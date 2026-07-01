import * as THREE from "three";
import type { DehleroCommand, DehleroCommandEnvelope } from "./commandTypes";

type CameraControlsLike = {
  enabled: boolean;
  setLookAt: (
    positionX: number,
    positionY: number,
    positionZ: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    enableTransition?: boolean,
  ) => Promise<void> | void;
};

export type AiCommandContext = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  controls?: CameraControlsLike;
};

function markAgentObject(obj: THREE.Object3D, id: string, name?: string) {
  obj.name = name ?? id;
  obj.userData.dehleroId = id;
  obj.userData.createdByAi = true;
}

function createMaterial(color?: string) {
  return new THREE.MeshStandardMaterial({
    color: color ?? "#ffffff",
    roughness: 0.55,
    metalness: 0.05,
  });
}

function findObject(scene: THREE.Scene, id: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;

  scene.traverse((item) => {
    if (item.userData.dehleroId === id) found = item;
  });

  return found;
}

function clearAiObjects(ctx: AiCommandContext) {
  const items: THREE.Object3D[] = [];

  ctx.scene.traverse((item) => {
    if (item.userData.createdByAi === true) items.push(item);
  });

  items.forEach((item) => {
    item.parent?.remove(item);
  });
}

function addPrimitive(
  ctx: AiCommandContext,
  command: Extract<DehleroCommand, { type: "addPrimitive" }>,
) {
  const old = findObject(ctx.scene, command.id);
  old?.parent?.remove(old);

  let geometry: THREE.BufferGeometry;

  if (command.primitive === "cube") {
    geometry = new THREE.BoxGeometry();
  } else if (command.primitive === "sphere") {
    geometry = new THREE.SphereGeometry(0.5, 48, 24);
  } else {
    geometry = new THREE.PlaneGeometry(2, 2);
  }

  const mesh = new THREE.Mesh(geometry, createMaterial(command.color));

  markAgentObject(mesh, command.id, command.name);

  if (command.position) mesh.position.set(...command.position);
  if (command.rotation) mesh.rotation.set(...command.rotation);
  if (command.scale) mesh.scale.set(...command.scale);

  ctx.scene.add(mesh);
}

function addText(
  ctx: AiCommandContext,
  command: Extract<DehleroCommand, { type: "addText" }>,
) {
  const old = findObject(ctx.scene, command.id);
  old?.parent?.remove(old);

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;

  const c = canvas.getContext("2d");
  if (!c) return;

  if (command.background) {
    c.fillStyle = command.background;
    c.fillRect(0, 0, canvas.width, canvas.height);
  }

  c.fillStyle = command.color ?? "#ffffff";
  c.font = "bold 72px Arial";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(command.text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  });

  const sprite = new THREE.Sprite(material);

  markAgentObject(sprite, command.id, command.id);

  if (command.position) sprite.position.set(...command.position);
  sprite.scale.set(...(command.scale ?? [6, 1.5, 1]));

  ctx.scene.add(sprite);
}

function animateObject(
  ctx: AiCommandContext,
  command: Extract<DehleroCommand, { type: "animateObject" }>,
) {
  const found = findObject(ctx.scene, command.id);

  if (found === null) {
    return;
  }

  const targetObject: THREE.Object3D = found;

  const startPosition = targetObject.position.clone();
  const endPosition = command.position
    ? new THREE.Vector3(...command.position)
    : startPosition.clone();

  const startedAt = performance.now();

  function frame(now: number) {
    const t = Math.min((now - startedAt) / (command.duration * 1000), 1);

    targetObject.position.lerpVectors(startPosition, endPosition, t);
    targetObject.updateMatrixWorld(true);

    if (t < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function setCameraLookAt(
  ctx: AiCommandContext,
  position: THREE.Vector3,
  target: THREE.Vector3,
) {
  if (ctx.controls) {
    void ctx.controls.setLookAt(
      position.x,
      position.y,
      position.z,
      target.x,
      target.y,
      target.z,
      false,
    );
    return;
  }

  ctx.camera.position.copy(position);
  ctx.camera.lookAt(target);
  ctx.camera.updateMatrixWorld(true);
}

function animateCamera(
  ctx: AiCommandContext,
  command: Extract<DehleroCommand, { type: "animateCamera" }>,
) {
  const startPosition = ctx.camera.position.clone();
  const endPosition = new THREE.Vector3(...command.position);
  const target = new THREE.Vector3(...command.target);
  const startedAt = performance.now();

  function frame(now: number) {
    const t = Math.min((now - startedAt) / (command.duration * 1000), 1);

    const current = startPosition.clone().lerp(endPosition, t);
    setCameraLookAt(ctx, current, target);

    if (t < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function orbitCamera(
  ctx: AiCommandContext,
  command: Extract<DehleroCommand, { type: "orbitCamera" }>,
) {
  const center = new THREE.Vector3(...command.center);
  const startedAt = performance.now();

  const startAngle = Math.atan2(
    ctx.camera.position.z - center.z,
    ctx.camera.position.x - center.x,
  );

  const angleDelta = THREE.MathUtils.degToRad(command.degrees);

  function frame(now: number) {
    const t = Math.min((now - startedAt) / (command.duration * 1000), 1);
    const angle = startAngle + angleDelta * t;

    const position = new THREE.Vector3(
      center.x + Math.cos(angle) * command.radius,
      center.y + command.height,
      center.z + Math.sin(angle) * command.radius,
    );

    setCameraLookAt(ctx, position, center);

    if (t < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

export function applyAiCommandEnvelope(
  ctx: AiCommandContext,
  envelope: DehleroCommandEnvelope,
) {
  envelope.commands.forEach((command) => {
    switch (command.type) {
      case "clearAiObjects":
        clearAiObjects(ctx);
        break;

      case "addPrimitive":
        addPrimitive(ctx, command);
        break;

      case "addText":
        addText(ctx, command);
        break;

      case "animateObject":
        animateObject(ctx, command);
        break;

      case "animateCamera":
        animateCamera(ctx, command);
        break;

      case "orbitCamera":
        orbitCamera(ctx, command);
        break;
    }
  });
}