# Quick run script for InsightLM-LT
# Use this after initial setup to start the application

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Starting InsightLM-LT..." -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Dependencies not installed. Running setup..." -ForegroundColor Yellow
    .\setup.ps1 -SkipRun
    Write-Host ""
}

npm run dev

