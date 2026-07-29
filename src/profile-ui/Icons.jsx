const ICON_PATHS = {
  close: "M4 4l8 8 M12 4l-8 8",
  copy: "M5.5 5.5h7v7h-7z M3.5 10.5h-1v-7h7v1",
  download: "M8 2.5v7 M5.5 7 8 9.5 10.5 7 M3.5 12.5h9",
  general: "M8 2.5v2 M8 11.5v2 M4.1 4.1l1.4 1.4 M10.5 10.5l1.4 1.4 M2.5 8h2 M11.5 8h2 M4.1 11.9l1.4-1.4 M10.5 5.5l1.4-1.4 M6 8a2 2 0 1 0 4 0 2 2 0 0 0-4 0z",
  linkedin: "M3.2 6.4v6.1 M3.2 3.6v.1 M6.5 12.5V6.4 M6.5 9.1c0-1.7 1.1-2.8 2.7-2.8 1.8 0 2.8 1.2 2.8 3.3v2.9",
  logOut: "M6.2 3.2H3.4v9.6h2.8 M9.2 5.2 12 8l-2.8 2.8 M12 8H6.5",
  reddit: "M4.1 7.4c-1.1 0-1.8.6-1.8 1.5 0 .6.3 1 .8 1.3-.1.3-.1.5-.1.8 0 1.8 2.2 3.2 5 3.2s5-1.4 5-3.2c0-.3 0-.5-.1-.8.5-.3.8-.8.8-1.3 0-.9-.7-1.5-1.8-1.5-.5 0-.9.1-1.2.4-.9-.6-2.2-.9-3.7-1l.7-2.8 2 .5 M11.6 3.5a1 1 0 1 0 2 0 1 1 0 0 0-2 0z M5.7 9.8h.1 M10.2 9.8h.1 M5.8 12c1.2.8 3.2.8 4.4 0",
  settings: "M8 5.3a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4z M8 2.5v1.2 M8 12.3v1.2 M3.2 4.2l.85.85 M11.95 10.95l.85.85 M2.5 8h1.2 M12.3 8h1.2 M3.2 11.8l.85-.85 M11.95 5.05l.85-.85",
  share: "M8 10.7V3.4 M5.55 5.85 8 3.4l2.45 2.45 M4.2 8.15v3.65h7.6V8.15",
  user: "M8 8.2a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4z M3.3 13.2c.6-2.1 2.2-3.3 4.7-3.3s4.1 1.2 4.7 3.3",
  x: "M3 2.7l10 10.6 M12.8 2.7 3.2 13.3"
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
