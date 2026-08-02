import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { LocaleProvider } from "../profile-ui/LocaleProvider.jsx";
import { initializeDocumentLocale } from "../profile-ui/i18n.js";
import { MarketingLanding } from "./MarketingLanding.jsx";
import { createSitesMarketingConfig } from "./sites-config.js";
import "../styles.css";

const rootElement = globalThis.document?.getElementById("root");
const initialLocale = initializeDocumentLocale();

if (rootElement) {
  const config = createSitesMarketingConfig(import.meta.env, {
    currentOrigin: globalThis.location?.origin
  });

  createRoot(rootElement).render(
    <StrictMode>
      <LocaleProvider initialLocale={initialLocale}>
        <MarketingLanding config={config} />
      </LocaleProvider>
    </StrictMode>
  );
}
