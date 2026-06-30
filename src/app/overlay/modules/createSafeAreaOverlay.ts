import type { OverlayController } from "../OverlayTypes";
import { insetRect, rectToCssVars } from "../overlayMath";

export function createSafeAreaOverlay(
  viewport: HTMLElement,
  controller: OverlayController,
) {
  const root = document.createElement("div");
  root.className = "dehlero-safe-area-overlay";

  root.innerHTML = `
    <div class="dehlero-safe-area-mask"></div>
    <div class="dehlero-safe-area-frame"></div>
    <div class="dehlero-safe-area-title-safe"></div>
    <div class="dehlero-safe-area-action-safe"></div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    .dehlero-safe-area-overlay {
      position: absolute;
      inset: 0;
      z-index: 30;
      pointer-events: none;
      contain: layout paint style;
      --safe-x: 0px;
      --safe-y: 0px;
      --safe-w: 1px;
      --safe-h: 1px;
      --action-x: 0px;
      --action-y: 0px;
      --action-w: 1px;
      --action-h: 1px;
      --title-x: 0px;
      --title-y: 0px;
      --title-w: 1px;
      --title-h: 1px;
    }

    .dehlero-safe-area-mask {
      position: absolute;
      inset: 0;
      background:
        linear-gradient(rgba(0,0,0,0.34), rgba(0,0,0,0.34));
      clip-path: polygon(
        0 0,
        100% 0,
        100% 100%,
        0 100%,
        0 0,
        var(--safe-x) var(--safe-y),
        var(--safe-x) calc(var(--safe-y) + var(--safe-h)),
        calc(var(--safe-x) + var(--safe-w)) calc(var(--safe-y) + var(--safe-h)),
        calc(var(--safe-x) + var(--safe-w)) var(--safe-y),
        var(--safe-x) var(--safe-y)
      );
      opacity: 0.55;
    }

    .dehlero-safe-area-frame {
      position: absolute;
      left: var(--safe-x);
      top: var(--safe-y);
      width: var(--safe-w);
      height: var(--safe-h);
      border: 2px solid rgba(255, 216, 77, 0.95);
      box-shadow:
        0 0 0 1px rgba(0,0,0,0.6),
        0 0 22px rgba(255, 216, 77, 0.25);
      box-sizing: border-box;
    }

    .dehlero-safe-area-action-safe {
      position: absolute;
      left: var(--action-x);
      top: var(--action-y);
      width: var(--action-w);
      height: var(--action-h);
      border: 1px dashed rgba(255, 216, 77, 0.48);
      box-sizing: border-box;
    }

    .dehlero-safe-area-title-safe {
      position: absolute;
      left: var(--title-x);
      top: var(--title-y);
      width: var(--title-w);
      height: var(--title-h);
      border: 1px dashed rgba(255, 255, 255, 0.38);
      box-sizing: border-box;
    }
  `;

  document.head.appendChild(style);
  viewport.appendChild(root);

  function apply() {
    const state = controller.getState();

    root.style.display =
      state.enabled && state.showSafeArea ? "block" : "none";

    const safe = state.safeArea;
    const actionSafe = insetRect(safe, 0.05);
    const titleSafe = insetRect(safe, 0.10);

    const vars = {
      ...rectToCssVars(safe),
      "--action-x": `${actionSafe.x}px`,
      "--action-y": `${actionSafe.y}px`,
      "--action-w": `${actionSafe.width}px`,
      "--action-h": `${actionSafe.height}px`,
      "--title-x": `${titleSafe.x}px`,
      "--title-y": `${titleSafe.y}px`,
      "--title-w": `${titleSafe.width}px`,
      "--title-h": `${titleSafe.height}px`,
    };

    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
  }

  const unsubscribe = controller.subscribe(apply);
  apply();

  return {
    element: root,

    update: apply,

    dispose() {
      unsubscribe();
      root.remove();
      style.remove();
    },
  };
}