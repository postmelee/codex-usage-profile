import React, { useState } from "react";
import { createRoot } from "react-dom/client";

import {
  clearCardImageResourceCache,
  useCardImageReadiness
} from "../../cardImageReadiness.js";

const CARD_SOURCE = "/__card-readiness/card.png";
const OWNER_SCOPE = "hook-fixture-owner";
const revokedObjectUrls = [];
let updateHarnessSource = null;

const originalCreateObjectUrl = URL.createObjectURL.bind(URL);
const originalRevokeObjectUrl = URL.revokeObjectURL.bind(URL);
URL.createObjectURL = (blob) => originalCreateObjectUrl(blob);
URL.revokeObjectURL = (value) => {
  revokedObjectUrls.push(value);
  originalRevokeObjectUrl(value);
};

function CardImageReadinessHarness() {
  const [src, updateSource] = useState(CARD_SOURCE);
  updateHarnessSource = updateSource;
  const readiness = useCardImageReadiness({
    scopeKey: OWNER_SCOPE,
    sourceKind: "owner",
    src
  });

  return (
    <output
      data-display-src={readiness.displaySrc ?? ""}
      data-status={readiness.status}
      data-visible-src={readiness.visibleSrc ?? ""}
      id="readiness-state"
    />
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<CardImageReadinessHarness />);

globalThis.__cardImageReadinessHarness = Object.freeze({
  cardSource: CARD_SOURCE,
  clear() {
    return clearCardImageResourceCache({
      scopeKey: OWNER_SCOPE,
      sourceKind: "owner"
    });
  },
  revokedObjectUrls,
  setSource(value) {
    updateHarnessSource(value);
  },
  unmount() {
    root.unmount();
  }
});
