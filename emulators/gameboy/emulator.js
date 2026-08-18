/*
 * ============================================================
 * WebBktx — Game Boy Emulator Core
 * ============================================================
 *
 * Łączy:
 *
 *   Cartridge
 *   Memory
 *   CPU
 *   PPU
 *   Timer
 *   Input
 *
 * ============================================================
 */

import GameBoyCartridge from "./cartridge.js";
import GameBoyMemory from "./memory.js";
import GameBoyPPU from "./ppu.js";
import GameBoyInput from "./input.js";
import GameBoyCPU from "./cpu.js";
import GameBoyTimer from "./timer.js";


export default class GameBoyEmulator {

    constructor(canvas) {

        /*
         * ----------------------------------------------------
         * Main components
         * ----------------------------------------------------
         */

        this.cartridge =
            new GameBoyCartridge();


        this.memory =
            new GameBoyMemory(
                this.cartridge
            );


        this.cpu =
            new GameBoyCPU(
                this.memory
            );


        this.ppu =
            new GameBoyPPU(
                this.memory,
                canvas
            );


        this.input =
            new GameBoyInput();


        this.timer =
            new GameBoyTimer(
                this.memory
            );


        /*
         * ----------------------------------------------------
         * Emulator state
         * ----------------------------------------------------
         */

        this.running = false;

        this.paused = false;

        this.romLoaded = false;


        /*
         * Animation frame.
         */

        this.animationFrame =
            null;


        /*
         * Timing.
         */

        this.lastTime = 0;

        this.accumulator = 0;


        /*
         * Game Boy CPU frequency.
         *
         * DMG:
         * 4,194,304 Hz
         */

        this.cpuFrequency =
            4194304;


        /*
         * Frame rate:
         *
         * ~59.73 FPS
         */

        this.frameRate =
            59.7275;


        this.cyclesPerFrame =
            Math.floor(
                this.cpuFrequency /
                this.frameRate
            );


        /*
         * Maximum cycles executed
         * in one browser frame.
         *
         * Prevents infinite loops
         * from freezing the browser.
         */

        this.maxCyclesPerFrame =
            70224;


        /*
         * Debug.
         */

        this.debug = {

            frames: 0,

            cycles: 0,

            fps: 0,

            lastFPSUpdate: 0

        };


        /*
         * ROM information.
         */

        this.romInfo = null;

    }


    /*
     * ========================================================
     * LOAD ROM
     * ========================================================
     */

    async loadROM(file) {

        if (!file) {

            throw new Error(
                "Nie podano pliku ROM."
            );

        }


        let data;


        /*
         * File / Blob
         */

        if (
            typeof file.arrayBuffer ===
            "function"
        ) {

            data =
                await file.arrayBuffer();

        }


        /*
         * ArrayBuffer
         */

        else if (
            file instanceof
            ArrayBuffer
        ) {

            data = file;

        }


        /*
         * Uint8Array
         */

        else if (
            file instanceof
            Uint8Array
        ) {

            data = file;

        }


        else {

            throw new Error(
                "Nieobsługiwany format ROM."
            );

        }


        /*
         * Load cartridge.
         */

        this.romInfo =
            this.cartridge.load(
                data
            );


        this.romLoaded =
            true;


        /*
         * Reset all components.
         */

        this.reset();


        console.log(
            "[WebBktx] ROM loaded:",
            this.romInfo
        );


        return this.romInfo;

    }


    /*
     * ========================================================
     * RESET
     * ========================================================
     */

    reset() {

        /*
         * CPU
         */

        if (
            this.cpu &&
            typeof this.cpu.reset ===
            "function"
        ) {

            this.cpu.reset();

        }


        /*
         * PPU
         */

        if (
            this.ppu &&
            typeof this.ppu.reset ===
            "function"
        ) {

            this.ppu.reset();

        }


        /*
         * Timer
         */

        if (
            this.timer &&
            typeof this.timer.reset ===
            "function"
        ) {

            this.timer.reset();

        }


        /*
         * Input
         */

        if (
            this.input &&
            typeof this.input.reset ===
            "function"
        ) {

            this.input.reset();

        }


        /*
         * Timing.
         */

        this.accumulator = 0;

        this.lastTime = 0;


        this.debug.frames = 0;

        this.debug.cycles = 0;

    }


