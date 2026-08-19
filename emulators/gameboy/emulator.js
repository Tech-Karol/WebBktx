/*
 * ============================================================
 * WebBktx — Game Boy Emulator
 * emulator.js
 * ============================================================
 *
 * Main emulator coordinator.
 *
 * Components:
 *
 *   CPU
 *   Memory
 *   Cartridge
 *   PPU
 *   Timer
 *   Input
 *   Audio
 *
 * Target:
 *
 *   Nintendo Game Boy DMG
 *
 * CPU:
 *
 *   Sharp SM83 / LR35902
 *   4.194304 MHz
 *
 * Frame:
 *
 *   70224 clock cycles
 *   ~59.73 FPS
 *
 * ============================================================
 */

import GameBoyMemory from "./memory.js";
import PPU from "./ppu.js";
import CPU from "./cpu.js";
import Cartridge from "./cartridge.js";
import Timer from "./timer.js";
import Input from "./input.js";
import Audio from "./audio.js";


export default class GameBoyEmulator {

    constructor(options = {}) {

        /*
         * ----------------------------------------------------
         * Options
         * ----------------------------------------------------
         */

        this.options =
            options;


        /*
         * ----------------------------------------------------
         * Components
         * ----------------------------------------------------
         */

        this.memory =
            null;

        this.cpu =
            null;

        this.ppu =
            null;

        this.timer =
            null;

        this.input =
            null;

        this.audio =
            null;

        this.cartridge =
            null;


        /*
         * ----------------------------------------------------
         * Runtime
         * ----------------------------------------------------
         */

        this.running =
            false;

        this.paused =
            false;

        this.loaded =
            false;


        this.cycles =
            0;

        this.totalCycles =
            0;

        this.frameCount =
            0;


        /*
         * ----------------------------------------------------
         * Animation
         * ----------------------------------------------------
         */

        this.animationFrame =
            null;


        /*
         * ----------------------------------------------------
         * Canvas
         * ----------------------------------------------------
         */

        this.canvas =
            null;

        this.context =
            null;


        /*
         * ----------------------------------------------------
         * ROM
         * ----------------------------------------------------
         */

        this.romName =
            "";


        /*
         * ----------------------------------------------------
         * Logging
         * ----------------------------------------------------
         */

        this.logs =
            [];


        /*
         * ----------------------------------------------------
         * Performance
         * ----------------------------------------------------
         */

        this.lastTimestamp =
            0;

        this.accumulator =
            0;


        /*
         * Maximum cycles executed during
         * one browser tick.
         *
         * Prevents browser lockups if a
         * breakpoint/debugger pauses execution.
         */

        this.MAX_CYCLES_PER_TICK =
            140448;


        /*
         * ----------------------------------------------------
         * Initialize hardware
         * ----------------------------------------------------
         */

        this.createHardware();


        this.log(
            "WebBktx Game Boy gotowy."
        );

    }


    /*
     * ========================================================
     * CREATE HARDWARE
     * ========================================================
     */

