import { useState, useRef, useEffect } from "react";
import { DashboardQuery } from "../../types/dashboard";
import { useDashboardStore } from "../../store/dashboardStore";
import { useWorkbookStore } from "../../store/workbookStore";
import { dashboardService } from "../../services/dashboardService";
import { DashboardResults } from "./DashboardResults";
import { testIds } from "../../testing/testIds";
import { InputDialog } from "../InputDialog";

interface DashboardTileProps {
  query: DashboardQuery;
  dashboardId: string;
  onDragStart: (queryId: string, initialPosition: { x: number; y: number }, size: { width: number; height: number }) => void;
  onDragMove: (queryId: string, x: number, y: number) => void;
  onDragEnd: (queryId: string, gridX: number, gridY: number) => void;
  onSizeChange: (queryId: string, size: "small" | "medium" | "large" | "full-width") => void;
}

// Grid constants - shared across the component
const GRID_COLUMN_SIZE = 200;
const GRID_ROW_HEIGHT = 180; // Height of each grid row (smaller than column width for tighter spacing)
const GRID_GAP = 16;

export function DashboardTile({
  query,
  dashboardId,
  onDragStart,
  onDragMove,
  onDragEnd,
  onSizeChange,
}: DashboardTileProps) {
  const { updateQuery, removeQuery, dashboards } = useDashboardStore();
  const { workbooks } = useWorkbookStore();

  // Get the CURRENT query from store to ensure we have latest position
  const currentQuery = dashboards
    .find(d => d.id === dashboardId)
    ?.queries.find(q => q.id === query.id) || query;
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(query.result);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartMousePos, setDragStartMousePos] = useState({ x: 0, y: 0 }); // Mouse position at drag start
  const [dragStartTilePos, setDragStartTilePos] = useState({ x: 0, y: 0 }); // Tile pixel position at drag start
  const [dragStartGridPos, setDragStartGridPos] = useState({ x: 0, y: 0 }); // Tile grid position at drag start
  const [hasMoved, setHasMoved] = useState(false); // Track if mouse actually moved during drag
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(query.title || query.question);
  const [showExplain, setShowExplain] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [sizePickerOpen, setSizePickerOpen] = useState(false);
  const [vizPickerOpen, setVizPickerOpen] = useState(false);
  const [chartPickerOpen, setChartPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editQuestionDialogOpen, setEditQuestionDialogOpen] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState(currentQuery.question);
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);

  // Sync local result state with store when query.result updates externally
  // This handles cases where results are updated via handleRefreshAll or other external updates
  useEffect(() => {
    // Sync local state with store value whenever it changes
    // This ensures UI updates when handleRefreshAll or other external updates occur
    const storeResult = currentQuery.result;
    setResult(storeResult);
    // Clear error when result is updated externally (successful refresh)
    if (storeResult !== undefined) {
      setError(null);
    }
  }, [currentQuery.result]);

  useEffect(() => {
    // Auto-run query on mount if no result
    if (!result && !currentQuery.result) {
      runQuery();
    }
  }, []);

  const computeTileType = (q: DashboardQuery) =>
    q.tileType ||
    (q.queryType === "date_range"
      ? "counter_warning"
      : q.queryType === "filter"
        ? "table"
        : q.queryType === "aggregate"
          ? "graph"
          : "counter");

  const runQuery = async (
    overrideQuestion?: string,
    overrideTileType?: DashboardQuery["tileType"],
  ) => {
    setIsRunning(true);
    setError(null);
    try {
      const q = currentQuery;
      const tileType = overrideTileType || computeTileType(q);
      const questionToRun = (overrideQuestion ?? q.question).trim();
      if (!questionToRun) {
        setError("Question cannot be empty");
        setResult(undefined);
        return;
      }

      // Execute query via MCP Dashboard Server (new prompt manager flow)
      if (window.electronAPI?.mcp?.dashboardQuery) {
        const response = await window.electronAPI.mcp.dashboardQuery(
          questionToRun,
          tileType
        );

        if (response && response.success && response.result) {
          const nextRes = (() => {
            const r = response.result as any;
            if (r && r.type === "graph" && q.graphChartType) {
              return { ...r, chartType: q.graphChartType };
            }
            return r;
          })();
          setResult(nextRes);
          setError(null);
          updateQuery(dashboardId, q.id, {
            result: nextRes,
            lastRun: new Date().toISOString(),
            ...(overrideTileType ? { tileType: overrideTileType } : {}),
          });
        } else if (response && response.error) {
          setError(response.error);
          setResult(undefined);
        }
      } else {
        // Fallback to legacy implementation
        const queryResult = await dashboardService.executeQuery({ ...currentQuery, question: questionToRun }, workbooks);
        const nextRes = (() => {
          const r = queryResult as any;
          if (r && r.type === "graph" && q.graphChartType) {
            return { ...r, chartType: q.graphChartType };
          }
          return r;
        })();
        setResult(nextRes);
        setError(null);
        updateQuery(dashboardId, currentQuery.id, {
          result: nextRes,
          lastRun: new Date().toISOString(),
          ...(overrideTileType ? { tileType: overrideTileType } : {}),
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Failed to run query:", err);
      setError(errorMessage);
      setResult(undefined);
    } finally {
      setIsRunning(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start drag on double-click (for title editing)
    if (e.detail === 2) {
      return;
    }

    // Only allow dragging from the header area (but not buttons/selects/title text)
    if (e.target instanceof HTMLElement) {
      const isButton = e.target.closest('button') || e.target.closest('select') || e.target.closest('input');
      const isTitleText = e.target.closest('.title-text');
      if (isButton || isTitleText) {
        return; // Don't start drag if clicking a button, select, input, or title text
      }
      // Only allow dragging from the header
      if (!e.target.closest('.tile-header')) {
        return;
      }
    }

    if (!tileRef.current?.parentElement) return;

    const tileRect = tileRef.current.getBoundingClientRect();
    const containerRect = tileRef.current.parentElement.getBoundingClientRect();

    // Get mouse position in container coordinates at drag start
    const mouseXInContainer = e.clientX - containerRect.left;
    const mouseYInContainer = e.clientY - containerRect.top;

    // Get tile size
    const tileSize = getTileSize();
    // Large tiles are now 3 columns wide (not 2)
    const width = tileSize === "small" ? 1 : tileSize === "medium" ? 2 : tileSize === "large" ? 3 : 4;
    const height = tileSize === "large" ? 2 : 1;
    const tileWidth = width * GRID_COLUMN_SIZE + (width - 1) * GRID_GAP;
    const tileHeight = height * GRID_ROW_HEIGHT + (height - 1) * GRID_GAP;

    // Get tile's current grid position from store
    const gridPosition = currentQuery.tilePosition || { x: 0, y: 0 };

    // Convert grid position to pixel position
    const pixelX = gridPosition.x * (GRID_COLUMN_SIZE + GRID_GAP);
    const pixelY = gridPosition.y * (GRID_ROW_HEIGHT + GRID_GAP);

    // Store the mouse position, tile pixel position, and grid position at drag start
    setDragStartMousePos({ x: mouseXInContainer, y: mouseYInContainer });
    setDragStartTilePos({ x: pixelX, y: pixelY });
    setDragStartGridPos({ x: gridPosition.x, y: gridPosition.y });
    setIsDragging(true);
    setHasMoved(false);

    // Notify parent to show drag preview at tile's current position
    onDragStart(query.id, { x: pixelX, y: pixelY }, { width: tileWidth, height: tileHeight });
  };

  useEffect(() => {
    if (!isDragging || !tileRef.current?.parentElement) {
      return;
    }

    const gridCellSizeX = GRID_COLUMN_SIZE + GRID_GAP;
    const gridCellSizeY = GRID_ROW_HEIGHT + GRID_GAP;

    // Capture start positions
    const startMousePos = { ...dragStartMousePos };
    const startTilePos = { ...dragStartTilePos };
    const startGridPos = { ...dragStartGridPos };

    const handleMouseMove = (e: MouseEvent) => {
      // Mark that mouse has moved
      setHasMoved(true);

      // Get current mouse position in container coordinates
      const containerRect = tileRef.current!.parentElement!.getBoundingClientRect();
      const mouseX = e.clientX - containerRect.left;
      const mouseY = e.clientY - containerRect.top;

      // Calculate how far the mouse has moved from the start position
      const deltaX = mouseX - startMousePos.x;
      const deltaY = mouseY - startMousePos.y;

      // New tile position = start position + mouse delta
      const visualX = startTilePos.x + deltaX;
      const visualY = startTilePos.y + deltaY;

      // Update preview position
      onDragMove(query.id, visualX, visualY);
    };

    const handleMouseUp = (e: MouseEvent) => {
      // Only update position if mouse actually moved during drag
      if (hasMoved) {
        // Calculate final grid position on release
        const containerRect = tileRef.current?.parentElement?.getBoundingClientRect();
        if (!containerRect) {
          setIsDragging(false);
          setHasMoved(false);
          return;
        }

        const mouseX = e.clientX - containerRect.left;
        const mouseY = e.clientY - containerRect.top;

        // Calculate delta from start
        const deltaX = mouseX - startMousePos.x;
        const deltaY = mouseY - startMousePos.y;

        // Final tile position
        const finalX = startTilePos.x + deltaX;
        const finalY = startTilePos.y + deltaY;

        // Convert to grid coordinates (round to nearest grid cell)
        const finalGridX = Math.max(0, Math.round(finalX / gridCellSizeX));
        const finalGridY = Math.max(0, Math.round(finalY / gridCellSizeY));

        // Notify parent to move tile and hide preview
        onDragEnd(query.id, finalGridX, finalGridY);
      } else {
        // User just clicked without dragging - cancel drag without moving tile
        // Use the grid position captured at drag start to avoid stale closure issues
        onDragEnd(query.id, startGridPos.x, startGridPos.y);
      }

      setIsDragging(false);
      setHasMoved(false);
    };

    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, dragStartMousePos.x, dragStartMousePos.y, dragStartTilePos.x, dragStartTilePos.y, dragStartGridPos.x, dragStartGridPos.y, query.id, onDragMove, onDragEnd, hasMoved]);

  const handleTitleDoubleClick = () => {
    setIsEditingTitle(true);
    setEditedTitle(query.title || query.question);
  };

  const handleTitleSave = () => {
    updateQuery(dashboardId, query.id, {
      title: editedTitle.trim() || undefined, // Empty string becomes undefined
    });
    setIsEditingTitle(false);
  };

  const handleTitleCancel = () => {
    setEditedTitle(query.title || query.question);
    setIsEditingTitle(false);
  };

  // Determine tile size based on query type and result
  const getTileSize = (): "small" | "medium" | "large" | "full-width" => {
    if (query.tileSize) return query.tileSize;

    // Auto-determine based on query type and result
    if (query.queryType === "count" || result?.chartType === "card") {
      return "small"; // Count tiles are small
    }
    if (query.queryType === "filter" || result?.chartType === "table") {
      return "full-width"; // Lists are full-width
    }
    if (result?.chartType === "bar" || result?.chartType === "line" || result?.chartType === "pie") {
      return "medium"; // Graphs are medium
    }
    return "medium"; // Default
  };

  const tileSize = getTileSize();
  const displayTitle = query.title || query.question;
  const sources = Array.isArray((result as any)?.sources) ? ((result as any).sources as any[]) : [];
  const isCompactHeader = tileSize === "small" || tileSize === "medium";
  const forceVisibleControls =
    typeof document !== "undefined" && document.body?.dataset?.automationMode === "true";

  const cycleSize = () => {
    const order: Array<"small" | "medium" | "large" | "full-width"> = ["small", "medium", "large", "full-width"];
    const idx = Math.max(0, order.indexOf(tileSize));
    const next = order[(idx + 1) % order.length];
    onSizeChange(query.id, next);
  };

  const sizeLabel = tileSize === "full-width" ? "W" : tileSize === "large" ? "L" : tileSize === "medium" ? "M" : "S";

  // Close the tile menu on outside click / Escape without blocking the UI with a backdrop.
  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setSizePickerOpen(false);
        setVizPickerOpen(false);
        setChartPickerOpen(false);
        setShowExplain(false);
        setShowSources(false);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (menuButtonRef.current?.contains(t)) return;
      if (menuPanelRef.current?.contains(t)) return;
      setMenuOpen(false);
      setSizePickerOpen(false);
      setVizPickerOpen(false);
      setChartPickerOpen(false);
    };

    // Capture phase to win against other handlers (drag, etc.)
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [menuOpen]);

  // Also allow Escape to exit Explain/Sources back to results, even when the menu isn't open.
  useEffect(() => {
    if (!showExplain && !showSources) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowExplain(false);
        setShowSources(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showExplain, showSources]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if this tile's container is focused or hovered
      if (tileRef.current?.matches(':hover') && e.key === 'Delete') {
        e.preventDefault();
        removeQuery(dashboardId, query.id).catch(err => {
          console.error("Failed to remove query:", err);
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dashboardId, query.id, removeQuery]);

  return (
    <div
      ref={tileRef}
      className={`rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md h-full flex flex-col ${
        isDragging ? "shadow-lg opacity-90 z-50" : ""
      }`}
      style={{
        cursor: isDragging ? "grabbing" : "default",
        maxWidth: "100%", // Ensure tile never exceeds its container width
        boxSizing: "border-box", // Include padding/borders in width calculation
      }}
      tabIndex={0}
      data-testid={testIds.dashboards.tile.container(query.id)}
    >
      {/* Tile Header */}
      <div
        className="tile-header group flex items-start justify-between gap-2 overflow-visible border-b border-gray-200 bg-gray-50 px-3 py-2 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        <div className="min-w-0 flex-1 title-text overflow-hidden" onDoubleClick={handleTitleDoubleClick}>
          {isEditingTitle ? (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleTitleSave();
                } else if (e.key === "Escape") {
                  handleTitleCancel();
                }
              }}
              className="text-sm font-semibold text-gray-800 w-full px-1 py-0.5 border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="Enter short title..."
            />
          ) : (
            <div className="relative cursor-text">
              <h3
                className="text-sm font-semibold text-gray-800 truncate"
                title={`Double-click to edit\n\nTitle: ${displayTitle}\nQuestion: ${query.question}`}
              >
                {displayTitle}
              </h3>
            </div>
          )}
          <div className="mt-0.5 text-[11px] text-gray-500 truncate" title={query.question}>
            <span className="capitalize">{query.queryType}</span>
            {query.lastRun && ` • ${new Date(query.lastRun).toLocaleTimeString()}`}
          </div>
        </div>
        <div className="relative flex shrink-0 items-center">
          <button
            ref={menuButtonRef}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className={`rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 hover:text-gray-900 ${
              forceVisibleControls ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
            title="Actions"
            data-testid={testIds.dashboards.tile.menu(query.id)}
          >
            ⋯
          </button>

          {menuOpen && (
            <>
              <div
                className="absolute right-0 top-full z-50 mt-1 w-56 max-h-72 overflow-auto rounded border border-gray-200 bg-white py-1 shadow-lg"
                data-testid={testIds.dashboards.tile.menuPanel(query.id)}
                ref={menuPanelRef}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSizePickerOpen(false);
                    setVizPickerOpen((v) => !v);
                  }}
                  data-testid={testIds.dashboards.tile.vizSelect(query.id)}
                >
                  Visualization:{" "}
                  {(computeTileType(currentQuery) || "counter") === "counter_warning"
                    ? "Counter (warning)"
                    : (computeTileType(currentQuery) || "counter") === "counter"
                      ? "Counter"
                      : (computeTileType(currentQuery) || "counter") === "table"
                        ? "Table"
                        : (computeTileType(currentQuery) || "counter") === "graph"
                          ? "Graph"
                          : (computeTileType(currentQuery) || "counter") === "text"
                            ? "Text"
                            : (computeTileType(currentQuery) || "counter") === "date"
                              ? "Date"
                              : "Status"}
                </button>
                {vizPickerOpen && (
                  <div className="mt-1 border-t border-gray-100 pt-1">
                    {(
                      ["counter", "table", "graph", "text", "date", "color", "counter_warning"] as const
                    ).map((t) => (
                      <button
                        key={t}
                        className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setVizPickerOpen(false);
                          setSizePickerOpen(false);
                          setMenuOpen(false);
                          updateQuery(dashboardId, query.id, { tileType: t });
                          runQuery(undefined, t);
                        }}
                        data-testid={testIds.dashboards.tile.vizOption(query.id, t)}
                      >
                        {t === "counter_warning"
                          ? "Counter (warning)"
                          : t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
                {/* Chart style picker (only for graph tiles). */}
                {(computeTileType(currentQuery) || "counter") === "graph" && (
                  <>
                    <button
                      className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSizePickerOpen(false);
                        setVizPickerOpen(false);
                        setChartPickerOpen((v) => !v);
                      }}
                      data-testid={testIds.dashboards.tile.chartSelect(query.id)}
                    >
                      Chart: {(currentQuery.graphChartType || (result as any)?.chartType || "bar")}
                    </button>
                    {chartPickerOpen && (
                      <div className="mt-1 border-t border-gray-100 pt-1">
                        {(["bar", "line", "pie"] as const).map((ct) => (
                          <button
                            key={ct}
                            className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setChartPickerOpen(false);
                              setMenuOpen(false);
                              updateQuery(dashboardId, query.id, { graphChartType: ct });
                              setResult((prev: any) => (prev && prev.type === "graph" ? { ...prev, chartType: ct } : prev));
                            }}
                            data-testid={testIds.dashboards.tile.chartOption(query.id, ct)}
                          >
                            {ct.charAt(0).toUpperCase() + ct.slice(1)}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <button
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    setVizPickerOpen(false);
                    setChartPickerOpen(false);
                    runQuery();
                  }}
                  data-testid={testIds.dashboards.tile.refresh(query.id)}
                >
                  Refresh
                </button>
                <button
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    setVizPickerOpen(false);
                    setChartPickerOpen(false);
                    setPendingQuestion(currentQuery.question);
                    setEditQuestionDialogOpen(true);
                  }}
                  data-testid={testIds.dashboards.tile.editQuestion(query.id)}
                >
                  Edit question…
                </button>
                <button
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setVizPickerOpen(false);
                    setChartPickerOpen(false);
                    setSizePickerOpen(true);
                  }}
                  data-testid={testIds.dashboards.tile.sizeSelect(query.id)}
                >
                  Size: {tileSize === "full-width" ? "Full width" : tileSize}
                </button>
                {sizePickerOpen && (
                  <div className="mt-1 border-t border-gray-100 pt-1">
                    {(["small", "medium", "large", "full-width"] as const).map((s) => (
                      <button
                        key={s}
                        className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 ${s === tileSize ? "font-semibold" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSizePickerOpen(false);
                          setMenuOpen(false);
                          onSizeChange(query.id, s);
                        }}
                      >
                        {s === "full-width" ? "Full width" : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    setShowExplain((prev) => {
                      const next = !prev;
                      if (next) setShowSources(false);
                      return next;
                    });
                  }}
                  data-testid={testIds.dashboards.tile.explain(query.id)}
                >
                  Explain
                </button>
                <button
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 disabled:opacity-50"
                  disabled={!sources.length}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    setShowSources((prev) => {
                      const next = !prev;
                      if (next) setShowExplain(false);
                      return next;
                    });
                  }}
                  data-testid={testIds.dashboards.tile.sources(query.id)}
                >
                  View sources
                </button>
                <div className="my-1 border-t border-gray-100" />
                <button
                  className="block w-full px-3 py-1.5 text-left text-xs text-red-700 hover:bg-red-50"
                  onClick={async (e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    try {
                      await removeQuery(dashboardId, query.id);
                    } catch (err) {
                      console.error("Failed to remove query:", err);
                    }
                  }}
                  data-testid={testIds.dashboards.tile.remove(query.id)}
                >
                  Delete tile
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tile Content */}
      <div
        className={`relative p-2 flex-1 ${tileSize === "small" || tileSize === "medium" ? "overflow-hidden" : "overflow-auto"}`}
      >
        {/* For small/medium tiles, show Explain/Sources as an overlay so it doesn't push results out of view. */}
        {(tileSize === "small" || tileSize === "medium") && (showExplain || showSources) && (
          <div className="absolute inset-0 z-10 bg-white/95 p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-gray-800">
                {showExplain ? "Explain" : "Sources"}
              </div>
              <button
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExplain(false);
                  setShowSources(false);
                }}
                data-testid={testIds.dashboards.tile.infoClose(query.id)}
                title="Back to result"
              >
                Back to result
              </button>
            </div>

            {showExplain && (
              <div
                className="h-[calc(100%-2.25rem)] overflow-auto rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700"
                data-testid={testIds.dashboards.tile.explainPanel(query.id)}
              >
                <div className="mt-1 text-gray-600">
                  Question: <span className="font-mono">{query.question}</span>
                </div>
                <div className="mt-1 text-gray-600">
                  Type: <span className="font-mono">{(result as any)?.type || query.tileType || "unknown"}</span>
                </div>
                {typeof (result as any)?.explanation === "string" && (result as any).explanation.trim() ? (
                  <div className="mt-2 whitespace-pre-wrap">{(result as any).explanation}</div>
                ) : (
                  <div className="mt-2 text-gray-500">
                    Explanation text coming next (we’ll generate a deterministic explanation + citations).
                  </div>
                )}
              </div>
            )}

            {showSources && (
              <div
                className="h-[calc(100%-2.25rem)] overflow-auto rounded border border-gray-200 bg-white p-2 text-xs text-gray-700"
                data-testid={testIds.dashboards.tile.sourcesPanel(query.id)}
              >
                {sources.length ? (
                  <ul className="mt-1 list-disc pl-4">
                    {sources.map((s: any, idx: number) => (
                      <li key={`${s.workbookId || "wb"}:${s.filePath || idx}`}>
                        <span className="font-mono">{s.workbookId}</span>:{" "}
                        <span className="font-mono">{s.filePath}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-1 text-gray-500">(no sources captured)</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* For large/full tiles, render panels inline above the result. */}
        {tileSize !== "small" && tileSize !== "medium" && showExplain && (
          <div
            className="mb-2 rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700"
            data-testid={testIds.dashboards.tile.explainPanel(query.id)}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="font-semibold">Explain</div>
              <button
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExplain(false);
                  setShowSources(false);
                }}
                data-testid={testIds.dashboards.tile.infoClose(query.id)}
                title="Back to result"
              >
                Back to result
              </button>
            </div>
            <div className="mt-1 text-gray-600">
              Question: <span className="font-mono">{query.question}</span>
            </div>
            <div className="mt-1 text-gray-600">
              Type: <span className="font-mono">{(result as any)?.type || query.tileType || "unknown"}</span>
            </div>
            {typeof (result as any)?.explanation === "string" && (result as any).explanation.trim() ? (
              <div className="mt-2 whitespace-pre-wrap">{(result as any).explanation}</div>
            ) : (
              <div className="mt-2 text-gray-500">Explanation text coming next (we’ll generate a deterministic explanation + citations).</div>
            )}
          </div>
        )}

        {tileSize !== "small" && tileSize !== "medium" && showSources && (
          <div
            className="mb-2 rounded border border-gray-200 bg-white p-2 text-xs text-gray-700"
            data-testid={testIds.dashboards.tile.sourcesPanel(query.id)}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="font-semibold">Sources</div>
              <button
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExplain(false);
                  setShowSources(false);
                }}
                data-testid={testIds.dashboards.tile.infoClose(query.id)}
                title="Back to result"
              >
                Back to result
              </button>
            </div>
            {sources.length ? (
              <ul className="mt-1 list-disc pl-4">
                {sources.map((s: any, idx: number) => (
                  <li key={`${s.workbookId || "wb"}:${s.filePath || idx}`}>
                    <span className="font-mono">{s.workbookId}</span>:{" "}
                    <span className="font-mono">{s.filePath}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-1 text-gray-500">(no sources captured)</div>
            )}
          </div>
        )}
        <div
          className="h-full"
          data-testid={testIds.dashboards.tile.result(query.id)}
          data-result-type={result?.type || (error ? "error" : "")}
        >
          {error ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-red-500 text-sm mb-2">⚠ Error</div>
              <div className="text-xs text-gray-600">{error}</div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  runQuery();
                }}
                className="mt-3 rounded bg-blue-500 px-3 py-1 text-xs text-white hover:bg-blue-600"
              >
                Retry
              </button>
            </div>
          ) : result ? (
            <DashboardResults result={result} tileSize={tileSize} />
          ) : (
            <div className="text-sm text-gray-500">
              {isRunning ? "Loading..." : "No data"}
            </div>
          )}
        </div>
      </div>

      <InputDialog
        isOpen={editQuestionDialogOpen}
        title="Edit Question"
        defaultValue={pendingQuestion}
        onCancel={() => setEditQuestionDialogOpen(false)}
        onConfirm={async (value) => {
          const newQ = (value || "").trim();
          setEditQuestionDialogOpen(false);
          if (!newQ || newQ === currentQuery.question) return;
          await updateQuery(dashboardId, currentQuery.id, { question: newQ });
          // Re-run deterministically against the new question immediately.
          await runQuery(newQ);
        }}
      />
    </div>
  );
}
