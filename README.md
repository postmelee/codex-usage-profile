# Codex Usage Profile

Codex Usage Profile renders a Codex-style usage profile page and defines the backend contract for CLI-submitted profile snapshots. The current implementation keeps the local preview available from fixture data while adding API boundaries for future CLI submit, public profile lookup, and README/card rendering work.

## Development

```bash
npm install
npm run dev
npm test
npm run build
```

The local preview is available at `/u/meleeisdeveloping`. Unknown `/u/:handle` routes are wired to the public snapshot API client and fall back to an unavailable state when no public snapshot exists.

The Vite dev server renders the frontend preview only. Auth, CLI login, snapshot submit, and public snapshot lookup need a host adapter that mounts `createProfileBackendHttpHandler()` on the same origin or proxies `/api/*` to that handler.

## Runtime Configuration

The backend package exposes a framework-neutral `Request`/`Response` handler instead of a standalone server. A host adapter should pass runtime configuration into `createProfileBackendHttpHandler()`:

| Setting | Purpose |
|---|---|
| `GITHUB_CLIENT_ID` | GitHub OAuth app client id used by `/api/auth/github/login` |
| `GITHUB_CLIENT_SECRET` | Host adapter secret used by the injected GitHub OAuth client during code exchange |
| `PUBLIC_BASE_URL` | Public origin used to build the OAuth callback URL |
| `PROFILE_STORE_FILE` | Local durable store path when using `createFileProfileBackendStore()` |
| `SESSION_SECURE_COOKIES` | Enable secure cookies behind HTTPS production hosting |

The MVP login and submit runtime flow is:

1. CLI calls `POST /api/cli/login/start` and opens the returned `browserUrl`.
2. Browser visits `GET /api/auth/github/login?cli_login_challenge=...`.
3. GitHub redirects to `GET /api/auth/github/callback`.
4. Callback upserts the GitHub owner, sets an `HttpOnly` session cookie, and approves the CLI challenge for the signed-in owner.
5. CLI calls `POST /api/cli/login/exchange` once to receive a raw CLI token.
6. Future CLI submit requests use `Authorization: Bearer ...` against `POST /api/snapshots/submit`.

## Security And Privacy

- The service should never ask for a Codex/OpenAI password, local Codex `auth.json`, or raw OpenAI/GitHub OAuth tokens as profile data.
- GitHub OAuth access tokens are used only to resolve the signed-in GitHub user and are not written to the profile store.
- Browser sessions use `HttpOnly`, `SameSite=Lax` cookies. Production hosting should enable secure cookies and terminate TLS before exposing OAuth or submit routes.
- CLI submit sends a profile snapshot JSON payload with a CLI API token in the `Authorization: Bearer ...` header.
- A raw CLI API token is returned only at issue/exchange time. Backend storage keeps a digest and metadata, not the raw token.
- Snapshot submit rejects credential-like fields and values such as OAuth access tokens, refresh tokens, local auth files, API keys, and `CODEX_ACCESS_TOKEN` environment assignments.
- Public profile lookup returns only the latest snapshot whose visibility is `public`; private or missing snapshots are treated as not found.
- The HTTP handler in this repository is a contract-level adapter. Real deployment still needs rate limiting, CSRF review for state-changing browser routes, production database selection, backup policy, and secret management.
