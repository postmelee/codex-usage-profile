import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  GlobalFonts,
  createCanvas,
  loadImage
} from "@napi-rs/canvas";

import { computeSocialCanvasLayout } from "./social-canvas.js";
import {
  CARD_THEME_PALETTES,
  getCardThemePalette
} from "./theme.js";

export const CARD_LOGICAL_WIDTH = 499;
export const CARD_LOGICAL_HEIGHT = 306;
export const CARD_OUTPUT_SCALE = 3;
export const CARD_OUTPUT_WIDTH = CARD_LOGICAL_WIDTH * CARD_OUTPUT_SCALE;
export const CARD_OUTPUT_HEIGHT = CARD_LOGICAL_HEIGHT * CARD_OUTPUT_SCALE;
export const CARD_RENDERER_VERSION = "codex-share-card-2";

export const CARD_COLORS = CARD_THEME_PALETTES.dark;

const CARD_FONT_FILES_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../node_modules/@fontsource/noto-sans-kr/files"
);
const CARD_FONT_WEIGHTS = Object.freeze([400, 500, 600]);
const cardFontFamiliesByWeight = new Map();
const AVATAR_X = 36;
const AVATAR_Y = 36;
const AVATAR_SIZE = 44;
const AVATAR_RADIUS = AVATAR_SIZE / 2;
const HEATMAP_X = 32;
const HEATMAP_Y = 96;
const HEATMAP_WIDTH = 435;
const HEATMAP_HEIGHT = 115;
const HEATMAP_CELL_SIZE = 14;
const STAT_CENTERS = Object.freeze([86.375, 195.125, 303.875, 412.625]);
const STAT_DIVIDERS = Object.freeze([140.5, 249.5, 358.5]);

let fontsRegistered = false;

export async function renderProfileCardPng(viewModel, options = {}) {
  registerCardFonts();
  const palette = getCardThemePalette(options.theme ?? viewModel.theme);

  const canvas = createCanvas(CARD_OUTPUT_WIDTH, CARD_OUTPUT_HEIGHT);
  const context = canvas.getContext("2d");
  context.scale(CARD_OUTPUT_SCALE, CARD_OUTPUT_SCALE);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  await drawCard(context, viewModel, options, palette);

  return canvas.encode("png");
}

export async function renderProfileSocialCardPng(viewModel, options = {}) {
  registerCardFonts();
  const palette = getCardThemePalette(options.theme ?? viewModel.theme);
  const layout = computeSocialCanvasLayout();

  const canvas = createCanvas(layout.canvasWidth, layout.canvasHeight);
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  context.fillStyle = palette.background;
  context.fillRect(0, 0, layout.canvasWidth, layout.canvasHeight);

  context.save();
  context.translate(layout.cardX, layout.cardY);
  context.scale(layout.scale, layout.scale);
  await drawCard(context, viewModel, options, palette);
  context.restore();

  return canvas.encode("png");
}

async function drawCard(context, viewModel, options, palette) {
  drawCardBackground(context, palette);
  await drawHeader(context, viewModel.header, options, palette);
  drawCodexLabel(context, palette);
  drawHeatmap(context, viewModel.heatmap, palette);
  drawStats(context, viewModel.stats, palette);
}

export function registerCardFonts() {
  if (fontsRegistered) return;

  const allFontFiles = readdirSync(CARD_FONT_FILES_DIRECTORY).sort();
  let registeredFontCount = 0;

  for (const weight of CARD_FONT_WEIGHTS) {
    const fontFiles = allFontFiles.filter((fileName) => (
      fileName.endsWith(`-${weight}-normal.woff2`)
    ));
    const families = [];

    fontFiles.forEach((fileName, index) => {
      const family = `CodexCard${weight}_${index}`;
      const key = GlobalFonts.registerFromPath(
        join(CARD_FONT_FILES_DIRECTORY, fileName),
        family
      );

      if (key) {
        families.push(family);
        registeredFontCount += 1;
      }
    });

    cardFontFamiliesByWeight.set(weight, families);
  }

  if (registeredFontCount === 0) {
    throw new Error("Codex card font files are missing or invalid");
  }

  fontsRegistered = true;
}

function drawCardBackground(context, palette) {
  context.fillStyle = palette.background;
  context.beginPath();
  context.roundRect(0, 0, CARD_LOGICAL_WIDTH, CARD_LOGICAL_HEIGHT, 32);
  context.fill();
}

