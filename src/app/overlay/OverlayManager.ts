import type * as THREE from "three";
import type { RecordingAspect } from "./overlayMath";
import { createOverlayController } from "./OverlayController";
import { CanvasTitleRenderer } from "./CanvasTitleRenderer";
import { createSafeAreaOverlay } from "./modules/createSafeAreaOverlay";
import {
  createTitleOverlay,
  type CinematicTitleOptions,
} from "./modules/createTitleOverlay";

export function createOverlayManager(
  viewport: HTMLElement,
  scene?: THREE.Scene,
) {
  const rect = viewport.getBoundingClientRect();

  const controller = createOverlayController(rect.width, rect.height);

  const safeAreaOverlay = createSafeAreaOverlay(viewport, controller);
  const titleOverlay = createTitleOverlay(viewport, controller);
  const canvasTitleOverlay = scene ? new CanvasTitleRenderer(scene) : null;

  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;

    const box = entry.contentRect;
    controller.setViewport(box.width, box.height);
  });

  resizeObserver.observe(viewport);

  function setAspect(aspect: RecordingAspect) {
    controller.setAspect(aspect);
  }

  function toggleSafeArea() {
    const state = controller.getState();
    controller.setShowSafeArea(!state.showSafeArea);
  }

  function showSafeArea(show = true) {
    controller.setShowSafeArea(show);
  }

  function showTitle(options: CinematicTitleOptions) {
    titleOverlay.show(options);
    canvasTitleOverlay?.show(options);
  }

  function hideTitle() {
    titleOverlay.hide();
    canvasTitleOverlay?.hide();
  }

  function setRecording(recording: boolean) {
    controller.setRecording(recording);
    canvasTitleOverlay?.setRecordingMode(recording);
  }

  function updateCanvasTitle(camera: THREE.PerspectiveCamera) {
    canvasTitleOverlay?.update(camera);
  }

  function dispose() {
    resizeObserver.disconnect();
    titleOverlay.dispose();
    canvasTitleOverlay?.dispose();
    safeAreaOverlay.dispose();
  }

  return {
    controller,

    setAspect,
    toggleSafeArea,
    showSafeArea,

    setRecording,
    showTitle,
    hideTitle,
    updateCanvasTitle,

    dispose,
  };
}

export type OverlayManager = ReturnType<typeof createOverlayManager>;