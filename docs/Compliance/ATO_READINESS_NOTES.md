## InsightLM‑LT ATO Readiness Notes (Demo Draft)

**Purpose**: This is a lightweight, demo-ready writeup of how InsightLM‑LT aligns to typical federal security expectations (NIST / FedRAMP OnRAMP) and what gaps remain before pursuing an ATO for CUI workloads.

**Scope note (important)**: FedRAMP authorizes **cloud services**. InsightLM‑LT is a **desktop application**; if/when it uses a cloud LLM (Azure GCC High), the cloud endpoint and surrounding platform controls are where **FedRAMP inheritance** comes from. The desktop app still matters for ATO as an endpoint/system component (data handling, boundary controls, update integrity, etc.).

---

## 1) Executive summary (for demo)

InsightLM‑LT is a **local-first desktop app** designed to keep work products on the endpoint while enabling AI assistance. For ATO/CUI use, the codebase already shows a strong separation between the renderer UI and privileged operations, and we have a clear hardening path to support either **Azure GCC High** LLM access or a fully **offline “skiff”** deployment.

**High-level status**

- **Strong foundation (today)**: renderer is hardened (Node disabled + context isolation), and there is deterministic enforcement of a project/workbook data boundary for file operations.
- **Not ATO-ready for CUI (today)**: missing CSP and sandbox hardening, navigation controls are too permissive, IPC surface is too powerful (including extension/server controls), and CUI-at-rest is plaintext by default.
- **ATO path (next)**: add “CUI mode” controls (minimize retention + encrypt at rest + redaction), lock down navigation/CSP/sandbox, constrain IPC and extension execution, and deploy LLM either via allowlisted **Azure GCC High** endpoints or fully offline.

---

## 2) Deployment modes we expect (and how they affect ATO posture)

### Mode A: Offline / “Skiff” (no external egress)

**Goal**: keep CUI fully on the enclave device/network.

- LLM calls route to **local model runtime** (e.g., an on-device service) with `baseUrl` pointing to `localhost`/in-enclave.
- Main ATO risk shifts toward endpoint hardening, local persistence security, and restricting process/tool execution.

### Mode B: Azure GCC High LLM

**Goal**: allow controlled egress of user prompts/content to a government cloud endpoint.

- Egress must be **allowlisted** and documented.
- Identity/access will typically be enterprise-controlled (SSO, conditional access).
- Provider data-handling guarantees (retention/training/access) must be documented and matched to the program’s CUI policy.

---

## 3) Standards/specifications commonly required (ATO + FedRAMP OnRAMP context)

This is a practical list of “what the review will ask for” when CUI is in scope.

- **RMF / ATO process**: NIST SP **800-37** (Risk Management Framework)
- **Categorization**: **FIPS 199** (impact level) and **FIPS 200** (minimum security requirements)
- **Security controls**: NIST SP **800-53 Rev. 5** (FedRAMP baselines align to this; CUI typically implies **Moderate**)
- **Assessment procedures**: NIST SP **800-53A**
- **Risk assessment guidance**: NIST SP **800-30**
- **CUI handling baseline (often required or mapped)**: NIST SP **800-171**
- **Cryptography expectations**: **FIPS 140-3** validated crypto (where applicable) + strong TLS config
- **Secure development & supply chain**: NIST SP **800-218** (SSDF) + SBOM + vulnerability remediation evidence
- **Hardening guidance**: DISA **STIGs** and org endpoint baselines (Windows endpoints, browser/Chromium guidance as applicable)

**FedRAMP OnRAMP note**: OnRAMP is about getting a **cloud service** “FedRAMP In Process.” For InsightLM‑LT, that matters most for the **Azure GCC High** LLM/API tier and any cloud services used for updates/telemetry—while the desktop app remains an ATO-relevant component within the overall system boundary.

---

## 4) Repo-specific technical observations (evidence pointers)

