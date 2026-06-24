import * as THREE from "three";
import CameraControls from "camera-controls";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { Pane } from "tweakpane";

import type { SceneNode } from "../core/scene/SceneNode";
import type { SceneRegistry } from "../core/scene/SceneRegistry";
import type { SelectionManager } from "./SelectionManager";

type PaneApi = {
  addBinding: (
    object: Record<string, unknown>,
    key: string,
    options?: Record<string, unknown>,
  ) => {
    dispose: () => void;
    on: (eventName: "change", callback: (event: { value: unknown }) => void) => void;
    refresh?: () => void;
  };
  addButton: (options: { title: string }) => {
    on: (eventName: "click", callback: () => void) => void;
  };
  addFolder: (options: { title: string }) => PaneApi;
  refresh?: () => void;
};

function round(value: number) {
  return Number(value.toFixed(4));
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
  onSelectionChange,
}: {
  root: HTMLElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  cameraControls: CameraControls;
  registry: SceneRegistry;
  selection: SelectionManager;
  onDeleteNode?: (node: SceneNode) => void;
  onSelectionChange?: (node: SceneNode | null) => void;
}) {
  const controls = new TransformControls(camera, renderer.domElement);
  controls.setMode("translate");
  controls.setSize(0.9);
  const params = {
    selectedNodeId: "",
    transformOutput: "",
  };

  const helper =
    "getHelper" in controls
      ? controls.getHelper()
      : (controls as unknown as THREE.Object3D);

  scene.add(helper);

  controls.addEventListener("dragging-changed", (event) => {
    cameraControls.enabled = !(event as any).value;
  });

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

  const actionsFolder = pane.addFolder({ title: "Actions" });
  const outputBinding = actionsFolder.addBinding(params, "transformOutput", {
    label: "Transform",
    disabled: true,
  });

  function refresh() {
    const options = getEditableNodes().reduce<Record<string, string>>(
      (acc, node) => {
        acc[node.name] = node.id;
        return acc;
      },
      { None: "" },
    );

    nodeBinding.dispose();
    nodeBinding = pane.addBinding(params, "selectedNodeId", {
      label: "Object",
      options,
    });

    nodeBinding.on("change", (event) => {
      const value = String(event.value);

      if (!value) {
        clearSelection();
        return;
      }

      selectNode(value);
    });

    pane.refresh?.();
  }

 function selectNode(id: string) {
   const node = registry.get(id);

   if (!node) return;

   params.selectedNodeId = id;

   selection.select(node);

   controls.attach(node.root);

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
    registry.unregister(node.id);
    selection.clear();
    params.transformOutput = "";
    refresh();
    selectFallback();
  }

  actionsFolder.addButton({ title: "Copy Transform" }).on("click", () => {
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
  });

  actionsFolder.addButton({ title: "Delete Selected" }).on("click", () => {
    deleteSelected();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "w") controls.setMode("translate");
    if (event.key.toLowerCase() === "e") controls.setMode("rotate");
    if (event.key.toLowerCase() === "r") controls.setMode("scale");

    const target = event.target;
    const isTyping =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement;

    if (!isTyping && (event.key === "Delete" || event.key === "Backspace")) {
      event.preventDefault();
      deleteSelected();
    }
  });

  refresh();

  function getEditableNodes() {
    return registry
      .getAll()
      .filter((node) => (node.metadata.source as { type?: string })?.type !== "ambient");
  }

  return {
  controls,

  refresh,

  selectNode,

  clearSelection,

  deleteSelected,

  getSelectedNode() {
    return selection.getSelected();
  },
};
}
