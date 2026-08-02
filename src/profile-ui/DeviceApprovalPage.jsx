import { useEffect, useMemo, useRef, useState } from "react";

import { CodexCheckCircleIcon } from "./Icons.jsx";
import { useLocale } from "./LocaleProvider.jsx";
import { ProfileShell } from "./ProfileShell.jsx";
import {
  DEVICE_APPROVAL_ERROR_KIND,
  DEVICE_APPROVAL_UI_STATUS,
  classifyDeviceApprovalError,
  createDeviceApprovalGuidance,
  getDeviceApprovalErrorMessageId,
  normalizeDeviceApprovalResult
} from "./deviceApproval.js";

export function DeviceApprovalPage({
  authState,
  client,
  location = window.location,
  onAuthStateChange
}) {
  const { locale, t } = useLocale();
  const initialUserCode = useMemo(() => readDeviceUserCode(location), [location]);
  const [userCode, setUserCode] = useState(initialUserCode);
  const [approvalState, setApprovalState] = useState({
    copyStatus: "idle",
    errorId: null,
    result: null,
    status: DEVICE_APPROVAL_UI_STATUS.IDLE
  });
  const approvalInFlightRef = useRef(false);
  const userCodeInputRef = useRef(null);
  const authStatus = authState?.status ?? "loading";
  const isAuthenticated = authStatus === "authenticated";
  const normalizedUserCode = normalizeUserCodeInput(userCode);
  const isApproving = approvalState.status === DEVICE_APPROVAL_UI_STATUS.APPROVING;
  const isApproved = approvalState.status === DEVICE_APPROVAL_UI_STATUS.APPROVED;
  const isRetryableError = (
    approvalState.status === DEVICE_APPROVAL_UI_STATUS.RETRYABLE_ERROR
  );
  const isTerminalError = (
    approvalState.status === DEVICE_APPROVAL_UI_STATUS.TERMINAL_ERROR
  );
  const hasApprovalError = (
    isRetryableError ||
    isTerminalError
  );
  const loginHref = client.buildGitHubLoginUrl({
    redirectTo: buildDeviceRedirectPath(normalizedUserCode)
  });
  const canApprove = Boolean(
    isAuthenticated &&
    normalizedUserCode &&
    (
      approvalState.status === DEVICE_APPROVAL_UI_STATUS.IDLE ||
      isRetryableError
    )
  );
  const guidance = approvalState.result
    ? createDeviceApprovalGuidance(
      approvalState.result.intent,
      location?.origin,
      locale
    )
    : null;

  useEffect(() => {
    if (!isTerminalError) return;

    userCodeInputRef.current?.focus();
    userCodeInputRef.current?.select();
  }, [isTerminalError]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canApprove || approvalInFlightRef.current) {
      return;
    }

    approvalInFlightRef.current = true;
    setApprovalState({
      copyStatus: "idle",
      errorId: null,
      result: null,
      status: DEVICE_APPROVAL_UI_STATUS.APPROVING
    });

    try {
      const result = normalizeDeviceApprovalResult(
        await client.authorizeDeviceLogin({ userCode: normalizedUserCode })
      );
      setApprovalState({
        copyStatus: "idle",
        errorId: null,
        result,
        status: DEVICE_APPROVAL_UI_STATUS.APPROVED
      });
    } catch (error) {
      const { kind } = classifyDeviceApprovalError(error);
      setApprovalState({
        copyStatus: "idle",
        errorId: getDeviceApprovalErrorMessageId(error, kind),
        result: null,
        status: kind === DEVICE_APPROVAL_ERROR_KIND.RETRYABLE
          ? DEVICE_APPROVAL_UI_STATUS.RETRYABLE_ERROR
          : DEVICE_APPROVAL_UI_STATUS.TERMINAL_ERROR
      });
    } finally {
      approvalInFlightRef.current = false;
    }
  }

  function handleUserCodeChange(event) {
    setUserCode(event.target.value);
    if (hasApprovalError) {
      setApprovalState({
        copyStatus: "idle",
        errorId: null,
        result: null,
        status: DEVICE_APPROVAL_UI_STATUS.IDLE
      });
    }
  }

  async function handleCopyCommand() {
    if (!guidance?.command || approvalState.copyStatus === "copying") {
      return;
    }

    setApprovalState((current) => ({ ...current, copyStatus: "copying" }));
    try {
      if (typeof navigator?.clipboard?.writeText !== "function") {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(guidance.command);
      setApprovalState((current) => ({ ...current, copyStatus: "copied" }));
    } catch {
      setApprovalState((current) => ({ ...current, copyStatus: "failed" }));
    }
  }

  return (
    <ProfileShell
      authState={authState}
      client={client}
      layout="fullscreen"
      onAuthStateChange={onAuthStateChange}
      pageHeading={false}
      showShare={false}
      title={t("device.title")}
    >
      <section className="device-view" data-auth-status={authStatus}>
        <section className="device-panel" aria-labelledby="device-title">
          <header className="device-header">
            <h1 id="device-title">{t("device.title")}</h1>
            <p>{t("device.description")}</p>
          </header>

          <form
            aria-busy={isApproving ? "true" : "false"}
            className="device-form"
            onSubmit={handleSubmit}
          >
            <label htmlFor="device-user-code">{t("device.userCode")}</label>
            <input
              aria-describedby={hasApprovalError ? "device-approval-error" : undefined}
              aria-invalid={hasApprovalError ? "true" : undefined}
              autoComplete="one-time-code"
              disabled={isApproving || isApproved}
              id="device-user-code"
              inputMode="text"
              onChange={handleUserCodeChange}
              placeholder="ABCD-1234"
              ref={userCodeInputRef}
              spellCheck="false"
              type="text"
              value={userCode}
            />

            <p className="device-security-note">
              {t("device.securityNote")}
            </p>

            {authStatus === "loading" ? (
              <p className="device-status">{t("settings.state.loading.message")}</p>
            ) : null}

            {authStatus === "unavailable" ? (
              <p className="device-status is-error">
                {t("settings.state.unavailable.message")}
              </p>
            ) : null}

            {authStatus === "anonymous" ? (
              <a className="device-primary-action" href={loginHref}>
                {t("account.loginWithGitHub")}
              </a>
            ) : (
              <button
                className={`device-primary-action${isApproved ? " is-approved" : ""}`}
                disabled={!canApprove}
                type="submit"
              >
                {isApproved ? (
                  <>
                    <CodexCheckCircleIcon />
                    <span>{t("device.approved")}</span>
                  </>
                ) : isApproving ? (
                  t("device.approving")
                ) : isRetryableError ? (
                  t("device.retry")
                ) : isTerminalError ? (
                  t("device.enterNewCode")
                ) : (
                  t("device.approve")
                )}
              </button>
            )}

            <div className="device-feedback">
              <div
                aria-atomic="true"
                aria-live="polite"
              >
                {isApproving ? (
                  <p className="device-status">{t("device.approvingStatus")}</p>
                ) : null}

                {isApproved && guidance ? (
                  <section
                    aria-label={t("device.authorizationComplete")}
                    className="device-success"
                  >
                    <p className="device-status is-success">{guidance.message}</p>

                    {guidance.command ? (
                      <>
                        <div className="device-command-row">
                          <code>{guidance.command}</code>
                          <button
                            className="device-copy-action"
                            disabled={approvalState.copyStatus === "copying"}
                            onClick={handleCopyCommand}
                            type="button"
                          >
                            {t("device.copyCommand")}
                          </button>
                        </div>
                        <p className="device-copy-status">
                          {approvalState.copyStatus === "copied"
                            ? t("device.commandCopied")
                            : approvalState.copyStatus === "failed"
                              ? t("device.copyFailed")
                              : ""}
                        </p>
                      </>
                    ) : null}

                    <nav
                      aria-label={t("device.authorizationComplete")}
                      className="device-success-links"
                    >
                      <a href="/">{t("common.nav.home")}</a>
                      <a href="/profile">{t("common.nav.profile")}</a>
                    </nav>
                  </section>
                ) : null}
              </div>

              {hasApprovalError ? (
                <p
                  className="device-status is-error"
                  id="device-approval-error"
                  role="alert"
                >
                  {t(approvalState.errorId)}
                </p>
              ) : null}
            </div>

            <a className="device-help-link" href="/#quickstart">
              {t("device.viewSetupGuide")}
            </a>
          </form>
        </section>
      </section>
    </ProfileShell>
  );
}

export function readDeviceUserCode(location) {
  const search = location?.search ?? "";
  const params = new URLSearchParams(search);

  return params.get("user_code") ?? params.get("userCode") ?? "";
}

export function buildDeviceRedirectPath(userCode) {
  const normalizedUserCode = normalizeUserCodeInput(userCode);
  const params = new URLSearchParams({ view: "device" });

  if (normalizedUserCode) {
    params.set("user_code", normalizedUserCode);
  }

  return `/?${params.toString()}`;
}

function normalizeUserCodeInput(value) {
  return typeof value === "string" ? value.trim() : "";
}
