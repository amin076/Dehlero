import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { LibraryCategory, LibraryItem, LibraryParamSpec } from "./studioTypes";
import { createSaturnRings } from "../assets/astronomy/createSaturnRings";
import { createTitanSurface } from "../assets/astronomy/createTitanSurface";
import { createRegistryLibraryItems } from "./library/createRegistryLibraryItems";


const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/gltf/");
dracoLoader.setDecoderConfig({ type: "wasm" });

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

type AstronautTeamColors = {
  body: string;
  trim: string;
  helmet: string;
  visor: string;
  gloves: string;
  boots: string;
};

const DEFAULT_ASTRONAUT_COLORS: AstronautTeamColors = {
  body: "#f8fafc",
  trim: "#2563eb",
  helmet: "#e5e7eb",
  visor: "#050816",
  gloves: "#f8fafc",
  boots: "#111827",
};

function getAstronautMaterialRole(materialName: string, index: number) {
  const name = materialName.toLowerCase();

  if (name.includes("shoe")) return "boots";
  if (name.includes("aceshelme.008")) return "visor";
  if (name.includes("aceshelme")) return "helmet";
  if (name.includes("lambert8") || name.includes("lambert5") || name.includes("lambert3")) return "trim";
  if (index === 1 || index === 2 || index === 3) return "boots";

  return "body";
}

function materialList(material: THREE.Material | THREE.Material[]) {
  return Array.isArray(material) ? material : [material];
}

function forceOpaqueMaterial(material: THREE.Material) {
  const candidate = material as THREE.MeshStandardMaterial;

  material.transparent = false;
  material.opacity = 1;
  material.depthWrite = true;
  material.depthTest = true;
  material.alphaTest = 0;

  if (candidate.alphaMap) {
    candidate.alphaMap = null;
  }

  material.needsUpdate = true;
}

function tintMaterial(material: THREE.Material, color: string) {
  const candidate = material as THREE.MeshStandardMaterial;

  forceOpaqueMaterial(material);

  if (!candidate.color) return;

  candidate.color.set(color);
  candidate.needsUpdate = true;
}

export function applyAstronautTeamColors(
  object: THREE.Object3D,
  colors: Partial<AstronautTeamColors>,
) {
  const finalColors = { ...DEFAULT_ASTRONAUT_COLORS, ...colors };

  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;

    materialList(mesh.material).forEach((material, index) => {
      const role =
        (material.userData?.dehleroAstronautRole as keyof AstronautTeamColors | undefined) ??
        (getAstronautMaterialRole(material.name ?? "", index) as keyof AstronautTeamColors);

      material.userData = {
        ...(material.userData ?? {}),
        dehleroAstronautRole: role,
      };

      tintMaterial(material, finalColors[role]);
    });
  });

  object.userData.dehlero = {
    ...(object.userData.dehlero ?? {}),
    astronautColors: finalColors,
  };
}

function cloneLoadedMaterial(material: THREE.Material | THREE.Material[]) {
  return Array.isArray(material)
    ? material.map((item) => item.clone())
    : material.clone();
}

function createAstronautPlaceholder() {
  const body = standardMesh("Astronaut Placeholder Body", new THREE.CapsuleGeometry(0.28, 0.75, 8, 20), "#f8fafc");
  body.position.y = 0.85;

  const helmet = standardMesh("Astronaut Placeholder Helmet", new THREE.SphereGeometry(0.28, 32, 16), "#e5e7eb");
  helmet.position.y = 1.45;

  const visor = standardMesh("Astronaut Placeholder Visor", new THREE.BoxGeometry(0.3, 0.13, 0.025), "#050816");
  visor.position.set(0, 1.48, 0.255);

  const leftArm = standardMesh("Astronaut Placeholder Left Arm", new THREE.CapsuleGeometry(0.08, 0.55, 8, 12), "#f8fafc");
  leftArm.position.set(-0.36, 0.9, 0);
  leftArm.rotation.z = -0.16;

  const rightArm = leftArm.clone();
  rightArm.name = "Astronaut Placeholder Right Arm";
  rightArm.position.x = 0.36;
  rightArm.rotation.z = 0.16;

  const leftBoot = standardMesh("Astronaut Placeholder Left Boot", new THREE.BoxGeometry(0.18, 0.12, 0.3), "#111827");
  leftBoot.position.set(-0.12, 0.16, 0.04);

  const rightBoot = leftBoot.clone();
  rightBoot.name = "Astronaut Placeholder Right Boot";
  rightBoot.position.x = 0.12;

  return group("Astronaut Loading Placeholder", [body, helmet, visor, leftArm, rightArm, leftBoot, rightBoot]);
}

