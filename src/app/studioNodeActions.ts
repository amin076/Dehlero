import * as THREE from "three";
import type { SceneNode } from "../core/scene/SceneNode";
import type { NodeSource, SceneHelper, TheatreBinding } from "./studioTypes";
import { disposeObject } from "./studioObjectUtils";

export function isEditableNode(node: SceneNode) {
  return (node.metadata.source as NodeSource)?.type !== "ambient";
}

export function getEditableNodes(nodes: SceneNode[]) {
  return nodes.filter(isEditableNode);
}

export function findSceneNodeByName({
  name,
  nodes,
}: {
  name?: string;
  nodes: SceneNode[];
}) {
  if (!name) return null;

  return getEditableNodes(nodes).find((node) => node.name === name) ?? null;
}

export function getSceneCameraNodes(nodes: SceneNode[]) {
  return getEditableNodes(nodes).filter(
    (node) => node.root instanceof THREE.PerspectiveCamera,
  );
}

export function getCameraOptions(nodes: SceneNode[]) {
  return [
    { id: "main", label: "Main View" },
    ...getSceneCameraNodes(nodes).map((node) => ({
      id: node.id,
      label: node.name,
    })),
  ];
}

export function getActiveRenderCamera({
  activeRenderCameraId,
  mainCamera,
  getNode,
}: {
  activeRenderCameraId: string;
  mainCamera: THREE.PerspectiveCamera;
  getNode: (id: string) => SceneNode | undefined;
}) {
  if (activeRenderCameraId === "main") return mainCamera;

  const node = getNode(activeRenderCameraId);

  return node?.root instanceof THREE.PerspectiveCamera
    ? node.root
    : mainCamera;
}

export function getCameraByName({
  name,
  mainCamera,
  nodes,
}: {
  name: string;
  mainCamera: THREE.PerspectiveCamera;
  nodes: SceneNode[];
}) {
  if (name === "Main View") return mainCamera;

  const node = findSceneNodeByName({ name, nodes });

  return node?.root instanceof THREE.PerspectiveCamera
    ? node.root
    : mainCamera;
}

export function getTheatreCameraByName({
  name,
  theatreMainCamera,
  nodes,
  theatreBindings,
}: {
  name: string;
  theatreMainCamera: unknown;
  nodes: SceneNode[];
  theatreBindings: Map<string, TheatreBinding>;
}) {
  if (name === "Main View") return theatreMainCamera;

  const node = findSceneNodeByName({ name, nodes });

  return node ? theatreBindings.get(node.id)?.theatreObject ?? null : null;
}

export function deleteSceneNode({
  node,
  helpers,
  unregisterTheatreObject,
  unregisterNode,
  setActiveRenderCameraId,
  refreshAfterDelete,
}: {
  node: SceneNode;
  helpers: Map<string, SceneHelper>;
  unregisterTheatreObject: (node: SceneNode) => void;
  unregisterNode: (nodeId: string) => void;
  setActiveRenderCameraId: (cameraId: string) => void;
  refreshAfterDelete: () => void;
}) {
  const helper = helpers.get(node.id);

  unregisterTheatreObject(node);

  if (helper) {
    helper.removeFromParent();
    disposeObject(helper);
    helpers.delete(node.id);
  }

  node.root.removeFromParent();
  disposeObject(node.root);
  unregisterNode(node.id);

  setActiveRenderCameraId("main");
  refreshAfterDelete();
}
