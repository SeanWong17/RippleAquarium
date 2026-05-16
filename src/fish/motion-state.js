import * as THREE from "three";
import { fishConfig } from "./config.js";

const TWO_PI = Math.PI * 2;
const SWIM_PHASE_STEP = Math.PI * (3 - Math.sqrt(5));
const worldUp = new THREE.Vector3(0, 1, 0);

const defaultScratch = createFishMotionScratch();

export function createFishMotionScratch() {
  return {
    previousDirection: new THREE.Vector3(),
    nextDirection: new THREE.Vector3(),
    turnAxis: new THREE.Vector3(),
    targetCurve: new THREE.Vector3(),
    zeroCurve: new THREE.Vector3(),
  };
}

export function createFishMotionState(index = 0) {
  return {
    swimPhase: readInitialSwimPhase(index),
    swimDrive: 0,
    swimAccelerationTime: 0,
    swimAccelerationArmed: true,
    bank: 0,
    curveBendWorld: new THREE.Vector3(),
  };
}

export function updateFishMotionState(
  fish,
  nextVelocity,
  dt,
  scratch = defaultScratch,
) {
  if (!fish || !nextVelocity || dt <= 0) {
    return;
  }

  const currentSpeed = fish.velocity.length();
  const speed = nextVelocity.length();
  const previousDirection = scratch.previousDirection.copy(fish.velocity);
  const nextDirection = scratch.nextDirection.copy(nextVelocity);

  if (
    previousDirection.lengthSq() <= 0.000001
    || nextDirection.lengthSq() <= 0.000001
  ) {
    fish.bank = dampAngle(fish.bank ?? 0, 0, fishConfig.bankResponse, dt);
    dampCurveBend(fish, null, dt, scratch);
    updateSwimPhase(fish, currentSpeed, speed, dt);
    return;
  }

  previousDirection.normalize();
  nextDirection.normalize();
  updateCurveBend(fish, previousDirection, nextDirection, speed, dt, scratch);
  updateSwimPhase(fish, currentSpeed, speed, dt);

  const turnAngle = previousDirection.angleTo(nextDirection);
  const turnAxis = scratch.turnAxis.crossVectors(previousDirection, nextDirection);
  const turnSign = turnAxis.dot(worldUp);
  const turnRate = turnAngle / dt;
  const targetBank = THREE.MathUtils.clamp(
    -turnSign * turnRate * fishConfig.bankTurnScale,
    -fishConfig.maxBankAngle,
    fishConfig.maxBankAngle,
  );

  fish.bank = dampAngle(
    fish.bank ?? 0,
    targetBank,
    fishConfig.bankResponse,
    dt,
  );
}

function updateSwimPhase(fish, currentSpeed, nextSpeed, dt) {
  const accelerationDrive = updateAccelerationSwimDrive(
    fish,
    currentSpeed,
    nextSpeed,
    dt,
  );
  const turnDrive = readTurnSwimDrive(fish.curveBendWorld);
  const swimDrive = Math.max(accelerationDrive, turnDrive);
  const swimFrequency = readSwimFrequency(swimDrive);

  fish.swimDrive = swimDrive;
  fish.swimPhase = ((fish.swimPhase ?? 0) + swimFrequency * TWO_PI * dt) % TWO_PI;
}

function readSwimFrequency(swimDrive) {
  const frequency = THREE.MathUtils.lerp(
    fishConfig.swimFrequencyMin,
    fishConfig.swimFrequencyMax,
    swimDrive,
  );
  const minInterval = fishConfig.swimTailBeatMinIntervalSeconds ?? 0;
  if (minInterval <= 0) {
    return frequency;
  }

  return Math.min(frequency, 1 / minInterval);
}

function updateAccelerationSwimDrive(fish, currentSpeed, nextSpeed, dt) {
  const acceleration = (nextSpeed - currentSpeed) / Math.max(0.0001, dt);
  const triggerDrive = THREE.MathUtils.smoothstep(
    acceleration,
    fishConfig.swimAccelerationThreshold,
    fishConfig.swimAccelerationFull,
  );
  const duration = Math.max(0.0001, fishConfig.swimAccelerationPulseSeconds);

  fish.swimAccelerationTime = Math.max(
    0,
    (fish.swimAccelerationTime ?? 0) - dt,
  );
  if (acceleration <= 0) {
    fish.swimAccelerationArmed = true;
  } else if (triggerDrive > 0 && fish.swimAccelerationArmed !== false) {
    fish.swimAccelerationTime = duration;
    fish.swimAccelerationArmed = false;
  }

  return THREE.MathUtils.clamp(fish.swimAccelerationTime / duration, 0, 1);
}

function updateCurveBend(
  fish,
  previousDirection,
  nextDirection,
  speed,
  dt,
  scratch,
) {
  const travelDistance = Math.max(0.0001, speed * dt);
  const targetCurve = scratch.targetCurve.copy(nextDirection).sub(previousDirection);
  targetCurve
    .addScaledVector(nextDirection, -targetCurve.dot(nextDirection))
    .multiplyScalar(fishConfig.curveDeformationStrength / travelDistance)
    .clampLength(0, fishConfig.curveDeformationMax);

  dampCurveBend(fish, targetCurve, dt, scratch);
}

function dampCurveBend(fish, targetCurve, dt, scratch) {
  if (!fish.curveBendWorld) {
    fish.curveBendWorld = new THREE.Vector3();
  }

  const target = targetCurve ?? scratch.zeroCurve.set(0, 0, 0);
  const alpha = readDampingAlpha(fishConfig.curveDeformationResponse, dt);
  fish.curveBendWorld.lerp(target, alpha);
}

function readInitialSwimPhase(index) {
  return (Math.max(0, index) * SWIM_PHASE_STEP) % TWO_PI;
}

function dampAngle(current, target, response, dt) {
  return THREE.MathUtils.lerp(current, target, readDampingAlpha(response, dt));
}

function readDampingAlpha(response, dt) {
  return 1 - Math.exp(-Math.max(0, response) * dt);
}

function readTurnSwimDrive(curveBendWorld) {
  if (!curveBendWorld || curveBendWorld.lengthSq() <= 0.000001) {
    return 0;
  }

  const normalizedCurve = THREE.MathUtils.clamp(
    curveBendWorld.length() / Math.max(0.0001, fishConfig.curveDeformationMax),
    0,
    1,
  );

  return normalizedCurve >= fishConfig.swimTurnCurveStart ? 1 : 0;
}
