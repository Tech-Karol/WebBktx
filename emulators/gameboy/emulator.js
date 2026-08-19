/*
 * ============================================================
 * WebBktx Game Boy Emulator
 * emulator.js
 * ============================================================
 *
 * Integrator:
 *
 *   CPU
 *   Memory
 *   PPU
 *   Cartridge
 *   Timer
 *   Input
 *   Audio
 *
 * Game Boy DMG
 * 160x144
 * 4.194304 MHz
 *
 * ============================================================
 */

import CPU from "./cpu.js";
import GameBoyMemory from "./memory.js";
import PPU from "./ppu.js";
import Cartridge from "./cartridge.js";



export default class GameBoyEmulator {

    constructor(options = {}) {

        this.logPrefix =
            "[WebBktx]";


        /*
         * ----------------------------------------------------
         * Hardware
         * ----------------------------------------------------
         */

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
         * Emulator state
         * ----------------------------------------------------
         */

        this.running =
            false;

        this.paused =
            true;

        this.romLoaded =
            false;


        /*
         * ----------------------------------------------------
         * Timing
         * ----------------------------------------------------
         */

        this.CLOCK =
            4194304;

        this.FPS =
            59.7275;

        this.cycles =
            0;

        this.frames =
            0;

        this.lastTime =
            0;

        this.accumulator =
            0;


        /*
         * Prevent browser starvation.
         */

        this.maxCyclesPerFrame =
            200000;


        /*
         * ----------------------------------------------------
         * ROM
         * ----------------------------------------------------
         */

        this.rom =
            null;

        this.romName =
            "";


        /*
         * ----------------------------------------------------
         * Save
         * ----------------------------------------------------
         */

        this.saveKey =
            "webbktx-gameboy-save";


        /*
         * ----------------------------------------------------
         * Animation
         * ----------------------------------------------------
         */

        this.animationFrame =
            null;


        /*
         * ----------------------------------------------------
         * Statistics
         * ----------------------------------------------------
         */

        this.stats = {

            cycles:
                0,

            frames:
                0,

            fps:
                0,

            lastFrameTime:
                0

        };


        /*
         * ----------------------------------------------------
         * Build hardware
         * ----------------------------------------------------
         */

        this.createHardware();


        this.log(
            "WebBktx Game Boy gotowy."
        );

    }



    /*
     * ========================================================
     * LOG
     * ========================================================
     */

    log(message, error = false) {

        const text =
            `${this.logPrefix} ${message}`;


        if (error) {

            console.error(
                text
            );

        } else {

            console.log(
                text
            );

        }

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

        this.cartridge =
            new Cartridge();


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
         * PPU.
         */

        this.ppu =
            new PPU(
                this.memory
            );


        /*
         * IMPORTANT:
         *
         * PPU must be connected through
         * the memory bus.
         */

        if (
            typeof this.memory.connectPPU ===
            "function"
        ) {

            this.memory.connectPPU(
                this.ppu
            );

        }


        /*
         * CPU.
         */

        this.cpu =
            new CPU(
                this.memory
            );


        /*
         * Connect CPU to PPU if supported.
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
         * Timer.
         *
         * If timer.js exists and exports correctly,
         * emulator can be extended without changing
         * the main loop.
         */

        this.tryCreateTimer();


        /*
         * Input.
         */

        this.tryCreateInput();


        /*
         * Audio.
         */

        this.tryCreateAudio();


        /*
         * Connect optional components.
         */

        if (
            this.timer &&
            typeof this.memory.connectTimer ===
            "function"
        ) {

            this.memory.connectTimer(
                this.timer
            );

        }


        if (
            this.input &&
            typeof this.memory.connectInput ===
            "function"
        ) {

            this.memory.connectInput(
                this.input
            );

        }


        if (
            this.audio &&
            typeof this.memory.connectAudio ===
            "function"
        ) {

            this.memory.connectAudio(
                this.audio
            );

        }


        /*
         * Initial reset.
         */

        this.resetHardware();

    }



