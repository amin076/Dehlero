import * as THREE from "three";
import CameraControls from "camera-controls";
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
  version: 1;
  name: string;
  objects: SavedObject[];
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

function createSceneBuilderPanel({
  root,
  library,
  addLibraryObject,
  importModel,
  applyTexture,
  createPlanetFromTexture,
  saveScene,
  loadScene,
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
    if (projectSelect.value) sceneNameInput.value = projectSelect.value;
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

export function createStudioApp({ root }: { root: HTMLDivElement }) {
  root.innerHTML = "";

  const registry = new SceneRegistry();
  const selection = new SelectionManager();
  const scene = createScene();
  const camera = createStudioCamera();
  const renderer = createRenderer();
  const clock = new THREE.Clock();
  const helpers = new Map<string, SceneHelper>();
  const library = createLibrary();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pointerDown = new THREE.Vector2();
  let didDragTransform = false;

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
  });

  let nextObjectIndex = 0;
  const nameCounts = new Map<string, number>();

  function uniqueName(baseName: string) {
    const count = (nameCounts.get(baseName) ?? 0) + 1;
    nameCounts.set(baseName, count);
    return `${baseName} ${count}`;
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
    transformEditor.refresh();
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

  function addLibraryObject(item: LibraryItem) {
    const object = item.create();
    placeObject(object, nextObjectIndex);
    nextObjectIndex += 1;

    attachObject(uniqueName(item.label), object, {
      type: "library",
      libraryId: item.id,
    });
  }

  function deleteNode(node: SceneNode) {
    const helper = helpers.get(node.id);

    if (helper) {
      helper.removeFromParent();
      disposeObject(helper);
      helpers.delete(node.id);
    }

    node.root.removeFromParent();
    disposeObject(node.root);
  }

  function updateHelperVisibility(selectedNode: SceneNode | null) {
    helpers.forEach((helper, nodeId) => {
      helper.visible = selectedNode?.id === nodeId;
      helper.update();
    });
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

    raycaster.setFromCamera(pointer, camera);
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
      version: 1,
      name: sceneBuilder.getSceneName(),
      objects,
    };
  }

  function saveScene() {
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

  async function loadSavedScene(savedScene: SavedScene) {
    clearEditableScene();
    sceneBuilder.setSceneName(savedScene.name);

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

  function newScene() {
    clearEditableScene();
    const nextName = `Untitled Scene ${getProjectNames().length + 1}`;
    sceneBuilder.setSceneName(nextName);
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
    newScene,
  });

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
    addDefaultProjectObjects();
    transformEditor.clearSelection();
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    controls.update(delta);
    helpers.forEach((helper) => helper.update());
    renderer.render(scene, camera);
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
