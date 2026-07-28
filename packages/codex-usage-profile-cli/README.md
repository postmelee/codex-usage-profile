# codex-usage-profile

Connect the account usage shown by Codex to a GitHub-backed Codex Usage Profile and receive a stable README card URL.

> The production MVP service runs at
> `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site`, which is
> also the CLI default. For reproducible automation, pin `0.1.0`; for an
> interactive first run, review the version npm displays before accepting
> `@latest`.

## Requirements

- Node.js 20 or newer
- A recent `codex` CLI on `PATH`
- A ChatGPT-backed Codex sign-in that supports `account/usage/read`
- A Codex Usage Profile service account linked through GitHub

API-key-only and Bedrock Codex authentication do not provide the account usage method consumed by the analyzer.

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
npx --yes codex-usage-profile@0.1.0 submit --json
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

- [CLI login, submit, privacy, and troubleshooting](https://github.com/postmelee/codex-usage-profile/blob/devel/docs/cli-submit.md)
- [README card and cache behavior](https://github.com/postmelee/codex-usage-profile/blob/devel/docs/readme-card.md)
- [Analyzer responsibility boundary](https://github.com/postmelee/codex-usage-profile/blob/devel/docs/codex-usage-analyzer.md)

## License

MIT. This independent community project is not affiliated with, endorsed by, or sponsored by OpenAI. OpenAI and Codex names and trademarks belong to their respective owners.
