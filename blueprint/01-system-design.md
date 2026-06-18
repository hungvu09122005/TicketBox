# 01 - Tài liệu thiết kế hệ thống TicketBox

## 1. Mục tiêu thiết kế

TicketBox là hệ thống bán vé concert chịu tải cao, phục vụ toàn bộ quy trình từ khi ban tổ chức mở bán vé đến khi khán giả vào cổng sự kiện.

Hệ thống cần phục vụ các nhóm người dùng chính:

| Nhóm người dùng | Nhu cầu chính |
|---|---|
| Khán giả | Xem concert, xem sơ đồ chỗ ngồi SVG, mua vé, nhận e-ticket QR, check-in tại cổng. |
| Ban tổ chức | Tạo concert, cấu hình loại vé, theo dõi doanh thu, upload PDF để tạo Artist Bio, import CSV khách VIP. |
| Nhân sự soát vé | Dùng mobile app để quét QR, hỗ trợ soát vé khi offline và tự đồng bộ lại. |
| Admin hệ thống | Quản lý user, role, permission và kiểm soát truy cập. |

Các vấn đề thiết kế quan trọng:

- Website có thể bị quá tải khi mở bán, ví dụ 80.000 người truy cập trong 5 phút đầu, phần lớn dồn vào phút đầu.
- Một số loại vé ít chỗ, ví dụ SVIP chỉ có khoảng 200 vé, nhưng có rất nhiều người mua cùng lúc.
- Hệ thống phải tránh oversell, tức không để hai khán giả cùng nhận được vé cuối cùng.
- Payment Gateway như VNPAY/MoMo có thể timeout, lỗi kéo dài hoặc gửi callback nhiều lần.
- Hệ thống phải tránh trừ tiền hoặc phát hành vé hai lần khi người dùng bấm thanh toán nhiều lần.
- Trang danh sách concert và chi tiết concert bị đọc rất nhiều, cần cache hợp lý.
- Mobile check-in phải hoạt động khi mạng yếu/mất mạng và không để một vé vào cổng hai lần.
- CSV khách VIP chỉ được nhập một chiều theo file, có thể có dữ liệu lỗi/trùng.
- AI Artist Bio là external service, có thể chậm hoặc lỗi, nên cần cô lập khỏi luồng chính.

Mục tiêu thiết kế:

- Kiến trúc rõ ràng, dễ hiểu, dễ bảo trì.
- Tách trách nhiệm tốt giữa client, backend, database, cache, queue và external service.
- Có khả năng mở rộng khi tải tăng.
- Đảm bảo consistency trong luồng mua vé.
- Cô lập lỗi từ Payment Gateway, AI Service, CSV Import và Notification Service.
- Bám sát kiến thức thiết kế phần mềm: SOLID, C4 Model, layered architecture, design pattern, queue-based asynchronous processing.

---

## 2. Phạm vi hệ thống

### 2.1. In scope

| Thành phần | Mô tả |
|---|---|
| Audience Web App | Khán giả xem concert, xem sơ đồ chỗ ngồi SVG, chọn vé, thanh toán, nhận QR e-ticket. |
| Admin Web App | Ban tổ chức tạo/cập nhật/hủy concert, cấu hình loại vé, upload PDF, import CSV, xem thống kê. |
| Check-in Mobile App | Nhân sự soát vé quét QR, check-in online, check-in offline và sync lại. |
| Backend API | Xử lý nghiệp vụ chính: Auth, Concert, Seat Map, Order, Payment, Ticket, Check-in, CSV, AI, Notification. |
| PostgreSQL | Lưu dữ liệu chính cần consistency: user, concert, ticket type, order, payment, ticket, check-in log. |
| Redis | Cache concert, cache availability ngắn hạn, rate limiting, hỗ trợ lock/idempotency. |
| Message Queue (bullMQ trên Redis) | Tách tác vụ nền khỏi request chính: CSV Import, AI Bio, notification, reminder. |
| Queue Worker (NestJS/Node.js) | Xử lý job bất đồng bộ từ bullMQ. |
| Object Storage | Lưu PDF, CSV, ảnh, SVG seat map, file liên quan. |
| External Services | Payment Gateway, AI Service, Email/App Notification Service. |

### 2.2. Out of scope

