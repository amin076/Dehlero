import type { LibraryCategory, LibraryItem } from "../studioTypes";
import { getProjectNames } from "../studioStorage";

export function createSceneBuilderPanel({
  root,
  library,
  addLibraryObject,
  importModel,
  applyTexture,
  createPlanetFromTexture,
  saveScene,
  loadScene,
  switchScene,
  newScene,
}: {
  root: HTMLElement;
  library: LibraryItem[];
  addLibraryObject: (item: LibraryItem) => void;
  importModel: (file: File) => void;
  applyTexture: (file: File) => void;
  createPlanetFromTexture: (file: File) => void;
  saveScene: () => void;
  loadScene: () => void;
  switchScene: (name: string) => void;
  newScene: () => void;
}) {
  const panel = document.createElement("aside");
  panel.className = "asset-library-panel";

  const categories: LibraryCategory[] = [
    "3D",
    "2D",
    "Planets",
    "Environment",
    "Lights",
    "Camera",
  ];

  panel.innerHTML = `
    <div class="panel-title">Scene Builder</div>

    <div class="project-panel">
      <label>
        Scene Name
        <input id="scene-name" type="text" value="Untitled Scene" />
      </label>

      <label>
        Saved Projects
        <select id="project-select"></select>
      </label>

      <div class="project-buttons">
        <button id="save-scene" type="button">Save Scene</button>
        <button id="load-scene" type="button">Open</button>
        <button id="new-scene" type="button">New</button>
      </div>
    </div>

    <div class="asset-library-groups"></div>

    <div class="asset-import-panel">
      <button id="import-model" type="button">Import Model</button>
      <button id="apply-texture" type="button">Apply Texture</button>
      <button id="planet-texture" type="button">Planet From Texture</button>
      <div id="asset-status" class="asset-status">Ready</div>
    </div>
  `;

  const groups = panel.querySelector<HTMLDivElement>(".asset-library-groups")!;
  const status = panel.querySelector<HTMLDivElement>("#asset-status")!;
  const sceneNameInput = panel.querySelector<HTMLInputElement>("#scene-name")!;
  const projectSelect =
    panel.querySelector<HTMLSelectElement>("#project-select")!;

  function refreshProjectOptions(selectedName?: string) {
    const names = getProjectNames();
    projectSelect.innerHTML = "";

    if (names.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No saved projects";
      projectSelect.appendChild(option);
      return;
    }

    names.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      projectSelect.appendChild(option);
    });

    if (selectedName && names.includes(selectedName)) {
      projectSelect.value = selectedName;
    }
  }

  categories.forEach((category) => {
    const categoryItems = library.filter((item) => item.category === category);

    if (categoryItems.length === 0) return;

    const section = document.createElement("section");
    section.className = "asset-library-group";

    const heading = document.createElement("h3");
    heading.textContent = category;
    section.appendChild(heading);

    const buttons = document.createElement("div");
    buttons.className = "asset-library-buttons";

    categoryItems.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `asset-button asset-button-${item.id}`;
      button.title = item.label;
      button.setAttribute("aria-label", item.label);
      button.innerHTML = `
        <span class="asset-button-icon" aria-hidden="true"></span>
        <span class="asset-button-label">${item.label}</span>
      `;

      button.onclick = () => addLibraryObject(item);
      buttons.appendChild(button);
    });

    section.appendChild(buttons);
    groups.appendChild(section);
  });

  const modelInput = document.createElement("input");
  modelInput.type = "file";
  modelInput.accept = ".glb,.gltf,.obj,model/gltf-binary,model/gltf+json";
  modelInput.hidden = true;

  const textureInput = document.createElement("input");
  textureInput.type = "file";
  textureInput.accept = "image/*";
  textureInput.hidden = true;

  const planetTextureInput = document.createElement("input");
  planetTextureInput.type = "file";
  planetTextureInput.accept = "image/*";
  planetTextureInput.hidden = true;

  modelInput.onchange = () => {
    const file = modelInput.files?.[0];
    if (!file) return;

    status.textContent = `Importing ${file.name}`;
    importModel(file);
    modelInput.value = "";
  };

  textureInput.onchange = () => {
    const file = textureInput.files?.[0];
    if (!file) return;

    applyTexture(file);
    textureInput.value = "";
  };

  planetTextureInput.onchange = () => {
    const file = planetTextureInput.files?.[0];
    if (!file) return;

    createPlanetFromTexture(file);
    planetTextureInput.value = "";
  };

  panel.querySelector<HTMLButtonElement>("#import-model")!.onclick = () => {
    modelInput.click();
  };

  panel.querySelector<HTMLButtonElement>("#apply-texture")!.onclick = () => {
    textureInput.click();
  };

  panel.querySelector<HTMLButtonElement>("#planet-texture")!.onclick = () => {
    planetTextureInput.click();
  };

  panel.querySelector<HTMLButtonElement>("#save-scene")!.onclick = saveScene;
  panel.querySelector<HTMLButtonElement>("#load-scene")!.onclick = loadScene;
  panel.querySelector<HTMLButtonElement>("#new-scene")!.onclick = newScene;

  projectSelect.onchange = () => {
    if (projectSelect.value) {
      switchScene(projectSelect.value);
    }
  };

  panel.append(modelInput, textureInput, planetTextureInput);
  root.appendChild(panel);

  return {
    panel,

    setStatus(message: string) {
      status.textContent = message;
    },

    getSceneName() {
      return sceneNameInput.value.trim() || "Untitled Scene";
    },

    setSceneName(name: string) {
      sceneNameInput.value = name;
      refreshProjectOptions(name);
    },

    getSelectedProjectName() {
      return projectSelect.value || sceneNameInput.value.trim();
    },

    refreshProjects(selectedName?: string) {
      refreshProjectOptions(selectedName);
    },
  };
}
