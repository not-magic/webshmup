// Canvas setup
const canvas = document.getElementById('canvas3d');

// Game objects
const ship = {
    body: Physics.addCollisionBody(canvas.width / 2, canvas.height - 250, 4.5, 0, 0, 0.2),
    size: 40,
    speed: 5,
    color: '#00ff00',
    radius: 4.5, // Small circle hitbox in center
    centerOffsetY: 3, // Hitbox moved down 3 pixels
    horizontalInput: 0.0, // Track horizontal input for banking effect
    collisionTimer: 0.0
};

// Star field for background
const stars = [];
const starCount = 200;

function initStars() {
    for (let i = 0; i < starCount; i++) {

        const brightness = Math.random() * 155 + 100 // Brightness between 100 and 255 (grey to white)
        const color = Math.floor(brightness);
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            speed: Math.random() + 0.5, // Speed between 0.5 and 1.5
            brightness: brightness,
            fillStyle: `rgb(${color}, ${color}, ${color})`
        });
    }
}

function updateStars() {
    for (let star of stars) {
        star.y += star.speed * deltaTime;

        // Wrap around when star goes off screen
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
    }
}

// Game state
let gameState = 'title'; // 'title', 'playing', or 'dying'
let deathTimer = 0; // Timer for death delay (120 frames = 2 seconds at 60fps)
let godMode = false; // Debug god mode
let halfSpeedMode = false; // Debug half-speed mode (only works when god mode is enabled)

// Delta time for frame-rate independent movement
let lastTime = 0;
let deltaTime = 1.0; // 1.0 at 60 FPS

// Gamepad state
let gamepad = null;
let lastAttackButtonState = false;
let rapidFireDelay = 0; // Frames until next rapid fire shot
let rapidFireTimer = 0; // Frames since last rapid fire shot

// Score
let score = 0;
let highScore = parseInt(localStorage.getItem('vibeShooterHighScore')) || 0;
let blueEnemiesDestroyed = 0;
let asteroidsDestroyed = 0;
let sentinelSpawnCount = 0; // Track Sentinel spawns
let sentinelKills = 0; // Track Sentinel destructions for centipede spawning

// Bullets
const bullets = [];
const bulletPool = []; // Pool of reusable bullet objects
let maxBullets = 3; // Start with 3 bullets, increase by destroying large enemies
const bulletSpeed = 8;
const bulletSize = 4;

// Asteroids
const asteroids = [];
const asteroidSpawnRate = 0.02; // Probability per frame
const asteroidSpeed = { min: 1, max: 3 };
const asteroidSize = { min: 20, max: 50 };

// Beetles (blue enemies)
const beetles = [];
const beetleSpawnRate = 0.005; // Probability per frame
const beetleSize = 30;
const beetlePauseDuration = 120; // Frames to pause (2 seconds at 60fps)

// Enemy bullets
const enemyBullets = [];
const enemyBulletPool = []; // Pool of reusable enemy bullet objects
const enemyBulletSpeed = 4.5;

// Sentinels (large white enemies)
const sentinels = [];
const sentinelWidth = 100;
const sentinelHeight = 40;
const sentinelSpeed = 1;

// Centipedes
const centipedes = [];
let centipedeSpawnQueue = 0; // Number of centipedes waiting to spawn
let centipedeSpawnTimer = 0; // Timer until next centipede spawns (300 frames = 5 seconds)

// Explosions
const explosions = [];

// Score popups
const scorePopups = [];

// Powerup text effects
const powerupTexts = [];

// Bullet pool helper functions
function addPlayerBullet(x, y, width, height, color, vx, vy, isRainbow, rainbowHue) {
    let bullet;
    if (bulletPool.length > 0) {
        bullet = bulletPool.pop();
        bullet.x = x;
        bullet.y = y;
        bullet.width = width;
        bullet.height = height;
        bullet.color = color;
        bullet.vx = vx;
        bullet.vy = vy;
        bullet.isRainbow = isRainbow;
        bullet.rainbowHue = rainbowHue;
    } else {
        bullet = { x, y, width, height, color, vx, vy, isRainbow, rainbowHue };
    }
    bullets.push(bullet);
}

function returnPlayerBullet(bullet) {
    bulletPool.push(bullet);
}

function addEnemyBullet(x, y, vx, vy, size, color, aimed) {
    let bullet;
    if (enemyBulletPool.length > 0) {
        bullet = enemyBulletPool.pop();
        bullet.x = x;
        bullet.y = y;
        bullet.vx = vx;
        bullet.vy = vy;
        bullet.size = size;
        bullet.color = color;
        bullet.aimed = aimed;
    } else {
        bullet = { x, y, vx, vy, size, color, aimed };
    }
    enemyBullets.push(bullet);
}

function returnEnemyBullet(bullet) {
    enemyBulletPool.push(bullet);
}

// Keyboard state
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    Space: false
};

// Gamepad connection events
window.addEventListener('gamepadconnected', (e) => {
    gamepad = e.gamepad;
    console.log('Gamepad connected:', gamepad);
});

window.addEventListener('gamepaddisconnected', (e) => {
    gamepad = null;
    console.log('Gamepad disconnected');
});

// Keyboard controls
window.addEventListener('keydown', (e) => {
    if (e.key === 'g' || e.key === 'G') {
        godMode = !godMode;
        if (godMode) {
            maxBullets = 100;
            console.log('God mode enabled - Power level set to 100');
        } else {
            console.log('God mode disabled');
        }
    }

    if ((e.key === 'c' || e.key === 'C') && godMode) {
        // Trigger a centipede spawn event (add 2 to queue to test delay)
        centipedeSpawnQueue += 2;
        console.log('Centipede spawn event triggered - 2 centipedes queued');
    }

    if ((e.key === 'h' || e.key === 'H') && godMode) {
        halfSpeedMode = !halfSpeedMode;
        console.log(halfSpeedMode ? 'Half-speed mode enabled' : 'Half-speed mode disabled');
    }

    // Track arrow keys and space bar
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault(); // Prevent page scrolling
        keys[e.key] = true;
    }
    if (e.key === ' ') {
        e.preventDefault(); // Prevent page scrolling
        keys.Space = true;
    }
});

window.addEventListener('keyup', (e) => {
    // Release arrow keys and space bar
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        keys[e.key] = false;
    }
    if (e.key === ' ') {
        keys.Space = false;
    }
});

// ===== UTILITY FUNCTIONS =====

// Fast O(1) array removal using swap-and-pop
// Note: Does not preserve array order
function removeAtSwap(array, index) {
    array[index] = array[array.length - 1];
    array.pop();
}

// Calculate distance between two points
function getDistance(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
}

// Calculate squared distance between two points (faster, avoids sqrt)
function getDistanceSquared(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
}

// Calculate angle from one point to another
function getAngleTo(fromX, fromY, toX, toY) {
    return Math.atan2(toY - fromY, toX - fromX);
}

