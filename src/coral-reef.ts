import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { aquariumFloorY, aquariumHalfSize } from "./config.js";
import { mulberry32 } from "./random.js";
import type { ExclusionZone, RandomSource } from "./types.js";

interface CoralModel {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
}

interface CoralState {
  modelIndex: number;
  instanceIndex: number;
  visible: boolean;
  position: THREE.Vector3;
  scale: number;
  baseY: number;
  baseRotationY: number;
  baseScale: number;
  growth: number;
  growthStartedAt: number;
  growing: boolean;
}

interface CoralReefSettings {
  count?: number;
  scale?: number;
  maxCount?: number;
  seed?: number;
  exclusionZones?: ExclusionZone[];
}

type CoralRebuildSettings = Partial<Pick<CoralReef, "count" | "scale">> & {
  growth?: number[] | null;
};

export interface CoralReef {
  group: THREE.Group;
  count: number;
  scale: number;
  maxCount: number;
  animatedGrowth: number[] | null;
  seed: number;
  exclusionZones: ExclusionZone[];
  corals: CoralState[];
  meshes: THREE.InstancedMesh[];
  rebuild(nextSettings?: CoralRebuildSettings): void;
  update(now?: number): void;
  dispose(): void;
}

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
const coralPlacementInset = 1.35;

const tmpMatrix = new THREE.Matrix4();
const tmpQuaternion = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpPosition = new THREE.Vector3();
const hiddenScale = new THREE.Vector3(0, 0, 0);

export async function createCoralReef({
  count = 100,
  scale = 2,
  maxCount = 200,
  seed = 73,
  exclusionZones = [],
}: CoralReefSettings = {}): Promise<CoralReef> {
  const models = await loadCoralModels();
  const group = new THREE.Group();
  group.name = "Coral reef";

  const reef: CoralReef = {
    group,
    count,
    scale,
    maxCount,
    animatedGrowth: null,
    seed,
    exclusionZones,
    // Logical corals shared with consumers (e.g. clownfish avoidance). Each entry
    // mirrors what a standalone Mesh used to expose: visible, world position,
    // rendered uniform scale.
    corals: [],
    meshes: [],
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
      for (const mesh of reef.meshes) {
        mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          material.dispose();
        }
      }
      reef.meshes.length = 0;
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

function findPrimaryMesh(root: THREE.Object3D): THREE.Mesh | null {
  let result: THREE.Mesh | null = null;
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && object.geometry && !result) {
      result = object;
    }
  });
  return result;
}

function normalizeCoralGeometry(sourceGeometry: THREE.BufferGeometry): THREE.BufferGeometry {
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

function buildCoralPool(reef: CoralReef, models: CoralModel[]): void {
  const random = mulberry32(reef.seed);
  // One InstancedMesh per coral model. Corals are assigned round-robin by model,
  // so per-model instance counts are tracked first, then meshes are allocated.
  const perModelCounts = new Array(models.length).fill(0);
  for (let i = 0; i < reef.maxCount; i += 1) {
    perModelCounts[i % models.length] += 1;
  }

  reef.meshes = models.map((model, modelIndex) => {
    const mesh = new THREE.InstancedMesh(
      model.geometry,
      model.material,
      Math.max(1, perModelCounts[modelIndex]),
    );
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.count = perModelCounts[modelIndex];
    reef.group.add(mesh);
    return mesh;
  });

  const nextInstanceIndex = new Array(models.length).fill(0);
  reef.corals = [];
  for (let i = 0; i < reef.maxCount; i += 1) {
    const modelIndex = i % models.length;
    const instanceIndex = nextInstanceIndex[modelIndex];
    nextInstanceIndex[modelIndex] += 1;

    const position = sampleCoralPosition(random, reef.exclusionZones);
    const baseScale = THREE.MathUtils.lerp(0.38, 0.95, random());

    reef.corals.push({
      modelIndex,
      instanceIndex,
      visible: i < reef.count,
      position: new THREE.Vector3(position.x, aquariumFloorY + 0.015, position.z),
      scale: 0,
      baseY: aquariumFloorY + 0.015,
      baseRotationY: random() * Math.PI * 2,
      baseScale,
      growth: i < reef.count ? 1 : 0,
      growthStartedAt: 0,
      growing: false,
    });
  }
}

function sampleCoralPosition(random: RandomSource, exclusionZones: ExclusionZone[]) {
  const fallback = { x: 0, z: 0 };

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const position = {
      x: randomSignedRange(random, aquariumHalfSize.x - coralPlacementInset),
      z: randomSignedRange(random, aquariumHalfSize.z - coralPlacementInset),
    };
    fallback.x = position.x;
    fallback.z = position.z;

    if (!isInExclusionZone(position, exclusionZones)) {
      return position;
    }
  }

  fallback.x = THREE.MathUtils.clamp(
    fallback.x,
    -aquariumHalfSize.x + coralPlacementInset,
    aquariumHalfSize.x - coralPlacementInset,
  );
  fallback.z = fallback.z < 0
    ? -aquariumHalfSize.z + coralPlacementInset
    : aquariumHalfSize.z - coralPlacementInset;
  return fallback;
}

