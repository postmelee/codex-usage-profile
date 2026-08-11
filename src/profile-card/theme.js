export const CARD_THEMES = Object.freeze(["light", "dark"]);
export const DEFAULT_CARD_THEME = "dark";

export const CARD_THEME_PALETTES = Object.freeze({
  dark: Object.freeze({
    avatarFallback: "#2f2f2f",
    background: "#181818",
    divider: "#242424",
    heatmap: Object.freeze([
      "#2f2f2f",
      "#203d59",
      "#245380",
      "#2a72b5",
      "#339cff"
    ]),
    primary: "#ffffff",
    secondary: "#aeaeae"
  }),
  light: Object.freeze({
    avatarFallback: "#eeeeec",
    background: "#ffffff",
    divider: "#ececec",
    heatmap: Object.freeze([
      "#eeeeee",
      "#c6e1f8",
      "#9bcdf5",
      "#67ade4",
      "#339cff"
    ]),
    primary: "#202123",
    secondary: "#686868"
  })
});

export function normalizeCardTheme(value) {
  const normalized = String(value ?? DEFAULT_CARD_THEME).trim().toLowerCase();
  return CARD_THEMES.includes(normalized) ? normalized : DEFAULT_CARD_THEME;
}

export function getCardThemePalette(value) {
  return CARD_THEME_PALETTES[normalizeCardTheme(value)];
}
