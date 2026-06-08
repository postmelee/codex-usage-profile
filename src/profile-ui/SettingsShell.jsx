import { Icon } from "./Icons.jsx";

const NAV_SECTIONS = [
  {
    label: "Personal",
    items: [
      ["General", "general"],
      ["Profile", "profile"],
      ["Appearance", "general"],
      ["Configuration", "config"],
      ["Personalization", "personalization"],
      ["Keyboard shortcuts", "keyboard"],
      ["Usage & billing", "billing"]
    ]
  },
  {
    label: "Integrations",
    items: [
      ["Appshots", "appshots"],
      ["MCP servers", "mcp"],
      ["Browser", "browser"],
      ["Computer use", "computer"]
    ]
  },
  {
    label: "Coding",
    items: [
      ["Hooks", "hooks"],
      ["Connections", "connections"],
      ["Git", "git"],
      ["Environments", "environments"],
      ["Worktrees", "worktrees"]
    ]
  },
  {
    label: "Archived",
    items: [["Archived chats", "archive"]]
  }
];

export function SettingsShell({ children }) {
  return (
    <div className="app-frame">
      <aside className="settings-sidebar" aria-label="Settings navigation">
        <div className="window-controls" aria-hidden="true">
          <span className="window-dot window-dot-red" />
          <span className="window-dot window-dot-yellow" />
          <span className="window-dot window-dot-green" />
        </div>

        <button className="back-button" type="button">
          <Icon name="back" />
          <span>Back to app</span>
        </button>
        <label className="search-shell">
          <Icon name="search" />
          <span className="sr-only">Search settings</span>
          <input type="search" placeholder="Search settings..." />
        </label>

        <nav className="settings-nav">
          {NAV_SECTIONS.map((section) => (
            <div className="settings-nav-section" key={section.label}>
              <div className="settings-nav-heading">{section.label}</div>
              {section.items.map(([item, icon]) => (
                <button
                  className={item === "Profile" ? "settings-nav-item is-active" : "settings-nav-item"}
                  key={item}
                  type="button"
                >
                  <Icon name={icon} />
                  <span>{item}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <main className="settings-main">
        <header className="settings-topbar">
          <h1>Profile</h1>
          <div className="settings-actions" aria-label="Profile actions">
            <button type="button"><Icon name="share" /><span>Share</span></button>
            <button type="button"><Icon name="lock" /><span>Private</span></button>
            <button type="button"><Icon name="edit" /><span>Edit</span></button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
