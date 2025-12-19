// VS Code-style SVG icons
export function AddIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 16 16"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 3v10M3 8h10"
      />
    </svg>
  );
}

export function RefreshIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 16 16"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 8a5.5 5.5 0 0 1 8.8-4.4M2.5 8h3M13.5 8a5.5 5.5 0 0 1-8.8 4.4M13.5 8h-3"
      />
    </svg>
  );
}

export function DeleteIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 16 16"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 5l6 6M11 5l-6 6"
      />
    </svg>
  );
}

export function PencilIcon({ className = "h-4 w-4" }: { className?: string }) {
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
      <path d="M3 13l3.2-.7L13 5.5 10.5 3 3.7 9.8 3 13z" />
      <path d="M9.9 3.6l2.5 2.5" />
    </svg>
  );
}

export function MoveIcon({ className = "h-4 w-4" }: { className?: string }) {
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
      <path d="M5.5 4.5L3.5 6.5l2 2" />
      <path d="M3.8 6.5H10a2.5 2.5 0 0 1 0 5H8.5" />
      <path d="M10.5 11.5l2-2-2-2" />
    </svg>
  );
}

export function ChevronRightIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 16 16"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 4l4 4-4 4"
      />
    </svg>
  );
}

export function CollapseAllIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 16 16"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="3" y="3" width="10" height="10" rx="1" />
      <path d="M6 8h4" strokeLinecap="round" />
    </svg>
  );
}

export function HistoryIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 16 16"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GearIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Outer gear shape */}
      <path d="M15.2 6.5h-1.1c-.5 0-.9-.4-.9-1 0-.3.1-.5.3-.7l.7-.7c.4-.4.4-1 0-1.4l-.9-.9c-.2-.2-.4-.3-.7-.3s-.5.1-.7.3l-.7.7c-.2.2-.4.3-.7.3-.5 0-.9-.4-.9-.9V.8c0-.5-.4-1-.9-1h-1.3c-.5 0-1 .5-1 1v1.1c0 .5-.4.9-.9.9-.3 0-.5-.1-.7-.3l-.7-.7c-.2-.2-.4-.3-.7-.3s-.5.1-.7.3l-.9.9c-.4.4-.4 1 0 1.4l.7.7c.2.2.3.4.3.7 0 .5-.4.9-.9.9H.8c-.5 0-1 .4-1 .9v1.3c0 .5.5.9 1 .9h1.1c.5 0 .9.4.9.9 0 .3-.1.5-.3.7l-.7.7c-.4.4-.4 1 0 1.4l.9.9c.2.2.4.3.7.3s.5-.1.7-.3l.7-.7c.2-.2.4-.3.7-.3.5 0 .9.4.9.9v1.1c0 .5.4 1 .9 1h1.3c.5 0 1-.4 1-1v-1.1c0-.5.4-.9.9-.9.3 0 .5.1.7.3l.7.7c.2.2.4.3.7.3s.5-.1.7-.3l.9-.9c.4-.4.4-1 0-1.4l-.7-.7c-.2-.2-.3-.4-.3-.7 0-.5.4-.9.9-.9h1.1c.5 0 1-.4 1-.9V7.5c0-.6-.4-1-1-1z" />
      {/* Center hub - filled */}
      <circle cx="8" cy="8" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FileIcon({ className = "h-4 w-4" }: { className?: string }) {
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
      <path d="M9 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6L9 2z" />
      <path d="M9 2v4h4" />
      {/* Plus sign */}
      <path d="M8 7v4M6 9h4" strokeWidth="1.2" />
    </svg>
  );
}

export function FolderIcon({ className = "h-4 w-4" }: { className?: string }) {
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
      <path d="M2.5 4.5h4l1.5 1.5H13.5c.6 0 1 .4 1 1v5.5c0 .6-.4 1-1 1h-11c-.6 0-1-.4-1-1V5.5c0-.6.4-1 1-1z" />
      {/* Plus sign */}
      <path d="M8 8.2v3M6.5 9.7h3" strokeWidth="1.2" />
    </svg>
  );
}

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

export function SendIcon({ className = "h-4 w-4" }: { className?: string }) {
  // A minimal "arrow up" send icon (Continue-style).
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 3v10" />
      <path d="M4.8 6.2 8 3l3.2 3.2" />
    </svg>
  );
}

export function PopOutIcon({ className = "h-4 w-4" }: { className?: string }) {
  // "Open in new" style icon.
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
      <path d="M6 3H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V10" />
      <path d="M9 3h4v4" />
      <path d="M13 3L7.5 8.5" />
    </svg>
  );
}
