import * as THREE from "three";
import { aquariumSize, waterLevelY } from "./config.js";

const SIM_SIZE = 384;
const MAX_IMPACTS = 24;

const quadVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const simulationFragmentShader = `
precision highp float;

varying vec2 vUv;
uniform sampler2D uPrevious;
uniform vec2 uTexel;
uniform vec2 uWorldSize;
uniform vec4 uImpacts[24];
uniform float uImpactCount;
uniform float uWaveSpeed;
uniform float uDampSmall;
uniform float uDampLarge;
uniform float uAmpThresh;
uniform float uRadius;
uniform float uForce;

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  float c = texture2D(uPrevious, vUv).r;
  float old = texture2D(uPrevious, vUv).g;

  float left = texture2D(uPrevious, vUv + vec2(-uTexel.x, 0.0)).r;
  float right = texture2D(uPrevious, vUv + vec2(uTexel.x, 0.0)).r;
  float up = texture2D(uPrevious, vUv + vec2(0.0, uTexel.y)).r;
  float down = texture2D(uPrevious, vUv + vec2(0.0, -uTexel.y)).r;
  float upLeft = texture2D(uPrevious, vUv + vec2(-uTexel.x, uTexel.y)).r;
  float upRight = texture2D(uPrevious, vUv + vec2(uTexel.x, uTexel.y)).r;
  float downLeft = texture2D(uPrevious, vUv + vec2(-uTexel.x, -uTexel.y)).r;
  float downRight = texture2D(uPrevious, vUv + vec2(uTexel.x, -uTexel.y)).r;
  float lap = 0.2 * (left + right + up + down) + 0.05 * (upLeft + upRight + downLeft + downRight) - c;

  float next = 2.0 * c - old + uWaveSpeed * lap;
  float amp = abs(next);
  next *= mix(uDampSmall, uDampLarge, smoothstep(0.0, uAmpThresh, amp));

  vec2 p = vec2((vUv.x - 0.5) * uWorldSize.x, (0.5 - vUv.y) * uWorldSize.y);
  for (int i = 0; i < 24; i += 1) {
    if (float(i) >= uImpactCount) break;
    vec4 impact = uImpacts[i];
    vec2 a = impact.xy;
    vec2 b = impact.zw;
    float distanceToPath = sdSegment(p, a, b);
    float travel = length(b - a);
    float source = smoothstep(uRadius, 0.0, distanceToPath);
    float falloff = exp(-(distanceToPath * distanceToPath) / max(uRadius * uRadius, 0.0001));
    float strength = uForce * mix(0.42, 1.0, smoothstep(0.0, 0.16, travel));
    next += strength * mix(source, falloff, 0.28);
  }

  float deadzone = 0.0032;
  next *= smoothstep(deadzone, deadzone * 2.2, abs(next));
  vec2 edge = min(vUv, 1.0 - vUv);
  float edgeMask = smoothstep(0.0, 0.05, min(edge.x, edge.y));
  next *= mix(0.90, 1.0, edgeMask);
  next = clamp(next, -1.5, 1.5);

  gl_FragColor = vec4(next, c, 0.0, 1.0);
}
`;

const waterVertexShader = `
uniform sampler2D uHeight;
uniform vec2 uTexel;
uniform float uDisplacement;
varying vec2 vUv;
varying float vHeight;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
  vUv = uv;
  float h = texture2D(uHeight, uv).r;
  float left = texture2D(uHeight, uv + vec2(-uTexel.x, 0.0)).r;
  float right = texture2D(uHeight, uv + vec2(uTexel.x, 0.0)).r;
  float up = texture2D(uHeight, uv + vec2(0.0, uTexel.y)).r;
  float down = texture2D(uHeight, uv + vec2(0.0, -uTexel.y)).r;
  vec3 transformed = position;
  transformed.z += h * uDisplacement;

  vHeight = h;
  vec3 localNormal = normalize(vec3(-(right - left) * 7.0, -(up - down) * 7.0, 1.0));
  vNormal = normalize((modelMatrix * vec4(localNormal, 0.0)).xyz);
  vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const waterFragmentShader = `