| Không làm sâu | Lý do |
|---|---|
| Payment production thật | Có thể dùng mock/sandbox để tập trung vào thiết kế. |
| Hạ tầng multi-region production | Quá lớn so với phạm vi môn học. |
| Tự train AI model | Chỉ cần tích hợp AI service hoặc mock AI adapter. |
| Microservices đầy đủ | Không phù hợp team nhỏ và thời gian 40 ngày. |
| Bot detection nâng cao | Có thể mô tả bằng rate limit/waiting room ở mức thiết kế. |

---

## 3. Quality Attributes

| Thuộc tính chất lượng | Cách thiết kế đáp ứng |
|---|---|
| Scalability | Web/backend stateless để scale ngang; Redis cache giảm tải DB; worker scale ngang theo queue. |
| Availability | Lỗi Payment/AI/Notification không kéo sập toàn hệ thống; có graceful degradation. |
| Consistency | PostgreSQL là source of truth; mua vé dùng transaction/lock để tránh oversell. |
| Performance | Cache concert list/detail; availability cache TTL ngắn; async queue cho tác vụ chậm. |
| Maintainability | Modular monolith, layered architecture, module boundary rõ ràng. |
| Security | JWT/RBAC, kiểm tra quyền ở API, admin/mobile giới hạn theo role. |
| Fault Tolerance | Circuit breaker, timeout, retry có giới hạn, dead-letter queue cho job lỗi. |
| Extensibility | Adapter/port cho Payment, AI, Notification để dễ thêm provider mới. |
| Fairness | Rate limit theo IP/user/device, per-user ticket limit, idempotency, có thể mở rộng waiting room. |

---

## 4. Kiến trúc tổng thể được chọn

Đề xuất:

> **Client-Server + Modular Monolith Backend + Layered Architecture + Queue-based Asynchronous Processing**

### 4.1. Client-Server

Audience Web, Admin Web và Mobile App giao tiếp với Backend API qua HTTPS/REST. Client không truy cập trực tiếp database, Redis hoặc Payment Gateway.

### 4.2. Modular Monolith Backend

Backend được triển khai trong một ứng dụng nhưng chia module rõ ràng:

| Module | Trách nhiệm |
|---|---|
| Auth/RBAC Module | Đăng nhập, JWT, role, permission. |
| Concert Module | Quản lý concert, thông tin nghệ sĩ, trạng thái publish/cancel. |
| Seat Map Module | Quản lý sơ đồ chỗ ngồi SVG và metadata theo khu. |
| Ticket Type Module | Quản lý loại vé, giá, số lượng, thời gian mở bán, limit per-user. |
| Order Module | Tạo order, giữ vé, kiểm tra tồn kho và giới hạn mua. |
| Payment Module | Tạo payment, xử lý callback, idempotency, payment timeout. |
| Ticket Module | Sinh e-ticket QR, quản lý trạng thái vé. |
| Check-in Module | Verify QR, check-in online, nhận sync offline. |
| CSV Import Module | Tạo job import khách VIP từ CSV. |
| AI Bio Module | Tạo job xử lý PDF và lưu Artist Bio draft. |
| Notification Module | Gửi email/app notification, reminder trước concert 24 giờ. |
| Common Module | Logging, error handling, middleware, guard, config. |

### 4.3. Layered Architecture

Bên trong backend, mỗi module nên theo các lớp:

```text
Controller/API Layer
→ Application Service Layer
→ Domain Logic Layer
→ Repository/Data Access Layer
```

Ý nghĩa:

- Controller chỉ nhận request/response.
- Application Service điều phối use case.
- Domain Logic chứa rule nghiệp vụ.
- Repository truy cập PostgreSQL/Redis.

### 4.4. Queue-based Async Processing

Các tác vụ chậm hoặc không cần phản hồi tức thì được đưa vào queue:

| Tác vụ | Lý do đưa vào queue |
|---|---|
| Gửi e-ticket/email | Không nên làm checkout bị chậm. |
| Reminder trước concert 24 giờ | Chạy theo lịch, không liên quan request user. |
| CSV Import | File có thể lớn, dữ liệu có thể lỗi/trùng. |
| AI Artist Bio | AI service có thể chậm hoặc timeout. |
| Generate report/statistic | Không cần phản hồi tức thì. |

