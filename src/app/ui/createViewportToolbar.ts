export function createViewportToolbar({
  root,
  getGridVisible,
  setGridVisible,
}: {
  root: HTMLElement;
  getGridVisible: () => boolean;
  setGridVisible: (visible: boolean) => void;
}) {
  const toolbar = document.createElement("div");
  toolbar.className = "viewport-toolbar glass-panel";

  const gridButton = document.createElement("button");
  gridButton.type = "button";

  function refresh() {
    gridButton.textContent = getGridVisible() ? "Grid: On" : "Grid: Off";
  }

  gridButton.onclick = () => {
    setGridVisible(!getGridVisible());
    refresh();
  };

  refresh();
  toolbar.appendChild(gridButton);
  root.appendChild(toolbar);

  return {
    refresh,
  };
}