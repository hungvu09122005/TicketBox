# Bổ sung ADR & Trade-off cho phần A - TicketBox Blueprint

> Mục tiêu của file này: bổ sung phần **lý do lựa chọn thiết kế**, **vì sao không chọn phương án khác**, **đánh đổi khi chọn**, và **vì sao phương án được chọn phù hợp hơn với TicketBox**.  
> File này nên được đưa vào Blueprint dưới tên gợi ý: `04-design-decisions-adr.md` hoặc chèn vào cuối `01-system-design.md`.

---

## 1. Vì sao cần phần ADR / Trade-off?

Trong đồ án thiết kế phần mềm, chỉ nêu “hệ thống dùng PostgreSQL, Redis, Queue, C4, Modular Monolith” là chưa đủ. Nhóm cần chứng minh:

1. Vì sao chọn giải pháp đó?
2. Vì sao không chọn giải pháp khác?
3. Giải pháp đó đánh đổi điều gì?
4. Giải pháp đó tối ưu hơn trong bối cảnh TicketBox như thế nào?
5. Nếu hệ thống phát triển lớn hơn thì phương án mở rộng là gì?

Vì vậy, phần này dùng dạng **ADR - Architecture Decision Record** cho các quyết định kỹ thuật quan trọng.

---

# ADR-01: Chọn Modular Monolith thay vì Microservices

## Bối cảnh

TicketBox có nhiều nghiệp vụ: concert, ticket, order, payment, check-in, CSV import, AI Artist Bio, notification. Nhìn qua có thể tách thành nhiều service nhỏ, nhưng nhóm chỉ có 3 người và thời gian làm đồ án ngắn. Hệ thống cũng có các luồng cần tính nhất quán cao như mua vé, thanh toán và phát hành e-ticket.

## Các phương án xem xét

| Phương án | Mô tả |
|---|---|
| Big Monolith | Tất cả code nằm chung, ít ranh giới module. |
| Modular Monolith | Một backend deploy chung nhưng chia module rõ ràng theo nghiệp vụ. |
| Microservices | Tách Concert Service, Order Service, Payment Service, Ticket Service, Check-in Service... thành service riêng. |
| Serverless-first | Dùng nhiều function nhỏ cho từng tác vụ. |

## Quyết định

Chọn:

> **Modular Monolith + Layered Architecture + Queue-based asynchronous processing**

## Lý do chọn

| Lý do | Giải thích |
|---|---|
| Phù hợp team nhỏ | 3 người dễ quản lý một backend hơn nhiều service độc lập. |
| Dễ đảm bảo consistency | Luồng mua vé cần transaction giữa order, ticket type, payment và ticket. |
| Dễ triển khai prototype | Ít DevOps hơn microservices. |
| Vẫn có ranh giới rõ | Chia module theo nghiệp vụ: Auth, Concert, Order, Payment, Ticket, Check-in, CSV, AI. |
| Có đường mở rộng | Sau này có thể tách Payment, Notification, Check-in thành service riêng nếu cần. |

## Vì sao không chọn Microservices ngay?

| Lý do không chọn | Giải thích |
|---|---|
| Quá phức tạp vận hành | Cần service discovery, distributed tracing, CI/CD nhiều service. |
| Khó xử lý transaction | Mua vé cần consistency cao, microservices dễ sinh distributed transaction. |
| Tốn thời gian tích hợp | 40 ngày và 3 người không phù hợp để vận hành nhiều service. |
| Dễ lệch trọng tâm môn học | Môn này chấm thiết kế, không nên làm kiến trúc quá lớn nhưng thiếu phân tích sâu. |

## Đánh đổi

| Được | Mất |
|---|---|
| Dễ phát triển, dễ demo, dễ kiểm soát luồng mua vé | Khó scale từng module riêng lẻ như microservices |
| Dễ dùng transaction trong PostgreSQL | Nếu code boundary kém có thể thành monolith rối |
| Ít overhead vận hành | Khi hệ thống rất lớn sẽ cần tách service |

## Vì sao tối ưu hơn cho TicketBox?

TicketBox trong phạm vi đồ án cần chứng minh thiết kế đúng, có thể chạy prototype và xử lý được các bài toán chính như oversell, payment lỗi, offline check-in. Modular Monolith đủ mạnh để thiết kế rõ ràng, nhưng không tạo độ phức tạp vận hành quá mức như Microservices. Đây là lựa chọn cân bằng giữa **maintainability**, **consistency** và **feasibility**.

---

# ADR-02: Chọn Layered Architecture trong Backend

## Bối cảnh

