/*
 * ============================================================
 * WebBktx — Game Boy Emulator Core
 * emulator.js
 * ============================================================
 *
 * Main integration layer:
 *
 *   CPU
 *   Memory
 *   Cartridge
 *   PPU
 *   Timer
 *   Input
 *   Audio
 *
 * Compatible with the current WebBktx architecture.
 *
 * ============================================================
 */

import CPU from "./cpu.js";
import GameBoyMemory from "./memory.js";
import PPU from "./ppu.js";
import Cartridge from "./cartridge.js";
import Timer from "./timer.js";
import Input from "./input.js";
import Audio from "./audio.js";


export default class GameBoyEmulator {

    constructor(options = {}) {

        this.options = options;


        /*
         * ----------------------------------------------------
         * Components
         * ----------------------------------------------------
         */

        this.cpu = null;
        this.memory = null;
        this.ppu = null;
        this.cartridge = null;
        this.timer = null;
        this.input = null;
        this.audio = null;


        /*
         * ----------------------------------------------------
         * Canvas
         * ----------------------------------------------------
         */

        this.canvas = null;
        this.context = null;


        /*
         * ----------------------------------------------------
         * Emulator state
         * ----------------------------------------------------
         */

        this.running = false;
        this.paused = true;
        this.romLoaded = false;


        /*
         * ----------------------------------------------------
         * Timing
         * ----------------------------------------------------
         */

        this.clockHz = 4194304;

        this.frameRate = 59.7275;

        this.cyclesPerFrame =
            Math.round(
                this.clockHz /
                this.frameRate
            );


        this.cycleAccumulator = 0;

        this.lastTime = 0;

        this.animationFrame = null;


        /*
         * ----------------------------------------------------
         * Statistics
         * ----------------------------------------------------
         */

        this.frameCount = 0;

        this.totalCycles = 0;

        this.fps = 0;

        this.fpsFrames = 0;

        this.fpsTime = 0;


        /*
         * ----------------------------------------------------
         * ROM information
         * ----------------------------------------------------
         */

        this.romName = "";

        this.romSize = 0;

        this.ramSize = 0;

        this.mbc = "—";

        this.title = "—";


        /*
         * ----------------------------------------------------
         * Debug / callbacks
         * ----------------------------------------------------
         */

        this.logs = [];

        this.onFrame = null;

        this.onStateChange = null;


        /*
         * ----------------------------------------------------
         * Create hardware
         * ----------------------------------------------------
         */

        this.createHardware();


        /*
         * ----------------------------------------------------
         * Initial log
         * ----------------------------------------------------
         */

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
         * Cartridge.
         */

        try {

            this.cartridge =
                new Cartridge();

        } catch (error) {

            this.cartridge =
                null;

        }


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

        try {

            this.timer =
                new Timer();

        } catch (error) {

            this.timer =
                null;

        }


        /*
         * Input.
         */

        try {

            this.input =
                new Input();

        } catch (error) {

            this.input =
                null;

        }


        /*
         * Audio.
         */

        try {

            this.audio =
                new Audio();

        } catch (error) {

            this.audio =
                null;

        }


        /*
         * CPU.
         */

        this.cpu =
            new CPU(
                this.memory
            );


        /*
         * Connect components.
         */

        this.connectHardware();

    }


    /*
     * ========================================================
     * CONNECT HARDWARE
     * ========================================================
     */

