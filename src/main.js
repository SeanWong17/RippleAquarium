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
};

const outputs = {
  count: document.querySelector("#count-value"),
  perception: document.querySelector("#perception-value"),
  separation: document.querySelector("#separation-value"),
  avoidance: document.querySelector("#avoidance-value"),
  turnRate: document.querySelector("#turn-rate-value"),
};

addLighting(scene);
addAquarium(scene);
addObstacles(scene, obstacles);
bindControls();
bindCameraToggle(cameraRig);
resetFish(Number(inputs.count.value));
resize();
window.addEventListener("resize", resize);
renderer.setAnimationLoop(animate);

function bindControls() {
  for (const [key, input] of Object.entries(inputs)) {
    input.addEventListener("input", () => {
      outputs[key].value = input.value;

      if (key === "count") {
        resetFish(Number(input.value));
        return;
      }

      simulationSettings.perceptionRadius = Number(inputs.perception.value);
      simulationSettings.separateWeight = Number(inputs.separation.value);
      simulationSettings.avoidCollisionWeight = Number(inputs.avoidance.value);
      simulationSettings.maxTurnRate = Number(inputs.turnRate.value);
    });
  }

  document.querySelector("#reset").addEventListener("click", () => {
    resetFish(Number(inputs.count.value));
  });
}

function resetFish(count) {
  simulation.reset(count);

  if (fishMesh) {
    scene.remove(fishMesh);
    disposeFishMesh(fishMesh);
  }

  fishMesh = createFishMesh(count);
  scene.add(fishMesh);
  updateFishInstances(fishMesh, simulation.fish);
  cameraRig.updateFishCamera(simulation.fish[fishConfig.highlightedIndex]);
}

function animate() {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  const trace = simulation.update(dt, {
    traceIndex: headingDebugger?.traceIndex,
  });
  updateFishInstances(fishMesh, simulation.fish);
  headingDebugger?.sample({
    dt,
    fish: simulation.fish[fishConfig.highlightedIndex],
    trace,
  });
  cameraRig.updateFishCamera(simulation.fish[fishConfig.highlightedIndex], dt);
  cameraRig.update();
  renderer.render(scene, cameraRig.activeCamera);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  cameraRig.resize(width, height);
  renderer.setSize(width, height, false);
}