    createHardware() {

        /*
         * Memory first.
         */

        this.memory =
            new GameBoyMemory();


        /*
         * PPU.
         */

        this.ppu =
            new PPU(
                this.memory
            );


        /*
         * Timer.
         */

        this.timer =
            new Timer(
                this.memory
            );


        /*
         * Input.
         */

        this.input =
            new Input(
                this.memory
            );


        /*
         * Audio.
         */

        this.audio =
            new Audio(
                this.memory
            );


        /*
         * CPU.
         */

        this.cpu =
            new CPU(
                this.memory
            );


        /*
         * Connect memory to hardware.
         */

        if (
            typeof this.memory.connectPPU ===
            "function"
        ) {

            this.memory.connectPPU(
                this.ppu
            );

        }


        if (
            typeof this.memory.connectTimer ===
            "function"
        ) {

            this.memory.connectTimer(
                this.timer
            );

        }


        if (
            typeof this.memory.connectInput ===
            "function"
        ) {

            this.memory.connectInput(
                this.input
            );

        }


        if (
            typeof this.memory.connectAudio ===
            "function"
        ) {

            this.memory.connectAudio(
                this.audio
            );

        }


        /*
         * Connect PPU.
         */

        if (
            this.ppu &&
            typeof this.ppu.connect ===
            "function"
        ) {

            this.ppu.connect({

                memory:
                    this.memory,

                cpu:
                    this.cpu

            });

        }


        /*
         * Connect CPU.
         */

        if (
            this.cpu
        ) {

            if (
                typeof this.cpu.connectMemory ===
                "function"
            ) {

                this.cpu.connectMemory(
                    this.memory
                );

            }

            else if (
                typeof this.cpu.connect ===
                "function"
            ) {

                this.cpu.connect({

                    memory:
                        this.memory

                });

            }

        }


        /*
         * Timer.
         */

        if (
            this.timer &&
            typeof this.timer.connect ===
            "function"
        ) {

            this.timer.connect({

                memory:
                    this.memory

            });

        }


        /*
         * Input.
         */

        if (
            this.input &&
            typeof this.input.connect ===
            "function"
        ) {

            this.input.connect({

                memory:
                    this.memory

            });

        }


        /*
         * Audio.
         */

        if (
            this.audio &&
            typeof this.audio.connect ===
            "function"
        ) {

            this.audio.connect({

                memory:
                    this.memory

            });

        }

    }


    /*
     * ========================================================
     * LOG
     * ========================================================
     */

    log(
        message
    ) {

        const time =
            new Date()
                .toLocaleTimeString();


        const text =
            `[${time}] ${message}`;


        this.logs.push(
            text
        );


        /*
         * Keep log reasonably small.
         */

        if (
            this.logs.length >
            300
        ) {

            this.logs.shift();

        }


        console.log(
            `[WebBktx] ${message}`
        );


        /*
         * Optional external callback.
         */

        if (
            typeof this.options.onLog ===
            "function"
        ) {

            this.options.onLog(
                text
            );

        }

    }


    /*
     * ========================================================
     * GET LOG
     * ========================================================
     */

    getLog() {

        return [
            ...this.logs
        ];

    }


    /*
     * ========================================================
     * CANVAS
     * ========================================================
     */

    attachCanvas(
        canvas
    ) {

        this.canvas =
            canvas;


        if (
            !canvas
        ) {

            return false;

        }


        /*
         * PPU owns the actual framebuffer.
         */

        if (
            this.ppu &&
            typeof this.ppu.attachCanvas ===
            "function"
        ) {

            this.ppu.attachCanvas(
                canvas
            );

        }


        this.context =
            canvas.getContext(
                "2d",
                {
                    alpha:
                        false
                }
            );


        if (
            this.context
        ) {

            this.context.imageSmoothingEnabled =
                false;

        }


        this.log(
            "Canvas podłączony."
        );


        return true;

    }


    /*
     * ========================================================
     * CONNECT CANVAS ALIAS
     * ========================================================
     */

    connectCanvas(
        canvas
    ) {

        return this.attachCanvas(
            canvas
        );

    }


    /*
     * ========================================================
     * LOAD ROM
     * ========================================================
     */

