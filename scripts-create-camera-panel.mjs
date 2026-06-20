import fs from "fs";
import path from "path";

const files = {
  "src/studio/controls/createCameraPanel.ts": `
import * as THREE from "three";
import CameraControls from "camera-controls";

type CameraPanelOptions = {
  root: HTMLElement;
  camera: THREE.PerspectiveCamera;
  controls: CameraControls;
};

export function createCameraPanel({ root, camera, controls }: CameraPanelOptions) {
  const panel = document.createElement("div");
  panel.className = "camera-panel";

  panel.innerHTML = \`
    <h3>Camera</h3>

    <label>
      FOV
      <input id="camera-fov" type="range" min="15" max="90" value="\${camera.fov}" />
      <span id="camera-fov-value">\${camera.fov}</span>
    </label>

    <div class="camera-buttons">
      <button id="camera-reset">Reset</button>
      <button id="camera-front">Front</button>
      <button id="camera-back">Back</button>
      <button id="camera-left">Left</button>
      <button id="camera-right">Right</button>
      <button id="camera-top">Top</button>
    </div>

    <pre id="camera-info"></pre>
  \`;

  root.appendChild(panel);

  const fovInput = panel.querySelector<HTMLInputElement>("#camera-fov")!;
  const fovValue = panel.querySelector<HTMLSpanElement>("#camera-fov-value")!;
  const info = panel.querySelector<HTMLPreElement>("#camera-info")!;

  fovInput.addEventListener("input", () => {
    camera.fov = Number(fovInput.value);
    camera.updateProjectionMatrix();
    fovValue.textContent = String(camera.fov);
  });

  panel.querySelector<HTMLButtonElement>("#camera-reset")!.onclick = () => {
    controls.setLookAt(6, 4, 8, 0, 0, 0, true);
  };

  panel.querySelector<HTMLButtonElement>("#camera-front")!.onclick = () => {
    controls.setLookAt(0, 0, 10, 0, 0, 0, true);
  };

  panel.querySelector<HTMLButtonElement>("#camera-back")!.onclick = () => {
    controls.setLookAt(0, 0, -10, 0, 0, 0, true);
  };

  panel.querySelector<HTMLButtonElement>("#camera-left")!.onclick = () => {
    controls.setLookAt(-10, 0, 0, 0, 0, 0, true);
  };

  panel.querySelector<HTMLButtonElement>("#camera-right")!.onclick = () => {
    controls.setLookAt(10, 0, 0, 0, 0, 0, true);
  };

  panel.querySelector<HTMLButtonElement>("#camera-top")!.onclick = () => {
    controls.setLookAt(0, 10, 0.01, 0, 0, 0, true);
  };

  function updateInfo() {
    const p = camera.position;
    const target = controls.getTarget(new THREE.Vector3());

    info.textContent =
      "Position\\n" +
      "x: " + p.x.toFixed(2) + "\\n" +
      "y: " + p.y.toFixed(2) + "\\n" +
      "z: " + p.z.toFixed(2) + "\\n\\n" +
      "Target\\n" +
      "x: " + target.x.toFixed(2) + "\\n" +
      "y: " + target.y.toFixed(2) + "\\n" +
      "z: " + target.z.toFixed(2);
    
    requestAnimationFrame(updateInfo);
  }

  updateInfo();

  return panel;
}
`,
};

for (const [file, content] of Object.entries(files)) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.trimStart(), "utf8");
}

console.log("Camera panel created.");
