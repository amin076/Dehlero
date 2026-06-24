import type { WorkspaceMode } from "../studioTypes";

export function createWorkspaceBar({
  root,
  onModeChange,
  onSave,
}: {
  root: HTMLElement;
  onModeChange: (mode: WorkspaceMode) => void;
  onSave: () => void;
}) {
  const bar = document.createElement("header");

  bar.className = "workspace-bar";

  bar.innerHTML = `
    <div class="workspace-brand">
      <strong>Dehlero Studio</strong>
      <span>Scene and motion editor</span>
    </div>

    <nav class="workspace-tabs" aria-label="Workspace">
      <button type="button" data-workspace="scene">Scene</button>
      <button type="button" data-workspace="shots">Shots</button>
      <button type="button" data-workspace="animate">Animate</button>
      <button type="button" data-workspace="record">Record</button>
    </nav>

    <div class="workspace-actions">
      <button type="button" data-panel-toggle="assets">Assets</button>
      <button type="button" data-panel-toggle="inspector">Inspector</button>
      <button type="button" data-action="save">Save</button>
    </div>
  `;

  let activeMode: WorkspaceMode = "scene";

  function setMode(mode: WorkspaceMode) {
    activeMode = mode;
    root.dataset.workspace = mode;

    bar
      .querySelectorAll<HTMLButtonElement>("[data-workspace]")
      .forEach((button) => {
        button.classList.toggle(
          "is-active",
          button.dataset.workspace === mode,
        );
      });

    onModeChange(mode);
  }

  bar.querySelectorAll<HTMLButtonElement>("[data-workspace]").forEach(
    (button) => {
      button.onclick = () =>
        setMode(button.dataset.workspace as WorkspaceMode);
    },
  );

  bar.querySelector<HTMLButtonElement>('[data-action="save"]')!.onclick =
    onSave;

  bar
    .querySelectorAll<HTMLButtonElement>("[data-panel-toggle]")
    .forEach((button) => {
      button.onclick = () => {
        const key = button.dataset.panelToggle;

        if (!key) return;

        const attribute = key === "assets" ? "assetsOpen" : "inspectorOpen";
        const nextValue = root.dataset[attribute] !== "true";

        root.dataset[attribute] = String(nextValue);
        button.classList.toggle("is-active", nextValue);

        window.dispatchEvent(new Event("resize"));
      };
    });

  root.appendChild(bar);

  setMode(activeMode);

  return {
    setMode,
  };
}
