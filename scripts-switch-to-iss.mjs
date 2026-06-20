import fs from "fs";

const file = "src/app/createStudioApp.ts";
let content = fs.readFileSync(file, "utf8");

content = content.replace(
  /await loadGLB\(".*?\.glb"\)/,
  'await loadGLB("/assets/astronomy/spacecraft/iss/iss.glb")'
);

content = content.replaceAll("Astronaut", "ISS");
content = content.replaceAll("Hubble", "ISS");

fs.writeFileSync(file, content, "utf8");

console.log("Switched asset to ISS.");
