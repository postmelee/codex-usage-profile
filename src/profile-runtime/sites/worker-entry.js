import {
  WORKER_CARD_RENDERER_VERSION,
  createWorkerProfileCardRenderer
} from "../../profile-card/worker-renderer.js";
import {
  PROFILE_CARD_WORKER_RENDERER_ASSETS
} from "../../profile-card/worker-renderer-assets.js";
import { createProfileSitesWorker } from "./worker.js";

const profileCardRenderPng = createWorkerProfileCardRenderer(
  PROFILE_CARD_WORKER_RENDERER_ASSETS
);

export default createProfileSitesWorker({
  profileCardRenderPng,
  profileCardRendererVersion: WORKER_CARD_RENDERER_VERSION
});