// Update a timer value (decreases by deltaTime, floors at 0)
function updateTimer(value, deltaTime) {
    return value > 0 ? value - deltaTime : 0;
}

// Check if two rectangles are colliding (both centered at x,y)
function checkRectCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 + w1/2 > x2 - w2/2 &&
           x1 - w1/2 < x2 + w2/2 &&
           y1 + h1/2 > y2 - h2/2 &&
           y1 - h1/2 < y2 + h2/2;
}

// Check collision between entity and ship hitbox
function checkShipHitboxCollision(entityX, entityY, entityRadius) {
    const hitboxY = ship.body.y + ship.centerOffsetY;
    const radiusSum = ship.radius + entityRadius;
    return getDistanceSquared(entityX, entityY, ship.body.x, hitboxY) < radiusSum * radiusSum;
}

// Spawn an aimed enemy bullet
function spawnAimedBullet(fromX, fromY, toX, toY, speed) {
    // Don't spawn bullets during dying state
    if (gameState === 'dying') return;

    const distance = getDistance(fromX, fromY, toX, toY);
    const dx = toX - fromX;
    const dy = toY - fromY;

    addEnemyBullet(
        fromX,
        fromY,
        (dx / distance) * speed,
        (dy / distance) * speed,
        6,
        '#ff69b4',
        true
    );
}

// Spawn a random direction enemy bullet
function spawnRandomBullet(x, y, speed) {
    // Don't spawn bullets during dying state
    if (gameState === 'dying') return;

    const angle = Math.random() * Math.PI * 2;

    addEnemyBullet(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        6,
        '#ff69b4',
        false
    );
}

// Apply velocity damping and speed limit to an entity
function applyDampingAndSpeedLimit(body, dampingFactor, maxSpeed, deltaTime) {
    body.vx *= dampingFactor;
    body.vy *= dampingFactor;

    const speed = Math.sqrt(body.vx * body.vx + body.vy * body.vy);
    if (speed > maxSpeed) {
        body,vx = (body.vx / speed) * maxSpeed;
        body.vy = (body.vy / speed) * maxSpeed;
    }
}

// Check if two points are within a certain distance (optimized with squared distance)
function isWithinDistance(x1, y1, x2, y2, threshold) {
    return getDistanceSquared(x1, y1, x2, y2) < threshold * threshold;
}

// Check if a body is offscreen and moving away (won't come back)
function isBodyOffscreenAndMovingAway(body, margin) {
    // Check if off left and moving left
    if (body.x < -margin && body.vx < 0) return true;
    // Check if off right and moving right
    if (body.x > canvas.width + margin && body.vx > 0) return true;
    // Check if off top and moving up
    if (body.y < -margin && body.vy < 0) return true;
    // Check if off bottom and moving down
    if (body.y > canvas.height + margin && body.vy > 0) return true;
    return false;
}

// ===== GAME FUNCTIONS =====

// Get joystick input
function getJoystickInput() {
    // Update gamepad state
    const gamepads = navigator.getGamepads();
    if (gamepads[0]) {
        gamepad = gamepads[0];
    }

    if (!gamepad) {
        return { x: 0, y: 0 };
    }

    // Left analog stick axes (typically axes[0] and axes[1])
    let x = gamepad.axes[0] || 0;
    let y = gamepad.axes[1] || 0;

    // Apply deadzone to prevent drift
    const deadzone = 0.15;
    let processedX = Math.abs(x) > deadzone ? x : 0;
    let processedY = Math.abs(y) > deadzone ? y : 0;

    // D-pad buttons (standard mapping: 12=up, 13=down, 14=left, 15=right)
    const dpadUp = gamepad.buttons[12]?.pressed || false;
    const dpadDown = gamepad.buttons[13]?.pressed || false;
    const dpadLeft = gamepad.buttons[14]?.pressed || false;
    const dpadRight = gamepad.buttons[15]?.pressed || false;

    // Add D-pad input (if pressed, set to -1 or 1)
    if (dpadLeft) processedX = -1;
    if (dpadRight) processedX = 1;
    if (dpadUp) processedY = -1;
    if (dpadDown) processedY = 1;

    return { x: processedX, y: processedY };
}

// Update ship position based on joystick input and keyboard
function handleMovementInputs() {
    const joystick = getJoystickInput();

    // Start with joystick input
    let inputX = joystick.x;
    let inputY = joystick.y;

    // Add keyboard input (keyboard overrides joystick if both are active)
    if (keys.ArrowLeft) inputX = -1;
    if (keys.ArrowRight) inputX = 1;
    if (keys.ArrowUp) inputY = -1;
    if (keys.ArrowDown) inputY = 1;

    // Store horizontal input for banking effect
    ship.horizontalInput += (inputX-ship.horizontalInput) * deltaTime * 0.3;

    // Apply velocity to physics body (direct control, not forces)
    ship.body.vx = inputX * ship.speed;
    ship.body.vy = inputY * ship.speed;
}

function updateShip() {
    // Keep ship within canvas bounds
    if (ship.body.x < ship.size / 2) {
        ship.body.x = ship.size / 2;
        ship.body.vx = 0;
    }
    if (ship.body.x > canvas.width - ship.size / 2) {
        ship.body.x = canvas.width - ship.size / 2;
        ship.body.vx = 0;
    }
    if (ship.body.y < ship.size / 2) {
        ship.body.y = ship.size / 2;
        ship.body.vy = 0;
    }
    if (ship.body.y > canvas.height - ship.size / 2) {
        ship.body.y = canvas.height - ship.size / 2;
        ship.body.vy = 0;
    }

    ship.collisionTimer = Math.max(0, ship.collisionTimer - deltaTime / 60.0);

    if (ship.body.lastHitImpulse > 0) {
        if (ship.collisionTimer > 0.0 && ship.collisionTimer < 0.5) {
            handlePlayerDeath();  
        } else {
            ship.collisionTimer = 1.0;
        }
    }
}

function calculateCurrentPlayerBulletCount() {
    let result = 0;
    for (let bullet of bullets) {
        result += bullet.isRainbow ? 3 : 1;
    }
    return result;    
}

function handleShooting() {
    // Check attack button from gamepad OR space bar from keyboard
    const gamepadAttack = gamepad?.buttons[0]?.pressed || false;
    const keyboardAttack = keys.Space;
    const attackButton = gamepadAttack || keyboardAttack;

    if (gameState === 'title') {
        // On title screen, fire button starts the game
        if (attackButton && !lastAttackButtonState) {
            gameState = 'playing';
        }
        lastAttackButtonState = attackButton;
        return;
    }

    // Don't allow shooting during dying state
    if (gameState === 'dying') {
        lastAttackButtonState = attackButton;
        return;
    }

    if (attackButton) {
        // Button is being held
        if (!lastAttackButtonState) {
            // Just pressed - start hold timer and fire first shot immediately
            rapidFireTimer = 0;
            rapidFireDelay = 10;
            shootBurst(); // Fire first burst immediately
        } else {
            rapidFireTimer += deltaTime;

            // Rapid fire while holding (fire when timer reaches delay)
            if (rapidFireTimer >= rapidFireDelay) {
                shootBullet(); // Fire bullet with spread
                rapidFireTimer = 0;

                // Calculate new random delay for next shot
                const baseDelay = Math.floor(Math.random() * 20) + 20; // 10-30
                const currentBulletCount = calculateCurrentPlayerBulletCount();

                rapidFireDelay = Math.max(1, Math.floor((baseDelay * currentBulletCount) / (maxBullets * 10)));
            }
        }
    } else {
        // Reset timers
        rapidFireTimer = 0;
        rapidFireDelay = 0;
    }

    lastAttackButtonState = attackButton;
}

