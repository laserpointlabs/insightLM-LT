# Git Quick Command Reference

Simple commands for working with the insightLM-LT repository.

## Initial Setup (First Time Only)

```powershell
# Clone the repository
git clone https://YOUR_TOKEN@github.com/AVIAN-LLC/insightLM-LT.git
cd insightLM-LT

# Set your identity
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

## Daily Workflow

```powershell
# Check status (see what changed)
git status

# Pull latest changes from GitHub
git pull

# Add files to staging
git add .                           # Add all changed files
git add path/to/file.ts            # Add specific file

# Commit changes
git commit -m "Your commit message"

# Push to GitHub
git push

# Push and set upstream (first time pushing a branch)
git push -u origin main
```

## Common Operations

```powershell
# See what changed
git status                          # Show modified files
git diff                            # Show line-by-line changes
git diff path/to/file.ts           # Show changes in specific file

# View commit history
git log                             # Full history
git log --oneline                   # Compact history
git log --oneline -10              # Last 10 commits

# Discard changes
git checkout -- path/to/file.ts    # Discard changes to one file
git checkout -- .                   # Discard all changes (careful!)

# Create a branch
git checkout -b feature-name       # Create and switch to new branch
git push -u origin feature-name    # Push new branch to GitHub

# Switch branches
git checkout main                  # Switch to main branch
git checkout feature-name          # Switch to feature branch

# View branches
git branch                         # Local branches
git branch -a                      # All branches (local + remote)

# Delete a branch
git branch -d feature-name         # Delete local branch
git push origin --delete feature-name  # Delete remote branch
```

## Undo Mistakes

```powershell
# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1

# Revert specific commit
git revert COMMIT_HASH

# Unstage files
git reset HEAD path/to/file.ts     # Unstage specific file
git reset HEAD .                   # Unstage all files
```

## Working with Remotes

```powershell
# View remote info
git remote -v

# Update remote URL (change token)
git remote set-url origin https://NEW_TOKEN@github.com/AVIAN-LLC/insightLM-LT.git

# Fetch changes without merging
git fetch origin

# Pull specific branch
git pull origin main
```

## Syncing Fork/Copy

```powershell
# Pull latest, add changes, and push
git pull
git add .
git commit -m "Your changes"
git push
```

## Emergency: Start Over Clean

```powershell
# Delete local changes and match GitHub
git fetch origin
git reset --hard origin/main

# Or completely re-clone
cd ..
rm -rf insightLM-LT
git clone https://YOUR_TOKEN@github.com/AVIAN-LLC/insightLM-LT.git
```

## Tips

- **Before you start work:** `git pull`
- **After making changes:** `git status` → `git add .` → `git commit -m "message"` → `git push`
- **Commit often:** Small commits are better than big ones
- **Write clear messages:** Describe what you changed and why
- **Pull before push:** Always pull latest changes before pushing

## Common Workflow Example

```powershell
# Start your day
git pull

# Make changes to files...
# (edit code, save files)

# Check what changed
git status

# Add all changes
git add .

# Commit with message
git commit -m "Add new dashboard feature"

# Push to GitHub
git push

# Done!
```

## Troubleshooting

**Error: "Repository not found"**
- Check your token is valid and authorized for SSO
- See `docs/GITHUB_ENTERPRISE_SETUP.md`

**Error: "Updates were rejected"**
- Someone else pushed changes
- Solution: `git pull` then `git push`

**Error: "Your branch is behind"**
- You need to pull changes
- Solution: `git pull`

**Merge conflicts**
1. `git pull` shows conflicts
2. Open conflicted files (marked with `<<<<<<<`)
3. Fix the conflicts manually
4. `git add .`
5. `git commit -m "Resolve merge conflicts"`
6. `git push`


