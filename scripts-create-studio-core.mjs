import fs from "fs";
import path from "path";

const folders = [
  "src/app",
  "src/engine/renderer",
  "src/engine/scene",
  "src/engine/camera",
  "src/engine/lighting",
  "src/studio/overlays",
  "src/studio/recording",
  "src/studio/controls",
];

for (const folder of folders) {
  fs.mkdirSync(folder, { recursive: true });
}

const files = {
  "src/main.ts": `
import "./style.css";
import { createStudioApp } from "./app/createStudioApp";

createStudioApp({
  root: document.querySelector<HTMLDivElement>("#app")!,
});
`,

  "src/app/createStudioApp.ts": `
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
`,

  "src/engine/renderer/createRenderer.ts": `
import * as THREE from "three";

export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor("#030409");

  return renderer;
}
`,

  "src/engine/scene/createScene.ts": `
import * as THREE from "three";

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#030409");
  return scene;
}
`,

  "src/engine/camera/createStudioCamera.ts": `
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
`,

  "src/engine/lighting/addDefaultLighting.ts": `
import * as THREE from "three";

export function addDefaultLighting(scene: THREE.Scene) {
  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.position.set(12, 18, 10);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x4466ff, 1.2);
  fill.position.set(-10, -8, -6);
  scene.add(fill);

  scene.add(new THREE.AmbientLight(0xffffff, 0.18));
}
`,

  "src/studio/overlays/createSafeAreaOverlay.ts": `
export function createSafeAreaOverlay(root: HTMLElement) {
  const overlay = document.createElement("div");
  overlay.className = "safe-area-overlay";
  overlay.innerHTML = \`
    <div class="safe-area-frame">
      <span>9:16 Safe Area</span>
    </div>
  \`;

  root.appendChild(overlay);
  return overlay;
}
`,

  "src/studio/recording/createRecordingControls.ts": `
export function createRecordingControls(root: HTMLElement, canvas: HTMLCanvasElement) {
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];

  const panel = document.createElement("div");
  panel.className = "recording-panel";

  const startButton = document.createElement("button");
  startButton.textContent = "Start Recording";

  const stopButton = document.createElement("button");
  stopButton.textContent = "Stop Recording";

  stopButton.disabled = true;

  startButton.onclick = () => {
    chunks = [];

    const stream = canvas.captureStream(60);

    recorder = new MediaRecorder(stream, {
      mimeType: "video/webm; codecs=vp9",
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "dehlero-recording.webm";
      a.click();

      URL.revokeObjectURL(url);
    };

    recorder.start();

    startButton.disabled = true;
    stopButton.disabled = false;
  };

  stopButton.onclick = () => {
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    startButton.disabled = false;
    stopButton.disabled = true;
  };

  panel.appendChild(startButton);
  panel.appendChild(stopButton);
  root.appendChild(panel);

  return panel;
}
`,

  "src/style.css": `
html,
body,
#app {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: #030409;
  font-family: system-ui, sans-serif;
}

.dehlero-viewport {
  position: fixed;
  inset: 0;
  background: #030409;
}

canvas {
  display: block;
}

.safe-area-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  display: grid;
  place-items: center;
}

.safe-area-frame {
  width: min(42vh, 94vw);
  aspect-ratio: 9 / 16;
  border: 2px dashed rgba(255, 255, 255, 0.42);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.18);
  position: relative;
}

.safe-area-frame span {
  position: absolute;
  top: 8px;
  left: 8px;
  color: white;
  font-size: 12px;
  opacity: 0.75;
  background: rgba(0, 0, 0, 0.45);
  padding: 4px 6px;
  border-radius: 6px;
}

.recording-panel {
  position: fixed;
  z-index: 10;
  left: 16px;
  top: 16px;
  display: flex;
  gap: 8px;
}

.recording-panel button {
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  background: rgba(15, 18, 30, 0.85);
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
}

.recording-panel button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
`,
};

for (const [file, content] of Object.entries(files)) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.trimStart(), "utf8");
}

if (fs.existsSync("src/counter.ts")) {
  fs.rmSync("src/counter.ts");
}

console.log("Dehlero Studio Core created.");
