import * as THREE from "three";
import { floorY, worldSize } from "./config.js";

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
  scene.fog = new THREE.Fog(0x081016, 18, 42);
  return scene;
}

export function addLighting(scene) {
  const hemiLight = new THREE.HemisphereLight(0x9fd8ff, 0x1b3024, 2.6);
  scene.add(hemiLight);

  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(8, 12, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);
}

export function addWorldBounds(scene) {
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x9bdcff,
    roughness: 0.02,
    metalness: 0,
    transmission: 0.65,
    thickness: 0.55,
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    depthWrite: false,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });

  const bounds = new THREE.Mesh(
    new THREE.BoxGeometry(worldSize.x, worldSize.y, worldSize.z),
    glassMaterial,
  );
  scene.add(bounds);

  const boundsEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(bounds.geometry),
    new THREE.LineBasicMaterial({
      color: 0xc6efff,
      transparent: true,
      opacity: 0.42,
    }),
  );
  scene.add(boundsEdges);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(worldSize.x, worldSize.z),
    new THREE.MeshStandardMaterial({
      color: 0x17222a,
      roughness: 0.9,
      metalness: 0,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY - 0.03;
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
}

export function addObstacles(scene, obstacles) {
  const obstacleMaterial = new THREE.MeshStandardMaterial({
    color: 0xb8584c,
    roughness: 0.52,
    metalness: 0.08,
    transparent: true,
    opacity: 0.82,
  });

  for (const obstacle of obstacles) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(obstacle.radius, 32, 18),
      obstacleMaterial,
    );
    mesh.position.copy(obstacle.position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}
