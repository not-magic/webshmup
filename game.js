// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const infoDiv = document.getElementById('info');

// Game objects
const ship = {
    x: canvas.width / 2,
    y: canvas.height - 250, // 250 pixels from bottom
    size: 40,
    speed: 5,
    color: '#00ff00',
    hitboxRadius: 4.5, // Small circle hitbox in center
    hitboxOffsetY: 3, // Hitbox moved down 3 pixels
    horizontalInput: 0 // Track horizontal input for banking effect
};

// Star field for background
const stars = [];
const starCount = 200;

function initStars() {
    for (let i = 0; i < starCount; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            speed: Math.random() * 2 + 0.5, // Speed between 0.5 and 2.5
            brightness: Math.random() * 155 + 100 // Brightness between 100 and 255 (grey to white)
        });
    }
}

function updateStars() {
    for (let star of stars) {
        star.y += star.speed;

        // Wrap around when star goes off screen
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
    }
}

function drawStars() {
    for (let star of stars) {
        const color = Math.floor(star.brightness);
        ctx.fillStyle = `rgb(${color}, ${color}, ${color})`;
        ctx.fillRect(star.x, star.y, 1, 1);
    }
}

// Game state
let gameState = 'title'; // 'title', 'playing', or 'dying'
let deathTimer = 0; // Timer for death delay (120 frames = 2 seconds at 60fps)
let godMode = false; // Debug god mode

// Gamepad state
let gamepad = null;
let lastAttackButtonState = false;
const chargeTime = 30; // 0.5 seconds at 60fps
const burstInterval = 10; // ~0.17 seconds at 60fps
let lastBurstTime = 0;
let rapidFireDelay = 0; // Frames until next rapid fire shot
let rapidFireTimer = 0; // Frames since last rapid fire shot

// Score
let score = 0;
let highScore = parseInt(localStorage.getItem('vibeShooterHighScore')) || 0;
let blueEnemiesDestroyed = 0;
let asteroidsDestroyed = 0;
let largeEnemySpawnCount = 0; // Track UFO spawns
let ufoKills = 0; // Track UFO destructions for centipede spawning

// Bullets
const bullets = [];
let maxBullets = 3; // Start with 3 bullets, increase by destroying large enemies
const bulletSpeed = 8;
const bulletSize = 4;

// Asteroids
const asteroids = [];
const asteroidSpawnRate = 0.02; // Probability per frame
const asteroidSpeed = { min: 1, max: 3 };
const asteroidSize = { min: 20, max: 50 };

// Enemies
const enemies = [];
const enemySpawnRate = 0.005; // Probability per frame
const enemySize = 30;
const enemySpeed = 2;
const enemyPauseDuration = 120; // Frames to pause (2 seconds at 60fps)
const enemyShootTiming = 20; // Shoot 20 frames before leaving

// Enemy bullets
const enemyBullets = [];
const enemyBulletSpeed = 4.5;

// Large white enemies
const largeEnemies = [];
const largeEnemyWidth = 100;
const largeEnemyHeight = 40;
const largeEnemySpeed = 1;

// Centipedes
const centipedes = [];

// Explosions
const explosions = [];

// Score popups
const scorePopups = [];

// Powerup text effects
const powerupTexts = [];

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
    infoDiv.textContent = `Gamepad connected: ${gamepad.id}`;
    console.log('Gamepad connected:', gamepad);
});

window.addEventListener('gamepaddisconnected', (e) => {
    gamepad = null;
    infoDiv.textContent = 'Gamepad disconnected. Please connect a gamepad/joystick.';
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
function updateShip() {
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
    ship.horizontalInput = inputX;

    // Move ship based on input
    ship.x += inputX * ship.speed;
    ship.y += inputY * ship.speed;

    // Keep ship within canvas bounds
    ship.x = Math.max(ship.size / 2, Math.min(canvas.width - ship.size / 2, ship.x));
    ship.y = Math.max(ship.size / 2, Math.min(canvas.height - ship.size / 2, ship.y));
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
            lastBurstTime = 0;
            rapidFireTimer = 0;
            rapidFireDelay = 20;
            shootBurst(); // Fire first burst immediately
        } else {
            rapidFireTimer++;

            // Rapid fire while holding (fire when timer reaches delay)
            if (rapidFireTimer >= rapidFireDelay) {
                shootBullet(); // Fire bullet with spread
                rapidFireTimer = 0;

                // Calculate new random delay for next shot
                const baseDelay = Math.floor(Math.random() * 60) + 30; // 10-30
                rapidFireDelay = Math.max(1, Math.floor(baseDelay / maxBullets));
            }
        }
    } else {
        // Reset timers
        lastBurstTime = 0;
        rapidFireTimer = 0;
        rapidFireDelay = 0;
    }

    lastAttackButtonState = attackButton;
}

function shootBullet() {
    // Calculate current bullet count (rainbow bullets count as 3)
    let currentBulletCount = 0;
    for (let bullet of bullets) {
        currentBulletCount += bullet.isRainbow ? 3 : 1;
    }

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
    bullets.push({
        x: ship.x,
        y: ship.y - ship.size / 2,
        width: bulletSize,
        height: bulletSize * 2,
        color: '#ffff00',
        vx: Math.cos(angle) * bulletSpeed,
        vy: Math.sin(angle) * bulletSpeed,
        isRainbow: isRainbow,
        rainbowHue: Math.random() * 360
    });
}