    /*
     * ========================================================
     * START
     * ========================================================
     */

    start() {

        if (!this.romLoaded) {

            throw new Error(
                "Najpierw załaduj ROM."
            );

        }


        if (this.running) {

            return;

        }


        this.running = true;

        this.paused = false;

        this.lastTime =
            performance.now();


        console.log(
            "[WebBktx] Game Boy started."
        );


        this.animationFrame =
            requestAnimationFrame(
                time =>
                    this.loop(time)
            );

    }


    /*
     * ========================================================
     * STOP
     * ========================================================
     */

    stop() {

        this.running = false;


        if (
            this.animationFrame !== null
        ) {

            cancelAnimationFrame(
                this.animationFrame
            );

            this.animationFrame =
                null;

        }


        console.log(
            "[WebBktx] Game Boy stopped."
        );

    }


    /*
     * ========================================================
     * PAUSE
     * ========================================================
     */

    pause() {

        this.paused =
            true;

    }


    /*
     * ========================================================
     * RESUME
     * ========================================================
     */

    resume() {

        if (!this.running) {

            this.start();

            return;

        }


        this.paused =
            false;

        this.lastTime =
            performance.now();

    }


    /*
     * ========================================================
     * MAIN LOOP
     * ========================================================
     */

    loop(time) {

        if (!this.running) {

            return;

        }


        /*
         * Schedule next browser frame.
         */

        this.animationFrame =
            requestAnimationFrame(
                t =>
                    this.loop(t)
            );


        /*
         * Paused.
         */

        if (this.paused) {

            this.lastTime =
                time;

            return;

        }


        /*
         * Delta time.
         */

        let delta =
            time -
            this.lastTime;


        this.lastTime =
            time;


        /*
         * Prevent huge jumps after
         * browser tab suspension.
         */

        if (delta > 100) {

            delta = 100;

        }


        /*
         * Convert milliseconds
         * into CPU cycles.
         */

        this.accumulator +=
            (
                delta /
                1000
            ) *
            this.cpuFrequency;


        /*
         * Maximum cycles per browser frame.
         */

        let cyclesThisFrame =
            Math.min(
                Math.floor(
                    this.accumulator
                ),
                this.maxCyclesPerFrame
            );


        if (
            cyclesThisFrame <= 0
        ) {

            return;

        }


        this.accumulator -=
            cyclesThisFrame;


        /*
         * Execute emulation.
         */

        let executed = 0;


        while (
            executed <
            cyclesThisFrame
        ) {

            const cycles =
                this.step();


            /*
             * Safety:
             * CPU must return a positive
             * cycle count.
             */

            if (
                !cycles ||
                cycles < 0
            ) {

                console.warn(
                    "[WebBktx] CPU returned invalid cycle count."
                );

                break;

            }


            executed +=
                cycles;

        }


        /*
         * Debug.
         */

        this.debug.cycles +=
            executed;


        this.updateFPS(
            time
        );

    }


    /*
     * ========================================================
     * SINGLE EMULATION STEP
     * ========================================================
     */

