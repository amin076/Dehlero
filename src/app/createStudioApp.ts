import * as THREE from "three";
import CameraControls from "camera-controls";
import { getProject, types } from "@theatre/core";
import type { ISheet, ISheetObject } from "@theatre/core";
import studioModule from "@theatre/studio";
import type { IScrub, IStudio } from "@theatre/studio";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

import type { SceneNode } from "../core/scene/SceneNode";
import { createSceneNodeFromObject } from "../core/scene/SceneNode";
import { SceneRegistry } from "../core/scene/SceneRegistry";
import { SelectionManager } from "../editor/SelectionManager";
import { createTransformEditor } from "../editor/TransformEditor";
import { createSaturnRings } from "../assets/astronomy/createSaturnRings";
import { createStudioCamera } from "../engine/camera/createStudioCamera";
import { createRenderer } from "../engine/renderer/createRenderer";
import { createScene } from "../engine/scene/createScene";

CameraControls.install({ THREE });

// Theatre Studio 0.7 ships a CommonJS bundle whose runtime default export can
// be nested once when Vite serves it without dependency pre-bundling.
const studio = (
  (studioModule as unknown as { default?: IStudio }).default ?? studioModule
) as IStudio;

const studioInitialization = Promise.resolve(
  studio.initialize({
    persistenceKey: "dehlero-theatre-studio-v2",
  }) as unknown as void | Promise<void>,
);
studio.ui.restore();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/gltf/");
dracoLoader.setDecoderConfig({ type: "wasm" });

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

const objLoader = new OBJLoader();

type LibraryCategory = "3D" | "2D" | "Lights" | "Camera" | "Planets";

type LibraryItem = {
  id: string;
  label: string;
  category: LibraryCategory;
  create: () => THREE.Object3D;
};

type UpdatableHelper = {
  update: () => void;
};

type SceneHelper = THREE.Object3D & UpdatableHelper;

type NodeSource =
  | { type: "library"; libraryId: string }
  | { type: "model"; assetKey: string; fileName: string }
  | { type: "textured-planet"; assetKey: string; fileName: string }
  | { type: "ambient" };

type SavedObject = {
  name: string;
  source: NodeSource;
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
  texture?: {
    assetKey: string;
    fileName: string;
  };
};

type SavedScene = {
  version: 1 | 2;
  name: string;
  objects: SavedObject[];
  timeline?: SavedTimelineClip[];
};

type MotionPreset = "spin" | "pulse" | "float" | "color-shift";
type CameraShot = "static" | "orbit" | "dolly-in" | "close-up" | "dolly-zoom";
type RecordingAspect = "16:9" | "9:16";
type WorkspaceMode = "scene" | "shots" | "animate" | "record";

type SavedTimelineClip =
  | {
      kind: "camera-shot";
      shot: CameraShot;
      start: number;
      duration: number;
      cameraName: string;
      targetName?: string;
    }
  | {
      kind: "object-motion";
      preset: MotionPreset;
      start: number;
      duration: number;
      targetName: string;
      loop: boolean;
    };

type CameraOption = {
  id: string;
  label: string;
};

type ShotListItem = {
  id: string;
  label: string;
  cameraLabel: string;
  targetLabel: string;
  duration: number;
  active?: boolean;
};

type TimelineDockItem = ShotListItem & {
  start: number;
  kind: "camera-shot" | "object-motion";
};

type TimelineAnimation = {
  id: string;
  name: string;
  kind?: "object-motion" | "camera-shot";
  metadata?: {
    cameraLabel?: string;
    preset?: MotionPreset;
    shot?: CameraShot;
    targetLabel?: string;
  };
  elapsed: number;
  delay: number;
  duration: number;
  loop: boolean;
  started: boolean;
  finished: boolean;
  start?: () => void;
  update: (progress: number, delta: number) => void;
  complete?: () => void;
};

type TheatreBinding = {
  objectKey: string;
  theatreObject: ISheetObject<any>;
  unsubscribe: () => void;
};

type TheatrePrimitivePath = Array<string | number>;

type TheatreInternalStudio = {
  transaction: (callback: (api: {
    stateEditors: {
      coreByProject: {
        historic: {
          sheetsById: {
            sequence: {
              setPrimitivePropAsSequenced: (
                address: Record<string, unknown> & {
                  pathToProp: TheatrePrimitivePath;
                },
                propConfig?: unknown,
              ) => void;
            };
          };
        };
      };
    };
  }) => void) => void;
};

const CAMERA_SHOT_LABELS: Record<CameraShot, string> = {
  static: "Static Shot",
  orbit: "Orbit",
  "dolly-in": "Dolly",
  "close-up": "Close Up",
  "dolly-zoom": "Dolly Zoom",
};

const SCENE_STORAGE_KEY = "dehlero.scene.v1";
const PROJECT_INDEX_STORAGE_KEY = "dehlero.projects.v1";
const ACTIVE_PROJECT_STORAGE_KEY = "dehlero.activeProject.v1";
const ASSET_DB_NAME = "dehlero-assets";
const ASSET_STORE_NAME = "assets";

function createDefaultMaterial(color: THREE.ColorRepresentation) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.58,
    metalness: 0.04,
  });
}

function setObjectShadows(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function normalizeImportedObject(object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();

  box.getCenter(center);
  box.getSize(size);

  const maxSize = Math.max(size.x, size.y, size.z);

  if (maxSize > 0) {
    const wrapper = new THREE.Group();
    wrapper.add(object);
    object.position.sub(center);
    wrapper.scale.setScalar(2.4 / maxSize);
    setObjectShadows(wrapper);
    return wrapper;
  }

  setObjectShadows(object);
  return object;
}

function createPlanet(texture?: THREE.Texture) {
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: texture ? "#ffffff" : "#8eb7ff",
    roughness: 1,
    metalness: 0,
  });

  const planet = new THREE.Mesh(new THREE.SphereGeometry(1.1, 96, 48), material);
  planet.name = "Planet";
  planet.castShadow = true;
  planet.receiveShadow = true;
  return planet;
}

function createLabelSprite(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 192;

  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(18, 24, 38, 0.88)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(255, 255, 255, 0.72)";
  context.lineWidth = 8;
  context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  context.fillStyle = "#ffffff";
  context.font = "700 58px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }),
  );

  sprite.scale.set(3.2, 1.2, 1);
  sprite.position.set(0, 1.8, 0);
  return sprite;
}

function createLibrary(): LibraryItem[] {
  return [
    {
      id: "cube",
      label: "Cube",
      category: "3D",
      create: () =>
        new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 1.4, 1.4),
          createDefaultMaterial("#6ea8fe"),
        ),
    },
    {
      id: "sphere",
      label: "Sphere",
      category: "3D",
      create: () =>
        new THREE.Mesh(
          new THREE.SphereGeometry(0.85, 48, 24),
          createDefaultMaterial("#91d36e"),
        ),
    },
    {
      id: "cylinder",
      label: "Cylinder",
      category: "3D",
      create: () =>
        new THREE.Mesh(
          new THREE.CylinderGeometry(0.65, 0.65, 1.7, 48),
          createDefaultMaterial("#f4b860"),
        ),
    },
    {
      id: "plane",
      label: "Plane",
      category: "2D",
      create: () => {
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(2.4, 1.5),
          new THREE.MeshStandardMaterial({
            color: "#f7f3e8",
            roughness: 0.75,
            side: THREE.DoubleSide,
          }),
        );
        plane.rotation.x = -Math.PI / 2;
        return plane;
      },
    },
    {
      id: "circle",
      label: "Circle",
      category: "2D",
      create: () => {
        const circle = new THREE.Mesh(
          new THREE.CircleGeometry(0.9, 64),
          new THREE.MeshStandardMaterial({
            color: "#ff7aa2",
            roughness: 0.72,
            side: THREE.DoubleSide,
          }),
        );
        circle.rotation.x = -Math.PI / 2;
        return circle;
      },
    },
    {
      id: "label",
      label: "Text Card",
      category: "2D",
      create: () => createLabelSprite("Title"),
    },
    {
      id: "planet",
      label: "Planet",
      category: "Planets",
      create: () => createPlanet(),
    },
    {
      id: "saturn-rings",
      label: "Saturn Rings",
      category: "Planets",
      create: () => {
        const rings = createSaturnRings(1.1);
        rings.rotation.x = Math.PI * 0.62;
        rings.rotation.z = Math.PI * 0.08;
        return rings;
      },
    },
    {
      id: "directional-light",
      label: "Directional",
      category: "Lights",
      create: () => {
        const light = new THREE.DirectionalLight("#ffffff", 3);
        light.position.set(3, 5, 2);
        return light;
      },
    },
    {
      id: "point-light",
      label: "Point",
      category: "Lights",
      create: () => {
        const light = new THREE.PointLight("#ffd08a", 18, 12);
        light.position.set(0, 3, 2);
        return light;
      },
    },
    {
      id: "production-camera",
      label: "Camera",
      category: "Camera",
      create: () => {
        const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 1000);
        camera.position.set(0, 2.2, 7);
        camera.lookAt(0, 0.75, 0);
        return camera;
      },
    },
  ];
}

