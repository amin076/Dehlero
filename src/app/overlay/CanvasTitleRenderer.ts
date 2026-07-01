import * as THREE from "three";
import type { CinematicTitleOptions, CinematicTitleStylePreset } from "./modules/createTitleOverlay";

interface TitlePresetStyle {
  accentColor: string;
  textColor: string;
  titleSize: number;
  subtitleSize: number;
  eyebrowSize: number;
  maxWidth: number;
  titleWeight: number;
  subtitleWeight: number;
  letterSpacing: number;
  titleTransform: "uppercase" | "none";
  glow: boolean;
  shadowStrength: number;
}

const PRESETS: Record<CinematicTitleStylePreset, TitlePresetStyle> = {
  trailer: {
    accentColor: "#ffd24a",
    textColor: "#ffffff",
    titleSize: 92,
    subtitleSize: 34,
    eyebrowSize: 25,
    maxWidth: 0.82,
    titleWeight: 950,
    subtitleWeight: 720,
    letterSpacing: -2,
    titleTransform: "uppercase",
    glow: true,
    shadowStrength: 0.9,
  },
  broadcast: {
    accentColor: "#75b7ff",
    textColor: "#ffffff",
    titleSize: 74,
    subtitleSize: 32,
    eyebrowSize: 23,
    maxWidth: 0.78,
    titleWeight: 850,
    subtitleWeight: 650,
    letterSpacing: -1,
    titleTransform: "none",
    glow: false,
    shadowStrength: 0.8,
  },
  documentary: {
    accentColor: "#e8d6a8",
    textColor: "#f7f2e8",
    titleSize: 68,
    subtitleSize: 31,
    eyebrowSize: 22,
    maxWidth: 0.74,
    titleWeight: 760,
    subtitleWeight: 560,
    letterSpacing: 0,
    titleTransform: "none",
    glow: false,
    shadowStrength: 0.75,
  },
  science: {
    accentColor: "#78f0ff",
    textColor: "#ffffff",
    titleSize: 72,
    subtitleSize: 30,
    eyebrowSize: 22,
    maxWidth: 0.72,
    titleWeight: 850,
    subtitleWeight: 620,
    letterSpacing: 1,
    titleTransform: "none",
    glow: true,
    shadowStrength: 0.78,
  },
  minimal: {
    accentColor: "#ffffff",
    textColor: "#ffffff",
    titleSize: 62,
    subtitleSize: 28,
    eyebrowSize: 20,
    maxWidth: 0.7,
    titleWeight: 720,
    subtitleWeight: 500,
    letterSpacing: 0,
    titleTransform: "none",
    glow: false,
    shadowStrength: 0.65,
  },
};

export class CanvasTitleRenderer {
  private readonly scene: THREE.Scene;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly texture: THREE.CanvasTexture;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private lastOptions: CinematicTitleOptions | null = null;
  private recordingMode = false;
  private titleVisible = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.canvas = document.createElement("canvas");
    this.canvas.width = 2048;
    this.canvas.height = 1024;

    const context = this.canvas.getContext("2d");
    if (!context) {
      throw new Error("CanvasTitleRenderer: 2D canvas context is unavailable");
    }
    this.context = context;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;

    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.name = "Dehlero Canvas Title Overlay";
    this.mesh.visible = false;
    this.mesh.renderOrder = 999999;
    this.mesh.frustumCulled = false;

