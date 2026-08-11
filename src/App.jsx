import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createProfileApiClient } from "./profile-api/client.js";
import { DeviceApprovalPage } from "./profile-ui/DeviceApprovalPage.jsx";
import { CardProfilePage } from "./profile-ui/CardProfilePage.jsx";
import { HomePage } from "./profile-ui/HomePage.jsx";
import { PublicProfilePage } from "./profile-ui/PublicProfilePage.jsx";
import { SettingsPage } from "./profile-ui/SettingsPage.jsx";
import {
  APP_ROUTE_TYPES,
  resolveAppRoute
} from "./profile-ui/appRoutes.js";
import {
  loadPublicProfileRoute,
  resolvePublicProfileRoute
} from "./profile-ui/publicProfileRoutes.js";
import { clearCardImageResourceCache } from "./profile-ui/cardImageReadiness.js";

export function App() {
  const profileApiClient = useMemo(() => createProfileApiClient(), []);
  const appRoute = useMemo(() => resolveAppRoute(window.location), []);
  const [authState, setAuthState] = useState({
    account: null,
    status: "loading"
  });
  const [publicRoute, setPublicRoute] = useState(() => (
    resolvePublicProfileRoute(window.location)
  ));
  const previousOwnerScopeRef = useRef(null);
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

  const ownerScope = authState.status === "authenticated"
    ? authState.account?.owner?.id ?? authState.account?.owner?.handle ?? null
    : null;
  useEffect(() => {
    const previousScope = previousOwnerScopeRef.current;
    if (previousScope && previousScope !== ownerScope) {
      clearCardImageResourceCache({
        scopeKey: previousScope,
        sourceKind: "owner"
      });
    }
    previousOwnerScopeRef.current = ownerScope;
  }, [ownerScope]);

  useEffect(() => {
    let isCurrent = true;
    const currentLocation = window.location;

    if (appRoute.type !== APP_ROUTE_TYPES.PUBLIC_PROFILE) {
      return () => {
        isCurrent = false;
      };
    }

    const initialRoute = resolvePublicProfileRoute(currentLocation);

    setPublicRoute(initialRoute);

    if (initialRoute.status !== "loading") {
      return () => {
        isCurrent = false;
      };
    }

    loadPublicProfileRoute(currentLocation, {
      client: profileApiClient
    }).then((nextRoute) => {
      if (isCurrent) {
        setPublicRoute(nextRoute);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [appRoute.type, profileApiClient]);

  if (appRoute.type === APP_ROUTE_TYPES.DEVICE) {
    return (
      <DeviceApprovalPage
        authState={authState}
        client={profileApiClient}
        location={window.location}
        onAuthStateChange={handleAuthStateChange}
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

  if (appRoute.type === APP_ROUTE_TYPES.HOME) {
    return (
      <HomePage
        authState={authState}
        client={profileApiClient}
        location={window.location}
        onAuthStateChange={handleAuthStateChange}
      />
    );
  }

  if (appRoute.type === APP_ROUTE_TYPES.OWNER_PROFILE) {
    return (
      <CardProfilePage
        authState={authState}
        client={profileApiClient}
        onAuthStateChange={handleAuthStateChange}
      />
    );
  }

  return (
    <PublicProfilePage
      authState={authState}
      client={profileApiClient}
      handle={publicRoute.handle}
      onAuthStateChange={handleAuthStateChange}
      profile={publicRoute.profile}
      status={publicRoute.status}
    />
  );
}
