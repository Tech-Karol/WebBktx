/*
 * ============================================================
 * WebBktx APP
 *
 * Version: 1.0
 *
 * Local launcher / UI controller
 *
 * Designed for:
 *   memory.js
 *   cpu.js
 *   decoder.js
 *   xbe.js
 *   core.js
 *   kernel.js
 *   thunks.js
 *   xapi.js
 *   xfile.js
 *   xinput.js
 *   xgraphics.js
 *
 * No PWA
 * No cache
 * No service worker
 * No online dependency
 *
 * ============================================================
 */

"use strict";


/* ============================================================
   APP CONFIG
============================================================ */

const WEBBKTX_APP_VERSION = "1.0";


const WebBktxApp = {

    version: WEBBKTX_APP_VERSION,

    initialized: false,

    gameFile: null,

    gameImage: null,

    core: null,

    kernel: null,

    graphics: null,

    input: null,

    animationFrame: null,

    running: false,

    elements: {},


    /* ========================================================
       START
    ======================================================== */

    async start() {

        try {

            this.cacheElements();

            this.setLoading(
                "Checking emulator modules..."
            );

            this.updateModule(
                "cache",
                "SKIP"
            );


            /*
             * No cache.
             *
             * The application intentionally does
             * not use localStorage, IndexedDB,
             * Cache API or Service Worker.
             */

            this.updateModule(
                "core",
                "CHECK"
            );


            this.checkModules();


            this.updateModule(
                "core",
                "OK"
            );


            this.setLoading(
                "Initializing WebBktx Core..."
            );


            await this.initializeCore();


            this.updateModule(
                "graphics",
                window.WebBktxGraphics ||
                window.WebBktxXGraphics
                    ? "OK"
                    : "WAIT"
            );


            this.updateModule(
                "input",
                window.WebBktxInput ||
                window.WebBktxXInput
                    ? "OK"
                    : "WAIT"
            );


            this.setProgress(
                100
            );


            this.setLoading(
                "System ready."
            );


            await this.delay(150);


            this.showScreen(
                "mainScreen"
            );


            this.initialized =
                true;


            this.showMessage(
                "WebBktx initialized successfully.",
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


        /*
         * Required UI.
         */

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
                    this.handleGameFile(
                        event
                    )
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
                    this.showScreen(
                        "mainScreen"
                    )
            );

        }


        if (el.aboutButton) {

            el.aboutButton.addEventListener(
                "click",
                () =>
                    this.showScreen(
                        "aboutScreen"
                    )
            );

        }


        if (el.aboutBackButton) {

            el.aboutBackButton.addEventListener(
                "click",
                () =>
                    this.showScreen(
                        "mainScreen"
                    )
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
       MODULE CHECK
    ======================================================== */

    checkModules() {

        const modules = {

            memory:
                typeof window.WebBktxMemory ===
                "function",

            cpu:
                typeof window.WebBktxCPU ===
                "function",

            xbe:
                typeof window.WebBktxXBE ===
                "function",

            core:
                typeof window.WebBktxCore ===
                "function"

        };


        console.table(
            modules
        );


        /*
         * Memory is mandatory.
         */

        if (!modules.memory) {

            throw new Error(
                "Brak WebBktxMemory. " +
                "Sprawdź core/memory.js."
            );

        }


        /*
         * CPU is mandatory.
         */

        if (!modules.cpu) {

            throw new Error(
                "Brak WebBktxCPU. " +
                "Sprawdź core/cpu.js."
            );

        }


        /*
         * XBE is mandatory for games.
         */

        if (!modules.xbe) {

            throw new Error(
                "Brak WebBktxXBE. " +
                "Sprawdź core/xbe.js."
            );

        }


        /*
         * Core is mandatory.
         */

        if (!modules.core) {

            throw new Error(
                "Brak WebBktxCore. " +
                "Sprawdź core/core.js."
            );

        }


        return modules;

    },


    /* ========================================================
       CORE INITIALIZATION
    ======================================================== */

    async initializeCore() {

        /*
         * Do NOT create Core before checking
         * the required constructors.
         */

        if (
            typeof window.WebBktxCore !==
            "function"
        ) {

            throw new Error(
                "WebBktxCore constructor unavailable."
            );

        }


        /*
         * Create Core.
         *
         * Core itself is responsible for
         * creating Memory / CPU / XBE.
         */

        this.core =
            new window.WebBktxCore({

                /*
                 * 64 MB Xbox-like base RAM.
                 *
                 * Can be changed later.
                 */

                ramSize:
                    64 * 1024 * 1024,

                /*
                 * Debug logging.
                 */

                debug:
                    true,

                /*
                 * Safety limit.
                 */

                maxInstructions:
                    100000

            });


        /*
         * Initialize explicitly.
         */

        if (
            typeof this.core.initialize ===
            "function"
        ) {

            this.core.initialize();

        }


        /*
         * Optional Kernel.
         */

        if (
            typeof window.WebBktxKernel ===
            "function"
        ) {

            try {

                this.kernel =
                    new window.WebBktxKernel(
                        this.core
                    );


                if (
                    typeof this.kernel.initialize ===
                    "function"
                ) {

                    await this.kernel.initialize();

                }


                console.log(
                    "WebBktx Kernel initialized."
                );

            } catch (error) {

                console.warn(
                    "Kernel initialization failed:",
                    error
                );

            }

        }


        /*
         * Optional graphics.
         */

        if (
            typeof window.WebBktxGraphics ===
            "function"
        ) {

            try {

                this.graphics =
                    new window.WebBktxGraphics(
                        this.elements.screen
                    );

            } catch (error) {

                console.warn(
                    "Graphics initialization failed:",
                    error
                );

            }

        } else if (
            typeof window.WebBktxXGraphics ===
            "function"
        ) {

            try {

                this.graphics =
                    new window.WebBktxXGraphics(
                        this.elements.screen
                    );

            } catch (error) {

                console.warn(
                    "XGraphics initialization failed:",
                    error
                );

            }

        }


        /*
         * Optional input.
         */

        if (
            typeof window.WebBktxInput ===
            "function"
        ) {

            try {

                this.input =
                    new window.WebBktxInput();

            } catch (error) {

                console.warn(
                    "Input initialization failed:",
                    error
                );

            }

        } else if (
            typeof window.WebBktxXInput ===
            "function"
        ) {

            try {

                this.input =
                    new window.WebBktxXInput();

            } catch (error) {

                console.warn(
                    "XInput initialization failed:",
                    error
                );

            }

        }


        return this.core;

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


        /*
         * XBE can be loaded directly.
         *
         * ISO/XISO support requires a disc
         * filesystem/parser. We don't pretend
         * an ISO is an XBE.
         */

        const name =
            file.name.toLowerCase();


        if (
            name.endsWith(".xbe")
        ) {

            this.elements.startButton.disabled =
                false;


            this.showMessage(
                "XBE selected. Ready to load.",
                "success"
            );


            return;

        }


        if (
            name.endsWith(".iso") ||
            name.endsWith(".xiso")
        ) {

            this.elements.startButton.disabled =
                true;


            this.showMessage(
                "ISO/XISO selected. " +
                "Disc filesystem support is required " +
                "before extracting default.xbe.",
                "warning"
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
       START GAME
    ======================================================== */

    async startGame() {

        if (
            !this.gameFile
        ) {

            this.showMessage(
                "No XBE selected.",
                "error"
            );

            return;

        }


        if (
            !this.core
        ) {

            this.showMessage(
                "Core is not initialized.",
                "error"
            );

            return;

        }


        this.showMessage(
            "Loading XBE...",
            "info"
        );


        try {

            /*
             * Core.loadGame() accepts the File.
             */

            let result;


            if (
                typeof this.core.loadGame ===
                "function"
            ) {

                result =
                    await this.core.loadGame(
                        this.gameFile
                    );

            } else {

                /*
                 * Compatibility fallback for
                 * alternative Core implementations.
                 */

                const xbe =
                    new window.WebBktxXBE(
                        this.gameFile
                    );


                await xbe.load();


                this.gameImage =
                    xbe;


                result = {
                    success: true,
                    image: xbe
                };

            }


            this.gameImage =
                result.image ||
                result;


            /*
             * Configure UI.
             */

            this.elements.gameName.textContent =
                this.gameFile.name;


            this.showScreen(
                "gameScreen"
            );


            /*
             * Start rendering.
             */

            this.startRenderLoop();


            /*
             * Start CPU only if the Core
             * explicitly supports it.
             */

            this.startExecution();


            this.showMessage(
                "XBE loaded.",
                "success"
            );


        } catch (error) {

            console.error(
                "Game start error:",
                error
            );


            this.showMessage(
                error.message ||
                "XBE loading failed.",
                "error"
            );

        }

    },


    /* ========================================================
       CPU EXECUTION
    ======================================================== */

    startExecution() {

        if (
            !this.core
        ) {

            return;

        }


        /*
         * Do not blindly call run().
         *
         * A browser UI cannot safely execute
         * 100000 instructions synchronously
         * on the main thread.
         */

        if (
            typeof this.core.step !==
            "function"
        ) {

            console.warn(
                "Core.step() unavailable."
            );

            return;

        }


        this.running =
            true;


        const tick =
            () => {

                if (!this.running) {

                    return;

                }


                try {

                    /*
                     * Small batches prevent the UI
                     * from locking completely.
                     */

                    for (
                        let i = 0;
                        i < 100 &&
                        this.running;
                        i++
                    ) {

                        const result =
                            this.core.step();


                        if (
                            result &&
                            result.halted
                        ) {

                            this.running =
                                false;

                            break;

                        }

                    }

                } catch (error) {

                    /*
                     * No game code loaded /
                     * decoder not attached /
                     * unsupported instruction.
                     *
                     * Don't crash the whole UI.
                     */

                    console.warn(
                        "CPU execution stopped:",
                        error
                    );


                    this.running =
                        false;

                    return;

                }


                if (this.running) {

                    setTimeout(
                        tick,
                        0
                    );

                }

            };


        tick();

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

                } catch (error) {

                    console.warn(
                        "Graphics Present error:",
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
       STOP GAME
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
            this.core &&
            typeof this.core.stop ===
            "function"
        ) {

            try {

                this.core.stop();

            } catch (error) {

                console.warn(
                    "Core stop error:",
                    error
                );

            }

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

            if (
                !this.core
            ) {

                output.textContent =
                    "Core not initialized.";

                return;

            }


            const cpu =
                this.core.cpu;


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

            } else if (
                typeof cpu.getStatus ===
                "function"
            ) {

                result =
                    cpu.getStatus();

            } else {

                result =
                    cpu;

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
            const screenId
            of screens
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
       LOADING UI
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
                    value
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


        if (name) {

            name.textContent =
                `${file.name} (${this.formatBytes(file.size)})`;

        }

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


        this.setLoading(
            "CORE ERROR"
        );


        this.setProgress(
            0
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


        /*
         * Put diagnostic information
         * directly into the loading panel.
         */

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


        const status = {

            memory:
                typeof window.WebBktxMemory,

            cpu:
                typeof window.WebBktxCPU,

            xbe:
                typeof window.WebBktxXBE,

            core:
                typeof window.WebBktxCore,

            decoder:
                typeof window.WebBktxDecoder,

            kernel:
                typeof window.WebBktxKernel,

            xapi:
                typeof window.WebBktxXAPI,

            thunks:
                typeof window.WebBktxThunks,

            xfile:
                typeof window.WebBktxXFile,

            xinput:
                typeof window.WebBktxXInput,

            graphics:
                typeof window.WebBktxGraphics,

            xgraphics:
                typeof window.WebBktxXGraphics

        };


        diagnostic.textContent =
            "WEBBKTX CORE ERROR\n\n" +

            message +

            "\n\nMODULE STATUS\n" +

            JSON.stringify(
                status,
                null,
                2
            ) +

            "\n\n" +

            "Sprawdź, czy pliki core/*.js " +
            "są załadowane przed app.js.";

    },


    /* ========================================================
       UTILITIES
    ======================================================== */

    formatBytes(bytes) {

        if (
            bytes === 0
        ) {

            return "0 B";

        }


        const units = [

            "B",
            "KB",
            "MB",
            "GB"

        ];


        const index =
            Math.floor(
                Math.log(bytes) /
                Math.log(1024)
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
    `%cWebBktx App ${WEBBKTX_APP_VERSION}`,
    "font-weight:bold"
);