function shootBurst() {
    const burstCountScale = 0.25;

    // Calculate burst count based on player power level
    const burstCount = Math.max(1, Math.floor(Math.min(10, maxBullets * burstCountScale)) + 1);

    // Calculate current bullet count (rainbow bullets count as 3)
    let currentBulletCount = 0;
    for (let bullet of bullets) {
        currentBulletCount += bullet.isRainbow ? 3 : 1;
    }

    // Only shoot if we have room for all burst bullets
    if (currentBulletCount + burstCount > maxBullets) return;

    const angleSpread = 10 * Math.PI / 180; // 10 degrees in radians
    const speed = bulletSpeed;
    const rainbowChance = Math.min((maxBullets-3)/2, 100);

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

        bullets.push({
            x: ship.x,
            y: ship.y - ship.size / 2,
            width: bulletSize,
            height: bulletSize * 2,
            color: '#ffff00',
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            isRainbow: isRainbow,
            rainbowHue: Math.random() * 360
        });
    }
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];

        // Update position based on velocity (for burst shots) or default upward movement
        if (bullet.vx !== undefined && bullet.vy !== undefined) {
            bullet.x += bullet.vx;
            bullet.y += bullet.vy;
        } else {
            bullet.y -= bulletSpeed;
        }

        // Remove bullets that go off screen
        if (bullet.y < -bullet.height || bullet.x < -50 || bullet.x > canvas.width + 50) {
            bullets.splice(i, 1);
        }
    }
}

function checkBulletAsteroidCollisions() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];

        for (let j = asteroids.length - 1; j >= 0; j--) {
            const asteroid = asteroids[j];

            // Simple circle collision detection
            const dx = bullet.x - asteroid.x;
            const dy = bullet.y - asteroid.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < asteroid.size / 2) {
                // Collision detected
                bullets.splice(i, 1);

                // Rainbow bullets do 3 damage, normal bullets do 1
                const damage = bullet.isRainbow ? 3 : 1;
                asteroid.health -= damage;
                asteroid.hitFlash = 5; // Flash for 5 frames

                if (asteroid.health <= 0) {
                    // Asteroid destroyed - spawn explosion, score popup, shoot bullet and remove
                    spawnExplosion(asteroid.x, asteroid.y, asteroid.size);
                    if (!godMode) {
                        spawnScorePopup(asteroid.x, asteroid.y, 1);
                        score += 1; // Award 1 point for asteroid
                    }
                    shootAsteroidBullet(asteroid);
                    asteroids.splice(j, 1);
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

    for (let i = 0; i < bulletCount; i++) {
        // Always fire in random direction
        const angle = Math.random() * Math.PI * 2;
        const vx = Math.cos(angle) * enemyBulletSpeed;
        const vy = Math.sin(angle) * enemyBulletSpeed;

        enemyBullets.push({
            x: asteroid.x,
            y: asteroid.y,
            vx: vx,
            vy: vy,
            size: 6,
            color: '#ff69b4', // Pink color
            aimed: false // Never aimed
        });
    }
}

function checkBulletEnemyCollisions() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];

        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];

            // Rectangle collision detection
            const bulletLeft = bullet.x - bullet.width / 2;
            const bulletRight = bullet.x + bullet.width / 2;
            const bulletTop = bullet.y;
            const bulletBottom = bullet.y + bullet.height;

            const enemyLeft = enemy.x - enemy.size / 2;
            const enemyRight = enemy.x + enemy.size / 2;
            const enemyTop = enemy.y - enemy.size / 2;
            const enemyBottom = enemy.y + enemy.size / 2;

            if (bulletRight > enemyLeft && bulletLeft < enemyRight &&
                bulletBottom > enemyTop && bulletTop < enemyBottom) {
                // Collision detected
                bullets.splice(i, 1);

                // Rainbow bullets do 3 damage, normal bullets do 1
                const damage = bullet.isRainbow ? 3 : 1;
                enemy.health -= damage;
                enemy.hitFlash = 5; // Flash for 5 frames
                enemy.stunTimer = 15; // Pause for 250ms (15 frames at 60fps)

                if (enemy.health <= 0) {
                    // Enemy destroyed - spawn explosion and score popup
                    spawnExplosion(enemy.x, enemy.y, enemy.size);
                    if (!godMode) {
                        spawnScorePopup(enemy.x, enemy.y, 2);
                        score += 2; // Award 2 points for enemy
                    }

                    // Shoot aimed bullets on death
                    const bulletCount = Math.floor(maxBullets * 0.1);
                    for (let k = 0; k < bulletCount; k++) {
                        // Aim at player with slight random variation
                        const dx = ship.x - enemy.x;
                        const dy = ship.y - enemy.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        // Add random spread of ±5 degrees
                        const baseAngle = Math.atan2(dy, dx);
                        const spread = (Math.random() - 0.5) * (10 * Math.PI / 180); // ±5 degrees
                        const angle = baseAngle + spread;

                        // Randomize speed by ±20%
                        const speedMultiplier = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
                        const speed = enemyBulletSpeed * 1.5 * speedMultiplier;
                        const vx = Math.cos(angle) * speed;
                        const vy = Math.sin(angle) * speed;

                        enemyBullets.push({
                            x: enemy.x,
                            y: enemy.y,
                            vx: vx,
                            vy: vy,
                            size: 6,
                            color: '#ff69b4',
                            aimed: true
                        });
                    }

                    enemies.splice(j, 1);
                    blueEnemiesDestroyed++;

                    // Spawn large enemy every 5 blue enemies destroyed
                    if (blueEnemiesDestroyed >= 5) {
                        largeEnemySpawnCount++;

                        // Every 4th spawn, spawn two UFOs
                        if (largeEnemySpawnCount % 4 === 0) {
                            spawnLargeEnemy();
                            spawnLargeEnemy(true); // Second UFO, higher position
                        } else {
                            spawnLargeEnemy();
                        }

                        blueEnemiesDestroyed = 0;
                    }
                }
                break; // Move to next bullet
            }
        }
    }
}

