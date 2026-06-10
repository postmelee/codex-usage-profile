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

## Security And Privacy

- The service should never ask for a Codex/OpenAI password, local Codex `auth.json`, or raw OpenAI/GitHub OAuth tokens as profile data.
- CLI submit sends a profile snapshot JSON payload with a CLI API token in the `Authorization: Bearer ...` header.
- A raw CLI API token is returned only at issue/exchange time. Backend storage keeps a digest and metadata, not the raw token.
- Snapshot submit rejects credential-like fields and values such as OAuth access tokens, refresh tokens, local auth files, API keys, and `CODEX_ACCESS_TOKEN` environment assignments.
- Public profile lookup returns only the latest snapshot whose visibility is `public`; private or missing snapshots are treated as not found.
- The HTTP handler in this repository is a contract-level adapter. Real deployment still needs production session handling, CSRF/state validation, TLS, durable storage, and secret management.

