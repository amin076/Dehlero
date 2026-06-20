import * as THREE from "three";

export type LightingRig = {
  key: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
};

export function createLightingRig(scene: THREE.Scene): LightingRig {
  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.position.set(12, 18, 10);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x4466ff, 1.2);
  fill.position.set(-10, -8, -6);
  scene.add(fill);

  const ambient = new THREE.AmbientLight(0xffffff, 0.18);
  scene.add(ambient);

  return { key, fill, ambient };
}