function checkBulletLargeEnemyCollisions() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];

        for (let j = largeEnemies.length - 1; j >= 0; j--) {
            const enemy = largeEnemies[j];

            // Rectangle collision detection
            const bulletLeft = bullet.x - bullet.width / 2;
            const bulletRight = bullet.x + bullet.width / 2;
            const bulletTop = bullet.y;
            const bulletBottom = bullet.y + bullet.height;

            const enemyLeft = enemy.x - enemy.width / 2;
            const enemyRight = enemy.x + enemy.width / 2;
            const enemyTop = enemy.y - enemy.height / 2;
            const enemyBottom = enemy.y + enemy.height / 2;

            if (bulletRight > enemyLeft && bulletLeft < enemyRight &&
                bulletBottom > enemyTop && bulletTop < enemyBottom) {
                // Collision detected
                bullets.splice(i, 1);

                // Rainbow bullets do 3 damage, normal bullets do 1
                const damage = bullet.isRainbow ? 3 : 1;
                enemy.health -= damage;
                enemy.hitFlash = 5; // Flash for 5 frames

                if (enemy.health <= 0) {
                    // Large enemy destroyed - spawn explosion, score popup, and powerup text
                    spawnExplosion(enemy.x, enemy.y, Math.max(enemy.width, enemy.height));
                    if (!godMode) {
                        spawnScorePopup(enemy.x, enemy.y, 10);
                        score += 10; // Award 10 points for large enemy
                    }
                    spawnPowerupText(enemy.x, enemy.y + 20);

                    // Shoot final burst on death
                    shootLargeEnemyBullets(enemy);

                    largeEnemies.splice(j, 1);
                    maxBullets += 3; // Increase bullet limit by 3

                    // Track UFO kills and spawn centipedes every 6 kills
                    ufoKills++;
                    if (ufoKills % 6 === 0) {
                        const centipedesToSpawn = Math.floor(ufoKills / 6);
                        for (let k = 0; k < centipedesToSpawn; k++) {
                            spawnCentipede();
                        }
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

                // Circle collision detection
                const dx = bullet.x - segment.x;
                const dy = bullet.y - segment.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < segment.size / 2 + bullet.width / 2) {
                    // Collision detected
                    bullets.splice(i, 1);
                    bulletHit = true;

                    // Rainbow bullets do 3 damage, normal bullets do 1
                    const damage = bullet.isRainbow ? 3 : 1;
                    segment.health -= damage;
                    segment.hitFlash = 5; // Flash for 5 frames

                    if (segment.health <= 0) {
                        // Segment destroyed - spawn explosion and score
                        spawnExplosion(segment.x, segment.y, segment.size);
                        if (!godMode) {
                            spawnScorePopup(segment.x, segment.y, 3);
                            score += 3; // Award 3 points per segment
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
    spawnExplosion(ship.x, ship.y, ship.size * 1.5);

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
    largeEnemySpawnCount = 0;
    ufoKills = 0;
    rapidFireTimer = 0;
    rapidFireDelay = 0;

    // Reset power level to starting value
    maxBullets = 3;

    // Clear all game objects
    bullets.length = 0;
    asteroids.length = 0;
    enemies.length = 0;
    largeEnemies.length = 0;
    centipedes.length = 0;
    enemyBullets.length = 0;
    explosions.length = 0;
    scorePopups.length = 0;
    powerupTexts.length = 0;

    // Reset ship position
    ship.x = canvas.width / 2;
    ship.y = canvas.height - 250;
}

function checkEnemyBulletPlayerCollisions() {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];

        // Circle collision detection with player hitbox
        const hitboxY = ship.y + ship.hitboxOffsetY;
        const dx = bullet.x - ship.x;
        const dy = bullet.y - hitboxY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < ship.hitboxRadius + bullet.size / 2) {
            // Player hit - return to title screen
            handlePlayerDeath();
            return;
        }
    }
}

function checkEnemyPlayerCollisions() {
    // Check blue enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];

        // Circle collision detection with player hitbox
        const hitboxY = ship.y + ship.hitboxOffsetY;
        const dx = enemy.x - ship.x;
        const dy = enemy.y - hitboxY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < ship.hitboxRadius + enemy.size / 2) {
            // Player hit - return to title screen
            handlePlayerDeath();
            return;
        }
    }
}

function checkLargeEnemyPlayerCollisions() {
    for (let i = largeEnemies.length - 1; i >= 0; i--) {
        const enemy = largeEnemies[i];

        // Rectangle-circle collision detection
        const hitboxY = ship.y + ship.hitboxOffsetY;
        const closestX = Math.max(enemy.x - enemy.width / 2, Math.min(ship.x, enemy.x + enemy.width / 2));
        const closestY = Math.max(enemy.y - enemy.height / 2, Math.min(hitboxY, enemy.y + enemy.height / 2));

        const dx = ship.x - closestX;
        const dy = hitboxY - closestY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < ship.hitboxRadius) {
            // Player hit - return to title screen
            handlePlayerDeath();
            return;
        }
    }
}

function checkAsteroidPlayerCollisions() {
    for (let i = asteroids.length - 1; i >= 0; i--) {
        const asteroid = asteroids[i];

        // Circle collision detection with player hitbox
        const hitboxY = ship.y + ship.hitboxOffsetY;
        const dx = asteroid.x - ship.x;
        const dy = asteroid.y - hitboxY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < ship.hitboxRadius + asteroid.size / 2) {
            // Player hit - return to title screen
            handlePlayerDeath();
            return;
        }
    }
}

