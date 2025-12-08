"use strict";
// instanced_render_pool.js - A managed InstanceMesh pool

class InstancedRenderPool {
	constructor() {
		this.scene =  null;
		this.instances =  null;
		this.capacity =  0;
		this.growAmount =  10;
		this.instanceCount =  0;
		this.geometry =  null;
		this.material =  null;

	    // Temporary objects (reused to avoid allocations)
	    this.tempMatrix =  new THREE.Matrix4();
	    this.tempPosition =  new THREE.Vector3();
	    this.tempQuaternion =  new THREE.Quaternion();
	    this.tempEuler =  new THREE.Euler();
	    this.tempScale =  new THREE.Vector3();
	    this.tempColor =  new THREE.Color();
	}

	init(scene, geometry, capacity, growAmount, material = null) {
		this.scene = scene;
		this.geometry = geometry;
		this.growAmount = growAmount;

		// Use provided material, or material from geometry if available, or default
		if (material) {
			this.material = material;
		} else if (geometry.material) {
			this.material = geometry.material;
		} else {
			this.material = new THREE.MeshStandardMaterial({ vertexColors: true });
		}

		this.grow(capacity);
		this.add(-10000, -10000, 0, 0.1, 0.1, 0.1, '#000000');
	}

    // Grow cube instances capacity
    grow(count) {
    	if (this.geometry == null) return;

        const oldCapacity = this.capacity;
        this.capacity += count;
        console.log(`Growing pool instances from ${oldCapacity} to ${this.capacity}`);

        // Create new larger instanced mesh
        const geometry = this.geometry;
        const material = this.material || new THREE.MeshStandardMaterial({ vertexColors: true });
        const newInstances = new THREE.InstancedMesh(
            geometry,
            material,
            this.capacity
        );
        newInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        // Setup colors
        const colors = new Float32Array(this.capacity * 3);
        newInstances.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
        newInstances.instanceColor.setUsage(THREE.DynamicDrawUsage);

        if (this.instances != null) {
	        // Copy old data
	        for (let i = 0; i < oldCapacity; i++) {
	            this.instances.getMatrixAt(i, this.tempMatrix);
	            newInstances.setMatrixAt(i, this.tempMatrix);
	        }

	        if (this.instances.instanceColor) {
	            colors.set(this.instances.instanceColor.array);
	        }

	        this.scene.remove(this.instances);
	        this.instances.dispose();
        }

        this.instances = newInstances;
        this.scene.add(this.instances);
    }

	add(x, y, z, scale_x, scale_y, scale_z, color, pitch = 0, yaw = 0, roll = 0) {
        const index = this.instanceCount++;
        if (index >= this.capacity) {
            // Grow the cube instances
            this.grow(this.growAmount);
        }

        if (index >= this.capacity) return; // couldn't grow

        // Set position, rotation, and scale via matrix
        this.tempPosition.set(x, y, z);
        this.tempScale.set(scale_x, scale_y, scale_z);

        // Set rotation from Euler angles (pitch=X, yaw=Y, roll=Z)
        this.tempEuler.set(pitch, yaw, roll, 'XYZ');
        this.tempQuaternion.setFromEuler(this.tempEuler);

        this.tempMatrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);
        this.instances.setMatrixAt(index, this.tempMatrix);

        // Set color
        this.tempColor.set(color);
        this.instances.setColorAt(index, this.tempColor);
	}

	reset() {
		this.instanceCount = 0;
	}

	render() {
		if (this.instances == null) return;

        // Update instance counts and mark for update
        this.instances.count = this.instanceCount;
        this.instances.instanceMatrix.needsUpdate = true;
        this.instances.instanceColor.needsUpdate = true;		
	}
}