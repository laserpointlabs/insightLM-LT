# Dual-Repo Push (AVIAN + Laserpoint) + Zero-Token Hygiene

This doc exists because syncing to **two GitHub repos** can get confusing fast, and **tokens must never end up in git history**.

## What we want

- **One local repo**
- **One push command**
- Code goes to **both**:
  - AVIAN: `AVIAN-LLC/insightLM-LT`
  - Laserpoint: `laserpointlabs/insightLM-LT`
- **No tokens/secrets** in:
  - source code
  - docs
  - config files
  - git history

## One-time setup: configure `origin` to push to both repos

Run from the repo root:

```powershell
# Add AVIAN as the fetch/push base remote
git remote remove origin
git remote add origin https://jdehart_avian@github.com/AVIAN-LLC/insightLM-LT.git

# Make origin PUSH to both AVIAN and Laserpoint
git remote set-url --push origin https://jdehart_avian@github.com/AVIAN-LLC/insightLM-LT.git
git remote set-url --add --push origin https://laserpointlabs@github.com/laserpointlabs/insightLM-LT.git

# Prevent github.com creds clobbering each other (store per-repo-path)
git config --global credential.useHttpPath true

git remote -v
git remote get-url --push --all origin
```

### Normal day-to-day workflow

```powershell
git checkout -b my-branch
git add -A
git commit -m "..."
git push -u origin my-branch
```

After the first push, you usually only need:

```powershell
git push
```

## Fix “Sync” problems in the UI (wrong upstream)

If your branch is tracking `origin/main` (or some other upstream), “Sync” will behave weird.

Fix upstream once:

```powershell
git branch -u origin/<your-branch-name>
```

Verify:

```powershell
git status -sb
```

## Authentication: keep it deterministic

Two supported ways:

- **Browser/device auth (Git Credential Manager)**: works, but sometimes the browser flow can glitch.
- **Token auth**: deterministic, but tokens must be handled carefully and never committed anywhere.

### Quick test: do I have AVIAN/Laserpoint access?

```powershell
git ls-remote https://jdehart_avian@github.com/AVIAN-LLC/insightLM-LT.git HEAD
git ls-remote https://laserpointlabs@github.com/laserpointlabs/insightLM-LT.git HEAD
```

If these return a hash, read access is working.

## Zero-token rule (non-negotiable)

**Never** commit:
- PATs (`ghp_…`, `github_pat_…`, etc.)
- API keys (OpenAI, Anthropic, etc.)
- `.env` files
- any “example” in docs that includes a real token

All secrets must come from **OS environment variables** (or a secret manager), never from git-tracked files.

### Required config pattern

Use env vars in YAML/config:

```yaml
apiKey: ${OPENAI_API_KEY}
```

### If a secret ever leaks into history

Laserpoint has push protection and will reject branches containing secrets in history.

**Response plan**:
- Stop pushing.
- Rotate/revoke the secret immediately.
- Rewrite history to remove the secret (e.g. `git-filter-repo`).
- Force-push the cleaned history.

We’ve already had to do this once: old commits contained leaked tokens/keys and Laserpoint rejected pushes until history was scrubbed.

## Preventing leaks (recommended)

- Add/keep `.gitignore` entries for `.env*` and other local config.
- Add a **pre-commit secret scan** (preferred).
- Add a CI secret scan (also recommended).

If you want, we can add a simple pre-commit hook that rejects commits containing common token patterns.
