# Mục 5: Mô Tả Các Luồng Nghiệp Vụ Quan Trọng & Quyết Định Thiết Kế (Business Flows & Design Decisions)

Tài liệu này mô tả 6 luồng nghiệp vụ cốt lõi của hệ thống TicketBox. Mỗi luồng được trình bày theo cùng một cấu trúc gồm: Tác nhân (Actors), Thành phần (Components), Kịch bản nghiệp vụ (Main/Alternative/Exception Flows) và Quyết định thiết kế (Design Decisions).

---

## 1. Phân Tích Các Tác Nhân Hệ Thống (Actor Analysis)

Hệ thống TicketBox phân chia vai trò rõ rệt để phân quyền truy cập thông qua mô hình RBAC và kiểm soát các luồng xử lý:

| Tác nhân (Actor)                      | Phân loại             | Mô tả vai trò & Phạm vi tương tác                                                                                                                               |
| :------------------------------------ | :-------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Khán giả (Audience)**               | Người dùng cuối       | Sử dụng `Audience Web App` để duyệt thông tin concert, xem sơ đồ ghế SVG, chọn vé, thực hiện thanh toán qua cổng thanh toán ngoài và nhận e-ticket (mã QR).     |
| **Ban tổ chức (Organizer)**           | Quản trị viên đối tác | Sử dụng `Admin Web App` để tạo sự kiện, cấu hình hạng vé, tải lên PDF để sinh bio nghệ sĩ bằng AI, import danh sách khách VIP từ CSV, và xem báo cáo doanh thu. |
| **Nhân sự soát vé (Check-in Staff)**  | Người dùng vận hành   | Sử dụng `Check-in Mobile App` tại cổng sự kiện để quét mã QR soát vé. Hỗ trợ quét trực tuyến (Online) và ngoại tuyến (Offline) khi mất kết nối mạng.            |
| **Admin hệ thống (System Admin)**     | Quản trị viên tối cao | Sở hữu toàn bộ quyền hạn trong hệ thống. Quản lý danh sách tài khoản người dùng, cấu hình vai trò, gán quyền (RBAC Matrix) và cấu hình tham số hệ thống.        |
| **Cổng thanh toán (Payment Gateway)** | Hệ thống bên ngoài    | Các bên thứ ba (VNPAY/MoMo) thực thi xử lý giao dịch tài chính, cung cấp giao diện thanh toán bảo mật và gửi webhook IPN về server để xác nhận giao dịch.       |
| **Dịch vụ gửi Email (Email Service)** | Hệ thống bên ngoài    | Dịch vụ gửi thư điện tử (như SendGrid/Mailgun) nhận yêu cầu gửi thư từ hàng đợi để chuyển e-ticket QR hoặc thư nhắc nhở sự kiện đến hòm thư Khán giả.           |
| **Dịch vụ AI (AI Service)**           | Hệ thống bên ngoài    | Các mô hình ngôn ngữ lớn (OpenAI/Gemini) nhận văn bản thô trích xuất từ PDF nghệ sĩ, phân tích và trả về nội dung tiểu sử được tóm tắt chuẩn hóa.               |

---

## 2. Các Thành Phần Hệ Thống Tham Gia (System Components)

Các luồng nghiệp vụ tương tác qua các thành phần công nghệ sau:
1. **Audience Web App**: Giao diện SPA (Single Page Application) dành cho khán giả.
2. **Admin Web App**: Giao diện Web quản trị dành cho Ban tổ chức và Admin hệ thống.
3. **Check-in Mobile App**: Ứng dụng di động (iOS/Android) dành cho nhân viên kiểm soát vé tại sân vận động.
4. **Backend API**: Hệ thống API Core xử lý nghiệp vụ chính của TicketBox.
5. **PostgreSQL Database**: Bộ lưu trữ dữ liệu quan hệ chính (Concerts, Orders, Tickets, Users, Roles).
6. **Redis**: Bộ nhớ đệm availability, rate limiting, waiting room, idempotency tạm thời và short-lived coordination. PostgreSQL transaction vẫn là cơ chế quyết định cuối cùng khi giữ/trừ vé.
7. **Message Queue (bullMQ)**: Hàng đợi xử lý tác vụ ngầm chạy trên nền Redis.
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
  3. Hệ thống kiểm tra số lượng vé còn khả dụng.
  4. Nếu số vé còn đủ, hệ thống giữ số vé cần mua trong một giao dịch ngắn, tạo đơn hàng chờ thanh toán và giữ vé trong vòng 10 phút.
  5. Hệ thống gọi API sang `Payment Gateway` (VNPAY/MoMo) để sinh đường dẫn thanh toán (payment link).
  6. Khán giả thực hiện thanh toán trên cổng của bên thứ ba. Sau khi thành công, `Payment Gateway` gửi callback xác nhận cho Backend API.
  7. Hệ thống ghi nhận đơn hàng đã thanh toán và phát hành vé điện tử chứa mã QR gửi tới khách hàng.