Backend TicketBox có nhiều nghiệp vụ và cần tránh việc controller xử lý toàn bộ logic. Nếu không chia lớp, code dễ bị rối, khó test và khó bảo trì.

## Các phương án xem xét

| Phương án | Mô tả |
|---|---|
| Controller xử lý trực tiếp | Controller gọi DB, xử lý logic, gọi external service. |
| Layered Architecture | Controller/API → Application Service → Domain Logic → Repository. |
| Hexagonal/Clean Architecture đầy đủ | Domain ở trung tâm, mọi external dependency đi qua port/adapter. |

## Quyết định

Chọn:

> **Layered Architecture**, kết hợp tư duy **Port/Adapter** cho các tích hợp ngoài như Payment, AI, Notification, Object Storage.

## Lý do chọn

| Lý do | Giải thích |
|---|---|
| Dễ hiểu | Phù hợp với nhóm sinh viên và dễ trình bày trong báo cáo. |
| Tách trách nhiệm tốt | Controller nhận request, Service xử lý nghiệp vụ, Repository truy cập dữ liệu. |
| Dễ test | Có thể mock Repository/Adapter. |
| Dễ áp dụng SOLID | Mỗi lớp/module có trách nhiệm rõ ràng. |
| Không quá nặng | Nhẹ hơn Clean Architecture đầy đủ nhưng vẫn có cấu trúc tốt. |

## Vì sao không chọn Controller xử lý trực tiếp?

Vì sẽ vi phạm nguyên tắc trách nhiệm đơn nhất. Một controller vừa validate, vừa xử lý nghiệp vụ, vừa gọi DB, vừa gọi payment sẽ khó mở rộng và khó test. Khi cần đổi payment provider hoặc thêm AI provider, code dễ bị sửa lan rộng.

## Vì sao không chọn Clean Architecture quá đầy đủ?

Clean Architecture rất tốt nhưng có thể làm tăng số lượng interface, DTO, mapper, layer. Với đồ án 40 ngày, dùng Layered Architecture kết hợp Adapter cho external service là đủ rõ ràng và thực tế hơn.

## Đánh đổi

| Được | Mất |
|---|---|
| Dễ hiểu, dễ bảo trì, dễ test | Không “thuần Clean Architecture” hoàn toàn |
| Ít phức tạp hơn Clean Architecture | Một số dependency cần kiểm soát bằng convention |
| Dễ trình bày trong C4/Component Diagram | Cần discipline để không để Service làm quá nhiều việc |

## Vì sao tối ưu hơn cho TicketBox?

TicketBox có nhiều luồng quan trọng nhưng không cần over-engineering. Layered Architecture giúp nhóm thể hiện rõ thiết kế phần mềm, còn Adapter giúp cô lập Payment/AI/Notification. Đây là mức kiến trúc vừa đủ để đáp ứng yêu cầu môn học và prototype.

---

# ADR-03: Chọn PostgreSQL làm Database chính thay vì NoSQL

## Bối cảnh

TicketBox có các dữ liệu quan hệ chặt chẽ: user, concert, ticket type, order, payment, ticket, check-in log. Đặc biệt, luồng mua vé cần đảm bảo không bán vượt số lượng và không cho user mua vượt giới hạn.

## Các phương án xem xét

| Phương án | Ưu điểm | Nhược điểm |
|---|---|---|
| PostgreSQL/MySQL | Transaction mạnh, constraint, quan hệ rõ | Scale write khó hơn NoSQL |
| MongoDB | Linh hoạt schema, dễ lưu document | Khó enforce quan hệ và transaction phức tạp hơn |
| DynamoDB/NoSQL key-value | Scale lớn, latency thấp | Thiết kế access pattern khó, transaction/constraint hạn chế |
| Kết hợp SQL + NoSQL | Linh hoạt | Tăng độ phức tạp hệ thống |

## Quyết định

Chọn:

> **PostgreSQL là source of truth cho dữ liệu nghiệp vụ chính.**

## Lý do chọn

| Lý do | Giải thích |
|---|---|
| Cần transaction | Tạo order và trừ số lượng vé cần atomic. |
| Cần constraint | Unique QR token, unique idempotency key, foreign key. |
| Dữ liệu quan hệ mạnh | Concert - TicketType - Order - Payment - Ticket liên kết chặt. |
| Dễ truy vấn báo cáo | Doanh thu, số vé bán, check-in, lịch sử payment. |
| Phù hợp prototype | Dễ seed data, dễ demo, dễ giải thích ERD. |

## Vì sao không chọn MongoDB làm chính?

