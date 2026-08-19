/*
 * ============================================================
 * WebBktx — Game Boy Emulator
 * emulator.js
 * ============================================================
 *
 * Main Game Boy DMG emulator controller.
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
 * Display:
 *
 *   160 × 144
 *
 * CPU:
 *
 *   Sharp LR35902
 *   4.194304 MHz
 *
 * ============================================================
 */

import GameBoyMemory from "./memory.js";
import CPU from "./cpu.js";
import PPU from "./ppu.js";
import Cartridge from "./cartridge.js";

import Timer from "./timer.js";
import Input from "./input.js";
import Audio from "./audio.js";


export default class GameBoyEmulator {

    constructor(options = {}) {

        /*
         * ----------------------------------------------------
         * OPTIONS
         * ----------------------------------------------------
         */

        this.options =
            options || {};


        /*
         * ----------------------------------------------------
         * CORE COMPONENTS
         * ----------------------------------------------------
         */

        this.memory =
            new GameBoyMemory();

        this.cpu =
            new CPU();

        this.ppu =
            new PPU(this.memory);

        this.timer =
            new Timer();

        this.input =
            new Input();

        this.audio =
            new Audio();


        this.cartridge =
            null;


        /*
         * ----------------------------------------------------
         * STATE
         * ----------------------------------------------------
         */

        this.running =
            false;

        this.paused =
            true;

        this.started =
            false;

        this.destroyed =
            false;


        /*
         * ----------------------------------------------------
         * TIMING
         * ----------------------------------------------------
         */

        this.clock =
            4194304;

        this.fps =
            59.73;

        this.cycles =
            0;

        this.frame =
            0;


        /*
         * ----------------------------------------------------
         * LOOP
         * ----------------------------------------------------
         */

        this.animationFrame =
            null;

        this.lastTime =
            0;

        this.accumulator =
            0;

        this.frameTime =
            1000 /
            this.fps;


        /*
         * ----------------------------------------------------
         * CANVAS
         * ----------------------------------------------------
         */

        this.canvas =
            null;

        this.context =
            null;


        /*
         * ----------------------------------------------------
         * DEBUG
         * ----------------------------------------------------
         */

        this.logs =
            [];

        this.maxLogs =
            200;


        /*
         * ----------------------------------------------------
         * CONNECT COMPONENTS
         * ----------------------------------------------------
         */

        this.connectComponents();


        /*
         * ----------------------------------------------------
         * INITIAL RESET
         * ----------------------------------------------------
         */

        this.reset();


        this.log(
            "WebBktx Game Boy gotowy."
        );

    }


    /*
     * ========================================================
     * LOG
     * ========================================================
     */

