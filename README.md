# Codex Usage Profile

Turn Codex account usage into a private-by-default profile and a stable GitHub README card.

<a href="https://codex-usage-profile.meleeisdeveloping.chatgpt.site/api/share/postmelee"><img width="50%" src="https://codex-usage-profile.meleeisdeveloping.chatgpt.site/u/postmelee/card.png" alt="Codex usage profile" /></a>

[![Website](https://img.shields.io/badge/Website-Open-0969da)](https://codex-usage-profile.meleeisdeveloping.chatgpt.site)
[![npm package](https://img.shields.io/npm/v/codex-usage-profile)](https://www.npmjs.com/package/codex-usage-profile)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**[Open Codex Usage Profile →](https://codex-usage-profile.meleeisdeveloping.chatgpt.site)**

## Quick start

1. Open the website and sign in with GitHub. Your profile starts private.
2. On the machine where Codex is signed in, run:

   ```bash
   npx codex-usage-profile@latest submit
   ```

   When no service login is stored, or a saved login is no longer valid, the CLI guides you through browser approval and continues the same submission. npm may also ask you to confirm the package and version before installation.
3. Review the private card preview, select **Publish card**, then open **Share** to copy your README Markdown or share to a social network.

Future submits and saved card appearance changes update the same README image URL. You do not need to replace the Markdown.

## What you get

- **Private by default:** only you can see a new profile until you publish it.
- **Stable README card:** one queryless image URL continues to show your latest published card.
- **Theme and language controls:** save a light or dark card in English or Korean without changing the README URL.
- **Fresh links for new social posts:** copied share links and the X, LinkedIn, Threads, Facebook, and Reddit buttons use the latest revision URL.
- **Local credential boundary:** the CLI never uploads your Codex/OpenAI password, API key, access token, refresh token, `auth.json`, prompts, responses, or session files.

Social platforms cache previews independently. A new revision URL gives a new post a fresh cache identity, but the platform may still need time to fetch and process the image.

## Add the card to a README

Replace `{handle}` with your published profile handle:

```html
<a href="https://codex-usage-profile.meleeisdeveloping.chatgpt.site/api/share/{handle}"><img width="50%" src="https://codex-usage-profile.meleeisdeveloping.chatgpt.site/u/{handle}/card.png" alt="Codex usage profile" /></a>
```

The outer link and image URL stay fixed:

- Click target: `/api/share/{handle}`
- Image source: `/u/{handle}/card.png`

Change only `width="50%"` if you want a different display size. Submit and card-setting changes update the PNG and ETag at the same URL. GitHub Camo may delay the visible refresh even after the origin has the new image.

Use the website's **Share** action for social posts. It copies `/api/share/{handle}/r/{revision}`, while the README Markdown remains unchanged.

See [README card and social sharing](docs/readme-card.md) for themes, languages, cache behavior, and troubleshooting.

## Commands

| Command | What it does |
|---|---|
| `npx codex-usage-profile@latest submit` | Sign in through browser approval when needed, then read and submit current Codex usage |
| `npx codex-usage-profile@latest login` | Check the saved service login and start browser approval when needed |
| `npx codex-usage-profile@latest status` | Show the connected account and latest submission metadata |
| `npx codex-usage-profile@latest logout` | Remove the locally stored service credential |
| `npx codex-usage-profile@latest --help` (`-h`) | Show all commands; add `--help` after a command for its supported options |
| `npx codex-usage-profile@latest --version` (`-v`) | Show the installed CLI version |

Requirements:

- Node.js 20 or newer
- A ChatGPT-backed Codex sign-in that supports account usage
- Codex on `PATH`, or a standard macOS `ChatGPT.app` or `Codex.app` installation
- A GitHub account for profile ownership and publishing

For browser approval, automation, credential storage, transmitted fields, and error recovery, see the [CLI user guide](docs/cli-submit.md).

## Privacy and safety

- GitHub OAuth establishes the profile owner; submitted usage cannot select another owner.
- The usage document contains capture metadata, token totals, peak and streak statistics, and source-dated daily token buckets.
- GitHub identity, visibility, handle, and public URLs remain owned by the web service.
- CLI credentials are scoped to usage submission and can be revoked from web **Settings**.
- Making a profile private stops public card access. Private and missing cards both return `404`.
- Exact retries are idempotent. If a submit result is unknown after a network failure, running the same submit again is safe.

## Help and feedback

- Ask setup questions in [Q&A](https://github.com/postmelee/codex-usage-profile/discussions/categories/q-a).
- Share card ideas in [Profile Card Customization Ideas](https://github.com/postmelee/codex-usage-profile/discussions/115).
- Show your published setup in [Show and tell](https://github.com/postmelee/codex-usage-profile/discussions/116).
- Report reproducible bugs or request a feature through the [issue chooser](https://github.com/postmelee/codex-usage-profile/issues/new/choose).
- Report vulnerabilities privately through the [Security Policy](SECURITY.md).

## Contributing

Code, documentation, bug reports, design feedback, and ideas are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Support

Maintained with support from OpenAI's [Codex for Open Source](https://developers.openai.com/community/codex-for-oss) program.

Support is provided to the maintainer and does not imply endorsement.

## License and trademark

The repository and published CLI package are licensed under the [MIT License](LICENSE). Copyright (c) 2026 postmelee.

This is an unofficial community project and is not affiliated with, endorsed by, or sponsored by OpenAI. OpenAI and Codex names and trademarks belong to their respective owners. The generated card uses the `Codex` product name only as descriptive text and does not reproduce or reconstruct an OpenAI or Codex logo.
