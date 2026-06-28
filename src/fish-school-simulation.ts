import * as THREE from "three";
import {
  createFishMotionScratch,
  createFishMotionState,
  updateFishMotionState,
} from "./fish/motion-state.js";
import { SpatialGrid } from "./fish/spatial-grid.js";
import {
  createRayDirections,
  mulberry32,
  randomPointInAquarium,
  randomPointInSphere,
} from "./random.js";
import type {
  FishMotionScratch,
  FishSimulationTrace,
  FishState,
  Obstacle,
  RandomSource,
  SimulationSettings,
} from "./types.js";

interface FishSchoolSimulationOptions {
  aquariumHalfSize: THREE.Vector3;
  obstacles: Obstacle[];
  settings: SimulationSettings;
}

interface UpdateOptions {
  traceIndex?: number;
}

export class FishSchoolSimulation {
  aquariumHalfSize: THREE.Vector3;
  obstacles: Obstacle[];
  settings: SimulationSettings;
  fish: FishState[];
  random: RandomSource;
  rayDirections: THREE.Vector3[];
  fishMotionScratch: FishMotionScratch;
  grid: SpatialGrid<FishState>;
  nextVelocities: THREE.Vector3[];
  nextPositions: THREE.Vector3[];
  tmpOffset: THREE.Vector3;
  tmpNeighborDir: THREE.Vector3;
  tmpAvoid: THREE.Vector3;
  tmpForward: THREE.Vector3;
  tmpDesired: THREE.Vector3;
  accel: THREE.Vector3;
  headingSum: THREE.Vector3;
  centerSum: THREE.Vector3;
  avoidanceSum: THREE.Vector3;
  steerOut: THREE.Vector3;
  boundaryOut: THREE.Vector3;
  clearDirOut: THREE.Vector3;
  tmpRayDir: THREE.Vector3;
  tmpRayEnd: THREE.Vector3;
  tmpRayLocalOrigin: THREE.Vector3;
  tmpRayLocalDir: THREE.Vector3;
  tmpTurnCurrent: THREE.Vector3;
  tmpTurnDesired: THREE.Vector3;
  tmpQuat: THREE.Quaternion;
  forwardAxis: THREE.Vector3;

  constructor({ aquariumHalfSize, obstacles, settings }: FishSchoolSimulationOptions) {
    this.aquariumHalfSize = aquariumHalfSize;
    this.obstacles = obstacles;
    this.settings = settings;
    this.fish = [];
    this.random = mulberry32(42);
    this.rayDirections = createRayDirections(300);
    this.fishMotionScratch = createFishMotionScratch();
    this.grid = new SpatialGrid(settings.perceptionRadius);

    // Pooled per-fish results, grown on demand (see ensureBuffers).
    this.nextVelocities = [];
    this.nextPositions = [];

    // Scratch reused inside update(). Named by role so overlapping lifetimes
    // are obvious and never alias across helper calls.
    this.tmpOffset = new THREE.Vector3();
    this.tmpNeighborDir = new THREE.Vector3();
    this.tmpAvoid = new THREE.Vector3();
    this.tmpForward = new THREE.Vector3();
    this.tmpDesired = new THREE.Vector3();
    this.accel = new THREE.Vector3();
    this.headingSum = new THREE.Vector3();
    this.centerSum = new THREE.Vector3();
    this.avoidanceSum = new THREE.Vector3();
    this.steerOut = new THREE.Vector3();
    this.boundaryOut = new THREE.Vector3();
    this.clearDirOut = new THREE.Vector3();

    // Scratch reserved for ray/collision helpers (no overlap with the flock
    // accumulators above, which stay live across these calls).
    this.tmpRayDir = new THREE.Vector3();
    this.tmpRayEnd = new THREE.Vector3();
    this.tmpRayLocalOrigin = new THREE.Vector3();
    this.tmpRayLocalDir = new THREE.Vector3();
    this.tmpTurnCurrent = new THREE.Vector3();
    this.tmpTurnDesired = new THREE.Vector3();
    this.tmpQuat = new THREE.Quaternion();
    this.forwardAxis = new THREE.Vector3(0, 0, 1);
  }

