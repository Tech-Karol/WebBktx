/*
 * ============================================================
 * WebBktx App
 *
 * Version: 1.0
 *
 * Application bootstrap / UI bridge
 *
 * Responsibilities:
 *   - Start WebBktx Core
 *   - Connect UI
 *   - Load local XBE files
 *   - Run / stop / reset emulator
 *   - Diagnostics
 *
 * No PWA
 * No Service Worker
 * No Cache
 * No Online Dependency
 *
 * ============================================================
 */

"use strict";


/* ============================================================
   VERSION
============================================================ */

const WEBBKTX_APP_VERSION = "1.0";


/* ============================================================
   APP
============================================================ */

class WebBktxApp {

    constructor(options = {}) {

        this.version =
            WEBBKTX_APP_VERSION;


        this.options =
            options;


        this.core =
            null;


        this.initialized =
            false;


        this.gameLoaded =
            false;


        this.file =
            null;


        this.running =
            false;


        this.elements = {};


        this.callbacks = {

            ready:
                options.onReady || null,

            gameLoaded:
                options.onGameLoaded || null,

            error:
                options.onError || null,

            stopped:
                options.onStopped || null

        };

    }


    /* ========================================================
       LOG
    ======================================================== */

    log(
        message,
        data = null
    ) {

        if (
            data !== null
        ) {

            console.log(
                `[WebBktx App] ${message}`,
                data
            );

        } else {

            console.log(
                `[WebBktx App] ${message}`
            );

        }

    }


    error(
        message,
        error = null
    ) {

        console.error(
            `[WebBktx App] ${message}`,
            error || ""
        );


        if (
            typeof this.callbacks.error ===
            "function"
        ) {

            try {

                this.callbacks.error(
                    error || new Error(message)
                );

            } catch (_) {}

        }

    }


    /* ========================================================
       MODULE CHECK
    ======================================================== */

    checkModules() {

        const result = {

            core:
                typeof WebBktxCore !==
                "undefined",

            memory:
                typeof WebBktxMemory !==
                "undefined",

            cpu:
                typeof WebBktxCPU !==
                "undefined",

            decoder:
                typeof WebBktxDecoder !==
                "undefined",

            xbe:
                typeof WebBktxXBE !==
                "undefined",

            kernel:
                typeof WebBktxKernel !==
                "undefined",

            xapi:
                typeof WebBktxXAPI !==
                "undefined",

            thunks:
                typeof WebBktxThunks !==
                "undefined",

            xfile:
                typeof WebBktxXFile !==
                "undefined",

            xinput:
                typeof WebBktxXInput !==
                "undefined",

            xgraphics:
                typeof WebBktxXGraphics !==
                "undefined"

        };


        return result;

    }


    /* ========================================================
       INIT
    ======================================================== */

    initialize() {

        if (
            this.initialized
        ) {

            return true;

        }


        this.log(
            `Starting WebBktx App ${this.version}...`
        );


        const modules =
            this.checkModules();


        console.log(
            "[WebBktx] Module status:",
            modules
        );


        if (
            !modules.core
        ) {

            throw new Error(
                "WebBktxCore not found. Check core.js."
            );

        }


        /*
         * Create Core.
         */

        this.core =
            new WebBktxCore({

                debug:
                    true,

                ramSize:
                    64 * 1024 * 1024,

                maxInstructions:
                    100000,

                autoKernel:
                    true

            });


        /*
         * Core callbacks.
         */

        this.core.onReady =
            () => {

                this.log(
                    "Core ready."
                );

                this.emitReady();

            };


        this.core.onGameLoaded =
            game => {

                this.gameLoaded =
                    true;


                this.log(
                    "Game loaded.",
                    game
                );


                if (
                    typeof this.callbacks.gameLoaded ===
                    "function"
                ) {

                    try {

                        this.callbacks.gameLoaded(
                            game
                        );

                    } catch (_) {}

                }

            };


        this.core.onError =
            error => {

                this.error(
                    "Core error.",
                    error
                );

            };


        this.core.onStop =
            () => {

                this.running =
                    false;


                if (
                    typeof this.callbacks.stopped ===
                    "function"
                ) {

                    try {

                        this.callbacks.stopped();

                    } catch (_) {}

                }

            };


        /*
         * Initialize Core.
         */

        this.core.initialize();


        this.initialized =
            true;


        this.log(
            "WebBktx App initialized."
        );


        return true;

    }


    /* ========================================================
       READY EVENT
    ======================================================== */

    emitReady() {

        if (
            typeof this.callbacks.ready ===
            "function"
        ) {

            try {

                this.callbacks.ready(
                    this
                );

            } catch (_) {}

        }


        if (
            typeof window !==
            "undefined"
        ) {

            try {

                window.dispatchEvent(
                    new CustomEvent(
                        "webbktx-ready",
                        {
                            detail:
                                this
                        }
                    )
                );

            } catch (_) {}

        }

    }


    /* ========================================================
       LOAD XBE FILE
    ======================================================== */

