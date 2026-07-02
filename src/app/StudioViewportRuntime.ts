import * as THREE from "three";
import CameraControls from "camera-controls";
import { setActiveOverlayManager } from "./overlay/OverlayService";
import { createOverlayManager } from "./overlay/OverlayManager";
import { createViewportToolbar } from "./ui/createViewportToolbar";
import type { RecordingAspect } from "./studioTypes";
import type { createProductionPanel } from "./ui/createProductionPanel";

CameraControls.install({ THREE });

type ProductionPanel = ReturnType<typeof createProductionPanel> | null;

type StudioViewportRuntimeOptions = {
  root: HTMLDivElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  getProductionPanel: () => ProductionPanel;
};

export function createStudioViewportRuntime({
  root,
  scene,
  camera,
  renderer,
  getProductionPanel,
}: StudioViewportRuntimeOptions) {
  scene.background = new THREE.Color("#090b12");

  const viewport = document.createElement("div");
  viewport.className = "dehlero-viewport";
  root.appendChild(viewport);
  viewport.appendChild(renderer.domElement);

  const overlayManager = createOverlayManager(viewport, scene);
  setActiveOverlayManager(overlayManager);

  function toOverlayAspect(aspect: RecordingAspect) {
    switch (aspect) {
      case "16:9":
        return "landscape";
      case "9:16":
      default:
        return "shorts";
    }
  }

  const controls = new CameraControls(camera, renderer.domElement);
  controls.minDistance = 0.1;
  controls.maxDistance = 2000;
  controls.infinityDolly = true;
  controls.smoothTime = 0.12;
  controls.setLookAt(18, 12, 28, 0, 2, 0, false);

  camera.near = 0.01;
  camera.far = 10000;
  camera.updateProjectionMatrix();

  const grid = new THREE.GridHelper(200, 100, "#3f4d64", "#202938");
  grid.visible = true;
  scene.add(grid);

  const viewportHelpers = { grid };

  const viewportToolbar = createViewportToolbar({
    root,
    getGridVisible: () => viewportHelpers.grid.visible,
    setGridVisible: (visible) => {
      viewportHelpers.grid.visible = visible;
      getProductionPanel()?.setStatus(
        visible ? "Grid Visible" : "Grid Hidden",
      );
    },
  });

  let restoreGridVisible = grid.visible;

  function enterRecordViewportMode() {
    restoreGridVisible = viewportHelpers.grid.visible;
    viewportHelpers.grid.visible = false;
  }

  function exitRecordViewportMode() {
    viewportHelpers.grid.visible = restoreGridVisible;
  }

  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "g") {
      viewportHelpers.grid.visible = !viewportHelpers.grid.visible;
      viewportToolbar.refresh();
      getProductionPanel()?.setStatus(
        viewportHelpers.grid.visible ? "Grid Visible" : "Grid Hidden",
      );
    }

    if (event.key.toLowerCase() === "v") {
      overlayManager.toggleSafeArea();
      getProductionPanel()?.setStatus("Safe Area Toggled");
    }

    if (event.key === "1") {
      overlayManager.showTitle({
        eyebrow: "Titan 3026",
        title: "World Cup",
        subtitle: "The first match beyond Earth",
        durationMs: 3500,
      });
    }

    if (event.key === "2") {
      overlayManager.showTitle({
        eyebrow: "Coming Soon",
        title: "Titan World Cup 3026",
        subtitle: " Esbiko cinematic simulation",
        durationMs: 4500,
      });
    }

    if (event.key === "0") {
      overlayManager.hideTitle();
    }
  });

  const ambient = new THREE.AmbientLight("#ffffff", 0.32);
  ambient.name = "Ambient Light";
  scene.add(ambient);

  return {
    viewport,
    overlayManager,
    controls,
    ambient,
    toOverlayAspect,
    enterRecordViewportMode,
    exitRecordViewportMode,
  };
}

export type StudioViewportRuntime = ReturnType<
  typeof createStudioViewportRuntime
>;
