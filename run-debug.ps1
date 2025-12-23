param(
    [int]$Port = 9222,
    [string]$ScreenshotKey = $env:SCREENSHOT_ENCRYPTION_KEY
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# Resolve screenshot key: prefer explicit param, then existing env, else auto-generate
function New-HexKey32 {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
}

if (-not $ScreenshotKey) {
    Write-Warning "SCREENSHOT_ENCRYPTION_KEY not provided; generating a temporary key for this session."
    $ScreenshotKey = New-HexKey32
}

$env:SCREENSHOT_ENCRYPTION_KEY = $ScreenshotKey
Write-Host "Using SCREENSHOT_ENCRYPTION_KEY: $($ScreenshotKey.Substring(0,8))... (not persisted)" -ForegroundColor Green

Write-Host "Starting dev with remote debugging on port $Port..." -ForegroundColor Cyan

# Launch Vite (React) dev server
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd `"$root`"; npm run dev:react" -WindowStyle Normal

# Launch Electron with remote debugging port
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd `"$root`"; npm run dev:electron -- --remote-debugging-port=$Port --enable-logging" -WindowStyle Normal

Write-Host ""
Write-Host "Dev servers started in separate PowerShell windows." -ForegroundColor Cyan
Write-Host "Electron DevTools websocket: ws://127.0.0.1:$Port" -ForegroundColor Cyan
Write-Host "Use MCP tools (get_electron_window_info, take_screenshot, send_command_to_electron, read_electron_logs) when the app is up." -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop: close the spawned windows or run 'taskkill /IM electron.exe /F' and 'taskkill /IM node.exe /F'." -ForegroundColor Yellow
