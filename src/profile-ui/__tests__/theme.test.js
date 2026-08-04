import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import {
  DEFAULT_RESOLVED_THEME,
  THEME_ATTRIBUTE,
  THEME_MEDIA_QUERY,
  THEME_PREFERENCE_ATTRIBUTE,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  initializeDocumentTheme,
  normalizeThemePreference,
  readDocumentThemeState,
  readStoredThemePreference,
  resolveThemePreference,
  subscribeToThemeChanges,
  syncDocumentTheme,
  writeStoredThemePreference
} from "../theme.js";

const PROJECT_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);

test("theme preference normalization accepts only system, light, and dark", () => {
  assert.deepEqual(THEME_PREFERENCES, ["system", "light", "dark"]);
  assert.equal(normalizeThemePreference(" SYSTEM "), "system");
  assert.equal(normalizeThemePreference("Light"), "light");
  assert.equal(normalizeThemePreference("dark"), "dark");
  assert.equal(normalizeThemePreference("sepia"), "system");
  assert.equal(normalizeThemePreference(null), "system");
});

test("storage persists only explicit overrides and safely falls back", () => {
  const storage = createStorage();

  assert.equal(readStoredThemePreference(storage), "system");
  assert.equal(writeStoredThemePreference("dark", storage), "dark");
  assert.equal(storage.getItem(THEME_STORAGE_KEY), "dark");
  assert.equal(readStoredThemePreference(storage), "dark");

  assert.equal(writeStoredThemePreference("system", storage), "system");
  assert.equal(storage.getItem(THEME_STORAGE_KEY), null);

  storage.setItem(THEME_STORAGE_KEY, "unsupported");
  assert.equal(readStoredThemePreference(storage), "system");

  const throwingStorage = {
    getItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    }
  };
  assert.equal(readStoredThemePreference(throwingStorage), "system");
  assert.equal(writeStoredThemePreference("light", throwingStorage), "light");
});

test("theme resolution follows the system only without an explicit override", () => {
  assert.equal(resolveThemePreference("system", { matches: true }), "dark");
  assert.equal(resolveThemePreference("system", { matches: false }), "light");
  assert.equal(resolveThemePreference("system", null), DEFAULT_RESOLVED_THEME);
  assert.equal(resolveThemePreference("light", { matches: true }), "light");
  assert.equal(resolveThemePreference("dark", { matches: false }), "dark");
});

test("document theme initialization and synchronization keep preference separate", () => {
  const documentValue = createDocument();
  const storage = createStorage({ [THEME_STORAGE_KEY]: "dark" });

  assert.deepEqual(initializeDocumentTheme({
    document: documentValue,
    mediaQueryList: { matches: false },
    storage
  }), {
    preference: "dark",
    resolvedTheme: "dark"
  });
  assert.equal(
    documentValue.documentElement.getAttribute(THEME_PREFERENCE_ATTRIBUTE),
    "dark"
  );
  assert.equal(
    documentValue.documentElement.getAttribute(THEME_ATTRIBUTE),
    "dark"
  );
  assert.equal(documentValue.documentElement.style.colorScheme, "dark");

  assert.deepEqual(syncDocumentTheme("system", {
    document: documentValue,
    mediaQueryList: { matches: false }
  }), {
    preference: "system",
    resolvedTheme: "light"
  });
});

test("provider initialization reuses a valid bootstrap document state", () => {
  const documentValue = createDocument({
    [THEME_ATTRIBUTE]: "dark",
    [THEME_PREFERENCE_ATTRIBUTE]: "system"
  });

  assert.deepEqual(readDocumentThemeState({
    document: documentValue,
    mediaQueryList: { matches: false },
    storage: createStorage()
  }), {
    preference: "system",
    resolvedTheme: "dark"
  });

  documentValue.documentElement.setAttribute(THEME_ATTRIBUTE, "sepia");
  assert.deepEqual(readDocumentThemeState({
    document: documentValue,
    mediaQueryList: { matches: false },
    storage: createStorage()
  }), {
    preference: "system",
    resolvedTheme: "light"
  });

  documentValue.documentElement.setAttribute(
    THEME_PREFERENCE_ATTRIBUTE,
    "dark"
  );
  documentValue.documentElement.setAttribute(THEME_ATTRIBUTE, "light");
  assert.deepEqual(readDocumentThemeState({
    document: documentValue,
    mediaQueryList: { matches: false },
    storage: createStorage({ [THEME_STORAGE_KEY]: "dark" })
  }), {
    preference: "dark",
    resolvedTheme: "dark"
  });
});

test("standard media and storage listeners update theme and clean up", () => {
  const mediaQueryList = createStandardMediaQuery(false);
  const windowValue = new EventTarget();
  const storage = createStorage();
  const documentValue = createDocument();
  const observed = [];
  const unsubscribe = subscribeToThemeChanges((state) => {
    observed.push(state);
  }, {
    document: documentValue,
    mediaQueryList,
    storage,
    window: windowValue
  });

  mediaQueryList.matches = true;
  mediaQueryList.dispatchEvent(new Event("change"));
  storage.setItem(THEME_STORAGE_KEY, "light");
  windowValue.dispatchEvent(createStorageEvent(THEME_STORAGE_KEY));
  windowValue.dispatchEvent(createStorageEvent("unrelated"));

  assert.deepEqual(observed, [
    { preference: "system", resolvedTheme: "dark" },
    { preference: "light", resolvedTheme: "light" }
  ]);

  unsubscribe();
  mediaQueryList.matches = false;
  mediaQueryList.dispatchEvent(new Event("change"));
  windowValue.dispatchEvent(createStorageEvent(null));
  assert.equal(observed.length, 2);
});