* **Alternative Flows (Luồng thay thế):**
  - **A1 (Vé trong kho không đủ):**
    1. Tại bước 3 của Main Flow, Backend API đọc số lượng vé khả dụng từ Redis cache để phản hồi nhanh cho người dùng.
    2. Nếu cache cho thấy số lượng còn lại nhỏ hơn số lượng Khán giả yêu cầu, Backend không mở giao dịch tạo đơn hàng.
    3. Backend trả về lỗi nghiệp vụ kèm số vé còn lại hiện tại để `Audience Web App` hiển thị cho Khán giả.
    4. Khán giả giảm số lượng vé hoặc chọn hạng vé khác rồi gửi lại yêu cầu mua.
    5. Nếu dữ liệu cache chưa kịp cập nhật nhưng kiểm tra cuối ở database phát hiện không đủ vé, Backend hủy giao dịch xử lý, làm mới dữ liệu số lượng vé của hạng vé đó và trả về cùng thông báo hết/không đủ vé.
  - **A2 (Vượt giới hạn tài khoản):**
    1. Tại bước 3 của Main Flow, Backend API kiểm tra tổng số vé mà khán giả đã mua hoặc đang giữ trong cùng hạng vé.
    2. Backend cộng thêm số vé đang yêu cầu để ra tổng dự kiến sau giao dịch này.
    3. Nếu tổng dự kiến vượt giới hạn, Backend dừng ngay trước khi giữ vé và trả về thông báo không thể mua thêm.
    4. `Audience Web App` hiển thị số vé đã mua/đang giữ và số vé tối đa còn có thể mua trong hạng vé đó.
    5. Khán giả điều chỉnh số lượng trong phạm vi cho phép rồi gửi lại yêu cầu mua.
  - **A3 (Hết hạn giữ vé - Timeout):**
    1. Sau bước 5 của Main Flow, đơn hàng chờ thanh toán được gắn thời điểm hết hạn sau 10 phút.
    2. Nếu Payment Gateway không gửi xác nhận thành công trước thời điểm hết hạn, tác vụ nền chọn đơn hàng quá hạn để xử lý.
    3. Backend mở giao dịch xử lý và kiểm tra đơn hàng vẫn chưa thanh toán để tránh xử lý nhầm đơn hàng đã thành công.
    4. Backend đánh dấu đơn hàng hết hạn và giải phóng số vé đã giữ.
    5. Backend làm mới dữ liệu số lượng vé trên Redis và ghi log hết hạn để phục vụ audit/support.
    6. Nếu Khán giả quay lại từ trang thanh toán sau khi đơn hàng đã hết hạn, hệ thống hiển thị thông báo đơn hàng đã hết hạn và yêu cầu đặt lại.
* **Exception Flows (Luồng ngoại lệ):**
  - **E1 (Thanh toán thất bại/Khách hủy):**
    1. Sau bước 5 của Main Flow, Khán giả hủy giao dịch, đóng trang thanh toán hoặc ngân hàng trả về trạng thái thất bại.
    2. Payment Gateway chuyển hướng Khán giả về trang kết quả thất bại hoặc gửi callback thất bại về Backend API.
    3. Backend xác minh chữ ký callback và đối chiếu thông tin giao dịch với đơn hàng tương ứng.
    4. Nếu đơn hàng vẫn đang chờ thanh toán, Backend cập nhật trạng thái thanh toán thất bại.
    5. Backend giải phóng vé đã giữ, làm mới dữ liệu số lượng vé trên Redis và ghi log lỗi thanh toán.
    6. `Audience Web App` hiển thị trạng thái thanh toán thất bại và cho phép Khán giả tạo đơn hàng mới nếu vé vẫn còn.
  - **E2 (Webhook thanh toán gửi trùng - Double Callback):**
    1. Payment Gateway gửi lại cùng một thông báo thanh toán nhiều lần do cơ chế thử lại hoặc do không nhận được phản hồi từ Backend.
    2. Backend xác minh chữ ký callback và tra cứu giao dịch theo mã định danh duy nhất của gateway hoặc khóa chống xử lý trùng.
    3. Nếu giao dịch đã được xử lý thành công, Backend không tạo thêm vé và không gửi thêm email phát hành vé.
    4. Backend ghi nhận lần callback trùng vào audit log để phục vụ đối soát.
    5. Backend trả phản hồi thành công cho Payment Gateway để gateway dừng gửi lại.
  - **E3 (Tranh chấp vé cuối cùng):**
    1. Nhiều Khán giả gửi yêu cầu mua cùng một hạng vé gần như đồng thời khi chỉ còn rất ít vé.
    2. Mỗi yêu cầu đi đến bước 4 của Main Flow và cố gắng giữ cùng một hạng vé.
    3. Giao dịch đầu tiên lấy được quyền xử lý sẽ kiểm tra còn vé, giữ số lượng cần mua và tạo đơn hàng chờ thanh toán.
    4. Các giao dịch đến sau phải chờ, sau đó đọc lại số lượng mới nhất trong PostgreSQL.
    5. Nếu số lượng còn lại không đủ, Backend hủy giao dịch xử lý của yêu cầu đến sau.
    6. Hệ thống trả thông báo hết vé hoặc không đủ vé, đồng thời làm mới dữ liệu số lượng vé để giao diện không tiếp tục hiển thị số lượng cũ.

#### B. Quyết định thiết kế (Design Decisions)
* **Giải pháp lựa chọn (What):** Sử dụng **Pessimistic Locking (Khóa bi quan)** bằng câu lệnh `SELECT ... FOR UPDATE` trong Database Transaction của PostgreSQL khi thực hiện trừ vé.
* **Lý do lựa chọn (Why):** Vé concert có mức cạnh tranh rất cao khi mở bán. Khóa bi quan cho phép serialize việc cập nhật cùng một `ticket_type` tại PostgreSQL, qua đó ngăn oversell khi transaction, constraint và xử lý lỗi được triển khai đúng.
* **Đánh đổi / Rủi ro (Trade-offs):** Có thể gây lock contention và tăng latency khi nhiều request cùng tranh một hạng vé. Vì vậy transaction phải ngắn, connection pool phải được giới hạn hợp lý, đồng thời rate limiting/waiting room cần lọc tải trước database. Throughput thực tế phụ thuộc hạ tầng, index, pool và độ dài transaction; nhóm sẽ xác nhận bằng load test thay vì cam kết một con số cố định.
* **Giải pháp thay thế bị loại bỏ (Alternatives):** 
  - *Optimistic Locking (Khóa lạc quan) với trường version:* Bị loại bỏ vì khi hàng ngàn người tranh mua một số lượng vé nhỏ, tỷ lệ xung đột phiên bản quá cao dẫn đến hàng loạt transaction bị rollback vô ích, làm giảm tỷ lệ mua vé thành công của người dùng thực tế.