    async loadROM(
        input
    ) {

        this.log(
            "Ładowanie: " +
            (
                input?.name ??
                "ROM"
            )
        );


        try {

            /*
             * Stop emulator before replacing
             * cartridge.
             */

            this.stop(
                false
            );


            /*
             * Read File.
             */

            let data;


            if (
                input instanceof File
            ) {

                data =
                    new Uint8Array(
                        await input.arrayBuffer()
                    );

                this.romName =
                    input.name;

            }

            else if (
                input instanceof ArrayBuffer
            ) {

                data =
                    new Uint8Array(
                        input
                    );

                this.romName =
                    "game.gb";

            }

            else if (
                input instanceof Uint8Array
            ) {

                data =
                    input;

                this.romName =
                    "game.gb";

            }

            else if (
                input?.arrayBuffer
            ) {

                data =
                    new Uint8Array(
                        await input.arrayBuffer()
                    );

                this.romName =
                    input.name ??
                    "game.gb";

            }

            else {

                throw new Error(
                    "Nieprawidłowy ROM."
                );

            }


            if (
                data.length <
                0x150
            ) {

                throw new Error(
                    "ROM jest za mały."
                );

            }


            /*
             * Cartridge.
             */

            this.cartridge =
                new Cartridge(
                    data
                );


            /*
             * Connect cartridge.
             */

            if (
                typeof this.memory.connectCartridge ===
                "function"
            ) {

                this.memory.connectCartridge(
                    this.cartridge
                );

            }


            /*
             * Reset hardware.
             *
             * Cartridge remains connected.
             */

            this.resetHardware();


            /*
             * Mark ROM loaded.
             */

            this.loaded =
                true;


            const title =
                this.getCartridgeTitle();


            this.log(
                "ROM załadowany: " +
                title
            );


            this.log(
                "ROM gotowy do uruchomienia."
            );


            return true;

        } catch (
            error
        ) {

            this.loaded =
                false;


            console.error(
                "[WebBktx] ROM ERROR:",
                error
            );


            this.log(
                "Nie udało się załadować: " +
                error.message
            );


            return false;

        }

    }


    /*
     * ========================================================
     * LOAD ROM ALIASES
     * ========================================================
     */

    async loadFile(
        file
    ) {

        return this.loadROM(
            file
        );

    }


    async loadFromFile(
        file
    ) {

        return this.loadROM(
            file
        );

    }


    /*
     * ========================================================
     * RESET HARDWARE
     * ========================================================
     */

    resetHardware() {

        /*
         * CPU.
         */

        if (
            this.cpu &&
            typeof this.cpu.reset ===
            "function"
        ) {

            this.cpu.reset();

        }


        /*
         * Memory.
         */

        if (
            this.memory &&
            typeof this.memory.reset ===
            "function"
        ) {

            this.memory.reset();

        }


        /*
         * PPU.
         */

        if (
            this.ppu &&
            typeof this.ppu.reset ===
            "function"
        ) {

            this.ppu.reset();

        }


        /*
         * Timer.
         */

        if (
            this.timer &&
            typeof this.timer.reset ===
            "function"
        ) {

            this.timer.reset();

        }


        /*
         * Input.
         */

        if (
            this.input &&
            typeof this.input.reset ===
            "function"
        ) {

            this.input.reset();

        }


        /*
         * Audio.
         */

        if (
            this.audio &&
            typeof this.audio.reset ===
            "function"
        ) {

            this.audio.reset();

        }


        /*
         * Counters.
         */

        this.cycles =
            0;

        this.totalCycles =
            0;

        this.frameCount =
            0;


        this.accumulator =
            0;


        /*
         * Cartridge must remain connected.
         */

        if (
            this.memory &&
            this.cartridge &&
            typeof this.memory.connectCartridge ===
            "function"
        ) {

            this.memory.connectCartridge(
                this.cartridge
            );

        }

    }


    /*
     * ========================================================
     * RESET
     * ========================================================
     */

    reset() {

        const wasRunning =
            this.running;


        this.stop(
            false
        );


        this.resetHardware();


        this.log(
            "Game Boy zresetowany."
        );


        if (
            wasRunning
        ) {

            this.start();

        }

    }


    /*
     * ========================================================
     * START
     * ========================================================
     */

    start() {

        if (
            !this.loaded
        ) {

            this.log(
                "Brak załadowanego ROM-u."
            );

            return false;

        }


        if (
            this.running
        ) {

            return true;

        }


        this.running =
            true;

        this.paused =
            false;


        this.lastTimestamp =
            performance.now();


        this.log(
            "Emulator uruchomiony."
        );


        this.log(
            "Emulator START."
        );


        this.animationFrame =
            requestAnimationFrame(
                this.loop.bind(
                    this
                )
            );


        return true;

    }


