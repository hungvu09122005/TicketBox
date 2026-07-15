# Đặc tả: Tạo Artist Bio Tự Động bằng AI (ai_bio.md)

## 1. Mô tả
Cho phép Ban tổ chức (Organizer) tải lên tệp PDF tài liệu nghệ sĩ để hệ thống tự động trích xuất nội dung, gọi dịch vụ AI (Grok/OpenAI) tóm tắt sinh tiểu sử nghệ sĩ dưới dạng bản nháp (Draft), hỗ trợ duyệt và chỉnh sửa trước khi xuất bản chính thức.

---

## 2. Luồng chính (Main Flow)
1. Organizer tải lên file PDF thông tin nghệ sĩ từ Admin Web App.
2. Backend API lưu PDF vào Object Storage, tạo bản ghi request trong PostgreSQL với trạng thái `PENDING`.
3. Đẩy job phân tích vào BullMQ và phản hồi ngay cho client.
4. Worker nhận job, thực hiện tải file PDF và chạy thư viện trích xuất văn bản thô (text extraction).
5. Gửi văn bản đã làm sạch sang AI Service kèm prompt tóm tắt.
6. Nhận kết quả từ AI, lưu vào database dưới dạng bản nháp `DRAFT` của concert/nghệ sĩ.
7. Organizer xem lại bản nháp, thực hiện chỉnh sửa nội dung nếu cần, rồi nhấn "Publish" để hiển thị công khai trên Audience Web App.

---

## 3. Kịch bản lỗi (Exception Flows)

### ES-01: File PDF là dạng ảnh scan (không trích xuất được text)
- **Điều kiện**: PDF tải lên chỉ chứa ảnh, không chứa text format.
- **Xử lý**: Worker phát hiện text trích xuất rỗng hoặc quá ngắn, đánh dấu request là `FAILED` kèm thông tin chi tiết lỗi. Admin Web hiển thị thông báo lỗi và gợi ý Organizer chuyển sang chế độ tự viết bio thủ công.

### ES-02: Dịch vụ AI bị sập hoặc quá tải (Circuit Breaker OPEN)
- **Điều kiện**: AI API của nhà cung cấp bị sập hoặc phản hồi timeout.
- **Xử lý**: 
  1. Circuit Breaker của AI Service chuyển sang `OPEN`, chặn các yêu cầu gửi sang AI.
  2. Job BullMQ tự động retry với cấu hình exponential backoff (thử lại sau 5 phút, tối đa 3 lần).
  3. Nếu vẫn lỗi, hệ thống đánh dấu job thất bại và kích hoạt fallback cho phép Organizer tự điền bio thủ công trực tiếp trên giao diện mà không bị block bởi AI.

---

## 4. Ràng buộc (Constraints)
- **Bảo mật**: Nội dung trích xuất thô từ PDF gửi sang AI Service phải được làm sạch, giới hạn độ dài ký tự tối đa (ví dụ 8000 ký tự) để tránh lỗi tràn token (token limit overflow) và tiết kiệm chi phí API.
- **Quy trình duyệt**: Không bao giờ tự động xuất bản (Publish) tiểu sử nghệ sĩ do AI tạo ra mà không có sự kiểm duyệt và phê duyệt thủ công của con người (Human-in-the-loop).

---

## 5. Tiêu chí chấp nhận (Acceptance Criteria)
- AI failure không làm ảnh hưởng đến luồng xem và duyệt mua vé của Khán giả.
- Dữ liệu bio hiển thị công khai ở Audience Web luôn là dữ liệu đã được xuất bản (`status = PUBLISHED`).
