import { type VRM, VRMExpressionPresetName, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { FrameProbe, type RenderMeasurement } from "./metrics";

export type AvatarMode = "idle" | "speaking";

export interface AvatarRendererOptions {
  onError?: (error: Error) => void;
  onModelLoaded?: (name: string) => void;
}

interface ActiveProbe {
  finish: (measurement: RenderMeasurement) => void;
  probe: FrameProbe;
  startedAt: number;
  timeout: number;
}

export class AvatarRenderer {
  readonly #camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  readonly #fallbackMouth: THREE.Mesh;
  readonly #fallbackRoot = new THREE.Group();
  readonly #loader = new GLTFLoader();
  readonly #options: AvatarRendererOptions;
  readonly #renderer: THREE.WebGLRenderer;
  readonly #resizeObserver: ResizeObserver;
  readonly #scene = new THREE.Scene();
  #activeProbe: ActiveProbe | undefined;
  #animationFrame = 0;
  #disposed = false;
  #lastRenderedAt = 0;
  #mode: AvatarMode = "idle";
  #vrm: VRM | undefined;

  constructor(canvas: HTMLCanvasElement, options: AvatarRendererOptions = {}) {
    this.#options = options;
    this.#renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas,
      powerPreference: "high-performance",
    });
    this.#renderer.setClearColor(0x000000, 0);
    this.#renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.#camera.position.set(0, 1.35, 4.3);
    this.#camera.lookAt(0, 1.15, 0);
    this.#scene.add(new THREE.HemisphereLight(0xffffff, 0x5b4a76, 2.8));

    const key = new THREE.DirectionalLight(0xffe9d6, 3.2);
    key.position.set(2, 4, 3);
    this.#scene.add(key);

    this.#fallbackMouth = this.#createFallback();
    this.#scene.add(this.#fallbackRoot);
    this.#loader.register((parser) => new VRMLoaderPlugin(parser));

    this.#resizeObserver = new ResizeObserver(() => this.resize());
    this.#resizeObserver.observe(canvas);
    this.resize();
    this.#animationFrame = requestAnimationFrame(this.#tick);
  }

  get mode(): AvatarMode {
    return this.#mode;
  }

  dispose(): void {
    this.#disposed = true;
    cancelAnimationFrame(this.#animationFrame);
    this.#resizeObserver.disconnect();
    this.#finishProbe();
    this.#vrm?.scene.removeFromParent();
    this.#renderer.dispose();
  }

  async loadVrm(source: string): Promise<void> {
    try {
      const gltf = await this.#loader.loadAsync(source);
      const vrm = gltf.userData.vrm as VRM | undefined;

      if (!vrm) {
        throw new Error("The selected file is valid glTF, but has no VRM extension.");
      }

      VRMUtils.removeUnnecessaryVertices(vrm.scene);
      VRMUtils.combineSkeletons(vrm.scene);
      VRMUtils.rotateVRM0(vrm);

      this.#vrm?.scene.removeFromParent();
      this.#vrm = vrm;
      this.#fallbackRoot.visible = false;
      this.#scene.add(vrm.scene);
      this.#frameModel(vrm.scene);
      const modelName = "name" in vrm.meta ? vrm.meta.name : vrm.meta.title;
      this.#options.onModelLoaded?.(modelName ?? "VRM avatar");
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      this.#options.onError?.(error);
      throw error;
    }
  }

  measure(durationMs: number): Promise<RenderMeasurement> {
    this.#finishProbe();

    return new Promise((finish) => {
      const startedAt = performance.now();
      const probe = new FrameProbe(this.#targetFps());
      const timeout = window.setTimeout(() => this.#finishProbe(), durationMs);
      this.#activeProbe = { finish, probe, startedAt, timeout };
    });
  }

  resize(): void {
    const canvas = this.#renderer.domElement;
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    this.#renderer.setSize(width, height, false);
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
  }

  setMode(mode: AvatarMode): void {
    if (mode === this.#mode) {
      return;
    }

    this.#finishProbe();
    this.#mode = mode;
    this.#lastRenderedAt = 0;
  }

  #createFallback(): THREE.Mesh {
    const material = new THREE.MeshStandardMaterial({ color: 0x8f77ff, roughness: 0.68 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 36, 28), material);
    head.position.y = 1.84;
    this.#fallbackRoot.add(head);

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.72, 1.15, 10, 30), material);
    body.position.y = 0.52;
    this.#fallbackRoot.add(body);

    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x161324 });
    for (const x of [-0.22, 0.22]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 18, 12), eyeMaterial);
      eye.position.set(x, 1.95, 0.57);
      this.#fallbackRoot.add(eye);
    }

    const mouth = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 20, 12),
      new THREE.MeshBasicMaterial({ color: 0x33213d }),
    );
    mouth.position.set(0, 1.72, 0.59);
    mouth.scale.set(1.25, 0.28, 0.35);
    this.#fallbackRoot.add(mouth);
    return mouth;
  }

  #finishProbe(): void {
    const activeProbe = this.#activeProbe;
    if (!activeProbe) {
      return;
    }

    window.clearTimeout(activeProbe.timeout);
    this.#activeProbe = undefined;
    activeProbe.finish(activeProbe.probe.snapshot(performance.now() - activeProbe.startedAt));
  }

  #frameModel(model: THREE.Object3D): void {
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const height = Math.max(size.y, 0.1);
    const distance = height / (2 * Math.tan(THREE.MathUtils.degToRad(this.#camera.fov / 2)));

    this.#camera.position.set(center.x, center.y, center.z + distance * 1.18);
    this.#camera.near = Math.max(0.01, distance / 100);
    this.#camera.far = distance * 10;
    this.#camera.lookAt(center);
    this.#camera.updateProjectionMatrix();
  }

  #targetFps(): number {
    return this.#mode === "speaking" ? 60 : 30;
  }

  #tick = (timestamp: number): void => {
    if (this.#disposed) {
      return;
    }

    this.#animationFrame = requestAnimationFrame(this.#tick);
    const frameInterval = 1_000 / this.#targetFps();
    if (timestamp - this.#lastRenderedAt < frameInterval * 0.88) {
      return;
    }

    const delta = this.#lastRenderedAt === 0 ? 0 : (timestamp - this.#lastRenderedAt) / 1_000;
    const elapsed = timestamp / 1_000;
    const mouthWeight = this.#mode === "speaking" ? (Math.sin(elapsed * 17) + 1) / 2 : 0;
    this.#fallbackMouth.scale.y = 0.28 + mouthWeight * 1.7;
    this.#fallbackRoot.rotation.y = Math.sin(elapsed * 0.8) * 0.06;

    if (this.#vrm) {
      this.#vrm.expressionManager?.setValue(VRMExpressionPresetName.Aa, mouthWeight * 0.8);
      const head = this.#vrm.humanoid?.getNormalizedBoneNode("head");
      if (head) {
        head.rotation.y = Math.sin(elapsed * 0.8) * 0.08;
      }
      this.#vrm.update(Math.min(delta, 0.1));
    }

    this.#renderer.render(this.#scene, this.#camera);
    this.#lastRenderedAt = timestamp;
    this.#activeProbe?.probe.record(timestamp);
  };
}
