import type { SceneNode } from "../core/scene/SceneNode";

export class SelectionManager {
  private selected: SceneNode | null = null;

  select(node: SceneNode) {
    this.selected = node;
  }

  clear() {
    this.selected = null;
  }

  getSelected() {
    return this.selected;
  }
}
