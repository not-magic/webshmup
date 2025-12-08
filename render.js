// render.js - three.js 3D rendering implementation for Vibe Shooter using InstancedMesh

// Pool indices enum
const PoolType = {
    ASTEROID_0: 0,
    ASTEROID_1: 1,
    ASTEROID_M: 2,
    ASTEROID_L: 3,
    ASTEROID_XL: 4,
    SPHERE: 5,
    PLAYER: 6,
    PLAYER_HIT: 7,
    PLAYER_BULLET: 8,
    ENEMY_BULLET: 9,
    STAR: 10,
    BEETLE: 11,
    BEETLE_HIT: 12,
    GOLIATH: 13,
    GOLIATH_HIT: 14,
    CENTIPEDE_HEAD: 15,
    CENTIPEDE_HEAD_HIT: 16,
    CENTIPEDE_SEGMENT: 17,
    CENTIPEDE_SEGMENT_HIT: 18
};

const Render3D = {
    name: '3D Three.js',
    canvas: null,
    renderer: null,
    backgroundScene: null,
    objectScene: null,
    bulletScene: null,
    camera: null,

    // Cache for loaded models
    loadedModels: {},
    gltfLoader: new THREE.GLTFLoader(),

    // All instanced render pools
    pools: [
        new InstancedRenderPool(), // ASTEROID_0
        new InstancedRenderPool(), // ASTEROID_1
        new InstancedRenderPool(), // ASTEROID_M
        new InstancedRenderPool(), // ASTEROID_L
        new InstancedRenderPool(), // ASTEROID_XL
        new InstancedRenderPool(), // SPHERE
        new InstancedRenderPool(), // PLAYER
        new InstancedRenderPool(), // PLAYER_HIT
        new InstancedRenderPool(), // PLAYER_BULLET
        new InstancedRenderPool(), // ENEMY_BULLET
        new InstancedRenderPool(), // STAR
        new InstancedRenderPool(), // BEETLE
        new InstancedRenderPool(), // BEETLE_HIT
        new InstancedRenderPool(), // GOLIATH
        new InstancedRenderPool(), // GOLIATH_HIT
        new InstancedRenderPool(), // CENTIPEDE_HEAD
        new InstancedRenderPool(), // CENTIPEDE_HEAD_HIT
        new InstancedRenderPool(), // CENTIPEDE_SEGMENT
        new InstancedRenderPool()  // CENTIPEDE_SEGMENT_HIT
    ],

    // Temporary objects for matrix operations (reused to avoid allocations)
    tempMatrix: new THREE.Matrix4(),
    tempPosition: new THREE.Vector3(),
    tempQuaternion: new THREE.Quaternion(),
    tempScale: new THREE.Vector3(),
    tempColor: new THREE.Color(),

    // Initialize the 3D renderer with canvas
    async init(canvas) {
        this.canvas = canvas;

        // Create three.js renderer with PBR settings
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: true,
            antialias: true
        });
        this.renderer.setSize(canvas.width, canvas.height);
        this.renderer.setClearColor(0x000000, 1);
        this.renderer.autoClear = false;


        // Enable PBR lighting
        this.renderer.physicallyCorrectLights = true;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        // Create scene
        this.backgroundScene = new THREE.Scene();
        this.objectScene = new THREE.Scene();
        this.bulletScene = new THREE.Scene();

        // Create perspective camera
        const width = canvas.width;
        const height = canvas.height;
        const fov = 60; // Field of view in degrees
        const aspect = width / height;

        this.camera = new THREE.PerspectiveCamera(
            fov,    // field of view
            aspect, // aspect ratio
            0.1,    // near clipping plane
            2000    // far clipping plane
        );

        // Calculate camera distance to make viewport match canvas dimensions at z=0
        // distance = (height/2) / tan(fov/2)
        const distance = (height / 2) / Math.tan((fov * Math.PI / 180) / 2);

        this.camera.up.set(0, -1, 0);

        // Position camera looking at center of canvas
        this.camera.position.set(width / 2, height / 2, -distance);
        this.camera.lookAt(width / 2, height / 2, 0);

        // Add directional light pointing down to the bottom left
        // With physicallyCorrectLights, intensity represents luminous intensity in candela
        const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
        // Position light above and to the right, pointing down and to the left
        directionalLight.position.set(-width/2, -height/2, -distance);
        directionalLight.target.position.set(0, 0, 0);
        this.objectScene.add(directionalLight);
        this.objectScene.add(directionalLight.target);

        const rimLight = new THREE.DirectionalLight(0xffff00, 2.0);
        // Position light above and to the right, pointing down and to the left
        rimLight.position.set(-width, height/2, distance/2);
        rimLight.target.position.set(0, 0, 0);
        this.objectScene.add(rimLight);
        this.objectScene.add(rimLight.target);

        // Add hemisphere light for better ambient lighting
        const hemisphereLight = new THREE.HemisphereLight(0x007fff, 0x442244, 0.4);
        this.objectScene.add(hemisphereLight);

        // Initialize instanced meshes
        await this.initInstances();

        console.log('three.js 3D renderer initialized successfully with instancing');
        return true;
    },

    // Load a .glb model and return {geometry, material}
    async loadGLB(path) {
        // Check cache first
        if (this.loadedModels[path]) {
            return this.loadedModels[path];
        }

        try {
            const gltf = await new Promise((resolve, reject) => {
                this.gltfLoader.load(path, resolve, undefined, reject);
            });

            // Extract geometry and material from the first mesh in the loaded model
            let result = null;
            gltf.scene.traverse((child) => {
                if (!result && child.isMesh) {
                    console.log(`Loaded ${path}`);
                    const geometry = child.geometry;

                    // Clone the material if available
                    let material = null;
                    if (child.material) {
                        material = child.material.clone();
                        material.vertexColors = false;

                        // Ensure textures use sRGB encoding for PBR
                        if (material.map) {
                            material.map.encoding = THREE.sRGBEncoding;
                        }
                        if (material.emissiveMap) {
                            material.emissiveMap.encoding = THREE.sRGBEncoding;
                        }
                    }

                    result = { geometry, material };
                }
            });

            if (!result) {
                console.error(`No mesh found in ${path}, using default box geometry`);
                result = {
                    geometry: new THREE.BoxGeometry(1, 1, 1),
                    material: new THREE.MeshStandardMaterial({ vertexColors: true })
                };
            }

            // Cache the result
            this.loadedModels[path] = result;
            return result;
            
        } catch (error) {
            console.error(`Failed to load ${path}:`, error);
            const fallback = {
                geometry: new THREE.BoxGeometry(1, 1, 1),
                material: new THREE.MeshStandardMaterial({ vertexColors: true })
            };
            this.loadedModels[path] = fallback;
            return fallback;
        }
    },

    // Initialize instanced meshes
    async initInstances() {
        // Load all unique models in parallel
        const [sphere, asteroid1, asteroidM, asteroidL, asteroidXL, player, quad, beetle, goliath, centipedeHead, centipedeSeg] = await Promise.all([
            this.loadGLB('assets/sphere.glb'),
            this.loadGLB('assets/asteroid_1.glb'),
            this.loadGLB('assets/asteroid_m.glb'),
            this.loadGLB('assets/asteroid_l.glb'),
            this.loadGLB('assets/asteroid_xl.glb'),
            this.loadGLB('assets/player.glb'),
            this.loadGLB('assets/quad.glb'),
            this.loadGLB('assets/beetle.glb'),
            this.loadGLB('assets/goliath.glb'),
            this.loadGLB('assets/centipede_head.glb'),
            this.loadGLB('assets/centipede_seg.glb')
        ]);

        // Initialize pools with loaded geometries
        this.pools[PoolType.ASTEROID_0].init(this.objectScene, asteroid1.geometry, 50, 20, asteroid1.material);
        this.pools[PoolType.ASTEROID_1].init(this.objectScene, asteroid1.geometry, 50, 20, new THREE.MeshBasicMaterial());
        this.pools[PoolType.ASTEROID_M].init(this.objectScene, asteroidM.geometry, 50, 20, asteroidM.material);
        this.pools[PoolType.ASTEROID_L].init(this.objectScene, asteroidL.geometry, 50, 20, asteroidL.material);
        this.pools[PoolType.ASTEROID_XL].init(this.objectScene, asteroidXL.geometry, 50, 20, asteroidXL.material);
        this.pools[PoolType.SPHERE].init(this.objectScene, sphere.geometry, 200, 50, new THREE.MeshBasicMaterial());
        this.pools[PoolType.PLAYER].init(this.objectScene, player.geometry, 2, 1, player.material);
        this.pools[PoolType.PLAYER_HIT].init(this.objectScene, player.geometry, 2, 1, new THREE.MeshBasicMaterial());
        this.pools[PoolType.PLAYER_BULLET].init(this.backgroundScene, quad.geometry, 300, 100, new THREE.MeshBasicMaterial());
        this.pools[PoolType.ENEMY_BULLET].init(this.bulletScene, quad.geometry, 300, 100, new THREE.MeshBasicMaterial());
        this.pools[PoolType.STAR].init(this.backgroundScene, quad.geometry, 300, 100, new THREE.MeshBasicMaterial());
        this.pools[PoolType.BEETLE].init(this.objectScene, beetle.geometry, 50, 50, beetle.material);
        this.pools[PoolType.BEETLE_HIT].init(this.objectScene, beetle.geometry, 50, 50, new THREE.MeshBasicMaterial());
        this.pools[PoolType.GOLIATH].init(this.objectScene, goliath.geometry, 15, 5, goliath.material);
        this.pools[PoolType.GOLIATH_HIT].init(this.objectScene, goliath.geometry, 15, 5, new THREE.MeshBasicMaterial());
        this.pools[PoolType.CENTIPEDE_HEAD].init(this.objectScene, centipedeHead.geometry, 4, 5, centipedeHead.material);
        this.pools[PoolType.CENTIPEDE_HEAD_HIT].init(this.objectScene, centipedeHead.geometry, 4, 5, new THREE.MeshBasicMaterial());
        this.pools[PoolType.CENTIPEDE_SEGMENT].init(this.objectScene, centipedeSeg.geometry, 50, 50, centipedeSeg.material);
        this.pools[PoolType.CENTIPEDE_SEGMENT_HIT].init(this.objectScene, centipedeSeg.geometry, 50, 50, new THREE.MeshBasicMaterial());
    },

    // Reset instance counts at start of frame
    resetPools() {
        for (let pool of this.pools) {
            pool.reset();
        }
    },

    // Render all pools
    drawPools() {
        for (let pool of this.pools) {
            pool.render();
        }
    },

    // ===== DRAWING FUNCTIONS =====

    drawStars() {
        for (let star of stars) {
            const z = -star.speed;
            const scale = star.speed * 0.5;
            this.pools[PoolType.STAR].add(star.x, star.y, z, scale, scale * 3, 0, star.fillStyle);
        }
    },

    drawBullets() {
        for (let bullet of bullets) {
            let color = bullet.color;
            if (bullet.isRainbow) {
                bullet.rainbowHue = (bullet.rainbowHue + 5) % 360;
                color = `hsl(${bullet.rainbowHue}, 100%, 50%)`;
            }
            // Draw bullets as small cubes

            this.pools[PoolType.PLAYER_BULLET].add(bullet.x, bullet.y, 0, bullet.width, bullet.height, 1.0, color);
        }
    },

    drawAsteroids() {
        for (let asteroid of asteroids) {
            // Calculate color based on current health
            const colorHealth = Math.min(asteroid.health, 10);
            const ratio = (colorHealth - 1) / 9;
            const r = Math.floor(136 + 119 * ratio);
            const g = Math.floor(136 * (1 - ratio));
            const b = Math.floor(136 * (1 - ratio));
            const color = asteroid.hitFlash > 0 ? '#ffffff' : `rgb(${r}, ${g}, ${b})`;

            // Draw as cube
            const poolType = asteroid.hitFlash ? PoolType.ASTEROID_1 : PoolType.ASTEROID_0;
            const scale = asteroid.size * 0.6;
            this.pools[poolType].add(asteroid.body.x, asteroid.body.y, 0, scale, scale, scale, color, asteroid.rotationAxisX, asteroid.rotationAxisY, asteroid.rotation);
        }
    },

    drawBeetles() {
        for (let beetle of beetles) {
            const color = beetle.hitFlash > 0 ? '#ffffff' : beetle.baseColor;
            // Draw beetles
            const scale = beetle.size * 2.0;

            let tilt = beetle.targetRotation-beetle.rotation;
            if (tilt > Math.PI*2) {
                tilt -= Math.PI*2;
            }
            if (tilt < -Math.PI*2) {
                tilt += Math.PI*2;
            }

            // Use beetle.rotation for roll (Z-axis rotation) to point in direction of travel
            const poolType = beetle.hitFlash ? PoolType.BEETLE_HIT : PoolType.BEETLE;
            this.pools[poolType].add(beetle.body.x, beetle.body.y, 0, scale, scale, scale, color, 0, 0, beetle.rotation - Math.PI/2);
        }
    },

    drawCentipedes() {
        for (let centipede of centipedes) {
            for (let i = 0; i < centipede.segments.length; i++) {
                const segment = centipede.segments[i];
                if (segment.health <= 0) continue;

                let color = '#ffffff';
                if (segment.shootFlash > 0) color = '#ff0000';
                if (segment.hitFlash > 0) color = '#ffffff';

                let angle;
                if (i === 0) {
                    // Head: use path direction
                    const nextSeg = centipede.segments[i + 1];
                    angle = getAngleTo(nextSeg.x, nextSeg.y, segment.x, segment.y);
                } else {
                    // Body: face towards previous segment
                    const prevSeg = centipede.segments[i - 1];
                    angle = getAngleTo(segment.x, segment.y, prevSeg.x, prevSeg.y);
                }

                if (i == 0) {
                    const poolType = segment.hitFlash ? PoolType.CENTIPEDE_HEAD_HIT : PoolType.CENTIPEDE_HEAD;
                    this.pools[poolType].add(segment.x, segment.y, 0, segment.size, segment.size, segment.size, color, Math.PI, 0, -angle + Math.PI/2);
                } else {
                    // Draw segments as spheres
                    const poolType = segment.hitFlash ? PoolType.CENTIPEDE_SEGMENT_HIT : PoolType.CENTIPEDE_SEGMENT;
                    this.pools[poolType].add(segment.x, segment.y, 0, segment.size, segment.size, segment.size, color, 0, 0, angle + Math.PI/2);
                }
            }
        }
    },

    drawSentinels() {
        for (let enemy of sentinels) {
            const color = enemy.hitFlash > 0 ? '#ffffff' : enemy.color;
            // Draw sentinels as larger cubes
            const scale = enemy.width * 0.7;
            const poolType = enemy.hitFlash ? PoolType.GOLIATH_HIT : PoolType.GOLIATH;
            this.pools[poolType].add(enemy.body.x, enemy.body.y, 0, scale, scale, scale, color, Math.PI * 1.2, 0, 0);
        }
    },

    drawEnemyBullets() {
        for (let bullet of enemyBullets) {
            const color = bullet.aimed ? '#00ffff' : bullet.color;
            const scale_x = bullet.size * (bullet.aimed ? 0.7 : 1.2);
            const scale_y = bullet.size * (bullet.aimed ? 4 : 1.2);
            const angle = Math.atan2(bullet.vy, bullet.vx);

            this.pools[PoolType.ENEMY_BULLET].add(bullet.x, bullet.y, 0, scale_x, scale_y, 1.0, color, 0, 0, bullet.aimed ? angle + Math.PI/2 : Math.PI/4);
        }
    },

    drawExplosions() {
        for (let explosion of explosions) {
            // Calculate scale
            const halfLife = explosion.lifetime / 2;
            let scale;
            if (explosion.timer <= halfLife) {
                scale = explosion.timer / halfLife;
            } else {
                scale = 1 - ((explosion.timer - halfLife) / halfLife);
            }

            const size = explosion.maxSize * scale;

            // Draw as glowing spheres
            this.pools[PoolType.SPHERE].add(explosion.x, explosion.y, 2, size * 2, size * 2, size * 2, '#ffff00');
            this.pools[PoolType.SPHERE].add(explosion.x, explosion.y, 0, size * 1.2, size * 1.2, size * 1.2, '#ffffff');
        }
    },

    drawScorePopups() {
        // Text rendering in three.js requires texture-based approach or external library
        // Skip for now
    },

    drawPowerupTexts() {
        // Text rendering in three.js requires texture-based approach or external library
        // Skip for now
    },

    renderCommon() {
        this.renderer.clear();
        // Render the scene
        this.renderer.render(this.backgroundScene, this.camera);
        this.renderer.clearDepth();
        this.renderer.render(this.objectScene, this.camera);
        this.renderer.clearDepth();
        this.renderer.render(this.bulletScene, this.camera);
    },

    renderTitleScreen() {
        // Reset instance counts to reuse instances
        this.resetPools();

        // Draw star field
        this.drawStars();

        // Update pools
        this.drawPools();

        this.renderCommon();
    },

    // Render the game
    render() {
        if (!this.renderer) return;

        // Reset instance counts to reuse instances
        this.resetPools();

        if (gameState === 'title') {
            this.renderTitleScreen();
            return;
        }

        // Draw all game elements
        this.drawStars();
        this.drawAsteroids();
        this.drawSentinels();
        this.drawBeetles();
        this.drawCentipedes();
        this.drawEnemyBullets();
        this.drawBullets();
        this.drawExplosions();
        this.drawScorePopups();
        this.drawPowerupTexts();

        // Draw ship
        if (gameState === 'playing') {
            const scale = ship.size * 0.3;
            this.pools[ship.collisionTimer > 0 ? PoolType.PLAYER_HIT :PoolType.PLAYER].add(ship.body.x, ship.body.y, 0, scale, scale, scale, 
                (ship.collisionTimer == 0.0 || ship.collisionTimer > 0.5) ? '#ffffff' : '#ff0000', 0, -Math.PI/2+(-0.9*ship.horizontalInput), Math.PI/2);
        }

        this.drawPools();

        this.renderCommon()
    }
};
