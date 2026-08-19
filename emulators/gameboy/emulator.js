/*
 * ============================================================
 * WebBktx Game Boy Emulator
 * emulator.js
 * ============================================================
 *
 * Główna magistrala emulatora:
 *
 *                 ┌───────────┐
 *                 │    CPU    │
 *                 │   LR35902 │
 *                 └─────┬─────┘
 *                       │
 *                       ▼
 *                 ┌───────────┐
 *                 │  MEMORY   │
 *                 └─────┬─────┘
 *                       │
 *          ┌────────────┼────────────┐
 *          ▼            ▼            ▼
 *      Cartridge       PPU        Timer/Input
 *                       │
 *                       ▼
 *                    Canvas
 *
 * ============================================================
 */

import GameBoyMemory from "./memory.js";
import PPU from "./ppu.js";

import CPU from "./cpu.js";

import Cartridge from "./cartridge.js";


export default class GameBoyEmulator {

    constructor(options = {}) {

        /*
         * ----------------------------------------------------
         * DOM / Canvas
         * ----------------------------------------------------
         */

        this.canvas =
            options.canvas ||
            null;

        this.context =
            null;


        /*
         * ----------------------------------------------------
         * Hardware
         * ----------------------------------------------------
         */

        this.memory =
            new GameBoyMemory();

        this.ppu =
            new PPU(
                this.memory
            );

        this.cpu =
            null;

        this.cartridge =
            null;


        /*
         * ----------------------------------------------------
         * Optional hardware
         * ----------------------------------------------------
         */

        this.timer =
            null;

        this.input =
            null;

        this.audio =
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

        this.destroyed =
            false;


        this.raf =
            0;

        this.lastTime =
            0;

        this.accumulator =
            0;


        /*
         * ----------------------------------------------------
         * Timing
         * ----------------------------------------------------
         */

        this.CLOCK =
            4194304;

        this.FPS =
            59.7275;

        this.CYCLES_PER_FRAME =
            70224;


        /*
         * ----------------------------------------------------
         * Statistics
         * ----------------------------------------------------
         */

        this.frame =
            0;

        this.cycles =
            0;

        this.framesThisSecond =
            0;

        this.fps =
            0;

        this.fpsTimer =
            0;


        /*
         * ----------------------------------------------------
         * ROM
         * ----------------------------------------------------
         */

        this.rom =
            null;

        this.romName =
            "";

        this.romLoaded =
            false;


        /*
         * ----------------------------------------------------
         * Save
         * ----------------------------------------------------
         */

        this.saveKey =
            "webbktx-gameboy-save";

        this.autoSave =
            true;


        /*
         * ----------------------------------------------------
         * Log
         * ----------------------------------------------------
         */

        this.logs =
            [];

        this.logCallback =
            null;


        /*
         * ----------------------------------------------------
         * Connect components
         * ----------------------------------------------------
         */

        this.connectMemory();

        this.createCPU();

        this.connectPPU();


        /*
         * Canvas.
         */

        if (
            this.canvas
        ) {

            this.attachCanvas(
                this.canvas
            );

        }


        this.log(
            "WebBktx Game Boy gotowy."
        );

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
                    "pl-PL",
                    {
                        hour12: false
                    }
                );


        const line =
            `[${time}] ${message}`;


        this.logs.push(
            line
        );


        if (
            this.logs.length >
            500
        ) {

            this.logs.shift();

        }


        if (
            typeof this.logCallback ===
            "function"
        ) {

            this.logCallback(
                line
            );

        }


        /*
         * Nie spamujemy konsoli przy każdym cyklu.
         */

