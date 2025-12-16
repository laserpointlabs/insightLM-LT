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

  ws.on("message", (raw) => {
    const msg = JSON.parse(String(raw));
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

  return { ws, call, evaluate };
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

  const { ws, evaluate } = await connectCDP();

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

    // Expand Contexts and toggle scoping All ↔ Scoped.
    await ensureExpanded(evaluate, "sidebar-contexts-header");
    await waitForSelector(evaluate, 'button[data-testid="contexts-scope-toggle"]', 20000);
    await clickSelector(evaluate, 'button[data-testid="contexts-scope-toggle"]');
    await sleep(250);
    await clickSelector(evaluate, 'button[data-testid="contexts-scope-toggle"]');
    console.log("✅ Toggled context scoping All ↔ Scoped");

    // Expand Workbooks and create a workbook.
    await ensureExpanded(evaluate, "sidebar-workbooks-header");
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

    // Expand Chat and send message.
    await ensureExpanded(evaluate, "sidebar-chat-header");
    await waitForSelector(evaluate, 'input[data-testid="chat-input"]', 20000);
    const msg = `smoke ping ${Date.now()}`;
    await setInputValue(evaluate, 'input[data-testid="chat-input"]', msg);
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
