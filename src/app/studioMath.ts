import * as THREE from "three";
import { types } from "@theatre/core";

export function easeInOutCubic(t: number) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function getObjectCenter(object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();

  if (!box.isEmpty()) {
    box.getCenter(center);
    return center;
  }

  return object.getWorldPosition(center);
}

export function getObjectRadius(object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();

  box.getSize(size);

  return Math.max(size.length() * 0.5, 1);
}

export function getFirstStandardMaterial(
  object: THREE.Object3D,
): THREE.MeshStandardMaterial | null {
  let material: THREE.MeshStandardMaterial | null = null;

  object.traverse((child) => {
    if (material || !(child instanceof THREE.Mesh)) return;

    const candidate = Array.isArray(child.material)
      ? child.material[0]
      : child.material;

    if (candidate instanceof THREE.MeshStandardMaterial) {
      material = candidate;
    }
  });

  return material;
}

export function colorToRgba(color: THREE.Color, alpha = 1) {
  return {
    r: color.r,
    g: color.g,
    b: color.b,
    a: alpha,
  };
}

export function applyRgbaToColor(
  color: THREE.Color,
  rgba: { r: number; g: number; b: number; a?: number },
) {
  color.setRGB(
    THREE.MathUtils.clamp(rgba.r, 0, 1),
    THREE.MathUtils.clamp(rgba.g, 0, 1),
    THREE.MathUtils.clamp(rgba.b, 0, 1),
  );
}

export function numberProp(value: number, range: [number, number]) {
  return types.number(value, { range });
}

export function vectorProps(
  vector: THREE.Vector3 | THREE.Euler,
  range: [number, number],
) {
  return types.compound({
    x: numberProp(vector.x, range),
    y: numberProp(vector.y, range),
    z: numberProp(vector.z, range),
  });
}