function shootBullet() {
    // Calculate current bullet count (rainbow bullets count as 3)
    const currentBulletCount = calculateCurrentPlayerBulletCount();

    // Check if we have room for a bullet
    if (currentBulletCount >= maxBullets) return;

    // Determine if this is a rainbow bullet (1% chance per power level)
    const rainbowChance = Math.min(maxBullets, 100); // Cap at 100%
    const isRainbow = (currentBulletCount + 3 < maxBullets) && (Math.random() * 100 < rainbowChance);

    // Add 5 degree random spread
    const spreadAngle = 5 * Math.PI / 180; // 5 degrees in radians
    const randomAngle = (Math.random() - 0.5) * 2 * spreadAngle; // ±5 degrees
    const angle = -Math.PI / 2 + randomAngle; // -PI/2 for straight up

    // Fire single bullet with spread
    addPlayerBullet(
        ship.body.x,
        ship.body.y - ship.size / 2,
        bulletSize,
        bulletSize * 3,
        '#ffff00',
        Math.cos(angle) * bulletSpeed,
        Math.sin(angle) * bulletSpeed,
        isRainbow,
        Math.random() * 360
    );
}

function shootBurst() {
    const burstCountScale = 0.5;

    // Calculate burst count based on player power level
    let burstCount = Math.max(1, Math.floor(Math.min(10, Math.floor((maxBullets*burstCountScale)/2))) + 1);

    // Calculate current bullet count (rainbow bullets count as 3)
    const currentBulletCount = calculateCurrentPlayerBulletCount();

    burstCount = Math.min(burstCount, maxBullets-currentBulletCount);
    // Only shoot if we have room for some bullets
    if (burstCount < 1) return;

    const angleSpread = 5 * Math.PI / 180; // 10 degrees in radians
    const speed = bulletSpeed;
    const rainbowChance = Math.min((maxBullets-3), 100);

    // Center bullet at 0, with remaining bullets split evenly on both sides
    const angles = [0]; // Center bullet
    const bulletsPerSide = Math.floor((burstCount - 1) / 2);
    for (let i = 1; i <= bulletsPerSide; i++) {
        angles.push(-i * angleSpread); // Left side
        angles.push(i * angleSpread);  // Right side
    }

    for (let relativeAngle of angles) {
        const angle = relativeAngle - Math.PI / 2; // -PI/2 for straight up

        // Determine if this is a rainbow bullet
        const isRainbow = Math.random() * 100 < rainbowChance;

        addPlayerBullet(
            ship.body.x,
            ship.body.y - ship.size / 2,
            bulletSize * 3,
            bulletSize,
            '#ffff00',
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            isRainbow,
            Math.random() * 360
        );
    }
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];

        // Update position based on velocity (for burst shots) or default upward movement
        if (bullet.vx !== undefined && bullet.vy !== undefined) {
            bullet.x += bullet.vx * deltaTime;
            bullet.y += bullet.vy * deltaTime;
        } else {
            bullet.y -= bulletSpeed * deltaTime;
        }

        // Remove bullets that go off screen
        if (bullet.y < -bullet.height || bullet.x < -50 || bullet.x > canvas.width + 50) {
            returnPlayerBullet(bullet);
            removeAtSwap(bullets, i);
        }
    }
}

function checkBulletCollision(bullet, x, y, radius) {
    const dx = bullet.x - x;
    const dy = bullet.y - y;
    const distanceSquared = dx * dx + dy * dy;

    const check_radius = (radius+bullet.width)/2;
    return distanceSquared < check_radius*check_radius;
}

function getBulletDamage(bullet) {
    return bullet.isRainbow ? 4 : 1;
}

function checkBulletAsteroidCollisions() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];

        for (let j = asteroids.length - 1; j >= 0; j--) {
            const asteroid = asteroids[j];

            if (checkBulletCollision(bullet, asteroid.body.x, asteroid.body.y, asteroid.body.radius + 1)) {
                // Collision detected
                returnPlayerBullet(bullet);
                removeAtSwap(bullets, i);

                asteroid.health -= getBulletDamage(bullet);
                asteroid.hitFlash = 5; // Flash for 5 frames

                // Apply impulse based on bullet velocity and damage
                if (bullet.vx !== undefined && bullet.vy !== undefined) {
                    // Bullet has velocity - use it for impulse direction
                    Physics.applyImpulse(asteroid.body, bullet.vx, bullet.vy, 1);
                }

                if (asteroid.health <= 0) {
                    // Asteroid destroyed - spawn explosion, score popup, shoot bullet and remove
                    spawnExplosion(asteroid.body.x, asteroid.body.y, asteroid.size);
                    addScore(asteroid.body.x, asteroid.body.y, 1);
                    shootAsteroidBullet(asteroid);
                    asteroid.body.destroy = true;
                    removeAtSwap(asteroids, j);
                    asteroidsDestroyed++;
                }
                break; // Move to next bullet
            }
        }
    }
}

function shootAsteroidBullet(asteroid) {
    // Number of bullets = maxHealth - 1
    const bulletCount = asteroid.maxHealth - 1;

    // No bullets for 1 HP asteroids
    if (bulletCount < 1) return;

    // Don't fire if within 100 pixels of player
    if (isWithinDistance(asteroid.body.x, asteroid.body.y, ship.body.x, ship.body.y, 100)) return;

    for (let i = 0; i < bulletCount; i++) {
        // Always fire in random direction
        spawnRandomBullet(asteroid.body.x, asteroid.body.y, enemyBulletSpeed);
    }
}

