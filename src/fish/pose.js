import * as THREE from "three";
import { fishConfig } from "./config.js";

const worldUp = new THREE.Vector3(0, 1, 0);
const worldForward = new THREE.Vector3(0, 0, 1);
const worldRight = new THREE.Vector3(1, 0, 0);
const localForward = new THREE.Vector3(0, 1, 0);
const tmpForward = new THREE.Vector3();
const tmpDorsal = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const tmpBasis = new THREE.Matrix4();

export function readFishDirection(fish, target) {
  if (fish?.velocity?.lengthSq() > 0.000001) {
    return target.copy(fish.velocity).normalize();
  }

  if (fish?.introDropDirection?.lengthSq() > 0.000001) {
    return target.copy(fish.introDropDirection).normalize();
  }

  return target.copy(localForward);
}

export function writeFishOrientationQuaternion(fish, direction, target) {
  const forward = tmpForward.copy(direction);

  tmpDorsal.copy(worldUp).addScaledVector(forward, -worldUp.dot(forward));
  if (tmpDorsal.lengthSq() < 0.000001) {
    const fallback = Math.abs(forward.dot(worldForward)) < 0.92 ? worldForward : worldRight;
    tmpDorsal.copy(fallback).addScaledVector(forward, -fallback.dot(forward));
  }
  tmpDorsal.normalize();

  const bank = THREE.MathUtils.clamp(
    fish.bank ?? 0,
    -fishConfig.maxBankAngle,
    fishConfig.maxBankAngle,
  );
  if (Math.abs(bank) > 0.000001) {
    tmpDorsal.applyAxisAngle(forward, bank).normalize();
  }

  tmpRight.crossVectors(forward, tmpDorsal).normalize();
  tmpDorsal.crossVectors(tmpRight, forward).normalize();
  tmpBasis.makeBasis(tmpRight, forward, tmpDorsal);
  return target.setFromRotationMatrix(tmpBasis);
}

export function getFishHeadPose(fish, pose) {
  readFishDirection(fish, pose.direction);
  pose.position.copy(fish.position).addScaledVector(pose.direction, fishConfig.length / 2);
  return pose;
}
