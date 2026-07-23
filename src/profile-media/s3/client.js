import { S3Client } from "@aws-sdk/client-s3";

export const DEFAULT_PROFILE_MEDIA_S3_REGION = "auto";
export const DEFAULT_PROFILE_MEDIA_S3_MAX_ATTEMPTS = 3;
export const DEFAULT_PROFILE_MEDIA_S3_OPERATION_TIMEOUT_MS = 8_000;

export function createProfileMediaS3Client(options = {}) {
  const endpoint = normalizeEndpoint(options.endpoint);
  const region = requireNonEmptyString(
    options.region ?? DEFAULT_PROFILE_MEDIA_S3_REGION,
    "S3 region"
  );
  const accessKeyId = requireNonEmptyString(options.accessKeyId, "S3 access key id");
  const secretAccessKey = requireNonEmptyString(
    options.secretAccessKey,
    "S3 secret access key"
  );
  const maxAttempts = requirePositiveInteger(
    options.maxAttempts ?? DEFAULT_PROFILE_MEDIA_S3_MAX_ATTEMPTS,
    "S3 max attempts"
  );

  return new S3Client({
    credentials: { accessKeyId, secretAccessKey },
    endpoint,
    forcePathStyle: options.forcePathStyle === true,
    maxAttempts,
    region
  });
}

export function resolveR2ProfileMediaStoreOptions(env = process.env) {
  return {
    accessKeyId: requireEnv(env, "R2_ACCESS_KEY_ID"),
    bucket: requireEnv(env, "R2_BUCKET"),
    endpoint: normalizeEndpoint(requireEnv(env, "R2_ENDPOINT")),
    forcePathStyle: false,
    operationTimeoutMs: DEFAULT_PROFILE_MEDIA_S3_OPERATION_TIMEOUT_MS,
    region: optionalEnv(env, "R2_REGION") ?? DEFAULT_PROFILE_MEDIA_S3_REGION,
    secretAccessKey: requireEnv(env, "R2_SECRET_ACCESS_KEY")
  };
}

export function resolveTestProfileMediaStoreOptions(env = process.env) {
  const requiredNames = [
    "TEST_S3_ENDPOINT",
    "TEST_S3_BUCKET",
    "TEST_S3_ACCESS_KEY_ID",
    "TEST_S3_SECRET_ACCESS_KEY"
  ];
  const missing = requiredNames.filter((name) => optionalEnv(env, name) === null);
  if (missing.length > 0) {
    return {
      enabled: false,
      reason: `missing test S3 settings: ${missing.join(", ")}`
    };
  }

  return {
    accessKeyId: requireEnv(env, "TEST_S3_ACCESS_KEY_ID"),
    bucket: requireEnv(env, "TEST_S3_BUCKET"),
    enabled: true,
    endpoint: normalizeEndpoint(requireEnv(env, "TEST_S3_ENDPOINT")),
    forcePathStyle: parseBooleanEnv(env.TEST_S3_FORCE_PATH_STYLE, false),
    operationTimeoutMs: DEFAULT_PROFILE_MEDIA_S3_OPERATION_TIMEOUT_MS,
    region: optionalEnv(env, "TEST_S3_REGION") ?? "us-east-1",
    secretAccessKey: requireEnv(env, "TEST_S3_SECRET_ACCESS_KEY")
  };
}

function normalizeEndpoint(value) {
  const rawValue = requireNonEmptyString(value, "S3 endpoint");
  let url;
  try {
    url = new URL(rawValue);
  } catch {
    throw new TypeError("S3 endpoint must be an absolute URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new TypeError("S3 endpoint must use http or https");
  }
  if (
    url.username ||
    url.password ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  ) {
    throw new TypeError("S3 endpoint must contain only an origin");
  }
  return url.origin;
}

function requireEnv(env, name) {
  const value = optionalEnv(env, name);
  if (value === null) throw new TypeError(`${name} is required`);
  return value;
}

function optionalEnv(env, name) {
  const value = env?.[name];
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim();
}

function parseBooleanEnv(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new TypeError("TEST_S3_FORCE_PATH_STYLE must be true or false");
}

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer`);
  }
  return value;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} is required`);
  }
  return value.trim();
}