function placeObject(object: THREE.Object3D, index: number) {
  const column = index % 4;
  const row = Math.floor(index / 4);
  object.position.x += (column - 1.5) * 2.6;
  object.position.z += row * 2.2;
}

function addObjectHelper(
  scene: THREE.Scene,
  object: THREE.Object3D,
): SceneHelper | null {
  if (object instanceof THREE.DirectionalLight) {
    const helper = new THREE.DirectionalLightHelper(object, 0.8);
    helper.visible = false;
    scene.add(helper);
    return helper;
  }

  if (object instanceof THREE.PointLight) {
    const helper = new THREE.PointLightHelper(object, 0.45);
    helper.visible = false;
    scene.add(helper);
    return helper;
  }

  if (object instanceof THREE.PerspectiveCamera) {
    const helper = new THREE.CameraHelper(object);
    helper.visible = false;
    scene.add(helper);
    return helper;
  }

  return null;
}

async function loadModelFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const url = URL.createObjectURL(file);

  try {
    if (extension === "glb" || extension === "gltf") {
      const gltf = await gltfLoader.loadAsync(url);
      return gltf.scene;
    }

    if (extension === "obj") {
      return await objLoader.loadAsync(url);
    }

    throw new Error(`Unsupported model format: ${extension ?? "unknown"}`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadTextureFile(file: File) {
  const url = URL.createObjectURL(file);
  const texture = new THREE.TextureLoader().load(url, () => {
    URL.revokeObjectURL(url);
  });

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function applyTextureToObject(object: THREE.Object3D, texture: THREE.Texture) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    child.material = materials.map((material) => {
      const nextMaterial =
        material instanceof THREE.MeshStandardMaterial
          ? material.clone()
          : new THREE.MeshStandardMaterial();

      nextMaterial.map = texture;
      nextMaterial.color.set("#ffffff");
      nextMaterial.needsUpdate = true;
      return nextMaterial;
    });
  });
}

function openAssetDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(ASSET_DB_NAME, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(ASSET_STORE_NAME);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveAssetBlob(key: string, blob: Blob) {
  const db = await openAssetDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(ASSET_STORE_NAME, "readwrite");
    transaction.objectStore(ASSET_STORE_NAME).put(blob, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  db.close();
}

async function loadAssetBlob(key: string) {
  const db = await openAssetDatabase();

  const blob = await new Promise<Blob>((resolve, reject) => {
    const transaction = db.transaction(ASSET_STORE_NAME, "readonly");
    const request = transaction.objectStore(ASSET_STORE_NAME).get(key);

    request.onsuccess = () => {
      const result = request.result;
      if (result instanceof Blob) resolve(result);
      else reject(new Error(`Missing asset: ${key}`));
    };

    request.onerror = () => reject(request.error);
  });

  db.close();
  return blob;
}

function createAssetKey(file: File) {
  return `${Date.now()}-${crypto.randomUUID()}-${file.name}`;
}

function createProjectStorageKey(name: string) {
  return `${SCENE_STORAGE_KEY}:${encodeURIComponent(name)}`;
}

function getProjectNames() {
  const rawNames = localStorage.getItem(PROJECT_INDEX_STORAGE_KEY);
  if (!rawNames) return [];

  try {
    const names = JSON.parse(rawNames);
    if (Array.isArray(names)) {
      return names.filter((name): name is string => typeof name === "string");
    }
  } catch {
    return [];
  }

  return [];
}

function setProjectNames(names: string[]) {
  localStorage.setItem(
    PROJECT_INDEX_STORAGE_KEY,
    JSON.stringify([...new Set(names)].sort((a, b) => a.localeCompare(b))),
  );
}

function addProjectName(name: string) {
  setProjectNames([...getProjectNames(), name]);
}

function loadProjectByName(name: string) {
  const rawScene = localStorage.getItem(createProjectStorageKey(name));
  return rawScene ? (JSON.parse(rawScene) as SavedScene) : null;
}

function migrateLegacySceneStorage() {
  const legacyScene = localStorage.getItem(SCENE_STORAGE_KEY);
  if (!legacyScene) return;

  try {
    const savedScene = JSON.parse(legacyScene) as SavedScene;
    const name = savedScene.name || "Untitled Scene";

    if (!localStorage.getItem(createProjectStorageKey(name))) {
      localStorage.setItem(createProjectStorageKey(name), legacyScene);
      addProjectName(name);
      localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, name);
    }

    localStorage.removeItem(SCENE_STORAGE_KEY);
  } catch {
    localStorage.removeItem(SCENE_STORAGE_KEY);
  }
}

function loadTextureFromBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const texture = new THREE.TextureLoader().load(url, () => {
    URL.revokeObjectURL(url);
  });

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function serializeTransform(object: THREE.Object3D): SavedObject["transform"] {
  return {
    position: [object.position.x, object.position.y, object.position.z],
    rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
    scale: [object.scale.x, object.scale.y, object.scale.z],
  };
}

function applySavedTransform(
  object: THREE.Object3D,
  transform: SavedObject["transform"],
) {
  object.position.fromArray(transform.position);
  object.rotation.set(
    transform.rotation[0],
    transform.rotation[1],
    transform.rotation[2],
  );
  object.scale.fromArray(transform.scale);
}

function disposeMaterial(material: THREE.Material) {
  Object.values(material).forEach((value) => {
    if (value instanceof THREE.Texture) value.dispose();
  });

  material.dispose();
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    child.geometry.dispose();

    if (Array.isArray(child.material)) {
      child.material.forEach(disposeMaterial);
      return;
    }

    disposeMaterial(child.material);
  });
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function getObjectCenter(object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();

  if (!box.isEmpty()) {
    box.getCenter(center);
    return center;
  }

  return object.getWorldPosition(center);
}

function getObjectRadius(object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  return Math.max(size.length() * 0.5, 1);
}

function getFirstStandardMaterial(object: THREE.Object3D): THREE.MeshStandardMaterial | null {
  let material: THREE.MeshStandardMaterial | null = null;

  object.traverse((child) => {
    if (material || !(child instanceof THREE.Mesh)) return;

    const candidate = Array.isArray(child.material)
      ? child.material[0]
      : child.material;

    if (candidate instanceof THREE.MeshStandardMaterial) {
      material = candidate;
    }
  });

  return material;
}

function colorToRgba(color: THREE.Color, alpha = 1) {
  return {
    r: color.r,
    g: color.g,
    b: color.b,
    a: alpha,
  };
}

function applyRgbaToColor(
  color: THREE.Color,
  rgba: { r: number; g: number; b: number; a?: number },
) {
  color.setRGB(
    THREE.MathUtils.clamp(rgba.r, 0, 1),
    THREE.MathUtils.clamp(rgba.g, 0, 1),
    THREE.MathUtils.clamp(rgba.b, 0, 1),
  );
}

function numberProp(value: number, range: [number, number]) {
  return types.number(value, { range });
}

function vectorProps(vector: THREE.Vector3 | THREE.Euler, range: [number, number]) {
  return types.compound({
    x: numberProp(vector.x, range),
    y: numberProp(vector.y, range),
    z: numberProp(vector.z, range),
  });
}

function getTheatreInternalStudio(): TheatreInternalStudio | null {
  const bundle = (
    window as Window & {
      __TheatreJS_StudioBundle?: { _studio?: TheatreInternalStudio };
    }
  ).__TheatreJS_StudioBundle;
  const internalStudio = bundle?._studio;
  return internalStudio && typeof internalStudio.transaction === "function"
    ? internalStudio
    : null;
}

