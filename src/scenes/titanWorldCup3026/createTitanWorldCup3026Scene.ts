import * as THREE from "three";

export function createTitanWorldCup3026Scene(scene: THREE.Scene) {
  scene.background = new THREE.Color("#130704");
  scene.fog = new THREE.FogExp2("#c06b32", 0.006);

  const group = new THREE.Group();
  group.name = "Titan World Cup 3026";
  scene.add(group);

  const terrain = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420, 160, 160),
    new THREE.MeshStandardMaterial({
      color: "#a75b2c",
      roughness: 0.98,
      metalness: 0,
    })
  );

  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = -1.2;

  const pos = terrain.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);

    const h =
      Math.sin(x * 0.045) * 1.2 +
      Math.cos(y * 0.038) * 0.9 +
      Math.sin((x + y) * 0.025) * 0.65;

    pos.setZ(i, h);
  }

  terrain.geometry.computeVertexNormals();
  group.add(terrain);

  const field = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 46),
    new THREE.MeshStandardMaterial({
      color: "#46572f",
      roughness: 0.95,
      transparent: true,
      opacity: 0.86,
    })
  );

  field.rotation.x = -Math.PI / 2;
  field.position.set(0, -0.72, -12);
  group.add(field);

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 64, 48),
    new THREE.MeshStandardMaterial({
      map: createFootballTexture(),
      roughness: 0.62,
      metalness: 0.02,
    })
  );

  ball.name = "Football";
  ball.position.set(-6, -0.25, 5);
  group.add(ball);

  const saturn = new THREE.Mesh(
    new THREE.SphereGeometry(9.5, 96, 48),
    new THREE.MeshStandardMaterial({
      color: "#d8b071",
      roughness: 0.82,
      emissive: "#2b1708",
      emissiveIntensity: 0.25,
    })
  );

  saturn.name = "Saturn";
  saturn.position.set(0, 40, -180);
  group.add(saturn);

  const rings = new THREE.Mesh(
    new THREE.RingGeometry(13, 24, 192),
    new THREE.MeshBasicMaterial({
      color: "#e2c99b",
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    })
  );

  rings.name = "Saturn Rings";
  rings.position.copy(saturn.position);
  rings.rotation.x = Math.PI * 0.62;
  rings.rotation.z = Math.PI * 0.08;
  group.add(rings);

  const haze = new THREE.Mesh(
    new THREE.SphereGeometry(180, 64, 32),
    new THREE.MeshBasicMaterial({
      color: "#d87735",
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
      depthWrite: false,
    })
  );
  haze.position.set(0, 12, -40);
  group.add(haze);

  const title = createTextSprite("WORLD CUP 3026\nTITAN STADIUM");
  title.position.set(0, 7.5, -26);
  title.visible = false;
  group.add(title);

  return {
    group,
    ball,
    saturn,
    rings,
    title,

    update(elapsed: number) {
      const t = elapsed;

      const flight = Math.min(t / 18, 1);
      ball.position.x = -6 + flight * 13;
      ball.position.z = 5 - flight * 38;
      ball.position.y = -0.25 + Math.sin(flight * Math.PI) * 6.8;

      ball.rotation.x -= 0.035;
      ball.rotation.z -= 0.025;

      saturn.rotation.y += 0.0007;
      rings.rotation.z += 0.00018;

      title.visible = t > 22;
    },
  };
}

function createFootballTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;

  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f7f3e8";
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = "#111111";

  for (let y = 70; y < 512; y += 150) {
    for (let x = 70; x < 512; x += 150) {
      ctx.beginPath();
      ctx.moveTo(x, y - 34);
      ctx.lineTo(x + 34, y - 10);
      ctx.lineTo(x + 22, y + 32);
      ctx.lineTo(x - 22, y + 32);
      ctx.lineTo(x - 34, y - 10);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 6;

  for (let i = -512; i < 512; i += 90) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 512, 512);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createTextSprite(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;

  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.font = "bold 92px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(255,150,70,0.95)";
  ctx.shadowBlur = 30;

  const lines = text.split("\n");
  lines.forEach((line, index) => {
    ctx.fillText(line, canvas.width / 2, 185 + index * 115);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(18, 9, 1);
  return sprite;
}
