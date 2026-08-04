import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.jsx";
import { LocaleProvider } from "./profile-ui/LocaleProvider.jsx";
import { ThemeProvider } from "./profile-ui/ThemeProvider.jsx";
import { initializeDocumentLocale } from "./profile-ui/i18n.js";
import "./styles.css";

const initialLocale = initializeDocumentLocale();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <LocaleProvider initialLocale={initialLocale}>
        <App />
      </LocaleProvider>
    </ThemeProvider>
  </StrictMode>
);
