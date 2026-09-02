import { PROFILE_GIF_PRESET } from "./gif-animation.js";

export function inspectGifBinary(input) {
  const bytes = normalizeBytes(input);
  const reader = createReader(bytes);
  const signature = reader.readAscii(6);
  if (signature !== "GIF87a" && signature !== "GIF89a") {
    throw new TypeError("Invalid GIF signature");
  }

  const width = reader.readUint16();
  const height = reader.readUint16();
  const packed = reader.readByte();
  reader.skip(2);
  const hasGlobalColorTable = Boolean(packed & 0x80);
  const globalColorTableSize = hasGlobalColorTable
    ? 1 << ((packed & 0x07) + 1)
    : 0;
  reader.skip(globalColorTableSize * 3);

  const frames = [];
  let loopCount = null;
  let trailerFound = false;
  let pendingControl = null;
  let localColorTableCount = 0;

  while (!reader.done()) {
    const marker = reader.readByte();
    if (marker === 0x3b) {
      trailerFound = true;
      break;
    }
    if (marker === 0x21) {
      const extension = reader.readByte();
      if (extension === 0xf9) {
        pendingControl = readGraphicControl(reader);
      } else if (extension === 0xff) {
        const applicationLength = reader.readByte();
        const application = reader.readAscii(applicationLength);
        const blocks = reader.readSubBlocks();
        if (
          application === "NETSCAPE2.0" &&
          blocks.length >= 3 &&
          blocks[0] === 1
        ) {
          loopCount = blocks[1] | (blocks[2] << 8);
        }
      } else if (extension === 0x01) {
        reader.skip(reader.readByte());
        reader.readSubBlocks();
      } else {
        reader.readSubBlocks();
      }
      continue;
    }
    if (marker !== 0x2c) {
      throw new TypeError(`Unexpected GIF block marker 0x${marker.toString(16)}`);
    }

    const left = reader.readUint16();
    const top = reader.readUint16();
    const frameWidth = reader.readUint16();
    const frameHeight = reader.readUint16();
    const imagePacked = reader.readByte();
    const hasLocalColorTable = Boolean(imagePacked & 0x80);
    const localColorTableSize = hasLocalColorTable
      ? 1 << ((imagePacked & 0x07) + 1)
      : 0;
    if (hasLocalColorTable) {
      localColorTableCount += 1;
      reader.skip(localColorTableSize * 3);
    }
    reader.readByte();
    reader.readSubBlocks();
    frames.push(Object.freeze({
      delayCentiseconds: pendingControl?.delayCentiseconds ?? 0,
      disposal: pendingControl?.disposal ?? 0,
      hasLocalColorTable,
      height: frameHeight,
      left,
      top,
      transparent: pendingControl?.transparent ?? false,
      transparentIndex: pendingControl?.transparentIndex ?? null,
      width: frameWidth
    }));
    pendingControl = null;
  }

  return Object.freeze({
    byteLength: bytes.length,
    frameCount: frames.length,
    frames: Object.freeze(frames),
    globalColorTableSize,
    hasGlobalColorTable,
    height,
    localColorTableCount,
    loopCount,
    signature,
    trailerFound,
    width
  });
}

