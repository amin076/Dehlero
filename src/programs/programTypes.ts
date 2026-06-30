import * as THREE from "three";

export type ProgramRuntimeBindings = Record<string, THREE.Object3D | null>;

export type ProgramContext = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  setStatus?: (message: string) => void;
  runtimeBindings?: ProgramRuntimeBindings;
};

export type ProgramInstance = {
  play: () => void;
  stop: () => void;
  update: (delta: number) => void;
};

export type ProgramDefinition = {
  id: string;
  name: string;
  description: string;
  create: (context: ProgramContext) => ProgramInstance;
};