  reset(count: number, seed = 42): void {
    const targetCount = normalizeFishCount(count, 0);
    this.fish.length = 0;
    this.random = mulberry32(seed);

    for (let i = 0; i < targetCount; i += 1) {
      this.fish.push(this.createFish(i));
    }
  }

  setCount(count: number): void {
    const targetCount = normalizeFishCount(count, this.fish.length);

    if (targetCount < this.fish.length) {
      this.fish.length = targetCount;
      return;
    }

    while (this.fish.length < targetCount) {
      this.fish.push(this.createFish(this.fish.length));
    }
  }

  createFish(index = this.fish.length): FishState {
    const position = randomPointInAquarium(this.random, this.aquariumHalfSize, 0.62);
    const direction = randomPointInSphere(this.random, 1).normalize();
    const speed = THREE.MathUtils.lerp(
      this.settings.minSpeed,
      this.settings.maxSpeed,
      this.random(),
    );

    return {
      position,
      velocity: direction.multiplyScalar(speed),
      ...this.createMotionState(index),
    };
  }

  createMotionState(index = this.fish.length) {
    return createFishMotionState(index);
  }

  ensureBuffers(count: number): void {
    while (this.nextVelocities.length < count) {
      this.nextVelocities.push(new THREE.Vector3());
      this.nextPositions.push(new THREE.Vector3());
    }
  }

