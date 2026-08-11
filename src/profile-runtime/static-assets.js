import { readFile, stat } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";

const CONTENT_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
});

const HASHED_ASSET_RE = /(?:^|\/)[^/]+-[A-Za-z0-9_-]{8,}\.[^/]+$/;
const STATIC_SECURITY_HEADERS = Object.freeze({
  "cross-origin-opener-policy": "same-origin",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff"
});

export function createStaticAssetHandler(options = {}) {
  const rootDirectory = resolve(options.rootDirectory ?? "dist");
  const indexPath = resolveInsideRoot(rootDirectory, options.indexFile ?? "index.html");

  return async function handleStaticAsset(request) {
    if (!["GET", "HEAD"].includes(request.method.toUpperCase())) {
      return textResponse("Method not allowed", 405, {
        allow: "GET, HEAD"
      });
    }

    const url = new URL(request.url);
    const requestedPath = decodeRequestPath(url.pathname);
    const assetPath = resolveInsideRoot(rootDirectory, requestedPath.slice(1));
    const directAsset = await readRegularFile(assetPath);

    if (directAsset) {
      return createAssetResponse(directAsset, assetPath, request.method);
    }

    if (looksLikeStaticAsset(requestedPath)) {
      return textResponse("Not found", 404);
    }

    const indexAsset = await readRegularFile(indexPath);
    if (!indexAsset) {
      return textResponse("Frontend build is unavailable", 503);
    }

    return createAssetResponse(indexAsset, indexPath, request.method, {
      cacheControl: "no-cache"
    });
  };
}

export async function assertStaticAssetRoot(options = {}) {
  const rootDirectory = resolve(options.rootDirectory ?? "dist");
  const indexPath = resolveInsideRoot(rootDirectory, options.indexFile ?? "index.html");
  const indexAsset = await readRegularFile(indexPath);

  if (!indexAsset) {
    throw new Error("Frontend build is missing index.html");
  }

  return rootDirectory;
}

function createAssetResponse(body, filePath, method, options = {}) {
  const extension = extname(filePath).toLowerCase();
  const headers = {
    ...STATIC_SECURITY_HEADERS,
    "cache-control": options.cacheControl ?? (
      HASHED_ASSET_RE.test(filePath)
        ? "public, max-age=31536000, immutable"
        : "no-cache"
    ),
    "content-length": String(body.byteLength),
    "content-type": CONTENT_TYPES[extension] ?? "application/octet-stream"
  };

  return new Response(method.toUpperCase() === "HEAD" ? null : body, {
    status: 200,
    headers
  });
}

function textResponse(body, status, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      ...STATIC_SECURITY_HEADERS,
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
      ...headers
    }
  });
}

async function readRegularFile(filePath) {
  try {
    const metadata = await stat(filePath);
    if (!metadata.isFile()) return null;
    return await readFile(filePath);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      return null;
    }
    throw error;
  }
}

function decodeRequestPath(pathname) {
  try {
    const decoded = decodeURIComponent(pathname);
    if (decoded.includes("\0") || decoded.includes("\\")) {
      throw new TypeError("Invalid asset path");
    }
    return decoded;
  } catch {
    throw new TypeError("Invalid asset path");
  }
}

function resolveInsideRoot(rootDirectory, pathname) {
  const resolvedPath = resolve(rootDirectory, pathname || ".");
  const relativePath = relative(rootDirectory, resolvedPath);

  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    relativePath.includes(`${sep}..${sep}`)
  ) {
    throw new TypeError("Asset path escapes the frontend root");
  }

  return resolvedPath;
}

function looksLikeStaticAsset(pathname) {
  const finalSegment = pathname.split("/").at(-1) ?? "";
  return finalSegment.includes(".");
}