function checkBulletBeetleCollisions() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];

        for (let j = beetles.length - 1; j >= 0; j--) {
            const beetle = beetles[j];

            // Circle collision detection (30% larger radius)
            if (checkBulletCollision(bullet, beetle.body.x, beetle.body.y, beetle.body.radius * 1.3)) {
                // Collision detected
                returnPlayerBullet(bullet);
                removeAtSwap(bullets, i);

                beetle.health -= getBulletDamage(bullet);
                beetle.hitFlash = 5; // Flash for 5 frames
                beetle.stunTimer = 15; // Pause for 250ms (15 frames at 60fps)

                // Apply impulse based on bullet velocity and damage
                if (bullet.vx !== undefined && bullet.vy !== undefined) {
                    // Bullet has velocity - use it for impulse direction
                    Physics.applyImpulse(beetle.body, bullet.vx, bullet.vy, 1);
                }

                if (beetle.health <= 0) {
                    // Beetle destroyed - spawn explosion and score popup
                    spawnExplosion(beetle.body.x, beetle.body.y, beetle.size);
                    addScore(beetle.body.x, beetle.body.y, 2);

                    // Shoot aimed bullets on death (only if far enough from player)
                    if (!isWithinDistance(beetle.body.x, beetle.body.y, ship.body.x, ship.body.y, 200)) {
                        const bulletCount = Math.floor(maxBullets * 0.1);
                        for (let k = 0; k < bulletCount; k++) {
                            // Add random spread of ±5 degrees
                            const baseAngle = getAngleTo(beetle.body.x, beetle.body.y, ship.body.x, ship.body.y);
                            const spread = (Math.random() - 0.5) * (10 * Math.PI / 180); // ±5 degrees
                            const angle = baseAngle + spread;

                            // Randomize speed by ±20%
                            const speedMultiplier = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
                            const speed = enemyBulletSpeed * 1.5 * speedMultiplier;

                            addEnemyBullet(
                                beetle.body.x,
                                beetle.body.y,
                                Math.cos(angle) * speed,
                                Math.sin(angle) * speed,
                                6,
                                '#ff69b4',
                                true
                            );
                        }
                    }

                    beetle.body.destroy = true;
                    removeAtSwap(beetles, j);
                    blueEnemiesDestroyed++;

                    // Spawn sentinel every 5 blue enemies destroyed
                    if (blueEnemiesDestroyed >= 5) {
                        sentinelSpawnCount++;

                        // Every 4th spawn, spawn two sentinels
                        if (sentinelSpawnCount % 4 === 0) {
                            spawnSentinel();
                            spawnSentinel(150); // Second sentinel, higher position
                        } else {
                            spawnSentinel();
                        }

                        blueEnemiesDestroyed = 0;
                    }
                }
                break; // Move to next bullet
            }
        }
    }
}

function checkBulletSentinelCollisions() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];

        for (let j = sentinels.length - 1; j >= 0; j--) {
            const enemy = sentinels[j];

            // Circle collision detection (30% larger radius)
            if (checkBulletCollision(bullet, enemy.body.x, enemy.body.y, enemy.body.radius * 1.3)) {
                // Collision detected
                returnPlayerBullet(bullet);
                removeAtSwap(bullets, i);

                enemy.health -= getBulletDamage(bullet);
                enemy.hitFlash = 5; // Flash for 5 frames

                if (enemy.health <= 0) {
                    // Sentinel destroyed - spawn explosion, score popup, and powerup text
                    spawnExplosion(enemy.body.x, enemy.body.y, Math.max(enemy.width, enemy.height));
                    addScore(enemy.body.x, enemy.body.y, 10);
                    spawnPowerupText(enemy.body.x, enemy.body.y + 20);

                    // Shoot final burst on death (only if far enough from player)
                    if (!isWithinDistance(enemy.body.x, enemy.body.y, ship.body.x, ship.body.y, 200)) {
                        shootSentinelBullets(enemy);
                    }

                    enemy.body.destroy = true;
                    removeAtSwap(sentinels, j);
                    maxBullets += 3; // Increase bullet limit by 3

                    // Track Sentinel kills and queue centipedes every 6 kills
                    sentinelKills++;
                    if (sentinelKills % 6 === 0) {
                        const centipedesToSpawn = Math.floor(sentinelKills / 6);
                        centipedeSpawnQueue += centipedesToSpawn;
                    }
                }
                break; // Move to next bullet
            }
        }
    }
}

function checkBulletCentipedeCollisions() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        let bulletHit = false;

        for (let centipede of centipedes) {
            for (let segment of centipede.segments) {
                if (segment.health <= 0) continue; // Skip destroyed segments

                if (checkBulletCollision(bullet, segment.x, segment.y, segment.size/2)) {
                    // Collision detected
                    returnPlayerBullet(bullet);
                    removeAtSwap(bullets, i);
                    bulletHit = true;

                    segment.health -= getBulletDamage(bullet);
                    segment.hitFlash = 5; // Flash for 5 frames

                    if (segment.health <= 0) {
                        // Segment destroyed - spawn explosion and score
                        spawnExplosion(segment.x, segment.y, segment.size);
                        addScore(segment.x, segment.y, 3);

                        // Shoot 8 pink bullets in a circle
                        const bulletCount = 8;
                        for (let k = 0; k < bulletCount; k++) {
                            const angle = (k / bulletCount) * Math.PI * 2;
                            const vx = Math.cos(angle) * enemyBulletSpeed;
                            const vy = Math.sin(angle) * enemyBulletSpeed;

                            addEnemyBullet(
                                segment.x,
                                segment.y,
                                vx,
                                vy,
                                6,
                                '#ff69b4',
                                false
                            );
                        }
                    }
                    break;
                }
            }
            if (bulletHit) break;
        }
    }
}

function handlePlayerDeath() {
    // God mode prevents death
    if (godMode) {
        return;
    }

    // Update high score if current score is higher
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('vibeShooterHighScore', highScore);
    }

    // Spawn explosion at player position
    spawnExplosion(ship.body.x, ship.body.y, ship.size * 1.5);

    // Set dying state and start death timer (2 seconds = 120 frames at 60fps)
    gameState = 'dying';
    deathTimer = 120;
}

function resetGame() {
    // Reset game state to title
    gameState = 'title';

    // Reset score and counters
    score = 0;
    blueEnemiesDestroyed = 0;
    asteroidsDestroyed = 0;
    sentinelSpawnCount = 0;
    sentinelKills = 0;
    rapidFireTimer = 0;
    rapidFireDelay = 0;
    centipedeSpawnQueue = 0;
    centipedeSpawnTimer = 0;

    // Reset power level to starting value
    maxBullets = 3;

    // Return all bullets to pools before clearing
    for (let bullet of bullets) {
        returnPlayerBullet(bullet);
    }
    for (let bullet of enemyBullets) {
        returnEnemyBullet(bullet);
    }

    // Clear all game objects
    bullets.length = 0;
    asteroids.length = 0;
    beetles.length = 0;
    sentinels.length = 0;
    centipedes.length = 0;
    enemyBullets.length = 0;
    explosions.length = 0;
    scorePopups.length = 0;
    powerupTexts.length = 0;

    // Reset physics system (clears all bodies and returns them to pool)
    Physics.resetAll();

    // Recreate ship physics body after reset
    ship.body = Physics.addCollisionBody(canvas.width / 2, canvas.height - 250, 4.5, 0, 0, 0.2);
    ship.horizontalInput = 0;
}

function checkEnemyBulletPlayerCollisions() {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];

        if (checkShipHitboxCollision(bullet.x, bullet.y, bullet.size / 2)) {
            // Player hit - return to title screen
            handlePlayerDeath();
            return;
        }
    }
}

