/*
 * ============================================================
 * WebBktx — Game Boy Emulator Core
 * ============================================================
 *
 * Łączy:
 *   CPU
 *   Memory
 *   PPU
 *   Timer
 *   Input
 *   Audio
 *   Cartridge
 *
 * ============================================================
 */

import CPU from "./cpu.js";
import GameBoyMemory from "./memory.js";
import PPU from "./ppu.js";
import Timer from "./timer.js";
import Input from "./input.js";
import Audio from "./audio.js";
import Cartridge from "./cartridge.js";


export default class GameBoy {

    constructor(options = {}) {

        this.canvas =
            options.canvas || null;

        this.context =
            this.canvas
                ? this.canvas.getContext("2d")
                : null;


        /*
         * ----------------------------------------------------
         * Hardware
         * ----------------------------------------------------
         */

        this.memory =
            new GameBoyMemory();

        this.cartridge =
            new Cartridge();

        this.ppu =
            new PPU();

        this.timer =
            new Timer();

        this.input =
            new Input();

        this.audio =
            new Audio();


        /*
         * ----------------------------------------------------
         * CPU
         * ----------------------------------------------------
         */

        this.cpu =
            new CPU(this.memory);


        /*
         * ----------------------------------------------------
         * Connect memory bus
         * ----------------------------------------------------
         */

        this.memory.connectCartridge(
            this.cartridge
        );

        this.memory.connectPPU(
            this.ppu
        );

        this.memory.connectTimer(
            this.timer
        );

        this.memory.connectInput(
            this.input
        );

        this.memory.connectAudio(
            this.audio
        );


        /*
         * ----------------------------------------------------
         * Timing
         * ----------------------------------------------------
         */

        this.clockSpeed =
            4194304;

        this.cycles =
            0;

        this.frameCycles =
            0;


        /*
         * ----------------------------------------------------
         * Emulator state
         * ----------------------------------------------------
         */

        this.running =
            false;

        this.paused =
            false;

        this.romLoaded =
            false;


        this.animationFrame =
            null;


        /*
         * ----------------------------------------------------
         * FPS
         * ----------------------------------------------------
         */

        this.frames =
            0;

        this.fps =
            0;

        this.fpsTime =
            performance.now();


        /*
         * ----------------------------------------------------
         * Framebuffer
         * ----------------------------------------------------
         */

        this.framebuffer =
            new Uint8ClampedArray(
                160 * 144 * 4
            );


        this.frameImage =
            this.context
                ? this.context.createImageData(
                    160,
                    144
                )
                : null;


        /*
         * ----------------------------------------------------
         * CPU callback
         * ----------------------------------------------------
         */

        this.connectCPU();


        /*
         * ----------------------------------------------------
         * Reset
         * ----------------------------------------------------
         */

        this.reset();

    }


    /*
     * ========================================================
     * CPU CONNECTION
     * ========================================================
     */

    connectCPU() {

        /*
         * Some CPU implementations expose
         * reset()/step()/clock().
         *
         * emulator.js keeps the interface
         * flexible so we can improve CPU later.
         */

        if (
            typeof this.cpu.setMemory ===
            "function"
        ) {

            this.cpu.setMemory(
                this.memory
            );

        }

    }


    /*
     * ========================================================
     * RESET
     * ========================================================
     */

    reset() {

        this.stop();

        this.memory.reset();


        if (
            typeof this.cartridge.reset ===
            "function"
        ) {

            this.cartridge.reset();

        }


        if (
            typeof this.cpu.reset ===
            "function"
        ) {

            this.cpu.reset();

        }


        if (
            typeof this.ppu.reset ===
            "function"
        ) {

            this.ppu.reset();

        }


        if (
            typeof this.timer.reset ===
            "function"
        ) {

            this.timer.reset();

        }


        if (
            typeof this.input.reset ===
            "function"
        ) {

            this.input.reset();

        }


        if (
            typeof this.audio.reset ===
            "function"
        ) {

            this.audio.reset();

        }


        this.cycles =
            0;

        this.frameCycles =
            0;

        this.frames =
            0;

        this.fps =
            0;

        this.romLoaded =
            Boolean(
                this.cartridge &&
                this.cartridge.rom
            );

    }


    /*
     * ========================================================
     * LOAD ROM
     * ========================================================
     */

    loadROM(data) {

        if (
            !data ||
            data.length === 0
        ) {

            throw new Error(
                "Game Boy ROM jest pusty."
            );

        }


        /*
         * Cartridge loader
         */

        if (
            typeof this.cartridge.load ===
            "function"
        ) {

            this.cartridge.load(
                data
            );

        } else {

            /*
             * Fallback dla prostego
             * cartridge.js.
             */

            this.cartridge.rom =
                new Uint8Array(data);

        }


        this.romLoaded =
            true;


        this.resetCPU();


        return true;

    }


    /*
     * ========================================================
     * RESET CPU AFTER ROM
     * ========================================================
     */

    resetCPU() {

        if (
            typeof this.cpu.reset ===
            "function"
        ) {

            this.cpu.reset();

        }


        /*
         * Classic DMG normally starts
         * at 0100 after boot ROM.
         */

        if (
            typeof this.cpu.setPC ===
            "function"
        ) {

            this.cpu.setPC(
                0x0100
            );

        } else if (
            this.cpu.registers
        ) {

            this.cpu.registers.pc =
                0x0100;

        } else if (
            "pc" in this.cpu
        ) {

            this.cpu.pc =
                0x0100;

        }

    }


