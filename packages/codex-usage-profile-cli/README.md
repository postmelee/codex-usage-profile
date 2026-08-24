# codex-usage-profile

Submit the account usage shown by Codex to your GitHub-backed [Codex Usage Profile](https://codex-usage-profile.meleeisdeveloping.chatgpt.site) and receive stable profile, card, and README links.

## Quick start

Run this on the machine where Codex is signed in:

```bash
npx codex-usage-profile@latest submit
```

If a service credential is not stored yet, `submit` opens browser approval and continues in the same terminal after approval. npm may first ask you to confirm the package and version before installation.

After submission:

1. Review your private card preview on the website.
2. Select **Publish card** when you are ready.
3. Copy the README Markdown or open a social sharing action from **Share**.

Interactive runs may optionally ask whether you want to star the project. Declining does not affect submission, and the prompt is skipped in CI and non-interactive runs.

## Requirements

- Node.js 20 or newer
- A recent `codex` CLI on `PATH`, or on macOS a standard `ChatGPT.app` or `Codex.app` installation
- A ChatGPT-backed Codex sign-in that supports `account/usage/read`
- A GitHub account connected through the Codex Usage Profile website

API-key-only and Bedrock authentication do not provide the account usage method used by this CLI.

## Commands

```bash
npx codex-usage-profile@latest status
npx codex-usage-profile@latest submit
npx codex-usage-profile@latest logout
```

- `status` shows authentication, token metadata, the latest submission time, and profile links.
- `submit` signs in when necessary, reads account usage, and submits it.
- `logout` removes only the local credential file. Revoke the server token from web **Settings** when a machine is no longer trusted.

An account can have up to three active CLI/API tokens. If the limit is reached, revoke an older **Device login** token in web **Settings**, then retry with a new code.

## Submit result

A successful interactive submit returns copyable profile, card, and README values:

```text
✓ Usage submitted successfully.
Captured: 2026-07-11T00:00:00.000Z

Links
  Profile: https://codex-usage-profile.meleeisdeveloping.chatgpt.site/?view=profile
  Card:    https://codex-usage-profile.meleeisdeveloping.chatgpt.site/u/octocat/card.png
  README:  <a href="https://codex-usage-profile.meleeisdeveloping.chatgpt.site/api/share/octocat"><img width="50%" src="https://codex-usage-profile.meleeisdeveloping.chatgpt.site/u/octocat/card.png" alt="Codex usage profile" /></a>
```

Supported interactive terminals show the Profile and Card URLs as clickable links. The README value remains exact plain HTML so it can be copied without terminal control sequences.

The README link and image source stay fixed after future submits. The website uses revisioned links for new social posts without changing this Markdown.

## What submit sends

The CLI sends one Account Usage Contract v1 document containing:

- contract version and capture time
- lifetime and peak daily tokens
- longest-running turn and streak counts
- source-dated daily token buckets

It does not send Codex/OpenAI credentials, GitHub OAuth credentials, prompts, responses, tool data, local session files, or filesystem paths. GitHub identity and profile visibility remain server-owned.

## Credentials and automation

Browser approval stores a narrow service credential in the operating system's user configuration directory. On macOS and Linux, the directory and file use owner-only permissions. `logout` removes the local file; it does not revoke the server token or unset an environment-provided token.

For trusted non-interactive automation, inject a pre-issued token through a secret manager, pin the CLI to an exact version, and request JSON output:

```bash
CODEX_USAGE_PROFILE_TOKEN='<service-submit-token>' \
npx --yes codex-usage-profile@0.1.3 submit --json
```

Do not put the token in command arguments, URLs, repository variables, logs, or shell history.

## Documentation

- [Project overview](https://github.com/postmelee/codex-usage-profile)
- [CLI login, submit, privacy, and troubleshooting](https://github.com/postmelee/codex-usage-profile/blob/main/docs/cli-submit.md)
- [README card and social sharing](https://github.com/postmelee/codex-usage-profile/blob/main/docs/readme-card.md)

## License

MIT. This independent community project is not affiliated with, endorsed by, or sponsored by OpenAI. OpenAI and Codex names and trademarks belong to their respective owners.