async function drawHeader(context, header, options, palette) {
  const avatarImage = await resolveAvatarImage(options.avatarSource);

  context.save();
  context.beginPath();
  context.arc(
    AVATAR_X + AVATAR_RADIUS,
    AVATAR_Y + AVATAR_RADIUS,
    AVATAR_RADIUS,
    0,
    Math.PI * 2
  );
  context.clip();

  if (avatarImage) {
    drawImageCover(
      context,
      avatarImage,
      AVATAR_X,
      AVATAR_Y,
      AVATAR_SIZE,
      AVATAR_SIZE
    );
  } else {
    context.fillStyle = palette.avatarFallback;
    context.fillRect(AVATAR_X, AVATAR_Y, AVATAR_SIZE, AVATAR_SIZE);
    drawCenteredFittedText(context, getAvatarFallback(header.displayName), {
      centerX: AVATAR_X + AVATAR_RADIUS,
      color: palette.secondary,
      maxFontSize: 18,
      maxWidth: 32,
      minFontSize: 14,
      weight: 600,
      y: 64
    });
  }
  context.restore();

  drawFittedText(context, header.displayName, {
    color: palette.primary,
    maxFontSize: 19,
    maxWidth: 260,
    minFontSize: 14,
    weight: 600,
    x: 96,
    y: 56
  });
  drawFittedText(context, header.username, {
    color: palette.secondary,
    maxFontSize: 13,
    maxWidth: 260,
    minFontSize: 10,
    weight: 400,
    x: 96,
    y: 75
  });
}

function drawCodexLabel(context, palette) {
  drawFittedText(context, "Codex", {
    color: palette.secondary,
    maxFontSize: 20,
    maxWidth: 57,
    minFontSize: 18,
    weight: 600,
    x: 411,
    y: 64.5
  });
}

function drawHeatmap(context, heatmap, palette) {
  const columnStep = (HEATMAP_WIDTH - HEATMAP_CELL_SIZE) /
    Math.max(heatmap.columnCount - 1, 1);
  const rowStep = (HEATMAP_HEIGHT - HEATMAP_CELL_SIZE) /
    Math.max(heatmap.rowCount - 1, 1);

  for (const cell of heatmap.cells) {
    const x = HEATMAP_X + cell.column * columnStep;
    const y = HEATMAP_Y + cell.row * rowStep;

    context.fillStyle = palette.heatmap[cell.level] ?? cell.color;
    context.beginPath();
    context.roundRect(x, y, HEATMAP_CELL_SIZE, HEATMAP_CELL_SIZE, 4);
    context.fill();
  }
}

function drawStats(context, stats, palette) {
  context.fillStyle = palette.divider;
  for (const dividerX of STAT_DIVIDERS) {
    context.fillRect(dividerX, 234, 1, 40);
  }

  stats.slice(0, 4).forEach((stat, index) => {
    const centerX = STAT_CENTERS[index];

    drawCenteredFittedText(context, stat.value, {
      centerX,
      color: palette.primary,
      maxFontSize: 18,
      maxWidth: 96,
      minFontSize: 14,
      weight: 600,
      y: 251
    });
    drawCenteredFittedText(context, stat.label, {
      centerX,
      color: palette.secondary,
      maxFontSize: 13,
      maxWidth: 98,
      minFontSize: 9,
      weight: 400,
      y: 273
    });
  });
}

function drawFittedText(context, text, options) {
  const fitted = fitText(context, text, options);

  context.fillStyle = options.color;
  context.font = createFont(fitted.fontSize, options.weight);
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillText(fitted.text, options.x, options.y);
}

function drawCenteredFittedText(context, text, options) {
  const fitted = fitText(context, text, options);

  context.fillStyle = options.color;
  context.font = createFont(fitted.fontSize, options.weight);
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillText(fitted.text, options.centerX, options.y);
}

function fitText(context, value, options) {
  const text = String(value ?? "—");
  const minFontSize = options.minFontSize ?? options.maxFontSize;
  let fontSize = options.maxFontSize;

  while (fontSize > minFontSize) {
    context.font = createFont(fontSize, options.weight);
    if (context.measureText(text).width <= options.maxWidth) {
      return { fontSize, text };
    }
    fontSize = Math.max(minFontSize, fontSize - 0.5);
  }

  context.font = createFont(fontSize, options.weight);
  if (context.measureText(text).width <= options.maxWidth) {
    return { fontSize, text };
  }

  return {
    fontSize,
    text: truncateText(context, text, options.maxWidth)
  };
}

function truncateText(context, text, maxWidth) {
  const characters = Array.from(text);
  const ellipsis = "…";

  while (characters.length > 1) {
    characters.pop();
    const candidate = `${characters.join("")}${ellipsis}`;

    if (context.measureText(candidate).width <= maxWidth) {
      return candidate;
    }
  }

  return ellipsis;
}

async function resolveAvatarImage(source) {
  if (!source) return null;

  if (source?.bytes instanceof Uint8Array) {
    return loadImage(source.bytes);
  }

  if (
    typeof source === "object" &&
    typeof source.width === "number" &&
    typeof source.height === "number"
  ) {
    return source;
  }

  return loadImage(source);
}

function drawImageCover(context, image, x, y, width, height) {
  const sourceRatio = image.width / image.height;
  const targetRatio = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.width;
  let sourceHeight = image.height;

  if (sourceRatio > targetRatio) {
    sourceWidth = image.height * targetRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else if (sourceRatio < targetRatio) {
    sourceHeight = image.width / targetRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height
  );
}

function createFont(fontSize, weight) {
  const families = cardFontFamiliesByWeight.get(weight) ??
    cardFontFamiliesByWeight.get(500) ??
    [];

  return `${weight} ${fontSize}px ${families.join(",")}`;
}

function getAvatarFallback(displayName) {
  return Array.from(String(displayName ?? "?"))[0]?.toUpperCase() ?? "?";
}
