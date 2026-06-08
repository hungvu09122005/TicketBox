# 04 - Checklist review kỹ thuật của Thành viên A

Theo plan mới:

- A làm chính: Mục 1, 2, 3.
- B làm chính: Mục 5 và Mục 7.
- C làm chính: Mục 4 và Mục 6.
- A review kỹ thuật cho các mục còn lại để đảm bảo toàn bộ Blueprint thống nhất.

---

## 1. Review Mục 4 - Database Design của C

| Câu hỏi | Đạt? |
|---|---|
| Có bảng `users`, `roles`, `permissions`, `user_roles`, `role_permissions` không? | [ ] |
| Có bảng `concerts`, `artists`, `ticket_types`, `seat_zones` không? | [ ] |
| Có lưu metadata/file path của SVG seat map không? | [ ] |
| Có bảng `orders`, `order_items`, `payments`, `tickets` không? | [ ] |
| Có bảng `checkin_logs` hỗ trợ online/offline/sync/conflict không? | [ ] |
| Có bảng `csv_import_jobs`, `vip_guests` không? | [ ] |
| Có bảng `ai_bio_requests` hoặc field lưu Artist Bio draft/published không? | [ ] |
| Có unique constraint cho `tickets.qr_token` không? | [ ] |
| Có unique constraint cho `payments.idempotency_key` hoặc `provider_transaction_id` không? | [ ] |
| Có index phục vụ đọc concert list/detail không? | [ ] |
| Có giải thích PostgreSQL là source of truth không? | [ ] |
| Có giải thích Redis chỉ là cache/rate limit/lock hỗ trợ không? | [ ] |

---

## 2. Review Mục 5 - Business Flows của B

| Câu hỏi | Đạt? |
|---|---|
| Luồng mua vé có bước xem seat map và availability theo khu không? | [ ] |
| Luồng mua vé có kiểm tra số vé còn lại không? | [ ] |
| Luồng mua vé có kiểm tra giới hạn vé per-user không? | [ ] |
| Luồng mua vé có order trạng thái `PENDING_PAYMENT` không? | [ ] |
| Luồng payment có success/fail/timeout/callback lặp không? | [ ] |
| E-ticket chỉ sinh sau payment thành công không? | [ ] |
| Có luồng gửi e-ticket/app/email sau mua vé không? | [ ] |
| Có luồng reminder 24 giờ trước concert không? | [ ] |
| Luồng check-in offline có local storage/local queue không? | [ ] |
| Sync offline có xử lý conflict không? | [ ] |
| Luồng CSV có validate từng dòng, xử lý lỗi/trùng không? | [ ] |
| Luồng AI Bio có PDF upload, AI job, draft, admin duyệt không? | [ ] |

---

## 3. Review Mục 6 - RBAC của C

| Câu hỏi | Đạt? |
|---|---|
| Có role Audience không? | [ ] |
| Có role Organizer không? | [ ] |
| Có role Check-in Staff không? | [ ] |
| Có role System Admin không? | [ ] |
| Audience chỉ được xem concert/mua vé/xem vé của mình không? | [ ] |
| Organizer được tạo/sửa/hủy concert, cấu hình vé, import CSV, upload PDF không? | [ ] |
| Check-in Staff chỉ được scan QR và sync check-in không? | [ ] |
| Admin được quản lý user/role/permission không? | [ ] |
| API có guard/middleware kiểm tra permission không? | [ ] |
| UI admin/mobile có ẩn chức năng không đúng quyền không? | [ ] |

---

## 4. Review Mục 7 - Protection Mechanisms của B

Mục 7 do B làm chính để giảm tải cho A, nhưng A cần review kỹ thuật.

