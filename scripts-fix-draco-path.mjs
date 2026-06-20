import fs from "fs";

const content = `
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/gltf/");

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

export async function loadGLB(url: string) {
  return await loader.loadAsync(url);
}
`;

fs.writeFileSync("src/assets/core/loadGLB.ts", content.trimStart(), "utf8");

console.log("DRACO decoder path fixed.");
