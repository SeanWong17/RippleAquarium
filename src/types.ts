import type * as THREE from "three";

export interface SimulationSettings {
  minSpeed: number;
  maxSpeed: number;
  maxTurnRate: number;
  perceptionRadius: number;
  avoidanceRadius: number;
  maxSteerForce: number;
  alignWeight: number;
  cohesionWeight: number;
  separateWeight: number;
  boundsRadius: number;
  avoidCollisionWeight: number;
  collisionAvoidDistance: number;
  boundaryWeight: number;
  boundaryMargin: number;
  topBoundaryMargin: number;
  bottomBoundaryMargin: number;
  horizontalBoundaryMargin: number;
}

export interface BoxObstacle {
  position: THREE.Vector3;
  shape: "box" | "plate";
  size: THREE.Vector3;
  radius?: number;
  rotationY?: number;
  render?: boolean;
}

export interface SphereObstacle {
  position: THREE.Vector3;
  radius: number;
  shape?: "sphere";
  strength?: number;
  render?: boolean;
}

export type Obstacle = BoxObstacle | SphereObstacle;

export interface BoxExclusionZone {
  position: THREE.Vector3;
  shape: "box";
  size: THREE.Vector2;
  strength?: number;
}

export type ExclusionZone = SphereObstacle | BoxExclusionZone;

export interface FishMotionState {
  swimPhase: number;
  swimDrive: number;
  swimAccelerationTime: number;
  swimAccelerationArmed: boolean;
  bank: number;
  curveBendWorld: THREE.Vector3;
  introDropDirection?: THREE.Vector3;
}

export interface FishState extends FishMotionState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
}

export interface FishMotionScratch {
  previousDirection: THREE.Vector3;
  nextDirection: THREE.Vector3;
  turnAxis: THREE.Vector3;
  targetCurve: THREE.Vector3;
  zeroCurve: THREE.Vector3;
}

export interface FishConfig {
  radius: number;
  length: number;
  renderScale: number;
  radialSegments: number;
  heightSegments: number;
  highlightedIndex: number;
  bodyColor: THREE.Color;
  highlightedColor: THREE.Color;
  appearanceVariants: THREE.Color[];
  renderBoundsRadius: number;
  swimFrequencyMin: number;
  swimFrequencyMax: number;
  swimTailBeatMinIntervalSeconds: number;
  maxBankAngle: number;
  bankTurnScale: number;
  bankResponse: number;
  curveDeformationStrength: number;
  curveDeformationMax: number;
  curveDeformationResponse: number;
  swimCurveStrength: number;
  swimAccelerationThreshold: number;
  swimAccelerationFull: number;
  swimAccelerationPulseSeconds: number;
  swimTurnCurveStart: number;
}

export interface FishModelInstance {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  renderScale: number;
  useAppearanceVariants: boolean;
}

export type RandomSource = () => number;

export interface FishTraceComponents {
  align: THREE.Vector3;
  cohesion: THREE.Vector3;
  separation: THREE.Vector3;
  obstacle: THREE.Vector3;
  boundary: THREE.Vector3;
}

export interface FishSimulationTrace {
  components: FishTraceComponents;
  neighborCount: number;
  collisionAvoidanceActive: boolean;
  boundaryAvoidanceActive: boolean;
  previousVelocity: THREE.Vector3;
  nextVelocity: THREE.Vector3;
}
