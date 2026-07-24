import {
  CARD_RENDERER_VERSION,
  renderProfileCardPng
} from "./renderer.js";
import { createProfileCardServiceCore } from "./service-core.js";

export {
  DEFAULT_PROFILE_CARD_AVATAR_MAX_BYTES,
  DEFAULT_PROFILE_CARD_AVATAR_TIMEOUT_MS,
  DEFAULT_PROFILE_CARD_CACHE_ENTRIES,
  DEFAULT_PROFILE_CARD_RENDERER_VERSION,
  createProfileCardEtag,
  createProfileCardRevision,
  createProfileCardSourceDigest,
  normalizeGitHubAvatarUrl
} from "./service-core.js";

export function createProfileCardService(options = {}) {
  return createProfileCardServiceCore({
    ...options,
    rendererVersion: options.rendererVersion ?? CARD_RENDERER_VERSION,
    renderPng: options.renderPng ?? renderProfileCardPng
  });
}