    connectHardware() {

        /*
         * Memory → Cartridge.
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


        /*
         * Memory → PPU.
         */

        if (
            this.memory &&
            this.ppu &&
            typeof this.memory.connectPPU ===
            "function"
        ) {

            this.memory.connectPPU(
                this.ppu
            );

        }


        /*
         * Memory → Timer.
         */

        if (
            this.memory &&
            this.timer &&
            typeof this.memory.connectTimer ===
            "function"
        ) {

            this.memory.connectTimer(
                this.timer
            );

        }


        /*
         * Memory → Input.
         */

        if (
            this.memory &&
            this.input &&
            typeof this.memory.connectInput ===
            "function"
        ) {

            this.memory.connectInput(
                this.input
            );

        }


        /*
         * Memory → Audio.
         */

        if (
            this.memory &&
            this.audio &&
            typeof this.memory.connectAudio ===
            "function"
        ) {

            this.memory.connectAudio(
                this.audio
            );

        }


        /*
         * PPU connection.
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
         * CPU connection.
         */

        this.connectCPU();


        /*
         * Timer connection.
         */

        if (
            this.timer &&
            typeof this.timer.connect ===
            "function"
        ) {

            this.timer.connect({

                memory:
                    this.memory,

                cpu:
                    this.cpu

            });

        }


        /*
         * Input connection.
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
         * Audio connection.
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
     * CONNECT CPU
     * ========================================================
     */

    connectCPU() {

        if (
            !this.cpu
        ) {

            return;

        }


        const connection = {

            memory:
                this.memory,

            ppu:
                this.ppu,

            timer:
                this.timer,

            input:
                this.input,

            audio:
                this.audio

        };


        if (
            typeof this.cpu.connect ===
            "function"
        ) {

            this.cpu.connect(
                connection
            );

            return;

        }


        /*
         * Fallback for simpler CPU implementations.
         */

        if (
            "memory" in this.cpu
        ) {

            this.cpu.memory =
                this.memory;

        }

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

            this.context =
                null;

            return;

        }


        canvas.width =
            160;

        canvas.height =
            144;


        this.context =
            canvas.getContext(
                "2d",
                {
                    alpha: false
                }
            );


        if (
            this.context
        ) {

            this.context.imageSmoothingEnabled =
                false;

        }


        /*
         * Give PPU the canvas.
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


        this.log(
            "Canvas podłączony."
        );

    }


    /*
     * ========================================================
     * SET CANVAS
     * ========================================================
     */

    setCanvas(
        canvas
    ) {

        this.attachCanvas(
            canvas
        );

    }


    /*
     * ========================================================
     * LOAD ROM
     * ========================================================
     */

    async loadROM(
        source
    ) {

        try {

            this.pause();


            let data = null;

            let fileName =
                "game.gb";


            /*
             * ------------------------------------------------
             * File object
             * ------------------------------------------------
             */

            if (
                source instanceof File
            ) {

                fileName =
                    source.name;

                data =
                    new Uint8Array(
                        await source.arrayBuffer()
                    );

            }


            /*
             * ------------------------------------------------
             * ArrayBuffer
             * ------------------------------------------------
             */

            else if (
                source instanceof ArrayBuffer
            ) {

                data =
                    new Uint8Array(
                        source
                    );

            }


            /*
             * ------------------------------------------------
             * Uint8Array
             * ------------------------------------------------
             */

            else if (
                source instanceof Uint8Array
            ) {

                data =
                    source;

            }


            /*
             * ------------------------------------------------
             * URL / string
             * ------------------------------------------------
             */

            else if (
                typeof source ===
                "string"
            ) {

                fileName =
                    source
                    .split("/")
                    .pop() ||
                    "game.gb";


                const response =
                    await fetch(
                        source
                    );


                if (
                    !response.ok
                ) {

                    throw new Error(
                        "HTTP " +
                        response.status
                    );

                }


                data =
                    new Uint8Array(
                        await response.arrayBuffer()
                    );

            }


            if (
                !data ||
                data.length <
                0x150
            ) {

                throw new Error(
                    "ROM jest pusta albo zbyt mała."
                );

            }


            this.log(
                "Ładowanie: " +
                fileName
            );


            /*
             * ------------------------------------------------
             * Load cartridge
             * ------------------------------------------------
             */

            let loaded =
                false;


            if (
                this.cartridge
            ) {

                if (
                    typeof this.cartridge.loadROM ===
                    "function"
                ) {

                    const result =
                        this.cartridge.loadROM(
                            data
                        );


                    loaded =
                        result !== false;

                }

                else if (
                    typeof this.cartridge.load ===
                    "function"
                ) {

                    const result =
                        this.cartridge.load(
                            data
                        );


                    loaded =
                        result !== false;

                }

                else if (
                    typeof this.cartridge.insert ===
                    "function"
                ) {

                    const result =
                        this.cartridge.insert(
                            data
                        );


                    loaded =
                        result !== false;

                }

            }


            /*
             * If cartridge API didn't return anything,
             * inspect whether ROM was actually installed.
             */

            if (
                !loaded &&
                this.cartridge
            ) {

                if (
                    this.cartridge.rom &&
                    this.cartridge.rom.length
                ) {

                    loaded =
                        true;

                }

            }


            if (
                !loaded
            ) {

                throw new Error(
                    "Cartridge nie zaakceptował ROM-u."
                );

            }


            /*
             * Reconnect cartridge after loading.
             */

            if (
                this.memory &&
                typeof this.memory.connectCartridge ===
                "function"
            ) {

                this.memory.connectCartridge(
                    this.cartridge
                );

            }


            /*
             * ------------------------------------------------
             * Read cartridge information
             * ------------------------------------------------
             */

            this.readROMInfo(
                data
            );


            /*
             * ------------------------------------------------
             * Reset hardware
             * ------------------------------------------------
             */

            this.reset(
                false
            );


            this.romLoaded =
                true;


            this.log(
                "ROM załadowany: " +
                this.title
            );


            this.log(
                "ROM gotowy do uruchomienia."
            );


            this.notifyState();


            return true;

        } catch (error) {

            console.error(
                "WebBktx ROM ERROR:",
                error
            );


            this.log(
                "Nie udało się załadować ROM-u."
            );


            this.romLoaded =
                false;


            return false;

        }

    }


    /*
     * ========================================================
     * READ ROM INFO
     * ========================================================
     */

    readROMInfo(
        data
    ) {

        /*
         * Game Boy title:
         *
         * 0134-0143
         */

        let title = "";

        for (
            let i = 0x134;
            i <= 0x143 &&
            i < data.length;
            i++
        ) {

            const c =
                data[i];


            if (
                c === 0
            ) {

                break;

            }


            if (
                c >= 32 &&
                c <= 126
            ) {

                title +=
                    String.fromCharCode(
                        c
                    );

            }

        }


        this.title =
            title.trim() ||
            "UNKNOWN";


        /*
         * Cartridge type.
         */

        const cartridgeType =
            data[0x147] ??
            0;


        this.mbc =
            this.getMBCName(
                cartridgeType
            );


        /*
         * ROM size.
         */

        this.romSize =
            data.length;


        /*
         * RAM size header.
         */

        this.ramSize =
            this.getRAMSize(
                data[0x149] ??
                0
            );


        /*
         * Store filename.
         */

        this.romName =
            this.title;

    }


    /*
     * ========================================================
     * MBC NAME
     * ========================================================
     */

    getMBCName(
        type
    ) {

        const names = {

            0x00:
                "ROM ONLY",

            0x01:
                "MBC1",

            0x02:
                "MBC1+RAM",

            0x03:
                "MBC1+RAM+BATTERY",

            0x05:
                "MBC2",

            0x06:
                "MBC2+BATTERY",

            0x08:
                "ROM+RAM",

            0x09:
                "ROM+RAM+BATTERY",

            0x0F:
                "MBC3+TIMER+BATTERY",

            0x10:
                "MBC3+TIMER+RAM+BATTERY",

            0x11:
                "MBC3",

            0x12:
                "MBC3+RAM",

            0x13:
                "MBC3+RAM+BATTERY",

            0x19:
                "MBC5",

            0x1A:
                "MBC5+RAM",

            0x1B:
                "MBC5+RAM+BATTERY",

            0x1C:
                "MBC5+RUMBLE",

            0x1D:
                "MBC5+RUMBLE+RAM",

            0x1E:
                "MBC5+RUMBLE+RAM+BATTERY",

            0x20:
                "MBC6",

            0x22:
                "MBC7",

            0xFC:
                "POCKET CAMERA",

            0xFD:
                "BANDAI TAMA5",

            0xFE:
                "HuC3",

            0xFF:
                "HuC1+RAM+BATTERY"

        };


        return (
            names[type] ||
            "MBC?"
        );

    }


    /*
     * ========================================================
     * RAM SIZE
     * ========================================================
     */

    getRAMSize(
        code
    ) {

        const sizes = {

            0x00:
                0,

            0x01:
                2 * 1024,

            0x02:
                8 * 1024,

            0x03:
                32 * 1024,

            0x04:
                128 * 1024,

            0x05:
                64 * 1024

        };


        return (
            sizes[code] ??
            0
        );

    }


    /*
     * ========================================================
     * RESET
     * ========================================================
     */

    reset(
        logMessage = true
    ) {

        this.pause();


        /*
         * Reset memory.
         */

        if (
            this.memory &&
            typeof this.memory.reset ===
            "function"
        ) {

            this.memory.reset();

        }


        /*
         * Reset cartridge controller,
         * but do not destroy loaded ROM.
         */

        if (
            this.cartridge &&
            typeof this.cartridge.reset ===
            "function"
        ) {

            try {

                this.cartridge.reset();

            } catch (error) {

                console.warn(
                    "Cartridge reset:",
                    error
                );

            }

        }


        /*
         * Reset PPU.
         */

        if (
            this.ppu &&
            typeof this.ppu.reset ===
            "function"
        ) {

            this.ppu.reset();

        }


        /*
         * Reset Timer.
         */

        if (
            this.timer &&
            typeof this.timer.reset ===
            "function"
        ) {

            this.timer.reset();

        }


        /*
         * Reset input.
         */

        if (
            this.input &&
            typeof this.input.reset ===
            "function"
        ) {

            this.input.reset();

        }


        /*
         * Reset audio.
         */

        if (
            this.audio &&
            typeof this.audio.reset ===
            "function"
        ) {

            this.audio.reset();

        }


        /*
         * Reset CPU.
         */

        if (
            this.cpu &&
            typeof this.cpu.reset ===
            "function"
        ) {

            this.cpu.reset();

        }


        /*
         * Reset timing.
         */

        this.cycleAccumulator =
            0;

        this.totalCycles =
            0;

        this.frameCount =
            0;

        this.fps =
            0;

        this.fpsFrames =
            0;

        this.fpsTime =
            performance.now();


        this.lastTime =
            performance.now();


        /*
         * Redraw.
         */

        if (
            this.ppu &&
            typeof this.ppu.render ===
            "function"
        ) {

            this.ppu.render();

        }


        if (
            logMessage
        ) {

            this.log(
                "Game Boy zresetowany."
            );

        }


        this.notifyState();

    }


    /*
     * ========================================================
     * START
     * ========================================================
     */

    start() {

        if (
            this.running
        ) {

            return;

        }


        if (
            !this.romLoaded
        ) {

            this.log(
                "Brak załadowanego ROM-u."
            );

            return;

        }


        this.running =
            true;

        this.paused =
            false;


        this.lastTime =
            performance.now();


        this.log(
            "Emulator uruchomiony."
        );


        this.log(
            "Emulator START."
        );


        this.notifyState();


        this.animationFrame =
            requestAnimationFrame(
                this.loop.bind(this)
            );

    }


    /*
     * ========================================================
     * RUN
     * ========================================================
     */

    run() {

        this.start();

    }


    /*
     * ========================================================
     * PAUSE
     * ========================================================
     */

    pause() {

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


        if (
            this.romLoaded
        ) {

            this.log(
                "Emulator PAUSE."
            );

        }


        this.notifyState();

    }


    /*
     * ========================================================
     * STOP
     * ========================================================
     */

    stop() {

        this.pause();

    }


    /*
     * ========================================================
     * LOOP
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


        /*
         * Delta time.
         */

        let delta =
            timestamp -
            this.lastTime;


        this.lastTime =
            timestamp;


        /*
         * Protect against tab switching,
         * debugger pauses etc.
         */

        if (
            delta >
            250
        ) {

            delta =
                250;

        }


        if (
            delta <
            0
        ) {

            delta =
                0;

        }


        /*
         * Convert milliseconds to CPU cycles.
         */

        this.cycleAccumulator +=
            (
                this.clockHz *
                delta /
                1000
            );


        /*
         * Execute CPU.
         */

        let cyclesToRun =
            Math.floor(
                this.cycleAccumulator
            );


        /*
         * Avoid freezing browser.
         */

        const maxCycles =
            Math.floor(
                this.clockHz *
                0.05
            );


        if (
            cyclesToRun >
            maxCycles
        ) {

            cyclesToRun =
                maxCycles;

        }


        this.cycleAccumulator -=
            cyclesToRun;


        if (
            cyclesToRun >
            0
        ) {

            this.executeCycles(
                cyclesToRun
            );

        }


        /*
         * FPS.
         */

        this.updateFPS(
            timestamp
        );


        /*
         * Render if frame available.
         */

        if (
            this.ppu &&
            typeof this.ppu.isFrameReady ===
            "function"
        ) {

            if (
                this.ppu.isFrameReady()
            ) {

                this.ppu.render();

                this.ppu.consumeFrame();

            }

        }


        /*
         * Continue.
         */

        this.animationFrame =
            requestAnimationFrame(
                this.loop.bind(this)
            );

    }


