import * as THREE from "three";
import type {
  DehleroCommand,
  DehleroCommandEnvelope,
  EasingName,
  Vec3,
} from "./commandTypes";

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

type ObjectAnimation = {
  kind: "object";
  object: THREE.Object3D;
  startedAt: number;
  duration: number;
  easing: EasingName;
  startPosition: THREE.Vector3;
  endPosition: THREE.Vector3;
  startRotation: THREE.Euler;
  endRotation: THREE.Euler;
  startScale: THREE.Vector3;
  endScale: THREE.Vector3;
};

type ProjectileAnimation = {
  kind: "projectile";
  object: THREE.Object3D;
  startedAt: number;
  duration: number;
  startPosition: THREE.Vector3;
  velocity: THREE.Vector3;
  gravity: number;
};

type OrbitObjectAnimation = {
  kind: "orbitObject";
  object: THREE.Object3D;
  startedAt: number;
  duration: number;
  easing: EasingName;
  center: THREE.Vector3;
  radius: number;
  height: number;
  startAngle: number;
  angleDelta: number;
};

type CameraAnimation = {
  kind: "camera";
  startedAt: number;
  duration: number;
  easing: EasingName;
  startPosition: THREE.Vector3;
  endPosition: THREE.Vector3;
  startFov: number | null;
  endFov: number | null;
  target: THREE.Vector3;
};

type OrbitCameraAnimation = {
  kind: "orbitCamera";
  startedAt: number;
  duration: number;
  easing: EasingName;
  center: THREE.Vector3;
  radius: number;
  height: number;
  startAngle: number;
  angleDelta: number;
  startFov: number | null;
  endFov: number | null;
};

type FollowCameraAnimation = {
  kind: "followCamera";
  target: THREE.Object3D;
  startedAt: number;
  duration: number;
  offset: THREE.Vector3;
  fov: number | null;
};

type ActiveAnimation =
  | ObjectAnimation
  | ProjectileAnimation
  | OrbitObjectAnimation
  | CameraAnimation
  | OrbitCameraAnimation
  | FollowCameraAnimation;

const activeAnimations: ActiveAnimation[] = [];

function ease(value: number, easing: EasingName = "linear") {
  if (easing === "easeInOut") {
    return value < 0.5
      ? 4 * value * value * value
      : 1 - Math.pow(-2 * value + 2, 3) / 2;
  }

  if (easing === "easeIn") {
    return value * value * value;
  }

  if (easing === "easeOut") {
    return 1 - Math.pow(1 - value, 3);
  }

  return value;
}

function vec3(value: Vec3) {
  return new THREE.Vector3(...value);
}

function currentFov(camera: THREE.Camera) {
  return camera instanceof THREE.PerspectiveCamera ? camera.fov : null;
}

function applyFov(camera: THREE.Camera, fov: number | null) {
  if (fov === null) return;

  if (camera instanceof THREE.PerspectiveCamera) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}

function setCameraLookAt(
  ctx: AiCommandContext,
  position: THREE.Vector3,
  target: THREE.Vector3,
  fov: number | null = null,
) {
  applyFov(ctx.camera, fov);

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
  }

  ctx.camera.position.copy(position);
  ctx.camera.lookAt(target);
  ctx.camera.updateMatrixWorld(true);
}

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

function removeActiveAnimationsForObject(object: THREE.Object3D) {
  for (let index = activeAnimations.length - 1; index >= 0; index -= 1) {
    const animation = activeAnimations[index];

    if (
      animation &&
      (animation.kind === "object" ||
        animation.kind === "projectile" ||
        animation.kind === "orbitObject") &&
      animation.object === object
    ) {
      activeAnimations.splice(index, 1);
    }
  }
}

function clearAiObjects(ctx: AiCommandContext) {
  const items: THREE.Object3D[] = [];

  ctx.scene.traverse((item) => {
    if (item.userData.createdByAi === true) items.push(item);
  });

  items.forEach((item) => {
    removeActiveAnimationsForObject(item);
    item.parent?.remove(item);
  });
}

