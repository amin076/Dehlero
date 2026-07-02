import * as THREE from "three";
import type CameraControls from "camera-controls";
import { exportProjectFile } from "../core/persistence/exportProjectFile";
import type { SceneNode } from "../core/scene/SceneNode";
import type { SceneRegistry } from "../core/scene/SceneRegistry";
import type { SelectionManager } from "../editor/SelectionManager";
import type { HierarchyPanel } from "../editor/HierarchyPanel";
import type { createTransformEditor } from "../editor/TransformEditor";
import { importDehleroFile } from "./studioImportExportService";
import type {
  LibraryItem,
  NodeSource,
  SavedScene,
  SceneHelper,
} from "./studioTypes";
import { disposeObject } from "./studioObjectUtils";
import type { createSceneBuilderPanel } from "./ui/createSceneBuilderPanel";
import type { createProductionPanel } from "./ui/createProductionPanel";
import type { TimelineController } from "./studioTimelineController";
import {
  serializeScene as serializeSceneData,
  saveSceneToStorage,
  saveCurrentSceneToStorage,
  getNextUntitledSceneName,
  getSavedProject,
  applySavedObjectToScene,
  importModelObject,
  applyTextureToSelectedObject,
  createTexturedPlanetObject,
} from "./studioScenePersistence";
import { ACTIVE_PROJECT_STORAGE_KEY } from "./studioConstants";

type TransformEditorLike = ReturnType<typeof createTransformEditor>;
type SceneBuilderLike = ReturnType<typeof createSceneBuilderPanel>;
type ProductionPanelLike = ReturnType<typeof createProductionPanel> | null;

export type StudioSceneRuntimeOptions = {
  registry: SceneRegistry;
  selection: SelectionManager;
  camera: THREE.PerspectiveCamera;
  controls: CameraControls;
  helpers: Map<string, SceneHelper>;
  theatreBindings: Map<string, { theatreObject: unknown }>;
  getTheatreSheet: () => unknown;
  setTheatreSelection: (items: unknown[]) => void;
  unregisterTheatreObject: (node: SceneNode) => void;
  registerTheatreMainCamera: () => void;
  getTheatreMainCameraKey: () => string | null;
  attachObject: (
    name: string,
    object: THREE.Object3D,
    source: NodeSource,
  ) => SceneNode;
  addLibraryObject: (item: LibraryItem) => void;
  uniqueName: (baseName: string) => string;
  library: LibraryItem[];
  hierarchyPanel: HierarchyPanel;
  transformEditor: TransformEditorLike;
  refreshProductionCameras: () => void;
  getActiveRenderCameraId: () => string;
  setActiveRenderCameraId: (id: string) => void;
  getDidDragTransform: () => boolean;
  setDidDragTransform: (value: boolean) => void;
  timelineController: TimelineController;
  shotRepository: { clear: () => void };
  getSceneBuilder: () => SceneBuilderLike;
  getProductionPanel: () => ProductionPanelLike;
  nextObjectIndex: () => number;
  setNextObjectIndex: (value: number) => void;
};

const THEATRE_INTEGRATION_ENABLED = false;

function cloneMaterialSafe(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    return material.map((item) => item.clone());
  }

  return material.clone();
}

function cloneObjectForEditing(source: THREE.Object3D) {
  const clone = source.clone(true);

  clone.traverse((object) => {
    const mesh = object as THREE.Mesh;

    if (mesh.isMesh && mesh.material) {
      mesh.material = cloneMaterialSafe(mesh.material);
    }
  });

  return clone;
}

