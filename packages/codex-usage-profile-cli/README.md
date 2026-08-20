# codex-usage-profile

Connect the account usage shown by Codex to a GitHub-backed Codex Usage Profile and receive a stable README card URL.

The CLI submits to the public [Codex Usage Profile](https://codex-usage-profile.meleeisdeveloping.chatgpt.site) service and returns stable profile, card, and README links.

## Requirements

- Node.js 20 or newer
- A recent `codex` CLI on `PATH`, or on macOS a standard `ChatGPT.app` or
  `Codex.app` installation under the system or user `Applications` directory
- A ChatGPT-backed Codex sign-in that supports `account/usage/read`
- A Codex Usage Profile service account linked through GitHub

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

On first use, the CLI opens a browser device flow and stores a narrow submit
credential after approval. A `submit` started before approval continues in the
same terminal and reports the final result there.

After a successful interactive login or submission, the CLI may ask whether
you’d like to star the GitHub repository. Declining does not affect login or
submission, and the prompt is skipped in CI and non-interactive runs.

An account can have up to three active CLI/API tokens. If browser approval
completes after that limit is reached, the CLI reports:

```text
Active token limit reached. Revoke an API token in Settings, then try again.
```

Revoke an old `Device login` token under the web Settings **API Tokens** section
and retry. CLI `logout` removes only the local credential file; it does not
revoke the corresponding server token.

After a successful human-readable submit, supported interactive terminals
render the `Profile` and `Card` URLs as clickable cyan OSC 8 hyperlinks. The
`README` value remains exact plain HTML-for-Markdown so it can be copied without
terminal control sequences. Its default `width="50%"` is adjustable, the image
uses the stable queryless card URL, and clicking it opens the public share page.
The result separates capture metadata from a compact,
indented `Links` block:

```text
✓ Usage submitted successfully.
Captured: 2026-07-11T00:00:00.000Z

Links
  Profile: https://example.com/?view=profile
  Card:    https://example.com/u/octocat/card.png
  README:  <a href="https://example.com/api/share/octocat"><img width="50%" src="https://example.com/u/octocat/card.png" alt="Codex usage profile" /></a>
```

On a color-capable TTY, the `Links` heading is dim gray. JSON, piped output,
`NO_COLOR`, `TERM=dumb`, and unsupported terminals keep the same information
structure without terminal control sequences; Profile and Card remain plain
URLs where hyperlinks are unavailable.

## Commands

```bash
npx codex-usage-profile@latest status
npx codex-usage-profile@latest submit
npx codex-usage-profile@latest logout
```

On first use, npm may ask for confirmation before installing the displayed package and version. Review both before approving the installation.

## Non-interactive Automation

On a trusted machine with an existing ChatGPT-backed Codex sign-in, use a pre-issued service token and pin the CLI to an exact version. `--yes` intentionally skips npm's installation confirmation and should not be combined with `@latest` in unattended execution.

```bash
CODEX_USAGE_PROFILE_TOKEN='<service-submit-token>' \
npx --yes codex-usage-profile@0.1.3 submit --json
```

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

- [CLI login, submit, privacy, and troubleshooting](https://github.com/postmelee/codex-usage-profile/blob/main/docs/cli-submit.md)
- [README card and cache behavior](https://github.com/postmelee/codex-usage-profile/blob/main/docs/readme-card.md)
- [Analyzer responsibility boundary](https://github.com/postmelee/codex-usage-profile/blob/main/docs/codex-usage-analyzer.md)

## License

MIT. This independent community project is not affiliated with, endorsed by, or sponsored by OpenAI. OpenAI and Codex names and trademarks belong to their respective owners.