  update(dt: number, options: UpdateOptions = {}): FishSimulationTrace | null {
    const count = this.fish.length;
    this.ensureBuffers(count);
    this.grid.setCellSize(this.settings.perceptionRadius);
    this.grid.build(this.fish);

    const nextVelocities = this.nextVelocities;
    const nextPositions = this.nextPositions;
    let trace = null;

    const perceptionSq = this.settings.perceptionRadius * this.settings.perceptionRadius;
    const avoidanceSq = this.settings.avoidanceRadius * this.settings.avoidanceRadius;

    for (let i = 0; i < count; i += 1) {
      const fish = this.fish[i];
      if (!fish) continue;
      const acceleration = this.accel.set(0, 0, 0);
      const components = options.traceIndex === i ? {
        align: new THREE.Vector3(),
        cohesion: new THREE.Vector3(),
        separation: new THREE.Vector3(),
        obstacle: new THREE.Vector3(),
        boundary: new THREE.Vector3(),
      } : null;
      const headingSum = this.headingSum.set(0, 0, 0);
      const centerSum = this.centerSum.set(0, 0, 0);
      const avoidanceSum = this.avoidanceSum.set(0, 0, 0);
      let neighborCount = 0;
      let collisionAvoidanceActive = false;
      let boundaryAvoidanceActive = false;

      const neighbors = this.grid.queryNeighbors(fish.position);
      for (let n = 0; n < neighbors.length; n += 1) {
        const j = neighbors[n];
        if (i === j) continue;
        const other = this.fish[j];
        if (!other) continue;
        const offset = this.tmpOffset.subVectors(other.position, fish.position);
        const distanceSq = offset.lengthSq();

        if (distanceSq < perceptionSq) {
          neighborCount += 1;
          headingSum.add(this.tmpNeighborDir.copy(other.velocity).normalize());
          centerSum.add(other.position);

          if (distanceSq < avoidanceSq) {
            const distance = Math.sqrt(Math.max(distanceSq, 0.0001));
            avoidanceSum.add(this.tmpAvoid.copy(offset).multiplyScalar(-1 / distance));
          }
        }
      }

      if (neighborCount > 0) {
        centerSum.multiplyScalar(1 / neighborCount);
        const align = this.steerTowards(headingSum, fish.velocity, this.steerOut)
          .multiplyScalar(this.settings.alignWeight);
        if (components) components.align.copy(align);
        acceleration.add(align);

        const cohesion = this.steerTowards(
          centerSum.sub(fish.position),
          fish.velocity,
          this.steerOut,
        ).multiplyScalar(this.settings.cohesionWeight);
        if (components) components.cohesion.copy(cohesion);
        acceleration.add(cohesion);

        const separation = this.steerTowards(avoidanceSum, fish.velocity, this.steerOut)
          .multiplyScalar(this.settings.separateWeight);
        if (components) components.separation.copy(separation);
        acceleration.add(separation);
      }

      const forward = this.tmpForward.copy(fish.velocity).normalize();
      if (this.isHeadingForCollision(fish.position, forward)) {
        collisionAvoidanceActive = true;
        const clearDirection = this.obstacleRays(fish.position, forward);
        const obstacle = this.steerTowards(clearDirection, fish.velocity, this.steerOut)
          .multiplyScalar(this.settings.avoidCollisionWeight);
        acceleration.add(obstacle);
        if (components) {
          components.obstacle.copy(obstacle);
        }
      }

      const boundary = this.aquariumBoundarySteer(fish.position);
      if (boundary.lengthSq() > 0) {
        boundaryAvoidanceActive = true;
        const boundaryForce = this.steerTowards(boundary, fish.velocity, this.steerOut)
          .multiplyScalar(this.settings.boundaryWeight);
        acceleration.add(boundaryForce);
        if (components) {
          components.boundary.copy(boundaryForce);
        }
      }

      const desiredVelocity = this.tmpDesired
        .copy(fish.velocity)
        .addScaledVector(acceleration, dt);
      const speed = THREE.MathUtils.clamp(
        desiredVelocity.length(),
        this.settings.minSpeed,
        this.settings.maxSpeed,
      );
      desiredVelocity.normalize().multiplyScalar(speed);
      const nextVelocity = nextVelocities[i];
      const nextPosition = nextPositions[i];
      const velocity = this.limitTurn(fish.velocity, desiredVelocity, dt, nextVelocity);

      nextPosition.copy(fish.position).addScaledVector(velocity, dt);

      if (components) {
        trace = {
          components,
          neighborCount,
          collisionAvoidanceActive,
          boundaryAvoidanceActive,
          previousVelocity: fish.velocity.clone(),
          nextVelocity: velocity.clone(),
        };
      }
    }

    for (let i = 0; i < count; i += 1) {
      const fish = this.fish[i];
      if (!fish) continue;
      updateFishMotionState(fish, nextVelocities[i], dt, this.fishMotionScratch);
      fish.velocity.copy(nextVelocities[i]);
      fish.position.copy(nextPositions[i]);
    }

    return trace;
  }

  steerTowards(vector: THREE.Vector3, velocity: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    if (vector.lengthSq() < 0.000001) {
      return out.set(0, 0, 0);
    }

    return out
      .copy(vector)
      .normalize()
      .multiplyScalar(this.settings.maxSpeed)
      .sub(velocity)
      .clampLength(0, this.settings.maxSteerForce);
  }

  limitTurn(
    currentVelocity: THREE.Vector3,
    desiredVelocity: THREE.Vector3,
    dt: number,
    out: THREE.Vector3,
  ): THREE.Vector3 {
    const speed = desiredVelocity.length();
    const currentDirection = this.tmpTurnCurrent.copy(currentVelocity).normalize();
    const desiredDirection = this.tmpTurnDesired.copy(desiredVelocity).normalize();
    const angle = currentDirection.angleTo(desiredDirection);
    const maxAngle = this.settings.maxTurnRate * dt;

    if (angle <= maxAngle || angle < 0.000001) {
      return out.copy(desiredVelocity);
    }

    const t = maxAngle / angle;
    const sinAngle = Math.sin(angle);

    if (Math.abs(sinAngle) > 0.000001) {
      out
        .copy(currentDirection)
        .multiplyScalar(Math.sin((1 - t) * angle) / sinAngle)
        .addScaledVector(desiredDirection, Math.sin(t * angle) / sinAngle)
        .normalize();
    } else {
      out.copy(currentDirection).lerp(desiredDirection, t).normalize();
    }

    return out.multiplyScalar(speed);
  }

