const ICON_PATHS = {
  appshots: "M4.5 4.5h7v7h-7z M2.5 7.5v1 M7.5 2.5h1 M13.5 7.5v1 M7.5 13.5h1",
  archive: "M3 5.5h10 M4 5.5v7h8v-7 M5 3.5h6l1 2h-8z M6.5 8h3",
  back: "M10.5 3.5 6 8l4.5 4.5 M6.5 8H13",
  billing: "M8 3a5 5 0 1 0 5 5 M8 6v2l1.5 1",
  browser: "M3 5.5h10v7h-10z M3 5.5l1.5-2h7l1.5 2",
  computer: "M8 2.5 8.8 5l2.7-.8-1.5 2.3 1.5 2.3-2.7-.8-.8 2.5-.8-2.5-2.7.8 1.5-2.3-1.5-2.3L7.2 5z",
  config: "M8 3.2 12 5.3v5.4l-4 2.1-4-2.1V5.3z M8 6.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z",
  connections: "M5 5a2 2 0 1 0 0 .1 M11 5a2 2 0 1 0 0 .1 M5 11a2 2 0 1 0 0 .1 M7 5h2 M6.5 6.5l3 3",
  edit: "M4 11.8 4.5 9l5.7-5.7a1.2 1.2 0 0 1 1.7 1.7L6.2 10.7z M3.8 12.2h8.4",
  environments: "M3.5 5h9v6h-9z M6 13h4",
  general: "M8 2.5v2 M8 11.5v2 M4.1 4.1l1.4 1.4 M10.5 10.5l1.4 1.4 M2.5 8h2 M11.5 8h2 M4.1 11.9l1.4-1.4 M10.5 5.5l1.4-1.4 M6 8a2 2 0 1 0 4 0 2 2 0 0 0-4 0z",
  git: "M6 4.5a1.5 1.5 0 1 0 0 .1 M10 8a1.5 1.5 0 1 0 0 .1 M6 11.5a1.5 1.5 0 1 0 0 .1 M7.2 5.4l1.6 1.2 M7.2 10.6l1.6-1.2",
  hooks: "M5.2 3v6.2a2.8 2.8 0 1 0 5.6 0V7 M3.8 3h2.8 M9.4 7h2.8",
  keyboard: "M3 5h10v6h-10z M5 7h.1 M7 7h.1 M9 7h.1 M11 7h.1 M5 9h6",
  lock: "M4.5 7h7v5.5h-7z M6 7V5.5a2 2 0 1 1 4 0V7",
  mcp: "M5 4.5 8 2.8l3 1.7v3.4l-3 1.7-3-1.7z M8 9.6V13 M5.5 11.2 8 13l2.5-1.8",
  personalization: "M8 3a5 5 0 1 0 5 5 M8 5.8a2.2 2.2 0 1 0 0 4.4",
  profile: "M5 12.5a3 3 0 0 1 6 0 M5.8 6.2a2.2 2.2 0 1 0 4.4 0 2.2 2.2 0 0 0-4.4 0z M2.5 8a5.5 5.5 0 1 0 11 0 5.5 5.5 0 0 0-11 0z",
  search: "M6.8 3.4a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z M9.4 9.4 12.5 12.5",
  share: "M8 11.5V3.5 M5.5 5.8 8 3.3l2.5 2.5 M4 8v4h8V8",
  worktrees: "M4 4h3v3H4z M9 9h3v3H9z M7 5.5h1.5v5H9"
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
