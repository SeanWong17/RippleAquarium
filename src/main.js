import * as THREE from "three";
import { FishSchoolSimulation } from "./fish-school-simulation.js";
import { bindCameraToggle, createCameraRig } from "./camera-rig.js";
import { createClownfishSchool } from "./clownfish-school.js";
import { createCoralReef } from "./coral-reef.js";
import { createPineappleHouseDecor } from "./decor/pineapple-house.js";
import { createSpongebobPatrickDecor } from "./decor/spongebob-patrick.js";
import {
  aquariumHalfSize,
  coralExclusionZones,
  fishConfig,
  obstacles,
  simulationSettings,
  waterLevelY,
} from "./config.js";
import {
  createFishMeshByKey,
  disposeFishMesh,
  loadFishModel,
  updateFishInstances,
} from "./fish-renderer.js";
import { createHeadingDebugger } from "./heading-debugger.js";
import {
  applyTranslations,
  getLanguage,
  setLanguage,
  t,
} from "./i18n.js";
import {
  addLighting,
  addObstacles,
  addAquarium,
  createRenderer,
  createScene,
} from "./scene-setup.js";

const STEP_FRAME_SECONDS = 1 / 60;
const baseMinSpeed = simulationSettings.minSpeed;
const baseMaxSpeed = simulationSettings.maxSpeed;
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
const koiSettings = { ...simulationSettings };
const koiSimulation = new FishSchoolSimulation({
  aquariumHalfSize,
  obstacles,
  settings: koiSettings,
});

const controls = {
  count: createControl("#count", "#count-value"),
  koiCount: createControl("#koi-count", "#koi-count-value"),
  perception: createControl("#perception", "#perception-value"),
  speedScale: createControl("#speed-scale", "#speed-scale-value"),
  separation: createControl("#separation", "#separation-value"),
  avoidance: createControl("#avoidance", "#avoidance-value"),
  turnRate: createControl("#turn-rate", "#turn-rate-value"),
  topMargin: createControl("#top-margin", "#top-margin-value"),
  koiPerception: createControl("#koi-perception", "#koi-perception-value"),
  koiSeparation: createControl("#koi-separation", "#koi-separation-value"),
  koiAvoidance: createControl("#koi-avoidance", "#koi-avoidance-value"),
  koiTurnRate: createControl("#koi-turn-rate", "#koi-turn-rate-value"),
  koiTopMargin: createControl("#koi-top-margin", "#koi-top-margin-value"),
  koiSpeedScale: createControl("#koi-speed-scale", "#koi-speed-scale-value"),
  waterForce: createControl("#water-force", "#water-force-value"),
  waterRadius: createControl("#water-radius", "#water-radius-value"),
  waterHeight: createControl("#water-height", "#water-height-value"),
  waterPersistence: createControl("#water-persistence", "#water-persistence-value"),
  surfaceBand: createControl("#surface-band", "#surface-band-value"),
  coralCount: createControl("#coral-count", "#coral-count-value"),
  coralScale: createControl("#coral-scale", "#coral-scale-value"),
  clownfishCount: createControl("#clownfish-count", "#clownfish-count-value"),
  light: createControl("#light", "#light-value"),
};

const simulationControlSettings = {
  perception: "perceptionRadius",
  separation: "separateWeight",
  avoidance: "avoidCollisionWeight",
  turnRate: "maxTurnRate",
  topMargin: "topBoundaryMargin",
};
const koiControlSettings = {
  koiPerception: "perceptionRadius",
  koiSeparation: "separateWeight",
  koiAvoidance: "avoidCollisionWeight",
  koiTurnRate: "maxTurnRate",
  koiTopMargin: "topBoundaryMargin",
};

let fishMesh = null;
let koiMesh = null;
let clownfishSchool = null;
let coralReef = null;
let coralIntro = null;
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
let controlsPanelHidden = false;

