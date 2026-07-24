export function createFakeR2Bucket() {
  const objects = new Map();
  const failures = [];
  const hooks = {
    get: [],
    head: [],
    put: []
  };
  let sequence = 0;
  let deleteCalls = 0;

  return {
    objects,

    failNext(method, error = new Error(`injected R2 ${method} failure`)) {
      failures.push({ error, method });
    },

    beforeNext(method, hook) {
      hooks[method].push(hook);
    },

    get deleteCalls() {
      return deleteCalls;
    },

    async delete(key) {
      deleteCalls += 1;
      objects.delete(key);
    },

    async get(key, options = {}) {
      await beforeOperation("get", { key, options });
      throwFailure("get");
      const object = objects.get(key);
      if (!object) return null;
      if (!matchesOnlyIf(object, options.onlyIf)) {
        return cloneObject(object, false);
      }
      return cloneObject(object, true);
    },

    async head(key) {
      await beforeOperation("head", { key });
      throwFailure("head");
      const object = objects.get(key);
      return object ? cloneObject(object, false) : null;
    },

    async put(key, value, options = {}) {
      await beforeOperation("put", { key, options, value });
      throwFailure("put");
      const current = objects.get(key);
      if (!matchesOnlyIf(current, options.onlyIf)) return null;
      const body = await normalizeBody(value);
      sequence += 1;
      const etag = `r2-${sequence}`;
      const object = {
        body,
        customMetadata: { ...(options.customMetadata ?? {}) },
        etag,
        httpEtag: `"${etag}"`,
        httpMetadata: { ...(options.httpMetadata ?? {}) },
        key,
        size: body.byteLength,
        uploaded: new Date("2026-07-24T00:00:00.000Z"),
        version: `version-${sequence}`
      };
      objects.set(key, object);
      return cloneObject(object, false);
    }
  };

  async function beforeOperation(method, context) {
    const hook = hooks[method].shift();
    if (hook) await hook(context);
  }

  function throwFailure(method) {
    const index = failures.findIndex((failure) => failure.method === method);
    if (index === -1) return;
    const [failure] = failures.splice(index, 1);
    throw failure.error;
  }
}

function cloneObject(object, includeBody) {
  const cloned = {
    customMetadata: { ...object.customMetadata },
    etag: object.etag,
    httpEtag: object.httpEtag,
    httpMetadata: { ...object.httpMetadata },
    key: object.key,
    size: object.size,
    uploaded: new Date(object.uploaded),
    version: object.version
  };
  if (includeBody) {
    const bytes = Buffer.from(object.body);
    cloned.arrayBuffer = async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    cloned.body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(bytes));
        controller.close();
      }
    });
  }
  return cloned;
}

function matchesOnlyIf(object, condition) {
  if (!condition) return true;
  if (condition.etagDoesNotMatch === "*") return object === undefined;
  if (condition.etagMatches !== undefined) {
    if (!object) return false;
    return [object.etag, object.httpEtag].includes(condition.etagMatches);
  }
  if (condition.etagDoesNotMatch !== undefined) {
    if (!object) return true;
    return ![object.etag, object.httpEtag].includes(condition.etagDoesNotMatch);
  }
  return true;
}

async function normalizeBody(value) {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value);
  if (value && typeof value.arrayBuffer === "function") {
    return Buffer.from(await value.arrayBuffer());
  }
  throw new TypeError("unsupported fake R2 body");
}
