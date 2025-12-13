import React from 'react';

export function SpreadsheetIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
      <line x1="3" y1="8" x2="21" y2="8" stroke="currentColor" strokeWidth="1"/>
      <line x1="8" y1="3" x2="8" y2="21" stroke="currentColor" strokeWidth="1"/>
      <line x1="3" y1="13" x2="21" y2="13" stroke="currentColor" strokeWidth="1"/>
      <line x1="13" y1="3" x2="13" y2="21" stroke="currentColor" strokeWidth="1"/>
    </svg>
  );
}