const lighting = addLighting(scene);
lighting.setIntensity(readControlValue("light"));
const aquariumEffects = addAquarium(scene, renderer);
addObstacles(scene, obstacles);
applySimulationSettingsFromControls();
applyKoiSettingsFromControls();
applyWaterSettingsFromControls();
bindControls();
bindPlaybackControls();
bindCameraToggle(cameraRig);
bindUiPanelShortcuts();
bindControlsPanel();
bindLanguageSwitcher();
bindWaterPointer();
const cameraPanel = bindCameraPanel(cameraRig);
const modelLoading = bindModelLoading();
try {
  const [, loadedCoralReef, pineappleHouse, spongebobPatrick] = await Promise.all([
    loadFishModel(),
    createCoralReef({
      count: 0,
      scale: 0,
      maxCount: Number(controls.coralCount.input.max),
      exclusionZones: coralExclusionZones,
    }),
    createPineappleHouseDecor(),
    createSpongebobPatrickDecor(),
  ]);
  scene.add(pineappleHouse);
  if (spongebobPatrick) {
    scene.add(spongebobPatrick);
  }
  coralReef = loadedCoralReef;
  scene.add(coralReef.group);
  clownfishSchool = createClownfishSchool(coralReef, {
    count: readControlValue("clownfishCount"),
  });
  scene.add(clownfishSchool.mesh);
  startCoralIntro();
} finally {
  modelLoading.finish();
}
simulation.reset(readControlValue("count"));
koiSimulation.reset(readControlValue("koiCount"), 142);
rebuildFishMesh();
rebuildKoiMesh();
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

function bindLanguageSwitcher() {
  applyCurrentLanguage();

  document.querySelectorAll(".lang-btn").forEach((button) => {
    button.addEventListener("click", () => {
      if (!setLanguage(button.dataset.lang)) return;

      applyCurrentLanguage();
    });
  });
}

function applyCurrentLanguage() {
  applyTranslations();
  syncLanguageButtons();
  syncControlsToggle();
  syncPlaybackControls(
    getRequiredElement("#playback-toggle"),
    getRequiredElement("#step-frame"),
  );
}

function syncLanguageButtons() {
  const language = getLanguage();
  document.querySelectorAll(".lang-btn").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.lang === language);
  });
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

  toggleButton.addEventListener("click", () => {
    controlsPanelHidden = !controlsPanelHidden;
    app.dataset.controlsPanel = controlsPanelHidden ? "hidden" : "visible";
    syncControlsToggle();
  });
}

function syncControlsToggle() {
  const toggleButton = getRequiredElement("#controls-toggle");
  toggleButton.textContent = controlsPanelHidden ? t("showParams") : t("hideParams");
  toggleButton.setAttribute("aria-expanded", String(!controlsPanelHidden));
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
  toggleButton.textContent = simulationPaused ? t("resume") : t("pause");
  toggleButton.setAttribute("aria-pressed", String(simulationPaused));
  stepButton.disabled = !simulationPaused;
}

function applyControlChange(key) {
  if (key === "count") {
    setFishCount(readControlValue(key));
    return;
  }

  if (key === "koiCount") {
    setKoiCount(readControlValue(key));
    return;
  }

  if (key === "light") {
    lighting.setIntensity(readControlValue(key));
    return;
  }

  if (key === "clownfishCount") {
    clownfishSchool?.setCount(readControlValue(key));
    return;
  }

  if (key.startsWith("coral")) {
    coralIntro = null;
    applyCoralSettingsFromControls();
    return;
  }

  if (key.startsWith("water") || key === "surfaceBand") {
    applyWaterSettingsFromControls();
    return;
  }

  if (key.startsWith("koi")) {
    applyKoiSettingsFromControls();
    return;
  }

  applySimulationSettingsFromControls();
}

function applySimulationSettingsFromControls() {
  for (const [key, settingName] of Object.entries(simulationControlSettings)) {
    simulationSettings[settingName] = readControlValue(key);
  }
  applySpeedScale(simulationSettings, readControlValue("speedScale"));
}

