import * as THREE from "three";
import CameraControls from "camera-controls";
import { getProject, types } from "@theatre/core";
import type { ISheet, ISheetObject } from "@theatre/core";
import type { IScrub } from "@theatre/studio";

import { HierarchyPanel } from "../editor/HierarchyPanel";
import type { SceneNode } from "../core/scene/SceneNode";
import { createSceneNodeFromObject } from "../core/scene/SceneNode";
import { SceneRegistry } from "../core/scene/SceneRegistry";
import { SelectionManager } from "../editor/SelectionManager";
import { createTransformEditor } from "../editor/TransformEditor";
import { createStudioCamera } from "../engine/camera/createStudioCamera";
import { createRenderer } from "../engine/renderer/createRenderer";
import { createScene } from "../engine/scene/createScene";

import {
  CAMERA_SHOT_LABELS,
  ACTIVE_PROJECT_STORAGE_KEY,
} from "./studioConstants";

import type {
  CameraOption,
  CameraShot,
  LibraryItem,
  MotionPreset,
  NodeSource,
  RecordingAspect,
  SavedScene,
  SavedTimelineClip,
  SceneHelper,
  TheatreBinding,
  TimelineAnimation,
  TimelineDockItem,
} from "./studioTypes";

import { createLibrary } from "./studioLibrary";
import {
  addObjectHelper,
  disposeObject,
  placeObject,
} from "./studioObjectUtils";
import {
  applyRgbaToColor,
  colorToRgba,
  getFirstStandardMaterial,
  numberProp,
  vectorProps,
} from "./studioMath";
import { loadProjectByName, migrateLegacySceneStorage } from "./studioStorage";
import {
  studio,
  studioInitialization,
  cleanupDuplicateTheatreShotPanes,
} from "./studioTheatre";
import {
  type RecordingState,
  getRecordingSize,
  createRecordingDownload,
  isRecordingSupported,
} from "./studioRecording";
import {
  pickNode as pickNodeFromScene,
  attachPickingEvents,
} from "./studioScenePicking";
import { createObjectMotionAnimation } from "./studioObjectMotions";
import {
  createShotRuntimeState,
  calculateCameraShotState,
  getShotTarget as getShotTargetFromSelection,
} from "./studioCameraShots";
import {
  createTimelineAnimation,
  getCameraShotAnimations as getCameraShotAnimationsFromState,
  getTimelineDuration as getTimelineDurationFromState,
  getCameraShotTimelineItems as getCameraShotTimelineItemsFromState,
  getObjectMotionTimelineItems as getObjectMotionTimelineItemsFromState,
  serializeTimeline as serializeTimelineData,
  clearTimelineState,
  applyCameraShotOrder as applyCameraShotOrderData,
  resetTimelineAnimations,
  updateTimelineAnimations,
} from "./studioTimeline";
import {
  bakeCameraShotToTheatre,
  bakeObjectMotionToTheatre,
} from "./studioTheatreBake";
import {
  serializeScene as serializeSceneData,
  saveSceneToStorage,
  saveCurrentSceneToStorage,
  getNextUntitledSceneName,
  getSavedProject,
  applySavedObjectToScene,
  importModelObject,
  applyTextureToSelectedObject,
  createTexturedPlanetObject,
} from "./studioScenePersistence";

import { createWorkspaceBar } from "./ui/createWorkspaceBar";
import { createSceneBuilderPanel } from "./ui/createSceneBuilderPanel";
import { createProductionPanel } from "./ui/createProductionPanel";
import { createTimelineDock } from "./ui/createTimelineDock";

CameraControls.install({ THREE });

