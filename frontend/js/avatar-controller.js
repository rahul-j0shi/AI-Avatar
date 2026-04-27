export class AvatarController {
    constructor(containerId) {
        this.containerId = containerId;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.avatar = null;
        this.isInitialized = false;
        this.isSpeaking = false;
        this.animationId = null;
        this.targetRotationY = 0;
        this.currentRotationY = 0;
    }

    async init(ttsSettings = {}) {
        const container = document.getElementById(this.containerId);
        if (!container) {
            throw new Error(`Container ${this.containerId} not found`);
        }

        try {
            const THREE = await import('three');
            const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');

            this.scene = new THREE.Scene();

            this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
            this.camera.position.z = 5;

            this.renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true
            });
            this.renderer.setSize(container.clientWidth, container.clientHeight);
            this.renderer.setPixelRatio(window.devicePixelRatio);
            container.appendChild(this.renderer.domElement);

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            this.scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
            directionalLight.position.set(5, 5, 5);
            this.scene.add(directionalLight);

            const pointLight1 = new THREE.PointLight(0xFF007F, 0.8, 20);
            pointLight1.position.set(-3, 2, 3);
            this.scene.add(pointLight1);

            const pointLight2 = new THREE.PointLight(0x00E5FF, 0.8, 20);
            pointLight2.position.set(3, -2, 3);
            this.scene.add(pointLight2);

            const loader = new GLTFLoader();
            const modelPath = '/talking-head/assets/models/avatar.glb';

            await new Promise((resolve, reject) => {
                loader.load(
                    modelPath,
                    (gltf) => {
                        this.avatar = gltf.scene;

                        const box = new THREE.Box3().setFromObject(this.avatar);
                        const center = box.getCenter(new THREE.Vector3());
                        const size = box.getSize(new THREE.Vector3());

                        const maxDim = Math.max(size.x, size.y, size.z);
                        const scale = 2 / maxDim;
                        this.avatar.scale.setScalar(scale);

                        this.avatar.position.sub(center.multiplyScalar(scale));
                        this.avatar.position.y = -0.5;

                        this.scene.add(this.avatar);
                        resolve();
                    },
                    undefined,
                    (error) => {
                        console.error('Error loading model:', error);
                        reject(error);
                    }
                );
            });

            window.addEventListener('resize', () => this.onResize());
            container.addEventListener('mousemove', (e) => this.onMouseMove(e));

            this.animate();
            this.isInitialized = true;

            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.remove();

            return true;
        } catch (error) {
            console.error('Error initializing avatar:', error);
            this.isInitialized = false;
            throw error;
        }
    }

    onResize() {
        const container = document.getElementById(this.containerId);
        if (!container || !this.camera || !this.renderer) return;

        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    onMouseMove(event) {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const rect = container.getBoundingClientRect();
        this.targetRotationY = ((event.clientX - rect.left) / rect.width - 0.5) * 0.5;
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());

        if (this.avatar) {
            this.currentRotationY += (this.targetRotationY - this.currentRotationY) * 0.05;
            this.avatar.rotation.y = this.currentRotationY;

            const time = Date.now() * 0.001;
            this.avatar.position.y = -0.5 + Math.sin(time * 0.5) * 0.03;
        }

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    async speakText(text) {
        if (!this.isInitialized) {
            console.error('Avatar not properly initialized');
            return;
        }

        if (!text || text.trim() === '') {
            console.log('Empty text received, skipping speech');
            return;
        }

        try {
            this.isSpeaking = true;
            console.log('Avatar speaking:', text);

            if (this.avatar) {
                const originalY = this.avatar.position.y;
                const breatheAnimation = () => {
                    if (!this.isSpeaking) return;
                    const time = Date.now() * 0.003;
                    this.avatar.position.y = originalY + Math.abs(Math.sin(time)) * 0.1;
                    requestAnimationFrame(breatheAnimation);
                };
                breatheAnimation();
            }

            setTimeout(() => {
                this.isSpeaking = false;
                console.log('Speech completed');
            }, text.length * 100);

        } catch (error) {
            console.error('Error during speech:', error);
            this.isSpeaking = false;
        }
    }

    speak(audioBuffer, text) {
        return this.speakText(text);
    }

    setMood(mood) {
        console.log('Setting mood:', mood);
    }

    getIsSpeaking() {
        return this.isSpeaking;
    }

    cleanup() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}