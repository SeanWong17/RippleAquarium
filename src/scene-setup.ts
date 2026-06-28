import * as THREE from "three";
import { aquariumFloorY, aquariumSize, waterLevelY } from "./config.js";
import { createWaterSurface } from "./water-surface.js";

export function createRenderer(canvas) {
  if (!canvas) {
    throw new Error("A canvas element is required to create the renderer.");
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x081016);
  return scene;
}

export function addLighting(scene) {
  const hemiBaseIntensity = 2.6;
  const sunBaseIntensity = 2.2;
  const hemiLight = new THREE.HemisphereLight(
    0x9fd8ff,
    0x1b3024,
    hemiBaseIntensity,
  );
  scene.add(hemiLight);

  const sun = new THREE.DirectionalLight(0xffffff, sunBaseIntensity);
  sun.position.set(0.8, 15, 0.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 42;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);

  return {
    setIntensity(multiplier) {
      hemiLight.intensity = hemiBaseIntensity * multiplier;
      sun.intensity = sunBaseIntensity * multiplier;
    },
  };
}

export function addAquarium(scene, renderer) {
  const effects = [];

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x9bdcff,
    roughness: 0.02,
    metalness: 0,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
    forceSinglePass: true,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });

  const aquariumGlass = new THREE.Mesh(
    new THREE.BoxGeometry(aquariumSize.x, aquariumSize.y, aquariumSize.z),
    glassMaterial,
  );
  scene.add(aquariumGlass);

  const aquariumEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(aquariumGlass.geometry),
    new THREE.LineBasicMaterial({
      color: 0xc6efff,
      transparent: true,
      opacity: 0.42,
    }),
  );
  scene.add(aquariumEdges);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(aquariumSize.x, aquariumSize.z),
    new THREE.MeshStandardMaterial({
      color: 0x17222a,
      roughness: 0.9,
      metalness: 0,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = aquariumFloorY - 0.008;
  floor.receiveShadow = true;
  scene.add(floor);

  const floorEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(floor.geometry),
    new THREE.LineBasicMaterial({
      color: 0x78b6c7,
      transparent: true,
      opacity: 0.5,
    }),
  );
  floorEdges.rotation.copy(floor.rotation);
  floorEdges.position.copy(floor.position);
  scene.add(floorEdges);

  const waterSurface = createWaterSurface(renderer);
  scene.add(waterSurface.mesh);
  effects.push(waterSurface);
  effects.push(addBubbleColumns(scene));

  return {
    waterSurface,
    update(time) {
      for (const effect of effects) {
        effect.update?.(time);
      }
    },
  };
}

export function addObstacles(scene, obstacles) {
  const obstacleMaterial = new THREE.MeshStandardMaterial({
    color: 0xb8584c,
    roughness: 0.52,
    metalness: 0.08,
  });

  for (const obstacle of obstacles) {
    if (obstacle.render === false) continue;

    const mesh = new THREE.Mesh(createObstacleGeometry(obstacle), obstacleMaterial);
    mesh.position.copy(obstacle.position);
    if (obstacle.rotationY) {
      mesh.rotation.y = obstacle.rotationY;
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}

function createObstacleGeometry(obstacle) {
  if (obstacle.shape === "box" || obstacle.shape === "plate") {
    return new THREE.BoxGeometry(obstacle.size.x, obstacle.size.y, obstacle.size.z);
  }

  return new THREE.SphereGeometry(obstacle.radius, 32, 18);
}

function addBubbleColumns(scene) {
  const count = 84;
  const geometry = new THREE.SphereGeometry(0.035, 8, 6);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xd8fbff,
    roughness: 0.08,
    metalness: 0,
    transmission: 0.2,
    transparent: true,
    opacity: 0.54,
    depthWrite: false,
  });
  const bubbles = new THREE.InstancedMesh(geometry, material, count);
  bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(bubbles);

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const starts = [];

  for (let i = 0; i < count; i += 1) {
    const column = i % 3;
    const ring = Math.floor(i / 3);
    const baseX = [-8.4, 0.2, 7.8][column];
    const baseZ = [-5.8, 6.3, -4.7][column];
    starts.push({
      x: baseX + Math.sin(ring * 1.7) * 0.42,
      z: baseZ + Math.cos(ring * 1.31) * 0.36,
      phase: (i * 0.137) % 1,
      size: 0.58 + ((i * 37) % 29) / 50,
      speed: 0.045 + ((i * 17) % 13) * 0.003,
    });
  }

  function update(time) {
    const height = waterLevelY - aquariumFloorY - 0.45;

    for (let i = 0; i < count; i += 1) {
      const bubble = starts[i];
      const t = (bubble.phase + time * bubble.speed) % 1;
      position.set(
        bubble.x + Math.sin(time * 1.2 + i) * 0.08,
        aquariumFloorY + 0.24 + t * height,
        bubble.z + Math.cos(time * 1.45 + i * 0.7) * 0.08,
      );
      const s = bubble.size * (0.55 + t * 0.55);
      scale.setScalar(s);
      matrix.compose(position, quaternion, scale);
      bubbles.setMatrixAt(i, matrix);
    }

    bubbles.instanceMatrix.needsUpdate = true;
  }

  update(0);

  return { update };
}
