import type { OverlayController } from "../OverlayTypes";
import { insetRect } from "../overlayMath";

export type CinematicTitleStylePreset =
  | "trailer"
  | "documentary"
  | "minimal"
  | "science"
  | "broadcast";

export interface CinematicTitleOptions {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  durationMs?: number;
  preset?: CinematicTitleStylePreset;
  accentColor?: string;
  textColor?: string;
  titleSize?: number;
  subtitleSize?: number;
  eyebrowSize?: number;
  maxWidth?: number;
  shadowStrength?: number;
  glow?: boolean;
}

type TitlePresetStyle = {
  accentColor: string;
  textColor: string;
  titleSize: number;
  subtitleSize: number;
  eyebrowSize: number;
  maxWidth: number;
  titleWeight: number;
  subtitleWeight: number;
  letterSpacing: string;
  titleTransform: string;
  glow: boolean;
  shadowStrength: number;
};

const PRESETS: Record<CinematicTitleStylePreset, TitlePresetStyle> = {
  trailer: {
    accentColor: "#ffd24a",
    textColor: "#ffffff",
    titleSize: 58,
    subtitleSize: 22,
    eyebrowSize: 17,
    maxWidth: 0.82,
    titleWeight: 950,
    subtitleWeight: 720,
    letterSpacing: "-0.04em",
    titleTransform: "uppercase",
    glow: true,
    shadowStrength: 0.9,
  },
  broadcast: {
    accentColor: "#75b7ff",
    textColor: "#ffffff",
    titleSize: 46,
    subtitleSize: 21,
    eyebrowSize: 15,
    maxWidth: 0.78,
    titleWeight: 850,
    subtitleWeight: 650,
    letterSpacing: "-0.02em",
    titleTransform: "none",
    glow: false,
    shadowStrength: 0.8,
  },
  documentary: {
    accentColor: "#e8d6a8",
    textColor: "#f7f2e8",
    titleSize: 42,
    subtitleSize: 20,
    eyebrowSize: 14,
    maxWidth: 0.74,
    titleWeight: 760,
    subtitleWeight: 560,
    letterSpacing: "-0.01em",
    titleTransform: "none",
    glow: false,
    shadowStrength: 0.75,
  },
  science: {
    accentColor: "#78f0ff",
    textColor: "#ffffff",
    titleSize: 44,
    subtitleSize: 19,
    eyebrowSize: 14,
    maxWidth: 0.72,
    titleWeight: 850,
    subtitleWeight: 620,
    letterSpacing: "0.01em",
    titleTransform: "none",
    glow: true,
    shadowStrength: 0.78,
  },
  minimal: {
    accentColor: "#ffffff",
    textColor: "#ffffff",
    titleSize: 38,
    subtitleSize: 18,
    eyebrowSize: 12,
    maxWidth: 0.70,
    titleWeight: 720,
    subtitleWeight: 500,
    letterSpacing: "0em",
    titleTransform: "none",
    glow: false,
    shadowStrength: 0.65,
  },
};

