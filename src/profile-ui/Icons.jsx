const ICON_PATHS = {
  close: "M4 4l8 8 M12 4l-8 8",
  copy: "M5.5 5.5h7v7h-7z M3.5 10.5h-1v-7h7v1",
  download: "M8 2.5v7 M5.5 7 8 9.5 10.5 7 M3.5 12.5h9",
  general: "M8 2.5v2 M8 11.5v2 M4.1 4.1l1.4 1.4 M10.5 10.5l1.4 1.4 M2.5 8h2 M11.5 8h2 M4.1 11.9l1.4-1.4 M10.5 5.5l1.4-1.4 M6 8a2 2 0 1 0 4 0 2 2 0 0 0-4 0z",
  globe: "M8 2.2a5.8 5.8 0 1 0 0 11.6A5.8 5.8 0 0 0 8 2.2z M2.4 8h11.2 M8 2.2c1.45 1.55 2.15 3.48 2.15 5.8S9.45 12.25 8 13.8C6.55 12.25 5.85 10.32 5.85 8S6.55 3.75 8 2.2z",
  logOut: "M6.2 3.2H3.4v9.6h2.8 M9.2 5.2 12 8l-2.8 2.8 M12 8H6.5",
  success: "M3 8.2 6.4 11.5 13 4.8 M8 1.8a6.2 6.2 0 1 0 0 12.4A6.2 6.2 0 0 0 8 1.8z",
  settings: "M8 5.3a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4z M8 2.5v1.2 M8 12.3v1.2 M3.2 4.2l.85.85 M11.95 10.95l.85.85 M2.5 8h1.2 M12.3 8h1.2 M3.2 11.8l.85-.85 M11.95 5.05l.85-.85",
  user: "M8 8.2a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4z M3.3 13.2c.6-2.1 2.2-3.3 4.7-3.3s4.1 1.2 4.7 3.3"
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
