import * as THREE from "three";

export function setObjectShadows(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

export function normalizeImportedObject(object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();

  box.getCenter(center);
  box.getSize(size);

  const maxSize = Math.max(size.x, size.y, size.z);

  if (maxSize > 0) {
    const wrapper = new THREE.Group();
    wrapper.add(object);
    object.position.sub(center);
    wrapper.scale.setScalar(2.4 / maxSize);
    setObjectShadows(wrapper);
    return wrapper;
  }

  setObjectShadows(object);
  return object;
}

export function placeObject(object: THREE.Object3D, index: number) {
  const column = index % 4;
  const row = Math.floor(index / 4);

  object.position.x += (column - 1.5) * 2.6;
  object.position.z += row * 2.2;
}

export function addObjectHelper(
  scene: THREE.Scene,
  object: THREE.Object3D,
) {
  if (object instanceof THREE.DirectionalLight) {
    const helper = new THREE.DirectionalLightHelper(object, 0.8);
    helper.visible = false;
    scene.add(helper);
    return helper;
  }

  if (object instanceof THREE.PointLight) {
    const helper = new THREE.PointLightHelper(object, 0.45);
    helper.visible = false;
    scene.add(helper);
    return helper;
  }

  if (object instanceof THREE.PerspectiveCamera) {
    const helper = new THREE.CameraHelper(object);
    helper.visible = false;
    scene.add(helper);
    return helper;
  }

  return null;
}

export function disposeMaterial(material: THREE.Material) {
  Object.values(material).forEach((value) => {
    if (value instanceof THREE.Texture) {
      value.dispose();
    }
  });

  material.dispose();
}

export function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    child.geometry.dispose();

    if (Array.isArray(child.material)) {
      child.material.forEach(disposeMaterial);
      return;
    }

    disposeMaterial(child.material);
  });
}
