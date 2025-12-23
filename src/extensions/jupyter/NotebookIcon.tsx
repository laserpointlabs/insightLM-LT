import React from 'react';

export function NotebookIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 16 16"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="2" width="10" height="12" rx="1" />
      <path d="M7 2v12M1 5h2M1 8h2M1 11h2" />
    </svg>
  );
}