    /*
     * ========================================================
     * EXECUTE CPU CYCLES
     * ========================================================
     */

    executeCycles(
        cycles
    ) {

        let remaining =
            cycles;


        /*
         * Safety counter.
         */

        let iterations =
            0;


        const maxIterations =
            100000;


        while (
            remaining > 0 &&
            iterations < maxIterations
        ) {

            iterations++;


            let used =
                0;


            /*
             * ------------------------------------------------
             * CPU
             * ------------------------------------------------
             */

            if (
                this.cpu
            ) {

                if (
                    typeof this.cpu.step ===
                    "function"
                ) {

                    used =
                        this.cpu.step();

                }

                else if (
                    typeof this.cpu.tick ===
                    "function"
                ) {

                    used =
                        this.cpu.tick();

                }

                else if (
                    typeof this.cpu.executeInstruction ===
                    "function"
                ) {

                    used =
                        this.cpu.executeInstruction();

                }

            }


            /*
             * Some CPU implementations return undefined.
             * In that case use a normal instruction quantum.
             */

            if (
                !Number.isFinite(
                    used
                ) ||
                used <= 0
            ) {

                used =
                    4;

            }


            /*
             * Don't execute beyond requested cycles.
             */

            used =
                Math.min(
                    used,
                    remaining
                );


            remaining -=
                used;


            this.totalCycles +=
                used;


            /*
             * ------------------------------------------------
             * PPU
             * ------------------------------------------------
             */

            if (
                this.ppu &&
                typeof this.ppu.step ===
                "function"
            ) {

                this.ppu.step(
                    used
                );

            }


            /*
             * ------------------------------------------------
             * Timer
             * ------------------------------------------------
             */

            if (
                this.timer
            ) {

                if (
                    typeof this.timer.step ===
                    "function"
                ) {

                    this.timer.step(
                        used
                    );

                }

                else if (
                    typeof this.timer.tick ===
                    "function"
                ) {

                    this.timer.tick(
                        used
                    );

                }

            }


            /*
             * ------------------------------------------------
             * Audio
             * ------------------------------------------------
             */

            if (
                this.audio
            ) {

                if (
                    typeof this.audio.step ===
                    "function"
                ) {

                    this.audio.step(
                        used
                    );

                }

                else if (
                    typeof this.audio.tick ===
                    "function"
                ) {

                    this.audio.tick(
                        used
                    );

                }

            }

        }

    }


