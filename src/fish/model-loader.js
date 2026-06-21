import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { fishConfig } from "./config.js";

const fishModelSources = [
  {
    key: "cartoon",
    url: new URL("./cartoon.glb", import.meta.url),
    useAppearanceVariants: false,
    axes: new THREE.Matrix4().set(
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
    ),
  },
  {
    key: "clown",
    url: new URL("./models/clownFish.glb", import.meta.url),
    useAppearanceVariants: false,
    bakeWorldMatrix: true,
    axes: new THREE.Matrix4().set(
      1,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      0,
      1,
    ),
  },
];
const tmpBox = new THREE.Box3();
const tmpCenter = new THREE.Vector3();
const tmpSize = new THREE.Vector3();

let fishModels = [createFallbackFishModel()];
let fishModelLoadPromise = null;

export async function loadFishModel() {
  if (fishModelLoadPromise) {
    return fishModelLoadPromise;
  }

  const loader = new GLTFLoader();
  fishModelLoadPromise = Promise.allSettled(
    fishModelSources.map((source) => loader.loadAsync(source.url.href)),
  )
    .then((results) => {
      const loaded = [];
      for (let i = 0; i < results.length; i += 1) {
        const source = fishModelSources[i];
        const result = results[i];
        if (result.status === "fulfilled") {
          loaded.push(createFishModelFromGltf(result.value, source));
        } else {
          console.warn(`Failed to load ${source.key} fish model.`, result.reason);
        }
      }
      fishModels = loaded.length ? loaded : fishModels;
      return fishModels;
    });

  return fishModelLoadPromise;
}

export function createFishModelInstance(variantIndex = 0) {
  const fishModel = fishModels[variantIndex % fishModels.length] ?? fishModels[0];
  return createFishModelInstanceFromModel(fishModel);
}

export function createFishModelInstanceByKey(key) {
  const fishModel = fishModels.find((model) => model.key === key) ?? fishModels[0];
  return createFishModelInstanceFromModel(fishModel);
}

function createFishModelInstanceFromModel(fishModel) {
  return {
    geometry: fishModel.geometry.clone(),
    material: cloneFishMaterial(fishModel.material, {
      appearanceVariants: fishModel.useAppearanceVariants,
    }),
    useAppearanceVariants: fishModel.useAppearanceVariants,
  };
}

export function cloneFishMaterial(material, options = {}) {
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
  if (options.appearanceVariants) {
    enableFishAppearanceVariants(cloned);
  }
  cloned.needsUpdate = true;
  return cloned;
}

export function disposeFishMaterial(material) {
  if (!material) return;

  material.gradientMap?.dispose();
  material.dispose();
}

function enableFishAppearanceVariants(material) {
  const previousOnBeforeCompile = material.onBeforeCompile;

  material.onBeforeCompile = (shader, renderer) => {
    previousOnBeforeCompile?.(shader, renderer);
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
varying vec3 vFishLocalPosition;`,
    ).replace(
      "#include <uv_vertex>",
      `#include <uv_vertex>
vFishLocalPosition = position;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
varying vec3 vFishLocalPosition;

vec3 readFishAppearanceColor(vec3 baseColor, vec3 localPosition) {
  float variant = 0.0;
  if (baseColor.r > 0.9 && baseColor.g < 0.72) variant = 1.0;
  else if (baseColor.r > 0.85 && baseColor.g > 0.78 && baseColor.b < 0.72) variant = 2.0;
  else if (baseColor.r < 0.7 && baseColor.g < 0.78 && baseColor.b < 0.82) variant = 3.0;

  if (variant < 0.5) {
    float dorsal = smoothstep(-0.15, 0.35, localPosition.z);
    return mix(baseColor * 0.78, baseColor, dorsal);
  }

  if (variant < 1.5) {
    vec3 orange = vec3(1.0, 0.37, 0.08);
    vec3 white = vec3(1.0, 0.96, 0.86);
    vec3 black = vec3(0.025, 0.025, 0.025);
    float stripeA = 1.0 - smoothstep(0.08, 0.16, abs(localPosition.y - 0.38));
    float stripeB = 1.0 - smoothstep(0.08, 0.16, abs(localPosition.y + 0.10));
    float stripeC = 1.0 - smoothstep(0.06, 0.14, abs(localPosition.y + 0.46));
    float stripe = max(max(stripeA, stripeB), stripeC);
    float edge = max(
      1.0 - smoothstep(0.14, 0.19, abs(localPosition.y - 0.38)),
      max(
        1.0 - smoothstep(0.14, 0.19, abs(localPosition.y + 0.10)),
        1.0 - smoothstep(0.12, 0.17, abs(localPosition.y + 0.46))
      )
    );
    vec3 color = mix(orange, white, stripe);
    return mix(color, black, clamp(edge - stripe, 0.0, 1.0));
  }

  if (variant < 2.5) {
    vec3 white = vec3(1.0, 0.94, 0.82);
    vec3 red = vec3(0.9, 0.13, 0.08);
    float spotA = smoothstep(0.30, 0.0, length(localPosition.xy - vec2(0.05, 0.25)));
    float spotB = smoothstep(0.28, 0.0, length(localPosition.xy - vec2(-0.08, -0.12)));
    float spotC = smoothstep(0.22, 0.0, length(localPosition.xy - vec2(0.10, -0.42)));
    return mix(white, red, clamp(max(max(spotA, spotB), spotC), 0.0, 1.0));
  }

  vec3 belly = vec3(0.74, 0.84, 0.87);
  vec3 back = vec3(0.18, 0.28, 0.32);
  float dorsal = smoothstep(-0.35, 0.42, localPosition.z);
  float sideLine = 1.0 - smoothstep(0.025, 0.065, abs(localPosition.z + 0.02));
  return mix(mix(belly, back, dorsal), vec3(0.9, 0.98, 1.0), sideLine * 0.28);
}`,
    ).replace(
      "#include <color_fragment>",
      `#include <color_fragment>
#ifdef USE_INSTANCING_COLOR
  diffuseColor.rgb = readFishAppearanceColor(diffuseColor.rgb, vFishLocalPosition);
#endif`,
    );
  };
}

function createFishModelFromGltf(gltf, source) {
  gltf.scene.updateWorldMatrix(true, true);
  const sourceMesh = findPrimaryMesh(gltf.scene);
  if (!sourceMesh) {
    throw new Error("Fish model does not contain a mesh.");
  }

  return {
    key: source.key,
    geometry: createFishGeometry(sourceMesh, source),
    material: cloneFishMaterial(sourceMesh.material),
    useAppearanceVariants: source.useAppearanceVariants,
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

function createFishGeometry(sourceMesh, source) {
  const geometry = sourceMesh.geometry.clone();

  if (source.bakeWorldMatrix) {
    sourceMesh.updateWorldMatrix(true, false);
    geometry.applyMatrix4(sourceMesh.matrixWorld);
  }

  geometry.applyMatrix4(source.axes);
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
