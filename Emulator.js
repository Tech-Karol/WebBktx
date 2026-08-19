 /*
  * ============================================================
  * WebBktx — Pokémon Mini Emulator
  * Emulator.js
  * ============================================================
  *
  * Główny kontroler emulatora.
  *
  * Odpowiada za:
  *  - inicjalizację komponentów
  *  - ładowanie ROM
  *  - wejście użytkownika
  *  - pętlę emulacji
  *  - synchronizację z ekranem
  *  - start / pause / reset
  *
  * Docelowa architektura:
  *
  * Emulator
  *    │
  *    ├── CPU
  *    │
  *    ├── Memory
  *    │     ├── Cartridge
  *    │     ├── Input
  *    │     ├── Timer
  *    │     └── Interrupts
  *    │
  *    ├── LCD
  *    │
  *    └── Sound
  *
  * ============================================================
  */

import CPU from "./CPU.js";
import Memory from "./Memory.js";
import Input from "./Input.js";
import LCD from "./LCD.js";


export default class Emulator {

    constructor(canvas) {

        if (!canvas) {
            throw new Error(
                "Pokémon Mini Emulator: canvas is required"
            );
        }

        this.canvas = canvas;

        this.ctx =
            canvas.getContext("2d", {
                alpha: false
            });

        if (!this.ctx) {
            throw new Error(
                "Nie można utworzyć kontekstu 2D."
            );
        }

        /*
         * ----------------------------------------------------
         * Stałe sprzętowe Pokémon Mini
         * ----------------------------------------------------
         */

        this.WIDTH = 96;
        this.HEIGHT = 64;

        /*
         * Docelowa częstotliwość odświeżania.
         *
         * Nie zakładamy tutaj jeszcze konkretnej
         * częstotliwości CPU — CPU będzie rozliczany
         * własnym licznikiem cykli.
         */

        this.FPS = 60;

        /*
         * ----------------------------------------------------
         * Stan emulatora
         * ----------------------------------------------------
         */

        this.running = false;
        this.paused = false;

        this.romLoaded = false;

        this.rom = null;

        this.lastFrameTime = 0;
        this.frameAccumulator = 0;

        this.totalCycles = 0;
        this.totalFrames = 0;

        /*
         * Limit bezpieczeństwa.
         *
         * Chroni przeglądarkę przed nieskończoną pętlą
         * w przypadku błędu CPU.
         */

        this.maxCyclesPerFrame = 100000;

        /*
         * ----------------------------------------------------
         * Komponenty
         * ----------------------------------------------------
         */

        this.input = new Input();

        this.memory = new Memory(
            this.input
        );

        this.cpu = new CPU(
            this.memory
        );

        this.lcd = new LCD(
            this.canvas
        );

        /*
         * ----------------------------------------------------
         * Stan ekranu
         * ----------------------------------------------------
         */

        this.frameReady = false;

        /*
         * requestAnimationFrame bind
         */

        this.frame = this.frame.bind(this);

        /*
         * Przygotowanie canvasu.
         */

        this.setupCanvas();

        /*
         * Wyświetlenie pustego ekranu.
         */

        this.clearScreen();
    }


    /* ========================================================
     * CANVAS
     * ======================================================== */

    setupCanvas() {

        this.canvas.width = this.WIDTH;
        this.canvas.height = this.HEIGHT;

        this.ctx.imageSmoothingEnabled = false;

        this.ctx.fillStyle = "#c8c8c8";

        this.ctx.fillRect(
            0,
            0,
            this.WIDTH,
            this.HEIGHT
        );
    }


    clearScreen() {

        this.ctx.fillStyle = "#c8c8c8";

        this.ctx.fillRect(
            0,
            0,
            this.WIDTH,
            this.HEIGHT
        );
    }


    /* ========================================================
     * ROM
     * ======================================================== */

    loadROM(data) {

        if (!data) {
            throw new Error(
                "Brak danych ROM."
            );
        }

        /*
         * ArrayBuffer → Uint8Array
         */

        if (data instanceof ArrayBuffer) {
            data = new Uint8Array(data);
        }

        /*
         * Kopiujemy dane ROM.
         *
         * Dzięki temu zewnętrzny kod nie może przypadkowo
         * zmodyfikować ROM-u podczas emulacji.
         */

        if (data instanceof Uint8Array) {

            this.rom =
                new Uint8Array(data);

        } else {

            throw new TypeError(
                "ROM musi być Uint8Array albo ArrayBuffer."
            );
        }

        if (this.rom.length === 0) {
            throw new Error(
                "ROM jest pusty."
            );
        }

        /*
         * Przekazanie ROM do pamięci.
         */

        if (
            this.memory &&
            typeof this.memory.loadROM === "function"
        ) {
            this.memory.loadROM(
                this.rom
            );
        }

        /*
         * Reset sprzętu.
         */

        this.reset();

        this.romLoaded = true;

        return true;
    }