    this.scene.add(this.mesh);
  }

  show(options: CinematicTitleOptions) {
    this.lastOptions = { ...options };
    this.titleVisible = true;
    this.redraw(options);
    this.syncVisibility();
  }

  hide() {
    this.titleVisible = false;
    this.mesh.visible = false;
  }

  setRecordingMode(recording: boolean) {
    this.recordingMode = recording;
    this.syncVisibility();
  }

  update(camera: THREE.PerspectiveCamera) {
    if (!this.mesh.visible) return;

    const distance = Math.max(0.5, Math.min(10, camera.near + 1.2));
    const height = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * distance;
    const width = height * camera.aspect;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    this.mesh.position.copy(camera.position).addScaledVector(forward, distance);
    this.mesh.quaternion.copy(camera.quaternion);
    this.mesh.scale.set(width * 0.92, height * 0.46, 1);
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }

  private syncVisibility() {
    this.mesh.visible = this.recordingMode && this.titleVisible && Boolean(this.lastOptions?.title);
  }

  private redraw(options: CinematicTitleOptions) {
    const preset = PRESETS[options.preset ?? "trailer"] ?? PRESETS.trailer;
    const accentColor = options.accentColor || preset.accentColor;
    const textColor = options.textColor || preset.textColor;
    const titleSize = clamp((options.titleSize ?? preset.titleSize) * 1.55, 32, 210);
    const subtitleSize = clamp((options.subtitleSize ?? preset.subtitleSize) * 1.45, 18, 96);
    const eyebrowSize = clamp((options.eyebrowSize ?? preset.eyebrowSize) * 1.45, 14, 70);
    const maxWidth = this.canvas.width * clamp(options.maxWidth ?? preset.maxWidth, 0.35, 0.96);
    const shadowStrength = clamp(options.shadowStrength ?? preset.shadowStrength, 0, 1.5);
    const glow = options.glow ?? preset.glow;

    const ctx = this.context;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const title = preset.titleTransform === "uppercase" ? options.title.toUpperCase() : options.title;
    const titleLines = wrapText(ctx, title, maxWidth, `${preset.titleWeight} ${titleSize}px Inter, Arial, sans-serif`, preset.letterSpacing);
    const subtitleLines = wrapText(ctx, options.subtitle ?? "", maxWidth * 0.86, `${preset.subtitleWeight} ${subtitleSize}px Inter, Arial, sans-serif`, 0);

    const eyebrow = options.eyebrow ?? "";
    const eyebrowBlock = eyebrow ? eyebrowSize * 1.7 : 0;
    const titleBlock = titleLines.length * titleSize * 1.04;
    const subtitleBlock = subtitleLines.length > 0 ? subtitleLines.length * subtitleSize * 1.22 + subtitleSize * 0.7 : 0;
    const totalHeight = eyebrowBlock + titleBlock + subtitleBlock;
    let y = height * 0.5 - totalHeight * 0.5;

    ctx.save();
    ctx.shadowColor = `rgba(0, 0, 0, ${0.74 * shadowStrength})`;
    ctx.shadowBlur = 34 * shadowStrength;
    ctx.shadowOffsetY = 14 * shadowStrength;

    if (eyebrow) {
      ctx.font = `850 ${eyebrowSize}px Inter, Arial, sans-serif`;
      ctx.fillStyle = accentColor;
      drawLetterSpacedText(ctx, eyebrow.toUpperCase(), width / 2, y + eyebrowSize * 0.5, 9);
      y += eyebrowBlock;
    }

    if (glow) {
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 34;
    }

    ctx.font = `${preset.titleWeight} ${titleSize}px Inter, Arial, sans-serif`;
    ctx.fillStyle = textColor;
    for (const line of titleLines) {
      drawLetterSpacedText(ctx, line, width / 2, y + titleSize * 0.5, preset.letterSpacing);
      y += titleSize * 1.04;
    }

    ctx.shadowColor = `rgba(0, 0, 0, ${0.7 * shadowStrength})`;
    ctx.shadowBlur = 24 * shadowStrength;
    ctx.font = `${preset.subtitleWeight} ${subtitleSize}px Inter, Arial, sans-serif`;
    ctx.fillStyle = withAlpha(textColor, 0.92);
    y += subtitleSize * 0.45;
    for (const line of subtitleLines) {
      ctx.fillText(line, width / 2, y + subtitleSize * 0.5);
      y += subtitleSize * 1.22;
    }

    ctx.restore();
    this.texture.needsUpdate = true;
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string,
  letterSpacing: number,
) {
  const normalized = text.replace(/\r/g, "").trim();
  if (!normalized) return [];

  ctx.font = font;
  const sourceLines = normalized.split("\n");
  const lines: string[] = [];

  for (const sourceLine of sourceLines) {
    const words = sourceLine.split(/\s+/).filter(Boolean);
    let line = "";

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      const width = measureLetterSpacedText(ctx, candidate, letterSpacing);
      if (width <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }

    if (line) lines.push(line);
  }

  return lines;
}

function drawLetterSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing: number,
) {
  if (letterSpacing === 0) {
    ctx.fillText(text, x, y);
    return;
  }

  const chars = Array.from(text);
  const totalWidth = measureLetterSpacedText(ctx, text, letterSpacing);
  let cursor = x - totalWidth / 2;

  for (const char of chars) {
    const charWidth = ctx.measureText(char).width;
    ctx.fillText(char, cursor + charWidth / 2, y);
    cursor += charWidth + letterSpacing;
  }
}

function measureLetterSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  letterSpacing: number,
) {
  const chars = Array.from(text);
  const spacing = Math.max(0, chars.length - 1) * letterSpacing;
  return ctx.measureText(text).width + spacing;
}

function withAlpha(color: string, alpha: number) {
  const safeAlpha = clamp(alpha, 0, 1);

  if (color.startsWith("#") && (color.length === 7 || color.length === 4)) {
    const hex = color.length === 4
      ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      : color;
    const r = Number.parseInt(hex.slice(1, 3), 16);
    const g = Number.parseInt(hex.slice(3, 5), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
  }

  return color;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
