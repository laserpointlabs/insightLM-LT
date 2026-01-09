import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type MentionKind = "workbook" | "folder" | "file";

export interface MentionItem {
  kind: MentionKind;
  id: string;
  label: string;
  insertText: string;
  searchText?: string;
}

interface MentionTextInputProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /**
   * Applied to the outer container (so parent layouts can flex/size the control).
   * `className` continues to apply to the input/textarea element for styling.
   */
  containerClassName?: string;
  className?: string;
  multiline?: boolean;
  rows?: number;
  inputTestId?: string;
  menuTestId?: string;
  itemTestId?: (item: MentionItem) => string;
  /**
   * Optional callback invoked when a mention item is selected.
   * Useful for "chip" UX (Cursor-style) where refs are rendered separately from the raw text.
   */
  onSelectMention?: (item: MentionItem) => void;
  /**
   * Provide a custom replacement string for the selected mention.
   * This replaces the current "@query" token (from "@" to caret) with the returned string.
   * Return null to keep the input unchanged.
   */
  getMentionReplacementText?: (item: MentionItem) => string | null;
  /**
   * Optional inline overlay renderer for advanced UX (e.g., inline chips).
   * Rendered inside the input container (absolute inset-0).
   */
  renderOverlay?: (value: string) => React.ReactNode;
  overlayClassName?: string;
  /**
   * Provides the universe of mention items (workbooks/folders/files).
   * The component filters client-side based on the currently typed query after '@'.
   */
  mentionItems?: MentionItem[];
  /**
   * Called when the user presses Enter while the mention menu is open and no item is selected.
   * Useful to prevent form submits when the menu is open.
   */
  onEnterWhenMenuOpen?: () => void;
  /**
   * Called when the user presses Enter while the mention menu is closed.
   */
  onEnter?: () => void;
  /**
   * Multiline Enter behavior.
   * - "newline": Enter inserts newline (default), Ctrl/Cmd+Enter submits
   * - "send": Enter submits, Shift+Enter inserts newline
   */
  enterBehavior?: "newline" | "send";
  /**
   * Autosize the textarea height to fit content up to maxRows.
   * (Only applies when multiline=true)
   */
  autosize?: boolean;
  /**
   * Maximum rows for autosize (beyond this, textarea scrolls).
   */
  maxRows?: number;
}

function getMentionQuery(
  value: string,
  caret: number,
): { start: number; query: string } | null {
  const upto = value.slice(0, caret);
  const at = upto.lastIndexOf("@");
  if (at < 0) return null;
  // Require start-of-string or whitespace before '@' to avoid emails/paths.
  if (at > 0 && /\S/.test(upto[at - 1])) return null;
  const query = upto.slice(at + 1);
  // Stop if query contains whitespace (we only typeahead within a single token).
  if (/\s/.test(query)) return null;
  return { start: at, query };
}

