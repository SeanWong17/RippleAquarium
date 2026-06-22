import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { aquariumFloorY, pineappleHouseDecor } from "../config.js";

const pineappleHouseModelUrl = new URL("./models/pineapple-house.glb", import.meta.url);

export async function createPineappleHouseDecor(settings = pineappleHouseDecor) {
  const modelHouse = await loadPineappleHouseModel(settings);
  if (modelHouse) return modelHouse;

  return createFallbackPineappleHouseDecor(settings);
}

async function loadPineappleHouseModel(settings) {
  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(pineappleHouseModelUrl.href);
    const house = gltf.scene;
    house.name = "Pineapple seabed house";
    normalizeLoadedHouse(house, settings);
    return house;
  } catch (error) {
    console.warn("Using fallback pineapple house decor.", error);
    return null;
  }
}

function normalizeLoadedHouse(house, settings) {
  const box = new THREE.Box3().setFromObject(house);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const height = Math.max(size.y, 0.0001);
  const scale = settings.height / height;

  house.position.set(0, 0, 0);
  house.scale.setScalar(scale);
  house.rotation.y = settings.rotationY;
  house.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(house);
  const scaledCenter = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);

  house.position.set(
    settings.position.x - scaledCenter.x,
    aquariumFloorY - scaledBox.min.y,
    settings.position.z - scaledCenter.z,
  );
  house.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      prepareLoadedMaterial(object.material);
    }
  });
}

function prepareLoadedMaterial(materialOrMaterials) {
  const materials = Array.isArray(materialOrMaterials)
    ? materialOrMaterials
    : [materialOrMaterials];

  for (const material of materials) {
    if (!material) continue;

    if (material.map) {
      material.map.colorSpace = THREE.SRGBColorSpace;
      material.needsUpdate = true;
    }
  }
}

function createFallbackPineappleHouseDecor(settings = pineappleHouseDecor) {
  const group = new THREE.Group();
  group.name = "Pineapple seabed house";
  group.position.copy(settings.position);
  group.rotation.y = settings.rotationY;

  const materials = createHouseMaterials();
  const body = createPineappleBody(settings, materials);
  const leaves = createLeafCrown(settings, materials.leaf);
  const door = createDoor(settings, materials);
  const windows = createWindows(settings, materials);
  const stones = createFoundationStones(settings, materials);

  group.add(body, leaves, door, windows, stones);
  group.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  return group;
}

