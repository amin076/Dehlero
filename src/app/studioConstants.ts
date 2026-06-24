
import type { CameraShot } from "./studioTypes";

export const CAMERA_SHOT_LABELS: Record<CameraShot, string> = {
  static: "Static Shot",
  orbit: "Orbit",
  "dolly-in": "Dolly",
  "close-up": "Close Up",
  "dolly-zoom": "Dolly Zoom",
};

export const SCENE_STORAGE_KEY = "dehlero.scene.v1";

export const PROJECT_INDEX_STORAGE_KEY =
  "dehlero.projects.v1";

export const ACTIVE_PROJECT_STORAGE_KEY =
  "dehlero.activeProject.v1";

export const ASSET_DB_NAME = "dehlero-assets";

export const ASSET_STORE_NAME = "assets";
