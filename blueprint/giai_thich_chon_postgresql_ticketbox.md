# ADR-03b: Vì sao chọn PostgreSQL làm database chính cho TicketBox?

> Mục tiêu của tài liệu này là giải thích rõ: **vì sao nhóm chọn PostgreSQL làm database chính cho toàn bộ dữ liệu nghiệp vụ của TicketBox, thay vì chọn mỗi chức năng một loại database riêng.**

---

## 1. Bối cảnh bài toán

TicketBox là hệ thống bán vé concert chịu tải cao. Hệ thống có nhiều nhóm dữ liệu và chức năng khác nhau:

| Nhóm dữ liệu/chức năng | Ví dụ |
|---|---|
| Người dùng và phân quyền | users, roles, permissions |
| Concert và loại vé | concerts, artists, ticket_types, seat_zones |
| Mua vé | orders, order_items |
| Thanh toán | payments, idempotency_keys |
| Vé điện tử | tickets, ticket_qr_tokens |
| Soát vé | checkin_logs |
| CSV khách VIP | vip_guests, csv_import_jobs |
| AI Artist Bio | ai_bio_requests, artist_bios |
| File | PDF, CSV, SVG seat map, ảnh nghệ sĩ |
| Dữ liệu tạm | cache, rate limit counter, lock, idempotency key tạm |

Nếu nhìn riêng từng chức năng, có thể nghĩ rằng nên dùng nhiều loại database khác nhau:

| Chức năng | Database/công nghệ có thể dùng |
|---|---|
| Order, payment, ticket | PostgreSQL/MySQL |
| Concert search | Elasticsearch |
| Check-in log lớn | MongoDB/DynamoDB |
| Cache số vé còn lại | Redis |
| Analytics doanh thu lớn | ClickHouse/BigQuery |
| File PDF/CSV/SVG | Object Storage |
| Event stream | Kafka |

Tuy nhiên, trong phạm vi đồ án TicketBox, nhóm chọn:

> **PostgreSQL làm source of truth cho dữ liệu nghiệp vụ chính, kết hợp Redis, Queue và Object Storage làm các thành phần hỗ trợ.**

---

## 2. Các phương án được xem xét

| Phương án | Mô tả |
|---|---|
| **Một database chính: PostgreSQL** | Dùng PostgreSQL lưu dữ liệu nghiệp vụ cốt lõi: user, concert, order, payment, ticket, check-in. Redis/Object Storage/Queue chỉ đóng vai trò hỗ trợ. |
| **Polyglot Persistence** | Mỗi nhóm chức năng dùng database tối ưu riêng: PostgreSQL, MongoDB, Elasticsearch, Redis, ClickHouse... |
| **NoSQL-first** | Dùng MongoDB/DynamoDB làm database chính, chỉ dùng SQL khi thật sự cần. |
| **Database per service** | Mỗi service có database riêng: Order DB, Payment DB, Ticket DB, Check-in DB... |

---

## 3. Quyết định

Nhóm chọn:

> **PostgreSQL là database chính và là source of truth cho toàn bộ dữ liệu nghiệp vụ cốt lõi của TicketBox.**

Các công nghệ khác được dùng theo vai trò hỗ trợ:

| Thành phần | Vai trò |
|---|---|
| PostgreSQL | Source of truth cho user, concert, ticket type, order, payment, ticket, check-in log |
| Redis | Cache, rate limiting, lock/idempotency key tạm |
| Message Queue | Xử lý bất đồng bộ CSV import, AI Artist Bio, notification, reminder |
| Object Storage | Lưu file PDF, CSV, SVG seat map, ảnh |

Điều này có nghĩa là nhóm **không dùng PostgreSQL cho tất cả mọi thứ một cách máy móc**. Nhóm vẫn dùng Redis cho cache/rate limit, Object Storage cho file và Queue cho xử lý nền. Tuy nhiên, các dữ liệu quyết định trạng thái nghiệp vụ cuối cùng vẫn được lưu trong PostgreSQL.

---

## 4. Lý do 1: Luồng nghiệp vụ TicketBox liên kết chặt với nhau

Luồng mua vé không phải là một thao tác độc lập. Nó đi qua nhiều dữ liệu có quan hệ trực tiếp:

