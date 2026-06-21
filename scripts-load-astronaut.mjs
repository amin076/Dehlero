import fs from "fs";

const file = "src/app/createStudioApp.ts";
let content = fs.readFileSync(file, "utf8");

content = content.replace(
  'import { getProject } from "@theatre/core";',
  'import { getProject } from "@theatre/core";\nimport { loadGLB } from "../assets/core/loadGLB";'
);

content = content.replace(
  `  const testObject = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.45,
      roughness: 0.35,
    })
  );

  scene.add(testObject);`,
  `  const gltf = await loadGLB("/assets/astronomy/spacecraft/astronaut/astronaut.glb");
  const testObject = gltf.scene;

  testObject.scale.setScalar(1);
  testObject.position.set(0, 0, 0);

  scene.add(testObject);`
);

content = content.replace(
  "export function createStudioApp({ root }: { root: HTMLDivElement }) {",
  "export async function createStudioApp({ root }: { root: HTMLDivElement }) {"
);

fs.writeFileSync(file, content, "utf8");

console.log("Astronaut GLB connected.");
