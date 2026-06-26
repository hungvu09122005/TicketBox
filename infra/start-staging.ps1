# TicketBox Staging Orchestration Script
# Exposes the NestJS API port 3001 using localtunnel, updates the environment variables, and launches the NestJS application.

$PSScriptRoot = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition

# 1. Start Docker Compose infrastructure containers (redis and minio)
Write-Host "Checking Docker Compose containers..." -ForegroundColor Cyan
docker compose -f "$PSScriptRoot\docker-compose.yml" up -d redis minio
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to start docker containers. Make sure Docker is running."
    exit 1
}

# 2. Setup Tunnel log files
$cfLog = Join-Path $PSScriptRoot "cloudflared.log"
$cfErr = Join-Path $PSScriptRoot "cloudflared.err"
$ltLog = Join-Path $PSScriptRoot "localtunnel.log"
$ltErr = Join-Path $PSScriptRoot "localtunnel.err"

foreach ($file in @($cfLog, $cfErr, $ltLog, $ltErr)) {
    if (Test-Path $file) { Remove-Item $file -Force -ErrorAction SilentlyContinue }
}

# 3. Start Tunnel
$url = $null
$tunnelProcess = $null
$tunnelType = ""

# Try Cloudflare first
Write-Host "Starting Cloudflare Tunnel on port 3001..." -ForegroundColor Cyan
$tunnelProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx cloudflared tunnel --url http://localhost:3001" -NoNewWindow -PassThru -RedirectStandardOutput $cfLog -RedirectStandardError $cfErr

$timeout = 15 # seconds
$elapsed = 0
Write-Host "Waiting for public URL from Cloudflare..." -NoNewline -ForegroundColor Cyan
while ($elapsed -lt $timeout) {
    Write-Host "." -NoNewline -ForegroundColor Cyan
    if (Test-Path $cfErr) {
        $errContent = Get-Content $cfErr -Raw
        if ($errContent -match "(https?://[a-zA-Z0-9-]+\.trycloudflare\.com)") {
            $url = $Matches[1].Trim()
            $tunnelType = "Cloudflare"
            Write-Host ""
            break
        }
    }
    if (Test-Path $cfLog) {
        $logContent = Get-Content $cfLog -Raw
        if ($logContent -match "(https?://[a-zA-Z0-9-]+\.trycloudflare\.com)") {
            $url = $Matches[1].Trim()
            $tunnelType = "Cloudflare"
            Write-Host ""
            break
        }
    }
    Start-Sleep -Seconds 1
    $elapsed++
}

# Fallback to localtunnel if Cloudflare failed
if (-not $url) {
    Write-Host "`nCloudflare Tunnel failed or timed out. Falling back to localtunnel..." -ForegroundColor Yellow
    if ($tunnelProcess) {
        Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
    }
    
    Write-Host "Starting localtunnel on port 3001..." -ForegroundColor Cyan
    $tunnelProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx localtunnel --port 3001" -NoNewWindow -PassThru -RedirectStandardOutput $ltLog -RedirectStandardError $ltErr
    
    $elapsed = 0
    Write-Host "Waiting for public URL from localtunnel..." -NoNewline -ForegroundColor Cyan
    while ($elapsed -lt $timeout) {
        Write-Host "." -NoNewline -ForegroundColor Cyan
        if (Test-Path $ltLog) {
            $logContent = Get-Content $ltLog -Raw
            if ($logContent -match "your url is: (https?://[^\s]+)") {
                $url = $Matches[1].Trim()
                $tunnelType = "localtunnel"
                Write-Host ""
                break
            }
        }
        Start-Sleep -Seconds 1
        $elapsed++
    }
}

if (-not $url) {
    Write-Host ""
    Write-Error "Failed to obtain any public tunnel URL within time limits."
    if ($tunnelProcess) {
        Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
    }
    exit 1
}

Write-Host "$tunnelType successfully started! Public URL: $url" -ForegroundColor Green

# 5. Update Env Files with public callback URL
$vnpayIpnUrl = "$url/api/v1/payments/callback/vnpay"
Write-Host "Setting VNPAY_IPN_URL to: $vnpayIpnUrl" -ForegroundColor Cyan

function Update-EnvFile($filePath, $ipnUrl) {
    if (Test-Path $filePath) {
        $content = Get-Content $filePath -Raw
        if ($content -match "VNPAY_IPN_URL=.*") {
            $content = $content -replace "VNPAY_IPN_URL=.*", "VNPAY_IPN_URL=$ipnUrl"
            [System.IO.File]::WriteAllText($filePath, $content)
            Write-Host "Updated $filePath" -ForegroundColor Green
        } else {
            $content += "`nVNPAY_IPN_URL=$ipnUrl`n"
            [System.IO.File]::WriteAllText($filePath, $content)
            Write-Host "Appended VNPAY_IPN_URL to $filePath" -ForegroundColor Green
        }
    } else {
        Write-Host "Warning: $filePath not found" -ForegroundColor Yellow
    }
}

$rootEnv = Resolve-Path (Join-Path $PSScriptRoot "..\.env") -ErrorAction SilentlyContinue
$apiEnv = Resolve-Path (Join-Path $PSScriptRoot "..\apps\api\.env") -ErrorAction SilentlyContinue

if ($rootEnv) { Update-EnvFile -filePath $rootEnv.Path -ipnUrl $vnpayIpnUrl }
if ($apiEnv) { Update-EnvFile -filePath $apiEnv.Path -ipnUrl $vnpayIpnUrl }

# 6. Start the NestJS API application in Staging Mode
try {
    Write-Host "Starting NestJS API in staging mode (pnpm dev:api)..." -ForegroundColor Cyan
    # Run in the root directory
    Set-Location (Join-Path $PSScriptRoot "..")
    pnpm dev:api
} finally {
    Write-Host "`nShutting down tunnel process..." -ForegroundColor Yellow
    if ($tunnelProcess) {
        Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
    }
    foreach ($file in @($cfLog, $cfErr, $ltLog, $ltErr)) {
        if (Test-Path $file) { Remove-Item $file -Force -ErrorAction SilentlyContinue }
    }
    Write-Host "Staging environment stopped." -ForegroundColor Green
}

