import type { LibraryCategory, LibraryItem } from "../studioTypes";
import { AssetFactory } from "./AssetFactory";
import { loadDefaultAssetRegistry } from "./AssetRegistry";

function mapAssetCategory(category: string): LibraryCategory {
  if (category.includes("environment") || category.includes("terrain")) {
    return "Environment";
  }

  if (category.includes("planets") || category.includes("moons")) {
    return "Planets";
  }

  if (category.includes("lights")) {
    return "Lights";
  }

  if (category.includes("camera")) {
    return "Camera";
  }

  return "3D";
}

export async function createRegistryLibraryItems(): Promise<LibraryItem[]> {
  const assets = await loadDefaultAssetRegistry();

  return assets.map((asset) => ({
    id: asset.entry.id,
    label: asset.entry.name,
    category: mapAssetCategory(asset.entry.category),
    create: () => AssetFactory.build(asset),
  }));
}