MongoDB linh hoạt nhưng TicketBox không chỉ lưu document; hệ thống cần ràng buộc quan hệ và transaction chính xác trong luồng mua vé. Nếu dùng MongoDB làm database chính, việc enforce oversell, per-user limit, payment-ticket consistency sẽ phức tạp hơn.

## Vì sao không chọn DynamoDB/NoSQL làm chính?

NoSQL có thể scale rất tốt, nhưng yêu cầu thiết kế access pattern chặt chẽ và khó trình bày ERD truyền thống. Với đồ án thiết kế phần mềm, PostgreSQL giúp thể hiện quan hệ dữ liệu, ràng buộc và transaction rõ hơn.

## Đánh đổi

| Được | Mất |
|---|---|
| Consistency mạnh cho mua vé | Scale write không dễ như NoSQL |
| Dễ thiết kế ERD và constraint | Cần tối ưu index/transaction khi tải cao |
| Dễ đảm bảo không oversell | Cần cache để giảm tải đọc |

## Vì sao tối ưu hơn cho TicketBox?

TicketBox có bài toán cốt lõi là không bán vượt vé và không trừ tiền/vé sai. PostgreSQL tối ưu hơn vì cung cấp transaction, locking và constraint rõ ràng. Các phần đọc nhiều sẽ được hỗ trợ bằng Redis, nên PostgreSQL không phải gánh toàn bộ tải đọc.

---

# ADR-04: Chọn Redis Cache-aside thay vì truy vấn DB trực tiếp hoặc Write-through Cache

## Bối cảnh

Trang danh sách concert và chi tiết concert bị đọc rất nhiều trong giờ mở bán. Nếu mỗi request đều truy vấn PostgreSQL, database có thể bị quá tải. Tuy nhiên, số vé còn lại thay đổi nhanh nên cache không được quá cũ.

## Các phương án xem xét

| Phương án | Mô tả |
|---|---|
| Không dùng cache | Mọi request đọc trực tiếp DB. |
| Cache-aside | App kiểm tra Redis trước, miss thì đọc DB rồi ghi cache. |
| Write-through | Mọi lần ghi dữ liệu đều ghi đồng thời vào cache. |
| Write-back | Ghi cache trước, ghi DB sau. |

## Quyết định

Chọn:

> **Redis Cache-aside cho concert list/detail và availability cache ngắn hạn.**

## Lý do chọn

| Lý do | Giải thích |
|---|---|
| Giảm tải DB | Dữ liệu concert bị đọc nhiều nhưng ít thay đổi. |
| Dễ kiểm soát TTL | Concert detail cache lâu hơn, availability cache ngắn hơn. |
| Dễ triển khai | Phù hợp prototype và báo cáo. |
| Có thể invalidate chủ động | Khi admin cập nhật concert hoặc payment success. |

## Vì sao không chọn truy vấn DB trực tiếp?

Vì đề có tình huống hàng nghìn request/giây vào trang chủ/trang chi tiết. DB trực tiếp sẽ trở thành bottleneck, nhất là trong phút đầu mở bán.

## Vì sao không chọn Write-back?

Write-back có nguy cơ mất dữ liệu nếu cache lỗi trước khi ghi DB. Với TicketBox, dữ liệu vé/order/payment cần an toàn, nên không phù hợp cho dữ liệu quan trọng.

## Đánh đổi

| Được | Mất |
|---|---|
| Giảm tải DB lớn | Có nguy cơ stale data |
| Tăng tốc response | Cần chiến lược invalidate/TTL |
| Dễ triển khai hơn write-through/write-back | Không phù hợp để quyết định cuối cùng còn vé hay không |

## Vì sao tối ưu hơn cho TicketBox?

Cache-aside phù hợp vì dữ liệu concert đọc nhiều và ít thay đổi. Riêng số vé còn lại chỉ cache ngắn hoặc invalidate khi giao dịch thành công. Quyết định cuối cùng khi checkout vẫn dựa trên PostgreSQL transaction, không dựa hoàn toàn vào Redis.

---

# ADR-05: Chọn Queue Worker cho CSV, AI, Notification thay vì xử lý đồng bộ

## Bối cảnh

Một số tác vụ trong TicketBox có thể tốn thời gian hoặc phụ thuộc external service:

- Import CSV khách VIP.
- AI Artist Bio từ PDF.
- Gửi email/app notification.
- Gửi reminder trước concert 24 giờ.

Nếu xử lý trực tiếp trong request chính, user/admin có thể phải chờ lâu hoặc request bị timeout.

## Các phương án xem xét