```text
Khán giả chọn vé
→ kiểm tra ticket_type còn vé không
→ tạo order
→ tạo payment
→ payment thành công
→ phát hành ticket
→ gửi e-ticket
→ check-in bằng QR tại cổng
```

Các bảng liên quan:

```text
users
→ orders
→ order_items
→ payments
→ tickets
→ checkin_logs
```

Nếu tách mỗi chức năng sang một database riêng, ví dụ:

| Thành phần | Database riêng |
|---|---|
| Order Service | PostgreSQL |
| Payment Service | MongoDB |
| Ticket Service | DynamoDB |
| Check-in Service | Elasticsearch/MongoDB |

thì một giao dịch mua vé phải đi qua nhiều database khác nhau. Khi đó, để đảm bảo:

- Thanh toán thành công thì chắc chắn phát hành vé.
- Không có hai người cùng nhận vé cuối cùng.
- Không phát hành ticket hai lần.
- Không cho user mua vượt giới hạn.

hệ thống phải xử lý thêm bài toán **distributed transaction**, **SAGA**, **eventual consistency** và **reconciliation**. Những phần này làm hệ thống phức tạp hơn rất nhiều so với phạm vi đồ án.

Vì vậy, với dữ liệu nghiệp vụ lõi có quan hệ chặt, một RDBMS như PostgreSQL là lựa chọn phù hợp hơn.

---

## 5. Lý do 2: TicketBox ưu tiên consistency ở luồng lõi

Trong TicketBox, một số lỗi dữ liệu có hậu quả rất nghiêm trọng:

| Lỗi dữ liệu | Hậu quả |
|---|---|
| Bán vượt số lượng vé | Nhiều người cùng có vé hợp lệ cho một khu/vị trí |
| Payment thành công nhưng không có ticket | Khách bị trừ tiền nhưng không nhận vé |
| Callback payment xử lý nhiều lần | Có thể phát hành vé trùng |
| Vé đã check-in nhưng vẫn được check-in lại | Có thể cho một vé vào cổng nhiều lần |
| User mua vượt giới hạn vé | Không công bằng với khán giả khác |

Những lỗi này không thể xử lý bằng eventual consistency đơn giản. Hệ thống cần **strong consistency** tại các điểm nghiệp vụ quan trọng.

PostgreSQL hỗ trợ:

| Cơ chế | Vai trò trong TicketBox |
|---|---|
| Transaction | Đảm bảo một nhóm thao tác cùng thành công hoặc cùng rollback |
| Row-level lock | Chống nhiều request cùng cập nhật số vé cuối cùng |
| Unique constraint | Chống trùng QR token, idempotency key |
| Foreign key | Giữ quan hệ đúng giữa order, payment, ticket |
| Isolation level | Giảm lỗi khi nhiều request đồng thời |
| Rollback | Hủy toàn bộ thay đổi nếu một bước thất bại |

Với luồng mua vé, PostgreSQL có thể xử lý theo hướng:

```text
BEGIN TRANSACTION
→ lock dòng ticket_type tương ứng
→ kiểm tra sold_quantity + requested_quantity <= total_quantity
→ kiểm tra user chưa vượt max_per_user
→ tạo order
→ cập nhật sold_quantity
→ COMMIT
```

Nếu bất kỳ bước nào thất bại, transaction rollback và hệ thống không tạo trạng thái dữ liệu nửa vời.

---

## 6. Lý do 3: Giảm độ phức tạp vận hành cho team 3 người

Dùng nhiều database có thể tối ưu từng chức năng, nhưng đổi lại hệ thống trở nên khó vận hành hơn.

| Nếu dùng nhiều database | Hệ quả |
|---|---|
| PostgreSQL cho order/payment | Cần vận hành RDBMS |
| MongoDB cho check-in log | Cần đồng bộ dữ liệu từ SQL sang NoSQL |
| Elasticsearch cho search concert | Cần pipeline index dữ liệu |
| ClickHouse cho analytics | Cần ETL hoặc event pipeline |
| DynamoDB cho ticket | Cần thiết kế partition key và consistency model |
| Redis cho cache | Cần xử lý TTL và cache invalidation |

Điều này làm tăng:

- Chi phí học công nghệ.
- Chi phí triển khai.
- Rủi ro dữ liệu lệch giữa các database.
- Độ khó khi debug.
- Độ khó khi demo.
- Độ khó khi giải thích trong báo cáo.

