import * as THREE from "three";
import CameraControls from "camera-controls";
import { getProject } from "@theatre/core";
import type { ISheet } from "@theatre/core";
import type { LibraryItem } from "./studioTypes";
import {
  ACTIVE_PROJECT_STORAGE_KEY,
} from "./studioConstants";
import {
  cleanupDuplicateTheatreShotPanes,
  studio,
  studioInitialization,
} from "./studioTheatre";
import {
  loadProjectByName,
  migrateLegacySceneStorage,
} from "./studioStorage";

export function createDefaultViewport({
  root,
  renderer,
}: {
  root: HTMLDivElement;
  renderer: THREE.WebGLRenderer;
}) {
  const viewport = document.createElement("div");
  viewport.className = "dehlero-viewport";

  root.appendChild(viewport);
  viewport.appendChild(renderer.domElement);

  return viewport;
}

export function createDefaultControls({
  camera,
  renderer,
}: {
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
}) {
  const controls = new CameraControls(camera, renderer.domElement);
  controls.setLookAt(6, 5, 8, 0, 0.75, 0, false);

  return controls;
}

export function addDefaultSceneHelpers(scene: THREE.Scene) {
  const grid = new THREE.GridHelper(18, 18, "#3f4d64", "#202938");
  scene.add(grid);

  const ambient = new THREE.AmbientLight("#ffffff", 0.32);
  ambient.name = "Ambient Light";
  scene.add(ambient);

  return {
    grid,
    ambient,
  };
}

export function addDefaultProjectObjects({
  library,
  addLibraryObject,
}: {
  library: LibraryItem[];
  addLibraryObject: (item: LibraryItem) => void;
}) {
  ["Cube", "Sphere", "Plane", "Directional", "Point", "Camera"].forEach(
    (label) => {
      const item = library.find((candidate) => candidate.label === label);

      if (item) {
        addLibraryObject(item);
      }
    },
  );
}

export function initializeTheatreSheet({
  setTheatreSheet,
  setTheatreShotPaneRoot,
  setTheatreShotPaneCreated,
  mountedTheatreShotPaneIds,
  renderTheatreShotPane,
  setStatus,
}: {
  setTheatreSheet: (sheet: ISheet | null) => void;
  setTheatreShotPaneRoot: (root: HTMLElement | null) => void;
  setTheatreShotPaneCreated: (value: boolean) => void;
  mountedTheatreShotPaneIds: Set<string>;
  renderTheatreShotPane: () => void;
  setStatus: (message: string) => void;
}) {
  try {
    const theatreSheet = getProject("Dehlero Motion").sheet("Scene");

    studio.extend(
      {
        id: "dehlero-shot-tools",
        panes: [
          {
            class: "dehlero-shot-director",
            mount({ node, paneId }) {
              mountedTheatreShotPaneIds.add(paneId);
              setTheatreShotPaneCreated(true);

              if (mountedTheatreShotPaneIds.size > 1) {
                window.requestAnimationFrame(() => {
                  cleanupDuplicateTheatreShotPanes();
                });
              }

              setTheatreShotPaneRoot(node);
              renderTheatreShotPane();

              return () => {
                mountedTheatreShotPaneIds.delete(paneId);
                setTheatreShotPaneRoot(null);
              };
            },
          },
        ],
      },
      { __experimental_reconfigure: true },
    );

    studio.setSelection([theatreSheet]);
    setTheatreSheet(theatreSheet);

    void studioInitialization.then(() => {
      studio.ui.hide();
      cleanupDuplicateTheatreShotPanes();
      setStatus("Theatre ready");
    });

    return theatreSheet;
  } catch (error) {
    console.error(error);
    setTheatreSheet(null);
    setStatus("Theatre failed to initialize");
    return null;
  }
}

export function prepareStoredProjects({
  refreshProjects,
}: {
  refreshProjects: (selectedName?: string) => void;
}) {
  migrateLegacySceneStorage();

  refreshProjects(
    localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) ?? undefined,
  );
}

export function getActiveStoredScene() {
  const activeProjectName = localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
  return activeProjectName ? loadProjectByName(activeProjectName) : null;
}

export function resizeViewport({
  recording,
  viewport,
  renderer,
  getActiveRenderCamera,
  mainCamera,
}: {
  recording: unknown;
  viewport: HTMLElement;
  renderer: THREE.WebGLRenderer;
  getActiveRenderCamera: () => THREE.PerspectiveCamera;
  mainCamera: THREE.PerspectiveCamera;
}) {
  if (recording) return;

  const bounds = viewport.getBoundingClientRect();
  const width = Math.max(Math.floor(bounds.width), 1);
  const height = Math.max(Math.floor(bounds.height), 1);
  const renderCamera = getActiveRenderCamera();

  renderCamera.aspect = width / height;
  renderCamera.updateProjectionMatrix();

  mainCamera.aspect = width / height;
  mainCamera.updateProjectionMatrix();

  renderer.setSize(width, height);
}

export function renderStudioFrame({
  clock,
  timelinePlaying,
  updateTimeline,
  updatePlayhead,
  controls,
  helpers,
  renderer,
  scene,
  getActiveRenderCamera,
}: {
  clock: THREE.Clock;
  timelinePlaying: boolean;
  updateTimeline: (delta: number) => void;
  updatePlayhead: () => void;
  controls: CameraControls;
  helpers: Map<string, { update: () => void }>;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  getActiveRenderCamera: () => THREE.PerspectiveCamera;
}) {
  const delta = clock.getDelta();

  if (timelinePlaying) {
    updateTimeline(delta);
  }

  updatePlayhead();
  controls.update(delta);
  helpers.forEach((helper) => helper.update());
  renderer.render(scene, getActiveRenderCamera());
}