test("legacy media listeners are supported and cleaned up", () => {
  const mediaQueryList = createLegacyMediaQuery(false);
  const observed = [];
  const unsubscribe = subscribeToThemeChanges((state) => {
    observed.push(state);
  }, {
    document: createDocument(),
    mediaQueryList,
    storage: createStorage(),
    window: new EventTarget()
  });

  mediaQueryList.matches = true;
  mediaQueryList.emit();
  assert.deepEqual(observed, [
    { preference: "system", resolvedTheme: "dark" }
  ]);

  unsubscribe();
  mediaQueryList.emit();
  assert.equal(observed.length, 1);
});

test("product and Sites bootstraps stay identical and run before module entry", async () => {
  const [productHtml, sitesHtml] = await Promise.all([
    readFile(join(PROJECT_ROOT, "index.html"), "utf8"),
    readFile(join(PROJECT_ROOT, "sites.html"), "utf8")
  ]);
  const productBootstrap = extractThemeBootstrap(productHtml);
  const sitesBootstrap = extractThemeBootstrap(sitesHtml);

  assert.equal(productBootstrap, sitesBootstrap);
  assert.ok(productHtml.indexOf("data-theme-bootstrap") < productHtml.indexOf("type=\"module\""));
  assert.ok(sitesHtml.indexOf("data-theme-bootstrap") < sitesHtml.indexOf("type=\"module\""));
  assert.match(productBootstrap, new RegExp(THEME_STORAGE_KEY.replace(":", "\\:")));
  assert.match(productBootstrap, new RegExp(THEME_PREFERENCE_ATTRIBUTE));
  assert.match(productBootstrap, new RegExp(THEME_ATTRIBUTE));
  assert.match(productBootstrap, new RegExp(THEME_MEDIA_QUERY.replace(/[()]/g, "\\$&")));
});

test("bootstrap handles explicit, system, corrupt, and blocked storage states", async () => {
  const html = await readFile(join(PROJECT_ROOT, "index.html"), "utf8");
  const bootstrap = extractThemeBootstrap(html);

  assert.deepEqual(runThemeBootstrap(bootstrap, {
    storedPreference: "dark",
    systemDark: false
  }), {
    colorScheme: "dark",
    preference: "dark",
    resolvedTheme: "dark"
  });
  assert.deepEqual(runThemeBootstrap(bootstrap, {
    storedPreference: null,
    systemDark: true
  }), {
    colorScheme: "dark",
    preference: "system",
    resolvedTheme: "dark"
  });
  assert.deepEqual(runThemeBootstrap(bootstrap, {
    storedPreference: "sepia",
    systemDark: false
  }), {
    colorScheme: "light",
    preference: "system",
    resolvedTheme: "light"
  });
  assert.deepEqual(runThemeBootstrap(bootstrap, {
    matchMediaThrows: true,
    storageThrows: true
  }), {
    colorScheme: "light",
    preference: "system",
    resolvedTheme: "light"
  });
});

function createStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}

function createDocument(initialAttributes = {}) {
  const attributes = new Map(Object.entries(initialAttributes));

  return {
    documentElement: {
      getAttribute(name) {
        return attributes.has(name) ? attributes.get(name) : null;
      },
      setAttribute(name, value) {
        attributes.set(name, String(value));
      },
      style: {}
    }
  };
}

function createStandardMediaQuery(matches) {
  const mediaQueryList = new EventTarget();
  mediaQueryList.matches = matches;
  return mediaQueryList;
}

function createLegacyMediaQuery(matches) {
  const listeners = new Set();

  return {
    matches,
    addListener(listener) {
      listeners.add(listener);
    },
    emit() {
      for (const listener of listeners) listener({ matches: this.matches });
    },
    removeListener(listener) {
      listeners.delete(listener);
    }
  };
}

function createStorageEvent(key) {
  const event = new Event("storage");
  Object.defineProperty(event, "key", { value: key });
  return event;
}

function extractThemeBootstrap(html) {
  const match = html.match(
    /<script data-theme-bootstrap>([\s\S]*?)<\/script>/
  );
  assert.ok(match, "theme bootstrap must exist");
  return match[1].trim();
}

function runThemeBootstrap(source, options = {}) {
  const documentValue = createDocument();
  const context = {
    document: documentValue,
    localStorage: {
      getItem() {
        if (options.storageThrows) throw new Error("blocked");
        return options.storedPreference ?? null;
      }
    },
    matchMedia() {
      if (options.matchMediaThrows) throw new Error("unsupported");
      return { matches: options.systemDark === true };
    }
  };

  runInNewContext(source, context);

  return {
    colorScheme: documentValue.documentElement.style.colorScheme,
    preference: documentValue.documentElement.getAttribute(
      THEME_PREFERENCE_ATTRIBUTE
    ),
    resolvedTheme: documentValue.documentElement.getAttribute(THEME_ATTRIBUTE)
  };
}