    /*
     * ========================================================
     * UPDATE FPS
     * ========================================================
     */

    updateFPS(
        timestamp
    ) {

        this.fpsFrames++;


        if (
            timestamp -
            this.fpsTime >=
            1000
        ) {

            this.fps =
                this.fpsFrames;


            this.fpsFrames =
                0;


            this.fpsTime =
                timestamp;

        }


        if (
            this.ppu
        ) {

            this.frameCount =
                this.ppu.frameCount ??
                this.frameCount;

        }

    }


    /*
     * ========================================================
     * SAVE STATE
     * ========================================================
     */

    saveState() {

        const state = {

            version:
                1,

            timestamp:
                Date.now(),

            memory:
                this.getMemoryState(),

            cpu:
                this.getComponentState(
                    this.cpu
                ),

            ppu:
                this.getComponentState(
                    this.ppu
                ),

            timer:
                this.getComponentState(
                    this.timer
                ),

            input:
                this.getComponentState(
                    this.input
                ),

            audio:
                this.getComponentState(
                    this.audio
                )

        };


        try {

            localStorage.setItem(
                "webbktx-gameboy-save",
                JSON.stringify(
                    state
                )
            );


            this.log(
                "Save zapisany."
            );


            return true;

        } catch (error) {

            console.error(
                error
            );


            this.log(
                "Nie udało się zapisać save."
            );


            return false;

        }

    }