function createAstronautModel() {
  const root = new THREE.Group();
  root.name = "Astronaut";

  const placeholder = createAstronautPlaceholder();
  root.add(placeholder);

  root.userData.dehlero = {
    ...(root.userData.dehlero ?? {}),
    libraryId: "astronaut",
    label: "Astronaut",
    isAstronaut: true,
    astronautColors: DEFAULT_ASTRONAUT_COLORS,
    recommendedScale: 1,
    nativeHeight: 1.75,
  };

  gltfLoader
    .loadAsync("/assets/characters/astronaut/astronaut.glb")
    .then((gltf) => {
      const model = gltf.scene;
      model.name = "Astronaut Model";

      model.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;

        mesh.material = cloneLoadedMaterial(mesh.material);
        materialList(mesh.material).forEach(forceOpaqueMaterial);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.renderOrder = 0;
      });

      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      if (size.y > 0) {
        model.position.sub(center);
        model.scale.multiplyScalar(1.75 / size.y);
        model.position.y += 0.875;
      }

      placeholder.removeFromParent();
      root.add(model);
      applyAstronautTeamColors(root, DEFAULT_ASTRONAUT_COLORS);
    })
    .catch((error) => {
      console.warn("Failed to load default astronaut model", error);
      applyAstronautTeamColors(root, DEFAULT_ASTRONAUT_COLORS);
    });

  return root;
}

type ItemOptions = {
  id: string;
  label: string;
  category: LibraryCategory;
  description?: string;
  parameters?: LibraryParamSpec[];
  create: () => THREE.Object3D;
};

export function createDefaultMaterial(color: THREE.ColorRepresentation) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.58,
    metalness: 0.04,
  });
}

function standardMesh(
  name: string,
  geometry: THREE.BufferGeometry,
  color: THREE.ColorRepresentation,
) {
  const mesh = new THREE.Mesh(geometry, createDefaultMaterial(color));
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function group(name: string, children: THREE.Object3D[]) {
  const g = new THREE.Group();
  g.name = name;
  children.forEach((child) => g.add(child));
  g.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return g;
}

function annotate(object: THREE.Object3D, item: Pick<LibraryItem, "id" | "label" | "parameters">) {
  object.name = item.label;
  object.userData.dehlero = {
    ...(object.userData.dehlero ?? {}),
    libraryId: item.id,
    label: item.label,
    parameters: item.parameters ?? [],
  };
  return object;
}

function item(options: ItemOptions): LibraryItem {
  return {
    ...options,
    create: () => annotate(options.create(), options),
  };
}

function numberParam(key: string, label: string, value: number, min: number, max: number, step = 0.1): LibraryParamSpec {
  return { key, label, value, min, max, step, type: "number" };
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

function createTube() {
  return standardMesh(
    "Tube",
    new THREE.TorusGeometry(0.9, 0.18, 24, 96),
    "#62d6ff",
  );
}

function createCapsule() {
  return standardMesh(
    "Capsule",
    new THREE.CapsuleGeometry(0.48, 1.35, 12, 32),
    "#c084fc",
  );
}

function createPyramid() {
  return standardMesh(
    "Pyramid",
    new THREE.ConeGeometry(0.85, 1.5, 4),
    "#fb7185",
  );
}

function createWedge() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.8, -0.6);
  shape.lineTo(0.8, -0.6);
  shape.lineTo(-0.8, 0.6);
  shape.lineTo(-0.8, -0.6);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 1.2,
    bevelEnabled: false,
  });
  geometry.center();

  return standardMesh("Wedge", geometry, "#f97316");
}

function createArrow() {
  const shaft = standardMesh(
    "Arrow Shaft",
    new THREE.CylinderGeometry(0.06, 0.06, 1.35, 24),
    "#38bdf8",
  );
  shaft.rotation.z = Math.PI / 2;

  const head = standardMesh(
    "Arrow Head",
    new THREE.ConeGeometry(0.2, 0.42, 32),
    "#38bdf8",
  );
  head.rotation.z = -Math.PI / 2;
  head.position.x = 0.86;

  return group("Arrow", [shaft, head]);
}

