import type * as THREE from "three";
import type { SceneNode } from "../core/scene/SceneNode";
import type { SceneRegistry } from "../core/scene/SceneRegistry";
import { ACTIVE_PROJECT_STORAGE_KEY } from "./studioConstants";
import {
  chooseDehleroImportFile,
  exportProjectFileBundle,
  exportSceneFile,
  importDehleroFile,
} from "./studioImportExportService";
import {
  applySavedObjectToScene,
  getNextUntitledSceneName,
  getSavedProject,
  saveCurrentSceneToStorage,
  saveSceneToStorage,
  serializeScene as serializeSceneData,
} from "./studioScenePersistence";
import { getProjectNames, loadProjectByName } from "./studioStorage";
import type {
  LibraryItem,
  NodeSource,
  SavedScene,
  SavedTimelineClip,
} from "./studioTypes";

type SceneBuilderLike = {
  getSceneName: () => string;
  setSceneName: (name: string) => void;
  getSelectedProjectName: () => string;
  refreshProjects: (selectedName?: string) => void;
  setStatus: (message: string) => void;
};

type TransformEditorLike = {
  refresh: () => void;
  clearSelection: () => void;
};

type HierarchyPanelLike = {
  refresh: () => void;
};

export type ProjectControllerDependencies = {
  sceneBuilder: SceneBuilderLike;
  registry: SceneRegistry;
  library: LibraryItem[];
  attachObject: (
    name: string,
    object: THREE.Object3D,
    source: NodeSource,
  ) => SceneNode;
  clearEditableScene: () => void;
  registerTheatreMainCamera: () => void;
  serializeTimeline: () => SavedTimelineClip[];
  restoreTimeline: (timeline: SavedTimelineClip[] | undefined) => void;
  addDefaultProjectObjects: () => void;
  transformEditor: TransformEditorLike;
  hierarchyPanel: HierarchyPanelLike;
};

export function createProjectController({
  sceneBuilder,
  registry,
  library,
  attachObject,
  clearEditableScene,
  registerTheatreMainCamera,
  serializeTimeline,
  restoreTimeline,
  addDefaultProjectObjects,
  transformEditor,
  hierarchyPanel,
}: ProjectControllerDependencies) {
  function serializeScene(): SavedScene {
    return serializeSceneData({
      sceneName: sceneBuilder.getSceneName(),
      nodes: registry.getAll(),
      serializeTimeline,
    });
  }

  function saveScene() {
    const savedScene = serializeScene();

    saveSceneToStorage(savedScene);
    sceneBuilder.refreshProjects(savedScene.name);
    sceneBuilder.setStatus(`Saved: ${savedScene.name}`);
  }

  function exportScene() {
    const savedScene = serializeScene();

    saveSceneToStorage(savedScene);
    sceneBuilder.refreshProjects(savedScene.name);
    exportSceneFile(savedScene);
    sceneBuilder.setStatus(`Exported scene: ${savedScene.name}`);
  }

  function exportProject() {
    const currentScene = serializeScene();

    saveSceneToStorage(currentScene);

    const scenes = getProjectNames()
      .map((projectName) => loadProjectByName(projectName))
      .filter((savedScene): savedScene is SavedScene => Boolean(savedScene));

    if (scenes.length === 0) {
      sceneBuilder.setStatus("No scenes to export");
      return;
    }

    exportProjectFileBundle({
      activeSceneName: currentScene.name,
      scenes,
    });

    sceneBuilder.refreshProjects(currentScene.name);
    sceneBuilder.setStatus(`Exported project: ${scenes.length} scene(s)`);
  }

  function saveCurrentSceneSilently() {
    saveCurrentSceneToStorage(serializeScene());
  }

  async function loadSavedScene(savedScene: SavedScene) {
    clearEditableScene();
    sceneBuilder.setSceneName(savedScene.name);
    registerTheatreMainCamera();

    for (const savedObject of savedScene.objects) {
      await applySavedObjectToScene({
        savedObject,
        library,
        attachObject,
      });
    }

    transformEditor.refresh();
    hierarchyPanel.refresh();
    transformEditor.clearSelection();
    restoreTimeline(savedScene.timeline);
    sceneBuilder.setStatus(`Loaded: ${savedScene.name}`);
  }

  function loadScene() {
    const projectName = sceneBuilder.getSelectedProjectName();
    const savedScene = projectName ? getSavedProject(projectName) : null;

    if (!savedScene) {
      sceneBuilder.setStatus("No saved scene");
      return;
    }

    void loadSavedScene(savedScene).catch((error) => {
      console.error(error);
      sceneBuilder.setStatus("Load failed");
    });
  }

  function switchScene(projectName: string) {
    const currentName = sceneBuilder.getSceneName();
    if (projectName === currentName) return;

    saveCurrentSceneSilently();

    const savedScene = getSavedProject(projectName);

    if (!savedScene) {
      sceneBuilder.setStatus("Selected scene was not found");
      sceneBuilder.refreshProjects(currentName);
      return;
    }

    localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, projectName);

    void loadSavedScene(savedScene).catch((error) => {
      console.error(error);
      sceneBuilder.setStatus("Scene switch failed");
      sceneBuilder.refreshProjects(currentName);
    });
  }

  function newScene() {
    saveCurrentSceneSilently();
    clearEditableScene();

    const nextName = getNextUntitledSceneName();

    sceneBuilder.setSceneName(nextName);
    registerTheatreMainCamera();
    addDefaultProjectObjects();
    transformEditor.clearSelection();
    saveScene();
    sceneBuilder.setStatus("New scene");
  }

  async function importProjectOrScene() {
    const file = await chooseDehleroImportFile();

    if (!file) return;

    try {
      saveCurrentSceneSilently();

      const result = await importDehleroFile(file);

      await loadSavedScene(result.activeScene);
      sceneBuilder.refreshProjects(result.activeScene.name);
      sceneBuilder.setStatus(
        `Imported ${result.importedScenes.length} scene(s): ${result.activeScene.name}`,
      );
    } catch (error) {
      console.error(error);
      sceneBuilder.setStatus("Import failed");
    }
  }

  function refreshProjectsFromActiveProject() {
    sceneBuilder.refreshProjects(
      localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) ?? undefined,
    );
  }

  async function loadActiveProject() {
    const activeProjectName = localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
    const activeScene = activeProjectName
      ? loadProjectByName(activeProjectName)
      : null;

    if (activeScene) {
      await loadSavedScene(activeScene);
      return;
    }

    registerTheatreMainCamera();
    addDefaultProjectObjects();
    transformEditor.clearSelection();
  }

  return {
    serializeScene,
    saveScene,
    exportScene,
    exportProject,
    saveCurrentSceneSilently,
    loadSavedScene,
    loadScene,
    switchScene,
    newScene,
    importProjectOrScene,
    refreshProjectsFromActiveProject,
    loadActiveProject,
  };
}

export type ProjectController = ReturnType<typeof createProjectController>;

