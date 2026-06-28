import * as THREE from "three";
import type { ExclusionZone, FishConfig, Obstacle, SimulationSettings } from "./types.js";

export const aquariumHalfSize = new THREE.Vector3(11, 6.6, 8.5);
export const aquariumSize = aquariumHalfSize.clone().multiplyScalar(2);
export const aquariumFloorY = -aquariumHalfSize.y;
export const waterLevelY = aquariumHalfSize.y - 0.72;

export const pineappleHouseDecor = {
  position: new THREE.Vector3(-4.65, aquariumFloorY, 2.75),
  rotationY: THREE.MathUtils.degToRad(16),
  bodyHeight: 4.28,
  height: 6.08,
  bodyRadius: 1.74,
  footprintRadius: 3.53,
};

export const spongebobPatrickDecor = {
  position: pineappleHouseDecor.position
    .clone()
    .add(new THREE.Vector3(1.48, 0, 4.2))
    .setY(aquariumFloorY),
  height: 2.35,
  footprintRadius: 1.65,
  rotationY: THREE.MathUtils.degToRad(-9),
};

export const frontDecorCoralMask = {
  position: pineappleHouseDecor.position.clone().add(new THREE.Vector3(0.8, 0, 4.35)),
  size: new THREE.Vector2(5.5, 3.75),
};

export const fishConfig = {
  radius: 0.6,
  length: 1.6,
  renderScale: 1,
  radialSegments: 36,
  heightSegments: 3,
  highlightedIndex: 0,
  bodyColor: new THREE.Color(0xf2f6ff),
  highlightedColor: new THREE.Color(0xf2f6ff),
  // 备用纯色变体(当前模型 useAppearanceVariants=false,暂未启用)。
  // 这些是平涂底色,并非条纹/斑纹贴图。
  appearanceVariants: [
    new THREE.Color(0xf2f6ff), // 浅冷白
    new THREE.Color(0xff8a2a), // 暖橙
    new THREE.Color(0xf7efe2), // 米白
    new THREE.Color(0x8fa4ad), // 灰蓝
  ],
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
} satisfies FishConfig;

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
} satisfies SimulationSettings;

export const obstacles = [
  {
    position: pineappleHouseDecor.position
      .clone()
      .setY(aquariumFloorY + pineappleHouseDecor.height * 0.42),
    radius: pineappleHouseDecor.footprintRadius,
    shape: "box",
    size: new THREE.Vector3(4.35, 5.1, 4.05),
    rotationY: pineappleHouseDecor.rotationY,
    render: false,
  },
] satisfies Obstacle[];

export const coralExclusionZones = [
  {
    position: pineappleHouseDecor.position,
    radius: pineappleHouseDecor.footprintRadius,
  },
  {
    position: frontDecorCoralMask.position,
    shape: "box",
    size: frontDecorCoralMask.size,
  },
] satisfies ExclusionZone[];

export const clownfishAvoidanceZones = [
  {
    position: pineappleHouseDecor.position,
    radius: pineappleHouseDecor.footprintRadius + 0.55,
    strength: 2.2,
  },
  {
    position: spongebobPatrickDecor.position,
    radius: spongebobPatrickDecor.footprintRadius + 0.45,
    strength: 2.8,
  },
  {
    position: frontDecorCoralMask.position,
    shape: "box",
    size: frontDecorCoralMask.size.clone().add(new THREE.Vector2(0.7, 0.65)),
    strength: 2.5,
  },
] satisfies ExclusionZone[];