function sequenceTheatrePrimitiveProps(
  theatreObject: ISheetObject<any>,
  paths: TheatrePrimitivePath[],
) {
  const internalStudio = getTheatreInternalStudio();
  if (!internalStudio) {
    throw new Error("Theatre sequencing API is unavailable");
  }

  internalStudio.transaction(({ stateEditors }) => {
    paths.forEach((pathToProp) => {
      stateEditors.coreByProject.historic.sheetsById.sequence.setPrimitivePropAsSequenced(
        {
          ...theatreObject.address,
          pathToProp,
        },
      );
    });
  });
}

function cleanupDuplicateTheatreShotPanes() {
  const bundle = (
    window as Window & {
      __TheatreJS_StudioBundle?: {
        _studio?: {
          paneManager?: {
            _getAllPanes?: () => {
              getValue: () => Record<
                string,
                {
                  instanceId: string;
                  definition?: { class?: string };
                }
              >;
            };
            destroyPane?: (pane: { instanceId: string }) => void;
          };
        };
      };
    }
  ).__TheatreJS_StudioBundle;
  const panePrism = bundle?._studio?.paneManager?._getAllPanes?.();
  const panes = panePrism ? Object.values(panePrism.getValue()) : [];
  const shotPanes = panes.filter(
    (pane) => pane.definition?.class === "dehlero-shot-director",
  );

  shotPanes.slice(1).forEach((pane) => {
    bundle?._studio?.paneManager?.destroyPane?.(pane);
  });
}

function createWorkspaceBar({
  root,
  onModeChange,
  onSave,
}: {
  root: HTMLElement;
  onModeChange: (mode: WorkspaceMode) => void;
  onSave: () => void;
}) {
  const bar = document.createElement("header");
  bar.className = "workspace-bar";
  bar.innerHTML = `
    <div class="workspace-brand">
      <strong>Dehlero Studio</strong>
      <span>Scene and motion editor</span>
    </div>
    <nav class="workspace-tabs" aria-label="Workspace">
      <button type="button" data-workspace="scene">Scene</button>
      <button type="button" data-workspace="shots">Shots</button>
      <button type="button" data-workspace="animate">Animate</button>
      <button type="button" data-workspace="record">Record</button>
    </nav>
    <div class="workspace-actions">
      <button type="button" data-panel-toggle="assets">Assets</button>
      <button type="button" data-panel-toggle="inspector">Inspector</button>
      <button type="button" data-action="save">Save</button>
    </div>
  `;

  let activeMode: WorkspaceMode = "scene";

  function setMode(mode: WorkspaceMode) {
    activeMode = mode;
    root.dataset.workspace = mode;
    bar.querySelectorAll<HTMLButtonElement>("[data-workspace]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.workspace === mode);
    });
    onModeChange(mode);
  }

  bar.querySelectorAll<HTMLButtonElement>("[data-workspace]").forEach((button) => {
    button.onclick = () => setMode(button.dataset.workspace as WorkspaceMode);
  });

  bar.querySelector<HTMLButtonElement>('[data-action="save"]')!.onclick = onSave;

  bar.querySelectorAll<HTMLButtonElement>("[data-panel-toggle]").forEach((button) => {
    button.onclick = () => {
      const key = button.dataset.panelToggle;
      if (!key) return;

      const attribute = key === "assets" ? "assetsOpen" : "inspectorOpen";
      const nextValue = root.dataset[attribute] !== "true";
      root.dataset[attribute] = String(nextValue);
      button.classList.toggle("is-active", nextValue);
      window.dispatchEvent(new Event("resize"));
    };
  });

  root.appendChild(bar);
  setMode(activeMode);

  return { setMode };
}

function createSceneBuilderPanel({
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
}: {
  root: HTMLElement;
  library: LibraryItem[];
  addLibraryObject: (item: LibraryItem) => void;
  importModel: (file: File) => void;
  applyTexture: (file: File) => void;
  createPlanetFromTexture: (file: File) => void;
  saveScene: () => void;
  loadScene: () => void;
  switchScene: (name: string) => void;
  newScene: () => void;
}) {
  const panel = document.createElement("aside");
  panel.className = "asset-library-panel";

  const categories: LibraryCategory[] = ["3D", "2D", "Planets", "Lights", "Camera"];

  panel.innerHTML = `
    <div class="panel-title">Scene Builder</div>
    <div class="project-panel">
      <label>
        Scene Name
        <input id="scene-name" type="text" value="Untitled Scene" />
      </label>
      <label>
        Saved Projects
        <select id="project-select"></select>
      </label>
      <div class="project-buttons">
        <button id="save-scene" type="button">Save Scene</button>
        <button id="load-scene" type="button">Open</button>
        <button id="new-scene" type="button">New</button>
      </div>
    </div>
    <div class="asset-library-groups"></div>
    <div class="asset-import-panel">
      <button id="import-model" type="button">Import Model</button>
      <button id="apply-texture" type="button">Apply Texture</button>
      <button id="planet-texture" type="button">Planet From Texture</button>
      <div id="asset-status" class="asset-status">Ready</div>
    </div>
  `;

  const groups = panel.querySelector<HTMLDivElement>(".asset-library-groups")!;
  const status = panel.querySelector<HTMLDivElement>("#asset-status")!;
  const sceneNameInput = panel.querySelector<HTMLInputElement>("#scene-name")!;
  const projectSelect = panel.querySelector<HTMLSelectElement>("#project-select")!;

  function refreshProjectOptions(selectedName?: string) {
    const names = getProjectNames();
    projectSelect.innerHTML = "";

    if (names.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No saved projects";
      projectSelect.appendChild(option);
      return;
    }

    names.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      projectSelect.appendChild(option);
    });

    if (selectedName && names.includes(selectedName)) {
      projectSelect.value = selectedName;
    }
  }

  categories.forEach((category) => {
    const section = document.createElement("section");
    section.className = "asset-library-group";

    const heading = document.createElement("h3");
    heading.textContent = category;
    section.appendChild(heading);

    const buttons = document.createElement("div");
    buttons.className = "asset-library-buttons";

    library
      .filter((item) => item.category === category)
      .forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `asset-button asset-button-${item.id}`;
        button.title = item.label;
        button.setAttribute("aria-label", item.label);
        button.innerHTML = `
          <span class="asset-button-icon" aria-hidden="true"></span>
          <span class="asset-button-label">${item.label}</span>
        `;
        button.onclick = () => addLibraryObject(item);
        buttons.appendChild(button);
      });

    section.appendChild(buttons);
    groups.appendChild(section);
  });

  const modelInput = document.createElement("input");
  modelInput.type = "file";
  modelInput.accept = ".glb,.gltf,.obj,model/gltf-binary,model/gltf+json";
  modelInput.hidden = true;

  const textureInput = document.createElement("input");
  textureInput.type = "file";
  textureInput.accept = "image/*";
  textureInput.hidden = true;

  const planetTextureInput = document.createElement("input");
  planetTextureInput.type = "file";
  planetTextureInput.accept = "image/*";
  planetTextureInput.hidden = true;

  modelInput.onchange = () => {
    const file = modelInput.files?.[0];
    if (!file) return;

    status.textContent = `Importing ${file.name}`;
    importModel(file);
    modelInput.value = "";
  };

  textureInput.onchange = () => {
    const file = textureInput.files?.[0];
    if (!file) return;

    applyTexture(file);
    textureInput.value = "";
  };

  planetTextureInput.onchange = () => {
    const file = planetTextureInput.files?.[0];
    if (!file) return;

    createPlanetFromTexture(file);
    planetTextureInput.value = "";
  };

  panel.querySelector<HTMLButtonElement>("#import-model")!.onclick = () => {
    modelInput.click();
  };

  panel.querySelector<HTMLButtonElement>("#apply-texture")!.onclick = () => {
    textureInput.click();
  };

  panel.querySelector<HTMLButtonElement>("#planet-texture")!.onclick = () => {
    planetTextureInput.click();
  };

  panel.querySelector<HTMLButtonElement>("#save-scene")!.onclick = saveScene;
  panel.querySelector<HTMLButtonElement>("#load-scene")!.onclick = loadScene;
  panel.querySelector<HTMLButtonElement>("#new-scene")!.onclick = newScene;

  projectSelect.onchange = () => {
    if (projectSelect.value) switchScene(projectSelect.value);
  };

  panel.append(modelInput, textureInput, planetTextureInput);

  root.appendChild(panel);
  return {
    panel,
    setStatus(message: string) {
      status.textContent = message;
    },
    getSceneName() {
      return sceneNameInput.value.trim() || "Untitled Scene";
    },
    setSceneName(name: string) {
      sceneNameInput.value = name;
      refreshProjectOptions(name);
    },
    getSelectedProjectName() {
      return projectSelect.value || sceneNameInput.value.trim();
    },
    refreshProjects(selectedName?: string) {
      refreshProjectOptions(selectedName);
    },
  };
}

