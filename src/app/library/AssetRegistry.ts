import type { AssetManifest } from "./AssetManifestTypes";
import { loadAssetManifest } from "./AssetManifestLoader";

export type AssetRegistryEntry = {
  id: string;
  name: string;
  type: string;
  category: string;
  manifest: string;
};

export type AssetRegistryFile = {
  version: number;
  generatedAt: string;
  assets: AssetRegistryEntry[];
};

export type RegisteredAsset = {
  manifestPath: string;
  manifest: AssetManifest;
  entry: AssetRegistryEntry;
};

export async function loadAssetRegistryFile(
  registryPath = "/assets/registry.json",
): Promise<AssetRegistryFile> {
  const response = await fetch(registryPath);

  if (!response.ok) {
    throw new Error(`Failed to load asset registry: ${registryPath}`);
  }

  return response.json() as Promise<AssetRegistryFile>;
}

export async function loadDefaultAssetRegistry(): Promise<RegisteredAsset[]> {
  const registry = await loadAssetRegistryFile();

  return Promise.all(
    registry.assets.map(async (entry) => ({
      manifestPath: entry.manifest,
      manifest: await loadAssetManifest(entry.manifest),
      entry,
    })),
  );
}
