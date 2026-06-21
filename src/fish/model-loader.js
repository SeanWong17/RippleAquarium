import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { fishConfig } from "./config.js";

const fishModelUrl = new URL("./cartoon.glb", import.meta.url);
const tmpBox = new THREE.Box3();
const tmpCenter = new THREE.Vector3();
const tmpSize = new THREE.Vector3();

const rawModelToFishAxes = new THREE.Matrix4().set(
  0,
  -1,
  0,
  0,
  -1,
  0,
  0,
  0,
  0,
  0,
  -1,
  0,
  0,
  0,
  0,
  1,
);

let fishModel = createFallbackFishModel();
let fishModelLoadPromise = null;

export async function loadFishModel() {
  if (fishModelLoadPromise) {
    return fishModelLoadPromise;
  }

  fishModelLoadPromise = new GLTFLoader()
    .loadAsync(fishModelUrl.href)
    .then((gltf) => {
      fishModel = createFishModelFromGltf(gltf);
      return fishModel;
    })
    .catch((error) => {
      console.warn("Failed to load fish model; using fallback fish geometry.", error);
      return fishModel;
    });

  return fishModelLoadPromise;
}

export function createFishModelInstance() {
  return {
    geometry: fishModel.geometry.clone(),
    material: cloneFishMaterial(fishModel.material),
  };
}

export function cloneFishMaterial(material) {
  const source = Array.isArray(material) ? material[0] : material;
  const cloned = source?.clone?.() ?? createFallbackFishMaterial();
  if ("roughness" in cloned) {
    cloned.roughness = 1;
  }
  if ("roughnessMap" in cloned) {
    cloned.roughnessMap = null;
  }
  if ("metalness" in cloned) {
    cloned.metalness = 0;
  }
  if ("metalnessMap" in cloned) {
    cloned.metalnessMap = null;
  }
  cloned.side = THREE.FrontSide;
  cloned.needsUpdate = true;
  return cloned;
}

export function disposeFishMaterial(material) {
  if (!material) return;

  material.gradientMap?.dispose();
  material.dispose();
}

function createFishModelFromGltf(gltf) {
  const sourceMesh = findPrimaryMesh(gltf.scene);
  if (!sourceMesh) {
    throw new Error("Fish model does not contain a mesh.");
  }

  return {
    geometry: createFishGeometry(sourceMesh.geometry),
    material: cloneFishMaterial(sourceMesh.material),
  };
}

function findPrimaryMesh(root) {
  let result = null;
  let resultDistanceSq = Infinity;
  const worldPosition = new THREE.Vector3();

  root.traverse((object) => {
    if (!object.isMesh || !object.geometry) {
      return;
    }

    object.getWorldPosition(worldPosition);
    const distanceSq = worldPosition.lengthSq();
    if (!result || distanceSq < resultDistanceSq) {
      result = object;
      resultDistanceSq = distanceSq;
    }
  });
  return result;
}

function createFishGeometry(sourceGeometry) {
  const geometry = sourceGeometry.clone();

  // Blender-exported fish meshes are long on raw X, head toward -X, belly toward +Z.
  geometry.applyMatrix4(rawModelToFishAxes);
  geometry.computeBoundingBox();
  tmpBox.copy(geometry.boundingBox);
  tmpBox.getCenter(tmpCenter);
  tmpBox.getSize(tmpSize);

  const modelLength = Math.max(0.0001, tmpSize.y);
  const scale = fishConfig.length / modelLength;
  geometry.translate(-tmpCenter.x, -tmpCenter.y, -tmpCenter.z);
  geometry.scale(scale, scale, scale);

  if (!geometry.attributes.normal) {
    geometry.computeVertexNormals();
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createFallbackFishModel() {
  return {
    geometry: createFallbackFishGeometry(),
    material: createFallbackFishMaterial(),
  };
}

function createFallbackFishMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0,
    flatShading: false,
    vertexColors: true,
  });
}

function createFallbackFishGeometry() {
  const radialSegments = Math.max(8, Math.floor(fishConfig.radialSegments ?? 18));
  const length = fishConfig.length;
  const radius = fishConfig.radius;
  const rings = [
    { y: length * 0.5, rx: radius * 0.12, rz: radius * 0.1 },
    { y: length * 0.28, rx: radius * 0.78, rz: radius * 0.52 },
    { y: 0, rx: radius, rz: radius * 0.66 },
    { y: -length * 0.26, rx: radius * 0.5, rz: radius * 0.38 },
    { y: -length * 0.39, rx: radius * 0.16, rz: radius * 0.12 },
  ];
  const positions = [];
  const indices = [];

  for (const ring of rings) {
    for (let i = 0; i < radialSegments; i += 1) {
      const angle = (i / radialSegments) * Math.PI * 2;
      positions.push(
        Math.cos(angle) * ring.rx,
        ring.y,
        Math.sin(angle) * ring.rz,
      );
    }
  }

  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const current = ringIndex * radialSegments;
    const next = current + radialSegments;
    for (let i = 0; i < radialSegments; i += 1) {
      const j = (i + 1) % radialSegments;
      indices.push(current + i, next + i, current + j);
      indices.push(next + i, next + j, current + j);
    }
  }

  const headCenter = positions.length / 3;
  positions.push(0, rings[0].y, 0);
  for (let i = 0; i < radialSegments; i += 1) {
    indices.push(headCenter, (i + 1) % radialSegments, i);
  }

  const tailCenter = positions.length / 3;
  const tailRing = (rings.length - 1) * radialSegments;
  positions.push(0, rings[rings.length - 1].y, 0);
  for (let i = 0; i < radialSegments; i += 1) {
    indices.push(tailCenter, tailRing + i, tailRing + ((i + 1) % radialSegments));
  }

  const tailTipY = -length * 0.5;
  const tailHalfWidth = radius * 0.76;
  const tailHalfHeight = radius * 1.12;
  const tailTop = positions.length / 3;
  positions.push(0, tailTipY, tailHalfHeight);
  const tailRight = positions.length / 3;
  positions.push(tailHalfWidth, tailTipY, 0);
  const tailBottom = positions.length / 3;
  positions.push(0, tailTipY, -tailHalfHeight);
  const tailLeft = positions.length / 3;
  positions.push(-tailHalfWidth, tailTipY, 0);
  indices.push(tailCenter, tailTop, tailRight);
  indices.push(tailCenter, tailRight, tailBottom);
  indices.push(tailCenter, tailBottom, tailLeft);
  indices.push(tailCenter, tailLeft, tailTop);

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const vertexColors = new Float32Array(geometry.attributes.position.count * 3).fill(1);
  geometry.setAttribute("color", new THREE.BufferAttribute(vertexColors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
