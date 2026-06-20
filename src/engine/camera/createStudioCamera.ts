import * as THREE from "three";

export function createStudioCamera() {
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    3000
  );

  camera.position.set(6, 4, 8);
  return camera;
}