function createSimpleCar() {
  const body = standardMesh("Car Body", new THREE.BoxGeometry(1.8, 0.45, 0.85), "#2563eb");
  body.position.y = 0.38;

  const cabin = standardMesh("Car Cabin", new THREE.BoxGeometry(0.8, 0.42, 0.68), "#60a5fa");
  cabin.position.set(-0.15, 0.78, 0);

  const wheels = [-0.62, 0.62].flatMap((x) =>
    [-0.48, 0.48].map((z) => {
      const wheel = standardMesh("Wheel", new THREE.CylinderGeometry(0.18, 0.18, 0.16, 32), "#111827");
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.16, z);
      return wheel;
    }),
  );

  return group("Car", [body, cabin, ...wheels]);
}

function createBuilding() {
  // Dehlero world units are cinematic/editor units, not real meters.
  // Keep architecture objects small by default so they match the shuttle pad,
  // sports props, lab objects, and default camera framing.
  const width = 0.46;
  const depth = 0.46;
  const height = 1.05;

  const tower = standardMesh("Building Tower", new THREE.BoxGeometry(width, height, depth), "#64748b");
  tower.position.y = height / 2;

  const roof = standardMesh("Building Roof", new THREE.BoxGeometry(width * 1.08, 0.045, depth * 1.08), "#475569");
  roof.position.y = height + 0.025;

  const windows: THREE.Object3D[] = [];
  for (let y = 0.22; y < height - 0.08; y += 0.2) {
    for (let x = -0.13; x <= 0.13; x += 0.13) {
      const window = standardMesh("Window", new THREE.BoxGeometry(0.07, 0.055, 0.012), "#bae6fd");
      window.position.set(x, y, depth / 2 + 0.007);
      windows.push(window);
    }
  }

  const building = group("Building", [tower, roof, ...windows]);
  building.userData.dehlero = {
    ...(building.userData.dehlero ?? {}),
    nativeHeight: height,
    recommendedScale: 1,
    sizeClass: "environment-small",
  };
  return building;
}

function createHouse() {
  const base = standardMesh("House Body", new THREE.BoxGeometry(0.58, 0.42, 0.5), "#fcd34d");
  base.position.y = 0.21;
  const roof = standardMesh("House Roof", new THREE.ConeGeometry(0.43, 0.28, 4), "#dc2626");
  roof.position.y = 0.56;
  roof.rotation.y = Math.PI / 4;
  const house = group("House", [base, roof]);
  house.userData.dehlero = {
    ...(house.userData.dehlero ?? {}),
    nativeHeight: 0.7,
    recommendedScale: 1,
    sizeClass: "environment-small",
  };
  return house;
}

function createFootball() {
  const ball = standardMesh("Football", new THREE.SphereGeometry(0.45, 48, 24), "#f8fafc");
  const ring1 = standardMesh("Football Seam A", new THREE.TorusGeometry(0.46, 0.012, 8, 64), "#111827");
  const ring2 = ring1.clone();
  ring2.rotation.x = Math.PI / 2;
  const ring3 = ring1.clone();
  ring3.rotation.y = Math.PI / 2;
  return group("Football", [ball, ring1, ring2, ring3]);
}

function createLabBeaker() {
  const glass = standardMesh("Beaker Glass", new THREE.CylinderGeometry(0.42, 0.34, 1.0, 48, 1, true), "#67e8f9");
  const liquid = standardMesh("Liquid", new THREE.CylinderGeometry(0.36, 0.3, 0.36, 48), "#38bdf8");
  liquid.position.y = -0.22;
  return group("Beaker", [glass, liquid]);
}

function createOrbitPath() {
  const curve = new THREE.EllipseCurve(0, 0, 1.4, 0.85, 0, Math.PI * 2);
  const points = curve.getPoints(160).map((point) => new THREE.Vector3(point.x, 0, point.y));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: "#93c5fd" });
  const line = new THREE.LineLoop(geometry, material);
  line.name = "Orbit Path";
  return line;
}

