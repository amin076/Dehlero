import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const assetsDir = path.join(publicDir, "assets");
const registryFile = path.join(assetsDir, "registry.json");

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MODEL_EXTENSIONS = new Set([".glb", ".gltf"]);

function toPublicPath(filePath) {
  return "/" + path.relative(publicDir, filePath).replace(/\\/g, "/");
}

function toRelativeAssetPath(assetFolder, filePath) {
  return path.relative(assetFolder, filePath).replace(/\\/g, "/");
}

function toTitleCase(value) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function guessType(assetFolder, files) {
  const hasModel = files.some((file) =>
    MODEL_EXTENSIONS.has(path.extname(file).toLowerCase()),
  );

  if (hasModel) return "glb-model";

  const normalized = assetFolder.replace(/\\/g, "/").toLowerCase();

  if (normalized.includes("/planets/") || normalized.includes("/moons/")) {
    return "procedural-planet";
  }

  return "unknown";
}

function guessCategory(assetFolder) {
  const relative = path.relative(assetsDir, assetFolder).replace(/\\/g, "/");
  const parts = relative.split("/");

  if (parts.length <= 1) return "general";

  return parts.slice(0, -1).join("/");
}

function findFirst(files, matcher) {
  return files.find((file) => matcher(file)) ?? null;
}

function createManifest(assetFolder, files) {
  const folderName = path.basename(assetFolder);
  const id = folderName.toLowerCase().replace(/\s+/g, "-");
  const name = toTitleCase(folderName);
  const type = guessType(assetFolder, files);
  const category = guessCategory(assetFolder);

  const modelFile = findFirst(files, (file) =>
    MODEL_EXTENSIONS.has(path.extname(file).toLowerCase()),
  );

  const albedo =
    findFirst(files, (file) => {
      const lower = file.toLowerCase();
      return (
        IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()) &&
        (lower.includes("albedo") ||
          lower.includes("basecolor") ||
          lower.includes("base_color") ||
          lower.includes("diffuse") ||
          lower.includes("color"))
      );
    }) ||
    findFirst(files, (file) =>
      IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()),
    );

  const normal = findFirst(files, (file) => {
    const lower = file.toLowerCase();
    return (
      IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()) &&
      lower.includes("normal")
    );
  });

  const roughness = findFirst(files, (file) => {
    const lower = file.toLowerCase();
    return (
      IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()) &&
      lower.includes("rough")
    );
  });

  const height = findFirst(files, (file) => {
    const lower = file.toLowerCase();
    return (
      IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()) &&
      (lower.includes("height") || lower.includes("displace"))
    );
  });

  const manifest = {
    id,
    name,
    type,
    category,
    description: `Auto-generated asset manifest for ${name}.`,
    model: modelFile ? toRelativeAssetPath(assetFolder, modelFile) : null,
    textures: {
      albedo: albedo ? toRelativeAssetPath(assetFolder, albedo) : null,
      normal: normal ? toRelativeAssetPath(assetFolder, normal) : null,
      roughness: roughness ? toRelativeAssetPath(assetFolder, roughness) : null,
      height: height ? toRelativeAssetPath(assetFolder, height) : null,
    },
    components: {
      sphere: type === "procedural-planet",
      rings: id === "saturn",
    },
    defaultTransform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: type === "procedural-planet" ? [1.8, 1.8, 1.8] : [1, 1, 1],
    },
    visual: {
      radius: 1,
      segments: 96,
    },
    metadata: {
      generated: true,
    },
  };

  return manifest;
}

function walk(dir, assetFolders = []) {
  if (!fs.existsSync(dir)) return assetFolders;
  const folderName = path.basename(dir).toLowerCase();

if (["textures", "previews", "preview", "thumbnail", "thumbnails"].includes(folderName)) {
  return assetFolders;
}

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(dir, entry.name));

  const hasAssetLikeFile = files.some((file) => {
    const ext = path.extname(file).toLowerCase();
    return IMAGE_EXTENSIONS.has(ext) || MODEL_EXTENSIONS.has(ext);
  });

  if (hasAssetLikeFile) {
    assetFolders.push(dir);
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      walk(path.join(dir, entry.name), assetFolders);
    }
  }

  return assetFolders;
}

function ensureManifest(assetFolder) {
  const manifestPath = path.join(assetFolder, "asset.json");

  const entries = fs.readdirSync(assetFolder, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .filter((entry) => entry.name !== "asset.json")
    .map((entry) => path.join(assetFolder, entry.name));

  if (!fs.existsSync(manifestPath)) {
    const manifest = createManifest(assetFolder, files);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    console.log(`✓ Created asset.json: ${manifestPath}`);
  }

const manifestText = fs
  .readFileSync(manifestPath, "utf8")
  .replace(/^\uFEFF/, "");

const manifest = JSON.parse(manifestText);
  return {
    manifestPath,
    manifest,
  };
}

const assetFolders = walk(assetsDir);
const registeredAssets = assetFolders
  .map(ensureManifest)
  .sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));

const registry = {
  version: 1,
  generatedAt: new Date().toISOString(),
  assets: registeredAssets.map(({ manifestPath, manifest }) => ({
    id: manifest.id,
    name: manifest.name,
    type: manifest.type,
    category: manifest.category,
    manifest: toPublicPath(manifestPath),
  })),
};

fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2), "utf8");

console.log(`✓ Asset registry generated`);
console.log(`✓ Assets found: ${registeredAssets.length}`);
console.log(`✓ Output: ${registryFile}`);