    /*
     * ========================================================
     * START
     * ========================================================
     */

    start() {

        if (
            !this.romLoaded
        ) {

            throw new Error(
                "Najpierw załaduj ROM Game Boy."
            );

        }


        if (
            this.running
        ) {

            return;

        }


        this.running =
            true;

        this.paused =
            false;


        this.lastTime =
            performance.now();


        this.animationFrame =
            requestAnimationFrame(
                this.loop.bind(this)
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

        if (
            !this.running
        ) {

            this.start();

            return;

        }


        this.paused =
            false;

    }


    /*
     * ========================================================
     * STOP
     * ========================================================
     */

    stop() {

        this.running =
            false;

        this.paused =
            false;


        if (
            this.animationFrame !== null
        ) {

            cancelAnimationFrame(
                this.animationFrame
            );

            this.animationFrame =
                null;

        }

    }


    /*
     * ========================================================
     * MAIN LOOP
     * ========================================================
     */

    loop(timestamp) {

        if (
            !this.running
        ) {

            return;

        }


        this.animationFrame =
            requestAnimationFrame(
                this.loop.bind(this)
            );


        if (
            this.paused
        ) {

            this.lastTime =
                timestamp;

            return;

        }


        let elapsed =
            timestamp -
            this.lastTime;


        this.lastTime =
            timestamp;


        /*
         * Prevent huge jumps after
         * tab switching.
         */

        if (
            elapsed > 250
        ) {

            elapsed =
                250;

        }


        /*
         * Game Boy CPU cycles.
         */

        const cyclesToRun =
            Math.floor(
                this.clockSpeed *
                (elapsed / 1000)
            );


        this.runCycles(
            cyclesToRun
        );


        /*
         * FPS
         */

        this.frames++;


        if (
            timestamp -
            this.fpsTime >=
            1000
        ) {

            this.fps =
                this.frames;

            this.frames =
                0;

            this.fpsTime =
                timestamp;


            this.updateFPS();

        }

    }


    /*
     * ========================================================
     * RUN CPU CYCLES
     * ========================================================
     */

    runCycles(targetCycles) {

        let executed =
            0;


        /*
         * Safety limit.
         */

        const maxCycles =
            Math.min(
                targetCycles,
                100000
            );


        while (
            executed <
            maxCycles
        ) {

            const cycles =
                this.stepCPU();


            if (
                !cycles ||
                cycles < 1
            ) {

                /*
                 * Prevent an infinite loop
                 * if CPU is not implemented yet.
                 */

                executed++;

            } else {

                executed +=
                    cycles;

            }


            /*
             * Update hardware with
             * the same number of cycles.
             */

            const usedCycles =
                cycles || 1;


            this.stepHardware(
                usedCycles
            );


            this.cycles +=
                usedCycles;

        }

    }


    /*
     * ========================================================
     * CPU STEP
     * ========================================================
     */

    stepCPU() {

        if (
            typeof this.cpu.step ===
            "function"
        ) {

            return this.cpu.step();

        }


        if (
            typeof this.cpu.clock ===
            "function"
        ) {

            return this.cpu.clock();

        }


        if (
            typeof this.cpu.executeInstruction ===
            "function"
        ) {

            return this.cpu.executeInstruction();

        }


        /*
         * CPU not ready yet.
         */

        return 1;

    }


    /*
     * ========================================================
     * HARDWARE STEP
     * ========================================================
     */

    stepHardware(cycles) {


        /*
         * Timer
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


        /*
         * PPU
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
         * Audio
         */

        if (
            this.audio &&
            typeof this.audio.step ===
            "function"
        ) {

            this.audio.step(
                cycles
            );

        }

    }


    /*
     * ========================================================
     * RENDER
     * ========================================================
     */

    render() {

        if (
            !this.context
        ) {

            return;

        }


        /*
         * If PPU provides framebuffer,
         * use it.
         */

        if (
            this.ppu &&
            this.ppu.framebuffer
        ) {

            this.copyPPUFrame();

        }


        if (
            !this.frameImage
        ) {

            return;

        }


        this.frameImage.data.set(
            this.framebuffer
        );


        this.context.putImageData(
            this.frameImage,
            0,
            0
        );

    }


    /*
     * ========================================================
     * COPY PPU FRAME
     * ========================================================
     */

    copyPPUFrame() {

        const source =
            this.ppu.framebuffer;


        if (
            !source
        ) {

            return;

        }


        /*
         * Uint32 / Uint8 framebuffer
         * compatibility.
         */

        if (
            source.length ===
            this.framebuffer.length
        ) {

            this.framebuffer.set(
                source
            );

        }

    }


    /*
     * ========================================================
     * FPS CALLBACK
     * ========================================================
     */

    updateFPS() {

        if (
            typeof this.onFPS ===
            "function"
        ) {

            this.onFPS(
                this.fps
            );

        }

    }


    /*
     * ========================================================
     * ROM INFORMATION
     * ========================================================
     */

    getROMInfo() {

        if (
            this.cartridge &&
            typeof this.cartridge.getInfo ===
            "function"
        ) {

            return this.cartridge.getInfo();

        }


        if (
            this.cartridge &&
            this.cartridge.header
        ) {

            return this.cartridge.header;

        }


        return null;

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

            cycles:
                this.cycles,

            fps:
                this.fps,

            cpu:
                this.cpu &&
                typeof this.cpu.getState ===
                "function"
                    ? this.cpu.getState()
                    : null,

            memory:
                this.memory.getState(),

            rom:
                this.getROMInfo()

        };

    }

}