export function assertProfileGifContract(input) {
  const metadata = inspectGifBinary(input);
  const failures = [];
  const expectedDelay = PROFILE_GIF_PRESET.frameDelayMs / 10;

  check(metadata.signature === "GIF89a", "signature must be GIF89a", failures);
  check(metadata.width === PROFILE_GIF_PRESET.width, "width must be 998", failures);
  check(metadata.height === PROFILE_GIF_PRESET.height, "height must be 612", failures);
  check(
    metadata.frameCount === PROFILE_GIF_PRESET.frameCount,
    "frame count must be 96",
    failures
  );
  check(metadata.loopCount === PROFILE_GIF_PRESET.loopCount, "loop must be infinite", failures);
  check(metadata.hasGlobalColorTable, "global color table is required", failures);
  check(
    metadata.globalColorTableSize <= PROFILE_GIF_PRESET.maxColors,
    "global color table must contain at most 256 colors",
    failures
  );
  check(metadata.localColorTableCount === 0, "local color tables are not allowed", failures);
  check(metadata.trailerFound, "GIF trailer is required", failures);
  check(
    metadata.byteLength < PROFILE_GIF_PRESET.maxBytes,
    "GIF must stay below 15,000,000 bytes",
    failures
  );
  check(metadata.byteLength > 0, "GIF must not be empty", failures);

  for (const [index, frame] of metadata.frames.entries()) {
    check(frame.left === 0 && frame.top === 0, `frame ${index} must start at 0,0`, failures);
    check(
      frame.width === PROFILE_GIF_PRESET.width &&
        frame.height === PROFILE_GIF_PRESET.height,
      `frame ${index} must cover the full canvas`,
      failures
    );
    check(frame.delayCentiseconds === expectedDelay, `frame ${index} delay must be 50ms`, failures);
    check(frame.disposal === 1, `frame ${index} disposal must be 1`, failures);
    check(!frame.transparent, `frame ${index} must disable transparency`, failures);
    check(
      frame.transparentIndex === null,
      `frame ${index} must not expose a transparent index`,
      failures
    );
  }

  if (failures.length > 0) {
    throw new TypeError(`GIF contract violation: ${failures.join("; ")}`);
  }
  return metadata;
}

export function createProfileGifTransferMetadata(metadata) {
  if (!metadata || !Array.isArray(metadata.frames) || metadata.frames.length === 0) {
    throw new TypeError("GIF metadata must contain inspected frames");
  }
  return Object.freeze({
    byteLength: metadata.byteLength,
    frameCount: metadata.frameCount,
    frameDelayCentiseconds: metadata.frames[0].delayCentiseconds,
    globalColorTableSize: metadata.globalColorTableSize,
    height: metadata.height,
    loopCount: metadata.loopCount,
    width: metadata.width
  });
}

function readGraphicControl(reader) {
  const blockSize = reader.readByte();
  if (blockSize !== 4) {
    throw new TypeError("Invalid GIF graphic control extension");
  }
  const packed = reader.readByte();
  const delayCentiseconds = reader.readUint16();
  const rawTransparentIndex = reader.readByte();
  if (reader.readByte() !== 0) {
    throw new TypeError("Invalid GIF graphic control terminator");
  }
  const transparent = Boolean(packed & 0x01);
  return Object.freeze({
    delayCentiseconds,
    disposal: (packed >> 2) & 0x07,
    transparent,
    transparentIndex: transparent ? rawTransparentIndex : null
  });
}

function createReader(bytes) {
  let offset = 0;

  function ensure(length) {
    if (offset + length > bytes.length) {
      throw new RangeError("Unexpected end of GIF data");
    }
  }

  return Object.freeze({
    done() {
      return offset >= bytes.length;
    },
    readAscii(length) {
      ensure(length);
      let value = "";
      for (let index = 0; index < length; index += 1) {
        value += String.fromCharCode(bytes[offset + index]);
      }
      offset += length;
      return value;
    },
    readByte() {
      ensure(1);
      return bytes[offset++];
    },
    readSubBlocks() {
      const values = [];
      while (true) {
        ensure(1);
        const length = bytes[offset++];
        if (length === 0) {
          return Uint8Array.from(values);
        }
        ensure(length);
        for (let index = 0; index < length; index += 1) {
          values.push(bytes[offset + index]);
        }
        offset += length;
      }
    },
    readUint16() {
      ensure(2);
      const value = bytes[offset] | (bytes[offset + 1] << 8);
      offset += 2;
      return value;
    },
    skip(length) {
      ensure(length);
      offset += length;
    }
  });
}

function normalizeBytes(input) {
  if (!(input instanceof Uint8Array)) {
    throw new TypeError("GIF input must be a Uint8Array");
  }
  return input;
}

function check(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}
