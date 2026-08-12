# codex-usage-profile

Connect the account usage shown by Codex to a GitHub-backed Codex Usage Profile and receive a stable README card URL.

The public release line starts at `codex-usage-profile@0.1.0`. This package is
the immutable `0.1.1` patch, prepared for provenance publishing and production
validation through the existing staged-release gate.

> The production MVP service runs at
> `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site`, which is
> also the CLI default. For reproducible automation, pin `0.1.1`; for an
> interactive first run, review the version npm displays before accepting
> `@latest`.

## Requirements

- Node.js 20 or newer
- A recent `codex` CLI on `PATH`, or on macOS a standard `ChatGPT.app` or
  `Codex.app` installation under the system or user `Applications` directory
- A ChatGPT-backed Codex sign-in that supports `account/usage/read`
- A Codex Usage Profile service account linked through GitHub
- Optional: a locally authenticated `gh` CLI for the terminal GitHub star prompt

API-key-only and Bedrock Codex authentication do not provide the account usage method consumed by the analyzer.

Executable lookup prefers `codex` on `PATH`. If it is absent on macOS, the
analyzer checks `/Applications/ChatGPT.app`,
`/Applications/Codex.app`, `~/Applications/ChatGPT.app`, then
`~/Applications/Codex.app`. Nonstandard installations must expose the
official Codex CLI on `PATH`.

## Quick Start

One command can start browser login when needed and continue with submission:

```bash
npx codex-usage-profile@latest submit
```

The CLI defaults to the production Sites origin. Once login succeeds, the
service origin and a narrow submit credential are stored locally. Use
`--server` only for local development or an explicitly reviewed alternative
deployment.

During device login, supported interactive terminals render only the verification URL as a clickable cyan OSC 8 hyperlink. Piped output, `submit --json`, `TERM=dumb`, and terminals without a supported hyperlink signal receive the same plain URL without ANSI control sequences.

After browser approval, `Device approved` means only that device authorization
is complete. A `submit` flow continues in the same CLI process, and the terminal
reports its final submission result. An explicit `login` flow instead shows the
next submit command, preserving `--server` for a local or alternate service.
The browser does not redirect, copy to the clipboard, or execute a command
automatically; those actions remain under the user's control. Older clients
without an intent receive a generic return-to-terminal message. See the
detailed CLI guide below for the complete approval flow.

## Optional GitHub Star Prompt

After a fresh interactive `login` or a successful human-readable `submit`, the
CLI waits for this prompt block before printing the existing command result:

```text
Help us grow! 🌱
A GitHub star helps others discover Codex Usage Profile.
Would you like to star it on GitHub as @octocat? (Y/n)
✓ Starred! Thank you for your support, @octocat. ⭐
```

Enter is **Yes**; `y` and `yes` also star, while `n` and `no` continue without
starring. Consent runs a fixed `gh api --silent --method PUT` request for
`/user/starred/postmelee/codex-usage-profile` and never opens a browser. The
displayed account is the active local `gh` account, which may differ from the
Codex Usage Profile owner. The block is separated from the surrounding login or
submit output by blank lines. On a color-capable TTY the heading is cyan, the
explanation is dim gray, and the success message is green. `NO_COLOR` and
`TERM=dumb` preserve the same wording and spacing without ANSI escapes.

The prompt is skipped when the repository is already starred, `gh` is missing
or unavailable, an existing credential makes `login` return `Already signed
in`, the product command fails, or the command is running with `--json`, in CI,
or without TTY stdin and stdout. An automatic login inside `submit` offers it
only once, after submission succeeds. All `gh` failures are optional and
fail-soft: they do not replace the original command result or exit status.

This integration uses only the local `gh` credential for the fixed GitHub API
request. It does not use or store the product's GitHub OAuth token or service
submit credential, and it does not expose raw `gh` errors.

```bash
npx codex-usage-profile@latest status
npx codex-usage-profile@latest submit
npx codex-usage-profile@latest logout
```

On first use, npm may ask for confirmation before installing the displayed package and version. Review both before approving the installation.

Set `CODEX_USAGE_PROFILE_URL` instead of repeating `--server`. `CODEX_USAGE_PROFILE_TOKEN` can supply an externally managed submit token, but the CLI never accepts a token as a command argument.

## Non-interactive Automation

On a trusted machine with an existing ChatGPT-backed Codex sign-in, use a pre-issued service token and pin the CLI to an exact version. `--yes` intentionally skips npm's installation confirmation and should not be combined with `@latest` in unattended execution.

```bash
CODEX_USAGE_PROFILE_URL=https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site \
CODEX_USAGE_PROFILE_TOKEN='<service-submit-token>' \
npx --yes codex-usage-profile@0.1.1 submit --json
```

JSON, CI, and non-TTY execution never run the optional star prompt, so stdout
remains one machine-readable JSON document.

## What Submit Sends

The CLI imports `codex-usage-analyzer`, starts the installed Codex app-server, and sends one Account Usage Contract v1 document to `POST /api/account-usage/submit`. The document contains only:

- lifetime and peak daily tokens
- longest-running turn and streak counts
- source-dated daily token buckets
- contract version and capture time

GitHub name, login, avatar, visibility, and public URL remain server-owned. The CLI does not send Codex/OpenAI credentials, GitHub OAuth credentials, prompts, responses, tool data, or local session files.

Device id and display name travel in product-specific headers rather than inside the analyzer document. The submit credential is sent only in the `Authorization` header.

## Credential Storage

Device login returns a raw service credential once. The CLI stores it in an owner-only config directory using an atomic file replacement and `0600` file permissions on macOS and Linux. File credentials are bound to the service origin that issued them and are never sent to another origin.

`logout` removes the local file. It cannot unset `CODEX_USAGE_PROFILE_TOKEN`; remove that variable from the shell environment yourself. Revoke issued credentials immediately from the web Settings screen when a machine or token is no longer trusted.

## Documentation

- [CLI login, submit, privacy, and troubleshooting](https://github.com/postmelee/codex-usage-profile/blob/devel/docs/cli-submit.md)
- [README card and cache behavior](https://github.com/postmelee/codex-usage-profile/blob/devel/docs/readme-card.md)
- [Analyzer responsibility boundary](https://github.com/postmelee/codex-usage-profile/blob/devel/docs/codex-usage-analyzer.md)

## License

MIT. This independent community project is not affiliated with, endorsed by, or sponsored by OpenAI. OpenAI and Codex names and trademarks belong to their respective owners.
