import type { CinematicShot } from "./ShotTypes";

export interface TimelineOptions {

    loop?: boolean;

    autoPlay?: boolean;

}

export class Timeline {

    private readonly shots: CinematicShot[] = [];

    private currentIndex = 0;

    private playing = false;

    private loop = false;

    constructor(options: TimelineOptions = {}) {

        this.loop = options.loop ?? false;

        this.playing = options.autoPlay ?? false;

    }

    //------------------------------------------------------

    add(shot: CinematicShot): this {

        this.shots.push(shot);

        return this;

    }

    //------------------------------------------------------

    addMany(shots: CinematicShot[]): this {

        this.shots.push(...shots);

        return this;

    }

    //------------------------------------------------------

    clear(): this {

        this.shots.length = 0;

        this.currentIndex = 0;

        return this;

    }

    //------------------------------------------------------

    play(): this {

        this.playing = true;

        return this;

    }

    //------------------------------------------------------

    pause(): this {

        this.playing = false;

        return this;

    }

    //------------------------------------------------------

    stop(): this {

        this.playing = false;

        this.currentIndex = 0;

        return this;

    }

    //------------------------------------------------------

    next(): CinematicShot | null {

        if (this.shots.length === 0) {

            return null;

        }

        this.currentIndex++;

        if (this.currentIndex >= this.shots.length) {

            if (!this.loop) {

                this.currentIndex = this.shots.length - 1;

                this.playing = false;

            } else {

                this.currentIndex = 0;

            }

        }

        return this.current();

    }

    //------------------------------------------------------

    previous(): CinematicShot | null {

        if (this.shots.length === 0) {

            return null;

        }

        this.currentIndex--;

        if (this.currentIndex < 0) {

            this.currentIndex = 0;

        }

        return this.current();

    }

    //------------------------------------------------------

    current(): CinematicShot | null {

        if (this.shots.length === 0) {

            return null;

        }

        return this.shots[this.currentIndex];

    }

    //------------------------------------------------------

    first(): CinematicShot | null {

        if (this.shots.length === 0) {

            return null;

        }

        this.currentIndex = 0;

        return this.current();

    }

    //------------------------------------------------------

    last(): CinematicShot | null {

        if (this.shots.length === 0) {

            return null;

        }

        this.currentIndex = this.shots.length - 1;

        return this.current();

    }

    //------------------------------------------------------

    getCurrentIndex(): number {

        return this.currentIndex;

    }

    //------------------------------------------------------

    size(): number {

        return this.shots.length;

    }

    //------------------------------------------------------

    isPlaying(): boolean {

        return this.playing;

    }

    //------------------------------------------------------

    getShots(): readonly CinematicShot[] {

        return this.shots;

    }

}
