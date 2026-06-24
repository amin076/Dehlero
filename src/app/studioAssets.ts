import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/gltf/");
dracoLoader.setDecoderConfig({ type: "wasm" });

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

const objLoader = new OBJLoader();

export async function loadModelFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const url = URL.createObjectURL(file);

  try {
    if (extension === "glb" || extension === "gltf") {
      const gltf = await gltfLoader.loadAsync(url);
      return gltf.scene;
    }

    if (extension === "obj") {
      return await objLoader.loadAsync(url);
    }

    throw new Error(`Unsupported model format: ${extension ?? "unknown"}`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function loadTextureFile(file: File) {
  const url = URL.createObjectURL(file);

  const texture = new THREE.TextureLoader().load(url, () => {
    URL.revokeObjectURL(url);
  });

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  return texture;
}

export function loadTextureFromBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);

  const texture = new THREE.TextureLoader().load(url, () => {
    URL.revokeObjectURL(url);
  });

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  return texture;
}

export function applyTextureToObject(
  object: THREE.Object3D,
  texture: THREE.Texture,
) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    child.material = materials.map((material) => {
      const nextMaterial =
        material instanceof THREE.MeshStandardMaterial
          ? material.clone()
          : new THREE.MeshStandardMaterial();

      nextMaterial.map = texture;
      nextMaterial.color.set("#ffffff");
      nextMaterial.needsUpdate = true;

      return nextMaterial;
    });
  });
}
