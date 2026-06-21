import * as THREE from "three";
import { aquariumSize, waterLevelY } from "./config.js";

const SIM_SIZE = 256;
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
  float lap = (4.0 * (left + right + up + down) + upLeft + upRight + downLeft + downRight - 20.0 * c) / 6.0;

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
    float strength = uForce * smoothstep(0.0, 0.08, travel);
    next += strength * exp(-(distanceToPath * distanceToPath) / (uRadius * uRadius));
  }

  float deadzone = 0.0018;
  next *= smoothstep(deadzone, deadzone * 2.4, abs(next));
  vec2 edge = min(vUv, 1.0 - vUv);
  float edgeMask = smoothstep(0.0, 0.045, min(edge.x, edge.y));
  next *= mix(0.86, 1.0, edgeMask);
  next = clamp(next, -2.5, 2.5);

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
  vNormal = normalize(normalMatrix * vec3(-(right - left) * 4.0, -(up - down) * 4.0, 1.0));
  vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const waterFragmentShader = `
precision highp float;

uniform vec3 uBaseColor;
uniform vec3 uHighlightColor;
uniform float uTime;
varying vec2 vUv;
varying float vHeight;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  vec3 lightDirection = normalize(vec3(0.35, 0.85, 0.42));
  float fresnel = pow(1.0 - clamp(dot(normal, viewDirection), 0.0, 1.0), 3.0);
  float specular = pow(max(dot(reflect(-lightDirection, normal), viewDirection), 0.0), 80.0);
  float wave = smoothstep(0.0, 0.05, abs(vHeight));
  float shimmer = sin((vUv.x * 18.0 + vUv.y * 13.0) + uTime * 1.6) * 0.025;

  vec3 color = mix(uBaseColor, uHighlightColor, wave);
  color += vec3(0.18, 0.32, 0.42) * fresnel;
  color += vec3(0.95, 1.0, 0.92) * specular * (0.35 + wave);
  color += shimmer;

  float alpha = mix(0.34, 0.58, clamp(wave + fresnel * 0.65, 0.0, 1.0));
  gl_FragColor = vec4(color, alpha);
}
`;

export function createWaterSurface(renderer) {
  const impacts = new Float32Array(MAX_IMPACTS * 4);
  const queuedImpacts = [];

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
      uWaveSpeed: { value: 0.31 },
      uDampSmall: { value: 0.875 },
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
      uBaseColor: { value: new THREE.Color(0x1c8fb3) },
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
    const impactTo = { x: to.x, z: to.z };
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    if (dx * dx + dz * dz < 0.000001) impactTo.x += 0.18;
    queuedImpacts.push({
      from: new THREE.Vector2(from.x, from.z),
      to: new THREE.Vector2(impactTo.x, impactTo.z),
    });
    if (queuedImpacts.length > MAX_IMPACTS * 2) {
      queuedImpacts.splice(0, queuedImpacts.length - MAX_IMPACTS * 2);
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
      impacts[offset] = impact.from.x;
      impacts[offset + 1] = impact.from.y;
      impacts[offset + 2] = impact.to.x;
      impacts[offset + 3] = impact.to.y;
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
