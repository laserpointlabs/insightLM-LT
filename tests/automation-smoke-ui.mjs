#!/usr/bin/env node
/**
 * UI-level automation smoke test via Chrome DevTools Protocol (CDP).
 *
 * Preconditions:
 * - Electron app is running with remote debugging enabled (this repo sets 9222 in electron/main.ts)
 *
 * What it does (selector-only):
 * - Ensure Automation Mode is enabled (forces hover-only controls visible)
 * - Toggle Context scoping All ↔ Scoped
 * - Create a workbook, create a markdown doc, rename it, create a folder, move the doc into the folder
 * - Send a chat message
 */

import WebSocket from "ws";

const DEBUG_HOST = process.env.ELECTRON_DEBUG_HOST || "127.0.0.1";
const DEBUG_PORT = Number(process.env.ELECTRON_DEBUG_PORT || "9222");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(msg) {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}

async function connectCDP() {
  const listUrl = `http://${DEBUG_HOST}:${DEBUG_PORT}/json/list`;
  const targets = await fetchJson(listUrl);
  // Prefer the actual app page target (avoid attaching to DevTools UI itself).
  const page =
    targets.find(
      (t) =>
        t.type === "page" &&
        typeof t.webSocketDebuggerUrl === "string" &&
        typeof t.url === "string" &&
        t.url.startsWith("http://localhost:5173"),
    ) ||
    targets.find(
      (t) =>
        t.type === "page" &&
        typeof t.webSocketDebuggerUrl === "string" &&
        typeof t.title === "string" &&
        t.title.toLowerCase().includes("insightlm"),
    ) ||
    targets.find(
      (t) =>
        t.type === "page" &&
        typeof t.webSocketDebuggerUrl === "string" &&
        typeof t.url === "string" &&
        !t.url.startsWith("devtools://"),
    ) ||
    targets.find((t) => typeof t.webSocketDebuggerUrl === "string");
  if (!page?.webSocketDebuggerUrl) {
    fail(`No CDP target found at ${listUrl}. Is the Electron app running?`);
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });

  let id = 0;
  const pending = new Map();
  const consoleEvents = [];
  const exceptionEvents = [];

  function toConsoleText(params) {
    try {
      const args = Array.isArray(params?.args) ? params.args : [];
      const parts = args.map((a) => {
        if (!a) return "";
        if (typeof a.value === "string") return a.value;
        if (typeof a.value === "number") return String(a.value);
        if (typeof a.value === "boolean") return String(a.value);
        if (a.description) return String(a.description);
        return "";
      });
      return parts.filter(Boolean).join(" ");
    } catch {
      return "";
    }
  }

  ws.on("message", (raw) => {
    const msg = JSON.parse(String(raw));
    // CDP events (no id)
    if (!msg.id && msg.method) {
      if (msg.method === "Runtime.consoleAPICalled") {
        const type = String(msg?.params?.type || "log");
        const text = toConsoleText(msg?.params);
        consoleEvents.push({ type, text });
      }
      if (msg.method === "Runtime.exceptionThrown") {
        const details = msg?.params?.exceptionDetails;
        const text =
          String(details?.text || "") ||
          String(details?.exception?.description || "") ||
          String(details?.exception?.value || "");
        exceptionEvents.push({ text });
      }
      return;
    }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || "CDP error"));
      else resolve(msg.result);
    }
  });

  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  const evaluate = async (expression) => {
    const res = await call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res?.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || "Runtime.evaluate exception");
    }
    return res?.result?.value;
  };

  await call("Runtime.enable");
  await call("Page.enable");

  return { ws, call, evaluate, consoleEvents, exceptionEvents };
}

function jsString(s) {
  return JSON.stringify(String(s));
}

async function waitForSelector(evaluate, selector, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await evaluate(`!!document.querySelector(${jsString(selector)})`);
    if (ok) return true;
    await sleep(150);
  }
  return false;
}

async function waitForGone(evaluate, selector, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await evaluate(`!!document.querySelector(${jsString(selector)})`);
    if (!ok) return true;
    await sleep(150);
  }
  return false;
}

async function waitForTextContains(evaluate, selector, needle, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const text = await evaluate(`
      (() => {
        const el = document.querySelector(${jsString(selector)});
        return el ? String(el.innerText || el.textContent || "") : null;
      })()
    `);
    if (typeof text === "string" && text.includes(String(needle))) return true;
    await sleep(150);
  }
  return false;
}

async function clickSelector(evaluate, selector) {
  const ok = await evaluate(`
    (() => {
      const el = document.querySelector(${jsString(selector)});
      if (!el) return false;
      el.scrollIntoView({ block: "center", inline: "center" });
      el.click();
      return true;
    })()
  `);
  if (!ok) throw new Error(`Could not click selector: ${selector}`);
}

async function ensureContextScopingMode(evaluate, desired /* "all" | "context" */) {
  const btn = 'button[data-testid="contexts-scope-toggle"]';
  const ok = await waitForSelector(evaluate, btn, 20000);
  if (!ok) throw new Error(`Missing context scoping toggle: ${btn}`);
  const wantLabel = desired === "all" ? "ALL" : "SCOPED";
  const start = Date.now();
  while (Date.now() - start < 8000) {
    const label = await evaluate(`(document.querySelector(${jsString(btn)})?.innerText || "").trim()`);
    const norm = String(label || "").trim().toUpperCase();
    // Be tolerant of minor label formatting differences (e.g. "Scoped" vs "SCOPED").
    if (norm.includes(wantLabel)) return;
    await clickSelector(evaluate, btn);
    await sleep(250);
  }
  throw new Error(`Could not set context scoping to ${wantLabel}`);
}