    log(message) {

        const text =
            `[WebBktx] ${message}`;

        this.logs.push(
            {
                time:
                    new Date().toLocaleTimeString(),

                message:
                    text
            }
        );


        if (
            this.logs.length >
            this.maxLogs
        ) {

            this.logs.shift();

        }


        console.log(
            text
        );


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
     * CONNECT COMPONENTS
     * ========================================================
     */

    connectComponents() {

        /*
         * MEMORY → CARTRIDGE
         */

        this.memory.connectCartridge(
            this.cartridge
        );


        /*
         * MEMORY → PPU
         */

        this.memory.connectPPU(
            this.ppu
        );


        /*
         * MEMORY → TIMER
         */

        this.memory.connectTimer(
            this.timer
        );


        /*
         * MEMORY → INPUT
         */

        this.memory.connectInput(
            this.input
        );


        /*
         * MEMORY → AUDIO
         */

        this.memory.connectAudio(
            this.audio
        );


        /*
         * PPU
         */

        if (
            this.ppu &&
            typeof this.ppu.connect ===
            "function"
        ) {

            this.ppu.connect(
                {
                    memory:
                        this.memory,

                    cpu:
                        this.cpu
                }
            );

        }


        /*
         * CPU
         */

        this.connectCPU();

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


        /*
         * Most emulator CPU implementations
         * expose a memory/bus property.
         */

        this.cpu.memory =
            this.memory;

        this.cpu.bus =
            this.memory;


        if (
            typeof this.cpu.connectMemory ===
            "function"
        ) {

            this.cpu.connectMemory(
                this.memory
            );

        }


        if (
            typeof this.cpu.connectBus ===
            "function"
        ) {

            this.cpu.connectBus(
                this.memory
            );

        }


        if (
            typeof this.cpu.connect ===
            "function"
        ) {

            this.cpu.connect(
                {
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
                }
            );

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


        /*
         * Game Boy native resolution.
         */

        canvas.width =
            160;

        canvas.height =
            144;


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


        /*
         * Connect directly to PPU.
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
     * LOAD ROM
     * ========================================================
     */

    async loadROM(
        source,
        filename = "game.gb"
    ) {

        try {

            this.stop();


            this.log(
                `Ładowanie: ${filename}`
            );


            /*
             * ------------------------------------------------
             * Convert source to Uint8Array
             * ------------------------------------------------
             */

            let data;


            if (
                source instanceof
                Uint8Array
            ) {

                data =
                    source;

            } else if (
                source instanceof
                ArrayBuffer
            ) {

                data =
                    new Uint8Array(
                        source
                    );

            } else if (
                source instanceof
                Blob
            ) {

                const buffer =
                    await source.arrayBuffer();

                data =
                    new Uint8Array(
                        buffer
                    );

            } else if (
                source instanceof
                File
            ) {

                const buffer =
                    await source.arrayBuffer();

                data =
                    new Uint8Array(
                        buffer
                    );

            } else {

                throw new Error(
                    "Nieprawidłowe źródło ROM."
                );

            }


            if (
                data.length <
                0x150
            ) {

                throw new Error(
                    "ROM jest za mały lub uszkodzony."
                );

            }


            /*
             * ------------------------------------------------
             * Cartridge
             * ------------------------------------------------
             */

            let cartridge;


            /*
             * Support multiple Cartridge APIs.
             */

            if (
                typeof Cartridge.fromROM ===
                "function"
            ) {

                cartridge =
                    await Cartridge.fromROM(
                        data
                    );

            } else {

                cartridge =
                    new Cartridge(
                        data
                    );

            }


            if (
                !cartridge
            ) {

                throw new Error(
                    "Nie udało się utworzyć cartridge."
                );

            }


            this.cartridge =
                cartridge;


            /*
             * Connect cartridge to memory.
             */

            this.memory.connectCartridge(
                cartridge
            );


            /*
             * Some cartridge implementations
             * expect ROM to be loaded separately.
             */

            if (
                typeof cartridge.loadROM ===
                "function"
            ) {

                await cartridge.loadROM(
                    data
                );

            }


            if (
                typeof cartridge.load ===
                "function" &&
                !cartridge.rom
            ) {

                await cartridge.load(
                    data
                );

            }


            /*
             * ------------------------------------------------
             * RESET HARDWARE
             * ------------------------------------------------
             */

            this.resetHardware();


            /*
             * ------------------------------------------------
             * Cartridge information
             * ------------------------------------------------
             */

            const info =
                this.getCartridgeInfo();


            this.log(
                `ROM załadowany: ${info.title}`
            );


            this.log(
                "ROM gotowy do uruchomienia."
            );


            return true;

        } catch (
            error
        ) {

            console.error(
                "WebBktx ROM ERROR:",
                error
            );


            this.log(
                `Nie udało się załadować: ${error.message}`
            );


            return false;

        }

    }


    /*
     * ========================================================
     * LOAD ROM FROM FILE INPUT
     * ========================================================
     */

    async loadROMFile(
        file
    ) {

        if (
            !file
        ) {

            return false;

        }


        return this.loadROM(
            file,
            file.name
        );

    }


    /*
     * ========================================================
     * RESET HARDWARE
     * ========================================================
     */

    resetHardware() {

        /*
         * Stop execution first.
         */

        this.stop();


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
         * CPU.
         */

        if (
            this.cpu
        ) {

            if (
                typeof this.cpu.reset ===
                "function"
            ) {

                this.cpu.reset();

            } else {

                /*
                 * Fallback for CPUs without reset().
                 */

                this.tryCPUReset();

            }

        }


        /*
         * Counters.
         */

        this.cycles =
            0;

        this.frame =
            0;

        this.accumulator =
            0;

        this.started =
            false;


        this.log(
            "Game Boy zresetowany."
        );

    }


    /*
     * ========================================================
     * RESET
     * ========================================================
     */

    reset() {

        this.resetHardware();

    }


    /*
     * ========================================================
     * CPU RESET FALLBACK
     * ========================================================
     */

    tryCPUReset() {

        if (
            !this.cpu
        ) {

            return;

        }


        const cpu =
            this.cpu;


        /*
         * Common register names.
         */

        if (
            "pc" in cpu
        ) {

            cpu.pc =
                0x0100;

        }


        if (
            "sp" in cpu
        ) {

            cpu.sp =
                0xFFFE;

        }


        if (
            "a" in cpu
        ) {

            cpu.a =
                0x01;

        }


        if (
            "f" in cpu
        ) {

            cpu.f =
                0xB0;

        }


        if (
            "b" in cpu
        ) {

            cpu.b =
                0x00;

        }


        if (
            "c" in cpu
        ) {

            cpu.c =
                0x13;

        }


        if (
            "d" in cpu
        ) {

            cpu.d =
                0x00;

        }


        if (
            "e" in cpu
        ) {

            cpu.e =
                0xD8;

        }


        if (
            "h" in cpu
        ) {

            cpu.h =
                0x01;

        }


        if (
            "l" in cpu
        ) {

            cpu.l =
                0x4D;

        }

    }


    /*
     * ========================================================
     * START
     * ========================================================
     */

    start() {

        if (
            this.destroyed
        ) {

            return;

        }


        if (
            !this.cartridge
        ) {

            this.log(
                "Brak ROM-u."
            );

            return;

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

        this.started =
            true;


        this.lastTime =
            performance.now();


        this.accumulator =
            0;


        this.log(
            "Emulator uruchomiony."
        );

        this.log(
            "Emulator START."
        );


        this.scheduleFrame();

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


        this.log(
            "Emulator zatrzymany."
        );

        this.log(
            "Emulator PAUSE."
        );

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

    }


    /*
     * ========================================================
     * TOGGLE
     * ========================================================
     */

    toggle() {

        if (
            this.running
        ) {

            this.pause();

        } else {

            this.start();

        }

    }


    /*
     * ========================================================
     * MAIN LOOP
     * ========================================================
     */

    scheduleFrame() {

        if (
            !this.running
        ) {

            return;

        }


        this.animationFrame =
            requestAnimationFrame(
                time => {

                    this.mainLoop(
                        time
                    );

                }
            );

    }


    /*
     * ========================================================
     * MAIN LOOP
     * ========================================================
     */

    mainLoop(
        now
    ) {

        if (
            !this.running
        ) {

            return;

        }


        let delta =
            now -
            this.lastTime;


        this.lastTime =
            now;


        /*
         * Prevent huge jumps after
         * browser tab switching.
         */

        if (
            delta >
            250
        ) {

            delta =
                250;

        }


        this.accumulator +=
            delta;


        /*
         * Execute enough CPU time to catch up.
         */

        const cpuMilliseconds =
            1000 /
            this.clock;


        /*
         * Maximum cycles per browser frame.
         */

        let cyclesToRun =
            Math.floor(
                (
                    this.accumulator /
                    cpuMilliseconds
                )
            );


        /*
         * Safety limit.
         */

        const maximumCycles =
            70000;


        if (
            cyclesToRun >
            maximumCycles
        ) {

            cyclesToRun =
                maximumCycles;

        }


        if (
            cyclesToRun >
            0
        ) {

            this.runCycles(
                cyclesToRun
            );


            this.accumulator -=
                cyclesToRun *
                cpuMilliseconds;

        }


        /*
         * Render completed frames.
         */

        if (
            this.ppu
        ) {

            if (
                typeof this.ppu.isFrameReady ===
                "function"
            ) {

                if (
                    this.ppu.isFrameReady()
                ) {

                    this.ppu.render();


                    if (
                        typeof this.ppu.consumeFrame ===
                        "function"
                    ) {

                        this.ppu.consumeFrame();

                    }

                }

            } else {

                this.ppu.render();

            }

        }


        this.scheduleFrame();

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
            cycles;


        while (
            remaining > 0
        ) {

            const used =
                this.stepCPU();


            /*
             * Never allow a broken CPU implementation
             * to create an infinite loop.
             */

            if (
                !Number.isFinite(
                    used
                ) ||
                used <= 0
            ) {

                remaining =
                    0;

                break;

            }


            const consumed =
                Math.min(
                    used,
                    remaining
                );


            /*
             * PPU.
             */

            if (
                this.ppu &&
                typeof this.ppu.step ===
                "function"
            ) {

                this.ppu.step(
                    consumed
                );

            }


            /*
             * Timer.
             */

            if (
                this.timer
            ) {

                if (
                    typeof this.timer.step ===
                    "function"
                ) {

                    this.timer.step(
                        consumed
                    );

                } else if (
                    typeof this.timer.tick ===
                    "function"
                ) {

                    this.timer.tick(
                        consumed
                    );

                }

            }


            /*
             * Audio.
             */

            if (
                this.audio
            ) {

                if (
                    typeof this.audio.step ===
                    "function"
                ) {

                    this.audio.step(
                        consumed
                    );

                } else if (
                    typeof this.audio.tick ===
                    "function"
                ) {

                    this.audio.tick(
                        consumed
                    );

                }

            }


            this.cycles +=
                consumed;


            remaining -=
                consumed;

        }


        /*
         * Frame count follows PPU.
         */

        if (
            this.ppu &&
            Number.isFinite(
                this.ppu.frameCount
            )
        ) {

            this.frame =
                this.ppu.frameCount;

        }

    }


    /*
     * ========================================================
     * STEP CPU
     * ========================================================
     */

    stepCPU() {

        if (
            !this.cpu
        ) {

            return 4;

        }


        let used;


        /*
         * Preferred API.
         */

        if (
            typeof this.cpu.step ===
            "function"
        ) {

            used =
                this.cpu.step();

        }


        /*
         * Alternative API.
         */

        else if (
            typeof this.cpu.tick ===
            "function"
        ) {

            used =
                this.cpu.tick();

        }


        else if (
            typeof this.cpu.execute ===
            "function"
        ) {

            used =
                this.cpu.execute();

        }


        else if (
            typeof this.cpu.runInstruction ===
            "function"
        ) {

            used =
                this.cpu.runInstruction();

        }


        else {

            /*
             * Temporary fallback.
             *
             * This keeps PPU/timing alive even if
             * CPU.js is currently incomplete.
             */

            used =
                4;

        }


        /*
         * Some CPUs return an object.
         */

        if (
            used &&
            typeof used ===
            "object"
        ) {

            if (
                Number.isFinite(
                    used.cycles
                )
            ) {

                used =
                    used.cycles;

            } else if (
                Number.isFinite(
                    used.cycleCount
                )
            ) {

                used =
                    used.cycleCount;

            }

        }


        /*
         * Some CPU implementations return
         * undefined while exposing cycles.
         */

        if (
            !Number.isFinite(
                used
            )
        ) {

            if (
                Number.isFinite(
                    this.cpu.lastCycles
                )
            ) {

                used =
                    this.cpu.lastCycles;

            } else if (
                Number.isFinite(
                    this.cpu.cyclesLast
                )
            ) {

                used =
                    this.cpu.cyclesLast;

            } else {

                used =
                    4;

            }

        }


        /*
         * Game Boy machine cycles are normally
         * multiples of 4.
         */

        used =
            Math.max(
                1,
                Math.floor(
                    used
                )
            );


        return used;

    }


    /*
     * ========================================================
     * GET CARTRIDGE INFO
     * ========================================================
     */

    getCartridgeInfo() {

        const cartridge =
            this.cartridge;


        if (
            !cartridge
        ) {

            return {

                title:
                    "—",

                mbc:
                    "—",

                romSize:
                    0,

                ramSize:
                    0,

                romBank:
                    1

            };

        }


        const rom =
            cartridge.rom;


        const ram =
            cartridge.ram;


        let title =
            cartridge.title ??
            cartridge.name ??
            "—";


        let mbc =
            cartridge.mbcType ??
            cartridge.mbc ??
            cartridge.mapper ??
            "—";


        let romSize =
            0;


        if (
            rom &&
            Number.isFinite(
                rom.length
            )
        ) {

            romSize =
                rom.length;

        } else if (
            Number.isFinite(
                cartridge.romSize
            )
        ) {

            romSize =
                cartridge.romSize;

        }


        let ramSize =
            0;


        if (
            ram &&
            Number.isFinite(
                ram.length
            )
        ) {

            ramSize =
                ram.length;

        } else if (
            Number.isFinite(
                cartridge.ramSize
            )
        ) {

            ramSize =
                cartridge.ramSize;

        }


        let romBank =
            cartridge.romBank ??
            cartridge.currentROMBank ??
            cartridge.bank ??
            1;


        /*
         * Cartridge may expose information
         * through getInfo().
         */

        if (
            typeof cartridge.getInfo ===
            "function"
        ) {

            try {

                const info =
                    cartridge.getInfo();


                if (
                    info
                ) {

                    title =
                        info.title ??
                        title;

                    mbc =
                        info.mbc ??
                        info.mbcType ??
                        mbc;

                    romSize =
                        info.romSize ??
                        romSize;

                    ramSize =
                        info.ramSize ??
                        ramSize;

                    romBank =
                        info.romBank ??
                        romBank;

                }

            } catch (
                error
            ) {

                console.warn(
                    "Cartridge getInfo error:",
                    error
                );

            }

        }


        return {

            title:
                String(
                    title
                ),

            mbc:
                String(
                    mbc
                ),

            romSize:
                Number(
                    romSize
                ) || 0,

            ramSize:
                Number(
                    ramSize
                ) || 0,

            romBank:
                Number(
                    romBank
                ) || 1

        };

    }


    /*
     * ========================================================
     * GET INFO
     * ========================================================
     *
     * Used by gameboy/index.html.
     *
     * ========================================================
     */

    getInfo() {

        const cartridge =
            this.getCartridgeInfo();


        let cpuCycles =
            this.cycles;


        /*
         * Prefer CPU's internal counter if available.
         */

        if (
            this.cpu
        ) {

            if (
                Number.isFinite(
                    this.cpu.totalCycles
                )
            ) {

                cpuCycles =
                    this.cpu.totalCycles;

            } else if (
                Number.isFinite(
                    this.cpu.cycles
                )
            ) {

                cpuCycles =
                    this.cpu.cycles;

            }

        }


        let frame =
            this.frame;


        if (
            this.ppu &&
            Number.isFinite(
                this.ppu.frameCount
            )
        ) {

            frame =
                this.ppu.frameCount;

        }


        return {

            cpu:
                "LR35902",

            clock:
                4194304,

            fps:
                59.73,

            frame:
                frame,

            cycles:
                cpuCycles,

            running:
                this.running,

            paused:
                this.paused,

            started:
                this.started,

            romLoaded:
                Boolean(
                    this.cartridge
                ),

            cartridge:
                cartridge,

            title:
                cartridge.title,

            mbc:
                cartridge.mbc,

            romSize:
                cartridge.romSize,

            ramSize:
                cartridge.ramSize,

            romBank:
                cartridge.romBank,

            ppu:
                this.ppu &&
                typeof this.ppu.getState ===
                "function"
                    ? this.ppu.getState()
                    : null

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

            started:
                this.started,

            cycles:
                this.cycles,

            frame:
                this.frame,

            cartridge:
                this.getCartridgeInfo(),

            cpu:
                this.cpuState(),

            ppu:
                this.ppuState()

        };

    }


    /*
     * ========================================================
     * CPU STATE
     * ========================================================
     */

    cpuState() {

        if (
            !this.cpu
        ) {

            return null;

        }


        if (
            typeof this.cpu.getState ===
            "function"
        ) {

            try {

                return this.cpu.getState();

            } catch (
                error
            ) {

                return null;

            }

        }


        return {

            pc:
                this.cpu.pc ??
                0,

            sp:
                this.cpu.sp ??
                0,

            a:
                this.cpu.a ??
                0,

            f:
                this.cpu.f ??
                0,

            b:
                this.cpu.b ??
                0,

            c:
                this.cpu.c ??
                0,

            d:
                this.cpu.d ??
                0,

            e:
                this.cpu.e ??
                0,

            h:
                this.cpu.h ??
                0,

            l:
                this.cpu.l ??
                0

        };

    }


    /*
     * ========================================================
     * PPU STATE
     * ========================================================
     */

    ppuState() {

        if (
            !this.ppu
        ) {

            return null;

        }


        if (
            typeof this.ppu.getState ===
            "function"
        ) {

            try {

                return this.ppu.getState();

            } catch (
                error
            ) {

                return null;

            }

        }


        return {

            mode:
                this.ppu.mode ??
                0,

            ly:
                this.ppu.ly ??
                0,

            frame:
                this.ppu.frameCount ??
                0

        };

    }


    /*
     * ========================================================
     * SAVE
     * ========================================================
     */

    save() {

        if (
            !this.cartridge
        ) {

            return null;

        }


        let data =
            null;


        if (
            typeof this.cartridge.save ===
            "function"
        ) {

            data =
                this.cartridge.save();

        } else if (
            typeof this.cartridge.getSaveData ===
            "function"
        ) {

            data =
                this.cartridge.getSaveData();

        } else if (
            this.cartridge.ram
        ) {

            data =
                new Uint8Array(
                    this.cartridge.ram
                );

        }


        if (
            data
        ) {

            try {

                localStorage.setItem(
                    "webbktx-gameboy-save",
                    JSON.stringify(
                        Array.from(
                            data
                        )
                    )
                );

                this.log(
                    "Save zapisany."
                );

            } catch (
                error
            ) {

                console.warn(
                    "Save error:",
                    error
                );

            }

        }


        return data;

    }


    /*
     * ========================================================
     * LOAD SAVE
     * ========================================================
     */

    loadSave() {

        if (
            !this.cartridge
        ) {

            return false;

        }


        try {

            const raw =
                localStorage.getItem(
                    "webbktx-gameboy-save"
                );


            if (
                !raw
            ) {

                return false;

            }


            const data =
                new Uint8Array(
                    JSON.parse(
                        raw
                    )
                );


            if (
                typeof this.cartridge.loadSave ===
                "function"
            ) {

                this.cartridge.loadSave(
                    data
                );

            } else if (
                typeof this.cartridge.setSaveData ===
                "function"
            ) {

                this.cartridge.setSaveData(
                    data
                );

            } else if (
                this.cartridge.ram
            ) {

                this.cartridge.ram.set(
                    data.subarray(
                        0,
                        this.cartridge.ram.length
                    )
                );

            }


            this.log(
                "Save wczytany."
            );


            return true;

        } catch (
            error
        ) {

            console.warn(
                "Load save error:",
                error
            );


            return false;

        }

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
                document.fullscreenElement
            ) {

                await document.exitFullscreen();

            } else {

                await this.canvas.requestFullscreen();

            }


            return true;

        } catch (
            error
        ) {

            console.warn(
                "Fullscreen error:",
                error
            );


            return false;

        }

    }


    /*
     * ========================================================
     * GET LOGS
     * ========================================================
     */

    getLogs() {

        return [
            ...this.logs
        ];

    }


    /*
     * ========================================================
     * GET LAST LOG
     * ========================================================
     */

    getLastLog() {

        if (
            this.logs.length ===
            0
        ) {

            return null;

        }


        return this.logs[
            this.logs.length - 1
        ];

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
     * IS PAUSED
     * ========================================================
     */

    isPaused() {

        return this.paused;

    }


    /*
     * ========================================================
     * GET CPU CYCLES
     * ========================================================
     */

    getCycles() {

        if (
            this.cpu &&
            Number.isFinite(
                this.cpu.totalCycles
            )
        ) {

            return this.cpu.totalCycles;

        }


        if (
            this.cpu &&
            Number.isFinite(
                this.cpu.cycles
            )
        ) {

            return this.cpu.cycles;

        }


        return this.cycles;

    }


    /*
     * ========================================================
     * GET FRAME
     * ========================================================
     */

    getFrame() {

        if (
            this.ppu &&
            Number.isFinite(
                this.ppu.frameCount
            )
        ) {

            return this.ppu.frameCount;

        }


        return this.frame;

    }


    /*
     * ========================================================
     * DESTROY
     * ========================================================
     */

    destroy() {

        this.stop();


        if (
            this.input &&
            typeof this.input.destroy ===
            "function"
        ) {

            this.input.destroy();

        }


        if (
            this.audio &&
            typeof this.audio.destroy ===
            "function"
        ) {

            this.audio.destroy();

        }


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

        this.cartridge =
            null;

        this.destroyed =
            true;


        this.log(
            "Emulator zniszczony."
        );

    }

}


/*
 * ============================================================
 * GLOBAL HELPER
 * ============================================================
 *
 * Allows:
 *
 *   window.WebBktxGameBoy
 *
 * ============================================================
 */

if (
    typeof window !==
    "undefined"
) {

    window.WebBktxGameBoy =
        GameBoyEmulator;

}
