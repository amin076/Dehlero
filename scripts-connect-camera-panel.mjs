import fs from "fs";

const file = "src/app/createStudioApp.ts";
let content = fs.readFileSync(file, "utf8");

content = content.replace(
  'import { createRecordingControls } from "../studio/recording/createRecordingControls";',
  'import { createRecordingControls } from "../studio/recording/createRecordingControls";\\nimport { createCameraPanel } from "../studio/controls/createCameraPanel";'
);

content = content.replace(
  "createRecordingControls(root, renderer.domElement);",
  "createRecordingControls(root, renderer.domElement);\\n  createCameraPanel({ root, camera, controls });"
);

fs.writeFileSync(file, content, "utf8");

console.log("Camera panel connected.");