function createProductionPanel({
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
}: {
  root: HTMLElement;
  addShot: (duration: number) => void;
  applyObjectMotion: (preset: MotionPreset, duration: number) => void;
  applyCameraShot: (shot: CameraShot, duration: number) => void;
  playTimeline: () => void;
  pauseTimeline: () => void;
  stopTimeline: () => void;
  playTheatreSequence: () => void;
  restoreTheatreStudio: () => void;
  restoreTheatreStudioWithShots: () => void;
  bakeShotsToTheatre: () => void;
  startRecording: (aspect: RecordingAspect, seconds: number, fps: number) => void;
  stopRecording: () => void;
  viewSelectedCamera: (cameraId: string) => void;
  viewMainCamera: () => void;
  removeCameraShot: (shotId: string) => void;
  moveCameraShot: (shotId: string, direction: -1 | 1) => void;
  selectCameraShot: (shotId: string) => void;
  updateCameraShotDuration: (shotId: string, duration: number) => void;
}) {
  const panel = document.createElement("aside");
  panel.className = "production-panel";
  panel.innerHTML = `
    <div class="panel-title">Motion & Recording</div>
    <div class="production-section production-section-primary" data-tool-section="playback">
      <div class="production-section-title">Playback</div>
      <div class="production-grid three">
        <button id="timeline-play" type="button">Play</button>
        <button id="timeline-pause" type="button">Pause</button>
        <button id="timeline-stop" type="button">Stop</button>
      </div>
      <div class="production-grid three">
        <button id="theatre-play" type="button">Theatre</button>
        <button id="theatre-open" type="button">Blank Theatre</button>
        <button id="theatre-shots" type="button">Theatre + Shots</button>
      </div>
      <button id="theatre-bake" type="button">Bake Shots to Theatre Keyframes</button>
    </div>
    <label data-tool-section="shots">
      Duration
      <input id="motion-duration" type="number" min="0.5" step="0.5" value="4" />
    </label>
    <div class="production-section" data-tool-section="shots">
      <div class="production-section-title">Object Motion</div>
      <div class="production-grid">
        <button type="button" data-motion="spin">Spin</button>
        <button type="button" data-motion="pulse">Pulse</button>
        <button type="button" data-motion="float">Float</button>
        <button type="button" data-motion="color-shift">Color</button>
      </div>
    </div>
    <div class="production-section" data-tool-section="shots">
      <div class="production-section-heading">
        <div class="production-section-title">Shot Director</div>
        <button id="add-shot" class="compact-button" type="button">Add Shot</button>
      </div>
      <div class="production-grid">
        <button type="button" data-shot="orbit">Orbit</button>
        <button type="button" data-shot="dolly-in">Dolly</button>
        <button type="button" data-shot="close-up">Close Up</button>
        <button type="button" data-shot="dolly-zoom">Dolly Zoom</button>
      </div>
      <div id="shot-list" class="shot-list"></div>
    </div>
    <div class="production-section" data-tool-section="camera">
      <div class="production-section-title">Render Camera</div>
      <label>
        Camera
        <select id="render-camera"></select>
      </label>
      <div class="production-grid two">
        <button id="view-camera" type="button">View Camera</button>
        <button id="view-main-camera" type="button">Main View</button>
      </div>
    </div>
    <div class="production-section" data-tool-section="record">
      <div class="production-section-title">Record Video</div>
      <div class="recording-options">
        <label>
          Aspect
          <select id="record-aspect">
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
          </select>
        </label>
        <label>
          Seconds
          <input id="record-seconds" type="number" min="1" step="1" value="8" />
        </label>
        <label>
          FPS
          <input id="record-fps" type="number" min="12" max="60" step="1" value="30" />
        </label>
      </div>
      <div class="production-grid two">
        <button id="record-start" type="button">Start</button>
        <button id="record-stop" type="button">Stop</button>
      </div>
      <div id="record-status" class="asset-status">Recorder ready</div>
    </div>
  `;

  const durationInput = panel.querySelector<HTMLInputElement>("#motion-duration")!;
  const aspectInput = panel.querySelector<HTMLSelectElement>("#record-aspect")!;
  const secondsInput = panel.querySelector<HTMLInputElement>("#record-seconds")!;
  const fpsInput = panel.querySelector<HTMLInputElement>("#record-fps")!;
  const renderCameraInput = panel.querySelector<HTMLSelectElement>("#render-camera")!;
  const shotList = panel.querySelector<HTMLDivElement>("#shot-list")!;
  const status = panel.querySelector<HTMLDivElement>("#record-status")!;

  const getDuration = () => Math.max(Number(durationInput.value) || 4, 0.5);

  panel.querySelectorAll<HTMLButtonElement>("[data-motion]").forEach((button) => {
    button.onclick = () => {
      applyObjectMotion(button.dataset.motion as MotionPreset, getDuration());
    };
  });

  panel.querySelectorAll<HTMLButtonElement>("[data-shot]").forEach((button) => {
    button.onclick = () => {
      viewSelectedCamera(renderCameraInput.value);
      applyCameraShot(button.dataset.shot as CameraShot, getDuration());
    };
  });

  panel.querySelector<HTMLButtonElement>("#timeline-play")!.onclick = playTimeline;
  panel.querySelector<HTMLButtonElement>("#timeline-pause")!.onclick = pauseTimeline;
  panel.querySelector<HTMLButtonElement>("#timeline-stop")!.onclick = stopTimeline;
  panel.querySelector<HTMLButtonElement>("#theatre-play")!.onclick = playTheatreSequence;
  panel.querySelector<HTMLButtonElement>("#theatre-open")!.onclick = restoreTheatreStudio;
  panel.querySelector<HTMLButtonElement>("#theatre-shots")!.onclick =
    restoreTheatreStudioWithShots;
  panel.querySelector<HTMLButtonElement>("#theatre-bake")!.onclick =
    bakeShotsToTheatre;
  panel.querySelector<HTMLButtonElement>("#add-shot")!.onclick = () => {
    addShot(getDuration());
  };
  panel.querySelector<HTMLButtonElement>("#view-camera")!.onclick = () => {
    viewSelectedCamera(renderCameraInput.value);
  };
  panel.querySelector<HTMLButtonElement>("#view-main-camera")!.onclick = () => {
    renderCameraInput.value = "main";
    viewMainCamera();
  };
  panel.querySelector<HTMLButtonElement>("#record-stop")!.onclick = stopRecording;
  panel.querySelector<HTMLButtonElement>("#record-start")!.onclick = () => {
    viewSelectedCamera(renderCameraInput.value);
    startRecording(
      aspectInput.value as RecordingAspect,
      Math.max(Number(secondsInput.value) || 8, 1),
      Math.max(Number(fpsInput.value) || 30, 12),
    );
  };

  shotList.onclick = (event) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>("[data-shot-row]");
    if (row?.dataset.shotRow && !(event.target as HTMLElement).closest("button")) {
      selectCameraShot(row.dataset.shotRow);
      return;
    }

    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button?.dataset.shotId) return;

    if (button.dataset.shotAction === "up") {
      moveCameraShot(button.dataset.shotId, -1);
      return;
    }

    if (button.dataset.shotAction === "down") {
      moveCameraShot(button.dataset.shotId, 1);
      return;
    }

    if (button.dataset.shotAction === "delete") {
      removeCameraShot(button.dataset.shotId);
    }
  };

  shotList.onchange = (event) => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>(
      "input[data-shot-duration]",
    );
    if (!input?.dataset.shotDuration) return;

    updateCameraShotDuration(
      input.dataset.shotDuration,
      Math.max(Number(input.value) || 0.5, 0.5),
    );
  };

  root.appendChild(panel);

  return {
    getSelectedCameraId() {
      return renderCameraInput.value || "main";
    },
    refreshCameras(options: CameraOption[], selectedId: string) {
      renderCameraInput.innerHTML = "";

      options.forEach((option) => {
        const element = document.createElement("option");
        element.value = option.id;
        element.textContent = option.label;
        renderCameraInput.appendChild(element);
      });

      renderCameraInput.value = options.some((option) => option.id === selectedId)
        ? selectedId
        : "main";
    },
    refreshShots(shots: ShotListItem[]) {
      shotList.innerHTML = "";

      if (shots.length === 0) {
        const empty = document.createElement("div");
        empty.className = "shot-empty";
        empty.textContent = "No camera shots";
        shotList.appendChild(empty);
        return;
      }

      shots.forEach((shot, index) => {
        const row = document.createElement("div");
        row.className = `shot-row${shot.active ? " is-active" : ""}`;
        row.dataset.shotRow = shot.id;

        const details = document.createElement("div");
        details.className = "shot-details";

        const title = document.createElement("strong");
        title.textContent = `${index + 1}. ${shot.label}`;

        const meta = document.createElement("span");
        meta.textContent = `${shot.cameraLabel} -> ${shot.targetLabel} | ${shot.duration}s`;

        const duration = document.createElement("input");
        duration.type = "number";
        duration.min = "0.5";
        duration.step = "0.5";
        duration.value = String(shot.duration);
        duration.title = "Shot duration";
        duration.dataset.shotDuration = shot.id;
        duration.className = "shot-duration";

        const actions = document.createElement("div");
        actions.className = "shot-actions";

        [
          ["up", "Up"],
          ["down", "Down"],
          ["delete", "Del"],
        ].forEach(([action, label]) => {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.shotAction = action;
          button.dataset.shotId = shot.id;
          button.textContent = label;
          actions.appendChild(button);
        });

        details.append(title, meta, duration);
        row.append(details, actions);
        shotList.appendChild(row);
      });
    },
    setStatus(message: string) {
      status.textContent = message;
    },
  };
}