---

## 5. Vì sao chọn Modular Monolith thay vì Microservices?

| Tiêu chí | Modular Monolith | Microservices |
|---|---|---|
| Phù hợp team 3 người | Cao | Thấp |
| Độ phức tạp triển khai | Thấp hơn | Cao hơn |
| Kiểm soát transaction mua vé | Dễ hơn | Khó hơn vì distributed transaction |
| Phù hợp 40 ngày | Cao | Thấp |
| Khả năng mở rộng sau này | Có thể tách dần module | Tốt nhưng cần vận hành mạnh |

**Quyết định:** Chọn modular monolith cho phạm vi đồ án, nhưng module boundary cần rõ để sau này có thể tách Payment, Notification, Check-in hoặc CSV Worker thành service độc lập.

---

## 6. Các thành phần chính và cách giao tiếp

| Thành phần | Vai trò | Giao tiếp |
|---|---|---|
| Audience Web App | Xem concert, seat map, mua vé, xem e-ticket | HTTPS/REST đến Backend API |
| Admin Web App | Quản lý concert, vé, CSV, PDF/AI Bio | HTTPS/REST đến Backend API |
| Check-in Mobile App | Quét QR, lưu offline, sync lại | HTTPS/REST; Local Storage khi offline |
| API Gateway/Load Balancer | Điều phối request, điểm đặt rate limit | HTTP/HTTPS |
| Backend API | Xử lý nghiệp vụ chính | REST, SQL, Redis, Queue |
| PostgreSQL | Source of truth | SQL |
| Redis | Cache/rate limit/lock/idempotency hỗ trợ | Redis protocol |
| Message Queue (bullMQ) | Lưu job/event bất đồng bộ | Redis/bullMQ |
| Queue Worker (NestJS/Node.js) | Xử lý CSV, AI, notification, reminder | Consume bullMQ jobs, cập nhật DB |
| Object Storage | Lưu PDF, CSV, SVG, ảnh, QR nếu cần | SDK/API |
| Payment Gateway | Xử lý thanh toán | HTTPS qua Payment Adapter |
| AI Service | Generate Artist Bio | HTTPS qua AI Adapter |
| Email/App Notification Service | Gửi xác nhận, e-ticket, reminder | HTTPS qua Notification Adapter |

---

## 7. Áp dụng SOLID vào thiết kế

### 7.1. SRP - Single Responsibility Principle

Mỗi module có một nhóm trách nhiệm rõ ràng. Không để một service duy nhất vừa tạo order, gọi payment, sinh QR và gửi email.

Ví dụ tách trách nhiệm:

| Module | Trách nhiệm chính |
|---|---|
| Order Module | Tạo order, giữ vé, kiểm tra tồn kho. |
| Payment Module | Tạo giao dịch, xử lý callback, idempotency. |
| Ticket Module | Sinh QR, quản lý trạng thái ticket. |
| Notification Module | Gửi email/app notification. |

### 7.2. OCP - Open/Closed Principle

Các tích hợp ngoài được đóng gói bằng adapter. Khi thêm provider mới, không sửa logic nghiệp vụ chính.

```text
PaymentPort
├── VnpayPaymentAdapter
├── MomoPaymentAdapter
└── MockPaymentAdapter

NotificationPort
├── EmailNotificationAdapter
├── AppPushNotificationAdapter
├── SmsNotificationAdapter
└── ZaloOANotificationAdapter
```

### 7.3. DIP - Dependency Inversion Principle

Application layer phụ thuộc vào interface/port, không phụ thuộc trực tiếp SDK của VNPAY/MoMo/AI/Email.

```text
OrderService → PaymentPort
AIJobWorker → AITextGenerationPort
NotificationWorker → NotificationPort
FileService → ObjectStoragePort
```

### 7.4. ISP - Interface Segregation Principle

Không tạo interface quá lớn như `ExternalIntegrationService`. Tách nhỏ theo nhu cầu:

- `PaymentPort`
- `NotificationPort`
- `AITextGenerationPort`
- `ObjectStoragePort`
- `QRCodeGeneratorPort`

### 7.5. LSP - Liskov Substitution Principle

