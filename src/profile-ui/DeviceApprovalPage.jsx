import { useMemo, useState } from "react";

export function DeviceApprovalPage({ authState, client, location = window.location }) {
  const initialUserCode = useMemo(() => readDeviceUserCode(location), [location]);
  const [userCode, setUserCode] = useState(initialUserCode);
  const [approvalState, setApprovalState] = useState({
    error: null,
    status: "idle"
  });
  const authStatus = authState?.status ?? "loading";
  const isAuthenticated = authStatus === "authenticated";
  const normalizedUserCode = normalizeUserCodeInput(userCode);
  const loginHref = client.buildGitHubLoginUrl({
    redirectTo: buildDeviceRedirectPath(normalizedUserCode)
  });
  const canApprove = isAuthenticated && normalizedUserCode && approvalState.status !== "submitting";

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canApprove) {
      return;
    }

    setApprovalState({ error: null, status: "submitting" });

    try {
      await client.authorizeDeviceLogin({ userCode: normalizedUserCode });
      setApprovalState({ error: null, status: "approved" });
    } catch (error) {
      setApprovalState({
        error: error instanceof Error ? error.message : "Device approval failed",
        status: "error"
      });
    }
  }

  return (
    <div className="app-frame">
      <main className="device-shell" data-auth-status={authStatus}>
        <section className="device-panel" aria-labelledby="device-title">
          <header className="device-header">
            <p>Codex Usage Profile</p>
            <h1 id="device-title">Authorize device</h1>
          </header>

          <form className="device-form" onSubmit={handleSubmit}>
            <label htmlFor="device-user-code">User code</label>
            <input
              autoComplete="one-time-code"
              id="device-user-code"
              inputMode="text"
              onChange={(event) => setUserCode(event.target.value)}
              placeholder="ABCD-1234"
              type="text"
              value={userCode}
            />

            {authStatus === "loading" ? (
              <p className="device-status">Checking signed-in account.</p>
            ) : null}

            {authStatus === "unavailable" ? (
              <p className="device-status is-error">Signed-in account unavailable.</p>
            ) : null}

            {authStatus === "anonymous" ? (
              <a className="device-primary-action" href={loginHref}>
                Sign in with GitHub
              </a>
            ) : (
              <button className="device-primary-action" disabled={!canApprove} type="submit">
                {approvalState.status === "submitting" ? "Approving" : "Approve device"}
              </button>
            )}

            {approvalState.status === "approved" ? (
              <p className="device-status is-success">Device approved.</p>
            ) : null}

            {approvalState.status === "error" ? (
              <p className="device-status is-error">{approvalState.error}</p>
            ) : null}
          </form>
        </section>
      </main>
    </div>
  );
}

export function readDeviceUserCode(location) {
  const search = location?.search ?? "";
  const params = new URLSearchParams(search);

  return params.get("user_code") ?? params.get("userCode") ?? "";
}

export function buildDeviceRedirectPath(userCode) {
  const normalizedUserCode = normalizeUserCodeInput(userCode);
  const params = new URLSearchParams();

  if (normalizedUserCode) {
    params.set("user_code", normalizedUserCode);
  }

  return `/device${params.size ? `?${params.toString()}` : ""}`;
}

function normalizeUserCodeInput(value) {
  return typeof value === "string" ? value.trim() : "";
}
