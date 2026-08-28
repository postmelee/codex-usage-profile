# GitHub README card and social sharing

Codex Usage Profile creates a 1497x918 PNG from your GitHub identity and the account usage submitted from Codex. Publish the card once, copy the HTML embed into a GitHub profile or project README, and keep the same Markdown as your usage or card appearance changes.

The default display width is `50%`:

```html
<a href="https://codex-usage-profile.meleeisdeveloping.chatgpt.site/api/share/{handle}"><img width="50%" src="https://codex-usage-profile.meleeisdeveloping.chatgpt.site/u/{handle}/card.png" alt="Codex usage profile" /></a>
```

Replace `{handle}` with your published profile handle. Change only `width="50%"` if you want a different display size.

## Publish and copy the card

1. Sign in to [Codex Usage Profile](https://codex-usage-profile.meleeisdeveloping.chatgpt.site) with GitHub.
2. Run `npx codex-usage-profile@latest submit` on the machine where Codex is signed in.
3. Review the private preview and choose a card theme and language.
4. Select **Publish card**.
5. Open **Share** and copy **README Markdown**.
6. Paste the HTML into your GitHub profile or project README.

A profile must have submitted usage before it can be published. Making the profile private later stops public card access; private and missing cards both return `404`.

## Stable README URLs

README Markdown uses two fixed, queryless URLs:

| Purpose | URL |
|---|---|
| Card click target | `https://codex-usage-profile.meleeisdeveloping.chatgpt.site/api/share/{handle}` |
| Card image | `https://codex-usage-profile.meleeisdeveloping.chatgpt.site/u/{handle}/card.png` |

Submitting new usage or saving card settings does not change either URL. The README Markdown before and after an update is identical. The image content and ETag change at the stable image URL.

Do not add a timestamp or random query to the README image. The queryless URL follows the theme and language saved for the profile.

## README links and social links are different

The website intentionally uses a separate URL for newly shared social posts:

| Surface | URL contract | Changes after an update |
|---|---|---|
| README click target | `/api/share/{handle}` | No |
| README image | `/u/{handle}/card.png` | No; content and ETag update |
| Copied share link | `/api/share/{handle}/r/{revision}` | Yes |
| X, LinkedIn, Threads, Facebook, Reddit | `/api/share/{handle}/r/{revision}` | Yes |

The revision gives a new post a fresh crawler cache identity. It is not a historical card snapshot and does not require the service to keep old card records. Opening an older revision link still converges on the current public profile metadata.

The fixed URL remains the canonical click target in README Markdown. Use **Copy share link** or a social button when creating a new social post.

## Card theme and language

Profile settings support:

- themes: `dark` and `light`
- languages: `en` and `ko`

The queryless README image always follows the profile's current theme and language. Saving a new selection updates the stable image without changing the README.

Explicit variants remain available for consumers that need a specific representation:

```text
https://codex-usage-profile.meleeisdeveloping.chatgpt.site/u/{handle}/card.png?theme=dark
https://codex-usage-profile.meleeisdeveloping.chatgpt.site/u/{handle}/card.png?theme=light
https://codex-usage-profile.meleeisdeveloping.chatgpt.site/u/{handle}/card.png?locale=en
https://codex-usage-profile.meleeisdeveloping.chatgpt.site/u/{handle}/card.png?locale=ko
https://codex-usage-profile.meleeisdeveloping.chatgpt.site/u/{handle}/card.png?theme=light&locale=ko
```

If only one selector is supplied, the other selector uses the compatibility default (`dark` for theme and `en` for locale). These explicit URLs are useful for direct image download or a pinned variant, but they are not the Markdown returned by the normal README flow.

## How card updates work

The stable public card responds with:

```text
Content-Type: image/png
Cache-Control: public, no-cache, must-revalidate
ETag: "..."
```

`no-cache` means a cache may store the image but must revalidate it before reuse.

- A changed submit updates the published card and ETag.
- An exact retry can repair a missing media refresh without creating another usage revision.
- Saving theme or language updates the stable card and social image.
- A revalidation with the current ETag returns `304 Not Modified`.
- A revalidation after content changes returns the new PNG and ETag.

If usage was stored but media refresh temporarily failed, the CLI reports `media_unavailable` and `Retry-After`. Wait for the requested interval and run the same submit again.

## GitHub Camo cache

GitHub rewrites external README image sources through Camo. The origin can already serve the latest PNG while GitHub still displays an older cached image.

1. Open the queryless card URL directly and confirm that it shows the latest card.
2. Reload the GitHub README and allow time for Camo to revalidate.
3. If the origin is correct and the delay persists, inspect the rendered README image URL.
4. Use a Camo purge only when necessary:

   ```bash
   curl -X PURGE 'https://camo.githubusercontent.com/...'
   ```

A purge can cause all GitHub viewers of that Camo URL to fetch the image again, so use it sparingly. See [GitHub's documentation on anonymized URLs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-anonymized-urls).

The outer `<a href>` remains the fixed Codex Usage Profile share page even when GitHub proxies the image.

## Social preview behavior

The share page provides Open Graph and Twitter Card metadata. A personalized social image is 2400x1260 and uses the profile's current theme and language. The light social image uses an opaque neutral canvas and subtle outline so the white card remains distinct on white preview surfaces. This social-only treatment does not change the README `card.png` or the dark social image's transparent outer area.

After a submit or card-setting change:

- **Copy share link** and all five social targets receive the latest revision URL.
- the README Markdown remains unchanged
- the social image is updated for the latest public profile

Social platforms control their own crawler queues and caches. A new revision URL avoids reuse of the old page identity, but it cannot guarantee that a platform processes the image immediately.

Social actions open each provider's compose experience with a public link. They do not call a provider API to upload an image or publish a post automatically. A provider may ignore some prefilled text. If a button is unavailable on your device, copy the share link and paste it into the app manually.

## Privacy and failure behavior

- New profiles are private.
- Publishing is an explicit web action; a CLI submit does not change visibility.
- Private and missing card images both return `404`.
- Private and missing share pages use the same generic metadata and unavailable state.
- Temporary media failures return `503 media_unavailable` with a retry hint rather than a private-looking `404`.
- Public card responses read only published media and do not expose owner IDs, storage paths, credentials, or private revisions.

The CLI sends usage statistics, not GitHub identity or credentials. See [CLI login, privacy, and troubleshooting](cli-submit.md) for the complete transmitted-field and credential-storage boundaries.

## Troubleshooting

| Symptom | Check |
|---|---|
| Card returns `404` | Confirm that usage was submitted and **Publish card** is enabled for the correct handle |
| Direct card is new but GitHub is old | Wait for Camo revalidation, then consider a targeted purge |
| A social compose screen shows an old preview | Use the newest link copied from **Share**, then allow the provider time to crawl it |
| A social compose screen shows no image | Confirm that the public share link and social image return `200`, then retry later |
| Card theme or language is old | Save the setting again, verify the direct queryless card, and reload the README |
| CLI reports `media_unavailable` | Wait for `Retry-After` and repeat the same submit |

## Trademark notice

This is an unofficial community project and is not affiliated with, endorsed by, or sponsored by OpenAI. The card uses the `Codex` product name only as descriptive text and does not reproduce or reconstruct an OpenAI or Codex logo.
