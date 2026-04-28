import * as THREE from "three";
import { fishConfig } from "./config.js";

const upAxis = new THREE.Vector3(0, 1, 0);
const unitScale = new THREE.Vector3(1, 1, 1);
const tmpDirection = new THREE.Vector3();
const tmpQuaternion = new THREE.Quaternion();
const tmpMatrix = new THREE.Matrix4();

export function createFishMesh(count) {
  const geometry = createFishGeometry();
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.42,
    metalness: 0.05,
    vertexColors: true,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = true;

  for (let i = 0; i < count; i += 1) {
    mesh.setColorAt(
      i,
      i === fishConfig.highlightedIndex
        ? fishConfig.highlightedColor
        : fishConfig.bodyColor,
    );
  }
  mesh.instanceColor.needsUpdate = true;

  return mesh;
}

export function disposeFishMesh(mesh) {
  if (!mesh) return;
  mesh.geometry.dispose();
  mesh.material.dispose();
}

export function updateFishInstances(mesh, boids) {
  for (let i = 0; i < boids.length; i += 1) {
    const boid = boids[i];
    const direction = tmpDirection.copy(boid.velocity).normalize();
    tmpQuaternion.setFromUnitVectors(upAxis, direction);
    tmpMatrix.compose(boid.position, tmpQuaternion, unitScale);
    mesh.setMatrixAt(i, tmpMatrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

export function getFishHeadPose(boid, pose) {
  pose.direction.copy(boid.velocity).normalize();
  pose.position.copy(boid.position).addScaledVector(
    pose.direction,
    fishConfig.length / 2,
  );
  return pose;
}

function createFishGeometry() {
  const geometry = new THREE.ConeGeometry(
    fishConfig.radius,
    fishConfig.length,
    fishConfig.radialSegments,
    1,
  );
  const vertexColors = new Float32Array(
    geometry.attributes.position.count * 3,
  ).fill(1);
  geometry.setAttribute("color", new THREE.BufferAttribute(vertexColors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
