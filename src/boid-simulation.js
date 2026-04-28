import * as THREE from "three";
import {
  createRayDirections,
  mulberry32,
  randomPointInBox,
  randomPointInSphere,
} from "./random.js";

export class BoidSimulation {
  constructor({ worldHalfSize, obstacles, settings }) {
    this.worldHalfSize = worldHalfSize;
    this.obstacles = obstacles;
    this.settings = settings;
    this.boids = [];
    this.rayDirections = createRayDirections(300);

    this.tmpVecA = new THREE.Vector3();
    this.tmpVecB = new THREE.Vector3();
    this.tmpVecC = new THREE.Vector3();
    this.tmpQuat = new THREE.Quaternion();
    this.forwardAxis = new THREE.Vector3(0, 0, 1);
  }

  reset(count, seed = 42) {
    this.boids.length = 0;
    const random = mulberry32(seed);

    for (let i = 0; i < count; i += 1) {
      const position = randomPointInBox(random, this.worldHalfSize, 0.62);
      const direction = randomPointInSphere(random, 1).normalize();
      const speed = THREE.MathUtils.lerp(
        this.settings.minSpeed,
        this.settings.maxSpeed,
        random(),
      );
      this.boids.push({
        position,
        velocity: direction.multiplyScalar(speed),
      });
    }
  }

  update(dt) {
    const nextVelocities = new Array(this.boids.length);
    const nextPositions = new Array(this.boids.length);

    for (let i = 0; i < this.boids.length; i += 1) {
      const boid = this.boids[i];
      const acceleration = new THREE.Vector3();
      const headingSum = new THREE.Vector3();
      const centerSum = new THREE.Vector3();
      const avoidanceSum = new THREE.Vector3();
      let neighborCount = 0;

      for (let j = 0; j < this.boids.length; j += 1) {
        if (i === j) continue;
        const other = this.boids[j];
        const offset = this.tmpVecA.subVectors(other.position, boid.position);
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
        acceleration.add(
          this.steerTowards(headingSum, boid.velocity).multiplyScalar(
            this.settings.alignWeight,
          ),
        );
        acceleration.add(
          this.steerTowards(centerSum.sub(boid.position), boid.velocity).multiplyScalar(
            this.settings.cohesionWeight,
          ),
        );
        acceleration.add(
          this.steerTowards(avoidanceSum, boid.velocity).multiplyScalar(
            this.settings.separateWeight,
          ),
        );
      }

      acceleration.add(
        this.steerTowards(
          this.tmpVecA.copy(boid.position).multiplyScalar(-1),
          boid.velocity,
        ).multiplyScalar(this.settings.targetWeight),
      );

      const forward = this.tmpVecB.copy(boid.velocity).normalize();
      if (this.isHeadingForCollision(boid.position, forward)) {
        const clearDirection = this.obstacleRays(boid.position, forward);
        acceleration.add(
          this.steerTowards(clearDirection, boid.velocity).multiplyScalar(
            this.settings.avoidCollisionWeight,
          ),
        );
      }

      const boundary = this.boxBoundarySteer(boid.position, this.settings.boundaryMargin);
      if (boundary.lengthSq() > 0) {
        acceleration.add(
          this.steerTowards(boundary, boid.velocity).multiplyScalar(
            this.settings.boundaryWeight,
          ),
        );
      }

      const velocity = boid.velocity.clone().add(acceleration.multiplyScalar(dt));
      const speed = THREE.MathUtils.clamp(
        velocity.length(),
        this.settings.minSpeed,
        this.settings.maxSpeed,
      );
      velocity.normalize().multiplyScalar(speed);

      nextVelocities[i] = velocity;
      nextPositions[i] = boid.position.clone().addScaledVector(velocity, dt);
    }

    for (let i = 0; i < this.boids.length; i += 1) {
      this.boids[i].velocity.copy(nextVelocities[i]);
      this.boids[i].position.copy(nextPositions[i]);
    }
  }

  steerTowards(vector, velocity) {
    if (vector.lengthSq() < 0.000001) {
      return new THREE.Vector3();
    }

    const desired = vector.clone().normalize().multiplyScalar(this.settings.maxSpeed);
    return desired.sub(velocity).clampLength(0, this.settings.maxSteerForce);
  }

  isHeadingForCollision(position, forward) {
    if (this.rayHitsObstacle(position, forward, this.settings.collisionAvoidDistance)) {
      return true;
    }

    const end = this.tmpVecA.copy(position).addScaledVector(
      forward,
      this.settings.collisionAvoidDistance,
    );
    return !this.isInsideBox(end, this.settings.boundsRadius);
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
        if (this.isInsideBox(end, this.settings.boundsRadius)) {
          return direction.clone();
        }
      }
    }

    return forward.clone();
  }

  rayHitsObstacle(origin, direction, maxDistance) {
    for (const obstacle of this.obstacles) {
      const radius = obstacle.radius + this.settings.boundsRadius;
      const offset = this.tmpVecC.subVectors(origin, obstacle.position);
      const b = offset.dot(direction);
      const c = offset.lengthSq() - radius * radius;
      const discriminant = b * b - c;

      if (discriminant < 0) continue;

      const root = Math.sqrt(discriminant);
      const near = -b - root;
      const far = -b + root;

      if ((near >= 0 && near <= maxDistance) || (far >= 0 && far <= maxDistance)) {
        return true;
      }
    }

    return false;
  }

  boxBoundarySteer(position, margin) {
    const steer = new THREE.Vector3();

    for (const axis of ["x", "y", "z"]) {
      const innerLimit = this.worldHalfSize[axis] - margin;

      if (position[axis] > innerLimit) {
        steer[axis] -= (position[axis] - innerLimit) / margin;
      } else if (position[axis] < -innerLimit) {
        steer[axis] += (-innerLimit - position[axis]) / margin;
      }
    }

    return steer;
  }

  isInsideBox(point, inset = 0) {
    return (
      Math.abs(point.x) <= this.worldHalfSize.x - inset &&
      Math.abs(point.y) <= this.worldHalfSize.y - inset &&
      Math.abs(point.z) <= this.worldHalfSize.z - inset
    );
  }
}
