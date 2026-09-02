import assert from "node:assert/strict";
import test from "node:test";

import gifencDefault, * as gifencNamespace from "gifenc";

import {
  assertProfileGifContract,
  inspectGifBinary
} from "../gif-binary.js";

const GIFEncoder = gifencNamespace.GIFEncoder ??
  gifencDefault.GIFEncoder ?? gifencDefault;

test("inspects dimensions, loop metadata, controls, and palette use", () => {
  const encoder = GIFEncoder();
  const palette = [
    [24, 24, 24, 255],
    [255, 255, 255, 255]
  ];
  const pixels = Uint8Array.from([0, 1, 1, 0]);
  encoder.writeFrame(pixels, 2, 2, {
    delay: 50,
    dispose: 1,
    palette,
    repeat: 0,
    transparent: false
  });
  encoder.writeFrame(pixels, 2, 2, {
    delay: 50,
    dispose: 1,
    transparent: false
  });
  encoder.finish();

  const metadata = inspectGifBinary(encoder.bytes());
  assert.equal(metadata.signature, "GIF89a");
  assert.equal(metadata.width, 2);
  assert.equal(metadata.height, 2);
  assert.equal(metadata.frameCount, 2);
  assert.equal(metadata.loopCount, 0);
  assert.equal(metadata.globalColorTableSize, 2);
  assert.equal(metadata.localColorTableCount, 0);
  assert.equal(metadata.trailerFound, true);
  assert.deepEqual(
    metadata.frames.map((frame) => frame.delayCentiseconds),
    [5, 5]
  );
  assert.deepEqual(metadata.frames.map((frame) => frame.disposal), [1, 1]);
  assert.deepEqual(metadata.frames.map((frame) => frame.transparent), [false, false]);
  assert.deepEqual(metadata.frames.map((frame) => frame.transparentIndex), [null, null]);
});

test("rejects malformed data and reports contract failures", () => {
  assert.throws(() => inspectGifBinary(Uint8Array.from([1, 2, 3])), RangeError);
  assert.throws(
    () => inspectGifBinary(new TextEncoder().encode("NOTGIF89a000000")),
    /Invalid GIF signature/
  );

  const onePixelGif = Uint8Array.from([
    71, 73, 70, 56, 57, 97,
    1, 0, 1, 0, 128, 0, 0,
    0, 0, 0, 255, 255, 255,
    59
  ]);
  const metadata = inspectGifBinary(onePixelGif);
  assert.equal(metadata.frameCount, 0);
  assert.throws(
    () => assertProfileGifContract(onePixelGif),
    /GIF contract violation/
  );
});