function spawnAsteroid() {
    const size = Math.random() * (asteroidSize.max - asteroidSize.min) + asteroidSize.min;
    const speed = Math.random() * (asteroidSpeed.max - asteroidSpeed.min) + asteroidSpeed.min;

    // Calculate health based on player power: 1 HP + 1 per 10 power levels
    const health = 1 + Math.floor(maxBullets / 10);

    // Generate consistent shape vertices
    const sides = 8;
    const vertices = [];
    for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2;
        const variance = 0.7 + Math.random() * 0.3; // Random irregularity
        const radius = size / 2 * variance;
        vertices.push({
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius
        });
    }

    // Spawn at least 'size' distance from left and right edges
    const x = Math.random() * (canvas.width - size * 2) + size;
    const y = -size;
    // Calculate mass based on size: 1-3 (size ranges from 20-50)
    const mass = Math.min(3, Math.max(1, Math.round((size - 20) / 10) + 1));
    const body = Physics.addCollisionBody(x, y, size / 2, 0, speed, mass);

    asteroids.push({
        body: body,
        size: size,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.04,
        rotationAxisX: Math.random() * Math.PI,
        rotationAxisY: Math.random() * Math.PI,
        health: health,
        maxHealth: health,
        hitFlash: 0,
        vertices: vertices
    });
}

function updateAsteroids() {
    // Randomly spawn new asteroids
    if (Math.random() < asteroidSpawnRate * deltaTime) {
        spawnAsteroid();
    }

    // Update existing asteroids
    for (let i = asteroids.length - 1; i >= 0; i--) {
        const asteroid = asteroids[i];

        // Update hit flash timer
        asteroid.hitFlash = updateTimer(asteroid.hitFlash, deltaTime);

        asteroid.rotation += asteroid.rotationSpeed * deltaTime;

        // Remove asteroids that go off screen and are moving away
        if (isBodyOffscreenAndMovingAway(asteroid.body, asteroid.size)) {
            asteroid.body.destroy = true;
            removeAtSwap(asteroids, i);
        }
    }
}

function isBeetleStartPositionValid(x, y, minDistance) {
    // Check if start position is too close to any existing beetle's body position
    for (let beetle of beetles) {
        const distToCurrent = getDistanceSquared(x, y, beetle.body.x, beetle.body.y);
        if (distToCurrent < minDistance * minDistance) {
            return false;
        }
    }
    return true;
}

function isBeetleTargetPositionValid(x, y, minDistance) {
    // Check if target position is too close to any existing beetle's target position
    for (let beetle of beetles) {
        const distToTarget = getDistanceSquared(x, y, beetle.targetX, beetle.targetY);
        if (distToTarget < minDistance * minDistance) {
            return false;
        }
    }
    return true;
}

function spawnBeetle() {
    const minDistance = beetleSize * 2;
    const maxAttempts = 10;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Random start position from top
        const startX = Math.random() * canvas.width;
        const startY = -beetleSize;

        // Determine which side of screen and keep target on same side
        const isLeftSide = startX < canvas.width / 2;
        let targetX;
        if (isLeftSide) {
            // Left side: target between 100 and middle
            targetX = Math.random() * (canvas.width / 2 - 100) + 100;
        } else {
            // Right side: target between middle and width - 100
            targetX = Math.random() * (canvas.width / 2 - 100) + canvas.width / 2;
        }
        const targetY = Math.random() * 200 + 100; // Mid screen area

        // Validate positions before spawning
        if (!isBeetleStartPositionValid(startX, startY, minDistance) ||
            !isBeetleTargetPositionValid(targetX, targetY, minDistance)) {
            continue; // Try again with new positions
        }

        // Exit towards the same side they entered from
        const exitX = isLeftSide ? -beetleSize : canvas.width + beetleSize;
        const exitY = targetY + (Math.random() * 100 - 50); // Exit near same Y

        // Calculate health: base 2 HP + 1 per 12 power levels
        const extraHP = Math.floor(maxBullets / 12);
        const health = 2 + extraHP;

        // Calculate color based on extra HP (blue to purple, capped at 5 extra HP)
        const colorExtraHP = Math.min(extraHP, 5);
        const ratio = colorExtraHP / 5; // 0 at base, 1 at 5 extra HP
        const r = Math.floor(136 * ratio); // 0 to 136
        const g = Math.floor(136 * (1 - ratio)); // 136 to 0
        const b = 255; // Always 255
        const color = `rgb(${r}, ${g}, ${b})`;

        const mass = 1; // Beetles have mass of 1
        const body = Physics.addCollisionBody(startX, startY, beetleSize, 0, 0, mass);

        beetles.push({
            body: body,
            size: beetleSize,
            color: color,
            baseColor: color,
            state: 'entering', // entering, pausing, shooting, exiting
            targetX: targetX,
            targetY: targetY,
            exitX: exitX,
            exitY: exitY,
            pauseTimer: 0,
            hasShot: false,
            health: health,
            hitFlash: 0,
            stunTimer: 0,
            shootingBulletsRemaining: 0,
            shootingTimer: 0,
            wingFlapTimer: Math.random() * Math.PI * 2, // Random starting phase
            rotation: 0, // Current rotation in radians
            rotationVelocity: 0,
            targetRotation: 0 // Target rotation based on velocity
        });
        return; // Successfully spawned
    }
    // If we get here, we failed to find a valid position after maxAttempts
    // Just skip spawning this beetle
}

