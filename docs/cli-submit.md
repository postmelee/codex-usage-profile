# CLI login and usage submit

The `codex-usage-profile` CLI reads the account usage shown by Codex and submits it to the Codex Usage Profile connected to your GitHub account. New profiles remain private until you publish them on the website.

For normal use, run:

```bash
npx codex-usage-profile@latest submit
```

The public CLI connects to [Codex Usage Profile](https://codex-usage-profile.meleeisdeveloping.chatgpt.site) by default. You do not need to provide a service URL.

## Requirements

- Node.js 20 or newer
- A ChatGPT-backed Codex sign-in that supports `account/usage/read`
- A recent `codex` CLI on `PATH`, or a standard macOS `ChatGPT.app` or `Codex.app` installation
- A GitHub account connected through the Codex Usage Profile website

API-key-only and Bedrock authentication do not provide the account usage method used by this CLI. The CLI delegates authentication to the installed Codex process and never asks you to paste an OpenAI or Codex token.

### Finding Codex

The CLI looks for the Codex executable in this order:

1. an executable `codex` on `PATH`
2. `/Applications/ChatGPT.app/Contents/Resources/codex`
3. `/Applications/Codex.app/Contents/Resources/codex`
4. `~/Applications/ChatGPT.app/Contents/Resources/codex`
5. `~/Applications/Codex.app/Contents/Resources/codex`

The application paths are macOS-only fallbacks. On Linux, Windows, or a nonstandard macOS installation, make the official Codex CLI available on `PATH`.

## Submit for the first time

1. Run `npx codex-usage-profile@latest submit`.
2. If needed, npm displays the package and version and asks for installation confirmation. Review both before accepting.
3. The CLI prints a verification URL and user code and tries to open the browser.
4. Sign in to the website with GitHub and approve the matching code.
5. Return to the same terminal. The running `submit` command continues, reads account usage, and reports the result.
6. Open your private profile preview, verify the card, and select **Publish card** when you are ready.

Browser approval confirms the CLI device only. The terminal's final result confirms whether usage submission succeeded. If the browser did not open automatically, use the printed URL and code.

Supported interactive terminals render the verification URL as a clickable link. Piped output, JSON output, `NO_COLOR`, `TERM=dumb`, and terminals without hyperlink support receive the same plain URL without control sequences.

## Optional GitHub star prompt

After a new interactive login or a successful human-readable submit, the CLI may ask whether you want to star `postmelee/codex-usage-profile` with the active account from your local GitHub CLI.

- Pressing Enter, `y`, or `yes` accepts. The default is **Yes**.
- `n` or `no` declines and continues the original login or submit result.
- Declining never affects authentication or submission.
- The prompt is skipped if the repository is already starred, the GitHub CLI is unavailable or not authenticated, the command failed, JSON output is requested, input or output is not a TTY, or `CI` is active.
- A GitHub CLI lookup or star failure is ignored and does not change the original command's exit status.

The product's GitHub OAuth token and service submit credential are never used for starring. The CLI does not read or store the GitHub CLI credential.

## Commands and options

| Command | Purpose |
|---|---|
| `submit` | Sign in when needed, read account usage, and submit it |
| `login` | Check the local credential and start browser approval when needed |
| `status` | Show the connected handle, token metadata, latest submission time, and profile URL |
| `logout` | Remove the local credential file |

```bash
npx codex-usage-profile@latest submit
npx codex-usage-profile@latest login
npx codex-usage-profile@latest status
npx codex-usage-profile@latest logout
```

| Option | Commands | Purpose |
|---|---|---|
| `--server <origin>` | `login`, `submit`, `status` | Advanced: override the service origin, or use `CODEX_USAGE_PROFILE_URL` |
| `--timeout <ms>` | `login`, `submit`, `status` | Set a request/analyzer timeout from 1 to 120000 milliseconds |
| `--json` | `submit`, `status` | Print allowlisted machine-readable output |
| `-h`, `--help` | global and every command | Print global or command-specific help without loading credentials or starting Codex App Server |
| `-v`, `--version` | global | Print the CLI version |

Use global help to list commands, then place `--help` after a command to see only its supported options:

```bash
npx codex-usage-profile@latest --help
npx codex-usage-profile@latest submit --help
```

The supported short form is `-h`; `-help` is not an alias. Invalid commands and options exit with an error and
print the appropriate global or command-specific help command to run next.

The CLI does not provide an option that accepts a raw token in a command argument or URL.

## Submit result and README Markdown

A successful interactive submit reports whether the document was accepted or unchanged, the capture time, and copyable links:

```text
✓ Usage submitted successfully.
Captured: 2026-07-11T00:00:00.000Z

Links
  Profile: https://codex-usage-profile.meleeisdeveloping.chatgpt.site/?view=profile
  Card:    https://codex-usage-profile.meleeisdeveloping.chatgpt.site/u/octocat/card.png
  README:  <a href="https://codex-usage-profile.meleeisdeveloping.chatgpt.site/api/share/octocat"><img width="50%" src="https://codex-usage-profile.meleeisdeveloping.chatgpt.site/u/octocat/card.png" alt="Codex usage profile" /></a>
```

Interactive terminals may render Profile and Card as clickable links. README remains exact plain HTML without ANSI or hyperlink sequences.

The README value always uses:

- fixed click target `/api/share/{handle}`
- queryless image source `/u/{handle}/card.png`
- default `width="50%"`

Future submits and card appearance changes update the image and ETag at the same URL. The README Markdown does not change. See [README card and social sharing](readme-card.md) for cache behavior and revisioned social links.

JSON, piped output, `NO_COLOR`, `TERM=dumb`, and terminals without hyperlink support keep the same information without unsupported terminal formatting.

## What submit sends

The CLI validates and sends one Account Usage Contract v1 document:

```json
{
  "contractVersion": 1,
  "capturedAt": "2026-07-11T00:00:00.000Z",
  "summary": {
    "lifetimeTokens": 1234567890,
    "peakDailyTokens": 45600000,
    "longestRunningTurnSec": 754,
    "currentStreakDays": 3,
    "longestStreakDays": 21
  },
  "dailyUsageBuckets": []
}
```

The example is synthetic. `null` means unavailable and is not converted to zero. `dailyUsageBuckets: null` and `[]` remain distinct.

The request also includes a narrow service credential in the `Authorization` header and a locally generated device ID and display name in product-specific headers.

The CLI does **not** send:

- OpenAI or Codex access tokens, refresh tokens, cookies, API keys, or local authentication files
- GitHub OAuth credentials, name, login, avatar, email, or account ID
- prompts, responses, tool input/output, or local session files
- profile visibility, public handle, image URL, README Markdown, or private revision
- raw App Server messages, stderr, or local filesystem paths

GitHub identity and visibility come only from the authenticated owner record on the website.

## Credential storage and revocation

Browser approval returns a narrow service credential once. The CLI stores it with the service origin, token record ID, and stable device ID.

| OS | Default file |
|---|---|
| macOS | `~/Library/Application Support/codex-usage-profile/credentials.json` |
| Linux | `${XDG_CONFIG_HOME:-~/.config}/codex-usage-profile/credentials.json` |
| Windows | `%APPDATA%\codex-usage-profile\credentials.json` |

On macOS and Linux, directories use `0700` and files use `0600`. Atomic replacement is used, and symlinks, unexpected file types, and overly open permissions are rejected.

`CODEX_USAGE_PROFILE_TOKEN` takes precedence over a file credential and is not written to disk. `logout` removes only the local file; it cannot unset an environment variable or revoke a server token.

### Expired or revoked credentials

When `submit` receives HTTP `401` or `410` with a saved file credential, it keeps the existing file, prints a
reconnection message, and starts browser approval once. After approval is stored atomically, the same captured
Account Usage Contract document is submitted once with the replacement credential. If approval fails or expires,
the previous file remains in place. If the replacement credential is also rejected, the command exits instead of
starting another approval loop.

An environment-provided `CODEX_USAGE_PROFILE_TOKEN` is never replaced automatically. If it is rejected, remove or
unset the value in the current shell, CI environment, or secret manager, then run
`npx codex-usage-profile@latest submit` again to use browser approval. The CLI does not overwrite or delete the
environment value.

Revoke a token immediately from web **Settings → API Tokens** when a machine or token is no longer trusted.

An account can have up to three active CLI/API tokens. Local `logout` does not revoke a server token. If browser approval reaches the limit, the CLI reports:

```text
Active token limit reached. Revoke an API token in Settings, then try again.
```

Revoke an older **Device login** token, then start a new approval code.

## Non-interactive automation

Use automation only on a trusted machine where Codex and a ChatGPT-backed sign-in are already available. Create a service submit token in web **Settings**, store it in a secret manager, pin an exact CLI version, and request JSON output:

```bash
CODEX_USAGE_PROFILE_TOKEN='<service-submit-token>' \
npx --yes codex-usage-profile@0.1.4 submit --json
```

`--yes` skips npm's package installation confirmation. Do not combine unattended `--yes` with `@latest`. Review version updates separately.

JSON output, non-TTY execution, and `CI` skip the optional star prompt, so standard output remains one JSON document.
If browser approval is required during a JSON submit, the verification URL, code, and progress are written to
standard error; standard output remains the final JSON document only.

## Errors and recovery

| Error | What to check |
|---|---|
| `CODEX_NOT_FOUND` | Install the official Codex CLI on `PATH` or use a standard macOS app location |
| `APP_SERVER_START_FAILED`, `APP_SERVER_EXITED` | Verify that the installed Codex can start `codex app-server` |
| `APP_SERVER_TIMEOUT` | Check connectivity and retry within the allowed timeout |
| `APP_SERVER_RPC_ERROR` | Update Codex and confirm a ChatGPT-backed sign-in |
| `APP_SERVER_PROTOCOL_ERROR`, `INVALID_ACCOUNT_USAGE_RESPONSE` | Update Codex and the CLI package |
| HTTP `401`, `410` with a saved file credential during `submit` | Complete the one browser reapproval started by the CLI; it then retries the same captured usage once |
| HTTP `401`, `410` with `CODEX_USAGE_PROFILE_TOKEN` | Remove or unset the rejected environment value, then run `submit` again to use browser approval |
| HTTP `409` during device approval | Revoke an older token if the three-token limit was reached |
| HTTP `409` during submit | The document is older than the stored revision or conflicts at the same capture time |
| HTTP `429` | Wait for the reported retry delay |
| HTTP `413`, `415` | Update the CLI to match the service contract |
| `media_unavailable` / HTTP `503` | Usage may be stored while public media refresh needs a retry; wait for `Retry-After` and run the same submit again |

If the network fails after submission and the result is unknown, running the same submit again is safe. Exact retries are idempotent and do not create another usage revision.

The CLI does not print raw upstream stderr, RPC messages, local paths, or service error bodies. Include only the CLI version, Codex version, Node.js version, operating system, and safe error code in a bug report.

## Security boundaries

- The website never asks for an OpenAI or Codex password or local authentication file.
- The installed Codex process owns ChatGPT authentication.
- A submit credential can update usage only for its linked GitHub owner.
- Identity, device, wrapper, credential-like, and unknown fields are rejected from the usage body.
- Only web profile settings can publish a card or make it private.
- Private and missing public cards both return `404`.