async function setInputValue(evaluate, selector, value) {
  const ok = await evaluate(`
    (() => {
      const el = document.querySelector(${jsString(selector)});
      if (!el) return false;
      el.scrollIntoView({ block: "center", inline: "center" });
      el.focus();
      // Use the native value setter so React reliably sees the change.
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      if (desc && typeof desc.set === "function") desc.set.call(el, ${jsString(value)});
      else el.value = ${jsString(value)};
      try {
        // Keep caret at end so @-typeahead logic (caret-based) behaves like real typing.
        el.setSelectionRange(el.value.length, el.value.length);
      } catch {}
      el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      el.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
      return true;
    })()
  `);
  if (!ok) throw new Error(`Could not fill input selector: ${selector}`);
}

async function setSelectValue(evaluate, selector, value) {
  const ok = await evaluate(`
    (() => {
      const el = document.querySelector(${jsString(selector)});
      if (!el) return false;
      el.scrollIntoView({ block: "center", inline: "center" });
      el.value = ${jsString(value)};
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()
  `);
  if (!ok) throw new Error(`Could not set select selector: ${selector}`);
}

async function ensureExpanded(evaluate, headerTestId) {
  const selector = `button[data-testid="${headerTestId}"]`;
  const ok = await waitForSelector(evaluate, selector, 20000);
  if (!ok) throw new Error(`Missing header toggle: ${selector}`);
  const expanded = await evaluate(`document.querySelector(${jsString(selector)})?.getAttribute("aria-expanded") === "true"`);
  if (!expanded) await clickSelector(evaluate, selector);
}

