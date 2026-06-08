const ICON_PATHS = {
  edit: "M4 11.8 4.5 9l5.7-5.7a1.2 1.2 0 0 1 1.7 1.7L6.2 10.7z M3.8 12.2h8.4",
  general: "M8 2.5v2 M8 11.5v2 M4.1 4.1l1.4 1.4 M10.5 10.5l1.4 1.4 M2.5 8h2 M11.5 8h2 M4.1 11.9l1.4-1.4 M10.5 5.5l1.4-1.4 M6 8a2 2 0 1 0 4 0 2 2 0 0 0-4 0z",
  lock: "M4.5 7h7v5.5h-7z M6 7V5.5a2 2 0 1 1 4 0V7",
  share: "M8 11.5V3.5 M5.5 5.8 8 3.3l2.5 2.5 M4 8v4h8V8"
};

export function Icon({ name, size = 16 }) {
  const path = ICON_PATHS[name] ?? ICON_PATHS.general;

  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 16 16"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={path}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.35"
      />
    </svg>
  );
}
