import * as THREE from "three";

export interface SceneNode {
  id: string;
  name: string;

  root: THREE.Object3D;
  visual?: THREE.Object3D;

  metadata: Record<string, unknown>;

  parentId: string | null;
  childrenIds: string[];

  visible: boolean;
  locked: boolean;
}


let nextId = 1;

export function createSceneNode(
  name: string,
  visual?: THREE.Object3D,
): SceneNode {
  const root = new THREE.Group();

  root.name = name;

  if (visual) {
    root.add(visual);
  }

  return {
    id: `node-${nextId++}`,
    name,

    root,
    visual,

    metadata: {},

    parentId: null,
    childrenIds: [],

    visible: true,
    locked: false,
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

    parentId: null,
    childrenIds: [],

    visible: true,
    locked: false,
  };
}
