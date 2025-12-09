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
    Write-Host "✓ Node.js installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found. Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

try {
    $npmVersion = npm --version
    Write-Host "✓ npm installed: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ npm not found. Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Gray

npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n✗ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green

# Build the application
if (-not $SkipBuild) {
    Write-Host "`nBuilding application..." -ForegroundColor Yellow

    npm run build

    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n✗ Build failed" -ForegroundColor Red
        exit 1
    }

    Write-Host "✓ Build completed successfully" -ForegroundColor Green
} else {
    Write-Host "`nSkipping build (use -SkipBuild:$false to build)" -ForegroundColor Gray
}

# Run the application
if (-not $SkipRun) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  Starting InsightLM-LT..." -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan

    npm run dev
} else {
    Write-Host "`nSetup complete! Run 'npm run dev' to start the application." -ForegroundColor Green
}
