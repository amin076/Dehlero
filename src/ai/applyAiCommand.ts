import * as THREE from "three";
import type { DehleroCommandEnvelope, DehleroCommand } from "./commandTypes";

export type AiCommandContext = {
  scene: THREE.Scene;
};

function createMaterial(color?: string) {
  return new THREE.MeshStandardMaterial({
    color: color ?? "#ffffff",
    roughness: 0.55,
    metalness: 0.05,
  });
}

function applyTransform(obj: THREE.Object3D, command: DehleroCommand) {
  if (command.position) obj.position.set(...command.position);
  if (command.rotation) obj.rotation.set(...command.rotation);
  if (command.scale) obj.scale.set(...command.scale);
  obj.name = command.name ?? command.id;
  obj.userData.dehleroId = command.id;
}

function addPrimitive(ctx: AiCommandContext, command: DehleroCommand) {
  if (command.type !== "addPrimitive") return;

  let geometry: THREE.BufferGeometry;

  if (command.primitive === "cube") {
    geometry = new THREE.BoxGeometry(1, 1, 1);
  } else if (command.primitive === "sphere") {
    geometry = new THREE.SphereGeometry(0.5, 48, 24);
  } else {
    geometry = new THREE.PlaneGeometry(2, 2);
  }

  const mesh = new THREE.Mesh(geometry, createMaterial(command.color));
  applyTransform(mesh, command);
  ctx.scene.add(mesh);
}

export function applyAiCommandEnvelope(
  ctx: AiCommandContext,
  envelope: DehleroCommandEnvelope,
) {
  if (!envelope.dehleroCommand || envelope.version !== "0.1") {
    throw new Error("Invalid Dehlero AI command envelope.");
  }

  envelope.commands.forEach((command) => {
    if (command.type === "addPrimitive") {
      addPrimitive(ctx, command);
    }
  });
}