function randomSignedRange(random: RandomSource, halfRange: number): number {
  return (random() * 2 - 1) * halfRange;
}

function isInExclusionZone(position: { x: number; z: number }, exclusionZones: ExclusionZone[]): boolean {
  for (const zone of exclusionZones) {
    if (zone.shape === "box" && isInBoxExclusionZone(position, zone)) {
      return true;
    }

    if (isInCircleExclusionZone(position, zone)) {
      return true;
    }
  }

  return false;
}

function isInCircleExclusionZone(position: { x: number; z: number }, zone: ExclusionZone): boolean {
  const radius = "radius" in zone ? zone.radius : 0;
  if (radius <= 0) return false;

  const dx = position.x - zone.position.x;
  const dz = position.z - zone.position.z;
  return dx * dx + dz * dz < radius * radius;
}

function isInBoxExclusionZone(position: { x: number; z: number }, zone: Extract<ExclusionZone, { shape: "box" }>): boolean {
  const halfX = zone.size.x * 0.5;
  const halfZ = zone.size.y * 0.5;
  const dx = Math.abs(position.x - zone.position.x);
  const dz = Math.abs(position.z - zone.position.z);

  return dx < halfX && dz < halfZ;
}

function getTargetCount(reef: CoralReef): number {
  return Math.max(0, Math.min(reef.maxCount, Math.floor(reef.count)));
}

function prepareCoralGrowth(
  reef: CoralReef,
  previousCount: number,
  previousGrowth: number[] | null = null,
): void {
  const targetCount = getTargetCount(reef);
  const now = performance.now();

  for (let i = 0; i < reef.corals.length; i += 1) {
    const coral = reef.corals[i];
    if (i >= targetCount) {
      coral.growth = 0;
      coral.growing = false;
      continue;
    }

    if (i >= previousCount) {
      coral.growth = 0;
      coral.growthStartedAt = now;
      coral.growing = true;
      continue;
    }

    if (previousGrowth) {
      coral.growth = previousGrowth[i] ?? coral.growth;
      coral.growthStartedAt = now - coral.growth * addedCoralGrowthDuration;
      coral.growing = coral.growth < 1;
      continue;
    }

    if (!coral.growing && coral.growth <= 0.001) {
      coral.growth = 1;
    }
  }
}

function updateCoralGrowth(reef: CoralReef, now: number): boolean {
  let changed = false;

  for (const coral of reef.corals) {
    if (!coral.growing) continue;

    const progress = THREE.MathUtils.clamp(
      (now - coral.growthStartedAt) / addedCoralGrowthDuration,
      0,
      1,
    );
    coral.growth = progress * progress * (3 - 2 * progress);
    changed = true;

    if (progress >= 1) {
      coral.growth = 1;
      coral.growing = false;
    }
  }

  return changed;
}

function syncCorals(reef: CoralReef): void {
  const targetCount = getTargetCount(reef);
  for (let i = 0; i < reef.corals.length; i += 1) {
    const coral = reef.corals[i];
    const visible = i < targetCount;
    coral.visible = visible;

    const mesh = reef.meshes[coral.modelIndex];
    if (!visible) {
      coral.scale = 0;
      tmpMatrix.compose(coral.position, identityQuaternion(), hiddenScale);
      mesh.setMatrixAt(coral.instanceIndex, tmpMatrix);
      continue;
    }

    const growth = reef.animatedGrowth?.[i] ?? coral.growth ?? 1;
    const renderScale = coral.baseScale * reef.scale * growth;
    coral.scale = renderScale;

    tmpPosition.set(
      coral.position.x,
      coral.baseY - (1 - growth) * 0.18,
      coral.position.z,
    );
    coral.position.y = tmpPosition.y;
    tmpQuaternion.setFromAxisAngle(
      Y_AXIS,
      coral.baseRotationY + (1 - growth) * 0.22,
    );
    tmpScale.setScalar(renderScale);
    tmpMatrix.compose(tmpPosition, tmpQuaternion, tmpScale);
    mesh.setMatrixAt(coral.instanceIndex, tmpMatrix);
  }

  for (const mesh of reef.meshes) {
    mesh.instanceMatrix.needsUpdate = true;
  }
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const reusableIdentityQuaternion = new THREE.Quaternion();

function identityQuaternion() {
  return reusableIdentityQuaternion.identity();
}
