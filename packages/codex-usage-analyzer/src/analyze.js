import { sampleUsageSnapshotV2 } from "./fixtures/sample-v2-snapshot.js";
import { assertUsageSnapshotV2 } from "./snapshot/v2-schema.js";

export const ANALYZER_NAME = "codex-usage-analyzer";
export const ANALYZER_VERSION = "0.1.0";

export async function analyzeUsage(options = {}) {
  return assertUsageSnapshotV2(createSampleUsageSnapshotV2({
    capturedAt: normalizeCapturedAt(options.capturedAt),
    producer: {
      name: ANALYZER_NAME,
      version: ANALYZER_VERSION
    }
  }));
}

export function createSampleUsageSnapshotV2(overrides = {}) {
  return mergeSnapshot(structuredClone(sampleUsageSnapshotV2), overrides);
}

function normalizeCapturedAt(value) {
  if (value === undefined || value === null) {
    return sampleUsageSnapshotV2.capturedAt;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError("capturedAt must be a valid date");
  }

  return date.toISOString();
}

function mergeSnapshot(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(value) && isPlainObject(target[key])) {
      target[key] = mergeSnapshot(target[key], value);
    } else {
      target[key] = value;
    }
  }

  return target;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
