import fs from "fs";

const content = `
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
import { createCameraPanel } from "../studio/controls/createCameraPanel";
import { createLightingPanel } from "../studio/controls/createLightingPanel";

CameraControls.install({ THREE });
studio.initialize();

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

  const lighting = createLightingRig(scene);
  createSafeAreaOverlay(root);
  createRecordingControls(root, renderer.domElement);
  createCameraPanel({ root, camera, controls });
  createLightingPanel(root, lighting);

  const testObject = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.45,
      roughness: 0.35,
    })
  );

  scene.add(testObject);

  const project = getProject("Dehlero");
  const sheet = project.sheet("Main Scene");

  const cubeObj = sheet.object("Test Cube", {
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    rotationY: 0,
  });

  cubeObj.onValuesChange((values) => {
    testObject.position.set(
      values.positionX,
      values.positionY,
      values.positionZ
    );

    testObject.rotation.y = values.rotationY;
  });

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
`;

fs.writeFileSync("src/app/createStudioApp.ts", content.trimStart(), "utf8");

console.log("Theatre.js connected to Dehlero.");
