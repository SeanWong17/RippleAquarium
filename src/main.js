import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const canvas = document.querySelector("#scene");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x081016);
scene.fog = new THREE.Fog(0x081016, 18, 42);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
camera.position.set(0, 8.5, 20);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.8, 0);
controls.maxDistance = 38;
controls.minDistance = 8;

const hemiLight = new THREE.HemisphereLight(0x9fd8ff, 0x1b3024, 2.6);
scene.add(hemiLight);

const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(8, 12, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

const worldHalfSize = new THREE.Vector3(11, 6.6, 8.5);
const worldSize = worldHalfSize.clone().multiplyScalar(2);
const floorY = -worldHalfSize.y;
const clock = new THREE.Clock();
const fishGeometry = new THREE.ConeGeometry(0.13, 0.58, 14, 1);
const fishVertexColors = new Float32Array(
  fishGeometry.attributes.position.count * 3,
).fill(1);
fishGeometry.setAttribute("color", new THREE.BufferAttribute(fishVertexColors, 3));
fishGeometry.computeVertexNormals();

const fishMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.42,
  metalness: 0.05,
  vertexColors: true,
});
const fishColor = new THREE.Color(0x5fe3b1);
const highlightedFishColor = new THREE.Color(0xff7ab8);
const highlightedFishIndex = 0;

const obstacleMaterial = new THREE.MeshStandardMaterial({
  color: 0xb8584c,
  roughness: 0.52,
  metalness: 0.08,
  transparent: true,
  opacity: 0.82,
});

const glassMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x9bdcff,
  roughness: 0.02,
  metalness: 0,
  transmission: 0.65,
  thickness: 0.55,
  transparent: true,
  opacity: 0.24,
  side: THREE.DoubleSide,
  depthWrite: false,
  clearcoat: 1,
  clearcoatRoughness: 0.08,
});

const bounds = new THREE.Mesh(
  new THREE.BoxGeometry(worldSize.x, worldSize.y, worldSize.z),
  glassMaterial,
);
scene.add(bounds);

