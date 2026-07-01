import * as THREE from "three";
import type { AssetBuildContext, AssetBuilder } from "../AssetBuilder";
import { resolveAssetPath } from "../AssetManifestLoader";
import { createSaturnRings } from "../../../assets/astronomy/createSaturnRings";

const textureLoader = new THREE.TextureLoader();

export class PlanetBuilder implements AssetBuilder {
  readonly type = "procedural-planet";

  build(context: AssetBuildContext): THREE.Object3D {
    const { manifest, manifestPath } = context;

    const group = new THREE.Group();
    group.name = manifest.name;

    const radius =
      typeof manifest.visual?.radius === "number" ? manifest.visual.radius : 1;

    const segments =
      typeof manifest.visual?.segments === "number"
        ? manifest.visual.segments
        : 96;

    const albedoPath = resolveAssetPath(
      manifestPath,
      manifest.textures?.albedo,
    );

    const texture = albedoPath ? textureLoader.load(albedoPath) : null;

    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
    }

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(radius, segments, Math.max(32, segments / 2)),
      new THREE.MeshStandardMaterial({
        map: texture ?? undefined,
        color: texture ? "#ffffff" : "#8eb7ff",
        roughness: 0.92,
        metalness: 0,
      }),
    );

    body.name = `${manifest.name} Body`;
    body.castShadow = true;
    body.receiveShadow = true;

    group.add(body);

    if (manifest.components?.rings) {
      const rings = createSaturnRings(radius);
      rings.name = `${manifest.name} Rings`;
      rings.rotation.x = Math.PI * 0.5;
      rings.rotation.z = 0;
      group.add(rings);
    }

    const scale = manifest.defaultTransform?.scale ?? [1, 1, 1];
    group.scale.set(scale[0], scale[1], scale[2]);

    const position = manifest.defaultTransform?.position ?? [0, 0, 0];
    group.position.set(position[0], position[1], position[2]);

    const rotation = manifest.defaultTransform?.rotation ?? [0, 0, 0];
    group.rotation.set(rotation[0], rotation[1], rotation[2]);

    return group;
  }
}
