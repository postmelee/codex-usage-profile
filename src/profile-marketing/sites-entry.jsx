import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { MarketingLanding } from "./MarketingLanding.jsx";
import { createMarketingConfig } from "./marketing-config.js";
import "../styles.css";

const rootElement = globalThis.document?.getElementById("root");

if (rootElement) {
  const config = createMarketingConfig({
    canonicalAppUrl: import.meta.env.VITE_CANONICAL_APP_URL || null
  });

  createRoot(rootElement).render(
    <StrictMode>
      <MarketingLanding config={config} />
    </StrictMode>
  );
}