precision highp float;

uniform vec3 uBaseColor;
uniform vec3 uHighlightColor;
uniform sampler2D uHeight;
uniform vec2 uTexel;
uniform float uTime;
varying vec2 vUv;
varying float vHeight;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  vec3 lightDirection = normalize(vec3(0.35, 0.85, 0.42));
  vec3 fillLight = normalize(vec3(-0.55, 0.36, 0.72));
  float fresnel = pow(1.0 - clamp(dot(normal, viewDirection), 0.0, 1.0), 3.0);
  float sharpSpecular = pow(max(dot(reflect(-lightDirection, normal), viewDirection), 0.0), 96.0);
  float broadSheen = pow(max(dot(reflect(-fillLight, normal), viewDirection), 0.0), 14.0);

  float hCenter = texture2D(uHeight, vUv).r;
  float hLeft = texture2D(uHeight, vUv - vec2(uTexel.x, 0.0)).r;
  float hRight = texture2D(uHeight, vUv + vec2(uTexel.x, 0.0)).r;
  float hDown = texture2D(uHeight, vUv - vec2(0.0, uTexel.y)).r;
  float hUp = texture2D(uHeight, vUv + vec2(0.0, uTexel.y)).r;
  vec2 grad = vec2(hRight - hLeft, hUp - hDown);
  float curvature = abs(hLeft + hRight + hUp + hDown - 4.0 * hCenter);
  float crest = clamp(hCenter * 1.25, -1.0, 1.0);
  float wave = clamp(
    smoothstep(0.006, 0.055, abs(hCenter)) +
    smoothstep(0.004, 0.035, curvature) * 0.72 +
    smoothstep(0.012, 0.09, length(grad)) * 0.45,
    0.0,
    1.0
  );
  float shimmer = sin((vUv.x * 26.0 + vUv.y * 19.0) + uTime * 1.7) * 0.012;

  vec3 warmCrest = vec3(1.04, 1.0, 0.94);
  vec3 coolTrough = vec3(0.76, 0.92, 1.08);
  vec3 waterTint = mix(coolTrough, warmCrest, crest * 0.5 + 0.5);
  vec3 color = mix(uBaseColor, uHighlightColor, wave * 0.58);
  color *= mix(vec3(1.0), waterTint, 0.32);
  color += vec3(0.18, 0.32, 0.42) * fresnel * 0.8;
  color += vec3(0.96, 1.0, 0.92) * sharpSpecular * (0.42 + wave * 0.8);
  color += vec3(0.72, 0.9, 1.0) * broadSheen * 0.18;
  color += shimmer * (0.25 + wave);

  float alpha = 0.12 + fresnel * 0.18 + wave * 0.28 + sharpSpecular * 0.16;
  gl_FragColor = vec4(color, clamp(alpha, 0.10, 0.52));
}
`;

export function createWaterSurface(renderer) {
  const impacts = new Float32Array(MAX_IMPACTS * 4);
  // Pooled impact holders (plain number fields) so queueImpact runs without
  // per-call heap allocation — it can fire once per near-surface fish/frame.
  const queuedImpacts = [];
  const impactPool = [];

  function acquireImpact() {
    return impactPool.pop() ?? { fromX: 0, fromZ: 0, toX: 0, toZ: 0 };
  }

  const simulationScene = new THREE.Scene();
  const simulationCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const simulationGeometry = new THREE.PlaneGeometry(2, 2);

  const targetOptions = {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
  };
  let readTarget = new THREE.WebGLRenderTarget(SIM_SIZE, SIM_SIZE, targetOptions);
  let writeTarget = readTarget.clone();

  const simulationMaterial = new THREE.ShaderMaterial({
    vertexShader: quadVertexShader,
    fragmentShader: simulationFragmentShader,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uPrevious: { value: null },
      uTexel: { value: new THREE.Vector2(1 / SIM_SIZE, 1 / SIM_SIZE) },
      uWorldSize: { value: new THREE.Vector2(aquariumSize.x, aquariumSize.z) },
      uImpacts: { value: impacts },
      uImpactCount: { value: 0 },
      uWaveSpeed: { value: 1.68 },
      uDampSmall: { value: 0.90 },
      uDampLarge: { value: 0.94 },
      uAmpThresh: { value: 0.12 },
      uRadius: { value: 0.42 },
      uForce: { value: 0.085 },
    },
  });
  simulationScene.add(new THREE.Mesh(simulationGeometry, simulationMaterial));

  const material = new THREE.ShaderMaterial({
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uHeight: { value: readTarget.texture },
      uTexel: { value: new THREE.Vector2(1 / SIM_SIZE, 1 / SIM_SIZE) },
      uDisplacement: { value: 0.34 },
      uBaseColor: { value: new THREE.Color(0x126d8c) },
      uHighlightColor: { value: new THREE.Color(0xd8fbff) },
      uTime: { value: 0 },
    },
  });

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(aquariumSize.x, aquariumSize.z, 180, 140),
    material,
  );
  mesh.name = "Ripple water surface";
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = waterLevelY;
  mesh.renderOrder = 2;

  clearTarget(readTarget);
  clearTarget(writeTarget);

  function clearTarget(target) {
    const previousTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.setRenderTarget(previousTarget);
  }

  function queueImpact(from, to = from) {
    if (!isInsideWater(to)) return;
    let toX = to.x;
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    if (dx * dx + dz * dz < 0.000001) toX += 0.18;

    const impact = acquireImpact();
    impact.fromX = from.x;
    impact.fromZ = from.z;
    impact.toX = toX;
    impact.toZ = to.z;
    queuedImpacts.push(impact);

    if (queuedImpacts.length > MAX_IMPACTS * 2) {
      const dropped = queuedImpacts.splice(0, queuedImpacts.length - MAX_IMPACTS * 2);
      for (let i = 0; i < dropped.length; i += 1) {
        impactPool.push(dropped[i]);
      }
    }
  }

  function isInsideWater(point) {
    return (
      Math.abs(point.x) <= aquariumSize.x * 0.5 &&
      Math.abs(point.z) <= aquariumSize.z * 0.5
    );
  }

  function update(time) {
    const count = Math.min(queuedImpacts.length, MAX_IMPACTS);
    for (let i = 0; i < count; i += 1) {
      const impact = queuedImpacts.shift();
      const offset = i * 4;
      impacts[offset] = impact.fromX;
      impacts[offset + 1] = impact.fromZ;
      impacts[offset + 2] = impact.toX;
      impacts[offset + 3] = impact.toZ;
      impactPool.push(impact);
    }

    simulationMaterial.uniforms.uPrevious.value = readTarget.texture;
    simulationMaterial.uniforms.uImpactCount.value = count;
    simulationMaterial.uniforms.uImpacts.needsUpdate = true;

    const previousTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(writeTarget);
    renderer.render(simulationScene, simulationCamera);
    renderer.setRenderTarget(previousTarget);

    const swap = readTarget;
    readTarget = writeTarget;
    writeTarget = swap;

    material.uniforms.uHeight.value = readTarget.texture;
    material.uniforms.uTime.value = time;
  }

  function setSettings(settings) {
    if (Number.isFinite(settings.force)) {
      simulationMaterial.uniforms.uForce.value = settings.force;
    }
    if (Number.isFinite(settings.radius)) {
      simulationMaterial.uniforms.uRadius.value = settings.radius;
    }
    if (Number.isFinite(settings.displacement)) {
      material.uniforms.uDisplacement.value = settings.displacement;
    }
    if (Number.isFinite(settings.persistence)) {
      simulationMaterial.uniforms.uDampLarge.value = settings.persistence;
    }
  }

  function dispose() {
    simulationGeometry.dispose();
    simulationMaterial.dispose();
    mesh.geometry.dispose();
    material.dispose();
    readTarget.dispose();
    writeTarget.dispose();
  }

  return {
    mesh,
    update,
    queueImpact,
    setSettings,
    dispose,
  };
}
