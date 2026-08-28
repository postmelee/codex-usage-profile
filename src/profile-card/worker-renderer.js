import { Resvg, initWasm } from "@resvg/resvg-wasm";

import {
  SOCIAL_CARD_LOGICAL_RADIUS,
  SOCIAL_OUTPUT_SCALE,
  computeSocialCanvasLayout,
  getSocialCanvasSurface
} from "./social-canvas.js";
import { getCardThemePalette } from "./theme.js";

export const WORKER_CARD_RENDERER_VERSION =
  "codex-share-card-3-resvg-wasm-1";

const CARD_LOGICAL_WIDTH = 499;
const CARD_LOGICAL_HEIGHT = 306;
const CARD_OUTPUT_SCALE = 3;
const AVATAR_X = 36;
const AVATAR_Y = 36;
const AVATAR_SIZE = 44;
const HEATMAP_X = 32;
const HEATMAP_Y = 96;
const HEATMAP_WIDTH = 435;
const HEATMAP_HEIGHT = 115;
const HEATMAP_CELL_SIZE = 14;
const STAT_CENTERS = Object.freeze([86.375, 195.125, 303.875, 412.625]);
const STAT_DIVIDERS = Object.freeze([140.5, 249.5, 358.5]);

let wasmInitialization = null;

export function createWorkerProfileCardRenderer(options = {}) {
  const wasmModule = options.wasmModule;
  const fontBuffers = normalizeFontBuffers(options.fontBuffers);

  if (!wasmModule) {
    throw new TypeError("Worker renderer Wasm module is required");
  }

  async function renderSvg(svg, fitTo) {
    await initializeWorkerRendererWasm(wasmModule);

    const renderer = new Resvg(svg, {
      fitTo,
      font: {
        defaultFontFamily: "Noto Sans KR",
        fontBuffers,
        loadSystemFonts: false,
        sansSerifFamily: "Noto Sans KR"
      },
      imageRendering: 0,
      shapeRendering: 2,
      textRendering: 2
    });

    try {
      const rendered = renderer.render();
      try {
        return rendered.asPng();
      } finally {
        rendered.free();
      }
    } finally {
      renderer.free();
    }
  }

  async function renderWorkerProfileCardPng(viewModel, renderOptions = {}) {
    return renderSvg(
      createWorkerProfileCardSvg(viewModel, renderOptions),
      { mode: "zoom", value: CARD_OUTPUT_SCALE }
    );
  }

  renderWorkerProfileCardPng.renderSocial = async function renderSocial(
    viewModel,
    renderOptions = {}
  ) {
    return renderSvg(
      createWorkerProfileSocialCardSvg(viewModel, renderOptions),
      { mode: "zoom", value: SOCIAL_OUTPUT_SCALE }
    );
  };

  return renderWorkerProfileCardPng;
}

export function createWorkerProfileCardSvg(viewModel, options = {}) {
  assertViewModel(viewModel);
  const palette = getCardThemePalette(options.theme ?? viewModel.theme);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_LOGICAL_WIDTH}"`,
    ` height="${CARD_LOGICAL_HEIGHT}" viewBox="0 0 ${CARD_LOGICAL_WIDTH}`,
    ` ${CARD_LOGICAL_HEIGHT}">`,
    createWorkerProfileCardBody(viewModel, options, palette),
    "</svg>"
  ].join("");
}

export function createWorkerProfileSocialCardSvg(viewModel, options = {}) {
  assertViewModel(viewModel);
  const theme = options.theme ?? viewModel.theme;
  const palette = getCardThemePalette(theme);
  const layout = computeSocialCanvasLayout();
  const surface = getSocialCanvasSurface(theme, layout);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.canvasWidth}"`,
    ` height="${layout.canvasHeight}" viewBox="0 0 ${layout.canvasWidth}`,
    ` ${layout.canvasHeight}">`,
    surface
      ? `<rect width="${layout.canvasWidth}" height="${layout.canvasHeight}"` +
        ` fill="${surface.backgroundColor}"/>`
      : "",
    `<g transform="translate(${layout.cardX} ${layout.cardY})`,
    ` scale(${layout.scale})">`,
    createWorkerProfileCardBody(viewModel, options, palette),
    "</g>",
    surface ? createWorkerSocialCardOutline(surface) : "",
    "</svg>"
  ].join("");
}

