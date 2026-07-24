import resvgWasmModule from "@resvg/resvg-wasm/index_bg.wasm";

import notoSansKrKorean400 from "./assets/noto-sans-kr-korean-400.bin";
import notoSansKrKorean600 from "./assets/noto-sans-kr-korean-600.bin";
import notoSansKrLatin400 from "./assets/noto-sans-kr-latin-400.bin";
import notoSansKrLatin600 from "./assets/noto-sans-kr-latin-600.bin";

export const PROFILE_CARD_WORKER_RENDERER_ASSETS = Object.freeze({
  fontBuffers: Object.freeze([
    new Uint8Array(notoSansKrKorean400),
    new Uint8Array(notoSansKrKorean600),
    new Uint8Array(notoSansKrLatin400),
    new Uint8Array(notoSansKrLatin600)
  ]),
  wasmModule: resvgWasmModule
});
