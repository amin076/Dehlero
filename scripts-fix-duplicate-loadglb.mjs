import fs from "fs";

const file = "src/app/createStudioApp.ts";
let content = fs.readFileSync(file, "utf8");

// remove all duplicate loadGLB imports
content = content.replace(
  /import\s+\{\s*loadGLB\s*\}\s+from\s+["']\.\.\/assets\/core\/loadGLB["'];\r?\n/g,
  ""
);

// add exactly one loadGLB import after theatre core import
content = content.replace(
  'import { getProject } from "@theatre/core";',
  'import { getProject } from "@theatre/core";\nimport { loadGLB } from "../assets/core/loadGLB";'
);

fs.writeFileSync(file, content, "utf8");

console.log("Duplicate loadGLB import fixed.");
