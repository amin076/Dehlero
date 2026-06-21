import fs from "fs";

const file = "src/app/createStudioApp.ts";
let content = fs.readFileSync(file, "utf8");

content = content.replace(
  /await loadGLB\(".*?\.glb"\)/,
  'await loadGLB("/assets/astronomy/spacecraft/hubble/hubble.glb")'
);

content = content.replaceAll("Astronaut", "Hubble");

fs.writeFileSync(file, content, "utf8");

console.log("Switched asset to Hubble.");