    async loadFile(
        file
    ) {

        if (
            !file
        ) {

            throw new Error(
                "No file selected."
            );

        }


        this.ensureInitialized();


        /*
         * Accept only normal local
         * browser file objects here.
         */

        if (
            typeof Blob !==
            "undefined" &&
            !(file instanceof Blob)
        ) {

            throw new Error(
                "Invalid local file."
            );

        }


        this.log(
            "Loading local XBE file...",
            {
                name:
                    file.name || "unknown",

                size:
                    file.size || 0

            }
        );


        try {

            const result =
                await this.core.loadGame(
                    file
                );


            this.file =
                file;


            this.gameLoaded =
                true;


            this.log(
                "XBE successfully loaded.",
                result
            );


            return result;

        } catch (error) {

            this.gameLoaded =
                false;


            this.error(
                "Failed to load XBE.",
                error
            );


            throw error;

        }

    }


    /* ========================================================
       LOAD FROM INPUT
    ======================================================== */

    async loadFromInput(
        input
    ) {

        if (
            !input
        ) {

            throw new Error(
                "File input is missing."
            );

        }


        if (
            !input.files ||
            !input.files.length
        ) {

            throw new Error(
                "No file selected."
            );

        }


        const file =
            input.files[0];


        return this.loadFile(
            file
        );

    }


    /* ========================================================
       RUN
    ======================================================== */

    run(
        instructionLimit
    ) {

        this.ensureInitialized();


        if (
            !this.gameLoaded
        ) {

            throw new Error(
                "No XBE loaded."
            );

        }


        this.log(
            "Starting emulation..."
        );


        this.running =
            true;


        try {

            const result =
                this.core.run(
                    instructionLimit
                );


            this.running =
                false;


            return result;

        } catch (error) {

            this.running =
                false;


            this.error(
                "Emulation failed.",
                error
            );


            throw error;

        }

    }


    /* ========================================================
       STEP
    ======================================================== */

    step() {

        this.ensureInitialized();


        if (
            !this.gameLoaded
        ) {

            throw new Error(
                "No XBE loaded."
            );

        }


        return this.core.step();

    }


    /* ========================================================
       PAUSE
    ======================================================== */

    pause() {

        this.ensureInitialized();


        this.core.pause();


        this.running =
            false;

    }


    /* ========================================================
       STOP
    ======================================================== */

    stop() {

        this.ensureInitialized();


        this.core.stop();


        this.running =
            false;

    }


    /* ========================================================
       RESET
    ======================================================== */

    reset() {

        this.ensureInitialized();


        this.core.reset();


        this.gameLoaded =
            false;


        this.file =
            null;


        this.running =
            false;

    }


    /* ========================================================
       DIAGNOSTICS
    ======================================================== */

    diagnostics() {

        this.ensureInitialized();


        return this.core.diagnostics();

    }


    /* ========================================================
       CPU
    ======================================================== */

    getCPUState() {

        this.ensureInitialized();


        return this.core.getCPUState();

    }


    /* ========================================================
       MEMORY
    ======================================================== */

    getMemoryInfo() {

        this.ensureInitialized();


        return this.core.getMemoryInfo();

    }


    /* ========================================================
       KERNEL
    ======================================================== */

    getKernelStatus() {

        this.ensureInitialized();


        return this.core.getKernelStatus();

    }


    /* ========================================================
       GAME
    ======================================================== */

    getGameInfo() {

        this.ensureInitialized();


        return this.core.getGameInfo();

    }


    /* ========================================================
       CORE
    ======================================================== */

    getCore() {

        this.ensureInitialized();


        return this.core;

    }


    /* ========================================================
       ENSURE
    ======================================================== */

    ensureInitialized() {

        if (
            !this.initialized
        ) {

            this.initialize();

        }

    }

}


/* ============================================================
   GLOBAL APP
============================================================ */

let WebBktxAppInstance =
    null;


/* ============================================================
   BOOTSTRAP
============================================================ */

function startWebBktx() {

    if (
        WebBktxAppInstance
    ) {

        return WebBktxAppInstance;

    }


    try {

        WebBktxAppInstance =
            new WebBktxApp();


        WebBktxAppInstance.initialize();


        return WebBktxAppInstance;

    } catch (error) {

        console.error(
            "[WebBktx] Application startup failed.",
            error
        );


        return null;

    }

}


/* ============================================================
   GLOBAL API
============================================================ */

if (
    typeof window !==
    "undefined"
) {

    window.WebBktxApp =
        WebBktxApp;


    window.webbktx =
        startWebBktx();

}


/* ============================================================
   DOM READY
============================================================ */

if (
    typeof document !==
    "undefined"
) {

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            () => {

                if (
                    !WebBktxAppInstance
                ) {

                    startWebBktx();

                }

            }
        );

    } else {

        startWebBktx();

    }

}


/* ============================================================
   READY
============================================================ */

console.log(
    `%cWebBktx App ${WEBBKTX_APP_VERSION}`,
    "font-weight:bold"
);
