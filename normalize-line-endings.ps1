# Normalize line endings and trailing newlines for all text files
# This script ensures all files have consistent line endings (LF) and trailing newlines

Write-Host "Normalizing line endings and trailing newlines..." -ForegroundColor Green

# Get all text files that are tracked by Git
$files = git ls-files | Where-Object { 
    $_ -match '\.(md|ts|tsx|js|json|py|ps1|txt|yml|yaml)$' -or
    $_ -match '\.(ts|tsx|js)$' -or
    $_ -match '^[^.]*$' -and (Test-Path $_) -and (Get-Content $_ -Raw -ErrorAction SilentlyContinue)
}

$count = 0
foreach ($file in $files) {
    if (Test-Path $file) {
        try {
            $content = Get-Content $file -Raw -Encoding UTF8
            if ($content) {
                # Remove all trailing whitespace from each line
                $lines = $content -split "`r?`n"
                $normalized = ($lines | ForEach-Object { $_.TrimEnd() }) -join "`n"
                
                # Ensure file ends with exactly one newline
                if (-not $normalized.EndsWith("`n")) {
                    $normalized += "`n"
                }
                
                # Only write if content changed
                $currentContent = Get-Content $file -Raw -Encoding UTF8
                if ($normalized -ne $currentContent) {
                    Set-Content -Path $file -Value $normalized -Encoding UTF8 -NoNewline
                    $count++
                    Write-Host "  Normalized: $file" -ForegroundColor Yellow
                }
            }
        } catch {
            Write-Host "  Skipped: $file (error: $_)" -ForegroundColor Red
        }
    }
}

Write-Host "`nNormalized $count files." -ForegroundColor Green
Write-Host "Run 'git diff' to review changes, then commit if desired." -ForegroundColor Cyan

