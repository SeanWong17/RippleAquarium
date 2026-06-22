import * as THREE from "three";
import {
  aquariumFloorY,
  aquariumHalfSize,
  clownfishAvoidanceZones,
  fishConfig,
} from "./config.js";
import {
  addFishCurveAttributes,
  enableFishCurveDeformation,
  markFishCurveAttributesNeedsUpdate,
  readFishCurveAttributes,
  updateFishCurveAttributes,
} from "./fish/curve-deformation.js";
import { createFishModelInstanceByKey } from "./fish/model-loader.js";
import { writeFishOrientationQuaternion } from "./fish/pose.js";
import { mulberry32 } from "./random.js";

const maxCount = 40;
const floorOffset = 0.72;
const verticalRange = 1.15;
const swimScale = 0.3;
const spawnRetryCount = 36;
const decorPushPasses = 4;
const decorClearance = 0.08;

const tmpMatrix = new THREE.Matrix4();
const tmpQuaternion = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpDirection = new THREE.Vector3();
const tmpRepel = new THREE.Vector3();
const tmpCorrection = new THREE.Vector3();

export function createClownfishSchool(coralReef, { count = 18, seed = 211 } = {}) {
  const { geometry, material } = createFishModelInstanceByKey("clown");
  addFishCurveAttributes(geometry, maxCount);
  enableFishCurveDeformation(material);
  const curveAttributes = readFishCurveAttributes(geometry);

  const mesh = new THREE.InstancedMesh(geometry, material, maxCount);
  mesh.name = "Bottom clownfish school";
  mesh.count = normalizeCount(count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = true;
  mesh.renderOrder = 2;
  mesh.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(),
    fishConfig.renderBoundsRadius,
  );

  const random = mulberry32(seed);
  const fish = Array.from({ length: maxCount }, (_, index) => createClownfish(index, random));
  function update(time, dt) {
    const step = Math.min(dt, 1 / 30);
    for (const item of fish) {
      if (item.index >= mesh.count) continue;

      updateClownfish(item, coralReef, step, time);
      writeFishOrientationQuaternion(item, item.velocity, tmpQuaternion);
      updateFishCurveAttributes(curveAttributes, item.index, item, tmpQuaternion);
      tmpScale.setScalar(swimScale);
      tmpMatrix.compose(item.position, tmpQuaternion, tmpScale);
      mesh.setMatrixAt(item.index, tmpMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    markFishCurveAttributesNeedsUpdate(curveAttributes);
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  update(0, 0);

  return {
    mesh,
    update,
    dispose,
    setCount(nextCount) {
      mesh.count = normalizeCount(nextCount);
    },
  };
}

function normalizeCount(count) {
  return THREE.MathUtils.clamp(Math.floor(count), 0, maxCount);
}

function createClownfish(index, random) {
  const position = createClownfishPosition(random);
  const angle = random() * Math.PI * 2;
  const speed = THREE.MathUtils.lerp(0.42, 0.78, random());

  return {
    index,
    position,
    velocity: new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(speed),
    bank: 0,
    swimPhase: random() * Math.PI * 2,
    swimDrive: 0.65,
    curveBendWorld: new THREE.Vector3(),
    turnBias: random() > 0.5 ? 1 : -1,
  };
}

function createClownfishPosition(random) {
  const fallback = new THREE.Vector3();

  for (let attempt = 0; attempt < spawnRetryCount; attempt += 1) {
    const position = randomClownfishPosition(random);
    if (!isInsideDecorZones(position)) {
      return position;
    }
    if (attempt === 0) {
      fallback.copy(position);
    }
  }

  pushPositionOutOfDecorZones(fallback);
  return fallback;
}

function randomClownfishPosition(random) {
  return new THREE.Vector3(
    (random() - 0.5) * aquariumHalfSize.x * 1.35,
    aquariumFloorY + floorOffset + random() * verticalRange,
    (random() - 0.5) * aquariumHalfSize.z * 1.35,
  );
}

function updateClownfish(item, coralReef, dt, time) {
  const homeY = aquariumFloorY + floorOffset + verticalRange * 0.42;
  tmpRepel.set(0, 0, 0);

  for (const coral of coralReef.group.children) {
    if (!coral.visible) continue;
    const offset = tmpDirection.copy(item.position).sub(coral.position);
    offset.y *= 0.45;
    const distanceSq = offset.lengthSq();
    const avoidRadius = Math.max(0.24, coral.scale.x * 0.34) + 0.56;
    if (distanceSq > 0.0001 && distanceSq < avoidRadius * avoidRadius) {
      tmpRepel.addScaledVector(offset.normalize(), (avoidRadius * avoidRadius - distanceSq) / avoidRadius);
    }
  }
  repelFromDecorZones(item, tmpRepel);

  const topY = aquariumFloorY + floorOffset + verticalRange;
  const bottomY = aquariumFloorY + floorOffset * 0.45;
  if (item.position.y > topY) tmpRepel.y -= (item.position.y - topY) * 2.2;
  if (item.position.y < bottomY) tmpRepel.y += (bottomY - item.position.y) * 2.2;

  const marginX = aquariumHalfSize.x * 0.72;
  const marginZ = aquariumHalfSize.z * 0.72;
  if (item.position.x > marginX) tmpRepel.x -= (item.position.x - marginX) * 0.7;
  if (item.position.x < -marginX) tmpRepel.x += (-marginX - item.position.x) * 0.7;
  if (item.position.z > marginZ) tmpRepel.z -= (item.position.z - marginZ) * 0.7;
  if (item.position.z < -marginZ) tmpRepel.z += (-marginZ - item.position.z) * 0.7;

  tmpRepel.y += (homeY - item.position.y) * 0.34;
  tmpRepel.x += Math.sin(time * 0.8 + item.index * 1.7) * 0.08 * item.turnBias;
  tmpRepel.z += Math.cos(time * 0.65 + item.index * 1.3) * 0.08;

  item.velocity.addScaledVector(tmpRepel, dt);
  item.velocity.clampLength(0.32, 0.9);
  item.position.addScaledVector(item.velocity, dt);
  if (pushPositionOutOfDecorZones(item.position)) {
    item.velocity.addScaledVector(tmpCorrection, 5).clampLength(0.32, 0.9);
  }
  item.swimPhase += dt * 8.5;
  item.swimDrive = 0.7;
  item.curveBendWorld.copy(item.velocity).normalize().multiplyScalar(0.2 * item.turnBias);
}

function repelFromDecorZones(item, repel) {
  for (const zone of clownfishAvoidanceZones) {
    if (zone.shape === "box") {
      repelFromBoxZone(item, repel, zone);
      continue;
    }

    repelFromCircleZone(item, repel, zone);
  }
}

function repelFromCircleZone(item, repel, zone) {
  const offset = tmpDirection.copy(item.position).sub(zone.position);
  offset.y *= 0.25;
  const distanceSq = offset.lengthSq();
  const radius = zone.radius ?? 0;

  if (radius <= 0 || distanceSq <= 0.0001 || distanceSq >= radius * radius) {
    return;
  }

  repel.addScaledVector(
    offset.normalize(),
    ((radius * radius - distanceSq) / radius) * (zone.strength ?? 1),
  );
}

function isInsideDecorZones(position) {
  for (const zone of clownfishAvoidanceZones) {
    if (isInsideDecorZone(position, zone)) {
      return true;
    }
  }

  return false;
}

function isInsideDecorZone(position, zone) {
  if (zone.shape === "box") {
    return readBoxZoneDepth(position, zone) !== null;
  }

  return readCircleZoneDepth(position, zone) !== null;
}

function pushPositionOutOfDecorZones(position) {
  let pushed = false;
  tmpCorrection.set(0, 0, 0);

  for (let pass = 0; pass < decorPushPasses; pass += 1) {
    let passPushed = false;

    for (const zone of clownfishAvoidanceZones) {
      const correction = zone.shape === "box"
        ? readBoxZoneCorrection(position, zone)
        : readCircleZoneCorrection(position, zone);
      if (!correction) continue;

      position.add(correction);
      tmpCorrection.add(correction);
      passPushed = true;
      pushed = true;
    }

    if (!passPushed) {
      break;
    }
  }

  return pushed;
}

function readCircleZoneDepth(position, zone) {
  const radius = zone.radius ?? 0;
  if (radius <= 0) return null;

  const localX = position.x - zone.position.x;
  const localZ = position.z - zone.position.z;
  const distanceSq = localX * localX + localZ * localZ;
  if (distanceSq >= radius * radius) return null;

  return {
    localX,
    localZ,
    distance: Math.sqrt(distanceSq),
    radius,
  };
}

function readCircleZoneCorrection(position, zone) {
  const depth = readCircleZoneDepth(position, zone);
  if (!depth) return null;

  const directionX = depth.distance > 0.0001 ? depth.localX / depth.distance : 1;
  const directionZ = depth.distance > 0.0001 ? depth.localZ / depth.distance : 0;
  const push = depth.radius - depth.distance + decorClearance;
  return tmpDirection.set(directionX * push, 0, directionZ * push);
}

function readBoxZoneDepth(position, zone) {
  const halfX = zone.size.x * 0.5;
  const halfZ = zone.size.y * 0.5;
  const localX = position.x - zone.position.x;
  const localZ = position.z - zone.position.z;
  const dx = Math.abs(localX);
  const dz = Math.abs(localZ);

  if (dx >= halfX || dz >= halfZ) {
    return null;
  }

  return {
    halfX,
    halfZ,
    localX,
    localZ,
    pushX: halfX - dx,
    pushZ: halfZ - dz,
  };
}

function readBoxZoneCorrection(position, zone) {
  const depth = readBoxZoneDepth(position, zone);
  if (!depth) return null;

  if (depth.pushX < depth.pushZ) {
    return tmpDirection.set(
      Math.sign(depth.localX || 1) * (depth.pushX + decorClearance),
      0,
      0,
    );
  }

  return tmpDirection.set(
    0,
    0,
    Math.sign(depth.localZ || 1) * (depth.pushZ + decorClearance),
  );
}

function repelFromBoxZone(item, repel, zone) {
  const halfX = zone.size.x * 0.5;
  const halfZ = zone.size.y * 0.5;
  const localX = item.position.x - zone.position.x;
  const localZ = item.position.z - zone.position.z;
  const dx = Math.abs(localX);
  const dz = Math.abs(localZ);

  if (dx >= halfX || dz >= halfZ) {
    return;
  }

  const pushX = halfX - dx;
  const pushZ = halfZ - dz;
  const strength = zone.strength ?? 1;

  if (pushX < pushZ) {
    repel.x += Math.sign(localX || 1) * pushX * strength;
  } else {
    repel.z += Math.sign(localZ || 1) * pushZ * strength;
  }
}