Với team 3 người và thời gian 40 ngày, mục tiêu tốt hơn là thiết kế một hệ thống **đúng, rõ, có trade-off hợp lý**, thay vì dùng quá nhiều công nghệ và làm tăng độ phức tạp không cần thiết.

---

## 7. Lý do 4: PostgreSQL đủ đáp ứng các nhóm dữ liệu nghiệp vụ hiện tại

Trong phạm vi đồ án, PostgreSQL có thể đáp ứng tốt các dữ liệu nghiệp vụ chính:

| Nhóm dữ liệu | Có phù hợp PostgreSQL không? | Lý do |
|---|---|---|
| User/RBAC | Có | Quan hệ user-role-permission rõ ràng |
| Concert | Có | Dữ liệu có cấu trúc, dễ query/filter |
| Ticket type/seat zone | Có | Có quan hệ với concert |
| Order/payment | Rất phù hợp | Cần transaction và constraint |
| Ticket QR | Rất phù hợp | Cần unique token và trạng thái rõ |
| Check-in log | Có, trong phạm vi đồ án | Cần audit và liên kết với ticket/staff/device |
| CSV import job | Có | Cần lưu trạng thái job và kết quả import |
| AI bio request | Có | Cần lưu trạng thái draft/failed/published |

Những phần không phù hợp lưu trực tiếp trong PostgreSQL sẽ được tách ra:

| Dữ liệu | Công nghệ phù hợp |
|---|---|
| PDF press kit | Object Storage |
| CSV file gốc | Object Storage |
| SVG seat map | Object Storage |
| Ảnh nghệ sĩ/concert | Object Storage |
| Cache concert list/detail | Redis |
| Rate limit counter | Redis |
| Job bất đồng bộ | Message Queue |

Như vậy, PostgreSQL không phải “làm tất cả”, mà chỉ giữ vai trò **nguồn dữ liệu chính xác cuối cùng**.

---

## 8. Vì sao không chọn database riêng cho từng chức năng?

### 8.1. Không chọn MongoDB cho check-in log làm database riêng

MongoDB lưu log linh hoạt, nhưng check-in log trong TicketBox cần liên kết với:

- ticket_id
- staff_id
- device_id
- concert_id
- trạng thái vé

Nếu lưu check-in log riêng trong MongoDB, hệ thống phải đồng bộ dữ liệu giữa PostgreSQL và MongoDB. Khi cần kiểm tra “vé này đã check-in chưa”, backend có thể phải đọc nhiều nguồn dữ liệu, tăng rủi ro lệch dữ liệu.

Trong phạm vi đồ án, lưu `checkin_logs` trong PostgreSQL giúp dễ audit và dễ đảm bảo một vé không được check-in hai lần.

### 8.2. Không chọn Elasticsearch cho concert search ở giai đoạn đầu

Elasticsearch phù hợp khi tìm kiếm full-text trên dữ liệu rất lớn. Tuy nhiên, TicketBox trong đồ án chủ yếu cần:

- xem danh sách concert sắp diễn ra,
- lọc theo trạng thái/time,
- xem chi tiết concert,
- hiển thị seat zone và availability.

Những truy vấn này PostgreSQL xử lý được với index phù hợp. Nếu sau này cần search nâng cao như gợi ý nghệ sĩ, tìm gần đúng, autocomplete đa ngôn ngữ, Elasticsearch có thể được bổ sung sau.

### 8.3. Không chọn ClickHouse/BigQuery cho report ở giai đoạn đầu

ClickHouse/BigQuery phù hợp cho analytics lớn, nhưng báo cáo trong đồ án chủ yếu gồm:

- số vé đã bán,
- doanh thu theo concert,
- số lượt check-in,
- trạng thái payment.

Các báo cáo này PostgreSQL có thể xử lý được trong phạm vi hiện tại. Khi dữ liệu tăng rất lớn, nhóm có thể tách analytics sang data warehouse sau.

### 8.4. Không chọn DynamoDB/NoSQL làm database chính

NoSQL có khả năng scale tốt, nhưng TicketBox cần nhiều ràng buộc quan hệ và transaction:

- một order có nhiều order_items,
- payment thuộc order,
- ticket phát hành từ order đã thanh toán,
- ticket liên kết với QR và check-in log,
- user bị giới hạn số vé theo ticket type.

