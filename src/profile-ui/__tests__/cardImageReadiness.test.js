import assert from "node:assert/strict";
import test from "node:test";

import {
  createCardImageResourceCache,
  createCardImageRequest,
  isCardImageAbortError,
  loadCardImage
} from "../cardImageReadiness.js";

test("shares concurrent and sequential decoded resources until explicit eviction", async () => {
  let releaseLoad;
  let loadCount = 0;
  let disposeCount = 0;
  const gate = new Promise((resolve) => { releaseLoad = resolve; });
  const cache = createCardImageResourceCache({
    loadResource: async () => {
      loadCount += 1;
      await gate;
      return {
        displaySrc: "blob:shared-card",
        release() { disposeCount += 1; }
      };
    },
    now: () => 0
  });

  const firstPending = cache.acquire({
    scopeKey: "owner_1",
    sourceKind: "owner",
    src: "/api/profile/card.png?theme=dark"
  });
  const secondPending = cache.acquire({
    scopeKey: "owner_1",
    sourceKind: "owner",
    src: "/api/profile/card.png?theme=dark"
  });
  releaseLoad();
  const [first, second] = await Promise.all([firstPending, secondPending]);

  assert.equal(loadCount, 1);
  assert.equal(first.displaySrc, "blob:shared-card");
  assert.equal(second.displaySrc, "blob:shared-card");
  first.release();
  second.release();
  const third = await cache.acquire({
    scopeKey: "owner_1",
    sourceKind: "owner",
    src: "/api/profile/card.png?theme=dark"
  });
  assert.equal(loadCount, 1);
  assert.equal(disposeCount, 0);

  assert.equal(cache.clear({ sourceKind: "owner", scopeKey: "owner_1" }), 1);
  assert.equal(disposeCount, 0);
  third.release();
  third.release();
  assert.equal(disposeCount, 1);
});

test("bounds resources by TTL and least-recently-used eviction", async () => {
  let currentTime = 0;
  let loadCount = 0;
  const disposed = [];
  const cache = createCardImageResourceCache({
    maxEntries: 2,
    ttlMs: 10,
    now: () => currentTime,
    loadResource: async (src) => {
      loadCount += 1;
      const displaySrc = `blob:${src}:${loadCount}`;
      return {
        displaySrc,
        release() { disposed.push(displaySrc); }
      };
    }
  });
  const request = (src) => ({ sourceKind: "public", src });

  (await cache.acquire(request("/a.png"))).release();
  (await cache.acquire(request("/b.png"))).release();
  currentTime = 5;
  (await cache.acquire(request("/a.png"))).release();
  (await cache.acquire(request("/c.png"))).release();

  assert.equal(loadCount, 3);
  assert.deepEqual(disposed, ["blob:/b.png:2"]);
  currentTime = 11;
  const refreshedA = await cache.acquire(request("/a.png"));
  assert.equal(loadCount, 4);
  assert.equal(refreshedA.displaySrc, "blob:/a.png:4");
  refreshedA.release();
  assert.ok(disposed.includes("blob:/a.png:1"));
});

test("isolates owner scopes and never caches failed resource loads", async () => {
  let loadCount = 0;
  const cache = createCardImageResourceCache({
    loadResource: async () => {
      loadCount += 1;
      if (loadCount === 1) throw new Error("temporary image failure");
      return { displaySrc: `blob:card-${loadCount}`, release() {} };
    },
    now: () => 0
  });
  const ownerRequest = (scopeKey) => ({
    scopeKey,
    sourceKind: "owner",
    src: "/api/profile/card.png"
  });

  await assert.rejects(cache.acquire(ownerRequest("owner_1")), /temporary/);
  const recovered = await cache.acquire(ownerRequest("owner_1"));
  const otherOwner = await cache.acquire(ownerRequest("owner_2"));

  assert.equal(loadCount, 3);
  assert.notEqual(recovered.displaySrc, otherOwner.displaySrc);
  recovered.release();
  otherOwner.release();
  assert.throws(
    () => cache.acquire({ sourceKind: "owner", src: "/card.png" }),
    /scope key/
  );
});

test("aborts a pending owner resource when its scope is cleared", async () => {
  const cache = createCardImageResourceCache({
    loadResource: async (_src, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    }),
    now: () => 0
  });
  const pending = cache.acquire({
    scopeKey: "owner_1",
    sourceKind: "owner",
    src: "/api/profile/card.png"
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(cache.clear({ sourceKind: "owner", scopeKey: "owner_1" }), 1);
  await assert.rejects(pending, isCardImageAbortError);
  assert.equal(cache.size, 0);
});

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
