import { useState, useRef, useEffect } from "react";
import { DashboardQuery } from "../../types/dashboard";
import { DashboardTile } from "./DashboardTile";
import { useDashboardStore } from "../../store/dashboardStore";

interface DashboardGridProps {
  queries: DashboardQuery[];
  dashboardId: string;
}

const GRID_COLUMN_SIZE = 200; // Width of each grid column in pixels
const GRID_ROW_HEIGHT = 180; // Height of each grid row in pixels (smaller than column width for tighter spacing)
const GRID_GAP = 16; // Gap between tiles in pixels

// Helper functions to get tile dimensions
const getTileWidth = (size: "small" | "medium" | "large" | "full-width" | undefined, containerWidth?: number): number => {
  if (!size) return 2; // Default medium
  if (size === "small") return 1;
  if (size === "medium") return 2;
  if (size === "large") return 3; // Large is now 3 columns wide
  if (size === "full-width") {
    // For full-width, calculate how many columns fit in the container
    if (containerWidth) {
      // Calculate how many columns fit: (containerWidth + GRID_GAP) / (GRID_COLUMN_SIZE + GRID_GAP)
      const columns = Math.floor((containerWidth + GRID_GAP) / (GRID_COLUMN_SIZE + GRID_GAP));
      return Math.max(columns, 4); // Minimum 4 columns
    }
    return 4; // Fallback to 4 if container width not available
  }
  return 2;
};

const getTileHeight = (size: "small" | "medium" | "large" | "full-width" | undefined): number => {
  if (!size) return 1;
  return size === "large" ? 2 : 1;
};

