import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { renderProfileSocialCardPng } from "../src/profile-card/renderer.js";
import { buildCardViewModel } from "../src/profile-card/view-model.js";
import {
  SAMPLE_CARD_TODAY_ISO,
  sampleAccountUsageReadResult,
  sampleCardOwner
} from "../src/profile-card/fixtures/sample-account-usage.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const avatarSource = await readFile(resolve(
  repositoryRoot,
  "public/assets/postmelee-avatar.png"
));
const viewModel = buildCardViewModel({
  locale: "ko",
  owner: sampleCardOwner,
  todayIso: SAMPLE_CARD_TODAY_ISO,
  usage: sampleAccountUsageReadResult
});
const png = await renderProfileSocialCardPng(viewModel, {
  avatarSource,
  theme: "dark"
});

await writeFile(
  resolve(repositoryRoot, "public/assets/codex-social-sample.png"),
  png
);
