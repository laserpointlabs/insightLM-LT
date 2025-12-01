import { useCallback, useEffect, useRef, useState } from "react";

interface ResizablePaneProps {
  direction: "horizontal" | "vertical";
  onResize: (size: number) => void;
  initialSize: number;
  minSize?: number;
  maxSize?: number;
  className?: string;
}

export function ResizablePane({
  direction,
  onResize,
  initialSize,
  minSize = 100,
  maxSize = Infinity,
  className = "",
}: ResizablePaneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef(0);
  const startSizeRef = useRef(initialSize);
  const onResizeRef = useRef(onResize);

  // Keep refs updated, but DON'T update startSizeRef during drag
  useEffect(() => {
    onResizeRef.current = onResize;
    // Only update startSizeRef if we're not currently dragging
    // This prevents the jump-to-max issue
    if (!isDragging) {
      startSizeRef.current = initialSize;
    }
  }, [onResize, initialSize, isDragging]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = direction === "horizontal" ? e.clientX : e.clientY;
      // Calculate delta: positive = drag right/down
      let delta = currentPos - startPosRef.current;

      // Invert vertical only (horizontal is correct as-is)
      if (direction === "vertical") {
        delta = -delta;
      }

      // Calculate new size from the starting size (captured at drag start)
      const newSize = Math.max(
        minSize,
        Math.min(maxSize, startSizeRef.current + delta)
      );

      onResizeRef.current(newSize);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, direction, minSize, maxSize]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    startPosRef.current = direction === "horizontal" ? e.clientX : e.clientY;
    startSizeRef.current = initialSize; // Capture current size at drag start
  }, [direction, initialSize]);

  const isHorizontal = direction === "horizontal";

  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{
        width: isHorizontal ? "4px" : "100%",
        height: isHorizontal ? "100%" : "4px",
        cursor: isHorizontal ? "col-resize" : "row-resize",
        backgroundColor: isDragging ? "#3b82f6" : "transparent",
        zIndex: isDragging ? 50 : 10,
      }}
      onMouseDown={handleMouseDown}
    >
      <div
        className="absolute inset-0 hover:bg-blue-400 transition-colors"
        style={{
          backgroundColor: isDragging ? "#3b82f6" : "transparent",
        }}
      />
    </div>
  );
}