export function createStudioSceneRuntime(options: StudioSceneRuntimeOptions) {
  function sceneBuilder() {
    return options.getSceneBuilder();
  }

  function makeDuplicateName(baseName: string) {
    const existing = new Set(options.registry.getAll().map((node) => node.name));
    let index = 1;
    let nextName = `${baseName} Copy`;

    while (existing.has(nextName)) {
      index += 1;
      nextName = `${baseName} Copy ${index}`;
    }

    return nextName;
  }

  function duplicateNode(node: SceneNode) {
    const cloneRoot = cloneObjectForEditing(node.root);
    const cloneName = makeDuplicateName(node.name);

    cloneRoot.name = cloneName;
    cloneRoot.position.copy(node.root.position).add(new THREE.Vector3(1, 0, 1));
    cloneRoot.rotation.copy(node.root.rotation);
    cloneRoot.scale.copy(node.root.scale);

    const source = (node.metadata.source as NodeSource) ?? { type: "generated" };
    const duplicate = options.attachObject(cloneName, cloneRoot, source);

    duplicate.metadata = JSON.parse(JSON.stringify(node.metadata ?? {}));
    duplicate.metadata.source = source;
    duplicate.visible = node.visible;
    duplicate.locked = false;

    options.hierarchyPanel.refresh();
    options.transformEditor.refresh();
    options.refreshProductionCameras();
    options.transformEditor.selectNode(duplicate.id);

    return duplicate;
  }

  function deleteNode(node: SceneNode) {
    const helper = options.helpers.get(node.id);
    options.unregisterTheatreObject(node);

    if (helper) {
      helper.removeFromParent();
      disposeObject(helper);
      options.helpers.delete(node.id);
    }

    node.root.removeFromParent();
    disposeObject(node.root);
    options.registry.unregister(node.id);

    if (options.getActiveRenderCameraId() === node.id) {
      options.setActiveRenderCameraId("main");
      options.controls.enabled = true;
    }

    options.refreshProductionCameras();
    options.hierarchyPanel.refresh();
  }

  function focusSelectedNode(node: SceneNode | null) {
    if (!node || options.getActiveRenderCameraId() !== "main") return;

    const box = new THREE.Box3().setFromObject(node.root);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();

    box.getCenter(center);
    box.getSize(size);

    const radius = Math.max(size.x, size.y, size.z, 1);
    const distance = Math.max(radius * 2.8, 4);

    const direction = new THREE.Vector3()
      .subVectors(options.camera.position, options.controls.getTarget(new THREE.Vector3()))
      .normalize();

    const nextPosition = center.clone().add(direction.multiplyScalar(distance));

    options.controls.setLookAt(
      nextPosition.x,
      nextPosition.y,
      nextPosition.z,
      center.x,
      center.y,
      center.z,
      true,
    );
  }

  function updateHelperVisibility(selectedNode: SceneNode | null) {
    focusSelectedNode(selectedNode);

    options.helpers.forEach((helper, nodeId) => {
      helper.visible = selectedNode?.id === nodeId;
      helper.update();
    });

    if (!THEATRE_INTEGRATION_ENABLED || !options.getTheatreSheet()) return;

    const binding = selectedNode
      ? options.theatreBindings.get(selectedNode.id)
      : undefined;

    options.setTheatreSelection(binding ? [binding.theatreObject] : [options.getTheatreSheet()]);
  }

  function clearEditableScene() {
    options.registry
      .getAll()
      .filter((node) => (node.metadata.source as NodeSource)?.type !== "ambient")
      .forEach((node) => {
        deleteNode(node);
        options.registry.unregister(node.id);
      });

    options.selection.clear();
    options.transformEditor.refresh();
    options.hierarchyPanel.refresh();
    options.timelineController.clearTimeline();
    options.shotRepository.clear();
  }

  function serializeScene(): SavedScene {
    return serializeSceneData({
      sceneName: sceneBuilder().getSceneName(),
      nodes: options.registry.getAll(),
      serializeTimeline: options.timelineController.serializeTimeline,
    });
  }

  function saveScene() {
    const savedScene = serializeScene();
    saveSceneToStorage(savedScene);
    sceneBuilder().refreshProjects(savedScene.name);
    sceneBuilder().setStatus(`Saved: ${savedScene.name}`);
  }

  function exportScene() {
    const savedScene = serializeScene();
    saveSceneToStorage(savedScene);
    sceneBuilder().refreshProjects(savedScene.name);
    exportProjectFile(savedScene.name, savedScene);
    sceneBuilder().setStatus(`Exported: ${savedScene.name}`);
  }

  async function importScene(file: File) {
    try {
      const result = await importDehleroFile(file);
      sceneBuilder().refreshProjects(result.activeScene.name);
      await loadSavedScene(result.activeScene);
      sceneBuilder().setStatus(`Imported: ${result.activeScene.name}`);
    } catch (error) {
      console.error(error);
      sceneBuilder().setStatus(
        error instanceof Error ? error.message : "Import scene failed",
      );
    }
  }

  function saveCurrentSceneSilently() {
    const expectedMainCameraKey = `${sceneBuilder().getSceneName()} / Main View Camera`;
    if (options.getTheatreMainCameraKey() !== expectedMainCameraKey) {
      options.registerTheatreMainCamera();
    }

    saveCurrentSceneToStorage(serializeScene());
  }

  async function loadSavedScene(savedScene: SavedScene) {
    clearEditableScene();
    sceneBuilder().setSceneName(savedScene.name);
    options.registerTheatreMainCamera();

    for (const savedObject of savedScene.objects) {
      await applySavedObjectToScene({
        savedObject,
        library: options.library,
        attachObject: options.attachObject,
      });
    }

    options.transformEditor.refresh();
    options.hierarchyPanel.refresh();
    options.transformEditor.clearSelection();
    options.timelineController.restoreTimeline(savedScene.timeline);
    sceneBuilder().setStatus(`Loaded: ${savedScene.name}`);
  }

  function loadScene() {
    const projectName = sceneBuilder().getSelectedProjectName();
    const savedScene = projectName ? getSavedProject(projectName) : null;

    if (!savedScene) {
      sceneBuilder().setStatus("No saved scene");
      return;
    }

    void loadSavedScene(savedScene).catch((error) => {
      console.error(error);
      sceneBuilder().setStatus("Load failed");
    });
  }

  function switchScene(projectName: string) {
    const currentName = sceneBuilder().getSceneName();
    if (projectName === currentName) return;

    saveCurrentSceneSilently();
    const savedScene = getSavedProject(projectName);

    if (!savedScene) {
      sceneBuilder().setStatus("Selected scene was not found");
      sceneBuilder().refreshProjects(currentName);
      return;
    }

    localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, projectName);
    void loadSavedScene(savedScene).catch((error) => {
      console.error(error);
      sceneBuilder().setStatus("Scene switch failed");
      sceneBuilder().refreshProjects(currentName);
    });
  }

  function newScene() {
    saveCurrentSceneSilently();
    clearEditableScene();
    const nextName = getNextUntitledSceneName();
    sceneBuilder().setSceneName(nextName);
    options.registerTheatreMainCamera();
    addDefaultProjectObjects();
    options.transformEditor.clearSelection();
    saveScene();
    sceneBuilder().setStatus("New scene");
  }

  async function importModel(file: File) {
    try {
      await importModelObject({
        file,
        nextObjectIndex: options.nextObjectIndex(),
        attachObject: options.attachObject,
        uniqueName: options.uniqueName,
        setStatus: sceneBuilder().setStatus,
      });
      options.setNextObjectIndex(options.nextObjectIndex() + 1);
    } catch (error) {
      console.error(error);
      sceneBuilder().setStatus("Import failed");
    }
  }

  async function applyTexture(file: File) {
    try {
      await applyTextureToSelectedObject({
        file,
        selected: options.selection.getSelected(),
        setStatus: sceneBuilder().setStatus,
      });
    } catch (error) {
      console.error(error);
      sceneBuilder().setStatus("Texture failed");
    }
  }

  async function createPlanetFromTexture(file: File) {
    try {
      await createTexturedPlanetObject({
        file,
        nextObjectIndex: options.nextObjectIndex(),
        attachObject: options.attachObject,
        uniqueName: options.uniqueName,
        setStatus: sceneBuilder().setStatus,
      });
      options.setNextObjectIndex(options.nextObjectIndex() + 1);
    } catch (error) {
      console.error(error);
      sceneBuilder().setStatus("Planet texture failed");
    }
  }

  function addDefaultProjectObjects() {
    [
      "Cube",
      "Sphere",
      "Cylinder",
      "Plane",
      "Directional",
      "Point",
      "Camera",
    ].forEach((label) => {
      const item = options.library.find((candidate) => candidate.label === label);
      if (item) options.addLibraryObject(item);
    });
  }

  return {
    duplicateNode,
    deleteNode,
    focusSelectedNode,
    updateHelperVisibility,
    clearEditableScene,
    serializeScene,
    saveScene,
    exportScene,
    importScene,
    saveCurrentSceneSilently,
    loadSavedScene,
    loadScene,
    switchScene,
    newScene,
    importModel,
    applyTexture,
    createPlanetFromTexture,
    addDefaultProjectObjects,
  };
}
