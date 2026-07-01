import * as THREE from "three";
import CameraControls from "camera-controls";
import { SceneRegistry } from "../core/scene/SceneRegistry";
import { SelectionManager } from "../editor/SelectionManager";
import type { SceneNode } from "../core/scene/SceneNode";

export type StudioContext = {
  root: HTMLElement;

  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;

  studioCamera: THREE.PerspectiveCamera;
  activeRenderCamera: THREE.PerspectiveCamera;

  controls: CameraControls;

  registry: SceneRegistry;
  selection: SelectionManager;

  getSelectedNode: () => SceneNode | null;
  resize: () => void;
  setStatus: (message: string) => void;
};