export function MentionTextInput({
  value,
  onChange,
  disabled,
  placeholder,
  containerClassName,
  className,
  multiline,
  rows = 3,
  inputTestId,
  menuTestId,
  itemTestId,
  onSelectMention,
  getMentionReplacementText,
  renderOverlay,
  overlayClassName,
  mentionItems = [],
  onEnterWhenMenuOpen,
  onEnter,
  enterBehavior = "newline",
  autosize = false,
  maxRows = 8,
}: MentionTextInputProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mentionState, setMentionState] = useState<{ start: number; query: string } | null>(null);
  const [menuDirection, setMenuDirection] = useState<"down" | "up">("down");
  const [menuPos, setMenuPos] = useState<null | { top: number; left: number; width: number }>(null);

  const filtered = useMemo(() => {
    if (!mentionState) return [];
    const q = mentionState.query.trim().toLowerCase();
    const items = mentionItems;
    if (!q) return items.slice(0, 20);
    return items
      .filter((it) => {
        const hay = `${it.label} ${it.searchText || ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 20);
  }, [mentionItems, mentionState]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (inputRef.current?.contains(t)) return;
      // If click is inside menu, keep open. We'll rely on stopPropagation in the menu.
      const menuEl = document.querySelector(menuTestId ? `[data-testid="${menuTestId}"]` : "");
      if (menuEl && menuEl.contains(t)) return;
      setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [menuOpen, menuTestId]);

  // Flip the mention menu upward when there isn't enough space below the input.
  // This is critical for sidebar Chat (composer at bottom) and keeps the menu visible.
  useEffect(() => {
    if (!menuOpen) return;

    const updatePlacement = () => {
      const host = containerRef.current;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
      const viewportW = window.innerWidth || document.documentElement.clientWidth || 0;

      const estimatedMenuH = Math.min(
        256,
        menuRef.current?.getBoundingClientRect().height || 256,
      );
      const margin = 8; // ~mt-1/mb-1 + breathing room

      const spaceBelow = viewportH - rect.bottom;
      const spaceAbove = rect.top;

      // Prefer opening upward if we'd clip below and there's more room above.
      const direction =
        spaceBelow < estimatedMenuH + margin && spaceAbove > spaceBelow ? "up" : "down";
      setMenuDirection(direction);

      // Position the menu in a portal (fixed) so it isn't clipped by overflow containers
      // and it layers above headers/other panes.
      const rawLeft = rect.left;
      const rawWidth = rect.width;
      const left = Math.max(4, Math.min(rawLeft, Math.max(4, viewportW - rawWidth - 4)));
      const top =
        direction === "down"
          ? Math.min(viewportH - 4, rect.bottom + 4)
          : Math.max(4, rect.top - estimatedMenuH - 4);
      setMenuPos({ top, left, width: rawWidth });
    };

    // Defer until after menu renders so we can measure its height.
    const t = window.setTimeout(updatePlacement, 0);
    window.addEventListener("resize", updatePlacement);
    // Use capture to catch scrolls in nested scroll containers.
    window.addEventListener("scroll", updatePlacement, true);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [menuOpen, filtered.length]);

  const refreshMentionState = () => {
    const el = inputRef.current;
    if (!el) return;
    // Some programmatic value updates (automation, paste flows) can leave the caret at 0.
    // Treat that case as "end of input" so @ menus open deterministically.
    const rawCaret = el.selectionStart ?? value.length;
    const caret = rawCaret === 0 && value.length > 0 ? value.length : rawCaret;
    const ms = getMentionQuery(value, caret);
    setMentionState(ms);
    const shouldOpen = !!ms;
    setMenuOpen(shouldOpen);
    if (shouldOpen) setActiveIndex(0);
  };

  // If the menu is open but items arrive asynchronously (e.g., workbooks load),
  // refresh the mention state so the list appears without requiring another click.
  useEffect(() => {
    if (!inputRef.current) return;
    if (document.activeElement !== inputRef.current) return;
    // Only refresh when the user is currently in an @ token.
    setTimeout(refreshMentionState, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentionItems.length]);

  const insertMention = (item: MentionItem) => {
    const el = inputRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? value.length;
    const ms = getMentionQuery(value, caret);
    if (!ms) return;
    // Inform parent first (allows "chip" UX to capture the selection deterministically).
    onSelectMention?.(item);

    const before = value.slice(0, ms.start);
    const after = value.slice(caret);
    const replacement =
      typeof getMentionReplacementText === "function"
        ? getMentionReplacementText(item)
        : item.insertText;
    if (replacement == null) {
      setMenuOpen(false);
      setMentionState(null);
      return;
    }
    const rep = String(replacement);
    // If replacement is empty, remove the "@query" token entirely and keep the rest unchanged.
    // Otherwise, insert replacement and add a single trailing space (unless already present).
    const needsSpace = rep.length > 0 && after.length > 0 ? !after.startsWith(" ") : rep.length > 0;
    const inserted = rep.length === 0 ? `${before}${after}` : `${before}${rep}${needsSpace ? " " : ""}${after}`;
    const nextCaret = rep.length === 0 ? before.length : (before + rep + (needsSpace ? " " : "")).length;
    onChange(inserted);
    // Restore caret after React updates.
    setTimeout(() => {
      try {
        el.focus();
        el.setSelectionRange(nextCaret, nextCaret);
      } catch {
        // ignore
      }
    }, 0);
    setMenuOpen(false);
    setMentionState(null);
  };

  const autosizeTextarea = () => {
    const el = inputRef.current;
    if (!multiline) return;
    if (!autosize) return;
    if (!el) return;
    // Only textarea supports height adjustment.
    if (!(el instanceof HTMLTextAreaElement)) return;
    try {
      const cs = window.getComputedStyle(el);
      const lineHeightRaw = cs.lineHeight;
      const lineHeight =
        lineHeightRaw && lineHeightRaw !== "normal" ? parseFloat(lineHeightRaw) : 20;
      const padTop = parseFloat(cs.paddingTop || "0") || 0;
      const padBottom = parseFloat(cs.paddingBottom || "0") || 0;
      const borderTop = parseFloat(cs.borderTopWidth || "0") || 0;
      const borderBottom = parseFloat(cs.borderBottomWidth || "0") || 0;
      const maxH = Math.max(1, (lineHeight || 20) * Math.max(1, maxRows) + padTop + padBottom + borderTop + borderBottom);

      el.style.height = "auto";
      const next = Math.min(el.scrollHeight, maxH);
      el.style.height = `${next}px`;
      el.style.overflowY = el.scrollHeight > maxH ? "auto" : "hidden";
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!multiline) return;
    if (!autosize) return;
    // Defer until after React applies value so scrollHeight is correct.
    const t = window.setTimeout(() => autosizeTextarea(), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, multiline, autosize, maxRows]);

  return (
    <div ref={containerRef} className={`relative ${containerClassName || ""}`}>
      {renderOverlay && (
        <div className={`absolute inset-0 ${overlayClassName || ""}`}>
          {renderOverlay(value)}
        </div>
      )}
      {multiline ? (
        <textarea
          ref={inputRef as any}
          value={value}
          rows={rows}
          onChange={(e) => {
            const next = e.target.value;
            onChange(next);
            const caret = (e.target as HTMLTextAreaElement).selectionStart ?? next.length;
            const ms = getMentionQuery(next, caret);
            setMentionState(ms);
            setMenuOpen(!!ms);
            if (ms) setActiveIndex(0);
          }}
          onKeyDown={(e) => {
            // IME-safe: don't submit while composing.
            // keyCode 229 is common for IME composition events.
            if ((e as any).isComposing || (e as any).keyCode === 229) return;
            if (!menuOpen) {
              if (enterBehavior === "send") {
                // Chat-style: Enter submits, Shift+Enter inserts newline.
                if (e.key === "Enter" && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault();
                  onEnter?.();
                }
                return;
              }
              // Default: Enter inserts newline; Ctrl/Cmd+Enter submits.
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                onEnter?.();
              }
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              // In menu: Enter selects mention, prevents newline.
              e.preventDefault();
              if (filtered[activeIndex]) insertMention(filtered[activeIndex]);
              else onEnterWhenMenuOpen?.();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setMenuOpen(false);
            }
          }}
          onClick={() => setTimeout(refreshMentionState, 0)}
          onKeyUp={() => setTimeout(refreshMentionState, 0)}
          onInput={() => autosizeTextarea()}
          disabled={disabled}
          placeholder={placeholder}
          className={className}
          data-testid={inputTestId}
        />
      ) : (
        <input
          ref={inputRef as any}
          type="text"
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            onChange(next);
            const caret = (e.target as HTMLInputElement).selectionStart ?? next.length;
            const ms = getMentionQuery(next, caret);
            setMentionState(ms);
            setMenuOpen(!!ms);
            if (ms) setActiveIndex(0);
          }}
          onKeyDown={(e) => {
            if (!menuOpen) {
              if (e.key === "Enter") {
                onEnter?.();
              }
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (filtered[activeIndex]) insertMention(filtered[activeIndex]);
              else onEnterWhenMenuOpen?.();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setMenuOpen(false);
            }
          }}
          onClick={() => setTimeout(refreshMentionState, 0)}
          onKeyUp={() => setTimeout(refreshMentionState, 0)}
          disabled={disabled}
          placeholder={placeholder}
          className={className}
          data-testid={inputTestId}
        />
      )}

      {menuOpen &&
        mentionState &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            className="max-h-64 overflow-auto rounded border border-gray-200 bg-white shadow-lg"
            style={{
              position: "fixed",
              top: menuPos?.top ?? 0,
              left: menuPos?.left ?? 0,
              width: menuPos?.width ?? 0,
              zIndex: 10000,
            }}
            data-testid={menuTestId}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {filtered.length > 0 ? (
              filtered.map((it, idx) => (
                <button
                  type="button"
                  key={`${it.kind}:${it.id}`}
                  className={`block w-full px-3 py-2 text-left text-xs hover:bg-gray-100 ${
                    idx === activeIndex ? "bg-gray-100" : ""
                  }`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={(e) => {
                    e.preventDefault();
                    insertMention(it);
                  }}
                  data-testid={itemTestId ? itemTestId(it) : undefined}
                  title={`${it.label}\n${it.insertText}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="shrink-0">
                      {it.kind === "workbook" ? "📚" : it.kind === "folder" ? "📁" : "📄"}
                    </span>
                    {/* Show the full human-friendly name; wrap instead of truncating. */}
                    <span className="flex-1 break-words leading-snug">{it.label}</span>
                    {/* Truncate the raw workbook://... insert text; full value is available on hover via title. */}
                    <span
                      className="max-w-[45%] shrink-0 truncate font-mono text-[10px] text-gray-400"
                      title={it.insertText}
                    >
                      {it.insertText}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-gray-500">
                {mentionItems.length === 0 ? "Loading workbooks…" : "No matches"}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