function createHouseMaterials() {
  return {
    shell: new THREE.MeshStandardMaterial({
      color: 0xeaa33a,
      roughness: 0.78,
      metalness: 0.02,
    }),
    shellDark: new THREE.MeshStandardMaterial({
      color: 0xa35d20,
      roughness: 0.86,
      metalness: 0,
    }),
    leaf: new THREE.MeshStandardMaterial({
      color: 0x21965a,
      roughness: 0.72,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
    leafDark: new THREE.MeshStandardMaterial({
      color: 0x146f4c,
      roughness: 0.76,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
    door: new THREE.MeshStandardMaterial({
      color: 0x42aac4,
      roughness: 0.54,
      metalness: 0.08,
    }),
    trim: new THREE.MeshStandardMaterial({
      color: 0x163541,
      roughness: 0.48,
      metalness: 0.2,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xa8ebff,
      roughness: 0.08,
      metalness: 0,
      transmission: 0.08,
      transparent: true,
      opacity: 0.72,
    }),
    stone: new THREE.MeshStandardMaterial({
      color: 0x4d5961,
      roughness: 0.9,
      metalness: 0,
    }),
  };
}

function createPineappleBody(settings, materials) {
  const group = new THREE.Group();
  const bodyGeometry = new THREE.SphereGeometry(1, 48, 30);
  const body = new THREE.Mesh(bodyGeometry, materials.shell);
  body.scale.set(settings.bodyRadius, settings.bodyHeight * 0.5, settings.bodyRadius * 0.93);
  body.position.y = settings.bodyHeight * 0.48;
  group.add(body);

  const bandGeometry = new THREE.TorusGeometry(settings.bodyRadius * 0.88, 0.018, 6, 72);
  for (let i = 0; i < 7; i += 1) {
    const band = new THREE.Mesh(bandGeometry, materials.shellDark);
    band.position.y = 0.42 + i * 0.34;
    band.rotation.x = Math.PI / 2;
    band.scale.set(1 - i * 0.045, 1 - i * 0.045, 1);
    group.add(band);
  }

  const grooveGeometry = new THREE.BoxGeometry(0.028, settings.bodyHeight * 0.58, 0.034);
  for (let i = 0; i < 14; i += 1) {
    const angle = (i / 14) * Math.PI * 2;
    const groove = new THREE.Mesh(grooveGeometry, materials.shellDark);
    groove.position.set(
      Math.sin(angle) * settings.bodyRadius * 0.84,
      settings.bodyHeight * 0.56,
      Math.cos(angle) * settings.bodyRadius * 0.78,
    );
    groove.rotation.y = angle;
    groove.rotation.z = i % 2 === 0 ? 0.42 : -0.42;
    group.add(groove);
  }

  return group;
}

function createLeafCrown(settings, material) {
  const group = new THREE.Group();
  const leafGeometry = new THREE.ConeGeometry(0.18, 1.58, 5);
  const leafBaseY = settings.bodyHeight * 0.94;

  for (let ring = 0; ring < 3; ring += 1) {
    const count = ring === 0 ? 7 : 8;
    const radius = 0.18 + ring * 0.16;
    const leafHeight = 1.42 - ring * 0.12;

    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + ring * 0.31;
      const leaf = new THREE.Mesh(leafGeometry, material);
      leaf.scale.set(0.7 - ring * 0.08, leafHeight, 0.36);
      leaf.position.set(Math.sin(angle) * radius, leafBaseY + ring * 0.2, Math.cos(angle) * radius);
      leaf.rotation.set(
        THREE.MathUtils.degToRad(26 + ring * 13),
        angle,
        THREE.MathUtils.degToRad((i % 2 === 0 ? 1 : -1) * (12 + ring * 8)),
      );
      group.add(leaf);
    }
  }

  return group;
}

function createDoor(settings, materials) {
  const group = new THREE.Group();
  const door = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.58, 8, 24), materials.door);
  door.position.set(0, 0.68, settings.bodyRadius * 0.9);
  door.scale.set(1, 1.06, 0.08);
  group.add(door);

  const trim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.035, 8, 48), materials.trim);
  trim.position.copy(door.position);
  trim.scale.set(0.86, 1.25, 0.1);
  group.add(trim);

  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), materials.trim);
  knob.position.set(0.22, 0.67, settings.bodyRadius * 0.99);
  group.add(knob);

  return group;
}

function createWindows(settings, materials) {
  const group = new THREE.Group();
  const windowGeometry = new THREE.CylinderGeometry(0.22, 0.22, 0.08, 32);
  const rimGeometry = new THREE.TorusGeometry(0.24, 0.035, 8, 32);

  for (const spec of [
    { angle: -0.74, y: 1.55, scale: 1 },
    { angle: 0.78, y: 1.72, scale: 0.9 },
  ]) {
    const x = Math.sin(spec.angle) * settings.bodyRadius * 0.86;
    const z = Math.cos(spec.angle) * settings.bodyRadius * 0.84;
    const window = new THREE.Mesh(windowGeometry, materials.glass);
    window.position.set(x, spec.y, z);
    window.rotation.x = Math.PI / 2;
    window.rotation.z = -spec.angle;
    window.scale.setScalar(spec.scale);

    const rim = new THREE.Mesh(rimGeometry, materials.trim);
    rim.position.copy(window.position);
    rim.rotation.copy(window.rotation);
    rim.scale.setScalar(spec.scale);
    group.add(window, rim);
  }

  return group;
}

function createFoundationStones(settings, materials) {
  const group = new THREE.Group();
  const stoneGeometry = new THREE.DodecahedronGeometry(0.18, 0);

  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    const stone = new THREE.Mesh(stoneGeometry, materials.stone);
    stone.position.set(
      Math.sin(angle) * settings.bodyRadius * 0.92,
      aquariumFloorY - settings.position.y + 0.09,
      Math.cos(angle) * settings.bodyRadius * 0.82,
    );
    stone.scale.set(1.2, 0.45 + (i % 3) * 0.08, 0.82);
    stone.rotation.set(0.2 * i, angle, 0.37 * i);
    group.add(stone);
  }

  const doorstep = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.12, 0.52), materials.stone);
  doorstep.position.set(0, aquariumFloorY - settings.position.y + 0.06, settings.bodyRadius * 1.05);
  doorstep.rotation.y = 0.02;
  group.add(doorstep);
  return group;
}
