import * as THREE from "three";
import CameraControls from "camera-controls";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { Pane } from "tweakpane";

import type { SceneNode } from "../core/scene/SceneNode";
import { createSceneNodeFromObject } from "../core/scene/SceneNode";
import type { SceneRegistry } from "../core/scene/SceneRegistry";
import type { SelectionManager } from "./SelectionManager";
import { applyAstronautTeamColors } from "../app/studioLibrary";

type PaneApi = {
  addBinding: (
    object: Record<string, unknown>,
    key: string,
    options?: Record<string, unknown>,
  ) => {
    dispose: () => void;
    on: (
      eventName: "change",
      callback: (event: { value: unknown }) => void,
    ) => void;
    refresh?: () => void;
  };
  addButton: (options: { title: string }) => {
    on: (eventName: "click", callback: () => void) => void;
  };
  addFolder: (options: { title: string }) => PaneApi;
  refresh?: () => void;
};

const POSITION_LIMIT = 10000;
const SCALE_LIMIT = 2000;
const SCALE_MIN = 0.0001;
const SCALE_STEP = 0.01;
const ROTATION_LIMIT = 3600;

function round(value: number) {
  return Number(value.toFixed(4));
}

function cloneMaterialSafe(material: THREE.Material | THREE.Material[]) {
  return Array.isArray(material)
    ? material.map((item) => item.clone())
    : material.clone();
}

function cloneObjectForEditing(source: THREE.Object3D) {
  const clone = source.clone(true);

  clone.traverse((object) => {
    const mesh = object as THREE.Mesh;

    if (mesh.isMesh && mesh.material) {
      mesh.material = cloneMaterialSafe(mesh.material);
    }
  });

  return clone;
}

