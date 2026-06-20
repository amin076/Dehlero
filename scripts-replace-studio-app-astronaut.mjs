import fs from "fs";

const content = `
import * as THREE from "three";
import CameraControls from "camera-controls";
import studio from "@theatre/studio";
import { getProject } from "@theatre/core";

import { loadGLB } from "../assets/core/loadGLB";
import { createRenderer } from "../engine/renderer/createRenderer";
import { createScene } from "../engine/scene/createScene";
import { createStudioCamera } from "../engine/camera/createStudioCamera";
import { createLightingRig } from "../engine/lighting/createLightingRig";
import { createSafeAreaOverlay } from "../studio/overlays/createSafeAreaOverlay";
import { createRecordingControls } from "../studio/recording/createRecordingControls";

CameraControls.install({ THREE });

const theatreStudio = (studio as any).default ?? studio;
theatreStudio.initialize();

function createModeToggle(root: HTMLElement, theatreStudio: any) {
  const button = document.createElement("button");
  button.className = "mode-toggle";
  button.textContent = "Record Mode";

  let recordMode = false;

  button.onclick = () => {
    recordMode = !recordMode;

    if (recordMode) {
      theatreStudio.ui.hide();
      button.textContent = "Author Mode";
      document.body.classList.add("record-mode");
    } else {
      theatreStudio.ui.show();
      button.textContent = "Record Mode";
      document.body.classList.remove("record-mode");
    }
  };

  root.appendChild(button);
}

function fitObjectToView(object: THREE.Object3D, camera: THREE.PerspectiveCamera) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();

  box.getSize(size);
  box.getCenter(center);

  object.position.sub(center);

  const maxSize = Math.max(size.x, size.y, size.z);
  const scale = maxSize > 0 ? 3 / maxSize : 1;

  object.scale.multiplyScalar(scale);

  camera.position.set(0, 2.2, 7);
  camera.lookAt(0, 0, 0);
}

export async function createStudioApp({ root }: { root: HTMLDivElement }) {
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
  createSafeAreaOverlay(root);
  createRecordingControls(root, renderer.domElement);
  createModeToggle(root, theatreStudio);

  const gltf = await loadGLB("/assets/astronomy/spacecraft/astronaut.glb");
  console.log("GLTF loaded:", gltf);

  const loadedObject = gltf.scene;
  loadedObject.name = "Astronaut";

  fitObjectToView(loadedObject, camera);
  scene.add(loadedObject);

  controls.setLookAt(0, 2.2, 7, 0, 0, 0, false);

  const project = getProject("Dehlero");
  const sheet = project.sheet("Main Scene");

  const theatreObject = sheet.object("Astronaut", {
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    rotationY: 0,
    scale: 1,
  });

  theatreObject.onValuesChange((values) => {
    loadedObject.position.set(
      values.positionX,
      values.positionY,
      values.positionZ
    );

    loadedObject.rotation.y = values.rotationY;
    loadedObject.scale.setScalar(values.scale);
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
    loadedObject,
  };
}
`;

fs.writeFileSync("src/app/createStudioApp.ts", content.trimStart(), "utf8");

console.log("createStudioApp.ts replaced with Astronaut GLB version.");