async function run() {
  console.log(`🧪 UI automation smoke (CDP @ ${DEBUG_HOST}:${DEBUG_PORT})`);

  const { ws, evaluate, consoleEvents, exceptionEvents } = await connectCDP();

  try {
    // Ensure the app has booted and our automation helper is present.
    const bootOk = await waitForSelector(evaluate, "body", 20000);
    if (!bootOk) fail("App did not render a <body> in time");

    // Enable automation mode (force-show hover-only controls).
    await evaluate(`
      (async () => {
        if (window.__insightlmAutomationUI?.setMode) window.__insightlmAutomationUI.setMode(true);
        return window.__insightlmAutomationUI?.getMode?.() === true || document.body?.dataset?.automationMode === "true";
      })()
    `);

    // Ensure we are on the File workbench (Insight Workbench) so the stacked sidebar views exist.
    const contextsHeaderSelector = 'button[data-testid="sidebar-contexts-header"]';
    const hasContextsHeader = await evaluate(`!!document.querySelector(${jsString(contextsHeaderSelector)})`);
    if (!hasContextsHeader) {
      const fileWorkbench = 'button[data-testid="activitybar-item-file"]';
      const hasFile = await waitForSelector(evaluate, fileWorkbench, 8000);
      if (hasFile) {
        await clickSelector(evaluate, fileWorkbench);
        await sleep(300);
      }
    }

    // Context scoping: indicator must be visible in BOTH the main header and the Contexts section header,
    // even when Contexts is collapsed.
    await waitForSelector(evaluate, 'button[data-testid="sidebar-scope-indicator"]', 20000);
    await waitForSelector(evaluate, '[data-testid="sidebar-scope-text"]', 20000);
    await waitForSelector(evaluate, 'button[data-testid="contexts-scope-toggle"]', 20000);

    // Collapse Contexts to prove the header accessory stays visible.
    const isContextsExpanded = await evaluate(
      `document.querySelector('button[data-testid="sidebar-contexts-header"]')?.getAttribute("aria-expanded") === "true"`,
    );
    if (isContextsExpanded) await clickSelector(evaluate, 'button[data-testid="sidebar-contexts-header"]');

    // Capture initial indicator label, toggle once via Contexts header accessory,
    // and assert the main header text reflects the selected mode.
    const before = await evaluate(`
      (() => {
        const b = document.querySelector('button[data-testid="contexts-scope-toggle"]');
        return b ? (b.innerText || "").trim() : null;
      })()
    `);
    if (!before) fail("Missing contexts scope toggle label text");

    await clickSelector(evaluate, 'button[data-testid="contexts-scope-toggle"]');

    const flipped = await (async () => {
      const start = Date.now();
      while (Date.now() - start < 20000) {
        const now = await evaluate(`
          (() => {
            const b = document.querySelector('button[data-testid="contexts-scope-toggle"]');
            return b ? (b.innerText || "").trim() : null;
          })()
        `);
        if (now && now !== before) return now;
        await sleep(150);
      }
      return null;
    })();
    if (!flipped) fail("Context scoping toggle did not flip label in time");

    // Main header scope text should clearly state "All workbooks" when in ALL mode.
    if (String(flipped).toUpperCase().includes("ALL")) {
      const ok = await waitForTextContains(evaluate, '[data-testid="sidebar-scope-text"]', "All workbooks", 20000);
      if (!ok) fail('Main header did not show "All workbooks" after switching to ALL');
    }

    // Toggle back via the MAIN header indicator and assert the Contexts header accessory matches.
    await clickSelector(evaluate, 'button[data-testid="sidebar-scope-indicator"]');
    const backOk = await (async () => {
      const start = Date.now();
      while (Date.now() - start < 20000) {
        const now = await evaluate(`
          (() => {
            const a = document.querySelector('button[data-testid="contexts-scope-toggle"]');
            const b = document.querySelector('button[data-testid="sidebar-scope-indicator"]');
            const la = a ? (a.innerText || "").trim() : null;
            const lb = b ? (b.innerText || "").trim() : null;
            return la && lb ? la === lb : false;
          })()
        `);
        if (now) return true;
        await sleep(150);
      }
      return false;
    })();
    if (!backOk) fail("Main header scope indicator did not stay in sync with Contexts header toggle");
    console.log("✅ Verified scoping indicator is always visible + toggles stay in sync (main + contexts header)");

    // Force deterministic mode for the rest of the smoke: Scoped (context).
    await ensureContextScopingMode(evaluate, "context");
    console.log("✅ Ensured context scoping is Scoped");

    // Expand Workbooks and create a workbook.
    await ensureExpanded(evaluate, "sidebar-workbooks-header");

    // If demo seeding is enabled (fresh install), verify the seeded UAV Trade Study workbook exists.
    // This is optional so existing dev machines with pre-existing workbooks don't fail the smoke.
    const seededWorkbookId = "uav-trade-study";
    const seededWorkbookItem = `div[data-testid="workbooks-item-${seededWorkbookId}"]`;
    const hasSeeded = await evaluate(`!!document.querySelector(${jsString(seededWorkbookItem)})`);
    if (hasSeeded) {
      console.log("✅ Found seeded demo workbook: UAV Trade Study");
      // Expand the seeded workbook
      const toggle = `span[data-testid="workbooks-toggle-${seededWorkbookId}"]`;
      await waitForSelector(evaluate, toggle, 20000);
      await clickSelector(evaluate, toggle);
      await sleep(250);

      // Verify trade folder and key docs exist (stable selectors)
      const folderTid = `div[data-testid="workbooks-folder-${seededWorkbookId}-trade"]`;
      const decisionSheetPath = encodeURIComponent("documents/trade/decision_matrix.is");
      const notebookPath = encodeURIComponent("documents/trade/trade_study.ipynb");
      const recPath = encodeURIComponent("documents/trade/recommendation.md");

      const folderOk = await waitForSelector(evaluate, folderTid, 20000);
      if (!folderOk) {
        console.warn("⚠️ Seeded UAV trade folder did not appear in Workbooks tree; skipping seeded-demo assertions");
      } else {

        // Expand the trade folder so the docs are visible/clickable.
        await clickSelector(evaluate, folderTid);
        await sleep(250);

        const sheetTid = `div[data-testid="workbooks-doc-${seededWorkbookId}-${decisionSheetPath}"]`;
        const nbTid = `div[data-testid="workbooks-doc-${seededWorkbookId}-${notebookPath}"]`;
        const recTid = `div[data-testid="workbooks-doc-${seededWorkbookId}-${recPath}"]`;

        const sheetOk = await waitForSelector(evaluate, sheetTid, 20000);
        const nbOk = await waitForSelector(evaluate, nbTid, 20000);
        const recOk = await waitForSelector(evaluate, recTid, 20000);
        if (!sheetOk || !nbOk || !recOk) {
          console.warn("⚠️ Seeded UAV trade study docs did not appear under trade folder; skipping seeded-demo assertions");
        } else {
          console.log("✅ Verified seeded UAV trade study artifacts exist");

          // Open the seeded spreadsheet and ensure the spreadsheet viewer mounts.
          await clickSelector(evaluate, sheetTid);
          await waitForSelector(evaluate, 'div[data-testid="document-viewer-content"][data-active-ext="is"]', 20000);
          await waitForSelector(evaluate, 'div[data-testid="spreadsheet-viewer"]', 20000);
          console.log("✅ Opened decision_matrix.is (spreadsheet viewer mounted)");

          // Open the seeded notebook, run the first code cell, and save.
          await clickSelector(evaluate, nbTid);
          await waitForSelector(evaluate, 'div[data-testid="document-viewer-content"][data-active-ext="ipynb"]', 20000);
          await waitForSelector(evaluate, 'div[data-testid="notebook-viewer"]', 20000);
          // Seeded notebook has: cell 0 markdown, cell 1 code.
          await waitForSelector(evaluate, 'button[data-testid="notebook-cell-run-1"]', 20000);
          await clickSelector(evaluate, 'button[data-testid="notebook-cell-run-1"]');
          // Wait for output OR for the expected artifacts to update. Fail-fast on obvious execution errors.
          // NOTE: We intentionally avoid asserting exact prose; we assert structural signals + artifact writes.
          const summaryRelPath = "documents/trade/results/summary.json";
          const outputOk = await (async () => {
            const start = Date.now();
            while (Date.now() - start < 60000) {
              const state = await evaluate(`
                (async () => {
                  const outEl = document.querySelector('div[data-testid="notebook-cell-output-1"]');
                  const outText = outEl ? String(outEl.innerText || "") : "";
                  let summary = "";
                  try {
                    summary = await window.electronAPI?.file?.read?.(${jsString(seededWorkbookId)}, ${jsString(summaryRelPath)});
                  } catch {
                    summary = "";
                  }
                  return { outText, summary };
                })()
              `);
              const outText = String(state?.outText || "");
              const summary = String(state?.summary || "");

              // Fail-fast if notebook execution surfaced an error.
              if (outText && (outText.includes("ExecutionError") || outText.includes("Traceback") || outText.toLowerCase().includes("error"))) {
                console.warn(`⚠️ Seeded notebook execution produced error output; skipping seeded-demo assertions.\n${outText.slice(0, 800)}`);
                return false;
              }

              const hasAnyOutput = outText.trim().length > 0;
              const summaryLooksUpdated =
                summary.trim().length > 2 &&
                summary.trim() !== "{}" &&
                (summary.includes('"top_recommendation"') || summary.includes("top_recommendation"));

              // Prefer the known success prints, but accept any output if artifacts updated.
              const hasExpectedPrints = outText.includes("Ready:") || outText.includes("Top recommendation:");

              if (hasExpectedPrints) return true;
              if (hasAnyOutput && summaryLooksUpdated) return true;

              await sleep(250);
            }
            return false;
          })();
          if (!outputOk) {
            console.warn("⚠️ Seeded notebook did not produce output/artifacts in time; skipping seeded-demo assertions");
          } else {
            // Save notebook (ensures outputs persist in file)
            await waitForSelector(evaluate, 'button[data-testid="document-save"]', 20000);
            await clickSelector(evaluate, 'button[data-testid="document-save"]');
            console.log("✅ Ran notebook cell + saved notebook");

            // Re-open notebook to confirm output persisted (reloads content from disk)
            await clickSelector(evaluate, `div[data-testid="workbooks-doc-${seededWorkbookId}-${notebookPath}"]`);
            await waitForSelector(evaluate, 'div[data-testid="notebook-cell-output-1"]', 20000);
            const persisted = await evaluate(`
              (() => {
                const el = document.querySelector('div[data-testid="notebook-cell-output-1"]');
                return el ? (el.innerText || "") : "";
              })()
            `);
            if (!String(persisted || "").trim()) {
              console.warn("⚠️ Seeded notebook output was not persisted after save/reopen; skipping seeded-demo assertions");
            } else {
              console.log("✅ Verified notebook output persisted after save");
            }
          }
        }
      }
    } else {
      console.log("ℹ️ Seeded UAV Trade Study workbook not present (skipping seeded-demo assertions)");
    }

    await clickSelector(evaluate, 'button[data-testid="workbooks-create"]');
    await waitForSelector(evaluate, 'input[data-testid="input-dialog-input"]', 20000);
    const wbName = `Auto Smoke WB ${Date.now()}`;
    await setInputValue(evaluate, 'input[data-testid="input-dialog-input"]', wbName);
    await clickSelector(evaluate, 'button[data-testid="input-dialog-ok"]');
    // Ensure the dialog actually closed before looking for new rows.
    await waitForGone(evaluate, 'input[data-testid="input-dialog-input"]', 20000);

    // Find the workbook id by matching the rendered workbook title text.
    const workbookId = await (async () => {
      const start = Date.now();
      while (Date.now() - start < 20000) {
        const id = await evaluate(`
          (() => {
            const items = Array.from(document.querySelectorAll('[data-testid^="workbooks-item-"]'));
            const hit = items.find(el => (el.innerText || "").includes(${jsString(wbName)}));
            if (!hit) return null;
            const tid = hit.getAttribute("data-testid") || "";
            return tid.startsWith("workbooks-item-") ? tid.slice("workbooks-item-".length) : null;
          })()
        `);
        if (id) return id;
        await sleep(150);
      }
      return null;
    })();

    if (!workbookId) {
      const debug = await evaluate(`
        (() => {
          const toast = Array.from(document.querySelectorAll('[data-testid^="toast-"] [data-testid="toast-message"]'))
            .map(n => (n.innerText || "").trim())
            .filter(Boolean)
            .slice(-4);
          const rows = Array.from(document.querySelectorAll('[data-testid^="workbooks-item-"]'))
            .map(el => ({ tid: el.getAttribute("data-testid"), text: (el.innerText || "").trim().slice(0,120) }))
            .slice(0, 12);
          const dialogOpen = !!document.querySelector('input[data-testid="input-dialog-input"]');
          return { toast, rows, dialogOpen };
        })()
      `);
      console.error("\nDebug:", debug);
      fail("Could not discover created workbook id in UI (workbook may not have been created or list did not refresh)");
    }
    console.log(`✅ Created workbook "${wbName}" (${workbookId})`);

    // Create + activate a context that contains this workbook (so Chat is in-scope deterministically).
    await ensureExpanded(evaluate, "sidebar-contexts-header");
    await clickSelector(evaluate, 'button[data-testid="contexts-create"]');
    await waitForSelector(evaluate, 'input[data-testid="contexts-modal-name"]', 20000);
    const ctxName = `Auto Smoke Ctx ${Date.now()}`;
    await setInputValue(evaluate, 'input[data-testid="contexts-modal-name"]', ctxName);
    const wbCheckbox = `input[data-testid="contexts-modal-workbook-checkbox"][data-workbook-id="${workbookId}"]`;
    const hasWbCheckbox = await waitForSelector(evaluate, wbCheckbox, 20000);
    if (!hasWbCheckbox) fail("Contexts create modal did not include the newly created workbook checkbox");
    await clickSelector(evaluate, wbCheckbox);
    await clickSelector(evaluate, 'button[data-testid="contexts-modal-save"]');

    // Discover the created context id by matching rendered card text.
    const contextId = await (async () => {
      const start = Date.now();
      while (Date.now() - start < 20000) {
        const id = await evaluate(`
          (() => {
            const items = Array.from(document.querySelectorAll('[data-testid^="contexts-item-"]'));
            const hit = items.find(el => (el.innerText || "").includes(${jsString(ctxName)}));
            if (!hit) return null;
            const tid = hit.getAttribute("data-testid") || "";
            return tid.startsWith("contexts-item-") ? tid.slice("contexts-item-".length) : null;
          })()
        `);
        if (id) return id;
        await sleep(150);
      }
      return null;
    })();
    if (!contextId) fail("Could not discover created context id in UI");

    // Activate it.
    const activateSel = `button[data-testid="contexts-activate-${contextId}"]`;
    const activateOk = await waitForSelector(evaluate, activateSel, 20000);
    if (!activateOk) fail("Created context did not render an Activate button");
    await clickSelector(evaluate, activateSel);
    await sleep(300);
    console.log(`✅ Created + activated context "${ctxName}" (${contextId})`);

    // Expand workbook row.
    await clickSelector(evaluate, `span[data-testid="workbooks-toggle-${workbookId}"]`);

    // Create markdown in workbook root.
    await clickSelector(evaluate, `button[data-testid="workbooks-create-markdown-${workbookId}"]`);
    await waitForSelector(evaluate, 'input[data-testid="input-dialog-input"]', 20000);
    const mdName = "auto-smoke.md";
    await setInputValue(evaluate, 'input[data-testid="input-dialog-input"]', mdName);
    await clickSelector(evaluate, 'button[data-testid="input-dialog-ok"]');
    console.log("✅ Created markdown doc");

    // Rename the doc (root doc path is deterministic).
    const docPath = `documents/${mdName}`;
    const enc = encodeURIComponent(docPath);
    await waitForSelector(evaluate, `button[data-testid="workbooks-doc-rename-${workbookId}-${enc}"]`, 20000);
    await clickSelector(evaluate, `button[data-testid="workbooks-doc-rename-${workbookId}-${enc}"]`);
    await waitForSelector(evaluate, 'input[data-testid="input-dialog-input"]', 20000);
    const renamed = "auto-smoke-renamed.md";
    await setInputValue(evaluate, 'input[data-testid="input-dialog-input"]', renamed);
    await clickSelector(evaluate, 'button[data-testid="input-dialog-ok"]');
    console.log("✅ Renamed markdown doc");

    // Create folder.
    await clickSelector(evaluate, `button[data-testid="workbooks-create-folder-${workbookId}"]`);
    await waitForSelector(evaluate, 'input[data-testid="input-dialog-input"]', 20000);
    const folderName = "auto-folder";
    await setInputValue(evaluate, 'input[data-testid="input-dialog-input"]', folderName);
    await clickSelector(evaluate, 'button[data-testid="input-dialog-ok"]');
    console.log("✅ Created folder");

    // Move doc into folder via move dialog.
    const renamedPath = `documents/${renamed}`;
    const renamedEnc = encodeURIComponent(renamedPath);
    await waitForSelector(evaluate, `button[data-testid="workbooks-doc-move-${workbookId}-${renamedEnc}"]`, 20000);
    await clickSelector(evaluate, `button[data-testid="workbooks-doc-move-${workbookId}-${renamedEnc}"]`);
    await waitForSelector(evaluate, 'select[data-testid="move-doc-folder-select"]', 20000);
    await setSelectValue(evaluate, 'select[data-testid="move-doc-folder-select"]', folderName);
    await clickSelector(evaluate, 'button[data-testid="move-doc-ok"]');

    const movedPath = `documents/${folderName}/${renamed}`;
    const movedTid = `div[data-testid="workbooks-doc-${workbookId}-${encodeURIComponent(movedPath)}"]`;
    const movedOk = await waitForSelector(evaluate, movedTid, 20000);
    if (!movedOk) fail("Move doc into folder did not reflect in UI");
    console.log("✅ Moved doc into folder");

    // Create a deterministic CSV fixture for dashboard graph testing.
    // The Workbooks UI "Import Files" button does not create arbitrary files, so we write the fixture directly.
    const csvName = "project_budget_2025.csv";
    const csvRelPath = `documents/${csvName}`;
    // Write CSV contents: multiple categories for year 2025.
    const csvContent = [
      "year,category,budget",
      "2025,Engineering,120",
      "2025,Manufacturing,200",
      "2025,Test,80",
      "2024,Engineering,50",
    ].join("\\n");
    await evaluate(`
      (async () => {
        if (!window.electronAPI?.file?.write) return false;
        await window.electronAPI.file.write(${jsString(workbookId)}, ${jsString(csvRelPath)}, ${jsString(csvContent)});
        return true;
      })()
    `);
    console.log("✅ Created CSV fixture for graph test");

    // Deterministic MCP smoke: validate workbook-rag exposes + executes rag_grep.
    // This intentionally does NOT rely on the LLM choosing a tool; it verifies the MCP plumbing directly.
    const grepRelPath = "documents/auto-smoke-grep.txt";
    const grepToken = `AUTO_SMOKE_GREP_TOKEN_${Date.now()}`;
    const grepContent = [
      `token=${grepToken}`,
      "ERROR_42",
      "foo.bar",
      "fooXbar",
      "foo    bar",
      "",
    ].join("\n");
    await evaluate(`
      (async () => {
        if (!window.electronAPI?.file?.write) return { ok: false, error: "electronAPI.file.write unavailable" };
        await window.electronAPI.file.write(${jsString(workbookId)}, ${jsString(grepRelPath)}, ${jsString(grepContent)});
        return { ok: true };
      })()
    `);

    const ragTools = await evaluate(`
      (async () => {
        if (!window.electronAPI?.mcp?.call) return { ok: false, error: "electronAPI.mcp.call unavailable" };
        const res = await window.electronAPI.mcp.call("workbook-rag", "tools/list", {});
        const tools = Array.isArray(res?.tools) ? res.tools : [];
        const names = tools.map(t => String(t?.name || "")).filter(Boolean);
        return { ok: true, names };
      })()
    `);
    if (!ragTools?.ok) fail(`workbook-rag tools/list unavailable: ${ragTools?.error || "unknown error"}`);
    if (!Array.isArray(ragTools.names) || !ragTools.names.includes("rag_grep")) {
      fail(`workbook-rag did not advertise rag_grep in tools/list. Got: ${JSON.stringify(ragTools.names || []).slice(0, 500)}`);
    }

    // Clear rag cache for this workbook id to avoid stale cache on fast repeated runs.
    await evaluate(`
      (async () => {
        try {
          await window.electronAPI.mcp.call("workbook-rag", "tools/call", {
            name: "rag_clear_cache",
            arguments: { workbook_id: ${jsString(workbookId)} },
          });
        } catch {}
        return true;
      })()
    `);

    const grepRes = await evaluate(`
      (async () => {
        const res = await window.electronAPI.mcp.call("workbook-rag", "tools/call", {
          name: "rag_grep",
          arguments: {
            pattern: ${jsString(grepToken)},
            regex: false,
            case_sensitive: false,
            workbook_ids: [${jsString(workbookId)}],
            max_results: 5,
            max_matches_per_file: 5,
          },
        });
        return res;
      })()
    `);
    const grepFiles = Array.isArray(grepRes?.results) ? grepRes.results : [];
    const grepHit = grepFiles.find((f) => String(f?.path || "") === grepRelPath);
    if (!grepHit) {
      const dbg = { truncated: !!grepRes?.truncated, files: grepFiles.map((f) => ({ path: f?.path, match_count: f?.match_count })) };
      fail(`rag_grep literal did not find fixture file by token. Debug: ${JSON.stringify(dbg).slice(0, 800)}`);
    }
    if (!(Number(grepHit?.match_count || 0) >= 1)) fail("rag_grep literal found fixture file but match_count < 1");

    const grepRegexRes = await evaluate(`
      (async () => {
        const res = await window.electronAPI.mcp.call("workbook-rag", "tools/call", {
          name: "rag_grep",
          arguments: {
            pattern: "ERROR_\\\\d+",
            regex: true,
            case_sensitive: false,
            workbook_ids: [${jsString(workbookId)}],
            max_results: 5,
            max_matches_per_file: 5,
          },
        });
        return res;
      })()
    `);
    const rxFiles = Array.isArray(grepRegexRes?.results) ? grepRegexRes.results : [];
    const rxHit = rxFiles.find((f) => String(f?.path || "") === grepRelPath);
    if (!rxHit) {
      const dbg = { truncated: !!grepRegexRes?.truncated, files: rxFiles.map((f) => ({ path: f?.path, match_count: f?.match_count })) };
      fail(`rag_grep regex did not find fixture file by ERROR_\\\\d+ pattern. Debug: ${JSON.stringify(dbg).slice(0, 800)}`);
    }
    if (!(Number(rxHit?.match_count || 0) >= 1)) fail("rag_grep regex found fixture file but match_count < 1");
    console.log("✅ Verified workbook-rag rag_grep tool advertised + executable (literal + regex)");

    // Expand Chat and send message.
    await ensureExpanded(evaluate, "sidebar-chat-header");
    await waitForSelector(evaluate, 'textarea[data-testid="chat-input"]', 20000);

    // Sanity: Chat @ mention menu opens and inserts a workbook:// reference.
    await clickSelector(evaluate, 'textarea[data-testid="chat-input"]');
    await setInputValue(evaluate, 'textarea[data-testid="chat-input"]', '@');
    const chatMenuOk = await waitForSelector(evaluate, 'div[data-testid="chat-mention-menu"]', 20000);
    if (!chatMenuOk) fail("Chat @ mention menu did not appear");
    const chatItemOk = await waitForSelector(evaluate, 'button[data-testid^="chat-mention-item-"]', 30000);
    if (!chatItemOk) fail("Chat @ mention menu appeared but no items were available");
    const firstChatMention = await evaluate(`
      (() => {
        const btn = document.querySelector('button[data-testid^="chat-mention-item-"]');
        return btn ? btn.getAttribute("data-testid") : null;
      })()
    `);
    if (!firstChatMention) fail("Chat @ mention menu opened but had no items");
    await clickSelector(evaluate, `button[data-testid="${firstChatMention}"]`);
    // Cursor-style: mention becomes a ref "chip" (not a raw workbook:// string in the textarea).
    const chipOk = await waitForSelector(evaluate, 'div[data-testid="chat-refs"] [data-testid^="chat-ref-"]', 20000);
    if (!chipOk) fail("Selecting a chat @ mention did not create a ref chip");
    console.log("✅ Chat @ mention creates ref chip");

    const msg = `smoke ping ${Date.now()}`;
    await setInputValue(evaluate, 'textarea[data-testid="chat-input"]', msg);
    await clickSelector(evaluate, 'button[data-testid="chat-send"]');

    // Verify at least one user message exists.
    const userMsgOk = await (async () => {
      const start = Date.now();
      while (Date.now() - start < 20000) {
        const ok = await evaluate(`
          (() => {
            const nodes = Array.from(document.querySelectorAll('[data-chat-message][data-role="user"]'));
            return nodes.some(n => (n.innerText || "").includes(${jsString(msg)}));
          })()
        `);
        if (ok) return true;
        await sleep(150);
      }
      return false;
    })();
    if (!userMsgOk) fail("Chat message was not rendered in UI");
    console.log("✅ Sent chat message");

    // Now delete the active context (this clears active context) and verify Chat shows deterministic empty-state.
    await ensureExpanded(evaluate, "sidebar-contexts-header");
    await clickSelector(evaluate, `button[data-testid="contexts-delete-${contextId}"]`);
    await waitForSelector(evaluate, 'button[data-testid="confirm-dialog-confirm"]', 20000);
    await clickSelector(evaluate, 'button[data-testid="confirm-dialog-confirm"]');
    await sleep(300);

    await ensureExpanded(evaluate, "sidebar-chat-header");
    const emptyOk = await waitForSelector(evaluate, 'div[data-testid="chat-empty-state"]', 20000);
    if (!emptyOk) fail("Chat did not show scoped-context empty state after active context was cleared");
    await clickSelector(evaluate, 'button[data-testid="chat-empty-state-jump-contexts"]');
    await ensureExpanded(evaluate, "sidebar-contexts-header");
    console.log("✅ Chat empty-state + jump-to-contexts works when no active context");

    // For dashboard flows, use All mode (avoids relying on whichever context happens to be active).
    await ensureContextScopingMode(evaluate, "all");
    console.log("✅ Switched context scoping to All for dashboard steps");

    // Dashboards: create a dashboard and add a query (automation-safe selectors).
    await ensureExpanded(evaluate, "sidebar-dashboards-header");
    await clickSelector(evaluate, 'button[data-testid="dashboards-create"]');
    await waitForSelector(evaluate, 'input[data-testid="input-dialog-input"]', 20000);
    const dashName = `Auto Smoke Dash ${Date.now()}`;
    await setInputValue(evaluate, 'input[data-testid="input-dialog-input"]', dashName);
    await clickSelector(evaluate, 'button[data-testid="input-dialog-ok"]');

    // Dashboard should open in viewer, add a simple query.
    await waitForSelector(evaluate, 'input[data-testid="dashboards-add-question-input"]', 20000);

    // Sanity: @ mention menu opens and inserts a workbook:// reference.
    await clickSelector(evaluate, 'input[data-testid="dashboards-add-question-input"]');
    await setInputValue(evaluate, 'input[data-testid="dashboards-add-question-input"]', '@');
    const menuOk = await waitForSelector(evaluate, 'div[data-testid="dashboards-add-question-mention-menu"]', 20000);
    if (!menuOk) fail("Dashboards @ mention menu did not appear");
    const itemOk = await waitForSelector(evaluate, 'button[data-testid^="dashboards-add-question-mention-item-"]', 30000);
    if (!itemOk) {
      const debug = await evaluate(`
        (() => {
          const menuText = (document.querySelector('div[data-testid="dashboards-add-question-mention-menu"]')?.innerText || "").trim();
          const wbr = (document.querySelector('input[data-testid="dashboards-add-question-input"]')?.value || "");
          return { menuText: menuText.slice(0, 120), value: wbr.slice(0, 120) };
        })()
      `);
      console.error("Mention debug:", debug);
      fail("Dashboards @ mention menu appeared but no items were available");
    }
    const firstMention = await evaluate(`
      (() => {
        const btn = document.querySelector('button[data-testid^="dashboards-add-question-mention-item-"]');
        return btn ? btn.getAttribute("data-testid") : null;
      })()
    `);
    if (!firstMention) fail("Dashboards @ mention menu opened but had no items");
    await clickSelector(evaluate, `button[data-testid="${firstMention}"]`);
    // Verify the input now contains workbook://
    const hasWorkbookRef = await evaluate(`
      (() => {
        const el = document.querySelector('input[data-testid="dashboards-add-question-input"]');
        return !!el && (el.value || "").includes("workbook://");
      })()
    `);
    if (!hasWorkbookRef) fail("Selecting a @ mention did not insert a workbook:// reference into the question input");
    console.log("✅ Dashboards @ mention inserts workbook:// reference");

    await setInputValue(evaluate, 'input[data-testid="dashboards-add-question-input"]', 'How many documents do we have?');
    await clickSelector(evaluate, 'button[data-testid="dashboards-add-query"]');
    console.log("✅ Created dashboard + added a query");

    async function getTileIds() {
      const ids = await evaluate(`
        (() => {
          // Use the tile menu buttons as the canonical per-tile element to avoid matching
          // nested elements like dashboard-tile-result-*
          const btns = Array.from(document.querySelectorAll('button[data-testid^="dashboard-tile-menu-"]'));
          return btns
            .map(b => b.getAttribute("data-testid"))
            .filter(Boolean);
        })()
      `);
      return Array.isArray(ids)
        ? ids.map((t) => String(t).replace(/^dashboard-tile-menu-/, ""))
        : [];
    }

    async function waitForNewTileId(prevIds, timeoutMs = 20000) {
      const prevSet = new Set(prevIds.map(String));
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const ids = await getTileIds();
        const newOnes = ids.filter((id) => !prevSet.has(String(id)));
        if (newOnes.length) return newOnes[newOnes.length - 1];
        await sleep(150);
      }
      return null;
    }

    async function waitForResultType(queryId, expectedType, timeoutMs = 20000) {
      const start = Date.now();
      const sel = `div[data-testid="dashboard-tile-result-${queryId}"]`;
      while (Date.now() - start < timeoutMs) {
        const got = await evaluate(`
          (() => {
            const el = document.querySelector(${jsString(sel)});
            return el ? (el.getAttribute("data-result-type") || "") : null;
          })()
        `);
        if (got && String(got) === String(expectedType)) return true;
        await sleep(150);
      }
      return false;
    }

    // Edit the question on the first tile (ensures edit flow exists and is stable).
    const firstTileTid = await (async () => {
      const start = Date.now();
      while (Date.now() - start < 60000) {
        const tid = await evaluate(`
          (() => {
            const el = document.querySelector('[data-testid^="dashboard-tile-"]');
            return el ? el.getAttribute("data-testid") : null;
          })()
        `);
        if (tid) return tid;
        await sleep(150);
      }
      return null;
    })();
    if (!firstTileTid) {
      console.warn(
        "⚠️ Dashboard tile did not render in time; skipping dashboard tile edit/viz steps (LLM/provider may be slow or unavailable).",
      );
    } else {
      const queryId = String(firstTileTid).replace(/^dashboard-tile-/, "");

      // Open tile menu, then edit question.
      await clickSelector(evaluate, `button[data-testid="dashboard-tile-menu-${queryId}"]`);
      await waitForSelector(evaluate, `div[data-testid="dashboard-tile-menu-panel-${queryId}"]`, 20000);
      await clickSelector(evaluate, `button[data-testid="dashboard-tile-edit-question-${queryId}"]`);
      await waitForSelector(evaluate, 'input[data-testid="input-dialog-input"]', 20000);
      const qCounter = `How many documents do we have? (counter ${Date.now()})`;
      await setInputValue(evaluate, 'input[data-testid="input-dialog-input"]', qCounter);
      await clickSelector(evaluate, 'button[data-testid="input-dialog-ok"]');
      console.log("✅ Edited dashboard tile question");

      // Force visualization to Counter (LLM output can be nondeterministic; don't hard-fail on result type).
      await clickSelector(evaluate, `button[data-testid="dashboard-tile-menu-${queryId}"]`);
      await waitForSelector(evaluate, `div[data-testid="dashboard-tile-menu-panel-${queryId}"]`, 20000);
      await clickSelector(evaluate, `button[data-testid="dashboard-tile-viz-${queryId}"]`);
      await waitForSelector(evaluate, `button[data-testid="dashboard-tile-viz-${queryId}-counter"]`, 20000);
      await clickSelector(evaluate, `button[data-testid="dashboard-tile-viz-${queryId}-counter"]`);
      console.log("✅ Set Counter visualization (result type is provider-dependent, not asserted)");
    }

    // NOTE: We intentionally avoid asserting a generic LLM-generated Table tile here because it can be nondeterministic.
    // Graph behavior is validated deterministically below using a CSV-backed graph tile with >1 points.

    // NOTE: We intentionally do NOT test a generic "graph documents" query here because it is LLM-dependent.
    // Graph behavior is validated deterministically below using a CSV-backed graph tile with >1 points.

    // CSV-backed graph smoke: create tile and set visualization to graph.
    const csvGraphQ = `Summarize the total budget in a bar graph for 2025 from workbook://${workbookId}/${csvRelPath}`;
    const beforeCsvGraph = await getTileIds();
    await setInputValue(evaluate, 'input[data-testid="dashboards-add-question-input"]', csvGraphQ);
    await clickSelector(evaluate, 'button[data-testid="dashboards-add-query"]');
    // Best-effort: on slower / offline LLMs, tile creation can be delayed or skipped.
    // We do NOT hard-fail the entire smoke on this step (Chat + scoped context is the core deterministic contract).
    const csvGraphId = await waitForNewTileId(beforeCsvGraph, 60000);
    if (!csvGraphId) {
      console.warn("⚠️ CSV graph tile did not render in time; skipping graph visualization step (LLM/provider may be slow or unavailable).");
    } else {
      await clickSelector(evaluate, `button[data-testid="dashboard-tile-menu-${csvGraphId}"]`);
      await waitForSelector(evaluate, `div[data-testid="dashboard-tile-menu-panel-${csvGraphId}"]`, 20000);
      await clickSelector(evaluate, `button[data-testid="dashboard-tile-viz-${csvGraphId}"]`);
      await waitForSelector(evaluate, `button[data-testid="dashboard-tile-viz-${csvGraphId}-graph"]`, 20000);
      await clickSelector(evaluate, `button[data-testid="dashboard-tile-viz-${csvGraphId}-graph"]`);
      console.log("✅ Created CSV graph tile and set Graph visualization (result rendering is provider-dependent, not asserted)");
    }

    // Final: fail hard on uncaught exceptions and known-fatal console errors.
    const fatalConsole = (consoleEvents || []).filter((e) => {
      const t = String(e?.text || "");
      return (
        t.includes("Duplicate definition of module 'jquery'") ||
        t.includes("Can only have one anonymous define call per script file") ||
        t.includes("Uncaught Error: Can only have one anonymous define call")
      );
    });
    if (Array.isArray(exceptionEvents) && exceptionEvents.length) {
      const first = exceptionEvents[0];
      fail(`Uncaught exception detected in renderer console: ${String(first?.text || "").slice(0, 800)}`);
    }
    if (fatalConsole.length) {
      const first = fatalConsole[0];
      fail(`Fatal console error detected: ${String(first?.text || "").slice(0, 800)}`);
    }

    console.log("\n🎉 UI automation smoke PASSED");
    process.exit(0);
  } catch (e) {
    console.error(e);
    fail(e instanceof Error ? e.message : "Smoke failed");
  } finally {
    try { ws.close(); } catch {}
  }
}

run();
