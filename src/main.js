import * as THREE from "three";
import { BoidSimulation } from "./boid-simulation.js";
import { bindCameraToggle, createCameraRig } from "./camera-rig.js";
import { fishConfig, obstacles, simulationSettings, worldHalfSize } from "./config.js";
import {
  createFishMesh,
  disposeFishMesh,
  updateFishInstances,
} from "./fish-renderer.js";
import { createHeadingDebugger } from "./heading-debugger.js";
import {
  addLighting,
  addObstacles,
  addWorldBounds,
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
const simulation = new BoidSimulation({
  worldHalfSize,
  obstacles,
  settings: simulationSettings,
});

let fishMesh = null;

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

addLighting(scene);
addWorldBounds(scene);
addObstacles(scene, obstacles);
bindControls();
bindCameraToggle(cameraRig);
resetBoids(Number(inputs.count.value));
resize();
window.addEventListener("resize", resize);
renderer.setAnimationLoop(animate);

function bindControls() {
  for (const [key, input] of Object.entries(inputs)) {
    input.addEventListener("input", () => {
      outputs[key].value = input.value;

      if (key === "count") {
        resetBoids(Number(input.value));
        return;
      }

      simulationSettings.perceptionRadius = Number(inputs.perception.value);
      simulationSettings.separateWeight = Number(inputs.separation.value);
      simulationSettings.avoidCollisionWeight = Number(inputs.avoidance.value);
    });
  }

  document.querySelector("#reset").addEventListener("click", () => {
    resetBoids(Number(inputs.count.value));
  });
}

function resetBoids(count) {
  simulation.reset(count);

  if (fishMesh) {
    scene.remove(fishMesh);
    disposeFishMesh(fishMesh);
  }

  fishMesh = createFishMesh(count);
  scene.add(fishMesh);
  updateFishInstances(fishMesh, simulation.boids);
  cameraRig.updateFishCamera(simulation.boids[fishConfig.highlightedIndex]);
}

function animate() {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  const trace = simulation.update(dt, {
    traceIndex: headingDebugger?.traceIndex,
  });
  updateFishInstances(fishMesh, simulation.boids);
  headingDebugger?.sample({
    dt,
    boid: simulation.boids[fishConfig.highlightedIndex],
    trace,
  });
  cameraRig.updateFishCamera(simulation.boids[fishConfig.highlightedIndex]);
  cameraRig.update();
  renderer.render(scene, cameraRig.activeCamera);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  cameraRig.resize(width, height);
  renderer.setSize(width, height, false);
}
