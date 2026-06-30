import * as THREE from "three";

import type { SceneNode } from "../core/scene/SceneNode";
import type { NodeSource } from "./studioTypes";

export function findNodeFromObject(
  object: THREE.Object3D,
  nodes: SceneNode[],
) {
  let current: THREE.Object3D | null = object;

  while (current) {
    const match = nodes.find((node) => node.root === current);

    if (match) {
      return match;
    }

    current = current.parent;
  }

  return null;
}

export function pickNode({
  event,
  renderer,
  camera,
  raycaster,
  pointer,
  nodes,
}: {
  event: PointerEvent;
  renderer: THREE.WebGLRenderer;
  camera: THREE.Camera;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  nodes: SceneNode[];
}) {
  const selectableNodes = nodes.filter(
    (node) =>
      !node.locked &&
      node.visible !== false &&
      (node.metadata.source as NodeSource)?.type !== "ambient",
  );

  const rect = renderer.domElement.getBoundingClientRect();

  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  const roots = selectableNodes.map((node) => node.root);

  const intersects = raycaster.intersectObjects(roots, true);

  if (intersects.length === 0) {
    return null;
  }

  for (const hit of intersects) {
    const node = findNodeFromObject(hit.object, selectableNodes);

    if (node) {
      return node;
    }
  }

  return null;
}

export function attachPickingEvents({
  renderer,
  pointerDown,
  didDragTransform,
  setDidDragTransform,
  selectNode,
  clearSelection,
  pickNode,
}: {
  renderer: THREE.WebGLRenderer;
  pointerDown: THREE.Vector2;
  didDragTransform: boolean;
  setDidDragTransform: (value: boolean) => void;
  selectNode: (nodeId: string) => void;
  clearSelection: () => void;
  pickNode: (event: PointerEvent) => SceneNode | null;
}) {
  renderer.domElement.addEventListener("pointerdown", (event) => {
    pointerDown.set(event.clientX, event.clientY);
    setDidDragTransform(false);
  });

  renderer.domElement.addEventListener("pointerup", (event) => {
    if (event.button !== 0) return;
    if (didDragTransform) return;

    const moved =
      pointerDown.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) >
      4;

    if (moved) {
      return;
    }

    const node = pickNode(event);

    if (node) {
      selectNode(node.id);
      return;
    }

    clearSelection();
  });

  renderer.domElement.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
}