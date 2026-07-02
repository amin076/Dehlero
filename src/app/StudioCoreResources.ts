import * as THREE from "three";
import type { ISheetObject } from "@theatre/core";
import { SceneRegistry } from "../core/scene/SceneRegistry";
import { SelectionManager } from "../editor/SelectionManager";
import { createStudioCamera } from "../engine/camera/createStudioCamera";
import { createRenderer } from "../engine/renderer/createRenderer";
import { createScene } from "../engine/scene/createScene";
import { createLibraryWithRegistry } from "./studioLibrary";
import type { SceneHelper, TheatreBinding } from "./studioTypes";

export async function createStudioCoreResources() {
  const registry = new SceneRegistry();
  const selection = new SelectionManager();
  const scene = createScene();
  const camera = createStudioCamera();
  const renderer = createRenderer();
  const clock = new THREE.Clock();
  const helpers = new Map<string, SceneHelper>();
  const library = await createLibraryWithRegistry();
  const theatreBindings = new Map<string, TheatreBinding>();

  return {
    registry,
    selection,
    scene,
    camera,
    renderer,
    clock,
    helpers,
    library,
    theatreBindings,
  };
}

export type StudioCoreResources = Awaited<
  ReturnType<typeof createStudioCoreResources>
>;

export type TheatreSheetObject = ISheetObject<any>;
