import * as THREE from "three";

import { CameraDirector } from "./CameraDirector";
import { Timeline } from "./Timeline";
import { ProgramClock } from "./ProgramClock";
import { ProgramRunner } from "./ProgramRunner";

export interface CinematicContext {

    scene: THREE.Scene;

    camera: THREE.PerspectiveCamera;

}

export abstract class CinematicProgram {

    protected readonly scene: THREE.Scene;

    protected readonly camera: THREE.PerspectiveCamera;

    protected readonly clock: ProgramClock;

    protected readonly timeline: Timeline;

    protected readonly cameraDirector: CameraDirector;

    protected readonly runner: ProgramRunner;

    constructor(context: CinematicContext) {

        this.scene = context.scene;

        this.camera = context.camera;

        this.clock = new ProgramClock();

        this.timeline = new Timeline({

            autoPlay: true,

        });

        this.cameraDirector = new CameraDirector(

            this.camera,

        );

        this.runner = new ProgramRunner(

            this.cameraDirector,

            this.timeline,

            this.clock,

        );

        this.build();

    }

    //---------------------------------------------------------

    /**
     * Child classes build the movie here.
     */

    protected abstract build(): void;

    //---------------------------------------------------------

    /**
     * Called every frame.
     */

    update(delta: number): void {

        this.runner.update(delta);

    }

    //---------------------------------------------------------

    start(): void {

        this.runner.start();

    }

    //---------------------------------------------------------

    stop(): void {

        this.runner.stop();

    }

    //---------------------------------------------------------

    pause(): void {

        this.runner.pause();

    }

    //---------------------------------------------------------

    resume(): void {

        this.runner.resume();

    }

    //---------------------------------------------------------

    protected addSystem(system: { update(delta:number):void }): void {

        this.runner.addSystem(system);

    }

}