### 4.1 Renderer hardening: Node disabled + context isolation enabled (good baseline)

In `electron/main.ts`, the main BrowserWindow is created with:

- `contextIsolation: true`
- `nodeIntegration: false`

This is a strong baseline for Electron ATO reviews because it prevents arbitrary renderer content from directly invoking Node APIs.

### 4.2 File access boundary enforcement (strong, deterministic)

The backend file service enforces a workbook-scoped path boundary:

- Rejects absolute paths
- Rejects path traversal (`..`)
- Best-effort prevention of symlink escape

This is the kind of deterministic control that supports a credible “data boundary” story for ATO.

### 4.3 Local persistence (CUI risk if not constrained)

By design, InsightLM‑LT is local-first and stores work products under the configured `dataDir` (default `%APPDATA%/insightLM‑LT`). Workbooks and chats persist to disk. For CUI, this becomes an explicit risk area unless the design adds:

- retention controls (what is stored, for how long)
- encryption-at-rest / OS-backed keystore usage
- redaction and logging controls

### 4.4 LLM egress (must be constrained for CUI)

The current implementation supports multiple providers and uses public endpoints for OpenAI/Anthropic today. For a GCC High story, this must shift to the authorized endpoint configuration, strict egress allowlisting, and documented provider data handling/retention rules.

---

## 5) Risk-ranked gaps (POA&M-style, demo-friendly)

These are the key deltas between “good demo security posture” and “ATO-ready for CUI.”

### High

- **Missing CSP (Content Security Policy)**: CSP reduces risk of script injection and limits what the renderer can execute/load. Without CSP, a renderer compromise can pivot into powerful IPC calls.
- **Navigation is too permissive**: Electron apps should be deny-by-default for navigation and new-window behavior; allowlist only what’s required.
- **Sandbox not enabled**: Electron sandboxing is commonly expected in hardened builds.
- **IPC/extension controls are too powerful**: the renderer can invoke privileged actions (file ops, MCP calls, debug tool execution). Extension/server management is particularly sensitive because it can lead to arbitrary process execution if not tightly controlled.
- **CUI-at-rest plaintext**: chats/workbooks/config stored on disk without an explicit CUI mode (encryption, minimization, retention).

### Medium

- **Logging/audit not ATO-grade**: need an explicit audit event taxonomy, protection of logs, and redaction to avoid leaking CUI/secrets.
- **Updates/supply-chain evidence incomplete**: need signing story, update channel controls, SBOM + scanning + patch SLA evidence.

---

## 6) Recommended “path to ATO” milestones (what we would do next)

This is intentionally phrased as “plan,” not as completed work.

1) **Define the authorization boundary and data flows**
   - Desktop app components, local persistence, extension/tool subprocesses
   - Azure GCC High LLM endpoint (Mode B) and/or local model runtime (Mode A)
   - Update/telemetry endpoints (if any)

2) **Introduce a CUI mode**
   - data minimization, retention controls, export controls
   - encryption at rest for persisted chats/docs/config where required
   - explicit “no cloud egress” mode for skiff deployments

3) **Harden Electron surfaces**
   - CSP
   - sandboxing
   - deny-by-default navigation and window creation with explicit allowlists
   - reduce and schema-validate IPC surface; tighten extension/server execution boundaries

4) **Supply chain and update integrity**
   - signed builds
   - controlled update mechanism
   - SBOM + SCA gating + remediation SLA evidence

5) **Audit/logging posture**
   - define audit events, redaction policies, and protected storage/retention

---

## 7) Slide-ready bullets (copy/paste)

- **Good today**: renderer hardened (no Node + context isolation) and deterministic file boundary enforcement.
- **Not ATO-ready (CUI)**: missing CSP/sandbox, permissive navigation, powerful IPC/extension execution, plaintext local persistence.
- **Path forward**: add “CUI mode” + tighten Electron controls + restrict IPC + deploy via Azure GCC High or fully offline skiff.

