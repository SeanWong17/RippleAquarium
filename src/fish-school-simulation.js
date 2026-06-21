import * as THREE from "three";
import {
  createFishMotionScratch,
  createFishMotionState,
  updateFishMotionState,
} from "./fish/motion-state.js";
import {
  createRayDirections,
  mulberry32,
  randomPointInAquarium,
  randomPointInSphere,
} from "./random.js";

export class FishSchoolSimulation {
  constructor({ aquariumHalfSize, obstacles, settings }) {
    this.aquariumHalfSize = aquariumHalfSize;
    this.obstacles = obstacles;
    this.settings = settings;
    this.fish = [];
    this.random = mulberry32(42);
    this.rayDirections = createRayDirections(300);
    this.fishMotionScratch = createFishMotionScratch();

    this.tmpVecA = new THREE.Vector3();
    this.tmpVecB = new THREE.Vector3();
    this.tmpVecC = new THREE.Vector3();
    this.tmpVecD = new THREE.Vector3();
    this.tmpQuat = new THREE.Quaternion();
    this.forwardAxis = new THREE.Vector3(0, 0, 1);
  }

  reset(count, seed = 42) {
    const targetCount = normalizeFishCount(count, 0);
    this.fish.length = 0;
    this.random = mulberry32(seed);

    for (let i = 0; i < targetCount; i += 1) {
      this.fish.push(this.createFish(i));
    }
  }

  setCount(count) {
    const targetCount = normalizeFishCount(count, this.fish.length);

    if (targetCount < this.fish.length) {
      this.fish.length = targetCount;
      return;
    }

    while (this.fish.length < targetCount) {
      this.fish.push(this.createFish(this.fish.length));
    }
  }

