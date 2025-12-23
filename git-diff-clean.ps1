# Git diff wrapper that ignores blank lines at EOF
# Usage: .\git-diff-clean.ps1 [additional git diff arguments]

$args = $args -join ' '
Invoke-Expression "git diff --ignore-blank-lines $args"

