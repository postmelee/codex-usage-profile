import { useEffect, useMemo, useState } from "react";

import { createProfileApiClient } from "./profile-api/client.js";
import { sampleProfileSnapshot } from "./profile-snapshot/fixtures/sample-snapshot.js";
import { selectProfileViewModel } from "./profile-snapshot/index.js";
import { ProfilePage } from "./profile-ui/ProfilePage.jsx";
import {
  loadProfileRouteSnapshot,
  resolveProfileRoute
} from "./profile-ui/profileRoutes.js";

export function App() {
  const profileApiClient = useMemo(() => createProfileApiClient(), []);
  const [route, setRoute] = useState(() => (
    resolveProfileRoute(window.location, sampleProfileSnapshot)
  ));

  useEffect(() => {
    let isCurrent = true;
    const currentLocation = window.location;
    const initialRoute = resolveProfileRoute(currentLocation, sampleProfileSnapshot);

    setRoute(initialRoute);

    if (initialRoute.source !== "api") {
      return () => {
        isCurrent = false;
      };
    }

    loadProfileRouteSnapshot(currentLocation, {
      client: profileApiClient,
      sampleSnapshot: sampleProfileSnapshot
    }).then((nextRoute) => {
      if (isCurrent) {
        setRoute(nextRoute);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [profileApiClient]);

  const viewModel = route.status === "ready"
    ? selectProfileViewModel(route.snapshot)
    : null;

  return (
    <ProfilePage
      handle={route.handle}
      status={route.status}
      viewModel={viewModel}
    />
  );
}