    /*
     * ========================================================
     * PAUSE
     * ========================================================
     */

    pause() {

        if (
            !this.running
        ) {

            return;

        }


        this.running =
            false;

        this.paused =
            true;


        if (
            this.animationFrame !==
            null
        ) {

            cancelAnimationFrame(
                this.animationFrame
            );

            this.animationFrame =
                null;

        }


        this.log(
            "Emulator PAUSE."
        );

    }


    /*
     * ========================================================
     * STOP
     * ========================================================
     */

    stop(
        writeLog = true
    ) {

        this.running =
            false;

        this.paused =
            false;


        if (
            this.animationFrame !==
            null
        ) {

            cancelAnimationFrame(
                this.animationFrame
            );

            this.animationFrame =
                null;

        }


        if (
            writeLog
        ) {

            this.log(
                "Emulator zatrzymany."
            );

        }

    }


    /*
     * ========================================================
     * MAIN LOOP
     * ========================================================
     */

    loop(
        timestamp
    ) {

        if (
            !this.running
        ) {

            return;

        }


        let elapsed =
            timestamp -
            this.lastTimestamp;


        this.lastTimestamp =
            timestamp;


        /*
         * Browser tab can sleep for seconds.
         *
         * Never try to emulate all those seconds.
         */

        if (
            elapsed >
            250
        ) {

            elapsed =
                250;

        }


        /*
         * Convert real time to GB clock.
         *
         * 4.194304 MHz.
         */

        this.accumulator +=
            elapsed *
            4194.304;


        let cycles =
            Math.floor(
                this.accumulator
            );


        this.accumulator -=
            cycles;


        /*
         * Prevent runaway execution.
         */

        cycles =
            Math.min(
                cycles,
                this.MAX_CYCLES_PER_TICK
            );


        this.runCycles(
            cycles
        );


        /*
         * Draw framebuffer.
         */

        if (
            this.ppu &&
            typeof this.ppu.render ===
            "function"
        ) {

            this.ppu.render();

        }


        this.animationFrame =
            requestAnimationFrame(
                this.loop.bind(
                    this
                )
            );

    }


    /*
     * ========================================================
     * RUN CYCLES
     * ========================================================
     */

    runCycles(
        cycles
    ) {

        let remaining =
            Math.max(
                0,
                cycles | 0
            );


        while (
            remaining >
            0 &&
            this.running
        ) {

            let cpuCycles =
                4;


            /*
             * CPU is the master clock.
             */

            if (
                this.cpu &&
                typeof this.cpu.step ===
                "function"
            ) {

                const result =
                    this.cpu.step();


                /*
                 * CPU implementations sometimes
                 * return undefined.
                 *
                 * In that case use 4 clocks.
                 */

                if (
                    Number.isFinite(
                        result
                    ) &&
                    result > 0
                ) {

                    cpuCycles =
                        result;

                }

            }


            /*
             * PPU.
             */

            if (
                this.ppu &&
                typeof this.ppu.step ===
                "function"
            ) {

                this.ppu.step(
                    cpuCycles
                );

            }


            /*
             * Timer.
             */

            if (
                this.timer &&
                typeof this.timer.step ===
                "function"
            ) {

                this.timer.step(
                    cpuCycles
                );

            }


            /*
             * Audio.
             */

            if (
                this.audio &&
                typeof this.audio.step ===
                "function"
            ) {

                this.audio.step(
                    cpuCycles
                );

            }


            this.cycles +=
                cpuCycles;

            this.totalCycles =
                this.cycles;


            remaining -=
                cpuCycles;


            /*
             * Frame counter.
             *
             * PPU is authoritative when available.
             */

            if (
                this.ppu &&
                Number.isFinite(
                    this.ppu.frameCount
                )
            ) {

                this.frameCount =
                    this.ppu.frameCount;

            }

        }

    }


    /*
     * ========================================================
     * GET CARTRIDGE TITLE
     * ========================================================
     */

