/*
 * ============================================================
 * WebBktx APP
 *
 * Version: 1.0
 *
 * Frontend / launcher for unified WebBktx runtime.
 *
 * Runtime:
 *     core/webbktx.js
 *
 * Expected:
 *     window.WebBktx
 *
 * Runtime components:
 *     Memory
 *     CPU
 *     Decoder
 *     XBE
 *     Kernel
 *     Thunks
 *     XAPI
 *     XFile
 *     XInput
 *     XGraphics
 *
 * ============================================================
 */

"use strict";


/* ============================================================
   CONFIG
============================================================ */

const WEBBKTX_APP_VERSION = "1.0";


/* ============================================================
   APP
============================================================ */

const WebBktxApp = {

    version: WEBBKTX_APP_VERSION,

    initialized: false,

    running: false,

    gameFile: null,

    gameImage: null,

    runtime: null,

    core: null,

    kernel: null,

    cpu: null,

    memory: null,

    decoder: null,

    xbe: null,

    xapi: null,

    thunks: null,

    xfile: null,

    input: null,

    graphics: null,

    animationFrame: null,

    executionTimer: null,

    elements: {},


    /* ========================================================
       START
    ======================================================== */

    async start() {

        try {

            this.cacheElements();

            this.setProgress(5);

            this.setLoading(
                "Checking WebBktx runtime..."
            );

            this.updateModule(
                "cache",
                "SKIP"
            );

            this.updateModule(
                "core",
                "CHECK"
            );


            /*
             * Wait one tick so the browser can
             * finish loading the runtime script.
             */

            await this.delay(0);


            this.checkRuntime();


            this.setProgress(25);

            this.setLoading(
                "Connecting runtime modules..."
            );


            this.connectRuntime();


            this.updateModule(
                "core",
                "OK"
            );


            this.setProgress(50);

            this.setLoading(
                "Initializing WebBktx..."
            );


            await this.initializeRuntime();


            this.setProgress(70);


            this.updateModule(
                "graphics",
                this.graphics
                    ? "OK"
                    : "WAIT"
            );


            this.updateModule(
                "input",
                this.input
                    ? "OK"
                    : "WAIT"
            );


            this.setLoading(
                "Testing runtime..."
            );


            this.runRuntimeDiagnostics();


            this.setProgress(100);

            this.setLoading(
                "System ready."
            );


            await this.delay(200);


            this.showScreen(
                "mainScreen"
            );


            this.initialized =
                true;


            this.showMessage(
                "WebBktx runtime initialized.",
                "success"
            );


            console.log(
                `[WebBktx App ${this.version}] Ready.`
            );


        } catch (error) {

            console.error(
                "[WebBktx App] Startup error:",
                error
            );


            this.showCoreError(
                error
            );

        }

    },


    /* ========================================================
       HTML ELEMENTS
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

            "cpuOutput",

            "cpuTestButton",
            "cpuBackButton",

            "aboutButton",
            "aboutBackButton",

            "backButton",

            "screen",
            "gameName"

        ];


        for (
            const id of ids
        ) {

            this.elements[id] =
                document.getElementById(id);

        }


        const required = [

            "loadingScreen",
            "mainScreen",
            "gameFile",
            "startButton",
            "screen"

        ];


        for (
            const id of required
        ) {

            if (
                !this.elements[id]
            ) {

                throw new Error(
                    `Missing HTML element #${id}`
                );

            }

        }


        this.bindEvents();

    },


    /* ========================================================
       EVENTS
    ======================================================== */

    bindEvents() {

        const el =
            this.elements;


        if (el.gameFile) {

            el.gameFile.addEventListener(
                "change",
                event =>
                    this.handleGameFile(event)
            );

        }


        if (el.startButton) {

            el.startButton.addEventListener(
                "click",
                () =>
                    this.startGame()
            );

        }


        if (el.cpuTestButton) {

            el.cpuTestButton.addEventListener(
                "click",
                () =>
                    this.showCPU()
            );

        }


        if (el.cpuBackButton) {

            el.cpuBackButton.addEventListener(
                "click",
                () =>
                    this.showScreen("mainScreen")
            );

        }


        if (el.aboutButton) {

            el.aboutButton.addEventListener(
                "click",
                () =>
                    this.showScreen("aboutScreen")
            );

        }


        if (el.aboutBackButton) {

            el.aboutBackButton.addEventListener(
                "click",
                () =>
                    this.showScreen("mainScreen")
            );

        }


        if (el.backButton) {

            el.backButton.addEventListener(
                "click",
                () =>
                    this.stopGame()
            );

        }

    },


    /* ========================================================
       RUNTIME CHECK
    ======================================================== */

    checkRuntime() {

        if (
            !window.WebBktx
        ) {

            throw new Error(
                "Nie znaleziono window.WebBktx. " +
                "Sprawdź, czy core/webbktx.js " +
                "jest załadowany przed app.js."
            );

        }


        if (
            typeof window.WebBktx !==
            "object"
        ) {

            throw new Error(
                "window.WebBktx ma nieprawidłowy typ."
            );

        }


        return true;

    },


    /* ========================================================
       CONNECT RUNTIME
    ======================================================== */

    connectRuntime() {

        this.runtime =
            window.WebBktx;


        /*
         * Accept the preferred unified API.
         */

        this.memory =
            this.runtime.Memory ||
            this.runtime.memory ||
            null;


        this.cpu =
            this.runtime.CPU ||
            this.runtime.cpu ||
            null;


        this.decoder =
            this.runtime.Decoder ||
            this.runtime.decoder ||
            null;


        this.xbe =
            this.runtime.XBE ||
            this.runtime.xbe ||
            null;


        this.kernel =
            this.runtime.Kernel ||
            this.runtime.kernel ||
            null;


        this.thunks =
            this.runtime.Thunks ||
            this.runtime.thunks ||
            null;


        this.xapi =
            this.runtime.XAPI ||
            this.runtime.xapi ||
            null;


        this.xfile =
            this.runtime.XFile ||
            this.runtime.xfile ||
            null;


        this.input =
            this.runtime.XInput ||
            this.runtime.Input ||
            this.runtime.input ||
            null;


        this.graphics =
            this.runtime.XGraphics ||
            this.runtime.Graphics ||
            this.runtime.graphics ||
            null;


        /*
         * Core can be either a constructor,
         * an already-created object, or the runtime itself.
         */

        this.core =
            this.runtime.Core ||
            this.runtime.core ||
            this.runtime;


        console.group(
            "[WebBktx] Runtime"
        );


        console.log(
            "Memory:",
            this.memory
        );


        console.log(
            "CPU:",
            this.cpu
        );


        console.log(
            "Decoder:",
            this.decoder
        );


        console.log(
            "XBE:",
            this.xbe
        );


        console.log(
            "Kernel:",
            this.kernel
        );


        console.log(
            "Thunks:",
            this.thunks
        );


        console.log(
            "XAPI:",
            this.xapi
        );


        console.log(
            "XFile:",
            this.xfile
        );


        console.log(
            "XInput:",
            this.input
        );


        console.log(
            "XGraphics:",
            this.graphics
        );


        console.groupEnd();

    },


    /* ========================================================
       RUNTIME INITIALIZATION
    ======================================================== */

    async initializeRuntime() {

        /*
         * Preferred:
         *
         * WebBktx.initialize()
         */

        if (
            this.runtime &&
            typeof this.runtime.initialize ===
            "function"
        ) {

            await this.runtime.initialize();

        }


        /*
         * If Core has its own initialize(),
         * use it as well.
         */

        if (
            this.core &&
            this.core !== this.runtime &&
            typeof this.core.initialize ===
            "function"
        ) {

            await this.core.initialize();

        }


        /*
         * Refresh references after initialization.
         */

        if (
            this.runtime
        ) {

            this.memory =
                this.runtime.Memory ||
                this.runtime.memory ||
                this.memory;


            this.cpu =
                this.runtime.CPU ||
                this.runtime.cpu ||
                this.cpu;


            this.decoder =
                this.runtime.Decoder ||
                this.runtime.decoder ||
                this.decoder;


            this.xbe =
                this.runtime.XBE ||
                this.runtime.xbe ||
                this.xbe;


            this.kernel =
                this.runtime.Kernel ||
                this.runtime.kernel ||
                this.kernel;


            this.input =
                this.runtime.XInput ||
                this.runtime.Input ||
                this.runtime.input ||
                this.input;


            this.graphics =
                this.runtime.XGraphics ||
                this.runtime.Graphics ||
                this.runtime.graphics ||
                this.graphics;

        }


        /*
         * Optional graphics initialization.
         */

        await this.initializeGraphics();


        /*
         * Optional input initialization.
         */

        await this.initializeInput();


        return true;

    },


    /* ========================================================
       GRAPHICS
    ======================================================== */

    async initializeGraphics() {

        if (
            !this.graphics
        ) {

            return null;

        }


        try {

            /*
             * If runtime exposes an already-created
             * graphics instance, use it.
             */

            if (
                typeof this.graphics !==
                "function"
            ) {

                if (
                    typeof this.graphics.initialize ===
                    "function"
                ) {

                    await this.graphics.initialize(
                        this.elements.screen
                    );

                }

                return this.graphics;

            }


            /*
             * Constructor form.
             */

            this.graphics =
                new this.graphics(
                    this.elements.screen
                );


            if (
                typeof this.graphics.initialize ===
                "function"
            ) {

                await this.graphics.initialize();

            }


            return this.graphics;

        } catch (error) {

            console.warn(
                "[WebBktx] Graphics initialization failed:",
                error
            );


            this.graphics =
                null;


            return null;

        }

    },


    /* ========================================================
       INPUT
    ======================================================== */

    async initializeInput() {

        if (
            !this.input
        ) {

            return null;

        }


        try {

            /*
             * Constructor form.
             */

            if (
                typeof this.input ===
                "function"
            ) {

                this.input =
                    new this.input();

            }


            if (
                this.input &&
                typeof this.input.initialize ===
                "function"
            ) {

                await this.input.initialize();

            }


            /*
             * Optional attach to canvas.
             */

            if (
                this.input &&
                typeof this.input.attach ===
                "function"
            ) {

                this.input.attach(
                    this.elements.screen
                );

            }


            return this.input;

        } catch (error) {

            console.warn(
                "[WebBktx] Input initialization failed:",
                error
            );


            this.input =
                null;


            return null;

        }

    },


    /* ========================================================
       DIAGNOSTICS
    ======================================================== */

    runRuntimeDiagnostics() {

        const status = {

            runtime:
                Boolean(this.runtime),

            memory:
                Boolean(this.memory),

            cpu:
                Boolean(this.cpu),

            decoder:
                Boolean(this.decoder),

            xbe:
                Boolean(this.xbe),

            kernel:
                Boolean(this.kernel),

            thunks:
                Boolean(this.thunks),

            xapi:
                Boolean(this.xapi),

            xfile:
                Boolean(this.xfile),

            xinput:
                Boolean(this.input),

            xgraphics:
                Boolean(this.graphics)

        };


        console.table(
            status
        );


        /*
         * Runtime itself is mandatory.
         *
         * Other systems can remain WAIT while
         * the runtime is developed.
         */

        if (
            !status.runtime
        ) {

            throw new Error(
                "WebBktx runtime unavailable."
            );

        }


        return status;

    },


    /* ========================================================
       GAME FILE
    ======================================================== */

    async handleGameFile(event) {

        const input =
            event.target;


        if (
            !input.files ||
            !input.files.length
        ) {

            return;

        }


        const file =
            input.files[0];


        this.gameFile =
            file;


        this.setFileInfo(
            file
        );


        const name =
            file.name.toLowerCase();


        if (
            name.endsWith(".xbe")
        ) {

            this.elements.startButton.disabled =
                false;


            this.showMessage(
                "XBE selected. Ready.",
                "success"
            );


            return;

        }


        if (
            name.endsWith(".iso") ||
            name.endsWith(".xiso")
        ) {

            this.elements.startButton.disabled =
                false;


            this.showMessage(
                "ISO/XISO selected. Runtime will attempt to mount it if XFile support is available.",
                "info"
            );


            return;

        }


        this.elements.startButton.disabled =
            true;


        this.showMessage(
            "Unsupported game file.",
            "error"
        );

    },


    /* ========================================================
       LOAD GAME
    ======================================================== */

    async startGame() {

        if (
            !this.gameFile
        ) {

            this.showMessage(
                "No game selected.",
                "error"
            );

            return;

        }


        if (
            !this.runtime
        ) {

            this.showMessage(
                "WebBktx runtime is not initialized.",
                "error"
            );

            return;

        }


        this.showMessage(
            "Loading game...",
            "info"
        );


        try {

            let result = null;


            /*
             * Preferred unified API.
             */

            if (
                typeof this.runtime.loadGame ===
                "function"
            ) {

                result =
                    await this.runtime.loadGame(
                        this.gameFile
                    );

            }


            /*
             * Core API fallback.
             */

            else if (
                this.core &&
                typeof this.core.loadGame ===
                "function"
            ) {

                result =
                    await this.core.loadGame(
                        this.gameFile
                    );

            }


            /*
             * XBE fallback.
             */

            else {

                result =
                    await this.loadXBEFallback();

            }


            if (
                result === false
            ) {

                throw new Error(
                    "Runtime rejected the game."
                );

            }


            this.gameImage =
                result &&
                result.image
                    ? result.image
                    : result;


            if (
                this.elements.gameName
            ) {

                this.elements.gameName.textContent =
                    this.gameFile.name;

            }


            this.showScreen(
                "gameScreen"
            );


            this.running =
                true;


            this.startExecution();


            this.startRenderLoop();


            this.showMessage(
                "Game loaded.",
                "success"
            );


        } catch (error) {

            console.error(
                "[WebBktx] Game start error:",
                error
            );


            this.running =
                false;


            this.showMessage(
                error.message ||
                "Game loading failed.",
                "error"
            );

        }

    },


    /* ========================================================
       XBE FALLBACK
    ======================================================== */

    async loadXBEFallback() {

        if (
            !this.xbe
        ) {

            throw new Error(
                "XBE subsystem is unavailable."
            );

        }


        let XBEClass =
            this.xbe;


        /*
         * Runtime may expose an instance.
         */

        if (
            typeof XBEClass !==
            "function"
        ) {

            if (
                typeof XBEClass.load ===
                "function"
            ) {

                return await XBEClass.load(
                    this.gameFile
                );

            }


            throw new Error(
                "XBE loader is unavailable."
            );

        }


        const image =
            new XBEClass(
                this.gameFile
            );


        if (
            typeof image.load ===
            "function"
        ) {

            await image.load();

        }


        return {

            success: true,

            image

        };

    },


    /* ========================================================
       EXECUTION
    ======================================================== */

    startExecution() {

        if (
            !this.running
        ) {

            return;

        }


        /*
         * Unified runtime gets priority.
         */

        if (
            this.runtime &&
            typeof this.runtime.step ===
            "function"
        ) {

            this.executionTimer =
                setTimeout(
                    () => this.executionTick(),
                    0
                );

            return;

        }


        /*
         * Core fallback.
         */

        if (
            this.core &&
            typeof this.core.step ===
            "function"
        ) {

            this.executionTimer =
                setTimeout(
                    () => this.executionTick(),
                    0
                );

            return;

        }


        /*
         * CPU fallback.
         */

        if (
            this.cpu &&
            typeof this.cpu.step ===
            "function"
        ) {

            this.executionTimer =
                setTimeout(
                    () => this.executionTick(),
                    0
                );

            return;

        }


        console.warn(
            "[WebBktx] No executable step() method."
        );

    },


    /* ========================================================
       EXECUTION TICK
    ======================================================== */

    executionTick() {

        if (
            !this.running
        ) {

            return;

        }


        try {

            let stepFunction = null;


            if (
                this.runtime &&
                typeof this.runtime.step ===
                "function"
            ) {

                stepFunction =
                    () =>
                        this.runtime.step();

            }


            else if (
                this.core &&
                typeof this.core.step ===
                "function"
            ) {

                stepFunction =
                    () =>
                        this.core.step();

            }


            else if (
                this.cpu &&
                typeof this.cpu.step ===
                "function"
            ) {

                stepFunction =
                    () =>
                        this.cpu.step();

            }


            if (!stepFunction) {

                return;

            }


            /*
             * Small batches keep the browser responsive.
             */

            for (
                let i = 0;
                i < 100 &&
                this.running;
                i++
            ) {

                const result =
                    stepFunction();


                if (
                    result &&
                    (
                        result.halted ||
                        result.faulted ||
                        result.breakpoint
                    )
                ) {

                    this.running =
                        false;

                    break;

                }

            }

        } catch (error) {

            console.error(
                "[WebBktx] Execution error:",
                error
            );


            this.running =
                false;


            this.showMessage(
                error.message ||
                "CPU execution stopped.",
                "error"
            );


            return;

        }


        if (
            this.running
        ) {

            this.executionTimer =
                setTimeout(
                    () =>
                        this.executionTick(),
                    0
                );

        }

    },


    /* ========================================================
       RENDER LOOP
    ======================================================== */

    startRenderLoop() {

        if (
            this.animationFrame
        ) {

            cancelAnimationFrame(
                this.animationFrame
            );

        }


        const render =
            () => {

                if (
                    !this.running
                ) {

                    return;

                }


                try {

                    if (
                        this.graphics &&
                        typeof this.graphics.Present ===
                        "function"
                    ) {

                        this.graphics.Present();

                    }

                    else if (
                        this.runtime &&
                        typeof this.runtime.Present ===
                        "function"
                    ) {

                        this.runtime.Present();

                    }

                } catch (error) {

                    console.warn(
                        "[WebBktx] Present error:",
                        error
                    );

                }


                this.animationFrame =
                    requestAnimationFrame(
                        render
                    );

            };


        this.animationFrame =
            requestAnimationFrame(
                render
            );

    },


    /* ========================================================
       STOP
    ======================================================== */

    stopGame() {

        this.running =
            false;


        if (
            this.animationFrame
        ) {

            cancelAnimationFrame(
                this.animationFrame
            );


            this.animationFrame =
                null;

        }


        if (
            this.executionTimer
        ) {

            clearTimeout(
                this.executionTimer
            );


            this.executionTimer =
                null;

        }


        try {

            if (
                this.runtime &&
                typeof this.runtime.stop ===
                "function"
            ) {

                this.runtime.stop();

            }

            else if (
                this.core &&
                typeof this.core.stop ===
                "function"
            ) {

                this.core.stop();

            }

            else if (
                this.cpu &&
                typeof this.cpu.stop ===
                "function"
            ) {

                this.cpu.stop();

            }

        } catch (error) {

            console.warn(
                "[WebBktx] Stop error:",
                error
            );

        }


        this.showScreen(
            "mainScreen"
        );

    },


    /* ========================================================
       CPU TEST
    ======================================================== */

    showCPU() {

        this.showScreen(
            "cpuScreen"
        );


        const output =
            this.elements.cpuOutput;


        if (!output) {

            return;

        }


        try {

            let cpu =
                this.cpu;


            /*
             * Runtime may expose CPU as a constructor
             * or as an instance.
             */

            if (
                typeof cpu ===
                "function"
            ) {

                cpu =
                    this.core &&
                    this.core.cpu
                        ? this.core.cpu
                        : null;

            }


            if (!cpu) {

                output.textContent =
                    "CPU instance unavailable.";

                return;

            }


            let result;


            if (
                typeof cpu.selfTest ===
                "function"
            ) {

                result =
                    cpu.selfTest();

            }


            else if (
                typeof cpu.getStatus ===
                "function"
            ) {

                result =
                    cpu.getStatus();

            }


            else {

                result = {

                    available: true,

                    message:
                        "CPU object loaded."

                };

            }


            output.textContent =
                JSON.stringify(
                    result,
                    null,
                    4
                );

        } catch (error) {

            output.textContent =
                "CPU TEST ERROR\n\n" +
                (
                    error.stack ||
                    error.message
                );

        }

    },


    /* ========================================================
       SCREEN
    ======================================================== */

    showScreen(id) {

        const screens = [

            "loadingScreen",
            "mainScreen",
            "cpuScreen",
            "aboutScreen",
            "gameScreen"

        ];


        for (
            const screenId of screens
        ) {

            const element =
                document.getElementById(
                    screenId
                );


            if (!element) {

                continue;

            }


            if (
                screenId === id
            ) {

                element.classList.remove(
                    "hidden"
                );

            } else {

                element.classList.add(
                    "hidden"
                );

            }

        }

    },


    /* ========================================================
       LOADING
    ======================================================== */

    setLoading(text) {

        if (
            this.elements.loadingText
        ) {

            this.elements.loadingText.textContent =
                text;

        }

    },


    setProgress(value) {

        if (
            !this.elements.progress
        ) {

            return;

        }


        const normalized =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(value) || 0
                )
            );


        this.elements.progress.style.width =
            `${normalized}%`;

    },


    updateModule(
        name,
        state
    ) {

        const element =
            document.querySelector(
                `[data-module="${name}"]`
            );


        if (!element) {

            return;

        }


        const status =
            element.querySelector(
                "strong"
            );


        if (status) {

            status.textContent =
                state;

        }


        element.dataset.status =
            state;

    },


    /* ========================================================
       FILE UI
    ======================================================== */

    setFileInfo(file) {

        const name =
            this.elements.fileInfo
                ?.querySelector(
                    ".file-name"
                );


        if (!name) {

            return;

        }


        name.textContent =
            `${file.name} (${this.formatBytes(file.size)})`;

    },


    /* ========================================================
       MESSAGE
    ======================================================== */

    showMessage(
        message,
        type = "info"
    ) {

        const element =
            this.elements.message;


        if (!element) {

            return;

        }


        element.textContent =
            message;


        element.dataset.type =
            type;

    },


    /* ========================================================
       CORE ERROR
    ======================================================== */

    showCoreError(error) {

        this.showScreen(
            "loadingScreen"
        );


        this.setProgress(
            0
        );


        this.setLoading(
            "CORE ERROR"
        );


        const message =
            error &&
            error.message
                ? error.message
                : String(error);


        console.error(
            "================================"
        );


        console.error(
            "WEBBKTX CORE ERROR"
        );


        console.error(
            message
        );


        console.error(
            "================================"
        );


        let diagnostic =
            document.getElementById(
                "webbktxCoreError"
            );


        if (!diagnostic) {

            diagnostic =
                document.createElement(
                    "pre"
                );


            diagnostic.id =
                "webbktxCoreError";


            diagnostic.style.whiteSpace =
                "pre-wrap";


            diagnostic.style.marginTop =
                "20px";


            diagnostic.style.padding =
                "16px";


            diagnostic.style.overflow =
                "auto";


            diagnostic.style.maxWidth =
                "800px";


            diagnostic.style.maxHeight =
                "300px";


            const container =
                document.querySelector(
                    ".loading-panel"
                );


            if (container) {

                container.appendChild(
                    diagnostic
                );

            }

        }


        const runtime =
            window.WebBktx;


        const status = {

            runtime:
                typeof runtime,

            memory:
                runtime
                    ? typeof (
                        runtime.Memory ||
                        runtime.memory
                    )
                    : "undefined",

            cpu:
                runtime
                    ? typeof (
                        runtime.CPU ||
                        runtime.cpu
                    )
                    : "undefined",

            decoder:
                runtime
                    ? typeof (
                        runtime.Decoder ||
                        runtime.decoder
                    )
                    : "undefined",

            xbe:
                runtime
                    ? typeof (
                        runtime.XBE ||
                        runtime.xbe
                    )
                    : "undefined",

            kernel:
                runtime
                    ? typeof (
                        runtime.Kernel ||
                        runtime.kernel
                    )
                    : "undefined",

            thunks:
                runtime
                    ? typeof (
                        runtime.Thunks ||
                        runtime.thunks
                    )
                    : "undefined",

            xapi:
                runtime
                    ? typeof (
                        runtime.XAPI ||
                        runtime.xapi
                    )
                    : "undefined",

            xfile:
                runtime
                    ? typeof (
                        runtime.XFile ||
                        runtime.xfile
                    )
                    : "undefined",

            xinput:
                runtime
                    ? typeof (
                        runtime.XInput ||
                        runtime.Input ||
                        runtime.input
                    )
                    : "undefined",

            xgraphics:
                runtime
                    ? typeof (
                        runtime.XGraphics ||
                        runtime.Graphics ||
                        runtime.graphics
                    )
                    : "undefined"

        };


        diagnostic.textContent =
            "WEBBKTX CORE ERROR\n\n" +

            message +

            "\n\nRUNTIME STATUS\n" +

            JSON.stringify(
                status,
                null,
                2
            ) +

            "\n\n" +

            "Wymagany jest:\n" +

            "core/webbktx.js\n\n" +

            "oraz:\n\n" +

            "window.WebBktx";

    },


    /* ========================================================
       UTILITIES
    ======================================================== */

    formatBytes(bytes) {

        if (
            !Number.isFinite(bytes) ||
            bytes <= 0
        ) {

            return "0 B";

        }


        const units = [

            "B",
            "KB",
            "MB",
            "GB",
            "TB"

        ];


        const index =
            Math.min(
                Math.floor(
                    Math.log(bytes) /
                    Math.log(1024)
                ),
                units.length - 1
            );


        return (
            (
                bytes /
                Math.pow(
                    1024,
                    index
                )
            ).toFixed(2) +
            " " +
            units[index]
        );

    },


    delay(ms) {

        return new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    ms
                )
        );

    }

};


/* ============================================================
   GLOBAL
============================================================ */

window.WebBktxApp =
    WebBktxApp;


/* ============================================================
   BOOT
============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () =>
            WebBktxApp.start(),
        {
            once: true
        }
    );

} else {

    WebBktxApp.start();

}


console.log(
    `%cWebBktx App ${WEBBKTX_APP_VERSION} loaded.`,
    "font-weight:bold"
);
