const ICON_PATHS = {
  general: "M8 2.5v2 M8 11.5v2 M4.1 4.1l1.4 1.4 M10.5 10.5l1.4 1.4 M2.5 8h2 M11.5 8h2 M4.1 11.9l1.4-1.4 M10.5 5.5l1.4-1.4 M6 8a2 2 0 1 0 4 0 2 2 0 0 0-4 0z",
  share: "M8 10.7V3.4 M5.55 5.85 8 3.4l2.45 2.45 M4.2 8.15v3.65h7.6V8.15"
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