    getCartridgeTitle() {

        if (
            !this.cartridge
        ) {

            return "—";

        }


        return (
            this.cartridge.title ??
            this.cartridge.romTitle ??
            this.cartridge.name ??
            "UNKNOWN"
        );

    }


    /*
     * ========================================================
     * GET INFO
     * ========================================================
     */

    getInfo() {

        const cart =
            this.cartridge;


        let romSize =
            0;

        let ramSize =
            0;


        if (
            cart
        ) {

            romSize =
                cart.rom?.length ??
                cart.romSize ??
                0;


            ramSize =
                cart.ram?.length ??
                cart.ramSize ??
                0;

        }


        return {

            cpu: {

                name:
                    "LR35902",

                clock:
                    4194304

            },


            fps:
                59.73,


            frame:
                this.ppu?.frameCount ??
                this.frameCount ??
                0,


            cycles:
                this.totalCycles ??
                0,


            running:
                this.running,


            paused:
                this.paused,


            loaded:
                this.loaded,


            rom: {

                title:
                    this.getCartridgeTitle(),

                mbc:
                    cart?.mbcType ??
                    cart?.mbc ??
                    cart?.mapper ??
                    "—",

                romSize,

                ramSize,

                romBank:
                    cart?.romBank ??
                    cart?.currentROMBank ??
                    1

            }

        };

    }


    /*
     * ========================================================
     * GET STATE
     * ========================================================
     */

    getState() {

        return {

            running:
                this.running,

            paused:
                this.paused,

            loaded:
                this.loaded,

            cycles:
                this.totalCycles,

            frame:
                this.frameCount,

            romName:
                this.romName

        };

    }


    /*
     * ========================================================
     * SAVE GAME
     * ========================================================
     */

    saveGame() {

        if (
            !this.cartridge
        ) {

            return false;

        }


        try {

            let data =
                null;


            if (
                typeof this.cartridge.getSaveData ===
                "function"
            ) {

                data =
                    this.cartridge.getSaveData();

            }

            else if (
                this.cartridge.ram
            ) {

                data =
                    this.cartridge.ram;

            }


            if (
                !data
            ) {

                return false;

            }


            const array =
                Array.from(
                    data
                );


            localStorage.setItem(
                "webbktx_gameboy_save",
                JSON.stringify(
                    array
                )
            );


            this.log(
                "Save zapisany."
            );


            return true;

        } catch (
            error
        ) {

            console.error(
                "[WebBktx] Save error:",
                error
            );


            return false;

        }

    }


    /*
     * ========================================================
     * LOAD GAME
     * ========================================================
     */

    loadGame() {

        if (
            !this.cartridge
        ) {

            return false;

        }


        try {

            const raw =
                localStorage.getItem(
                    "webbktx_gameboy_save"
                );


            if (
                !raw
            ) {

                this.log(
                    "Brak zapisu gry."
                );

                return false;

            }


            const array =
                Uint8Array.from(
                    JSON.parse(
                        raw
                    )
                );


            if (
                typeof this.cartridge.loadSaveData ===
                "function"
            ) {

                this.cartridge.loadSaveData(
                    array
                );

            }

            else if (
                this.cartridge.ram
            ) {

                this.cartridge.ram.set(
                    array.subarray(
                        0,
                        this.cartridge.ram.length
                    )
                );

            }

            else {

                return false;

            }


            this.log(
                "Save wczytany."
            );


            return true;

        } catch (
            error
        ) {

            console.error(
                "[WebBktx] Load save error:",
                error
            );


            return false;

        }

    }


    /*
     * ========================================================
     * SAVE STATE
     * ========================================================
     *
     * This is emulator state, not Pokémon battery RAM.
     *
     * ========================================================
     */

