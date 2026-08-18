/*
 * ============================================================
 * WebBktx — Game Boy Emulator
 * emulator.js
 * ============================================================
 */

import CPU from "./cpu.js";
import GameBoyMemory from "./memory.js";
import PPU from "./ppu.js";
import Timer from "./timer.js";
import Input from "./input.js";
import Audio from "./audio.js";
import Cartridge from "./cartridge.js";


export default class GameBoyEmulator {

    constructor(options = {}) {

        this.canvas = options.canvas || null;

        this.logCallback =
            typeof options.log === "function"
                ? options.log
                : null;

        /*
         * ----------------------------------------------------
         * Hardware
         * ----------------------------------------------------
         */

        this.memory = new GameBoyMemory();
        this.cartridge = new Cartridge();
        this.cpu = new CPU();
        this.ppu = new PPU();
        this.timer = new Timer();
        this.input = new Input();
        this.audio = new Audio();

        /*
         * ----------------------------------------------------
         * State
         * ----------------------------------------------------
         */

        this.running = false;
        this.paused = false;
        this.romLoaded = false;

        this.frame = 0;
        this.totalCycles = 0;

        this.animationFrame = null;
        this.lastTimestamp = 0;
        this.accumulator = 0;

        /*
         * ----------------------------------------------------
         * Game Boy timing
         * ----------------------------------------------------
         */

        this.CLOCK = 4194304;

        this.FRAME_RATE = 59.7275;

        this.CYCLES_PER_FRAME =
            Math.round(
                this.CLOCK /
                this.FRAME_RATE
            );

        this.MAX_CYCLES_PER_UPDATE =
            200000;

        /*
         * ----------------------------------------------------
         * Connect everything
         * ----------------------------------------------------
         */

        this.connectComponents();

        if (this.canvas) {
            this.attachCanvas(this.canvas);
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

    log(message) {

        console.log(
            "[WebBktx]",
            message
        );

        if (this.logCallback) {
            this.logCallback(message);
        }
    }


    /*
     * ========================================================
     * CONNECT
     * ========================================================
     */

    connectComponents() {

        /*
         * Memory -> Cartridge
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
         * Memory -> PPU
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
         * Memory -> Timer
         */

        if (
            typeof this.memory.connectTimer ===
            "function"
        ) {

            this.memory.connectTimer(
                this.timer
            );

        }


        /*
         * Memory -> Input
         */

        if (
            typeof this.memory.connectInput ===
            "function"
        ) {

            this.memory.connectInput(
                this.input
            );

        }


        /*
         * Memory -> Audio
         */

        if (
            typeof this.memory.connectAudio ===
            "function"
        ) {

            this.memory.connectAudio(
                this.audio
            );

        }


        /*
         * PPU
         *
         * Adapter because Memory uses:
         *
         * readByte()
         * writeByte()
         */

        if (
            typeof this.ppu.connect ===
            "function"
        ) {

            this.ppu.connect({

                memory:
                    this.createPPUAdapter(),

                cpu:
                    this.cpu

            });

        }


        /*
         * CPU
         */

        this.connectCPU();

    }


    /*
     * ========================================================
     * PPU ADAPTER
     * ========================================================
     */

    createPPUAdapter() {

        return {

            read8:
                address => {

                    return this.memory.readByte(
                        address
                    );

                },


            write8:
                (
                    address,
                    value
                ) => {

                    this.memory.writeByte(
                        address,
                        value
                    );

                }

        };

    }


    /*
     * ========================================================
     * CPU CONNECTION
     * ========================================================
     */

    connectCPU() {

        if (
            typeof this.cpu.connect ===
            "function"
        ) {

            this.cpu.connect({

                memory:
                    this.memory,

                bus:
                    this.memory,

                emulator:
                    this

            });

            return;

        }


        /*
         * Compatibility z prostszymi CPU.
         */

        this.cpu.memory =
            this.memory;

        this.cpu.bus =
            this.memory;

    }


    /*
     * ========================================================
     * CANVAS
     * ========================================================
     */

    attachCanvas(canvas) {

        this.canvas =
            canvas;

        if (
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

            this.pause();


            /*
             * ------------------------------------------------
             * Convert source -> Uint8Array
             * ------------------------------------------------
             */

            let rom;


            if (
                source instanceof Uint8Array
            ) {

                rom =
                    source;

            }
            else if (
                source instanceof ArrayBuffer
            ) {

                rom =
                    new Uint8Array(
                        source
                    );

            }
            else if (
                typeof Blob !== "undefined" &&
                source instanceof Blob
            ) {

                rom =
                    new Uint8Array(
                        await source.arrayBuffer()
                    );

            }
            else {

                throw new Error(
                    "Nieobsługiwany typ ROM."
                );

            }


            /*
             * ------------------------------------------------
             * Basic validation
             * ------------------------------------------------
             */

            if (
                rom.length <
                0x150
            ) {

                throw new Error(
                    "ROM jest za mały."
                );

            }


            this.log(
                `Ładowanie: ${filename}`
            );


            /*
             * ------------------------------------------------
             * Cartridge
             * ------------------------------------------------
             */

            let loaded =
                false;


            /*
             * API #1
             *
             * cartridge.load(rom)
             */

            if (
                typeof this.cartridge.load ===
                "function"
            ) {

                const result =
                    this.cartridge.load(
                        rom,
                        filename
                    );


                /*
                 * load() może być async.
                 */

                if (
                    result instanceof Promise
                ) {

                    await result;

                }


                loaded =
                    true;

            }


            /*
             * API #2
             *
             * cartridge.loadROM(rom)
             */

            else if (
                typeof this.cartridge.loadROM ===
                "function"
            ) {

                const result =
                    this.cartridge.loadROM(
                        rom,
                        filename
                    );


                if (
                    result instanceof Promise
                ) {

                    await result;

                }


                loaded =
                    true;

            }


            /*
             * API #3
             *
             * Bezpośrednie podłączenie ROM.
             *
             * Przydatne dla prostego Cartridge.
             */

            else {

                this.cartridge.rom =
                    new Uint8Array(
                        rom
                    );

                this.cartridge.romData =
                    this.cartridge.rom;

                this.cartridge.filename =
                    filename;

                loaded =
                    true;

            }


            if (
                !loaded
            ) {

                throw new Error(
                    "Cartridge nie obsługuje ładowania ROM."
                );

            }


            /*
             * ------------------------------------------------
             * ROM loaded
             * ------------------------------------------------
             */

            this.romLoaded =
                true;


            /*
             * ------------------------------------------------
             * Reset hardware
             * ------------------------------------------------
             */

            this.resetHardware();


            /*
             * ------------------------------------------------
             * ROM info
             * ------------------------------------------------
             */

            const title =
                this.getROMTitle();


            this.log(
                `ROM załadowany: ${title}`
            );


            /*
             * Save
             */

            this.loadSave();


            this.log(
                "ROM gotowy do uruchomienia."
            );


            return {

                title:
                    title,

                size:
                    rom.length,

                filename:
                    filename

            };

        }
        catch (error) {

            console.error(
                "WebBktx ROM ERROR:",
                error
            );


            this.romLoaded =
                false;


            this.log(
                "Nie udało się załadować: " +
                error.message
            );


            /*
             * Bardzo ważne:
             * nie połykamy błędu.
             */

            throw error;

        }

    }


    /*
     * ========================================================
     * ROM TITLE
     * ========================================================
     */

    getROMTitle() {

        /*
         * Cartridge API.
         */

        try {

            if (
                typeof this.cartridge.getTitle ===
                "function"
            ) {

                const title =
                    this.cartridge.getTitle();

                if (
                    title
                ) {

                    return title;

                }

            }

        }
        catch (_) {}


        if (
            this.cartridge.title
        ) {

            return this.cartridge.title;

        }


        /*
         * Fallback:
         * odczyt z ROM.
         */

        const rom =
            this.cartridge.rom ||
            this.cartridge.romData;


        if (
            rom &&
            rom.length >=
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
                    rom[i];


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


            if (
                title.trim()
            ) {

                return title.trim();

            }

        }


        return "GAME BOY";

    }


    /*
     * ========================================================
     * RESET HARDWARE
     * ========================================================
     */

    resetHardware() {

        /*
         * Memory FIRST.
         */

        if (
            typeof this.memory.reset ===
            "function"
        ) {

            this.memory.reset();

        }


        /*
         * CPU.
         */

        if (
            typeof this.cpu.reset ===
            "function"
        ) {

            this.cpu.reset();

        }


        /*
         * Timer.
         */

        if (
            typeof this.timer.reset ===
            "function"
        ) {

            this.timer.reset();

        }


        /*
         * Input.
         */

        if (
            typeof this.input.reset ===
            "function"
        ) {

            this.input.reset();

        }


        /*
         * Audio.
         */

        if (
            typeof this.audio.reset ===
            "function"
        ) {

            this.audio.reset();

        }


        /*
         * PPU LAST.
         */

        if (
            typeof this.ppu.reset ===
            "function"
        ) {

            this.ppu.reset();

        }


        /*
         * CPU needs Memory again.
         */

        this.connectCPU();


        this.frame =
            0;

        this.totalCycles =
            0;

        this.accumulator =
            0;


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

        const running =
            this.running;


        this.pause();


        this.resetHardware();


        if (
            this.ppu &&
            typeof this.ppu.render ===
            "function"
        ) {

            this.ppu.render();

        }


        if (
            running &&
            this.romLoaded
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
            !this.romLoaded
        ) {

            this.log(
                "Brak ROM."
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


        this.accumulator =
            0;


        this.log(
            "Emulator uruchomiony."
        );


        this.log(
            "Emulator START."
        );


        this.animationFrame =
            requestAnimationFrame(
                time =>
                    this.loop(
                        time
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
            this.animationFrame !==
            null
        ) {

            cancelAnimationFrame(
                this.animationFrame
            );

            this.animationFrame =
                null;

        }


        const wasRunning =
            this.running;


        this.running =
            false;

        this.paused =
            true;


        if (
            wasRunning
        ) {

            this.log(
                "Emulator zatrzymany."
            );

            this.log(
                "Emulator PAUSE."
            );

        }

    }


    /*
     * ========================================================
     * LOOP
     * ========================================================
     */

    loop(timestamp) {

        if (
            !this.running
        ) {

            return;

        }


        let delta =
            timestamp -
            this.lastTimestamp;


        this.lastTimestamp =
            timestamp;


        /*
         * Tab został uśpiony.
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


        /*
         * Convert milliseconds
         * to Game Boy CPU cycles.
         */

        this.accumulator +=
            (
                delta *
                this.CLOCK
            ) /
            1000;


        let cycles =
            Math.floor(
                this.accumulator
            );


        cycles =
            Math.min(
                cycles,
                this.MAX_CYCLES_PER_UPDATE
            );


        if (
            cycles > 0
        ) {

            this.runCycles(
                cycles
            );


            this.accumulator -=
                cycles;

        }


        /*
         * Render frame.
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


        this.animationFrame =
            requestAnimationFrame(
                time =>
                    this.loop(
                        time
                    )
            );

    }


    /*
     * ========================================================
     * RUN CYCLES
     * ========================================================
     */

    runCycles(cycles) {

        let remaining =
            cycles;


        while (
            remaining > 0
        ) {

            let used =
                this.stepCPU();


            /*
             * CPU musi zwrócić liczbę cykli.
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


            this.totalCycles +=
                used;


            remaining -=
                used;

        }

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


        if (
            typeof this.cpu.step ===
            "function"
        ) {

            const result =
                this.cpu.step();


            if (
                typeof result ===
                "number"
            ) {

                return result;

            }


            if (
                result &&
                typeof result.cycles ===
                "number"
            ) {

                return result.cycles;

            }


            return 4;

        }


        if (
            typeof this.cpu.executeInstruction ===
            "function"
        ) {

            const result =
                this.cpu.executeInstruction();


            if (
                typeof result ===
                "number"
            ) {

                return result;

            }


            return 4;

        }


        return 4;

    }


    /*
     * ========================================================
     * SAVE
     * ========================================================
     */

    save() {

        if (
            !this.romLoaded
        ) {

            return false;

        }


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
            typeof this.cartridge.getRAM ===
            "function"
        ) {

            data =
                this.cartridge.getRAM();

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

            this.log(
                "Brak RAM Save."
            );

            return false;

        }


        const bytes =
            data instanceof Uint8Array
                ? data
                : new Uint8Array(data);


        try {

            localStorage.setItem(
                this.getSaveKey(),
                this.bytesToBase64(
                    bytes
                )
            );


            this.log(
                "Save zapisany."
            );


            return true;

        }
        catch (error) {

            console.error(
                error
            );


            this.log(
                "Błąd zapisu Save."
            );


            return false;

        }

    }


    /*
     * ========================================================
     * LOAD SAVE
     * ========================================================
     */

    loadSave() {

        if (
            !this.romLoaded
        ) {

            return false;

        }


        try {

            const encoded =
                localStorage.getItem(
                    this.getSaveKey()
                );


            if (
                !encoded
            ) {

                return false;

            }


            const data =
                this.base64ToBytes(
                    encoded
                );


            if (
                typeof this.cartridge.loadSaveData ===
                "function"
            ) {

                this.cartridge.loadSaveData(
                    data
                );

            }
            else if (
                typeof this.cartridge.loadRAM ===
                "function"
            ) {

                this.cartridge.loadRAM(
                    data
                );

            }
            else if (
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

        }
        catch (error) {

            console.error(
                error
            );

            return false;

        }

    }


    /*
     * ========================================================
     * SAVE KEY
     * ========================================================
     */

    getSaveKey() {

        const title =
            this.getROMTitle();


        return (
            "webbktx.gb." +
            title
                .replace(
                    /[^a-z0-9]/gi,
                    "_"
                )
                .toLowerCase() +
            ".save"
        );

    }


    /*
     * ========================================================
     * BASE64
     * ========================================================
     */

    bytesToBase64(bytes) {

        let binary =
            "";


        const chunk =
            0x8000;


        for (
            let i = 0;
            i < bytes.length;
            i += chunk
        ) {

            const part =
                bytes.subarray(
                    i,
                    Math.min(
                        i + chunk,
                        bytes.length
                    )
                );


            binary +=
                String.fromCharCode(
                    ...part
                );

        }


        return btoa(
            binary
        );

    }


    base64ToBytes(value) {

        const binary =
            atob(
                value
            );


        const bytes =
            new Uint8Array(
                binary.length
            );


        for (
            let i = 0;
            i < binary.length;
            i++
        ) {

            bytes[i] =
                binary.charCodeAt(i);

        }


        return bytes;

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

            return;

        }


        const element =
            this.canvas.parentElement ||
            this.canvas;


        if (
            document.fullscreenElement
        ) {

            await document.exitFullscreen();

            return;

        }


        if (
            element.requestFullscreen
        ) {

            await element.requestFullscreen();

        }

    }


    /*
     * ========================================================
     * STATE
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
                this.totalCycles,

            clock:
                this.CLOCK,

            fps:
                this.FRAME_RATE,

            cpu:
                this.cpu &&
                typeof this.cpu.getState ===
                "function"
                    ? this.cpu.getState()
                    : {},

            ppu:
                this.ppu &&
                typeof this.ppu.getState ===
                "function"
                    ? this.ppu.getState()
                    : {},

            cartridge:
                this.cartridge &&
                typeof this.cartridge.getState ===
                "function"
                    ? this.cartridge.getState()
                    : {}

        };

    }


    /*
     * ========================================================
     * DESTROY
     * ========================================================
     */

    destroy() {

        this.pause();


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

    }

}
