# 08 - Governance Policy: No-Mock Data & Real Environment Policy

## 1. Mục tiêu
Đảm bảo toàn bộ hệ thống TicketBox (Backend, Web, Mobile) chỉ sử dụng **dữ liệu thật** hoặc dữ liệu được tạo qua API/Admin UI, không hard-code dữ liệu nghiệp vụ (concert, ticket, order, payment, AI result...).

Mục tiêu là duy trì tính chân thực, dễ debug và sát với môi trường production.

## 2. Quy định bắt buộc

- **Cấm hard-code dữ liệu nghiệp vụ**: Không được hard-code danh sách concert, ticket, user, payment result, AI bio... trong source code (frontend lẫn backend).
- **Dữ liệu demo**: Phải được tạo qua **Admin Web UI** hoặc script seeding chạy qua API thật (không seed trực tiếp trong code).
- **External Services**: Phải dùng **Sandbox / Test Credentials thật** (VNPAY Sandbox, OpenAI test key, SendGrid sandbox, Supabase Storage test bucket...).
- **Biến môi trường**: Tất cả credential, URL, API key phải được lấy từ `.env` (không hard-code trong code).
- **Mobile App**: Chỉ đọc/ghi dữ liệu qua API hoặc đồng bộ từ server. Local SQLite chỉ dùng để cache offline, không chứa dữ liệu seed mặc định.

## 3. Checklist Review No-Mock-Data (Dùng để tự review và review chéo)

- [ ] Không tồn tại hard-coded array/object chứa concert, ticket, order, payment result trong source code.
- [ ] Tất cả dữ liệu hiển thị trên Frontend đều được lấy từ API thật.
- [ ] Các service bên ngoài (Payment, AI, Email, Object Storage) đang dùng test/sandbox credentials qua `.env`.
- [ ] Không có key, secret, URL production được hard-code.
- [ ] Đã có script seeding (nếu cần) chạy qua API thay vì insert trực tiếp vào database.
- [ ] Mobile App chỉ seed dữ liệu mẫu khi development (và có comment rõ ràng hoặc toggle bằng env variable).
- [ ] Khi code review, kiểm tra xem có dùng MSW (Mock Service Worker) hay không (nếu có, phải dựa trên contract API thật).



