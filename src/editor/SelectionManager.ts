import type { SceneNode } from "../core/scene/SceneNode";
import type { SceneRegistry } from "../core/scene/SceneRegistry";

export class SelectionManager {
  private selected: SceneNode | null = null;

  select(node: SceneNode) {
    if (node.locked) {
      return;
    }

    this.selected = node;
  }

  selectById(id: string, registry: SceneRegistry) {
    const node = registry.get(id);

    if (!node) {
      return;
    }

    if (node.locked) {
      return;
    }

    this.selected = node;
  }

  clear() {
    this.selected = null;
  }

  getSelected() {
    return this.selected;
  }

  isSelected(node: SceneNode) {
    return this.selected?.id === node.id;
  }

  hasSelection() {
    return this.selected !== null;
  }

  getSelectedId() {
    return this.selected?.id;
  }
}
