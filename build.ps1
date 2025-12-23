# Build script for InsightLM-LT
# Creates production build

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Building InsightLM-LT..." -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Dependencies not installed. Installing..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nX Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Building application..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nX Build failed" -ForegroundColor Red
    exit 1
}

Write-Host "`nOK Build completed successfully!" -ForegroundColor Green
Write-Host "Output is in the 'dist' and 'dist-electron' directories" -ForegroundColor Gray
