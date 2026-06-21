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

export function createFishMesh(count) {
  const { geometry, material } = createFishModelInstance();
  addFishCurveAttributes(geometry, count);
  enableFishCurveDeformation(material);

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(),
    fishConfig.renderBoundsRadius,
  );
  mesh.castShadow = true;
  mesh.renderOrder = 2;

  for (let i = 0; i < count; i += 1) {
    const variant = fishConfig.appearanceVariants[i % fishConfig.appearanceVariants.length];
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

  for (let i = 0; i < fish.length; i += 1) {
    const currentFish = fish[i];
    const fishScale = fishConfig.renderScale;
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
