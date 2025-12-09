# InsightLM-LT Setup Script
# Installs dependencies, builds, and optionally runs the application

param(
    [switch]$SkipBuild = $false,
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

# Build the application
if (-not $SkipBuild) {
    Write-Host "`nBuilding application..." -ForegroundColor Yellow
    
    npm run build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nX Build failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "OK Build completed successfully" -ForegroundColor Green
}

# Run the application
if (-not $SkipRun) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  Starting InsightLM-LT..." -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    npm run dev
}

Write-Host "`nSetup complete! Run 'npm run dev' to start the application." -ForegroundColor Green
