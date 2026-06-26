import * as THREE from "three";
import type { LibraryItem } from "../../studioTypes";
import { createSaturnRings } from "../../../assets/astronomy/createSaturnRings";

const textureLoader = new THREE.TextureLoader();

export function createSaturnPlanet() {
  const group = new THREE.Group();
  group.name = "Saturn";

  const saturnTexture = textureLoader.load(
    "/assets/astronomy/planets/saturn/textures/saturn_albedo.jpg",
  );

  saturnTexture.colorSpace = THREE.SRGBColorSpace;
  saturnTexture.wrapS = THREE.RepeatWrapping;
  saturnTexture.wrapT = THREE.ClampToEdgeWrapping;

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 128, 64),
    new THREE.MeshStandardMaterial({
      map: saturnTexture,
      color: "#ffffff",
      roughness: 0.92,
      metalness: 0,
    }),
  );

  body.name = "Saturn Body";
  body.castShadow = true;
  body.receiveShadow = true;

  const rings = createSaturnRings(1.15);
  rings.name = "Saturn Rings";
  rings.rotation.x = Math.PI * 0.5;
  rings.rotation.z = 0;

  group.add(body);
  group.add(rings);
  group.scale.setScalar(1.8);

  return group;
}

export function createSaturnLibraryItem(): LibraryItem {
  return {
    id: "saturn",
    label: "Saturn",
    category: "Planets",
    create: () => createSaturnPlanet(),
  };
}