const boundsEdges = new THREE.LineSegments(
  new THREE.EdgesGeometry(bounds.geometry),
  new THREE.LineBasicMaterial({
    color: 0xc6efff,
    transparent: true,
    opacity: 0.42,
  }),
);
scene.add(boundsEdges);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(worldSize.x, worldSize.z),
  new THREE.MeshStandardMaterial({
    color: 0x17222a,
    roughness: 0.9,
    metalness: 0,
  }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = floorY - 0.03;
floor.receiveShadow = true;
scene.add(floor);

const floorEdges = new THREE.LineSegments(
  new THREE.EdgesGeometry(floor.geometry),
  new THREE.LineBasicMaterial({
    color: 0x78b6c7,
    transparent: true,
    opacity: 0.5,
  }),
);
floorEdges.rotation.copy(floor.rotation);
floorEdges.position.copy(floor.position);
scene.add(floorEdges);

const settings = {
  minSpeed: 2,
  maxSpeed: 5,
  perceptionRadius: 2.7,
  avoidanceRadius: 1,
  maxSteerForce: 3,
  alignWeight: 1,
  cohesionWeight: 1,
  separateWeight: 1.35,
  targetWeight: 0.18,
  boundsRadius: 0.27,
  avoidCollisionWeight: 10,
  collisionAvoidDistance: 5,
  boundaryWeight: 9,
  boundaryMargin: 2,
};

const obstacles = [
  { position: new THREE.Vector3(-4.2, -0.4, -2.4), radius: 1.25 },
  { position: new THREE.Vector3(3.8, 1.2, -1.2), radius: 1.45 },
  { position: new THREE.Vector3(-1.1, 2.2, 3.3), radius: 1.05 },
  { position: new THREE.Vector3(2.1, -2.7, 3.1), radius: 1.25 },
  { position: new THREE.Vector3(0, 0, 0), radius: 1.65 },
];

for (const obstacle of obstacles) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(obstacle.radius, 32, 18),
    obstacleMaterial,
  );
  mesh.position.copy(obstacle.position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

const rayDirections = createRayDirections(300);
const boids = [];
let fishMesh = null;

const tmpVecA = new THREE.Vector3();
const tmpVecB = new THREE.Vector3();
const tmpVecC = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpMatrix = new THREE.Matrix4();
const upAxis = new THREE.Vector3(0, 1, 0);
const forwardAxis = new THREE.Vector3(0, 0, 1);
const unitScale = new THREE.Vector3(1, 1, 1);

const inputs = {
  count: document.querySelector("#count"),
  perception: document.querySelector("#perception"),
  separation: document.querySelector("#separation"),
  avoidance: document.querySelector("#avoidance"),
};

const outputs = {
  count: document.querySelector("#count-value"),
  perception: document.querySelector("#perception-value"),
  separation: document.querySelector("#separation-value"),
  avoidance: document.querySelector("#avoidance-value"),
};

for (const [key, input] of Object.entries(inputs)) {
  input.addEventListener("input", () => {
    outputs[key].value = input.value;

    if (key === "count") {
      resetBoids(Number(input.value));
      return;
    }

    settings.perceptionRadius = Number(inputs.perception.value);
    settings.separateWeight = Number(inputs.separation.value);
    settings.avoidCollisionWeight = Number(inputs.avoidance.value);
  });
}

document.querySelector("#reset").addEventListener("click", () => {
  resetBoids(Number(inputs.count.value));
});

resetBoids(Number(inputs.count.value));
resize();
window.addEventListener("resize", resize);
renderer.setAnimationLoop(animate);

function resetBoids(count) {
  boids.length = 0;
  const random = mulberry32(42);

  if (fishMesh) {
    scene.remove(fishMesh);
    fishMesh.geometry.dispose();
    fishMesh.material.dispose();
  }

  fishMesh = new THREE.InstancedMesh(fishGeometry.clone(), fishMaterial.clone(), count);
  fishMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fishMesh.castShadow = true;
  scene.add(fishMesh);

  for (let i = 0; i < count; i += 1) {
    const position = randomPointInBox(random, worldHalfSize, 0.62);
    const direction = randomPointInSphere(random, 1).normalize();
    const speed = THREE.MathUtils.lerp(settings.minSpeed, settings.maxSpeed, random());
    const velocity = direction.multiplyScalar(speed);
    boids.push({ position, velocity });
    fishMesh.setColorAt(
      i,
      i === highlightedFishIndex ? highlightedFishColor : fishColor,
    );
  }
  fishMesh.instanceColor.needsUpdate = true;

  updateInstances();
}

function animate() {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  updateBoids(dt);
  updateInstances();
  controls.update();
  renderer.render(scene, camera);
}

function updateBoids(dt) {
  const nextVelocities = new Array(boids.length);
  const nextPositions = new Array(boids.length);

  for (let i = 0; i < boids.length; i += 1) {
    const boid = boids[i];
    const acceleration = new THREE.Vector3();
    const headingSum = new THREE.Vector3();
    const centerSum = new THREE.Vector3();
    const avoidanceSum = new THREE.Vector3();
    let neighborCount = 0;

    for (let j = 0; j < boids.length; j += 1) {
      if (i === j) continue;
      const other = boids[j];
      const offset = tmpVecA.subVectors(other.position, boid.position);
      const distanceSq = offset.lengthSq();

      if (distanceSq < settings.perceptionRadius * settings.perceptionRadius) {
        neighborCount += 1;
        headingSum.add(tmpVecB.copy(other.velocity).normalize());
        centerSum.add(other.position);

        if (distanceSq < settings.avoidanceRadius * settings.avoidanceRadius) {
          const distance = Math.sqrt(Math.max(distanceSq, 0.0001));
          avoidanceSum.add(tmpVecC.copy(offset).multiplyScalar(-1 / distance));
        }
      }
    }

    if (neighborCount > 0) {
      centerSum.multiplyScalar(1 / neighborCount);
      acceleration.add(
        steerTowards(headingSum, boid.velocity).multiplyScalar(settings.alignWeight),
      );
      acceleration.add(
        steerTowards(centerSum.sub(boid.position), boid.velocity).multiplyScalar(
          settings.cohesionWeight,
        ),
      );
      acceleration.add(
        steerTowards(avoidanceSum, boid.velocity).multiplyScalar(settings.separateWeight),
      );
    }

    acceleration.add(
      steerTowards(tmpVecA.copy(boid.position).multiplyScalar(-1), boid.velocity).multiplyScalar(
        settings.targetWeight,
      ),
    );

    const forward = tmpVecB.copy(boid.velocity).normalize();
    if (isHeadingForCollision(boid.position, forward)) {
      const clearDirection = obstacleRays(boid.position, forward);
      acceleration.add(
        steerTowards(clearDirection, boid.velocity).multiplyScalar(
          settings.avoidCollisionWeight,
        ),
      );
    }

    const boundary = boxBoundarySteer(boid.position, settings.boundaryMargin);
    if (boundary.lengthSq() > 0) {
      acceleration.add(
        steerTowards(boundary, boid.velocity).multiplyScalar(settings.boundaryWeight),
      );
    }

    const velocity = boid.velocity.clone().add(acceleration.multiplyScalar(dt));
    const speed = THREE.MathUtils.clamp(
      velocity.length(),
      settings.minSpeed,
      settings.maxSpeed,
    );
    velocity.normalize().multiplyScalar(speed);

    nextVelocities[i] = velocity;
    nextPositions[i] = boid.position.clone().addScaledVector(velocity, dt);
  }

  for (let i = 0; i < boids.length; i += 1) {
    boids[i].velocity.copy(nextVelocities[i]);
    boids[i].position.copy(nextPositions[i]);
  }
}

function updateInstances() {
  for (let i = 0; i < boids.length; i += 1) {
    const boid = boids[i];
    const direction = tmpVecA.copy(boid.velocity).normalize();
    tmpQuat.setFromUnitVectors(upAxis, direction);
    tmpMatrix.compose(boid.position, tmpQuat, unitScale);
    fishMesh.setMatrixAt(i, tmpMatrix);
  }
  fishMesh.instanceMatrix.needsUpdate = true;
}

function steerTowards(vector, velocity) {
  if (vector.lengthSq() < 0.000001) {
    return new THREE.Vector3();
  }

  const desired = vector.clone().normalize().multiplyScalar(settings.maxSpeed);
  return desired.sub(velocity).clampLength(0, settings.maxSteerForce);
}

function isHeadingForCollision(position, forward) {
  if (rayHitsObstacle(position, forward, settings.collisionAvoidDistance)) {
    return true;
  }

  const end = tmpVecA.copy(position).addScaledVector(
    forward,
    settings.collisionAvoidDistance,
  );
  return !isInsideBox(end, settings.boundsRadius);
}

function obstacleRays(position, forward) {
  tmpQuat.setFromUnitVectors(forwardAxis, forward);

  for (const localDirection of rayDirections) {
    const direction = tmpVecA.copy(localDirection).applyQuaternion(tmpQuat).normalize();
    const end = tmpVecB.copy(position).addScaledVector(
      direction,
      settings.collisionAvoidDistance,
    );

    if (!rayHitsObstacle(position, direction, settings.collisionAvoidDistance)) {
      if (isInsideBox(end, settings.boundsRadius)) {
        return direction.clone();
      }
    }
  }

  return forward.clone();
}

function rayHitsObstacle(origin, direction, maxDistance) {
  for (const obstacle of obstacles) {
    const radius = obstacle.radius + settings.boundsRadius;
    const offset = tmpVecC.subVectors(origin, obstacle.position);
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

function boxBoundarySteer(position, margin) {
  const steer = new THREE.Vector3();

  for (const axis of ["x", "y", "z"]) {
    const innerLimit = worldHalfSize[axis] - margin;

    if (position[axis] > innerLimit) {
      steer[axis] -= (position[axis] - innerLimit) / margin;
    } else if (position[axis] < -innerLimit) {
      steer[axis] += (-innerLimit - position[axis]) / margin;
    }
  }

  return steer;
}

function isInsideBox(point, inset = 0) {
  return (
    Math.abs(point.x) <= worldHalfSize.x - inset &&
    Math.abs(point.y) <= worldHalfSize.y - inset &&
    Math.abs(point.z) <= worldHalfSize.z - inset
  );
}

function createRayDirections(count) {
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

function randomPointInSphere(random, radius) {
  const point = new THREE.Vector3();

  do {
    point.set(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1);
  } while (point.lengthSq() > 1 || point.lengthSq() === 0);

  return point.multiplyScalar(radius);
}

function randomPointInBox(random, halfSize, scale = 1) {
  return new THREE.Vector3(
    (random() * 2 - 1) * halfSize.x * scale,
    (random() * 2 - 1) * halfSize.y * scale,
    (random() * 2 - 1) * halfSize.z * scale,
  );
}

function mulberry32(seed) {
  return function next() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