    /* ========================================================
     * RESET
     * ======================================================== */

    reset() {

        /*
         * CPU
         */

        if (
            this.cpu &&
            typeof this.cpu.reset === "function"
        ) {
            this.cpu.reset();
        }

        /*
         * Memory
         */

        if (
            this.memory &&
            typeof this.memory.reset === "function"
        ) {
            this.memory.reset();
        }

        /*
         * Input
         */

        if (
            this.input &&
            typeof this.input.reset === "function"
        ) {
            this.input.reset();
        }

        /*
         * LCD
         */

        if (
            this.lcd &&
            typeof this.lcd.reset === "function"
        ) {
            this.lcd.reset();
        }

        this.totalCycles = 0;
        this.totalFrames = 0;

        this.frameAccumulator = 0;

        this.frameReady = false;

        this.clearScreen();
    }


    /* ========================================================
     * START
     * ======================================================== */

    start() {

        if (this.running) {
            return;
        }

        this.running = true;
        this.paused = false;

        this.lastFrameTime =
            performance.now();

        requestAnimationFrame(
            this.frame
        );
    }


    /* ========================================================
     * STOP
     * ======================================================== */

    stop() {

        this.running = false;
        this.paused = false;
    }


    /* ========================================================
     * PAUSE
     * ======================================================== */

    pause() {

        this.paused = true;
    }


    /* ========================================================
     * RESUME
     * ======================================================== */

    resume() {

        this.paused = false;

        this.lastFrameTime =
            performance.now();
    }


    /* ========================================================
     * TOGGLE PAUSE
     * ======================================================== */

    togglePause() {

        if (this.paused) {
            this.resume();
        } else {
            this.pause();
        }
    }


    /* ========================================================
     * FRAME
     * ======================================================== */

    frame(timestamp) {

        if (!this.running) {
            return;
        }

        /*
         * Obliczamy czas od poprzedniej klatki.
         */

        let delta =
            timestamp -
            this.lastFrameTime;

        this.lastFrameTime =
            timestamp;

        /*
         * Ochrona przed ogromnym skokiem czasu,
         * np. po przełączeniu karty.
         */

        if (delta > 250) {
            delta = 250;
        }

        if (!this.paused) {

            this.runFrame(
                delta
            );

            this.render();
        }

        this.totalFrames++;

        requestAnimationFrame(
            this.frame
        );
    }


    /* ========================================================
     * RUN FRAME
     * ======================================================== */

    runFrame(delta) {

        /*
         * Docelowo liczba cykli będzie wynikała z
         * częstotliwości CPU Pokémon Mini.
         *
         * Na razie korzystamy z wartości dostarczanej
         * przez CPU, jeśli będzie dostępna.
         */

        const cyclesPerSecond =
            this.getCPUFrequency();

        const cyclesToRun =
            Math.max(
                1,
                Math.floor(
                    cyclesPerSecond *
                    (delta / 1000)
                )
            );

        let cycles = 0;

        /*
         * Ograniczenie bezpieczeństwa.
         */

        const limit =
            Math.min(
                cyclesToRun,
                this.maxCyclesPerFrame
            );

        while (
            cycles < limit &&
            this.running &&
            !this.paused
        ) {

            /*
             * Aktualizacja urządzeń,
             * które wymagają taktowania CPU.
             */

            this.updateHardware(
                1
            );

            /*
             * Jeden krok CPU.
             */

            if (
                this.cpu &&
                typeof this.cpu.step === "function"
            ) {

                const used =
                    this.cpu.step();

                /*
                 * CPU powinien zwrócić liczbę cykli.
                 *
                 * Jeżeli zwróci niepoprawną wartość,
                 * używamy 1 jako zabezpieczenia.
                 */

                const consumed =
                    Number.isFinite(used) &&
                    used > 0
                        ? used
                        : 1;

                cycles += consumed;
                this.totalCycles += consumed;

            } else {

                /*
                 * CPU jeszcze niegotowy.
                 */

                break;
            }
        }
    }


