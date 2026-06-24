import * as THREE from "three";
import type { SceneNode } from "../core/scene/SceneNode";
import type { NodeSource } from "./studioTypes";

export function findNodeFromObject(
  object: THREE.Object3D,
  nodes: SceneNode[],
) {
  return nodes
    .filter(
      (node) =>
        (node.metadata.source as NodeSource)?.type !== "ambient",
    )
    .find(
      (node) =>
        node.root === object ||
        node.root.children.includes(object) ||
        node.root.getObjectById(object.id),
    );
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
  const rect = renderer.domElement.getBoundingClientRect();

  pointer.x =
    ((event.clientX - rect.left) / rect.width) * 2 - 1;

  pointer.y =
    -((event.clientY - rect.top) / rect.height) * 2 + 1;

  const selectableNodes = nodes.filter(
    (node) =>
      (node.metadata.source as NodeSource)?.type !== "ambient",
  );

  raycaster.setFromCamera(pointer, camera);

  const intersects = raycaster.intersectObjects(
    selectableNodes.map((node) => node.root),
    true,
  );

  if (intersects.length === 0) {
    return null;
  }

  return findNodeFromObject(
    intersects[0].object,
    selectableNodes,
  );
}

export function attachPickingEvents({
  renderer,
  pointerDown,
  didDragTransform,
  setDidDragTransform,
  selectNode,
  clearSelection,
  deleteNode,
  pickNode,
}: {
  renderer: THREE.WebGLRenderer;
  pointerDown: THREE.Vector2;
  didDragTransform: boolean;
  setDidDragTransform: (value: boolean) => void;
  selectNode: (nodeId: string) => void;
  clearSelection: () => void;
  deleteNode: (nodeId: string) => void;
  pickNode: (event: PointerEvent) => SceneNode | null;
}) {
  renderer.domElement.addEventListener(
    "pointerdown",
    (event) => {
      pointerDown.set(event.clientX, event.clientY);
      setDidDragTransform(false);
    },
  );

  renderer.domElement.addEventListener(
    "pointerup",
    (event) => {
      if (event.button !== 0) return;
      if (didDragTransform) return;

      if (
        pointerDown.distanceTo(
          new THREE.Vector2(
            event.clientX,
            event.clientY,
          ),
        ) > 4
      ) {
        return;
      }

      const node = pickNode(event);

      if (node) {
        selectNode(node.id);
        return;
      }

      clearSelection();
    },
  );

  renderer.domElement.addEventListener(
    "contextmenu",
    (event) => {
      event.preventDefault();

      const node = pickNode(event);

      if (!node) return;

      selectNode(node.id);
      deleteNode(node.id);
    },
  );
}
