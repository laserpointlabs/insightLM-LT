import { useEffect, useMemo, useRef, useState } from "react";

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
  mentionItems = [],
  onEnterWhenMenuOpen,
  onEnter,
}: MentionTextInputProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mentionState, setMentionState] = useState<{ start: number; query: string } | null>(null);

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
    const before = value.slice(0, ms.start);
    const after = value.slice(caret);
    const inserted = `${before}${item.insertText} ${after}`;
    const nextCaret = (before + item.insertText + " ").length;
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

  return (
    <div className={`relative ${containerClassName || ""}`}>
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
            if (!menuOpen) {
              // In multiline mode:
              // - Enter inserts newline (default browser behavior)
              // - Ctrl/Cmd+Enter triggers submit
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

      {menuOpen && mentionState && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-full max-h-64 overflow-auto rounded border border-gray-200 bg-white shadow-lg"
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
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {it.kind === "workbook" ? "📚" : it.kind === "folder" ? "📁" : "📄"}{" "}
                    {it.label}
                  </span>
                  <span className="font-mono text-[10px] text-gray-400 truncate">{it.insertText}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-gray-500">
              {mentionItems.length === 0 ? "Loading workbooks…" : "No matches"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