export function DashboardGrid({ queries, dashboardId }: DashboardGridProps) {
  const { updateQuery } = useDashboardStore();
  const [draggingTileId, setDraggingTileId] = useState<string | null>(null);
  const [dragPreviewPosition, setDragPreviewPosition] = useState<{ x: number; y: number } | null>(null);
  const [draggingTileData, setDraggingTileData] = useState<{
    query: DashboardQuery;
    initialPosition: { x: number; y: number };
    size: { width: number; height: number };
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Measure container width for full-width tiles
  useEffect(() => {
    const updateContainerWidth = () => {
      if (containerRef.current?.parentElement) {
        // Get the parent container (the div with overflow-auto p-4)
        const parent = containerRef.current.parentElement;
        const parentRect = parent.getBoundingClientRect();
        // Account for padding (p-4 = 16px on each side = 32px total)
        const availableWidth = parentRect.width - 32; // Subtract padding
        setContainerWidth(availableWidth);
      }
    };

    updateContainerWidth();
    window.addEventListener('resize', updateContainerWidth);
    // Use ResizeObserver for more accurate tracking
    const resizeObserver = new ResizeObserver(updateContainerWidth);
    if (containerRef.current?.parentElement) {
      resizeObserver.observe(containerRef.current.parentElement);
    }

    return () => {
      window.removeEventListener('resize', updateContainerWidth);
      resizeObserver.disconnect();
    };
  }, []);

  const handleDragStart = (queryId: string, initialPosition: { x: number; y: number }, size: { width: number; height: number }) => {
    const query = queries.find(q => q.id === queryId);
    if (!query) return;

    setDraggingTileId(queryId);
    setDraggingTileData({
      query,
      initialPosition, // Use the pixel position passed in from the tile component
      size,
    });
    // Initialize preview position at tile's current location (use the position passed in)
    setDragPreviewPosition(initialPosition);
  };

  const handleDragMove = (queryId: string, x: number, y: number) => {
    if (draggingTileId === queryId) {
      setDragPreviewPosition({ x, y });
    }
  };

  const handleDragEnd = (queryId: string, gridX: number, gridY: number) => {
    // Update store with new position
    updateQuery(dashboardId, queryId, {
      tilePosition: { x: gridX, y: gridY },
    });

    // Clear drag state
    setDraggingTileId(null);
    setDragPreviewPosition(null);
    setDraggingTileData(null);
  };

  const handleSizeChange = (
    queryId: string,
    size: "small" | "medium" | "large" | "full-width"
  ) => {
    const query = queries.find(q => q.id === queryId);
    if (!query) return;

    const currentPosition = query.tilePosition || { x: 0, y: 0 };
    const newWidth = getTileWidth(size, containerWidth);
    const newHeight = getTileHeight(size);
    // For full-width tiles, use the calculated container width columns
    // For others, use the standard max grid width
    const maxGridWidth = size === "full-width" ? getTileWidth(size, containerWidth) : 4;

    // Build set of occupied cells (excluding the current tile being resized)
    const occupiedPositions = new Set<string>();
    queries.forEach((q) => {
      // Skip the tile we're resizing
      if (q.id === queryId) return;

      const pos = q.tilePosition;
      if (!pos) return;

      const width = getTileWidth(q.tileSize, containerWidth);
      const height = getTileHeight(q.tileSize);

      // Mark all cells occupied by this tile
      for (let x = pos.x; x < pos.x + width; x++) {
        for (let y = pos.y; y < pos.y + height; y++) {
          occupiedPositions.add(`${x},${y}`);
        }
      }
    });

    // Helper to check if a position is valid for the new size
    const canPlaceAt = (x: number, y: number, width: number, height: number): boolean => {
      // Check if tile fits within grid bounds
      if (x + width > maxGridWidth) return false;

      // Check if all required cells are available
      for (let checkX = x; checkX < x + width; checkX++) {
        for (let checkY = y; checkY < y + height; checkY++) {
          if (occupiedPositions.has(`${checkX},${checkY}`)) {
            return false;
          }
        }
      }
      return true;
    };

    // Check if current position is valid with new size
    let newPosition = currentPosition;

    // For full-width tiles, always position at x=0
    if (size === "full-width") {
      // Check if any tiles overlap at the current y position
      const hasOverlap = queries.some((q) => {
        if (q.id === queryId) return false; // Skip self
        const qPos = q.tilePosition || { x: 0, y: 0 };
        const qHeight = getTileHeight(q.tileSize);
        // Check if tiles overlap vertically
        return (
          (currentPosition.y >= qPos.y && currentPosition.y < qPos.y + qHeight) ||
          (currentPosition.y + newHeight > qPos.y && currentPosition.y + newHeight <= qPos.y + qHeight) ||
          (currentPosition.y <= qPos.y && currentPosition.y + newHeight > qPos.y + qHeight)
        );
      });

      if (hasOverlap) {
        // Find first available y position
        let nextY = 0;
        while (queries.some((q) => {
          if (q.id === queryId) return false;
          const qPos = q.tilePosition || { x: 0, y: 0 };
          const qHeight = getTileHeight(q.tileSize);
          return (
            (nextY >= qPos.y && nextY < qPos.y + qHeight) ||
            (nextY + newHeight > qPos.y && nextY + newHeight <= qPos.y + qHeight) ||
            (nextY <= qPos.y && nextY + newHeight > qPos.y + qHeight)
          );
        })) {
          nextY++;
          if (nextY > 100) {
            console.warn("Could not find valid position for full-width tile");
            return;
          }
        }
        newPosition = { x: 0, y: nextY };
      } else {
        newPosition = { x: 0, y: currentPosition.y };
      }
    } else if (!canPlaceAt(currentPosition.x, currentPosition.y, newWidth, newHeight)) {
      // Current position won't work, find a new valid position
      let nextX = 0;
      let nextY = 0;

      while (!canPlaceAt(nextX, nextY, newWidth, newHeight)) {
        nextX++;
        if (nextX + newWidth > maxGridWidth) {
          nextX = 0;
          nextY++;
        }
        // Safety check to prevent infinite loop
        if (nextY > 100) {
          console.warn("Could not find valid position for resized tile");
          return; // Abort if we can't find a position
        }
      }

      newPosition = { x: nextX, y: nextY };
    }

    // Update both size and position (if changed)
    updateQuery(dashboardId, queryId, {
      tileSize: size,
      tilePosition: newPosition,
    });
  };

  // Calculate grid dimensions
  const maxX = Math.max(
    ...queries.map((q) => {
      const pos = q.tilePosition || { x: 0, y: 0 };
      const width = getTileWidth(q.tileSize, containerWidth);
      return pos.x + width;
    }),
    4
  );

  const maxY = Math.max(
    ...queries.map((q) => {
      const pos = q.tilePosition || { x: 0, y: 0 };
      const height = getTileHeight(q.tileSize);
      return pos.y + height;
    }),
    1
  );

  const getTileStyle = (query: DashboardQuery) => {
    const position = query.tilePosition || { x: 0, y: 0 };
    const width = getTileWidth(query.tileSize, containerWidth);
    const height = getTileHeight(query.tileSize);

    // For full-width tiles, span the entire container width
    if (query.tileSize === "full-width" && containerWidth > 0) {
      return {
        position: "absolute" as const,
        left: "0px", // Always start at left edge
        top: `${position.y * (GRID_ROW_HEIGHT + GRID_GAP)}px`,
        width: `${containerWidth}px`, // Use full container width
        height: `${height * GRID_ROW_HEIGHT + (height - 1) * GRID_GAP}px`, // Use height instead of minHeight for tighter fit
      };
    }

    return {
      position: "absolute" as const,
      left: `${position.x * (GRID_COLUMN_SIZE + GRID_GAP)}px`,
      top: `${position.y * (GRID_ROW_HEIGHT + GRID_GAP)}px`,
      width: `${width * GRID_COLUMN_SIZE + (width - 1) * GRID_GAP}px`,
      height: `${height * GRID_ROW_HEIGHT + (height - 1) * GRID_GAP}px`, // Use height instead of minHeight for tighter fit
    };
  };

  // Generate grid lines for visual feedback
  const renderGridLines = () => {
    if (!draggingTileId) return null;

    const lines = [];
    const gridWidth = maxX * (GRID_COLUMN_SIZE + GRID_GAP);
    const gridHeight = maxY * (GRID_ROW_HEIGHT + GRID_GAP);

    // Vertical lines
    for (let i = 0; i <= maxX; i++) {
      lines.push(
        <div
          key={`v-${i}`}
          className="absolute bg-gray-300 pointer-events-none"
          style={{
            left: `${i * (GRID_COLUMN_SIZE + GRID_GAP)}px`,
            top: 0,
            width: "1px",
            height: `${gridHeight}px`,
            opacity: 0.3,
          }}
        />
      );
    }

    // Horizontal lines
    for (let i = 0; i <= maxY; i++) {
      lines.push(
        <div
          key={`h-${i}`}
          className="absolute bg-gray-300 pointer-events-none"
          style={{
            left: 0,
            top: `${i * (GRID_ROW_HEIGHT + GRID_GAP)}px`,
            width: `${gridWidth}px`,
            height: "1px",
            opacity: 0.3,
          }}
        />
      );
    }

    return lines;
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{
        width: containerWidth > 0 && queries.some(q => q.tileSize === "full-width")
          ? `${containerWidth}px` // Use container width if there are full-width tiles
          : `${maxX * (GRID_COLUMN_SIZE + GRID_GAP) - GRID_GAP}px`,
        minHeight: `${maxY * (GRID_ROW_HEIGHT + GRID_GAP) - GRID_GAP}px`,
      }}
    >
      {/* Grid lines (only visible when dragging) */}
      {renderGridLines()}

      {/* Render actual tiles */}
      {queries.map((query) => {
        const style = getTileStyle(query);
        const isDragging = draggingTileId === query.id;

        return (
          <div
            key={query.id}
            style={{
              ...style,
              transition: isDragging ? "none" : "left 0.2s ease, top 0.2s ease",
              opacity: isDragging ? 0.4 : 1,
              pointerEvents: isDragging ? "none" : "auto",
            }}
          >
            <DashboardTile
              query={query}
              dashboardId={dashboardId}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onSizeChange={handleSizeChange}
            />
          </div>
        );
      })}

      {/* Render drag preview outline */}
      {draggingTileId && draggingTileData && dragPreviewPosition && (
        <div
          className="absolute pointer-events-none z-50"
          style={{
            left: `${dragPreviewPosition.x}px`,
            top: `${dragPreviewPosition.y}px`,
            width: `${draggingTileData.size.width}px`,
            minHeight: `${draggingTileData.size.height}px`,
            border: "2px dashed #3b82f6",
            borderRadius: "0.5rem",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          }}
        >
          <div className="p-3">
            <div className="text-sm font-semibold text-gray-800">
              {draggingTileData.query.title || draggingTileData.query.question}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {draggingTileData.query.queryType}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
