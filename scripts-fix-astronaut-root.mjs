import fs from "fs";

const file = "src/app/createStudioApp.ts";
let content = fs.readFileSync(file, "utf8");

content = content.replace(
  `const loadedObject = gltf.scene;
  loadedObject.name = "Astronaut";

  fitObjectToView(loadedObject, camera);
  scene.add(loadedObject);

  controls.setLookAt(0, 2.2, 7, 0, 0, 0, false);`,
  `const assetRoot = new THREE.Group();
  assetRoot.name = "AstronautRoot";

  const loadedObject = gltf.scene;
  loadedObject.name = "Astronaut";

  const box = new THREE.Box3().setFromObject(loadedObject);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();

  box.getCenter(center);
  box.getSize(size);

  loadedObject.position.sub(center);

  const maxSize = Math.max(size.x, size.y, size.z);
  const fitScale = maxSize > 0 ? 3 / maxSize : 1;
  loadedObject.scale.setScalar(fitScale);

  assetRoot.add(loadedObject);
  scene.add(assetRoot);

  controls.setLookAt(0, 1.5, 7, 0, 0, 0, false);`
);

content = content.replaceAll("loadedObject.position.set(", "assetRoot.position.set(");
content = content.replaceAll("loadedObject.rotation.y = values.rotationY;", "assetRoot.rotation.y = values.rotationY;");
content = content.replaceAll("loadedObject.scale.setScalar(values.scale);", "assetRoot.scale.setScalar(values.scale);");

fs.writeFileSync(file, content, "utf8");

console.log("Astronaut now uses centered assetRoot.");
