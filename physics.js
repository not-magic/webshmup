// physics.js - Collision detection system

const Physics = {
    bodies: [],
    bodyPool: [], // Pool of reusable body objects
    accumulator: 0,
    fixedDeltaTime: 1.0 /  8, // Fixed timestep of 8x per 60 hz (1.0 delta time = 16.66ms)

    addCollisionBody(x, y, radius, vx = 0, vy = 0, mass = 1) {
        // Try to get a body from the pool, or create a new one
        let body;
        if (this.bodyPool.length > 0) {
            body = this.bodyPool.pop();
            // Reset the body properties
            body.x = x;
            body.y = y;
            body.radius = radius;
            body.vx = vx;
            body.vy = vy;
            body.mass = mass;
            body.destroy = false;
            body.lastHitImpulse = 0;
        } else {
            // No bodies in pool, create a new one
            body = {
                x: x,
                y: y,
                radius: radius,
                vx: vx,
                vy: vy,
                mass: mass,
                destroy: false,
                lastHitImpulse: 0,
            };
        }
        this.bodies.push(body);
        return body;
    },

    // Reset all bodies and return them to the pool
    resetAll() {
        // Move all bodies to the pool
        for (let body of this.bodies) {
            this.bodyPool.push(body);
        }
        // Clear the active bodies array
        this.bodies.length = 0;
        // Reset accumulator
        this.accumulator = 0;
    },

    // Apply an impulse to a body in a given direction
    applyImpulse(body, directionX, directionY, strength) {
        // Normalize direction
        const length = Math.sqrt(directionX * directionX + directionY * directionY);
        if (length > 0) {
            const nx = directionX / length;
            const ny = directionY / length;
            body.vx += nx * strength;
            body.vy += ny * strength;
        }
    },

    update(deltaTime) {
        // Return destroyed bodies to the pool and remove them from active list
        const activeBodies = [];
        for (let body of this.bodies) {
            if (body.destroy) {
                this.bodyPool.push(body);
            } else {
                activeBodies.push(body);
            }
        }
        this.bodies = activeBodies;

        // Accumulate elapsed time
        this.accumulator += deltaTime;

        for (let body of this.bodies) {
            body.lastHitImpulse = 0;
        }

        // Process physics in fixed timesteps
        while (this.accumulator >= this.fixedDeltaTime) {
            this.integrate();
            this.accumulator -= this.fixedDeltaTime;
        }
    },

    integrate() {
        // Update positions based on velocities
        for (let body of this.bodies) {
            body.x += body.vx * this.fixedDeltaTime;
            body.y += body.vy * this.fixedDeltaTime;
        }

        // Check collisions between all pairs of bodies
        for (let i = 0; i < this.bodies.length; i++) {
            for (let j = i + 1; j < this.bodies.length; j++) {
                const bodyA = this.bodies[i];
                const bodyB = this.bodies[j];

                // Calculate distance between bodies
                const dx = bodyB.x - bodyA.x;
                const dy = bodyB.y - bodyA.y;
                const distanceSquared = dx * dx + dy * dy;
                const radiusSum = bodyA.radius + bodyB.radius;

                // Check for collision
                if (distanceSquared < radiusSum * radiusSum && distanceSquared > 0) {
                    const distance = Math.sqrt(distanceSquared);
                    const overlap = radiusSum - distance;

                    // Calculate collision normal
                    const nx = dx / distance;
                    const ny = dy / distance;

                    // Separate bodies (position correction) weighted by mass
                    const totalMass = bodyA.mass + bodyB.mass;
                    const separationA = overlap * (bodyB.mass / totalMass);
                    const separationB = overlap * (bodyA.mass / totalMass);
                    bodyA.x -= nx * separationA;
                    bodyA.y -= ny * separationA;
                    bodyB.x += nx * separationB;
                    bodyB.y += ny * separationB;

                    // Calculate relative velocity
                    const relVx = bodyB.vx - bodyA.vx;
                    const relVy = bodyB.vy - bodyA.vy;

                    // Calculate relative velocity in collision normal direction
                    const velAlongNormal = relVx * nx + relVy * ny;

                    // Don't resolve if velocities are separating
                    if (velAlongNormal < 0) {
                        // Apply impulse to resolve collision (elastic collision with mass)
                        const restitution = 1.0; // Perfectly elastic
                        const impulse = (1 + restitution) * velAlongNormal / (1 / bodyA.mass + 1 / bodyB.mass);

                        bodyA.vx += impulse * nx / bodyA.mass;
                        bodyA.vy += impulse * ny / bodyA.mass;
                        bodyB.vx -= impulse * nx / bodyB.mass;
                        bodyB.vy -= impulse * ny / bodyB.mass;

                        bodyA.lastHitImpulse -= impulse / bodyA.mass;
                        bodyB.lastHitImpulse -= impulse / bodyB.mass;
                    }
                }
            }
        }
    }
};
