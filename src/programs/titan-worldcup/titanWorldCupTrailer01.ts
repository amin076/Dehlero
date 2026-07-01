import * as THREE from "three";
import type { ProgramContext, ProgramInstance } from "../programTypes";

type BindingKey =
  | "hero.ball"
  | "hero.shuttle"
  | "hero.saturn"
  | "hero.astronaut1"
  | "hero.astronaut2";

type ActorState = {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
};

const DURATION = 30;

function clamp01(value: number) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function smoother(value: number) {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function bell(value: number) {
  const t = clamp01(value);
  return Math.sin(t * Math.PI);
}

function shotTime(elapsed: number, start: number, end: number) {
  return smoother((elapsed - start) / (end - start));
}

function getBoundObject(context: ProgramContext, key: BindingKey) {
  return context.runtimeBindings?.[key] ?? null;
}

function captureState(object: THREE.Object3D): ActorState {
  return {
    position: object.position.clone(),
    rotation: object.rotation.clone(),
    scale: object.scale.clone(),
  };
}

function restoreState(object: THREE.Object3D | null, state: ActorState | null) {
  if (!object || !state) return;
  object.position.copy(state.position);
  object.rotation.copy(state.rotation);
  object.scale.copy(state.scale);
}

function scaleFromState(
  object: THREE.Object3D | null,
  state: ActorState | null,
  multiplier: number,
) {
  if (!object || !state) return;
  object.scale.copy(state.scale).multiplyScalar(multiplier);
}

function setCamera(
  camera: THREE.PerspectiveCamera,
  position: THREE.Vector3,
  target: THREE.Vector3,
  fov: number,
) {
  camera.position.copy(position);
  camera.fov = fov;
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}

function titleCanvas(main: string, sub: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 90, 0, 420);
  gradient.addColorStop(0, "rgba(5, 10, 22, 0.18)");
  gradient.addColorStop(0.5, "rgba(5, 10, 22, 0.48)");
  gradient.addColorStop(1, "rgba(5, 10, 22, 0.18)");

  ctx.fillStyle = gradient;
  roundRect(ctx, 142, 112, 740, 278, 46);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 210, 128, 0.52)";
  ctx.lineWidth = 3;
  roundRect(ctx, 154, 124, 716, 254, 40);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.shadowColor = "rgba(255, 185, 90, 0.95)";
  ctx.shadowBlur = 26;
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 64px Arial, Helvetica, sans-serif";
  ctx.fillText(main, 512, 222);

  ctx.shadowColor = "rgba(120, 190, 255, 0.8)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "rgba(235, 247, 255, 0.96)";
  ctx.font = "800 30px Arial, Helvetica, sans-serif";
  ctx.fillText(sub.toUpperCase(), 512, 310);

  return canvas;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function createCanvasTitle(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
) {
  const material = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(
      titleCanvas("WORLD CUP 3026", "The First Match on Titan"),
    ),
    transparent: true,
    depthTest: false,
    depthWrite: false,
    opacity: 0,
  });

  const sprite = new THREE.Sprite(material);
  sprite.name = "Dehlero Shorts Canvas Title";
  sprite.renderOrder = 9999;
  sprite.visible = true;
  scene.add(sprite);

  const direction = new THREE.Vector3();
  const position = new THREE.Vector3();

  function setLines(main: string, sub: string) {
    material.map?.dispose();
    material.map = new THREE.CanvasTexture(titleCanvas(main, sub));
    material.map.needsUpdate = true;
    material.needsUpdate = true;
  }

  function update(opacity: number, verticalOffset = 0.02, scale = 0.74) {
    material.opacity = clamp01(opacity);
    sprite.visible = material.opacity > 0.002;

    camera.getWorldDirection(direction);
    position.copy(camera.position).add(direction.multiplyScalar(7.5));
    position.y += verticalOffset * 7.5;
    sprite.position.copy(position);
    sprite.quaternion.copy(camera.quaternion);

    const height = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * 7.5;
    sprite.scale.set(height * scale, height * scale * 0.5, 1);
  }

  function dispose() {
    scene.remove(sprite);
    material.map?.dispose();
    material.dispose();
  }

  return { setLines, update, dispose };
}

