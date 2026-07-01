import * as THREE from "three";

import { createHeroReveal } from "./HeroRevealBuilder";
import { createOrbitShot } from "./OrbitShotBuilder";
import { createFollowBallShot } from "./FollowBallShotBuilder";

import type { CinematicShot } from "./ShotTypes";

export class ShotLibrary {

    //---------------------------------------------------------

    static heroReveal(

        target: THREE.Object3D,

        title?: string,

        subtitle?: string,

        duration = 4,

    ): CinematicShot {

        return createHeroReveal({

            target,

            title,

            subtitle,

            duration,

        });

    }

    //---------------------------------------------------------

    static orbit(

        target: THREE.Object3D,

        radius = 3,

        duration = 4,

    ): CinematicShot {

        return createOrbitShot({

            target,

            radius,

            duration,

        });

    }

    //---------------------------------------------------------

    static followBall(

        ball: THREE.Object3D,

        duration = 5,

    ): CinematicShot {

        return createFollowBallShot({

            ball,

            duration,

        });

    }

}