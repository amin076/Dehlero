import { CameraDirector } from "./CameraDirector";
import { Timeline } from "./Timeline";
import { ProgramClock } from "./ProgramClock";

import type { CinematicShot } from "./ShotTypes";

export interface Updatable {

    update(delta: number): void;

}

export class ProgramRunner {

    private readonly camera: CameraDirector;

    private readonly timeline: Timeline;

    private readonly clock: ProgramClock;

    private readonly systems: Updatable[] = [];

    private currentShot: CinematicShot | null = null;

    constructor(

        camera: CameraDirector,

        timeline: Timeline,

        clock: ProgramClock,

    ) {

        this.camera = camera;

        this.timeline = timeline;

        this.clock = clock;

    }

    //--------------------------------------------------

    addSystem(system: Updatable): this {

        this.systems.push(system);

        return this;

    }

    //--------------------------------------------------

    start(): void {

        this.timeline.play();

        this.currentShot = this.timeline.first();

        if (this.currentShot) {

            this.camera.play(this.currentShot);

        }

    }

    //--------------------------------------------------

    update(realDelta: number): void {

        this.clock.update(realDelta);

        const delta = this.clock.getDelta();

        //----------------------------------------------

        for (const system of this.systems) {

            system.update(delta);

        }

        //----------------------------------------------

        this.camera.update(delta);

        //----------------------------------------------

        if (

            this.camera.isFinished()

            &&

            this.timeline.isPlaying()

        ) {

            const next = this.timeline.next();

            if (next) {

                this.currentShot = next;

                this.camera.play(next);

            }

        }

    }

    //--------------------------------------------------

    stop(): void {

        this.clock.stop();

        this.timeline.stop();

        this.camera.stop();

    }

    //--------------------------------------------------

    pause(): void {

        this.clock.pause();

        this.timeline.pause();

    }

    //--------------------------------------------------

    resume(): void {

        this.clock.play();

        this.timeline.play();

    }

    //--------------------------------------------------

    getClock(): ProgramClock {

        return this.clock;

    }

    //--------------------------------------------------

    getTimeline(): Timeline {

        return this.timeline;

    }

    //--------------------------------------------------

    getCameraDirector(): CameraDirector {

        return this.camera;

    }

}