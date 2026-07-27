# Codex Usage Profile

Codex Usage Profile combines GitHub identity with the account usage reported by Codex and renders a 998x612 PNG that can be embedded in a GitHub README.

A successful CLI submit updates stored usage and changes the card ETag while preserving one stable image URL. README Markdown therefore stays the same as usage changes.

> The public MVP service runs on ChatGPT Sites at
> `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site`.
> The CLI already uses this origin by default. npm package publication remains
> tracked in #44, so use the source checkout or a reviewed local tarball until
> that release is complete.

## MVP Flow

1. Open the website and sign in with GitHub.
2. Run the product CLI. If no credential exists, it opens the browser approval flow and continues after approval.
3. The CLI reads `account/usage/read` through `codex-usage-analyzer` and submits Account Usage Contract v1.
4. Open the owner profile, verify the updated private preview, then select **Publish card**.
5. Copy the stable image URL or README Markdown from **Share**.
6. Future submits update the same image URL.

After the npm package is published in #44, the intended command is:

```bash
npx codex-usage-profile@latest submit
```

The CLI defaults to the production Sites origin. `--server` remains available
for local development and an explicitly reviewed alternative deployment.

```bash
npx codex-usage-profile@latest status
npx codex-usage-profile@latest submit
npx codex-usage-profile@latest logout
```

On first use, npm may ask for confirmation before installing the displayed package and version. Review both before approving the installation.

See [CLI login and submit](docs/cli-submit.md) for source/tarball commands, credential locations, transmitted fields, privacy, error mapping, and troubleshooting.

### Non-interactive Automation

On a trusted machine that already has a ChatGPT-backed Codex sign-in, automation can use a pre-issued service token and an exact CLI version. `--yes` intentionally skips npm's installation confirmation, so do not combine it with `@latest` in unattended execution.

```bash
CODEX_USAGE_PROFILE_URL=https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site \
CODEX_USAGE_PROFILE_TOKEN='<service-submit-token>' \
npx --yes codex-usage-profile@0.1.0 submit --json
```

## README Card

```md
![Codex usage profile](https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/u/octocat/card.png)
```

The default URL renders English. Add `?locale=ko` for Korean. Making the profile private causes the public image endpoint to return `404`.

Public cards use this cache contract:

```text
Content-Type: image/png
Cache-Control: public, no-cache, must-revalidate
ETag: "..."
```

Each changed submit produces a new ETag. GitHub's image proxy can delay visible README refresh even after the origin returns the new card. See [README card usage and cache behavior](docs/readme-card.md).

If usage is stored but the public media refresh fails, the CLI reports that the submit is safe to run again. The exact retry keeps the stored usage revision and retries only the public card convergence.

## Data Boundary

