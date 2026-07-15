# TicketBox — Project Proposal

## Vấn đề
Các concert âm nhạc lớn tại Việt Nam trong những năm gần đây (như Anh Trai Say Hi, Anh Trai Vượt Ngàn Chông Gai, Em Xinh Say Hi, Chị Đẹp Đạp Gió Rẽ Sóng) thu hút hàng chục nghìn khán giả đăng ký mua vé đồng thời. Việc bán vé thủ công hoặc qua các kênh rời rạc như Zalo OA, Google Form, chuyển khoản thủ công không còn khả thi do không đảm bảo tính công bằng và dễ xảy ra gian lận.

Khi các đơn vị tổ chức mở bán vé công khai trên hệ thống công nghệ thông tin, họ thường gặp phải các hậu quả cụ thể sau:
1. **Website bị sập (Downtime)**: Lượng truy cập đồng thời khổng lồ (vượt quá khả năng xử lý của hạ tầng) trong những phút đầu mở bán gây cạn kiệt connection pool của database hoặc nghẽn hàng đợi xử lý HTTP requests.
2. **Trừ tiền nhưng không phát hành vé (Double Charge/No Ticket)**: Khán giả đã thực hiện thanh toán thành công qua ngân hàng/cổng thanh toán nhưng hệ thống bị lỗi và không ghi nhận đơn hàng, dẫn đến tranh chấp giao dịch.
3. **Vé ảo và Đầu cơ (Scalper Bots)**: Các bot tự động do scalper lập trình vét sạch vé trong vài giây đầu, sau đó bán lại thị trường đen với giá gấp nhiều lần, tước đi cơ hội của người hâm mộ thực tế.

## Mục tiêu
Hệ thống TicketBox được thiết kế nhằm số hóa toàn bộ quy trình bán vé một cách minh bạch, an toàn và tin cậy cao:
- **Khả năng chịu tải đỉnh cực lớn**: Hỗ trợ tối thiểu **80.000 người truy cập đồng thời trong 5 phút đầu mở bán** (với 70% lượng traffic dồn vào phút đầu tiên) mà không sập hệ thống.
- **Tính nhất quán tuyệt đối (No Oversell)**: Ngăn chặn tình trạng bán vượt số lượng vé (ví dụ: hạng vé SVIP chỉ có 200 ghế, tuyệt đối không được phát hành vé thứ 201).
- **Chống trừ tiền hai lần**: Đảm bảo mỗi giao dịch thanh toán chỉ được xử lý một lần duy nhất kể cả khi người dùng click thanh toán nhiều lần hoặc gateway gửi webhook lặp.
- **Soát vé ngoại tuyến**: Đảm bảo cổng soát vé vẫn hoạt động mượt mà tại sân vận động ngay cả trong điều kiện mất sóng mạng di động, hỗ trợ đồng bộ dữ liệu idempotent và phát hiện xung đột sau đó.

## Người dùng và nhu cầu
Hệ thống phục vụ 4 nhóm đối tượng chính:

| Nhóm người dùng (Actor) | Nhu cầu & Hành vi cốt lõi |
|---|---|
| **Khán giả (Audience)** | Xem danh sách/chi tiết concert, chọn sơ đồ ghế khu vực (GA, SVIP, VIP...), giữ vé tạm thời, thanh toán qua cổng sandbox, nhận e-ticket QR mã hoá. |
| **Ban tổ chức (Organizer)** | Tạo concert, cấu hình hạng vé, tải file PDF tiểu sử nghệ sĩ để sinh bio qua AI, import file CSV khách VIP, theo dõi báo cáo doanh thu theo scope được giao. |
| **Nhân sự soát vé (Check-in Staff)** | Sử dụng mobile app quét mã QR vé tại cổng sự kiện. Có khả năng đồng bộ trước danh sách vé, soát vé offline và sync lại log check-in khi có mạng. |
| **Admin hệ thống (System Admin)** | Quản lý tài khoản, phân quyền theo vai trò chi tiết (RBAC Matrix) và giám sát hệ thống. |

## Phạm vi

### Thuộc phạm vi (In-Scope)
- **Client Web Apps**: Giao diện Audience Web và Admin Web xây dựng bằng React/Next.js.
- **Mobile Client**: Check-in Mobile App phát triển bằng React Native/Expo hỗ trợ local SQLite và sync batch.
- **Backend API**: NestJS Modular Monolith, quản lý logic nghiệp vụ chính (Concert, Order, Payment, Ticket, Check-in, CSV, AI Bio, Notification).
- **Hạ tầng lưu trữ**: PostgreSQL làm Source of Truth, Redis làm cache/waiting room/rate limit, Object Storage (Supabase Storage/S3) chứa file phi cấu trúc, BullMQ cho tác vụ chạy nền.
- **Tích hợp bên ngoài (Sandbox)**: Tích hợp với VNPAY sandbox cho luồng thanh toán thực và Grok/OpenAI cho luồng AI Artist Bio.

### Không thuộc phạm vi (Out-of-Scope)
- **Tích hợp Payment thật**: Sử dụng môi trường thử nghiệm Sandbox của VNPAY.
- **Hạ tầng production toàn cầu**: Triển khai cloud multi-region, Kubernetes tự động scale hoặc CDN phân tán.
- **Huấn luyện mô hình AI riêng**: Chỉ gọi API của provider (Grok/OpenAI) qua API.
- **Hệ thống phát hiện Bot nâng cao**: Chỉ cài đặt ở mức Rate Limiting và hàng chờ ảo (Virtual Waiting Room).

## Rủi ro và ràng buộc
1. **Tranh chấp tài nguyên (Lock Contention)**: Khi hàng ngàn request cùng tranh chấp một số lượng vé GA/VIP nhỏ, database dễ bị nghẽn connection. Hệ thống buộc phải dùng pessimistic lock kết hợp transaction cực ngắn và lọc tải trước bằng Redis.
2. **Cổng thanh toán không ổn định**: Các cuộc gọi đồng bộ sang gateway bên thứ ba có thể bị timeout hoặc lỗi. Hệ thống phải cách ly lỗi bằng Circuit Breaker để thanh toán lỗi không kéo sập luồng duyệt concert.
3. **Môi trường soát vé chập chờn**: Sân vận động đông người sẽ bị nghẽn sóng mạng. Ứng dụng mobile bắt buộc phải là offline-first, tự xác thực cục bộ và đồng bộ bất đồng bộ khi trực tuyến lại.
4. **Idempotency**: Callback thanh toán từ gateway hoặc lệnh gửi lại request từ client do mất gói tin có thể xảy ra bất cứ lúc nào. Mọi API thanh toán và sync check-in phải idempotent.
