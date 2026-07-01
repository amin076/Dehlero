
import { CinematicProgram } from "../../cinematic/CinematicProgram";
import { SceneActors } from "../../cinematic/SceneActors";
import { ShotLibrary } from "../../cinematic/ShotLibrary";

import { BallDirector } from "../../cinematic/BallDirector";
import { AstronautDirector } from "../../cinematic/AstronautDirector";
import { ShuttleDirector } from "../../cinematic/ShuttleDirector";

export class TitanWorldCupTrailer02 extends CinematicProgram {

    private actors!: SceneActors;

    protected build(): void {

        //--------------------------------------
        // Discover actors
        //--------------------------------------

        this.actors = new SceneActors(this.scene);

        const saturn =
            this.actors.get("Saturn");

        const ball =
            this.actors.get("ball");

        const shuttle =
            this.actors.get("shuttle");

        const astronaut1 =
            this.actors.get("Astronaut1");

        const astronaut2 =
            this.actors.get("Astronaut2");

        //--------------------------------------
        // Directors
        //--------------------------------------

        const ballDirector =
            new BallDirector(
                ball,
                this.clock,
            );

        const shuttleDirector =
            new ShuttleDirector(
                shuttle,
                this.clock,
            );

        const astronautA =
            new AstronautDirector(
                astronaut1,
                this.clock,
            );

        const astronautB =
            new AstronautDirector(
                astronaut2,
                this.clock,
            );

        //--------------------------------------
        // Initial states
        //--------------------------------------

        astronautA.lookAt(ball);

        astronautB.lookAt(ball);

        ballDirector.float(
            0.03,
            0.7,
        );

        shuttleDirector.enableIdle(
            0.02,
            0.35,
        );

        //--------------------------------------
        // Register systems
        //--------------------------------------

        this.addSystem(ballDirector);

        this.addSystem(shuttleDirector);

        this.addSystem(astronautA);

        this.addSystem(astronautB);

        //--------------------------------------
        // Timeline
        //--------------------------------------

        this.timeline

        //--------------------------------------
        // Hook
        //--------------------------------------

        .add(

            ShotLibrary.heroReveal(

                saturn,

                "WORLD CUP 3026",

                "ON TITAN",

                2.5,

            ),

        )

        //--------------------------------------
        // Shuttle reveal
        //--------------------------------------

        .add(

            ShotLibrary.orbit(

                shuttle,

                3,

                3,

            ),

        )

        //--------------------------------------
        // Ball reveal
        //--------------------------------------

        .add(

            ShotLibrary.heroReveal(

                ball,

                "LOW GRAVITY",

                "",

                2,

            ),

        )

        //--------------------------------------
        // Orbit
        //--------------------------------------

        .add(

            ShotLibrary.orbit(

                ball,

                1.4,

                3,

            ),

        )

        //--------------------------------------
        // Follow
        //--------------------------------------

        .add(

            ShotLibrary.followBall(

                ball,

                5,

            ),

        )

        //--------------------------------------
        // Ending
        //--------------------------------------

        .add(

            ShotLibrary.heroReveal(

                ball,

                "WOULD YOU",

                "PLAY HERE?",

                3,

            ),

        );

    }

}