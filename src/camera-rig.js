import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { getFishHeadPose } from "./fish-renderer.js";

const CAMERA_MODE = {
  orbit: "orbit",
  fish: "fish",
};

const FISH_CAMERA_POSITION_RESPONSE = 10;
const FISH_CAMERA_DIRECTION_RESPONSE = 5;
const FISH_CAMERA_LOOK_AHEAD = 3.6;
const worldUp = new THREE.Vector3(0, 1, 0);
const fallbackUp = new THREE.Vector3(1, 0, 0);

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
  const smoothedFishPosition = new THREE.Vector3();
  const smoothedFishDirection = new THREE.Vector3(0, 0, -1);
  const target = new THREE.Vector3();
  const up = new THREE.Vector3();
  let mode = CAMERA_MODE.orbit;
  let fishCameraInitialized = false;

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

    updateFishCamera(fish, dt = 0) {
      if (!fish) return;

      getFishHeadPose(fish, pose);

      if (!fishCameraInitialized || dt <= 0) {
        smoothedFishPosition.copy(pose.position);
        smoothedFishDirection.copy(pose.direction);
        fishCameraInitialized = true;
      } else {
        const positionAlpha = 1 - Math.exp(-FISH_CAMERA_POSITION_RESPONSE * dt);
        const directionAlpha = 1 - Math.exp(-FISH_CAMERA_DIRECTION_RESPONSE * dt);
        smoothedFishPosition.lerp(pose.position, positionAlpha);
        smoothedFishDirection.lerp(pose.direction, directionAlpha).normalize();
      }

      fishCamera.position.copy(smoothedFishPosition);
      up.copy(worldUp).addScaledVector(
        smoothedFishDirection,
        -worldUp.dot(smoothedFishDirection),
      );
      if (up.lengthSq() < 0.0001) {
        up.copy(fallbackUp).addScaledVector(
          smoothedFishDirection,
          -fallbackUp.dot(smoothedFishDirection),
        );
      }
      fishCamera.up.copy(up.normalize());
      fishCamera.lookAt(
        target
          .copy(smoothedFishPosition)
          .addScaledVector(smoothedFishDirection, FISH_CAMERA_LOOK_AHEAD),
      );
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
