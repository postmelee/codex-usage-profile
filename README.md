# Codex Usage Profile

[![Website](https://img.shields.io/badge/Website-Open-0969da)](https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site)
[![npm package](https://img.shields.io/npm/v/codex-usage-profile)](https://www.npmjs.com/package/codex-usage-profile)
[![CI](https://img.shields.io/github/actions/workflow/status/postmelee/codex-usage-profile/publish-npm.yml?branch=devel&label=CI)](https://github.com/postmelee/codex-usage-profile/actions/workflows/publish-npm.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Turn Codex account usage into a private-by-default profile and a stable GitHub README card.

Codex Usage Profile connects your GitHub identity to usage reported by the official Codex App Server `account/usage/read` API. The public MVP is available at [codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site](https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site), and the CLI uses that origin by default.

> [!IMPORTANT]
> The current production service supports the private preview, publish flow, and stable README card. A metadata-enhanced `/?profile={handle}` share page and social preview are included in the next deployment candidate but are not yet live. The preview embed below will be replaced only after that deployment passes production smoke checks.

<!-- PROFILE_CARD_EMBED_PLACEHOLDER
Replace after the next production deployment and `/?profile={handle}` smoke:

[![Codex usage profile](<PRODUCTION_CARD_URL>)](<PRODUCTION_PROFILE_URL>)
-->

## Support

Maintained with support from **OpenAI’s [Codex for Open Source](https://developers.openai.com/community/codex-for-oss)** program.

> _Support is provided to the maintainer and does not imply endorsement._

## Quick start

1. Open the [Codex Usage Profile website](https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site) and sign in with GitHub.
2. Submit your Codex usage from the machine where Codex is signed in:

   ```bash
   npx codex-usage-profile@latest submit
   ```

3. On first use, approve the browser device flow. npm may also ask you to confirm the package name and version before installation.
4. Open your private profile preview and verify the submitted values.
5. Select **Publish card** when you are ready to make the card public.
6. Copy the stable image URL or README Markdown from **Share** and add it to your GitHub profile or project README.

Future submits update the same image URL. Your README Markdown does not need to change when the usage data changes.

## What you get

- **Private by default:** a new profile is visible only to its authenticated GitHub owner until it is published.
- **Stable README card:** a 1497x918 PNG designed for GitHub README embedding.
- **Cache-aware updates:** changed usage produces a new ETag at the same image URL.
- **Social sharing:** the next deployment candidate adds a dedicated profile page backed by a 2400x1260 social preview image.
- **No separate usage export:** the CLI reads the identity-free account usage document through [`codex-usage-analyzer`](https://github.com/postmelee/codex-usage-analyzer) and submits it directly.

## Share surfaces

| Surface | URL | Availability | Purpose |
|---|---|---|---|
| README card | `/u/{handle}/card.png` | Available now | Stable PNG for GitHub profile and project READMEs |
| Public profile | `/?profile={handle}` | Next deployment | Human-readable share page with link-preview metadata |
| Social preview | `/u/{handle}/social.png` | Next deployment | Link preview image for social platforms |

Use the README card in Markdown after replacing `{handle}` with your published profile handle:

```md
![Codex usage profile](https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/u/{handle}/card.png)
```

The default card renders in English. Add `?locale=ko` for Korean. When you make the profile private, its public image endpoint returns `404`.

GitHub's image proxy can delay a visible refresh even after the origin serves the new card. See [README card usage and cache behavior](docs/readme-card.md) for the endpoint contract and troubleshooting steps.

## Requirements

- Node.js 20 or newer
- A ChatGPT-backed Codex sign-in on the submitting machine
- Codex available on `PATH`, or a standard macOS `ChatGPT.app` or `Codex.app` installation
- A GitHub account for profile ownership and publishing

The service never asks for your Codex/OpenAI password, local Codex `auth.json`, API key, access token, refresh token, or keychain entry.

## CLI reference

```bash
# Show authentication and submit status
npx codex-usage-profile@latest status

# Read and submit current account usage
npx codex-usage-profile@latest submit

# Remove the locally stored service credential
npx codex-usage-profile@latest logout
```

The CLI first looks for `codex` on `PATH`. On macOS it also checks the standard system and user Applications folders for `ChatGPT.app` and `Codex.app`.

For repeatable automation, pin the published version instead of using `@latest`. The current public version is `0.1.1`:

```bash
CODEX_USAGE_PROFILE_URL=https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site \
CODEX_USAGE_PROFILE_TOKEN='<service-submit-token>' \
npx --yes codex-usage-profile@0.1.1 submit --json
```

Only use a pre-issued service token on a trusted machine. See [CLI login and usage submit](docs/cli-submit.md) for credential locations, transmitted fields, error mapping, and package validation.

## How it works

1. GitHub OAuth establishes the profile owner. The GitHub access token is used to fetch the authenticated user and is then discarded.
2. The browser device flow issues the CLI a narrow submit token. The server stores only its digest.
3. `codex-usage-analyzer` reads `account/usage/read` through the installed Codex process and emits Account Usage Contract v1 without identity or credentials.
4. The service binds the usage document to the authenticated GitHub owner. Request data cannot select a different owner.
5. Publishing writes the public card, while private previews remain authenticated and are never persisted to public media.

If a submit stores usage but public media refresh fails, running the same submit again safely retries card convergence without creating a new usage revision.

## Data and privacy

The CLI transmits the account usage document to `POST /api/account-usage/submit`. It contains capture metadata, token totals, peak and streak statistics, and source-dated daily token buckets.

The web service separately owns your GitHub display name, login, avatar, stable provider user ID, sessions, visibility, profile handle, and rendered profile/card URLs. GitHub identity never comes from the submitted usage body.

Security boundaries include:

- CLI tokens are excluded from arguments, URLs, logs, analytics, success output, and error messages.
- File credentials are bound to the service origin and stored with owner-only permissions on macOS/Linux.
- Usage submit rejects identity, credential-like, wrapper, and unknown fields.
- Exact retries are idempotent; stale or conflicting revisions are rejected.
- Public PNG requests read only the stable media object; private previews stay authenticated.
- A revoked token can no longer submit updates; making a profile private stops public card access.

Revoke the CLI token from web Settings if it is exposed or the machine is no longer trusted.

## Development

```bash
npm install
npm run dev
npm run dev:runtime
npm test
npm run build
```

`npm run dev` starts the Vite frontend. `npm run dev:runtime` starts the same-origin local runtime for frontend and `/api/*` development.

Before publishing the npm package, run:

```bash
npm run scan:public-release
npm run verify:npm-release
npm run smoke:npm-package:local
```

See [production hosting architecture](docs/production-hosting.md), [Sites operations and rollback](docs/sites-operations.md), and [npm release operations](docs/npm-release.md) for deployment and release procedures.

## Documentation

- [CLI login and usage submit](docs/cli-submit.md)
- [README card endpoint and cache behavior](docs/readme-card.md)
- [Standalone analyzer integration](docs/codex-usage-analyzer.md)
- [Production hosting architecture](docs/production-hosting.md)
- [Sites operations and rollback](docs/sites-operations.md)
- [UsageSnapshot v2 legacy compatibility contract](docs/usage-snapshot-v2.md)

## License

The repository and published CLI package are licensed under the [MIT License](LICENSE). Copyright (c) 2026 postmelee.

## Trademark Notice

This is an unofficial community project and is not affiliated with, endorsed by, or sponsored by OpenAI. The generated card uses the `Codex` product name only as descriptive text and does not reproduce or reconstruct an OpenAI or Codex logo.
