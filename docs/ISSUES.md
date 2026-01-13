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

## 2026-01-12 — CI failing (laserpoint): Phase 0 Jupyter workbook:// cwd regression
- **GitHub issue (AVIAN tracking)**: `https://github.com/AVIAN-LLC/insightLM-LT/issues/3`
- **Where**: `laserpointlabs/insightLM-LT` GitHub Actions → CI run `20924758888`
- **Failing step**: `npm run test:decoupling` → Phase 0
- **Error**: `Failed to create notebook: name 'new_notebook' is not defined`
- **Notes**:
  - Phases 1–4 pass; only Phase 0 fails.
  - CI annotations also mention `git.exe` exit 128, but the first failing assertion is the Phase 0 notebook creation error above.

## 2026-01-12 — Workbook delete/rename must cascade to contexts + active context (no stale refs)
- **GitHub issue (AVIAN tracking)**: `https://github.com/AVIAN-LLC/insightLM-LT/issues/4`
- **Problem**: deleting/renaming a workbook can leave stale references (Chat context picker, contexts’ `workbook_ids`, quick `[WB]` contexts, active context pointer, chat threads).

## 2026-01-13 — Automation regression: duplicate `testIds.documentViewer` key (fixed)
- **Problem**: `src/testing/testIds.ts` accidentally defined `documentViewer` twice; the latter overwrote the former silently at runtime.
- **Impact**: UI and smoke selectors drifted (tabs/save ids), creating flaky or broken automation.
- **Fix**: Removed the duplicate key and standardized on one authoritative `testIds.documentViewer` block.
- **Write-up**: `docs/Testing/TESTIDS_DUPLICATE_KEY_POSTMORTEM.md`