function updateBeetles() {
    // Calculate spawn rate multiplier based on asteroids destroyed
    // Every 10 asteroids increases spawn rate by 5%
    const spawnRateMultiplier = 1 + (Math.floor(asteroidsDestroyed / 10) * 0.05);
    const adjustedSpawnRate = beetleSpawnRate * spawnRateMultiplier * deltaTime;

    // Randomly spawn new beetles
    if (Math.random() < adjustedSpawnRate) {
        spawnBeetle();
    }

    const acceleration = 0.1;
    const movementDampingFactor = Math.pow(0.97, deltaTime);
    const stillDampingFactor = Math.pow(0.9, deltaTime);
    // Increase speed by 10% for every 5 power levels
    const baseMaxSpeed = 6; // 50% faster than original 4
    const maxSpeed = baseMaxSpeed * (1 + Math.floor(maxBullets / 5) * 0.1);
    const arrivalThreshold = 20;

    // Update existing beetles
    for (let i = beetles.length - 1; i >= 0; i--) {
        const beetle = beetles[i];

        // Update hit flash timer
        beetle.hitFlash = updateTimer(beetle.hitFlash, deltaTime);

        // Update wing flap timer
        beetle.wingFlapTimer += deltaTime * 0.15; // Speed of flapping

        // Update stun timer
        beetle.stunTimer = updateTimer(beetle.stunTimer, deltaTime);
        if (beetle.stunTimer > 0) {
            continue; // Skip movement while stunned
        }

        if (beetle.state === 'entering') {
            // Calculate acceleration toward target
            const dx = beetle.targetX - beetle.body.x;
            const dy = beetle.targetY - beetle.body.y;
            const distanceSquared = getDistanceSquared(beetle.body.x, beetle.body.y, beetle.targetX, beetle.targetY);

            if (distanceSquared < arrivalThreshold * arrivalThreshold) {
                // Reached target - gradually slow down
                const slowdownDamping = Math.pow(0.9, deltaTime);
                beetle.body.vx *= slowdownDamping;
                beetle.body.vy *= slowdownDamping;

                if (Math.abs(beetle.body.vx) < 0.1 && Math.abs(beetle.body.vy) < 0.1) {
                    beetle.state = 'pausing';
                    beetle.pauseTimer = beetlePauseDuration;
                }
            } else {
                // Apply acceleration toward target (need actual distance for normalization)
                const distance = Math.sqrt(distanceSquared);
                const ax = (dx / distance) * acceleration;
                const ay = (dy / distance) * acceleration;

                beetle.body.vx += ax * deltaTime;
                beetle.body.vy += ay * deltaTime;
            }

            // Apply damping and limit max speed
            applyDampingAndSpeedLimit(beetle.body, movementDampingFactor, maxSpeed, deltaTime);

            // Update rotation to point to the target
            if ((dx*dx+dy*dy) > 100) {
                beetle.targetRotation = Math.atan2(dy, dx);
            }

        } else if (beetle.state === 'pausing') {
            // Calculate dynamic shoot timing based on player power
            // Higher power = shoots sooner (divide pause by power level)
            const basePauseBeforeShoot = 100; // Base pause time in frames
            const adjustedPauseBeforeShoot = Math.max(10, Math.floor(basePauseBeforeShoot / maxBullets));
            const dynamicShootTiming = beetlePauseDuration - adjustedPauseBeforeShoot;

            // Point toward player while paused
            const dx = ship.body.x - beetle.body.x;
            const dy = ship.body.y - beetle.body.y;

            // Update rotation to point to the target
            if ((dx*dx+dy*dy) > 100) {
                beetle.targetRotation = Math.atan2(dy, dx);
            }            

            // Start shooting before leaving (check before decrementing timer)
            if (beetle.pauseTimer > dynamicShootTiming && !beetle.hasShot) {
                // Check if we'll cross the threshold this frame
                if (beetle.pauseTimer - deltaTime <= dynamicShootTiming) {
                    beetle.state = 'shooting';
                    beetle.hasShot = true;
                    // Calculate bullets based on player power: 1 bullet per 10 power levels
                    beetle.shootingBulletsRemaining = Math.floor(maxBullets / 10) + 1;
                    beetle.shootingTimer = 0;
                }
            }

            // Apply damping and limit max speed
            applyDampingAndSpeedLimit(beetle.body, stillDampingFactor, maxSpeed, deltaTime);

            // Wait at position
            beetle.pauseTimer -= deltaTime;

            if (beetle.pauseTimer <= 0) {
                beetle.state = 'exiting';
            }
        } else if (beetle.state === 'shooting') {
            // Point toward player while shooting
            const dx = ship.body.x - beetle.body.x;
            const dy = ship.body.y - beetle.body.y;
            beetle.targetRotation = Math.atan2(dy, dx);

            // Fire bullets one at a time with delay
            beetle.shootingTimer += deltaTime;

            if (beetle.shootingTimer >= 18) { // 300ms at 60fps = 18 frames
                shootEnemyBullet(beetle);
                beetle.shootingBulletsRemaining--;
                beetle.shootingTimer = 0;

                if (beetle.shootingBulletsRemaining <= 0) {
                    beetle.state = 'pausing'; // Return to pausing state
                }
            }

            // Apply damping and limit max speed
            applyDampingAndSpeedLimit(beetle.body, stillDampingFactor, maxSpeed, deltaTime);

        } else if (beetle.state === 'exiting') {
            // Calculate acceleration toward exit
            const dx = beetle.exitX - beetle.body.x;
            const dy = beetle.exitY - beetle.body.y;
            const distanceSquared = getDistanceSquared(beetle.body.x, beetle.body.y, beetle.exitX, beetle.exitY);

            if (distanceSquared > 0) {
                // Apply acceleration toward exit (need actual distance for normalization)
                const distance = Math.sqrt(distanceSquared);
                const ax = (dx / distance) * acceleration;
                const ay = (dy / distance) * acceleration;

                beetle.body.vx += ax * deltaTime;
                beetle.body.vy += ay * deltaTime;

                // Apply damping and limit max speed
                applyDampingAndSpeedLimit(beetle.body, movementDampingFactor, maxSpeed, deltaTime);

                // Update rotation to point to the target
                if ((dx*dx+dy*dy) > 100) {
                    beetle.targetRotation = Math.atan2(dy, dx);
                }
            }

            // Remove if off screen and moving away
            if (isBodyOffscreenAndMovingAway(beetle.body, beetleSize)) {
                beetle.body.destroy = true;
                removeAtSwap(beetles, i);
            }
        }

        // Interpolate rotation toward target rotation (for all beetles)
        const rotationSpeed = 0.1 * deltaTime; // Adjust this value to control rotation speed
        let rotationDiff = beetle.targetRotation - beetle.rotation;

        // Normalize the difference to the range [-PI, PI] for shortest path
        while (rotationDiff > Math.PI) rotationDiff -= Math.PI*2;
        while (rotationDiff < -Math.PI) rotationDiff += Math.PI*2;

        const rotationSpeedCap = Math.PI/5;
        if (rotationDiff > rotationSpeedCap) rotationDiff = rotationSpeedCap;
        if (rotationDiff < -rotationSpeedCap) rotationDiff = -rotationSpeedCap;

        // Interpolate
        beetle.rotationVelocity = rotationDiff;
        beetle.rotation += rotationDiff * rotationSpeed;

        // Normalize rotation to [0, 2*PI]
        while (beetle.rotation < 0) beetle.rotation += Math.PI*2;
        while (beetle.rotation >= Math.PI) beetle.rotation -= Math.PI*2;
    }
}

function spawnSentinel(adjustY = 0) {
    // Random X position, keeping enemy fully on screen
    const randomX = Math.random() * (canvas.width - sentinelWidth) + sentinelWidth / 2;

    // Calculate health: base 10 HP + 1 per power level
    const health = 10 + Math.floor(maxBullets);

    // If this is the second sentinel, place it higher to avoid overlap
    const startY = -sentinelHeight - adjustY;

    const mass = 20; // Sentinels are large and heavy
    const body = Physics.addCollisionBody(randomX, startY, sentinelWidth / 2, 0, sentinelSpeed, mass);

    sentinels.push({
        body: body,
        width: sentinelWidth,
        height: sentinelHeight,
        color: '#cccccc',
        health: health,
        hitFlash: 0,
        shootTimer: 60, // Shoot every 60 frames (1 second at 60fps)
        bulletRotation: 0, // Current rotation angle
        rotationDirection: Math.random() < 0.5 ? 1 : -1, // Randomly rotate clockwise or counter-clockwise
        blinkTimer: Math.random() * Math.PI * 2, // Random starting phase for lights
        spawnX: randomX,
        targetY: body.y
    });
}

