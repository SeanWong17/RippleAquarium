import * as THREE from "three";

export const aquariumHalfSize = new THREE.Vector3(11, 6.6, 8.5);
export const aquariumSize = aquariumHalfSize.clone().multiplyScalar(2);
export const aquariumFloorY = -aquariumHalfSize.y;
export const waterLevelY = aquariumHalfSize.y - 0.72;

export const fishConfig = {
  radius: 0.13,
  length: 0.58,
  radialSegments: 14,
  highlightedIndex: 0,
  bodyColor: new THREE.Color(0x7c6dff),
  highlightedColor: new THREE.Color(0xfff000),
};

export const simulationSettings = {
  minSpeed: 2,
  maxSpeed: 5,
  maxTurnRate: 1,
  perceptionRadius: 2.7,
  avoidanceRadius: 1,
  maxSteerForce: 3,
  alignWeight: 1,
  cohesionWeight: 1,
  separateWeight: 1.35,
  boundsRadius: 0.27,
  avoidCollisionWeight: 10,
  collisionAvoidDistance: 5,
  boundaryWeight: 9,
  boundaryMargin: 2,
};

export const obstacles = [
  { position: new THREE.Vector3(-4.2, -0.4, -2.4), radius: 1.25 },
  {
    position: new THREE.Vector3(3.8, 1.2, -1.2),
    radius: 1.45,
    shape: "box",
    size: new THREE.Vector3(2.3, 2.3, 2.3),
  },
  {
    position: new THREE.Vector3(-1.1, 2.2, 3.3),
    radius: 1.75,
    shape: "plate",
    size: new THREE.Vector3(0.24, 2.8, 3.4),
  },
  { position: new THREE.Vector3(2.1, -2.7, 3.1), radius: 1.25 },
  { position: new THREE.Vector3(0, 0, 0), radius: 1.65 },
];
