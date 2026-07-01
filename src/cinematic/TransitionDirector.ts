import * as THREE from "three";

export type TransitionType =
    | "cut"
    | "blend"
    | "fade"
    | "fadeBlack"
    | "whipPan"
    | "flash";

export interface Transition {

    type: TransitionType;

    duration: number;

}

export class TransitionDirector {

    private active = false;

    private elapsed = 0;

    private transition: Transition | null = null;

    private fromPosition = new THREE.Vector3();

    private toPosition = new THREE.Vector3();

    private fromTarget = new THREE.Vector3();

    private toTarget = new THREE.Vector3();

    private fromFov = 45;

    private toFov = 45;

    begin(

        transition: Transition,

        fromCamera: THREE.PerspectiveCamera,

        toPosition: THREE.Vector3,

        toTarget: THREE.Vector3,

        toFov: number,

    ): void {

        this.transition = transition;

        this.elapsed = 0;

        this.active = true;

        this.fromPosition.copy(

            fromCamera.position,

        );

        const forward = new THREE.Vector3();

        fromCamera.getWorldDirection(forward);

        this.fromTarget.copy(

            fromCamera.position.clone().add(forward),

        );

        this.fromFov = fromCamera.fov;

        this.toPosition.copy(toPosition);

        this.toTarget.copy(toTarget);

        this.toFov = toFov;

    }

    update(

        camera: THREE.PerspectiveCamera,

        delta: number,

    ): boolean {

        if (!this.active || !this.transition) {

            return false;

        }

        this.elapsed += delta;

        const t = Math.min(

            1,

            this.elapsed /

            this.transition.duration,

        );

        switch (

            this.transition.type

        ) {

            case "cut":

                camera.position.copy(

                    this.toPosition,

                );

                camera.lookAt(

                    this.toTarget,

                );

                camera.fov = this.toFov;

                break;

            case "blend":

            case "fade":

            case "fadeBlack":

            case "whipPan":

            case "flash":

                camera.position.lerpVectors(

                    this.fromPosition,

                    this.toPosition,

                    THREE.MathUtils.smootherstep(

                        t,

                        0,

                        1,

                    ),

                );

                const target =

                    new THREE.Vector3()

                        .lerpVectors(

                            this.fromTarget,

                            this.toTarget,

                            THREE.MathUtils.smootherstep(

                                t,

                                0,

                                1,

                            ),

                        );

                camera.lookAt(target);

                camera.fov = THREE.MathUtils.lerp(

                    this.fromFov,

                    this.toFov,

                    t,

                );

                break;

        }

        camera.updateProjectionMatrix();

        if (t >= 1) {

            this.active = false;

        }

        return this.active;

    }

    isActive(): boolean {

        return this.active;

    }

    stop(): void {

        this.active = false;

        this.transition = null;

    }

}