| Phương án | Mô tả |
|---|---|
| Xử lý đồng bộ | Request chờ đến khi tác vụ xong. |
| Queue Worker | Request tạo job, worker xử lý nền. |
| Cron script riêng | Chạy theo lịch, ít liên kết với hệ thống chính. |

## Quyết định

Chọn:

> **Message Queue + Queue Worker cho tác vụ nền.**

## Lý do chọn

| Lý do | Giải thích |
|---|---|
| Không block request chính | Upload CSV/PDF trả kết quả nhanh hơn. |
| Chịu lỗi tốt hơn | Job có thể retry khi AI/email lỗi. |
| Dễ scale worker | Khi nhiều CSV/AI job, tăng số worker. |
| Phù hợp reminder 24h | Scheduled job có thể publish reminder vào queue. |

## Vì sao không xử lý đồng bộ?

Vì AI Service hoặc CSV lớn có thể chậm. Nếu request HTTP phải chờ, hệ thống dễ timeout và làm admin nghĩ thao tác thất bại.

## Đánh đổi

| Được | Mất |
|---|---|
| Tăng khả năng chịu lỗi | Tăng độ phức tạp vận hành |
| Dễ retry job | Cần lưu trạng thái job |
| Request nhanh hơn | Kết quả không có ngay lập tức |

## Vì sao tối ưu hơn cho TicketBox?

Các tác vụ như CSV, AI, notification không cần hoàn thành tức thì trong request đầu tiên. Queue giúp hệ thống chính vẫn ổn định, đặc biệt khi đang mở bán vé và backend cần ưu tiên checkout/order.

---

# ADR-06: Chọn Payment Adapter + Circuit Breaker thay vì gọi Payment Gateway trực tiếp

## Bối cảnh

TicketBox tích hợp cổng thanh toán như VNPAY/MoMo. Các cổng này có thể timeout, lỗi hoặc gửi callback nhiều lần. Hệ thống cần đảm bảo payment lỗi không kéo sập toàn bộ dịch vụ.

## Các phương án xem xét

| Phương án | Mô tả |
|---|---|
| Gọi trực tiếp VNPAY/MoMo trong PaymentService | Nhanh để code nhưng coupling cao. |
| Payment Adapter | Định nghĩa interface chung, mỗi provider có adapter riêng. |
| Payment Adapter + Circuit Breaker | Adapter kết hợp timeout, fallback, open/half-open/closed. |

## Quyết định

Chọn:

> **Payment Adapter + Circuit Breaker + Timeout + Idempotency.**

## Lý do chọn

| Lý do | Giải thích |
|---|---|
| Dễ thay cổng thanh toán | Thêm MoMo/ZaloPay không sửa luồng chính. |
| Giảm coupling | Domain không phụ thuộc SDK cụ thể. |
| Chịu lỗi tốt hơn | Circuit Breaker ngăn gọi gateway khi lỗi kéo dài. |
| Phù hợp SOLID | Áp dụng OCP và DIP. |

## Vì sao không gọi trực tiếp Payment Gateway?

Vì sẽ làm PaymentService phụ thuộc chặt vào SDK/API cụ thể. Khi đổi cổng thanh toán hoặc thêm provider mới, phải sửa nhiều code. Ngoài ra, nếu gateway lỗi, lỗi dễ lan vào luồng checkout.

## Đánh đổi

| Được | Mất |
|---|---|
| Dễ mở rộng provider | Cần thiết kế interface tốt |
| Cô lập lỗi tốt | Tăng một lớp abstraction |
| Dễ test bằng MockPaymentProvider | Cần xử lý mapping response từng provider |

## Vì sao tối ưu hơn cho TicketBox?

Đề yêu cầu hệ thống dễ bổ sung kênh/thành phần ngoài và không bị payment kéo sập. Adapter + Circuit Breaker đáp ứng trực tiếp yêu cầu này: Payment lỗi thì chỉ luồng thanh toán bị ảnh hưởng, còn xem concert vẫn hoạt động.

---

# ADR-07: Chọn Idempotency Key cho Payment thay vì chỉ dựa vào trạng thái client

## Bối cảnh

User có thể bấm thanh toán nhiều lần, mạng có thể ngắt giữa chừng, hoặc Payment Gateway gửi callback lặp. Nếu backend xử lý mỗi request như mới, user có thể bị trừ tiền hoặc nhận vé sai.

## Các phương án xem xét

| Phương án | Vấn đề |
|---|---|
| Chỉ disable nút trên frontend | Không đủ, user có thể refresh, gửi lại request, mạng lỗi. |
| Chỉ tin Payment Gateway | Không kiểm soát được callback lặp hoặc retry từ client. |
| Idempotency Key ở backend | Backend nhận diện request trùng và trả kết quả cũ. |

