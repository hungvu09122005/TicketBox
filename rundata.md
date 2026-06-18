# HƯỚNG DẪN CẤU HÌNH & CHẠY DATABASE (DEV ENVIRONMENT)

Vui lòng làm theo các bước sau:

### 1. Chuẩn bị Database (PostgreSQL)
Đảm bảo bạn đã cài đặt PostgreSQL trên máy hoặc chạy qua Docker.
* Tạo database tên là: `ticketbox_dev`
* Cấu hình thông tin kết nối trong file `.env` tại thư mục `apps/api/`:
    ```env
    DB_HOST=localhost
    DB_PORT=5432
    DB_USERNAME=postgres
    DB_PASSWORD=your_password
    DB_DATABASE=ticketbox_dev
    ```

### 2. Cài đặt Dependencies
Tại thư mục gốc của project, chạy lệnh:
```bash
pnpm install

```

### 3. Chạy lệnh Seed (Cực kỳ quan trọng)
Đây là lệnh để chèn dữ liệu mẫu (Roles, Admin, Staff, Concerts...) vào database, bắt buộc phải chạy lệnh này lần đầu để hệ thống có dữ liệu mà test:

```bash
pnpm --filter @ticketbox/api run seed:run

```


### 4. Khởi chạy Server
-Sau khi đã seed xong thì khởi động server (vd : npx ts-node -r tsconfig-paths/register src/main.ts)

-Quản lý DB: Nên dùng DBeaver để xem dữ liệu cho trực quan.

-Khi bị lỗi dữ liệu: Nếu trong quá trình code mà dữ liệu bị lỗi/xung đột, hãy dùng lệnh TRUNCATE TABLE users, roles, user_roles, tickets, orders CASCADE; trong DBeaver để xóa trắng dữ liệu rồi chạy lại lệnh seed:run ở bước 3.
"""