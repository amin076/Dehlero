import type { SavedScene } from "./studioTypes";
import { saveSceneToStorage } from "./studioScenePersistence";

export const DEHLERO_PROJECT_FILE_VERSION = 1;
export const DEHLERO_SCENE_FILE_VERSION = 1;

export type DehleroSceneFile = {
  version: 1;
  type: "dehlero.scene";
  exportedAt: string;
  scene: SavedScene;
};

export type DehleroProjectFile = {
  version: 1;
  type: "dehlero.project";
  exportedAt: string;
  activeSceneName: string;
  scenes: SavedScene[];
};

export type ImportResult = {
  activeScene: SavedScene;
  importedScenes: SavedScene[];
};

const ACCEPTED_EXTENSIONS = ".dehlero,.dhlscene,.json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${label}`);
  }

  return value.trim();
}

function normalizeSceneVersion(value: unknown): SavedScene["version"] {
  if (value === undefined || value === null) return 1;
  if (value === 1 || value === 2) return value;
  throw new Error("Invalid scene version");
}

function normalizeSavedScene(value: unknown): SavedScene {
  if (!isRecord(value)) {
    throw new Error("Invalid scene file");
  }

  const name = assertString(value.name, "scene name");
  const version = normalizeSceneVersion(value.version);
  const objects = Array.isArray(value.objects) ? value.objects : [];
  const timeline = Array.isArray(value.timeline) ? value.timeline : [];

  return {
    ...(value as SavedScene),
    version,
    name,
    objects: objects as SavedScene["objects"],
    timeline: timeline as SavedScene["timeline"],
  };
}

function parseImportedPayload(payload: unknown): ImportResult {
  if (!isRecord(payload)) {
    throw new Error("Import failed: file is not a valid Dehlero JSON file");
  }

  if (payload.type === "dehlero.scene") {
    const scene = normalizeSavedScene(payload.scene);
    return {
      activeScene: scene,
      importedScenes: [scene],
    };
  }

  if (payload.type === "dehlero.project") {
    const scenesValue = payload.scenes;
    if (!Array.isArray(scenesValue) || scenesValue.length === 0) {
      throw new Error("Import failed: project has no scenes");
    }

    const scenes = scenesValue.map(normalizeSavedScene);
    const activeSceneName =
      typeof payload.activeSceneName === "string" ? payload.activeSceneName : "";
    const activeScene =
      scenes.find((scene) => scene.name === activeSceneName) ?? scenes[0];

    return {
      activeScene,
      importedScenes: scenes,
    };
  }

  if (typeof payload.name === "string" && Array.isArray(payload.objects)) {
    const scene = normalizeSavedScene(payload);
    return {
      activeScene: scene,
      importedScenes: [scene],
    };
  }

  throw new Error("Import failed: unsupported Dehlero file type");
}

async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text();

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Import failed: file is not valid JSON");
  }
}

function downloadJsonFile(fileName: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.click();

  URL.revokeObjectURL(url);
}

function safeFileName(name: string, extension: string) {
  const cleaned = name
    .trim()
    .replace(/[^a-z0-9-_ ]/gi, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return `${cleaned || "dehlero-scene"}.${extension}`;
}

export function exportSceneFile(scene: SavedScene) {
  const payload: DehleroSceneFile = {
    version: DEHLERO_SCENE_FILE_VERSION,
    type: "dehlero.scene",
    exportedAt: new Date().toISOString(),
    scene,
  };

  downloadJsonFile(safeFileName(scene.name, "dhlscene"), payload);
}

export function exportProjectFileBundle({
  activeSceneName,
  scenes,
}: {
  activeSceneName: string;
  scenes: SavedScene[];
}) {
  const payload: DehleroProjectFile = {
    version: DEHLERO_PROJECT_FILE_VERSION,
    type: "dehlero.project",
    exportedAt: new Date().toISOString(),
    activeSceneName,
    scenes,
  };

  downloadJsonFile(safeFileName(activeSceneName || "dehlero-project", "dehlero"), payload);
}

export async function importDehleroFile(file: File): Promise<ImportResult> {
  const payload = await readJsonFile(file);
  const result = parseImportedPayload(payload);

  result.importedScenes.forEach(saveSceneToStorage);

  return result;
}

export function chooseDehleroImportFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");

    input.type = "file";
    input.accept = ACCEPTED_EXTENSIONS;
    input.style.display = "none";

    input.addEventListener(
      "change",
      () => {
        const file = input.files?.[0] ?? null;
        input.remove();
        resolve(file);
      },
      { once: true },
    );

    document.body.appendChild(input);
    input.click();
  });
}
