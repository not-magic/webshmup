# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vibe Shooter is a vertical scrolling shoot-em-up game built with vanilla JavaScript and HTML5 Canvas. The game runs entirely client-side with no build process or dependencies.

## Running the Game

Open `index.html` directly in a web browser. No build step or server required.

## Architecture

This is a single-page application with a simple architecture:

- `index.html` - Game container with minimal styling (radial gradient background)
- `game.js` - Entire game engine and logic (~1950 lines)

### Game State System

The game uses a simple state machine with three states:
- `title` - Title screen, waiting for fire button
- `playing` - Active gameplay
- `dying` - Death animation (2 second delay before reset)

### Core Game Loop (60 FPS target)

The main loop (`gameLoop()`) runs all updates then renders:
1. Update stars (parallax scrolling background)
2. Handle shooting input
3. Update all entities (asteroids, enemies, UFOs, centipedes, bullets)
4. Check all collisions
5. Render frame

### Enemy Types and Spawning

**Asteroids**:
- Spawn randomly at top of screen
- Health scales with power level: `1 + floor(maxBullets / 10)`
- Color dynamically calculated per frame based on current health (grey at 1 HP, red at 10+ HP)
- Shoot random bullets on death equal to `maxHealth - 1`

**Blue Enemies**:
- Spawn rate increases 5% per 10 asteroids destroyed
- Health: `2 + floor(maxBullets / 12)`
- Color shifts blue → purple based on extra HP (capped at 5 extra)
- Movement: accelerate to random pause point → shoot bullets → exit
- Shoot `floor(maxBullets / 10) + 1` aimed bullets with ±5° spread on death

**UFOs (Large White Enemies)**:
- Spawn every 5 blue enemies destroyed
- Every 4th spawn triggers two UFOs instead of one
- Health: `10 + floor(maxBullets / 5)`
- Shoot rotating circular bullet patterns: `8 + floor(maxBullets / 5)` bullets
- Destroying UFO increases power by 3 (`maxBullets += 3`)

**Centipedes**:
- Spawn every 6 UFOs destroyed, spawn count = `floor(ufoKills / 6)` centipedes
- Segments: `5 + floor(maxBullets * 0.2)`
- Body segments: `floor((5 + floor(maxBullets * 0.1)) / 2)` HP
- Head segment: body HP × 10
- Travel diagonally across screen with sine wave motion
- 1% chance per frame to shoot aimed bullets, 2% chance for random bullets
- Teleport to new position when all segments go off screen (if any still alive)

### Player Power System

Power level is tracked by `maxBullets` (starts at 3, increases by 3 per UFO destroyed).

Power affects:
- Burst shot count: `max(1, floor(min(10, maxBullets * 0.25)) + 1)`
- Rapid fire delay: `max(1, floor(random(60) + 30) / maxBullets)` frames
- Rainbow bullet chance: `min(maxBullets, 100)`% (rainbow bullets count as 3, do 3 damage)
- Enemy health, bullet counts, spawn rates, and movement speed

### Shooting Mechanics

**Fire Button Behavior**:
- **Initial press**: Fires burst shot immediately with 30 frame initial delay before rapid fire starts
- **Hold**: Rapid fire mode - single bullets with ±5° random spread
- **Tap**: Only the initial burst fires (release before rapid fire starts)

**Burst Shots**:
- Center bullet + bullets split evenly on sides at 10° intervals
- Count: `max(1, floor(min(10, maxBullets * 0.25)) + 1)`
- All bullets in burst have `min((maxBullets-3)/2, 100)`% chance to be rainbow

**Rapid Fire**:
- Fires single bullet per shot with ±5° spread
- Delay between shots: `max(1, floor(random(60) + 30) / maxBullets)` frames
- Each bullet has `min(maxBullets, 100)`% chance to be rainbow (only if room for 3-bullet cost)

**Rainbow Bullets**:
- Count as 3 bullets toward the `maxBullets` limit
- Do 3 damage instead of 1
- Cycle through HSL hues for visual effect

### Collision Detection

- Player uses small circle hitbox (4.5px radius, offset down 3px from center)
- Asteroids and centipede segments use circle collision
- Blue enemies and UFOs use rectangle collision
- Enemy bullets: circle for player collision

### Visual Effects

**Banking Effect**: Player ship and blue enemies scale horizontally (0.7-1.0) based on horizontal movement/velocity to simulate banking in flight.

**Hit Flash**: Entities flash white for 5 frames when hit.

**Explosions**: Two-circle animation (yellow outer, white inner) that grows then shrinks over 20 frames.

**Score Popups**: Float upward and fade out over 60 frames.

**Powerup Text**: "LEVEL UP!" expands letter spacing (10px → 40px) and fades out over 60 frames.

### God Mode

Press 'G' to toggle god mode:
- Sets `maxBullets = 100`
- Prevents death
- Disables score counting

### High Score

Stored in localStorage as `vibeShooterHighScore`. Only updated on death (not during god mode).

## Important Implementation Details

### Frame-Based Timing
All timers use frame counts assuming 60 FPS (e.g., 60 frames = 1 second). Do not use millisecond timing.

### Bullet Accounting
Always account for rainbow bullets counting as 3 when checking against `maxBullets` limit. The pattern is:
```javascript
let currentBulletCount = 0;
for (let bullet of bullets) {
    currentBulletCount += bullet.isRainbow ? 3 : 1;
}
```

### Color Calculations
Asteroid and blue enemy colors are calculated dynamically based on current health/HP. Never store static colors for entities whose appearance changes with damage.

### Coordinate System
Canvas origin (0,0) is top-left. Player ship Y position is measured from bottom of screen (e.g., `canvas.height - 250`).

### Input Handling
Game supports both gamepad (button 0 for fire, left stick/D-pad for movement) and keyboard (Space for fire, arrow keys for movement). Always check both input sources and OR them together.
