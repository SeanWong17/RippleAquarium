import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { FishSchoolSimulation } from "../src/fish-school-simulation.js";
import { SpatialGrid } from "../src/fish/spatial-grid.js";

const baseSettings = {
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

function makeSimulation(overrides = {}) {
  return new FishSchoolSimulation({
    aquariumHalfSize: new THREE.Vector3(11, 6.6, 8.5),
    obstacles: [],
    settings: { ...baseSettings, ...overrides },
  });
}

test("steerTowards returns zero for a zero input vector", () => {
  const sim = makeSimulation();
  const out = new THREE.Vector3(9, 9, 9);
  const result = sim.steerTowards(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), out);
  assert.equal(result, out, "writes into the provided output vector");
  assert.equal(result.length(), 0);
});

test("steerTowards is clamped by maxSteerForce", () => {
  const sim = makeSimulation();
  const out = new THREE.Vector3();
  // Desired points +x at maxSpeed; current velocity points -x, so the raw
  // steering force is large and must be clamped.
  sim.steerTowards(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-7.5, 0, 0), out);
  assert.ok(out.length() <= baseSettings.maxSteerForce + 1e-6);
  assert.ok(out.x > 0, "steers back toward +x");
});

test("limitTurn passes small turns through unchanged", () => {
  const sim = makeSimulation();
  const current = new THREE.Vector3(5, 0, 0);
  const desired = new THREE.Vector3(5, 0.01, 0);
  const out = new THREE.Vector3();
  sim.limitTurn(current, desired, 1 / 60, out);
  assert.ok(out.distanceTo(desired) < 1e-6);
});

test("limitTurn caps the turn angle and preserves desired speed", () => {
  const sim = makeSimulation();
  const current = new THREE.Vector3(5, 0, 0);
  const desired = new THREE.Vector3(-5, 0, 0); // 180 degrees away
  const out = new THREE.Vector3();
  const dt = 1 / 60;
  sim.limitTurn(current, desired, dt, out);

  const maxAngle = baseSettings.maxTurnRate * dt;
  const turned = current.angleTo(out);
  assert.ok(turned <= maxAngle + 1e-6, `turned ${turned} <= ${maxAngle}`);
  assert.ok(Math.abs(out.length() - desired.length()) < 1e-6, "keeps desired speed");
});

test("ray hits a box obstacle dead ahead and misses when pointing away", () => {
  const sim = makeSimulation();
  const obstacle = {
    position: new THREE.Vector3(0, 0, 5),
    shape: "box" as const,
    size: new THREE.Vector3(2, 2, 2),
  };
  const origin = new THREE.Vector3(0, 0, 0);
  assert.equal(
    sim.rayHitsSingleObstacle(origin, new THREE.Vector3(0, 0, 1), 10, obstacle),
    true,
    "ray toward the box hits",
  );
  assert.equal(
    sim.rayHitsSingleObstacle(origin, new THREE.Vector3(0, 0, -1), 10, obstacle),
    false,
    "ray away from the box misses",
  );
});

test("ray hits a sphere obstacle dead ahead and misses when pointing away", () => {
  const sim = makeSimulation();
  const obstacle = { position: new THREE.Vector3(0, 0, 5), radius: 1 };
  const origin = new THREE.Vector3(0, 0, 0);
  assert.equal(
    sim.rayHitsSingleObstacle(origin, new THREE.Vector3(0, 0, 1), 10, obstacle),
    true,
  );
  assert.equal(
    sim.rayHitsSingleObstacle(origin, new THREE.Vector3(0, 0, -1), 10, obstacle),
    false,
  );
});

test("SpatialGrid neighbour query matches brute-force within the cell radius", () => {
  const radius = 2.7;
  const grid = new SpatialGrid(radius);
  const rng = mulberry(1234);
  const items = Array.from({ length: 250 }, () => ({
    position: new THREE.Vector3(
      (rng() * 2 - 1) * 11,
      (rng() * 2 - 1) * 6.6,
      (rng() * 2 - 1) * 8.5,
    ),
  }));

  grid.build(items);

  const radiusSq = radius * radius;
  for (let i = 0; i < items.length; i += 1) {
    const brute = new Set<number>();
    for (let j = 0; j < items.length; j += 1) {
      if (i === j) continue;
      if (items[i].position.distanceToSquared(items[j].position) < radiusSq) {
        brute.add(j);
      }
    }

    // The grid returns a 3x3x3 superset; every true neighbour must appear in it.
    const candidates = new Set(grid.queryNeighbors(items[i].position));
    for (const j of brute) {
      assert.ok(candidates.has(j), `grid missed neighbour ${j} of ${i}`);
    }
  }
});

test("grid-based update keeps fish inside the aquarium", () => {
  const sim = makeSimulation();
  sim.reset(120);
  for (let step = 0; step < 120; step += 1) {
    sim.update(1 / 60);
  }
  for (const fish of sim.fish) {
    assert.ok(Math.abs(fish.position.x) <= 11 + 1, "x within bounds");
    assert.ok(Math.abs(fish.position.y) <= 6.6 + 1, "y within bounds");
    assert.ok(Math.abs(fish.position.z) <= 8.5 + 1, "z within bounds");
    assert.ok(Number.isFinite(fish.velocity.length()), "velocity stays finite");
  }
});

test("update is deterministic for a fixed seed", () => {
  const a = makeSimulation();
  const b = makeSimulation();
  a.reset(60, 7);
  b.reset(60, 7);
  for (let step = 0; step < 50; step += 1) {
    a.update(1 / 60);
    b.update(1 / 60);
  }
  for (let i = 0; i < a.fish.length; i += 1) {
    assert.ok(a.fish[i].position.distanceTo(b.fish[i].position) < 1e-9);
  }
});

// Local PRNG for test fixtures (independent of the sim's internal RNG).
function mulberry(seed) {
  return function next() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
