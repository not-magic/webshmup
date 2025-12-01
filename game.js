// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const infoDiv = document.getElementById('info');

// Game objects
const square = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: 40,
    speed: 5,
    color: '#00ff00'
};

// Gamepad state
let gamepad = null;

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
    const x = gamepad.axes[0] || 0;
    const y = gamepad.axes[1] || 0;

    // Apply deadzone to prevent drift
    const deadzone = 0.15;
    const processedX = Math.abs(x) > deadzone ? x : 0;
    const processedY = Math.abs(y) > deadzone ? y : 0;

    return { x: processedX, y: processedY };
}

// Update square position based on joystick input
function updateSquare() {
    const joystick = getJoystickInput();

    // Move square based on joystick position
    square.x += joystick.x * square.speed;
    square.y += joystick.y * square.speed;

    // Keep square within canvas bounds
    square.x = Math.max(square.size / 2, Math.min(canvas.width - square.size / 2, square.x));
    square.y = Math.max(square.size / 2, Math.min(canvas.height - square.size / 2, square.y));
}

// Render the game
function render() {
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw square
    ctx.fillStyle = square.color;
    ctx.fillRect(
        square.x - square.size / 2,
        square.y - square.size / 2,
        square.size,
        square.size
    );

    // Draw joystick debug info if gamepad is connected
    if (gamepad) {
        const joystick = getJoystickInput();
        ctx.fillStyle = '#fff';
        ctx.font = '14px Arial';
        ctx.fillText(`Joystick X: ${joystick.x.toFixed(2)}`, 10, 20);
        ctx.fillText(`Joystick Y: ${joystick.y.toFixed(2)}`, 10, 40);
        ctx.fillText(`Square X: ${Math.floor(square.x)}`, 10, 60);
        ctx.fillText(`Square Y: ${Math.floor(square.y)}`, 10, 80);
    }
}

// Game loop
function gameLoop() {
    updateSquare();
    render();
    requestAnimationFrame(gameLoop);
}

// Initialize game
function init() {
    console.log('Game initialized. Connect a gamepad to start playing.');
    gameLoop();
}

// Start the game when page loads
init();
