import { useCallback, useEffect, useMemo, useState } from "react";

import { createProfileApiClient } from "./profile-api/client.js";
import { sampleProfileSnapshot } from "./profile-snapshot/fixtures/sample-snapshot.js";
import { selectProfileViewModel } from "./profile-snapshot/index.js";
import { DeviceApprovalPage } from "./profile-ui/DeviceApprovalPage.jsx";
import { ProfilePage } from "./profile-ui/ProfilePage.jsx";
import { SettingsPage } from "./profile-ui/SettingsPage.jsx";
import {
  APP_ROUTE_TYPES,
  resolveAppRoute
} from "./profile-ui/appRoutes.js";
import {
  loadProfileRouteSnapshot,
  resolveProfileRoute
} from "./profile-ui/profileRoutes.js";

export function App() {
  const profileApiClient = useMemo(() => createProfileApiClient(), []);
  const appRoute = useMemo(() => resolveAppRoute(window.location), []);
  const [authState, setAuthState] = useState({
    account: null,
    status: "loading"
  });
  const [route, setRoute] = useState(() => (
    resolveProfileRoute(window.location, sampleProfileSnapshot)
  ));
  const handleAuthStateChange = useCallback((nextAuthState) => {
    setAuthState(nextAuthState);
  }, []);

  useEffect(() => {
    let isCurrent = true;

    profileApiClient.getCurrentAccount().then((account) => {
      if (!isCurrent) {
        return;
      }

      setAuthState({
        account,
        status: account ? "authenticated" : "anonymous"
      });
    }).catch(() => {
      if (isCurrent) {
        setAuthState({
          account: null,
          status: "unavailable"
        });
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [profileApiClient]);

  useEffect(() => {
    let isCurrent = true;
    const currentLocation = window.location;

    if (appRoute.type !== APP_ROUTE_TYPES.PROFILE) {
      return () => {
        isCurrent = false;
      };
    }

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
  }, [appRoute.type, profileApiClient]);

  const viewModel = route.status === "ready"
    ? selectProfileViewModel(route.snapshot)
    : null;

  if (appRoute.type === APP_ROUTE_TYPES.DEVICE) {
    return (
      <DeviceApprovalPage
        authState={authState}
        client={profileApiClient}
        location={window.location}
      />
    );
  }

  if (appRoute.type === APP_ROUTE_TYPES.SETTINGS) {
    return (
      <SettingsPage
        authState={authState}
        client={profileApiClient}
        location={window.location}
        onAuthStateChange={handleAuthStateChange}
      />
    );
  }

  return (
    <ProfilePage
      authState={authState}
      client={profileApiClient}
      handle={route.handle}
      onAuthStateChange={handleAuthStateChange}
      status={route.status}
      viewModel={viewModel}
    />
  );
}