export function createLibrary(): LibraryItem[] {
  const library: LibraryItem[] = [
    item({
      id: "cube",
      label: "Cube",
      category: "3D",
      parameters: [
        numberParam("width", "Width", 1.4, 0.05, 20),
        numberParam("height", "Height", 1.4, 0.05, 20),
        numberParam("depth", "Depth", 1.4, 0.05, 20),
      ],
      create: () => standardMesh("Cube", new THREE.BoxGeometry(1.4, 1.4, 1.4), "#6ea8fe"),
    }),
    item({
      id: "sphere",
      label: "Sphere",
      category: "3D",
      parameters: [
        numberParam("radius", "Radius", 0.85, 0.05, 20),
        numberParam("segments", "Segments", 48, 8, 128, 1),
      ],
      create: () => standardMesh("Sphere", new THREE.SphereGeometry(0.85, 48, 24), "#91d36e"),
    }),
    item({
      id: "cylinder",
      label: "Cylinder",
      category: "3D",
      parameters: [
        numberParam("radiusTop", "Top Radius", 0.65, 0, 20),
        numberParam("radiusBottom", "Bottom Radius", 0.65, 0, 20),
        numberParam("height", "Height", 1.7, 0.05, 40),
        numberParam("segments", "Segments", 48, 3, 128, 1),
      ],
      create: () => standardMesh("Cylinder", new THREE.CylinderGeometry(0.65, 0.65, 1.7, 48), "#f4b860"),
    }),
    item({
      id: "cone",
      label: "Cone",
      category: "3D",
      parameters: [
        numberParam("radius", "Bottom Radius", 0.75, 0.02, 20),
        numberParam("height", "Height", 1.7, 0.05, 40),
        numberParam("segments", "Segments", 48, 3, 128, 1),
      ],
      create: () => standardMesh("Cone", new THREE.ConeGeometry(0.75, 1.7, 48), "#fb923c"),
    }),
    item({
      id: "tube",
      label: "Tube / Torus",
      category: "3D",
      parameters: [
        numberParam("majorRadius", "Outer Radius", 0.9, 0.05, 20),
        numberParam("tubeRadius", "Tube Radius", 0.18, 0.01, 5),
        numberParam("segments", "Segments", 96, 8, 256, 1),
      ],
      create: createTube,
    }),
    item({
      id: "capsule",
      label: "Capsule",
      category: "3D",
      parameters: [
        numberParam("radius", "Radius", 0.48, 0.02, 20),
        numberParam("length", "Length", 1.35, 0.02, 40),
      ],
      create: createCapsule,
    }),
    item({
      id: "pyramid",
      label: "Pyramid",
      category: "3D",
      parameters: [
        numberParam("radius", "Base Radius", 0.85, 0.02, 20),
        numberParam("height", "Height", 1.5, 0.02, 40),
      ],
      create: createPyramid,
    }),
    item({
      id: "wedge",
      label: "Wedge",
      category: "3D",
      parameters: [
        numberParam("width", "Width", 1.6, 0.05, 20),
        numberParam("height", "Height", 1.2, 0.05, 20),
        numberParam("depth", "Depth", 1.2, 0.05, 20),
      ],
      create: createWedge,
    }),
    item({
      id: "plane",
      label: "Plane",
      category: "2D",
      parameters: [
        numberParam("width", "Width", 2.4, 0.05, 100),
        numberParam("height", "Height", 1.5, 0.05, 100),
      ],
      create: () => {
        const plane = standardMesh("Plane", new THREE.PlaneGeometry(2.4, 1.5), "#f7f3e8");
        const material = plane.material as THREE.MeshStandardMaterial;
        material.side = THREE.DoubleSide;
        plane.rotation.x = -Math.PI / 2;
        return plane;
      },
    }),
    item({
      id: "circle",
      label: "Circle",
      category: "2D",
      parameters: [numberParam("radius", "Radius", 0.9, 0.02, 50)],
      create: () => {
        const circle = standardMesh("Circle", new THREE.CircleGeometry(0.9, 64), "#ff7aa2");
        const material = circle.material as THREE.MeshStandardMaterial;
        material.side = THREE.DoubleSide;
        circle.rotation.x = -Math.PI / 2;
        return circle;
      },
    }),
    item({
      id: "label",
      label: "Text Card",
      category: "2D",
      parameters: [
        { key: "text", label: "Text", value: "Title", type: "text" },
        numberParam("width", "Width", 3.2, 0.1, 20),
        numberParam("height", "Height", 1.2, 0.1, 20),
      ],
      create: () => createLabelSprite("Title"),
    }),
    item({
      id: "arrow",
      label: "Arrow",
      category: "Science",
      create: createArrow,
    }),
    item({
      id: "orbit-path",
      label: "Orbit Path",
      category: "Science",
      parameters: [
        numberParam("radiusX", "Radius X", 1.4, 0.05, 100),
        numberParam("radiusZ", "Radius Z", 0.85, 0.05, 100),
      ],
      create: createOrbitPath,
    }),
    item({
      id: "beaker",
      label: "Beaker",
      category: "Science",
      create: createLabBeaker,
    }),
    item({
      id: "planet",
      label: "Planet",
      category: "Astronomy",
      parameters: [numberParam("radius", "Radius", 1.1, 0.05, 100)],
      create: () => createPlanet(),
    }),
    item({
      id: "saturn-rings",
      label: "Saturn Rings",
      category: "Astronomy",
      parameters: [
        numberParam("innerRadius", "Inner Radius", 1.35, 0.01, 50),
        numberParam("outerRadius", "Outer Radius", 2.35, 0.01, 80),
        numberParam("tilt", "Tilt", 26.7, -90, 90, 0.1),
      ],
      create: () => {
        const rings = createSaturnRings(1.1);
        rings.rotation.x = Math.PI * 0.62;
        rings.rotation.z = Math.PI * 0.08;
        return rings;
      },
    }),
    item({
      id: "ground-surface",
      label: "Ground Surface",
      category: "Environment",
      create: () => createTitanSurface(),
    }),
    item({
      id: "building",
      label: "Building",
      category: "Architecture",
      parameters: [
        numberParam("width", "Width", 0.46, 0.05, 10, 0.01),
        numberParam("depth", "Depth", 0.46, 0.05, 10, 0.01),
        numberParam("height", "Height", 1.05, 0.05, 30, 0.01),
      ],
      create: createBuilding,
    }),
    item({
      id: "house",
      label: "House",
      category: "Architecture",
      parameters: [
        numberParam("width", "Width", 0.58, 0.05, 10, 0.01),
        numberParam("height", "Height", 0.7, 0.05, 10, 0.01),
        numberParam("depth", "Depth", 0.5, 0.05, 10, 0.01),
      ],
      create: createHouse,
    }),
    item({
      id: "car",
      label: "Car",
      category: "Vehicles",
      create: createSimpleCar,
    }),
    item({
      id: "astronaut",
      label: "Astronaut",
      category: "3D",
      description: "Default GLB astronaut with editable team colors.",
      parameters: [
        { key: "bodyColor", label: "Body Color", value: DEFAULT_ASTRONAUT_COLORS.body, type: "color" },
        { key: "trimColor", label: "Team Trim", value: DEFAULT_ASTRONAUT_COLORS.trim, type: "color" },
        { key: "helmetColor", label: "Helmet", value: DEFAULT_ASTRONAUT_COLORS.helmet, type: "color" },
        { key: "visorColor", label: "Visor", value: DEFAULT_ASTRONAUT_COLORS.visor, type: "color" },
        { key: "glovesColor", label: "Gloves", value: DEFAULT_ASTRONAUT_COLORS.gloves, type: "color" },
        { key: "bootsColor", label: "Boots", value: DEFAULT_ASTRONAUT_COLORS.boots, type: "color" },
      ],
      create: createAstronautModel,
    }),
    item({
      id: "football",
      label: "Football",
      category: "Sports",
      create: createFootball,
    }),
    item({
      id: "directional-light",
      label: "Directional",
      category: "Lights",
      create: () => {
        const light = new THREE.DirectionalLight("#ffffff", 3);
        light.position.set(3, 5, 2);
        return light;
      },
    }),
    item({
      id: "point-light",
      label: "Point",
      category: "Lights",
      create: () => {
        const light = new THREE.PointLight("#ffd08a", 18, 12);
        light.position.set(0, 3, 2);
        return light;
      },
    }),
    item({
      id: "spot-light",
      label: "Spot Light",
      category: "Lights",
      create: () => {
        const light = new THREE.SpotLight("#ffffff", 14, 28, Math.PI / 6, 0.4, 1);
        light.position.set(0, 6, 4);
        light.target.position.set(0, 0, 0);
        return light;
      },
    }),
    item({
      id: "production-camera",
      label: "Camera",
      category: "Camera",
      create: () => {
        const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 1000);
        camera.position.set(0, 2.2, 7);
        camera.lookAt(0, 0.75, 0);
        return camera;
      },
    }),
  ];

  return library;
}

export async function createLibraryWithRegistry(): Promise<LibraryItem[]> {
  const baseLibrary = createLibrary();

  try {
    const registryItems = await createRegistryLibraryItems();
    const existingIds = new Set(baseLibrary.map((libraryItem) => libraryItem.id));
    const newItems = registryItems.filter((libraryItem) => !existingIds.has(libraryItem.id));

    return [...baseLibrary, ...newItems];
  } catch (error) {
    console.warn("Failed to load asset registry", error);
    return baseLibrary;
  }
}