  isHeadingForCollision(position: THREE.Vector3, forward: THREE.Vector3): boolean {
    if (this.rayHitsObstacle(position, forward, this.settings.collisionAvoidDistance)) {
      return true;
    }

    const end = this.tmpRayEnd.copy(position).addScaledVector(
      forward,
      this.settings.collisionAvoidDistance,
    );
    return !this.isInsidePredictedAquarium(end, this.settings.boundsRadius);
  }

  obstacleRays(position: THREE.Vector3, forward: THREE.Vector3): THREE.Vector3 {
    this.tmpQuat.setFromUnitVectors(this.forwardAxis, forward);

    for (const localDirection of this.rayDirections) {
      const direction = this.tmpRayDir
        .copy(localDirection)
        .applyQuaternion(this.tmpQuat)
        .normalize();
      const end = this.tmpRayEnd.copy(position).addScaledVector(
        direction,
        this.settings.collisionAvoidDistance,
      );

      if (!this.rayHitsObstacle(position, direction, this.settings.collisionAvoidDistance)) {
        if (this.isInsidePredictedAquarium(end, this.settings.boundsRadius)) {
          return this.clearDirOut.copy(direction);
        }
      }
    }

    return this.clearDirOut.copy(forward);
  }

  rayHitsObstacle(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): boolean {
    for (const obstacle of this.obstacles) {
      if (this.rayHitsSingleObstacle(origin, direction, maxDistance, obstacle)) {
        return true;
      }
    }

    return false;
  }

  rayHitsSingleObstacle(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    obstacle: Obstacle,
  ): boolean {
    if ((obstacle.shape === "box" || obstacle.shape === "plate") && obstacle.size) {
      return this.rayHitsBoxObstacle(origin, direction, maxDistance, obstacle);
    }

    const radius = obstacle.radius;
    if (typeof radius === "number") {
      return this.rayHitsSphereObstacle(origin, direction, maxDistance, {
        ...obstacle,
        radius,
      });
    }

    return false;
  }

  rayHitsBoxObstacle(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    obstacle: Extract<Obstacle, { shape: "box" | "plate" }>,
  ): boolean {
    const localOrigin = this.tmpRayLocalOrigin.subVectors(origin, obstacle.position);
    const localDirection = this.tmpRayLocalDir.copy(direction);

    if (obstacle.rotationY) {
      this.rotateAroundY(localOrigin, -obstacle.rotationY);
      this.rotateAroundY(localDirection, -obstacle.rotationY);
    }

    const inset = this.settings.boundsRadius;
    const halfX = obstacle.size.x * 0.5 + inset;
    const halfY = obstacle.size.y * 0.5 + inset;
    const halfZ = obstacle.size.z * 0.5 + inset;

    return rayIntersectsExpandedBox(localOrigin, localDirection, halfX, halfY, halfZ, maxDistance);
  }

  rayHitsSphereObstacle(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    obstacle: Obstacle & { radius: number },
  ): boolean {
    const radius = obstacle.radius + this.settings.boundsRadius;
    const offset = this.tmpRayLocalOrigin.subVectors(origin, obstacle.position);
    const b = offset.dot(direction);
    const c = offset.lengthSq() - radius * radius;
    const discriminant = b * b - c;

    if (discriminant < 0) {
      return false;
    }

    const root = Math.sqrt(discriminant);
    const near = -b - root;
    const far = -b + root;

    return (near >= 0 && near <= maxDistance) || (far >= 0 && far <= maxDistance);
  }

  rotateAroundY(vector: THREE.Vector3, angle: number): THREE.Vector3 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = vector.x;
    const z = vector.z;

