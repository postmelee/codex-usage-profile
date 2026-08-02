import { useState } from "react";

import { Icon } from "./Icons.jsx";
import { useLocale } from "./LocaleProvider.jsx";
import {
  HOME_QUICKSTART_STEPS,
  HOME_SUBMIT_COMMAND
} from "./homeOnboarding.js";

export function HomeQuickstart({ authenticated, loginHref, status }) {
  const [copyState, setCopyState] = useState("idle");
  const { t } = useLocale();

  async function handleCopyCommand() {
    try {
      if (!globalThis.navigator?.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }

      await globalThis.navigator.clipboard.writeText(HOME_SUBMIT_COMMAND);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <section
      className="home-quickstart"
      id="quickstart"
      aria-labelledby="quickstart-title"
    >
      <div className="home-quickstart-inner">
        <header className="home-quickstart-heading">
          <h2 id="quickstart-title">{t("quickstart.title")}</h2>
          <p>{t("quickstart.description")}</p>
        </header>

        {authenticated ? (
          <div className="home-command-tool">
            <span className="home-command-label">{t("quickstart.runInTerminal")}</span>
            <div className="home-command-row">
              <code>{HOME_SUBMIT_COMMAND}</code>
              <button
                aria-label={t("quickstart.copyCommand")}
                className="icon-command home-command-copy"
                onClick={handleCopyCommand}
                title={t("quickstart.copyCommand")}
                type="button"
              >
                <Icon name="copy" />
              </button>
            </div>
            <p
              aria-live="polite"
              className={`home-copy-status is-${copyState}`}
              role="status"
            >
              {getCopyStatus(copyState, t)}
            </p>
          </div>
        ) : (
          <QuickstartAccess loginHref={loginHref} status={status} />
        )}

        <ol className="home-quickstart-steps">
          {HOME_QUICKSTART_STEPS.map((step, index) => (
            <li key={step.id}>
              <span aria-hidden="true" className="home-step-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{t(`quickstart.step.${step.id}.title`)}</h3>
                <p>{t(`quickstart.step.${step.id}.description`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function QuickstartAccess({ loginHref, status }) {
  const { t } = useLocale();

  if (status === "loading") {
    return (
      <p className="home-quickstart-status" role="status">
        {t("quickstart.sessionChecking")}
      </p>
    );
  }

  if (status === "unavailable") {
    return (
      <p className="home-quickstart-status is-error" role="status">
        {t("quickstart.sessionUnavailable")}
      </p>
    );
  }

  return (
    <div className="home-quickstart-access">
      <p>{t("quickstart.sessionDescription")}</p>
      <a className="secondary-command" href={loginHref}>
        {t("quickstart.signInToView")}
      </a>
    </div>
  );
}

function getCopyStatus(status, t) {
  return {
    copied: t("quickstart.commandCopied"),
    error: t("quickstart.copyFailed"),
    idle: ""
  }[status] ?? "";
}