export function createTitanWorldCupTrailer01(
  context: ProgramContext,
): ProgramInstance {
  const { camera, scene, setStatus } = context;

  let playing = false;
  let elapsed = 0;

  let ball: THREE.Object3D | null = null;
  let shuttle: THREE.Object3D | null = null;
  let saturn: THREE.Object3D | null = null;
  let astronaut1: THREE.Object3D | null = null;
  let astronaut2: THREE.Object3D | null = null;

  let ballState: ActorState | null = null;
  let shuttleState: ActorState | null = null;
  let saturnState: ActorState | null = null;
  let astronaut1State: ActorState | null = null;
  let astronaut2State: ActorState | null = null;

  const title = createCanvasTitle(scene, camera);

  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const tmpC = new THREE.Vector3();
  const ballPos = new THREE.Vector3();
  const shuttlePos = new THREE.Vector3();
  const astronautPos = new THREE.Vector3();
  const stadiumCenter = new THREE.Vector3();
  const saturnCenter = new THREE.Vector3();

  function prepare() {
    ball = getBoundObject(context, "hero.ball");
    shuttle = getBoundObject(context, "hero.shuttle");
    saturn = getBoundObject(context, "hero.saturn");
    astronaut1 = getBoundObject(context, "hero.astronaut1");
    astronaut2 = getBoundObject(context, "hero.astronaut2");

    if (!ball || !shuttle || !saturn || !astronaut1 || !astronaut2) {
      setStatus?.(
        "Select Ball, Shuttle, Saturn, Astronaut 1 and Astronaut 2 first",
      );
      return false;
    }

    elapsed = 0;
    playing = false;

    ballState = captureState(ball);
    shuttleState = captureState(shuttle);
    saturnState = captureState(saturn);
    astronaut1State = captureState(astronaut1);
    astronaut2State = captureState(astronaut2);

    stadiumCenter.copy(ballState.position).lerp(shuttleState.position, 0.28);
    saturnCenter.copy(saturnState.position);

    scaleFromState(ball, ballState, 4);
    scaleFromState(shuttle, shuttleState, 4);
    scaleFromState(astronaut1, astronaut1State, 4);
    scaleFromState(astronaut2, astronaut2State, 4);

    title.setLines("WORLD CUP 3026", "The First Match on Titan");
    title.update(0);

    setCamera(
      camera,
      stadiumCenter.clone().add(new THREE.Vector3(0, 4.8, 18.5)),
      saturnCenter.clone().lerp(stadiumCenter, 0.55),
      31,
    );

    return true;
  }

  function play() {
    if (!prepare()) return;
    playing = true;
    setStatus?.("Playing Titan World Cup 3026 Shorts Trailer");
  }

  function stop() {
    playing = false;
    elapsed = 0;
    title.update(0);

    restoreState(ball, ballState);
    restoreState(shuttle, shuttleState);
    restoreState(saturn, saturnState);
    restoreState(astronaut1, astronaut1State);
    restoreState(astronaut2, astronaut2State);

    setStatus?.("Stopped Titan World Cup 3026");
  }

  function update(delta: number) {
    if (
      !playing ||
      !ball ||
      !shuttle ||
      !saturn ||
      !astronaut1 ||
      !astronaut2 ||
      !ballState ||
      !shuttleState ||
      !saturnState ||
      !astronaut1State ||
      !astronaut2State
    ) {
      return;
    }

    elapsed += delta;

    stadiumCenter.copy(ballState.position).lerp(shuttleState.position, 0.28);
    saturnCenter.copy(saturnState.position);

    // Gentle background life.
    saturn.rotation.y = saturnState.rotation.y + elapsed * 0.035;
    astronaut2.position.copy(astronaut2State.position);
    astronaut2.rotation.y =
      astronaut2State.rotation.y + Math.sin(elapsed * 0.9) * 0.035;

    scaleFromState(ball, ballState, 4);
    scaleFromState(shuttle, shuttleState, 4);
    scaleFromState(astronaut1, astronaut1State, 4);
    scaleFromState(astronaut2, astronaut2State, 4);

    // Shot 1: 0–3s. Big Saturn, instant hook, centered Shorts title.
    if (elapsed < 3) {
      const t = shotTime(elapsed, 0, 3);

      restoreState(ball, ballState);
      restoreState(shuttle, shuttleState);
      restoreState(astronaut1, astronaut1State);
      scaleFromState(ball, ballState, 4);
      scaleFromState(shuttle, shuttleState, 4);
      scaleFromState(astronaut1, astronaut1State, 4);
      scaleFromState(astronaut2, astronaut2State, 4);

      tmpA.copy(stadiumCenter).add(new THREE.Vector3(0, 4.5, 18.2));
      tmpB.copy(stadiumCenter).add(new THREE.Vector3(0, 4.0, 15.2));
      tmpC.lerpVectors(tmpA, tmpB, t);

      setCamera(
        camera,
        tmpC,
        saturnCenter.clone().lerp(stadiumCenter, 0.52),
        30,
      );

      title.setLines("WORLD CUP 3026", "The First Match on Titan");
      title.update(
        smoother(elapsed / 0.45) * (1 - smoother((elapsed - 2.35) / 0.65)),
        0.05,
        0.72,
      );
      return;
    }

    // Shot 2: 3–7s. Shuttle crosses frame fast enough for retention but still cinematic.
    if (elapsed < 7) {
      const t = shotTime(elapsed, 3, 7);

      const start = shuttleState.position
        .clone()
        .add(new THREE.Vector3(-7.5, 3.0, 5.5));
      const end = shuttleState.position
        .clone()
        .add(new THREE.Vector3(6.8, 1.4, -4.2));
      shuttlePos.lerpVectors(start, end, t);
      shuttlePos.y += bell(t) * 1.0;
      shuttle.position.copy(shuttlePos);
      shuttle.rotation.copy(shuttleState.rotation);
      shuttle.rotation.z += THREE.MathUtils.lerp(-0.12, 0.08, t);

      tmpA.copy(stadiumCenter).add(new THREE.Vector3(-3.2, 3.0, 11.5));
      tmpB.copy(stadiumCenter).add(new THREE.Vector3(2.4, 3.6, 9.4));
      tmpC.lerpVectors(tmpA, tmpB, t);

      setCamera(
        camera,
        tmpC,
        shuttle.position.clone().lerp(stadiumCenter, 0.35),
        THREE.MathUtils.lerp(33, 29, t),
      );
      title.update(0);
      return;
    }

    // Shot 3: 7–11s. Astronaut 1 moves toward the ball; astronaut 2 watches.
    if (elapsed < 11) {
      const t = shotTime(elapsed, 7, 11);

      shuttle.position.copy(shuttleState.position);
      shuttle.rotation.copy(shuttleState.rotation);

      const walkFrom = astronaut1State.position
        .clone()
        .lerp(ballState.position, 0.18);
      const walkTo = astronaut1State.position
        .clone()
        .lerp(ballState.position, 0.62);
      astronautPos.lerpVectors(walkFrom, walkTo, t);
      astronautPos.y += Math.abs(Math.sin(t * Math.PI * 5)) * 0.12;
      astronaut1.position.copy(astronautPos);
      astronaut1.rotation.copy(astronaut1State.rotation);
      astronaut1.rotation.y += Math.sin(t * Math.PI * 2) * 0.1;
      astronaut1.rotation.z += Math.sin(t * Math.PI * 6) * 0.035;

      ball.position.copy(ballState.position);
      ball.rotation.copy(ballState.rotation);

      tmpA.copy(ballState.position).add(new THREE.Vector3(-0.95, 1.25, 2.15));
      tmpB.copy(ballState.position).add(new THREE.Vector3(-0.55, 1.05, 1.65));
      tmpC.lerpVectors(tmpA, tmpB, t);

      const target = ballState.position.clone().lerp(astronaut1.position, 0.52);
      target.y += 0.85;
      setCamera(camera, tmpC, target, THREE.MathUtils.lerp(36, 31, t));
      title.update(0);
      return;
    }

    // Shot 4: 11–15s. Extreme football close-up, readable on phone.
    if (elapsed < 15) {
      const t = shotTime(elapsed, 11, 15);

      shuttle.position.copy(shuttleState.position);
      astronaut1.position.copy(
        astronaut1State.position.clone().lerp(ballState.position, 0.66),
      );
      astronaut1.rotation.copy(astronaut1State.rotation);

      ballPos.copy(ballState.position);
      ballPos.y += 0.18 + Math.sin((elapsed - 11) * 2.2) * 0.08;
      ball.position.copy(ballPos);
      ball.rotation.x = ballState.rotation.x + elapsed * 0.95;
      ball.rotation.y = ballState.rotation.y + elapsed * 0.65;

      tmpA.copy(ball.position).add(new THREE.Vector3(0.22, 0.2, 0.82));
      tmpB.copy(ball.position).add(new THREE.Vector3(0.08, 0.12, 0.68));
      tmpC.lerpVectors(tmpA, tmpB, t);

      setCamera(camera, tmpC, ball.position, THREE.MathUtils.lerp(23, 17, t));
      title.update(0);
      return;
    }

    // Shot 5: 15–20s. Kick moment and low-gravity rise.
    if (elapsed < 20) {
      const t = shotTime(elapsed, 15, 20);

      shuttle.position.copy(shuttleState.position);

      astronaut1.position.copy(
        astronaut1State.position.clone().lerp(ballState.position, 0.7),
      );
      astronaut1.rotation.copy(astronaut1State.rotation);
      astronaut1.rotation.x += bell(t) * 0.12;
      astronaut1.rotation.z += bell(t) * 0.2;

      const kickStart = ballState.position.clone();
      const kickEnd = ballState.position
        .clone()
        .add(new THREE.Vector3(1.4, 4.8, -5.8));
      ballPos.lerpVectors(kickStart, kickEnd, t);
      ballPos.y += bell(t) * 2.25;
      ball.position.copy(ballPos);
      ball.rotation.x += delta * 7.4;
      ball.rotation.y += delta * 5.2;

      tmpA.copy(ballState.position).add(new THREE.Vector3(-0.65, 0.8, 1.75));
      tmpB.copy(ball.position).add(new THREE.Vector3(-0.75, 0.95, 2.1));
      tmpC.lerpVectors(tmpA, tmpB, t);

      const target = ball.position.clone().lerp(saturnCenter, 0.12);
      target.y += 0.2;
      setCamera(camera, tmpC, target, THREE.MathUtils.lerp(29, 34, t));
      title.update(0);
      return;
    }

    // Shot 6: 20–26s. Follow the flying ball with Saturn filling the background.
    if (elapsed < 26) {
      const t = shotTime(elapsed, 20, 26);

      shuttle.position.copy(shuttleState.position);
      astronaut1.position.copy(
        astronaut1State.position.clone().lerp(ballState.position, 0.7),
      );

      const flyStart = ballState.position
        .clone()
        .add(new THREE.Vector3(1.4, 4.8, -5.8));
      const flyEnd = ballState.position
        .clone()
        .add(new THREE.Vector3(4.6, 7.8, -13.8));
      ballPos.lerpVectors(flyStart, flyEnd, t);
      ballPos.y += bell(t) * 1.25;
      ball.position.copy(ballPos);
      ball.rotation.x += delta * 8.5;
      ball.rotation.y += delta * 6.1;

      tmpA.copy(ball.position).add(new THREE.Vector3(0.58, 0.72, 1.95));
      tmpB.copy(ball.position).add(new THREE.Vector3(0.14, 0.82, 1.5));
      tmpC.lerpVectors(tmpA, tmpB, t);

      const target = ball.position.clone().lerp(saturnCenter, 0.24);
      target.y += 0.25;
      setCamera(camera, tmpC, target, THREE.MathUtils.lerp(31, 25, t));
      title.update(0);
      return;
    }

    // Shot 7: 26–30s. Vertical-safe final wide shot with CTA.
    if (elapsed < DURATION) {
      const t = shotTime(elapsed, 26, DURATION);

      shuttle.position.copy(shuttleState.position);
      shuttle.rotation.copy(shuttleState.rotation);
      astronaut1.position.copy(
        astronaut1State.position.clone().lerp(ballState.position, 0.62),
      );
      astronaut1.rotation.copy(astronaut1State.rotation);
      astronaut2.position.copy(astronaut2State.position);
      astronaut2.rotation.copy(astronaut2State.rotation);

      ball.position.lerpVectors(
        ballState.position.clone().add(new THREE.Vector3(4.6, 7.8, -13.8)),
        ballState.position.clone().add(new THREE.Vector3(0.5, 3.4, -5.8)),
        t,
      );
      ball.rotation.x += delta * 3.5;
      ball.rotation.y += delta * 2.4;

      tmpA.copy(ball.position).add(new THREE.Vector3(0.15, 1.0, 3.2));
      tmpB.copy(stadiumCenter).add(new THREE.Vector3(0, 3.2, 10.5));
      tmpC.lerpVectors(tmpA, tmpB, t);

      const target = stadiumCenter.clone().lerp(saturnCenter, 0.38);
      target.y += 1.0;
      setCamera(camera, tmpC, target, THREE.MathUtils.lerp(27, 33, t));

      title.setLines("WOULD YOU", "Play Here?");
      title.update(smoother((elapsed - 26.35) / 0.75), -0.02, 0.7);
      return;
    }

    playing = false;
    title.update(0);
    setStatus?.("Finished Titan World Cup 3026 Shorts Trailer");
  }

  return {
    play,
    stop,
    update,
  };
}

