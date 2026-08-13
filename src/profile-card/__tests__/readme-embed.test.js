import assert from "node:assert/strict";
import test from "node:test";

import {
  README_CARD_DEFAULT_WIDTH,
  buildReadmeCardSnippet
} from "../readme-embed.js";

test("builds a linked and size-adjustable README card", () => {
  assert.equal(README_CARD_DEFAULT_WIDTH, "50%");
  assert.equal(
    buildReadmeCardSnippet(
      "https://profiles.example.test/u/postmelee/card.png",
      "https://profiles.example.test/api/share/postmelee"
    ),
    '<a href="https://profiles.example.test/api/share/postmelee">'
      + '<img width="50%" '
      + 'src="https://profiles.example.test/u/postmelee/card.png" '
      + 'alt="Codex usage profile" /></a>'
  );
});

test("escapes URL query separators for HTML attributes", () => {
  assert.equal(
    buildReadmeCardSnippet(
      "https://profiles.example.test/card.png?theme=dark&locale=ko",
      "https://profiles.example.test/share?from=readme&mode=card"
    ),
    '<a href="https://profiles.example.test/share?from=readme&amp;mode=card">'
      + '<img width="50%" '
      + 'src="https://profiles.example.test/card.png?theme=dark&amp;locale=ko" '
      + 'alt="Codex usage profile" /></a>'
  );
});

test("rejects missing, relative, credentialed, and unsafe URLs", () => {
  const cardUrl = "https://profiles.example.test/u/postmelee/card.png";
  const shareUrl = "https://profiles.example.test/api/share/postmelee";

  assert.equal(buildReadmeCardSnippet(null, shareUrl), null);
  assert.equal(buildReadmeCardSnippet(cardUrl, null), null);
  assert.equal(buildReadmeCardSnippet("/u/postmelee/card.png", shareUrl), null);
  assert.equal(buildReadmeCardSnippet(cardUrl, "/api/share/postmelee"), null);
  assert.equal(buildReadmeCardSnippet("javascript:alert(1)", shareUrl), null);
  assert.equal(buildReadmeCardSnippet(cardUrl, "data:text/html,unsafe"), null);
  assert.equal(
    buildReadmeCardSnippet(
      "https://user:secret@profiles.example.test/card.png",
      shareUrl
    ),
    null
  );
  assert.equal(
    buildReadmeCardSnippet(
      cardUrl,
      "https://user:secret@profiles.example.test/api/share/postmelee"
    ),
    null
  );
});
