import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { aquariumFloorY, aquariumHalfSize } from "./config.js";
import { mulberry32 } from "./random.js";

const coralUrls = Array.from(
  { length: 7 },
  (_, index) => new URL(`./coral/Coral${index}.glb`, import.meta.url),
);

const coralColors = [
  new THREE.Color(0x0b6b4c),
  new THREE.Color(0x1f8a4d),
  new THREE.Color(0x5da331),
  new THREE.Color(0xb24c3c),
  new THREE.Color(0xd05b73),
  new THREE.Color(0xd78b52),
  new THREE.Color(0x7e5ac7),
];

export async function createCoralReef({
  count = 90,
  scale = 1,
  seed = 73,
} = {}) {
  const models = await loadCoralModels();
  const group = new THREE.Group();
  group.name = "Coral reef";

  const reef = {
    group,
    count,
    scale,
    seed,
    rebuild(nextSettings = {}) {
      if (Number.isFinite(nextSettings.count)) reef.count = nextSettings.count;
      if (Number.isFinite(nextSettings.scale)) reef.scale = nextSettings.scale;
      rebuildCorals(reef, models);
    },
    dispose() {
      group.clear();
      for (const model of models) {
        model.geometry.dispose();
        model.material.dispose();
      }
    },
  };

  rebuildCorals(reef, models);
  return reef;
}

async function loadCoralModels() {
  const loader = new GLTFLoader();
  const gltfs = await Promise.all(coralUrls.map((url) => loader.loadAsync(url.href)));
  return gltfs.map((gltf, index) => {
    const mesh = findPrimaryMesh(gltf.scene);
    if (!mesh) throw new Error(`Coral${index}.glb does not contain a mesh.`);

    const geometry = normalizeCoralGeometry(mesh.geometry);
    const material = new THREE.MeshStandardMaterial({
      color: coralColors[index % coralColors.length],
      roughness: 0.82,
      metalness: 0,
    });
    return { geometry, material };
  });
}

function findPrimaryMesh(root) {
  let result = null;
  root.traverse((object) => {
    if (object.isMesh && object.geometry && !result) {
      result = object;
    }
  });
  return result;
}

function normalizeCoralGeometry(sourceGeometry) {
  const geometry = sourceGeometry.clone();
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  const height = Math.max(size.y, 0.0001);
  geometry.translate(-center.x, -box.min.y, -center.z);
  geometry.scale(1 / height, 1 / height, 1 / height);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function rebuildCorals(reef, models) {
  reef.group.clear();
  const random = mulberry32(reef.seed);
  const targetCount = Math.max(0, Math.floor(reef.count));

  for (let i = 0; i < targetCount; i += 1) {
    const model = models[i % models.length];
    const coral = new THREE.Mesh(model.geometry, model.material);
    const x = (random() - 0.5) * aquariumHalfSize.x * 1.68;
    const z = (random() - 0.5) * aquariumHalfSize.z * 1.68;
    const baseScale = THREE.MathUtils.lerp(0.38, 0.95, random()) * reef.scale;

    coral.position.set(x, aquariumFloorY + 0.015, z);
    coral.rotation.y = random() * Math.PI * 2;
    coral.scale.setScalar(baseScale);
    coral.castShadow = true;
    coral.receiveShadow = true;
    reef.group.add(coral);
  }
}