  createFish(index = this.fish.length) {
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

  update(dt, options = {}) {
    const nextVelocities = new Array(this.fish.length);
    const nextPositions = new Array(this.fish.length);
    let trace = null;

    for (let i = 0; i < this.fish.length; i += 1) {
      const fish = this.fish[i];
      const acceleration = new THREE.Vector3();
      const components = options.traceIndex === i ? {
        align: new THREE.Vector3(),
        cohesion: new THREE.Vector3(),
        separation: new THREE.Vector3(),
        obstacle: new THREE.Vector3(),
        boundary: new THREE.Vector3(),
      } : null;
      const headingSum = new THREE.Vector3();
      const centerSum = new THREE.Vector3();
      const avoidanceSum = new THREE.Vector3();
      let neighborCount = 0;
      let collisionAvoidanceActive = false;
      let boundaryAvoidanceActive = false;

      for (let j = 0; j < this.fish.length; j += 1) {
        if (i === j) continue;
        const other = this.fish[j];
        const offset = this.tmpVecA.subVectors(other.position, fish.position);
        const distanceSq = offset.lengthSq();

        if (distanceSq < this.settings.perceptionRadius * this.settings.perceptionRadius) {
          neighborCount += 1;
          headingSum.add(this.tmpVecB.copy(other.velocity).normalize());
          centerSum.add(other.position);

          if (distanceSq < this.settings.avoidanceRadius * this.settings.avoidanceRadius) {
            const distance = Math.sqrt(Math.max(distanceSq, 0.0001));
            avoidanceSum.add(this.tmpVecC.copy(offset).multiplyScalar(-1 / distance));
          }
        }
      }

      if (neighborCount > 0) {
        centerSum.multiplyScalar(1 / neighborCount);
        const align = this.steerTowards(headingSum, fish.velocity).multiplyScalar(
          this.settings.alignWeight,
        );
        const cohesion = this.steerTowards(
          centerSum.sub(fish.position),
          fish.velocity,
        ).multiplyScalar(
          this.settings.cohesionWeight,
        );
        const separation = this.steerTowards(
          avoidanceSum,
          fish.velocity,
        ).multiplyScalar(
          this.settings.separateWeight,
        );

        acceleration.add(align);
        acceleration.add(cohesion);
        acceleration.add(separation);

        if (components) {
          components.align.copy(align);
          components.cohesion.copy(cohesion);
          components.separation.copy(separation);
        }
      }

      const forward = this.tmpVecB.copy(fish.velocity).normalize();
      if (this.isHeadingForCollision(fish.position, forward)) {
        collisionAvoidanceActive = true;
        const clearDirection = this.obstacleRays(fish.position, forward);
        const obstacle = this.steerTowards(
          clearDirection,
          fish.velocity,
        ).multiplyScalar(
          this.settings.avoidCollisionWeight,
        );
        acceleration.add(obstacle);
        if (components) {
          components.obstacle.copy(obstacle);
        }
      }

      const boundary = this.aquariumBoundarySteer(fish.position);
      if (boundary.lengthSq() > 0) {
        boundaryAvoidanceActive = true;
        const boundaryForce = this.steerTowards(
          boundary,
          fish.velocity,
        ).multiplyScalar(
          this.settings.boundaryWeight,
        );
        acceleration.add(boundaryForce);
        if (components) {
          components.boundary.copy(boundaryForce);
        }
      }

      const desiredVelocity = fish.velocity.clone().add(acceleration.multiplyScalar(dt));
      const speed = THREE.MathUtils.clamp(
        desiredVelocity.length(),
        this.settings.minSpeed,
        this.settings.maxSpeed,
      );
      desiredVelocity.normalize().multiplyScalar(speed);
      const velocity = this.limitTurn(fish.velocity, desiredVelocity, dt);

      nextVelocities[i] = velocity;
      nextPositions[i] = fish.position.clone().addScaledVector(velocity, dt);

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

    for (let i = 0; i < this.fish.length; i += 1) {
      const fish = this.fish[i];
      updateFishMotionState(fish, nextVelocities[i], dt, this.fishMotionScratch);
      fish.velocity.copy(nextVelocities[i]);
      fish.position.copy(nextPositions[i]);
    }

    return trace;
  }

  steerTowards(vector, velocity) {
    if (vector.lengthSq() < 0.000001) {
      return new THREE.Vector3();
    }

    const desired = vector.clone().normalize().multiplyScalar(this.settings.maxSpeed);
    return desired.sub(velocity).clampLength(0, this.settings.maxSteerForce);
  }

  limitTurn(currentVelocity, desiredVelocity, dt) {
    const currentDirection = currentVelocity.clone().normalize();
    const desiredDirection = desiredVelocity.clone().normalize();
    const angle = currentDirection.angleTo(desiredDirection);
    const maxAngle = this.settings.maxTurnRate * dt;

    if (angle <= maxAngle || angle < 0.000001) {
      return desiredVelocity;
    }

    const t = maxAngle / angle;
    const sinAngle = Math.sin(angle);
    let direction;

    if (Math.abs(sinAngle) > 0.000001) {
      direction = currentDirection
        .multiplyScalar(Math.sin((1 - t) * angle) / sinAngle)
        .add(desiredDirection.multiplyScalar(Math.sin(t * angle) / sinAngle))
        .normalize();
    } else {
      direction = currentDirection.lerp(desiredDirection, t).normalize();
    }

    return direction.multiplyScalar(desiredVelocity.length());
  }

  isHeadingForCollision(position, forward) {
    if (this.rayHitsObstacle(position, forward, this.settings.collisionAvoidDistance)) {
      return true;
    }

    const end = this.tmpVecA.copy(position).addScaledVector(
      forward,
      this.settings.collisionAvoidDistance,
    );
    return !this.isInsidePredictedAquarium(end, this.settings.boundsRadius);
  }

  obstacleRays(position, forward) {
    this.tmpQuat.setFromUnitVectors(this.forwardAxis, forward);

    for (const localDirection of this.rayDirections) {
      const direction = this.tmpVecA
        .copy(localDirection)
        .applyQuaternion(this.tmpQuat)
        .normalize();
      const end = this.tmpVecB.copy(position).addScaledVector(
        direction,
        this.settings.collisionAvoidDistance,
      );

      if (!this.rayHitsObstacle(position, direction, this.settings.collisionAvoidDistance)) {
        if (this.isInsidePredictedAquarium(end, this.settings.boundsRadius)) {
          return direction.clone();
        }
      }
    }

    return forward.clone();
  }

  rayHitsObstacle(origin, direction, maxDistance) {
    for (const obstacle of this.obstacles) {
      if (this.rayHitsSingleObstacle(origin, direction, maxDistance, obstacle)) {
        return true;
      }
    }

    return false;
  }

  rayHitsSingleObstacle(origin, direction, maxDistance, obstacle) {
    if ((obstacle.shape === "box" || obstacle.shape === "plate") && obstacle.size) {
      return this.rayHitsBoxObstacle(origin, direction, maxDistance, obstacle);
    }

    return this.rayHitsSphereObstacle(origin, direction, maxDistance, obstacle);
  }

  rayHitsBoxObstacle(origin, direction, maxDistance, obstacle) {
    const localOrigin = this.tmpVecC.subVectors(origin, obstacle.position);
    const localDirection = this.tmpVecD.copy(direction);

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

  rayHitsSphereObstacle(origin, direction, maxDistance, obstacle) {
    const radius = obstacle.radius + this.settings.boundsRadius;
    const offset = this.tmpVecC.subVectors(origin, obstacle.position);
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

  rotateAroundY(vector, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = vector.x;
    const z = vector.z;

    vector.x = x * cos + z * sin;
    vector.z = -x * sin + z * cos;
    return vector;
  }

  aquariumBoundarySteer(position) {
    const steer = new THREE.Vector3();
    const horizontalMargin = this.settings.horizontalBoundaryMargin ?? this.settings.boundaryMargin;
    const topMargin = this.settings.topBoundaryMargin ?? this.settings.boundaryMargin;
    const bottomMargin = this.settings.bottomBoundaryMargin ?? this.settings.boundaryMargin;

    for (const axis of ["x", "z"]) {
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

  isInsideAquarium(point, inset = 0) {
    return (
      Math.abs(point.x) <= this.aquariumHalfSize.x - inset &&
      Math.abs(point.y) <= this.aquariumHalfSize.y - inset &&
      Math.abs(point.z) <= this.aquariumHalfSize.z - inset
    );
  }

  isInsidePredictedAquarium(point, inset = 0) {
    const topInset = Math.min(inset, this.settings.topBoundaryMargin ?? inset);

    return (
      Math.abs(point.x) <= this.aquariumHalfSize.x - inset &&
      point.y <= this.aquariumHalfSize.y - topInset &&
      point.y >= -this.aquariumHalfSize.y + inset &&
      Math.abs(point.z) <= this.aquariumHalfSize.z - inset
    );
  }
}

function normalizeFishCount(count, fallback) {
  if (!Number.isFinite(count)) {
    return fallback;
  }

  return Math.max(0, Math.floor(count));
}

function rayIntersectsExpandedBox(origin, direction, halfX, halfY, halfZ, maxDistance) {
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