    vector.x = x * cos + z * sin;
    vector.z = -x * sin + z * cos;
    return vector;
  }

  aquariumBoundarySteer(position: THREE.Vector3): THREE.Vector3 {
    const steer = this.boundaryOut.set(0, 0, 0);
    const horizontalMargin = this.settings.horizontalBoundaryMargin ?? this.settings.boundaryMargin;
    const topMargin = this.settings.topBoundaryMargin ?? this.settings.boundaryMargin;
    const bottomMargin = this.settings.bottomBoundaryMargin ?? this.settings.boundaryMargin;

    for (const axis of ["x", "z"] as const) {
      const innerLimit = this.aquariumHalfSize[axis] - horizontalMargin;

      if (position[axis] > innerLimit) {
        steer[axis] -= (position[axis] - innerLimit) / horizontalMargin;
      } else if (position[axis] < -innerLimit) {
        steer[axis] += (-innerLimit - position[axis]) / horizontalMargin;
      }
    }

    const topInnerLimit = this.aquariumHalfSize.y - topMargin;
    const bottomInnerLimit = -this.aquariumHalfSize.y + bottomMargin;
    if (position.y > topInnerLimit) {
      steer.y -= (position.y - topInnerLimit) / topMargin;
    } else if (position.y < bottomInnerLimit) {
      steer.y += (bottomInnerLimit - position.y) / bottomMargin;
    }

    return steer;
  }

  isInsideAquarium(point: THREE.Vector3, inset = 0): boolean {
    return (
      Math.abs(point.x) <= this.aquariumHalfSize.x - inset &&
      Math.abs(point.y) <= this.aquariumHalfSize.y - inset &&
      Math.abs(point.z) <= this.aquariumHalfSize.z - inset
    );
  }

  isInsidePredictedAquarium(point: THREE.Vector3, inset = 0): boolean {
    const topInset = Math.min(inset, this.settings.topBoundaryMargin ?? inset);

    return (
      Math.abs(point.x) <= this.aquariumHalfSize.x - inset &&
      point.y <= this.aquariumHalfSize.y - topInset &&
      point.y >= -this.aquariumHalfSize.y + inset &&
      Math.abs(point.z) <= this.aquariumHalfSize.z - inset
    );
  }
}

function normalizeFishCount(count: number, fallback: number): number {
  if (!Number.isFinite(count)) {
    return fallback;
  }

  return Math.max(0, Math.floor(count));
}

function rayIntersectsExpandedBox(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  halfX: number,
  halfY: number,
  halfZ: number,
  maxDistance: number,
): boolean {
  let near = 0;
  let far = maxDistance;

  if (Math.abs(direction.x) < 0.000001) {
    if (origin.x < -halfX || origin.x > halfX) return false;
  } else {
    const inverseDirection = 1 / direction.x;
    let axisNear = (-halfX - origin.x) * inverseDirection;
    let axisFar = (halfX - origin.x) * inverseDirection;
    if (axisNear > axisFar) {
      const swap = axisNear;
      axisNear = axisFar;
      axisFar = swap;
    }
    near = Math.max(near, axisNear);
    far = Math.min(far, axisFar);
    if (near > far) return false;
  }

  if (Math.abs(direction.y) < 0.000001) {
    if (origin.y < -halfY || origin.y > halfY) return false;
  } else {
    const inverseDirection = 1 / direction.y;
    let axisNear = (-halfY - origin.y) * inverseDirection;
    let axisFar = (halfY - origin.y) * inverseDirection;
    if (axisNear > axisFar) {
      const swap = axisNear;
      axisNear = axisFar;
      axisFar = swap;
    }
    near = Math.max(near, axisNear);
    far = Math.min(far, axisFar);
    if (near > far) return false;
  }

  if (Math.abs(direction.z) < 0.000001) {
    if (origin.z < -halfZ || origin.z > halfZ) return false;
  } else {
    const inverseDirection = 1 / direction.z;
    let axisNear = (-halfZ - origin.z) * inverseDirection;
    let axisFar = (halfZ - origin.z) * inverseDirection;
    if (axisNear > axisFar) {
      const swap = axisNear;
      axisNear = axisFar;
      axisFar = swap;
    }
    near = Math.max(near, axisNear);
    far = Math.min(far, axisFar);
    if (near > far) return false;
  }

  return far >= 0 && near <= maxDistance;
}