export function createStudioApp({ root }: { root: HTMLDivElement }) {
  root.innerHTML = "";
  root.className = "studio-shell";
  root.dataset.workspace = "scene";
  root.dataset.assetsOpen = "true";
  root.dataset.inspectorOpen = "true";

  const registry = new SceneRegistry();
  const selection = new SelectionManager();
  const scene = createScene();
  const camera = createStudioCamera();
  const renderer = createRenderer();
  const clock = new THREE.Clock();
  const helpers = new Map<string, SceneHelper>();
  const library = createLibrary();
  const theatreBindings = new Map<string, TheatreBinding>();
  let theatreSheet: ISheet | null = null;
  let theatreMainCamera: ISheetObject<any> | null = null;
  let theatreMainCameraUnsubscribe: (() => void) | null = null;
  let transformScrub: IScrub | null = null;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pointerDown = new THREE.Vector2();
  const activeAnimations: TimelineAnimation[] = [];
  let didDragTransform = false;
  let timelinePlaying = true;
  let timelinePosition = 0;
  let cameraShotCursor = 0;
  let activeShotId: string | null = null;
  let activeRenderCameraId = "main";
  let workspaceController: ReturnType<typeof createWorkspaceBar> | null = null;
  let theatreShotPaneRoot: HTMLElement | null = null;
  let theatreShotPaneCreated = false;
  const mountedTheatreShotPaneIds = new Set<string>();
  let productionPanel: ReturnType<typeof createProductionPanel> | null = null;
  let timelineDock: ReturnType<typeof createTimelineDock> | null = null;
  let recording: RecordingState | null = null;

  scene.background = new THREE.Color("#090b12");

  const viewport = document.createElement("div");
  viewport.className = "dehlero-viewport";
  root.appendChild(viewport);
  viewport.appendChild(renderer.domElement);

  const controls = new CameraControls(camera, renderer.domElement);
  controls.setLookAt(6, 5, 8, 0, 0.75, 0, false);

  const grid = new THREE.GridHelper(18, 18, "#3f4d64", "#202938");
  scene.add(grid);

  const ambient = new THREE.AmbientLight("#ffffff", 0.32);
  ambient.name = "Ambient Light";
  scene.add(ambient);

  const transformEditor = createTransformEditor({
    root,
    scene,
    camera,
    renderer,
    cameraControls: controls,
    registry,
    selection,
    onDeleteNode: deleteNode,
    onSelectionChange: updateHelperVisibility,
  });
  const hierarchyPanel = new HierarchyPanel(
    registry,
    selection,
    transformEditor,
  );

  const hierarchyMount = document.createElement("div");
  hierarchyMount.className = "hierarchy-mount";
  root.appendChild(hierarchyMount);
  hierarchyMount.appendChild(hierarchyPanel.getElement());

  hierarchyPanel.refresh();

  transformEditor.controls.addEventListener("dragging-changed", (event) => {
    if ((event as { value?: boolean }).value) didDragTransform = true;
    controls.enabled =
      activeRenderCameraId === "main" && !(event as { value?: boolean }).value;
  });

  transformEditor.controls.addEventListener("mouseDown", () => {
    transformScrub?.discard();
    transformScrub = studio.scrub();
  });

  transformEditor.controls.addEventListener("objectChange", () => {
    const node = selection.getSelected();
    const binding = node ? theatreBindings.get(node.id) : null;
    if (!node || !binding) return;

    const scrub = transformScrub ?? studio.scrub();
    scrub.capture(({ set }) => {
      set(binding.theatreObject.props.position, {
        x: node.root.position.x,
        y: node.root.position.y,
        z: node.root.position.z,
      });
      set(binding.theatreObject.props.rotation, {
        x: node.root.rotation.x,
        y: node.root.rotation.y,
        z: node.root.rotation.z,
      });
      set(binding.theatreObject.props.scale, {
        x: node.root.scale.x,
        y: node.root.scale.y,
        z: node.root.scale.z,
      });
    });

    if (!transformScrub) scrub.commit();
  });

  transformEditor.controls.addEventListener("mouseUp", () => {
    transformScrub?.commit();
    transformScrub = null;
  });

  let nextObjectIndex = 0;
  const nameCounts = new Map<string, number>();

  function uniqueName(baseName: string) {
    const count = (nameCounts.get(baseName) ?? 0) + 1;
    nameCounts.set(baseName, count);
    return `${baseName} ${count}`;
  }

  function getTheatreObjectKey(node: SceneNode) {
    const sceneName = sceneBuilder.getSceneName().trim() || "Scene";
    return `${sceneName} / ${node.name}`;
  }

  function registerTheatreObject(node: SceneNode) {
    if (!theatreSheet) return;

    const source = node.metadata.source as NodeSource | undefined;
    if (source?.type === "ambient") return;

    const material = getFirstStandardMaterial(node.root);
    const props = {
      position: vectorProps(node.root.position, [-20, 20]),
      rotation: vectorProps(node.root.rotation, [-Math.PI * 2, Math.PI * 2]),
      scale: vectorProps(node.root.scale, [0.01, 20]),
      material: types.compound({
        color: types.rgba(
          material
            ? colorToRgba(material.color, material.opacity)
            : colorToRgba(new THREE.Color("#ffffff")),
        ),
      }),
      light: types.compound({
        intensity: numberProp(
          node.root instanceof THREE.Light ? node.root.intensity : 1,
          [0, 20],
        ),
        color: types.rgba(
          node.root instanceof THREE.Light
            ? colorToRgba(node.root.color)
            : colorToRgba(new THREE.Color("#ffffff")),
        ),
      }),
      camera: types.compound({
        fov: numberProp(
          node.root instanceof THREE.PerspectiveCamera ? node.root.fov : 50,
          [1, 140],
        ),
      }),
    };

    const objectKey = getTheatreObjectKey(node);
    const theatreObject = theatreSheet.object(objectKey, props, {
      reconfigure: true,
    });
    const unsubscribe = theatreObject.onValuesChange((values) => {
      node.root.position.set(
        values.position.x,
        values.position.y,
        values.position.z,
      );
      node.root.rotation.set(
        values.rotation.x,
        values.rotation.y,
        values.rotation.z,
      );
      node.root.scale.set(values.scale.x, values.scale.y, values.scale.z);

      if (material) {
        applyRgbaToColor(material.color, values.material.color);
        material.opacity = values.material.color.a;
        material.transparent = material.opacity < 1;
        material.needsUpdate = true;
      }

      if (node.root instanceof THREE.Light) {
        node.root.intensity = values.light.intensity;
        applyRgbaToColor(node.root.color, values.light.color);
      }

      if (node.root instanceof THREE.PerspectiveCamera) {
        node.root.fov = values.camera.fov;
        node.root.updateProjectionMatrix();
      }
    });

    theatreBindings.set(node.id, { objectKey, theatreObject, unsubscribe });
  }

  function registerTheatreMainCamera() {
    if (!theatreSheet) return;

    if (theatreMainCamera) {
      theatreMainCameraUnsubscribe?.();
      theatreSheet.detachObject(theatreMainCamera.address.objectKey);
    }

    theatreMainCamera = theatreSheet.object(
      `${sceneBuilder.getSceneName()} / Main View Camera`,
      {
        position: vectorProps(camera.position, [-100, 100]),
        rotation: vectorProps(camera.rotation, [-Math.PI * 2, Math.PI * 2]),
        camera: types.compound({
          fov: numberProp(camera.fov, [1, 140]),
        }),
      },
      { reconfigure: true },
    );

    theatreMainCameraUnsubscribe = theatreMainCamera.onValuesChange(
      (values) => {
        camera.position.set(
          values.position.x,
          values.position.y,
          values.position.z,
        );
        camera.rotation.set(
          values.rotation.x,
          values.rotation.y,
          values.rotation.z,
        );
        camera.fov = values.camera.fov;
        camera.updateProjectionMatrix();
      },
    );
  }

  function unregisterTheatreObject(node: SceneNode) {
    const binding = theatreBindings.get(node.id);
    if (!binding || !theatreSheet) return;

    binding.unsubscribe();
    theatreSheet.detachObject(binding.objectKey);
    theatreBindings.delete(node.id);
  }

  function registerObject(
    name: string,
    object: THREE.Object3D,
    source: NodeSource,
    select = true,
  ) {
    object.name = name;
    const node = createSceneNodeFromObject(name, object);
    node.metadata.source = source;
    registry.register(node);
    registerTheatreObject(node);
    transformEditor.refresh();
    hierarchyPanel.refresh();
    refreshProductionCameras();
    if (select) transformEditor.selectNode(node.id);
    return node;
  }

  function attachObject(
    name: string,
    object: THREE.Object3D,
    source: NodeSource,
  ) {
    scene.add(object);

    const node = registerObject(name, object, source);
    const helper = addObjectHelper(scene, object);

    if (helper) helpers.set(node.id, helper);
    return node;
  }

  function getSceneCameraNodes() {
    return registry
      .getAll()
      .filter(
        (node) =>
          (node.metadata.source as NodeSource)?.type !== "ambient" &&
          node.root instanceof THREE.PerspectiveCamera,
      );
  }

  function getCameraOptions(): CameraOption[] {
    return [
      { id: "main", label: "Main View" },
      ...getSceneCameraNodes().map((node) => ({
        id: node.id,
        label: node.name,
      })),
    ];
  }

  function getActiveRenderCamera() {
    if (activeRenderCameraId === "main") return camera;

    const node = registry.get(activeRenderCameraId);
    return node?.root instanceof THREE.PerspectiveCamera ? node.root : camera;
  }

  function refreshProductionCameras() {
    activeRenderCameraId = getCameraOptions().some(
      (option) => option.id === activeRenderCameraId,
    )
      ? activeRenderCameraId
      : "main";

    productionPanel?.refreshCameras(getCameraOptions(), activeRenderCameraId);
    refreshShotList();
  }

  function viewSelectedCamera(cameraId: string) {
    activeRenderCameraId = cameraId || "main";
    controls.enabled = activeRenderCameraId === "main";
    refreshProductionCameras();
    resize();
    sceneBuilder.setStatus(
      activeRenderCameraId === "main"
        ? "Viewing main camera"
        : "Viewing scene camera",
    );
  }

  function viewMainCamera() {
    viewSelectedCamera("main");
  }

  function getActiveRenderCameraLabel() {
    return (
      getCameraOptions().find((option) => option.id === activeRenderCameraId)
        ?.label ?? "Main View"
    );
  }

  function findSceneNodeByName(name?: string) {
    if (!name) return null;

    return (
      registry
        .getAll()
        .filter(
          (node) => (node.metadata.source as NodeSource)?.type !== "ambient",
        )
        .find((node) => node.name === name) ?? null
    );
  }

  function getCameraByName(name: string) {
    if (name === "Main View") return camera;

    const node = findSceneNodeByName(name);
    return node?.root instanceof THREE.PerspectiveCamera ? node.root : camera;
  }

  function getTheatreCameraByName(name: string) {
    if (name === "Main View") return theatreMainCamera;

    const node = findSceneNodeByName(name);
    return node ? (theatreBindings.get(node.id)?.theatreObject ?? null) : null;
  }

  function getCameraShotAnimations() {
    return getCameraShotAnimationsFromState(activeAnimations);
  }

  function getTimelineDuration() {
    return getTimelineDurationFromState({
      cameraShotCursor,
      activeAnimations,
    });
  }

  function getCameraShotTimelineItems(): TimelineDockItem[] {
    return getCameraShotTimelineItemsFromState({
      shots: getCameraShotAnimations(),
      activeShotId,
    });
  }

  function getObjectMotionTimelineItems(): TimelineDockItem[] {
    return getObjectMotionTimelineItemsFromState(activeAnimations);
  }

  function refreshShotList() {
    const shots = getCameraShotTimelineItems();
    productionPanel?.refreshShots(shots);
    timelineDock?.refresh(
      [...shots, ...getObjectMotionTimelineItems()].sort(
        (first, second) => first.start - second.start,
      ),
      getTimelineDuration(),
    );
    renderTheatreShotPane();
  }

  function renderTheatreShotPane() {
    if (!theatreShotPaneRoot) return;

    const shots = getCameraShotTimelineItems();
    theatreShotPaneRoot.innerHTML = `
      <div style="height:100%;box-sizing:border-box;padding:12px;color:#e2e8f0;background:#111722;font:12px Inter,system-ui,sans-serif;overflow:auto">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px">
          <strong>Dehlero Shot Director</strong>
          <button type="button" data-theatre-shot-play style="border:1px solid #475569;border-radius:4px;padding:5px 9px;color:white;background:#263449;cursor:pointer">Play shots</button>
        </div>
        <div data-theatre-shot-list style="display:grid;gap:6px"></div>
      </div>
    `;

    const list = theatreShotPaneRoot.querySelector<HTMLElement>(
      "[data-theatre-shot-list]",
    )!;

    if (shots.length === 0) {
      list.textContent = "No shots. Return to the Shots workspace to add one.";
    } else {
      shots.forEach((shot, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.theatreShotId = shot.id;
        button.style.cssText = [
          "display:grid",
          "gap:3px",
          "width:100%",
          "padding:8px",
          "border:1px solid #334155",
          "border-radius:4px",
          `background:${shot.active ? "#1e3a5f" : "#172033"}`,
          "color:white",
          "text-align:left",
          "cursor:pointer",
        ].join(";");
        button.innerHTML = `
          <strong>${index + 1}. ${shot.label}</strong>
          <span style="color:#94a3b8;font-size:11px">${shot.start}s - ${
            shot.start + shot.duration
          }s | ${shot.cameraLabel}</span>
        `;
        list.appendChild(button);
      });
    }

    theatreShotPaneRoot.querySelector<HTMLButtonElement>(
      "[data-theatre-shot-play]",
    )!.onclick = () => {
      rewindTimeline();
      timelinePlaying = true;
    };

    theatreShotPaneRoot
      .querySelectorAll<HTMLButtonElement>("[data-theatre-shot-id]")
      .forEach((button) => {
        button.onclick = () => {
          if (button.dataset.theatreShotId) {
            selectCameraShot(button.dataset.theatreShotId);
          }
        };
      });
  }

  function ensureTheatreShotPane() {
    if (theatreShotPaneCreated) return;
    studio.createPane("dehlero-shot-director");
    theatreShotPaneCreated = true;
  }

  function serializeTimeline(): SavedTimelineClip[] {
    return serializeTimelineData(activeAnimations);
  }

  function clearTimeline() {
    const nextState = clearTimelineState(activeAnimations);
    cameraShotCursor = nextState.cameraShotCursor;
    timelinePosition = nextState.timelinePosition;
    timelinePlaying = nextState.timelinePlaying;
    activeShotId = nextState.activeShotId;
    refreshShotList();
    timelineDock?.setPlayhead(0, 10);
  }

  function applyCameraShotOrder(shots: TimelineAnimation[]) {
    const nextState = applyCameraShotOrderData(shots);
    cameraShotCursor = nextState.cameraShotCursor;
    timelinePosition = nextState.timelinePosition;
    refreshShotList();
  }

  function rebuildCameraShotTiming() {
    applyCameraShotOrder(getCameraShotAnimations());
  }

  function removeCameraShot(shotId: string) {
    const index = activeAnimations.findIndex(
      (animation) => animation.id === shotId,
    );
    if (index < 0) return;

    activeAnimations.splice(index, 1);
    if (activeShotId === shotId) {
      activeShotId = getCameraShotAnimations()[0]?.id ?? null;
    }
    rebuildCameraShotTiming();
    sceneBuilder.setStatus("Camera shot removed");
  }

  function moveCameraShot(shotId: string, direction: -1 | 1) {
    const shots = getCameraShotAnimations();
    const index = shots.findIndex((animation) => animation.id === shotId);
    const targetIndex = index + direction;

    if (index < 0 || targetIndex < 0 || targetIndex >= shots.length) return;

    [shots[index], shots[targetIndex]] = [shots[targetIndex], shots[index]];
    applyCameraShotOrder(shots);
    sceneBuilder.setStatus("Camera shot order updated");
  }

  function selectCameraShot(shotId: string) {
    if (!getCameraShotAnimations().some((shot) => shot.id === shotId)) return;
    activeShotId = shotId;
    refreshShotList();
    sceneBuilder.setStatus("Shot selected");
  }

  function updateCameraShotDuration(shotId: string, duration: number) {
    const shot = getCameraShotAnimations().find(
      (animation) => animation.id === shotId,
    );
    if (!shot) return;

    shot.duration = Math.max(duration, 0.5);
    rebuildCameraShotTiming();
    sceneBuilder.setStatus("Shot duration updated");
  }

  function addShot(duration: number) {
    applyCameraShot("static", duration);
  }

  function addLibraryObject(item: LibraryItem) {
    const object = item.create();
    placeObject(object, nextObjectIndex);
    nextObjectIndex += 1;

    attachObject(uniqueName(item.label), object, {
      type: "library",
      libraryId: item.id,
    });
  }

  function addTimelineAnimation(
    animation: Omit<
      TimelineAnimation,
      "id" | "elapsed" | "started" | "finished"
    >,
  ) {
    const nextAnimation = createTimelineAnimation(animation);
    activeAnimations.push(nextAnimation);
    timelinePlaying = true;
    refreshShotList();
    return nextAnimation;
  }

  function applyObjectMotion(
    preset: MotionPreset,
    duration: number,
    options: {
      delay?: number;
      loop?: boolean;
      silent?: boolean;
      targetNode?: SceneNode | null;
    } = {},
  ) {
    const node = options.targetNode ?? selection.getSelected();

    if (!node) {
      sceneBuilder.setStatus("Select an object first");
      return;
    }

    addTimelineAnimation(
      createObjectMotionAnimation({
        node,
        preset,
        duration,
        delay:
          options.delay ??
          getCameraShotAnimations().find((shot) => shot.id === activeShotId)
            ?.delay ??
          0,
        loop: options.loop ?? (preset === "spin" || preset === "float"),
      }),
    );

    if (!options.silent) sceneBuilder.setStatus(`Motion added: ${preset}`);
  }

  function getShotTarget() {
    return getShotTargetFromSelection(selection.getSelected());
  }

  function applyCameraShot(
    shot: CameraShot,
    duration: number,
    options: {
      cameraName?: string;
      delay?: number;
      silent?: boolean;
      targetName?: string;
      orbitDegrees?: number;
      distanceMultiplier?: number;
    } = {},
  ) {
    const shotCamera = options.cameraName
      ? getCameraByName(options.cameraName)
      : getActiveRenderCamera();
    const selectedTarget = options.targetName
      ? findSceneNodeByName(options.targetName)
      : selection.getSelected();

    let runtime = createShotRuntimeState({
      shotCamera,
      selectedTarget,
      fallbackTarget: getShotTarget(),
    });

    const delay = options.delay ?? cameraShotCursor;
    cameraShotCursor = Math.max(cameraShotCursor, delay + duration);

    addTimelineAnimation({
      name: CAMERA_SHOT_LABELS[shot],
      kind: "camera-shot",
      metadata: {
        cameraLabel: options.cameraName ?? getActiveRenderCameraLabel(),
        shot,
        targetLabel: selectedTarget?.name ?? "Scene center",
      },
      delay,
      duration,
      loop: false,
      orbitDegrees: options.orbitDegrees,
      distanceMultiplier: options.distanceMultiplier,
      start() {
        runtime = createShotRuntimeState({
          shotCamera,
          selectedTarget,
          fallbackTarget: getShotTarget(),
        });
      },
      update(progress) {
        const { nextPosition, nextFov } = calculateCameraShotState({
          shot,
          progress,
          ...runtime,
        });

        shotCamera.fov = nextFov;
        shotCamera.updateProjectionMatrix();

        if (shotCamera === camera) {
          controls.setLookAt(
            nextPosition.x,
            nextPosition.y,
            nextPosition.z,
            runtime.center.x,
            runtime.center.y,
            runtime.center.z,
            false,
          );
          return;
        }

        shotCamera.position.copy(nextPosition);
        shotCamera.lookAt(runtime.center);
      },
    });

    const newestShot = getCameraShotAnimations()
      .slice()
      .sort((first, second) => second.delay - first.delay)[0];
    if (newestShot) activeShotId = newestShot.id;

    rebuildCameraShotTiming();
    if (!options.silent) {
      sceneBuilder.setStatus(`Queued camera shot: ${CAMERA_SHOT_LABELS[shot]}`);
    }
  }

  function playTimeline() {
    const cameraShots = getCameraShotAnimations();
    if (cameraShots.length > 0 && cameraShots.every((shot) => shot.finished)) {
      rewindTimeline();
    }

    timelinePlaying = true;
    sceneBuilder.setStatus("Timeline playing");
  }

  function rewindTimeline() {
    resetTimelineAnimations(activeAnimations);
    timelinePosition = 0;
    timelineDock?.setPlayhead(timelinePosition, getTimelineDuration());
    timelinePlaying = true;
  }

  function pauseTimeline() {
    timelinePlaying = false;
    sceneBuilder.setStatus("Timeline paused");
  }

  function stopTimeline() {
    clearTimeline();
    sceneBuilder.setStatus("Timeline stopped");
  }

  function playTheatreSequence() {
    if (!theatreSheet) {
      sceneBuilder.setStatus("Theatre is not ready");
      return;
    }

    timelinePlaying = false;
    theatreSheet.sequence.position = 0;
    controls.enabled = false;
    void theatreSheet.sequence.play().finally(() => {
      controls.enabled = activeRenderCameraId === "main";
    });
    sceneBuilder.setStatus("Theatre sequence playing");
  }

  function hasTheatreAnimation() {
    if (!theatreSheet) return false;
    const sheet = theatreSheet;

    const objects = [
      theatreMainCamera,
      ...Array.from(theatreBindings.values()).map(
        (binding) => binding.theatreObject,
      ),
    ].filter((object): object is ISheetObject<any> => Boolean(object));

    return objects.some((object) => {
      const candidatePointers = [
        object.props.position?.x,
        object.props.rotation?.x,
        object.props.scale?.x,
        object.props.material?.color,
        object.props.camera?.fov,
      ].filter(Boolean);

      return candidatePointers.some(
        (pointer) =>
          sheet.sequence.__experimental_getKeyframes(pointer).length > 0,
      );
    });
  }

  function restoreTheatreStudio() {
    try {
      workspaceController?.setMode("animate");
      timelinePlaying = false;
      studio.ui.hide();
      window.requestAnimationFrame(() => {
        studio.ui.restore();
        sceneBuilder.setStatus("Theatre opened without shot playback");
      });
    } catch (error) {
      console.error(error);
      sceneBuilder.setStatus("Theatre Studio failed to open");
    }
  }

  function restoreTheatreStudioWithShots() {
    bakeShotsToTheatre();
    restoreTheatreStudio();
    ensureTheatreShotPane();
    renderTheatreShotPane();
  }

  function bakeShotsToTheatre() {
    if (!theatreSheet) {
      sceneBuilder.setStatus("Theatre is not ready");
      return;
    }

    const clips = activeAnimations
      .filter(
        (animation) =>
          animation.kind === "camera-shot" ||
          animation.kind === "object-motion",
      )
      .slice()
      .sort((first, second) => first.delay - second.delay);

    if (clips.length === 0) {
      sceneBuilder.setStatus("Add shots or object motion before baking");
      return;
    }

    try {
      const cameraStates = new Map<
        string,
        { position: THREE.Vector3; fov: number }
      >();
      const objectStates = new Map<
        string,
        {
          position: THREE.Vector3;
          rotation: THREE.Euler;
          scale: THREE.Vector3;
          color: THREE.Color | null;
          opacity: number;
        }
      >();

      studio.transaction(({ set }) => {
        set(
          theatreSheet!.sequence.pointer.length,
          Math.max(getTimelineDuration(), 0.5),
        );
      });

      clips.forEach((clip) => {
        bakeCameraShotToTheatre({
          clip,
          theatreSheet: theatreSheet!,
          getCameraByName,
          getTheatreCameraByName,
          findSceneNodeByName,
          cameraStates,
        });

        bakeObjectMotionToTheatre({
          clip,
          theatreSheet: theatreSheet!,
          findSceneNodeByName,
          theatreBindings,
          objectStates,
        });
      });

      theatreSheet.sequence.position = 0;
      studio.setSelection([theatreSheet]);
      sceneBuilder.setStatus(
        `${clips.length} shot and motion clips baked to Theatre keyframes`,
      );
    } catch (error) {
      console.error(error);
      sceneBuilder.setStatus("Bake to Theatre failed");
    }
  }

  function restoreRecordingViewport() {
    if (!recording) return;

    window.clearTimeout(recording.stopTimer);
    theatreSheet?.sequence.pause();
    renderer.setPixelRatio(recording.restorePixelRatio);
    recording.restoreCamera.aspect = recording.restoreCameraAspect;
    recording.restoreCamera.updateProjectionMatrix();
    recording = null;
    resize();
  }

  function startRecording(
    aspect: RecordingAspect,
    seconds: number,
    fps: number,
  ) {
    if (recording) {
      productionPanel?.setStatus("Already recording");
      return;
    }

    if (!isRecordingSupported(renderer.domElement)) {
      productionPanel?.setStatus("Recording is not supported in this browser");
      return;
    }

    const size = getRecordingSize(aspect);
    const restorePixelRatio = renderer.getPixelRatio();
    const recordCamera = getActiveRenderCamera();
    const restoreCameraAspect = recordCamera.aspect;

    rewindTimeline();
    if (theatreSheet && hasTheatreAnimation()) {
      timelinePlaying = false;
      theatreSheet.sequence.position = 0;
      void theatreSheet.sequence.play();
    }
    renderer.setPixelRatio(1);
    renderer.setSize(size.width, size.height, false);
    recordCamera.aspect = size.width / size.height;
    recordCamera.updateProjectionMatrix();

    const stream = renderer.domElement.captureStream(fps);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    recorder.onstop = () => {
      createRecordingDownload({ chunks, mimeType, aspect });
      stream.getTracks().forEach((track) => track.stop());
      restoreRecordingViewport();
      productionPanel?.setStatus("Recording saved");
    };

    recording = {
      recorder,
      chunks,
      stopTimer: window.setTimeout(() => stopRecording(), seconds * 1000),
      restorePixelRatio,
      restoreCamera: recordCamera,
      restoreCameraAspect,
    };

    recorder.start();
    productionPanel?.setStatus(`Recording ${aspect} ${seconds}s`);
  }

  function stopRecording() {
    if (!recording) {
      productionPanel?.setStatus("Recorder ready");
      return;
    }

    if (recording.recorder.state !== "inactive") {
      recording.recorder.stop();
    }
  }

  function deleteNode(node: SceneNode) {
    const helper = helpers.get(node.id);
    unregisterTheatreObject(node);

    if (helper) {
      helper.removeFromParent();
      disposeObject(helper);
      helpers.delete(node.id);
    }

    node.root.removeFromParent();
    disposeObject(node.root);
    registry.unregister(node.id);

    if (activeRenderCameraId === node.id) {
      activeRenderCameraId = "main";
      controls.enabled = true;
    }

    refreshProductionCameras();
    hierarchyPanel.refresh();
  }

  function updateHelperVisibility(selectedNode: SceneNode | null) {
    helpers.forEach((helper, nodeId) => {
      helper.visible = selectedNode?.id === nodeId;
      helper.update();
    });

    if (!theatreSheet) return;

    const binding = selectedNode
      ? theatreBindings.get(selectedNode.id)
      : undefined;
    studio.setSelection(binding ? [binding.theatreObject] : [theatreSheet]);
  }

  attachPickingEvents({
    renderer,
    pointerDown,
    didDragTransform,
    setDidDragTransform(value) {
      didDragTransform = value;
    },
    selectNode(nodeId) {
      transformEditor.selectNode(nodeId);
    },
    clearSelection() {
      transformEditor.clearSelection();
    },
    deleteNode(nodeId) {
      const node = registry.get(nodeId);
      if (node) deleteNode(node);
    },
    pickNode(event) {
      return (
        pickNodeFromScene({
          event,
          renderer,
          camera: getActiveRenderCamera(),
          raycaster,
          pointer,
          nodes: registry.getAll(),
        }) ?? null
      );
    },
  });

  function clearEditableScene() {
    registry
      .getAll()
      .filter(
        (node) => (node.metadata.source as NodeSource)?.type !== "ambient",
      )
      .forEach((node) => {
        deleteNode(node);
        registry.unregister(node.id);
      });

    selection.clear();
    transformEditor.refresh();
    hierarchyPanel.refresh();
    clearTimeline();
  }

  function serializeScene(): SavedScene {
    return serializeSceneData({
      sceneName: sceneBuilder.getSceneName(),
      nodes: registry.getAll(),
      serializeTimeline,
    });
  }

  function saveScene() {
    const expectedMainCameraKey = `${sceneBuilder.getSceneName()} / Main View Camera`;
    if (theatreMainCamera?.address.objectKey !== expectedMainCameraKey) {
      registerTheatreMainCamera();
    }

    const savedScene = serializeScene();
    saveSceneToStorage(savedScene);
    sceneBuilder.refreshProjects(savedScene.name);
    sceneBuilder.setStatus(`Saved: ${savedScene.name}`);
  }

  function saveCurrentSceneSilently() {
    const expectedMainCameraKey = `${sceneBuilder.getSceneName()} / Main View Camera`;
    if (theatreMainCamera?.address.objectKey !== expectedMainCameraKey) {
      registerTheatreMainCamera();
    }

    saveCurrentSceneToStorage(serializeScene());
  }

  function restoreTimeline(timeline: SavedTimelineClip[] | undefined) {
    clearTimeline();

    if (!timeline || timeline.length === 0) return;

    timeline
      .slice()
      .sort((first, second) => first.start - second.start)
      .forEach((clip) => {
        if (clip.kind === "camera-shot") {
          applyCameraShot(clip.shot, clip.duration, {
            cameraName: clip.cameraName,
            delay: clip.start,
            silent: true,
            targetName: clip.targetName,
          });
          return;
        }

        const targetNode = findSceneNodeByName(clip.targetName);
        if (!targetNode) return;

        applyObjectMotion(clip.preset, clip.duration, {
          delay: clip.start,
          loop: clip.loop,
          silent: true,
          targetNode,
        });
      });

    timelinePlaying = false;
    rewindTimeline();
    timelinePlaying = false;
    refreshShotList();
  }

  async function loadSavedScene(savedScene: SavedScene) {
    clearEditableScene();
    sceneBuilder.setSceneName(savedScene.name);
    registerTheatreMainCamera();

    for (const savedObject of savedScene.objects) {
      await applySavedObjectToScene({
        savedObject,
        library,
        attachObject,
      });
    }

    transformEditor.refresh();
    hierarchyPanel.refresh();
    transformEditor.clearSelection();
    restoreTimeline(savedScene.timeline);
    sceneBuilder.setStatus(`Loaded: ${savedScene.name}`);
  }

  function loadScene() {
    const projectName = sceneBuilder.getSelectedProjectName();
    const savedScene = projectName ? getSavedProject(projectName) : null;

    if (!savedScene) {
      sceneBuilder.setStatus("No saved scene");
      return;
    }

    void loadSavedScene(savedScene).catch((error) => {
      console.error(error);
      sceneBuilder.setStatus("Load failed");
    });
  }

  function switchScene(projectName: string) {
    const currentName = sceneBuilder.getSceneName();
    if (projectName === currentName) return;

    saveCurrentSceneSilently();
    const savedScene = getSavedProject(projectName);

    if (!savedScene) {
      sceneBuilder.setStatus("Selected scene was not found");
      sceneBuilder.refreshProjects(currentName);
      return;
    }

    localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, projectName);
    void loadSavedScene(savedScene).catch((error) => {
      console.error(error);
      sceneBuilder.setStatus("Scene switch failed");
      sceneBuilder.refreshProjects(currentName);
    });
  }

  function newScene() {
    saveCurrentSceneSilently();
    clearEditableScene();
    const nextName = getNextUntitledSceneName();
    sceneBuilder.setSceneName(nextName);
    registerTheatreMainCamera();
    addDefaultProjectObjects();
    transformEditor.clearSelection();
    saveScene();
    sceneBuilder.setStatus("New scene");
  }

  async function importModel(file: File) {
    try {
      await importModelObject({
        file,
        nextObjectIndex,
        attachObject,
        uniqueName,
        setStatus: sceneBuilder.setStatus,
      });
      nextObjectIndex += 1;
    } catch (error) {
      console.error(error);
      sceneBuilder.setStatus("Import failed");
    }
  }

  async function applyTexture(file: File) {
    try {
      await applyTextureToSelectedObject({
        file,
        selected: selection.getSelected(),
        setStatus: sceneBuilder.setStatus,
      });
    } catch (error) {
      console.error(error);
      sceneBuilder.setStatus("Texture failed");
    }
  }

  async function createPlanetFromTexture(file: File) {
    try {
      await createTexturedPlanetObject({
        file,
        nextObjectIndex,
        attachObject,
        uniqueName,
        setStatus: sceneBuilder.setStatus,
      });
      nextObjectIndex += 1;
    } catch (error) {
      console.error(error);
      sceneBuilder.setStatus("Planet texture failed");
    }
  }

  function addDefaultProjectObjects() {
    ["Cube", "Sphere", "Plane", "Directional", "Point", "Camera"].forEach(
      (label) => {
        const item = library.find((candidate) => candidate.label === label);
        if (item) addLibraryObject(item);
      },
    );
  }

  const sceneBuilder = createSceneBuilderPanel({
    root,
    library,
    addLibraryObject,
    importModel,
    applyTexture,
    createPlanetFromTexture,
    saveScene,
    loadScene,
    switchScene,
    newScene,
  });

  productionPanel = createProductionPanel({
    root,
    addShot,
    applyObjectMotion,
    applyCameraShot,
    playTimeline,
    pauseTimeline,
    stopTimeline,
    playTheatreSequence,
    restoreTheatreStudio,
    restoreTheatreStudioWithShots,
    bakeShotsToTheatre,
    startRecording,
    stopRecording,
    viewSelectedCamera,
    viewMainCamera,
    removeCameraShot,
    moveCameraShot,
    selectCameraShot,
    updateCameraShotDuration,
  });

  timelineDock = createTimelineDock({
    root,
    playTimeline,
    pauseTimeline,
    stopTimeline,
    restoreTheatreStudio,
  });
  refreshShotList();

  workspaceController = createWorkspaceBar({
    root,
    onSave: saveScene,
    onModeChange(mode) {
      if (mode === "animate") {
        studio.ui.restore();
      } else {
        studio.ui.hide();
      }
      window.dispatchEvent(new Event("resize"));
    },
  });

  try {
    theatreSheet = getProject("Dehlero Motion").sheet("Scene");
    studio.extend(
      {
        id: "dehlero-shot-tools",
        panes: [
          {
            class: "dehlero-shot-director",
            mount({ node, paneId }) {
              mountedTheatreShotPaneIds.add(paneId);
              theatreShotPaneCreated = true;

              if (mountedTheatreShotPaneIds.size > 1) {
                window.requestAnimationFrame(() => {
                  cleanupDuplicateTheatreShotPanes();
                });
              }

              theatreShotPaneRoot = node;
              renderTheatreShotPane();
              return () => {
                mountedTheatreShotPaneIds.delete(paneId);
                if (theatreShotPaneRoot === node) theatreShotPaneRoot = null;
              };
            },
          },
        ],
      },
      { __experimental_reconfigure: true },
    );
    studio.setSelection([theatreSheet]);
    void studioInitialization.then(() => {
      studio.ui.hide();
      cleanupDuplicateTheatreShotPanes();
      sceneBuilder.setStatus("Theatre ready");
    });
  } catch (error) {
    console.error(error);
    theatreSheet = null;
    sceneBuilder.setStatus("Theatre failed to initialize");
  }

  migrateLegacySceneStorage();
  sceneBuilder.refreshProjects(
    localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) ?? undefined,
  );

  registerObject("Ambient Light", ambient, { type: "ambient" }, false);

  const activeProjectName = localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
  const activeScene = activeProjectName
    ? loadProjectByName(activeProjectName)
    : null;

  if (activeScene) {
    void loadSavedScene(activeScene).catch((error) => {
      console.error(error);
      sceneBuilder.setStatus("Auto-load failed");
      addDefaultProjectObjects();
    });
  } else {
    registerTheatreMainCamera();
    addDefaultProjectObjects();
    transformEditor.clearSelection();
  }

  function resize() {
    if (recording) return;

    const bounds = viewport.getBoundingClientRect();
    const width = Math.max(Math.floor(bounds.width), 1);
    const height = Math.max(Math.floor(bounds.height), 1);
    const renderCamera = getActiveRenderCamera();

    renderCamera.aspect = width / height;
    renderCamera.updateProjectionMatrix();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    if (timelinePlaying) {
      const timelineDuration = getTimelineDuration();
      timelinePosition =
        timelineDuration > 0
          ? Math.min(timelinePosition + delta, timelineDuration)
          : 0;

      updateTimelineAnimations({ activeAnimations, delta });
    }

    timelineDock?.setPlayhead(timelinePosition, getTimelineDuration() || 10);
    controls.update(delta);
    helpers.forEach((helper) => helper.update());
    renderer.render(scene, getActiveRenderCamera());
  }

  resize();
  window.addEventListener("resize", resize);
  animate();

  return {
    scene,
    camera,
    renderer,
    controls,
    registry,
  };
}
