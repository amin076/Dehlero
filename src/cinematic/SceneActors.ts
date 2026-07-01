import * as THREE from "three";

export class SceneActors {
  private readonly scene: THREE.Scene;
  private readonly actors = new Map<string, THREE.Object3D>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.scan();
  }

  scan(): this {
    this.actors.clear();

    this.scene.traverse((object) => {
      if (!object.name) return;

      this.actors.set(object.name, object);
      this.actors.set(object.name.toLowerCase(), object);
    });

    return this;
  }

  has(name: string): boolean {
    return this.actors.has(name) || this.actors.has(name.toLowerCase());
  }

  get(name: string): THREE.Object3D {
    const actor =
      this.actors.get(name) ??
      this.actors.get(name.toLowerCase());

    if (!actor) {
      throw new Error(
        `[SceneActors] Actor not found: "${name}". Make sure the object exists and has this name.`,
      );
    }

    return actor;
  }

  find(name: string): THREE.Object3D | null {
    return (
      this.actors.get(name) ??
      this.actors.get(name.toLowerCase()) ??
      null
    );
  }

  names(): string[] {
    return Array.from(new Set(this.actors.keys())).sort();
  }

  require(names: string[]): Record<string, THREE.Object3D> {
    const result: Record<string, THREE.Object3D> = {};

    for (const name of names) {
      result[name] = this.get(name);
    }

    return result;
  }
}