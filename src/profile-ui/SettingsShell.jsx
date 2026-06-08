const NAV_SECTIONS = [
  {
    label: "Personal",
    items: ["General", "Profile", "Appearance", "Configuration", "Personalization", "Keyboard shortcuts", "Usage & billing"]
  },
  {
    label: "Integrations",
    items: ["Appshots", "MCP servers", "Browser", "Computer use"]
  },
  {
    label: "Coding",
    items: ["Hooks", "Connections", "Git", "Environments", "Worktrees"]
  },
  {
    label: "Archived",
    items: ["Archived chats"]
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

        <button className="back-button" type="button">Back to app</button>
        <label className="search-shell">
          <span className="search-icon" aria-hidden="true" />
          <span className="sr-only">Search settings</span>
          <input type="search" placeholder="Search settings..." />
        </label>

        <nav className="settings-nav">
          {NAV_SECTIONS.map((section) => (
            <div className="settings-nav-section" key={section.label}>
              <div className="settings-nav-heading">{section.label}</div>
              {section.items.map((item) => (
                <button
                  className={item === "Profile" ? "settings-nav-item is-active" : "settings-nav-item"}
                  key={item}
                  type="button"
                >
                  <span className="settings-nav-icon" aria-hidden="true" />
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
            <button type="button">Share</button>
            <button type="button">Private</button>
            <button type="button">Edit</button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
