import * as THREE from "three";

export const aquariumHalfSize = new THREE.Vector3(11, 6.6, 8.5);
export const aquariumSize = aquariumHalfSize.clone().multiplyScalar(2);
export const aquariumFloorY = -aquariumHalfSize.y;
export const waterLevelY = aquariumHalfSize.y - 0.72;

export const fishConfig = {
  radius: 0.6,
  length: 1.6,
  renderScale: 1,
  radialSegments: 36,
  heightSegments: 3,
  highlightedIndex: 0,
  bodyColor: new THREE.Color(0xf2f6ff),
  highlightedColor: new THREE.Color(0xf2f6ff),
  renderBoundsRadius: 18,
  swimFrequencyMin: 0.9,
  swimFrequencyMax: 2.1,
  swimTailBeatMinIntervalSeconds: 0.65,
  maxBankAngle: THREE.MathUtils.degToRad(12),
  bankTurnScale: 0.18,
  bankResponse: 8,
  curveDeformationStrength: 0.72,
  curveDeformationMax: 2.35,
  curveDeformationResponse: 12,
  swimCurveStrength: 0.92,
  swimAccelerationThreshold: 0.35,
  swimAccelerationFull: 2.4,
  swimAccelerationPulseSeconds: 0.32,
  swimTurnCurveStart: 0.08,
};

export const coneConfig = {
  count: 0,
  radius: 0.3,
  length: 0.8,
  renderScale: 1,
  radialSegments: 36,
  heightSegments: 3,
  bodyColor: new THREE.Color(0xf2f6ff),
  outlineColor: new THREE.Color(0x101010),
  outlineScale: 1.09,
  renderBoundsRadius: 18,
};

export const simulationSettings = {
  minSpeed: 3,
  maxSpeed: 7.5,
  maxTurnRate: 4,
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
  topBoundaryMargin: 0.42,
  bottomBoundaryMargin: 2,
  horizontalBoundaryMargin: 2,
};

export const obstacles = [
  {
    position: new THREE.Vector3(-5.6, 1.4, -3.7),
    radius: 1.45,
    shape: "box",
    size: new THREE.Vector3(2.3, 2.3, 2.3),
  },
  {
    position: new THREE.Vector3(3.4, -1.8, 3.8),
    radius: 1.75,
    shape: "plate",
    size: new THREE.Vector3(0.24, 2.8, 3.4),
    rotationY: THREE.MathUtils.degToRad(-24),
  },
  { position: new THREE.Vector3(1.2, 2.6, -1.1), radius: 1.65 },
];