function applyKoiSettingsFromControls() {
  for (const [key, settingName] of Object.entries(koiControlSettings)) {
    koiSettings[settingName] = readControlValue(key);
  }
  applySpeedScale(koiSettings, readControlValue("koiSpeedScale"));
}

function applySpeedScale(settings, scale) {
  const normalizedScale = Number.isFinite(scale) ? scale : 1;
  settings.minSpeed = baseMinSpeed * normalizedScale;
  settings.maxSpeed = baseMaxSpeed * normalizedScale;
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

function applyCoralSettingsFromControls() {
  coralReef?.rebuild({
    count: readControlValue("coralCount"),
    scale: readControlValue("coralScale"),
    growth: null,
  });
}

function startCoralIntro() {
  coralIntro = {
    startedAt: performance.now(),
    duration: 3600,
    targetCount: readControlValue("coralCount"),
    targetScale: readControlValue("coralScale"),
    growthBuffer: new Array(coralReef.maxCount).fill(0),
  };
  coralReef.rebuild({ count: 0, scale: 0 });
}

function setFishCount(count) {
  simulation.setCount(count);
  rebuildFishMesh();
}

function setKoiCount(count) {
  koiSimulation.setCount(count);
  rebuildKoiMesh();
}

function rebuildFishMesh() {
  if (fishMesh) {
    scene.remove(fishMesh);
    disposeFishMesh(fishMesh);
  }

  fishMesh = createFishMeshByKey(simulation.fish.length, "cartoon");
  scene.add(fishMesh);
  updateFishInstances(fishMesh, simulation.fish);
  cameraRig.updateFishCamera(simulation.fish[fishConfig.highlightedIndex]);
}

function rebuildKoiMesh() {
  if (koiMesh) {
    scene.remove(koiMesh);
    disposeFishMesh(koiMesh);
    koiMesh = null;
  }

  if (koiSimulation.fish.length <= 0) {
    return;
  }

  koiMesh = createFishMeshByKey(koiSimulation.fish.length, "koi");
  scene.add(koiMesh);
  updateFishInstances(koiMesh, koiSimulation.fish);
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
    koiSimulation.update(simulationDt);
    updateFishInstances(fishMesh, simulation.fish);
    if (koiMesh) {
      updateFishInstances(koiMesh, koiSimulation.fish);
    }
    clownfishSchool?.update(simulationTime, simulationDt);
    queueFishSurfaceImpacts(simulation.fish);
    queueFishSurfaceImpacts(koiSimulation.fish);
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

  updateCoralIntro();
  coralReef?.update();
  aquariumEffects.update(simulationTime);
  cameraRig.update();
  cameraPanel.update();
  renderer.render(scene, cameraRig.activeCamera);
}

function updateCoralIntro() {
  if (!coralIntro || !coralReef) return;

  const progress = Math.min(
    1,
    (performance.now() - coralIntro.startedAt) / coralIntro.duration,
  );
  // Reuse a persistent buffer; coralReef holds the reference until the intro
  // ends (growth: null), and we overwrite every entry each frame.
  const growth = coralIntro.growthBuffer;
  let visibleCount = 0;
  for (let index = 0; index < growth.length; index += 1) {
    if (index >= coralIntro.targetCount) {
      growth[index] = 0;
      continue;
    }

    const orderProgress = index / Math.max(1, coralIntro.targetCount - 1);
    const local = THREE.MathUtils.clamp((progress - orderProgress * 0.58) / 0.42, 0, 1);
    const value = local * local * (3 - 2 * local);
    growth[index] = value;
    if (value > 0.001) visibleCount += 1;
  }

  coralReef.rebuild({
    count: visibleCount,
    scale: coralIntro.targetScale,
    growth,
  });

  if (progress >= 1) {
    coralReef.rebuild({
      count: coralIntro.targetCount,
      scale: coralIntro.targetScale,
      growth: null,
    });
    coralIntro = null;
  }
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
    copyStatus.textContent = copied ? t("copySuccess") : t("copyFailed");
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
