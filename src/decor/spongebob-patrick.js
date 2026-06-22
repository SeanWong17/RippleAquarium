import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { aquariumFloorY, spongebobPatrickDecor } from "../config.js";

const characterModelUrl = new URL("./models/spongebob-patrick.glb", import.meta.url);

export async function createSpongebobPatrickDecor({
  position = spongebobPatrickDecor.position,
  height = spongebobPatrickDecor.height,
  rotationY = spongebobPatrickDecor.rotationY,
} = {}) {
  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(characterModelUrl.href);
    const characters = gltf.scene;
    characters.name = "Spongebob and Patrick seabed decor";
    normalizeCharacterModel(characters, { position, height, rotationY });
    return characters;
  } catch (error) {
    console.warn("Spongebob and Patrick decor model was not loaded.", error);
    return null;
  }
}

function normalizeCharacterModel(characters, { position, height, rotationY }) {
  const box = new THREE.Box3().setFromObject(characters);
  const size = new THREE.Vector3();
  box.getSize(size);

  const scale = height / Math.max(size.y, 0.0001);
  characters.position.set(0, 0, 0);
  characters.scale.setScalar(scale);
  characters.rotation.y = rotationY;
  characters.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(characters);
  const scaledCenter = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);

  characters.position.set(
    position.x - scaledCenter.x,
    aquariumFloorY - scaledBox.min.y,
    position.z - scaledCenter.z,
  );
  characters.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      preserveCharacterMaterialColor(object);
    }
  });
}

function preserveCharacterMaterialColor(mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

  for (const material of materials) {
    if (!material) continue;

    if (material.map) {
      material.map.colorSpace = THREE.SRGBColorSpace;
    }
    material.toneMapped = false;
    material.roughness = Math.max(material.roughness ?? 0.72, 0.68);
    material.metalness = Math.min(material.metalness ?? 0, 0.02);
    material.needsUpdate = true;
  }
}
