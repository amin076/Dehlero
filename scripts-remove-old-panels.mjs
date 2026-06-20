import fs from "fs";

const file = "src/app/createStudioApp.ts";
let content = fs.readFileSync(file, "utf8");

content = content.replace(
  'import { createCameraPanel } from "../studio/controls/createCameraPanel";\n',
  ""
);

content = content.replace(
  'import { createLightingPanel } from "../studio/controls/createLightingPanel";\n',
  ""
);

content = content.replace(
  "  createCameraPanel({ root, camera, controls });\n",
  ""
);

content = content.replace(
  "  createLightingPanel(root, lighting);\n",
  ""
);

fs.writeFileSync(file, content, "utf8");

console.log("Old custom camera/lighting panels removed.");