    /*
     * ========================================================
     * LOAD STATE
     * ========================================================
     */

    loadState() {

        try {

            const raw =
                localStorage.getItem(
                    "webbktx-gameboy-save"
                );


            if (
                !raw
            ) {

                this.log(
                    "Brak zapisu."
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
                this.ppu,
                state.ppu
            );


            this.setComponentState(
                this.timer,
                state.timer
            );


            this.setComponentState(
                this.input,
                state.input
            );


            this.setComponentState(
                this.audio,
                state.audio
            );


            this.setMemoryState(
                state.memory
            );


            this.log(
                "Save wczytany."
            );


            if (
                this.ppu &&
                typeof this.ppu.render ===
                "function"
            ) {

                this.ppu.render();

            }


            return true;

        } catch (error) {

            console.error(
                error
            );


            this.log(
                "Nie udało się wczytać save."
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

            } catch (error) {

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

            } catch (error) {

                console.warn(
                    "setState:",
                    error
                );

            }

        }

    }


    /*
     * ========================================================
     * MEMORY STATE
     * ========================================================
     */

    getMemoryState() {

        if (
            !this.memory
        ) {

            return null;

        }


        if (
            typeof this.memory.getState ===
            "function"
        ) {

            return this.memory.getState();

        }


        return null;

    }


    /*
     * ========================================================
     * SET MEMORY STATE
     * ========================================================
     */

    setMemoryState(
        state
    ) {

        if (
            !this.memory ||
            !state
        ) {

            return;

        }


        if (
            typeof this.memory.setState ===
            "function"
        ) {

            this.memory.setState(
                state
            );

        }

    }


    /*
     * ========================================================
     * GET INFO
     * ========================================================
     *
     * This is required by your current index.html.
     *
     * ========================================================
     */

    getInfo() {

        const ppuState =
            this.ppu &&
            typeof this.ppu.getState ===
            "function"
                ? this.ppu.getState()
                : {};


        const cpuState =
            this.getCPUInfo();


        return {

            /*
             * ROM
             */

            title:
                this.title || "—",

            rom:
                this.romSize || 0,

            romSize:
                this.romSize || 0,

            ram:
                this.ramSize || 0,

            ramSize:
                this.ramSize || 0,

            mbc:
                this.mbc || "—",


            /*
             * Emulator
             */

            cpu:
                "LR35902",

            clock:
                this.clockHz,

            clockHz:
                this.clockHz,

            fps:
                this.fps || 0,

            frame:
                this.frameCount || 0,

            cycles:
                this.totalCycles || 0,


            /*
             * State
             */

            running:
                this.running,

            paused:
                this.paused,

            romLoaded:
                this.romLoaded,


            /*
             * PPU
             */

            ppu:
                ppuState,

            mode:
                ppuState.mode ??
                0,

            ly:
                ppuState.ly ??
                0,


            /*
             * CPU debug
             */

            cpuState:
                cpuState

        };

    }


    /*
     * ========================================================
     * CPU INFO
     * ========================================================
     */

    getCPUInfo() {

        if (
            !this.cpu
        ) {

            return {};

        }


        if (
            typeof this.cpu.getState ===
            "function"
        ) {

            try {

                return this.cpu.getState();

            } catch (error) {

                return {};

            }

        }


        return {

            pc:
                this.cpu.pc ??
                this.cpu.PC ??
                0,

            sp:
                this.cpu.sp ??
                this.cpu.SP ??
                0

        };

    }


    /*
     * ========================================================
     * GET STATUS
     * ========================================================
     */

    getStatus() {

        if (
            !this.romLoaded
        ) {

            return "Brak ROM";

        }


        if (
            this.running
        ) {

            return "Uruchomiony";

        }


        return "Pauza";

    }


    /*
     * ========================================================
     * IS RUNNING
     * ========================================================
     */

    isRunning() {

        return this.running;

    }


    /*
     * ========================================================
     * IS ROM LOADED
     * ========================================================
     */

    isROMLoaded() {

        return this.romLoaded;

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
                .toLocaleTimeString(
                    "pl-PL"
                );


        const line =
            `[${time}] ${message}`;


        this.logs.push(
            line
        );


        /*
         * Keep log manageable.
         */

        if (
            this.logs.length >
            200
        ) {

            this.logs.shift();

        }


        console.log(
            "[WebBktx]",
            message
        );


        if (
            typeof this.options.onLog ===
            "function"
        ) {

            this.options.onLog(
                line
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
     * STATE CALLBACK
     * ========================================================
     */

    notifyState() {

        if (
            typeof this.onStateChange ===
            "function"
        ) {

            try {

                this.onStateChange(
                    this.getInfo()
                );

            } catch (error) {

                console.warn(
                    "onStateChange:",
                    error
                );

            }

        }

    }


    /*
     * ========================================================
     * SET FRAME CALLBACK
     * ========================================================
     */

    setFrameCallback(
        callback
    ) {

        this.onFrame =
            typeof callback ===
            "function"
                ? callback
                : null;

    }


    /*
     * ========================================================
     * GET CANVAS
     * ========================================================
     */

    getCanvas() {

        return this.canvas;

    }


    /*
     * ========================================================
     * FULLSCREEN
     * ========================================================
     */

    async fullscreen() {

        if (
            !this.canvas
        ) {

            return false;

        }


        try {

            if (
                this.canvas.requestFullscreen
            ) {

                await this.canvas.requestFullscreen();

                return true;

            }

        } catch (error) {

            console.warn(
                "Fullscreen:",
                error
            );

        }


        return false;

    }


    /*
     * ========================================================
     * DESTROY
     * ========================================================
     */

    destroy() {

        this.pause();


        if (
            this.ppu &&
            typeof this.ppu.destroy ===
            "function"
        ) {

            this.ppu.destroy();

        }


        this.canvas =
            null;

        this.context =
            null;

        this.cpu =
            null;

        this.memory =
            null;

        this.ppu =
            null;

        this.cartridge =
            null;

        this.timer =
            null;

        this.input =
            null;

        this.audio =
            null;

    }

}
