# InsightLM-LT Setup Guide

Quick guide to get InsightLM-LT running on your machine.

## Prerequisites

- **Node.js** 18+ (download from https://nodejs.org/)
- **Git** (download from https://git-scm.com/)
- **Personal Access Token** for GitHub (see `docs/GITHUB_ENTERPRISE_SETUP.md`)

## Quick Start

### 1. Clone the Repository

```powershell
git clone https://YOUR_TOKEN@github.com/AVIAN-LLC/insightLM-LT.git
cd insightLM-LT
```

### 2. Run Setup Script

```powershell
.\setup.ps1
```

This will:
- Install all dependencies
- Build the application
- Start the development server

### 3. Done!

The application should open automatically in Electron.

## Alternative: Manual Setup

If you prefer manual setup:

```powershell
# Install dependencies
npm install

# Start development server
npm run dev
```

## Daily Usage

After initial setup, just run:

```powershell
.\run.ps1
```

Or manually:

```powershell
npm run dev
```

## Production Build

To create a production build:

```powershell
.\build.ps1
```

Or manually:

```powershell
npm run build
```

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| **Setup** | `.\setup.ps1` | First-time setup (install + build + run) |
| **Run** | `.\run.ps1` | Quick start for daily use |
| **Build** | `.\build.ps1` | Create production build |
| **Dev** | `npm run dev` | Start development server |
| **Build (manual)** | `npm run build` | Build for production |
| **Test** | `npm test` | Run tests |
| **Lint** | `npm run lint` | Check code quality |

## Script Options

### setup.ps1

```powershell
# Skip build step (just install dependencies)
.\setup.ps1 -SkipBuild

# Skip run step (install and build only)
.\setup.ps1 -SkipRun

# Just install dependencies
.\setup.ps1 -SkipBuild -SkipRun
```

## Troubleshooting

### "npm not found" or "node not found"

Install Node.js from https://nodejs.org/ (includes npm).

### Build fails with "tsc not found"

Run `npm install` first to install dependencies.

### Permission errors when running scripts

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Port already in use

Another instance is running. Close it or change the port in `vite.config.ts`.

### Dependency installation fails

Try:
```powershell
rm -rf node_modules
rm package-lock.json
npm install
```

### Application won't start

1. Check Node.js version: `node --version` (should be 18+)
2. Reinstall dependencies: `npm install`
3. Clear cache: `npm cache clean --force`
4. Try again: `npm run dev`

## Next Steps

- Read `docs/GIT_QUICK_COMMANDS.md` for Git workflow
- Read `docs/GITHUB_ENTERPRISE_SETUP.md` for repository setup
- Check `README.md` for project overview
- See `docs/ELECTRON_GUIDE.md` for development guide

## For Team Members

### First Time Setup

1. Get Personal Access Token from John or create your own at https://github.com/settings/tokens
2. Authorize token for SAML SSO (you'll get a link when you first try to clone)
3. Clone the repository with your token
4. Run `.\setup.ps1`
5. Start coding!

### Daily Workflow

1. Pull latest changes: `git pull`
2. Start app: `.\run.ps1`
3. Make changes
4. Commit and push: See `docs/GIT_QUICK_COMMANDS.md`

## Project Structure

```
insightLM-LT/
├── electron/          # Electron main process code
├── src/              # React frontend code
├── mcp-servers/      # MCP server implementations
├── docs/             # Documentation
├── scripts/          # Utility scripts
├── setup.ps1         # First-time setup script
├── run.ps1           # Quick run script
└── build.ps1         # Production build script
```

## Support

- Check documentation in `docs/` folder
- Review existing issues on GitHub
- Ask team members for help