function createTimelineDock({
  root,
  playTimeline,
  pauseTimeline,
  stopTimeline,
  restoreTheatreStudio,
}: {
  root: HTMLElement;
  playTimeline: () => void;
  pauseTimeline: () => void;
  stopTimeline: () => void;
  restoreTheatreStudio: () => void;
}) {
  const dock = document.createElement("aside");
  dock.className = "timeline-dock";
  dock.innerHTML = `
    <div class="timeline-dock-header">
      <div>
        <div class="timeline-dock-title">Shot Sequence</div>
        <div id="timeline-dock-status" class="timeline-dock-status">No clips yet</div>
      </div>
      <div id="timeline-time" class="timeline-time">0.00s</div>
      <div class="timeline-dock-controls">
        <button id="dock-play" type="button">Play</button>
        <button id="dock-pause" type="button">Pause</button>
        <button id="dock-stop" type="button">Stop</button>
        <button id="dock-studio" type="button">Theatre Editor</button>
      </div>
    </div>
    <div class="timeline-dock-body">
      <div class="timeline-ruler" id="timeline-ruler"></div>
      <div class="timeline-tracks" id="timeline-tracks">
        <div class="timeline-playhead" id="timeline-playhead"></div>
        <div class="timeline-track-row">
          <div class="timeline-track-label">Camera Shots</div>
          <div class="timeline-track" data-track="camera-shot">
            <div class="timeline-empty">Add camera shots to build a sequence</div>
          </div>
        </div>
        <div class="timeline-track-row">
          <div class="timeline-track-label">Object Motion</div>
          <div class="timeline-track" data-track="object-motion">
            <div class="timeline-empty">Select object and add motion</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const status = dock.querySelector<HTMLDivElement>("#timeline-dock-status")!;
  const timeReadout = dock.querySelector<HTMLDivElement>("#timeline-time")!;
  const ruler = dock.querySelector<HTMLDivElement>("#timeline-ruler")!;
  const tracks = dock.querySelector<HTMLDivElement>("#timeline-tracks")!;
  const playhead = dock.querySelector<HTMLDivElement>("#timeline-playhead")!;
  let timelineDuration = 10;

  dock.querySelector<HTMLButtonElement>("#dock-play")!.onclick = playTimeline;
  dock.querySelector<HTMLButtonElement>("#dock-pause")!.onclick = pauseTimeline;
  dock.querySelector<HTMLButtonElement>("#dock-stop")!.onclick = stopTimeline;
  dock.querySelector<HTMLButtonElement>("#dock-studio")!.onclick = restoreTheatreStudio;

  function renderRuler(totalDuration: number) {
    ruler.innerHTML = "";
    const tickCount = Math.max(Math.ceil(totalDuration), 1);

    for (let second = 0; second <= tickCount; second += 1) {
      const tick = document.createElement("div");
      tick.className = "timeline-tick";
      tick.style.left = `${(second / tickCount) * 100}%`;
      tick.textContent = `${second}s`;
      ruler.appendChild(tick);
    }
  }

  function setPlayhead(position: number, totalDuration = timelineDuration) {
    const normalizedTotal = Math.max(totalDuration, 0.1);
    const percent = THREE.MathUtils.clamp(position / normalizedTotal, 0, 1) * 100;
    const trackOffset = 98;
    playhead.style.left = `calc(${trackOffset}px + ${percent}% - ${
      (percent / 100) * trackOffset
    }px)`;
    timeReadout.textContent = `${position.toFixed(2)}s`;
  }

  root.appendChild(dock);

  return {
    refresh(items: TimelineDockItem[], totalDuration: number) {
      timelineDuration = Math.max(totalDuration, 10);
      renderRuler(timelineDuration);

      tracks.querySelectorAll(".timeline-track").forEach((track) => {
        track.querySelectorAll(".timeline-clip, .timeline-empty").forEach((node) => {
          node.remove();
        });
      });

      if (items.length === 0) {
        tracks.querySelectorAll<HTMLDivElement>(".timeline-track").forEach((track) => {
          const empty = document.createElement("div");
          empty.className = "timeline-empty";
          empty.textContent =
            track.dataset.track === "camera-shot"
              ? "Add camera shots to build a sequence"
              : "Select object and add motion";
          track.appendChild(empty);
        });
        status.textContent = "No clips yet";
        setPlayhead(0);
        return;
      }

      items.forEach((item) => {
        const track = tracks.querySelector<HTMLDivElement>(
          `.timeline-track[data-track="${item.kind}"]`,
        );
        if (!track) return;

        const clip = document.createElement("div");
        clip.className = `timeline-clip timeline-clip-${item.kind}`;
        clip.style.left = `${(item.start / timelineDuration) * 100}%`;
        clip.style.width = `${Math.max((item.duration / timelineDuration) * 100, 4)}%`;
        clip.title = `${item.label} | ${item.cameraLabel} -> ${item.targetLabel}`;

        const label = document.createElement("strong");
        label.textContent = item.label;
        const meta = document.createElement("span");
        meta.textContent = `${item.start}s - ${item.start + item.duration}s`;

        clip.append(label, meta);
        track.appendChild(clip);
      });

      tracks.querySelectorAll<HTMLDivElement>(".timeline-track").forEach((track) => {
        if (track.querySelector(".timeline-clip")) return;
        const empty = document.createElement("div");
        empty.className = "timeline-empty";
        empty.textContent =
          track.dataset.track === "camera-shot"
            ? "Add camera shots to build a sequence"
            : "Select object and add motion";
        track.appendChild(empty);
      });

      status.textContent = `${items.length} clip${items.length === 1 ? "" : "s"} | ${totalDuration}s`;
      setPlayhead(0);
    },
    setPlayhead,
  };
}

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
  let recording:
    | {
        recorder: MediaRecorder;
        chunks: Blob[];
        stopTimer: number;
        restorePixelRatio: number;
        restoreCamera: THREE.PerspectiveCamera;
        restoreCameraAspect: number;
      }
    | null = null;

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
    const theatreObject = theatreSheet.object(objectKey, props, { reconfigure: true });
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

    theatreMainCameraUnsubscribe = theatreMainCamera.onValuesChange((values) => {
      camera.position.set(values.position.x, values.position.y, values.position.z);
      camera.rotation.set(values.rotation.x, values.rotation.y, values.rotation.z);
      camera.fov = values.camera.fov;
      camera.updateProjectionMatrix();
    });
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
      activeRenderCameraId === "main" ? "Viewing main camera" : "Viewing scene camera",
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
        .filter((node) => (node.metadata.source as NodeSource)?.type !== "ambient")
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
    return node ? theatreBindings.get(node.id)?.theatreObject ?? null : null;
  }

  function getLookAtRotation(
    position: THREE.Vector3,
    target: THREE.Vector3,
    sourceCamera: THREE.PerspectiveCamera,
  ) {
    const previewCamera = sourceCamera.clone();
    previewCamera.position.copy(position);
    previewCamera.lookAt(target);
    return previewCamera.rotation.clone();
  }

  function createCameraShotFrames(
    shot: CameraShot,
    duration: number,
    sourceCamera: THREE.PerspectiveCamera,
    targetNode: SceneNode | null,
    initial: {
      position: THREE.Vector3;
      fov: number;
    },
  ) {
    const target = targetNode
      ? {
          center: getObjectCenter(targetNode.root),
          radius: getObjectRadius(targetNode.root),
        }
      : {
          center: new THREE.Vector3(0, 0.75, 0),
          radius: 2.5,
        };
    const startOffset = initial.position.clone().sub(target.center);
    const orbitRadius = Math.max(startOffset.length(), target.radius * 3.2);
    const startAngle = Math.atan2(startOffset.z, startOffset.x);
    const direction = startOffset.clone().normalize();
    const closePosition = target.center
      .clone()
      .add(direction.clone().multiplyScalar(target.radius * 1.75));
    closePosition.y = target.center.y + target.radius * 0.72;
    const dollyPosition = target.center
      .clone()
      .add(direction.clone().multiplyScalar(target.radius * 2.25));
    const samples =
      shot === "orbit" ? [0, 0.25, 0.5, 0.75, 1] : [0, 1];

    return samples.map((progress) => {
      const eased = easeInOutCubic(progress);
      const position = initial.position.clone();
      let fov = initial.fov;

      if (shot === "orbit") {
        const angle = startAngle + Math.PI * 2 * progress;
        position.set(
          target.center.x + Math.cos(angle) * orbitRadius,
          initial.position.y,
          target.center.z + Math.sin(angle) * orbitRadius,
        );
      } else if (shot === "dolly-in") {
        position.lerpVectors(initial.position, dollyPosition, eased);
      } else if (shot === "close-up") {
        position.lerpVectors(initial.position, closePosition, eased);
      } else if (shot === "dolly-zoom") {
        position.lerpVectors(initial.position, closePosition, eased);
        fov = THREE.MathUtils.lerp(initial.fov, Math.max(initial.fov * 0.42, 12), eased);
      }

      return {
        offset: duration * progress,
        position,
        rotation: getLookAtRotation(position, target.center, sourceCamera),
        fov,
      };
    });
  }

  function getCameraShotAnimations() {
    return activeAnimations
      .filter((animation) => animation.kind === "camera-shot")
      .sort((first, second) => first.delay - second.delay);
  }

  function getTimelineDuration() {
    return Math.max(
      cameraShotCursor,
      ...activeAnimations
        .filter((animation) => !animation.loop)
        .map((animation) => animation.delay + animation.duration),
      0,
    );
  }

  function getCameraShotTimelineItems(): TimelineDockItem[] {
    return getCameraShotAnimations().map((animation) => ({
      id: animation.id,
      label: animation.name,
      cameraLabel: animation.metadata?.cameraLabel ?? "Main View",
      targetLabel: animation.metadata?.targetLabel ?? "Scene center",
      duration: animation.duration,
      start: animation.delay,
      kind: "camera-shot",
      active: animation.id === activeShotId,
    }));
  }

  function getObjectMotionTimelineItems(): TimelineDockItem[] {
    return activeAnimations
      .filter((animation) => animation.kind === "object-motion")
      .map((animation) => ({
        id: animation.id,
        label: animation.name,
        cameraLabel: "Object",
        targetLabel: animation.metadata?.targetLabel ?? "Motion",
        duration: animation.duration,
        start: animation.delay,
        kind: "object-motion",
      }));
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
    return activeAnimations
      .filter(
        (animation) =>
          animation.kind === "camera-shot" || animation.kind === "object-motion",
      )
      .sort((first, second) => first.delay - second.delay)
      .flatMap((animation): SavedTimelineClip[] => {
        if (animation.kind === "camera-shot" && animation.metadata?.shot) {
          return [
            {
              kind: "camera-shot",
              shot: animation.metadata.shot,
              start: animation.delay,
              duration: animation.duration,
              cameraName: animation.metadata.cameraLabel ?? "Main View",
              ...(animation.metadata.targetLabel &&
              animation.metadata.targetLabel !== "Scene center"
                ? { targetName: animation.metadata.targetLabel }
                : {}),
            },
          ];
        }

        if (
          animation.kind === "object-motion" &&
          animation.metadata?.preset &&
          animation.metadata.targetLabel
        ) {
          return [
            {
              kind: "object-motion",
              preset: animation.metadata.preset,
              start: animation.delay,
              duration: animation.duration,
              targetName: animation.metadata.targetLabel,
              loop: animation.loop,
            },
          ];
        }

        return [];
      });
  }

  function clearTimeline() {
    activeAnimations.splice(0, activeAnimations.length);
    cameraShotCursor = 0;
    timelinePosition = 0;
    timelinePlaying = false;
    activeShotId = null;
    refreshShotList();
    timelineDock?.setPlayhead(0, 10);
  }

  function applyCameraShotOrder(shots: TimelineAnimation[]) {
    cameraShotCursor = 0;

    shots.forEach((shot) => {
      shot.delay = cameraShotCursor;
      shot.elapsed = 0;
      shot.started = false;
      shot.finished = false;
      cameraShotCursor += shot.duration;
    });

    timelinePosition = 0;
    refreshShotList();
  }

  function rebuildCameraShotTiming() {
    applyCameraShotOrder(getCameraShotAnimations());
  }

  function removeCameraShot(shotId: string) {
    const index = activeAnimations.findIndex((animation) => animation.id === shotId);
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
    animation: Omit<TimelineAnimation, "id" | "elapsed" | "started" | "finished">,
  ) {
    const nextAnimation = {
      ...animation,
      id: crypto.randomUUID(),
      elapsed: 0,
      started: false,
      finished: false,
    };

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

    const object = node.root;
    const startPosition = object.position.clone();
    const startRotation = object.rotation.clone();
    const startScale = object.scale.clone();
    const material = getFirstStandardMaterial(object);
    const startColor = material?.color.clone();
    const targetColor = new THREE.Color("#6ee7ff");

    addTimelineAnimation({
      name: `${node.name} ${preset}`,
      kind: "object-motion",
      metadata: {
        preset,
        targetLabel: node.name,
      },
      delay:
        options.delay ??
        getCameraShotAnimations().find((shot) => shot.id === activeShotId)?.delay ??
        0,
      duration,
      loop: options.loop ?? (preset === "spin" || preset === "float"),
      update(progress) {
        const eased = easeInOutCubic(progress);

        if (preset === "spin") {
          object.rotation.y = startRotation.y + Math.PI * 2 * progress;
          return;
        }

        if (preset === "pulse") {
          const pulse = 1 + Math.sin(progress * Math.PI) * 0.45;
          object.scale.set(
            startScale.x * pulse,
            startScale.y * pulse,
            startScale.z * pulse,
          );
          return;
        }

        if (preset === "float") {
          object.position.y = startPosition.y + Math.sin(progress * Math.PI * 2) * 0.75;
          return;
        }

        if (preset === "color-shift" && material && startColor) {
          material.color.copy(startColor).lerp(targetColor, eased);
          material.needsUpdate = true;
        }
      },
      complete() {
        if (preset === "pulse") object.scale.copy(startScale);
      },
    });

    if (!options.silent) sceneBuilder.setStatus(`Motion added: ${preset}`);
  }

  function getShotTarget() {
    const selected = selection.getSelected();

    if (selected) {
      return {
        center: getObjectCenter(selected.root),
        radius: getObjectRadius(selected.root),
      };
    }

    return {
      center: new THREE.Vector3(0, 0.75, 0),
      radius: 2.5,
    };
  }

  function applyCameraShot(
    shot: CameraShot,
    duration: number,
    options: {
      cameraName?: string;
      delay?: number;
      silent?: boolean;
      targetName?: string;
    } = {},
  ) {
    const shotCamera = options.cameraName
      ? getCameraByName(options.cameraName)
      : getActiveRenderCamera();
    const selectedTarget = options.targetName
      ? findSceneNodeByName(options.targetName)
      : selection.getSelected();
    let center = new THREE.Vector3();
    let radius = 1;
    let startPosition = new THREE.Vector3();
    let startFov = shotCamera.fov;
    let orbitRadius = 1;
    let startAngle = 0;
    let startHeight = 0;
    let closePosition = new THREE.Vector3();
    let dollyPosition = new THREE.Vector3();
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
      start() {
        const target = selectedTarget
          ? {
              center: getObjectCenter(selectedTarget.root),
              radius: getObjectRadius(selectedTarget.root),
            }
          : getShotTarget();
        center = target.center;
        radius = target.radius;
        startPosition = shotCamera.position.clone();
        startFov = shotCamera.fov;
        const startOffset = startPosition.clone().sub(center);
        orbitRadius = Math.max(startOffset.length(), radius * 3.2);
        startAngle = Math.atan2(startOffset.z, startOffset.x);
        startHeight = startPosition.y;
        const direction = startPosition.clone().sub(center).normalize();
        closePosition = center
          .clone()
          .add(direction.clone().multiplyScalar(radius * 1.75));
        closePosition.y = center.y + radius * 0.72;
        dollyPosition = center
          .clone()
          .add(direction.clone().multiplyScalar(radius * 2.25));
      },
      update(progress) {
        const eased = easeInOutCubic(progress);
        const nextPosition = new THREE.Vector3();
        let nextFov = startFov;

        if (shot === "static") {
          nextPosition.copy(startPosition);
        } else if (shot === "orbit") {
          const angle = startAngle + Math.PI * 2 * progress;
          nextPosition.set(
            center.x + Math.cos(angle) * orbitRadius,
            startHeight,
            center.z + Math.sin(angle) * orbitRadius,
          );
        }

        if (shot === "dolly-in") {
          nextPosition.copy(startPosition).lerp(dollyPosition, eased);
        }

        if (shot === "close-up") {
          nextPosition.copy(startPosition).lerp(closePosition, eased);
          nextFov = THREE.MathUtils.lerp(startFov, 28, eased);
        }

        if (shot === "dolly-zoom") {
          nextPosition.copy(startPosition).lerp(dollyPosition, eased);
          nextFov = THREE.MathUtils.lerp(startFov, 62, eased);
        }

        shotCamera.fov = nextFov;
        shotCamera.updateProjectionMatrix();

        if (shotCamera === camera) {
          controls.setLookAt(
            nextPosition.x,
            nextPosition.y,
            nextPosition.z,
            center.x,
            center.y,
            center.z,
            false,
          );
          return;
        }

        shotCamera.position.copy(nextPosition);
        shotCamera.lookAt(center);
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
    activeAnimations.forEach((animation) => {
      animation.elapsed = 0;
      animation.started = false;
      animation.finished = false;
    });
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

  function setTheatreObjectAt(
    position: number,
    theatreObject: ISheetObject<any>,
    values: Record<string, unknown>,
  ) {
    if (!theatreSheet) return;

    theatreSheet.sequence.position = position;
    studio.transaction(({ set }) => {
      const setValue = set as (pointer: unknown, value: unknown) => void;
      Object.entries(values).forEach(([key, value]) => {
        setValue((theatreObject.props as Record<string, unknown>)[key], value);
      });
    });
  }

  function bakeShotsToTheatre() {
    if (!theatreSheet) {
      sceneBuilder.setStatus("Theatre is not ready");
      return;
    }

    const clips = activeAnimations
      .filter(
        (animation) =>
          animation.kind === "camera-shot" || animation.kind === "object-motion",
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
        set(theatreSheet!.sequence.pointer.length, Math.max(getTimelineDuration(), 0.5));
      });

      clips.forEach((clip) => {
        if (clip.kind === "camera-shot" && clip.metadata?.shot) {
          const cameraName = clip.metadata.cameraLabel ?? "Main View";
          const sourceCamera = getCameraByName(cameraName);
          const theatreCamera = getTheatreCameraByName(cameraName);
          if (!theatreCamera) return;

          sequenceTheatrePrimitiveProps(theatreCamera, [
            ["position", "x"],
            ["position", "y"],
            ["position", "z"],
            ["rotation", "x"],
            ["rotation", "y"],
            ["rotation", "z"],
            ["camera", "fov"],
          ]);

          const state = cameraStates.get(cameraName) ?? {
            position: sourceCamera.position.clone(),
            fov: sourceCamera.fov,
          };
          const targetNode =
            clip.metadata.targetLabel &&
            clip.metadata.targetLabel !== "Scene center"
              ? findSceneNodeByName(clip.metadata.targetLabel)
              : null;
          const frames = createCameraShotFrames(
            clip.metadata.shot,
            clip.duration,
            sourceCamera,
            targetNode,
            state,
          );

          frames.forEach((frame) => {
            setTheatreObjectAt(clip.delay + frame.offset, theatreCamera, {
              position: {
                x: frame.position.x,
                y: frame.position.y,
                z: frame.position.z,
              },
              rotation: {
                x: frame.rotation.x,
                y: frame.rotation.y,
                z: frame.rotation.z,
              },
              camera: { fov: frame.fov },
            });
          });

          const lastFrame = frames[frames.length - 1];
          cameraStates.set(cameraName, {
            position: lastFrame.position.clone(),
            fov: lastFrame.fov,
          });
          return;
        }

        if (
          clip.kind !== "object-motion" ||
          !clip.metadata?.preset ||
          !clip.metadata.targetLabel
        ) {
          return;
        }

        const node = findSceneNodeByName(clip.metadata.targetLabel);
        const binding = node ? theatreBindings.get(node.id) : null;
        if (!node || !binding) return;

        const material = getFirstStandardMaterial(node.root);
        const state = objectStates.get(node.name) ?? {
          position: node.root.position.clone(),
          rotation: node.root.rotation.clone(),
          scale: node.root.scale.clone(),
          color: material?.color.clone() ?? null,
          opacity: material?.opacity ?? 1,
        };
        const start = clip.delay;
        const end = clip.delay + clip.duration;

        if (clip.metadata.preset === "spin") {
          sequenceTheatrePrimitiveProps(binding.theatreObject, [
            ["rotation", "x"],
            ["rotation", "y"],
            ["rotation", "z"],
          ]);
          setTheatreObjectAt(start, binding.theatreObject, {
            rotation: {
              x: state.rotation.x,
              y: state.rotation.y,
              z: state.rotation.z,
            },
          });
          state.rotation.y += Math.PI * 2;
          setTheatreObjectAt(end, binding.theatreObject, {
            rotation: {
              x: state.rotation.x,
              y: state.rotation.y,
              z: state.rotation.z,
            },
          });
        } else if (clip.metadata.preset === "pulse") {
          sequenceTheatrePrimitiveProps(binding.theatreObject, [
            ["scale", "x"],
            ["scale", "y"],
            ["scale", "z"],
          ]);
          [0, 0.5, 1].forEach((progress) => {
            const multiplier = progress === 0.5 ? 1.45 : 1;
            setTheatreObjectAt(
              start + clip.duration * progress,
              binding.theatreObject,
              {
                scale: {
                  x: state.scale.x * multiplier,
                  y: state.scale.y * multiplier,
                  z: state.scale.z * multiplier,
                },
              },
            );
          });
        } else if (clip.metadata.preset === "float") {
          sequenceTheatrePrimitiveProps(binding.theatreObject, [
            ["position", "x"],
            ["position", "y"],
            ["position", "z"],
          ]);
          [0, 0.25, 0.5, 0.75, 1].forEach((progress) => {
            setTheatreObjectAt(
              start + clip.duration * progress,
              binding.theatreObject,
              {
                position: {
                  x: state.position.x,
                  y:
                    state.position.y +
                    Math.sin(progress * Math.PI * 2) * 0.75,
                  z: state.position.z,
                },
              },
            );
          });
        } else if (clip.metadata.preset === "color-shift" && state.color) {
          sequenceTheatrePrimitiveProps(binding.theatreObject, [
            ["material", "color"],
          ]);
          const targetColor = new THREE.Color("#6ee7ff");
          setTheatreObjectAt(start, binding.theatreObject, {
            material: {
              color: colorToRgba(state.color, state.opacity),
            },
          });
          setTheatreObjectAt(end, binding.theatreObject, {
            material: {
              color: colorToRgba(targetColor, state.opacity),
            },
          });
          state.color.copy(targetColor);
        }

        objectStates.set(node.name, state);
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

  function getRecordingSize(aspect: RecordingAspect) {
    return aspect === "9:16"
      ? { width: 720, height: 1280 }
      : { width: 1280, height: 720 };
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

  function startRecording(aspect: RecordingAspect, seconds: number, fps: number) {
    if (recording) {
      productionPanel?.setStatus("Already recording");
      return;
    }

    if (!("captureStream" in renderer.domElement) || typeof MediaRecorder === "undefined") {
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
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dehlero-${aspect.replace(":", "x")}-${Date.now()}.webm`;
      link.click();
      URL.revokeObjectURL(url);
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

  function findNodeFromObject(object: THREE.Object3D) {
    return registry
      .getAll()
      .filter((node) => (node.metadata.source as NodeSource)?.type !== "ambient")
      .find((node) => node.root === object || node.root.children.includes(object) || node.root.getObjectById(object.id));
  }

  function pickNode(event: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const nodes = registry
      .getAll()
      .filter((node) => (node.metadata.source as NodeSource)?.type !== "ambient");

    raycaster.setFromCamera(pointer, getActiveRenderCamera());
    const intersects = raycaster.intersectObjects(
      nodes.map((node) => node.root),
      true,
    );

    return intersects.length > 0 ? findNodeFromObject(intersects[0].object) : null;
  }

  renderer.domElement.addEventListener("pointerdown", (event) => {
    pointerDown.set(event.clientX, event.clientY);
    didDragTransform = false;
  });

  renderer.domElement.addEventListener("pointerup", (event) => {
    if (event.button !== 0 || didDragTransform) return;
    if (pointerDown.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 4) return;

    const node = pickNode(event);

    if (node) {
      transformEditor.selectNode(node.id);
      return;
    }

    transformEditor.clearSelection();
  });

  renderer.domElement.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    const node = pickNode(event);

    if (node) {
      transformEditor.selectNode(node.id);
      transformEditor.deleteSelected();
    }
  });

  function clearEditableScene() {
    registry
      .getAll()
      .filter((node) => (node.metadata.source as NodeSource)?.type !== "ambient")
      .forEach((node) => {
        deleteNode(node);
        registry.unregister(node.id);
      });

    selection.clear();
    transformEditor.refresh();
    clearTimeline();
  }

  function serializeScene(): SavedScene {
    const objects = registry
      .getAll()
      .filter((node) => (node.metadata.source as NodeSource)?.type !== "ambient")
      .map((node): SavedObject => {
        const texture = node.metadata.texture as SavedObject["texture"];

        return {
          name: node.name,
          source: node.metadata.source as NodeSource,
          transform: serializeTransform(node.root),
          ...(texture ? { texture } : {}),
        };
      });

    return {
      version: 2,
      name: sceneBuilder.getSceneName(),
      objects,
      timeline: serializeTimeline(),
    };
  }

  function saveScene() {
    const expectedMainCameraKey = `${sceneBuilder.getSceneName()} / Main View Camera`;
    if (theatreMainCamera?.address.objectKey !== expectedMainCameraKey) {
      registerTheatreMainCamera();
    }
    const savedScene = serializeScene();
    localStorage.setItem(
      createProjectStorageKey(savedScene.name),
      JSON.stringify(savedScene),
    );
    addProjectName(savedScene.name);
    localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, savedScene.name);
    sceneBuilder.refreshProjects(savedScene.name);
    sceneBuilder.setStatus(`Saved: ${savedScene.name}`);
  }

  function saveCurrentSceneSilently() {
    const expectedMainCameraKey = `${sceneBuilder.getSceneName()} / Main View Camera`;
    if (theatreMainCamera?.address.objectKey !== expectedMainCameraKey) {
      registerTheatreMainCamera();
    }
    const savedScene = serializeScene();
    localStorage.setItem(
      createProjectStorageKey(savedScene.name),
      JSON.stringify(savedScene),
    );
    addProjectName(savedScene.name);
  }

  async function createObjectFromSaved(savedObject: SavedObject) {
    const { source } = savedObject;

    if (source.type === "library") {
      const item = library.find(
        (candidate) => candidate.id === source.libraryId,
      );

      if (!item) throw new Error(`Missing library item: ${savedObject.name}`);
      return item.create();
    }

    if (source.type === "model") {
      const blob = await loadAssetBlob(source.assetKey);
      const file = new File([blob], source.fileName);
      return normalizeImportedObject(await loadModelFile(file));
    }

    if (source.type === "textured-planet") {
      const blob = await loadAssetBlob(source.assetKey);
      return createPlanet(loadTextureFromBlob(blob));
    }

    throw new Error(`Unsupported saved object: ${savedObject.name}`);
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
      const object = await createObjectFromSaved(savedObject);
      object.name = savedObject.name;
      applySavedTransform(object, savedObject.transform);

      if (savedObject.texture) {
        const blob = await loadAssetBlob(savedObject.texture.assetKey);
        applyTextureToObject(object, loadTextureFromBlob(blob));
      }

      const node = attachObject(savedObject.name, object, savedObject.source);
      if (savedObject.texture) node.metadata.texture = savedObject.texture;
    }

    transformEditor.refresh();
    transformEditor.clearSelection();
    restoreTimeline(savedScene.timeline);
    sceneBuilder.setStatus(`Loaded: ${savedScene.name}`);
  }

  function loadScene() {
    const projectName = sceneBuilder.getSelectedProjectName();
    const savedScene = projectName ? loadProjectByName(projectName) : null;

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
    const savedScene = loadProjectByName(projectName);

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
    const nextName = `Untitled Scene ${getProjectNames().length + 1}`;
    sceneBuilder.setSceneName(nextName);
    registerTheatreMainCamera();
    addDefaultProjectObjects();
    transformEditor.clearSelection();
    saveScene();
    sceneBuilder.setStatus("New scene");
  }

  async function importModel(file: File) {
    try {
      const assetKey = createAssetKey(file);
      await saveAssetBlob(assetKey, file);

      const loadedObject = await loadModelFile(file);
      const object = normalizeImportedObject(loadedObject);
      object.name = file.name.replace(/\.[^.]+$/, "");
      placeObject(object, nextObjectIndex);
      nextObjectIndex += 1;

      attachObject(uniqueName(object.name || "Imported Model"), object, {
        type: "model",
        assetKey,
        fileName: file.name,
      });
      sceneBuilder.setStatus(`Imported ${file.name}`);
    } catch (error) {
      console.error(error);
      sceneBuilder.setStatus("Import failed");
    }
  }

  async function applyTexture(file: File) {
    const selected = selection.getSelected();
    if (!selected) {
      sceneBuilder.setStatus("Select an object first");
      return;
    }

    const assetKey = createAssetKey(file);
    await saveAssetBlob(assetKey, file);

    const texture = loadTextureFile(file);
    applyTextureToObject(selected.root, texture);
    selected.metadata.texture = { assetKey, fileName: file.name };
    sceneBuilder.setStatus(`Texture applied: ${file.name}`);
  }

  async function createPlanetFromTexture(file: File) {
    const assetKey = createAssetKey(file);
    await saveAssetBlob(assetKey, file);

    const texture = loadTextureFile(file);
    const planet = createPlanet(texture);
    planet.name = file.name.replace(/\.[^.]+$/, "");
    placeObject(planet, nextObjectIndex);
    nextObjectIndex += 1;

    attachObject(uniqueName("Textured Planet"), planet, {
      type: "textured-planet",
      assetKey,
      fileName: file.name,
    });
    sceneBuilder.setStatus(`Planet created: ${file.name}`);
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
  sceneBuilder.refreshProjects(localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) ?? undefined);

  registerObject("Ambient Light", ambient, { type: "ambient" }, false);

  const activeProjectName = localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
  const activeScene = activeProjectName ? loadProjectByName(activeProjectName) : null;

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
        timelineDuration > 0 ? Math.min(timelinePosition + delta, timelineDuration) : 0;

      for (let index = activeAnimations.length - 1; index >= 0; index -= 1) {
        const animation = activeAnimations[index];
        if (animation.finished) continue;

        animation.elapsed += delta;
        if (animation.elapsed < animation.delay) continue;

        if (!animation.started) {
          animation.started = true;
          animation.start?.();
        }

        const localElapsed = animation.elapsed - animation.delay;
        const progress = Math.min(localElapsed / animation.duration, 1);
        animation.update(progress, delta);

        if (progress >= 1) {
          animation.complete?.();

          if (animation.loop) {
            animation.elapsed = 0;
          } else if (animation.kind === "camera-shot") {
            animation.finished = true;
          } else {
            activeAnimations.splice(index, 1);
          }
        }
      }
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