Các implementation của cùng một interface phải thay thế được cho nhau. Ví dụ `MockPaymentAdapter`, `VnpayPaymentAdapter`, `MomoPaymentAdapter` đều trả về cùng kiểu `PaymentResult`, không làm hỏng luồng checkout.

---

## 8. Mapping yêu cầu sang thành phần kiến trúc

| Yêu cầu đồ án | Thành phần xử lý |
|---|---|
| Xem danh sách concert tải cao | Audience Web + Backend API + Redis Cache + PostgreSQL |
| Xem sơ đồ chỗ ngồi SVG | Seat Map Module + Object Storage + PostgreSQL metadata |
| Xem số vé còn lại theo khu | Ticket Type Module + Redis availability cache TTL ngắn + PostgreSQL source of truth |
| Mua vé không oversell | Order Module + PostgreSQL transaction/row-level lock |
| Giới hạn vé per-user | Order Module + query paid orders + DB constraint/transaction |
| Thanh toán VNPAY/MoMo | Payment Module + Payment Adapter |
| Payment timeout/lỗi kéo dài | Circuit Breaker + timeout + graceful degradation |
| Chống trừ tiền hai lần | Idempotency key + unique constraint + callback deduplication |
| Gửi e-ticket/app/email | Notification Module + Queue Worker |
| Reminder trước concert 24 giờ | Scheduler + Message Queue + Notification Worker |
| Soát vé online/offline | Check-in Mobile App + Local Storage + Check-in Module + sync API |
| CSV khách VIP | CSV Import Module + Object Storage + Queue Worker |
| AI Artist Bio từ PDF | AI Bio Module + Object Storage + AI Worker + AI Service |
| Kiểm soát quyền admin/mobile | Auth/RBAC Module + API Guard + UI permission check |
| Chống bot/spam request | API Gateway/Middleware + Redis rate limiting |

---

## 9. Luồng dữ liệu tổng quát

### 9.1. Xem concert và seat map

```text
Audience Web
→ API Gateway / Rate Limit
→ Backend API
→ Concert Module
→ Redis cache
→ PostgreSQL nếu cache miss
→ Object Storage nếu cần tải SVG seat map
```

Thiết kế:

- Concert list/detail cache được vì dữ liệu ít thay đổi.
- Seat map SVG có thể lưu ở Object Storage, metadata theo khu lưu PostgreSQL.
- Availability theo khu cache ngắn hạn bằng Redis.
- Quyết định cuối cùng về còn vé hay không vẫn phải dựa trên PostgreSQL khi checkout.

### 9.2. Mua vé

```text
Audience Web
→ Backend API
→ Order Module
→ PostgreSQL transaction / lock ticket_type
→ Payment Module
→ Payment Gateway
→ Payment callback
→ Ticket Module
→ Notification Queue
→ Email/App Notification Worker
```

Nguyên tắc:

- PostgreSQL là source of truth cho số lượng vé.
- Redis chỉ hỗ trợ cache/rate limit/lock/idempotency, không là nơi quyết định cuối cùng khi checkout.
- Ticket chỉ phát hành sau khi payment thành công.
- Payment callback phải idempotent.
- Notification gửi qua queue để không block checkout.

### 9.3. Reminder trước concert 24 giờ

```text
Scheduler
→ Message Queue tạo reminder job
→ Notification Worker
→ Email/App Notification Service
→ Khán giả nhận nhắc nhở
```

Reminder là tác vụ nền, không phụ thuộc request của user, nên phù hợp xử lý bằng scheduler + queue.

### 9.4. AI Artist Bio

```text
Admin Web
→ Backend API
→ Object Storage lưu PDF
→ Queue tạo AI job
→ Worker extract/clean text
→ AI Service
→ PostgreSQL lưu bio draft
→ Admin review và publish
```

### 9.5. CSV Import khách VIP

```text
Admin Web
→ Backend API upload CSV
→ Object Storage lưu file
→ Queue tạo import job
→ CSV Worker validate từng dòng
→ PostgreSQL lưu vip_guests hợp lệ
→ Admin xem import result
```

### 9.6. Check-in offline

```text
Mobile App sync dữ liệu trước sự kiện
→ Mất mạng
→ Scan QR và kiểm tra local data
→ Lưu check-in vào local queue
→ Có mạng lại
→ Sync API
→ Backend xử lý conflict
→ PostgreSQL cập nhật kết quả cuối cùng
```

