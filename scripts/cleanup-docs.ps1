# PowerShell script to clean up markdown files
# Removes trailing whitespace and extra blank lines while preserving UTF-8 encoding and emojis

param(
    [string]$Path = "docs",
    [switch]$DryRun = $false
)

$files = Get-ChildItem -Path $Path -Filter "*.md" -Recurse
$cleanedCount = 0
$totalCharsChanged = 0

foreach ($file in $files) {
    # Read file with UTF-8 encoding to preserve emojis
    $originalContent = Get-Content $file.FullName -Raw -Encoding UTF8

    if ([string]::IsNullOrEmpty($originalContent)) {
        continue
    }

    $originalLength = $originalContent.Length

    # Split into lines, handling both CRLF and LF
    $lines = $originalContent -split "`r?`n"

    # Remove trailing whitespace from each line
    $cleanedLines = @()
    foreach ($line in $lines) {
        # Remove trailing spaces and tabs
        $cleanedLine = $line -replace '[ \t]+$', ''
        $cleanedLines += $cleanedLine
    }

    # Rejoin with LF (Unix-style line endings)
    $content = $cleanedLines -join "`n"

    # Remove multiple consecutive blank lines (more than 2 consecutive newlines)
    while ($content -match "(`n`n`n+)") {
        $content = $content -replace "(`n`n`n+)", "`n`n"
    }

    # Remove all trailing whitespace and newlines
    $content = $content -replace "[ \t\r\n]+$", ""

    # Ensure file ends with exactly one newline
    $content += "`n"

    $newLength = $content.Length
    $charsChanged = [Math]::Abs($originalLength - $newLength)

    # Check if content actually changed
    if ($originalContent -ne $content) {
        if ($DryRun) {
            Write-Host "Would clean: $($file.Name) (would change $charsChanged chars)" -ForegroundColor Yellow
        } else {
            # Write with UTF-8 encoding and -NoNewline to prevent extra line
            Set-Content $file.FullName $content -Encoding UTF8 -NoNewline
            Write-Host "Cleaned: $($file.Name) (changed $charsChanged chars)" -ForegroundColor Green
            $cleanedCount++
            $totalCharsChanged += $charsChanged
        }
    }
}

if ($DryRun) {
    Write-Host "`nDry run complete. Use without -DryRun to apply changes." -ForegroundColor Cyan
} else {
    Write-Host "`nCleanup complete! Cleaned $cleanedCount files, changed $totalCharsChanged characters total." -ForegroundColor Green
}
