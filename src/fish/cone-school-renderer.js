import * as THREE from "three";
import { coneConfig } from "../config.js";
import {
  readFishDirection,
  writeFishOrientationQuaternion,
} from "./pose.js";

const unitScale = new THREE.Vector3(1, 1, 1);
const tmpDirection = new THREE.Vector3();
const tmpQuaternion = new THREE.Quaternion();
const tmpMatrix = new THREE.Matrix4();
const tmpScale = new THREE.Vector3();

export function createConeSchoolMesh(count) {
  const geometry = createConeGeometry();
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0,
    flatShading: false,
    vertexColors: true,
  });
  const outlineMaterial = new THREE.MeshBasicMaterial({
    color: coneConfig.outlineColor,
    side: THREE.BackSide,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const outlineMesh = new THREE.InstancedMesh(geometry, outlineMaterial, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  outlineMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(),
    coneConfig.renderBoundsRadius,
  );
  outlineMesh.boundingSphere = mesh.boundingSphere;
  mesh.castShadow = true;
  mesh.renderOrder = 3;
  outlineMesh.castShadow = false;
  outlineMesh.receiveShadow = false;
  outlineMesh.renderOrder = 2;

  for (let i = 0; i < count; i += 1) {
    mesh.setColorAt(i, coneConfig.bodyColor);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  mesh.add(outlineMesh);
  mesh.userData.outlineMesh = outlineMesh;
  return mesh;
}

export function disposeConeSchoolMesh(mesh) {
  if (!mesh) return;

  mesh.geometry.dispose();
  disposeMaterial(mesh.material);
  disposeMaterial(mesh.userData.outlineMesh?.material);
}

export function updateConeSchoolInstances(mesh, fish) {
  const outlineMesh = mesh.userData.outlineMesh;

  for (let i = 0; i < fish.length; i += 1) {
    const currentFish = fish[i];
    const direction = readFishDirection(currentFish, tmpDirection);
    writeFishOrientationQuaternion(currentFish, direction, tmpQuaternion);

    tmpMatrix.compose(
      currentFish.position,
      tmpQuaternion,
      tmpScale.copy(unitScale).multiplyScalar(coneConfig.renderScale),
    );
    mesh.setMatrixAt(i, tmpMatrix);

    if (outlineMesh) {
      tmpMatrix.compose(
        currentFish.position,
        tmpQuaternion,
        tmpScale.copy(unitScale)
          .multiplyScalar(coneConfig.renderScale * coneConfig.outlineScale),
      );
      outlineMesh.setMatrixAt(i, tmpMatrix);
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (outlineMesh) {
    outlineMesh.instanceMatrix.needsUpdate = true;
  }
}

function createConeGeometry() {
  const geometry = new THREE.ConeGeometry(
    coneConfig.radius,
    coneConfig.length,
    coneConfig.radialSegments,
    coneConfig.heightSegments,
  );
  const vertexColors = new Float32Array(
    geometry.attributes.position.count * 3,
  ).fill(1);
  geometry.setAttribute("color", new THREE.BufferAttribute(vertexColors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function disposeMaterial(material) {
  if (!material) return;

  material.gradientMap?.dispose();
  material.dispose();
}
