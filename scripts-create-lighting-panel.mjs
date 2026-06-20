import fs from "fs";
import path from "path";

const files = {
  "src/engine/lighting/createLightingRig.ts": `
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
`,

  "src/studio/controls/createLightingPanel.ts": `
import type { LightingRig } from "../../engine/lighting/createLightingRig";

export function createLightingPanel(root: HTMLElement, lighting: LightingRig) {
  const panel = document.createElement("div");
  panel.className = "lighting-panel";

  panel.innerHTML = \`
    <h3>Lighting</h3>

    <label>
      Key
      <input id="key-light" type="range" min="0" max="8" step="0.1" value="\${lighting.key.intensity}" />
      <span id="key-light-value">\${lighting.key.intensity}</span>
    </label>

    <label>
      Fill
      <input id="fill-light" type="range" min="0" max="5" step="0.1" value="\${lighting.fill.intensity}" />
      <span id="fill-light-value">\${lighting.fill.intensity}</span>
    </label>

    <label>
      Ambient
      <input id="ambient-light" type="range" min="0" max="2" step="0.01" value="\${lighting.ambient.intensity}" />
      <span id="ambient-light-value">\${lighting.ambient.intensity}</span>
    </label>

    <div class="lighting-buttons">
      <button id="preset-deep-space">Deep Space</button>
      <button id="preset-studio">Studio</button>
      <button id="preset-reset">Reset</button>
    </div>
  \`;

  root.appendChild(panel);

  const keyInput = panel.querySelector<HTMLInputElement>("#key-light")!;
  const fillInput = panel.querySelector<HTMLInputElement>("#fill-light")!;
  const ambientInput = panel.querySelector<HTMLInputElement>("#ambient-light")!;

  const keyValue = panel.querySelector<HTMLSpanElement>("#key-light-value")!;
  const fillValue = panel.querySelector<HTMLSpanElement>("#fill-light-value")!;
  const ambientValue = panel.querySelector<HTMLSpanElement>("#ambient-light-value")!;

  function sync() {
    lighting.key.intensity = Number(keyInput.value);
    lighting.fill.intensity = Number(fillInput.value);
    lighting.ambient.intensity = Number(ambientInput.value);

    keyValue.textContent = lighting.key.intensity.toFixed(1);
    fillValue.textContent = lighting.fill.intensity.toFixed(1);
    ambientValue.textContent = lighting.ambient.intensity.toFixed(2);
  }

  keyInput.oninput = sync;
  fillInput.oninput = sync;
  ambientInput.oninput = sync;

  function setPreset(key: number, fill: number, ambient: number) {
    keyInput.value = String(key);
    fillInput.value = String(fill);
    ambientInput.value = String(ambient);
    sync();
  }

  panel.querySelector<HTMLButtonElement>("#preset-deep-space")!.onclick = () => {
    setPreset(3.5, 0.8, 0.08);
  };

  panel.querySelector<HTMLButtonElement>("#preset-studio")!.onclick = () => {
    setPreset(4.5, 2.0, 0.4);
  };

  panel.querySelector<HTMLButtonElement>("#preset-reset")!.onclick = () => {
    setPreset(3.0, 1.2, 0.18);
  };

  return panel;
}
`,
};

for (const [file, content] of Object.entries(files)) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.trimStart(), "utf8");
}

console.log("Lighting panel files created.");