    saveToStorage() {

        try {

            const state = {

                version:
                    1,

                timestamp:
                    Date.now(),

                cpu:
                    this.getComponentState(
                        this.cpu
                    ),

                memory:
                    this.getComponentState(
                        this.memory
                    ),

                ppu:
                    this.getComponentState(
                        this.ppu
                    ),

                timer:
                    this.getComponentState(
                        this.timer
                    )

            };


            localStorage.setItem(
                "webbktx_gameboy_state",
                JSON.stringify(
                    state
                )
            );


            this.log(
                "Stan emulatora zapisany."
            );


            return true;

        } catch (
            error
        ) {

            console.error(
                "[WebBktx] State save error:",
                error
            );


            return false;

        }

    }


    /*
     * ========================================================
     * LOAD STATE
     * ========================================================
     */

    loadFromStorage() {

        try {

            const raw =
                localStorage.getItem(
                    "webbktx_gameboy_state"
                );


            if (
                !raw
            ) {

                this.log(
                    "Brak zapisanego stanu."
                );

                return false;

            }


            const state =
                JSON.parse(
                    raw
                );


            this.setComponentState(
                this.cpu,
                state.cpu
            );


            this.setComponentState(
                this.memory,
                state.memory
            );


            this.setComponentState(
                this.ppu,
                state.ppu
            );


            this.setComponentState(
                this.timer,
                state.timer
            );


            this.log(
                "Stan emulatora wczytany."
            );


            return true;

        } catch (
            error
        ) {

            console.error(
                "[WebBktx] State load error:",
                error
            );


            return false;

        }

    }


    /*
     * ========================================================
     * COMPONENT STATE
     * ========================================================
     */

    getComponentState(
        component
    ) {

        if (
            !component
        ) {

            return null;

        }


        if (
            typeof component.getState ===
            "function"
        ) {

            try {

                return component.getState();

            } catch {

                return null;

            }

        }


        return null;

    }


    /*
     * ========================================================
     * SET COMPONENT STATE
     * ========================================================
     */

    setComponentState(
        component,
        state
    ) {

        if (
            !component ||
            !state
        ) {

            return;

        }


        if (
            typeof component.setState ===
            "function"
        ) {

            try {

                component.setState(
                    state
                );

            } catch (
                error
            ) {

                console.warn(
                    "[WebBktx] Nie można przywrócić stanu:",
                    error
                );

            }

        }

    }


    /*
     * ========================================================
     * HAS SAVE
     * ========================================================
     */

    hasSave() {

        try {

            return Boolean(
                localStorage.getItem(
                    "webbktx_gameboy_save"
                )
            );

        } catch {

            return false;

        }

    }


    /*
     * ========================================================
     * DELETE SAVE
     * ========================================================
     */

    deleteSave() {

        try {

            localStorage.removeItem(
                "webbktx_gameboy_save"
            );


            return true;

        } catch {

            return false;

        }

    }


    /*
     * ========================================================
     * GET FRAMEBUFFER
     * ========================================================
     */

    getFrameBuffer() {

        if (
            this.ppu &&
            typeof this.ppu.getFrameBuffer ===
            "function"
        ) {

            return this.ppu.getFrameBuffer();

        }


        return null;

    }


    /*
     * ========================================================
     * GET PPU
     * ========================================================
     */

    getPPU() {

        return this.ppu;

    }


    /*
     * ========================================================
     * GET CPU
     * ========================================================
     */

    getCPU() {

        return this.cpu;

    }


    /*
     * ========================================================
     * GET MEMORY
     * ========================================================
     */

    getMemory() {

        return this.memory;

    }


    /*
     * ========================================================
     * GET CARTRIDGE
     * ========================================================
     */

    getCartridge() {

        return this.cartridge;

    }


    /*
     * ========================================================
     * DESTROY
     * ========================================================
     */

    destroy() {

        this.stop(
            false
        );


        if (
            this.ppu &&
            typeof this.ppu.destroy ===
            "function"
        ) {

            this.ppu.destroy();

        }


        this.cpu =
            null;

        this.memory =
            null;

        this.ppu =
            null;

        this.timer =
            null;

        this.input =
            null;

        this.audio =
            null;

        this.cartridge =
            null;

        this.canvas =
            null;

        this.context =
            null;

    }

}
