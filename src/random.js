import * as THREE from "three";

export function createRayDirections(count) {
  const directions = [];
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  const angleIncrement = Math.PI * 2 * goldenRatio;

  for (let i = 0; i < count; i += 1) {
    const t = i / count;
    const inclination = Math.acos(1 - 2 * t);
    const azimuth = angleIncrement * i;
    directions.push(
      new THREE.Vector3(
        Math.sin(inclination) * Math.cos(azimuth),
        Math.sin(inclination) * Math.sin(azimuth),
        Math.cos(inclination),
      ),
    );
  }

  return directions;
}

export function mulberry32(seed) {
  return function next() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomPointInBox(random, halfSize, scale = 1) {
  return new THREE.Vector3(
    (random() * 2 - 1) * halfSize.x * scale,
    (random() * 2 - 1) * halfSize.y * scale,
    (random() * 2 - 1) * halfSize.z * scale,
  );
}

export function randomPointInSphere(random, radius) {
  const point = new THREE.Vector3();

  do {
    point.set(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1);
  } while (point.lengthSq() > 1 || point.lengthSq() === 0);

  return point.multiplyScalar(radius);
}