        if (
            typeof console !==
            "undefined"
        ) {

            console.log(
                "[WebBktx]",
                message
            );

        }

    }


    setLogCallback(
        callback
    ) {

        this.logCallback =
            typeof callback ===
            "function"
                ? callback
                : null;

    }


    getLogs() {

        return [
            ...this.logs
        ];

    }


    /*
     * ========================================================
     * CONNECT MEMORY
     * ========================================================
     */

    connectMemory() {

        /*
         * Memory -> PPU
         */

        if (
            this.memory &&
            typeof this.memory.connectPPU ===
            "function"
        ) {

            this.memory.connectPPU(
                this.ppu
            );

        }

    }


    /*
     * ========================================================
     * CREATE CPU
     * ========================================================
     */

    createCPU() {

        try {

            this.cpu =
                new CPU(
                    this.memory
                );

        } catch (
            error
        ) {

            /*
             * Nie kończymy inicjalizacji całego emulatora.
             * Dzięki temu ROM może się załadować,
             * a użytkownik dostanie prawdziwy błąd CPU.
             */

            this.cpu =
                null;

            this.log(
                "CPU nie został utworzony: " +
                error.message
            );

        }


        if (
            this.cpu
        ) {

            /*
             * Najczęstsze API CPU.
             */

            if (
                typeof this.cpu.connectMemory ===
                "function"
            ) {

                this.cpu.connectMemory(
                    this.memory
                );

            }

            if (
                typeof this.cpu.setMemory ===
                "function"
            ) {

                this.cpu.setMemory(
                    this.memory
                );

            }

        }

    }


    /*
     * ========================================================
     * CONNECT PPU
     * ========================================================
     */

    connectPPU() {

        if (
            !this.ppu
        ) {

            return;

        }


        if (
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
         * Memory ma już własne VRAM/OAM.
         *
         * PPU musi pracować na tych samych tablicach.
         */

        if (
            this.memory
        ) {

            this.ppu.vram =
                this.memory.vram;

            this.ppu.oam =
                this.memory.oam;

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

            return;

        }


        /*
         * Nie wymuszamy CSS.
         * Prawdziwy framebuffer Game Boya = 160x144.
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


        if (
            this.context
        ) {

            this.context.imageSmoothingEnabled =
                false;

        }


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
        name = "game.gb"
    ) {

        try {

            this.stop();


            this.log(
                `Ładowanie: ${name}`
            );


            const data =
                await this.normalizeROM(
                    source
                );


            if (
                !data ||
                data.length <
                0x150
            ) {

                throw new Error(
                    "ROM jest pusty albo zbyt mały."
                );

            }


            this.rom =
                data;

            this.romName =
                name;


            /*
             * ------------------------------------------------
             * Cartridge
             * ------------------------------------------------
             */

            this.cartridge =
                this.createCartridge(
                    data,
                    name
                );


            if (
                !this.cartridge
            ) {

                throw new Error(
                    "Nie udało się utworzyć cartridge."
                );

            }


            /*
             * Podłączenie cartridge do memory.
             */

            if (
                typeof this.memory.connectCartridge ===
                "function"
            ) {

                this.memory.connectCartridge(
                    this.cartridge
                );

            } else {

                this.memory.cartridge =
                    this.cartridge;

            }


            /*
             * Reset pamięci.
             */

            if (
                typeof this.memory.reset ===
                "function"
            ) {

                this.memory.reset();

            }


            /*
             * Reset CPU.
             */

            this.resetCPU();


            /*
             * Ponowne spięcie PPU po resetach.
             */

            this.connectPPU();


            /*
             * Załaduj stan początkowy
             * zgodny z uruchomieniem bez boot ROM.
             */

            this.initializeDMG();


            this.romLoaded =
                true;


            this.paused =
                true;

            this.running =
                false;


            this.frame =
                0;

            this.cycles =
                0;


            this.log(
                "ROM załadowany: " +
                this.getCartridgeTitle()
            );


            /*
             * Informacja o cartridge.
             */

            this.log(
                "ROM gotowy do uruchomienia."
            );


            return true;

        } catch (
            error
        ) {

            console.error(
                "[WebBktx] ROM ERROR:",
                error
            );


            this.romLoaded =
                false;


            this.log(
                "Nie udało się załadować: " +
                error.message
            );


            return false;

        }

    }


    /*
     * ========================================================
     * NORMALIZE ROM
     * ========================================================
     */

    async normalizeROM(
        source
    ) {

        if (
            source instanceof Uint8Array
        ) {

            return new Uint8Array(
                source
            );

        }


        if (
            source instanceof ArrayBuffer
        ) {

            return new Uint8Array(
                source
            );

        }


        if (
            source instanceof Blob
        ) {

            const buffer =
                await source.arrayBuffer();


            return new Uint8Array(
                buffer
            );

        }


        if (
            source &&
            source.buffer instanceof ArrayBuffer
        ) {

            return new Uint8Array(
                source.buffer,
                source.byteOffset || 0,
                source.byteLength
            );

        }


        if (
            typeof source ===
            "string"
        ) {

            const response =
                await fetch(
                    source
                );


            if (
                !response.ok
            ) {

                throw new Error(
                    `HTTP ${response.status}`
                );

            }


            const buffer =
                await response.arrayBuffer();


            return new Uint8Array(
                buffer
            );

        }


        throw new Error(
            "Nieobsługiwany format ROM."
        );

    }


    /*
     * ========================================================
     * CARTRIDGE FACTORY
     * ========================================================
     */

    createCartridge(
        data,
        name
    ) {

        /*
         * Najpierw próbujemy standardowego API.
         */

        try {

            return new Cartridge(
                data,
                name
            );

        } catch (
            firstError
        ) {

            /*
             * Niektóre cartridge.js mają
             * konstruktor bez argumentów.
             */

            try {

                const cart =
                    new Cartridge();


                if (
                    typeof cart.load ===
                    "function"
                ) {

                    cart.load(
                        data,
                        name
                    );

                } else if (
                    typeof cart.loadROM ===
                    "function"
                ) {

                    cart.loadROM(
                        data,
                        name
                    );

                } else {

                    cart.rom =
                        data;

                }


                return cart;

            } catch (
                secondError
            ) {

                throw firstError;

            }

        }

    }


    /*
     * ========================================================
     * RESET CPU
     * ========================================================
     */

    resetCPU() {

        if (
            !this.cpu
        ) {

            return;

        }


        if (
            typeof this.cpu.reset ===
            "function"
        ) {

            this.cpu.reset();

            return;

        }


        /*
         * Awaryjny reset typowego CPU.
         */

        if (
            typeof this.cpu.resetCPU ===
            "function"
        ) {

            this.cpu.resetCPU();

        }

    }


    /*
     * ========================================================
     * INITIAL DMG STATE
     * ========================================================
     */

    initializeDMG() {

        /*
         * Ten zestaw odpowiada uruchomieniu DMG
         * po boot ROM.
         *
         * Jeżeli CPU posiada własny reset sprzętowy,
         * jego wartości pozostają nadrzędne.
         */

        const writes = [

            [0xFF05, 0x00],
            [0xFF06, 0x00],
            [0xFF07, 0x00],

            [0xFF10, 0x80],
            [0xFF11, 0xBF],
            [0xFF12, 0xF3],
            [0xFF14, 0xBF],

            [0xFF16, 0x3F],
            [0xFF17, 0x00],
            [0xFF19, 0xBF],

            [0xFF1A, 0x7F],
            [0xFF1B, 0xFF],
            [0xFF1C, 0x9F],
            [0xFF1E, 0xBF],

            [0xFF20, 0xFF],
            [0xFF21, 0x00],
            [0xFF22, 0x00],
            [0xFF23, 0xBF],

            [0xFF24, 0x77],
            [0xFF25, 0xF3],
            [0xFF26, 0xF1],

            [0xFF40, 0x91],
            [0xFF41, 0x85],
            [0xFF42, 0x00],
            [0xFF43, 0x00],
            [0xFF44, 0x00],
            [0xFF45, 0x00],

            [0xFF47, 0xFC],
            [0xFF48, 0xFF],
            [0xFF49, 0xFF],

            [0xFF4A, 0x00],
            [0xFF4B, 0x00],

            [0xFFFF, 0x00]

        ];


        for (
            const [address, value]
            of writes
        ) {

            /*
             * Nie używamy PPU.writeRegister().
             *
             * To ważne:
             *
             * PPU -> memory -> PPU
             *
             * powodowało wcześniej:
             *
             * Maximum call stack size exceeded
             */

            this.directMemoryWrite(
                address,
                value
            );

        }


        /*
         * CPU musi wystartować od 0100,
         * jeżeli boot ROM nie jest emulowany.
         */

        if (
            this.cpu
        ) {

            if (
                typeof this.cpu.setPC ===
                "function"
            ) {

                this.cpu.setPC(
                    0x0100
                );

            } else if (
                "pc" in this.cpu
            ) {

                this.cpu.pc =
                    0x0100;

            } else if (
                "PC" in this.cpu
            ) {

                this.cpu.PC =
                    0x0100;

            }

        }

    }


    /*
     * ========================================================
     * DIRECT MEMORY WRITE
     * ========================================================
     *
     * Używane tylko podczas inicjalizacji.
     *
     * Nie korzystamy z PPU.writeRegister().
     */

    directMemoryWrite(
        address,
        value
    ) {

        const mem =
            this.memory;


        if (
            !mem
        ) {

            return;

        }


        /*
         * Specjalne rejestry.
         */

        if (
            address ===
            0xFFFF
        ) {

            mem.interruptEnable =
                value & 0xFF;

            return;

        }


        if (
            address ===
            0xFF0F
        ) {

            mem.interruptFlags =
                (
                    value |
                    0xE0
                ) & 0xFF;

            return;

        }


        if (
            address ===
            0xFF00
        ) {

            mem.joyp =
                (
                    value &
                    0x30
                ) |
                0xC0;

            return;

        }


        /*
         * Bezpośrednio I/O.
         */

        if (
            address >= 0xFF00 &&
            address <= 0xFF7F &&
            mem.io
        ) {

            mem.io[
                address -
                0xFF00
            ] =
                value & 0xFF;

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

            return false;

        }


        if (
            !this.romLoaded
        ) {

            this.log(
                "Nie można uruchomić: brak ROM-u."
            );

            return false;

        }


        if (
            !this.cpu
        ) {

            this.log(
                "Nie można uruchomić: CPU nie istnieje."
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


        this.accumulator =
            0;


        this.log(
            "Emulator uruchomiony."
        );


        this.log(
            "Emulator START."
        );


        this.raf =
            requestAnimationFrame(
                this.loop.bind(this)
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
            this.raf
        ) {

            cancelAnimationFrame(
                this.raf
            );

            this.raf =
                0;

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
            this.raf
        ) {

            cancelAnimationFrame(
                this.raf
            );

            this.raf =
                0;

        }

    }


    /*
     * ========================================================
     * RESET
     * ========================================================
     */

    reset() {

        this.stop();


        if (
            this.memory &&
            typeof this.memory.reset ===
            "function"
        ) {

            this.memory.reset();

        }


        this.resetCPU();


        if (
            this.ppu &&
            typeof this.ppu.reset ===
            "function"
        ) {

            this.ppu.reset();

        }


        this.connectPPU();


        if (
            this.romLoaded
        ) {

            this.initializeDMG();

        }


        this.frame =
            0;

        this.cycles =
            0;


        this.log(
            "Game Boy zresetowany."
        );

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


        let delta =
            timestamp -
            this.lastTime;


        this.lastTime =
            timestamp;


        /*
         * Tab / throttling może zwrócić
         * ogromny delta.
         */

        if (
            delta > 250
        ) {

            delta =
                250;

        }


        if (
            delta < 0
        ) {

            delta =
                0;

        }


        this.accumulator +=
            (
                delta /
                1000
            ) *
            this.CLOCK;


        /*
         * Maksymalnie ~2 frame przy jednym
         * wywołaniu RAF.
         *
         * Chroni przed spiralą śmierci.
         */

        const maxCycles =
            this.CYCLES_PER_FRAME *
            2;


        let executed =
            0;


        while (
            this.accumulator >= 1 &&
            executed < maxCycles
        ) {

            /*
             * Wykonujemy instrukcję CPU.
             */

            const cycles =
                this.stepCPU();


            if (
                cycles <= 0
            ) {

                /*
                 * CPU musi zawsze konsumować
                 * przynajmniej jeden cykl.
                 */

                this.accumulator =
                    0;

                break;

            }


            this.accumulator -=
                cycles;


            executed +=
                cycles;

            this.cycles +=
                cycles;


            /*
             * PPU pracuje w T-cycles.
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

        }


        /*
         * Frame gotowy?
         */

        if (
            this.ppu &&
            typeof this.ppu.isFrameReady ===
            "function" &&
            this.ppu.isFrameReady()
        ) {

            this.presentFrame();

            this.ppu.consumeFrame();

            this.frame++;

            this.framesThisSecond++;

        }


        /*
         * FPS.
         */

        this.updateFPS(
            delta
        );


        this.raf =
            requestAnimationFrame(
                this.loop.bind(this)
            );

    }


    /*
     * ========================================================
     * CPU STEP
     * ========================================================
     */

    stepCPU() {

        if (
            !this.cpu
        ) {

            return 4;

        }


        let cycles =
            0;


        try {

            if (
                typeof this.cpu.step ===
                "function"
            ) {

                cycles =
                    this.cpu.step();

            } else if (
                typeof this.cpu.tick ===
                "function"
            ) {

                cycles =
                    this.cpu.tick();

            } else if (
                typeof this.cpu.executeInstruction ===
                "function"
            ) {

                cycles =
                    this.cpu.executeInstruction();

            } else if (
                typeof this.cpu.runInstruction ===
                "function"
            ) {

                cycles =
                    this.cpu.runInstruction();

            }

        } catch (
            error
        ) {

            this.log(
                "CPU ERROR: " +
                error.message
            );


            this.pause();


            console.error(
                error
            );


            return 0;

        }


        /*
         * Niektóre CPU zwracają M-cycles
         * zamiast T-cycles.
         *
         * Jeżeli zwrócona wartość jest typowa
         * dla instrukcji GB (1..20), traktujemy
         * ją jako M-cycles.
         */

        if (
            cycles > 0 &&
            cycles <= 20
        ) {

            /*
             * Jeśli CPU posiada informację,
             * że zwraca T-cycles, nie mnożymy.
             */

            if (
                this.cpu.returnsTCycles ===
                true
            ) {

                return cycles;

            }


            if (
                this.cpu.returnsMCycles ===
                true
            ) {

                return cycles * 4;

            }


            /*
             * Najczęstszy model emulatora:
             * CPU step() zwraca T-cycles.
             *
             * Nie zmieniamy automatycznie,
             * ponieważ błędna konwersja CPU
             * powoduje całkowicie złą prędkość.
             */

        }


        return Math.max(
            1,
            Number(
                cycles
            ) || 4
        );

    }


    /*
     * ========================================================
     * PRESENT FRAME
     * ========================================================
     */

    presentFrame() {

        if (
            !this.ppu
        ) {

            return;

        }


        /*
         * PPU sam może renderować.
         */

        if (
            typeof this.ppu.render ===
            "function"
        ) {

            this.ppu.render(
                this.context
            );

            return;

        }


        /*
         * Awaryjny renderer.
         */

        if (
            !this.context ||
            typeof ImageData ===
            "undefined"
        ) {

            return;

        }


        if (
            typeof this.ppu.getRGBABuffer !==
            "function"
        ) {

            return;

        }


        const rgba =
            this.ppu.getRGBABuffer();


        const image =
            new ImageData(
                rgba,
                160,
                144
            );


        this.context.putImageData(
            image,
            0,
            0
        );

    }


    /*
     * ========================================================
     * FPS
     * ========================================================
     */

    updateFPS(
        delta
    ) {

        this.fpsTimer +=
            delta;


        if (
            this.fpsTimer >=
            1000
        ) {

            this.fps =
                this.framesThisSecond;


            this.framesThisSecond =
                0;

            this.fpsTimer -=
                1000;

        }

    }


    /*
     * ========================================================
     * SAVE
     * ========================================================
     */

    save() {

        try {

            const state =
                this.serializeState();


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

        } catch (
            error
        ) {

            this.log(
                "Save ERROR: " +
                error.message
            );


            return false;

        }

    }


    /*
     * ========================================================
     * LOAD
     * ========================================================
     */

    load() {

        try {

            const text =
                localStorage.getItem(
                    this.saveKey
                );


            if (
                !text
            ) {

                this.log(
                    "Brak zapisu."
                );


                return false;

            }


            const state =
                JSON.parse(
                    text
                );


            this.deserializeState(
                state
            );


            this.log(
                "Save wczytany."
            );


            return true;

        } catch (
            error
        ) {

            this.log(
                "Load ERROR: " +
                error.message
            );


            return false;

        }

    }


    /*
     * ========================================================
     * loadFromStorage
     * ========================================================
     *
     * Ta funkcja była wymagana przez Twój index.html.
     *
     * ========================================================
     */

    loadFromStorage() {

        return this.load();

    }


    /*
     * ========================================================
     * saveToStorage
     * ========================================================
     */

    saveToStorage() {

        return this.save();

    }


    /*
     * ========================================================
     * SERIALIZE
     * ========================================================
     */

    serializeState() {

        return {

            version:
                1,

            romName:
                this.romName,

            frame:
                this.frame,

            cycles:
                this.cycles,

            memory:
                this.serializeMemory(),

            cpu:
                this.serializeCPU(),

            ppu:
                this.serializePPU(),

            cartridge:
                this.serializeCartridge()

        };

    }


    /*
     * ========================================================
     * MEMORY SERIALIZE
     * ========================================================
     */

    serializeMemory() {

        const m =
            this.memory;


        return {

            wram:
                this.arrayToBase64(
                    m.wram
                ),

            hram:
                this.arrayToBase64(
                    m.hram
                ),

            vram:
                this.arrayToBase64(
                    m.vram
                ),

            oam:
                this.arrayToBase64(
                    m.oam
                ),

            io:
                this.arrayToBase64(
                    m.io
                ),

            interruptEnable:
                m.interruptEnable,

            interruptFlags:
                m.interruptFlags,

            joyp:
                m.joyp,

            serialData:
                m.serialData,

            serialControl:
                m.serialControl

        };

    }


    /*
     * ========================================================
     * MEMORY DESERIALIZE
     * ========================================================
     */

    deserializeMemory(
        state
    ) {

        if (
            !state
        ) {

            return;

        }


        const m =
            this.memory;


        this.base64ToArray(
            state.wram,
            m.wram
        );


        this.base64ToArray(
            state.hram,
            m.hram
        );


        this.base64ToArray(
            state.vram,
            m.vram
        );


        this.base64ToArray(
            state.oam,
            m.oam
        );


        this.base64ToArray(
            state.io,
            m.io
        );


        if (
            state.interruptEnable !==
            undefined
        ) {

            m.interruptEnable =
                state.interruptEnable;

        }


        if (
            state.interruptFlags !==
            undefined
        ) {

            m.interruptFlags =
                state.interruptFlags;

        }


        if (
            state.joyp !==
            undefined
        ) {

            m.joyp =
                state.joyp;

        }


        if (
            state.serialData !==
            undefined
        ) {

            m.serialData =
                state.serialData;

        }


        if (
            state.serialControl !==
            undefined
        ) {

            m.serialControl =
                state.serialControl;

        }

    }


    /*
     * ========================================================
     * CPU SERIALIZE
     * ========================================================
     */

    serializeCPU() {

        if (
            !this.cpu
        ) {

            return null;

        }


        if (
            typeof this.cpu.getState ===
            "function"
        ) {

            return this.cpu.getState();

        }


        const keys = [

            "a",
            "b",
            "c",
            "d",
            "e",
            "f",
            "h",
            "l",
            "af",
            "bc",
            "de",
            "hl",
            "pc",
            "sp",
            "ime",
            "halted",
            "stopped"

        ];


        const result = {};


        for (
            const key of keys
        ) {

            if (
                key in this.cpu
            ) {

                result[key] =
                    this.cpu[key];

            }

        }


        return result;

    }


    /*
     * ========================================================
     * CPU DESERIALIZE
     * ========================================================
     */

    deserializeCPU(
        state
    ) {

        if (
            !this.cpu ||
            !state
        ) {

            return;

        }


        if (
            typeof this.cpu.setState ===
            "function"
        ) {

            this.cpu.setState(
                state
            );

            return;

        }


        for (
            const key of Object.keys(
                state
            )
        ) {

            if (
                key in this.cpu
            ) {

                this.cpu[key] =
                    state[key];

            }

        }

    }


    /*
     * ========================================================
     * PPU SERIALIZE
     * ========================================================
     */

    serializePPU() {

        if (
            !this.ppu
        ) {

            return null;

        }


        return {

            mode:
                this.ppu.mode,

            lineCycles:
                this.ppu.lineCycles,

            ly:
                this.ppu.ly,

            frameCount:
                this.ppu.frameCount,

            frameReady:
                this.ppu.frameReady,

            frameBuffer:
                this.arrayToBase64(
                    this.ppu.frameBuffer
                )

        };

    }


    /*
     * ========================================================
     * PPU DESERIALIZE
     * ========================================================
     */

    deserializePPU(
        state
    ) {

        if (
            !this.ppu ||
            !state
        ) {

            return;

        }


        if (
            state.mode !==
            undefined
        ) {

            this.ppu.mode =
                state.mode;

        }


        if (
            state.lineCycles !==
            undefined
        ) {

            this.ppu.lineCycles =
                state.lineCycles;

        }


        if (
            state.ly !==
            undefined
        ) {

            this.ppu.ly =
                state.ly;

        }


        if (
            state.frameCount !==
            undefined
        ) {

            this.ppu.frameCount =
                state.frameCount;

        }


        if (
            state.frameReady !==
            undefined
        ) {

            this.ppu.frameReady =
                state.frameReady;

        }


        this.base64ToArray(
            state.frameBuffer,
            this.ppu.frameBuffer
        );

    }


    /*
     * ========================================================
     * CARTRIDGE SERIALIZE
     * ========================================================
     */

    serializeCartridge() {

        if (
            !this.cartridge
        ) {

            return null;

        }


        if (
            typeof this.cartridge.getState ===
            "function"
        ) {

            return this.cartridge.getState();

        }


        const result = {};


        const keys = [

            "ramEnabled",
            "romBank",
            "ramBank",
            "bank",
            "mode"

        ];


        for (
            const key of keys
        ) {

            if (
                key in this.cartridge
            ) {

                result[key] =
                    this.cartridge[key];

            }

        }


        if (
            this.cartridge.ram
        ) {

            result.ram =
                this.arrayToBase64(
                    this.cartridge.ram
                );

        }


        return result;

    }


    /*
     * ========================================================
     * CARTRIDGE DESERIALIZE
     * ========================================================
     */

    deserializeCartridge(
        state
    ) {

        if (
            !this.cartridge ||
            !state
        ) {

            return;

        }


        if (
            typeof this.cartridge.setState ===
            "function"
        ) {

            this.cartridge.setState(
                state
            );

            return;

        }


        for (
            const key of Object.keys(
                state
            )
        ) {

            if (
                key ===
                "ram"
            ) {

                continue;

            }


            if (
                key in this.cartridge
            ) {

                this.cartridge[key] =
                    state[key];

            }

        }


        if (
            state.ram &&
            this.cartridge.ram
        ) {

            this.base64ToArray(
                state.ram,
                this.cartridge.ram
            );

        }

    }


    /*
     * ========================================================
     * DESERIALIZE FULL STATE
     * ========================================================
     */

    deserializeState(
        state
    ) {

        this.stop();


        this.deserializeMemory(
            state.memory
        );


        this.deserializeCPU(
            state.cpu
        );


        this.deserializePPU(
            state.ppu
        );


        this.deserializeCartridge(
            state.cartridge
        );


        this.frame =
            state.frame ||
            0;


        this.cycles =
            state.cycles ||
            0;


        this.connectPPU();


        this.presentFrame();

    }


    /*
     * ========================================================
     * BASE64
     * ========================================================
     */

    arrayToBase64(
        array
    ) {

        if (
            !array
        ) {

            return "";

        }


        let binary =
            "";


        const chunk =
            0x8000;


        for (
            let i = 0;
            i < array.length;
            i += chunk
        ) {

            const end =
                Math.min(
                    i + chunk,
                    array.length
                );


            let part =
                "";


            for (
                let j = i;
                j < end;
                j++
            ) {

                part += String.fromCharCode(
                    array[j]
                );

            }


            binary +=
                part;

        }


        return btoa(
            binary
        );

    }


    /*
     * ========================================================
     * BASE64 -> ARRAY
     * ========================================================
     */

    base64ToArray(
        base64,
        target
    ) {

        if (
            !base64 ||
            !target
        ) {

            return;

        }


        const binary =
            atob(
                base64
            );


        const length =
            Math.min(
                binary.length,
                target.length
            );


        for (
            let i = 0;
            i < length;
            i++
        ) {

            target[i] =
                binary.charCodeAt(
                    i
                );

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


        if (
            typeof this.cartridge.getTitle ===
            "function"
        ) {

            return this.cartridge.getTitle();

        }


        if (
            this.cartridge.title
        ) {

            return this.cartridge.title;

        }


        if (
            this.rom &&
            this.rom.length >=
            0x144
        ) {

            let title =
                "";


            for (
                let i = 0x134;
                i <= 0x143;
                i++
            ) {

                const c =
                    this.rom[i];


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


            return title.trim() ||
                "—";

        }


        return "—";

    }


    /*
     * ========================================================
     * CARTRIDGE TYPE
     * ========================================================
     */

    getCartridgeType() {

        if (
            this.cartridge
        ) {

            if (
                typeof this.cartridge.getTypeName ===
                "function"
            ) {

                return this.cartridge.getTypeName();

            }


            if (
                this.cartridge.typeName
            ) {

                return this.cartridge.typeName;

            }


            if (
                this.cartridge.mbc
            ) {

                return this.cartridge.mbc;

            }

        }


        if (
            this.rom &&
            this.rom.length >
            0x147
        ) {

            const type =
                this.rom[0x147];


            const names = {

                0x00:
                    "ROM",

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
                    "MBC5+RUMBLE+RAM+BATTERY"

            };


            return names[type] ||
                `MBC 0x${type.toString(16)}`;

        }


        return "—";

    }


    /*
     * ========================================================
     * ROM SIZE
     * ========================================================
     */

    getROMSize() {

        if (
            this.rom
        ) {

            return this.rom.length;

        }


        if (
            this.cartridge
        ) {

            if (
                this.cartridge.rom
            ) {

                return this.cartridge.rom.length;

            }


            if (
                typeof this.cartridge.getROMSize ===
                "function"
            ) {

                return this.cartridge.getROMSize();

            }

        }


        return 0;

    }


    /*
     * ========================================================
     * RAM SIZE
     * ========================================================
     */

    getRAMSize() {

        if (
            this.cartridge
        ) {

            if (
                typeof this.cartridge.getRAMSize ===
                "function"
            ) {

                return this.cartridge.getRAMSize();

            }


            if (
                this.cartridge.ram
            ) {

                return this.cartridge.ram.length;

            }

        }


        if (
            this.rom &&
            this.rom.length >
            0x149
        ) {

            const sizes = {

                0x00:
                    0,

                0x01:
                    2048,

                0x02:
                    8192,

                0x03:
                    32768,

                0x04:
                    131072,

                0x05:
                    65536

            };


            return sizes[
                this.rom[0x149]
            ] || 0;

        }


        return 0;

    }


    /*
     * ========================================================
     * ROM BANK
     * ========================================================
     */

    getROMBank() {

        if (
            this.cartridge
        ) {

            if (
                this.cartridge.romBank !==
                undefined
            ) {

                return this.cartridge.romBank;

            }


            if (
                this.cartridge.bank !==
                undefined
            ) {

                return this.cartridge.bank;

            }


            if (
                typeof this.cartridge.getROMBank ===
                "function"
            ) {

                return this.cartridge.getROMBank();

            }

        }


        return 1;

    }


    /*
     * ========================================================
     * GET INFO
     * ========================================================
     *
     * Ta metoda naprawia:
     *
     * TypeError:
     * emulator.getInfo is not a function
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


        return {

            /*
             * ROM
             */

            title:
                this.getCartridgeTitle(),

            cartridge:
                this.getCartridgeType(),

            mbc:
                this.getCartridgeType(),

            romSize:
                this.getROMSize(),

            ramSize:
                this.getRAMSize(),

            romBank:
                this.getROMBank(),


            /*
             * CPU
             */

            cpu:
                "LR35902",

            clock:
                this.CLOCK,

            clockMHz:
                this.CLOCK /
                1000000,


            /*
             * Video
             */

            fps:
                this.fps ||
                this.FPS,

            targetFPS:
                this.FPS,

            frame:
                this.frame,

            cycles:
                this.cycles,


            /*
             * Emulator
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
                0

        };

    }


    /*
     * ========================================================
     * getState
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

            frame:
                this.frame,

            cycles:
                this.cycles,

            fps:
                this.fps,

            romName:
                this.romName

        };

    }


    /*
     * ========================================================
     * destroy
     * ========================================================
     */

    destroy() {

        this.stop();


        this.destroyed =
            true;


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

    }

}
