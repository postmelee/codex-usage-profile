const ICON_PATHS = {
  close: "M4 4l8 8 M12 4l-8 8",
  copy: "M5.5 5.5h7v7h-7z M3.5 10.5h-1v-7h7v1",
  download: "M8 2.5v7 M5.5 7 8 9.5 10.5 7 M3.5 12.5h9",
  general: "M8 2.5v2 M8 11.5v2 M4.1 4.1l1.4 1.4 M10.5 10.5l1.4 1.4 M2.5 8h2 M11.5 8h2 M4.1 11.9l1.4-1.4 M10.5 5.5l1.4-1.4 M6 8a2 2 0 1 0 4 0 2 2 0 0 0-4 0z",
  globe: "M8 2.2a5.8 5.8 0 1 0 0 11.6A5.8 5.8 0 0 0 8 2.2z M2.4 8h11.2 M8 2.2c1.45 1.55 2.15 3.48 2.15 5.8S9.45 12.25 8 13.8C6.55 12.25 5.85 10.32 5.85 8S6.55 3.75 8 2.2z",
  logOut: "M6.2 3.2H3.4v9.6h2.8 M9.2 5.2 12 8l-2.8 2.8 M12 8H6.5",
  settings: "M8 5.3a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4z M8 2.5v1.2 M8 12.3v1.2 M3.2 4.2l.85.85 M11.95 10.95l.85.85 M2.5 8h1.2 M12.3 8h1.2 M3.2 11.8l.85-.85 M11.95 5.05l.85-.85",
  user: "M8 8.2a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4z M3.3 13.2c.6-2.1 2.2-3.3 4.7-3.3s4.1 1.2 4.7 3.3"
};

export function CodexCheckCircleIcon({ size = 18 }) {
  return (
    <svg
      aria-hidden="true"
      className="icon codex-check-circle-icon"
      data-codex-check-circle=""
      fill="none"
      height={size}
      viewBox="0 0 20 21"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12.1599 7.63617C12.3713 7.33596 12.7863 7.26372 13.0866 7.47504C13.3867 7.68642 13.4589 8.10153 13.2477 8.40179L9.28876 14.0268C9.17264 14.1917 8.98808 14.2954 8.7868 14.308C8.61044 14.319 8.43764 14.2592 8.30634 14.144L8.25262 14.0912L6.16962 11.7993L6.08954 11.6918C5.93136 11.4259 5.97666 11.0761 6.21454 10.8598C6.45225 10.6439 6.80379 10.6326 7.05341 10.8149L7.15399 10.9047L8.67841 12.5815L12.1599 7.63617Z"
        fill="currentColor"
      />
      <path
        clipRule="evenodd"
        d="M9.99506 2.81226C14.3664 2.81226 17.9101 6.35596 17.9101 10.7273C17.9101 15.0986 14.3664 18.6423 9.99506 18.6423C5.62372 18.6423 2.08002 15.0986 2.08002 10.7273C2.08002 6.35596 5.62372 2.81226 9.99506 2.81226ZM9.99506 4.14233C6.35826 4.14233 3.4101 7.0905 3.4101 10.7273C3.4101 14.3641 6.35826 17.3123 9.99506 17.3123C13.6319 17.3123 16.58 14.3641 16.58 10.7273C16.58 7.0905 13.6319 4.14233 9.99506 4.14233Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}

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
