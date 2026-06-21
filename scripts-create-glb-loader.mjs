import fs from "fs";

const content = `
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const loader = new GLTFLoader();

export async function loadGLB(url: string) {
  return await loader.loadAsync(url);
}
`;

fs.writeFileSync(
  "src/assets/core/loadGLB.ts",
  content.trimStart(),
  "utf8"
);

console.log("loadGLB.ts created.");
