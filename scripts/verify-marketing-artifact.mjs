import { readFile, readdir, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

const outputDirectory = resolve(process.argv[2] ?? "dist-sites");
const requiredFiles = [
  ".openai/hosting.json",
  "client/apple-touch-icon.png",
  "client/favicon-32x32.png",
  "client/favicon.ico",
  "client/index.html",
  "client/site-icon-512.png",
  "server/index.js"
];
const forbiddenPatterns = [
  [/@napi-rs\/canvas/i, "native canvas dependency"],
  [/GITHUB_CLIENT_SECRET/i, "GitHub client secret name"],
  [/PROFILE_SESSION_SECRET/i, "profile session secret name"],
  [/PROFILE_STORE_FILE/i, "profile store file setting"],
  [/SESSION_SECURE_COOKIES/i, "session cookie setting"],
  [/(?:DATABASE_URL|NEON_DATABASE_URL)/i, "database credential name"],
  [/(?:R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY)/i, "R2 credential name"],
  [/CLOUDFLARE_API_TOKEN/i, "Cloudflare credential name"],
  [/node:(?:fs|http|https|net|path)/i, "Node server module"],
  [/profile-(?:api|backend|runtime)/i, "product API or runtime module"],
  [/\/api\//i, "product API route"],
  [/(?:oauth|githubClientSecret|ownerId|tokenDigest)/i, "account credential field"],
  [/(?:deviceCode|deviceSecret|deviceChallenge)/i, "device credential field"],
  [/(?:avatarUrl|githubLogin|dailyUsageBuckets|peakDailyTokens)/i, "runtime account or usage field"],
  [/(?:owner_1|postmelee-avatar|meleeisdeveloping)/i, "private account fixture"]
];
const secretEnvironmentKeys = [
  "CLOUDFLARE_API_TOKEN",
  "DATABASE_URL",
  "GITHUB_CLIENT_SECRET",
  "NEON_DATABASE_URL",
  "PROFILE_SESSION_SECRET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY"
];

const files = await listFiles(outputDirectory);
const relativeFiles = new Set(
  files.map((filePath) => relative(outputDirectory, filePath))
);
const inspectableFiles = files.filter((filePath) =>
  /\.(?:css|html|js|json)$/.test(filePath)
);

for (const requiredFile of requiredFiles) {
  if (!relativeFiles.has(requiredFile)) {
    throw new Error(`Sites artifact is missing ${requiredFile}`);
  }
}

for (const filePath of relativeFiles) {
  if (/(?:postmelee|meleeisdeveloping|owner_1)/i.test(filePath)) {
    throw new Error(`Private account fixture path found in Sites artifact: ${filePath}`);
  }
}

if (!relativeFiles.has("server/index.js")) {
  throw new Error("Sites artifact does not contain a Worker entry");
}

const hostingManifest = JSON.parse(await readFile(
  resolve(outputDirectory, ".openai/hosting.json"),
  "utf8"
));
assertHostingManifest(hostingManifest);

for (const filePath of inspectableFiles) {
  const contents = await readFile(filePath, "utf8");

  for (const [pattern, label] of forbiddenPatterns) {
    if (pattern.test(contents)) {
      throw new Error(`${label} found in ${filePath}`);
    }
  }

  for (const key of secretEnvironmentKeys) {
    const value = process.env[key];
    if (value && value.length >= 8 && contents.includes(value)) {
      throw new Error(`Value from ${key} found in ${filePath}`);
    }
  }
}

console.log(
  `Verified ${inspectableFiles.length} sample-only Sites marketing files.`
);

function assertHostingManifest(manifest) {
  const allowedKeys = new Set(["d1", "project_id", "r2"]);
  const unsupportedKeys = Object.keys(manifest).filter(
    (key) => !allowedKeys.has(key)
  );

  if (unsupportedKeys.length > 0) {
    throw new Error(
      `Sites hosting manifest contains unsupported keys: ${unsupportedKeys.join(", ")}`
    );
  }
  if (manifest.d1 !== null || manifest.r2 !== null) {
    throw new Error("Sites marketing mirror must keep D1 and R2 bindings null");
  }
  if (
    manifest.project_id !== undefined &&
    (typeof manifest.project_id !== "string" || manifest.project_id.trim() === "")
  ) {
    throw new Error("Sites project_id must be a non-empty string when present");
  }
}

async function listFiles(directory) {
  const directoryStat = await stat(directory).catch(() => null);
  if (!directoryStat?.isDirectory()) {
    throw new Error(`Sites artifact directory not found: ${directory}`);
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const entryPath = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  }));

  return nestedFiles.flat();
}
