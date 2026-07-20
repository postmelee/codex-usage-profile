export function createWebRequestFromNodeRequest(nodeRequest, options = {}) {
  const method = normalizeMethod(nodeRequest.method);
  const init = {
    headers: createWebHeadersFromNodeHeaders(nodeRequest.headers),
    method
  };

  if (!["GET", "HEAD"].includes(method)) {
    init.body = nodeRequest;
    init.duplex = "half";
  }

  return new Request(
    options.url ?? createNodeRequestUrl(nodeRequest, options),
    init
  );
}

export function createNodeRequestUrl(nodeRequest, options = {}) {
  const rawUrl = typeof nodeRequest.url === "string" && nodeRequest.url.trim() !== ""
    ? nodeRequest.url
    : "/";
  const origin = options.origin ?? options.publicBaseUrl ?? createRequestOrigin(
    nodeRequest,
    options
  );

  return new URL(rawUrl, origin).toString();
}

export async function writeWebResponseToNodeResponse(webResponse, nodeResponse) {
  nodeResponse.statusCode = webResponse.status;

  if (webResponse.statusText) {
    nodeResponse.statusMessage = webResponse.statusText;
  }

  writeWebResponseHeaders(webResponse, nodeResponse);

  if (!webResponse.body) {
    nodeResponse.end();
    return;
  }

  const body = Buffer.from(await webResponse.arrayBuffer());
  nodeResponse.end(body);
}

export function writeNodeErrorResponse(nodeResponse, error, options = {}) {
  if (isNodeResponseEnded(nodeResponse)) {
    return;
  }

  nodeResponse.statusCode = options.statusCode ?? 500;
  nodeResponse.setHeader("content-type", "application/json; charset=utf-8");
  nodeResponse.end(JSON.stringify({
    ok: false,
    error: {
      code: options.code ?? "runtime_request_failed",
      message: options.exposeMessage === true && error instanceof Error
        ? error.message
        : "Runtime request failed"
    }
  }));
}

export function isNodeResponseEnded(nodeResponse) {
  return nodeResponse.writableEnded === true || nodeResponse.finished === true;
}

export function listen(server, options) {
  return new Promise((resolveListen, rejectListen) => {
    const onError = (error) => {
      server.off("listening", onListening);
      rejectListen(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolveListen();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(options.port, options.host);
  });
}

export function closeServer(server) {
  return new Promise((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) {
        rejectClose(error);
        return;
      }

      resolveClose();
    });
  });
}

export function createServerUrl(server, host, options = {}) {
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : options.defaultPort;
  const normalizedHost = host === "0.0.0.0" || host === "::"
    ? options.loopbackHost ?? "127.0.0.1"
    : host;

  return `http://${normalizedHost}:${port}`;
}

function createWebHeadersFromNodeHeaders(nodeHeaders = {}) {
  const headers = new Headers();

  for (const [name, value] of Object.entries(nodeHeaders)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
      continue;
    }

    if (value !== undefined) {
      headers.set(name, String(value));
    }
  }

  return headers;
}

function writeWebResponseHeaders(webResponse, nodeResponse) {
  const setCookieValues = typeof webResponse.headers.getSetCookie === "function"
    ? webResponse.headers.getSetCookie()
    : [];

  webResponse.headers.forEach((value, name) => {
    if (name.toLowerCase() === "set-cookie" && setCookieValues.length > 0) {
      return;
    }

    nodeResponse.setHeader(name, value);
  });

  if (setCookieValues.length > 0) {
    nodeResponse.setHeader("set-cookie", setCookieValues);
  }
}

function createRequestOrigin(nodeRequest, options = {}) {
  const protocol = options.protocol ?? "http";
  const host = normalizeHeaderValue(nodeRequest.headers?.host) ??
    options.defaultHost ?? "127.0.0.1:5173";

  return `${protocol}://${host}`;
}

function normalizeHeaderValue(value) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }

  return null;
}

function normalizeMethod(method) {
  if (typeof method !== "string" || method.trim() === "") {
    return "GET";
  }

  return method.toUpperCase();
}
