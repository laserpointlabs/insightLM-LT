# Local Issues Log

(Use GitHub Issues when GH auth is available. Until then, log here.)

## 2026-01-09 — Git: could not write `.git/config` (Permission denied)
- **GitHub issue**: `https://github.com/AVIAN-LLC/insightLM-LT/issues/2`
- **When**: During `git push -u ... feat/projects-gitlite` after squash-merge + branch creation.
- **Error**: `error: could not write config file .git/config: Permission denied`
- **Impact**: Push succeeded, but tracking/config writes may be unreliable; could cause future branch tracking or config updates to fail.
- **Likely cause**: Filesystem permission/ACL issue on `.git/config` (possibly due to elevated/readonly attribute/AV interference).
- **Follow-up**:
  - [ ] Reproduce with a harmless config write: `git config --local --list` / `git config --local test.write true`
  - [ ] If repro: fix ACL/ownership on `.git` folder; verify writes work.
  - [ ] Close/delete this note in ~30 days if it never recurs.
