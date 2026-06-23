import * as THREE from "three";

function createSaturnRingGeometry(inner: number, outer: number) {
  const radialSegments = 80;
  const angularSegments = 360;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r <= radialSegments; r++) {
    const t = r / radialSegments;
    const radius = inner + (outer - inner) * t;

    for (let a = 0; a <= angularSegments; a++) {
      const angle = (a / angularSegments) * Math.PI * 2;
      positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      uvs.push(t, 0.5);
    }
  }

  for (let r = 0; r < radialSegments; r++) {
    for (let a = 0; a < angularSegments; a++) {
      const row1 = r * (angularSegments + 1);
      const row2 = (r + 1) * (angularSegments + 1);

      const a1 = row1 + a;
      const a2 = row1 + a + 1;
      const b1 = row2 + a;
      const b2 = row2 + a + 1;

      indices.push(a1, b1, a2);
      indices.push(a2, b1, b2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

export function createSaturnRings(radius: number) {
  const texture = new THREE.TextureLoader().load(
    "/assets/astronomy/planets/saturn/saturn-ring.png",
  );

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const group = new THREE.Group();
  group.name = "Saturn Rings";

  const inner = radius * 1.22;
  const outer = radius * 2.45;
  const span = outer - inner;

  const bands = [
    { id: "c-ring", inner, outer: inner + span * 0.23, opacity: 0.55 },
    { id: "b-ring", inner: inner + span * 0.28, outer: inner + span * 0.58, opacity: 1.0 },
    { id: "cassini-division", inner: inner + span * 0.6, outer: inner + span * 0.67, opacity: 0.08 },
    { id: "a-ring", inner: inner + span * 0.69, outer, opacity: 0.82 },
  ];

  for (const band of bands) {
    const mesh = new THREE.Mesh(
      createSaturnRingGeometry(band.inner, band.outer),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: band.opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        alphaTest: 0.01,
      }),
    );

    mesh.name = band.id;
    group.add(mesh);
  }

  return group;
}
