$ErrorActionPreference = 'Stop'

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Install GitHub CLI (gh) - Non-Admin" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

function Refresh-PathFromRegistry {
  $UserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $MachinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $Env:Path = "${UserPath};${MachinePath}"
}

try {
  $existing = Get-Command gh -ErrorAction SilentlyContinue
  if ($null -ne $existing) {
    Write-Host "OK gh already available: $($existing.Source)" -ForegroundColor Green
    gh --version
    exit 0
  }

  Write-Host "Installing gh via webinstall.dev (non-admin, per-user)..." -ForegroundColor Yellow
  Invoke-WebRequest -Uri https://webinstall.dev/gh -UseBasicParsing |
    Select-Object -ExpandProperty Content |
    powershell

  Refresh-PathFromRegistry

  $installed = Get-Command gh -ErrorAction SilentlyContinue
  if ($null -eq $installed) {
    Write-Host "`nX gh install completed but gh is not on PATH for this session." -ForegroundColor Red
    Write-Host "Close/reopen your terminal or run:" -ForegroundColor Yellow
    Write-Host "  `$UserPath = [Environment]::GetEnvironmentVariable('Path', 'User')" -ForegroundColor Gray
    Write-Host "  `$MachinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')" -ForegroundColor Gray
    Write-Host "  `$Env:Path = \"`${UserPath};`${MachinePath}\"" -ForegroundColor Gray
    exit 1
  }

  Write-Host "`nOK gh installed: $($installed.Source)" -ForegroundColor Green
  gh --version
}
catch {
  Write-Host "`nX Failed to install gh: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}


