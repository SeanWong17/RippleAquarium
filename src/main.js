import * as THREE from "three";
import { FishSchoolSimulation } from "./fish-school-simulation.js";
import { bindCameraToggle, createCameraRig } from "./camera-rig.js";
import {
  aquariumHalfSize,
  coneConfig,
  fishConfig,
  obstacles,
  simulationSettings,
  waterLevelY,
} from "./config.js";
import {
  createConeSchoolMesh,
  createFishMesh,
  disposeConeSchoolMesh,
  disposeFishMesh,
  loadFishModel,
  updateConeSchoolInstances,
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

const STEP_FRAME_SECONDS = 1 / 60;
const app = getRequiredElement("#app");
const canvas = getRequiredElement("#scene");
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

const controls = {
  count: createControl("#count", "#count-value"),
  cones: createControl("#cones", "#cones-value"),
  perception: createControl("#perception", "#perception-value"),
  separation: createControl("#separation", "#separation-value"),
  avoidance: createControl("#avoidance", "#avoidance-value"),
  turnRate: createControl("#turn-rate", "#turn-rate-value"),
  topMargin: createControl("#top-margin", "#top-margin-value"),
  waterForce: createControl("#water-force", "#water-force-value"),
  waterRadius: createControl("#water-radius", "#water-radius-value"),
  waterHeight: createControl("#water-height", "#water-height-value"),
  waterPersistence: createControl("#water-persistence", "#water-persistence-value"),
  surfaceBand: createControl("#surface-band", "#surface-band-value"),
  light: createControl("#light", "#light-value"),
};

const simulationControlSettings = {
  perception: "perceptionRadius",
  separation: "separateWeight",
  avoidance: "avoidCollisionWeight",
  turnRate: "maxTurnRate",
  topMargin: "topBoundaryMargin",
};

let fishMesh = null;
let coneSchoolMesh = null;
let simulationPaused = false;
let pendingSimulationSteps = 0;
let simulationTime = 0;
const waterPointer = {
  raycaster: new THREE.Raycaster(),
  pointer: new THREE.Vector2(),
  previousPoint: null,
};
const waterInteraction = {
  surfaceBand: 0.72,
};
const fishSurfaceState = new WeakMap();

const lighting = addLighting(scene);
lighting.setIntensity(readControlValue("light"));
const aquariumEffects = addAquarium(scene, renderer);
addObstacles(scene, obstacles);
applySimulationSettingsFromControls();
applyWaterSettingsFromControls();
bindControls();
bindPlaybackControls();
bindCameraToggle(cameraRig);
bindUiPanelShortcuts();
bindControlsPanel();
bindWaterPointer();
const cameraPanel = bindCameraPanel(cameraRig);
const modelLoading = bindModelLoading();
try {
  await loadFishModel();
} finally {
  modelLoading.finish();
}
simulation.reset(readControlValue("count"));
syncConeControlLimit();
rebuildFishMesh();
resize();
window.addEventListener("resize", resize);
renderer.setAnimationLoop(animate);

function bindControls() {
  for (const [key, control] of Object.entries(controls)) {
    syncControlOutput(control);
    control.input.addEventListener("input", () => {
      syncControlOutput(control);
      applyControlChange(key);
    });
  }
}

function bindPlaybackControls() {
  const toggleButton = getRequiredElement("#playback-toggle");
  const stepButton = getRequiredElement("#step-frame");

  toggleButton.addEventListener("click", () => {
    simulationPaused = !simulationPaused;
    if (!simulationPaused) {
      pendingSimulationSteps = 0;
    }
    syncPlaybackControls(toggleButton, stepButton);
  });

  stepButton.addEventListener("click", () => {
    if (!simulationPaused) return;

    pendingSimulationSteps += 1;
  });

  syncPlaybackControls(toggleButton, stepButton);
}

function bindUiPanelShortcuts() {
  window.addEventListener("keydown", (event) => {
    if (event.repeat) return;

    if (event.key === "2") {
      event.preventDefault();
      app.dataset.uiPanels = "hidden";
    } else if (event.key === "1") {
      event.preventDefault();
      app.dataset.uiPanels = "visible";
    }
  });
}

function bindControlsPanel() {
  const toggleButton = getRequiredElement("#controls-toggle");
  let hidden = false;

  toggleButton.addEventListener("click", () => {
    hidden = !hidden;
    app.dataset.controlsPanel = hidden ? "hidden" : "visible";
    toggleButton.textContent = hidden ? "显示参数" : "隐藏参数";
    toggleButton.setAttribute("aria-expanded", String(!hidden));
  });
}

function bindWaterPointer() {
  canvas.addEventListener("pointerdown", (event) => {
    if (event.target !== canvas) return;

    const point = getWaterIntersection(event);
    if (!point) return;

    aquariumEffects.waterSurface.queueImpact(point);
    waterPointer.previousPoint = point.clone();
  });

  canvas.addEventListener("pointermove", (event) => {
    if ((event.buttons & 1) === 0 || !waterPointer.previousPoint) return;

    const point = getWaterIntersection(event);
    if (!point) return;

    aquariumEffects.waterSurface.queueImpact(waterPointer.previousPoint, point);
    waterPointer.previousPoint.copy(point);
  });

  window.addEventListener("pointerup", () => {
    waterPointer.previousPoint = null;
  });
  window.addEventListener("pointercancel", () => {
    waterPointer.previousPoint = null;
  });
}

function getWaterIntersection(event) {
  const rect = canvas.getBoundingClientRect();
  waterPointer.pointer.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  waterPointer.raycaster.setFromCamera(waterPointer.pointer, cameraRig.activeCamera);

  const directionY = waterPointer.raycaster.ray.direction.y;
  if (Math.abs(directionY) < 0.000001) return null;

  const distance = (waterLevelY - waterPointer.raycaster.ray.origin.y) / directionY;
  if (distance < 0) return null;

  const point = waterPointer.raycaster.ray.at(distance, new THREE.Vector3());
  if (
    Math.abs(point.x) > aquariumHalfSize.x ||
    Math.abs(point.z) > aquariumHalfSize.z
  ) {
    return null;
  }

  return point;
}

function queueFishSurfaceImpacts(fish) {
  const surfaceBand = waterInteraction.surfaceBand;
  const cooldownSeconds = 0.16;

  for (const item of fish) {
    const distanceToSurface = waterLevelY - item.position.y;
    const previous = fishSurfaceState.get(item);

    if (
      distanceToSurface >= 0 &&
      distanceToSurface < surfaceBand &&
      item.velocity.y > -0.08 &&
      (!previous || simulationTime - previous.time > cooldownSeconds)
    ) {
      const previousPoint = previous?.point ?? item.position;
      aquariumEffects.waterSurface.queueImpact(previousPoint, item.position);
      fishSurfaceState.set(item, {
        time: simulationTime,
        point: item.position.clone(),
      });
      continue;
    }

    if (!previous) {
      fishSurfaceState.set(item, {
        time: -Infinity,
        point: item.position.clone(),
      });
    } else {
      previous.point.copy(item.position);
    }
  }
}

function syncPlaybackControls(toggleButton, stepButton) {
  toggleButton.textContent = simulationPaused ? "继续" : "暂停";
  toggleButton.setAttribute("aria-pressed", String(simulationPaused));
  stepButton.disabled = !simulationPaused;
}

function applyControlChange(key) {
  if (key === "count") {
    setFishCount(readControlValue(key));
    return;
  }

  if (key === "cones") {
    setConeCount(readControlValue(key));
    return;
  }

  if (key === "light") {
    lighting.setIntensity(readControlValue(key));
    return;
  }

  if (key.startsWith("water") || key === "surfaceBand") {
    applyWaterSettingsFromControls();
    return;
  }

  applySimulationSettingsFromControls();
}

function applySimulationSettingsFromControls() {
  for (const [key, settingName] of Object.entries(simulationControlSettings)) {
    simulationSettings[settingName] = readControlValue(key);
  }
}

function applyWaterSettingsFromControls() {
  waterInteraction.surfaceBand = readControlValue("surfaceBand");
  aquariumEffects.waterSurface.setSettings({
    force: readControlValue("waterForce"),
    radius: readControlValue("waterRadius"),
    displacement: readControlValue("waterHeight"),
    persistence: readControlValue("waterPersistence"),
  });
}

function setFishCount(count) {
  simulation.setCount(count);
  syncConeControlLimit();
  rebuildFishMesh();
}

function setConeCount(count) {
  coneConfig.count = normalizeConeCount(count);
  syncConeControlLimit();
  rebuildFishMesh();
}

function rebuildFishMesh() {
  if (fishMesh) {
    scene.remove(fishMesh);
    disposeFishMesh(fishMesh);
  }
  if (coneSchoolMesh) {
    scene.remove(coneSchoolMesh);
    disposeConeSchoolMesh(coneSchoolMesh);
  }

  const schools = splitRenderableSchools(simulation.fish);

  fishMesh = createFishMesh(schools.fish.length);
  scene.add(fishMesh);
  updateFishInstances(fishMesh, schools.fish);

  coneSchoolMesh = createConeSchoolMesh(schools.cones.length);
  scene.add(coneSchoolMesh);
  updateConeSchoolInstances(coneSchoolMesh, schools.cones);
  cameraRig.updateFishCamera(simulation.fish[fishConfig.highlightedIndex]);
}

function animate() {
  const frameDt = Math.min(clock.getDelta(), 1 / 30);
  const simulationDt = getSimulationDelta(frameDt);
  let trace = null;

  if (simulationDt > 0) {
    simulationTime += simulationDt;
    trace = simulation.update(simulationDt, {
      traceIndex: headingDebugger?.traceIndex,
    });
    const schools = splitRenderableSchools(simulation.fish);
    updateFishInstances(fishMesh, schools.fish);
    updateConeSchoolInstances(coneSchoolMesh, schools.cones);
    queueFishSurfaceImpacts(simulation.fish);
    headingDebugger?.sample({
      dt: simulationDt,
      fish: simulation.fish[fishConfig.highlightedIndex],
      trace,
    });
    cameraRig.updateFishCamera(
      simulation.fish[fishConfig.highlightedIndex],
      simulationDt,
    );
  }

  aquariumEffects.update(simulationTime);
  cameraRig.update();
  cameraPanel.update();
  renderer.render(scene, cameraRig.activeCamera);
}

function splitRenderableSchools(fish) {
  const coneCount = Math.min(
    coneConfig.count,
    Math.max(0, fish.length - 1),
  );
  const fishCount = fish.length - coneCount;

  return {
    fish: fish.slice(0, fishCount),
    cones: fish.slice(fishCount),
  };
}

function syncConeControlLimit() {
  const control = controls.cones;
  const maxConeCount = Math.max(0, simulation.fish.length - 1);
  const coneCount = Math.min(
    normalizeConeCount(readInputNumber(control.input)),
    maxConeCount,
  );

  control.input.max = String(maxConeCount);
  control.input.value = String(coneCount);
  coneConfig.count = coneCount;
  syncControlOutput(control);
}

function normalizeConeCount(count) {
  if (!Number.isFinite(count)) {
    return coneConfig.count;
  }

  return Math.max(0, Math.floor(count));
}

function getSimulationDelta(frameDt) {
  if (!simulationPaused) {
    return frameDt;
  }

  if (pendingSimulationSteps <= 0) {
    return 0;
  }

  pendingSimulationSteps -= 1;
  return STEP_FRAME_SECONDS;
}

function resize() {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  cameraRig.resize(width, height);
  renderer.setSize(width, height, false);
  cameraPanel.update();
}

function bindCameraPanel(rig) {
  const copyButton = getRequiredElement("#copy-camera-json");
  const copyStatus = getRequiredElement("#copy-camera-status");
  let copyStatusTimeout = 0;

  copyButton.addEventListener("click", async () => {
    const json = JSON.stringify(readCameraTransformSnapshot(rig), null, 2);
    const copied = await copyText(json);
    copyStatus.textContent = copied ? "已复制相机参数" : "复制失败";
    window.clearTimeout(copyStatusTimeout);
    copyStatusTimeout = window.setTimeout(() => {
      copyStatus.textContent = "";
    }, 1800);
  });

  return { update() {} };
}

function bindModelLoading() {
  const container = getRequiredElement("#model-loading");

  return {
    finish() {
      container.classList.add("is-complete");
      container.setAttribute("aria-hidden", "true");
      container.hidden = true;
    },
  };
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
  if (!navigator.clipboard?.writeText) {
    return fallbackCopyText(text);
  }

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
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}

function vectorToJSON(vector) {
  return {
    x: roundCameraNumber(vector.x),
    y: roundCameraNumber(vector.y),
    z: roundCameraNumber(vector.z),
  };
}

function roundCameraNumber(value) {
  return Number(value.toFixed(4));
}

function createControl(inputSelector, outputSelector) {
  return {
    input: getRequiredInput(inputSelector),
    output: getRequiredElement(outputSelector),
  };
}

function syncControlOutput({ input, output }) {
  output.value = input.value;
}

function readControlValue(key) {
  return readInputNumber(controls[key].input);
}

function readInputNumber(input) {
  if (Number.isFinite(input.valueAsNumber)) {
    return input.valueAsNumber;
  }

  const defaultValue = Number(input.defaultValue);
  return Number.isFinite(defaultValue) ? defaultValue : 0;
}

function getRequiredElement(selector) {
  const element = document.querySelector(selector);

  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element;
}

function getRequiredInput(selector) {
  const element = getRequiredElement(selector);

  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`Expected ${selector} to be an input element.`);
  }

  return element;
}
