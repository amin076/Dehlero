import * as THREE from "three";
import type { ProgramContext, ProgramInstance } from "../programTypes";

function clamp01(v: number) {
  return THREE.MathUtils.clamp(v, 0, 1);
}

function smooth(v: number) {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
}

function lookAt(camera: THREE.PerspectiveCamera, target: THREE.Vector3) {
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}

function setFov(camera: THREE.PerspectiveCamera, fov: number) {
  camera.fov = fov;
  camera.updateProjectionMatrix();
}

function makeShortTitle() {
  const layer = document.createElement("div");
  layer.style.position = "fixed";
  layer.style.inset = "0";
  layer.style.zIndex = "99999";
  layer.style.pointerEvents = "none";
  layer.style.display = "flex";
  layer.style.alignItems = "center";
  layer.style.justifyContent = "center";
  layer.style.opacity = "0";
  layer.style.transition = "opacity 0.35s ease";

  const card = document.createElement("div");
  card.style.transform = "translateY(-4vh)";
  card.style.maxWidth = "72vw";
  card.style.padding = "16px 22px";
  card.style.borderRadius = "22px";
  card.style.background = "rgba(0,0,0,0.34)";
  card.style.backdropFilter = "blur(12px)";
  card.style.textAlign = "center";
  card.style.color = "white";
  card.style.textShadow = "0 0 20px rgba(255,190,90,0.95)";

  const title = document.createElement("div");
  title.style.font = "900 clamp(26px, 4.6vw, 44px) Arial";
  title.style.letterSpacing = "0.08em";

  const subtitle = document.createElement("div");
  subtitle.style.font = "700 clamp(13px, 2.0vw, 18px) Arial";
  subtitle.style.marginTop = "8px";
  subtitle.style.letterSpacing = "0.13em";

  card.append(title, subtitle);
  layer.appendChild(card);
  document.body.appendChild(layer);

  return {
    setLines(main: string, sub: string) {
      title.textContent = main;
      subtitle.textContent = sub;
    },
    show(opacity: number) {
      layer.style.opacity = String(clamp01(opacity));
    },
    remove() {
      layer.remove();
    },
  };
}

