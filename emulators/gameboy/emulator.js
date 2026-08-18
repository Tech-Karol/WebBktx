/*
 * ============================================================
 * WebBktx — Game Boy Emulator
 * emulator.js
 * ============================================================
 *
 * Łączy:
 *
 *   CPU
 *   Memory
 *   Cartridge
 *   PPU
 *   Timer
 *   Input
 *   Audio
 *
 * Główna pętla:
 *
 *   CPU -> cycles
 *   PPU -> cycles
 *   Timer -> cycles
 *   Audio -> cycles
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


export default class GameBoyEmulator {

    constructor(options = {}) {

        /*
         * ----------------------------------------------------
         * DOM
         * ----------------------------------------------------
         */

        this.canvas =
            options.canvas ||
            null;


        this.logCallback =
            typeof options.log === "function"
                ? options.log
                : null;


        /*
         * ----------------------------------------------------
         * Components
         * ----------------------------------------------------
         */

        this.memory =
            new GameBoyMemory();


        this.cartridge =
            new Cartridge();


        this.cpu =
            new CPU();


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
         * Emulator state
         * ----------------------------------------------------
         */

        this.running =
            false;

        this.paused =
            false;

        this.romLoaded =
            false;


        this.frame =
            0;

        this.totalCycles =
            0;


        this.animationFrame =
            null;


        this.lastTimestamp =
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

        this.FRAME_RATE =
            59.7275;

        this.CYCLES_PER_FRAME =
            Math.round(
                this.CLOCK /
                this.FRAME_RATE
            );


        /*
         * Limit pojedynczej iteracji.
         *
         * Chroni przeglądarkę przed zawieszeniem,
         * jeśli CPU zostanie gdzieś zablokowane.
         */

        this.MAX_CYCLES_PER_UPDATE =
            200000;


        /*
         * ----------------------------------------------------
         * Connect components
         * ----------------------------------------------------
         */

        this.connectComponents();


        /*
         * ----------------------------------------------------
         * Canvas
         * ----------------------------------------------------
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

        if (
            this.logCallback
        ) {

            this.logCallback(
                message
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
         * PPU -> Memory
         */

        if (
            typeof this.ppu.connect ===
            "function"
        ) {

            this.ppu.connect({
                memory:
                    this.createPPUMemoryAdapter(),

                cpu:
                    this.cpu

            });

        }


        /*
         * CPU -> Memory
         */

        this.connectCPU();


        /*
         * Input -> DOM
         */

        if (
            typeof this.input.attach ===
            "function"
        ) {

            this.input.attach();

        }

    }


    /*
     * ========================================================
     * PPU MEMORY ADAPTER
     * ========================================================
     *
     * Twój memory.js posiada:
     *
     *   readByte()
     *   writeByte()
     *
     * PPU oczekuje:
     *
     *   read8()
     *   write8()
     *
     * ========================================================
     */

    createPPUMemoryAdapter() {

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

        /*
         * Różne wersje CPU mogą mieć różne API.
         *
         * Obsługujemy kilka popularnych wariantów.
         */

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
            typeof this.ppu.attachCanvas ===
            "function"
        ) {

            this.ppu.attachCanvas(
                canvas
            );

        }

    }


    /*
     * ========================================================
     * LOAD ROM
     * ========================================================
     */

    async loadROM(
        data,
        filename = "game.gb"
    ) {

        /*
         * Zatrzymaj emulator przed zmianą ROM-u.
         */

        this.pause();


        let rom;


        /*
         * ArrayBuffer
         */

        if (
            data instanceof ArrayBuffer
        ) {

            rom =
                new Uint8Array(
                    data
                );

        }


        /*
         * Uint8Array
         */

        else if (
            data instanceof Uint8Array
        ) {

            rom =
                data;

        }


        /*
         * File
         */

        else if (
            typeof File !== "undefined" &&
            data instanceof File
        ) {

            rom =
                new Uint8Array(
                    await data.arrayBuffer()
                );

        }


        else {

            throw new Error(
                "Nieobsługiwany format ROM."
            );

        }


        if (
            rom.length <
            0x150
        ) {

            throw new Error(
                "ROM jest zbyt mały lub uszkodzony."
            );

        }


        this.log(
            `Ładowanie: ${filename}`
        );


        /*
         * Cartridge
         */

        if (
            typeof this.cartridge.load ===
            "function"
        ) {

            this.cartridge.load(
                rom,
                filename
            );

        } else if (
            typeof this.cartridge.loadROM ===
            "function"
        ) {

            this.cartridge.loadROM(
                rom,
                filename
            );

        } else {

            /*
             * Awaryjny fallback.
             */

            this.cartridge.rom =
                rom;

            this.cartridge.filename =
                filename;

        }


        this.romLoaded =
            true;


        /*
         * Reset całego sprzętu.
         */

        this.resetHardware();


        /*
         * Informacja o ROM-ie.
         */

        const title =
            this.getROMTitle();


        this.log(
            `ROM załadowany: ${title}`
        );


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


    /*
     * ========================================================
     * ROM TITLE
     * ========================================================
     */

    getROMTitle() {

        try {

            /*
             * Najczęściej cartridge udostępnia
             * getTitle().
             */

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


            /*
             * Fallback bezpośrednio z ROM.
             */

            const rom =
                this.cartridge.rom;


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


                return title.trim();

            }

        }

        catch (
            error
        ) {

            console.warn(
                error
            );

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
         * CPU
         */

        if (
            typeof this.cpu.reset ===
            "function"
        ) {

            this.cpu.reset();

        }


        /*
         * Memory
         */

        if (
            typeof this.memory.reset ===
            "function"
        ) {

            this.memory.reset();

        }


        /*
         * Timer
         */

        if (
            typeof this.timer.reset ===
            "function"
        ) {

            this.timer.reset();

        }


        /*
         * Input
         */

        if (
            typeof this.input.reset ===
            "function"
        ) {

            this.input.reset();

        }


        /*
         * Audio
         */

        if (
            typeof this.audio.reset ===
            "function"
        ) {

            this.audio.reset();

        }


        /*
         * PPU
         */

        if (
            typeof this.ppu.reset ===
            "function"
        ) {

            this.ppu.reset();

        }


        this.frame =
            0;

        this.totalCycles =
            0;

        this.accumulator =
            0;


        /*
         * Po resetowaniu CPU powinno dostać dostęp
         * do tego samego Memory Bus.
         */

        this.connectCPU();


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

        const wasRunning =
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
            wasRunning &&
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
                timestamp =>
                    this.loop(
                        timestamp
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
            !this.running &&
            !this.paused
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

        this.paused =
            false;

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
            this.lastTimestamp;


        this.lastTimestamp =
            timestamp;


        /*
         * Przy przełączeniu karty,
         * DevTools itd. delta może być ogromna.
         */

        if (
            delta >
            250
        ) {

            delta =
                250;

        }


        this.accumulator +=
            (
                delta /
                1000
            ) *
            this.CLOCK;


        let cycles =
            Math.floor(
                this.accumulator
            );


        /*
         * Nie pozwalamy przetworzyć
         * nieskończonej liczby cykli.
         */

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
         * Renderuj gotową klatkę.
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
                t =>
                    this.loop(
                        t
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
            cycles;


        while (
            remaining > 0
        ) {

            /*
             * CPU step.
             */

            let used =
                this.stepCPU();


            /*
             * Awaryjny fallback.
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
             * Nie wykonujemy więcej niż
             * pozostało w tej aktualizacji.
             */

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

                this.stepTimer(
                    used
                );

            }


            /*
             * Audio.
             */

            if (
                this.audio
            ) {

                this.stepAudio(
                    used
                );

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


        /*
         * Standard:
         *
         * cpu.step()
         */

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


            /*
             * Niektóre CPU zwracają:
             *
             * { cycles: 4 }
             */

            if (
                result &&
                typeof result.cycles ===
                "number"
            ) {

                return result.cycles;

            }


            return 4;

        }


        /*
         * Alternatywa:
         *
         * cpu.executeInstruction()
         */

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
     * TIMER STEP
     * ========================================================
     */

    stepTimer(
        cycles
    ) {

        if (
            typeof this.timer.step ===
            "function"
        ) {

            this.timer.step(
                cycles
            );

            return;

        }


        if (
            typeof this.timer.tick ===
            "function"
        ) {

            this.timer.tick(
                cycles
            );

        }

    }


    /*
     * ========================================================
     * AUDIO STEP
     * ========================================================
     */

    stepAudio(
        cycles
    ) {

        if (
            typeof this.audio.step ===
            "function"
        ) {

            this.audio.step(
                cycles
            );

            return;

        }


        if (
            typeof this.audio.tick ===
            "function"
        ) {

            this.audio.tick(
                cycles
            );

        }

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

            return null;

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
                "Brak danych SRAM do zapisania."
            );

            return null;

        }


        const copy =
            data instanceof Uint8Array
                ? new Uint8Array(data)
                : new Uint8Array(data);


        const key =
            this.getSaveKey();


        try {

            localStorage.setItem(
                key,
                this.bytesToBase64(
                    copy
                )
            );

            this.log(
                "Save zapisany."
            );

            return copy;

        }
        catch (
            error
        ) {

            console.error(
                error
            );

            this.log(
                "Nie udało się zapisać Save."
            );

            return null;

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


        const key =
            this.getSaveKey();


        try {

            const encoded =
                localStorage.getItem(
                    key
                );


            if (
                !encoded
            ) {

                this.log(
                    "Brak zapisanego Save."
                );

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
        catch (
            error
        ) {

            console.error(
                error
            );

            this.log(
                "Błąd wczytywania Save."
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
            "webbktx.gb.save." +
            title
                .replace(
                    /[^a-z0-9]/gi,
                    "_"
                )
                .toLowerCase()
        );

    }


    /*
     * ========================================================
     * BASE64
     * ========================================================
     */

    bytesToBase64(
        bytes
    ) {

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


    base64ToBytes(
        value
    ) {

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
                binary.charCodeAt(
                    i
                );

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


        const target =
            this.canvas.parentElement ||
            this.canvas;


        if (
            document.fullscreenElement
        ) {

            await document.exitFullscreen();

            return;

        }


        if (
            target.requestFullscreen
        ) {

            await target.requestFullscreen();

        }

    }


    /*
     * ========================================================
     * GET STATE
     * ========================================================
     */

    getState() {

        const cpuState =
            this.cpu &&
            typeof this.cpu.getState ===
            "function"
                ? this.cpu.getState()
                : {};


        const ppuState =
            this.ppu &&
            typeof this.ppu.getState ===
            "function"
                ? this.ppu.getState()
                : {};


        const cartridgeState =
            this.cartridge &&
            typeof this.cartridge.getState ===
            "function"
                ? this.cartridge.getState()
                : {};


        return {

            running:
                this.running,

            paused:
                this.paused,

            romLoaded:
                this.romLoaded,

            frame:
                this.frame,

            totalCycles:
                this.totalCycles,

            clock:
                this.CLOCK,

            fps:
                this.FRAME_RATE,

            cpu:
                cpuState,

            ppu:
                ppuState,

            cartridge:
                cartridgeState

        };

    }


    /*
     * ========================================================
     * DEBUG
     * ========================================================
     */

    debugState() {

        const state =
            this.getState();


        console.log(
            "WebBktx Game Boy",
            state
        );


        return state;

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


        this.canvas =
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

        this.memory =
            null;

    }

}