## Quyết định

Chọn:

> **Idempotency Key được lưu ở backend, có unique constraint và TTL phù hợp.**

## Lý do chọn

| Lý do | Giải thích |
|---|---|
| Backend kiểm soát được trùng lặp | Không phụ thuộc hoàn toàn vào frontend. |
| Chống double charge | Cùng key không tạo nhiều payment. |
| Chống phát hành vé hai lần | Callback lặp không tạo ticket lặp. |
| Dễ audit | Có record payment/idempotency để kiểm tra. |

## Đánh đổi

| Được | Mất |
|---|---|
| An toàn hơn cho payment | Cần lưu key và trạng thái xử lý |
| Dễ xử lý retry | Cần định nghĩa TTL/key format |
| Giảm lỗi do mạng | Tăng logic backend |

## Vì sao tối ưu hơn cho TicketBox?

TicketBox có rủi ro “trừ tiền nhưng không nhận vé” và “bấm nhiều lần”. Idempotency Key là giải pháp phù hợp vì giải quyết đúng lỗi retry/double-submit ở luồng thanh toán.

---

# ADR-08: Chọn PostgreSQL Transaction/Lock cho chống Oversell thay vì chỉ dùng Redis Lock

## Bối cảnh

Một số loại vé có số lượng rất ít, trong khi hàng chục nghìn người mua cùng lúc. Hệ thống phải đảm bảo không có hai người cùng nhận vé cuối cùng.

## Các phương án xem xét

| Phương án | Ưu điểm | Nhược điểm |
|---|---|---|
| Chỉ dùng Redis counter | Nhanh | Redis không nên là source of truth cho order/payment |
| Redis distributed lock | Nhanh, giảm DB conflict | Cần xử lý TTL, lock release, split-brain edge cases |
| DB transaction + row lock | Đúng và dễ chứng minh consistency | Có thể nghẽn nếu cạnh tranh quá cao |
| Optimistic locking | Ít lock hơn | Khi conflict cao sẽ retry nhiều |
| Queue theo từng loại vé | Công bằng, kiểm soát tốt | User phải chờ, thiết kế phức tạp hơn |

## Quyết định

Chọn:

> **PostgreSQL transaction kết hợp pessimistic row-level lock (`SELECT ... FOR UPDATE`) là cơ chế quyết định cuối cùng; Redis chỉ hỗ trợ cache, rate limit, waiting room, idempotency và short-lived coordination.**

## Lý do chọn

| Lý do | Giải thích |
|---|---|
| Đảm bảo consistency rõ ràng | DB transaction atomic. |
| Dễ trình bày và chứng minh | Phù hợp môn thiết kế phần mềm. |
| Dữ liệu order/ticket nằm trong DB | Lock ngay source of truth. |
| Giảm nguy cơ oversell | Chỉ commit khi đủ vé. |

## Vì sao không chỉ dùng Redis Lock?

Redis lock nhanh nhưng nếu dùng sai TTL hoặc service crash khi giữ lock thì dễ tạo lỗi. Ngoài ra, Redis không phải nơi lưu order/payment cuối cùng. Vẫn cần DB để commit dữ liệu thật.

## Đánh đổi

| Được | Mất |
|---|---|
| Đảm bảo không oversell tốt hơn | Có thể tăng contention ở DB |
| Dễ chứng minh correctness | Cần tối ưu transaction ngắn |
| Phù hợp dữ liệu quan hệ | Cần cache/rate limit để giảm request vào DB |

## Vì sao tối ưu hơn cho TicketBox?

TicketBox ưu tiên đúng dữ liệu hơn tốc độ tuyệt đối ở điểm checkout. Trang xem concert có thể cache, nhưng lúc bấm mua vé thì hệ thống phải chính xác. Vì vậy DB transaction là lựa chọn phù hợp nhất cho luồng quyết định cuối cùng.

---

# ADR-09: Chọn Offline-first Check-in có Sync thay vì Online-only

## Bối cảnh

Sân vận động hoặc nhà thi đấu có thể có sóng yếu khi hàng chục nghìn người tập trung. Nhân sự soát vé vẫn cần quét QR và không được để mất dữ liệu.

## Các phương án xem xét

| Phương án | Ưu điểm | Nhược điểm |
|---|---|---|
| Online-only | Đơn giản, server kiểm tra ngay | Mất mạng là không check-in được |
| Offline-first local storage + sync | Vẫn check-in khi mất mạng | Cần xử lý conflict |
| Full local replica toàn bộ DB | Offline mạnh | Nặng, rủi ro bảo mật, đồng bộ phức tạp |

