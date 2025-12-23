import React from "react";
import { FileIcon, NotebookIcon } from "../components/Icons";

export type FileIconSize = "xs" | "sm";

export function getFileExtension(filename: string): string {
  const base = String(filename || "").trim();
  const last = base.lastIndexOf(".");
  if (last <= 0 || last === base.length - 1) return "";
  return base.slice(last + 1).toLowerCase();
}

function Badge({
  text,
  tone = "gray",
  size = "xs",
}: {
  text: string;
  tone?: "gray" | "blue" | "green" | "amber" | "red" | "purple";
  size?: FileIconSize;
}) {
  const cls =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "green"
          ? "border-green-200 bg-green-50 text-green-700"
          : tone === "blue"
            ? "border-blue-200 bg-blue-50 text-blue-700"
            : tone === "purple"
              ? "border-purple-200 bg-purple-50 text-purple-700"
              : "border-gray-200 bg-gray-50 text-gray-700";

  const sz = size === "sm" ? "text-[10px] px-1.5 py-[1px]" : "text-[9px] px-1.5 py-[1px]";

  return (
    <span
      className={`inline-flex items-center rounded border ${cls} ${sz} font-semibold leading-none`}
      title={text}
    >
      {text}
    </span>
  );
}

export function getFileTypeIcon(filename: string, opts?: { size?: FileIconSize }): React.ReactNode {
  const size = opts?.size || "xs";
  const ext = getFileExtension(filename);
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-3 w-3";

  // High-signal formats first
  if (ext === "pdf") return <Badge text="PDF" tone="red" size={size} />;
  if (ext === "doc" || ext === "docx") return <Badge text="DOC" tone="blue" size={size} />;
  if (ext === "md" || ext === "mdx") return <Badge text="MD" tone="purple" size={size} />;

  // InsightLM spreadsheet/notebook types
  if (ext === "is") return <Badge text="SHEET" tone="green" size={size} />;
  if (ext === "ipynb") return <NotebookIcon className={iconSize} />;

  // Data/code
  if (ext === "csv") return <Badge text="CSV" tone="green" size={size} />;
  if (ext === "json") return <Badge text="JSON" tone="amber" size={size} />;
  if (ext === "py") return <Badge text="PY" tone="amber" size={size} />;
  if (ext === "js" || ext === "jsx" || ext === "ts" || ext === "tsx") return <Badge text={ext.toUpperCase()} tone="amber" size={size} />;

  // Images
  if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "gif" || ext === "webp") {
    return <Badge text={ext.toUpperCase()} tone="blue" size={size} />;
  }

  // Fallback: generic file icon
  return <FileIcon className={iconSize} />;
}