---

### 3.2. Luồng 2: Thông Báo Xác Nhận và Nhắc Nhở (Notifications)

* **Tác nhân tham gia (Actors):** Khán giả (Audience), Dịch vụ gửi Email (Email Service).
* **Thành phần tham gia (Components):** Backend API, Redis (bullMQ), Queue Worker, PostgreSQL Database, Email Service.

#### A. Luồng xử lý nghiệp vụ (Business Flow)
* **Main Flow (Luồng chính):**
  1. Khi đơn hàng của Khán giả được xác nhận thanh toán thành công, Backend API tiến hành sinh mã QR e-ticket.
  2. Backend API tạo một tác vụ gửi email xác nhận mua vé thành công kèm mã QR vé và đẩy vào hàng đợi `Message Queue` (bullMQ chạy trên nền Redis).
  3. `Queue Worker` lấy tác vụ ra khỏi hàng đợi.
  4. Worker gọi API sang dịch vụ gửi email ngoài (SendGrid/Mailgun) để chuyển e-ticket đến hòm thư Khán giả.
  5. Định kỳ hàng giờ, tác vụ lịch quét PostgreSQL tìm các vé có concert diễn ra sau 24 giờ tới và tự động đẩy các tác vụ nhắc nhở vào `Message Queue`.
  6. Worker xử lý tác vụ nhắc nhở và gọi dịch vụ ngoài gửi email nhắc nhở về thời gian và địa điểm concert cho Khán giả.
* **Alternative Flows (Luồng thay thế):**
  - **A1 (Thay đổi thông tin vé/sự kiện):**
    1. Ban tổ chức cập nhật thông tin quan trọng của concert như thời gian, địa điểm, cổng vào hoặc sơ đồ khu vực.
    2. Backend API lưu thay đổi vào PostgreSQL và đánh dấu phiên bản thông tin concert mới.
    3. Backend truy vấn danh sách đơn hàng và vé đã thanh toán của concert bị ảnh hưởng.
    4. Backend tạo các tác vụ thông báo thay đổi theo từng nhóm người nhận và đẩy vào `Message Queue`.
    5. Worker lấy từng tác vụ, dựng nội dung email nêu rõ thông tin cũ, thông tin mới và hướng dẫn cần thiết cho Khán giả.
    6. Worker gọi Email Service để gửi thông báo; nếu e-ticket cần cập nhật thông tin hiển thị, email đính kèm hoặc dẫn đến phiên bản vé mới.
    7. Hệ thống ghi log gửi thông báo theo từng người nhận để Ban tổ chức theo dõi tiến độ.
  - **A2 (Khán giả yêu cầu gửi lại e-ticket):**
    1. Khán giả đăng nhập và mở trang lịch sử đơn hàng hoặc liên hệ support để yêu cầu gửi lại vé.
    2. Backend kiểm tra đơn hàng thuộc về Khán giả và đã được thanh toán.
    3. Backend không tạo QR mới, chỉ lấy lại thông tin vé đã phát hành để giữ nguyên tính duy nhất của vé.
    4. Backend đẩy tác vụ gửi lại e-ticket vào `Message Queue`.
    5. Worker gửi lại email vé và ghi nhận đây là lần gửi lại trong lịch sử thông báo.
* **Exception Flows (Luồng ngoại lệ):**
  - **E1 (API bên thứ ba bị sập/timeout):**
    1. Worker gọi API Email Service trong bước 4 hoặc bước 6 của Main Flow nhưng yêu cầu bị quá thời gian chờ hoặc nhận lỗi phía nhà cung cấp.
    2. Worker đánh dấu lần gửi hiện tại là thất bại tạm thời và lưu thông tin lỗi vào lịch sử thông báo.
    3. bullMQ áp dụng chính sách thử lại, ví dụ thử lại sau 5 phút và tối đa 3 lần.
    4. Nếu lần thử lại tiếp theo thành công, Worker cập nhật lịch sử gửi thành công và kết thúc tác vụ.
    5. Nếu đủ số lần thử lại vẫn thất bại, tác vụ được chuyển vào hàng đợi lỗi để xử lý sau.
    6. Hệ thống gửi cảnh báo vận hành cho Admin hệ thống để kiểm tra provider hoặc gửi thủ công cho các vé bị ảnh hưởng.
  - **E2 (Sai địa chỉ email):**
    1. Email Service chấp nhận yêu cầu gửi mail nhưng sau đó nhận thông báo bị trả lại từ mail server đích.
    2. Email Service gọi webhook bounce về Backend API kèm mã lỗi và địa chỉ email bị trả lại.
    3. Backend xác minh thông báo từ nhà cung cấp và tìm lịch sử gửi tương ứng.
    4. Backend đánh dấu email bị trả lại, lưu lý do và thời điểm nhận thông báo.
    5. Nếu đây là e-ticket sau thanh toán, hệ thống đánh dấu đơn hàng cần support theo dõi để tránh Khán giả không nhận được vé.
    6. Support/Admin có thể cập nhật email đúng và kích hoạt Alternative Flow A2 để gửi lại e-ticket.
  - **E3 (Job thông báo bị tạo trùng):**
    1. Backend nhận cùng một sự kiện thanh toán thành công hoặc nhắc lịch nhiều lần do cơ chế thử lại.
    2. Trước khi đưa vào hàng đợi, Backend kiểm tra khóa chống xử lý trùng theo loại sự kiện, đơn hàng hoặc vé và kênh gửi.
    3. Nếu tác vụ tương ứng đã tồn tại hoặc đã gửi thành công, Backend bỏ qua việc tạo tác vụ mới.
    4. Nếu tác vụ trước đó thất bại vĩnh viễn, Backend cho phép tạo tác vụ thử lại thủ công với mã lý do riêng.
    5. Hệ thống ghi log để audit việc chống gửi email trùng cho cùng một vé.

