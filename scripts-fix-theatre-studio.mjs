import fs from "fs";

const file = "src/app/createStudioApp.ts";
let content = fs.readFileSync(file, "utf8");

content = content.replace(
  "studio.initialize();",
  "const theatreStudio = (studio as any).default ?? studio;\ntheatreStudio.initialize();"
);

fs.writeFileSync(file, content, "utf8");

console.log("Theatre studio import fixed.");
