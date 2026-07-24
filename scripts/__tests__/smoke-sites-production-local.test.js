import assert from "node:assert/strict";
import test from "node:test";

import {
  runSitesProductionLocalSmoke
} from "../smoke-sites-production-local.mjs";

test("production local smoke verifies artifact before one-runtime contract smoke", async () => {
  const calls = [];
  const result = await runSitesProductionLocalSmoke({
    async buildProductionArtifact() {
      calls.push("build");
    },
    async verifyProductionArtifact(options) {
      calls.push("verify");
      assert.match(options.outputDirectory, /dist$/);
      return {
        artifactBytes: 1024,
        clientFileCount: 3,
        expectedBindingCount: 3,
        migrationFileCount: 2,
        workerCompressedBytes: 512,
        workerFileCount: 1,
        workerRawBytes: 2048
      };
    },
    async runRuntimeSmoke(options) {
      calls.push("runtime");
      assert.equal(options.skipBuild, false);
      return {
        publicPngBytes: 4096,
        routesVerified: 35
      };
    }
  });

  assert.deepEqual(calls, ["build", "verify", "runtime"]);
  assert.deepEqual(result, {
    artifactBytes: 1024,
    clientFileCount: 3,
    expectedBindingCount: 3,
    migrationFileCount: 2,
    publicPngBytes: 4096,
    routesVerified: 35,
    workerCompressedBytes: 512,
    workerFileCount: 1,
    workerRawBytes: 2048
  });
});

test("production local smoke can reuse separately verified build inputs", async () => {
  let built = false;
  const result = await runSitesProductionLocalSmoke({
    skipProductionBuild: true,
    skipRuntimeBuild: true,
    async buildProductionArtifact() {
      built = true;
    },
    async verifyProductionArtifact() {
      return {
        artifactBytes: 10,
        clientFileCount: 3,
        expectedBindingCount: 3,
        migrationFileCount: 2,
        workerCompressedBytes: 5,
        workerFileCount: 1,
        workerRawBytes: 15
      };
    },
    async runRuntimeSmoke(options) {
      assert.equal(options.skipBuild, true);
      return {
        publicPngBytes: 20,
        routesVerified: 35
      };
    }
  });

  assert.equal(built, false);
  assert.equal(result.routesVerified, 35);
});