#### B. Quyết định thiết kế (Design Decisions)
* **Giải pháp lựa chọn (What):** Sử dụng kiến trúc **Event-Driven & Queue Processing** (bullMQ/Redis) kết hợp mẫu thiết kế **Adapter Pattern** cho Notification Service.
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
  1. Ban tổ chức đăng nhập vào `Admin Web App`, hệ thống trả về phiên đăng nhập kèm danh sách quyền.
  2. Ban tổ chức điền thông tin để tạo concert mới và cấu hình các hạng vé, bao gồm tên, giá, tổng số lượng và giới hạn mua của từng hạng.
  3. API Gateway và Backend Middleware kiểm tra tính hợp lệ của token và đối chiếu quyền truy cập (RBAC). Nếu hợp lệ, Backend ghi nhận thông tin concert và cấu hình vé vào PostgreSQL Database.
  4. Hệ thống đồng thời thực hiện xóa các key cache danh sách concert cũ trên Redis để đảm bảo cập nhật thông tin mới nhất ra Client.
* **Alternative Flows (Luồng thay thế):**
  - **A1 (Cập nhật concert):**
    1. Ban tổ chức mở concert đã tạo trên `Admin Web App` và chỉnh sửa thông tin như mô tả, ảnh, thời gian, địa điểm hoặc sơ đồ ghế.
    2. Frontend gửi yêu cầu cập nhật kèm thông tin phiên đăng nhập đến Backend API.
    3. Backend Middleware kiểm tra token, quyền cập nhật concert và quyền sở hữu concert của Ban tổ chức.
    4. Backend validate dữ liệu mới, bao gồm định dạng thời gian, trạng thái concert và tính hợp lệ của sơ đồ ghế/ticket type.
    5. Backend ghi thay đổi vào PostgreSQL trong một giao dịch xử lý.
    6. Backend làm mới các dữ liệu cache liên quan đến danh sách concert, chi tiết concert và số lượng vé nếu thay đổi ảnh hưởng đến vé.
    7. Hệ thống trả về phiên bản concert mới để Admin Web App hiển thị lại.
  - **A2 (Hủy concert):**
    1. Ban tổ chức chọn thao tác hủy concert và nhập lý do hủy.
    2. Backend kiểm tra quyền hủy concert và xác nhận concert chưa diễn ra.
    3. Backend chuyển concert sang trạng thái đã hủy trong PostgreSQL.
    4. Backend khóa các chức năng mua vé mới cho concert đó và làm mới dữ liệu hiển thị công khai.
    5. Backend truy vấn các đơn hàng đã thanh toán để tạo tác vụ hoàn tiền hoặc đối soát hoàn tiền theo chính sách cổng thanh toán.
    6. Backend tạo tác vụ thông báo hủy concert cho toàn bộ Khán giả đã mua vé.
    7. Admin Web App hiển thị trạng thái hủy, số đơn hàng bị ảnh hưởng và tiến độ hoàn tiền/thông báo.
  - **A3 (Admin hệ thống cập nhật phân quyền):**
    1. Admin hệ thống mở màn hình quản lý vai trò và chọn user/role cần chỉnh sửa.
    2. Backend kiểm tra Admin có quyền quản lý phân quyền.
    3. Backend cập nhật quan hệ giữa người dùng, vai trò và quyền trong PostgreSQL.
    4. Backend làm mới cache quyền của người dùng bị ảnh hưởng trên Redis.
    5. Các yêu cầu tiếp theo của người dùng phải dùng quyền mới; nếu phiên cũ không còn hợp lệ, hệ thống yêu cầu đăng nhập lại hoặc làm mới phiên.
* **Exception Flows (Luồng ngoại lệ):**
  - **E1 (Không đủ quyền truy cập - Unauthorized):**
    1. Người dùng không có vai trò phù hợp gửi yêu cầu tạo/sửa concert, cấu hình vé hoặc quản lý RBAC.
    2. Backend Middleware xác thực phiên đăng nhập và trích xuất danh sách quyền.
    3. Backend phát hiện người dùng thiếu quyền bắt buộc hoặc không thuộc Ban tổ chức sở hữu concert.
    4. Backend dừng xử lý trước khi ghi database.
    5. Backend trả lỗi không đủ quyền kèm mã lỗi nghiệp vụ nhất quán cho frontend.
    6. Hệ thống ghi log bảo mật gồm người dùng, thao tác, thiết bị, địa chỉ truy cập và thời điểm để phục vụ audit.
  - **E2 (Chỉnh sửa hạng vé khi đã có người mua):**
    1. Ban tổ chức gửi yêu cầu giảm tổng số lượng của một hạng vé.
    2. Backend mở giao dịch xử lý và đọc số vé đã bán, số vé đang giữ thanh toán và số vé đã check-in nếu có.
    3. Nếu tổng số lượng mới nhỏ hơn số vé đã bán hoặc đang giữ hợp lệ, Backend từ chối cập nhật.
    4. Backend hủy giao dịch xử lý và trả lỗi: *"Không thể giảm số lượng vé thấp hơn số lượng đã bán hoặc đang giữ."*
    5. Admin Web App hiển thị số lượng tối thiểu hợp lệ để Ban tổ chức nhập lại.
  - **E3 (Token hết hạn hoặc bị thu hồi):**
    1. Người dùng thao tác trên Admin Web App sau khi phiên đăng nhập hết hạn hoặc quyền đã bị Admin hệ thống thu hồi.
    2. Backend Middleware phát hiện phiên hết hạn, phiên không hợp lệ hoặc quyền trong phiên không còn khớp với quyền hiện tại.
    3. Backend trả lỗi yêu cầu đăng nhập lại nếu phiên hết hạn, hoặc lỗi không đủ quyền nếu quyền đã bị thu hồi.
    4. Admin Web App xóa session cục bộ và chuyển người dùng về màn hình đăng nhập hoặc hiển thị thông báo thiếu quyền.
    5. Hệ thống ghi audit log nếu token bị thu hồi do thay đổi phân quyền.

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
  2. Mobile App gửi yêu cầu soát vé kèm mã QR và thời điểm quét trực tiếp lên `Backend API`.
  3. API kiểm tra tính hợp lệ và trạng thái check-in của vé trong PostgreSQL. Nếu hợp lệ, API ghi nhận vé đã được check-in và lưu lịch sử quét trực tuyến.
  4. Mobile App hiển thị màn hình thông báo check-in thành công (giao diện màu xanh).
