import type { OverlayManager } from "./OverlayManager";
import type { RecordingAspect } from "./overlayMath";
import type { CinematicTitleOptions } from "./modules/createTitleOverlay";

let activeOverlayManager: OverlayManager | null = null;

export function setActiveOverlayManager(manager: OverlayManager | null) {
  activeOverlayManager = manager;
}

export function getActiveOverlayManager() {
  return activeOverlayManager;
}

export const overlayService = {
  setAspect(aspect: RecordingAspect) {
    activeOverlayManager?.setAspect(aspect);
  },

  showSafeArea(show = true) {
    activeOverlayManager?.showSafeArea(show);
  },

  toggleSafeArea() {
    activeOverlayManager?.toggleSafeArea();
  },

  setRecording(recording: boolean) {
    activeOverlayManager?.setRecording(recording);
  },

  showTitle(options: CinematicTitleOptions) {
    activeOverlayManager?.showTitle(options);
  },

  hideTitle() {
    activeOverlayManager?.hideTitle();
  },
};