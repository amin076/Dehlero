import fs from "fs";

const file = "src/app/createStudioApp.ts";
let content = fs.readFileSync(file, "utf8");

content = content.replace(
  "theatreStudio.initialize();",
  "theatreStudio.initialize();\n  let isRecordMode = false;"
);

content = content.replace(
  "createRecordingControls(root, renderer.domElement);",
  "createRecordingControls(root, renderer.domElement);\n  createModeToggle(root, theatreStudio);"
);

content = content.replace(
  "export function createStudioApp({ root }: { root: HTMLDivElement }) {",
  `
function createModeToggle(root: HTMLElement, theatreStudio: any) {
  const button = document.createElement("button");
  button.className = "mode-toggle";
  button.textContent = "Record Mode";

  let recordMode = false;

  button.onclick = () => {
    recordMode = !recordMode;

    if (recordMode) {
      theatreStudio.ui.hide();
      button.textContent = "Author Mode";
      document.body.classList.add("record-mode");
    } else {
      theatreStudio.ui.show();
      button.textContent = "Record Mode";
      document.body.classList.remove("record-mode");
    }
  };

  root.appendChild(button);
}

export function createStudioApp({ root }: { root: HTMLDivElement }) {`
);

fs.writeFileSync(file, content, "utf8");

console.log("Author/Record mode toggle added.");
