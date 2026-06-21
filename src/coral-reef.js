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

const addedCoralGrowthDuration = 1800;

export async function createCoralReef({
  count = 100,
  scale = 2,
  maxCount = 200,
  seed = 73,
} = {}) {
  const models = await loadCoralModels();
  const group = new THREE.Group();
  group.name = "Coral reef";

  const reef = {
    group,
    count,
    scale,
    maxCount,
    animatedGrowth: null,
    seed,
    rebuild(nextSettings = {}) {
      const previousCount = getTargetCount(reef);
      const previousGrowth = Array.isArray(reef.animatedGrowth)
        ? reef.animatedGrowth
        : null;
      if (Number.isFinite(nextSettings.count)) reef.count = nextSettings.count;
      if (Number.isFinite(nextSettings.scale)) reef.scale = nextSettings.scale;
      if (Array.isArray(nextSettings.growth)) reef.animatedGrowth = nextSettings.growth;
      if (nextSettings.growth === null) reef.animatedGrowth = null;
      if (!Array.isArray(reef.animatedGrowth)) {
        prepareCoralGrowth(reef, previousCount, previousGrowth);
      }
      syncCorals(reef);
    },
    update(now = performance.now()) {
      if (Array.isArray(reef.animatedGrowth)) return;
      if (updateCoralGrowth(reef, now)) syncCorals(reef);
    },
    dispose() {
      group.clear();
      for (const model of models) {
        model.geometry.dispose();
        model.material.dispose();
      }
    },
  };

  buildCoralPool(reef, models);
  syncCorals(reef);
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

function buildCoralPool(reef, models) {
  const random = mulberry32(reef.seed);

  for (let i = 0; i < reef.maxCount; i += 1) {
    const model = models[i % models.length];
    const coral = new THREE.Mesh(model.geometry, model.material);
    const x = (random() - 0.5) * aquariumHalfSize.x * 1.68;
    const z = (random() - 0.5) * aquariumHalfSize.z * 1.68;
    const baseScale = THREE.MathUtils.lerp(0.38, 0.95, random());

    coral.position.set(x, aquariumFloorY + 0.015, z);
    coral.userData.baseY = coral.position.y;
    coral.userData.baseRotationY = random() * Math.PI * 2;
    coral.rotation.y = coral.userData.baseRotationY;
    coral.userData.baseScale = baseScale;
    coral.userData.growth = i < reef.count ? 1 : 0;
    coral.userData.growthStartedAt = 0;
    coral.userData.growing = false;
    coral.castShadow = true;
    coral.receiveShadow = true;
    reef.group.add(coral);
  }
}

function getTargetCount(reef) {
  return Math.max(0, Math.min(reef.maxCount, Math.floor(reef.count)));
}

function prepareCoralGrowth(reef, previousCount, previousGrowth = null) {
  const targetCount = getTargetCount(reef);
  const now = performance.now();

  for (let i = 0; i < reef.group.children.length; i += 1) {
    const coral = reef.group.children[i];
    if (i >= targetCount) {
      coral.userData.growth = 0;
      coral.userData.growing = false;
      continue;
    }

    if (i >= previousCount) {
      coral.userData.growth = 0;
      coral.userData.growthStartedAt = now;
      coral.userData.growing = true;
      continue;
    }

    if (previousGrowth) {
      coral.userData.growth = previousGrowth[i] ?? coral.userData.growth;
      coral.userData.growthStartedAt =
        now - coral.userData.growth * addedCoralGrowthDuration;
      coral.userData.growing = coral.userData.growth < 1;
      continue;
    }

    if (!coral.userData.growing && coral.userData.growth <= 0.001) {
      coral.userData.growth = 1;
    }
  }
}

function updateCoralGrowth(reef, now) {
  let changed = false;

  for (const coral of reef.group.children) {
    if (!coral.userData.growing) continue;

    const progress = THREE.MathUtils.clamp(
      (now - coral.userData.growthStartedAt) / addedCoralGrowthDuration,
      0,
      1,
    );
    coral.userData.growth = progress * progress * (3 - 2 * progress);
    changed = true;

    if (progress >= 1) {
      coral.userData.growth = 1;
      coral.userData.growing = false;
    }
  }

  return changed;
}

function syncCorals(reef) {
  const targetCount = getTargetCount(reef);
  for (let i = 0; i < reef.group.children.length; i += 1) {
    const coral = reef.group.children[i];
    coral.visible = i < targetCount;
    const growth = reef.animatedGrowth?.[i] ?? coral.userData.growth ?? 1;
    coral.scale.setScalar(coral.userData.baseScale * reef.scale * growth);
    coral.position.y = coral.userData.baseY - (1 - growth) * 0.18;
    coral.rotation.y = coral.userData.baseRotationY + (1 - growth) * 0.22;
  }
}
