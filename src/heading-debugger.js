import * as THREE from "three";

const DEFAULT_FRAME_LIMIT = 240;

export function createHeadingDebugger({ enabled, frameLimit = DEFAULT_FRAME_LIMIT }) {
  if (!enabled) {
    return null;
  }

  const previousDirection = new THREE.Vector3();
  const currentDirection = new THREE.Vector3();
  let frame = 0;
  let hasPreviousDirection = false;
  const samples = [];

  return {
    get traceIndex() {
      return 0;
    },

    sample({ dt, fish, trace }) {
      if (!fish || frame >= frameLimit) {
        return;
      }

      currentDirection.copy(fish.velocity).normalize();
      const deltaDegrees = hasPreviousDirection
        ? THREE.MathUtils.radToDeg(previousDirection.angleTo(currentDirection))
        : 0;
      previousDirection.copy(currentDirection);
      hasPreviousDirection = true;

      const componentMagnitudes = Object.fromEntries(
        Object.entries(trace?.components ?? {}).map(([name, vector]) => [
          name,
          Number(vector.length().toFixed(3)),
        ]),
      );

      const sample = {
        frame,
        dt: Number(dt.toFixed(4)),
        deltaDegrees: Number(deltaDegrees.toFixed(3)),
        direction: [
          Number(currentDirection.x.toFixed(3)),
          Number(currentDirection.y.toFixed(3)),
          Number(currentDirection.z.toFixed(3)),
        ],
        speed: Number(fish.velocity.length().toFixed(3)),
        neighborCount: trace?.neighborCount ?? 0,
        collisionAvoidanceActive: trace?.collisionAvoidanceActive ?? false,
        boundaryAvoidanceActive: trace?.boundaryAvoidanceActive ?? false,
        componentMagnitudes,
      };
      samples.push(sample);
      console.log("[heading-debug]", sample);

      frame += 1;

      if (frame === frameLimit) {
        const deltas = samples.map((entry) => entry.deltaDegrees);
        deltas.sort((a, b) => a - b);
        console.table({
          frames: samples.length,
          mean: average(deltas),
          p95: percentile(deltas, 0.95),
          p99: percentile(deltas, 0.99),
          max: deltas.at(-1),
        });
      }
    },
  };
}

function average(values) {
  return Number(
    (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3),
  );
}

function percentile(sortedValues, ratio) {
  const index = Math.floor((sortedValues.length - 1) * ratio);
  return sortedValues[index];
}