Nếu dùng NoSQL làm chính, nhóm phải thiết kế access pattern, partition key, consistency model và xử lý transaction phức tạp hơn. Với đồ án thiết kế phần mềm, PostgreSQL giúp mô hình dữ liệu rõ ràng và dễ chứng minh tính đúng hơn.

---

## 9. Đánh đổi khi chọn PostgreSQL làm database chính

| Tiêu chí | Lợi ích | Đánh đổi |
|---|---|---|
| Consistency | Transaction mạnh, dễ chống oversell | Có thể nghẽn nếu lock quá nhiều |
| Data integrity | Có foreign key, unique constraint, rollback | Schema ít linh hoạt hơn NoSQL |
| ERD/Báo cáo | Dễ trình bày quan hệ dữ liệu | Cần migration khi đổi schema |
| Debug | Dữ liệu tập trung, dễ kiểm tra | Single primary DB có thể thành bottleneck |
| Prototype | Dễ seed data, dễ demo | Không thể hiện polyglot architecture phức tạp |
| Scale đọc | Có thể kết hợp Redis/read replica | Cần thiết kế cache invalidation |
| Scale ghi | Đủ cho phạm vi đồ án | Khó scale hơn NoSQL phân tán |
| Vận hành | Đơn giản hơn nhiều database | Không tối ưu riêng cho từng workload |

---

## 10. Vì sao lựa chọn này tối ưu hơn cho TicketBox hiện tại?

### 10.1. Tối ưu theo yêu cầu quan trọng nhất: đúng dữ liệu

TicketBox có thể chấp nhận trang concert hiển thị số vé còn lại gần đúng trong vài giây, nhưng không thể chấp nhận:

- bán vượt vé,
- trừ tiền hai lần,
- phát hành vé sai,
- cho một vé check-in nhiều lần.

Vì vậy, hệ thống cần tối ưu trước cho **correctness** ở luồng lõi. PostgreSQL phù hợp hơn vì có transaction và constraint.

### 10.2. Tối ưu theo phạm vi đồ án

Đồ án yêu cầu thiết kế đầy đủ nhưng team chỉ có 3 người. Nếu chọn database riêng cho từng chức năng, nhóm sẽ phải thiết kế thêm nhiều bài toán phụ như distributed transaction, data sync, ETL, duplicate detection giữa nhiều store. Điều này làm đồ án phức tạp quá mức.

### 10.3. Tối ưu theo khả năng mở rộng hợp lý

Chọn PostgreSQL không khóa chết hệ thống. Kiến trúc vẫn có hướng mở rộng:

| Khi cần mở rộng | Phương án |
|---|---|
| Đọc concert quá nhiều | Thêm Redis cache/read replica |
| Search phức tạp | Thêm Elasticsearch |
| Analytics lớn | Thêm ClickHouse/BigQuery |
| Check-in log cực lớn | Tách log sang NoSQL/time-series DB |
| Payment tách riêng | Tách Payment Service sau |
| Notification tăng mạnh | Scale Queue Worker |

Nói cách khác, nhóm chọn **một source of truth thống nhất ở giai đoạn đầu**, nhưng vẫn thiết kế mở để tách ra khi có lý do rõ ràng.

---

## 11. So sánh tổng hợp

| Tiêu chí | PostgreSQL làm DB chính | Database riêng từng chức năng |
|---|---|---|
| Consistency khi mua vé | Cao, dễ dùng transaction | Khó hơn, cần SAGA/distributed transaction |
| Chống oversell | Dễ chứng minh bằng lock/transaction | Khó hơn nếu order/ticket phân tán |
| Chống double payment | Dễ dùng unique constraint/idempotency | Cần đồng bộ nhiều store |
| Check-in audit | Dữ liệu tập trung, dễ truy vết | Có thể nhanh hơn nhưng cần sync |
| Độ phức tạp thiết kế | Vừa phải | Cao |
| Phù hợp team 3 người | Cao | Thấp |
| Phù hợp 40 ngày | Cao | Thấp |
| Tối ưu từng workload | Trung bình | Cao |
| Rủi ro vận hành | Thấp hơn | Cao hơn |
| Khả năng mở rộng tương lai | Có thể mở rộng từng phần sau | Mạnh hơn nhưng tốn công từ đầu |
