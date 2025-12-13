# Installing GitHub CLI (gh)

## Overview

GitHub CLI (`gh`) is the official command-line tool for GitHub. It allows you to work seamlessly with GitHub from your terminal, including managing pull requests, issues, repositories, and more.

**⚠️ Important:** Do NOT install `gh` via npm. The npm package `gh` is a deprecated third-party tool called "nodegh" that is not the official GitHub CLI and will cause issues.

## Recommended Installation Methods

### Method 1: Webinstall.dev (Easiest - Recommended)

[Webinstall.dev](https://webinstall.dev/gh/) provides a cross-platform installer that works seamlessly on Windows, macOS, and Linux.

#### Windows (PowerShell)

1. Open PowerShell
2. Run the installer:
   ```powershell
   Invoke-WebRequest -Uri https://webinstall.dev/gh -UseBasicParsing | Select-Object -ExpandProperty Content | powershell
   ```

3. Update your PATH (choose one):
   - **Option A:** Run this command in PowerShell:
     ```powershell
     $UserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
     $MachinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
     $Env:Path = "${UserPath};${MachinePath}"
     ```
   - **Option B:** Close and reopen your terminal

4. Verify installation:
   ```powershell
   gh --version
   ```

#### macOS/Linux

```bash
curl -sS https://webinstall.dev/gh | bash
```

Then restart your terminal or run:
```bash
source ~/.config/envman/PATH.env
```

### Method 2: Windows Package Manager (winget)

If you have Windows 10/11 with winget installed:

```powershell
winget install --id GitHub.cli
```

### Method 3: Chocolatey (Windows)

If you have Chocolatey installed:

```powershell
choco install gh
```

### Method 4: Direct Download

1. Visit [GitHub CLI Releases](https://github.com/cli/cli/releases)
2. Download the appropriate installer for your platform
3. Run the installer
4. Follow the installation prompts

## Verification

After installation, verify that `gh` is working correctly:

```bash
gh --version
```

You should see output like:
```
gh version 2.83.2 (2025-12-10)
https://github.com/cli/cli/releases/tag/v2.83.2
```

Test the help command:
```bash
gh --help
```

## Initial Setup

### Authentication

To start using GitHub CLI, authenticate with your GitHub account:

```bash
gh auth login
```

This will guide you through the authentication process. You can choose between:
- **Browser authentication** (recommended)
- **Token authentication** (for CI/CD environments)

### Verify Authentication

```bash
gh auth status
```

## Common Issues and Solutions

### Issue: "gh: command not found"

**Solution:** The PATH environment variable hasn't been updated. Either:
- Close and reopen your terminal
- Manually add the installation directory to your PATH
- Run the PATH update command provided by the installer

### Issue: Wrong version or unexpected behavior

**Solution:** You may have installed the deprecated npm package. Check:
```bash
npm list -g gh
```

If it shows `gh@2.8.9` or similar, uninstall it:
```bash
npm uninstall -g gh
```

Then install the official GitHub CLI using one of the methods above.

### Issue: Permission errors on macOS/Linux

**Solution:** Ensure the binary has execute permissions:
```bash
chmod +x ~/.local/bin/gh
```

## What NOT to Do

### ❌ Don't Install via npm

```bash
# DON'T DO THIS
npm install -g gh
```

The npm package `gh` is **not** the official GitHub CLI. It's a deprecated third-party tool called "nodegh" that:
- Has compatibility issues
- Lacks many features of the official CLI
- Can cause conflicts with the real GitHub CLI
- Is no longer maintained

### ✅ Use Official Installation Methods

Always use one of the recommended methods listed above to ensure you get the official, maintained GitHub CLI.

## Quick Reference

### Installation Locations

- **Windows (webinstall.dev):** `C:\Users\<username>\.local\bin\gh.exe`
- **macOS/Linux (webinstall.dev):** `~/.local/bin/gh`
- **Windows (winget):** Usually `C:\Program Files\GitHub CLI\gh.exe`

### Useful Commands

```bash
# Check version
gh --version

# View help
gh --help

# Authenticate
gh auth login

# Check auth status
gh auth status

# View repository
gh repo view

# List pull requests
gh pr list

# Create pull request
gh pr create

# List issues
gh issue list
```

## Additional Resources

- **Official Documentation:** https://cli.github.com/manual/
- **Webinstall.dev:** https://webinstall.dev/gh/
- **GitHub Repository:** https://github.com/cli/cli
- **Cheat Sheet:** https://webinstall.dev/gh/ (scroll down for examples)

## Summary

The easiest way to install GitHub CLI is using **webinstall.dev**, which provides a simple one-command installation that works across all platforms. Avoid npm installation methods, as they install a deprecated third-party package that is not the official GitHub CLI.