* **Alternative Flows (Luồng thay thế):**
  - **A1 (Offline soát vé khi mất mạng ở sân vận động):**
    1. Trước sự kiện, Check-in Staff đăng nhập thiết bị và đồng bộ danh sách vé hợp lệ của concert về bộ nhớ cục bộ trên thiết bị.
    2. Backend trả về bản dữ liệu cục bộ gồm mã vé đã được mã hóa, trạng thái check-in hiện tại và thời điểm đồng bộ.
    3. Khi mất mạng tại cổng vào, Mobile App chuyển sang chế độ offline và chỉ cho quét nếu dữ liệu cục bộ chưa vượt quá thời hạn cho phép.
    4. Nhân sự quét QR của Khán giả; app mã hóa mã QR và đối chiếu với dữ liệu cục bộ.
    5. Nếu vé hợp lệ và chưa được đánh dấu check-in trong dữ liệu cục bộ, app ghi nhận lượt quét vào hàng đợi trên thiết bị kèm thông tin thiết bị, nhân sự và thời điểm quét.
    6. Mobile App hiển thị trạng thái check-in tạm thời thành công để không làm tắc cổng.
    7. Khi có kết nối mạng trở lại, app gửi các lượt quét offline lên Backend API theo thứ tự thời gian quét.
    8. Backend xử lý đồng bộ, ghi nhận các lượt quét hợp lệ và trả danh sách lượt quét bị xung đột nếu có.
  - **A2 (Quét thủ công khi camera không đọc được QR):**
    1. Camera thiết bị không đọc được mã QR do màn hình Khán giả quá tối, QR bị mờ hoặc vé in bị nhăn.
    2. Check-in Staff chọn chế độ nhập mã thủ công trên Mobile App.
    3. Staff nhập mã vé hoặc mã định danh ngắn hiển thị trên e-ticket.
    4. Mobile App gửi mã này lên Backend nếu online, hoặc đối chiếu với dữ liệu cục bộ nếu offline.
    5. Hệ thống áp dụng cùng quy tắc hợp lệ/chưa check-in như luồng quét QR.
    6. Lượt check-in được đánh dấu là nhập mã thủ công để phục vụ audit.
* **Exception Flows (Luồng ngoại lệ):**
  - **E1 (Vé đã được check-in trước đó):**
    1. Staff quét QR hoặc nhập mã vé của một vé đã được check-in trước đó.
    2. Nếu online, Backend tra cứu PostgreSQL và tìm thấy lịch sử check-in trước đó.
    3. Backend trả lỗi vé đã được sử dụng kèm thời điểm quét trước, cổng/thiết bị và staff đã quét nếu dữ liệu cho phép hiển thị.
    4. Nếu offline, Mobile App đối chiếu dữ liệu cục bộ và thấy vé đã được đánh dấu check-in trên cùng thiết bị hoặc trong bản đồng bộ.
    5. Mobile App hiển thị cảnh báo đỏ, âm báo lỗi và không cho Staff xác nhận khách vào cổng.
    6. Hệ thống ghi thêm log attempt để Ban tổ chức kiểm tra nghi vấn dùng lại vé.
  - **E2 (Xung đột đồng bộ khi sync offline - Conflict):**
    1. Cùng một vé được quét thành công ở hai thiết bị offline khác nhau trước khi một trong hai thiết bị kịp sync.
    2. Thiết bị thứ nhất đồng bộ lên Backend; nếu vé chưa có lượt check-in trực tuyến, Backend chấp nhận lượt quét và ghi nhận vé đã được check-in.
    3. Thiết bị thứ hai đồng bộ cùng vé lên Backend sau đó.
    4. Backend phát hiện vé đã có lịch sử check-in hợp lệ từ thiết bị khác.
    5. Backend so sánh thời điểm quét; lượt quét sớm nhất được chấp nhận, lượt quét còn lại được đánh dấu xung đột.
    6. Backend trả danh sách conflict về Mobile App để Staff/Ban tổ chức xử lý tại cổng hoặc sau sự kiện.
    7. Hệ thống lưu đầy đủ thông tin thiết bị, nhân sự, cổng vào và thời điểm để phục vụ điều tra gian lận.
  - **E3 (Dữ liệu offline quá cũ):**
    1. Thiết bị đã tải dữ liệu vé nhưng không kết nối mạng trong thời gian dài.
    2. Khi Staff mở chế độ offline, Mobile App kiểm tra thời điểm đồng bộ gần nhất và thời hạn hiệu lực offline.
    3. Nếu dữ liệu quá cũ, app cảnh báo dữ liệu không còn đủ tin cậy để soát vé.
    4. App yêu cầu thiết bị kết nối mạng để đồng bộ lại danh sách vé trước khi tiếp tục quét.
    5. Nếu Ban tổ chức cho phép xử lý khẩn cấp, mọi lượt quét sau đó được gắn cờ dữ liệu cũ để Backend kiểm tra kỹ khi đồng bộ.
  - **E4 (QR không hợp lệ hoặc bị giả mạo):**
    1. Staff quét một QR không tồn tại trong PostgreSQL hoặc không có trong dữ liệu offline trên thiết bị.
    2. Hệ thống xác định token không hợp lệ, sai chữ ký, sai concert hoặc không thuộc ngày sự kiện.
    3. Mobile App hiển thị cảnh báo đỏ và không tạo check-in thành công.
    4. Lượt quét thất bại được ghi log với dữ liệu tối thiểu của QR để phục vụ phân tích gian lận nhưng không lưu thông tin nhạy cảm không cần thiết.

