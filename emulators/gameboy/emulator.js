/*
 * ============================================================
 * WebBktx — Nintendo Game Boy Emulator
 * emulator.js
 * ============================================================
 *
 * Główna warstwa emulatora:
 *
 * ROM
 *  ↓
 * Cartridge
 *  ↓
 * Memory
 *  ↓
 * CPU
 *  ├── PPU
 *  ├── Timer
 *  ├── Audio
 *  └── Input
 *
 * Game Boy DMG:
 *
 * CPU: Sharp LR35902
 * Clock: 4,194,304 Hz
 * Display: 160 × 144
 * FPS: ~59.73
 *
 * ============================================================
 */

import CPU from "./cpu.js";
import Memory from "./memory.js";
import Cartridge from "./cartridge.js";
import PPU from "./ppu.js";
import Timer from "./timer.js";
import Audio from "./audio.js";
import Input from "./input.js";


export default class GameBoyEmulator {

    constructor(options = {}) {

        /*
         * ----------------------------------------------------
         * Opcje
         * ----------------------------------------------------
         */

        this.options = {

            audio:
                options.audio !== false,

            debug:
                options.debug === true,

            autoStart:
                options.autoStart === true

        };


        /*
         * ----------------------------------------------------
         * Hardware timing
         * ----------------------------------------------------
         */

        this.CLOCK =
            4194304;

        this.FPS =
            59.7275;

        this.CYCLES_PER_FRAME =
            this.CLOCK /
            this.FPS;


        /*
         * ----------------------------------------------------
         * Emulator state
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
         * Timing
         * ----------------------------------------------------
         */

        this.lastTime =
            0;

        this.timeAccumulator =
            0;

        this.totalCycles =
            0;

        this.frameCount =
            0;


        /*
         * ----------------------------------------------------
         * ROM
         * ----------------------------------------------------
         */

        this.romLoaded =
            false;


        /*
         * ----------------------------------------------------
         * Hardware
         * ----------------------------------------------------
         */

        this.cartridge =
            new Cartridge();

        this.memory =
            null;

        this.cpu =
            null;

        this.ppu =
            null;

        this.timer =
            null;

        this.audio =
            null;

        this.input =
            null;


        /*
         * ----------------------------------------------------
         * Display
         * ----------------------------------------------------
         */

        this.canvas =
            null;

        this.context =
            null;


        /*
         * ----------------------------------------------------
         * Animation
         * ----------------------------------------------------
         */

        this.animationFrame =
            null;


        /*
         * ----------------------------------------------------
         * Events
         * ----------------------------------------------------
         */

        this.onFrame =
            options.onFrame || null;

        this.onStatus =
            options.onStatus || null;

        this.onError =
            options.onError || null;


        /*
         * ----------------------------------------------------
         * Bind
         * ----------------------------------------------------
         */

        this.loop =
            this.loop.bind(this);


        this.log(
            "GameBoyEmulator initialized."
        );

    }


    /*
     * ========================================================
     * LOG
     * ========================================================
     */

    log(...args) {

        if (
            this.options.debug
        ) {

            console.log(
                "[WebBktx:GB]",
                ...args
            );

        }

    }


    /*
     * ========================================================
     * STATUS
     * ========================================================
     */

    status(
        message
    ) {

        this.log(
            message
        );


        if (
            typeof this.onStatus ===
            "function"
        ) {

            this.onStatus(
                message
            );

        }

    }


    /*
     * ========================================================
     * ERROR
     * ========================================================
     */

