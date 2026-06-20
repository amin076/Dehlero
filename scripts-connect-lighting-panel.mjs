import fs from "fs";

const file = "src/app/createStudioApp.ts";
let content = fs.readFileSync(file, "utf8");

content = content.replace(
  'import { addDefaultLighting } from "../engine/lighting/addDefaultLighting";',
  'import { createLightingRig } from "../engine/lighting/createLightingRig";'
);

content = content.replace(
  'import { createCameraPanel } from "../studio/controls/createCameraPanel";',
  'import { createCameraPanel } from "../studio/controls/createCameraPanel";\nimport { createLightingPanel } from "../studio/controls/createLightingPanel";'
);

content = content.replace(
  "addDefaultLighting(scene);",
  "const lighting = createLightingRig(scene);"
);

content = content.replace(
  "createCameraPanel({ root, camera, controls });",
  "createCameraPanel({ root, camera, controls });\n  createLightingPanel(root, lighting);"
);

fs.writeFileSync(file, content, "utf8");

console.log("Lighting panel connected.");
