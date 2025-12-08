# Renderer Guide

**Note**: This game now uses a **dual canvas system** where both renderers draw simultaneously. See [DUAL_CANVAS_GUIDE.md](DUAL_CANVAS_GUIDE.md) for the current architecture.

This document describes the two rendering implementations available.

## Available Renderers

### Render2D (Default)
- **File**: `render2d.js`
- **Technology**: HTML5 Canvas 2D Context
- **Features**:
  - Fully featured with all visual effects
  - Text rendering (scores, UI, title screen)
  - Particle effects and animations
  - Best compatibility across all browsers

### Render3D (Experimental)
- **File**: `render.js`
- **Technology**: WebGL
- **Features**:
  - 3D rendering with orthographic projection
  - Uses basic cube primitives for all game objects
  - Hardware-accelerated graphics
  - Coordinates match canvas pixel dimensions
  - Z-buffer depth range: -100 to 100
  - **Note**: Text rendering not yet implemented

## Dual Canvas Architecture

Both renderers draw simultaneously to separate canvas elements:

```html
<canvas id="canvas2d" width="600" height="800"></canvas>
<canvas id="canvas3d" width="600" height="800"></canvas>
```

Each renderer:
- Gets its own dedicated canvas
- Initializes its own context type (2D or WebGL)
- Renders every frame independently
- Uses the same game state

See [DUAL_CANVAS_GUIDE.md](DUAL_CANVAS_GUIDE.md) for more details.

## Renderer Interface

Both renderers implement the same interface, making them interchangeable:

```javascript
{
    name: 'Renderer Name',  // String identifier for this renderer
    init(canvas),           // Initialize with canvas element, return true on success
    render(),              // Main render function
    drawStars(),           // Draw background stars
    drawBullets(),         // Draw player bullets
    drawAsteroids(),       // Draw asteroids
    drawEnemies(),         // Draw blue enemies
    drawCentipedes(),      // Draw centipede enemies
    drawSentinels(),       // Draw Sentinel enemies
    drawEnemyBullets(),    // Draw enemy projectiles
    drawExplosions(),      // Draw explosion effects
    drawScorePopups(),     // Draw floating score text
    drawPowerupTexts(),    // Draw powerup notifications
    renderTitleScreen()    // Render title screen
}
```

## Creating a New Renderer

To create a new renderer implementation:

1. **Create a new file** (e.g., `renderCustom.js`)
2. **Define an object** with the same interface as above
3. **Implement all required methods**
4. **Add the script to `index.html`** before `game.js`
5. **Update `init()` function** in game.js to detect and register your renderer:

```javascript
// In game.js init() function, add:
if (typeof RenderCustom !== 'undefined') {
    const initSuccess = RenderCustom.init(canvas);
    if (initSuccess !== false) {
        renderers.push(RenderCustom);
    }
}
```

That's it! Your renderer will now appear in the rotation when pressing R.

Example skeleton:

```javascript
const RenderCustom = {
    name: 'Custom Renderer',  // REQUIRED: Display name for this renderer
    ctx: null,

    init(canvas) {
        // Initialize your rendering context
        this.ctx = canvas.getContext('2d'); // or webgl, etc.
        return true; // REQUIRED: Return true on success, false on failure
    },

    render() {
        // Main render loop
        if (gameState === 'title') {
            this.renderTitleScreen();
            return;
        }

        // Clear and draw
        this.drawStars();
        this.drawAsteroids();
        // ... etc
    },

    // Implement all other draw methods...
};
```

## Performance Notes

- **2D Renderer**: Best for compatibility, good performance on all devices
- **3D Renderer**: May have better performance on devices with GPU acceleration, but higher overhead for simple 2D gameplay

## Known Limitations

### 3D Renderer
- No text rendering (scores, UI not visible)
- Basic cube primitives only (no detailed ship/enemy models)
- Missing some visual polish from 2D version

## Future Improvements

Potential enhancements for the 3D renderer:
- Texture-mapped text rendering
- 3D models for ships and enemies
- Particle systems for explosions
- Post-processing effects (bloom, glow)
- Camera shake and effects