    reportError(
        error
    ) {

        console.error(
            "[WebBktx:GB]",
            error
        );


        if (
            typeof this.onError ===
            "function"
        ) {

            this.onError(
                error
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

        if (
            !canvas
        ) {

            throw new Error(
                "GameBoyEmulator: canvas nie istnieje."
            );

        }


        this.canvas =
            canvas;


        this.canvas.width =
            160;

        this.canvas.height =
            144;


        this.context =
            this.canvas.getContext(
                "2d",
                {
                    alpha: false
                }
            );


        if (
            !this.context
        ) {

            throw new Error(
                "Nie można utworzyć kontekstu Canvas."
            );

        }


        /*
         * Piksele Game Boya
         * nie powinny być wygładzane.
         */

        this.context.imageSmoothingEnabled =
            false;


        this.clearScreen();


        /*
         * Jeżeli PPU już istnieje,
         * przekazujemy canvas.
         */

        if (
            this.ppu &&
            typeof this.ppu.attachCanvas ===
            "function"
        ) {

            this.ppu.attachCanvas(
                this.canvas
            );

        }


        this.status(
            "Canvas podłączony."
        );

    }


    /*
     * ========================================================
     * CLEAR SCREEN
     * ========================================================
     */

    clearScreen() {

        if (
            !this.context
        ) {

            return;

        }


        this.context.fillStyle =
            "#000000";


        this.context.fillRect(
            0,
            0,
            160,
            144
        );

    }


    /*
     * ========================================================
     * LOAD ROM
     * ========================================================
     */

    loadROM(
        data
    ) {

        try {

            this.pause();


            /*
             * ------------------------------------------------
             * Cartridge
             * ------------------------------------------------
             */

            this.cartridge.load(
                data
            );


            /*
             * ------------------------------------------------
             * Memory
             * ------------------------------------------------
             */

            this.memory =
                new Memory(
                    this.cartridge
                );


            /*
             * ------------------------------------------------
             * PPU
             * ------------------------------------------------
             */

            this.ppu =
                new PPU(
                    this.memory
                );


            /*
             * ------------------------------------------------
             * Timer
             * ------------------------------------------------
             */

            this.timer =
                new Timer(
                    this.memory
                );


            /*
             * ------------------------------------------------
             * Audio
             * ------------------------------------------------
             */

            if (
                this.options.audio
            ) {

                this.audio =
                    new Audio(
                        this.memory
                    );

            } else {

                this.audio =
                    null;

            }


            /*
             * ------------------------------------------------
             * Input
             * ------------------------------------------------
             */

            this.input =
                new Input(
                    this.memory
                );


            /*
             * ------------------------------------------------
             * CPU
             * ------------------------------------------------
             */

            this.cpu =
                new CPU(
                    this.memory
                );


            /*
             * ------------------------------------------------
             * Połączenie komponentów
             * ------------------------------------------------
             */

            this.connectComponents();


            /*
             * ------------------------------------------------
             * Canvas → PPU
             * ------------------------------------------------
             */

            if (
                this.canvas &&
                this.ppu &&
                typeof this.ppu.attachCanvas ===
                "function"
            ) {

                this.ppu.attachCanvas(
                    this.canvas
                );

            }


            /*
             * ------------------------------------------------
             * Reset
             * ------------------------------------------------
             */

            this.reset();


            this.romLoaded =
                true;


            this.status(
                "ROM załadowany: " +
                (
                    this.cartridge.title ||
                    "Unknown"
                )
            );


            return true;

        } catch (
            error
        ) {

            this.reportError(
                error
            );


            return false;

        }

    }


    /*
     * ========================================================
     * CONNECT COMPONENTS
     * ========================================================
     */

    connectComponents() {

        /*
         * Memory może posiadać własny system
         * podłączania urządzeń.
         */

        if (
            this.memory &&
            typeof this.memory.connect ===
            "function"
        ) {

            this.memory.connect({

                cpu:
                    this.cpu,

                ppu:
                    this.ppu,

                timer:
                    this.timer,

                audio:
                    this.audio,

                input:
                    this.input,

                cartridge:
                    this.cartridge

            });

        }


        /*
         * PPU
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
         * Timer
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
         * Audio
         */

        if (
            this.audio &&
            typeof this.audio.connect ===
            "function"
        ) {

            this.audio.connect({

                memory:
                    this.memory,

                cpu:
                    this.cpu

            });

        }


        /*
         * Input
         */

        if (
            this.input &&
            typeof this.input.connect ===
            "function"
        ) {

            this.input.connect({

                memory:
                    this.memory,

                cpu:
                    this.cpu

            });

        }

    }


    /*
     * ========================================================
     * RESET
     * ========================================================
     */

    reset() {

        this.pause();


        /*
         * Timing
         */

        this.lastTime =
            0;

        this.timeAccumulator =
            0;

        this.totalCycles =
            0;

        this.frameCount =
            0;


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
         * Memory
         */

        if (
            this.memory &&
            typeof this.memory.reset ===
            "function"
        ) {

            this.memory.reset();

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
         * Audio
         */

        if (
            this.audio &&
            typeof this.audio.reset ===
            "function"
        ) {

            this.audio.reset();

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


        this.clearScreen();


        this.status(
            "Game Boy zresetowany."
        );

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

            throw new Error(
                "Emulator został zniszczony."
            );

        }


        if (
            !this.romLoaded ||
            !this.cpu
        ) {

            throw new Error(
                "Najpierw załaduj ROM."
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

        this.started =
            true;


        this.lastTime =
            performance.now();


        this.timeAccumulator =
            0;


        this.animationFrame =
            requestAnimationFrame(
                this.loop
            );


        this.status(
            "Emulator uruchomiony."
        );

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


        this.status(
            "Emulator zatrzymany."
        );

    }


    /*
     * ========================================================
     * RESUME
     * ========================================================
     */

    resume() {

        if (
            !this.romLoaded ||
            !this.cpu
        ) {

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


        this.lastTime =
            performance.now();


        this.timeAccumulator =
            0;


        this.animationFrame =
            requestAnimationFrame(
                this.loop
            );


        this.status(
            "Emulator wznowiony."
        );

    }


    /*
     * ========================================================
     * TOGGLE PAUSE
     * ========================================================
     */

    togglePause() {

        if (
            this.running
        ) {

            this.pause();

        } else {

            this.resume();

        }

    }


    /*
     * ========================================================
     * MAIN BROWSER LOOP
     * ========================================================
     */

    loop(
        timestamp
    ) {

        if (
            !this.running ||
            this.destroyed
        ) {

            return;

        }


        /*
         * Delta czasu w ms.
         */

        let delta =
            timestamp -
            this.lastTime;


        this.lastTime =
            timestamp;


        /*
         * Gdy karta była długo
         * nieaktywna, nie próbujemy
         * wykonywać sekund emulatora
         * za jednym razem.
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
         * Przeliczamy czas rzeczywisty
         * na cykle CPU.
         */

        this.timeAccumulator +=
            (
                delta /
                1000
            ) *
            this.CLOCK;


        /*
         * Maksymalnie kilka klatek
         * backlogu.
         */

        const maxCycles =
            this.CYCLES_PER_FRAME * 4;


        let cycles =
            Math.floor(
                this.timeAccumulator
            );


        if (
            cycles > maxCycles
        ) {

            cycles =
                maxCycles;

        }


        if (
            cycles > 0
        ) {

            this.timeAccumulator -=
                cycles;


            this.runCycles(
                cycles
            );

        }


        /*
         * Kolejna klatka przeglądarki.
         */

        this.animationFrame =
            requestAnimationFrame(
                this.loop
            );

    }


    /*
     * ========================================================
     * RUN CPU CYCLES
     * ========================================================
     */

    runCycles(
        cycles
    ) {

        if (
            !this.cpu
        ) {

            return;

        }


        let executed =
            0;


        while (
            executed < cycles
        ) {

            let used =
                0;


            /*
             * Główna metoda CPU.
             */

            if (
                typeof this.cpu.step ===
                "function"
            ) {

                used =
                    this.cpu.step();

            }


            /*
             * Alternatywa.
             */

            else if (
                typeof this.cpu.tick ===
                "function"
            ) {

                used =
                    this.cpu.tick();

            }


            /*
             * Brak CPU API.
             */

            else {

                throw new Error(
                    "CPU musi posiadać step() lub tick()."
                );

            }


            /*
             * CPU powinno zwrócić liczbę
             * cykli wykorzystanych przez
             * instrukcję.
             */

            if (
                !Number.isFinite(
                    used
                ) ||
                used <= 0
            ) {

                /*
                 * Tymczasowy fallback.
                 *
                 * Docelowo CPU zawsze musi
                 * zwracać poprawne cykle.
                 */

                used =
                    4;

            }


            executed +=
                used;


            this.totalCycles +=
                used;


            /*
             * Reszta hardware.
             */

            this.tickHardware(
                used
            );

        }


        /*
         * PPU może być gotowe
         * do wyświetlenia nowej klatki.
         */

        this.renderIfReady();

    }


    /*
     * ========================================================
     * HARDWARE TICK
     * ========================================================
     */

    tickHardware(
        cycles
    ) {

        /*
         * ----------------------------------------------------
         * PPU
         * ----------------------------------------------------
         */

        if (
            this.ppu
        ) {

            if (
                typeof this.ppu.step ===
                "function"
            ) {

                this.ppu.step(
                    cycles
                );

            }

            else if (
                typeof this.ppu.tick ===
                "function"
            ) {

                this.ppu.tick(
                    cycles
                );

            }

        }


        /*
         * ----------------------------------------------------
         * Timer
         * ----------------------------------------------------
         */

        if (
            this.timer
        ) {

            if (
                typeof this.timer.step ===
                "function"
            ) {

                this.timer.step(
                    cycles
                );

            }

            else if (
                typeof this.timer.tick ===
                "function"
            ) {

                this.timer.tick(
                    cycles
                );

            }

        }


        /*
         * ----------------------------------------------------
         * Audio
         * ----------------------------------------------------
         */

        if (
            this.audio
        ) {

            if (
                typeof this.audio.step ===
                "function"
            ) {

                this.audio.step(
                    cycles
                );

            }

            else if (
                typeof this.audio.tick ===
                "function"
            ) {

                this.audio.tick(
                    cycles
                );

            }

        }


        /*
         * ----------------------------------------------------
         * Input
         * ----------------------------------------------------
         */

        if (
            this.input &&
            typeof this.input.step ===
            "function"
        ) {

            this.input.step(
                cycles
            );

        }

    }


    /*
     * ========================================================
     * FRAME READY
     * ========================================================
     */

    renderIfReady() {

        if (
            !this.ppu
        ) {

            return;

        }


        let ready =
            false;


        /*
         * Popularna flaga PPU.
         */

        if (
            this.ppu.frameReady ===
            true
        ) {

            ready =
                true;

        }


        /*
         * Alternatywna metoda.
         */

        if (
            typeof this.ppu.isFrameReady ===
            "function"
        ) {

            if (
                this.ppu.isFrameReady()
            ) {

                ready =
                    true;

            }

        }


        if (
            !ready
        ) {

            return;

        }


        /*
         * Reset flagi.
         */

        if (
            "frameReady" in this.ppu
        ) {

            this.ppu.frameReady =
                false;

        }


        /*
         * Render.
         */

        this.render();


        this.frameCount++;


        if (
            typeof this.onFrame ===
            "function"
        ) {

            this.onFrame(
                this.frameCount
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
            !this.ppu
        ) {

            return;

        }


        /*
         * PPU ma własny renderer.
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
         * PPU daje framebuffer.
         */

        if (
            typeof this.ppu.getFrameBuffer ===
            "function"
        ) {

            const frame =
                this.ppu.getFrameBuffer();


            if (
                frame
            ) {

                this.drawFrame(
                    frame
                );

            }

        }

    }


    /*
     * ========================================================
     * DRAW FRAMEBUFFER
     * ========================================================
     */

    drawFrame(
        frame
    ) {

        if (
            !this.context
        ) {

            return;

        }


        /*
         * ----------------------------------------------------
         * RGBA
         * ----------------------------------------------------
         */

        if (
            frame instanceof
            Uint8ClampedArray &&
            frame.length ===
            160 * 144 * 4
        ) {

            const image =
                new ImageData(
                    frame,
                    160,
                    144
                );


            this.context.putImageData(
                image,
                0,
                0
            );


            return;

        }


        /*
         * ----------------------------------------------------
         * Grayscale Game Boy 0-3
         * ----------------------------------------------------
         */

        if (
            frame instanceof
            Uint8Array &&
            frame.length ===
            160 * 144
        ) {

            const image =
                this.context.createImageData(
                    160,
                    144
                );


            /*
             * Domyślna paleta DMG.
             */

            const palette = [
                255,
                170,
                85,
                0
            ];


            for (
                let i = 0;
                i < frame.length;
                i++
            ) {

                const shade =
                    frame[i] & 3;


                const value =
                    palette[
                        shade
                    ];


                const p =
                    i * 4;


                image.data[p] =
                    value;

                image.data[p + 1] =
                    value;

                image.data[p + 2] =
                    value;

                image.data[p + 3] =
                    255;

            }


            this.context.putImageData(
                image,
                0,
                0
            );

        }

    }


    /*
     * ========================================================
     * SAVE RAM
     * ========================================================
     */

    saveRAM() {

        if (
            !this.cartridge
        ) {

            return null;

        }


        if (
            typeof this.cartridge.exportRAM !==
            "function"
        ) {

            return null;

        }


        return this.cartridge.exportRAM();

    }


    /*
     * ========================================================
     * LOAD RAM
     * ========================================================
     */

    loadRAM(
        data
    ) {

        if (
            !this.cartridge
        ) {

            return false;

        }


        if (
            typeof this.cartridge.importRAM !==
            "function"
        ) {

            return false;

        }


        this.cartridge.importRAM(
            data
        );


        return true;

    }


    /*
     * ========================================================
     * SAVE KEY
     * ========================================================
     */

    getSaveKey() {

        const title =
            this.cartridge?.title ||
            "unknown";


        return (
            "webbktx-gameboy-" +
            title
                .trim()
                .replace(
                    /[^a-zA-Z0-9_-]/g,
                    "_"
                )
        );

    }


    /*
     * ========================================================
     * SAVE TO LOCAL STORAGE
     * ========================================================
     */

    saveToStorage() {

        const ram =
            this.saveRAM();


        if (
            !ram
        ) {

            return false;

        }


        try {

            /*
             * Uint8Array → Base64
             */

            let binary =
                "";


            const chunk =
                0x8000;


            for (
                let i = 0;
                i < ram.length;
                i += chunk
            ) {

                const part =
                    ram.subarray(
                        i,
                        Math.min(
                            i + chunk,
                            ram.length
                        )
                    );


                binary +=
                    String.fromCharCode(
                        ...part
                    );

            }


            const encoded =
                btoa(
                    binary
                );


            localStorage.setItem(
                this.getSaveKey(),
                encoded
            );


            this.status(
                "Save zapisany."
            );


            return true;

        } catch (
            error
        ) {

            this.reportError(
                error
            );


            return false;

        }

    }


    /*
     * ========================================================
     * LOAD FROM LOCAL STORAGE
     * ========================================================
     */

    loadFromStorage() {

        if (
            !this.cartridge
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


            const binary =
                atob(
                    encoded
                );


            const ram =
                new Uint8Array(
                    binary.length
                );


            for (
                let i = 0;
                i < binary.length;
                i++
            ) {

                ram[i] =
                    binary.charCodeAt(
                        i
                    );

            }


            this.loadRAM(
                ram
            );


            this.status(
                "Save wczytany."
            );


            return true;

        } catch (
            error
        ) {

            this.reportError(
                error
            );


            return false;

        }

    }


    /*
     * ========================================================
     * GAME INFORMATION
     * ========================================================
     */

    getInfo() {

        let cartridgeInfo =
            null;


        if (
            this.cartridge &&
            typeof this.cartridge.getInfo ===
            "function"
        ) {

            cartridgeInfo =
                this.cartridge.getInfo();

        }


        return {

            system:
                "Nintendo Game Boy",

            platform:
                "DMG",

            running:
                this.running,

            paused:
                this.paused,

            romLoaded:
                this.romLoaded,

            frame:
                this.frameCount,

            cycles:
                this.totalCycles,

            clock:
                this.CLOCK,

            fps:
                this.FPS,

            cartridge:
                cartridgeInfo

        };

    }


    /*
     * ========================================================
     * DESTROY
     * ========================================================
     */

    destroy() {

        this.pause();


        this.destroyed =
            true;


        /*
         * Input może mieć eventy
         * klawiatury/gamepada.
         */

        if (
            this.input &&
            typeof this.input.destroy ===
            "function"
        ) {

            this.input.destroy();

        }


        /*
         * AudioContext.
         */

        if (
            this.audio &&
            typeof this.audio.destroy ===
            "function"
        ) {

            this.audio.destroy();

        }


        /*
         * Wyczyść referencje.
         */

        this.cpu =
            null;

        this.memory =
            null;

        this.ppu =
            null;

        this.timer =
            null;

        this.audio =
            null;

        this.input =
            null;

        this.cartridge =
            null;


        this.canvas =
            null;

        this.context =
            null;


        this.romLoaded =
            false;


        this.status(
            "Emulator zniszczony."
        );

    }

}