function drawBullets() {
    for (let bullet of bullets) {
        if (bullet.isRainbow) {
            // Cycle through rainbow colors
            bullet.rainbowHue = (bullet.rainbowHue + 5) % 360;
            ctx.fillStyle = `hsl(${bullet.rainbowHue}, 100%, 50%)`;
        } else {
            ctx.fillStyle = bullet.color;
        }
        ctx.fillRect(bullet.x - bullet.width / 2, bullet.y, bullet.width, bullet.height);
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

    asteroids.push({
        x: Math.random() * canvas.width,
        y: -size,
        size: size,
        speed: speed,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.03, // 3x faster rotation
        health: health,
        maxHealth: health,
        hitFlash: 0,
        vertices: vertices
    });
}

function updateAsteroids() {
    // Randomly spawn new asteroids
    if (Math.random() < asteroidSpawnRate) {
        spawnAsteroid();
    }

    // Update existing asteroids
    for (let i = asteroids.length - 1; i >= 0; i--) {
        const asteroid = asteroids[i];

        // Update hit flash timer
        if (asteroid.hitFlash > 0) {
            asteroid.hitFlash--;
        }

        asteroid.y += asteroid.speed;
        asteroid.rotation += asteroid.rotationSpeed;

        // Remove asteroids that go off screen
        if (asteroid.y > canvas.height + asteroid.size) {
            asteroids.splice(i, 1);
        }
    }
}

function drawAsteroids() {
    for (let asteroid of asteroids) {
        ctx.save();
        ctx.translate(asteroid.x, asteroid.y);
        ctx.rotate(asteroid.rotation);

        // Calculate color based on current health (grey to red)
        const colorHealth = Math.min(asteroid.health, 10);
        const ratio = (colorHealth - 1) / 9; // 0 at 1 HP, 1 at 10 HP
        const r = Math.floor(136 + 119 * ratio); // 136 to 255
        const g = Math.floor(136 * (1 - ratio)); // 136 to 0
        const b = Math.floor(136 * (1 - ratio)); // 136 to 0
        const color = `rgb(${r}, ${g}, ${b})`;

        // Draw asteroid as irregular polygon using stored vertices
        // Flash white when hit
        ctx.fillStyle = asteroid.hitFlash > 0 ? '#ffffff' : color;
        ctx.beginPath();
        for (let i = 0; i < asteroid.vertices.length; i++) {
            const vertex = asteroid.vertices[i];
            if (i === 0) {
                ctx.moveTo(vertex.x, vertex.y);
            } else {
                ctx.lineTo(vertex.x, vertex.y);
            }
        }
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

function spawnEnemy() {
    // Random start position from top
    const startX = Math.random() * canvas.width;
    const startY = -enemySize;

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

    // Exit towards the same side they entered from
    const exitX = isLeftSide ? -enemySize : canvas.width + enemySize;
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

    enemies.push({
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        size: enemySize,
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
        shootingTimer: 0
    });
}

function updateEnemies() {
    // Calculate spawn rate multiplier based on asteroids destroyed
    // Every 10 asteroids increases spawn rate by 5%
    const spawnRateMultiplier = 1 + (Math.floor(asteroidsDestroyed / 10) * 0.05);
    const adjustedSpawnRate = enemySpawnRate * spawnRateMultiplier;

    // Randomly spawn new enemies
    if (Math.random() < adjustedSpawnRate) {
        spawnEnemy();
    }

    const acceleration = 0.15;
    const damping = 0.95;
    // Increase speed by 10% for every 5 power levels
    const baseMaxSpeed = 6; // 50% faster than original 4
    const maxSpeed = baseMaxSpeed * (1 + Math.floor(maxBullets / 5) * 0.1);
    const arrivalThreshold = 20;

    // Update existing enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];

        // Update hit flash timer
        if (enemy.hitFlash > 0) {
            enemy.hitFlash--;
        }

        // Update stun timer
        if (enemy.stunTimer > 0) {
            enemy.stunTimer--;
            continue; // Skip movement while stunned
        }

        if (enemy.state === 'entering') {
            // Calculate acceleration toward target
            const dx = enemy.targetX - enemy.x;
            const dy = enemy.targetY - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < arrivalThreshold) {
                // Reached target - gradually slow down
                enemy.vx *= 0.9;
                enemy.vy *= 0.9;

                if (Math.abs(enemy.vx) < 0.1 && Math.abs(enemy.vy) < 0.1) {
                    enemy.vx = 0;
                    enemy.vy = 0;
                    enemy.x = enemy.targetX;
                    enemy.y = enemy.targetY;
                    enemy.state = 'pausing';
                    enemy.pauseTimer = enemyPauseDuration;
                }
            } else {
                // Apply acceleration toward target
                const ax = (dx / distance) * acceleration;
                const ay = (dy / distance) * acceleration;

                enemy.vx += ax;
                enemy.vy += ay;
            }

            // Apply damping and limit max speed
            enemy.vx *= damping;
            enemy.vy *= damping;
            const speed = Math.sqrt(enemy.vx * enemy.vx + enemy.vy * enemy.vy);
            if (speed > maxSpeed) {
                enemy.vx = (enemy.vx / speed) * maxSpeed;
                enemy.vy = (enemy.vy / speed) * maxSpeed;
            }

            // Update position
            enemy.x += enemy.vx;
            enemy.y += enemy.vy;

        } else if (enemy.state === 'pausing') {
            // Wait at position
            enemy.pauseTimer--;

            // Calculate dynamic shoot timing based on player power
            // Higher power = shoots sooner (divide pause by power level)
            const basePauseBeforeShoot = 100; // Base pause time in frames
            const adjustedPauseBeforeShoot = Math.max(10, Math.floor(basePauseBeforeShoot / maxBullets));
            const dynamicShootTiming = enemyPauseDuration - adjustedPauseBeforeShoot;

            // Start shooting before leaving
            if (enemy.pauseTimer === dynamicShootTiming && !enemy.hasShot) {
                enemy.state = 'shooting';
                enemy.hasShot = true;
                // Calculate bullets based on player power: 1 bullet per 10 power levels
                enemy.shootingBulletsRemaining = Math.floor(maxBullets / 10) + 1;
                enemy.shootingTimer = 0;
            }

            if (enemy.pauseTimer <= 0) {
                enemy.state = 'exiting';
            }
        } else if (enemy.state === 'shooting') {
            // Fire bullets one at a time with delay
            enemy.shootingTimer++;

            if (enemy.shootingTimer >= 18) { // 300ms at 60fps = 18 frames
                shootEnemyBullet(enemy);
                enemy.shootingBulletsRemaining--;
                enemy.shootingTimer = 0;

                if (enemy.shootingBulletsRemaining <= 0) {
                    enemy.state = 'pausing'; // Return to pausing state
                }
            }
        } else if (enemy.state === 'exiting') {
            // Calculate acceleration toward exit
            const dx = enemy.exitX - enemy.x;
            const dy = enemy.exitY - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0) {
                // Apply acceleration toward exit
                const ax = (dx / distance) * acceleration;
                const ay = (dy / distance) * acceleration;

                enemy.vx += ax;
                enemy.vy += ay;

                // Apply damping and limit max speed
                enemy.vx *= damping;
                enemy.vy *= damping;
                const speed = Math.sqrt(enemy.vx * enemy.vx + enemy.vy * enemy.vy);
                if (speed > maxSpeed) {
                    enemy.vx = (enemy.vx / speed) * maxSpeed;
                    enemy.vy = (enemy.vy / speed) * maxSpeed;
                }

                // Update position
                enemy.x += enemy.vx;
                enemy.y += enemy.vy;
            }

            // Remove if off screen
            if (enemy.x < -enemySize || enemy.x > canvas.width + enemySize ||
                enemy.y < -enemySize || enemy.y > canvas.height + enemySize) {
                enemies.splice(i, 1);
            }
        }
    }
}

