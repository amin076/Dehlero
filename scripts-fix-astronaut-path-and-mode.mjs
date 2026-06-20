import fs from "fs";

const file = "src/app/createStudioApp.ts";
let content = fs.readFileSync(file, "utf8");

content = content.replace(
  'await loadGLB("/assets/astronomy/spacecraft/astronaut.glb")',
  'await loadGLB("/assets/astronomy/spacecraft_astronaut/astronaut.glb")'
);

content = content.replace(
  `    } else {
      theatreStudio.ui.show();
      button.textContent = "Record Mode";
      document.body.classList.remove("record-mode");
    }`,
  `    } else {
      window.location.reload();
    }`
);

fs.writeFileSync(file, content, "utf8");

console.log("Astronaut path and Theatre toggle fixed.");
