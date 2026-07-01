export type AssetManifest = {
  id: string;
  name: string;
  type: string;
  category: string;
  description?: string;
  model?: string | null;
  textures?: {
    albedo?: string | null;
    normal?: string | null;
    roughness?: string | null;
    height?: string | null;
  };
  components?: {
    sphere?: boolean;
    rings?: boolean;
  };
  defaultTransform?: {
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
  };
  visual?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};
