import * as THREE from "three";
import { FishSchoolSimulation } from "./fish-school-simulation.js";
import { bindCameraToggle, createCameraRig } from "./camera-rig.js";
import { aquariumHalfSize, fishConfig, obstacles, simulationSettings } from "./config.js";
import {
  createFishMesh,
  disposeFishMesh,
  updateFishInstances,
} from "./fish-renderer.js";
import { createHeadingDebugger } from "./heading-debugger.js";
import {
  addLighting,
  addObstacles,
  addAquarium,
  createRenderer,
  createScene,
} from "./scene-setup.js";

const canvas = document.querySelector("#scene");
const renderer = createRenderer(canvas);
const scene = createScene();
const clock = new THREE.Clock();
const cameraRig = createCameraRig(renderer);
const query = new URLSearchParams(window.location.search);
const headingDebugger = createHeadingDebugger({
  enabled: query.get("debugHeading") === "1",
  frameLimit: Number(query.get("debugFrames")) || undefined,
});
const simulation = new FishSchoolSimulation({
  aquariumHalfSize,
  obstacles,
  settings: simulationSettings,
});

let fishMesh = null;

const inputs = {
  count: document.querySelector("#count"),
  perception: document.querySelector("#perception"),
  separation: document.querySelector("#separation"),
  avoidance: document.querySelector("#avoidance"),
  turnRate: document.querySelector("#turn-rate"),
  light: document.querySelector("#light"),
};

const outputs = {
  count: document.querySelector("#count-value"),
  perception: document.querySelector("#perception-value"),
  separation: document.querySelector("#separation-value"),
  avoidance: document.querySelector("#avoidance-value"),
  turnRate: document.querySelector("#turn-rate-value"),
  light: document.querySelector("#light-value"),
};

const lighting = addLighting(scene);
lighting.setIntensity(Number(inputs.light.value));
const aquariumEffects = addAquarium(scene);
addObstacles(scene, obstacles);
bindControls();
bindCameraToggle(cameraRig);
const cameraPanel = bindCameraPanel(cameraRig);
simulation.reset(Number(inputs.count.value));
rebuildFishMesh();
resize();
window.addEventListener("resize", resize);
renderer.setAnimationLoop(animate);

function bindControls() {
  for (const [key, input] of Object.entries(inputs)) {
    input.addEventListener("input", () => {
      outputs[key].value = input.value;

      if (key === "count") {
        setFishCount(Number(input.value));
        return;
      }

      if (key === "light") {
        lighting.setIntensity(Number(input.value));
        return;
      }

      simulationSettings.perceptionRadius = Number(inputs.perception.value);
      simulationSettings.separateWeight = Number(inputs.separation.value);
      simulationSettings.avoidCollisionWeight = Number(inputs.avoidance.value);
      simulationSettings.maxTurnRate = Number(inputs.turnRate.value);
    });
  }
}

function setFishCount(count) {
  simulation.setCount(count);
  rebuildFishMesh();
}

function rebuildFishMesh() {
  if (fishMesh) {
    scene.remove(fishMesh);
    disposeFishMesh(fishMesh);
  }

  fishMesh = createFishMesh(simulation.fish.length);
  scene.add(fishMesh);
  updateFishInstances(fishMesh, simulation.fish);
  cameraRig.updateFishCamera(simulation.fish[fishConfig.highlightedIndex]);
}

function animate() {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  const time = clock.elapsedTime;
  const trace = simulation.update(dt, {
    traceIndex: headingDebugger?.traceIndex,
  });
  updateFishInstances(fishMesh, simulation.fish);
  aquariumEffects.update(time);
  headingDebugger?.sample({
    dt,
    fish: simulation.fish[fishConfig.highlightedIndex],
    trace,
  });
  cameraRig.updateFishCamera(simulation.fish[fishConfig.highlightedIndex], dt);
  cameraRig.update();
  cameraPanel.update();
  renderer.render(scene, cameraRig.activeCamera);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  cameraRig.resize(width, height);
  renderer.setSize(width, height, false);
  cameraPanel.update();
}

function bindCameraPanel(rig) {
  const modeOutput = document.querySelector("#camera-mode");
  const copyButton = document.querySelector("#copy-camera-json");
  const copyStatus = document.querySelector("#copy-camera-status");
  const transformOutputs = {
    position: document.querySelector("#camera-position"),
    rotation: document.querySelector("#camera-rotation"),
    quaternion: document.querySelector("#camera-quaternion"),
    up: document.querySelector("#camera-up"),
  };
  let copyStatusTimeout = 0;

  copyButton.addEventListener("click", async () => {
    const json = JSON.stringify(readCameraTransformSnapshot(rig), null, 2);
    const copied = await copyText(json);
    copyStatus.textContent = copied ? "Copied camera JSON" : "Copy failed";
    window.clearTimeout(copyStatusTimeout);
    copyStatusTimeout = window.setTimeout(() => {
      copyStatus.textContent = "";
    }, 1800);
  });

  function update() {
    const camera = rig.activeCamera;

    modeOutput.textContent = `mode: ${rig.mode}`;
    syncTransformOutputs(camera);
  }

  function syncTransformOutputs(camera) {
    transformOutputs.position.textContent = formatVector(camera.position);
    transformOutputs.rotation.textContent = formatRotation(camera.rotation);
    transformOutputs.quaternion.textContent = formatQuaternion(camera.quaternion);
    transformOutputs.up.textContent = formatVector(camera.up);
  }

  update();
  return { update };
}

function readCameraTransformSnapshot(rig) {
  const camera = rig.activeCamera;

  return {
    mode: rig.mode,
    transform: {
      position: vectorToJSON(camera.position),
      rotation: {
        x: roundCameraNumber(camera.rotation.x),
        y: roundCameraNumber(camera.rotation.y),
        z: roundCameraNumber(camera.rotation.z),
        order: camera.rotation.order,
      },
      quaternion: {
        x: roundCameraNumber(camera.quaternion.x),
        y: roundCameraNumber(camera.quaternion.y),
        z: roundCameraNumber(camera.quaternion.z),
        w: roundCameraNumber(camera.quaternion.w),
      },
      up: vectorToJSON(camera.up),
    },
  };
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return fallbackCopyText(text);
  }
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-999px";
  document.body.append(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}

function formatVector(vector) {
  return `${formatCameraNumber(vector.x)}, ${formatCameraNumber(vector.y)}, ${formatCameraNumber(vector.z)}`;
}

function formatRotation(rotation) {
  return `${formatCameraNumber(rotation.x)}, ${formatCameraNumber(rotation.y)}, ${formatCameraNumber(rotation.z)} ${rotation.order}`;
}

function formatQuaternion(quaternion) {
  return `${formatCameraNumber(quaternion.x)}, ${formatCameraNumber(quaternion.y)}, ${formatCameraNumber(quaternion.z)}, ${formatCameraNumber(quaternion.w)}`;
}

function vectorToJSON(vector) {
  return {
    x: roundCameraNumber(vector.x),
    y: roundCameraNumber(vector.y),
    z: roundCameraNumber(vector.z),
  };
}

function formatCameraNumber(value) {
  return String(roundCameraNumber(value));
}

function roundCameraNumber(value) {
  return Number(value.toFixed(4));
}
