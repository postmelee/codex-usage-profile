import { sampleProfileSnapshot } from "./profile-snapshot/fixtures/sample-snapshot.js";
import { selectProfileViewModel } from "./profile-snapshot/index.js";
import { ProfilePage } from "./profile-ui/ProfilePage.jsx";
import { resolveProfileRoute } from "./profile-ui/profileRoutes.js";

export function App() {
  const route = resolveProfileRoute(window.location, sampleProfileSnapshot);
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
