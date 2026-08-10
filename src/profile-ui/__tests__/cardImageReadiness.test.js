import assert from "node:assert/strict";
import test from "node:test";

import {
  createCardImageRequest,
  isCardImageAbortError,
  loadCardImage
} from "../cardImageReadiness.js";

test("fetches one same-origin PNG, decodes its object URL, and releases it once", async () => {
  const image = createFakeImage();
  const fetchCalls = [];
  const revoked = [];
  const pending = loadCardImage("/api/profile/card.png?theme=dark", {
    baseOrigin: "https://profile.example.test",
    createImage: () => image,
    createObjectUrl(blob) {
      assert.equal(blob.type, "image/png");
      return "blob:card-preview";
    },
    fetchImpl: async (src, options) => {
      fetchCalls.push([src, options.credentials]);
      return new Response(Buffer.from("png"), {
        headers: { "content-type": "image/png" }
      });
    },
    revokeObjectUrl(value) {
      revoked.push(value);
    }
  });

  await waitFor(() => image.src === "blob:card-preview");
  image.complete = true;
  image.naturalWidth = 1497;
  image.onload();

  const resource = await pending;
  assert.equal(resource.displaySrc, "blob:card-preview");
  assert.deepEqual(fetchCalls, [[
    "/api/profile/card.png?theme=dark",
    "same-origin"
  ]]);
  assert.equal(image.decodeCalls, 1);
  resource.release();
  resource.release();
  assert.deepEqual(revoked, ["blob:card-preview"]);
});

test("rejects unsafe sources and non-PNG responses before decoding", async () => {
  for (const src of [
    "https://other.example.test/card.png",
    "//other.example.test/card.png",
    "/u/../private/card.png",
    "/u/%252e%252e/private/card.png",
    "/u\\..\\private.png"
  ]) {
    assert.throws(
      () => loadCardImage(src, {
        baseOrigin: "https://profile.example.test",
        createImage: createFakeImage,
        createObjectUrl: () => "blob:unused",
        fetchImpl: async () => new Response(),
        revokeObjectUrl() {}
      }),
      /same-origin|safe/
    );
  }

  await assert.rejects(
    loadCardImage("/card.png", {
      baseOrigin: "https://profile.example.test",
      createImage: createFakeImage,
      createObjectUrl: () => "blob:unused",
      fetchImpl: async () => new Response("html", {
        headers: { "content-type": "text/html" }
      }),
      revokeObjectUrl() {}
    }),
    /non-empty PNG/
  );
});

test("aborts a pending fetch and keeps request objects identity-free", async () => {
  const controller = new AbortController();
  const pending = loadCardImage("/card.png", {
    baseOrigin: "https://profile.example.test",
    createImage: createFakeImage,
    createObjectUrl: () => "blob:unused",
    fetchImpl: async (_src, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    }),
    revokeObjectUrl() {},
    signal: controller.signal
  });
  controller.abort();

  await assert.rejects(pending, isCardImageAbortError);
  assert.deepEqual(
    createCardImageRequest({ sourceKind: "owner", src: "/card.png" }),
    { sourceKind: "owner", src: "/card.png" }
  );
});

function createFakeImage() {
  return {
    complete: false,
    decodeCalls: 0,
    async decode() {
      this.decodeCalls += 1;
    },
    naturalWidth: 0,
    onerror: null,
    onload: null,
    src: ""
  };
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("condition was not met");
}