#### B. Quyết định thiết kế (Design Decisions)
* **Giải pháp lựa chọn (What):** Sử dụng cơ chế lưu trữ **SQLite Local** trên thiết bị di động kết hợp chiến lược đồng bộ **Timestamp-based Conflict Resolution (Giải quyết xung đột dựa trên mốc thời gian)** trên server.
* **Lý do lựa chọn (Why):** Các concert lớn có vùng sóng không ổn định. Thiết kế offline-first đảm bảo nhân sự soát vé hoạt động liên tục không bị gián đoạn (không gây ùn tắc tại cổng). Việc xử lý xung đột thời gian trên server đảm bảo tính chính xác và phát hiện được gian lận.
* **Đánh đổi / Rủi ro (Trade-offs):** Có rủi ro một vé giả hoặc vé bị in làm hai bản có thể đi qua cổng offline trước khi gói tin đồng bộ được gửi lên server. Tuy nhiên, đây là sự đánh đổi chấp nhận được để giữ cho dòng người vào cổng không bị tắc nghẽn.
* **Giải pháp thay thế bị loại bỏ (Alternatives):**
  - *Chỉ soát vé trực tuyến (Online Only Check-in):* Bị loại bỏ vì khi hàng chục nghìn người tập trung, mạng di động chắc chắn nghẽn, dẫn đến tê liệt hoàn toàn cổng soát vé.

---

### 3.5. Luồng 5: Tạo Artist Bio Tự Động (AI Artist Bio)

* **Tác nhân tham gia (Actors):** Ban tổ chức (Organizer), Dịch vụ AI (AI Service).
* **Thành phần tham gia (Components):** Admin Web App, Backend API, Object Storage, Redis (bullMQ), Queue Worker, PostgreSQL Database, AI Service.

#### A. Luồng xử lý nghiệp vụ (Business Flow)
* **Main Flow (Luồng chính):**
  1. Ban tổ chức upload file PDF hồ sơ giới thiệu nghệ sĩ lên `Admin Web App`.
  2. Backend API lưu PDF vào `Object Storage` và tạo tác vụ xử lý đang chờ trong PostgreSQL.
  3. Backend đẩy một tác vụ xử lý PDF vào `Message Queue` (bullMQ/Redis).
  4. `Queue Worker` nhận tác vụ, thực hiện trích xuất text từ file PDF và làm sạch văn bản thô.
  5. Worker gửi văn bản đã làm sạch sang `AI Service` (OpenAI/Gemini) kèm prompt tóm tắt.
  6. AI phản hồi kết quả. Worker lưu kết quả tóm tắt vào database dưới dạng bản nháp bio của concert và đánh dấu tác vụ hoàn tất.
  7. BTC nhận thông báo, xem lại bản nháp bio trên trang Admin, thực hiện chỉnh sửa nếu cần, rồi bấm **"Publish"** để hiển thị ra trang công chúng.
* **Alternative Flows (Luồng thay thế):**
  - **A1 (Nhập bio thủ công không cần AI):**
    1. Ban tổ chức chọn chế độ nhập thủ công thay vì upload PDF.
    2. Admin Web App hiển thị trình soạn thảo nội dung bio.
    3. Ban tổ chức nhập nội dung tiểu sử, ảnh hoặc các thông tin phụ trợ nếu có.
    4. Backend validate độ dài, định dạng HTML/Markdown an toàn và quyền chỉnh sửa concert.
    5. Backend lưu nội dung thành bản nháp hoặc xuất bản trực tiếp tùy lựa chọn của Ban tổ chức.
    6. Nếu Ban tổ chức bấm **"Publish"**, Backend chuyển bio sang trạng thái công khai và làm mới cache chi tiết concert.
  - **A2 (Upload lại PDF để tạo bản nháp mới):**
    1. Ban tổ chức không hài lòng với bản nháp AI hiện tại và upload file PDF mới.
    2. Backend lưu file mới vào Object Storage và tạo tác vụ AI mới liên kết với concert.
    3. Bản bio đang publish vẫn được giữ nguyên để trang công chúng không bị trống trong lúc xử lý.
    4. Worker xử lý PDF mới và lưu kết quả vào bản nháp phiên bản mới.
    5. Ban tổ chức so sánh/chỉnh sửa bản nháp mới rồi quyết định publish.
  - **A3 (Chỉnh sửa bản nháp AI trước khi publish):**
    1. Worker hoàn tất tác vụ AI và tạo bản nháp bio.
    2. Ban tổ chức mở bản nháp trên Admin Web App.
    3. Ban tổ chức chỉnh sửa các đoạn chưa đúng, thêm thông tin thiếu hoặc xóa nội dung không phù hợp.
    4. Backend lưu từng lần chỉnh sửa hoặc lưu khi Ban tổ chức bấm cập nhật.
    5. Chỉ khi Ban tổ chức bấm **"Publish"**, nội dung mới được hiển thị ra Audience Web App.