    /*
     * ========================================================
     * OPTIONAL TIMER
     * ========================================================
     */

    tryCreateTimer() {

        /*
         * Timer can be attached later by emulator.js
         * or by external code.
         *
         * This function intentionally does not import
         * a missing module.
         */

        this.timer =
            null;

    }



    /*
     * ========================================================
     * OPTIONAL INPUT
     * ========================================================
     */

    tryCreateInput() {

        this.input =
            null;

    }



    /*
     * ========================================================
     * OPTIONAL AUDIO
     * ========================================================
     */

    tryCreateAudio() {

        this.audio =
            null;

    }



    /*
     * ========================================================
     * ATTACH CANVAS
     * ========================================================
     */

    attachCanvas(canvas) {

        this.canvas =
            canvas;


        if (!canvas) {

            this.context =
                null;

            return;

        }


        /*
         * Native Game Boy resolution.
         */

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


        if (this.context) {

            this.context.imageSmoothingEnabled =
                false;

        }


        /*
         * Give canvas to PPU.
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
     * RESET HARDWARE
     * ========================================================
     */

    resetHardware() {

        this.running =
            false;

        this.paused =
            true;


        /*
         * Memory reset.
         */

        if (
            this.memory &&
            typeof this.memory.reset ===
            "function"
        ) {

            this.memory.reset();

        }


        /*
         * PPU reset.
         */

        if (
            this.ppu &&
            typeof this.ppu.reset ===
            "function"
        ) {

            this.ppu.reset();

        }


        /*
         * CPU reset.
         */

        if (
            this.cpu &&
            typeof this.cpu.reset ===
            "function"
        ) {

            this.cpu.reset();

        }


        /*
         * Timer reset.
         */

        if (
            this.timer &&
            typeof this.timer.reset ===
            "function"
        ) {

            this.timer.reset();

        }


        /*
         * Input reset.
         */

        if (
            this.input &&
            typeof this.input.reset ===
            "function"
        ) {

            this.input.reset();

        }


        this.cycles =
            0;

        this.frames =
            0;

        this.stats.cycles =
            0;

        this.stats.frames =
            0;


        this.accumulator =
            0;


        this.lastTime =
            0;


        /*
         * Render initial frame.
         */

        if (
            this.ppu &&
            typeof this.ppu.render ===
            "function"
        ) {

            this.ppu.render();

        }

    }



    /*
     * ========================================================
     * LOAD ROM
     * ========================================================
     */

    async loadROM(input) {

        try {

            let data =
                null;

            let name =
                "game.gb";


            /*
             * File object.
             */

            if (
                input instanceof File
            ) {

                name =
                    input.name;

                data =
                    new Uint8Array(
                        await input.arrayBuffer()
                    );

            }


            /*
             * Uint8Array.
             */

            else if (
                input instanceof Uint8Array
            ) {

                data =
                    input;

            }


            /*
             * ArrayBuffer.
             */

            else if (
                input instanceof ArrayBuffer
            ) {

                data =
                    new Uint8Array(
                        input
                    );

            }


            else {

                throw new Error(
                    "Nieobsługiwany format ROM-u."
                );

            }


            if (
                !data ||
                data.length <
                0x150
            ) {

                throw new Error(
                    "ROM jest za mały lub uszkodzony."
                );

            }


            this.log(
                `Ładowanie: ${name}`
            );


            /*
             * Stop old emulation.
             */

            this.pause();


            /*
             * Keep original ROM.
             */

            this.rom =
                new Uint8Array(
                    data
                );

            this.romName =
                name;


            /*
             * Load cartridge.
             */

            let loaded =
                false;


            if (
                this.cartridge
            ) {

                /*
                 * Most common API.
                 */

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


                /*
                 * Alternative API.
                 */

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


                /*
                 * Direct ROM fallback.
                 */

                else {

                    this.cartridge.rom =
                        new Uint8Array(
                            data
                        );

                    loaded =
                        true;

                }

            }


            if (!loaded) {

                throw new Error(
                    "Cartridge nie przyjął ROM-u."
                );

            }


            /*
             * Connect cartridge again.
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
             * Reset all hardware after cartridge
             * is loaded.
             */

            this.resetHardware();


            this.romLoaded =
                true;


            /*
             * Cartridge information.
             */

            const info =
                this.getCartridgeInfo();


            if (
                info.title
            ) {

                this.log(
                    `ROM załadowany: ${info.title}`
                );

            } else {

                this.log(
                    "ROM załadowany."
                );

            }


            this.log(
                "ROM gotowy do uruchomienia."
            );


            return true;

        } catch (error) {

            this.romLoaded =
                false;

            this.running =
                false;

            this.paused =
                true;


            this.log(
                `ROM ERROR: ${error.message}`,
                true
            );


            return false;

        }

    }



    /*
     * ========================================================
     * LOAD ROM ALIAS
     * ========================================================
     */

    load(input) {

        return this.loadROM(
            input
        );

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


        this.lastTime =
            performance.now();


        this.log(
            "Emulator uruchomiony."
        );


        this.log(
            "Emulator START."
        );


        this.scheduleFrame();


        return true;

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

        this.pause();

    }



    /*
     * ========================================================
     * RESET
     * ========================================================
     */

    reset() {

        this.pause();


        this.resetHardware();


        /*
         * Cartridge must remain loaded.
         */

        if (
            this.cartridge &&
            this.rom &&
            this.rom.length
        ) {

            /*
             * Do not reload the cartridge here.
             * Reset hardware only.
             */

        }


        this.log(
            "Game Boy zresetowany."
        );

    }



    /*
     * ========================================================
     * FRAME LOOP
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

                    this.animationFrame =
                        null;

                    this.runFrame(
                        time
                    );

                }
            );

    }



    /*
     * ========================================================
     * RUN FRAME
     * ========================================================
     */

    runFrame(time) {

        if (
            !this.running
        ) {

            return;

        }


        if (
            !this.lastTime
        ) {

            this.lastTime =
                time;

        }


        let delta =
            time -
            this.lastTime;


        this.lastTime =
            time;


        /*
         * Browser tab protection.
         */

        if (
            delta >
            100
        ) {

            delta =
                100;

        }


        if (
            delta <
            0
        ) {

            delta =
                0;

        }


        /*
         * Number of CPU cycles corresponding
         * to elapsed real time.
         */

        let cyclesToRun =
            Math.floor(
                (
                    delta /
                    1000
                ) *
                this.CLOCK
            );


        /*
         * Avoid giant chunks.
         */

        cyclesToRun =
            Math.min(
                cyclesToRun,
                this.maxCyclesPerFrame
            );


        let executed =
            0;


        /*
         * CPU execution.
         */

        while (
            executed <
            cyclesToRun
        ) {

            let used =
                this.stepCPU();


            /*
             * Protect against broken CPU
             * returning zero/NaN.
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


            used =
                Math.min(
                    used,
                    cyclesToRun -
                    executed
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
                    used
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
             * Audio.
             */

            if (
                this.audio &&
                typeof this.audio.step ===
                "function"
            ) {

                this.audio.step(
                    used
                );

            }


            executed +=
                used;

            this.cycles +=
                used;

        }


        /*
         * Render only when a complete frame
         * is ready.
         */

        if (
            this.ppu &&
            typeof this.ppu.isFrameReady ===
            "function" &&
            this.ppu.isFrameReady()
        ) {

            if (
                typeof this.ppu.render ===
                "function"
            ) {

                this.ppu.render();

            }


            if (
                typeof this.ppu.consumeFrame ===
                "function"
            ) {

                this.ppu.consumeFrame();

            }


            this.frames++;


            this.stats.frames =
                this.frames;


            this.stats.lastFrameTime =
                time;

        }


        this.stats.cycles =
            this.cycles;


        /*
         * Continue.
         */

        this.scheduleFrame();

    }



    /*
     * ========================================================
     * CPU STEP
     * ========================================================
     */

    stepCPU() {

        if (!this.cpu) {

            return 4;

        }


        /*
         * step()
         */

        if (
            typeof this.cpu.step ===
            "function"
        ) {

            const result =
                this.cpu.step();


            if (
                Number.isFinite(
                    result
                ) &&
                result > 0
            ) {

                return result;

            }


            /*
             * Some CPUs expose cycles
             * separately.
             */

            if (
                Number.isFinite(
                    this.cpu.cycles
                )
            ) {

                return 4;

            }


            return 4;

        }


        /*
         * executeInstruction()
         */

        if (
            typeof this.cpu.executeInstruction ===
            "function"
        ) {

            const result =
                this.cpu.executeInstruction();


            return Number.isFinite(
                result
            )
                ? Math.max(
                    1,
                    result
                )
                : 4;

        }


        /*
         * tick()
         */

        if (
            typeof this.cpu.tick ===
            "function"
        ) {

            const result =
                this.cpu.tick();


            return Number.isFinite(
                result
            )
                ? Math.max(
                    1,
                    result
                )
                : 4;

        }


        return 4;

    }



    /*
     * ========================================================
     * SAVE
     * ========================================================
     */

    save() {

        try {

            /*
             * Cartridge-native save.
             */

            if (
                this.cartridge
            ) {

                if (
                    typeof this.cartridge.getSaveData ===
                    "function"
                ) {

                    const data =
                        this.cartridge.getSaveData();


                    this.writeSaveStorage(
                        data
                    );


                    this.log(
                        "Save zapisany."
                    );


                    return true;

                }


                if (
                    typeof this.cartridge.save ===
                    "function"
                ) {

                    const data =
                        this.cartridge.save();


                    this.writeSaveStorage(
                        data
                    );


                    this.log(
                        "Save zapisany."
                    );


                    return true;

                }

            }


            /*
             * Generic memory save.
             */

            const state =
                this.createSaveState();


            localStorage.setItem(
                this.saveKey,
                JSON.stringify(
                    state
                )
            );


            this.log(
                "Save zapisany."
            );


            return true;

        } catch (error) {

            this.log(
                `Save ERROR: ${error.message}`,
                true
            );


            return false;

        }

    }



    /*
     * ========================================================
     * LOAD SAVE
     * ========================================================
     */

    load() {

        return this.loadFromStorage();

    }



    /*
     * ========================================================
     * SAVE TO STORAGE
     * ========================================================
     */

    saveToStorage() {

        return this.save();

    }



    /*
     * ========================================================
     * LOAD FROM STORAGE
     * ========================================================
     */

    loadFromStorage() {

        try {

            if (
                !this.cartridge
            ) {

                return false;

            }


            const raw =
                localStorage.getItem(
                    this.saveKey
                );


            if (!raw) {

                this.log(
                    "Brak zapisu."
                );

                return false;

            }


            /*
             * Cartridge save format.
             */

            if (
                typeof this.cartridge.loadSaveData ===
                "function"
            ) {

                const data =
                    JSON.parse(
                        raw
                    );


                this.cartridge.loadSaveData(
                    data
                );


                this.log(
                    "Save wczytany."
                );


                return true;

            }


            /*
             * Cartridge load().
             */

            if (
                typeof this.cartridge.loadSave ===
                "function"
            ) {

                const data =
                    JSON.parse(
                        raw
                    );


                this.cartridge.loadSave(
                    data
                );


                this.log(
                    "Save wczytany."
                );


                return true;

            }


            /*
             * Generic emulator state.
             */

            const state =
                JSON.parse(
                    raw
                );


            this.restoreSaveState(
                state
            );


            this.log(
                "Save wczytany."
            );


            return true;

        } catch (error) {

            this.log(
                `Load Save ERROR: ${error.message}`,
                true
            );


            return false;

        }

    }



    /*
     * ========================================================
     * WRITE SAVE STORAGE
     * ========================================================
     */

    writeSaveStorage(data) {

        /*
         * Uint8Array.
         */

        if (
            data instanceof Uint8Array
        ) {

            const binary =
                Array.from(
                    data
                );


            localStorage.setItem(
                this.saveKey,
                JSON.stringify(
                    {
                        type:
                            "uint8array",

                        data:
                            binary

                    }
                )
            );


            return;

        }


        localStorage.setItem(
            this.saveKey,
            JSON.stringify(
                data
            )
        );

    }



    /*
     * ========================================================
     * CREATE SAVE STATE
     * ========================================================
     */

    createSaveState() {

        const state = {

            version:
                1,

            romName:
                this.romName,

            cycles:
                this.cycles,

            frames:
                this.frames,

            memory:
                null,

            cpu:
                null

        };


        /*
         * Memory state.
         */

        if (
            this.memory &&
            typeof this.memory.getState ===
            "function"
        ) {

            state.memory =
                this.memory.getState();

        }


        /*
         * CPU state.
         */

        if (
            this.cpu &&
            typeof this.cpu.getState ===
            "function"
        ) {

            state.cpu =
                this.cpu.getState();

        }


        return state;

    }



    /*
     * ========================================================
     * RESTORE SAVE STATE
     * ========================================================
     */

    restoreSaveState(state) {

        if (!state) {

            return;

        }


        if (
            Number.isFinite(
                state.cycles
            )
        ) {

            this.cycles =
                state.cycles;

        }


        if (
            Number.isFinite(
                state.frames
            )
        ) {

            this.frames =
                state.frames;

        }


        /*
         * CPU restore.
         */

        if (
            state.cpu &&
            this.cpu &&
            typeof this.cpu.setState ===
            "function"
        ) {

            this.cpu.setState(
                state.cpu
            );

        }


        /*
         * Cartridge state is handled
         * separately by cartridge.js.
         */

    }



    /*
     * ========================================================
     * GET CARTRIDGE INFO
     * ========================================================
     */

    getCartridgeInfo() {

        const c =
            this.cartridge;


        if (!c) {

            return {

                title:
                    "",

                type:
                    "",

                romSize:
                    0,

                ramSize:
                    0,

                romBank:
                    1

            };

        }


        const info =
            typeof c.getInfo ===
            "function"
                ? c.getInfo()
                : null;


        if (info) {

            return {

                title:
                    info.title ??
                    c.title ??
                    "",

                type:
                    info.type ??
                    info.mapper ??
                    c.type ??
                    "",

                romSize:
                    info.romSize ??
                    c.rom?.length ??
                    this.rom?.length ??
                    0,

                ramSize:
                    info.ramSize ??
                    c.ram?.length ??
                    0,

                romBank:
                    info.romBank ??
                    c.romBank ??
                    1

            };

        }


        return {

            title:
                c.title ??
                "",

            type:
                c.type ??
                c.mapper ??
                "",

            romSize:
                c.rom?.length ??
                this.rom?.length ??
                0,

            ramSize:
                c.ram?.length ??
                0,

            romBank:
                c.romBank ??
                1

        };

    }



    /*
     * ========================================================
     * GET INFO
     * ========================================================
     *
     * This fixes:
     *
     * emulator.getInfo is not a function
     *
     * ========================================================
     */

    getInfo() {

        const cartridge =
            this.getCartridgeInfo();


        let cpuState =
            null;


        if (
            this.cpu &&
            typeof this.cpu.getState ===
            "function"
        ) {

            cpuState =
                this.cpu.getState();

        }


        const ppuState =
            this.ppu &&
            typeof this.ppu.getState ===
            "function"
                ? this.ppu.getState()
                : null;


        return {

            /*
             * Cartridge
             */

            title:
                cartridge.title,

            cartridgeTitle:
                cartridge.title,

            mapper:
                cartridge.type,

            type:
                cartridge.type,

            romSize:
                cartridge.romSize,

            ramSize:
                cartridge.ramSize,

            romBank:
                cartridge.romBank,


            /*
             * Emulator
             */

            cpu:
                "LR35902",

            CPU:
                "LR35902",

            clock:
                this.CLOCK,

            clockHz:
                this.CLOCK,

            fps:
                this.FPS,

            frame:
                this.frames,

            frames:
                this.frames,

            cycles:
                this.cycles,

            running:
                this.running,

            paused:
                this.paused,

            romLoaded:
                this.romLoaded,


            /*
             * CPU
             */

            cpuState:
                cpuState,

            /*
             * PPU
             */

            ppu:
                ppuState

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

            romLoaded:
                this.romLoaded,

            cycles:
                this.cycles,

            frames:
                this.frames,

            romName:
                this.romName,

            cartridge:
                this.getCartridgeInfo(),

            cpu:
                this.cpu &&
                typeof this.cpu.getState ===
                "function"
                    ? this.cpu.getState()
                    : null,

            ppu:
                this.ppu &&
                typeof this.ppu.getState ===
                "function"
                    ? this.ppu.getState()
                    : null,

            memory:
                this.memory &&
                typeof this.memory.getState ===
                "function"
                    ? this.memory.getState()
                    : null

        };

    }



    /*
     * ========================================================
     * GET FRAME
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
     * GET RGBA FRAME
     * ========================================================
     */

    getRGBABuffer() {

        if (
            this.ppu &&
            typeof this.ppu.getRGBABuffer ===
            "function"
        ) {

            return this.ppu.getRGBABuffer();

        }


        return null;

    }



    /*
     * ========================================================
     * CONNECT TIMER
     * ========================================================
     */

    connectTimer(timer) {

        this.timer =
            timer;


        if (
            this.memory &&
            typeof this.memory.connectTimer ===
            "function"
        ) {

            this.memory.connectTimer(
                timer
            );

        }

    }



    /*
     * ========================================================
     * CONNECT INPUT
     * ========================================================
     */

    connectInput(input) {

        this.input =
            input;


        if (
            this.memory &&
            typeof this.memory.connectInput ===
            "function"
        ) {

            this.memory.connectInput(
                input
            );

        }

    }



    /*
     * ========================================================
     * CONNECT AUDIO
     * ========================================================
     */

    connectAudio(audio) {

        this.audio =
            audio;


        if (
            this.memory &&
            typeof this.memory.connectAudio ===
            "function"
        ) {

            this.memory.connectAudio(
                audio
            );

        }

    }



    /*
     * ========================================================
     * CONNECT MEMORY
     * ========================================================
     */

    connectMemory(memory) {

        if (!memory) {

            return;

        }


        this.memory =
            memory;


        if (
            this.ppu &&
            typeof this.memory.connectPPU ===
            "function"
        ) {

            this.memory.connectPPU(
                this.ppu
            );

        }


        if (
            this.cartridge &&
            typeof this.memory.connectCartridge ===
            "function"
        ) {

            this.memory.connectCartridge(
                this.cartridge
            );

        }


        if (
            this.timer &&
            typeof this.memory.connectTimer ===
            "function"
        ) {

            this.memory.connectTimer(
                this.timer
            );

        }


        if (
            this.input &&
            typeof this.memory.connectInput ===
            "function"
        ) {

            this.memory.connectInput(
                this.input
            );

        }


        if (
            this.audio &&
            typeof this.memory.connectAudio ===
            "function"
        ) {

            this.memory.connectAudio(
                this.audio
            );

        }

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
     * HAS ROM
     * ========================================================
     */

    hasROM() {

        return this.romLoaded;

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

        this.canvas =
            null;

        this.context =
            null;

        this.rom =
            null;

        this.romLoaded =
            false;

    }

}
