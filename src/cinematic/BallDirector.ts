import * as THREE from "three";

import { ProgramClock } from "./ProgramClock";

export interface KickOptions {

    direction: THREE.Vector3;

    speed: number;

    spin?: THREE.Vector3;

    gravity?: number;

}

export class BallDirector {

    private readonly ball: THREE.Object3D;

    private readonly clock: ProgramClock;

    private velocity = new THREE.Vector3();

    private spin = new THREE.Vector3();

    private gravity = 0;

    private floating = false;

    private floatingAmplitude = 0.05;

    private floatingSpeed = 0.8;

    constructor(

        ball: THREE.Object3D,

        clock: ProgramClock,

    ) {

        this.ball = ball;

        this.clock = clock;

    }

    //------------------------------------------------------

    update(delta: number): void {

        this.applyFloating();

        this.applyPhysics(delta);

        this.applySpin(delta);

    }

    //------------------------------------------------------

    private applyFloating(): void {

        if (!this.floating) {

            return;

        }

        const t = this.clock.getElapsed();

        this.ball.position.y +=

            Math.sin(

                t * this.floatingSpeed,

            ) *

            this.floatingAmplitude *

            0.01;

    }

    //------------------------------------------------------

    private applyPhysics(delta: number): void {

        this.velocity.y -=

            this.gravity *

            delta;

        this.ball.position.add(

            this.velocity.clone()

                .multiplyScalar(delta),

        );

    }

    //------------------------------------------------------

    private applySpin(delta: number): void {

        this.ball.rotation.x +=

            this.spin.x * delta;

        this.ball.rotation.y +=

            this.spin.y * delta;

        this.ball.rotation.z +=

            this.spin.z * delta;

    }

    //------------------------------------------------------

    float(

        amplitude = 0.05,

        speed = 0.8,

    ): this {

        this.floating = true;

        this.floatingAmplitude = amplitude;

        this.floatingSpeed = speed;

        return this;

    }

    //------------------------------------------------------

    stopFloating(): this {

        this.floating = false;

        return this;

    }

    //------------------------------------------------------

    kick(options: KickOptions): this {

        this.velocity.copy(

            options.direction

                .clone()

                .normalize()

                .multiplyScalar(

                    options.speed,

                ),

        );

        this.spin.copy(

            options.spin ??

            new THREE.Vector3(

                10,

                5,

                2,

            ),

        );

        this.gravity =

            options.gravity ?? 0.6;

        return this;

    }

    //------------------------------------------------------

    stop(): this {

        this.velocity.set(0,0,0);

        this.spin.set(0,0,0);

        this.gravity = 0;

        return this;

    }

    //------------------------------------------------------

    reset(

        position: THREE.Vector3,

    ): this {

        this.ball.position.copy(position);

        this.stop();

        return this;

    }

    //------------------------------------------------------

    lookAt(

        target: THREE.Vector3,

    ): this {

        this.ball.lookAt(target);

        return this;

    }

    //------------------------------------------------------

    setSpin(

        x:number,

        y:number,

        z:number,

    ): this {

        this.spin.set(x,y,z);

        return this;

    }

    //------------------------------------------------------

    setVelocity(

        velocity: THREE.Vector3,

    ): this {

        this.velocity.copy(velocity);

        return this;

    }

    //------------------------------------------------------

    getVelocity(): THREE.Vector3 {

        return this.velocity.clone();

    }

    //------------------------------------------------------

    getObject(): THREE.Object3D {

        return this.ball;

    }

}