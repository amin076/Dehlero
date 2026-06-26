import * as THREE from "three";
import type { LibraryItem } from "./studioTypes";
import { createSaturnRings } from "../assets/astronomy/createSaturnRings";
import { createTitanSurface } from "../assets/astronomy/createTitanSurface";
import { createRegistryLibraryItems } from "./library/createRegistryLibraryItems";

export function createDefaultMaterial(color: THREE.ColorRepresentation) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.58,
    metalness: 0.04,
  });
}

export function createPlanet(texture?: THREE.Texture) {
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: texture ? "#ffffff" : "#8eb7ff",
    roughness: 1,
    metalness: 0,
  });

  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 96, 48),
    material,
  );

  planet.name = "Planet";
  planet.castShadow = true;
  planet.receiveShadow = true;

  return planet;
}

export function createLabelSprite(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 192;

  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(18, 24, 38, 0.88)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(255, 255, 255, 0.72)";
  context.lineWidth = 8;
  context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  context.fillStyle = "#ffffff";
  context.font = "700 58px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }),
  );

  sprite.scale.set(3.2, 1.2, 1);
  sprite.position.set(0, 1.8, 0);

  return sprite;
}

export function createLibrary(): LibraryItem[] {
  return [
    {
      id: "cube",
      label: "Cube",
      category: "3D",
      create: () =>
        new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 1.4, 1.4),
          createDefaultMaterial("#6ea8fe"),
        ),
    },
    {
      id: "sphere",
      label: "Sphere",
      category: "3D",
      create: () =>
        new THREE.Mesh(
          new THREE.SphereGeometry(0.85, 48, 24),
          createDefaultMaterial("#91d36e"),
        ),
    },
    {
      id: "cylinder",
      label: "Cylinder",
      category: "3D",
      create: () =>
        new THREE.Mesh(
          new THREE.CylinderGeometry(0.65, 0.65, 1.7, 48),
          createDefaultMaterial("#f4b860"),
        ),
    },
    {
      id: "plane",
      label: "Plane",
      category: "2D",
      create: () => {
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(2.4, 1.5),
          new THREE.MeshStandardMaterial({
            color: "#f7f3e8",
            roughness: 0.75,
            side: THREE.DoubleSide,
          }),
        );

        plane.rotation.x = -Math.PI / 2;
        return plane;
      },
    },

    {
      id: "ground-surface",
      label: "Ground Surface",
      category: "Environment",
      create: () => createTitanSurface(),
    },
    {
      id: "circle",
      label: "Circle",
      category: "2D",
      create: () => {
        const circle = new THREE.Mesh(
          new THREE.CircleGeometry(0.9, 64),
          new THREE.MeshStandardMaterial({
            color: "#ff7aa2",
            roughness: 0.72,
            side: THREE.DoubleSide,
          }),
        );

        circle.rotation.x = -Math.PI / 2;
        return circle;
      },
    },
    {
      id: "label",
      label: "Text Card",
      category: "2D",
      create: () => createLabelSprite("Title"),
    },
    {
      id: "planet",
      label: "Planet",
      category: "Planets",
      create: () => createPlanet(),
    },

    {
      id: "saturn-rings",
      label: "Saturn Rings",
      category: "Planets",
      create: () => {
        const rings = createSaturnRings(1.1);
        rings.rotation.x = Math.PI * 0.62;
        rings.rotation.z = Math.PI * 0.08;
        return rings;
      },
    },
    {
      id: "directional-light",
      label: "Directional",
      category: "Lights",
      create: () => {
        const light = new THREE.DirectionalLight("#ffffff", 3);
        light.position.set(3, 5, 2);
        return light;
      },
    },
    {
      id: "point-light",
      label: "Point",
      category: "Lights",
      create: () => {
        const light = new THREE.PointLight("#ffd08a", 18, 12);
        light.position.set(0, 3, 2);
        return light;
      },
    },
    {
      id: "production-camera",
      label: "Camera",
      category: "Camera",
      create: () => {
        const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 1000);
        camera.position.set(0, 2.2, 7);
        camera.lookAt(0, 0.75, 0);
        return camera;
      },
    },
  ];
}

export async function createLibraryWithRegistry(): Promise<LibraryItem[]> {
  const baseLibrary = createLibrary();

  try {
    const registryItems = await createRegistryLibraryItems();
    const existingIds = new Set(baseLibrary.map((item) => item.id));
    const newItems = registryItems.filter((item) => !existingIds.has(item.id));

    return [...baseLibrary, ...newItems];
  } catch (error) {
    console.warn("Failed to load asset registry", error);
    return baseLibrary;
  }
}
