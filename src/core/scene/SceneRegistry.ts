import type { SceneNode } from "./SceneNode";

export class SceneRegistry {
  private nodes = new Map<string, SceneNode>();

  register(node: SceneNode) {
    this.nodes.set(node.id, node);
  }

  unregister(id: string) {
    const node = this.nodes.get(id);

    if (!node) return;

    if (node.parentId) {
      const parent = this.nodes.get(node.parentId);

      if (parent) {
        parent.childrenIds = parent.childrenIds.filter(
          (childId) => childId !== id,
        );
      }
    }

    node.childrenIds.forEach((childId) => {
      const child = this.nodes.get(childId);

      if (child) {
        child.parentId = null;
      }
    });

    this.nodes.delete(id);
  }

  get(id: string) {
    return this.nodes.get(id);
  }

  getAll() {
    return [...this.nodes.values()];
  }

  findByName(name: string) {
    return this.getAll().find(
      (node) => node.name === name,
    );
  }

  getRootNodes() {
    return this.getAll().filter(
      (node) => !node.parentId,
    );
  }

  addChild(
    parentId: string,
    childId: string,
  ) {
    const parent = this.nodes.get(parentId);
    const child = this.nodes.get(childId);

    if (!parent || !child) return;

    if (child.parentId) {
      this.removeFromParent(childId);
    }

    child.parentId = parentId;

    if (
      !parent.childrenIds.includes(childId)
    ) {
      parent.childrenIds.push(childId);
    }
  }

  removeFromParent(childId: string) {
    const child = this.nodes.get(childId);

    if (!child?.parentId) return;

    const parent = this.nodes.get(
      child.parentId,
    );

    if (parent) {
      parent.childrenIds =
        parent.childrenIds.filter(
          (id) => id !== childId,
        );
    }

    child.parentId = null;
  }

  reparent(
    childId: string,
    newParentId: string,
  ) {
    this.removeFromParent(childId);
    this.addChild(
      newParentId,
      childId,
    );
  }
}
