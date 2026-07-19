import { useState } from "react";

import { Icon } from "./Icons.jsx";
import {
  HOME_QUICKSTART_STEPS,
  HOME_SUBMIT_COMMAND
} from "./homeOnboarding.js";

export function HomeQuickstart({ authenticated, loginHref, status }) {
  const [copyState, setCopyState] = useState("idle");

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
          <h2 id="quickstart-title">Quickstart</h2>
          <p>
            Connect the CLI once, review your card, and reuse the same image link.
          </p>
        </header>

        {authenticated ? (
          <div className="home-command-tool">
            <span className="home-command-label">Run in your terminal</span>
            <div className="home-command-row">
              <code>{HOME_SUBMIT_COMMAND}</code>
              <button
                aria-label="Copy submit command"
                className="icon-command home-command-copy"
                onClick={handleCopyCommand}
                title="Copy submit command"
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
              {getCopyStatus(copyState)}
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
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function QuickstartAccess({ loginHref, status }) {
  if (status === "loading") {
    return (
      <p className="home-quickstart-status" role="status">
        Checking your GitHub session
      </p>
    );
  }

  if (status === "unavailable") {
    return (
      <p className="home-quickstart-status is-error" role="status">
        Sign in is temporarily unavailable.
      </p>
    );
  }

  return (
    <div className="home-quickstart-access">
      <p>Sign in to connect this browser session and reveal the CLI command.</p>
      <a className="secondary-command" href={loginHref}>
        Sign in to view command
      </a>
    </div>
  );
}

function getCopyStatus(status) {
  return {
    copied: "Command copied.",
    error: "Copy failed. Select the command and copy it manually.",
    idle: ""
  }[status] ?? "";
}