function createWorkerSocialCardOutline(surface) {
  const { outline } = surface;

  return [
    `<rect x="${outline.x}" y="${outline.y}"`,
    ` width="${outline.width}" height="${outline.height}"`,
    ` rx="${outline.radius}" fill="none"`,
    ` stroke="${surface.borderColor}" stroke-width="${surface.borderWidth}"/>`
  ].join("");
}

function createWorkerProfileCardBody(viewModel, options, palette) {
  const avatar = createAvatarMarkup(
    viewModel.header,
    options.avatarSource,
    palette
  );
  const heatmap = createHeatmapMarkup(viewModel.heatmap, palette);
  const stats = createStatsMarkup(viewModel.stats, palette);

  return [
    "<defs>",
    '<clipPath id="avatar-clip"><circle cx="58" cy="58" r="22"/></clipPath>',
    "</defs>",
    `<rect width="${CARD_LOGICAL_WIDTH}" height="${CARD_LOGICAL_HEIGHT}"`,
    ` rx="${SOCIAL_CARD_LOGICAL_RADIUS}" fill="${palette.background}"/>`,
    avatar,
    createFittedText(viewModel.header.displayName, {
      color: palette.primary,
      fontSize: 19,
      maxWidth: 260,
      minFontSize: 14,
      weight: 600,
      x: 96,
      y: 56
    }),
    createFittedText(viewModel.header.username, {
      color: palette.secondary,
      fontSize: 13,
      maxWidth: 260,
      minFontSize: 10,
      weight: 400,
      x: 96,
      y: 75
    }),
    createFittedText("Codex", {
      anchor: "middle",
      color: palette.secondary,
      fontSize: 20,
      maxWidth: 57,
      minFontSize: 18,
      weight: 600,
      x: 439.5,
      y: 64.5
    }),
    heatmap,
    stats
  ].join("");
}

async function initializeWorkerRendererWasm(wasmModule) {
  if (!wasmInitialization) {
    wasmInitialization = initWasm(wasmModule).catch((error) => {
      wasmInitialization = null;
      throw error;
    });
  }

  await wasmInitialization;
}

function createAvatarMarkup(header, source, palette) {
  const avatarUri = createAvatarDataUri(source);
  if (avatarUri) {
    return [
      `<image x="${AVATAR_X}" y="${AVATAR_Y}" width="${AVATAR_SIZE}"`,
      ` height="${AVATAR_SIZE}" preserveAspectRatio="xMidYMid slice"`,
      ' clip-path="url(#avatar-clip)"',
      ` href="${escapeXml(avatarUri)}"/>`
    ].join("");
  }

  return [
    `<circle cx="58" cy="58" r="22" fill="${palette.avatarFallback}"/>`,
    createFittedText(getAvatarFallback(header.displayName), {
      anchor: "middle",
      color: palette.secondary,
      fontSize: 18,
      maxWidth: 32,
      minFontSize: 14,
      weight: 600,
      x: 58,
      y: 64
    })
  ].join("");
}

function createHeatmapMarkup(heatmap, palette) {
  const columnStep = (HEATMAP_WIDTH - HEATMAP_CELL_SIZE) /
    Math.max(heatmap.columnCount - 1, 1);
  const rowStep = (HEATMAP_HEIGHT - HEATMAP_CELL_SIZE) /
    Math.max(heatmap.rowCount - 1, 1);

  return heatmap.cells.map((cell) => {
    const x = HEATMAP_X + cell.column * columnStep;
    const y = HEATMAP_Y + cell.row * rowStep;
    return `<rect x="${formatNumber(x)}" y="${formatNumber(y)}"` +
      ` width="${HEATMAP_CELL_SIZE}" height="${HEATMAP_CELL_SIZE}"` +
      ` rx="4" fill="${escapeXml(palette.heatmap[cell.level] ?? cell.color)}"/>`;
  }).join("");
}

