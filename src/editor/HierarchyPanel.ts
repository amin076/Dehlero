import type { SceneNode } from "../core/scene/SceneNode";
import { SceneRegistry } from "../core/scene/SceneRegistry";
import { SelectionManager } from "./SelectionManager";

type TransformEditorApi = {
  selectNode: (id: string) => void;
};

export class HierarchyPanel {
  private element: HTMLDivElement;

  private registry: SceneRegistry;
  private selection: SelectionManager;
  private transformEditor: TransformEditorApi;

  constructor(
    registry: SceneRegistry,
    selection: SelectionManager,
    transformEditor: TransformEditorApi,
  ) {
    this.registry = registry;
    this.selection = selection;
    this.transformEditor = transformEditor;

    this.element = document.createElement("div");
    this.element.className = "hierarchy-panel";
  }

  getElement() {
    return this.element;
  }

  refresh() {
    this.element.innerHTML = "";

    const title = document.createElement("h3");
    title.textContent = "Hierarchy";

    this.element.appendChild(title);

    this.registry.getRootNodes().forEach((node) => {
      this.renderNode(node, 0);
    });
  }

  private renderNode(
    node: SceneNode,
    depth: number,
  ) {
    const row = document.createElement("div");

    row.className = "hierarchy-row";
    row.style.paddingLeft = `${depth * 16}px`;
    row.textContent = node.name;

    if (this.selection.isSelected(node)) {
      row.classList.add("hierarchy-selected");
    }

    if (!node.visible) {
      row.style.opacity = "0.5";
    }

    row.onclick = () => {
      this.transformEditor.selectNode(node.id);
      this.refresh();
    };

    this.element.appendChild(row);

    node.childrenIds.forEach((childId) => {
      const child = this.registry.get(childId);

      if (child) {
        this.renderNode(child, depth + 1);
      }
    });
  }
}
