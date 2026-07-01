import * as THREE from "three";

const textureLoader = new THREE.TextureLoader();

export function createTitanSurface() {
  const group = new THREE.Group();
  group.name = "Titan Surface";

  const texture = textureLoader.load(
    "/assets/astronomy/moons/titan/textures/titan_albedo.jpg",
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);

  const geometry = new THREE.PlaneGeometry(18, 18, 160, 160);
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position;

  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getZ(i);

    const distance = Math.sqrt(x * x + z * z);
    const curvature = -0.018 * distance * distance;
    const noise =
      Math.sin(x * 1.7) * 0.06 +
      Math.cos(z * 1.3) * 0.05 +
      Math.sin((x + z) * 0.9) * 0.035;

    positions.setY(i, curvature + noise);
  }

  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: "#d49a55",
    roughness: 0.95,
    metalness: 0,
  });

  const surface = new THREE.Mesh(geometry, material);
  surface.name = "Titan Curved Surface";
  surface.receiveShadow = true;

  group.add(surface);

  return group;
}