* **Exception Flows (Luồng ngoại lệ):**
  - **E1 (PDF không đọc được text):**
    1. Worker tải file PDF từ Object Storage và thử trích xuất văn bản.
    2. Công cụ parse trả về rỗng hoặc tỷ lệ ký tự đọc được thấp do PDF là bản scan ảnh, bị khóa hoặc lỗi định dạng.
    3. Worker đánh dấu tác vụ thất bại với lý do không trích xuất được nội dung từ PDF.
    4. Backend giữ nguyên bio đang publish hiện tại nếu có.
    5. Admin Web App hiển thị lỗi cụ thể và gợi ý Ban tổ chức upload PDF có text thật hoặc chuyển sang Alternative Flow A1 để nhập thủ công.
  - **E2 (AI Service lỗi/timeout):**
    1. Worker đã trích xuất được text nhưng yêu cầu đến AI Service bị quá thời gian chờ, bị giới hạn tần suất hoặc nhận lỗi phía nhà cung cấp.
    2. Worker ghi nhận lỗi nhà cung cấp và thử lại theo chính sách queue nếu lỗi có thể phục hồi.
    3. Nếu thử lại thành công, Worker tiếp tục lưu bản nháp bio như Main Flow.
    4. Nếu vượt quá số lần thử lại, Worker đánh dấu tác vụ thất bại.
    5. Admin Web App hiển thị trạng thái thất bại, cho phép Ban tổ chức bấm thử lại hoặc nhập bio thủ công.
  - **E3 (Nội dung AI trả về không phù hợp):**
    1. AI Service trả về bio nhưng nội dung sai thông tin, quá dài, chứa ngôn ngữ không phù hợp hoặc không đúng giọng văn sự kiện.
    2. Worker lưu kết quả dưới dạng bản nháp thay vì xuất bản tự động.
    3. Ban tổ chức xem bản nháp và phát hiện nội dung cần sửa.
    4. Ban tổ chức chỉnh sửa thủ công theo Alternative Flow A3 hoặc hủy bản nháp.
    5. Hệ thống chỉ hiển thị nội dung ra trang công chúng sau khi Ban tổ chức publish.
  - **E4 (File upload vượt giới hạn hoặc sai định dạng):**
    1. Ban tổ chức upload file không phải PDF hoặc file vượt quá dung lượng cho phép.
    2. Backend kiểm tra metadata và MIME type trước khi lưu lâu dài.
    3. Backend từ chối upload, không tạo tác vụ AI và không ghi file vào Object Storage chính thức.
    4. Admin Web App hiển thị lỗi định dạng/dung lượng để Ban tổ chức chọn file khác.

#### B. Quyết định thiết kế (Design Decisions)
* **Giải pháp lựa chọn (What):** Sử dụng **Asynchronous Worker Processing (Xử lý Worker bất đồng bộ)** kết hợp quy trình phê duyệt **Draft / Publish** (Human-in-the-loop).
* **Lý do lựa chọn (Why):** Trích xuất text từ file PDF lớn và gọi API AI là các tác vụ tốn thời gian (có thể mất 5 - 15 giây). Xử lý bất đồng bộ giúp tránh tình trạng timeout của HTTP request. Trạng thái `Draft` đảm bảo nội dung do AI tạo ra được kiểm soát chất lượng bởi con người trước khi hiển thị cho Khán giả.
* **Đánh đổi / Rủi ro (Trade-offs):** BTC phải duyệt thủ công, không hiển thị bio ngay lập tức khi upload PDF.
* **Giải pháp thay thế bị loại bỏ (Alternatives):**
  - *Xử lý đồng bộ trực tiếp (Synchronous Call):* Bị loại bỏ vì gây block luồng xử lý của web server, dễ dẫn đến timeout và cạn kiệt tài nguyên máy chủ.

---

### 3.6. Luồng 6: Đồng Bộ Danh Sách Khách Mời VIP (VIP Guest Sync)

* **Tác nhân tham gia (Actors):** Ban tổ chức (Organizer).
* **Thành phần tham gia (Components):** Admin Web App, Backend API, Redis (bullMQ), Queue Worker, PostgreSQL Database.

#### A. Luồng xử lý nghiệp vụ (Business Flow)
* **Main Flow (Luồng chính):**
  1. Ban tổ chức upload file CSV danh sách khách VIP (họ tên, email, sđt, hạng vé VIP) từ nhãn hàng tài trợ lên `Admin Web App`.
  2. Backend lưu file, tạo tác vụ xử lý đang chờ trong PostgreSQL, và đẩy tác vụ vào queue (bullMQ/Redis).
  3. `Queue Worker` lấy tác vụ ra và tiến hành đọc file CSV theo từng khối.
  4. Worker validate định dạng dữ liệu từng dòng (email hợp lệ, sđt đúng định dạng, hạng vé có tồn tại).
  5. Worker ghi dữ liệu khách hợp lệ vào danh sách khách VIP và tự động sinh e-ticket tương ứng.
  6. Sau khi hoàn tất, worker đánh dấu tác vụ thành công và lưu danh sách các dòng bị lỗi cấu trúc dữ liệu vào database.
  7. Ban tổ chức xem kết quả và tải báo cáo chi tiết các dòng lỗi về trên Admin Web App để xử lý.
