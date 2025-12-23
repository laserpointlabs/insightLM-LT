# InsightLM-LT Setup Script
# Installs dependencies and runs the application

param(
    [switch]$Build = $false,
    [switch]$SkipRun = $false
)

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  InsightLM-LT Setup Script" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if Node.js is installed
Write-Host "Checking prerequisites..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "OK Node.js installed: $nodeVersion" -ForegroundColor Green
}
catch {
    Write-Host "X Node.js not found. Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

try {
    $npmVersion = npm --version
    Write-Host "OK npm installed: $npmVersion" -ForegroundColor Green
}
catch {
    Write-Host "X npm not found. Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Gray

npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nX Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "OK Dependencies installed successfully" -ForegroundColor Green

# Build the application (optional, requires GTK on Windows)
if ($Build) {
    Write-Host "`nBuilding application..." -ForegroundColor Yellow
    Write-Host "Note: Production build requires GTK for Windows (for canvas package)" -ForegroundColor Gray

    npm run build

    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nX Build failed (this is OK for development - use 'npm run dev' instead)" -ForegroundColor Yellow
        Write-Host "Production builds require GTK: https://github.com/Automattic/node-canvas/wiki/Installation:-Windows" -ForegroundColor Gray
    }
    else {
        Write-Host "OK Build completed successfully" -ForegroundColor Green
    }
}

# Run the application
if (-not $SkipRun) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  Starting InsightLM-LT in DEV mode..." -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan

    npm run dev
}
else {
    Write-Host "`nSetup complete! Run 'npm run dev' to start the application." -ForegroundColor Green
}
