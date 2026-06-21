import * as THREE from "three";
import CameraControls from "camera-controls";
import studio from "@theatre/studio";
import { getProject } from "@theatre/core";

import { createRenderer } from "../engine/renderer/createRenderer";
import { createScene } from "../engine/scene/createScene";
import { createStudioCamera } from "../engine/camera/createStudioCamera";
import { createLightingRig } from "../engine/lighting/createLightingRig";
import { createSafeAreaOverlay } from "../studio/overlays/createSafeAreaOverlay";
import { createRecordingControls } from "../studio/recording/createRecordingControls";
import { createTitanWorldCup3026Scene } from "../scenes/titanWorldCup3026/createTitanWorldCup3026Scene";

CameraControls.install({ THREE });

const theatreStudio = (studio as any).default ?? studio;
theatreStudio.initialize();

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

  createLightingRig(scene);

  const hemiLight = new THREE.HemisphereLight("#d28a45", "#21100a", 1.8);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight("#ffd2a0", 3.2);
  sunLight.position.set(-12, 18, 10);
  scene.add(sunLight);

  const rimLight = new THREE.DirectionalLight("#ff9d4d", 1.6);
  rimLight.position.set(16, 8, -18);
  scene.add(rimLight);

  createSafeAreaOverlay(root);
  createRecordingControls(root, renderer.domElement);

  const titanTrailer = createTitanWorldCup3026Scene(scene);

  camera.position.set(0, 4.2, 18);
  camera.lookAt(0, 1, -10);
  controls.setLookAt(0, 4.2, 18, 0, 1, -10, false);

  const project = getProject("Dehlero");
  const sheet = project.sheet("Titan World Cup 3026");

  function updateCamera(t: number) {
    if (t < 6) {
      const k = t / 6;
      controls.setLookAt(
        THREE.MathUtils.lerp(0, -3.5, k),
        THREE.MathUtils.lerp(4.2, 2.2, k),
        THREE.MathUtils.lerp(18, 9, k),
        THREE.MathUtils.lerp(0, -2, k),
        0.5,
        THREE.MathUtils.lerp(-10, 0, k),
        false,
      );
      camera.fov = THREE.MathUtils.lerp(46, 36, k);
    } else if (t < 16) {
      const k = (t - 6) / 10;
      controls.setLookAt(
        THREE.MathUtils.lerp(-3.5, 5.5, k),
        THREE.MathUtils.lerp(2.2, 3.8, k),
        THREE.MathUtils.lerp(9, -8, k),
        titanTrailer.ball.position.x,
        titanTrailer.ball.position.y,
        titanTrailer.ball.position.z,
        false,
      );
      camera.fov = THREE.MathUtils.lerp(36, 30, k);
    } else if (t < 24) {
      const k = (t - 16) / 8;
      controls.setLookAt(
        THREE.MathUtils.lerp(5.5, 0, k),
        THREE.MathUtils.lerp(3.8, 6.5, k),
        THREE.MathUtils.lerp(-8, 20, k),
        THREE.MathUtils.lerp(titanTrailer.ball.position.x, 8, k),
        THREE.MathUtils.lerp(titanTrailer.ball.position.y, 3, k),
        THREE.MathUtils.lerp(titanTrailer.ball.position.z, -28, k),
        false,
      );
      camera.fov = THREE.MathUtils.lerp(30, 38, k);
    } else {
      const k = Math.min((t - 24) / 6, 1);
      controls.setLookAt(
        THREE.MathUtils.lerp(0, 0, k),
        THREE.MathUtils.lerp(6.5, 7.5, k),
        THREE.MathUtils.lerp(20, 24, k),
        0,
        5,
        -22,
        false,
      );
      camera.fov = THREE.MathUtils.lerp(38, 34, k);
    }

    camera.updateProjectionMatrix();
  }

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

    titanTrailer.update(elapsed);
    updateCamera(elapsed);

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
    project,
    sheet,
  };
}
