## Releases, First Install, and Auto-Updates

This outlines how we distribute InsightLM, handle first install, and deliver automatic updates.

### Overview (mermaid)
```mermaid
flowchart LR
    dev[Tag Release in GitHub] --> ci[GitHub Actions Build & Sign]
    ci --> rel[Publish GitHub Release\n(Installers + latest.yml)]
    rel --> pages[GitHub Pages\n(Landing/Download Link)]
    rel --> app[Electron App]
    app -->|autoUpdater| rel
```

### Distribution channels
- **GitHub Releases**: primary channel; attach Windows installer (NSIS/exe or ZIP) and update metadata (latest.yml/app-update.yml from electron-builder).
- **GitHub Pages**: simple landing page linking to “Latest Release” and install instructions.

### Build & publish (CI)
- Trigger: tag push (e.g., `v0.1.0`).
- Steps:
  1) Install deps, build (electron + react).
  2) Package via electron-builder (Windows).
  3) Code-sign if cert is available (reduces SmartScreen friction).
  4) Upload artifacts to GitHub Releases.
  5) Upload update metadata (latest.yml/app-update.yml) for `electron-updater`.

### Auto-update in app (electron-updater)
- In production builds, call `autoUpdater.checkForUpdatesAndNotify()` on startup (and optionally on an interval).
- Electron app checks GitHub Releases for update metadata; downloads and prompts to install.
- Provide a minimal UI indicator: “Update available / Downloading / Ready to install.”

### Versioning & channels
- Semver tags: `v0.1.0`, `v0.1.1`, etc.
- Optional beta channel: publish beta-tagged releases; beta builds point to beta feed.

### Install experience
- Windows: signed NSIS installer preferred; portable ZIP as fallback.
- Provide checksums in the Release assets.
- Document data location (app data dir) and that updates are non-destructive.

### Safety & migrations
- Keep user data in app data dir; app updates should not overwrite user data.
- If schema/config migrations are needed, gate by version and make them idempotent.

### Landing page (GitHub Pages)
- Link to latest GitHub Release asset.
- Quick install steps (Windows).
- “What’s new” (link to release notes).
- Basic troubleshooting (SmartScreen note, data location, auto-update behavior).

### Next steps
- Add GitHub Actions workflow to build/sign/publish on tag.
- Wire `autoUpdater` in `electron/main.ts` for prod builds with minimal status UI.
- Add a landing page (or README section) linking to latest Release.