function spawnCentipede() {
    // Randomly choose left or right side to start
    const startLeft = Math.random() < 0.5;

    // Random Y position at top (0 to 100 pixels from top)
    const startY = Math.random() * 100;
    const startX = startLeft ? -250 : canvas.width + 250;

    // Random Y position at bottom on opposite side
    const endY = canvas.height - Math.random() * 100;
    const endX = startLeft ? canvas.width + 250 : -250;

    // Create segments based on player power level
    const numSegments = 5 + Math.floor(maxBullets * 0.2);
    const bodyHealth = Math.floor(5 + Math.floor(maxBullets * 0.025));
    const headHealth = bodyHealth * 10;
    const segmentSize = 40;
    const segmentSpacing = segmentSize; // Distance between segment centers (they touch)
    const segments = [];

    for (let i = 0; i < numSegments; i++) {
        segments.push({
            x: startX,
            y: startY,
            size: segmentSize,
            health: i === 0 ? headHealth : bodyHealth,
            hitFlash: 0,
            shootFlash: 0
        });
    }

    // Calculate total distance and direction
    const totalDistance = getDistance(startX, startY, endX, endY);
    const speed = 1;

    centipedes.push({
        segments: segments,
        startX: startX,
        startY: startY,
        endX: endX,
        endY: endY,
        speed: speed,
        segmentSpacing: segmentSpacing,
        distance: 0, // Current distance traveled by head
        totalDistance: totalDistance,
        color: '#ff8800', // Orange color
        wiggleTime: 0 // For sine wave animation
    });
}

function updateCentipedeSpawnQueue() {
    // If there are centipedes in the queue
    if (centipedeSpawnQueue > 0) {
        // Countdown the timer
        centipedeSpawnTimer -= deltaTime;

        // If timer reached zero, spawn a centipede
        if (centipedeSpawnTimer <= 0) {
            spawnCentipede();
            centipedeSpawnQueue--;
            // Reset timer for next centipede (300 frames = 5 seconds at 60fps)
            centipedeSpawnTimer = 300;
        }
    }
}

function updateCentipedes() {
    for (let i = centipedes.length - 1; i >= 0; i--) {
        const centipede = centipedes[i];

        // Move the head along the path
        centipede.distance += centipede.speed * deltaTime;
        centipede.wiggleTime += 0.05 * deltaTime; // Increment for sine wave animation

        // Calculate perpendicular direction for sine wave (rotate 90 degrees)
        const pathDx = centipede.endX - centipede.startX;
        const pathDy = centipede.endY - centipede.startY;
        const pathLength = getDistance(centipede.startX, centipede.startY, centipede.endX, centipede.endY);
        const perpX = -pathDy / pathLength; // Perpendicular X
        const perpY = pathDx / pathLength;  // Perpendicular Y

        // Update all segments along the same sine wave path
        for (let j = 0; j < centipede.segments.length; j++) {
            const segment = centipede.segments[j];

            // Calculate this segment's distance along the path (behind the head)
            const segmentDistance = centipede.distance - (j * centipede.segmentSpacing);
            const segmentProgress = segmentDistance / centipede.totalDistance;

            // Calculate base position on straight path
            const baseX = centipede.startX + (centipede.endX - centipede.startX) * segmentProgress;
            const baseY = centipede.startY + (centipede.endY - centipede.startY) * segmentProgress;

            // Apply same sine wave offset based on distance along path
            const sineOffset = Math.sin(centipede.wiggleTime + segmentDistance * 0.02) * 22.5;
            segment.x = baseX + perpX * sineOffset;
            segment.y = baseY + perpY * sineOffset;

            // Update flash timers
            segment.hitFlash = updateTimer(segment.hitFlash, deltaTime);
            segment.shootFlash = updateTimer(segment.shootFlash, deltaTime);

            // Visible segments have 1% chance to fire aimed bullet each frame
            if (segment.health > 0 &&
                segment.x >= 0 && segment.x <= canvas.width &&
                segment.y >= 0 && segment.y <= canvas.height &&
                Math.random() < 0.01 * deltaTime) {

                // Fire aimed bullet at player
                spawnAimedBullet(segment.x, segment.y, ship.body.x, ship.body.y, enemyBulletSpeed * 1.5);

                // Flash red when shooting
                segment.shootFlash = 5;
            }

            // Visible segments have 2% chance to fire random bullet each frame
            if (segment.health > 0 &&
                segment.x >= 0 && segment.x <= canvas.width &&
                segment.y >= 0 && segment.y <= canvas.height &&
                Math.random() < 0.02 * deltaTime) {

                // Fire random direction bullet
                spawnRandomBullet(segment.x, segment.y, enemyBulletSpeed);

                // Flash red when shooting
                segment.shootFlash = 5;
            }
        }

        // Check if all segments are destroyed
        const allSegmentsDestroyed = centipede.segments.every(seg => seg.health <= 0);

        // Check if all segments are off screen on the destination side
        const travelingRight = centipede.endX > centipede.startX;
        const allSegmentsOffScreen = travelingRight
            ? centipede.segments.every(seg => seg.x > canvas.width + 50)
            : centipede.segments.every(seg => seg.x < -50);

        if (allSegmentsDestroyed) {
            // Remove if all segments destroyed
            removeAtSwap(centipedes, i);
        } else if (allSegmentsOffScreen) {
            // Teleport to new random position if all segments off screen but still has living segments
            const startLeft = Math.random() < 0.5;
            const startY = Math.random() * 100;
            const startX = startLeft ? -250 : canvas.width + 250;
            const endY = canvas.height - Math.random() * 100;
            const endX = startLeft ? canvas.width + 250 : -250;

            // Update centipede path
            centipede.startX = startX;
            centipede.startY = startY;
            centipede.endX = endX;
            centipede.endY = endY;

            centipede.totalDistance = getDistance(startX, startY, endX, endY);
            centipede.distance = 0;

            // Reset all segment positions to new start
            for (let seg of centipede.segments) {
                seg.x = startX;
                seg.y = startY;
            }
        }
    }
}

function updateSentinels() {
    const stillDampingFactor = Math.pow(0.9, deltaTime);
 
    for (let i = sentinels.length - 1; i >= 0; i--) {
        const enemy = sentinels[i];

        // Update hit flash timer
        enemy.hitFlash = updateTimer(enemy.hitFlash, deltaTime);

        // Update blink timer for lights
        enemy.blinkTimer += deltaTime * 0.2; // Speed of blinking

        // Update shoot timer and shoot
        enemy.shootTimer -= deltaTime;
        if (enemy.shootTimer <= 0) {
            shootSentinelBullets(enemy);
            enemy.shootTimer = 60; // Reset timer
        }

        enemy.targetY += sentinelSpeed * deltaTime;

        // Update physics body velocity (sentinels move downward at a constant rate) and position X (to maintain their original X)
        enemy.body.vy += (enemy.targetY-enemy.body.y) * 0.05 * deltaTime;

        applyDampingAndSpeedLimit(enemy.body, stillDampingFactor, sentinelSpeed * 1.2, deltaTime);

        // Remove if off screen
        if (enemy.body.y > canvas.height + enemy.height) {
            enemy.body.destroy = true;
            removeAtSwap(sentinels, i);
        }
    }
}