The active CLI path uses the official Codex App Server `account/usage/read` result through the installed [`codex-usage-analyzer`](https://github.com/postmelee/codex-usage-analyzer) package.

Analyzer-owned Account Usage Contract v1 fields:

- capture time and contract version
- lifetime and peak daily tokens
- longest-running turn
- current and longest streak
- source-dated daily token buckets

Web-service-owned fields:

- GitHub display name, login, avatar and stable provider user id
- browser sessions and CLI submit tokens
- device metadata
- public/private visibility and profile handle
- profile/card URLs, rendering, localization and cache behavior

The CLI sends the account usage document itself to `POST /api/account-usage/submit`. Device metadata uses headers and GitHub identity comes only from the authenticated web account. The service never trusts an identity supplied beside usage.

The older [`UsageSnapshot v2`](docs/usage-snapshot-v2.md) remains an internal compatibility contract for the legacy snapshot API and compatibility-only modules. It is not emitted by the current analyzer package, submitted by the current CLI, or used by the production `/u/:handle` route.

## Development

```bash
npm install
npm run dev
npm run dev:runtime
npm test
npm run build
```

The Home and owner card routes are `/` and `/profile`. The hosted Sites public
profile URL is `/?profile={handle}`; local development also accepts
`/u/{handle}`. The public profile loads the allowlisted Account Usage response
from `GET /api/profiles/public/{handle}` and displays the stable
`/u/{handle}/card.png` image.

`npm run dev` starts the Vite frontend preview only. `npm run dev:runtime` starts a same-origin local runtime that routes `/api/*` to `createProfileBackendHttpHandler()` and delegates frontend routes to Vite middleware.

Local CLI smoke:

```bash
node packages/codex-usage-profile-cli/bin/codex-usage-profile.js --help
node packages/codex-usage-profile-cli/bin/codex-usage-profile.js login \
  --server http://127.0.0.1:5177
```

Package preflight:

```bash
npm pack --dry-run --workspace packages/codex-usage-profile-cli --json
```

### Cloud Run Container POC

Build the production frontend and the Cloud Run target image, then run the
container smoke against the same image:

```bash
npm run build:cloud-run
docker build --platform linux/amd64 \
  -t codex-usage-profile:task37 .
node scripts/smoke-cloud-run-container.mjs codex-usage-profile:task37
```

The smoke fixture uses `PROFILE_RUNTIME_MODE=spike` with a temporary file
store. Production mode rejects the file store and starts with the Postgres
(Neon) adapter from the server-only `NEON_DATABASE_URL` after verifying that
schema migrations are applied. It also requires `PROFILE_MEDIA_MODE=external`,
creates the R2 adapter from server-only `R2_*` values, and verifies bucket
readiness before listening. Actual Cloud Run, Neon, R2 and Secret Manager
resources remain deployment work in #43. See
[Production hosting architecture](docs/production-hosting.md).

## Runtime Configuration

Copy `.env.example` to a local `.env`. `.env` is ignored by git and must never be committed.

| Setting | Purpose |
|---|---|
| `GITHUB_CLIENT_ID` | GitHub OAuth app client id used by `/api/auth/github/login` |
| `GITHUB_CLIENT_SECRET` | Server-side secret used during OAuth code exchange |
| `PUBLIC_BASE_URL` | Public origin used to build OAuth callback and card URLs |
| `PROFILE_STORE_FILE` | Local durable store path for development |
| `PROFILE_MEDIA_MODE` | `memory` for local development; production accepts `external` only |
| `R2_ENDPOINT`, `R2_BUCKET`, `R2_REGION` | External public-card media location and region |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Server-only R2 credentials; read only when external media is created |
| `SESSION_SECURE_COOKIES` | Enables secure cookies behind HTTPS hosting |

GitHub OAuth callback URL:

```text
{PUBLIC_BASE_URL}/api/auth/github/callback
```

The GitHub access token is used only to fetch the authenticated GitHub user and is then discarded. GitHub name, login, and avatar remain server-owned identity fields.

When `.env` is missing, `npm run dev:runtime` still starts with safe defaults for non-OAuth smoke checks. GitHub login redirect requires `GITHUB_CLIENT_ID`; callback completion requires both OAuth values.

## CLI Authentication

The CLI uses the existing device login endpoints:

```text
POST /api/auth/device
POST /api/auth/device/poll
GET  /api/account-usage/status
POST /api/account-usage/submit
```

The browser approves a user code under the signed-in GitHub session. The approved poll response returns a narrow service token once. The server stores only its digest; the CLI stores the raw token in an owner-only local credential file with atomic replacement and `0600` permissions on macOS/Linux.

File credentials are bound to the issuing service origin and are never sent to another origin. `CODEX_USAGE_PROFILE_TOKEN` can override the file token but is never written to disk. `logout` removes the file and cannot unset a shell environment variable.

## Security And Privacy

- The service never asks for a Codex/OpenAI password, local Codex `auth.json`, API key, access token, refresh token or keychain entry.
- The analyzer delegates authentication to the installed Codex process and emits identity-free usage only.
- CLI tokens are excluded from argv, URLs, logs, analytics, success output and error messages.
- Usage submit rejects wrapper, identity, credential-like and unknown fields.
- A Bearer token can update only its bound GitHub owner. Body/header data cannot select another owner.
- New profiles default to private; public card access follows the web profile visibility setting.
- Exact retries are idempotent, stale/conflicting revisions are rejected, request bodies are size-limited, and submit is rate-limited.
- Public PNG requests read only the stable media object. Private previews remain authenticated on-demand renders and are never persisted to public media.
- The Sites production service provides TLS, D1 shared rate limiting, external
  backup/restore, operator account deletion, manual retention cleanup, and
  server-side secret management. Cloud Run/Neon/S3-compatible R2 remains the
  tested fallback in #43 rather than an MVP release prerequisite.

Revoke a CLI token immediately from web Settings when it is exposed or a machine is no longer trusted.

## Documentation

- [CLI login and usage submit](docs/cli-submit.md)
- [README image endpoint and cache](docs/readme-card.md)
- [Standalone analyzer integration](docs/codex-usage-analyzer.md)
- [Production hosting architecture](docs/production-hosting.md)
- [Sites operations and rollback](docs/sites-operations.md)
- [Legacy UsageSnapshot v2 compatibility contract](docs/usage-snapshot-v2.md)

## Trademark Notice

This is an unofficial community project and is not affiliated with, endorsed by, or sponsored by OpenAI. The generated card uses the `Codex` product name only as descriptive text and does not reproduce or reconstruct an OpenAI or Codex logo.
