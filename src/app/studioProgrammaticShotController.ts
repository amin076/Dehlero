import type { SceneNode } from "../core/scene/SceneNode";
import type {
  ProgramContext,
  ProgramInstance,
  ProgramRuntimeBindings,
} from "../programs/programTypes";
import { programRegistry } from "../programs/programRegistry";

const PANEL_STORAGE_KEY = "dehlero.programmaticPanel.position";

type SavedPanelPosition = {
  left: number;
  top: number;
};

function loadPanelPosition(): SavedPanelPosition {
  try {
    const raw = localStorage.getItem(PANEL_STORAGE_KEY);
    if (!raw) return { left: 24, top: 420 };

    const parsed = JSON.parse(raw) as Partial<SavedPanelPosition>;

    return {
      left: typeof parsed.left === "number" ? parsed.left : 24,
      top: typeof parsed.top === "number" ? parsed.top : 420,
    };
  } catch {
    return { left: 24, top: 420 };
  }
}

function savePanelPosition(position: SavedPanelPosition) {
  localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(position));
}

export function createProgrammaticShotController(
  context: ProgramContext & {
    getSceneNodes?: () => SceneNode[];
  },
) {
  let activeProgram: ProgramInstance | null = null;

  const panel = document.createElement("div");
  panel.className = "programmatic-shot-panel dehlero-floating-panel";

  const savedPosition = loadPanelPosition();

  panel.style.position = "fixed";
  panel.style.left = `${savedPosition.left}px`;
  panel.style.top = `${savedPosition.top}px`;
  panel.style.zIndex = "80";
  panel.style.display = "flex";
  panel.style.flexDirection = "column";
  panel.style.gap = "8px";
  panel.style.width = "280px";
  panel.style.padding = "12px";
  panel.style.borderRadius = "18px";
  panel.style.border = "1px solid rgba(255,255,255,0.18)";
  panel.style.background = "rgba(10, 15, 25, 0.72)";
  panel.style.backdropFilter = "blur(18px)";
  panel.style.boxShadow = "0 18px 60px rgba(0,0,0,0.38)";
  panel.style.color = "white";
  panel.style.fontSize = "12px";
  panel.style.userSelect = "none";

  panel.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });

  panel.addEventListener("pointerup", (event) => {
    event.stopPropagation();
  });

  const title = document.createElement("div");
  title.textContent = "Programmatic Shots";
  title.style.fontWeight = "800";
  title.style.cursor = "grab";
  title.style.padding = "4px 2px 8px";
  title.style.letterSpacing = "0.02em";

  const programSelect = document.createElement("select");
  programSelect.title = "Programmatic Shots";

  programRegistry.forEach((program) => {
    const option = document.createElement("option");
    option.value = program.id;
    option.textContent = program.name;
    programSelect.appendChild(option);
  });

  function createObjectSelect(titleText: string) {
    const wrapper = document.createElement("label");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.gap = "4px";
    wrapper.style.fontSize = "11px";
    wrapper.style.color = "rgba(255,255,255,0.72)";

    const caption = document.createElement("span");
    caption.textContent = titleText;

    const select = document.createElement("select");
    select.title = titleText;

    wrapper.append(caption, select);

    return { wrapper, select };
  }

  const ballControl = createObjectSelect("Ball");
  const shuttleControl = createObjectSelect("Shuttle");
  const saturnControl = createObjectSelect("Saturn");
  const astronaut1Control = createObjectSelect("Astronaut 1");
  const astronaut2Control = createObjectSelect("Astronaut 2");

  const ballSelect = ballControl.select;
  const shuttleSelect = shuttleControl.select;
  const saturnSelect = saturnControl.select;
  const astronaut1Select = astronaut1Control.select;
  const astronaut2Select = astronaut2Control.select;

  const refreshButton = document.createElement("button");
  refreshButton.type = "button";
  refreshButton.textContent = "Refresh Objects";

  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.textContent = "Play Program";

  const stopButton = document.createElement("button");
  stopButton.type = "button";
  stopButton.textContent = "Stop";

  function styleControl(element: HTMLElement) {
    element.style.border = "1px solid rgba(255,255,255,0.18)";
    element.style.borderRadius = "10px";
    element.style.padding = "7px 8px";
    element.style.background = "rgba(255,255,255,0.08)";
    element.style.color = "white";
  }

  [
    programSelect,
    ballSelect,
    shuttleSelect,
    saturnSelect,
    astronaut1Select,
    astronaut2Select,
    refreshButton,
    playButton,
    stopButton,
  ].forEach(styleControl);

  function getSceneNodes() {
    return context.getSceneNodes?.() ?? [];
  }

  function refreshObjectOptions() {
    const nodes = getSceneNodes();

    const selects = [
      { select: ballSelect, placeholder: "Select ball..." },
      { select: shuttleSelect, placeholder: "Select shuttle..." },
      { select: saturnSelect, placeholder: "Select Saturn..." },
      { select: astronaut1Select, placeholder: "Select Astronaut 1..." },
      { select: astronaut2Select, placeholder: "Select Astronaut 2..." },
    ];

    selects.forEach(({ select, placeholder }) => {
      const previousValue = select.value;

      select.innerHTML = "";

      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = placeholder;
      select.appendChild(emptyOption);

      nodes.forEach((node) => {
        const option = document.createElement("option");
        option.value = node.id;
        option.textContent = node.name;
        select.appendChild(option);
      });

      if (previousValue) {
        select.value = previousValue;
      }
    });

    context.setStatus?.(`Program objects refreshed: ${nodes.length}`);
  }

  function findNode(id: string) {
    return getSceneNodes().find((node) => node.id === id) ?? null;
  }

  function enableDragging() {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    title.addEventListener("pointerdown", (event) => {
      dragging = true;
      title.style.cursor = "grabbing";

      const rect = panel.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;

      title.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    });

    title.addEventListener("pointermove", (event) => {
      if (!dragging) return;

      const nextLeft = Math.max(
        8,
        Math.min(
          window.innerWidth - panel.offsetWidth - 8,
          event.clientX - offsetX,
        ),
      );

      const nextTop = Math.max(
        8,
        Math.min(
          window.innerHeight - panel.offsetHeight - 8,
          event.clientY - offsetY,
        ),
      );

      panel.style.left = `${nextLeft}px`;
      panel.style.top = `${nextTop}px`;
    });

    title.addEventListener("pointerup", (event) => {
      if (!dragging) return;

      dragging = false;
      title.style.cursor = "grab";

      const rect = panel.getBoundingClientRect();

      savePanelPosition({
        left: rect.left,
        top: rect.top,
      });

      title.releasePointerCapture(event.pointerId);
    });
  }

  refreshButton.onclick = refreshObjectOptions;

  playButton.onclick = () => {
    const selectedProgram = programRegistry.find(
      (program) => program.id === programSelect.value,
    );

    if (!selectedProgram) {
      context.setStatus?.("No program selected");
      return;
    }

    const ballNode = findNode(ballSelect.value);
    const shuttleNode = findNode(shuttleSelect.value);
    const saturnNode = findNode(saturnSelect.value);
    const astronaut1Node = findNode(astronaut1Select.value);
    const astronaut2Node = findNode(astronaut2Select.value);

    if (
      !ballNode ||
      !shuttleNode ||
      !saturnNode ||
      !astronaut1Node ||
      !astronaut2Node
    ) {
      context.setStatus?.(
        "Select Ball, Shuttle, Saturn, Astronaut 1 and Astronaut 2 first",
      );
      return;
    }

    activeProgram?.stop();

    const runtimeBindings: ProgramRuntimeBindings = {
      "hero.ball": ballNode.root,
      "hero.shuttle": shuttleNode.root,
      "hero.saturn": saturnNode.root,
      "hero.astronaut1": astronaut1Node.root,
      "hero.astronaut2": astronaut2Node.root,
    };

    // Expose every scene object by its name
    for (const node of getSceneNodes()) {
      runtimeBindings[node.name] = node.root;
    }

    activeProgram = selectedProgram.create({
      ...context,
      runtimeBindings,
    });

    activeProgram.play();
  };

  stopButton.onclick = () => {
    activeProgram?.stop();
    activeProgram = null;
  };

  panel.append(
    title,
    programSelect,
    ballControl.wrapper,
    shuttleControl.wrapper,
    saturnControl.wrapper,
    astronaut1Control.wrapper,
    astronaut2Control.wrapper,
    refreshButton,
    playButton,
    stopButton,
  );

  document.body.appendChild(panel);

  enableDragging();
  refreshObjectOptions();

  function update(delta: number) {
    activeProgram?.update(delta);
  }

  function dispose() {
    activeProgram?.stop();
    activeProgram = null;
    panel.remove();
  }

  return {
    update,
    dispose,
    refreshObjectOptions,
  };
}