---

## 10. Chiến lược cô lập lỗi

| Sự cố | Ảnh hưởng mong muốn | Cách cô lập |
|---|---|---|
| Payment Gateway lỗi | Chỉ ảnh hưởng checkout/payment, người dùng vẫn xem concert được | Payment Adapter + Circuit Breaker + timeout |
| AI Service lỗi | Chỉ ảnh hưởng tạo Artist Bio, admin có thể nhập thủ công | AI job async + retry + fallback |
| CSV file lỗi | Không ảnh hưởng bán vé | Import bằng queue, validate từng dòng |
| Email service lỗi | Không làm checkout thất bại | Notification queue, retry sau |
| Redis lỗi | Hệ thống degrade, có thể đọc DB nhưng hạn chế traffic | Fallback DB, giảm tải, cảnh báo vận hành |
| Worker lỗi | Job không mất | Queue retry/dead-letter queue |
| Mobile mất mạng | Staff vẫn scan trong phạm vi dữ liệu local | Local storage + sync conflict |
| Object Storage lỗi | Upload PDF/CSV/SVG tạm lỗi, chức năng khác vẫn chạy | Retry, báo lỗi riêng cho admin |

---

## 11. Quyết định thiết kế quan trọng - ADR tóm tắt

### ADR-01: Chọn Modular Monolith

Chọn modular monolith vì team nhỏ, thời gian ngắn, dễ kiểm soát transaction mua vé. Vẫn thiết kế boundary rõ để có thể tách service sau này.

### ADR-02: Chọn PostgreSQL làm database chính

PostgreSQL phù hợp vì hệ thống có dữ liệu quan hệ và cần transaction/constraint trong order, payment, ticket, check-in.

### ADR-03: Chọn Redis cho cache/rate limit/lock hỗ trợ

Redis giảm tải DB cho concert list/detail, hỗ trợ rate limit và cache availability ngắn hạn. Redis không thay thế PostgreSQL trong quyết định checkout cuối cùng.

### ADR-04: Chọn Queue cho tác vụ nền

Queue giúp xử lý CSV, AI, notification, reminder mà không block request chính.

### ADR-05: Dùng Adapter/Port cho external services

Payment, AI, Notification, Object Storage được gọi qua interface để dễ thay provider, dễ mock và giảm coupling.

---

## 12. Trade-off

| Quyết định | Ưu điểm | Nhược điểm |
|---|---|---|
| Modular Monolith | Dễ phát triển, dễ deploy, phù hợp team nhỏ | Nếu không giữ boundary sẽ thành monolith rối |
| Layered Architecture | Dễ hiểu, dễ test, tách trách nhiệm tốt | Có thể hơi nhiều lớp với prototype nhỏ |
| PostgreSQL transaction | Đảm bảo consistency khi mua vé | Có thể nghẽn nếu lock quá nhiều lúc peak |
| Redis cache | Giảm tải DB, tăng tốc đọc | Cần TTL/invalidate đúng để tránh stale data |
| Queue Worker | Tách tác vụ chậm, tăng fault tolerance | Cần retry/monitoring/dead-letter queue |
| Circuit Breaker | Cô lập lỗi payment | Cần chọn ngưỡng lỗi phù hợp |
| Adapter pattern | Dễ thay provider | Cần thiết kế contract tốt từ đầu |

---

## 13. Liên kết với các mục Blueprint khác

| Mục Blueprint | Liên kết |
|---|---|
| Mục 2 - C4 Diagram | Các thành phần trong tài liệu này phải xuất hiện trong C4 Level 1/2. |
| Mục 3 - High-Level Architecture | Các luồng ở mục 9 được vẽ trực quan. |
| Mục 4 - Database Design | PostgreSQL, Redis, Object Storage phải khớp schema của C. |
| Mục 5 - Business Flows | Luồng mua vé, check-in, CSV, AI, reminder phải khớp phần của B. |
| Mục 6 - RBAC | Auth/RBAC module phải khớp role-permission matrix của C. |
| Mục 7 - Protection Mechanisms | Redis, queue, circuit breaker, idempotency, rate limit phải xuất hiện trong kiến trúc. |
