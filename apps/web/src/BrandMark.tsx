export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`brand-mark ${className}`.trim()}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="1"
        y="1"
        width="46"
        height="46"
        rx="14"
        fill="#e5f5ee"
        stroke="#cfe8de"
      />
      <path
        d="M14 10.5h12.5L35 19v18.5H14Z"
        fill="#fcfffd"
        stroke="#2d7563"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M26.5 10.5V19H35"
        fill="#cfeade"
        stroke="#2d7563"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M19 25.5h5.5c2.2 0 2.2 3 0 3h-1.7c-2.2 0-2.2 3 0 3H29"
        fill="none"
        stroke="#efa174"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