function createStatsMarkup(stats, palette) {
  const dividers = STAT_DIVIDERS.map((x) => (
    `<rect x="${x}" y="234" width="1" height="40"` +
    ` fill="${palette.divider}"/>`
  )).join("");
  const labels = stats.slice(0, 4).map((stat, index) => {
    const x = STAT_CENTERS[index];
    return [
      createFittedText(stat.value, {
        anchor: "middle",
        color: palette.primary,
        fontSize: 18,
        maxWidth: 96,
        minFontSize: 14,
        weight: 600,
        x,
        y: 251
      }),
      createFittedText(stat.label, {
        anchor: "middle",
        color: palette.secondary,
        fontSize: 13,
        maxWidth: 98,
        minFontSize: 9,
        weight: 400,
        x,
        y: 273
      })
    ].join("");
  }).join("");

  return `${dividers}${labels}`;
}

function createFittedText(value, options) {
  const fitted = fitSvgText(value, options);
  const length = fitted.compressed
    ? ` textLength="${options.maxWidth}" lengthAdjust="spacingAndGlyphs"`
    : "";

  return [
    `<text x="${formatNumber(options.x)}" y="${formatNumber(options.y)}"`,
    ` fill="${options.color}" font-family="Noto Sans KR"`,
    ` font-size="${fitted.fontSize}" font-weight="${options.weight}"`,
    ` text-anchor="${options.anchor ?? "start"}"${length}>`,
    escapeXml(fitted.text),
    "</text>"
  ].join("");
}

function fitSvgText(value, options) {
  const text = String(value ?? "—");
  const minFontSize = options.minFontSize ?? options.fontSize;
  let fontSize = options.fontSize;
  let width = estimateTextWidth(text, fontSize);

  while (fontSize > minFontSize && width > options.maxWidth) {
    fontSize = Math.max(minFontSize, fontSize - 0.5);
    width = estimateTextWidth(text, fontSize);
  }

  return {
    compressed: width > options.maxWidth,
    fontSize,
    text
  };
}

function estimateTextWidth(text, fontSize) {
  return Array.from(text).reduce((width, character) => {
    if (/\s/.test(character)) return width + fontSize * 0.32;
    if (character.codePointAt(0) > 0xff) return width + fontSize;
    if (/[ilI1|.,'`]/.test(character)) return width + fontSize * 0.3;
    if (/[MW@#%]/.test(character)) return width + fontSize * 0.85;
    return width + fontSize * 0.58;
  }, 0);
}

function createAvatarDataUri(source) {
  if (!source) return null;
  if (typeof source === "string" && source.startsWith("data:image/")) {
    return source;
  }

  const bytes = normalizeByteSource(source);
  if (!bytes || bytes.byteLength === 0) return null;
  const mediaType = sniffImageMediaType(bytes);
  if (!mediaType) return null;

  return `data:${mediaType};base64,${encodeBase64(bytes)}`;
}

function normalizeByteSource(source) {
  if (source instanceof Uint8Array) return source;
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  if (ArrayBuffer.isView(source)) {
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  }
  return null;
}

function sniffImageMediaType(bytes) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 &&
    bytes[2] === 0x4e && bytes[3] === 0x47
  ) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 6 &&
    String.fromCharCode(...bytes.subarray(0, 3)) === "GIF"
  ) return "image/gif";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) return "image/webp";
  return null;
}

function encodeBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function normalizeFontBuffers(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError("Worker renderer font buffers are required");
  }

  return value.map((font) => {
    const bytes = normalizeByteSource(font);
    if (!bytes || bytes.byteLength === 0) {
      throw new TypeError("Worker renderer font buffer must not be empty");
    }
    return bytes;
  });
}

function assertViewModel(value) {
  if (
    !value || typeof value !== "object" ||
    !value.header || !value.heatmap || !Array.isArray(value.stats)
  ) {
    throw new TypeError("Profile card view model is required");
  }
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatNumber(value) {
  return Number(value.toFixed(4)).toString();
}

function getAvatarFallback(displayName) {
  return Array.from(String(displayName ?? "?"))[0]?.toUpperCase() ?? "?";
}
