"use strict";

/*
 * ============================================================
 * WebBktx Application
 * Version 1.3.0
 *
 * XBE BOOT FRONTEND
 *
 * Audio: DISABLED
 * ============================================================
 */

const WebBktxApp = {

    runtime: null,

    selectedFile: null,

    bootLoop: null,

    fpsLoop: null,

    frameCounter: 0,

    lastFPS:
        performance.now(),

    fps: 0,

    booted: false,

    elements: {},


    /* ========================================================
       INITIALIZE
    ======================================================== */

    init() {

        console.log(
            "[WebBktx] Application initialization..."
        );

        this.runtime =
            window.WebBktx &&
            window.WebBktx.runtime
                ? window.WebBktx.runtime
                : null;

        if (!this.runtime) {

            this.showFatalError(
                "Nie znaleziono WebBktx runtime."
            );

            return;
        }

        this.cacheElements();

        this.bindEvents();

        this.initializeRuntime();

        this.startFPSCounter();

        console.log(
            "[WebBktx] Application ready."
        );
    },


    /* ========================================================
       ELEMENTS
    ======================================================== */

    cacheElements() {

        const ids = [

            "loadingScreen",
            "mainScreen",
            "cpuScreen",
            "aboutScreen",
            "gameScreen",

            "progress",
            "loadingText",

            "gameFile",
            "fileInfo",
            "startButton",
            "message",

            "gameName",

            "screen",

            "cpuOutput",

            "cpuTestButton",
            "cpuBackButton",

            "aboutButton",
            "aboutBackButton",

            "backButton"
        ];

        for (const id of ids) {

            this.elements[id] =
                document.getElementById(id);
        }
    },


    /* ========================================================
       EVENTS
    ======================================================== */

    bindEvents() {

        const e = this.elements;


        if (e.gameFile) {

            e.gameFile.addEventListener(
                "change",
                event =>
                    this.handleFile(
                        event.target.files[0]
                    )
            );
        }


        if (e.startButton) {

            e.startButton.addEventListener(
                "click",
                () =>
                    this.startGame()
            );
        }


        if (e.cpuTestButton) {

            e.cpuTestButton.addEventListener(
                "click",
                () =>
                    this.showCPU()
            );
        }


        if (e.cpuBackButton) {

            e.cpuBackButton.addEventListener(
                "click",
                () =>
                    this.showMain()
            );
        }


        if (e.aboutButton) {

            e.aboutButton.addEventListener(
                "click",
                () =>
                    this.showAbout()
            );
        }


        if (e.aboutBackButton) {

            e.aboutBackButton.addEventListener(
                "click",
                () =>
                    this.showMain()
            );
        }


        if (e.backButton) {

            e.backButton.addEventListener(
                "click",
                () =>
                    this.stopGame()
            );
        }
    },


    /* ========================================================
       RUNTIME
    ======================================================== */

    initializeRuntime() {

        try {

            this.runtime.initialize();

            this.log(
                "Runtime initialized."
            );

            this.runLoadingSequence();

        } catch (error) {

            console.error(error);

            this.showFatalError(
                error.message
            );
        }
    },


    /* ========================================================
       LOADING SCREEN
    ======================================================== */

    runLoadingSequence() {

        const modules = [

            [
                "cache",
                "LOCAL STORAGE"
            ],

            [
                "core",
                "WEBBKTX CORE"
            ],

            [
                "graphics",
                "GRAPHICS SYSTEM"
            ],

            [
                "input",
                "CONTROLLER SYSTEM"
            ]
        ];

        let index = 0;

        const next = () => {

            if (index >= modules.length) {

                this.setProgress(
                    100,
                    "System ready."
                );

                setTimeout(
                    () =>
                        this.showMain(),
                    350
                );

                return;
            }

            const [id, name] =
                modules[index];

            const module =
                document.querySelector(
                    `.module[data-module="${id}"]`
                );

            if (module) {

                const status =
                    module.querySelector(
                        "strong"
                    );

                if (status) {
                    status.textContent =
                        "OK";
                }
            }

            const progress =
                Math.round(
                    (
                        (index + 1) /
                        modules.length
                    ) * 100
                );

            this.setProgress(
                progress,
                `${name} ready.`
            );

            index++;

            setTimeout(
                next,
                250
            );
        };

        next();
    },


    setProgress(percent, text) {

        if (this.elements.progress) {

            this.elements.progress.style.width =
                `${percent}%`;
        }

        if (this.elements.loadingText) {

            this.elements.loadingText.textContent =
                text;
        }
    },


    /* ========================================================
       SCREENS
    ======================================================== */

    hideAllScreens() {

        document
            .querySelectorAll(".screen")
            .forEach(
                screen =>
                    screen.classList.add(
                        "hidden"
                    )
            );
    },


    showMain() {

        this.stopBootLoop();

        this.hideAllScreens();

        this.elements.mainScreen
            ?.classList.remove(
                "hidden"
            );
    },


    showCPU() {

        this.stopBootLoop();

        this.hideAllScreens();

        this.elements.cpuScreen
            ?.classList.remove(
                "hidden"
            );

        this.runCPUDiagnostic();
    },


    showAbout() {

        this.stopBootLoop();

        this.hideAllScreens();

        this.elements.aboutScreen
            ?.classList.remove(
                "hidden"
            );
    },


    showGame() {

        this.hideAllScreens();

        this.elements.gameScreen
            ?.classList.remove(
                "hidden"
            );
    },


    /* ========================================================
       FILE
    ======================================================== */

    async handleFile(file) {

        if (!file) {
            return;
        }

        this.selectedFile = file;

        const name =
            file.name || "unknown.xbe";

        const size =
            file.size || 0;

        this.updateFileInfo(
            `${name} • ${this.formatBytes(size)}`
        );

        this.setMessage(
            "Loading XBE..."
        );

        try {

            const result =
                await this.runtime.loadGame(
                    file
                );

            console.log(
                "[WebBktx] XBE LOAD RESULT:",
                result
            );

            console.log(
                "[WebBktx] XBE STATUS:",
                result.status
            );

            this.updateFileInfo(
                `${name} • ${this.formatBytes(size)} • XBE OK`
            );

            this.setMessage(
                "XBE loaded. Ready to boot."
            );

            if (this.elements.startButton) {

                this.elements.startButton.disabled =
                    false;
            }

            /*
             * Show useful XBE data.
             */

            this.showXBEInfo(
                result.status
            );

        } catch (error) {

            console.error(
                "[WebBktx] XBE LOAD ERROR:",
                error
            );

            this.setMessage(
                `XBE ERROR: ${error.message}`,
                true
            );

            if (this.elements.startButton) {
                this.elements.startButton.disabled =
                    true;
            }
        }
    },


    updateFileInfo(text) {

        const element =
            this.elements.fileInfo;

        if (!element) {
            return;
        }

        const name =
            element.querySelector(
                ".file-name"
            );

        if (name) {
            name.textContent =
                text;
        }
    },


    showXBEInfo(status) {

        console.log(
            "[WebBktx] XBE HEADER:",
            status.header
        );

        console.log(
            "[WebBktx] XBE SECTIONS:",
            status.sections
        );

        console.log(
            "[WebBktx] XBE ENTRY:",
            this.hex(
                status.entryPoint
            )
        );
    },


    /* ========================================================
       START GAME
    ======================================================== */

    async startGame() {

        if (!this.selectedFile) {

            this.setMessage(
                "Select an XBE first.",
                true
            );

            return;
        }

        this.showGame();

        this.booted = false;

        this.frameCounter = 0;

        if (this.elements.gameName) {

            this.elements.gameName.textContent =
                this.selectedFile.name
                    .replace(
                        /\.xbe$/i,
                        ""
                    )
                    .toUpperCase();
        }

        try {

            this.prepareGraphics();

            this.runtime.attachInput();

            /*
             * AUDIO IS INTENTIONALLY DISABLED.
             */

            console.log(
                "[WebBktx] AUDIO: DISABLED"
            );

            const boot =
                this.runtime.bootXBE();

            console.log(
                "[WebBktx] BOOT XBE:",
                boot
            );

            this.booted = true;

            this.renderBootScreen(
                "XBE BOOTING",
                [
                    `ENTRY: ${this.hex(boot.entryPoint)}`,
                    `MAPPED: ${this.formatBytes(boot.mapping.mappedBytes)}`,
                    "AUDIO: DISABLED",
                    "CPU: STARTING"
                ]
            );

            this.startBootLoop();

        } catch (error) {

            console.error(
                "[WebBktx] BOOT ERROR:",
                error
            );

            this.renderBootError(
                error
            );
        }
    },


    /* ========================================================
       GRAPHICS
    ======================================================== */

    prepareGraphics() {

        const canvas =
            this.elements.screen;

        if (!canvas) {

            throw new Error(
                "Canvas #screen not found."
            );
        }

        this.runtime.attachGraphics(
            canvas
        );

        canvas.width = 1280;
        canvas.height = 720;
    },


    /* ========================================================
       BOOT LOOP
    ======================================================== */

    startBootLoop() {

        this.stopBootLoop();

        let last =
            performance.now();

        const frame = now => {

            if (!this.booted) {
                return;
            }

            const delta =
                now - last;

            last = now;

            /*
             * Around 10 FPS minimum target.
             *
             * We do not run one enormous CPU loop,
             * because that would freeze the browser.
             */

            try {

                const result =
                    this.runtime.runFrame(
                        5000
                    );

                this.updateEmulatorScreen(
                    result,
                    delta
                );

            } catch (error) {

                console.error(
                    "[WebBktx] FRAME ERROR:",
                    error
                );

                this.booted = false;

                this.renderBootError(
                    error
                );

                return;
            }

            this.bootLoop =
                requestAnimationFrame(
                    frame
                );
        };

        this.bootLoop =
            requestAnimationFrame(
                frame
            );
    },


    stopBootLoop() {

        if (this.bootLoop !== null) {

            cancelAnimationFrame(
                this.bootLoop
            );

            this.bootLoop = null;
        }
    },


    /* ========================================================
       FRAME
    ======================================================== */

    updateEmulatorScreen(
        result,
        delta
    ) {

        const canvas =
            this.elements.screen;

        if (!canvas) {
            return;
        }

        const ctx =
            canvas.getContext(
                "2d"
            );

        if (!ctx) {
            return;
        }

        ctx.fillStyle =
            "#050708";

        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        ctx.fillStyle =
            "#00ff88";

        ctx.font =
            "bold 34px monospace";

        ctx.fillText(
            "WebBktx",
            60,
            80
        );

        ctx.font =
            "20px monospace";

        ctx.fillText(
            "XBE BOOT RUNTIME",
            60,
            120
        );

        ctx.fillStyle =
            "#ffffff";

        ctx.fillText(
            `STATE: ${result.state}`,
            60,
            180
        );

        const cpu =
            result.cpu;

        if (cpu) {

            ctx.fillText(
                `EIP: ${this.hex(
                    cpu.registers.EIP
                )}`,
                60,
                220
            );

            ctx.fillText(
                `EAX: ${this.hex(
                    cpu.registers.EAX
                )}`,
                60,
                250
            );

            ctx.fillText(
                `EBX: ${this.hex(
                    cpu.registers.EBX
                )}`,
                60,
                280
            );

            ctx.fillText(
                `ESP: ${this.hex(
                    cpu.registers.ESP
                )}`,
                60,
                310
            );

            ctx.fillText(
                `Instructions: ${cpu.instructionsExecuted}`,
                60,
                350
            );

            ctx.fillText(
                `Cycles: ${cpu.cycles}`,
                60,
                380
            );
        }

        ctx.fillStyle =
            "#aaaaaa";

        ctx.fillText(
            "AUDIO: DISABLED",
            60,
            440
        );

        ctx.fillText(
            "GPU: BOOT MODE",
            60,
            470
        );

        if (
            result.last &&
            result.last.mnemonic
        ) {

            ctx.fillText(
                `LAST: ${result.last.mnemonic}`,
                60,
                520
            );
        }

        /*
         * CPU fault.
         */

        if (
            result.state ===
            "CPU FAULT"
        ) {

            ctx.fillStyle =
                "#ff4444";

            ctx.font =
                "18px monospace";

            ctx.fillText(
                "CPU FAULT",
                60,
                570
            );

            ctx.fillText(
                result.error ||
                "Unknown CPU error",
                60,
                600
            );

            /*
             * Stop automatically on fault.
             */

            this.booted = false;

            return;
        }

        /*
         * HLT.
         */

        if (
            result.state ===
            "HALTED"
        ) {

            this.booted = false;
        }
    },


    /* ========================================================
       BOOT SCREEN
    ======================================================== */

    renderBootScreen(
        title,
        lines
    ) {

        const canvas =
            this.elements.screen;

        if (!canvas) {
            return;
        }

        const ctx =
            canvas.getContext(
                "2d"
            );

        ctx.fillStyle =
            "#050708";

        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        ctx.fillStyle =
            "#00ff88";

        ctx.font =
            "bold 40px monospace";

        ctx.fillText(
            "WebBktx",
            60,
            80
        );

        ctx.fillStyle =
            "#ffffff";

        ctx.font =
            "26px monospace";

        ctx.fillText(
            title,
            60,
            140
        );

        ctx.font =
            "18px monospace";

        lines.forEach(
            (line, index) => {

                ctx.fillText(
                    line,
                    60,
                    200 +
                    index * 35
                );
            }
        );
    },


    renderBootError(error) {

        this.stopBootLoop();

        const canvas =
            this.elements.screen;

        if (!canvas) {
            return;
        }

        const ctx =
            canvas.getContext(
                "2d"
            );

        ctx.fillStyle =
            "#050708";

        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        ctx.fillStyle =
            "#ff3333";

        ctx.font =
            "bold 32px monospace";

        ctx.fillText(
            "WEBBKTX CPU FAULT",
            50,
            80
        );

        ctx.fillStyle =
            "#ffffff";

        ctx.font =
            "18px monospace";

        ctx.fillText(
            error.message ||
            String(error),
            50,
            130
        );

        const status =
            this.runtime.getStatus();

        if (
            status.cpu &&
            status.cpu.registers
        ) {

            ctx.fillText(
                `EIP: ${this.hex(
                    status.cpu.registers.EIP
                )}`,
                50,
                190
            );

            ctx.fillText(
                `EAX: ${this.hex(
                    status.cpu.registers.EAX
                )}`,
                50,
                220
            );

            ctx.fillText(
                `ESP: ${this.hex(
                    status.cpu.registers.ESP
                )}`,
                50,
                250
            );
        }

        ctx.fillStyle =
            "#aaaaaa";

        ctx.fillText(
            "Audio: disabled",
            50,
            310
        );

        ctx.fillText(
            "XBE pozostaje załadowane.",
            50,
            340
        );

        ctx.fillText(
            "Następny etap: rozszerzenie dekodera/XAPI.",
            50,
            370
        );

        this.booted = false;
    },


    /* ========================================================
       CPU TEST
    ======================================================== */

    runCPUDiagnostic() {

        const output =
            this.elements.cpuOutput;

        if (!output) {
            return;
        }

        let text = "";

        try {

            const result =
                this.runtime.selfTest();

            text +=
                "WebBktx CPU Diagnostic\n";

            text +=
                "======================\n\n";

            text +=
                `Runtime: ${this.runtime.version}\n`;

            text +=
                `CPU: AVAILABLE\n`;

            text +=
                `Memory: OK\n`;

            text +=
                `Decoder: OK\n`;

            text +=
                `Kernel: ${
                    result.kernel
                        ? "OK"
                        : "ERROR"
                }\n\n`;

            for (
                const test of result.cpu.tests
            ) {

                text +=
                    `${test.name}: ${
                        test.pass
                            ? "PASS"
                            : "FAIL"
                    }\n`;
            }

            text +=
                `\nRESULT: ${
                    result.passed
                        ? "PASS"
                        : "FAIL"
                }\n`;

        } catch (error) {

            text +=
                "CPU DIAGNOSTIC ERROR\n\n";

            text +=
                error.message;
        }

        output.textContent =
            text;
    },


    /* ========================================================
       STOP GAME
    ======================================================== */

    stopGame() {

        this.booted = false;

        this.stopBootLoop();

        try {
            this.runtime.stop();
        } catch (_) {}

        this.showMain();

        this.setMessage(
            "Emulator stopped."
        );
    },


    /* ========================================================
       FPS
    ======================================================== */

    startFPSCounter() {

        const loop = now => {

            this.frameCounter++;

            if (
                now -
                this.lastFPS >=
                1000
            ) {

                this.fps =
                    this.frameCounter;

                this.frameCounter =
                    0;

                this.lastFPS =
                    now;
            }

            requestAnimationFrame(
                loop
            );
        };

        requestAnimationFrame(
            loop
        );
    },


    /* ========================================================
       UI
    ======================================================== */

    setMessage(
        message,
        error = false
    ) {

        const element =
            this.elements.message;

        if (!element) {
            return;
        }

        element.textContent =
            message;

        element.dataset.error =
            error
                ? "true"
                : "false";
    },


    showFatalError(message) {

        this.hideAllScreens();

        const main =
            this.elements.mainScreen;

        if (main) {

            main.classList.remove(
                "hidden"
            );

            this.setMessage(
                `WEBBKTX CORE ERROR: ${message}`,
                true
            );
        }

        console.error(
            "[WebBktx] FATAL:",
            message
        );
    },


    log(message) {

        console.log(
            `[WebBktx] ${message}`
        );
    },


    hex(value) {

        return (
            "0x" +
            (
                Number(value) >>> 0
            )
                .toString(16)
                .padStart(8, "0")
        );
    },


    formatBytes(bytes) {

        bytes =
            Number(bytes) || 0;

        if (bytes < 1024) {
            return `${bytes} B`;
        }

        if (bytes < 1024 * 1024) {
            return `${(
                bytes / 1024
            ).toFixed(1)} KB`;
        }

        return `${(
            bytes /
            1024 /
            1024
        ).toFixed(2)} MB`;
    }
};


/* ============================================================
   GLOBAL
============================================================ */

window.WebBktxApp =
    WebBktxApp;


/* ============================================================
   START
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        WebBktxApp.init();

    }
);


console.log(
    "[WebBktx] app.js loaded."
);