    /* ========================================================
     * CPU FREQUENCY
     * ======================================================== */

    getCPUFrequency() {

        /*
         * Jeżeli CPU posiada własną konfigurację,
         * wykorzystujemy ją.
         */

        if (
            this.cpu &&
            Number.isFinite(
                this.cpu.frequency
            )
        ) {
            return this.cpu.frequency;
        }

        if (
            this.cpu &&
            Number.isFinite(
                this.cpu.clockFrequency
            )
        ) {
            return this.cpu.clockFrequency;
        }

        /*
         * Tymczasowa wartość.
         *
         * Zostanie ustawiona zgodnie z dokumentacją
         * Pokémon Mini podczas implementacji CPU.
         */

        return 4000000;
    }


    /* ========================================================
     * HARDWARE UPDATE
     * ======================================================== */

    updateHardware(cycles) {

        /*
         * INPUT
         */

        if (
            this.input &&
            typeof this.input.tick === "function"
        ) {
            this.input.tick(
                cycles
            );
        }

        /*
         * MEMORY
         */

        if (
            this.memory &&
            typeof this.memory.tick === "function"
        ) {
            this.memory.tick(
                cycles
            );
        }

        /*
         * LCD
         */

        if (
            this.lcd &&
            typeof this.lcd.tick === "function"
        ) {
            this.lcd.tick(
                cycles
            );
        }
    }


    /* ========================================================
     * RENDER
     * ======================================================== */

    render() {

        if (!this.lcd) {
            return;
        }

        /*
         * Jeżeli LCD posiada własną funkcję renderującą,
         * pozwalamy mu narysować obraz.
         */

        if (
            typeof this.lcd.render === "function"
        ) {

            this.lcd.render(
                this.ctx
            );

            return;
        }

        /*
         * Fallback.
         */

        if (
            typeof this.lcd.getFrameBuffer ===
            "function"
        ) {

            const framebuffer =
                this.lcd.getFrameBuffer();

            if (!framebuffer) {
                return;
            }

            this.renderFrameBuffer(
                framebuffer
            );
        }
    }


    /* ========================================================
     * FRAMEBUFFER FALLBACK
     * ======================================================== */

    renderFrameBuffer(buffer) {

        const image =
            this.ctx.createImageData(
                this.WIDTH,
                this.HEIGHT
            );

        /*
         * Obsługujemy:

         *  - Uint8Array z wartościami 0/1
         *  - RGBA framebuffer
         */

        if (
            buffer.length ===
            this.WIDTH *
            this.HEIGHT *
            4
        ) {

            image.data.set(
                buffer
            );

        } else {

            for (
                let i = 0;
                i < this.WIDTH * this.HEIGHT;
                i++
            ) {

                const value =
                    buffer[i]
                        ? 0
                        : 255;

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
        }

        this.ctx.putImageData(
            image,
            0,
            0
        );
    }


    /* ========================================================
     * INPUT
     * ======================================================== */

    press(button) {

        if (
            this.input &&
            typeof this.input.press === "function"
        ) {
            this.input.press(
                button
            );
        }
    }


    release(button) {

        if (
            this.input &&
            typeof this.input.release === "function"
        ) {
            this.input.release(
                button
            );
        }
    }


    /* ========================================================
     * DEBUG
     * ======================================================== */

    getState() {

        return {

            running:
                this.running,

            paused:
                this.paused,

            romLoaded:
                this.romLoaded,

            romSize:
                this.rom
                    ? this.rom.length
                    : 0,

            totalCycles:
                this.totalCycles,

            totalFrames:
                this.totalFrames,

            cpu:
                this.cpu &&
                typeof this.cpu.getState ===
                "function"
                    ? this.cpu.getState()
                    : null,

            memory:
                this.memory &&
                typeof this.memory.getState ===
                "function"
                    ? this.memory.getState()
                    : null,

            input:
                this.input &&
                typeof this.input.getState ===
                "function"
                    ? this.input.getState()
                    : null
        };
    }


    /* ========================================================
     * DESTROY
     * ======================================================== */

    destroy() {

        this.stop();

        this.rom = null;

        this.cpu = null;
        this.memory = null;
        this.input = null;
        this.lcd = null;

        this.canvas = null;
        this.ctx = null;
    }
}
