import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { getFishHeadPose } from "./fish-renderer.js";

const CAMERA_MODE = {
  orbit: "orbit",
  fish: "fish",
};

export function createCameraRig(renderer) {
  const orbitCamera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
  orbitCamera.position.set(0, 8.5, 20);

  const fishCamera = new THREE.PerspectiveCamera(74, 1, 0.03, 90);

  const controls = new OrbitControls(orbitCamera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0.8, 0);
  controls.maxDistance = 38;
  controls.minDistance = 8;

  const pose = {
    position: new THREE.Vector3(),
    direction: new THREE.Vector3(0, 0, -1),
  };
  const target = new THREE.Vector3();
  let mode = CAMERA_MODE.orbit;

  return {
    get activeCamera() {
      return mode === CAMERA_MODE.fish ? fishCamera : orbitCamera;
    },

    get mode() {
      return mode;
    },

    toggle() {
      mode = mode === CAMERA_MODE.orbit ? CAMERA_MODE.fish : CAMERA_MODE.orbit;
      controls.enabled = mode === CAMERA_MODE.orbit;
    },

    update() {
      if (controls.enabled) {
        controls.update();
      }
    },

    updateFishCamera(boid) {
      if (!boid) return;

      getFishHeadPose(boid, pose);
      fishCamera.position.copy(pose.position);
      fishCamera.up.set(0, 1, 0);
      if (Math.abs(fishCamera.up.dot(pose.direction)) > 0.94) {
        fishCamera.up.set(1, 0, 0);
      }
      fishCamera.lookAt(target.copy(fishCamera.position).add(pose.direction));
    },

    resize(width, height) {
      orbitCamera.aspect = width / height;
      orbitCamera.updateProjectionMatrix();
      fishCamera.aspect = width / height;
      fishCamera.updateProjectionMatrix();
    },
  };
}

export function bindCameraToggle(cameraRig) {
  window.addEventListener("keydown", (event) => {
    if (event.code !== "Space" || event.repeat) return;

    event.preventDefault();
    cameraRig.toggle();
  });
}
