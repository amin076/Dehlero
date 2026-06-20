import fs from "fs";

const file = "src/app/createStudioApp.ts";
let content = fs.readFileSync(file, "utf8");

content = content.replace(
  /await loadGLB\(".*astronaut.*\.glb"\)/,
  'await loadGLB("/assets/astronomy/spacecraft/astronaut/astronaut.glb")'
);

fs.writeFileSync(file, content, "utf8");

console.log("Astronaut path corrected.");