    step() {

        /*
         * ----------------------------------------------------
         * INPUT
         * ----------------------------------------------------
         */

        this.input.updateGamepad();


        /*
         * Update joypad register.
         */

        this.updateJoypad();


        /*
         * ----------------------------------------------------
         * CPU
         * ----------------------------------------------------
         */

        let cycles = 4;


        if (
            this.cpu &&
            typeof this.cpu.step ===
            "function"
        ) {

            cycles =
                this.cpu.step();

        }


        /*
         * ----------------------------------------------------
         * PPU
         * ----------------------------------------------------
         */

        if (
            this.ppu &&
            typeof this.ppu.step ===
            "function"
        ) {

            this.ppu.step(
                cycles
            );

        }


        /*
         * ----------------------------------------------------
         * TIMER
         * ----------------------------------------------------
         */

        if (
            this.timer &&
            typeof this.timer.step ===
            "function"
        ) {

            this.timer.step(
                cycles
            );

        }


        return cycles;

    }


    /*
     * ========================================================
     * JOYPAD REGISTER
     * ========================================================
     *
     * FF00
     *
     * Bit:
     *
     * P14 = buttons
     * P15 = directions
     * ========================================================
     */

    updateJoypad() {

        /*
         * This implementation expects
         * FF00 to be handled by memory.js.
         *
         * We update it if the memory module
         * exposes a joypad method.
         */

        if (
            typeof this.memory.setJoypadState ===
            "function"
        ) {

            this.memory.setJoypadState(
                this.input.getState()
            );

            return;

        }


        /*
         * Fallback implementation.
         */

        let joyp =
            this.memory.read(0xFF00);


        /*
         * Keep selection bits.
         */

        let result =
            joyp & 0xF0;


        /*
         * Buttons selected.
         */

        if (!(joyp & 0x20)) {

            let buttons = 0x0F;


            if (
                this.input.isDown("a")
            ) {

                buttons &= ~0x01;

            }


            if (
                this.input.isDown("b")
            ) {

                buttons &= ~0x02;

            }


            if (
                this.input.isDown("select")
            ) {

                buttons &= ~0x04;

            }


            if (
                this.input.isDown("start")
            ) {

                buttons &= ~0x08;

            }


            result |=
                buttons;

        }


        /*
         * Direction selected.
         */

        else if (!(joyp & 0x10)) {

            let directions = 0x0F;


            if (
                this.input.isDown("right")
            ) {

                directions &= ~0x01;

            }


            if (
                this.input.isDown("left")
            ) {

                directions &= ~0x02;

            }


            if (
                this.input.isDown("up")
            ) {

                directions &= ~0x04;

            }


            if (
                this.input.isDown("down")
            ) {

                directions &= ~0x08;

            }


            result |=
                directions;

        }


        this.memory.write(
            0xFF00,
            result
        );

    }


    /*
     * ========================================================
     * FPS
     * ========================================================
     */

    updateFPS(time) {

        this.debug.frames++;


        if (
            !this.debug.lastFPSUpdate
        ) {

            this.debug.lastFPSUpdate =
                time;

            return;

        }


        const elapsed =
            time -
            this.debug.lastFPSUpdate;


        if (
            elapsed >= 1000
        ) {

            this.debug.fps =
                this.debug.frames;


            this.debug.frames =
                0;


            this.debug.lastFPSUpdate =
                time;

        }

    }


    /*
     * ========================================================
     * SAVE
     * ========================================================
     */

    getSaveData() {

        if (
            !this.cartridge
        ) {

            return null;

        }


        return this.cartridge.getSaveData();

    }


    /*
     * ========================================================
     * LOAD SAVE
     * ========================================================
     */

    loadSave(data) {

        if (
            !this.cartridge
        ) {

            return false;

        }


        return this.cartridge.loadSave(
            data
        );

    }


    /*
     * ========================================================
     * DEBUG STATE
     * ========================================================
     */

    getState() {

        return {

            running:
                this.running,

            paused:
                this.paused,

            romLoaded:
                this.romLoaded,

            rom:
                this.romInfo,

            cpu:
                this.cpu?.getState
                    ? this.cpu.getState()
                    : null,

            ppu:
                this.ppu?.getState
                    ? this.ppu.getState()
                    : null,

            fps:
                this.debug.fps,

            cycles:
                this.debug.cycles

        };

    }

}
