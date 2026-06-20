import * as THREE from "three";
import CameraControls from "camera-controls";

import { createRenderer } from "../engine/renderer/createRenderer";
import { createScene } from "../engine/scene/createScene";
import { createStudioCamera } from "../engine/camera/createStudioCamera";
import { addDefaultLighting } from "../engine/lighting/addDefaultLighting";
import { createSafeAreaOverlay } from "../studio/overlays/createSafeAreaOverlay";
import { createRecordingControls } from "../studio/recording/createRecordingControls";

CameraControls.install({ THREE });

export function createStudioApp({ root }: { root: HTMLDivElement }) {
  root.innerHTML = "";

  const viewport = document.createElement("div");
  viewport.className = "dehlero-viewport";
  root.appendChild(viewport);

  const scene = createScene();
  const camera = createStudioCamera();
  const renderer = createRenderer();

  viewport.appendChild(renderer.domElement);

  const clock = new THREE.Clock();
  const controls = new CameraControls(camera, renderer.domElement);

  addDefaultLighting(scene);
  createSafeAreaOverlay(root);
  createRecordingControls(root, renderer.domElement);

  const testObject = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.45,
      roughness: 0.35,
    })
  );

  scene.add(testObject);

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
  }

  function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    testObject.rotation.y = elapsed * 0.4;

    controls.update(delta);
    renderer.render(scene, camera);
  }

  resize();
  window.addEventListener("resize", resize);
  animate();

  return {
    scene,
    camera,
    renderer,
    controls,
  };
}
