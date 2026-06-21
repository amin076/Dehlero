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

  const project = getProject("Dehlero");
  const sheet = project.sheet("Titan World Cup 3026");

  (sheet.sequence as any).pointer.length = 30;

  const cameraObj = sheet.object("Camera", {
    position: {
      x: 0,
      y: 4.2,
      z: 18,
    },
    target: {
      x: 0,
      y: 1,
      z: -10,
    },
    fov: 36,
  });

  cameraObj.onValuesChange((v) => {
    controls.setLookAt(
      v.position.x,
      v.position.y,
      v.position.z,
      v.target.x,
      v.target.y,
      v.target.z,
      false,
    );

    camera.fov = v.fov;
    camera.updateProjectionMatrix();
  });

  function playTrailer(iterationCount: number) {
    sheet.sequence.position = 0;
    sheet.sequence.play({ iterationCount });
  }

  function resetTrailer() {
    sheet.sequence.position = 0;
  }

  function createTrailerControls() {
    const panel = document.createElement("div");
    panel.className = "trailer-controls";

    panel.innerHTML = `
      <button id="trailer-reset">Reset</button>
      <button id="trailer-play">Play Trailer</button>
      <button id="trailer-loop">Loop</button>
    `;

    root.appendChild(panel);

    panel.querySelector<HTMLButtonElement>("#trailer-reset")!.onclick =
      resetTrailer;

    panel.querySelector<HTMLButtonElement>("#trailer-play")!.onclick = () => {
      playTrailer(1);
    };

    panel.querySelector<HTMLButtonElement>("#trailer-loop")!.onclick = () => {
      playTrailer(Infinity);
    };
  }

  createTrailerControls();

  (window as any).dehlero = {
    sheet,
    play: () => playTrailer(1),
    loop: () => playTrailer(Infinity),
    reset: resetTrailer,
    jump: (t: number) => {
      sheet.sequence.position = t;
    },
  };

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
    const trailerTime = sheet.sequence.position;

    titanTrailer.update(trailerTime);

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
