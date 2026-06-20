export function createSafeAreaOverlay(root: HTMLElement) {
  const overlay = document.createElement("div");
  overlay.className = "safe-area-overlay";
  overlay.innerHTML = `
    <div class="safe-area-frame">
      <span>9:16 Safe Area</span>
    </div>
  `;

  root.appendChild(overlay);
  return overlay;
}
