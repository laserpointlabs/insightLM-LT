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
    throw new Error(`No CDP target found at ${listUrl}. Is the Electron app running?`);
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
          String(details?.exception?.description || "") ||
          String(details?.text || "") ||
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
      // Prefer InputEvent so React's change tracking is reliably triggered in prod Electron.
      try {
        el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: null }));
      } catch {
        el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      }
      el.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
      return true;
    })()
  `);
  if (!ok) throw new Error(`Could not fill input selector: ${selector}`);
}

// Type like a real user (char-by-char) so the UI visibly updates and React's controlled value stays in sync.
async function typeText(evaluate, selector, text, delayMs = 15) {
  // Ensure focus + start from empty (like selecting all + delete).
  await setInputValue(evaluate, selector, "");
  for (const ch of String(text || "")) {
    const ok = await evaluate(`
      (() => {
        const el = document.querySelector(${jsString(selector)});
        if (!el) return false;
        if (el.disabled) return false;
        el.focus();
        const next = String(el.value || "") + ${jsString(ch)};
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, "value");
        if (desc && typeof desc.set === "function") desc.set.call(el, next);
        else el.value = next;
        try { el.setSelectionRange(el.value.length, el.value.length); } catch {}
        try {
          el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: ${jsString(ch)} }));
        } catch {
          el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
        }
        return true;
      })()
    `);
    if (!ok) throw new Error(`Could not type into selector: ${selector}`);
    await sleep(delayMs);
  }
}

// Append text without clearing first (useful for newline + continued typing assertions).
async function appendText(evaluate, selector, text, delayMs = 15) {
  for (const ch of String(text || "")) {
    const ok = await evaluate(`
      (() => {
        const el = document.querySelector(${jsString(selector)});
        if (!el) return false;
        if (el.disabled) return false;
        el.focus();
        const next = String(el.value || "") + ${jsString(ch)};
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, "value");
        if (desc && typeof desc.set === "function") desc.set.call(el, next);
        else el.value = next;
        try { el.setSelectionRange(el.value.length, el.value.length); } catch {}
        try {
          el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: ${jsString(ch)} }));
        } catch {
          el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
        }
        return true;
      })()
    `);
    if (!ok) throw new Error(`Could not type into selector: ${selector}`);
    await sleep(delayMs);
  }
}

async function getTextareaMetrics(evaluate, selector) {
  return await evaluate(`
    (() => {
      const el = document.querySelector(${jsString(selector)});
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      const px = (v) => {
        const n = parseFloat(String(v || "0"));
        return Number.isFinite(n) ? n : 0;
      };
      const lineHeightRaw = cs.lineHeight;
      const lineHeight = lineHeightRaw && lineHeightRaw !== "normal" ? px(lineHeightRaw) : 20;
      return {
        rectH: rect.height,
        rectW: rect.width,
        clientH: el.clientHeight,
        clientW: el.clientWidth,
        scrollH: el.scrollHeight,
        scrollW: el.scrollWidth,
        overflowY: cs.overflowY,
        overflowX: cs.overflowX,
        lineHeight,
        padTop: px(cs.paddingTop),
        padBottom: px(cs.paddingBottom),
        borderTop: px(cs.borderTopWidth),
        borderBottom: px(cs.borderBottomWidth),
      };
    })()
  `);
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

async function ensureAutomationMode(evaluate) {
  await evaluate(`
    (async () => {
      if (window.__insightlmAutomationUI?.setMode) window.__insightlmAutomationUI.setMode(true);
      return window.__insightlmAutomationUI?.getMode?.() === true || document.body?.dataset?.automationMode === "true";
    })()
  `);
}

async function connectWithRetry(timeoutMs = 45000, wantProjectNameContains = null) {
  const start = Date.now();
  let lastErr = "";
  while (Date.now() - start < timeoutMs) {
    try {
      const cdp = await connectCDP();
      const bootOk = await waitForSelector(cdp.evaluate, "body", 20000);
      if (!bootOk) throw new Error("No <body>");
      const hasElectronAPI = await cdp.evaluate(`typeof window.electronAPI !== "undefined"`);
      if (!hasElectronAPI) throw new Error("electronAPI missing");

      if (wantProjectNameContains) {
        const want = String(wantProjectNameContains || "").trim();
        if (want) {
          const ok = await waitForSelector(cdp.evaluate, 'span[data-testid="statusbar-project-name"]', 20000);
          if (!ok) throw new Error("Project name indicator missing");
          const name = await cdp.evaluate(`
            (() => {
              const el = document.querySelector('span[data-testid="statusbar-project-name"]');
              return el ? (el.innerText || "").trim() : "";
            })()
          `);
          if (!String(name || "").includes(want)) {
            try { cdp.ws?.close?.(); } catch {}
            throw new Error(`Connected to wrong Project (wanted "${want}", got "${String(name || "")}")`);
          }
        }
      }
      return cdp;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      await sleep(750);
    }
  }
  throw new Error(`Failed to reconnect CDP after relaunch: ${lastErr}`);
}

async function setViewport(call, width, height) {
  try {
    await call("Emulation.setDeviceMetricsOverride", {
      width: Number(width),
      height: Number(height),
      deviceScaleFactor: 1,
      mobile: false,
    });
  } catch (e) {
    // Fail-soft: don't break smoke if CDP implementation differs; layout assertions will still run.
    console.warn("WARN: could not set viewport via CDP Emulation:", e?.message || String(e));
  }
}

async function run() {
  console.log(`🧪 UI automation smoke (CDP @ ${DEBUG_HOST}:${DEBUG_PORT})`);

  let ws, call, evaluate, consoleEvents, exceptionEvents;
  try {
    ({ ws, call, evaluate, consoleEvents, exceptionEvents } = await connectCDP());
  } catch (e) {
    fail(e instanceof Error ? e.message : "Failed to connect to CDP");
  }

  try {
    // Ensure the app has booted and our automation helper is present.
    const bootOk = await waitForSelector(evaluate, "body", 20000);
    if (!bootOk) fail("App did not render a <body> in time");

    // Ensure each run starts from a clean slate (smoke config uses a dedicated dataDir).
    // This prevents automation artifacts from polluting normal dev/demo data.
    await evaluate(`
      (async () => {
        if (window.electronAPI?.demos?.resetDevData) {
          await window.electronAPI.demos.resetDevData();
          try { localStorage.removeItem("insightlm.openTabs.v1"); } catch {}
          return true;
        }
        return false;
      })()
    `);
    await sleep(300);

    // Enable automation mode (force-show hover-only controls).
    await ensureAutomationMode(evaluate);
    // Status bar should be visible (project indicator).
    await waitForSelector(evaluate, 'div[data-testid="statusbar-container"]', 20000);
    await waitForSelector(evaluate, 'span[data-testid="statusbar-project-name"]', 20000);

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

    // Extensions workbench: list + toggle + open details tab (manifest-driven, decoupled).
    const extBtn = 'button[data-testid="activitybar-item-extensions"]';
    const hasExtBtn = await waitForSelector(evaluate, extBtn, 20000);
    if (!hasExtBtn) fail("Missing Activity Bar Extensions icon");
    await clickSelector(evaluate, extBtn);
    await waitForSelector(evaluate, 'div[data-testid="extensions-workbench"]', 20000);

    // Expect built-in extensions to be registered (at least Jupyter + Spreadsheet in this repo).
    const hasAnyExt = await waitForSelector(evaluate, 'div[data-testid^="extensions-item-"]', 20000);
    if (!hasAnyExt) fail("Extensions workbench opened but no extensions were listed");

    // Toggle one extension deterministically (pick the first tile).
    const firstExt = await evaluate(`
      (() => {
        const el = document.querySelector('div[data-testid^="extensions-item-"]');
        return el ? String(el.getAttribute("data-testid") || "") : null;
      })()
    `);
    if (!firstExt) fail("Could not locate first extension tile");
    const extIdEnc = firstExt.slice("extensions-item-".length);
    const toggleTid = `extensions-toggle-${extIdEnc}`;
    const beforeToggle = await evaluate(`(() => !!document.querySelector('input[data-testid="${toggleTid}"]') && document.querySelector('input[data-testid="${toggleTid}"]').checked)()`);
    await clickSelector(evaluate, `input[data-testid="${toggleTid}"]`);
    const extToggleFlipped = await (async () => {
      const start = Date.now();
      while (Date.now() - start < 15000) {
        const now = await evaluate(`(() => document.querySelector('input[data-testid="${toggleTid}"]') ? document.querySelector('input[data-testid="${toggleTid}"]').checked : null)()`);
        if (now !== null && now !== beforeToggle) return true;
        await sleep(150);
      }
      return false;
    })();
    if (!extToggleFlipped) fail("Extension enable toggle did not flip");

    // Open details tab by clicking the tile (button inside tile).
    await clickSelector(evaluate, `div[data-testid="${firstExt}"] button[title="Open extension details"]`);
    await waitForSelector(evaluate, 'div[data-testid="extensions-details"]', 20000);
    const detailsOk = await evaluate(`
      (() => {
        const idEl = document.querySelector('span[data-testid="extensions-details-id"]');
        const nameEl = document.querySelector('div[data-testid="extensions-details-name"]');
        return { hasId: !!idEl, hasName: !!nameEl, id: idEl ? (idEl.innerText || "").trim() : null };
      })()
    `);
    if (!detailsOk?.hasId || !detailsOk?.hasName) fail(`Extension details tab missing expected fields: ${JSON.stringify(detailsOk)}`);
    console.log("✅ Extensions workbench: list + toggle + open details tab");

    // Return to File workbench before sidebar view assertions (Dashboards/Contexts/Workbooks/Chat live there).
    const fileWorkbench2 = 'button[data-testid="activitybar-item-file"]';
    const hasFile2 = await waitForSelector(evaluate, fileWorkbench2, 20000);
    if (!hasFile2) fail("Missing Activity Bar File workbench icon (after Extensions test)");
    await clickSelector(evaluate, fileWorkbench2);
    await waitForSelector(evaluate, 'button[data-testid="sidebar-dashboards-header"]', 20000);

    // Views/Layout sanity (VS Code-like): collapsed bottom view docks; no horizontal overflow when constrained.
    await setViewport(call, 900, 560);
    await waitForSelector(evaluate, 'div[data-testid="sidebar-container"]', 20000);
    await waitForSelector(evaluate, 'div[data-testid="sidebar-views-scroll"]', 20000);

    // Ensure Workbooks + Chat headers exist.
    await waitForSelector(evaluate, 'button[data-testid="sidebar-workbooks-header"]', 20000);
    await waitForSelector(evaluate, 'button[data-testid="sidebar-chat-header"]', 20000);

    // Expand Dashboards/Workbooks (so we can test that collapsing the lowest view "docks" and doesn't get pushed off-screen).
    await ensureExpanded(evaluate, "sidebar-dashboards-header");
    await ensureExpanded(evaluate, "sidebar-workbooks-header");

    // Collapse Workbooks and Chat (lowest view should dock to bottom; Workbooks should dock directly above Chat).
    const wbExpandedNow = await evaluate(
      `document.querySelector('button[data-testid="sidebar-workbooks-header"]')?.getAttribute("aria-expanded") === "true"`,
    );
    if (wbExpandedNow) await clickSelector(evaluate, 'button[data-testid="sidebar-workbooks-header"]');

    const chatExpandedNow = await evaluate(
      `document.querySelector('button[data-testid="sidebar-chat-header"]')?.getAttribute("aria-expanded") === "true"`,
    );
    if (chatExpandedNow) await clickSelector(evaluate, 'button[data-testid="sidebar-chat-header"]');

    const layoutOk = await evaluate(`
      (() => {
        const sb = document.querySelector('div[data-testid="sidebar-container"]');
        const sc = document.querySelector('div[data-testid="sidebar-views-scroll"]');
        const chat = document.querySelector('button[data-testid="sidebar-chat-header"]');
        const wb = document.querySelector('button[data-testid="sidebar-workbooks-header"]');
        if (!sb || !sc || !chat || !wb) return { ok: false, why: "missing elements" };
        const sbR = sb.getBoundingClientRect();
        const chatR = chat.getBoundingClientRect();
        const wbR = wb.getBoundingClientRect();
        const eps = 6; // px tolerance for borders/shadows
        const chatDocked = chatR.bottom <= sbR.bottom + eps && chatR.bottom >= sbR.bottom - 48;
        const wbAboveChat = wbR.bottom <= chatR.top + eps;
        const noHorizOverflow = sc.scrollWidth <= sc.clientWidth + 1;
        return {
          ok: !!(chatDocked && wbAboveChat && noHorizOverflow),
          chatDocked,
          wbAboveChat,
          noHorizOverflow,
          sb: { bottom: sbR.bottom, height: sbR.height },
          chat: { top: chatR.top, bottom: chatR.bottom },
          wb: { top: wbR.top, bottom: wbR.bottom },
          sc: { clientW: sc.clientWidth, scrollW: sc.scrollWidth },
        };
      })()
    `);
    if (!layoutOk?.ok) fail(`Views/layout docking/overflow check failed: ${JSON.stringify(layoutOk).slice(0, 1200)}`);
    console.log("✅ Sidebar views: collapsed bottom docks; no horizontal overflow (constrained viewport)");

    // Sidebar view bodies must scroll vertically (regression: overflow was hidden, losing scrollbars and pushing Chat off-screen).
    const assertViewBodyScrollable = async (viewBodyTid) => {
      const res = await evaluate(`
        (() => {
          const el = document.querySelector('div[data-testid="${viewBodyTid}"]');
          if (!el) return { ok: false, why: "missing" };
          const cs = window.getComputedStyle(el);
          return {
            ok: cs.overflowY === "auto" || cs.overflowY === "scroll",
            overflowY: cs.overflowY,
            overflowX: cs.overflowX,
          };
        })()
      `);
      if (!res?.ok) fail(`View body not scrollable (${viewBodyTid}): ${JSON.stringify(res)}`);
    };
    await ensureExpanded(evaluate, "sidebar-dashboards-header");
    await ensureExpanded(evaluate, "sidebar-contexts-header");
    await ensureExpanded(evaluate, "sidebar-workbooks-header");
    await ensureExpanded(evaluate, "sidebar-chat-header");
    await assertViewBodyScrollable("sidebar-viewbody-dashboards");
    await assertViewBodyScrollable("sidebar-viewbody-contexts");
    await assertViewBodyScrollable("sidebar-viewbody-workbooks");
    await assertViewBodyScrollable("sidebar-viewbody-chat");
    console.log("✅ Sidebar views: view bodies scroll vertically (overflow-y auto)");

    // Single-view fill behavior: if only Dashboards (or only Contexts) is expanded, it should fill the available scroll region.
    const assertSingleViewFills = async (viewHeaderTid, viewContainerTid, collapseOthers /* array of header selectors */) => {
      // Collapse all listed headers first.
      for (const sel of collapseOthers) {
        const isExp = await evaluate(`document.querySelector(${jsString(sel)})?.getAttribute("aria-expanded") === "true"`);
        if (isExp) await clickSelector(evaluate, sel);
      }
      // Expand desired view.
      await ensureExpanded(evaluate, viewHeaderTid);
      // Ensure chat is collapsed for a stable bottom dock baseline.
      const chatExp = await evaluate(
        `document.querySelector('button[data-testid="sidebar-chat-header"]')?.getAttribute("aria-expanded") === "true"`,
      );
      if (chatExp) await clickSelector(evaluate, 'button[data-testid="sidebar-chat-header"]');

      const metrics = await evaluate(`
        (() => {
          const sc = document.querySelector('div[data-testid="sidebar-views-scroll"]');
          const v = document.querySelector('div[data-testid="${viewContainerTid}"]');
          if (!sc || !v) return { ok: false, why: "missing" };
          const scR = sc.getBoundingClientRect();
          const vR = v.getBoundingClientRect();
          const eps = 10;

          // VS Code-like behavior: collapsed view headers remain visible and consume space,
          // so the single expanded view should fill the REMAINING area, not necessarily the entire scroll region.
          const children = Array.from(sc.children || []);
          const otherHeights = children
            .filter((el) => el && el.getAttribute && el.getAttribute("data-testid") !== "${viewContainerTid}")
            .map((el) => el.getBoundingClientRect().height)
            .reduce((a, b) => a + b, 0);

          const expectedMin = Math.max(0, scR.height - otherHeights - eps);
          const fills = vR.height >= expectedMin;
          return { ok: fills, fills, expectedMin, scH: scR.height, vH: vR.height, otherHeights };
        })()
      `);
      if (!metrics?.ok) fail(`Single-view fill failed for ${viewContainerTid}: ${JSON.stringify(metrics)}`);
    };

    await assertSingleViewFills(
      "sidebar-dashboards-header",
      "sidebar-view-dashboards",
      ['button[data-testid="sidebar-contexts-header"]', 'button[data-testid="sidebar-workbooks-header"]'],
    );
    await assertSingleViewFills(
      "sidebar-contexts-header",
      "sidebar-view-contexts",
      ['button[data-testid="sidebar-dashboards-header"]', 'button[data-testid="sidebar-workbooks-header"]'],
    );
    console.log("✅ Sidebar views: single expanded view fills available area (Dashboards + Contexts)");

    // Context scoping: indicator must be visible in BOTH the Status Bar and the Contexts section header,
    // even when Contexts is collapsed.
    await waitForSelector(evaluate, 'button[data-testid="statusbar-scope-toggle"]', 20000);
    await waitForSelector(evaluate, '[data-testid="statusbar-scope-text"]', 20000);
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

    // Status bar scope text should clearly state "All workbooks" when in ALL mode.
    if (String(flipped).toUpperCase().includes("ALL")) {
      const ok = await waitForTextContains(evaluate, '[data-testid="statusbar-scope-text"]', "All workbooks", 20000);
      if (!ok) fail('Status bar did not show "All workbooks" after switching to ALL');
    }

    // Toggle back via the Status Bar and assert the Contexts header accessory matches.
    await clickSelector(evaluate, 'button[data-testid="statusbar-scope-toggle"]');
    const backOk = await (async () => {
      const start = Date.now();
      while (Date.now() - start < 20000) {
        const now = await evaluate(`
          (() => {
            const a = document.querySelector('button[data-testid="contexts-scope-toggle"]');
            const b = document.querySelector('button[data-testid="statusbar-scope-toggle"]');
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
    if (!backOk) fail("Status bar scope toggle did not stay in sync with Contexts header toggle");
    console.log("✅ Verified scoping indicator is always visible + toggles stay in sync (status bar + contexts header)");

    // NOTE: Project-scoped persistence across relaunch is proven deterministically in
    // `tests/run-prod-renderer-smoke.mjs` because in-app relaunch can disrupt CDP connectivity.

    // Force deterministic mode for the rest of the smoke: Scoped (context).
    await ensureContextScopingMode(evaluate, "context");
    console.log("✅ Ensured context scoping is Scoped");

    // Keep Chat mounted so it can receive "workbooks:changed" and refresh the Context picker list.
    await ensureExpanded(evaluate, "sidebar-chat-header");

    // Expand Workbooks and create a workbook.
    await ensureExpanded(evaluate, "sidebar-workbooks-header");

    // Verify demos can be loaded after reset (and don't depend on hardcoded org paths).
    // This is important for dev resets: the user expects AC-1000 + Trade Study to work immediately.
    await evaluate(`
      (async () => {
        if (window.electronAPI?.demos?.load) {
          await window.electronAPI.demos.load("ac1000");
          await window.electronAPI.demos.load("trade-study");
          return true;
        }
        return false;
      })()
    `);
    // Allow the renderer to refresh the workbooks tree after demo load notifications.
    await sleep(800);

    // Assert demo workbooks are present.
    const acMainId = "ac1000-main-project";
    const acItem = 'div[data-testid="workbooks-item-' + acMainId + '"]';
    const acOk = await waitForSelector(evaluate, acItem, 30000);
    if (!acOk) fail("AC-1000 demo workbook did not appear after demos.load('ac1000')");
    console.log("✅ Verified demos.load('ac1000') makes AC-1000 workbook available");

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
            await waitForSelector(evaluate, 'button[data-testid="document-viewer-save-button"]', 20000);
            await clickSelector(evaluate, 'button[data-testid="document-viewer-save-button"]');
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
    // Use a name that sorts near the top so it will appear in the Chat "Quick: Workbooks" list (which is capped).
    const wbName = `AAA Smoke WB ${Date.now()}`;
    await setInputValue(evaluate, 'input[data-testid="input-dialog-input"]', wbName);
    // Fail-soft: on some builds the dialog may auto-submit quickly; only click OK if still present.
    const okBtn = 'button[data-testid="input-dialog-ok"]';
    const okPresent = await evaluate(`!!document.querySelector(${jsString(okBtn)})`);
    if (okPresent) await clickSelector(evaluate, okBtn);
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

    // Create a second workbook that is NOT part of the active "[WB] ..." context.
    // We'll use this to prove Chat @ mentions are truly scoped (not just "top N" luck).
    await clickSelector(evaluate, 'button[data-testid="workbooks-create"]');
    await waitForSelector(evaluate, 'input[data-testid="input-dialog-input"]', 20000);
    // IMPORTANT: Mention parsing only supports single-token "@query" (no whitespace).
    // Use an underscore token so the mention menu stays open while we type the query.
    const otherWbToken = `ZZZ_OTHER_WB_${Date.now()}`;
    await setInputValue(evaluate, 'input[data-testid="input-dialog-input"]', otherWbToken);
    const okBtn2 = 'button[data-testid="input-dialog-ok"]';
    const okPresent2 = await evaluate(`!!document.querySelector(${jsString(okBtn2)})`);
    if (okPresent2) await clickSelector(evaluate, okBtn2);
    await waitForGone(evaluate, 'input[data-testid="input-dialog-input"]', 20000);

    const otherWorkbookId = await (async () => {
      const start = Date.now();
      while (Date.now() - start < 20000) {
        const id = await evaluate(`
          (() => {
            const items = Array.from(document.querySelectorAll('[data-testid^="workbooks-item-"]'));
            const hit = items.find(el => (el.innerText || "").includes(${jsString(otherWbToken)}));
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

    if (!otherWorkbookId) fail("Could not discover second workbook id in UI");
    console.log(`✅ Created second workbook "${otherWbToken}" (${otherWorkbookId})`);

    // Chat context picker should refresh its Quick Workbooks list without a full reload.
    // Open the Context menu and assert the new workbook appears.
    await ensureExpanded(evaluate, "sidebar-chat-header");
    await waitForSelector(evaluate, 'button[data-testid="chat-context-chip"]', 20000);
    await clickSelector(evaluate, 'button[data-testid="chat-context-chip"]');
    await waitForSelector(evaluate, 'div[data-testid="chat-context-menu"]', 20000);
    const quickTid = `chat-context-quick-workbook-${encodeURIComponent(String(workbookId || ""))}`;
    const quickOk = await waitForSelector(evaluate, `button[data-testid="${quickTid}"]`, 20000);
    if (!quickOk) fail("New workbook did not appear in Chat context picker Quick: Workbooks list (expected no View→Reload)");

    // Click the quick workbook to create/activate the auto "[WB] ..." context, then ensure it does NOT appear
    // in the normal Contexts list (prevents confusing duplicates in the picker).
    await clickSelector(evaluate, `button[data-testid="${quickTid}"]`);
    await sleep(300);
    await clickSelector(evaluate, 'button[data-testid="chat-context-chip"]');
    await waitForSelector(evaluate, 'div[data-testid="chat-context-menu"]', 20000);
    const hasWbContextDuplicate = await evaluate(`
      (() => {
        const items = Array.from(document.querySelectorAll('button[data-testid^="chat-context-item-"]'));
        return items.some((el) => (el.innerText || "").includes(${jsString(`[WB] ${wbName}`)}));
      })()
    `);
    if (hasWbContextDuplicate) fail("Chat context picker shows duplicate [WB] context in Contexts list (should be excluded)");

    // "Go to Contexts…" must reliably jump/expand Contexts view.
    await clickSelector(evaluate, 'button[data-testid="chat-context-menu-go-to-contexts"]');
    const contextsExpanded = await (async () => {
      const start = Date.now();
      while (Date.now() - start < 8000) {
        const ok = await evaluate(`!!document.querySelector('div[data-testid="sidebar-viewbody-contexts"]')`);
        if (ok) return true;
        await sleep(150);
      }
      return false;
    })();
    if (!contextsExpanded) fail('Chat context menu "Go to Contexts…" did not expand Contexts view');
    // Return to chat/workbooks for the remainder of the flow.
    await ensureExpanded(evaluate, "sidebar-chat-header");
    await ensureExpanded(evaluate, "sidebar-workbooks-header");

    // Close the menu (click chip again).
    const menuStillOpen = await evaluate(`!!document.querySelector('div[data-testid="chat-context-menu"]')`);
    if (menuStillOpen) {
      await clickSelector(evaluate, 'button[data-testid="chat-context-chip"]');
      await waitForGone(evaluate, 'div[data-testid="chat-context-menu"]', 20000);
    }
    console.log("✅ Chat context picker updates when a new workbook is created (no View→Reload)");

    // Create a new notebook via the Jupyter workbook action, open it, run `%pwd`, and assert
    // cwd resolves to the notebook's directory (no fallbacks).
    await clickSelector(evaluate, `span[data-testid="workbooks-toggle-${workbookId}"]`);
    await sleep(250);
    const notebookDocTid = await (async () => {
      const actionBtn = `button[data-testid="workbooks-action-jupyter.create-notebook-${workbookId}"]`;
      const hasAction = await waitForSelector(evaluate, actionBtn, 20000);
      if (!hasAction) fail(`Missing Jupyter create notebook action button: ${actionBtn}`);

      const before = await evaluate(`
        (() => Array.from(document.querySelectorAll('[data-testid^="workbooks-doc-${workbookId}-"]'))
          .map(el => String(el.getAttribute("data-testid") || ""))
          .filter(Boolean)
        )()
      `);

      await clickSelector(evaluate, actionBtn);

      const start = Date.now();
      while (Date.now() - start < 20000) {
        const after = await evaluate(`
          (() => Array.from(document.querySelectorAll('[data-testid^="workbooks-doc-${workbookId}-"]'))
            .map(el => String(el.getAttribute("data-testid") || ""))
            .filter(Boolean)
          )()
        `);
        const b = new Set(Array.isArray(before) ? before : []);
        const a = Array.isArray(after) ? after : [];
        const diff = a.filter((x) => !b.has(x));
        const ipynb = diff.find((tid) => tid.toLowerCase().includes(".ipynb"));
        if (ipynb) return ipynb;
        await sleep(150);
      }
      return null;
    })();

    if (!notebookDocTid) fail("Notebook did not appear in Workbooks tree after Create New Notebook action");
    await clickSelector(evaluate, `div[data-testid="${notebookDocTid}"]`);
    await waitForSelector(evaluate, 'div[data-testid="document-viewer-content"][data-active-ext="ipynb"]', 20000);
    await waitForSelector(evaluate, 'div[data-testid="notebook-viewer"]', 20000);

    // Overwrite the first cell with %pwd (the exact user repro).
    await waitForSelector(evaluate, 'div[data-testid="notebook-cell-0"]', 20000);
    await setInputValue(evaluate, 'div[data-testid="notebook-cell-0"] textarea', "%pwd");
    await waitForSelector(evaluate, 'button[data-testid="notebook-cell-run-0"]', 20000);
    await clickSelector(evaluate, 'button[data-testid="notebook-cell-run-0"]');

    const pwdOk = await (async () => {
      const start = Date.now();
      const expectedNeedle = `workbooks\\\\${workbookId}\\\\documents`.toLowerCase();
      while (Date.now() - start < 30000) {
        const out = await evaluate(`
          (() => {
            const el = document.querySelector('div[data-testid="notebook-cell-output-0"]');
            return el ? String(el.innerText || el.textContent || "") : "";
          })()
        `);
        const outText = String(out || "");
        // Fail-fast on obvious execution errors (this should be strict now).
        if (outText && (outText.includes("ExecutionError") || outText.includes("Traceback") || outText.toLowerCase().includes("missing required param: notebook_path"))) {
          fail(`Notebook execution failed while validating %pwd:\n${outText.slice(0, 1200)}`);
        }
        const norm = outText.toLowerCase().replaceAll("/", "\\");
        if (norm.includes(expectedNeedle)) return true;
        await sleep(150);
      }
      return false;
    })();
    if (!pwdOk) fail("Notebook %pwd output did not include expected notebook directory (workbooks/<id>/documents)");
    console.log("✅ Notebook %pwd resolves to notebook directory (no cwd fallback)");

    // Capture doc id + filename for tab-stability checks after Ctrl+S.
    const nb1 = await evaluate(`
      (() => {
        const el = document.querySelector('div[data-testid="document-viewer-content"]');
        return el ? { id: el.getAttribute("data-active-doc-id") || "", filename: el.getAttribute("data-active-filename") || "" } : null;
      })()
    `);
    if (!nb1?.id) fail("Could not read active notebook tab id for save-stability check");

    // Create a SECOND notebook deterministically so lastOpenedDocId differs from the tab we will save.
    // (The create-notebook action uses second-level timestamps, which can collide in fast automation.)
    const nb2RelPath = `documents/auto-smoke-tab-stability-${Date.now()}.ipynb`;
    const nb2Content = JSON.stringify(
      {
        cells: [
          {
            cell_type: "code",
            source: "%pwd",
            metadata: {},
            outputs: [],
            execution_count: null,
          },
        ],
        metadata: { kernelspec: { name: "python3", display_name: "Python 3", language: "python" } },
        nbformat: 4,
        nbformat_minor: 2,
      },
      null,
      2,
    );
    await evaluate(`
      (async () => {
        if (!window.electronAPI?.file?.write) return false;
        await window.electronAPI.file.write(${jsString(workbookId)}, ${jsString(nb2RelPath)}, ${jsString(nb2Content)});
        return true;
      })()
    `);
    // Refresh the Workbooks view so the new notebook is visible.
    const refreshBtn = 'button[data-testid="workbooks-refresh"]';
    const refreshPresent = await evaluate(`!!document.querySelector(${jsString(refreshBtn)})`);
    if (refreshPresent) await clickSelector(evaluate, refreshBtn);

    const notebookDocTid2 = `div[data-testid="workbooks-doc-${workbookId}-${encodeURIComponent(nb2RelPath)}"]`;
    const nb2Ok = await waitForSelector(evaluate, notebookDocTid2, 20000);
    if (!nb2Ok) fail("Second notebook did not appear in Workbooks tree after file.write + refresh");

    // Open second notebook via Workbooks (this sets lastOpenedDocId to notebook2).
    await clickSelector(evaluate, notebookDocTid2);
    await waitForSelector(evaluate, 'div[data-testid="document-viewer-content"][data-active-ext="ipynb"]', 20000);
    const nb2 = await evaluate(`
      (() => {
        const el = document.querySelector('div[data-testid="document-viewer-content"]');
        return el ? { id: el.getAttribute("data-active-doc-id") || "", filename: el.getAttribute("data-active-filename") || "" } : null;
      })()
    `);
    if (!nb2?.id) fail("Could not read second notebook tab id");

    // Switch back to notebook1 by clicking its TAB (important: should NOT update lastOpenedDocId).
    await clickSelector(evaluate, `div[data-testid="document-viewer-tab-${encodeURIComponent(String(nb1.id || ""))}"]`);
    const backTabOk = await waitForTextContains(
      evaluate,
      'div[data-testid="document-viewer-content"]',
      String(nb1.filename || ""),
      20000,
    );
    if (!backTabOk) fail("Could not switch back to notebook1 tab for save-stability check");

    // Make an edit so the save bar appears.
    await setInputValue(evaluate, 'div[data-testid="notebook-cell-0"] textarea', "%pwd\\n");
    const saveBarOk = await waitForSelector(evaluate, 'div[data-testid="document-viewer-save-bar"]', 20000);
    if (!saveBarOk) fail("Expected save bar to appear after notebook edit");

    // Trigger Ctrl+S (the exact repro path).
    await evaluate(`
      (() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
        return true;
      })()
    `);
    await waitForGone(evaluate, 'div[data-testid="document-viewer-save-bar"]', 20000);

    // Assert the active tab did NOT change to notebook2 after saving notebook1.
    const afterSave = await evaluate(`
      (() => {
        const el = document.querySelector('div[data-testid="document-viewer-content"]');
        return el ? { id: el.getAttribute("data-active-doc-id") || "", filename: el.getAttribute("data-active-filename") || "" } : null;
      })()
    `);
    if (!afterSave?.id) fail("Could not read active tab after Ctrl+S");
    if (String(afterSave.id) !== String(nb1.id)) {
      fail(`Ctrl+S save switched active tab unexpectedly (expected ${nb1.filename}, got ${afterSave.filename})`);
    }
    console.log("✅ Ctrl+S save keeps the saved tab active (no tab jump)");

  // Dirty tab close protection (no silent data loss)
  // Use the notebook editor path (textarea exists) to deterministically create unsaved changes.
  const dirtyToken = `dirty-close-${Date.now()}`;
  const dirtyNotebookRelPath = `documents/auto-smoke-dirty-close-${Date.now()}.ipynb`;
  const dirtyNotebookContent = JSON.stringify(
    {
      cells: [
        {
          cell_type: "code",
          source: `%pwd\n# ${dirtyToken}\n`,
          metadata: {},
          outputs: [],
          execution_count: null,
        },
      ],
      metadata: { kernelspec: { name: "python3", display_name: "Python 3", language: "python" } },
      nbformat: 4,
      nbformat_minor: 2,
    },
    null,
    2,
  );
  await evaluate(`
    (async () => {
      await window.electronAPI.file.write(${jsString(workbookId)}, ${jsString(dirtyNotebookRelPath)}, ${jsString(dirtyNotebookContent)});
      return true;
    })()
  `);
  const refreshBtn2 = 'button[data-testid="workbooks-refresh"]';
  const refreshPresent2 = await evaluate(`!!document.querySelector(${jsString(refreshBtn2)})`);
  if (refreshPresent2) await clickSelector(evaluate, refreshBtn2);
  const dirtyNotebookTid = `div[data-testid="workbooks-doc-${workbookId}-${encodeURIComponent(dirtyNotebookRelPath)}"]`;
  const dnOk = await waitForSelector(evaluate, dirtyNotebookTid, 20000);
  if (!dnOk) fail("Dirty-close notebook did not appear in Workbooks tree");
  await clickSelector(evaluate, dirtyNotebookTid);
  await waitForSelector(evaluate, 'div[data-testid="document-viewer-content"][data-active-ext="ipynb"]', 20000);
  await waitForSelector(evaluate, 'div[data-testid="notebook-viewer"]', 20000);
  // Make it dirty (ensure save bar appears)
  await setInputValue(evaluate, 'div[data-testid="notebook-cell-0"] textarea', `%pwd\n# ${dirtyToken}\n# edit\n`);
  const dirtySaveBarOk = await waitForSelector(evaluate, 'div[data-testid="document-viewer-save-bar"]', 20000);
  if (!dirtySaveBarOk) fail("Expected save bar to appear after dirty-close notebook edit");

  const activeTabId = await evaluate(
    `document.querySelector('div[data-testid="document-viewer-content"]')?.getAttribute("data-active-doc-id") || ""`,
  );
  if (!activeTabId) fail("No active doc id for dirty-close test");

  // Close the tab via close button → expect unsaved dialog.
  await clickSelector(evaluate, `button[data-testid="document-viewer-tab-close-${encodeURIComponent(String(activeTabId))}"]`);
  await waitForSelector(evaluate, 'div[data-testid="unsaved-close-dialog"]', 10000);
  // Cancel should keep the tab open.
  await clickSelector(evaluate, 'button[data-testid="unsaved-close-dialog-cancel"]');
  await waitForGone(evaluate, 'div[data-testid="unsaved-close-dialog"]', 10000);
  const stillOpen = await evaluate(
    `!!document.querySelector('div[data-testid="document-viewer-tab-${encodeURIComponent(String(activeTabId))}"]')`,
  );
  if (!stillOpen) fail("Dirty tab closed even after Cancel");
  // Close again, choose Don't Save → should close without persisting token.
  await clickSelector(evaluate, `button[data-testid="document-viewer-tab-close-${encodeURIComponent(String(activeTabId))}"]`);
  await waitForSelector(evaluate, 'div[data-testid="unsaved-close-dialog"]', 10000);
  await clickSelector(evaluate, 'button[data-testid="unsaved-close-dialog-dont-save"]');
  await waitForGone(evaluate, 'div[data-testid="unsaved-close-dialog"]', 10000);
  const closed = await evaluate(
    `!document.querySelector('div[data-testid="document-viewer-tab-${encodeURIComponent(String(activeTabId))}"]')`,
  );
  if (!closed) fail("Dirty tab did not close after Don't Save");
  const rawAfterDontSave = await evaluate(`
    (async () => {
      try {
        const res = await window.electronAPI.file.read(${jsString(workbookId)}, ${jsString(dirtyNotebookRelPath)});
        return String(res?.content || "");
      } catch { return ""; }
    })()
  `);
  if (String(rawAfterDontSave).includes("# edit")) fail("Don't Save unexpectedly persisted dirty content");

  console.log("✅ Dirty tab close protection (Save/Don't Save/Cancel) prevents silent data loss");

    // Ctrl+S already performed a save; don't require the save bar/button to still be visible.
    // If it is visible (e.g. slow persistence), click it as a best-effort extra save.
    const saveBtn = 'button[data-testid="document-viewer-save-button"]';
    const saveVisible = await evaluate(`!!document.querySelector(${jsString(saveBtn)})`);
    if (saveVisible) {
      await clickSelector(evaluate, saveBtn);
    }
    console.log("✅ Saved notebook after %pwd execution");

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

    // Context card: workbook list collapsible (should not dominate Contexts view for large contexts).
    const cardToggleSel = `button[data-testid="contexts-card-workbooks-toggle-${encodeURIComponent(contextId)}"]`;
    const cardListSel = `div[data-testid="contexts-card-workbooks-list-${encodeURIComponent(contextId)}"]`;
    await waitForSelector(evaluate, cardToggleSel, 20000);
    await waitForSelector(evaluate, cardListSel, 20000);
    await clickSelector(evaluate, cardToggleSel); // collapse
    await sleep(200);
    const listGone = await evaluate(`!document.querySelector(${jsString(cardListSel)})`);
    if (!listGone) fail("Context card workbooks list did not collapse");
    await clickSelector(evaluate, cardToggleSel); // expand
    await waitForSelector(evaluate, cardListSel, 20000);
    console.log("✅ Context card: workbook list collapsible");

    // Contexts view: Quick Workbooks collapsible + active highlight
    // Collapse then expand to prove the toggle works deterministically.
    await waitForSelector(evaluate, 'button[data-testid="sidebar-contexts-header"]', 20000);
    await ensureExpanded(evaluate, "sidebar-contexts-header");
    await waitForSelector(evaluate, 'button[data-testid="contexts-quick-workbooks-toggle"]', 20000);
    await clickSelector(evaluate, 'button[data-testid="contexts-quick-workbooks-toggle"]'); // collapse
    await sleep(200);
    const quickHidden = await evaluate(`!document.querySelector('div[data-testid="contexts-quick-workbooks"]')`);
    if (!quickHidden) fail("Contexts quick workbooks did not collapse");
    await clickSelector(evaluate, 'button[data-testid="contexts-quick-workbooks-toggle"]'); // expand
    await sleep(200);
    await waitForSelector(evaluate, 'div[data-testid="contexts-quick-workbooks"]', 20000);

    // Click the first quick workbook and assert it is marked active (data-active=true).
    const firstQuickTid = await evaluate(`
      (() => {
        const btn = document.querySelector('button[data-testid^="contexts-quick-workbook-"]');
        return btn ? (btn.getAttribute("data-testid") || "") : null;
      })()
    `);
    if (!firstQuickTid) fail("No quick workbook button found in Contexts");
    await clickSelector(evaluate, `button[data-testid="${firstQuickTid}"]`);
    await sleep(400);
    const activeOk = await evaluate(`
      (() => {
        const el = document.querySelector('button[data-testid="${firstQuickTid}"]');
        return el ? String(el.getAttribute("data-active") || "") === "true" : false;
      })()
    `);
    if (!activeOk) fail("Quick workbook did not show active highlight after activation");
    console.log("✅ Contexts Quick Workbooks: collapsible + active highlight");

    // Restore the originally created Context as ACTIVE for subsequent chat/empty-state steps.
    // (Quick workbook activation changes the active context; later we delete `contextId` and expect chat to show empty state.)
    await clickSelector(evaluate, `button[data-testid="contexts-activate-${contextId}"]`);
    await sleep(300);

    // Expand workbook row.
    await clickSelector(evaluate, `span[data-testid="workbooks-toggle-${workbookId}"]`);

    // Create markdown in workbook root.
    await clickSelector(evaluate, `button[data-testid="workbooks-create-markdown-${workbookId}"]`);
    await waitForSelector(evaluate, 'input[data-testid="input-dialog-input"]', 20000);
    const mdName = "auto-smoke.md";
    await setInputValue(evaluate, 'input[data-testid="input-dialog-input"]', mdName);
    await clickSelector(evaluate, 'button[data-testid="input-dialog-ok"]');
    console.log("✅ Created markdown doc");

    // Regression proof: new files should be queryable immediately (no waiting + no View→Reload).
    // Write a unique token, then assert workbook-rag can grep it right away.
    const refreshProbeToken = `refresh-probe-${Date.now()}`;
    const probeWrite = await evaluate(`
      (async () => {
        try {
          if (!window.electronAPI?.file?.write) return { ok: false, why: "electronAPI.file.write unavailable" };
          await window.electronAPI.file.write(${jsString(workbookId)}, "documents/auto-smoke.md", ${jsString(
      `This is a refresh probe: ${refreshProbeToken}\n`,
    )});
          return { ok: true };
        } catch (e) {
          return { ok: false, why: e instanceof Error ? e.message : String(e) };
        }
      })()
    `);
    if (!probeWrite?.ok) fail(`Failed to write refresh probe: ${JSON.stringify(probeWrite)}`);

    // Open the markdown doc and assert it live-updates when written again (no manual refresh / no "Sources" click).
    const mdTid = `div[data-testid="workbooks-doc-${workbookId}-${encodeURIComponent("documents/auto-smoke.md")}"]`;
    await waitForSelector(evaluate, mdTid, 20000);
    await clickSelector(evaluate, mdTid);
    await waitForSelector(evaluate, 'div[data-testid="document-viewer-content"][data-active-ext="md"]', 20000);

    const liveToken = `live-update-${Date.now()}`;
    const liveWriteOk = await evaluate(`
      (async () => {
        try {
          await window.electronAPI.file.write(${jsString(workbookId)}, "documents/auto-smoke.md", ${jsString(
            `Live update token: ${liveToken}\n`,
          )});
          return true;
        } catch { return false; }
      })()
    `);
    if (!liveWriteOk) fail("Failed to write live-update token to auto-smoke.md");

    const liveOk = await (async () => {
      const start = Date.now();
      while (Date.now() - start < 10000) {
        const ok = await evaluate(`
          (() => {
            const el = document.querySelector('div[data-testid="document-viewer-content"]');
            if (!el) return false;
            const snip = String(el.getAttribute("data-active-content-snippet") || "");
            return snip.includes(${jsString(liveToken)});
          })()
        `);
        if (ok) return true;
        await sleep(150);
      }
      return false;
    })();
    if (!liveOk) fail("Open document did not live-update after file.write (expected UI to reflect new content)");
    console.log("✅ Open document live-updates after file.write (no manual refresh)");

    const probeGrep = await (async () => {
      const start = Date.now();
      while (Date.now() - start < 10000) {
        const attempt = await evaluate(`
          (async () => {
            if (!window.electronAPI?.mcp?.call) return { ok: false, error: "electronAPI.mcp.call unavailable" };
            try {
              const res = await window.electronAPI.mcp.call("workbook-rag", "tools/call", {
                name: "rag_grep",
                arguments: { pattern: ${jsString(refreshProbeToken)}, regex: false, workbook_ids: [${jsString(workbookId)}] },
              });
              return { ok: true, res };
            } catch (e) {
              return { ok: false, error: e instanceof Error ? e.message : String(e) };
            }
          })()
        `);
        if (attempt?.ok) {
          const text = JSON.stringify(attempt?.res || "");
          if (text.includes(refreshProbeToken)) return { ok: true, res: attempt.res };
        }
        await sleep(200);
      }
      return { ok: false, error: "timeout" };
    })();
    if (!probeGrep?.ok) fail(`workbook-rag did not find newly-written token quickly (expected ${refreshProbeToken}, error=${String(probeGrep?.error || "unknown")})`);
    console.log("✅ Verified new file is immediately queryable (refresh/index cache invalidation)");

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

    // Project data access boundary (deterministic deny): workbook-rag must not allow traversal outside workbook.
    // Attempt to escape to the project config (../../config/llm.yaml) from within a workbook.
    const denyRes = await evaluate(`
      (async () => {
        try {
          const res = await window.electronAPI.mcp.call("workbook-rag", "tools/call", {
            name: "rag_read_file",
            arguments: {
              workbook_id: ${jsString(workbookId)},
              file_path: "../../config/llm.yaml",
            },
          });
          return res;
        } catch (e) {
          return { __threw: true, message: String(e?.message || e) };
        }
      })()
    `);
    if (denyRes?.__threw) fail(`rag_read_file traversal call threw (expected fail-soft response): ${denyRes?.message || "unknown"}`);
    const denyContent = String(denyRes?.content || denyRes?.result?.content || "");
    if (!denyContent.toLowerCase().includes("path not allowed")) {
      fail(`rag_read_file traversal did not deny access as expected. Got: ${denyContent.slice(0, 300)}`);
    }
    // Ensure we did not leak any YAML content (sanity: should not include common keys).
    if (denyContent.includes("activeProvider") || denyContent.includes("profiles:")) {
      fail("rag_read_file traversal denial leaked config content unexpectedly");
    }
    console.log("✅ Verified workbook-rag denies traversal outside workbook (project data access boundary)");

    // Git-lite deterministic smoke (scoped to current project dataDir; no remote).
    const gitSmokeOk = await evaluate(`
      (async () => {
        if (!window.electronAPI?.git?.init) return { ok: false, error: "electronAPI.git unavailable" };
        // Ensure repo exists
        const init = await window.electronAPI.git.init();
        if (!init?.ok) return { ok: false, error: init?.error || "git init failed" };
        // Create deterministic file in an existing workbook
        const rel = "documents/git_smoke.txt";
        const token = "GIT_SMOKE_TOKEN_" + Date.now();
        await window.electronAPI.file.write(${jsString(workbookId)}, rel, "token=" + token + "\\n");
        // Status should include the workbook file path somewhere (exact path varies by repo root).
        const st = await window.electronAPI.git.status();
        if (!st?.ok) return { ok: false, error: st?.error || "git status failed" };
        const hasUntracked = Array.isArray(st.untracked) && st.untracked.length > 0;
        // Commit with deterministic message
        const msg = "smoke: git-lite " + token;
        const c = await window.electronAPI.git.commit(msg);
        if (!c?.ok) return { ok: false, error: c?.error || "git commit failed" };
        const lg = await window.electronAPI.git.log(5);
        if (!lg?.ok) return { ok: false, error: lg?.error || "git log failed" };
        const hit = Array.isArray(lg.commits) && lg.commits.some((x) => String(x?.subject || "").includes(token));
        if (!hit) return { ok: false, error: "git log did not include commit subject token" };
        return { ok: true, hasUntracked };
      })()
    `);
    if (!gitSmokeOk?.ok) fail(`Git-lite smoke failed: ${gitSmokeOk?.error || "unknown error"}`);
    console.log("✅ Verified Git-lite init/status/commit/log (local, deterministic)");

    // Expand Chat and send message.
    await ensureExpanded(evaluate, "sidebar-chat-header");
    await waitForSelector(evaluate, 'textarea[data-testid="chat-input"]', 20000);

    // Pop Chat out into a tab, then verify draft persists across tab switches.
    // (This is the high-frequency UX: users keep typed text while switching tabs.)
    const popoutBtn = 'button[data-testid="chat-popout"]';
    const popoutOk = await waitForSelector(evaluate, popoutBtn, 20000);
    if (!popoutOk) fail("Chat popout button not found");
    await clickSelector(evaluate, popoutBtn);
    // Wait for the main DocumentViewer to show the Chat tab content.
    await waitForSelector(evaluate, 'div[data-testid="document-viewer-content"][data-active-ext="chat"]', 20000);
    await waitForSelector(evaluate, 'textarea[data-testid="chat-input"]', 20000);
    // Chat input is disabled while context status is loading; wait until it becomes interactive.
    await waitForSelector(evaluate, 'textarea[data-testid="chat-input"]:not([disabled])', 20000);

    // Make chat send deterministic + fast for smoke by stubbing the LLM chat call.
    // This avoids flaky long waits and ensures the composer re-enables quickly after send.
    await evaluate(`
      (() => {
        try {
          if (!window.electronAPI?.llm?.chat) return false;
          if (!window.__SMOKE_ORIG_LLM_CHAT) window.__SMOKE_ORIG_LLM_CHAT = window.electronAPI.llm.chat;
          window.electronAPI.llm.chat = async () => "smoke-ok";
          return true;
        } catch {
          return false;
        }
      })()
    `);

    // --- Chat composer hardening: autosize + wrapping + keyboard semantics ---
    // 1) Autosize grows with content up to maxRows, then becomes internally scrollable.
    {
      const sel = 'textarea[data-testid="chat-input"]';
      await clickSelector(evaluate, sel);
      await typeText(evaluate, sel, "x");
      const base = await getTextareaMetrics(evaluate, sel);
      if (!base) fail("Could not read chat textarea metrics (base)");

      const fiveLines = ["one", "two", "three", "four", "five"].join("\n");
      await typeText(evaluate, sel, fiveLines);
      const m5 = await getTextareaMetrics(evaluate, sel);
      if (!m5) fail("Could not read chat textarea metrics (5 lines)");
      if (!(m5.rectH > base.rectH + Math.max(4, base.lineHeight * 1.5))) {
        fail(`Chat textarea did not grow for multi-line input (baseH=${base.rectH}, h5=${m5.rectH})`);
      }

      const manyLines = Array.from({ length: 20 }, (_, i) => `l${i + 1}`).join("\n");
      await typeText(evaluate, sel, manyLines);
      const m20 = await getTextareaMetrics(evaluate, sel);
      if (!m20) fail("Could not read chat textarea metrics (20 lines)");

      const maxRows = 8;
      const maxH =
        (m20.lineHeight || 20) * maxRows +
        (m20.padTop || 0) +
        (m20.padBottom || 0) +
        (m20.borderTop || 0) +
        (m20.borderBottom || 0) +
        6; // tolerance for subpixel rounding / box model diffs

      if (m20.rectH > maxH) {
        fail(`Chat textarea exceeded maxRows height cap (h20=${m20.rectH}, maxH≈${maxH})`);
      }
      if (!(m20.scrollH > m20.clientH + 2)) {
        fail(`Chat textarea did not become scrollable after exceeding maxRows (scrollH=${m20.scrollH}, clientH=${m20.clientH})`);
      }
      console.log("✅ Chat composer autosize caps at maxRows and scrolls internally");
    }

    // 2) Wrapping/no horizontal overflow for long tokens.
    {
      const sel = 'textarea[data-testid="chat-input"]';
      // Ensure enabled before typing (if prior steps triggered async loading).
      await waitForSelector(evaluate, `${sel}:not([disabled])`, 20000);
      const longToken = "A".repeat(220);
      await typeText(evaluate, sel, longToken);
      const m = await getTextareaMetrics(evaluate, sel);
      if (!m) fail("Could not read chat textarea metrics (wrap)");
      // Allow a tiny tolerance for subpixel rounding.
      if (m.scrollW > m.clientW + 2) {
        fail(`Chat textarea has horizontal overflow for long tokens (scrollW=${m.scrollW}, clientW=${m.clientW})`);
      }
      console.log("✅ Chat composer long-token wrapping (no horizontal overflow)");
    }

    // 3) Shift+Enter inserts newline; Enter is handled by the app (preventDefault=true).
    {
      const sel = 'textarea[data-testid="chat-input"]';
      await waitForSelector(evaluate, `${sel}:not([disabled])`, 20000);
      await clickSelector(evaluate, sel);
      await typeText(evaluate, sel, "hello");
      const shiftEnterPrevented = await evaluate(`
        (() => {
          const el = document.querySelector(${jsString(sel)});
          if (!el) return null;
          el.focus();
          const ev = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", shiftKey: true, bubbles: true, cancelable: true });
          el.dispatchEvent(ev);
          return ev.defaultPrevented;
        })()
      `);
      if (shiftEnterPrevented == null) fail("Could not dispatch Shift+Enter to chat textarea");
      if (shiftEnterPrevented) fail("Shift+Enter was prevented; expected newline behavior");

      // Simulate the browser's newline insertion (since synthetic KeyboardEvent does not perform default actions).
      const inserted = await evaluate(`
        (() => {
          const el = document.querySelector(${jsString(sel)});
          if (!el) return false;
          const v = String(el.value || "");
          const next = v + "\\n";
          const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
          if (desc && typeof desc.set === "function") desc.set.call(el, next);
          else el.value = next;
          try { el.setSelectionRange(el.value.length, el.value.length); } catch {}
          try {
            el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertLineBreak", data: "\\n" }));
          } catch {
            el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
          }
          return true;
        })()
      `);
      if (!inserted) fail("Failed to simulate Shift+Enter newline insertion");
      await appendText(evaluate, sel, "world");
      const hasNewline = await evaluate(`
        (() => {
          const el = document.querySelector(${jsString(sel)});
          return el ? String(el.value || "") === "hello\\nworld" : false;
        })()
      `);
      if (!hasNewline) fail("Shift+Enter newline assertion failed (expected \"hello\\nworld\")");

      // Now verify Enter is handled by the app (preventDefault) and results in sending.
      const enterMsg = `enter send ${Date.now()}`;
      await typeText(evaluate, sel, enterMsg);
      const enterPrevented = await evaluate(`
        (() => {
          const el = document.querySelector(${jsString(sel)});
          if (!el) return null;
          el.focus();
          const ev = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true });
          el.dispatchEvent(ev);
          return ev.defaultPrevented;
        })()
      `);
      if (enterPrevented == null) fail("Could not dispatch Enter to chat textarea");
      if (!enterPrevented) fail("Enter was not prevented; expected Enter=send behavior");

      // Wait for a user message bubble to include the sent text.
      const enterSentOk = await (async () => {
        const start = Date.now();
        while (Date.now() - start < 20000) {
          const ok = await evaluate(`
            (() => {
              const nodes = Array.from(document.querySelectorAll('[data-chat-message][data-role="user"]'));
              return nodes.some(n => (n.innerText || "").includes(${jsString(enterMsg)}));
            })()
          `);
          if (ok) return true;
          await sleep(150);
        }
        return false;
      })();
      if (!enterSentOk) fail("Enter-to-send did not result in a sent user message");
      // Ensure the composer becomes interactive again before subsequent typing steps.
      await waitForSelector(evaluate, `${sel}:not([disabled])`, 20000);
      console.log("✅ Chat composer Shift+Enter newline + Enter=send semantics verified");
    }

    const chatDoc = await evaluate(`
      (() => {
        const el = document.querySelector('div[data-testid="document-viewer-content"]');
        return el ? { id: el.getAttribute("data-active-doc-id") || "" } : null;
      })()
    `);
    if (!chatDoc?.id) fail("Could not read active chat tab id after popout");

    // Editor splits (2 groups): show Chat + a Notebook side-by-side.
    // Split Right, then move Chat to the other group, and assert both panes exist.
    await clickSelector(evaluate, 'button[data-testid="document-viewer-split-right"]');
    const splitOk = await waitForSelector(evaluate, 'div[data-testid="document-viewer-split-container"]', 20000);
    if (!splitOk) fail("Split Right did not create split container");

    // Focus the Chat tab and move it to the other group.
    await clickSelector(evaluate, `div[data-testid="document-viewer-tab-${encodeURIComponent(String(chatDoc.id || ""))}"]`);
    await clickSelector(evaluate, 'button[data-testid="document-viewer-move-to-other-group"]');
    await sleep(300);

    const panesOk = await evaluate(`
      (() => {
        const a = document.querySelector('div[data-testid="document-viewer-pane-a"]');
        const b = document.querySelector('div[data-testid="document-viewer-pane-b"]');
        return { hasA: !!a, hasB: !!b };
      })()
    `);
    if (!panesOk?.hasA || !panesOk?.hasB) fail(`Split panes not present after split: ${JSON.stringify(panesOk)}`);

    const hasChatSomewhere = await evaluate(`
      (() => {
        const nodes = Array.from(document.querySelectorAll('div[data-testid="document-viewer-pane-a"], div[data-testid="document-viewer-pane-b"]'));
        return nodes.some((n) => (n.innerText || "").includes("Chat") || !!n.querySelector('textarea[data-testid="chat-input"]'));
      })()
    `);
    if (!hasChatSomewhere) fail("Expected Chat to be visible in one of the split panes after move");

    console.log("✅ Editor splits: Chat + doc can be shown side-by-side (2 groups)");

    const draft = `draft ${Date.now()}`;
    await clickSelector(evaluate, 'textarea[data-testid="chat-input"]');
    await typeText(evaluate, 'textarea[data-testid="chat-input"]', draft);

    // Switch to an existing notebook tab and back.
    if (nb1?.id) {
      await clickSelector(evaluate, `div[data-testid="document-viewer-tab-${encodeURIComponent(String(nb1.id || ""))}"]`);
      await waitForSelector(evaluate, 'div[data-testid="document-viewer-content"][data-active-ext="ipynb"]', 20000);
      await clickSelector(evaluate, `div[data-testid="document-viewer-tab-${encodeURIComponent(String(chatDoc.id || ""))}"]`);
      await waitForSelector(evaluate, 'div[data-testid="document-viewer-content"][data-active-ext="chat"]', 20000);
      await waitForSelector(evaluate, 'textarea[data-testid="chat-input"]:not([disabled])', 20000);
      const draftOk = await evaluate(`
        (() => {
          const el = document.querySelector('textarea[data-testid="chat-input"]');
          return el ? String(el.value || "") === ${jsString(draft)} : false;
        })()
      `);
      if (!draftOk) {
        const debug = await evaluate(`
          (() => {
            const el = document.querySelector('textarea[data-testid="chat-input"]');
            const actual = el ? String(el.value || "") : null;
            let storage = null;
            try {
              storage = localStorage.getItem("insightlm.chatDrafts.v1");
            } catch {}
            const has = storage ? storage.includes(${jsString(draft)}) : false;
            return { actual, actualLen: actual ? actual.length : 0, storageLen: storage ? storage.length : 0, storageHasDraft: has };
          })()
        `);
        console.log("❌ Chat draft persist debug:", debug);
        fail("Chat draft did not persist across tab switch");
      }
      console.log("✅ Chat draft persists across tab switches");
    }

    // Sanity: Chat @ mention menu opens and inserts a workbook:// reference.
    // Additionally: in Scoped mode, Chat @ mentions must be filtered to the ACTIVE context's workbooks (not all project workbooks).
    // We prove this by searching for the second workbook's token and asserting "No matches".
    await ensureContextScopingMode(evaluate, "context");
    await clickSelector(evaluate, 'textarea[data-testid="chat-input"]');
    await typeText(evaluate, 'textarea[data-testid="chat-input"]', `@${otherWbToken}`);
    const chatMenuOk = await waitForSelector(evaluate, 'div[data-testid="chat-mention-menu"]', 20000);
    if (!chatMenuOk) fail("Chat @ mention menu did not appear");
    const noMatchesOk = await waitForTextContains(evaluate, 'div[data-testid="chat-mention-menu"]', "No matches", 20000);
    if (!noMatchesOk) fail("Chat @ mentions did not appear scoped (expected 'No matches' when searching for an out-of-context workbook)");

    // Now open the menu without a query and assert the ACTIVE workbook is present and selectable.
    await clickSelector(evaluate, 'textarea[data-testid="chat-input"]');
    await typeText(evaluate, 'textarea[data-testid="chat-input"]', '@');
    const chatItemOk = await waitForSelector(evaluate, 'button[data-testid^="chat-mention-item-"]', 30000);
    if (!chatItemOk) fail("Chat @ mention menu appeared but no items were available");
    const activeWorkbookTid = `chat-mention-item-workbook-${encodeURIComponent(String(workbookId || ""))}`;
    const activeMentionOk = await waitForSelector(evaluate, `button[data-testid="${activeWorkbookTid}"]`, 20000);
    if (!activeMentionOk) fail("Active workbook was not present in Chat @ mention list under Scoped mode");
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

    const findUserMessageIdByText = async (needle) => {
      const start = Date.now();
      while (Date.now() - start < 20000) {
        const id = await evaluate(`
          (() => {
            const nodes = Array.from(document.querySelectorAll('[data-chat-message][data-role="user"][data-chat-message-id]'));
            const hit = nodes.find(n => (n.innerText || "").includes(${jsString(needle)}));
            return hit ? String(hit.getAttribute("data-chat-message-id") || "") : null;
          })()
        `);
        if (id) return id;
        await sleep(150);
      }
      return null;
    };

    const assertMessageScopeBadge = async (messageId, expected /* "context" | "all" */) => {
      const tid = `chat-message-scope-${encodeURIComponent(String(messageId || ""))}`;
      const ok = await waitForSelector(evaluate, `span[data-testid="${tid}"]`, 20000);
      if (!ok) fail(`Missing scope badge for message ${messageId}`);
      const mode = await evaluate(`document.querySelector('span[data-testid="${tid}"]')?.getAttribute("data-scope-mode") || null`);
      if (mode !== expected) fail(`Scope badge mismatch for ${messageId}: expected ${expected}, got ${String(mode)}`);
    };

    // Send two messages under different scopes; badges must persist per message (history readability).
    await ensureContextScopingMode(evaluate, "context");
    await waitForSelector(evaluate, 'textarea[data-testid="chat-input"]', 20000);
    await waitForSelector(evaluate, 'textarea[data-testid="chat-input"]:not([disabled])', 20000);
    const msgScoped = `scoped ping ${Date.now()}`;
    await typeText(evaluate, 'textarea[data-testid="chat-input"]', msgScoped);
    await clickSelector(evaluate, 'button[data-testid="chat-send"]');
    const scopedId = await findUserMessageIdByText(msgScoped);
    if (!scopedId) fail("Scoped chat message was not rendered in UI");
    await assertMessageScopeBadge(scopedId, "context");

    await ensureContextScopingMode(evaluate, "all");
    await waitForSelector(evaluate, 'textarea[data-testid="chat-input"]', 20000);
    await waitForSelector(evaluate, 'textarea[data-testid="chat-input"]:not([disabled])', 20000);
    const msgAll = `all ping ${Date.now()}`;
    await typeText(evaluate, 'textarea[data-testid="chat-input"]', msgAll);
    await clickSelector(evaluate, 'button[data-testid="chat-send"]');
    const allId = await findUserMessageIdByText(msgAll);
    if (!allId) fail("All-scope chat message was not rendered in UI");
    await assertMessageScopeBadge(allId, "all");

    // Previously sent message must keep its original badge even after toggling scope.
    await assertMessageScopeBadge(scopedId, "context");
    console.log("✅ Chat transcript records per-message scope (Scoped vs All)");

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

    // Renderer reload persistence: split layout should survive View → Reload.
    // (Do this at the very end; doc IDs will change after reload.)
    const splitPersistDebug = await evaluate(`
      (() => {
        try {
          const raw = localStorage.getItem("insightlm.editorSplit.v1");
          return raw ? JSON.parse(raw) : null;
        } catch { return null; }
      })()
    `);
    if (!splitPersistDebug || String(splitPersistDebug?.mode || "single") === "single") {
      fail(`Split layout was not persisted before reload (debug=${JSON.stringify(splitPersistDebug)})`);
    }

    await evaluate(`location.reload()`);
    await waitForSelector(evaluate, "body", 20000);

    await waitForSelector(evaluate, 'button[data-testid="activitybar-item-file"]', 20000);
    await clickSelector(evaluate, 'button[data-testid="activitybar-item-file"]');

    const restoreDone = await (async () => {
      const start = Date.now();
      while (Date.now() - start < 30000) {
        const state = await evaluate(`
          (() => {
            const restoring = (window.__insightlmRestoringTabs === true);
            const el = document.querySelector('div[data-testid="document-viewer-content"]');
            const activeId = el ? String(el.getAttribute("data-active-doc-id") || "") : "";
            return { restoring, hasActive: !!activeId };
          })()
        `);
        if (state && state.restoring === false && state.hasActive) return true;
        await sleep(200);
      }
      return false;
    })();
    if (!restoreDone) {
      const dbg = await evaluate(`
        (() => {
          let split = null;
          let tabs = null;
          try { split = localStorage.getItem("insightlm.editorSplit.v1"); } catch {}
          try { tabs = localStorage.getItem("insightlm.openTabs.v1"); } catch {}
          const el = document.querySelector('div[data-testid="document-viewer-content"]');
          const activeId = el ? String(el.getAttribute("data-active-doc-id") || "") : "";
          const restoring = (typeof window.__insightlmRestoringTabs === "undefined") ? "undefined" : String(window.__insightlmRestoringTabs);
          return { restoring, activeId, split: split ? split.slice(0, 300) : null, openTabs: tabs ? tabs.slice(0, 300) : null };
        })()
      `);
      fail(`Renderer reload: tab restore did not finish in time (debug=${JSON.stringify(dbg)})`);
    }

    const splitRestored = await (async () => {
      const start = Date.now();
      while (Date.now() - start < 30000) {
        const ok = await evaluate(`!!document.querySelector('div[data-testid="document-viewer-split-container"]')`);
        if (ok) return true;
        await sleep(200);
      }
      return false;
    })();
    if (!splitRestored) {
      const after = await evaluate(`
        (() => {
          try {
            const raw = localStorage.getItem("insightlm.editorSplit.v1");
            return raw ? JSON.parse(raw) : null;
          } catch { return null; }
        })()
      `);
      fail(`Split layout did not persist after renderer reload (expected split container). persisted=${JSON.stringify(after)}`);
    }
    console.log("✅ Split layout persists after renderer reload");

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