function drawEnemies() {
    for (let enemy of enemies) {
        // Flash white when hit
        const color = enemy.hitFlash > 0 ? '#ffffff' : enemy.baseColor;

        // Calculate horizontal scale based on velocity (banking effect)
        // Normalize vx by max expected speed (~15), scale from 1.0 to 0.55 (45% reduction)
        const normalizedVx = Math.abs(enemy.vx) / 15;
        const horizontalScale = 1.0 - Math.min(normalizedVx * 2, 1.0);

        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.scale(horizontalScale, 1.0);

        // Draw space bug
        ctx.fillStyle = color;

        // Main body (ellipse)
        ctx.beginPath();
        ctx.ellipse(0, 0, enemy.size / 3, enemy.size / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head (smaller circle at top)
        ctx.beginPath();
        ctx.arc(0, -enemy.size / 3, enemy.size / 4, 0, Math.PI * 2);
        ctx.fill();

        // Antennae
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-enemy.size / 8, -enemy.size / 2);
        ctx.lineTo(-enemy.size / 4, -enemy.size * 0.7);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(enemy.size / 8, -enemy.size / 2);
        ctx.lineTo(enemy.size / 4, -enemy.size * 0.7);
        ctx.stroke();

        // Wings (left and right)
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = color;

        // Left wing
        ctx.beginPath();
        ctx.ellipse(-enemy.size / 3, 0, enemy.size / 4, enemy.size / 2.5, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Right wing
        ctx.beginPath();
        ctx.ellipse(enemy.size / 3, 0, enemy.size / 4, enemy.size / 2.5, 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1.0;

        ctx.restore();
    }
}

function spawnLargeEnemy(isSecondUFO = false) {
    // Random X position, keeping enemy fully on screen
    const randomX = Math.random() * (canvas.width - largeEnemyWidth) + largeEnemyWidth / 2;

    // Calculate health: base 10 HP + 1 per 5 power levels
    const health = 10 + Math.floor(maxBullets / 5);

    // If this is the second UFO, place it higher to avoid overlap
    const startY = isSecondUFO ? -largeEnemyHeight - 150 : -largeEnemyHeight;

    largeEnemies.push({
        x: randomX,
        y: startY,
        width: largeEnemyWidth,
        height: largeEnemyHeight,
        speed: largeEnemySpeed,
        color: '#cccccc',
        health: health,
        hitFlash: 0,
        shootTimer: 60, // Shoot every 60 frames (1 second at 60fps)
        bulletRotation: 0, // Current rotation angle
        rotationDirection: Math.random() < 0.5 ? 1 : -1 // Randomly rotate clockwise or counter-clockwise
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
    const bodyHealth = Math.floor((5 + Math.floor(maxBullets * 0.1)) / 2);
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
    const dx = endX - startX;
    const dy = endY - startY;
    const totalDistance = Math.sqrt(dx * dx + dy * dy);
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

function updateCentipedes() {
    for (let i = centipedes.length - 1; i >= 0; i--) {
        const centipede = centipedes[i];

        // Move the head along the path
        centipede.distance += centipede.speed;
        centipede.wiggleTime += 0.05; // Increment for sine wave animation

        // Calculate head position (allow it to continue beyond endpoint)
        const progress = centipede.distance / centipede.totalDistance;
        const baseHeadX = centipede.startX + (centipede.endX - centipede.startX) * progress;
        const baseHeadY = centipede.startY + (centipede.endY - centipede.startY) * progress;

        // Calculate perpendicular direction for sine wave (rotate 90 degrees)
        const pathDx = centipede.endX - centipede.startX;
        const pathDy = centipede.endY - centipede.startY;
        const pathLength = Math.sqrt(pathDx * pathDx + pathDy * pathDy);
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
            if (segment.hitFlash > 0) {
                segment.hitFlash--;
            }
            if (segment.shootFlash > 0) {
                segment.shootFlash--;
            }

            // Visible segments have 1% chance to fire aimed bullet each frame
            if (segment.health > 0 &&
                segment.x >= 0 && segment.x <= canvas.width &&
                segment.y >= 0 && segment.y <= canvas.height &&
                Math.random() < 0.01) {

                // Fire aimed bullet at player
                const dx = ship.x - segment.x;
                const dy = ship.y - segment.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const vx = (dx / distance) * enemyBulletSpeed * 1.5;
                const vy = (dy / distance) * enemyBulletSpeed * 1.5;

                enemyBullets.push({
                    x: segment.x,
                    y: segment.y,
                    vx: vx,
                    vy: vy,
                    size: 6,
                    color: '#ff69b4',
                    aimed: true
                });

                // Flash red when shooting
                segment.shootFlash = 5;
            }

            // Visible segments have 2% chance to fire random bullet each frame
            if (segment.health > 0 &&
                segment.x >= 0 && segment.x <= canvas.width &&
                segment.y >= 0 && segment.y <= canvas.height &&
                Math.random() < 0.02) {

                // Fire random direction bullet
                const angle = Math.random() * Math.PI * 2;
                const vx = Math.cos(angle) * enemyBulletSpeed;
                const vy = Math.sin(angle) * enemyBulletSpeed;

                enemyBullets.push({
                    x: segment.x,
                    y: segment.y,
                    vx: vx,
                    vy: vy,
                    size: 6,
                    color: '#ff69b4',
                    aimed: false
                });

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
            centipedes.splice(i, 1);
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

            const dx = endX - startX;
            const dy = endY - startY;
            centipede.totalDistance = Math.sqrt(dx * dx + dy * dy);
            centipede.distance = 0;

            // Reset all segment positions to new start
            for (let seg of centipede.segments) {
                seg.x = startX;
                seg.y = startY;
            }
        }
    }
}

function drawCentipedes() {
    for (let centipede of centipedes) {
        for (let i = 0; i < centipede.segments.length; i++) {
            const segment = centipede.segments[i];
            if (segment.health <= 0) continue; // Don't draw destroyed segments

            // Flash white when hit, red when shooting, otherwise normal color
            let color = centipede.color;
            if (segment.shootFlash > 0) color = '#ff0000';
            if (segment.hitFlash > 0) color = '#ffffff';

            // Calculate direction angle
            let angle;
            if (i === 0) {
                // Head: use path direction
                const dx = centipede.endX - centipede.startX;
                const dy = centipede.endY - centipede.startY;
                angle = Math.atan2(dy, dx);
            } else {
                // Body: face towards previous segment
                const prevSeg = centipede.segments[i - 1];
                const dx = prevSeg.x - segment.x;
                const dy = prevSeg.y - segment.y;
                angle = Math.atan2(dy, dx);
            }

            // Save context and apply rotation
            ctx.save();
            ctx.translate(segment.x, segment.y);
            ctx.rotate(angle);

            // Draw main body (centered at origin)
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, segment.size / 2, 0, Math.PI * 2);
            ctx.fill();

            // Draw outline
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.stroke();

            const radius = segment.size / 2;

            if (i === 0) {
                // Head segment - draw eyes and pinchers
                // Eyes (positioned towards front/right side)
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(radius * 0.3, -radius * 0.3, radius * 0.25, 0, Math.PI * 2);
                ctx.arc(radius * 0.3, radius * 0.3, radius * 0.25, 0, Math.PI * 2);
                ctx.fill();

                // Pupils
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(radius * 0.3, -radius * 0.3, radius * 0.12, 0, Math.PI * 2);
                ctx.arc(radius * 0.3, radius * 0.3, radius * 0.12, 0, Math.PI * 2);
                ctx.fill();

                // Pinchers (pointing forward)
                ctx.strokeStyle = color === '#ffffff' ? '#ffffff' : centipede.color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                // Top pincher
                ctx.moveTo(radius * 0.6, -radius * 0.4);
                ctx.lineTo(radius * 1.2, -radius * 0.6);
                // Bottom pincher
                ctx.moveTo(radius * 0.6, radius * 0.4);
                ctx.lineTo(radius * 1.2, radius * 0.6);
                ctx.stroke();
            } else {
                // Body segments - draw legs perpendicular to body
                ctx.strokeStyle = color === '#ffffff' ? '#ffffff' : centipede.color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                // Top leg
                ctx.moveTo(0, -radius);
                ctx.lineTo(0, -radius * 1.5);
                // Bottom leg
                ctx.moveTo(0, radius);
                ctx.lineTo(0, radius * 1.5);
                ctx.stroke();
            }

            // Restore context
            ctx.restore();
        }
    }
}

function updateLargeEnemies() {
    for (let i = largeEnemies.length - 1; i >= 0; i--) {
        const enemy = largeEnemies[i];

        // Update hit flash timer
        if (enemy.hitFlash > 0) {
            enemy.hitFlash--;
        }

        // Update shoot timer and shoot
        enemy.shootTimer--;
        if (enemy.shootTimer <= 0) {
            shootLargeEnemyBullets(enemy);
            enemy.shootTimer = 60; // Reset timer
        }

        enemy.y += enemy.speed;

        // Remove if off screen
        if (enemy.y > canvas.height + enemy.height) {
            largeEnemies.splice(i, 1);
        }
    }
}

function drawLargeEnemies() {
    for (let enemy of largeEnemies) {
        // Flash white when hit
        const color = enemy.hitFlash > 0 ? '#ffffff' : enemy.color;

        ctx.save();
        ctx.translate(enemy.x, enemy.y);

        // Draw flying saucer UFO
        ctx.fillStyle = color;

        // Main disc (ellipse)
        ctx.beginPath();
        ctx.ellipse(0, 0, enemy.width / 2, enemy.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Darker bottom edge of disc
        ctx.fillStyle = enemy.hitFlash > 0 ? '#cccccc' : '#888888';
        ctx.beginPath();
        ctx.ellipse(0, enemy.height / 4, enemy.width / 2, enemy.height / 4, 0, 0, Math.PI);
        ctx.fill();

        // Dome on top (lighter color)
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, -enemy.height / 4, enemy.width / 4, enemy.height / 3, 0, Math.PI, 0, true);
        ctx.fill();

        // Cockpit window (darker)
        ctx.fillStyle = enemy.hitFlash > 0 ? '#666666' : '#333333';
        ctx.beginPath();
        ctx.ellipse(0, -enemy.height / 3, enemy.width / 6, enemy.height / 5, 0, Math.PI, 0, true);
        ctx.fill();

        ctx.restore();
    }
}

function shootEnemyBullet(enemy) {
    // Calculate direction toward player
    const dx = ship.x - enemy.x;
    const dy = ship.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Normalize and multiply by speed (1.5x for aimed bullets)
    const vx = (dx / distance) * enemyBulletSpeed * 1.5;
    const vy = (dy / distance) * enemyBulletSpeed * 1.5;

    enemyBullets.push({
        x: enemy.x,
        y: enemy.y,
        vx: vx,
        vy: vy,
        size: 6,
        color: '#ff69b4', // Pink color
        aimed: true // Aimed at player
    });
}

function shootLargeEnemyBullets(enemy) {
    // Shoot bullets in a circle with rotation
    // Base 8 bullets + 1 bullet per 5 player power levels
    const bulletCount = 8 + Math.floor(maxBullets / 5);

    for (let i = 0; i < bulletCount; i++) {
        const angle = (i / bulletCount) * Math.PI * 2 + enemy.bulletRotation;
        const vx = Math.cos(angle) * enemyBulletSpeed;
        const vy = Math.sin(angle) * enemyBulletSpeed;

        enemyBullets.push({
            x: enemy.x,
            y: enemy.y,
            vx: vx,
            vy: vy,
            size: 6,
            color: '#ff69b4', // Pink color
            aimed: false // Not aimed at player
        });
    }

    // Rotate by 10 degrees for next burst (10 degrees = ~0.1745 radians)
    enemy.bulletRotation += (10 * Math.PI / 180) * enemy.rotationDirection;
}

function updateEnemyBullets() {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];

        bullet.x += bullet.vx;
        bullet.y += bullet.vy;

        // Remove bullets that go off screen
        if (bullet.x < -10 || bullet.x > canvas.width + 10 ||
            bullet.y < -10 || bullet.y > canvas.height + 10) {
            enemyBullets.splice(i, 1);
        }
    }
}

function drawEnemyBullets() {
    for (let bullet of enemyBullets) {
        if (bullet.aimed) {
            // Draw aimed bullets as thin cyan laser bolts (50% larger visually)
            ctx.fillStyle = '#00ffff'; // Cyan
            const angle = Math.atan2(bullet.vy, bullet.vx);
            const length = 12 * 1.5; // 50% larger
            const width = 2 * 1.5; // 50% larger

            ctx.save();
            ctx.translate(bullet.x, bullet.y);
            ctx.rotate(angle);
            ctx.fillRect(-length / 2, -width / 2, length, width);
            ctx.restore();
        } else {
            // Draw non-aimed bullets as pink diamonds (squares rotated 45 degrees, 50% larger visually)
            ctx.fillStyle = bullet.color;
            const size = bullet.size * 1.5; // 50% larger visually

            ctx.save();
            ctx.translate(bullet.x, bullet.y);
            ctx.rotate(Math.PI / 4); // Rotate 45 degrees to make diamond shape
            ctx.fillRect(-size / 2, -size / 2, size, size);
            ctx.restore();
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
        explosion.timer++;

        // Remove explosion when animation is complete
        if (explosion.timer >= explosion.lifetime) {
            explosions.splice(i, 1);
        }
    }
}

function drawExplosions() {
    for (let explosion of explosions) {
        // Calculate scale: grows for first half, shrinks for second half
        const halfLife = explosion.lifetime / 2;
        let scale;
        if (explosion.timer <= halfLife) {
            // Growing phase
            scale = explosion.timer / halfLife;
        } else {
            // Shrinking phase
            scale = 1 - ((explosion.timer - halfLife) / halfLife);
        }

        const size = explosion.maxSize * scale;

        // Draw yellow circle (outer) with random offset
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(
            explosion.x + explosion.yellowOffsetX,
            explosion.y + explosion.yellowOffsetY,
            size,
            0,
            Math.PI * 2
        );
        ctx.fill();

        // Draw white circle (inner, 60% of outer size) with random offset
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(
            explosion.x + explosion.whiteOffsetX,
            explosion.y + explosion.whiteOffsetY,
            size * 0.6,
            0,
            Math.PI * 2
        );
        ctx.fill();
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

function updateScorePopups() {
    for (let i = scorePopups.length - 1; i >= 0; i--) {
        const popup = scorePopups[i];
        popup.timer++;

        // Move upward
        popup.y -= 1;

        // Remove when lifetime expires
        if (popup.timer >= popup.lifetime) {
            scorePopups.splice(i, 1);
        }
    }
}

function drawScorePopups() {
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px Arial';

    for (let popup of scorePopups) {
        // Calculate alpha (fade out in last 20 frames)
        let alpha = 1.0;
        const fadeStart = popup.lifetime - 20;
        if (popup.timer > fadeStart) {
            alpha = 1.0 - ((popup.timer - fadeStart) / 20);
        }

        // Draw with yellow color and fading alpha
        ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
        ctx.fillText(`+${popup.points}`, popup.x, popup.y);
    }

    ctx.textAlign = 'left';
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
        text.timer++;

        // Don't move - stay at same Y position

        // Remove when lifetime expires
        if (text.timer >= text.lifetime) {
            powerupTexts.splice(i, 1);
        }
    }
}

function drawPowerupTexts() {
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px Arial';

    const powerupText = 'LEVEL UP!';

    for (let text of powerupTexts) {
        // Calculate alpha (fade out over entire lifetime)
        let alpha = 1.0 - (text.timer / text.lifetime);

        // Calculate letter spacing (expand from 10 to 40 pixels over lifetime)
        const letterSpacing = 10 + (text.timer / text.lifetime) * 30;

        // Draw each letter individually with spacing
        ctx.fillStyle = `rgba(255, 105, 180, ${alpha})`; // Hot pink

        // Calculate total width to center the text
        const totalWidth = (powerupText.length - 1) * letterSpacing;
        let startX = text.x - totalWidth / 2;

        for (let i = 0; i < powerupText.length; i++) {
            ctx.fillText(powerupText[i], startX + i * letterSpacing, text.y);
        }
    }

    ctx.textAlign = 'left';
}

function renderTitleScreen() {
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw star field
    drawStars();

    // Draw title
    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 64px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('VIBE SHOOTER', canvas.width / 2, canvas.height / 2 - 50);

    // Draw instruction
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('Press Fire to Start', canvas.width / 2, canvas.height / 2 + 50);

    // Draw high score
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 32px Arial';
    ctx.fillText(`High Score: ${highScore}`, canvas.width / 2, canvas.height / 2 + 120);

    // Reset text align
    ctx.textAlign = 'left';
}

// Render the game
function render() {
    if (gameState === 'title') {
        renderTitleScreen();
        return;
    }

    // Render game scene for both 'playing' and 'dying' states
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw star field
    drawStars();

    // Draw asteroids
    drawAsteroids();

    // Draw large enemies
    drawLargeEnemies();

    // Draw enemies
    drawEnemies();

    // Draw centipedes
    drawCentipedes();

    // Draw enemy bullets
    drawEnemyBullets();

    // Draw bullets
    drawBullets();

    // Draw explosions
    drawExplosions();

    // Draw score popups
    drawScorePopups();

    // Draw powerup texts
    drawPowerupTexts();

    // Draw ship as spaceship (only if playing, hide during dying)
    if (gameState === 'playing') {
        // Calculate horizontal scale based on input (banking effect)
        // Scale from 1.0 (no input) to 0.7 (full input) = 30% reduction
        const horizontalScale = 1.0 - Math.abs(ship.horizontalInput) * 0.3;

        ctx.save();
        ctx.translate(ship.x, ship.y);
        ctx.scale(horizontalScale, 1.0);
        ctx.translate(-ship.x, -ship.y);

        ctx.fillStyle = ship.color;
        ctx.beginPath();

        // Nose
        ctx.moveTo(ship.x, ship.y - ship.size / 2);

        // Right side of cockpit
        ctx.lineTo(ship.x + ship.size / 6, ship.y - ship.size / 6);

        // Right wing
        ctx.lineTo(ship.x + ship.size / 2, ship.y);
        ctx.lineTo(ship.x + ship.size / 4, ship.y + ship.size / 4);

        // Right engine
        ctx.lineTo(ship.x + ship.size / 6, ship.y + ship.size / 4);
        ctx.lineTo(ship.x + ship.size / 6, ship.y + ship.size / 2);

        // Bottom center (between engines)
        ctx.lineTo(ship.x, ship.y + ship.size / 3);

        // Left engine
        ctx.lineTo(ship.x - ship.size / 6, ship.y + ship.size / 2);
        ctx.lineTo(ship.x - ship.size / 6, ship.y + ship.size / 4);

        // Left wing
        ctx.lineTo(ship.x - ship.size / 4, ship.y + ship.size / 4);
        ctx.lineTo(ship.x - ship.size / 2, ship.y);

        // Left side of cockpit
        ctx.lineTo(ship.x - ship.size / 6, ship.y - ship.size / 6);

        ctx.closePath();
        ctx.fill();

        ctx.restore();

        // Draw hitbox as white circle, offset downwards (not scaled)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ship.x, ship.y + ship.hitboxOffsetY, ship.hitboxRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw score
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`Score: ${score}`, 10, 30);

    // Draw god mode indicator
    if (godMode) {
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('GOD MODE', 10, 60);
    }
}

// Game loop
function gameLoop() {
    updateStars();
    handleShooting(); // Check for input in all states

    if (gameState === 'playing') {
        updateAsteroids();
        updateEnemies();
        updateLargeEnemies();
        updateCentipedes();
        updateEnemyBullets();
        updateExplosions();
        updateScorePopups();
        updatePowerupTexts();
        updateShip();
        updateBullets();
        checkBulletAsteroidCollisions();
        checkBulletEnemyCollisions();
        checkBulletLargeEnemyCollisions();
        checkBulletCentipedeCollisions();
        checkEnemyBulletPlayerCollisions();
        checkEnemyPlayerCollisions();
        checkLargeEnemyPlayerCollisions();
        checkAsteroidPlayerCollisions();

        // Update high score in memory (saved to localStorage only on death)
        if (score > highScore && !godMode) {
            highScore = score;
        }
    } else if (gameState === 'dying') {
        // Continue updating some visual elements during death
        updateExplosions();
        updateScorePopups();
        updatePowerupTexts();
        updateEnemyBullets();
        updateBullets();
        updateAsteroids();
        updateEnemies();
        updateLargeEnemies();
        updateCentipedes();

        // Count down death timer
        deathTimer--;
        if (deathTimer <= 0) {
            resetGame();
        }
    }

    render();
    requestAnimationFrame(gameLoop);
}

// Initialize game
function init() {
    console.log('Game initialized. Connect a gamepad to start playing.');
    initStars();
    gameLoop();
}

// Start the game when page loads
init();
