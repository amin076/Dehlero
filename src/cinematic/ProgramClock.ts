export interface ProgramClockOptions {

    fps?: number;

    timeScale?: number;

}

export class ProgramClock {

    private elapsed = 0;

    private delta = 0;

    private frame = 0;

    private playing = true;

    private fps: number;

    private timeScale: number;

    constructor(options: ProgramClockOptions = {}) {

        this.fps = options.fps ?? 60;

        this.timeScale = options.timeScale ?? 1;

    }

    //--------------------------------------------------

    update(realDelta: number): void {

        if (!this.playing) {

            this.delta = 0;

            return;

        }

        this.delta = realDelta * this.timeScale;

        this.elapsed += this.delta;

        this.frame++;

    }

    //--------------------------------------------------

    play(): void {

        this.playing = true;

    }

    //--------------------------------------------------

    pause(): void {

        this.playing = false;

    }

    //--------------------------------------------------

    toggle(): void {

        this.playing = !this.playing;

    }

    //--------------------------------------------------

    stop(): void {

        this.elapsed = 0;

        this.delta = 0;

        this.frame = 0;

        this.playing = false;

    }

    //--------------------------------------------------

    seek(seconds: number): void {

        this.elapsed = Math.max(0, seconds);

        this.frame = Math.floor(

            this.elapsed * this.fps,

        );

    }

    //--------------------------------------------------

    stepFrame(): void {

        this.elapsed += 1 / this.fps;

        this.frame++;

    }

    //--------------------------------------------------

    setTimeScale(scale: number): void {

        this.timeScale = Math.max(0, scale);

    }

    //--------------------------------------------------

    setFPS(fps: number): void {

        if (fps > 0) {

            this.fps = fps;

        }

    }

    //--------------------------------------------------

    getElapsed(): number {

        return this.elapsed;

    }

    //--------------------------------------------------

    getDelta(): number {

        return this.delta;

    }

    //--------------------------------------------------

    getFrame(): number {

        return this.frame;

    }

    //--------------------------------------------------

    getFPS(): number {

        return this.fps;

    }

    //--------------------------------------------------

    getTimeScale(): number {

        return this.timeScale;

    }

    //--------------------------------------------------

    isPlaying(): boolean {

        return this.playing;

    }

}