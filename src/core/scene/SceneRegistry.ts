import type { SceneNode } from "./SceneNode";

export class SceneRegistry {
  private nodes = new Map<string, SceneNode>();

  register(node: SceneNode) {
    this.nodes.set(node.id, node);
  }

  unregister(id: string) {
    this.nodes.delete(id);
  }

  get(id: string) {
    return this.nodes.get(id);
  }

  getAll() {
    return [...this.nodes.values()];
  }

  findByName(name: string) {
    return this.getAll().find((node) => node.name === name);
  }
}
