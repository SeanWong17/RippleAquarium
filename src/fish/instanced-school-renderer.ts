import * as THREE from "three";
import { fishConfig } from "./config.js";
import {
  addFishCurveAttributes,
  enableFishCurveDeformation,
  markFishCurveAttributesNeedsUpdate,
  readFishCurveAttributes,
  updateFishCurveAttributes,
} from "./curve-deformation.js";
import {
  createFishModelInstance,
  createFishModelInstanceByKey,
  disposeFishMaterial,
} from "./model-loader.js";
import {
  readFishDirection,
  writeFishOrientationQuaternion,
} from "./pose.js";

const unitScale = new THREE.Vector3(1, 1, 1);
const tmpDirection = new THREE.Vector3();
const tmpQuaternion = new THREE.Quaternion();
const tmpMatrix = new THREE.Matrix4();
const tmpScale = new THREE.Vector3();

export function createFishMesh(capacity, variantIndex = 0) {
  const { geometry, material, useAppearanceVariants, renderScale } = createFishModelInstance(variantIndex);
  return createFishMeshFromModel(capacity, geometry, material, useAppearanceVariants, renderScale);
}

export function createFishMeshByKey(capacity, modelKey) {
  const { geometry, material, useAppearanceVariants, renderScale } = createFishModelInstanceByKey(modelKey);
  return createFishMeshFromModel(capacity, geometry, material, useAppearanceVariants, renderScale);
}

// Resize the visible instance count without touching geometry/material. The mesh
// is allocated once at capacity, so this is a cheap field write — no GPU realloc
// or shader recompile, unlike disposing and rebuilding the mesh.
export function setFishMeshCount(mesh, count) {
  if (!mesh) return;
  mesh.count = Math.max(0, Math.min(count, mesh.userData.capacity ?? count));
}

function createFishMeshFromModel(capacity, geometry, material, useAppearanceVariants, renderScale = 1) {
  addFishCurveAttributes(geometry, capacity);
  enableFishCurveDeformation(material);

  const count = capacity;
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.userData.capacity = capacity;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(),
    fishConfig.renderBoundsRadius,
  );
  mesh.castShadow = true;
  mesh.renderOrder = 2;
  mesh.userData.renderScale = renderScale;

  for (let i = 0; i < count; i += 1) {
    const variant = useAppearanceVariants
      ? fishConfig.appearanceVariants[i % fishConfig.appearanceVariants.length]
      : fishConfig.bodyColor;
    mesh.setColorAt(
      i,
      i === fishConfig.highlightedIndex ? fishConfig.highlightedColor : variant,
    );
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  return mesh;
}

export function disposeFishMesh(mesh) {
  if (!mesh) return;

  mesh.geometry.dispose();
  disposeFishMaterial(mesh.material);
}

export function updateFishInstances(mesh, fish) {
  const curveAttributes = readFishCurveAttributes(mesh.geometry);
  const fishScale = fishConfig.renderScale * (mesh.userData.renderScale ?? 1);

  for (let i = 0; i < fish.length; i += 1) {
    const currentFish = fish[i];
    const direction = readFishDirection(currentFish, tmpDirection);
    writeFishOrientationQuaternion(currentFish, direction, tmpQuaternion);
    updateFishCurveAttributes(
      curveAttributes,
      i,
      currentFish,
      tmpQuaternion,
    );

    tmpMatrix.compose(
      currentFish.position,
      tmpQuaternion,
      tmpScale.copy(unitScale).multiplyScalar(fishScale),
    );
    mesh.setMatrixAt(i, tmpMatrix);
  }

  mesh.instanceMatrix.needsUpdate = true;
  markFishCurveAttributesNeedsUpdate(curveAttributes);
}
