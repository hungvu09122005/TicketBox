# Mục 5: Mô Tả Các Luồng Nghiệp Vụ Quan Trọng & Quyết Định Thiết Kế (Business Flows & Design Decisions)

Tài liệu này đặc tả chi tiết 6 luồng nghiệp vụ cốt lõi tương ứng với các yêu cầu hệ thống trong [plan.md](file:///Users/mac/Documents/Nam_3/HK2/TKPM/Project/plan.md). Nhằm đảm bảo tính nhất quán và tính chuyên nghiệp cao trong tài liệu thiết kế, mỗi luồng nghiệp vụ đều được phân tích theo một định dạng đồng nhất bao gồm: các Tác nhân (Actors) tham gia, các Thành phần (Components) tham gia, các Kịch bản nghiệp vụ (Main/Alternative/Exception Flows) và các Quyết định thiết kế (Design Decisions) đi kèm.

---

## 1. Phân Tích Các Tác Nhân Hệ Thống (Actor Analysis)

Hệ thống TicketBox phân chia vai trò rõ rệt để phân quyền truy cập thông qua mô hình RBAC và kiểm soát các luồng xử lý:

| Tác nhân (Actor) | Phân loại | Mô tả vai trò & Phạm vi tương tác |
| :--- | :--- | :--- |
| **Khán giả (Audience)** | Người dùng cuối | Sử dụng `Audience Web App` để duyệt thông tin concert, xem sơ đồ ghế SVG, chọn vé, thực hiện thanh toán qua cổng thanh toán ngoài và nhận e-ticket (mã QR). |
| **Ban tổ chức (Organizer)** | Quản trị viên đối tác | Sử dụng `Admin Web App` để tạo sự kiện, cấu hình hạng vé, tải lên PDF để sinh bio nghệ sĩ bằng AI, import danh sách khách VIP từ CSV, và xem báo cáo doanh thu. |
| **Nhân sự soát vé (Check-in Staff)**| Người dùng vận hành | Sử dụng `Check-in Mobile App` tại cổng sự kiện để quét mã QR soát vé. Hỗ trợ quét trực tuyến (Online) và ngoại tuyến (Offline) khi mất kết nối mạng. |
| **Admin hệ thống (System Admin)** | Quản trị viên tối cao | Sở hữu toàn bộ quyền hạn trong hệ thống. Quản lý danh sách tài khoản người dùng, cấu hình vai trò, gán quyền (RBAC Matrix) và cấu hình tham số hệ thống. |
| **Cổng thanh toán (Payment Gateway)** | Hệ thống bên ngoài | Các bên thứ ba (VNPAY/MoMo) thực thi xử lý giao dịch tài chính, cung cấp giao diện thanh toán bảo mật và gửi webhook IPN về server để xác nhận giao dịch. |
| **Dịch vụ gửi Email (Email Service)** | Hệ thống bên ngoài | Dịch vụ gửi thư điện tử (như SendGrid/Mailgun) nhận yêu cầu gửi thư từ hàng đợi để chuyển e-ticket QR hoặc thư nhắc nhở sự kiện đến hòm thư Khán giả. |
| **Dịch vụ AI (AI Service)** | Hệ thống bên ngoài | Các mô hình ngôn ngữ lớn (OpenAI/Gemini) nhận văn bản thô trích xuất từ PDF nghệ sĩ, phân tích và trả về nội dung tiểu sử được tóm tắt chuẩn hóa. |

---

## 2. Các Thành Phần Hệ Thống Tham Gia (System Components)

Các luồng nghiệp vụ tương tác qua các thành phần công nghệ sau:
1. **Audience Web App**: Giao diện SPA (Single Page Application) dành cho khán giả.
2. **Admin Web App**: Giao diện Web quản trị dành cho Ban tổ chức và Admin hệ thống.
3. **Check-in Mobile App**: Ứng dụng di động (iOS/Android) dành cho nhân viên kiểm soát vé tại sân vận động.
4. **Backend API**: Hệ thống API Core xử lý nghiệp vụ chính của TicketBox.
5. **PostgreSQL Database**: Bộ lưu trữ dữ liệu quan hệ chính (Concerts, Orders, Tickets, Users, Roles).
6. **Redis Cache & Lock**: Bộ nhớ đệm dữ liệu (availability), lưu trữ session, rate limiting và khóa phân tán (Distributed Lock/Idempotency Key).
7. **Message Queue (BullMQ)**: Hàng đợi xử lý tác vụ ngầm chạy trên nền Redis.
8. **Queue Worker**: Bộ xử lý bất đồng bộ các tác vụ ngầm (gửi mail, parse CSV, gọi AI).
9. **Object Storage**: Bộ lưu trữ tệp tin (ảnh concert, file PDF nghệ sĩ, file CSV khách VIP).

---

## 3. Chi Tiết Các Luồng Nghiệp Vụ & Quyết Định Thiết Kế

### 3.1. Luồng 1: Xem và Mua Vé Concert (Viewing & Purchasing)

* **Tác nhân tham gia (Actors):** Khán giả (Audience), Cổng thanh toán (Payment Gateway).
* **Thành phần tham gia (Components):** Audience Web App, Backend API, Redis Cache, PostgreSQL Database.

#### A. Luồng xử lý nghiệp vụ (Business Flow)
* **Main Flow (Luồng chính):**
  1. Khán giả truy cập `Audience Web App`, xem danh sách concert, chi tiết concert và sơ đồ chỗ ngồi SVG tương tác.
  2. Khán giả chọn khu vực hạng vé (GA, SVIP, VIP...) và số lượng vé cần đặt mua.
  3. Hệ thống kiểm tra số lượng vé còn khả dụng trong cache Redis và kiểm tra giới hạn mua vé tối đa của tài khoản (`max_per_user`) lưu trong PostgreSQL.
  4. Hệ thống mở database transaction, thực hiện khóa dòng (`SELECT ... FOR UPDATE` trong PostgreSQL) để trừ số lượng vé trong bảng `ticket_types`, tạo bản ghi đơn hàng ở trạng thái `PENDING_PAYMENT` và giữ vé trong vòng 10 phút.
  5. Hệ thống gọi API sang `Payment Gateway` (VNPAY/MoMo) để sinh đường dẫn thanh toán (payment link).
  6. Khán giả thực hiện thanh toán trên cổng của bên thứ ba. Sau khi thành công, `Payment Gateway` gửi callback (IPN Webhook) xác nhận cho Backend API.
  7. Hệ thống cập nhật trạng thái đơn hàng thành `PAID` và phát hành vé điện tử chứa mã QR (`tickets.qr_token`) gửi tới khách hàng.
* **Alternative Flows (Luồng thay thế):**
  - **A1 (Vé trong kho không đủ):** Hệ thống kiểm tra thấy số lượng vé khả dụng trong cache Redis hoặc DB thấp hơn số lượng yêu cầu -> Từ chối tạo đơn hàng, báo lỗi số vé còn lại khả dụng để Khán giả chọn lại.
  - **A2 (Vượt giới hạn tài khoản):** Khán giả chọn số lượng vé vượt quá giới hạn mua `max_per_user` của hạng vé đó hoặc tổng số vé đã mua trước đó + số vé đang chọn lớn hơn `max_per_user` -> Hệ thống chặn và hiển thị cảnh báo giới hạn mua vé của tài khoản.
  - **A3 (Hết hạn giữ vé - Timeout):** Đơn hàng giữ ở trạng thái `PENDING_PAYMENT` quá 10 phút không được thanh toán thành công -> Redis TTL trigger webhook cập nhật trạng thái đơn hàng thành `EXPIRED` và cộng lại vé vào kho khả dụng (giảm `sold_quantity`).
* **Exception Flows (Luồng ngoại lệ):**
  - **E1 (Thanh toán thất bại/Khách hủy):** Khán giả hủy giao dịch thanh toán hoặc giao dịch lỗi từ phía ngân hàng -> Cổng thanh toán phản hồi lỗi. Backend API cập nhật trạng thái đơn hàng thành `PAYMENT_FAILED` và trả lại vé về kho ngay lập tức.
  - **E2 (Webhook thanh toán gửi trùng - Double Callback):** Cổng thanh toán gửi webhook IPN nhiều lần -> Backend nhận request, kiểm tra trạng thái đơn hàng đã là `PAID` chưa thông qua `idempotency_key` -> Trả về kết quả thành công ngay lập tức cho Gateway và không thực hiện xử lý tạo vé lần thứ hai.
  - **E3 (Tranh chấp vé cuối cùng):** Nhiều người cùng bấm mua vé cuối cùng tại một thời điểm -> Nhờ khóa bi quan `FOR UPDATE`, transaction nào giành được khóa trước sẽ trừ vé thành công. Các transaction chạy sau sẽ đọc dữ liệu mới và nhận thấy `sold_quantity >= total_quantity` -> Hệ thống báo hết vé và rollback transaction.

#### B. Quyết định thiết kế (Design Decisions)
* **Giải pháp lựa chọn (What):** Sử dụng **Pessimistic Locking (Khóa bi quan)** bằng câu lệnh `SELECT ... FOR UPDATE` trong Database Transaction của PostgreSQL khi thực hiện trừ vé.
* **Lý do lựa chọn (Why):** Vé concert có tính cạnh tranh cực kỳ cao khi mở bán. Khóa bi quan đảm bảo tính nhất quán dữ liệu tuyệt đối tại tầng Database, loại bỏ hoàn toàn rủi ro bán vượt số lượng (oversell).
* **Đánh đổi / Rủi ro (Trade-offs):** Gây hiện tượng nghẽn dòng (lock contention) tại Database khi có hàng vạn request đồng thời. Tuy nhiên, do transaction trừ vé cực kỳ ngắn (chỉ đọc-ghi 2 bảng dữ liệu), PostgreSQL vẫn có khả năng đáp ứng tốt hàng nghìn transaction/giây trên phần cứng tiêu chuẩn.
* **Giải pháp thay thế bị loại bỏ (Alternatives):** 
  - *Optimistic Locking (Khóa lạc quan) với trường version:* Bị loại bỏ vì khi hàng ngàn người tranh mua một số lượng vé nhỏ, tỷ lệ xung đột phiên bản quá cao dẫn đến hàng loạt transaction bị rollback vô ích, làm giảm tỷ lệ mua vé thành công của người dùng thực tế.

---

### 3.2. Luồng 2: Thông Báo Xác Nhận và Nhắc Nhở (Notifications)

* **Tác nhân tham gia (Actors):** Khán giả (Audience), Dịch vụ gửi Email (Email Service).
* **Thành phần tham gia (Components):** Backend API, Redis (BullMQ), Queue Worker, PostgreSQL Database, Email Service.

#### A. Luồng xử lý nghiệp vụ (Business Flow)
* **Main Flow (Luồng chính):**
  1. Khi đơn hàng của Khán giả chuyển sang trạng thái `PAID`, Backend API tiến hành sinh mã QR e-ticket.
  2. Backend API tạo một tác vụ (Job) gửi email xác nhận mua vé thành công kèm mã QR vé và đẩy vào hàng đợi `Message Queue` (BullMQ chạy trên nền Redis).
  3. `Queue Worker` lấy job ra khỏi hàng đợi.
  4. Worker gọi API sang dịch vụ gửi email ngoài (SendGrid/Mailgun) để chuyển e-ticket đến hòm thư Khán giả.
  5. Định kỳ hàng giờ, một Cron Job quét PostgreSQL tìm các vé có concert diễn ra sau 24 giờ tới và tự động đẩy các tác vụ nhắc nhở (Job) vào `Message Queue`.
  6. Worker xử lý job nhắc nhở và gọi dịch vụ ngoài gửi email nhắc nhở về thời gian và địa điểm concert cho Khán giả.
* **Alternative Flows (Luồng thay thế):**
  - **A1 (Thay đổi thông tin vé/sự kiện):** Khi BTC cập nhật thay đổi lớn của concert (thời gian, địa điểm) -> Hệ thống sinh hàng loạt job gửi thông báo thay đổi sang Queue để Worker gửi email đính kèm vé cập nhật mới cho tất cả khán giả đã mua vé của concert đó.
* **Exception Flows (Luồng ngoại lệ):**
  - **E1 (API bên thứ ba bị sập/timeout):** Worker gọi API gửi mail gặp lỗi mạng hoặc timeout -> Hệ thống áp dụng retry policy (thử lại sau 5 phút, tối đa 3 lần). Nếu sau 3 lần vẫn lỗi, job được chuyển sang Dead Letter Queue (DLQ) để thông báo cho admin xử lý thủ công.
  - **E2 (Sai địa chỉ email):** Email gửi đi bị nhà mạng trả lại (bounce) -> Dịch vụ Email gọi webhook thông báo cho server. Worker ghi nhận trạng thái gửi email là `BOUNCED` vào bảng `notification_logs` để bộ phận Support kiểm tra lại thông tin khi khách hàng khiếu nại.

#### B. Quyết định thiết kế (Design Decisions)
* **Giải pháp lựa chọn (What):** Sử dụng kiến trúc **Event-Driven & Queue Processing** (BullMQ/Redis) kết hợp mẫu thiết kế **Adapter Pattern** cho Notification Service.
* **Lý do lựa chọn (Why):** 
  - Gửi email và thông báo đẩy (push) phụ thuộc vào API bên thứ ba, tốc độ xử lý chậm và dễ lỗi. Việc xử lý bất đồng bộ qua Queue giúp giải phóng luồng chính của Backend API ngay lập tức, giảm tối đa thời gian phản hồi cho Khán giả khi mua vé.
  - Mẫu Adapter giúp hệ thống dễ dàng tích hợp thêm các kênh thông báo mới như SMS, Zalo OA trong tương lai mà không cần chỉnh sửa logic cốt lõi.
* **Đánh đổi / Rủi ro (Trade-offs):** Đòi hỏi cài đặt và giám sát thêm hạ tầng Redis và Worker. Dữ liệu gửi thông báo có độ trễ nhỏ (vài giây) so với thời điểm thanh toán thành công (Eventual Consistency).
* **Giải pháp thay thế bị loại bỏ (Alternatives):**
  - *Gửi trực tiếp đồng bộ (Synchronous HTTP Call):* Bị loại bỏ vì nếu dịch vụ email bị chậm hoặc sập, request mua vé của Khán giả sẽ bị treo lâu, dẫn tới cạn kiệt connection pool của backend và gây sập toàn bộ hệ thống.

---

### 3.3. Luồng 3: Quản Trị Hệ Thống và Cấu Hình Vé (Administration & RBAC)

* **Tác nhân tham gia (Actors):** Ban tổ chức (Organizer), Admin hệ thống (System Admin).
* **Thành phần tham gia (Components):** Admin Web App, Backend API, PostgreSQL Database, Redis Cache.

#### A. Luồng xử lý nghiệp vụ (Business Flow)
* **Main Flow (Luồng chính):**
  1. Ban tổ chức đăng nhập vào `Admin Web App`, hệ thống trả về mã `jwt_token` chứa danh sách quyền (permissions).
  2. Ban tổ chức điền thông tin để tạo concert mới và cấu hình các hạng vé (tên, giá, tổng số lượng, giới hạn mua vé `max_per_user` của từng hạng).
  3. API Gateway và Backend Middleware kiểm tra tính hợp lệ của token và đối chiếu quyền truy cập (RBAC). Nếu hợp lệ, Backend ghi nhận thông tin concert và cấu hình vé vào PostgreSQL Database.
  4. Hệ thống đồng thời thực hiện xóa các key cache danh sách concert cũ trên Redis để đảm bảo cập nhật thông tin mới nhất ra Client.
* **Alternative Flows (Luồng thay thế):**
  - **A1 (Cập nhật concert):** BTC thực hiện sửa đổi thông tin concert (ví dụ: mô tả hoặc sơ đồ ghế) -> Hệ thống ghi đè dữ liệu mới vào PostgreSQL và chủ động invalidate key cache tương ứng trong Redis.
  - **A2 (Hủy concert):** BTC thực hiện hủy concert -> Hệ thống chuyển trạng thái concert thành `CANCELLED`, khóa chức năng bán vé, tự động kích hoạt luồng hoàn tiền hàng loạt cho các vé đã thanh toán, và gửi email thông báo hủy cho khán giả.
* **Exception Flows (Luồng ngoại lệ):**
  - **E1 (Không đủ quyền truy cập - Unauthorized):** Người dùng không có vai trò phù hợp cố tình gửi request -> Backend API kiểm tra phân quyền trong token, phát hiện thiếu permission tương ứng -> Trả về lỗi HTTP `403 Forbidden` và ghi log cảnh báo an ninh.
  - **E2 (Chỉnh sửa hạng vé khi đã có người mua):** BTC cố gắng giảm tổng số lượng vé (`total_quantity`) của một hạng vé xuống thấp hơn số vé thực tế đã bán (`sold_quantity`) -> Backend chặn nghiệp vụ, trả về lỗi: *"Không thể giảm số lượng vé thấp hơn số lượng đã bán thực tế."*

#### B. Quyết định thiết kế (Design Decisions)
* **Giải pháp lựa chọn (What):** Sử dụng mô hình **Role-Based Access Control (RBAC)** lưu trữ trong Database kết hợp mã hóa **JWT Token** lưu ở Client Cookie (HttpOnly).
* **Lý do lựa chọn (Why):** Hệ thống có các nhóm người dùng phân quyền rất rõ rệt. RBAC là mô hình kiểm soát truy cập trực quan, dễ quản lý ma trận quyền, và bảo vệ các API quản trị cốt lõi khỏi sự truy cập trái phép.
* **Đánh đổi / Rủi ro (Trade-offs):** Mọi request quản trị đều phải kiểm tra quyền trong database hoặc cache, gây thêm tải nhỏ cho CPU. Cần thiết kế invalidate cache quyền hạn của user ngay lập tức khi Admin cập nhật phân quyền mới.
* **Giải pháp thay thế bị loại bỏ (Alternatives):**
  - *Attribute-Based Access Control (ABAC):* Bị loại bỏ vì quá phức tạp và không cần thiết cho quy mô nghiệp vụ hiện tại của TicketBox.

---

### 3.4. Luồng 4: Soát Vé Tại Sự Kiện (Check-in)

* **Tác nhân tham gia (Actors):** Nhân sự soát vé (Check-in Staff), Khán giả (Audience).
* **Thành phần tham gia (Components):** Check-in Mobile App, Local Storage (SQLite), Backend API, PostgreSQL Database.

#### A. Luồng xử lý nghiệp vụ (Business Flow)
* **Main Flow (Luồng chính - Online):**
  1. Nhân sự soát vé dùng ứng dụng `Check-in Mobile App` quét mã QR code trên vé của Khán giả.
  2. Mobile App gửi yêu cầu soát vé kèm `qr_token` và `scanned_at` trực tiếp lên `Backend API`.
  3. API kiểm tra tính hợp lệ và trạng thái check-in của vé trong PostgreSQL. Nếu hợp lệ, API cập nhật trạng thái vé thành `CHECKED_IN`, ghi nhận log check-in trực tuyến với chế độ `ONLINE`.
  4. Mobile App hiển thị màn hình thông báo check-in thành công (giao diện màu xanh).
* **Alternative Flow (Luồng thay thế - Offline soát vé khi mất mạng ở sân vận động):**
  1. Trước sự kiện, Mobile App đồng bộ toàn bộ danh sách vé hợp lệ về lưu trữ local `SQLite` trên điện thoại.
  2. Khi mất mạng, app soát vé đối chiếu mã QR trực tiếp với SQLite local:
     - Nếu hợp lệ và chưa check-in -> Đánh dấu đã check-in trên SQLite local và lưu log quét tạm thời vào hàng đợi local.
  3. Mobile App hiển thị trạng thái check-in tạm thời thành công.
  4. Khi có kết nối mạng trở lại, app tự động đẩy các log offline lên server thông qua API `/checkin/sync`.
  5. Backend xử lý đồng bộ và ghi nhận log với trạng thái `SYNCED`.
* **Exception Flows (Luồng ngoại lệ):**
  - **E1 (Vé đã được check-in trước đó):**
    - *Nếu online:* Backend kiểm tra PostgreSQL thấy vé đã check-in -> Trả về lỗi `400 Bad Request` kèm thông báo *"Vé đã được quét lúc [time] bởi thiết bị [device]"*, Mobile App hiện cảnh báo đỏ.
    - *Nếu offline:* Mobile App đối chiếu SQLite local thấy trạng thái đã quét -> Lập tức hiển thị cảnh báo đỏ ngăn chặn khách vào cổng.
  - **E2 (Xung đột đồng bộ khi sync offline - Conflict):** Một vé bị quét ở hai thiết bị offline khác nhau tại hai cổng vào khác nhau. Khi sync lên server, server áp dụng quy tắc mốc thời gian: chấp nhận lượt quét có `scanned_at` sớm nhất là hợp lệ (`status` = `SUCCESS`). Lượt quét muộn hơn bị cập nhật trạng thái `CONFLICT` để BTC xử lý gian lận chéo.
  - **E3 (Dữ liệu offline quá cũ):** Thiết bị di động mất kết nối mạng quá lâu trước khi đồng bộ dữ liệu vé -> Mobile App cảnh báo nhân sự cần kết nối mạng để đồng bộ lại danh sách vé mới nhất.

#### B. Quyết định thiết kế (Design Decisions)
* **Giải pháp lựa chọn (What):** Sử dụng cơ chế lưu trữ **SQLite Local** trên thiết bị di động kết hợp chiến lược đồng bộ **Timestamp-based Conflict Resolution (Giải quyết xung đột dựa trên mốc thời gian)** trên server.
* **Lý do lựa chọn (Why):** Các concert lớn có vùng sóng không ổn định. Thiết kế offline-first đảm bảo nhân sự soát vé hoạt động liên tục không bị gián đoạn (không gây ùn tắc tại cổng). Việc xử lý xung đột thời gian trên server đảm bảo tính chính xác và phát hiện được gian lận.
* **Đánh đổi / Rủi ro (Trade-offs):** Có rủi ro một vé giả hoặc vé bị in làm hai bản có thể đi qua cổng offline trước khi gói tin đồng bộ được gửi lên server. Tuy nhiên, đây là sự đánh đổi chấp nhận được để giữ cho dòng người vào cổng không bị tắc nghẽn.
* **Giải pháp thay thế bị loại bỏ (Alternatives):**
  - *Chỉ soát vé trực tuyến (Online Only Check-in):* Bị loại bỏ vì khi hàng chục nghìn người tập trung, mạng di động chắc chắn nghẽn, dẫn đến tê liệt hoàn toàn cổng soát vé.

---

### 3.5. Luồng 5: Tạo Artist Bio Tự Động (AI Artist Bio)

* **Tác nhân tham gia (Actors):** Ban tổ chức (Organizer), Dịch vụ AI (AI Service).
* **Thành phần tham gia (Components):** Admin Web App, Backend API, Object Storage, Redis (BullMQ), Queue Worker, PostgreSQL Database, AI Service.

#### A. Luồng xử lý nghiệp vụ (Business Flow)
* **Main Flow (Luồng chính):**
  1. Ban tổ chức upload file PDF hồ sơ giới thiệu nghệ sĩ lên `Admin Web App`.
  2. Backend API lưu PDF vào `Object Storage` và tạo bản ghi job trạng thái `PENDING` trong PostgreSQL.
  3. Backend đẩy một task xử lý PDF vào `Message Queue` (BullMQ/Redis).
  4. `Queue Worker` nhận job, thực hiện trích xuất text từ file PDF và làm sạch văn bản thô.
  5. Worker gửi văn bản đã làm sạch sang `AI Service` (OpenAI/Gemini) kèm prompt tóm tắt.
  6. AI phản hồi kết quả. Worker lưu kết quả tóm tắt vào database dưới dạng bản nháp `draft_bio` của concert và cập nhật trạng thái job thành `SUCCESS`.
  7. BTC nhận thông báo, xem lại bản nháp bio trên trang Admin, thực hiện chỉnh sửa nếu cần, rồi bấm **"Publish"** để hiển thị ra trang công chúng.
* **Alternative Flows (Luồng thay thế):**
  - **A1 (Nhập bio thủ công không cần AI):** BTC không sử dụng file PDF -> Tự gõ trực tiếp nội dung tiểu sử nghệ sĩ vào ô soạn thảo văn bản trên Admin Web App và bấm **"Publish"**.
* **Exception Flows (Luồng ngoại lệ):**
  - **E1 (PDF không đọc được text):** File PDF dạng scan ảnh không thể trích xuất chữ thô -> Worker báo lỗi, ghi nhận job `FAILED`, hiển thị lỗi định dạng file để BTC biết và sửa đổi.
  - **E2 (AI Service lỗi/timeout):** Dịch vụ AI bên thứ ba bị sập -> Hệ thống lưu yêu cầu ở trạng thái `FAILED`. BTC có thể bấm nút thử lại sau hoặc nhập nội dung thủ công.
  - **E3 (Nội dung AI trả về không phù hợp):** AI trả về thông tin sai lệch -> Nhờ cơ chế *Draft/Publish*, thông tin không hiển thị ngay ra ngoài mà chờ BTC kiểm duyệt chỉnh sửa lại trước khi xuất bản.

#### B. Quyết định thiết kế (Design Decisions)
* **Giải pháp lựa chọn (What):** Sử dụng **Asynchronous Worker Processing (Xử lý Worker bất đồng bộ)** kết hợp quy trình phê duyệt **Draft / Publish** (Human-in-the-loop).
* **Lý do lựa chọn (Why):** Trích xuất text từ file PDF lớn và gọi API AI là các tác vụ tốn thời gian (có thể mất 5 - 15 giây). Xử lý bất đồng bộ giúp tránh tình trạng timeout của HTTP request. Trạng thái `Draft` đảm bảo nội dung do AI tạo ra được kiểm soát chất lượng bởi con người trước khi hiển thị cho Khán giả.
* **Đánh đổi / Rủi ro (Trade-offs):** BTC phải duyệt thủ công, không hiển thị bio ngay lập tức khi upload PDF.
* **Giải pháp thay thế bị loại bỏ (Alternatives):**
  - *Xử lý đồng bộ trực tiếp (Synchronous Call):* Bị loại bỏ vì gây block luồng xử lý của web server, dễ dẫn đến timeout và cạn kiệt tài nguyên máy chủ.

---

### 3.6. Luồng 6: Đồng Bộ Danh Sách Khách Mời VIP (VIP Guest Sync)

* **Tác nhân tham gia (Actors):** Ban tổ chức (Organizer).
* **Thành phần tham gia (Components):** Admin Web App, Backend API, Redis (BullMQ), Queue Worker, PostgreSQL Database.

#### A. Luồng xử lý nghiệp vụ (Business Flow)
* **Main Flow (Luồng chính):**
  1. Ban tổ chức upload file CSV danh sách khách VIP (họ tên, email, sđt, hạng vé VIP) từ nhãn hàng tài trợ lên `Admin Web App`.
  2. Backend lưu file, tạo bản ghi job trong PostgreSQL trạng thái `PENDING`, và đẩy task vào queue (BullMQ/Redis).
  3. `Queue Worker` lấy task ra và tiến hành đọc file CSV theo từng khối (Chunk-based Reading).
  4. Worker validate định dạng dữ liệu từng dòng (email hợp lệ, sđt đúng định dạng, hạng vé có tồn tại).
  5. Worker ghi dữ liệu khách hợp lệ vào bảng `vip_guests` và tự động sinh mã e-ticket tương ứng trong bảng `tickets`.
  6. Sau khi hoàn tất, worker cập nhật trạng thái job thành `SUCCESS` và lưu trữ danh sách các dòng bị lỗi cấu trúc dữ liệu gửi về database.
  7. Ban tổ chức xem kết quả và tải báo cáo chi tiết các dòng lỗi về trên Admin Web App để xử lý.
* **Alternative Flows (Luồng thay thế):**
  - **A1 (Khách VIP đã có vé trước đó):** File CSV chứa thông tin khách mời đã được cấp vé VIP ở lần import trước -> Worker kiểm tra Email/SĐT trùng khớp trong bảng `vip_guests` -> Cập nhật thông tin mới và không sinh thêm vé mới để tránh trùng lặp.
* **Exception Flows (Luồng ngoại lệ):**
  - **E1 (File CSV không đúng định dạng cột):** BTC upload file CSV sai cấu trúc header (thiếu cột email hoặc định dạng không đúng) -> Hệ thống từ chối import ngay từ đầu, báo lỗi định dạng cột để BTC sửa đổi.
  - **E2 (Dòng dữ liệu bị lỗi - Partial Failure):** File CSV có một vài dòng bị thiếu thông tin hoặc sai định dạng -> Các dòng lỗi bị bỏ qua và ghi nhận chi tiết lỗi vào báo cáo. Các dòng hợp lệ khác vẫn được import thành công và sinh vé bình thường (Thành công một phần).
  - **E3 (Khách VIP bị trùng email/phone):** Hệ thống phát hiện email/sđt trùng lặp trong cùng một file CSV -> Ghi nhận dòng trùng vào báo cáo để BTC kiểm tra lại tính hợp lệ của khách mời.

#### B. Quyết định thiết kế (Design Decisions)
* **Giải pháp lựa chọn (What):** Sử dụng **Chunk-based CSV Reading (Đọc CSV theo khối)** kết hợp chiến lược xử lý lỗi **Partial Success (Thành công một phần)**.
* **Lý do lựa chọn (Why):** 
  - File CSV có thể chứa hàng nghìn dòng khách mời. Đọc theo khối giúp tiết kiệm bộ nhớ RAM của server.
  - Chiến lược Thành công một phần giúp hệ thống không bị treo hoặc rollback toàn bộ file khi chỉ có một vài dòng bị sai định dạng. BTC có thể tải về danh sách lỗi cụ thể để sửa nhanh.
* **Đánh đổi / Rủi ro (Trade-offs):** Đòi hỏi thiết kế giao diện Admin theo dõi tiến độ công việc (import progress tracking) do xử lý chạy ngầm.
* **Giải pháp thay thế bị loại bỏ (Alternatives):**
  - *Rollback toàn bộ khi có lỗi (All-or-Nothing Transaction):* Bị loại bỏ vì nếu file CSV 2000 dòng có 2 dòng bị lỗi nhỏ, việc hủy bỏ toàn bộ và bắt BTC sửa rồi upload lại từ đầu rất tốn thời gian trong đêm sát ngày diễn ra sự kiện.
