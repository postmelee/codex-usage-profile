import { readdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const outputDirectory = resolve(process.argv[2] ?? "dist-marketing");
const forbiddenPatterns = [
  [/@napi-rs\/canvas/i, "native canvas dependency"],
  [/GITHUB_CLIENT_SECRET/i, "GitHub client secret name"],
  [/PROFILE_STORE_FILE/i, "profile store file setting"],
  [/SESSION_SECURE_COOKIES/i, "session cookie setting"],
  [/node:(?:fs|http|https|net|path)/i, "Node server module"],
  [/profile-(?:api|backend|runtime)/i, "product API or runtime module"],
  [/\/api\/(?:auth|account|cli|profile)/i, "product API route"]
];

const files = await listFiles(outputDirectory);
const inspectableFiles = files.filter((filePath) => /\.(?:css|html|js|json)$/.test(filePath));

if (!inspectableFiles.some((filePath) => filePath.endsWith(".js"))) {
  throw new Error("Marketing artifact does not contain a JavaScript entry");
}

for (const filePath of inspectableFiles) {
  const contents = await readFile(filePath, "utf8");

  for (const [pattern, label] of forbiddenPatterns) {
    if (pattern.test(contents)) {
      throw new Error(`${label} found in ${filePath}`);
    }
  }
}

console.log(`Verified ${inspectableFiles.length} browser-only marketing files.`);

async function listFiles(directory) {
  const directoryStat = await stat(directory).catch(() => null);
  if (!directoryStat?.isDirectory()) {
    throw new Error(`Marketing artifact directory not found: ${directory}`);
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const entryPath = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  }));

  return nestedFiles.flat();
}
