# Task 27 - Load, cache, rate limit and waiting room test

## Scope

This report is generated from local test infrastructure only. It does not commit any production performance number.

## How to run

1. Start API, Postgres and Redis.
2. Set env vars:
    $env:API_BASE_URL = "http://localhost:3001/api/v1"
    $env:CONCERT_ID = "83306671-ff10-4a33-a915-dfd3cd8cbae3"
3. Run Artillery:
    pnpm dlx artillery run tests/artillery/concert-read-load.yml --output tests/reports/task27-concert-read-load-artillery.json
4. Run this script with an audience JWT:
    .\tests\scripts\task27-load-cache-rate-limit-waiting-room.ps1 -ApiBaseUrl "http://localhost:3001/api/v1" -ConcertId "83306671-ff10-4a33-a915-dfd3cd8cbae3" -TicketTypeId "33a95c8d-6ca8-4c3e-9d8a-9cdd414179e7" -AccessToken $env:ACCESS_TOKEN

## Endpoints

- Concert list: GET /api/v1/concerts?page=1&limit=10
- Concert detail: GET /api/v1/concerts/83306671-ff10-4a33-a915-dfd3cd8cbae3
- Order / waiting room: POST /api/v1/orders

## Cache before / after

### Concert list cache

- Redis key: concerts:published:list:1:10:all
- Before first request exists: 0
- Cold request status: 200
- Cold request time ms: 17
- After cold request exists: 0
- TTL after cold request: -2
- Warm request status: 200
- Warm request time ms: 8

### Concert detail cache

- Redis key: concerts:detail:83306671-ff10-4a33-a915-dfd3cd8cbae3
- Before first request exists: 0
- Cold request status: 200
- Cold request time ms: 10
- After cold request exists: 0
- TTL after cold request: -2
- Warm request status: 200
- Warm request time ms: 7

## Rate limit result

Public policy was tested with 130 rapid requests to GET /concerts.

- HTTP 200 count: 100
- HTTP 429 count: 30
- Other status count: 0

## Waiting room / queue token release

This test seeds 101 fake active checkout sessions in Redis to force waiting room queueing.

- Active count before queue request: 101
- Queue count before queue request: 0
- Queue request HTTP status: 202
- Queue count after enqueue: 1
- Active count after release wait: 1
- Queue count after release wait: 0

Queue response body:

    {"success":true,"data":{"message":"System is under heavy load. You have been placed in the virtual waiting room.","status":"QUEUED","queueToken":"<redacted>"}}

## Acceptance Criteria

- Co script va huong dan chay: PASS
- Khong cam ket con so ngoai ha tang test: PASS
- Co ket qua truoc/sau cache: PASS

## Artillery concert read load summary

Local Artillery run against public concert read endpoints:

- HTTP requests: 400
- HTTP 200 count: 300
- HTTP 429 count: 100
- VUsers completed: 200
- VUsers failed: 0

This is a local/test-infrastructure observation only, not a production performance commitment.
