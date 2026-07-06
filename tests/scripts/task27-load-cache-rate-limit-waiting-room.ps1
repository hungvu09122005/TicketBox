param(
  [string]$ApiBaseUrl = "http://localhost:3001/api/v1",
  [string]$ConcertId = "83306671-ff10-4a33-a915-dfd3cd8cbae3",
  [string]$TicketTypeId = "33a95c8d-6ca8-4c3e-9d8a-9cdd414179e7",
  [string]$AccessToken = $env:ACCESS_TOKEN
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force tests\reports | Out-Null

function Redis([string[]]$cmd) {
  docker compose -f infra/docker-compose.yml exec -T redis redis-cli @cmd
}

function Clear-RedisPattern([string]$pattern) {
  $keys = Redis @("KEYS", $pattern)
  $keys | ForEach-Object {
    $k = $_.Trim()
    if ($k) {
      Redis @("DEL", $k) | Out-Null
    }
  }
}

function Invoke-TimedGet($Url) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $res = Invoke-WebRequest -Uri $Url -Method Get -UseBasicParsing
    $sw.Stop()
    [pscustomobject]@{
      status = [int]$res.StatusCode
      ms = $sw.ElapsedMilliseconds
      body = $res.Content
    }
  } catch {
    $sw.Stop()
    $status = 0
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode.value__
    }
    [pscustomobject]@{
      status = $status
      ms = $sw.ElapsedMilliseconds
      body = $_.ErrorDetails.Message
    }
  }
}

function Invoke-TimedPostJson($Url, $Token, $BodyObject) {
  $json = $BodyObject | ConvertTo-Json -Compress
  $sw = [System.Diagnostics.Stopwatch]::StartNew()

  try {
    $res = Invoke-WebRequest `
      -Uri $Url `
      -Method Post `
      -ContentType "application/json" `
      -Headers @{ Authorization = "Bearer $Token" } `
      -Body $json `
      -UseBasicParsing

    $sw.Stop()
    [pscustomobject]@{
      status = [int]$res.StatusCode
      ms = $sw.ElapsedMilliseconds
      body = $res.Content
    }
  } catch {
    $sw.Stop()
    $status = 0
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode.value__
    }
    [pscustomobject]@{
      status = $status
      ms = $sw.ElapsedMilliseconds
      body = $_.ErrorDetails.Message
    }
  }
}

"=== TASK 27: cache before/after ==="

Redis @("DEL", "concerts:published:list:1:10:all", "concerts:detail:$ConcertId") | Out-Null

$beforeListExists = (Redis @("EXISTS", "concerts:published:list:1:10:all")).Trim()
$beforeDetailExists = (Redis @("EXISTS", "concerts:detail:$ConcertId")).Trim()

$coldList = Invoke-TimedGet "$ApiBaseUrl/concerts?page=1&limit=10"
$afterColdListExists = (Redis @("EXISTS", "concerts:published:list:1:10:all")).Trim()
$listTtl = (Redis @("TTL", "concerts:published:list:1:10:all")).Trim()
$warmList = Invoke-TimedGet "$ApiBaseUrl/concerts?page=1&limit=10"

$coldDetail = Invoke-TimedGet "$ApiBaseUrl/concerts/$ConcertId"
$afterColdDetailExists = (Redis @("EXISTS", "concerts:detail:$ConcertId")).Trim()
$detailTtl = (Redis @("TTL", "concerts:detail:$ConcertId")).Trim()
$warmDetail = Invoke-TimedGet "$ApiBaseUrl/concerts/$ConcertId"

"=== TASK 27: public 429 test ==="

Clear-RedisPattern "ratelimit:public:*"

$rateStatuses = @()
for ($i = 0; $i -lt 130; $i++) {
  $r = Invoke-TimedGet "$ApiBaseUrl/concerts?page=1&limit=10"
  $rateStatuses += $r.status
}

$rate200 = ($rateStatuses | Where-Object { $_ -eq 200 }).Count
$rate429 = ($rateStatuses | Where-Object { $_ -eq 429 }).Count
$rateOther = ($rateStatuses | Where-Object { $_ -ne 200 -and $_ -ne 429 }).Count

"=== TASK 27: waiting room token release ==="

$queueBefore = "SKIPPED"
$queueAfterEnqueue = "SKIPPED"
$queueAfter = "SKIPPED"
$activeBefore = "SKIPPED"
$activeAfter = "SKIPPED"
$queuedStatus = "SKIPPED"
$queuedBody = "ACCESS_TOKEN missing"