function removeObject(
  ctx: AiCommandContext,
  command: Extract<DehleroCommand, { type: "removeObject" }>,
) {
  const object = findObject(ctx.scene, command.id);
  if (!object) return;

  removeActiveAnimationsForObject(object);
  object.parent?.remove(object);
}

function addPrimitive(
  ctx: AiCommandContext,
  command: Extract<DehleroCommand, { type: "addPrimitive" }>,
) {
  const old = findObject(ctx.scene, command.id);
  if (old) {
    removeActiveAnimationsForObject(old);
    old.parent?.remove(old);
  }

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

  const context = canvas.getContext("2d");
  if (!context) return;

  if (command.background) {
    context.fillStyle = command.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.fillStyle = command.color ?? "#ffffff";
  context.font = "bold 72px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(command.text, canvas.width / 2, canvas.height / 2);

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

function addLight(
  ctx: AiCommandContext,
  command: Extract<DehleroCommand, { type: "addLight" }>,
) {
  const old = findObject(ctx.scene, command.id);
  old?.parent?.remove(old);

  const color = command.color ?? "#ffffff";
  const intensity = command.intensity ?? 1;

  let light: THREE.Light;

  if (command.kind === "ambient") {
    light = new THREE.AmbientLight(color, intensity);
  } else if (command.kind === "point") {
    light = new THREE.PointLight(color, intensity, 100);
  } else {
    light = new THREE.DirectionalLight(color, intensity);
  }

  markAgentObject(light, command.id, command.name);

  if (command.position) light.position.set(...command.position);

  ctx.scene.add(light);
}

function setTransform(
  ctx: AiCommandContext,
  command: Extract<DehleroCommand, { type: "setTransform" }>,
) {
  const object = findObject(ctx.scene, command.id);
  if (!object) return;

  if (command.position) object.position.set(...command.position);
  if (command.rotation) object.rotation.set(...command.rotation);
  if (command.scale) object.scale.set(...command.scale);

  object.updateMatrixWorld(true);
}

function setColor(
  ctx: AiCommandContext,
  command: Extract<DehleroCommand, { type: "setColor" }>,
) {
  const object = findObject(ctx.scene, command.id);
  if (!(object instanceof THREE.Mesh)) return;

  const material = object.material;

  if (Array.isArray(material)) {
    material.forEach((item) => {
      if (item instanceof THREE.MeshStandardMaterial) item.color.set(command.color);
    });
    return;
  }

  if (material instanceof THREE.MeshStandardMaterial) {
    material.color.set(command.color);
  }
}

function animateObject(
  ctx: AiCommandContext,
  command: Extract<DehleroCommand, { type: "animateObject" }>,
) {
  const object = findObject(ctx.scene, command.id);
  if (!object) return;

  removeActiveAnimationsForObject(object);

  activeAnimations.push({
    kind: "object",
    object,
    startedAt: performance.now(),
    duration: Math.max(command.duration, 0.001),
    easing: command.easing ?? "linear",
    startPosition: object.position.clone(),
    endPosition: command.position ? vec3(command.position) : object.position.clone(),
    startRotation: object.rotation.clone(),
    endRotation: command.rotation ? new THREE.Euler(...command.rotation) : object.rotation.clone(),
    startScale: object.scale.clone(),
    endScale: command.scale ? vec3(command.scale) : object.scale.clone(),
  });
}

function projectileObject(
  ctx: AiCommandContext,
  command: Extract<DehleroCommand, { type: "projectileObject" }>,
) {
  const object = findObject(ctx.scene, command.id);
  if (!object) return;

  removeActiveAnimationsForObject(object);

  activeAnimations.push({
    kind: "projectile",
    object,
    startedAt: performance.now(),
    duration: Math.max(command.duration, 0.001),
    startPosition: object.position.clone(),
    velocity: vec3(command.velocity),
    gravity: command.gravity ?? -9.8,
  });
}

function orbitObject(
  ctx: AiCommandContext,
  command: Extract<DehleroCommand, { type: "orbitObject" }>,
) {
  const object = findObject(ctx.scene, command.id);
  if (!object) return;

  removeActiveAnimationsForObject(object);

  const center = vec3(command.center);
  const startAngle = Math.atan2(
    object.position.z - center.z,
    object.position.x - center.x,
  );

  activeAnimations.push({
    kind: "orbitObject",
    object,
    startedAt: performance.now(),
    duration: Math.max(command.duration, 0.001),
    easing: command.easing ?? "linear",
    center,
    radius: command.radius,
    height: command.height ?? object.position.y - center.y,
    startAngle,
    angleDelta: THREE.MathUtils.degToRad(command.degrees),
  });
}

function setCamera(
  ctx: AiCommandContext,
  command: Extract<DehleroCommand, { type: "setCamera" }>,
) {
  setCameraLookAt(ctx, vec3(command.position), vec3(command.target), command.fov ?? null);
}

function animateCamera(
  ctx: AiCommandContext,
  command: Extract<DehleroCommand, { type: "animateCamera" }>,
) {
  activeAnimations.push({
    kind: "camera",
    startedAt: performance.now(),
    duration: Math.max(command.duration, 0.001),
    easing: command.easing ?? "linear",
    startPosition: ctx.camera.position.clone(),
    endPosition: vec3(command.position),
    startFov: currentFov(ctx.camera),
    endFov: command.fov ?? currentFov(ctx.camera),
    target: vec3(command.target),
  });
}

function orbitCamera(
  ctx: AiCommandContext,
  command: Extract<DehleroCommand, { type: "orbitCamera" }>,
) {
  const center = vec3(command.center);
  const startAngle = Math.atan2(
    ctx.camera.position.z - center.z,
    ctx.camera.position.x - center.x,
  );

  activeAnimations.push({
    kind: "orbitCamera",
    startedAt: performance.now(),
    duration: Math.max(command.duration, 0.001),
    easing: command.easing ?? "linear",
    center,
    radius: command.radius,
    height: command.height,
    startAngle,
    angleDelta: THREE.MathUtils.degToRad(command.degrees),
    startFov: currentFov(ctx.camera),
    endFov: command.fov ?? currentFov(ctx.camera),
  });
}

function followCamera(
  ctx: AiCommandContext,
  command: Extract<DehleroCommand, { type: "followCamera" }>,
) {
  const target = findObject(ctx.scene, command.targetId);
  if (!target) return;

  activeAnimations.push({
    kind: "followCamera",
    target,
    startedAt: performance.now(),
    duration: Math.max(command.duration, 0.001),
    offset: command.offset ? vec3(command.offset) : new THREE.Vector3(0, 3, 8),
    fov: command.fov ?? currentFov(ctx.camera),
  });
}

function updateObjectAnimation(animation: ObjectAnimation, t: number) {
  animation.object.position.lerpVectors(animation.startPosition, animation.endPosition, t);

  animation.object.rotation.set(
    THREE.MathUtils.lerp(animation.startRotation.x, animation.endRotation.x, t),
    THREE.MathUtils.lerp(animation.startRotation.y, animation.endRotation.y, t),
    THREE.MathUtils.lerp(animation.startRotation.z, animation.endRotation.z, t),
  );

  animation.object.scale.lerpVectors(animation.startScale, animation.endScale, t);
  animation.object.updateMatrixWorld(true);
}

function updateProjectile(animation: ProjectileAnimation, elapsed: number) {
  animation.object.position.set(
    animation.startPosition.x + animation.velocity.x * elapsed,
    animation.startPosition.y + animation.velocity.y * elapsed + 0.5 * animation.gravity * elapsed * elapsed,
    animation.startPosition.z + animation.velocity.z * elapsed,
  );
  animation.object.updateMatrixWorld(true);
}

function updateOrbitObject(animation: OrbitObjectAnimation, t: number) {
  const angle = animation.startAngle + animation.angleDelta * t;

  animation.object.position.set(
    animation.center.x + Math.cos(angle) * animation.radius,
    animation.center.y + animation.height,
    animation.center.z + Math.sin(angle) * animation.radius,
  );
  animation.object.updateMatrixWorld(true);
}

function updateCameraAnimation(
  ctx: AiCommandContext,
  animation: CameraAnimation,
  t: number,
) {
  const position = animation.startPosition.clone().lerp(animation.endPosition, t);
  const fov =
    animation.startFov !== null && animation.endFov !== null
      ? THREE.MathUtils.lerp(animation.startFov, animation.endFov, t)
      : null;

  setCameraLookAt(ctx, position, animation.target, fov);
}

function updateOrbitCamera(
  ctx: AiCommandContext,
  animation: OrbitCameraAnimation,
  t: number,
) {
  const angle = animation.startAngle + animation.angleDelta * t;
  const position = new THREE.Vector3(
    animation.center.x + Math.cos(angle) * animation.radius,
    animation.center.y + animation.height,
    animation.center.z + Math.sin(angle) * animation.radius,
  );

  const fov =
    animation.startFov !== null && animation.endFov !== null
      ? THREE.MathUtils.lerp(animation.startFov, animation.endFov, t)
      : null;

  setCameraLookAt(ctx, position, animation.center, fov);
}

function updateFollowCamera(
  ctx: AiCommandContext,
  animation: FollowCameraAnimation,
) {
  const target = animation.target.position.clone();
  const position = target.clone().add(animation.offset);
  setCameraLookAt(ctx, position, target, animation.fov);
}

export function updateAiAnimations(ctx: AiCommandContext, now = performance.now()) {
  for (let index = activeAnimations.length - 1; index >= 0; index -= 1) {
    const animation = activeAnimations[index];
    if (!animation) continue;

    const elapsed = (now - animation.startedAt) / 1000;
    const raw = Math.min(elapsed / animation.duration, 1);
    const t = ease(raw, "easing" in animation ? animation.easing : "linear");

    if (animation.kind === "object") {
      updateObjectAnimation(animation, t);
    } else if (animation.kind === "projectile") {
      updateProjectile(animation, elapsed);
    } else if (animation.kind === "orbitObject") {
      updateOrbitObject(animation, t);
    } else if (animation.kind === "camera") {
      updateCameraAnimation(ctx, animation, t);
    } else if (animation.kind === "orbitCamera") {
      updateOrbitCamera(ctx, animation, t);
    } else {
      updateFollowCamera(ctx, animation);
    }

    if (raw >= 1 && animation.kind !== "followCamera") {
      activeAnimations.splice(index, 1);
    }
  }
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

      case "removeObject":
        removeObject(ctx, command);
        break;

      case "addPrimitive":
        addPrimitive(ctx, command);
        break;

      case "addText":
        addText(ctx, command);
        break;

      case "addLight":
        addLight(ctx, command);
        break;

      case "setTransform":
        setTransform(ctx, command);
        break;

      case "setColor":
        setColor(ctx, command);
        break;

      case "animateObject":
        animateObject(ctx, command);
        break;

      case "projectileObject":
        projectileObject(ctx, command);
        break;

      case "orbitObject":
        orbitObject(ctx, command);
        break;

      case "setCamera":
        setCamera(ctx, command);
        break;

      case "animateCamera":
        animateCamera(ctx, command);
        break;

      case "orbitCamera":
        orbitCamera(ctx, command);
        break;

      case "followCamera":
        followCamera(ctx, command);
        break;
    }
  });
}