export function createTitanWorldCupTrailer01(
  context: ProgramContext,
): ProgramInstance {
  const { camera, setStatus } = context;

  let playing = false;
  let elapsed = 0;

  let ball: THREE.Object3D | null = null;
  let shuttle: THREE.Object3D | null = null;

  const title = makeShortTitle();

  const ballHome = new THREE.Vector3();
  const ballHeroA = new THREE.Vector3(0, 4.0, -7.2);
  const ballHeroB = new THREE.Vector3(4.8, 4.8, -13.2);
  const ballBaseRotation = new THREE.Euler();

  const shuttleLanding = new THREE.Vector3();
  const shuttleStart = new THREE.Vector3();
  const shuttleBaseRotation = new THREE.Euler();

  const saturnFrameTarget = new THREE.Vector3(0, 2.55, -3.7);
  const finalFrameTarget = new THREE.Vector3(0, 2.65, -4.2);

  const tmpTarget = new THREE.Vector3();
  const tmpPos = new THREE.Vector3();

  function prepare() {
    ball = context.runtimeBindings?.["hero.ball"] ?? null;
    shuttle = context.runtimeBindings?.["hero.shuttle"] ?? null;

    if (!ball || !shuttle) {
      setStatus?.("Bind hero.ball and hero.shuttle first");
      return false;
    }

    elapsed = 0;

    ballHome.copy(ball.position);
    ballBaseRotation.copy(ball.rotation);

    shuttleLanding.copy(shuttle.position);
    shuttleBaseRotation.copy(shuttle.rotation);

    // Keep the shuttle upright and only animate its position.
    shuttleStart.copy(shuttleLanding).add(new THREE.Vector3(0, 7.2, -18));
    shuttle.position.copy(shuttleStart);
    shuttle.rotation.copy(shuttleBaseRotation);

    // Opening frame based on the screenshot composition:
    // centered runway, Saturn visible, shuttle upright in the distance.
    setFov(camera, 34);
    camera.position.set(0, 4.8, 25.5);
    lookAt(camera, saturnFrameTarget);

    title.setLines("TITAN WORLD CUP 3026", "THE GAME BEYOND EARTH");
    title.show(0);

    return true;
  }

  function play() {
    if (!prepare()) return;
    playing = true;
    setStatus?.("Playing Titan World Cup 3026");
  }

  function stop() {
    playing = false;
    title.show(0);

    if (ball) {
      ball.position.copy(ballHome);
      ball.rotation.copy(ballBaseRotation);
    }

    if (shuttle) {
      shuttle.position.copy(shuttleLanding);
      shuttle.rotation.copy(shuttleBaseRotation);
    }

    setStatus?.("Stopped Titan World Cup 3026");
  }

  function update(delta: number) {
    if (!playing || !ball || !shuttle) return;

    elapsed += delta;

    // 0–4 s: opening hero frame, Saturn + moon composition, centered title.
    if (elapsed < 4) {
      const t = smooth(elapsed / 4);

      camera.position.lerpVectors(
        new THREE.Vector3(0, 4.9, 25.8),
        new THREE.Vector3(0, 4.4, 22.6),
        t,
      );
      setFov(camera, THREE.MathUtils.lerp(35, 32, t));
      lookAt(camera, saturnFrameTarget);

      const fadeIn = smooth(elapsed / 0.9);
      const fadeOut = elapsed > 3.1 ? 1 - smooth((elapsed - 3.1) / 0.9) : 1;
      title.show(fadeIn * fadeOut);

      shuttle.position.copy(shuttleStart);
      shuttle.rotation.copy(shuttleBaseRotation);
      return;
    }

    // 4–10 s: shuttle landing, wheels-down attitude preserved.
    if (elapsed < 10) {
      const t = smooth((elapsed - 4) / 6);

      shuttle.position.lerpVectors(shuttleStart, shuttleLanding, t);
      shuttle.rotation.copy(shuttleBaseRotation);

      camera.position.lerpVectors(
        new THREE.Vector3(-1.4, 4.7, 21.0),
        new THREE.Vector3(-2.2, 3.6, 16.6),
        t,
      );
      setFov(camera, THREE.MathUtils.lerp(31, 29, t));
      lookAt(camera, new THREE.Vector3(0, 2.45, -3.9));

      title.show(0);
      return;
    }

    // 10–15 s: reveal more of the base but keep the Saturn axis in frame.
    if (elapsed < 15) {
      const t = smooth((elapsed - 10) / 5);

      shuttle.position.copy(shuttleLanding);
      shuttle.rotation.copy(shuttleBaseRotation);

      camera.position.lerpVectors(
        new THREE.Vector3(-2.2, 3.6, 16.6),
        new THREE.Vector3(8.4, 6.5, 23.8),
        t,
      );
      setFov(camera, THREE.MathUtils.lerp(29, 34, t));
      lookAt(camera, new THREE.Vector3(0, 2.7, -3.8));
      return;
    }

    // 15–21 s: ball rises into the sky and rotates with Saturn still behind it.
    if (elapsed < 21) {
      const t = smooth((elapsed - 15) / 6);

      shuttle.position.copy(shuttleLanding);
      shuttle.rotation.copy(shuttleBaseRotation);

      tmpPos.lerpVectors(ballHome, ballHeroA, t);
      tmpPos.y += Math.sin(t * Math.PI * 2) * 0.18;
      ball.position.copy(tmpPos);
      ball.rotation.x += delta * 2.2;
      ball.rotation.y += delta * 1.6;

      camera.position.lerpVectors(
        new THREE.Vector3(8.4, 6.5, 23.8),
        new THREE.Vector3(2.8, 4.2, 13.4),
        t,
      );
      setFov(camera, THREE.MathUtils.lerp(34, 27, t));

      tmpTarget.copy(ball.position).lerp(saturnFrameTarget, 0.22);
      tmpTarget.y += 0.18;
      lookAt(camera, tmpTarget);
      return;
    }

    // 21–27 s: a few seconds of ball travel and spin in the sky.
    if (elapsed < 27) {
      const t = smooth((elapsed - 21) / 6);

      shuttle.position.copy(shuttleLanding);
      shuttle.rotation.copy(shuttleBaseRotation);

      tmpPos.lerpVectors(ballHeroA, ballHeroB, t);
      tmpPos.y += Math.sin(t * Math.PI) * 0.9;
      ball.position.copy(tmpPos);
      ball.rotation.x += delta * 6.4;
      ball.rotation.y += delta * 4.2;

      camera.position.lerpVectors(
        new THREE.Vector3(2.8, 4.2, 13.4),
        ball.position.clone().add(new THREE.Vector3(4.3, 2.0, 8.7)),
        t,
      );
      setFov(camera, THREE.MathUtils.lerp(27, 30, t));

      tmpTarget.copy(ball.position).lerp(finalFrameTarget, 0.32);
      tmpTarget.y += 0.2;
      lookAt(camera, tmpTarget);
      return;
    }

    // 27–32 s: final wide pullback, shuttle + Saturn visible again, centered end title.
    if (elapsed < 32) {
      const t = smooth((elapsed - 27) / 5);

      shuttle.position.copy(shuttleLanding);
      shuttle.rotation.copy(shuttleBaseRotation);

      ball.position.lerpVectors(ballHeroB, new THREE.Vector3(1.2, 4.4, -10.2), t);
      ball.rotation.x += delta * 2.8;
      ball.rotation.y += delta * 2.0;

      camera.position.lerpVectors(
        ballHeroB.clone().add(new THREE.Vector3(4.3, 2.0, 8.7)),
        new THREE.Vector3(0, 5.8, 26.8),
        t,
      );
      setFov(camera, THREE.MathUtils.lerp(30, 35, t));
      lookAt(camera, finalFrameTarget);

      title.setLines("WELCOME TO TITAN", "WORLD CUP 3026");
      const fadeIn = smooth((elapsed - 27) / 1.0);
      const fadeOut = elapsed > 31 ? 1 - smooth((elapsed - 31) / 1.0) : 1;
      title.show(fadeIn * fadeOut);
      return;
    }

    playing = false;
    title.show(0);
    setStatus?.("Finished Titan World Cup 3026");
  }

  return {
    play,
    stop,
    update,
  };
}

