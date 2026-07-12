# Codex Usage Profile

Codex Usage Profile combines GitHub identity with Codex account usage and renders a public 998x612 PNG that can be embedded in a GitHub README. A stable image URL is revalidated after each successful usage submit, so README markup does not need to change when the card data changes.

## README Card

1. Sign in with GitHub from `/`.
2. Open `/profile` and confirm the private card preview.
3. Submit Codex usage, then select **Publish card**.
4. Open **Share** and copy the README Markdown.

```md
![Codex usage profile](https://profiles.example.com/u/octocat/card.png)
```

The default URL renders English. Add `?locale=ko` for Korean. Making the profile private causes the public image endpoint to return `404`.

The usage portion follows the official Codex App Server [`account/usage/read`](https://developers.openai.com/codex/app-server#7-token-usage-chatgpt) result: summary metrics and daily token buckets. GitHub OAuth remains the source for the displayed name, login, and avatar. See [GitHub README card usage and cache behavior](docs/readme-card.md) for the complete flow, ETag updates, and GitHub Camo guidance.

## Development

```bash
npm install
npm run dev
npm run dev:runtime
npm test
npm run build
```

The Home and owner card routes are `/` and `/profile`. The existing full profile preview is available at `/u/meleeisdeveloping`. Unknown `/u/:handle` routes are wired to the public snapshot API client and fall back to an unavailable state when no public snapshot exists.

`npm run dev` starts the Vite frontend preview only. `npm run dev:runtime` starts a same-origin local runtime that routes `/api/*` to `createProfileBackendHttpHandler()` and delegates frontend routes to Vite middleware.

## Usage Snapshot Contract

`UsageSnapshot v2` is the shared data contract for analyzer-produced usage data. The contract is documented in [`docs/usage-snapshot-v2.md`](docs/usage-snapshot-v2.md).

The intended boundary is:

- `codex-usage-analyzer` reads local usage data and emits a `UsageSnapshot v2` JSON object.
- `codex-usage-profile` authenticates users, receives snapshots, stores latest public/private state, and renders profile/card UI.
- GitHub-facing fields such as login, avatar URL, display name, bio, profile URL, visibility, sessions, tokens, and devices belong to the web service account/profile layer, not to the analyzer snapshot.
- Product-specific CLIs can wrap the analyzer SDK and submit the resulting snapshot, but should keep rendered UI-only values and account identity outside `payload.snapshot`.

## Analyzer Package

The analyzer now has a standalone repository at [`postmelee/codex-usage-analyzer`](https://github.com/postmelee/codex-usage-analyzer).

This repository still includes `codex-usage-analyzer` as a temporary workspace compatibility copy at [`packages/codex-usage-analyzer`](packages/codex-usage-analyzer/README.md).

The analyzer CLI smoke path is:

```bash
node packages/codex-usage-analyzer/bin/codex-usage-analyzer.js analyze --json
```

The analyzer package is contract-first at this stage. It exposes the SDK/CLI boundary and canonical `UsageSnapshot v2` validator, but the real local usage parser is still a follow-up. See [`docs/codex-usage-analyzer.md`](docs/codex-usage-analyzer.md) for SDK exports, wrapper compatibility, the standalone repository, and dependency transition options.

## Runtime Configuration

The backend package exposes a framework-neutral `Request`/`Response` handler instead of a standalone server. A host adapter should pass runtime configuration into `createProfileBackendHttpHandler()`:

Copy `.env.example` to `.env` for local runtime work. `.env` is ignored by git and must contain real local secrets only on your machine.

| Setting | Purpose |
|---|---|
| `GITHUB_CLIENT_ID` | GitHub OAuth app client id used by `/api/auth/github/login` |
| `GITHUB_CLIENT_SECRET` | Host adapter secret used by the injected GitHub OAuth client during code exchange |
| `PUBLIC_BASE_URL` | Public origin used to build the OAuth callback URL |
| `PROFILE_STORE_FILE` | Local durable store path when using `createFileProfileBackendStore()` |
| `SESSION_SECURE_COOKIES` | Enable secure cookies behind HTTPS production hosting |

For local GitHub OAuth testing, configure the OAuth App callback URL to:

```text
{PUBLIC_BASE_URL}/api/auth/github/callback
```

The runtime uses the GitHub access token only to fetch the authenticated GitHub user, then discards it.

When `.env` is missing, `npm run dev:runtime` still starts with safe defaults for frontend and non-OAuth API smoke checks. GitHub login redirect needs `GITHUB_CLIENT_ID`; callback completion needs both GitHub OAuth settings.

This local runtime currently verifies the browser GitHub OAuth and session boundary. The MVP CLI auth flow is planned as a device-code flow so users can run `npx codex-usage-profile@latest submit` without configuring a local callback:

1. CLI calls a device login start endpoint and receives a verification URL, user code, device code, expiry, and poll interval.
2. CLI displays the verification URL and user code, then polls the device login status endpoint.
3. Browser opens the verification URL. If needed, the user signs in with GitHub and approves the pending CLI device code.
4. The poll response returns a raw CLI API token once after approval.
5. CLI stores the token locally with restrictive permissions.
6. Future CLI submit requests use `Authorization: Bearer ...` against `POST /api/snapshots/submit`.

## Security And Privacy

- The service should never ask for a Codex/OpenAI password, local Codex `auth.json`, or raw OpenAI/GitHub OAuth tokens as profile data.
- GitHub OAuth access tokens are used only to resolve the signed-in GitHub user and are not written to the profile store.
- Browser sessions use `HttpOnly`, `SameSite=Lax` cookies. Production hosting should enable secure cookies and terminate TLS before exposing OAuth or submit routes.
- CLI submit sends a profile snapshot JSON payload with a CLI API token in the `Authorization: Bearer ...` header.
- A raw CLI API token is returned only at issue/exchange time. Backend storage keeps a digest and metadata, not the raw token.
- Snapshot submit rejects credential-like fields and values such as OAuth access tokens, refresh tokens, local auth files, API keys, and `CODEX_ACCESS_TOKEN` environment assignments.
- Analyzer snapshots must not include GitHub-facing profile data such as GitHub login, avatar URL, bio, profile URL, service visibility, session ids, CLI tokens, or device metadata. The web service merges GitHub account/profile records with usage snapshots after submit.
- Public profile lookup returns only the latest snapshot whose visibility is `public`; private or missing snapshots are treated as not found.
- The HTTP handler in this repository is a contract-level adapter. Real deployment still needs rate limiting, CSRF review for state-changing browser routes, production database selection, backup policy, and secret management.

## Trademark Notice

This is an unofficial community project and is not affiliated with, endorsed by, or sponsored by OpenAI. The generated card uses the `Codex` product name only as descriptive text and does not reproduce or reconstruct an OpenAI or Codex logo.
