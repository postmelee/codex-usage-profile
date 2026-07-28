import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import {
  EXPECTED_ANALYZER_PACKAGE,
  EXPECTED_NPM_PACKAGE_FILES,
  assertPackageContentSafe,
  normalizeNpmPackResult,
  verifyLockfileContract,
  verifyNpmRelease,
  verifyPackageMetadata,
  verifyPackedEntries
} from "../verify-npm-release.mjs";

test("normalizes one npm 11 array or npm 12 object candidate", () => {
  const candidate = {
    id: "codex-usage-profile@0.1.0"
  };

  assert.equal(normalizeNpmPackResult([candidate]), candidate);
  assert.equal(normalizeNpmPackResult({
    [candidate.id]: candidate
  }), candidate);

  for (const invalid of [
    [],
    [candidate, candidate],
    {},
    {
      first: candidate,
      second: candidate
    },
    candidate,
    null,
    "codex-usage-profile@0.1.0"
  ]) {
    assert.throws(
      () => normalizeNpmPackResult(invalid),
      /exactly one package candidate/
    );
  }
});

test("npm release verifier accepts the exact local package candidate", async () => {
  const result = await verifyNpmRelease();

  assert.equal(result.packageId, "codex-usage-profile@0.1.0");
  assert.equal(result.entryCount, EXPECTED_NPM_PACKAGE_FILES.length);
  assert.match(result.shasum, /^[a-f0-9]{40}$/);
  assert.match(result.integrity, /^sha512-[A-Za-z0-9+/]+=*$/);
  assert.ok(result.packedBytes > 0);
  assert.ok(result.unpackedBytes > result.packedBytes);
  assert.deepEqual(Object.keys(result).sort(), [
    "entryCount",
    "integrity",
    "packageId",
    "packedBytes",
    "shasum",
    "unpackedBytes"
  ]);
});

test("release metadata and lock reject analyzer dependency drift", async () => {
  const manifest = JSON.parse(await readFile(
    new URL("../../packages/codex-usage-profile-cli/package.json", import.meta.url),
    "utf8"
  ));
  const lockfile = JSON.parse(await readFile(
    new URL("../../package-lock.json", import.meta.url),
    "utf8"
  ));

  const manifestWithRange = structuredClone(manifest);
  manifestWithRange.dependencies[EXPECTED_ANALYZER_PACKAGE.name] = "^0.2.0";
  assert.throws(
    () => verifyPackageMetadata(manifestWithRange),
    /package dependencies/
  );

  const manifestWithoutProvenance = structuredClone(manifest);
  delete manifestWithoutProvenance.publishConfig.provenance;
  assert.throws(
    () => verifyPackageMetadata(manifestWithoutProvenance),
    /package publish provenance/
  );

  const lockWithDifferentIntegrity = structuredClone(lockfile);
  lockWithDifferentIntegrity.packages[
    `node_modules/${EXPECTED_ANALYZER_PACKAGE.name}`
  ].integrity = "sha512-not-the-reviewed-package";
  assert.throws(
    () => verifyLockfileContract(lockWithDifferentIntegrity),
    /locked analyzer integrity/
  );
});

test("packed file checks reject additions and unsafe executable modes", () => {
  const entries = EXPECTED_NPM_PACKAGE_FILES.map((path) => ({
    content: Buffer.from(path),
    mode: path === "bin/codex-usage-profile.js" ? 0o755 : 0o644,
    path,
    size: Buffer.byteLength(path),
    type: "0"
  }));
  const npmFiles = entries.map(({ mode, path, size }) => ({ mode, path, size }));

  verifyPackedEntries(entries, npmFiles);

  assert.throws(
    () => verifyPackedEntries([
      ...entries,
      {
        content: Buffer.from("private"),
        mode: 0o644,
        path: ".env",
        size: 7,
        type: "0"
      }
    ], npmFiles),
    /packed file allowlist/
  );

  const unsafeBin = entries.map((entry) => (
    entry.path === "bin/codex-usage-profile.js"
      ? { ...entry, mode: 0o644 }
      : entry
  ));
  assert.throws(
    () => verifyPackedEntries(unsafeBin, npmFiles),
    /unsafe mode/
  );
});

test("content scan reports category and path without echoing secret text", () => {
  const sensitiveValue = [
    "github",
    "_pat_",
    "0123456789abcdefghijklmnopqrstuvwxyz_ABCDEF"
  ].join("");
  const entries = [{
    content: Buffer.from(`const credential = "${sensitiveValue}";`),
    mode: 0o644,
    path: "src/index.js",
    size: sensitiveValue.length,
    type: "0"
  }];

  assert.throws(
    () => assertPackageContentSafe(entries),
    (error) => {
      assert.match(error.message, /GitHub credential/);
      assert.match(error.message, /src\/index\.js/);
      assert.equal(error.message.includes(sensitiveValue), false);
      return true;
    }
  );
});
