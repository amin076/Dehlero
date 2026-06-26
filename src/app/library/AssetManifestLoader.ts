import type { AssetManifest } from "./AssetManifestTypes";

export async function loadAssetManifest(
  manifestPath: string,
): Promise<AssetManifest> {
  const response = await fetch(manifestPath);

  if (!response.ok) {
    throw new Error(`Failed to load asset manifest: ${manifestPath}`);
  }

  return response.json() as Promise<AssetManifest>;
}

export function resolveAssetPath(manifestPath: string, relativePath?: string | null) {
  if (!relativePath) return null;

  const basePath = manifestPath.slice(0, manifestPath.lastIndexOf("/") + 1);
  return `${basePath}${relativePath}`;
}
