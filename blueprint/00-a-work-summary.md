# Tổng hợp phần việc của Thành viên A - TicketBox Blueprint

## A phụ trách chính

| Mục | Tên mục | File |
|---:|---|---|
| 1 | Tài liệu thiết kế hệ thống | `01-system-design.md` |
| 2 | C4 Diagram | `02-c4-diagram.md` |
| 3 | High-Level Architecture Diagram | `03-high-level-architecture.md` |

## A review kỹ thuật

| Mục | Người làm chính | A cần review |
|---:|---|---|
| 4 | C | Database có phục vụ đúng kiến trúc, transaction, cache, offline, CSV, AI không. |
| 5 | B | Business flow có khớp architecture và xử lý lỗi không. |
| 6 | C | RBAC có enforce được ở API/admin/mobile không. |
| 7 | B | Rate limit, caching, idempotency, circuit breaker, race condition có đúng kỹ thuật không. |

## Những điểm đã bổ sung để bám sát đề

- Seat map SVG và availability theo khu GA/SVIP/VIP/CAT1/CAT2.
- Notification và reminder 24 giờ trước concert.
- Fairness/chống bot khi 80.000 người truy cập giờ mở bán.
- PostgreSQL là source of truth, Redis chỉ hỗ trợ cache/rate limit/lock.
- Mục 7 thống nhất lại: B làm chính, A review kỹ thuật.
