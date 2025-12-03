import { useState, useRef, useEffect } from "react";
import { DashboardQuery } from "../../types/dashboard";
import { useDashboardStore } from "../../store/dashboardStore";
import { useWorkbookStore } from "../../store/workbookStore";
import { dashboardService } from "../../services/dashboardService";
import { DashboardResults } from "./DashboardResults";

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
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tileRef = useRef<HTMLDivElement>(null);

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

  const runQuery = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const queryResult = await dashboardService.executeQuery(query, workbooks);
      setResult(queryResult);
      setError(null);
      updateQuery(dashboardId, query.id, {
        result: queryResult,
        lastRun: new Date().toISOString(),
      });
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
      }}
      tabIndex={0}
    >
      {/* Tile Header */}
      <div
        className="tile-header flex items-start justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        <div className="flex-1 min-w-0 group title-text" onDoubleClick={handleTitleDoubleClick}>
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
              <h3 className="text-sm font-semibold text-gray-800 truncate pr-6" title={`Double-click to edit\n\nTitle: ${displayTitle}\nQuestion: ${query.question}`}>
                {displayTitle}
              </h3>
              <span className="absolute right-0 top-0 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                ✎
              </span>
            </div>
          )}
          <div className="text-xs text-gray-500 mt-0.5 truncate" title={query.question}>
            {query.queryType}
            {query.lastRun &&
              ` • ${new Date(query.lastRun).toLocaleTimeString()}`}
          </div>
        </div>
        <div className="flex gap-1 ml-2 flex-shrink-0">
          {/* Size selector */}
          <select
            value={tileSize}
            onChange={(e) => onSizeChange(query.id, e.target.value as any)}
            className="rounded border border-gray-300 px-1.5 py-0.5 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
            <option value="full-width">Full Width</option>
          </select>
          <button
            onClick={(e) => {
              e.stopPropagation();
              runQuery();
            }}
            disabled={isRunning}
            className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200 disabled:opacity-50"
            title="Refresh"
          >
            {isRunning ? "..." : "↻"}
          </button>
          <button
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await removeQuery(dashboardId, query.id);
              } catch (err) {
                console.error("Failed to remove query:", err);
              }
            }}
            className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            title="Remove"
          >
            ×
          </button>
        </div>
      </div>

      {/* Tile Content */}
      <div className="p-3 flex-1 overflow-auto">
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
          <DashboardResults result={result} />
        ) : (
          <div className="text-sm text-gray-500">
            {isRunning ? "Loading..." : "No data"}
          </div>
        )}
      </div>
    </div>
  );
}
