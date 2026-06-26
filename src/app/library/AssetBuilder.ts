import * as THREE from "three";
import type { AssetManifest } from "./AssetManifestTypes";

export interface AssetBuildContext {
  manifest: AssetManifest;
  manifestPath: string;
}

export interface AssetBuilder {
  readonly type: string;

  build(context: AssetBuildContext): Promise<THREE.Object3D> | THREE.Object3D;
}
