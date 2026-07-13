# TicketBox - Hệ Thống Đặt Vé Concert Trực Tuyến

Dự án này là hệ thống phân phối vé concert trực tuyến (Modular Monolith sử dụng NestJS và Next.js) được tích hợp cơ chế phân quyền RBAC bảo mật, thanh toán qua VNPAY với tính năng chống trùng lặp request (Idempotency).

---

## 1. Yêu Cầu Hệ Thống
Trước khi chạy dự án, hãy đảm bảo máy tính của bạn đã được cài đặt:
* **Node.js** (Phiên bản v18 trở lên)
* **pnpm** (Hệ thống quản lý package chính của dự án)
* **Docker & Docker Compose** (Để chạy PostgreSQL, Redis và MinIO)

---

## 2. Hướng Dẫn Clone Và Khởi Chạy Nhanh (Quick Start)

### Bước 2.1: Clone dự án về máy
Mở Terminal của bạn và chạy lệnh sau để tải mã nguồn về:
```bash
git clone <URL_repository_cua_ban>
# Di chuyển vào thư mục dự án vừa clone
cd TicketBox
```
*Lưu ý: Tất cả các lệnh tiếp theo trong tài liệu này đều phải được thực thi từ thư mục gốc của dự án (`TicketBox`).*

### Bước 2.2: Khởi động Hạ tầng Docker
Chạy lệnh sau từ thư mục `TicketBox` để khởi động các container cơ sở dữ liệu:
```bash
docker compose -f infra/docker-compose.yml up -d postgres redis minio
```

### Bước 2.2: Cấu hình biến môi trường
Sao chép file `.env.example` thành `.env` trong thư mục `TicketBox`:
```bash
cp .env.example .env
```
*(Mặc định cấu hình local đã được điền sẵn trong `.env.example`. Bạn có thể thay đổi cổng hoặc kết nối DB nếu cần).*

### Bước 2.3: Seed Dữ liệu mẫu (Database Seeding)
Chạy lệnh sau để tạo cấu trúc bảng và nạp đầy đủ **4 concert mẫu**, loại vé, giá, phân quyền RBAC và sơ đồ chỗ ngồi:
```bash
# Nạp từ script seed full của backend
pnpm --filter @ticketbox/api seed
```
Hoặc nếu bạn khởi chạy cơ sở dữ liệu bằng SQL script thủ công:
```bash
psql -U ticketbox -d ticketbox -f seed.sql
```

### Bước 2.4: Chạy API (Backend)
```bash
pnpm dev:api
```
Backend sẽ khởi chạy tại: [http://localhost:3001](http://localhost:3001)

### Bước 2.5: Chạy Giao diện Audience Web (Dành cho khách hàng)
Mở một terminal mới và chạy:
```bash
pnpm dev:audience-web
```
Giao diện sẽ chạy tại: [http://localhost:3000](http://localhost:3000)

### Bước 2.6: Chạy Giao diện Admin Web (Quản trị)
Mở thêm một terminal mới và chạy:
```bash
pnpm dev:admin-web
```
Giao diện quản trị sẽ chạy tại: [http://localhost:3002](http://localhost:3002)

---

## 3. Tài Khoản Đăng Nhập Thử Nghiệm (Test Accounts)
Sau khi chạy seed thành công, bạn có thể dùng các tài khoản sau để đăng nhập thử:

* **Người mua vé (Audience):** `audience@ticketbox.local` / `Audience@123456`
* **Ban tổ chức (Organizer):** `organizer@ticketbox.local` / `Organizer@123456`
* **Kiểm soát viên (Check-in Staff):** `staff@ticketbox.local` / `Staff@123456`
* **Quản trị viên hệ thống (Admin):** `admin@ticketbox.local` / `Admin@123456`

---

## 4. Hướng Dẫn Kiểm Thử E2E và Idempotency
Để biết chi tiết cách kiểm tra luồng thanh toán, giả lập IPN qua Tunnel và chạy bộ test Playwright tự động, vui lòng đọc tài liệu hướng dẫn kiểm thử chi tiết tại:
* [test/README.md](../test/README.md)

---

## 5. Xử Lý Sự Cố Thường Gặp (Troubleshooting)

### 5.1 Xung đột cổng kết nối (Port Conflicts)
Nếu bạn nhận được lỗi `EADDRINUSE` (cổng kết nối đã bị tiến trình khác chiếm dụng), hãy chạy các lệnh sau để tắt các tiến trình đang chạy ẩn:
```bash
# Tắt tiến trình chạy ở cổng 3001 (Backend API)
kill -9 $(lsof -t -i :3001)

# Tắt tiến trình chạy ở cổng 3000 (Audience Web)
kill -9 $(lsof -t -i :3000)

# Tắt tiến trình chạy ở cổng 3002 (Admin Web)
kill -9 $(lsof -t -i :3002)
```

### 5.2 Không thể kết nối hoặc khởi tạo Redis Cache
* **Hiện tượng:** Không ghi được cache hoặc bị lỗi kết nối Redis.
* **Cách khắc phục:**
  1. Kiểm tra xem container Redis có đang chạy hay không:
     ```bash
     docker ps | grep ticketbox-redis
     ```
  2. Nếu không chạy, khởi động lại hạ tầng bằng lệnh:
     ```bash
     docker compose -f infra/docker-compose.yml restart redis
     ```
  3. Kiểm tra xem các cache key có được ghi nhận chính xác vào Redis DB hay không:
     ```bash
     docker exec -it ticketbox-redis redis-cli KEYS "keyv:*"
     ```
     *(Lưu ý: Các key cache sẽ tự động biến mất sau khi hết thời gian sống TTL - mặc định là 60 giây đối với danh sách concert).*

### 5.3 Lỗi kết nối Cơ sở dữ liệu (PostgreSQL) hoặc MinIO (S3)
* Đảm bảo hạ tầng Docker đã khởi chạy thành công bằng lệnh `docker compose -f infra/docker-compose.yml ps`.
* Kiểm tra cấu hình kết nối trong file `.env` xem các thông số `DATABASE_URL` hoặc `MINIO_ENDPOINT` có khớp với môi trường chạy thực tế của bạn hay chưa.