export function createTransformEditor({
  root,
  scene,
  camera,
  renderer,
  cameraControls,
  registry,
  selection,
  onDeleteNode,
  onDuplicateNode,
  onSelectionChange,
  onSceneChange,
}: {
  root: HTMLElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  cameraControls: CameraControls;
  registry: SceneRegistry;
  selection: SelectionManager;
  onDeleteNode?: (node: SceneNode) => void;
  onDuplicateNode?: (node: SceneNode) => SceneNode | null;
  onSelectionChange?: (node: SceneNode | null) => void;
  onSceneChange?: () => void;
}) {
  const controls = new TransformControls(camera, renderer.domElement);

  controls.setMode("translate");
  controls.setSize(0.75);
  controls.setSpace("world");
  controls.setTranslationSnap(null);
  controls.setRotationSnap(null);
  controls.setScaleSnap(null);

  const params = {
    selectedNodeId: "",
    objectName: "",
    transformOutput: "",

    positionX: 0,
    positionY: 0,
    positionZ: 0,

    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,

    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    uniformScale: 1,

    astronautBodyColor: "#f8fafc",
    astronautTrimColor: "#2563eb",
    astronautHelmetColor: "#e5e7eb",
    astronautVisorColor: "#050816",
    astronautGlovesColor: "#f8fafc",
    astronautBootsColor: "#111827",
  };

  const helper =
    "getHelper" in controls
      ? controls.getHelper()
      : (controls as unknown as THREE.Object3D);

  scene.add(helper);

  controls.addEventListener("dragging-changed", (event) => {
    cameraControls.enabled = !(event as any).value;
  });

  controls.addEventListener("objectChange", () => {
    syncParamsFromSelected();
    pane.refresh?.();
    onSceneChange?.();
  });

  function notifyObjectTransformChanged() {
    controls.dispatchEvent({ type: "objectChange" } as any);
  }

  const panel = document.createElement("div");
  panel.className = "transform-editor-panel tweakpane-panel";
  root.appendChild(panel);

  const pane = new Pane({
    title: "Dehlero Transform Editor",
    container: panel,
  }) as unknown as PaneApi;

  let nodeBinding = pane.addBinding(params, "selectedNodeId", {
    label: "Object",
    options: {},
  });

  let nodeOptionsSignature = "";
  let nodeBindingRebuildQueued = false;

  function createNodeOptions() {
    return getEditableNodes().reduce<Record<string, string>>(
      (acc, node) => {
        acc[node.name] = node.id;
        return acc;
      },
      { None: "" },
    );
  }

  function attachNodeBindingChangeHandler() {
    nodeBinding.on("change", (event) => {
      const value = String(event.value);

      if (!value) {
        clearSelection();
        return;
      }

      selectNode(value);
    });
  }

  function rebuildNodeBindingSafely(options: Record<string, string>) {
    if (nodeBindingRebuildQueued) return;

    nodeBindingRebuildQueued = true;

    window.setTimeout(() => {
      nodeBindingRebuildQueued = false;

      nodeBinding.dispose();

      nodeBinding = pane.addBinding(params, "selectedNodeId", {
        label: "Object",
        options,
      });

      attachNodeBindingChangeHandler();
      nodeBinding.refresh?.();
      pane.refresh?.();
    }, 0);
  }

  attachNodeBindingChangeHandler();

  const objectFolder = pane.addFolder({ title: "Object" });

  objectFolder
    .addBinding(params, "objectName", {
      label: "Name",
    })
    .on("change", () => {
      renameSelected(String(params.objectName));
    });

  objectFolder.addButton({ title: "Duplicate Selected" }).on("click", () => {
    duplicateSelected();
  });

  const modeFolder = pane.addFolder({ title: "Transform Mode" });

  modeFolder.addButton({ title: "Move" }).on("click", () => {
    controls.setMode("translate");
  });

  modeFolder.addButton({ title: "Rotate" }).on("click", () => {
    controls.setMode("rotate");
  });

  modeFolder.addButton({ title: "Scale" }).on("click", () => {
    controls.setMode("scale");
  });

  modeFolder.addButton({ title: "World Space" }).on("click", () => {
    controls.setSpace("world");
  });

  modeFolder.addButton({ title: "Local Space" }).on("click", () => {
    controls.setSpace("local");
  });

  modeFolder.addButton({ title: "Big Gizmo" }).on("click", () => {
    controls.setSize(1.8);
  });

  modeFolder.addButton({ title: "Small Gizmo" }).on("click", () => {
    controls.setSize(0.6);
  });

  const numericFolder = pane.addFolder({ title: "Numeric Transform" });

  numericFolder
    .addBinding(params, "positionX", {
      label: "Position X",
      min: -POSITION_LIMIT,
      max: POSITION_LIMIT,
      step: 0.1,
    })
    .on("change", applyParamsToSelected);

  numericFolder
    .addBinding(params, "positionY", {
      label: "Position Y",
      min: -POSITION_LIMIT,
      max: POSITION_LIMIT,
      step: 0.1,
    })
    .on("change", applyParamsToSelected);

  numericFolder
    .addBinding(params, "positionZ", {
      label: "Position Z",
      min: -POSITION_LIMIT,
      max: POSITION_LIMIT,
      step: 0.1,
    })
    .on("change", applyParamsToSelected);

  numericFolder
    .addBinding(params, "rotationX", {
      label: "Rotation X",
      min: -ROTATION_LIMIT,
      max: ROTATION_LIMIT,
      step: 1,
    })
    .on("change", applyParamsToSelected);

  numericFolder
    .addBinding(params, "rotationY", {
      label: "Rotation Y",
      min: -ROTATION_LIMIT,
      max: ROTATION_LIMIT,
      step: 1,
    })
    .on("change", applyParamsToSelected);

  numericFolder
    .addBinding(params, "rotationZ", {
      label: "Rotation Z",
      min: -ROTATION_LIMIT,
      max: ROTATION_LIMIT,
      step: 1,
    })
    .on("change", applyParamsToSelected);

  numericFolder
    .addBinding(params, "scaleX", {
      label: "Scale X",
      min: SCALE_MIN,
      max: SCALE_LIMIT,
      step: SCALE_STEP,
    })
    .on("change", applyParamsToSelected);

  numericFolder
    .addBinding(params, "scaleY", {
      label: "Scale Y",
      min: SCALE_MIN,
      max: SCALE_LIMIT,
      step: SCALE_STEP,
    })
    .on("change", applyParamsToSelected);

  numericFolder
    .addBinding(params, "scaleZ", {
      label: "Scale Z",
      min: SCALE_MIN,
      max: SCALE_LIMIT,
      step: SCALE_STEP,
    })
    .on("change", applyParamsToSelected);

  numericFolder.addButton({ title: "Apply Uniform Scale" }).on("click", () => {
    const node = selection.getSelected();
    if (!node) return;

    const value = Math.max(SCALE_MIN, Number(params.uniformScale) || 1);
    node.root.scale.set(value, value, value);

    notifyObjectTransformChanged();
  });

  numericFolder.addButton({ title: "Shrink 50%" }).on("click", () => {
    scaleSelectedBy(0.5);
  });

  numericFolder.addButton({ title: "Grow 200%" }).on("click", () => {
    scaleSelectedBy(2);
  });

  numericFolder.addButton({ title: "Fit Height 1" }).on("click", () => {
    fitSelectedToHeight(1);
  });

  numericFolder.addButton({ title: "Fit Height 0.5" }).on("click", () => {
    fitSelectedToHeight(0.5);
  });

  numericFolder.addButton({ title: "Fit Width 1" }).on("click", () => {
    fitSelectedToMaxXZ(1);
  });

  const astronautFolder = pane.addFolder({ title: "Astronaut Team Colors" });

  astronautFolder
    .addBinding(params, "astronautBodyColor", { label: "Suit Body" })
    .on("change", applyAstronautColorParams);

  astronautFolder
    .addBinding(params, "astronautTrimColor", { label: "Team Trim" })
    .on("change", applyAstronautColorParams);

  astronautFolder
    .addBinding(params, "astronautHelmetColor", { label: "Helmet" })
    .on("change", applyAstronautColorParams);

  astronautFolder
    .addBinding(params, "astronautVisorColor", { label: "Visor" })
    .on("change", applyAstronautColorParams);

  astronautFolder
    .addBinding(params, "astronautGlovesColor", { label: "Gloves / Hands" })
    .on("change", applyAstronautColorParams);

  astronautFolder
    .addBinding(params, "astronautBootsColor", { label: "Shoes / Boots" })
    .on("change", applyAstronautColorParams);

  astronautFolder.addButton({ title: "Apply Team Colors" }).on("click", () => {
    applyAstronautColorParams();
  });

  astronautFolder.addButton({ title: "Blue Team" }).on("click", () => {
    setAstronautPreset("#f8fafc", "#2563eb", "#e5e7eb", "#050816", "#f8fafc", "#111827");
  });

  astronautFolder.addButton({ title: "Red Team" }).on("click", () => {
    setAstronautPreset("#f8fafc", "#dc2626", "#e5e7eb", "#050816", "#f8fafc", "#111827");
  });

  astronautFolder.addButton({ title: "Green Team" }).on("click", () => {
    setAstronautPreset("#f8fafc", "#16a34a", "#e5e7eb", "#050816", "#f8fafc", "#111827");
  });

  astronautFolder.addButton({ title: "Gold Team" }).on("click", () => {
    setAstronautPreset("#f8fafc", "#f59e0b", "#e5e7eb", "#050816", "#f8fafc", "#111827");
  });


  const actionsFolder = pane.addFolder({ title: "Actions" });

  const outputBinding = actionsFolder.addBinding(params, "transformOutput", {
    label: "Transform",
    disabled: true,
  });

  actionsFolder.addButton({ title: "Copy Transform" }).on("click", () => {
    copyTransform();
  });

  actionsFolder.addButton({ title: "Delete Selected" }).on("click", () => {
    deleteSelected();
  });


  function getSelectedBox(node: SceneNode) {
    node.root.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(node.root);
    if (box.isEmpty()) return null;
    return box;
  }

  function scaleSelectedBy(multiplier: number) {
    const node = selection.getSelected();
    if (!node) return;

    const safeMultiplier = Math.max(SCALE_MIN, Number(multiplier) || 1);
    node.root.scale.multiplyScalar(safeMultiplier);
    notifyObjectTransformChanged();
    syncParamsFromSelected();
    pane.refresh?.();
  }

  function fitSelectedToHeight(targetHeight: number) {
    const node = selection.getSelected();
    if (!node) return;

    const box = getSelectedBox(node);
    if (!box) return;

    const size = new THREE.Vector3();
    box.getSize(size);

    if (size.y <= 0) return;

    const factor = Math.max(SCALE_MIN, targetHeight / size.y);
    node.root.scale.multiplyScalar(factor);
    notifyObjectTransformChanged();
    syncParamsFromSelected();
    pane.refresh?.();
  }

  function fitSelectedToMaxXZ(targetWidth: number) {
    const node = selection.getSelected();
    if (!node) return;

    const box = getSelectedBox(node);
    if (!box) return;

    const size = new THREE.Vector3();
    box.getSize(size);
    const maxXZ = Math.max(size.x, size.z);

    if (maxXZ <= 0) return;

    const factor = Math.max(SCALE_MIN, targetWidth / maxXZ);
    node.root.scale.multiplyScalar(factor);
    notifyObjectTransformChanged();
    syncParamsFromSelected();
    pane.refresh?.();
  }

  function isAstronautNode(node: SceneNode | null) {
    if (!node) return false;

    const data = node.root.userData.dehlero ?? {};
    return data.isAstronaut === true || data.libraryId === "astronaut";
  }

  function getAstronautColorsFromNode(node: SceneNode) {
    const data = node.root.userData.dehlero ?? {};
    return data.astronautColors as
      | { body?: string; trim?: string; helmet?: string; visor?: string; gloves?: string; boots?: string }
      | undefined;
  }

  function syncAstronautParamsFromSelected() {
    const node = selection.getSelected();
    if (!node || !isAstronautNode(node)) return;

    const colors = getAstronautColorsFromNode(node);
    if (!colors) return;

    params.astronautBodyColor = colors.body ?? params.astronautBodyColor;
    params.astronautTrimColor = colors.trim ?? params.astronautTrimColor;
    params.astronautHelmetColor = colors.helmet ?? params.astronautHelmetColor;
    params.astronautVisorColor = colors.visor ?? params.astronautVisorColor;
    params.astronautGlovesColor = colors.gloves ?? params.astronautGlovesColor;
    params.astronautBootsColor = colors.boots ?? params.astronautBootsColor;
  }

  function applyAstronautColorParams() {
    const node = selection.getSelected();
    if (!node || !isAstronautNode(node)) return;

    applyAstronautTeamColors(node.root, {
      body: params.astronautBodyColor,
      trim: params.astronautTrimColor,
      helmet: params.astronautHelmetColor,
      visor: params.astronautVisorColor,
      gloves: params.astronautGlovesColor,
      boots: params.astronautBootsColor,
    });

    onSceneChange?.();
  }

  function setAstronautPreset(
    body: string,
    trim: string,
    helmet: string,
    visor: string,
    gloves: string,
    boots: string,
  ) {
    params.astronautBodyColor = body;
    params.astronautTrimColor = trim;
    params.astronautHelmetColor = helmet;
    params.astronautVisorColor = visor;
    params.astronautGlovesColor = gloves;
    params.astronautBootsColor = boots;
    applyAstronautColorParams();
    pane.refresh?.();
  }


  function makeDuplicateName(baseName: string) {
    const existing = new Set(registry.getAll().map((node) => node.name));
    let index = 1;
    let nextName = `${baseName} Copy`;

    while (existing.has(nextName)) {
      index += 1;
      nextName = `${baseName} Copy ${index}`;
    }

    return nextName;
  }

  function renameSelected(name: string) {
    const node = selection.getSelected();
    if (!node) return;

    const safeName = name.trim();

    if (!safeName) {
      params.objectName = node.name;
      pane.refresh?.();
      return;
    }

    node.name = safeName;
    node.root.name = safeName;

    refresh();
    onSceneChange?.();
    pane.refresh?.();
  }

  function duplicateSelected() {
    const node = selection.getSelected();
    if (!node) return;

    if (onDuplicateNode) {
      const duplicated = onDuplicateNode(node);

      if (duplicated) {
        selectNode(duplicated.id);
        onSceneChange?.();
      }

      return;
    }

    const cloneRoot = cloneObjectForEditing(node.root);
    const cloneName = makeDuplicateName(node.name);

    cloneRoot.name = cloneName;
    cloneRoot.position.copy(node.root.position).add(new THREE.Vector3(1, 0, 1));
    cloneRoot.rotation.copy(node.root.rotation);
    cloneRoot.scale.copy(node.root.scale);

    const cloneNode = createSceneNodeFromObject(cloneName, cloneRoot);
    cloneNode.metadata = JSON.parse(JSON.stringify(node.metadata ?? {}));
    cloneNode.visible = node.visible;
    cloneNode.locked = false;

    scene.add(cloneNode.root);
    registry.register(cloneNode);

    selectNode(cloneNode.id);
    onSceneChange?.();
  }

  function syncParamsFromSelected() {
    const node = selection.getSelected();
    if (!node) return;

    params.objectName = node.name;

    params.positionX = round(node.root.position.x);
    params.positionY = round(node.root.position.y);
    params.positionZ = round(node.root.position.z);

    params.rotationX = round(THREE.MathUtils.radToDeg(node.root.rotation.x));
    params.rotationY = round(THREE.MathUtils.radToDeg(node.root.rotation.y));
    params.rotationZ = round(THREE.MathUtils.radToDeg(node.root.rotation.z));

    params.scaleX = round(node.root.scale.x);
    params.scaleY = round(node.root.scale.y);
    params.scaleZ = round(node.root.scale.z);

    params.uniformScale = round(
      (node.root.scale.x + node.root.scale.y + node.root.scale.z) / 3,
    );

    syncAstronautParamsFromSelected();
  }

  function applyParamsToSelected() {
    const node = selection.getSelected();
    if (!node) return;

    node.root.position.set(
      Number(params.positionX) || 0,
      Number(params.positionY) || 0,
      Number(params.positionZ) || 0,
    );

    node.root.rotation.set(
      THREE.MathUtils.degToRad(Number(params.rotationX) || 0),
      THREE.MathUtils.degToRad(Number(params.rotationY) || 0),
      THREE.MathUtils.degToRad(Number(params.rotationZ) || 0),
    );

    node.root.scale.set(
      Math.max(SCALE_MIN, Number(params.scaleX) || 1),
      Math.max(SCALE_MIN, Number(params.scaleY) || 1),
      Math.max(SCALE_MIN, Number(params.scaleZ) || 1),
    );

    notifyObjectTransformChanged();
  }

  function copyTransform() {
    const node = selection.getSelected();
    if (!node) return;

    const p = node.root.position;
    const r = node.root.rotation;
    const s = node.root.scale;

    params.transformOutput = `
${node.name}.position.set(${round(p.x)}, ${round(p.y)}, ${round(p.z)});

${node.name}.rotation.set(
  THREE.MathUtils.degToRad(${round(THREE.MathUtils.radToDeg(r.x))}),
  THREE.MathUtils.degToRad(${round(THREE.MathUtils.radToDeg(r.y))}),
  THREE.MathUtils.degToRad(${round(THREE.MathUtils.radToDeg(r.z))}),
);

${node.name}.scale.set(${round(s.x)}, ${round(s.y)}, ${round(s.z)});
`.trim();

    outputBinding.refresh?.();
  }

  function refresh() {
    const selectedId = selection.getSelectedId() ?? "";
    const options = createNodeOptions();
    const nextOptionsSignature = JSON.stringify(options);

    params.selectedNodeId = selectedId;

    syncParamsFromSelected();

    if (nextOptionsSignature !== nodeOptionsSignature) {
      nodeOptionsSignature = nextOptionsSignature;
      rebuildNodeBindingSafely(options);
    }

    nodeBinding.refresh?.();
    outputBinding.refresh?.();
    pane.refresh?.();
  }

  function selectNode(id: string) {
    const node = registry.get(id);
    if (!node) return;

    params.selectedNodeId = id;

    selection.select(node);
    controls.attach(node.root);

    syncParamsFromSelected();
    refresh();

    onSelectionChange?.(node);
    pane.refresh?.();
  }

  function clearSelection() {
    controls.detach();

    selection.clear();
    params.selectedNodeId = "";

    refresh();

    onSelectionChange?.(null);
    pane.refresh?.();
  }

  function selectFallback() {
    const nextNode = getEditableNodes()[0];

    if (nextNode) {
      selectNode(nextNode.id);
      return;
    }

    clearSelection();
  }

  function deleteSelected() {
    const node = selection.getSelected();
    if (!node) return;

    controls.detach();

    onDeleteNode?.(node);

    selection.clear();
    params.transformOutput = "";

    refresh();
    selectFallback();

    onSceneChange?.();
  }

  window.addEventListener("keydown", (event) => {
    const target = event.target;
    const isTyping =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement;

    if (!isTyping) {
      if (event.key.toLowerCase() === "w") controls.setMode("translate");
      if (event.key.toLowerCase() === "e") controls.setMode("rotate");
      if (event.key.toLowerCase() === "r") controls.setMode("scale");

      if (event.key === "Delete") {
        event.preventDefault();
        deleteSelected();
      }
    }
  });

  refresh();

  function getEditableNodes() {
    return registry
      .getAll()
      .filter(
        (node) =>
          (node.metadata.source as { type?: string })?.type !== "ambient",
      );
  }

  return {
    controls,

    refresh,

    selectNode,

    clearSelection,

    deleteSelected,

    duplicateSelected,

    renameSelected,

    getSelectedNode() {
      return selection.getSelected();
    },
  };
}
