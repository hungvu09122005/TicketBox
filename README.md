# 🎫 TicketBox

> **High-load concert ticketing system** — Pnpm monorepo, NestJS modular monolith backend, Next.js frontends, Expo mobile check-in app.

---

## 📋 Mục lục

- [Tổng quan kiến trúc](#-tổng-quan-kiến-trúc)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [Yêu cầu hệ thống](#-yêu-cầu-hệ-thống)
- [Cài đặt & Cấu hình](#-cài-đặt--cấu-hình)
- [Khởi chạy ứng dụng](#-khởi-chạy-ứng-dụng)
- [Database — Schema & Seed](#-database--schema--seed)
- [Các module API](#-các-module-api)
- [Biến môi trường](#-biến-môi-trường)
- [Scripts tổng hợp](#-scripts-tổng-hợp)
- [Swagger / API Docs](#-swagger--api-docs)
- [Troubleshooting](#-troubleshooting)

---

## 🏗 Tổng quan kiến trúc

```
┌──────────────────────────────────────────────────────────────┐
│                        Clients                               │
│  audience-web (Next.js :3000)   admin-web (Next.js :3002)    │
│                checkin-mobile (Expo)                         │
└───────────────────────┬──────────────────────────────────────┘
                        │ HTTP / REST
┌───────────────────────▼──────────────────────────────────────┐
│               api — NestJS Modular Monolith (:3001)          │
│  Auth · Users · Concerts · Orders · Tickets · Payments       │
│  Check-in · CSV Import · AI Bio · Notifications · Reporting  │
└────┬──────────────┬───────────────────┬──────────────────────┘
     │              │                   │
  PostgreSQL     Redis              MinIO / S3
  (TypeORM)   (Bull queues,       (avatar, PDF,
               cache, lock)        CSV storage)
```

**Tech Stack:**

| Layer | Technology |
|---|---|
| Backend | NestJS 10, TypeScript 5 |
| Database | PostgreSQL 16, TypeORM 0.3 |
| Queue | Bull (Redis-backed) |
| Cache | cache-manager + Redis |
| Audience Web | Next.js 15, React 19 |
| Admin Web | Next.js 15, React 19 |
| Mobile | Expo (React Native) |
| Object Storage | MinIO (S3-compatible) |
| AI | Grok (xAI) |
| Payment | VNPAY Sandbox |
| Email | SendGrid |
| Container | Docker Compose |

---

## 📁 Cấu trúc thư mục

```
TicketBox/
├── apps/
│   ├── api/                   # NestJS backend
│   │   ├── src/
│   │   │   ├── config/        # Cấu hình ứng dụng & load-env
│   │   │   ├── database/      # TypeORM DataSource, migrations, seed runner
│   │   │   ├── modules/       # Các domain module
│   │   │   │   ├── auth/
│   │   │   │   ├── users/
│   │   │   │   ├── artists/
│   │   │   │   ├── concerts/
│   │   │   │   ├── seat-map/
│   │   │   │   ├── ticket-types/
│   │   │   │   ├── orders/
│   │   │   │   ├── payments/
│   │   │   │   ├── tickets/
│   │   │   │   ├── checkin/
│   │   │   │   ├── notifications/
│   │   │   │   ├── csv-import/
│   │   │   │   ├── ai-bio/
│   │   │   │   ├── reporting/
│   │   │   │   ├── storage/
│   │   │   │   ├── health/
│   │   │   │   └── queue/
│   │   │   └── main.ts
│   │   ├── migrations/        # Knex migration files
│   │   ├── knexfile.js
│   │   └── package.json
│   ├── audience-web/          # Next.js — giao diện khán giả
│   ├── admin-web/             # Next.js — giao diện quản trị
│   └── checkin-mobile/        # Expo — app check-in tại cổng
├── infra/
│   ├── db/
│   │   └── seed.sql           # ← Schema + seed data (tự động chạy khi khởi tạo DB)
│   └── docker-compose.yml
├── docs/                      # Tài liệu bổ sung
├── blueprint/                 # Thiết kế & sơ đồ hệ thống
├── .env                       # ← KHÔNG commit file này
├── .env.example
├── pnpm-workspace.yaml
└── package.json
```

> **Về `infra/db/seed.sql`:** File này chứa toàn bộ schema (CREATE TABLE, ENUMs, indexes) cùng dữ liệu seed (RBAC, users mẫu, concert demo). Được mount vào `/docker-entrypoint-initdb.d/` của container Postgres — PostgreSQL sẽ tự động thực thi file này khi volume DB được khởi tạo lần đầu tiên.

---

## ✅ Yêu cầu hệ thống

| Công cụ | Phiên bản tối thiểu |
|---|---|
| Node.js | ≥ 20.0.0 |
| pnpm | ≥ 9.0.0 |
| Docker & Docker Compose | mới nhất |

---

## ⚙️ Cài đặt & Cấu hình

### 1. Clone & cài dependencies

```bash
git clone <repo-url>
cd TicketBox
pnpm install
```

### 2. Tạo file `.env`

```bash
cp .env.example .env
```

Sau đó chỉnh sửa file `.env`, điền đầy đủ các giá trị bắt buộc:

```env
# PostgreSQL — phải khớp với docker-compose.yml
DATABASE_PASSWORD=ticketbox_dev

# MinIO / Object Storage — bắt buộc để kết nối MinIO trên Docker
MINIO_ACCESS_KEY=ticketbox_minio
MINIO_SECRET_KEY=ticketbox_minio_dev

# JWT — bắt buộc phải có giá trị, tạo bằng:
# openssl rand -hex 64
JWT_ACCESS_SECRET=<secret>
JWT_REFRESH_SECRET=<secret>

# QR token signing
QR_TOKEN_SECRET=<secret>
```

> **Lưu ý:** 
> * `DATABASE_PASSWORD` phải là `ticketbox_dev` (khớp với `POSTGRES_PASSWORD` trong `docker-compose.yml`). Nếu để trống sẽ gây lỗi `client password must be a string` khi kết nối PostgreSQL.
> * `MINIO_ACCESS_KEY` và `MINIO_SECRET_KEY` phải khớp với cấu hình trong `docker-compose.yml` (`ticketbox_minio` và `ticketbox_minio_dev`) để API có thể tạo/đọc bucket chứa file upload.

---

## 🐳 Khởi chạy ứng dụng

> `infra/docker-compose.yml` định nghĩa **đầy đủ** các service gồm `postgres`, `redis`, `minio`, `api`, `audience-web`, `admin-web`.  
> Bạn có **2 cách** để chạy dự án:

---

### 🇦 Lựa chọn 1 — Full Docker (mọi thứ chạy trong container)

**Bước 1:** Khởi động toàn bộ stack (backend, frontend, hạ tầng):

```bash
pnpm run infra:up
```

**Bước 2:** Nạp dữ liệu mẫu và đồng bộ DB (chỉ cần chạy một lần duy nhất khi khởi tạo DB):

```bash
docker exec -it ticketbox-api pnpm run seed:run
```

Sau khi chạy, các service sẽ sẵn sàng tại:

| Service | URL |
|---|---|
| Audience Web | http://localhost:3000 |
| API | http://localhost:3001 |
| Admin Web | http://localhost:3002 |
| MinIO Web Console | http://localhost:9001 |

> ⚠️ **Không** chạy thêm `pnpm dev:*` khi đã dùng lựa chọn này — sẽ xảy ra xung đột port.

---

### 🇧 Lựa chọn 2 — Dev Local (hạ tầng Docker + chạy code trực tiếp)

**Bước 1:** Chỉ khởi động PostgreSQL, Redis, MinIO

```bash
pnpm run infra:services
```

**Bước 2:** Chạy migrations và nạp dữ liệu mẫu (chỉ cần chạy một lần khi khởi tạo DB)

```bash
pnpm run seed:run
```

**Bước 3:** Chạy từng app ở các terminal riêng

```bash
# Terminal 1 — Backend API (NestJS)
pnpm run dev:api          # → http://localhost:3001

# Terminal 2 — Audience Web (Next.js)
pnpm run dev:audience-web # → http://localhost:3000

# Terminal 3 — Admin Web (Next.js)
pnpm run dev:admin-web    # → http://localhost:3002

# Terminal 4 (tuỳ chọn) — Mobile Check-in (Expo)
pnpm run dev:mobile
```

---

**Tắt toàn bộ Docker:**

```bash
pnpm run infra:down
```

---

## 🗄 Database — Schema & Seed

### Cơ chế khởi tạo

Để tránh xung đột schema giữa file SQL tĩnh và các migrations của TypeORM, database của dự án sẽ khởi tạo trống và chạy migrations tự động khi container API khởi chạy. Sau đó, dữ liệu mẫu sẽ được nạp thông qua **Seed runner (TypeScript)**.

File SQL `seed.sql` hiện tại đã được tắt mount tự động và chỉ đóng vai trò tham chiếu cấu trúc bảng ban đầu.

#### Tài khoản mẫu sau khi seed

| Role | Email | Mật khẩu |
|---|---|---|
| `SYSTEM_ADMIN` | `admin@ticketbox.local` | `Admin@123456` |
| `ORGANIZER` | `organizer@ticketbox.local` | `Organizer@123456` |
| `CHECKIN_STAFF` | `staff@ticketbox.local` | `Staff@123456` |
| `AUDIENCE` | `audience@ticketbox.local` | `Audience@123456` |

> ⚠️ **Quan trọng:** Không chạy trực tiếp file `seed.sql` lên cơ sở dữ liệu đã có bảng, vì có thể gây lỗi bất đồng bộ kiểu dữ liệu (mismatch types) với các cột đã thay đổi trong migrations. Hãy dùng lệnh `seed:run` để đồng bộ an toàn.

---

### Chạy seed thủ công (chỉ dùng khi DB trống)

```bash
# Qua Docker exec (chỉ khuyên dùng khi database hoàn toàn trống)
docker exec -i ticketbox-postgres psql -U ticketbox -d ticketbox < infra/db/seed.sql
```

---

### Migrations (TypeORM)

```bash
# Chạy tất cả migrations
pnpm run migration:run

# Revert migration gần nhất
pnpm run migration:revert

# Tạo migration mới (từ apps/api)
cd apps/api
npx typeorm-ts-node-commonjs migration:generate -d src/database/data-source.ts src/database/migrations/<TenMigration>
```

### Seed runner (TypeScript - KHUYÊN DÙNG)

Lệnh này sẽ tự động chạy tất cả các migrations TypeORM chưa thực thi để đồng bộ schema mới nhất, sau đó tự động làm sạch bảng và nạp **toàn bộ dữ liệu mẫu đầy đủ** (bao gồm RBAC, 4 users, các nghệ sĩ, 4 concert, seat maps, orders, tickets, check-in logs,...):

```bash
pnpm run seed:run
```

---

## 📦 Các module API

| Module | Chức năng chính |
|---|---|
| **Auth** | Đăng ký, đăng nhập, refresh token, JWT + Passport |
| **Users** | Quản lý người dùng, RBAC (Roles & Permissions) |
| **Artists** | Quản lý nghệ sĩ, upload avatar lên MinIO |
| **Concerts** | CRUD concert, quản lý trạng thái (DRAFT → PUBLISHED → COMPLETED) |
| **Seat Map** | Quản lý sơ đồ chỗ ngồi (seat zones) theo concert |
| **Ticket Types** | Loại vé, giá, số lượng, thời gian mở bán |
| **Orders** | Tạo đơn hàng, giữ vé có thời hạn (hold), xử lý hết hạn qua Bull queue |
| **Payments** | Tích hợp VNPAY Sandbox, xử lý IPN callback, idempotency key |
| **Tickets** | Sinh QR token (HMAC-SHA256), mã thủ công 12 ký tự |
| **Check-in** | Xác thực vé QR / mã thủ công, hỗ trợ offline/online, chống conflict |
| **Notifications** | Gửi email qua SendGrid, queue-based (Bull), dedup log |
| **CSV Import** | Import danh sách VIP guest từ file CSV lưu trên MinIO |
| **AI Bio** | Sinh bio nghệ sĩ tự động từ PDF qua Grok API (xAI) |
| **Reporting** | Thống kê doanh thu, số vé đã bán, check-in rate |
| **Storage** | Presigned URL upload/download MinIO |
| **Health** | Health check endpoint (`/health`) |
| **Queue** | Bull queues cho orders, notifications, CSV, AI |

---

## 🔑 Biến môi trường

Xem file [`.env.example`](.env.example) để tham chiếu đầy đủ. Các biến quan trọng:

| Biến | Mô tả | Bắt buộc |
|---|---|---|
| `DATABASE_HOST` | Host PostgreSQL | ✅ |
| `DATABASE_PORT` | Port PostgreSQL (mặc định: 5432) | ✅ |
| `DATABASE_USERNAME` | Username PostgreSQL | ✅ |
| `DATABASE_PASSWORD` | **Mật khẩu PostgreSQL** (phải là string) | ✅ |
| `DATABASE_NAME` | Tên database | ✅ |
| `REDIS_HOST` | Host Redis | ✅ |
| `REDIS_PORT` | Port Redis (mặc định: 6379) | ✅ |
| `JWT_ACCESS_SECRET` | Secret key cho Access Token | ✅ |
| `JWT_REFRESH_SECRET` | Secret key cho Refresh Token | ✅ |
| `QR_TOKEN_SECRET` | Secret HMAC-SHA256 ký QR token | ✅ |
| `MINIO_ENDPOINT` | Host MinIO | ✅ |
| `MINIO_ACCESS_KEY` | MinIO access key | ✅ |
| `MINIO_SECRET_KEY` | MinIO secret key | ✅ |
| `VNPAY_TMN_CODE` | Mã terminal VNPAY | Tùy chọn |
| `VNPAY_HASH_SECRET` | Hash secret VNPAY | Tùy chọn |
| `SENDGRID_API_KEY` | API key SendGrid | Tùy chọn |
| `GROK_API_KEY` | API key xAI Grok | Tùy chọn |

---

## 🛠 Scripts tổng hợp

Chạy từ thư mục **gốc** (`TicketBox/`):

```bash
# Infrastructure
pnpm run infra:up          # Khởi động toàn bộ stack qua Docker (kèm cả API & Web)
pnpm run infra:services    # Chỉ khởi động PostgreSQL + Redis + MinIO (dùng khi dev local)
pnpm run infra:down        # Tắt tất cả Docker services

# Dev (dùng sau khi đã chạy infra:services)
pnpm run dev:api           # Chạy NestJS backend (:3001)
pnpm run dev:audience-web  # Chạy audience Next.js (:3000)
pnpm run dev:admin-web     # Chạy admin Next.js (:3002)
pnpm run dev:mobile        # Chạy Expo mobile

# Database
pnpm run migration:run     # Chạy tất cả migrations (TypeORM)
pnpm run migration:revert  # Revert migration gần nhất
pnpm run seed:run          # Chạy seed runner TypeScript

# Quality
pnpm run build             # Build tất cả packages
pnpm run lint              # Lint tất cả packages
pnpm run test              # Test tất cả packages
```

---

## 📖 Swagger / API Docs

Sau khi khởi chạy API, truy cập:

```
http://localhost:3001/api/docs
```

---

## 🐞 Troubleshooting

### `client password must be a string`
→ `DATABASE_PASSWORD` đang bị bỏ trống trong `.env`. Điền `ticketbox_dev` (khớp với `docker-compose.yml`).

### `JwtStrategy requires a secret or key`
→ `JWT_ACCESS_SECRET` và `JWT_REFRESH_SECRET` đang bị bỏ trống. Chạy lệnh sau để tạo secret:
```bash
openssl rand -hex 64
```

### `Cannot find module '@modules/...'`
→ Thiếu flag `-r tsconfig-paths/register` khi chạy `ts-node`. Xem lại lệnh seed ở trên.

### Migrations không chạy
→ Đảm bảo infrastructure đã khởi động (`pnpm run infra:up`) và `DATABASE_URL` trong `.env` đã được cấu hình đúng.

### DB không có dữ liệu sau khi `infra:up`
→ `infra/db/seed.sql` chỉ chạy tự động khi volume Postgres **chưa tồn tại**. Nếu đã có volume từ lần chạy trước, chạy thủ công:
```bash
docker exec -i ticketbox-postgres psql -U ticketbox -d ticketbox < infra/db/seed.sql
```
Hoặc xoá volume cũ và khởi động lại:
```bash
pnpm run infra:down
docker volume rm ticketbox_postgres_data
pnpm run infra:up
```