## Quyết định

Chọn:

> **Mobile App lưu dữ liệu cần thiết trước sự kiện, check-in offline bằng local storage, sau đó sync lên server.**

## Lý do chọn

| Lý do | Giải thích |
|---|---|
| Phù hợp điều kiện sân vận động | Mất mạng vẫn quét được. |
| Không cần copy toàn bộ DB | Chỉ sync dữ liệu vé/sự kiện cần thiết. |
| Server vẫn là source of truth | Khi online lại, server xử lý conflict cuối cùng. |
| Dễ trình bày flow | Có local queue, sync API, conflict handling. |

## Đánh đổi

| Được | Mất |
|---|---|
| Soát vé không phụ thuộc mạng 100% | Có nguy cơ conflict khi nhiều thiết bị offline |
| Trải nghiệm cổng vào tốt hơn | Cần cơ chế sync và audit log |
| Không mất log check-in | Cần bảo vệ local data |

## Vì sao tối ưu hơn cho TicketBox?

Đề nêu rõ địa điểm concert có sóng không ổn định. Online-only không đáp ứng yêu cầu. Offline-first có sync là lựa chọn cân bằng giữa khả năng vận hành thực tế và độ phức tạp vừa phải.

---

# ADR-10: Chọn Object Storage cho PDF/CSV/SVG thay vì lưu file trực tiếp trong Database

## Bối cảnh

TicketBox cần lưu nhiều loại file:

- PDF hồ sơ nghệ sĩ.
- CSV khách VIP.
- SVG sơ đồ chỗ ngồi.
- Ảnh concert/nghệ sĩ.
- Có thể có QR image nếu cần.

## Các phương án xem xét

| Phương án | Ưu điểm | Nhược điểm |
|---|---|---|
| Lưu file binary trong database | Dễ backup cùng DB | DB phình to, truy vấn chậm |
| Lưu file trong local filesystem | Dễ prototype | Khó scale nhiều server |
| Object Storage | Phù hợp file lớn, dễ scale | Cần quản lý URL/permission |

## Quyết định

Chọn:

> **Object Storage lưu file, PostgreSQL chỉ lưu metadata và đường dẫn file.**

## Lý do chọn

| Lý do | Giải thích |
|---|---|
| Phù hợp file lớn | PDF/CSV/ảnh/SVG không làm DB nặng. |
| Dễ scale | Khi backend scale nhiều instance, file vẫn dùng chung. |
| Tách dữ liệu nghiệp vụ và file | DB lưu metadata, storage lưu binary. |
| Dễ tích hợp worker | Worker đọc PDF/CSV từ storage để xử lý. |

## Đánh đổi

| Được | Mất |
|---|---|
| Database nhẹ hơn | Cần quản lý quyền truy cập file |
| Dễ scale backend | Cần thêm storage component |
| Phù hợp AI/CSV worker | Cần xử lý file lifecycle |

## Vì sao tối ưu hơn cho TicketBox?

PDF/CSV/SVG là file, không phải dữ liệu quan hệ chính. Lưu chúng trong Object Storage giúp database tập trung vào dữ liệu nghiệp vụ như order/payment/ticket.

---

# ADR-11: Chọn JWT + Backend RBAC Guard thay vì Session-only hoặc ABAC phức tạp

## Bối cảnh

TicketBox có Audience Web, Admin Web và Mobile Check-in App. Hệ thống cần xác thực thống nhất trên nhiều client, đồng thời quyền có thể thay đổi khi Admin cập nhật role/permission.

## Các phương án xem xét

| Phương án | Ưu điểm | Nhược điểm |
|---|---|---|
| Session-based auth | Revoke session trực tiếp, đơn giản cho web truyền thống | Cần session store khi scale; mobile tích hợp kém thuận tiện hơn |
| JWT chứa toàn bộ permissions | Ít lookup ở server | Token lớn; quyền dễ bị stale đến khi token hết hạn |
| JWT claim tối thiểu + RBAC Guard/Redis cache | Phù hợp web/mobile, permission cập nhật nhanh hơn | Tăng một lookup cache và cần quản lý version/invalidation |
| ABAC | Linh hoạt theo nhiều thuộc tính | Rule engine và audit phức tạp, quá mức cho phạm vi đồ án |

## Quyết định

Chọn:

> **JWT cho authentication; Backend RBAC Guard + permission cache + ownership check cho authorization. JWT chỉ chứa `user_id`, role cơ bản, `permission_version`, `jti` và thời hạn — không chứa toàn bộ permission.**

## Lý do chọn

