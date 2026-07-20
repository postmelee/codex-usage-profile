import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { MarketingLanding } from "./MarketingLanding.jsx";
import { createSitesMarketingConfig } from "./sites-config.js";
import "../styles.css";

const rootElement = globalThis.document?.getElementById("root");

if (rootElement) {
  const config = createSitesMarketingConfig(import.meta.env, {
    currentOrigin: globalThis.location?.origin
  });

  createRoot(rootElement).render(
    <StrictMode>
      <MarketingLanding config={config} />
    </StrictMode>
  );
}
