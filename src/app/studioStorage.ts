import * as THREE from "three";
import type { SavedScene } from "./studioTypes";
import {
  ACTIVE_PROJECT_STORAGE_KEY,
  ASSET_DB_NAME,
  ASSET_STORE_NAME,
  PROJECT_INDEX_STORAGE_KEY,
  SCENE_STORAGE_KEY,
} from "./studioConstants";

export function openAssetDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(ASSET_DB_NAME, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(ASSET_STORE_NAME);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAssetBlob(key: string, blob: Blob) {
  const db = await openAssetDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(ASSET_STORE_NAME, "readwrite");
    transaction.objectStore(ASSET_STORE_NAME).put(blob, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  db.close();
}

export async function loadAssetBlob(key: string) {
  const db = await openAssetDatabase();

  const blob = await new Promise<Blob>((resolve, reject) => {
    const transaction = db.transaction(ASSET_STORE_NAME, "readonly");
    const request = transaction.objectStore(ASSET_STORE_NAME).get(key);

    request.onsuccess = () => {
      const result = request.result;

      if (result instanceof Blob) {
        resolve(result);
        return;
      }

      reject(new Error(`Missing asset: ${key}`));
    };

    request.onerror = () => reject(request.error);
  });

  db.close();

  return blob;
}

export function createAssetKey(file: File) {
  return `${Date.now()}-${crypto.randomUUID()}-${file.name}`;
}

export function createProjectStorageKey(name: string) {
  return `${SCENE_STORAGE_KEY}:${encodeURIComponent(name)}`;
}

export function getProjectNames() {
  const rawNames = localStorage.getItem(PROJECT_INDEX_STORAGE_KEY);

  if (!rawNames) return [];

  try {
    const names = JSON.parse(rawNames);

    if (Array.isArray(names)) {
      return names.filter((name): name is string => typeof name === "string");
    }
  } catch {
    return [];
  }

  return [];
}

export function setProjectNames(names: string[]) {
  localStorage.setItem(
    PROJECT_INDEX_STORAGE_KEY,
    JSON.stringify([...new Set(names)].sort((a, b) => a.localeCompare(b))),
  );
}

export function addProjectName(name: string) {
  setProjectNames([...getProjectNames(), name]);
}

export function loadProjectByName(name: string) {
  const rawScene = localStorage.getItem(createProjectStorageKey(name));
  return rawScene ? (JSON.parse(rawScene) as SavedScene) : null;
}

export function migrateLegacySceneStorage() {
  const legacyScene = localStorage.getItem(SCENE_STORAGE_KEY);

  if (!legacyScene) return;

  try {
    const savedScene = JSON.parse(legacyScene) as SavedScene;
    const name = savedScene.name || "Untitled Scene";

    if (!localStorage.getItem(createProjectStorageKey(name))) {
      localStorage.setItem(createProjectStorageKey(name), legacyScene);
      addProjectName(name);
      localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, name);
    }

    localStorage.removeItem(SCENE_STORAGE_KEY);
  } catch {
    localStorage.removeItem(SCENE_STORAGE_KEY);
  }
}

export function serializeTransform(
  object: THREE.Object3D,
): {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
} {
  return {
    position: [object.position.x, object.position.y, object.position.z],
    rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
    scale: [object.scale.x, object.scale.y, object.scale.z],
  };
}

export function applySavedTransform(
  object: THREE.Object3D,
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  },
) {
  object.position.fromArray(transform.position);

  object.rotation.set(
    transform.rotation[0],
    transform.rotation[1],
    transform.rotation[2],
  );

  object.scale.fromArray(transform.scale);
}
