# Task 26 – Concurrent purchase test

## Branch

feature/test-concurrent-purchase

## Tool

Artillery

## Scenario

- Endpoint: `POST /api/v1/orders`
- Target API: `http://localhost:3001/api/v1`
- Concert ID: `83306671-ff10-4a33-a915-dfd3cd8cbae3`
- Ticket Type ID: `33a95c8d-6ca8-4c3e-9d8a-9cdd414179e7`
- Test inventory:
  - `total_quantity = 5`
  - `sold_quantity = 0`
  - `held_quantity = 0`
  - `max_per_user = 2`
- Load profile:
  - duration: 10 seconds
  - arrivalRate: 20 users/second
  - total requests: 200
  - quantity per request: 1

## Artillery result

```text
http.codes.201: 2
http.codes.409: 2
http.codes.429: 196
http.requests: 200
vusers.completed: 200
vusers.failed: 0

Database verification
Inventory safety
total_quantity = 5
sold_quantity = 0
held_quantity = 2
used_quantity = 2
inventory_ok = true
max_per_user = 2

Result: sold_quantity + held_quantity <= total_quantity is PASS.

Max per user

Violation query:

user_id | user_quantity
--------+--------------
(0 rows)

Per-user quantity:

user_id                              | order_count | quantity_sum
-------------------------------------+-------------+-------------
cb14dd9a-c663-432e-8d7b-4592a95cb64a | 2           | 2

Result: no user exceeded max_per_user = 2, PASS.

Order status summary
status          | order_count | quantity_sum
----------------+-------------+-------------
PENDING_PAYMENT | 2           | 2
Acceptance Criteria
Tổng sold + held không vượt total: PASS
Không user nào vượt max_per_user: PASS
Có report kết quả: PASS