function shootEnemyBullet(enemy) {
    // Don't spawn bullets during dying state
    if (gameState === 'dying') return;

    // Calculate direction to player
    const dx = ship.body.x - enemy.body.x;
    const dy = ship.body.y - enemy.body.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Normalize direction and offset spawn position to front edge
    const nx = dx / distance;
    const ny = dy / distance;
    const offset = enemy.size / 2;
    const spawnX = enemy.body.x + nx * offset;
    const spawnY = enemy.body.y + ny * offset;

    // Fire aimed bullet at player from front edge
    spawnAimedBullet(spawnX, spawnY, ship.body.x, ship.body.y, enemyBulletSpeed * 1.5);
}

function shootSentinelBullets(enemy) {
    // Don't spawn bullets during dying state
    if (gameState === 'dying') return;

    // Shoot bullets in a circle with rotation
    // Base 8 bullets + 1 bullet per 5 player power levels
    const bulletCount = 8 + Math.floor(maxBullets / 5);

    for (let i = 0; i < bulletCount; i++) {
        const angle = (i / bulletCount) * Math.PI * 2 + enemy.bulletRotation;
        const vx = Math.cos(angle) * enemyBulletSpeed;
        const vy = Math.sin(angle) * enemyBulletSpeed;

        addEnemyBullet(
            enemy.body.x,
            enemy.body.y,
            vx,
            vy,
            6,
            '#ff69b4',
            false
        );
    }

    // Rotate by 10 degrees for next burst (10 degrees = ~0.1745 radians)
    enemy.bulletRotation += (10 * Math.PI / 180) * enemy.rotationDirection;
}

function updateEnemyBullets() {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];

        bullet.x += bullet.vx * deltaTime;
        bullet.y += bullet.vy * deltaTime;

        // Remove bullets that go off screen
        if (bullet.x < -10 || bullet.x > canvas.width + 10 ||
            bullet.y < -10 || bullet.y > canvas.height + 10) {
            returnEnemyBullet(bullet);
            removeAtSwap(enemyBullets, i);
        }
    }
}

function spawnExplosion(x, y, size) {
    explosions.push({
        x: x,
        y: y,
        maxSize: size,
        timer: 0,
        lifetime: 20, // Frames for complete animation
        // Random offsets for each circle
        yellowOffsetX: (Math.random() - 0.5) * size * 0.3,
        yellowOffsetY: (Math.random() - 0.5) * size * 0.3,
        whiteOffsetX: (Math.random() - 0.5) * size * 0.3,
        whiteOffsetY: (Math.random() - 0.5) * size * 0.3
    });
}

function updateExplosions() {
    for (let i = explosions.length - 1; i >= 0; i--) {
        const explosion = explosions[i];
        explosion.timer += deltaTime;

        // Remove explosion when animation is complete
        if (explosion.timer >= explosion.lifetime) {
            removeAtSwap(explosions, i);
        }
    }
}

function spawnScorePopup(x, y, points) {
    scorePopups.push({
        x: x,
        y: y,
        points: points,
        timer: 0,
        lifetime: 60 // 1 second at 60fps
    });
}

function addScore(x, y, points) {
    if (!godMode) {
        spawnScorePopup(x, y, points);
        score += points;
    }
}

function updateScorePopups() {
    for (let i = scorePopups.length - 1; i >= 0; i--) {
        const popup = scorePopups[i];
        popup.timer += deltaTime;

        // Move upward
        popup.y -= 1 * deltaTime;

        // Remove when lifetime expires
        if (popup.timer >= popup.lifetime) {
            removeAtSwap(scorePopups, i);
        }
    }
}

function spawnPowerupText(x, y) {
    powerupTexts.push({
        x: x,
        y: y,
        timer: 0,
        lifetime: 60 // 1 second at 60fps
    });
}

function updatePowerupTexts() {
    for (let i = powerupTexts.length - 1; i >= 0; i--) {
        const text = powerupTexts[i];
        text.timer += deltaTime;

        // Don't move - stay at same Y position

        // Remove when lifetime expires
        if (text.timer >= text.lifetime) {
            removeAtSwap(powerupTexts, i);
        }
    }
}

// Render the game
// Game loop
function gameLoop(currentTime) {
    // Calculate deltaTime (1.0 at 60 FPS)
    if (lastTime === 0) {
        lastTime = currentTime;
        deltaTime = 1.0; // Default to 1.0 on first frame
    } else {
        const elapsed = currentTime - lastTime;
        lastTime = currentTime;
        deltaTime = Math.max(0.1, Math.min(2.0, elapsed * 60 / 1000)); // 1.0 at 60 FPS (16.666ms per frame)
    }

    // Apply half-speed mode if enabled
    if (halfSpeedMode) {
        deltaTime /= 2;
    }

    updateStars();
    handleShooting(); // Check for input in all states

    if (gameState === 'playing') {
        handleMovementInputs();

        Physics.update(deltaTime);
        updateAsteroids();
        updateBeetles();
        updateSentinels();
        updateCentipedeSpawnQueue();
        updateCentipedes();
        updateEnemyBullets();
        updateExplosions();
        updateScorePopups();
        updatePowerupTexts();
        updateShip();
        updateBullets();
        checkBulletAsteroidCollisions();
        checkBulletBeetleCollisions();
        checkBulletSentinelCollisions();
        checkBulletCentipedeCollisions();
        checkEnemyBulletPlayerCollisions();


        // Update high score in memory (saved to localStorage only on death)
        if (score > highScore && !godMode) {
            highScore = score;
        }
    } else if (gameState === 'dying') {
        // Continue updating some visual elements during death
        Physics.update(deltaTime);
        updateExplosions();
        updateScorePopups();
        updatePowerupTexts();
        updateEnemyBullets();
        updateBullets();
        updateAsteroids();
        updateBeetles();
        updateSentinels();
        updateCentipedes();

        // Count down death timer
        deathTimer -= deltaTime;
        if (deathTimer <= 0) {
            resetGame();
        }
    }

    // Render
    Render3D.render();
    requestAnimationFrame(gameLoop);
}

// Initialize game
async function init() {
    console.log('Game initialized. Connect a gamepad to start playing.');

    // Initialize 3D renderer
    const init3DSuccess = await Render3D.init(canvas);
    if (init3DSuccess !== false) {
        console.log('3D WebGL renderer initialized');
    } else {
        console.error('Failed to initialize 3D renderer');
    }

    initStars();
    requestAnimationFrame(gameLoop);
}

// Start the game when page loads
init();
