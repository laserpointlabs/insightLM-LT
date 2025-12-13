# GitHub Enterprise Repository Setup Guide

This guide walks through setting up a local repository to push to an enterprise GitHub organization repository with SAML SSO enabled.

## Prerequisites

- Git installed and configured
- Access to the GitHub organization (AVIAN-LLC in this example)
- GitHub account with appropriate permissions

## Step-by-Step Setup

### Step 1: Check Current Git Configuration

First, verify your current git remote configuration:

```powershell
git remote -v
```

If no remote is configured, you'll see no output. If a remote exists but points to the wrong location, note the current URL.

### Step 2: Create a Personal Access Token (PAT)

1. Go to GitHub: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Give it a descriptive name (e.g., "insightLM-LT-repo")
4. Select the **`repo`** scope (full control of private repositories)
5. Click **"Generate token"**
6. **Copy the token immediately** - you won't be able to see it again!

> **Important:** Keep this token secure. Treat it like a password.

### Step 3: Add or Update the Remote URL

Add the remote with your Personal Access Token embedded in the URL:

```powershell
git remote add origin https://YOUR_TOKEN@github.com/AVIAN-LLC/insightLM-LT.git
```

Or if a remote already exists, update it:

```powershell
git remote set-url origin https://YOUR_TOKEN@github.com/AVIAN-LLC/insightLM-LT.git
```

Replace `YOUR_TOKEN` with your actual Personal Access Token (e.g., `ghp_...`).

**Example:**
```powershell
git remote set-url origin https://ghp_REDACTED@github.com/AVIAN-LLC/insightLM-LT.git
```

### Step 4: Verify Remote Configuration

Confirm the remote was set correctly:

```powershell
git remote -v
```

You should see:
```
origin  https://YOUR_TOKEN@github.com/AVIAN-LLC/insightLM-LT.git (fetch)
origin  https://YOUR_TOKEN@github.com/AVIAN-LLC/insightLM-LT.git (push)
```

### Step 5: Test Connection (Will Fail Initially with SAML SSO)

Try to fetch from the remote:

```powershell
git fetch origin
```

**Expected Error (if SAML SSO is enabled):**
```
remote: The 'AVIAN-LLC' organization has enabled or enforced SAML SSO.
remote: To access this repository, visit https://github.com/enterprises/avian-llc/sso?authorization_request=...
fatal: unable to access 'https://github.com/AVIAN-LLC/insightLM-LT.git/': The requested URL returned error: 403
```

### Step 6: Authorize Token for SAML SSO

1. **Copy the SSO authorization URL** from the error message
2. **Open the URL in your browser**
3. **Click "Authorize"** to grant your Personal Access Token access to the organization
4. You may need to authenticate with your organization's SSO provider

### Step 7: Verify Connection Works

After authorizing, test the connection again:

```powershell
git fetch origin
```

If successful, you should see no errors (or see branches being fetched).

### Step 8: Push Your Code

Check your current branch and status:

```powershell
git status
git branch
```

Push your code to the remote:

```powershell
git push -u origin main
```

Or for other branches:

```powershell
git push -u origin BRANCH_NAME
```

The `-u` flag sets up tracking so future pushes can use just `git push`.

### Step 9: Verify Push Success

You should see output like:

```
Enumerating objects: 197, done.
Counting objects: 100% (197/197), done.
Delta compression using up to 32 threads
Compressing objects: 100% (193/193), done.
Writing objects: 100% (197/197), 2.16 MiB | 5.38 MiB/s, done.
Total 197 (delta 12), reused 0 (delta 0), pack-reused 0
remote: Resolving deltas: 100% (12/12), done.
To https://github.com/AVIAN-LLC/insightLM-LT.git
 * [new branch]      main -> main
branch 'main' set up to track 'origin/main'.
```

## Troubleshooting

### Issue: "Repository not found" Error

**Possible causes:**
- Repository doesn't exist (create it on GitHub first)
- You don't have access to the organization
- Repository name is incorrect
- Token doesn't have proper permissions

**Solution:**
- Verify repository exists and you have access
- Check token has `repo` scope
- Confirm organization name and repository name are correct

### Issue: "403 Forbidden" After Setting Up Token

**Possible causes:**
- Token not authorized for SAML SSO
- Token expired or revoked
- Organization requires SSO authorization

**Solution:**
- Re-authorize token via SSO link (Step 6)
- Generate a new token if needed
- Contact organization admin if issues persist

### Issue: TLS Certificate Verification Warning

If you see:
```
warning: TLS certificate verification has been disabled!
```

**Solution:**
Enable certificate verification:
```powershell
git config --global http.sslVerify true
```

### Issue: Token Visible in Remote URL (Security Concern)

While embedding the token in the URL works, it's not the most secure method. Consider using:

1. **Git Credential Manager** (recommended):
   ```powershell
   git config --global credential.helper manager-core
   ```
   Then use URL without token:
   ```powershell
   git remote set-url origin https://github.com/AVIAN-LLC/insightLM-LT.git
   ```
   Git will prompt for credentials and store them securely.

2. **SSH Keys** (alternative):
   ```powershell
   git remote set-url origin git@github.com:AVIAN-LLC/insightLM-LT.git
   ```
   Requires SSH key setup with GitHub.

## Security Best Practices

1. **Never commit tokens to the repository** - Use `.gitignore` if needed
2. **Use Git Credential Manager** instead of embedding tokens in URLs
3. **Rotate tokens regularly** - Generate new tokens periodically
4. **Use minimal scopes** - Only grant necessary permissions
5. **Revoke unused tokens** - Clean up old tokens in GitHub settings

## Quick Reference Commands

```powershell
# Check remote configuration
git remote -v

# Add remote with token
git remote add origin https://YOUR_TOKEN@github.com/ORGANIZATION/REPO.git

# Update existing remote
git remote set-url origin https://YOUR_TOKEN@github.com/ORGANIZATION/REPO.git

# Test connection
git fetch origin

# Push to remote
git push -u origin main

# Check git status
git status
```

## Additional Resources

- [GitHub Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [GitHub SAML SSO](https://docs.github.com/en/enterprise-cloud@latest/authentication/authenticating-with-saml-single-sign-on/about-authentication-with-saml-single-sign-on)
- [Git Credential Manager](https://github.com/GitCredentialManager/git-credential-manager)

---

**Last Updated:** December 2025
**Tested with:** GitHub Enterprise, Windows PowerShell, Git 2.x














