import * as THREE from "three";
import type { AssetBuildContext } from "./AssetBuilder";
import type { RegisteredAsset } from "./AssetRegistry";
import { PlanetBuilder } from "./builders/PlanetBuilder";

const builders = new Map<string, PlanetBuilder>();

builders.set("procedural-planet", new PlanetBuilder());

export class AssetFactory {
  static build(asset: RegisteredAsset): THREE.Object3D {
    const builder = builders.get(asset.manifest.type);

    if (!builder) {
      throw new Error(
        `No builder registered for asset type "${asset.manifest.type}"`,
      );
    }

    const context: AssetBuildContext = {
      manifest: asset.manifest,
      manifestPath: asset.manifestPath,
    };

    return builder.build(context);
  }

  static register(type: string, builder: PlanetBuilder) {
    builders.set(type, builder);
  }

  static has(type: string) {
    return builders.has(type);
  }

  static getTypes() {
    return [...builders.keys()];
  }
}