| Cơ chế | Câu hỏi review |
|---|---|
| Rate Limiting | Có áp dụng theo IP/user/endpoint/device không? |
| Rate Limiting | Có dùng Redis counter không? |
| Rate Limiting | Có response `429 Too Many Requests` không? |
| Fairness | Có nói đến bot/client spam và tính công bằng cho khán giả thật không? |
| Waiting room mở rộng | Có nhắc như phương án mở rộng khi tải quá lớn không? |
| Caching | Có phân biệt concert list/detail, seat map và availability cache không? |
| Caching | Có TTL khác nhau và invalidate khi admin update/payment success không? |
| Idempotency | Có idempotency key cho payment request không? |
| Idempotency | Có xử lý callback lặp từ gateway không? |
| Circuit Breaker | Có Closed/Open/Half-Open không? |
| Circuit Breaker | Có graceful degradation: payment lỗi nhưng xem concert vẫn chạy không? |
| Race Condition | Có transaction/lock để tránh oversell không? |
| Per-user limit | Có đảm bảo user không mua vượt limit khi gửi request song song không? |
| Queue | CSV/AI/Notification/Reminder có xử lý async không? |
| Offline Check-in | Có local storage, sync và conflict handling không? |

---

## 5. Góp ý kỹ thuật chuẩn cho B ở Mục 7

### 5.1. Rate Limiting và fairness

Hệ thống áp dụng rate limiting ở API Gateway/Middleware. Redis lưu counter theo IP, user hoặc device. Endpoint đọc như `GET /concerts` có ngưỡng cao hơn, endpoint nhạy cảm như `POST /orders` và `POST /payments` có ngưỡng thấp hơn. Khi vượt giới hạn, hệ thống trả `429 Too Many Requests`.

Để đảm bảo công bằng, hệ thống kết hợp rate limiting, JWT/user identity, per-user ticket limit, idempotency key và có thể mở rộng waiting room khi lượng truy cập quá lớn.

### 5.2. Caching

Dùng cache-aside với Redis. Concert list/detail và seat map metadata có thể cache lâu hơn vì ít thay đổi. Ticket availability cache ngắn hơn hoặc invalidate khi payment thành công. Redis chỉ dùng để hiển thị nhanh; checkout cuối cùng vẫn dựa trên PostgreSQL transaction.

### 5.3. Idempotency

Mỗi request thanh toán có `idempotency_key`. Nếu client gửi lại cùng key, backend trả kết quả cũ thay vì tạo giao dịch mới. Callback payment cũng cần kiểm tra `provider_transaction_id` để không phát hành vé hai lần.

### 5.4. Circuit Breaker

Payment Gateway được gọi qua Payment Adapter có Circuit Breaker. Khi lỗi liên tục, circuit chuyển sang Open để ngừng gọi gateway tạm thời. Các chức năng không phụ thuộc payment như xem concert, xem seat map, AI Bio, CSV Import, check-in vẫn có thể hoạt động.

### 5.5. Race condition và per-user limit

PostgreSQL là source of truth. Khi tạo order, backend mở transaction và lock dòng `ticket_types` hoặc dùng optimistic locking. Chỉ tăng `sold_quantity` nếu còn đủ vé. Đồng thời kiểm tra số vé user đã mua thành công để không vượt `max_per_user` dù user gửi nhiều request song song.

---

## 6. Checklist thống nhất cuối cùng

| Hạng mục | Đạt? |
|---|---|
| Actor thống nhất giữa C4, RBAC và business flow | [ ] |
| Container thống nhất giữa C4 và High-Level Architecture | [ ] |
| Redis xuất hiện ở C4, architecture và protection mechanisms | [ ] |
| Queue xuất hiện ở C4, architecture, CSV, AI, notification, reminder | [ ] |
| Payment Gateway xuất hiện ở C4, architecture và business flow | [ ] |
| AI Service xuất hiện ở C4, architecture và AI Bio flow | [ ] |
| CSV one-way integration xuất hiện ở architecture, flow và DB | [ ] |
| Offline check-in xuất hiện ở architecture, business flow và database | [ ] |
| Seat map SVG xuất hiện ở system design, C4, architecture và DB | [ ] |
| Reminder 24h xuất hiện ở architecture và business flow | [ ] |
| PostgreSQL là source of truth, Redis chỉ hỗ trợ | [ ] |
| Tài liệu có trade-off, không chỉ liệt kê giải pháp | [ ] |