if ($AccessToken) {
  Clear-RedisPattern "ratelimit:order:*"

  $activeKey = "waiting_room:${ConcertId}:active"
  $queueKey = "waiting_room:${ConcertId}:queue"

  Redis @("DEL", $activeKey, $queueKey) | Out-Null

  $future = [int64](([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) + 300000)
  for ($i = 0; $i -lt 101; $i++) {
    Redis @("ZADD", $activeKey, "$future", "task27-fake-active-$i") | Out-Null
  }

  $activeBefore = (Redis @("ZCARD", $activeKey)).Trim()
  $queueBefore = (Redis @("ZCARD", $queueKey)).Trim()

  $body = @{
    concertId = $ConcertId
    ticketTypeId = $TicketTypeId
    quantity = 1
  }

  $queued = Invoke-TimedPostJson "$ApiBaseUrl/orders" $AccessToken $body
  $queuedStatus = $queued.status
  $queuedBody = $queued.body
  if ($queuedBody) {
    $queuedBody = $queuedBody -replace '"queueToken":"[^"]+"', '"queueToken":"<redacted>"'
  }

  $queueAfterEnqueue = (Redis @("ZCARD", $queueKey)).Trim()

  Redis @("DEL", $activeKey) | Out-Null
  Start-Sleep -Seconds 7

  $activeAfter = (Redis @("ZCARD", $activeKey)).Trim()
  $queueAfter = (Redis @("ZCARD", $queueKey)).Trim()
}

$lines = @(
"# Task 27 - Load, cache, rate limit and waiting room test",
"",
"## Scope",
"",
"This report is generated from local test infrastructure only. It does not commit any production performance number.",
"",
"## How to run",
"",
"1. Start API, Postgres and Redis.",
"2. Set env vars:",
"    `$env:API_BASE_URL = `"http://localhost:3001/api/v1`"",
"    `$env:CONCERT_ID = `"$ConcertId`"",
"3. Run Artillery:",
"    pnpm dlx artillery run tests/artillery/concert-read-load.yml --output tests/reports/task27-concert-read-load-artillery.json",
"4. Run this script with an audience JWT:",
"    .\tests\scripts\task27-load-cache-rate-limit-waiting-room.ps1 -ApiBaseUrl `"http://localhost:3001/api/v1`" -ConcertId `"$ConcertId`" -TicketTypeId `"$TicketTypeId`" -AccessToken `$env:ACCESS_TOKEN",
"",
"## Endpoints",
"",
"- Concert list: GET /api/v1/concerts?page=1&limit=10",
"- Concert detail: GET /api/v1/concerts/$ConcertId",
"- Order / waiting room: POST /api/v1/orders",
"",
"## Cache before / after",
"",
"### Concert list cache",
"",
"- Redis key: concerts:published:list:1:10:all",
"- Before first request exists: $beforeListExists",
"- Cold request status: $($coldList.status)",
"- Cold request time ms: $($coldList.ms)",
"- After cold request exists: $afterColdListExists",
"- TTL after cold request: $listTtl",
"- Warm request status: $($warmList.status)",
"- Warm request time ms: $($warmList.ms)",
"",
"### Concert detail cache",
"",
"- Redis key: concerts:detail:$ConcertId",
"- Before first request exists: $beforeDetailExists",
"- Cold request status: $($coldDetail.status)",
"- Cold request time ms: $($coldDetail.ms)",
"- After cold request exists: $afterColdDetailExists",
"- TTL after cold request: $detailTtl",
"- Warm request status: $($warmDetail.status)",
"- Warm request time ms: $($warmDetail.ms)",
"",
"## Rate limit result",
"",
"Public policy was tested with 130 rapid requests to GET /concerts.",
"",
"- HTTP 200 count: $rate200",
"- HTTP 429 count: $rate429",
"- Other status count: $rateOther",
"",
"## Waiting room / queue token release",
"",
"This test seeds 101 fake active checkout sessions in Redis to force waiting room queueing.",
"",
"- Active count before queue request: $activeBefore",
"- Queue count before queue request: $queueBefore",
"- Queue request HTTP status: $queuedStatus",
"- Queue count after enqueue: $queueAfterEnqueue",
"- Active count after release wait: $activeAfter",
"- Queue count after release wait: $queueAfter",
"",
"Queue response body:",
"",
"    $queuedBody",
"",
"## Acceptance Criteria",
"",
"- Co script va huong dan chay: PASS",
"- Khong cam ket con so ngoai ha tang test: PASS",
"- Co ket qua truoc/sau cache: PASS"
)

$lines | Set-Content tests\reports\task27-load-cache-rate-limit-waiting-room-report.md -Encoding UTF8

"REPORT_CREATED: tests\reports\task27-load-cache-rate-limit-waiting-room-report.md"