| Lý do | Giải thích |
|---|---|
| Phù hợp web và mobile | Cùng một access-token flow cho Audience/Admin/Mobile. |
| Backend dễ scale ngang | Không cần giữ session trong memory của một instance. |
| Giảm stale permission | Admin đổi quyền thì tăng `permission_version` và invalidate Redis cache. |
| Role của TicketBox rõ ràng | Audience, Organizer, Check-in Staff, System Admin phù hợp RBAC. |
| Bảo vệ dữ liệu cá nhân | Ownership check đảm bảo user chỉ đọc order/ticket của mình. |

## Vì sao không nhét toàn bộ permission vào JWT?

Permission có thể bị thay đổi trong khi token còn hạn. Nếu toàn bộ permission nằm trong JWT, token cũ vẫn tiếp tục mang quyền cũ. Thiết kế hiện tại dùng token ngắn hạn và tra permission từ Redis/PostgreSQL theo `permission_version`, nên thay đổi quyền phản ánh nhanh và token nhỏ hơn.

## Row Level Security

PostgreSQL RLS là lớp defense-in-depth có thể bổ sung, nhưng không bắt buộc trong prototype. Nếu triển khai, Backend phải đặt user context theo từng transaction/connection; không dùng `auth.uid()` vì đây không phải hàm PostgreSQL tiêu chuẩn của kiến trúc này.

## Đánh đổi

| Được | Mất |
|---|---|
| Phù hợp nhiều client, Backend gần stateless | Cần refresh/revocation strategy |
| Quyền cập nhật nhanh hơn JWT chứa full permissions | Mỗi request cần Redis lookup hoặc DB fallback |
| RBAC dễ audit và trình bày | Kém linh hoạt hơn ABAC |
| Ownership check rõ ràng | Repository/service phải áp dụng scope nhất quán |

## Vì sao tối ưu hơn cho TicketBox?

TicketBox có số role hữu hạn và ranh giới chức năng rõ. JWT claim tối thiểu kết hợp Backend RBAC Guard cân bằng giữa khả năng scale, tính cập nhật của permission và độ phức tạp vừa sức với team 3 người.

---

# ADR-12: Chọn Seat Map theo Zone/SVG thay vì chọn từng ghế chi tiết

## Bối cảnh

Đề yêu cầu sơ đồ chỗ ngồi SVG tương tác theo khu như GA, SVIP, VIP, CAT1, CAT2. Hệ thống cần hiển thị số vé còn lại theo từng loại/khu.

## Các phương án xem xét

| Phương án | Ưu điểm | Nhược điểm |
|---|---|---|
| Zone-based seat map | Đơn giản, phù hợp loại vé theo khu | Không chọn từng ghế cụ thể |
| Seat-level map | Chính xác từng ghế | Dữ liệu và UI phức tạp hơn |
| Không dùng seat map | Đơn giản nhất | Không đáp ứng yêu cầu đề |

## Quyết định

Chọn:

> **Seat Map SVG theo khu/zone, liên kết với ticket type và availability theo zone.**

## Lý do chọn

| Lý do | Giải thích |
|---|---|
| Bám đúng yêu cầu | Đề nêu các khu GA, SVIP, VIP, CAT1, CAT2. |
| Dễ thiết kế hơn seat-level | Không cần quản lý từng ghế. |
| Phù hợp concert GA/zone | Nhiều concert bán vé theo khu. |
| Dễ cache availability | Cache theo ticket type/zone. |

## Đánh đổi

| Được | Mất |
|---|---|
| Dễ triển khai, dễ demo | Không chọn được ghế cụ thể |
| Phù hợp vé theo khu | Ít chi tiết hơn seat-level map |
| Dễ scale hơn | Không đáp ứng event cần seat assignment chính xác |

## Vì sao tối ưu hơn cho TicketBox?

Đề mô tả theo khu vé, không bắt buộc chọn từng ghế. Zone-based SVG giúp đáp ứng yêu cầu tương tác mà không làm hệ thống phức tạp quá mức.

---

# ADR-13: Chọn Adapter cho AI/Notification để dễ mở rộng

## Bối cảnh

Hệ thống cần tạo Artist Bio từ PDF và gửi thông báo qua app/email. Trong tương lai có thể bổ sung kênh Zalo OA, SMS hoặc đổi AI provider.

## Các phương án xem xét

| Phương án | Mô tả |
|---|---|
| Gọi trực tiếp AI/email provider | Nhanh nhưng coupling cao. |
| Dùng adapter/interface | Tách domain khỏi provider cụ thể. |
| Dùng một service external chung cho mọi tích hợp | Dễ tập trung nhưng interface dễ phình to. |

