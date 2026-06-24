import * as THREE from "three";
import type { SceneNode } from "../core/scene/SceneNode";
import type {
  NodeSource,
  SavedObject,
  SavedScene,
  SavedTimelineClip,
} from "./studioTypes";
import {
  ACTIVE_PROJECT_STORAGE_KEY,
} from "./studioConstants";
import {
  addProjectName,
  applySavedTransform,
  createProjectStorageKey,
  getProjectNames,
  loadAssetBlob,
  loadProjectByName,
  saveAssetBlob,
  serializeTransform,
} from "./studioStorage";
import {
  applyTextureToObject,
  loadModelFile,
  loadTextureFile,
  loadTextureFromBlob,
} from "./studioAssets";
import { normalizeImportedObject, placeObject } from "./studioObjectUtils";
import { createAssetKey } from "./studioStorage";
import { createPlanet } from "./studioLibrary";
import type { LibraryItem } from "./studioTypes";

export function serializeScene({
  sceneName,
  nodes,
  serializeTimeline,
}: {
  sceneName: string;
  nodes: SceneNode[];
  serializeTimeline: () => SavedTimelineClip[];
}): SavedScene {
  const objects = nodes
    .filter((node) => (node.metadata.source as NodeSource)?.type !== "ambient")
    .map((node): SavedObject => {
      const texture = node.metadata.texture as SavedObject["texture"];

      return {
        name: node.name,
        source: node.metadata.source as NodeSource,
        transform: serializeTransform(node.root),
        ...(texture ? { texture } : {}),
      };
    });

  return {
    version: 2,
    name: sceneName,
    objects,
    timeline: serializeTimeline(),
  };
}

export function saveSceneToStorage(savedScene: SavedScene) {
  localStorage.setItem(
    createProjectStorageKey(savedScene.name),
    JSON.stringify(savedScene),
  );

  addProjectName(savedScene.name);
  localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, savedScene.name);
}

export function saveCurrentSceneToStorage(savedScene: SavedScene) {
  localStorage.setItem(
    createProjectStorageKey(savedScene.name),
    JSON.stringify(savedScene),
  );

  addProjectName(savedScene.name);
}

export async function createObjectFromSaved({
  savedObject,
  library,
}: {
  savedObject: SavedObject;
  library: LibraryItem[];
}) {
  const { source } = savedObject;

  if (source.type === "library") {
    const item = library.find(
      (candidate) => candidate.id === source.libraryId,
    );

    if (!item) {
      throw new Error(`Missing library item: ${savedObject.name}`);
    }

    return item.create();
  }

  if (source.type === "model") {
    const blob = await loadAssetBlob(source.assetKey);
    const file = new File([blob], source.fileName);

    return normalizeImportedObject(await loadModelFile(file));
  }

  if (source.type === "textured-planet") {
    const blob = await loadAssetBlob(source.assetKey);
    return createPlanet(loadTextureFromBlob(blob));
  }

  throw new Error(`Unsupported saved object: ${savedObject.name}`);
}

export async function importModelObject({
  file,
  nextObjectIndex,
  attachObject,
  uniqueName,
  setStatus,
}: {
  file: File;
  nextObjectIndex: number;
  attachObject: (
    name: string,
    object: THREE.Object3D,
    source: NodeSource,
  ) => SceneNode;
  uniqueName: (baseName: string) => string;
  setStatus: (message: string) => void;
}) {
  const assetKey = createAssetKey(file);
  await saveAssetBlob(assetKey, file);

  const loadedObject = await loadModelFile(file);
  const object = normalizeImportedObject(loadedObject);

  object.name = file.name.replace(/\.[^.]+$/, "");
  placeObject(object, nextObjectIndex);

  attachObject(uniqueName(object.name || "Imported Model"), object, {
    type: "model",
    assetKey,
    fileName: file.name,
  });

  setStatus(`Imported ${file.name}`);
}

export async function applyTextureToSelectedObject({
  file,
  selected,
  setStatus,
}: {
  file: File;
  selected: SceneNode | null;
  setStatus: (message: string) => void;
}) {
  if (!selected) {
    setStatus("Select an object first");
    return;
  }

  const assetKey = createAssetKey(file);
  await saveAssetBlob(assetKey, file);

  const texture = loadTextureFile(file);
  applyTextureToObject(selected.root, texture);

  selected.metadata.texture = {
    assetKey,
    fileName: file.name,
  };

  setStatus(`Texture applied: ${file.name}`);
}

export async function createTexturedPlanetObject({
  file,
  nextObjectIndex,
  attachObject,
  uniqueName,
  setStatus,
}: {
  file: File;
  nextObjectIndex: number;
  attachObject: (
    name: string,
    object: THREE.Object3D,
    source: NodeSource,
  ) => SceneNode;
  uniqueName: (baseName: string) => string;
  setStatus: (message: string) => void;
}) {
  const assetKey = createAssetKey(file);
  await saveAssetBlob(assetKey, file);

  const texture = loadTextureFile(file);
  const planet = createPlanet(texture);

  planet.name = file.name.replace(/\.[^.]+$/, "");
  placeObject(planet, nextObjectIndex);

  attachObject(uniqueName("Textured Planet"), planet, {
    type: "textured-planet",
    assetKey,
    fileName: file.name,
  });

  setStatus(`Planet created: ${file.name}`);
}

export function getNextUntitledSceneName() {
  return `Untitled Scene ${getProjectNames().length + 1}`;
}

export function getSavedProject(projectName: string) {
  return loadProjectByName(projectName);
}

export async function applySavedObjectToScene({
  savedObject,
  library,
  attachObject,
}: {
  savedObject: SavedObject;
  library: LibraryItem[];
  attachObject: (
    name: string,
    object: THREE.Object3D,
    source: NodeSource,
  ) => SceneNode;
}) {
  const object = await createObjectFromSaved({
    savedObject,
    library,
  });

  object.name = savedObject.name;
  applySavedTransform(object, savedObject.transform);

  if (savedObject.texture) {
    const blob = await loadAssetBlob(savedObject.texture.assetKey);
    applyTextureToObject(object, loadTextureFromBlob(blob));
  }

  const node = attachObject(
    savedObject.name,
    object,
    savedObject.source,
  );

  if (savedObject.texture) {
    node.metadata.texture = savedObject.texture;
  }

  return node;
}
