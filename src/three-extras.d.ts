declare module "three/addons/controls/OrbitControls.js" {
  import type { Camera, EventDispatcher, MOUSE, TOUCH } from "three";

  export class OrbitControls extends EventDispatcher {
    constructor(object: Camera, domElement?: HTMLElement);
    enabled: boolean;
    target: import("three").Vector3;
    minDistance: number;
    maxDistance: number;
    enableDamping: boolean;
    dampingFactor: number;
    enablePan: boolean;
    mouseButtons: {
      LEFT?: MOUSE;
      MIDDLE?: MOUSE;
      RIGHT?: MOUSE;
    };
    touches: {
      ONE?: TOUCH;
      TWO?: TOUCH;
    };
    update(deltaTime?: number): boolean;
    dispose(): void;
  }
}

declare module "three/addons/loaders/GLTFLoader.js" {
  import type {
    AnimationClip,
    Camera,
    EventDispatcher,
    LoadingManager,
    Object3D,
    Scene,
  } from "three";

  export interface GLTF {
    animations: AnimationClip[];
    scene: Scene;
    scenes: Scene[];
    cameras: Camera[];
    asset: {
      copyright?: string;
      generator?: string;
      version?: string;
      minVersion?: string;
      extensions?: unknown;
      extras?: unknown;
    };
    parser: unknown;
    userData: Record<string, unknown>;
  }

  export class GLTFLoader extends EventDispatcher {
    constructor(manager?: LoadingManager);
    loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<GLTF>;
    parseAsync(data: ArrayBuffer | string, path: string): Promise<GLTF>;
    register(callback: (parser: unknown) => unknown): this;
    unregister(callback: (parser: unknown) => unknown): this;
    setDRACOLoader(dracoLoader: unknown): this;
    setDDSLoader(ddsLoader: unknown): this;
    setKTX2Loader(ktx2Loader: unknown): this;
    setMeshoptDecoder(meshoptDecoder: unknown): this;
    setPath(path: string): this;
    setResourcePath(resourcePath: string): this;
    setCrossOrigin(crossOrigin: string): this;
    setRequestHeader(requestHeader: Record<string, string>): this;
    setWithCredentials(value: boolean): this;
  }

  export type GLTFScene = Object3D;
}
