import * as THREE from 'three';

class LandingAvatar {
    constructor() {
        this.canvas = document.getElementById('avatar-canvas');
        this.frame = document.getElementById('avatar-frame');
        this.mouseX = 0;
        this.mouseY = 0;
        this.targetRotationX = 0;
        this.targetRotationY = 0;
        this.blinkTimer = 0;
        this.isBlinking = false;
        this.init();
    }

    init() {
        if (!this.canvas) return;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
        this.camera.position.z = 5;

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: true
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(350, 350);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);

        const pointLight1 = new THREE.PointLight(0xFF007F, 1, 10);
        pointLight1.position.set(-2, 1, 2);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x00E5FF, 1, 10);
        pointLight2.position.set(2, -1, 2);
        this.scene.add(pointLight2);

        this.loadAvatar();

        this.setupMouseTracking();
        this.animate();

        window.addEventListener('resize', () => this.onResize());
    }

    loadAvatar() {
        const loader = new THREE.GLTFLoader();

        loader.load(
            '../talking-head/assets/models/avatar.glb',
            (gltf) => {
                this.avatar = gltf.scene;
                this.avatar.scale.set(2, 2, 2);
                this.avatar.position.y = -0.5;
                this.scene.add(this.avatar);
            },
            undefined,
            (error) => {
                console.error('Error loading avatar:', error);
                this.showFallback();
            }
        );
    }

    showFallback() {
        const fallbackGeom = new THREE.SphereGeometry(1, 32, 32);
        const fallbackMat = new THREE.MeshPhongMaterial({
            color: 0x888888,
            emissive: 0x222222
        });
        const fallback = new THREE.Mesh(fallbackGeom, fallbackMat);
        this.scene.add(fallback);
    }

    setupMouseTracking() {
        document.addEventListener('mousemove', (e) => {
            const rect = this.frame.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            this.mouseX = (e.clientX - centerX) / (rect.width / 2);
            this.mouseY = (e.clientY - centerY) / (rect.height / 2);
        });
    }

    onResize() {
        if (!this.frame) return;
        const size = this.frame.offsetWidth;
        this.camera.aspect = 1;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(size, size);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.targetRotationY = this.mouseX * 0.3;
        this.targetRotationX = -this.mouseY * 0.2;

        if (this.avatar) {
            this.avatar.rotation.y += (this.targetRotationY - this.avatar.rotation.y) * 0.05;
            this.avatar.rotation.x += (this.targetRotationX - this.avatar.rotation.x) * 0.05;

            const time = Date.now() * 0.001;
            this.avatar.position.y = -0.5 + Math.sin(time * 0.5) * 0.05;
        }

        this.blinkTimer += 0.016;
        if (this.blinkTimer > 4 && !this.isBlinking) {
            this.blink();
        }

        this.renderer.render(this.scene, this.camera);
    }

    blink() {
        this.isBlinking = true;
        setTimeout(() => {
            this.isBlinking = false;
            this.blinkTimer = 0;
        }, 150);
    }
}

class ParticleSystem {
    constructor() {
        this.container = document.getElementById('particles');
        this.words = ['namaste', 'kaise ho', 'accha', 'sahi hai', 'jaane do', 'mast', 'theek hai', 'chal'];
        this.init();
    }

    init() {
        if (!this.container) return;

        for (let i = 0; i < 8; i++) {
            this.createParticle(i);
        }
    }

    createParticle(index) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.textContent = this.words[Math.floor(Math.random() * this.words.length)];
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${50 + Math.random() * 50}%`;
        particle.style.animationDelay = `${index * 1}s`;
        particle.style.animationDuration = `${6 + Math.random() * 4}s`;

        this.container.appendChild(particle);

        setInterval(() => {
            particle.textContent = this.words[Math.floor(Math.random() * this.words.length)];
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${50 + Math.random() * 50}%`;
        }, 8000);
    }
}

class ScrollAnimations {
    constructor() {
        this.init();
    }

    init() {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry, index) => {
                    if (entry.isIntersecting) {
                        setTimeout(() => {
                            entry.target.classList.add('visible');
                        }, index * 100);
                    }
                });
            },
            { threshold: 0.2 }
        );

        document.querySelectorAll('[data-animate]').forEach((el) => {
            observer.observe(el);
        });
    }
}

class NavbarScroll {
    constructor() {
        this.navbar = document.getElementById('navbar');
        this.init();
    }

    init() {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                this.navbar.classList.add('scrolled');
            } else {
                this.navbar.classList.remove('scrolled');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const avatar = new LandingAvatar();
    const particles = new ParticleSystem();
    const scrollAnim = new ScrollAnimations();
    const navbar = new NavbarScroll();
});