* **Alternative Flows (Luồng thay thế):**
  - **A1 (Khách VIP đã có vé trước đó):**
    1. Worker đọc một dòng CSV có email hoặc số điện thoại trùng với khách VIP đã được import trước đó cho cùng concert.
    2. Worker tra cứu danh sách khách VIP theo concert và thông tin liên hệ của khách.
    3. Nếu khách đã có ticket VIP hợp lệ, Worker không tạo thêm ticket mới.
    4. Worker cập nhật các trường thông tin có thể thay đổi như họ tên, số điện thoại hoặc ghi chú nếu dữ liệu mới hợp lệ.
    5. Worker ghi nhận dòng đó là cập nhật khách đã tồn tại trong báo cáo import.
    6. Ban tổ chức xem báo cáo để biết dòng nào được cập nhật thay vì tạo mới.
  - **A2 (Import chạy lại sau khi sửa file lỗi):**
    1. Sau Main Flow, Ban tổ chức tải báo cáo lỗi và sửa các dòng không hợp lệ trong CSV.
    2. Ban tổ chức upload lại file đã sửa hoặc chỉ upload file gồm các dòng lỗi cần xử lý lại.
    3. Backend tạo tác vụ import mới, liên kết với lần import trước đó để audit.
    4. Worker xử lý lại từng dòng và áp dụng kiểm tra trùng như A1.
    5. Các dòng hợp lệ mới được thêm vào danh sách khách VIP và phát hành e-ticket; các dòng vẫn lỗi tiếp tục được đưa vào báo cáo mới.
* **Exception Flows (Luồng ngoại lệ):**
  - **E1 (File CSV không đúng định dạng cột):**
    1. Ban tổ chức upload file CSV lên Admin Web App.
    2. Backend đọc hàng tiêu đề trước khi tạo tác vụ xử lý dài hạn.
    3. Backend phát hiện thiếu các cột bắt buộc như họ tên, email, số điện thoại, hạng vé hoặc tên cột sai định dạng.
    4. Backend từ chối import, không đưa tác vụ vào hàng đợi và không tạo vé.
    5. Admin Web App hiển thị danh sách cột thiếu/sai để Ban tổ chức sửa file.
  - **E2 (Dòng dữ liệu bị lỗi - Partial Failure):**
    1. Worker bắt đầu xử lý CSV theo chunk và validate từng dòng.
    2. Một số dòng bị thiếu email/số điện thoại, sai định dạng email, ticket type không tồn tại hoặc dữ liệu vượt độ dài cho phép.
    3. Worker bỏ qua các dòng lỗi và ghi chi tiết lỗi gồm số dòng, tên cột, giá trị lỗi và lý do lỗi vào bảng/báo cáo import.
    4. Worker tiếp tục xử lý các dòng hợp lệ khác trong cùng file.
    5. Sau khi hoàn tất, tác vụ được đánh dấu thành công một phần nếu có cả dòng thành công và dòng lỗi.
    6. Ban tổ chức tải báo cáo lỗi để sửa và chạy lại Alternative Flow A2.
  - **E3 (Khách VIP bị trùng email/phone trong cùng file):**
    1. Worker phát hiện nhiều dòng trong cùng CSV dùng chung email hoặc số điện thoại cho cùng concert.
    2. Worker chọn dòng đầu tiên hợp lệ làm bản ghi chính theo thứ tự xuất hiện trong file.
    3. Các dòng trùng sau đó không được tạo ticket để tránh phát hành vé VIP trùng.
    4. Worker ghi các dòng trùng vào báo cáo với lý do trùng thông tin trong cùng file.
    5. Ban tổ chức kiểm tra báo cáo để quyết định giữ một khách, sửa thông tin hoặc import lại.
  - **E4 (Tác vụ import bị gián đoạn giữa chừng):**
    1. Worker đang xử lý CSV thì tiến trình bị restart hoặc mất kết nối database tạm thời.
    2. Queue đánh dấu tác vụ chưa hoàn tất và thử lại theo cấu hình.
    3. Khi chạy lại, Worker dựa trên mã tác vụ import và ràng buộc chống trùng để bỏ qua các dòng đã xử lý thành công trước đó.
    4. Worker tiếp tục từ chunk hoặc dòng gần nhất có thể xác định.
    5. Nếu thử lại vẫn thất bại quá số lần cho phép, tác vụ chuyển sang trạng thái thất bại và Admin Web App hiển thị trạng thái cần xử lý thủ công.

#### B. Quyết định thiết kế (Design Decisions)
* **Giải pháp lựa chọn (What):** Sử dụng **Chunk-based CSV Reading (Đọc CSV theo khối)** kết hợp chiến lược xử lý lỗi **Partial Success (Thành công một phần)**.
* **Lý do lựa chọn (Why):** 
  - File CSV có thể chứa hàng nghìn dòng khách mời. Đọc theo khối giúp tiết kiệm bộ nhớ RAM của server.
  - Chiến lược Thành công một phần giúp hệ thống không bị treo hoặc rollback toàn bộ file khi chỉ có một vài dòng bị sai định dạng. BTC có thể tải về danh sách lỗi cụ thể để sửa nhanh.
* **Đánh đổi / Rủi ro (Trade-offs):** Đòi hỏi thiết kế giao diện Admin theo dõi tiến độ công việc (import progress tracking) do xử lý chạy ngầm.
* **Giải pháp thay thế bị loại bỏ (Alternatives):**
  - *Rollback toàn bộ khi có lỗi (All-or-Nothing Transaction):* Bị loại bỏ vì nếu file CSV 2000 dòng có 2 dòng bị lỗi nhỏ, việc hủy bỏ toàn bộ và bắt BTC sửa rồi upload lại từ đầu rất tốn thời gian trong đêm sát ngày diễn ra sự kiện.
