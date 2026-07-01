import * as THREE from "three";

import { ProgramClock } from "./ProgramClock";

export interface FlyByOptions {

    start: THREE.Vector3;

    end: THREE.Vector3;

    duration: number;

    loop?: boolean;

}

export class ShuttleDirector {

    private readonly shuttle: THREE.Object3D;

    private readonly clock: ProgramClock;

    private flyBy: FlyByOptions | null = null;

    private startedAt = 0;

    private idleEnabled = true;

    private idleAmplitude = 0.03;

    private idleSpeed = 0.45;

    constructor(

        shuttle: THREE.Object3D,

        clock: ProgramClock,

    ) {

        this.shuttle = shuttle;

        this.clock = clock;

    }

    //---------------------------------------------------------

    update(delta: number): void {

        this.updateIdle(delta);

        this.updateFlyBy(delta);

    }

    //---------------------------------------------------------

    private updateIdle(delta: number): void {

        if (!this.idleEnabled) {

            return;

        }

        const t = this.clock.getElapsed();

        this.shuttle.position.y +=

            Math.sin(t * this.idleSpeed) *

            this.idleAmplitude *

            delta;

        this.shuttle.rotation.z +=

            Math.sin(t * 0.5) *

            0.015 *

            delta;

        this.shuttle.rotation.x +=

            Math.cos(t * 0.4) *

            0.01 *

            delta;

    }

    //---------------------------------------------------------

    private updateFlyBy(_delta: number): void {

        if (!this.flyBy) {

            return;

        }

        const elapsed =

            this.clock.getElapsed()

            - this.startedAt;

        let t =

            elapsed /

            this.flyBy.duration;

        if (this.flyBy.loop) {

            t = t % 1;

        } else {

            t = Math.min(1, t);

        }

        this.shuttle.position.lerpVectors(

            this.flyBy.start,

            this.flyBy.end,

            t,

        );

        const direction =

            this.flyBy.end

                .clone()

                .sub(

                    this.flyBy.start,

                )

                .normalize();

        const target =

            this.shuttle.position

                .clone()

                .add(direction);

        this.shuttle.lookAt(target);

        if (

            !this.flyBy.loop

            &&

            t >= 1

        ) {

            this.flyBy = null;

        }

    }

    //---------------------------------------------------------

    startFlyBy(

        options: FlyByOptions,

    ): this {

        this.flyBy = options;

        this.startedAt =

            this.clock.getElapsed();

        return this;

    }

    //---------------------------------------------------------

    stopFlyBy(): this {

        this.flyBy = null;

        return this;

    }

    //---------------------------------------------------------

    enableIdle(

        amplitude = 0.03,

        speed = 0.45,

    ): this {

        this.idleEnabled = true;

        this.idleAmplitude = amplitude;

        this.idleSpeed = speed;

        return this;

    }

    //---------------------------------------------------------

    disableIdle(): this {

        this.idleEnabled = false;

        return this;

    }

    //---------------------------------------------------------

    reset(

        position: THREE.Vector3,

        rotation?: THREE.Euler,

    ): this {

        this.shuttle.position.copy(position);

        if (rotation) {

            this.shuttle.rotation.copy(rotation);

        }

        this.flyBy = null;

        return this;

    }

    //---------------------------------------------------------

    lookAt(

        target: THREE.Object3D | THREE.Vector3,

    ): this {

        if (

            target instanceof THREE.Object3D

        ) {

            this.shuttle.lookAt(

                target.position,

            );

        } else {

            this.shuttle.lookAt(target);

        }

        return this;

    }

    //---------------------------------------------------------

    getObject(): THREE.Object3D {

        return this.shuttle;

    }

}