## Quyết định

Chọn:

> **AI Adapter và Notification Adapter riêng, mỗi adapter implement interface riêng.**

## Lý do chọn

| Lý do | Giải thích |
|---|---|
| Dễ thay provider | Đổi AI/email không ảnh hưởng business flow. |
| Đúng Open/Closed Principle | Thêm provider mới bằng cách thêm implementation. |
| Đúng Dependency Inversion | Module nghiệp vụ phụ thuộc interface, không phụ thuộc SDK cụ thể. |
| Dễ test | Có thể dùng mock adapter trong prototype. |

## Đánh đổi

| Được | Mất |
|---|---|
| Giảm coupling | Tăng số interface/class |
| Dễ mở rộng provider | Cần design contract ổn |
| Dễ mock/test | Cần mapping lỗi từng provider |

## Vì sao tối ưu hơn cho TicketBox?

Đề yêu cầu dễ bổ sung kênh thông báo mới. Adapter là lựa chọn phù hợp vì mở rộng không làm thay đổi lớn luồng nghiệp vụ hiện tại.

---

# 2. Bảng tổng hợp quyết định thiết kế

| Quyết định | Lựa chọn | Không chọn | Đánh đổi chính |
|---|---|---|---|
| Kiến trúc backend | Modular Monolith | Microservices ngay từ đầu | Dễ làm, dễ consistency nhưng scale từng module kém hơn |
| Kiến trúc code | Layered + Adapter | Controller xử lý trực tiếp | Rõ trách nhiệm nhưng cần discipline |
| Database chính | PostgreSQL | MongoDB/DynamoDB làm chính | Consistency tốt nhưng cần cache để giảm tải |
| Cache | Redis Cache-aside | DB trực tiếp / Write-back | Giảm tải DB nhưng cần TTL/invalidate |
| Async tasks | Queue Worker | Xử lý đồng bộ | Request nhanh hơn nhưng tăng độ phức tạp |
| Payment | Adapter + Circuit Breaker | Gọi trực tiếp Gateway | Cô lập lỗi tốt nhưng thêm abstraction |
| Double payment | Idempotency Key | Chỉ disable frontend | An toàn hơn nhưng thêm logic backend |
| Oversell | DB transaction/lock | Chỉ Redis lock | Đúng dữ liệu hơn nhưng có contention |
| Check-in | Offline-first + sync | Online-only | Vận hành tốt hơn nhưng phải xử lý conflict |
| File storage | Object Storage | DB blob | DB nhẹ hơn nhưng cần quản lý file |
| Authz | JWT + RBAC | Session-only/ABAC | Dễ scale nhưng cần refresh/revoke strategy |
| Seat map | Zone-based SVG | Seat-level map | Đơn giản hơn nhưng không chọn ghế cụ thể |

---

# 3. Cách đưa phần này vào báo cáo

Nên đặt phần này trong `01-system-design.md` hoặc tạo file riêng:

```text
blueprint/
├── 01-system-design.md
├── 02-c4-diagram.md
├── 03-high-level-architecture.md
├── 04-design-decisions-adr.md
```

Nếu đưa vào báo cáo PDF, nên đặt sau phần “Kiến trúc tổng thể” và trước phần “C4 Diagram”.

Cấu trúc đề xuất:

```text
4. Các quyết định thiết kế quan trọng
   4.1. Chọn Modular Monolith thay vì Microservices
   4.2. Chọn PostgreSQL thay vì NoSQL làm database chính
   4.3. Chọn Redis Cache-aside
   4.4. Chọn Queue Worker cho tác vụ nền
   4.5. Chọn Payment Adapter + Circuit Breaker
   4.6. Chọn DB Transaction để chống oversell
   4.7. Chọn Offline-first Check-in
   4.8. Chọn RBAC cho kiểm soát truy cập
```

---

# 4. Checklist tự kiểm tra phần trade-off

- [ ] Mỗi lựa chọn lớn đều có ít nhất 2 phương án thay thế.
- [ ] Có giải thích vì sao không chọn phương án thay thế.
- [ ] Có bảng “Được/Mất” hoặc “Ưu/Nhược”.
- [ ] Có câu kết luận vì sao phù hợp với TicketBox.
- [ ] Có liên kết với yêu cầu đề: tải đột biến, payment lỗi, offline check-in, CSV, AI, per-user limit, caching.
- [ ] Không viết chung chung kiểu “vì tốt hơn”, mà phải nói rõ tốt hơn ở tiêu chí nào: consistency, maintainability, scalability, fault tolerance, feasibility.