export function createTitleOverlay(
  viewport: HTMLElement,
  controller: OverlayController,
) {
  const root = document.createElement("div");
  root.className = "dehlero-title-overlay";
  root.style.display = "none";

  root.innerHTML = `
    <div class="dehlero-title-box">
      <div class="dehlero-title-eyebrow"></div>
      <div class="dehlero-title-main"></div>
      <div class="dehlero-title-subtitle"></div>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    .dehlero-title-overlay {
      position: absolute;
      z-index: 40;
      pointer-events: none;
      contain: layout paint style;
      align-items: center;
      justify-content: center;
      text-align: center;
      box-sizing: border-box;
      padding: 3.5%;
      overflow: hidden;
    }

    .dehlero-title-box {
      width: min(100%, var(--dehlero-title-max-width, 82%));
      max-width: var(--dehlero-title-max-width, 82%);
      color: var(--dehlero-title-color, #ffffff);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      text-shadow:
        0 4px calc(16px * var(--dehlero-title-shadow, 0.85)) rgba(0,0,0,0.95),
        0 12px calc(34px * var(--dehlero-title-shadow, 0.85)) rgba(0,0,0,0.78);
      animation: dehlero-title-rise 760ms cubic-bezier(.2,.85,.25,1) both;
      will-change: transform, opacity, filter;
    }

    .dehlero-title-box[data-glow="true"] {
      text-shadow:
        0 5px 20px rgba(0,0,0,0.96),
        0 14px 42px rgba(0,0,0,0.82),
        0 0 26px color-mix(in srgb, var(--dehlero-title-accent, #ffd24a) 45%, transparent);
    }

    .dehlero-title-eyebrow {
      color: var(--dehlero-title-accent, #ffd24a);
      font-size: var(--dehlero-eyebrow-size, 17px);
      font-weight: 850;
      letter-spacing: 0.24em;
      text-transform: uppercase;
      margin-bottom: 0.55em;
      line-height: 1.2;
    }

    .dehlero-title-main {
      color: var(--dehlero-title-color, #ffffff);
      font-size: var(--dehlero-main-size, 58px);
      font-weight: var(--dehlero-main-weight, 950);
      line-height: 0.96;
      letter-spacing: var(--dehlero-main-spacing, -0.04em);
      text-transform: var(--dehlero-main-transform, uppercase);
      overflow-wrap: anywhere;
      word-break: normal;
      hyphens: auto;
    }

    .dehlero-title-subtitle {
      margin: 0.78em auto 0;
      max-width: min(90%, 620px);
      color: color-mix(in srgb, var(--dehlero-title-color, #ffffff) 92%, transparent);
      font-size: var(--dehlero-subtitle-size, 22px);
      font-weight: var(--dehlero-subtitle-weight, 700);
      line-height: 1.18;
      letter-spacing: 0.015em;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }

    @keyframes dehlero-title-rise {
      from {
        opacity: 0;
        transform: translateY(20px) scale(0.975);
        filter: blur(7px);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
        filter: blur(0);
      }
    }
  `;

  document.head.appendChild(style);
  viewport.appendChild(root);

  const box = root.querySelector<HTMLElement>(".dehlero-title-box");
  const eyebrowEl = root.querySelector<HTMLElement>(".dehlero-title-eyebrow");
  const titleEl = root.querySelector<HTMLElement>(".dehlero-title-main");
  const subtitleEl = root.querySelector<HTMLElement>(".dehlero-title-subtitle");

  let timer: number | null = null;
  let lastOptions: CinematicTitleOptions | null = null;

  function applySafeArea() {
    const state = controller.getState();
    const titleSafe = insetRect(state.safeArea, 0.08);

    root.style.left = `${titleSafe.x}px`;
    root.style.top = `${titleSafe.y}px`;
    root.style.width = `${titleSafe.width}px`;
    root.style.height = `${titleSafe.height}px`;
    root.style.visibility = state.recording ? "hidden" : "visible";

    if (root.style.display !== "none" && lastOptions) {
      const options = lastOptions;
      window.requestAnimationFrame(() => fitTitleToSafeArea(options));
    }
  }

  function show(options: CinematicTitleOptions) {
    lastOptions = options;
    applySafeArea();

    const preset = PRESETS[options.preset ?? "trailer"] ?? PRESETS.trailer;
    const accentColor = options.accentColor || preset.accentColor;
    const textColor = options.textColor || preset.textColor;
    const titleSize = clamp(options.titleSize ?? preset.titleSize, 18, 140);
    const subtitleSize = clamp(options.subtitleSize ?? preset.subtitleSize, 10, 72);
    const eyebrowSize = clamp(options.eyebrowSize ?? preset.eyebrowSize, 8, 48);
    const maxWidth = clamp(options.maxWidth ?? preset.maxWidth, 0.35, 0.96);
    const shadow = clamp(options.shadowStrength ?? preset.shadowStrength, 0, 1.5);
    const glow = options.glow ?? preset.glow;

    if (box) {
      box.style.setProperty("--dehlero-title-max-width", `${Math.round(maxWidth * 100)}%`);
      box.style.setProperty("--dehlero-title-accent", accentColor);
      box.style.setProperty("--dehlero-title-color", textColor);
      box.style.setProperty("--dehlero-main-size", `${titleSize}px`);
      box.style.setProperty("--dehlero-subtitle-size", `${subtitleSize}px`);
      box.style.setProperty("--dehlero-eyebrow-size", `${eyebrowSize}px`);
      box.style.setProperty("--dehlero-title-shadow", `${shadow}`);
      box.style.setProperty("--dehlero-main-weight", `${preset.titleWeight}`);
      box.style.setProperty("--dehlero-subtitle-weight", `${preset.subtitleWeight}`);
      box.style.setProperty("--dehlero-main-spacing", preset.letterSpacing);
      box.style.setProperty("--dehlero-main-transform", preset.titleTransform);
      box.dataset.glow = String(glow);
    }

    if (eyebrowEl) {
      eyebrowEl.textContent = options.eyebrow ?? "";
      eyebrowEl.style.display = options.eyebrow ? "block" : "none";
    }

    if (titleEl) {
      titleEl.textContent = options.title;
    }

    if (subtitleEl) {
      subtitleEl.textContent = options.subtitle ?? "";
      subtitleEl.style.display = options.subtitle ? "block" : "none";
    }

    root.style.display = "flex";

    if (box) {
      box.style.animation = "none";
      box.offsetHeight;
      box.style.animation = "";
    }

    window.requestAnimationFrame(() => fitTitleToSafeArea(options));

    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }

    if (options.durationMs && options.durationMs > 0) {
      timer = window.setTimeout(() => {
        hide();
      }, options.durationMs);
    }
  }

  function fitTitleToSafeArea(options: CinematicTitleOptions) {
    if (!box || !titleEl || root.style.display === "none") return;

    const preset = PRESETS[options.preset ?? "trailer"] ?? PRESETS.trailer;
    let titleSize = clamp(options.titleSize ?? preset.titleSize, 18, 140);
    let subtitleSize = clamp(options.subtitleSize ?? preset.subtitleSize, 10, 72);
    let eyebrowSize = clamp(options.eyebrowSize ?? preset.eyebrowSize, 8, 48);
    const minTitle = Math.max(18, titleSize * 0.42);
    const minSubtitle = Math.max(11, subtitleSize * 0.55);
    const minEyebrow = Math.max(8, eyebrowSize * 0.55);

    box.style.setProperty("--dehlero-main-size", `${titleSize}px`);
    box.style.setProperty("--dehlero-subtitle-size", `${subtitleSize}px`);
    box.style.setProperty("--dehlero-eyebrow-size", `${eyebrowSize}px`);

    const maxWidth = root.clientWidth * 0.96;
    const maxHeight = root.clientHeight * 0.88;

    for (let i = 0; i < 60; i += 1) {
      const tooWide = box.scrollWidth > maxWidth || titleEl.scrollWidth > maxWidth;
      const tooTall = box.scrollHeight > maxHeight;

      if (!tooWide && !tooTall) break;
      if (titleSize <= minTitle && subtitleSize <= minSubtitle && eyebrowSize <= minEyebrow) break;

      titleSize = Math.max(minTitle, titleSize - 2);
      subtitleSize = Math.max(minSubtitle, subtitleSize - 1);
      eyebrowSize = Math.max(minEyebrow, eyebrowSize - 0.75);

      box.style.setProperty("--dehlero-main-size", `${titleSize}px`);
      box.style.setProperty("--dehlero-subtitle-size", `${subtitleSize}px`);
      box.style.setProperty("--dehlero-eyebrow-size", `${eyebrowSize}px`);
    }
  }

  function hide() {
    root.style.display = "none";
    lastOptions = null;

    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  }

  const unsubscribe = controller.subscribe(applySafeArea);
  applySafeArea();

  return {
    element: root,
    show,
    hide,
    update: applySafeArea,

    dispose() {
      unsubscribe();
      hide();
      root.remove();
      style.remove();
    },
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
