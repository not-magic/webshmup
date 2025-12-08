# Vibe Shooter Architecture

## Overview

Vibe Shooter is designed with a clean separation between game logic and rendering, with two rendering implementations displaying the same game state simultaneously on separate canvases.

## Core Components

### 1. Game Logic (`game.js`)
- Contains all game state, physics, collision detection, and update logic
- **Renderer-agnostic**: No direct rendering calls
- Manages game entities: player, enemies, bullets, etc.
- Handles input from keyboard and gamepad

### 2. Dual Canvas System
Each renderer has its own dedicated canvas element:

```javascript
// Canvas setup
const canvas2d = document.getElementById('canvas2d');
const canvas3d = document.getElementById('canvas3d');
const canvas = canvas2d;  // Reference for game logic

// At startup (init function)
if (typeof Render2D !== 'undefined') {
    Render2D.init(canvas2d);   // 2D renderer gets its canvas
}
if (typeof Render3D !== 'undefined') {
    Render3D.init(canvas3d);   // 3D renderer gets its canvas
}

// In game loop - both render simultaneously
if (typeof Render2D !== 'undefined' && Render2D.ctx) {
    Render2D.render();
}
if (typeof Render3D !== 'undefined' && Render3D.gl) {
    Render3D.render();
}
```

### 3. Renderer Implementations

All renderers must implement this interface:

```javascript
const RendererName = {
    name: 'Renderer Name',  // String identifier (REQUIRED)
    init(canvas),           // Initialize, return true on success, false on failure
    render(),              // Main render loop
    drawStars(),           // Individual draw functions...
    drawBullets(),
    drawAsteroids(),
    drawEnemies(),
    drawCentipedes(),
    drawSentinels(),
    drawEnemyBullets(),
    drawExplosions(),
    drawScorePopups(),
    drawPowerupTexts(),
    renderTitleScreen()
};
```

#### Current Implementations

**Render2D** (`render2d.js`)
- HTML5 Canvas 2D Context
- Full-featured with all visual effects
- Text rendering for UI and scores
- Best compatibility

**Render3D** (`render.js`)
- WebGL-based 3D rendering
- Uses shaders and 3D transformations
- Renders entities as cubes in 3D space
- Experimental (no text rendering yet)

## Game Loop Flow

```
┌─────────────────────────────────────┐
│  requestAnimationFrame(gameLoop)    │
└────────────┬────────────────────────┘
             │
             ▼
    ┌────────────────────┐
    │  Update Stars      │
    └────────┬───────────┘
             │
             ▼
    ┌────────────────────┐
    │  Handle Input      │
    └────────┬───────────┘
             │
             ▼
    ┌────────────────────┐
    │  Update Entities   │
    │  - Ship            │
    │  - Bullets         │
    │  - Enemies         │
    │  - Asteroids       │
    └────────┬───────────┘
             │
             ▼
    ┌────────────────────┐
    │  Check Collisions  │
    └────────┬───────────┘
             │
             ▼
    ┌────────────────────┐
    │  Spawn Enemies     │
    └────────┬───────────┘
             │
             ▼
    ┌────────────────────────────────┐
    │  renderers[index].render()     │
    └────────┬───────────────────────┘
             │
             ▼
    ┌────────────────────────────────┐
    │  requestAnimationFrame(loop)   │
    └────────────────────────────────┘
```

## Key Design Decisions

### 1. Dual Canvas Architecture
**Why**: Each renderer needs its own context type (2D or WebGL)

```javascript
// Each renderer gets its own canvas
const canvas2d = document.getElementById('canvas2d');
const canvas3d = document.getElementById('canvas3d');

Render2D.init(canvas2d);  // 2D context
Render3D.init(canvas3d);  // WebGL context

// Both render every frame
Render2D.render();
Render3D.render();
```

Benefits:
- Each canvas can have a different context type
- Renderers run simultaneously for side-by-side comparison
- No context conflicts or switching overhead
- Can visualize rendering technique differences in real-time
- Each renderer fully owns its canvas
- Easy to add more canvases for additional renderers

### 2. Frame-Based Timing
All game timing uses frame counts assuming 60 FPS:
- Simple and consistent
- No time delta calculations needed
- Predictable physics

### 3. Unified Interface
All renderers implement the same interface:
- Game logic never knows which renderer is active
- Renderers can have different internal implementations
- Easy to test and compare renderers

## Adding a New Renderer

1. **Add a new canvas element** in `index.html`:
   ```html
   <div>
       <h3 style="color: #fff;">My Renderer</h3>
       <canvas id="canvasCustom" width="600" height="800"></canvas>
   </div>
   ```

2. **Create `renderName.js`** with the renderer interface:
   ```javascript
   const RenderCustom = {
       name: 'My Renderer',
       canvas: null,

       init(canvas) {
           this.canvas = canvas;
           // Initialize your context
           return true;
       },

       render() { /* ... */ },
       // ... implement all required methods
   };
   ```

3. **Add initialization in `game.js` init()**:
   ```javascript
   const canvasCustom = document.getElementById('canvasCustom');

   if (typeof RenderCustom !== 'undefined') {
       RenderCustom.init(canvasCustom);
   }
   ```

4. **Add render call in game loop**:
   ```javascript
   if (typeof RenderCustom !== 'undefined') {
       RenderCustom.render();
   }
   ```

That's it! Your renderer will now draw alongside the others.

## File Structure

```
webshmup/
├── index.html          # Main HTML file, loads all scripts
├── game.js             # Game logic and loop
├── render2d.js         # 2D Canvas renderer
├── render.js           # 3D WebGL renderer
├── CLAUDE.md           # Project documentation
├── RENDERER_GUIDE.md   # Renderer usage guide
└── ARCHITECTURE.md     # This file
```

## Future Enhancements

Possible renderer implementations:
- **ASCII Renderer**: Console/terminal-style display
- **SVG Renderer**: Vector graphics rendering
- **PixiJS Renderer**: Using PixiJS library
- **Three.js Renderer**: Full 3D models with Three.js
- **Canvas API Renderer**: Alternative 2D approach
- **Retro Renderer**: CRT effects, scanlines, etc.

The architecture supports all of these with minimal changes!
