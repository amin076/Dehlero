import * as THREE from "three";

export interface SceneNode {
  id: string;
  name: string;
  root: THREE.Object3D;
  visual?: THREE.Object3D;
  metadata: Record<string, unknown>;
}

let nextId = 1;

export function createSceneNode(
  name: string,
  visual?: THREE.Object3D,
): SceneNode {
  const root = new THREE.Group();
  root.name = name;

  if (visual) root.add(visual);

  return {
    id: `node-${nextId++}`,
    name,
    root,
    visual,
    metadata: {},
  };
}

export function createSceneNodeFromObject(
  name: string,
  object: THREE.Object3D,
): SceneNode {
  object.name = name;

  return {
    id: `node-${nextId++}`,
    name,
    root: object,
    visual: object,
    metadata: {},
  };
}
