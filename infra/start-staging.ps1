# TicketBox Staging Orchestration Script
# Exposes the NestJS API port 3001 using localtunnel, updates the environment variables, and launches the NestJS application.

$PSScriptRoot = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition

# 1. Start Docker Compose infrastructure containers
Write-Host "Checking Docker Compose containers..." -ForegroundColor Cyan
docker compose -f "$PSScriptRoot\docker-compose.yml" up -d postgres redis minio
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to start docker containers. Make sure Docker is running."
    exit 1
}

# 2. Setup Tunnel log files
$logFile = Join-Path $PSScriptRoot "localtunnel.log"
$errFile = Join-Path $PSScriptRoot "localtunnel.err"
if (Test-Path $logFile) { Remove-Item $logFile -Force -ErrorAction SilentlyContinue }
if (Test-Path $errFile) { Remove-Item $errFile -Force -ErrorAction SilentlyContinue }

# 3. Start localtunnel on port 3001
Write-Host "Starting localtunnel on port 3001..." -ForegroundColor Cyan
$ltProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx localtunnel --port 3001" -NoNewWindow -PassThru -RedirectStandardOutput $logFile -RedirectStandardError $errFile

# 4. Wait for localtunnel to output the URL
$url = $null
$timeout = 30 # seconds
$elapsed = 0
Write-Host "Waiting for public URL from localtunnel..." -NoNewline -ForegroundColor Cyan
while ($elapsed -lt $timeout) {
    Write-Host "." -NoNewline -ForegroundColor Cyan
    if (Test-Path $logFile) {
        $logContent = Get-Content $logFile -Raw
        if ($logContent -match "your url is: (https?://[^\s]+)") {
            $url = $Matches[1].Trim()
            Write-Host ""
            break
        }
    }
    Start-Sleep -Seconds 1
    $elapsed++
}

if (-not $url) {
    Write-Host ""
    Write-Error "Failed to obtain localtunnel URL within $timeout seconds."
    if (Test-Path $logFile) {
        Write-Host "Log contents:" -ForegroundColor Yellow
        Get-Content $logFile
    }
    if ($ltProcess) {
        Stop-Process -Id $ltProcess.Id -Force -ErrorAction SilentlyContinue
    }
    exit 1
}

Write-Host "Localtunnel successfully started! Public URL: $url" -ForegroundColor Green

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
    Write-Host "`nShutting down localtunnel process..." -ForegroundColor Yellow
    if ($ltProcess) {
        Stop-Process -Id $ltProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $logFile) {
        Remove-Item $logFile -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $errFile) {
        Remove-Item $errFile -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Staging environment stopped." -ForegroundColor Green
}
