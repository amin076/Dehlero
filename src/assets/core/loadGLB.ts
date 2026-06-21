import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/gltf/");

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

export async function loadGLB(url: string) {
  return await loader.loadAsync(url);
}
