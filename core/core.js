/*
 * ============================================================
 * WebBktx Core Loader
 * ============================================================
 *
 * WebBktx 0.7
 *
 * Automatically loads:
 *
 *   memory.js
 *   cpu.js
 *   xbe.js
 *
 * Then exposes:
 *
 *   window.WebBktxCore.WebBktxCore
 *
 * ============================================================
 */

"use strict";


/* ============================================================
   VERSION
============================================================ */

const WEBBKTX_CORE_VERSION = "0.7";


/* ============================================================
   PATH
============================================================ */

const WEBBKTX_CORE_PATH =
    "core/";


/* ============================================================
   MODULE LIST
============================================================ */

const WEBBKTX_MODULES = [

    "memory.js",
    "cpu.js",
    "xbe.js"

];


/* ============================================================
   GLOBAL STATE
============================================================ */

let WebBktxMemoryClass = null;
let WebBktxCPUClass = null;
let WebBktxXBEClass = null;

let WebBktxModulesReady = false;


/* ============================================================
   SCRIPT LOADER
============================================================ */

function loadScript(filename) {

    return new Promise(
        (resolve, reject) => {

            /*
             * Prevent duplicate loading.
             */

            const existing =
                document.querySelector(
                    `script[data-webbktx="${filename}"]`
                );


            if (existing) {

                /*
                 * Already loaded.
                 */

                if (
                    existing.dataset.loaded ===
                    "true"
                ) {

                    resolve();

                    return;

                }


                /*
                 * Existing but still loading.
                 */

                existing.addEventListener(
                    "load",
                    () => resolve(),
                    { once: true }
                );


                existing.addEventListener(
                    "error",
                    () => reject(
                        new Error(
                            "Cannot load " +
                            filename
                        )
                    ),
                    { once: true }
                );


                return;

            }


            const script =
                document.createElement(
                    "script"
                );


            script.src =
                WEBBKTX_CORE_PATH +
                filename;


            script.async =
                false;


            script.dataset.webbktx =
                filename;


            script.onload =
                () => {

                    script.dataset.loaded =
                        "true";


                    console.log(
                        "[WebBktx] Loaded:",
                        filename
                    );


                    resolve();

                };


            script.onerror =
                () => {

                    reject(
                        new Error(
                            "Failed to load module: " +
                            filename
                        )
                    );

                };


            document.head.appendChild(
                script
            );

        }
    );

}


/* ============================================================
   LOAD ALL MODULES
============================================================ */

async function loadWebBktxModules() {

    console.log(
        "[WebBktx] Loading Core modules..."
    );


    for (
        const module
        of WEBBKTX_MODULES
    ) {

        await loadScript(
            module
        );

    }


    /*
     * Find module classes.
     *
     * We support a few possible
     * naming conventions.
     */

    WebBktxMemoryClass =
        window.WebBktxMemory ||
        window.WebBktxMemoryModule;


    WebBktxCPUClass =
        window.WebBktxCPU ||
        window.X86CPU ||
        window.WebBktxCPUModule;


    WebBktxXBEClass =
        window.WebBktxXBE ||
        window.XBEImage ||
        window.WebBktxXBEModule;


    /*
     * Check memory.
     */

    if (
        typeof WebBktxMemoryClass !==
        "function"
    ) {

        throw new Error(
            "WebBktxMemory was not found after loading memory.js."
        );

    }


    /*
     * Check CPU.
     */

    if (
        typeof WebBktxCPUClass !==
        "function"
    ) {

        throw new Error(
            "WebBktxCPU was not found after loading cpu.js."
        );

    }


    /*
     * Check XBE.
     */

    if (
        typeof WebBktxXBEClass !==
        "function"
    ) {

        throw new Error(
            "WebBktxXBE was not found after loading xbe.js."
        );

    }


    WebBktxModulesReady =
        true;


    console.log(
        "[WebBktx] All modules loaded."
    );


    return true;

}


/* ============================================================
   MODULE READY PROMISE
============================================================ */

const WebBktxReady =
    loadWebBktxModules()
        .catch(
            error => {

                console.error(
                    "[WebBktx] Module loading failed:",
                    error
                );


                throw error;

            }
        );


/* ============================================================
   CORE CLASS
============================================================ */

class WebBktxCore {

    constructor(options = {}) {

        this.version =
            WEBBKTX_CORE_VERSION;


        this.options =
            options;


        this.memory =
            null;


        this.cpu =
            null;


        this.xbe =
            null;


        this.game =
            null;


        this.running =
            false;


        this.initialized =
            false;


        this.settings = {

            /*
             * 64 MB default RAM.
             */

            ramSize:
                options.ramSize ||
                64 * 1024 * 1024,


            debug:
                options.debug !== false,


            maxInstructions:
                options.maxInstructions ||
                100000

        };


        this.logBuffer = [];


        /*
         * Core initialization is performed
         * synchronously when modules are ready.
         *
         * app.js can call methods after
         * waiting for WebBktxReady.
         */

        if (
            WebBktxModulesReady
        ) {

            this.initialize();

        }

    }


    /* ========================================================
       LOG
    ======================================================== */

    log(
        message,
        data = null
    ) {

        const entry = {

            time:
                new Date().toISOString(),

            message,

            data

        };


        this.logBuffer.push(
            entry
        );


        if (
            this.logBuffer.length >
            500
        ) {

            this.logBuffer.shift();

        }


        if (
            this.settings.debug
        ) {

            if (
                data !== null
            ) {

                console.log(
                    "[WebBktx]",
                    message,
                    data
                );

            } else {

                console.log(
                    "[WebBktx]",
                    message
                );

            }

        }

    }


    /* ========================================================
       ERROR
    ======================================================== */

    error(
        message,
        error = null
    ) {

        console.error(
            "[WebBktx]",
            message,
            error || ""
        );

    }


    /* ========================================================
       INITIALIZE
    ======================================================== */

    initialize() {

        if (
            this.initialized
        ) {

            return true;

        }


        if (
            !WebBktxModulesReady
        ) {

            throw new Error(
                "WebBktx modules are not ready."
            );

        }


        this.log(
            "Initializing WebBktx Core..."
        );


        /*
         * MEMORY
         */

        this.memory =
            new WebBktxMemoryClass(
                this.settings.ramSize
            );


        this.log(
            "RAM initialized.",
            {
                size:
                    this.settings.ramSize
            }
        );


        /*
         * CPU
         */

        this.cpu =
            new WebBktxCPUClass(
                this.memory
            );


        this.log(
            "CPU initialized."
        );


        /*
         * XBE
         */

        this.xbe =
            new WebBktxXBEClass();


        this.log(
            "XBE loader initialized."
        );


        this.initialized =
            true;


        /*
         * Reset state.
         */

        this.reset();


        this.initialized =
            true;


        this.log(
            "WebBktx Core initialized successfully."
        );


        return true;

    }


    /* ========================================================
       RESET
    ======================================================== */

    reset() {

        if (
            !this.initialized &&
            !WebBktxModulesReady
        ) {

            return;

        }


        this.running =
            false;


        this.game =
            null;


        if (
            this.memory &&
            typeof this.memory.clear ===
            "function"
        ) {

            this.memory.clear();

        }


        if (
            this.cpu &&
            typeof this.cpu.reset ===
            "function"
        ) {

            this.cpu.reset();

        }


        this.log(
            "Core reset."
        );

    }


    /* ========================================================
       LOAD GAME
    ======================================================== */

    async loadGame(file) {

        this.ensureInitialized();


        if (!file) {

            throw new Error(
                "No game file supplied."
            );

        }


        this.log(
            "Loading game...",
            {
                name:
                    file.name,

                size:
                    file.size
            }
        );


        /*
         * XBE loader.
         */

        let image;


        if (
            typeof this.xbe.load ===
            "function"
        ) {

            image =
                await this.xbe.load(
                    file
                );

        } else {

            throw new Error(
                "XBE loader does not provide load()."
            );

        }


        this.game =
            image;


        /*
         * Load image into RAM.
         */

        let memoryMap =
            null;


        if (
            typeof this.xbe.loadIntoMemory ===
            "function"
        ) {

            memoryMap =
                this.xbe.loadIntoMemory(
                    this.memory
                );

        }


        /*
         * Entry point.
         */

        if (
            image &&
            image.entryPoint !==
            undefined
        ) {

            const entry =
                Number(
                    image.entryPoint
                ) >>> 0;


            if (
                this.cpu &&
                typeof this.cpu.setInstructionPointer ===
                "function"
            ) {

                this.cpu.setInstructionPointer(
                    entry
                );

            } else if (
                this.cpu
            ) {

                this.cpu.EIP =
                    entry;

            }

        }


        this.log(
            "Game loaded.",
            {
                entryPoint:
                    image
                        ? image.entryPoint
                        : null,

                memoryMap
            }
        );


        return {

            success:
                true,

            recognized:
                true,

            image,

            memory:
                memoryMap,

            entryPoint:
                image
                    ? image.entryPoint
                    : null

        };

    }


    /* ========================================================
       STEP
    ======================================================== */

    step() {

        this.ensureInitialized();


        if (!this.game) {

            throw new Error(
                "No game loaded."
            );

        }


        if (
            !this.cpu ||
            typeof this.cpu.step !==
            "function"
        ) {

            throw new Error(
                "CPU step() is unavailable."
            );

        }


        const result =
            this.cpu.step();


        return result;

    }


    /* ========================================================
       RUN
    ======================================================== */

    run(
        limit =
            this.settings.maxInstructions
    ) {

        this.ensureInitialized();


        if (!this.game) {

            throw new Error(
                "No game loaded."
            );

        }


        this.running =
            true;


        let executed =
            0;


        let last =
            null;


        try {

            while (
                this.running &&
                executed <
                limit
            ) {

                last =
                    this.step();


                executed++;


                if (
                    last &&
                    last.halted
                ) {

                    break;

                }

            }

        } catch (error) {

            this.running =
                false;


            this.error(
                "CPU execution failed.",
                error
            );


            throw error;

        }


        this.running =
            false;


        return {

            executed,

            last,

            running:
                false

        };

    }


    /* ========================================================
       STOP
    ======================================================== */

    stop() {

        this.running =
            false;


        if (
            this.cpu &&
            typeof this.cpu.stop ===
            "function"
        ) {

            this.cpu.stop();

        }

    }


    /* ========================================================
       ENTRY POINT
    ======================================================== */

    getEntryPoint() {

        this.ensureInitialized();


        if (!this.game) {

            return null;

        }


        return (
            this.game.entryPoint ??
            null
        );

    }


    /* ========================================================
       CPU STATE
    ======================================================== */

    getCPUState() {

        this.ensureInitialized();


        if (
            this.cpu &&
            typeof this.cpu.getState ===
            "function"
        ) {

            return this.cpu.getState();

        }


        return {

            EIP:
                this.cpu
                    ? this.cpu.EIP
                    : 0,

            EAX:
                this.cpu
                    ? this.cpu.EAX
                    : 0,

            EBX:
                this.cpu
                    ? this.cpu.EBX
                    : 0,

            ECX:
                this.cpu
                    ? this.cpu.ECX
                    : 0,

            EDX:
                this.cpu
                    ? this.cpu.EDX
                    : 0

        };

    }


    /* ========================================================
       MEMORY INFO
    ======================================================== */

    getMemoryInfo() {

        this.ensureInitialized();


        return {

            size:
                this.memory.size,

            sizeMB:
                this.memory.size /
                1024 /
                1024

        };

    }


    /* ========================================================
       DIAGNOSTICS
    ======================================================== */

    diagnostics() {

        this.ensureInitialized();


        return {

            core: {

                version:
                    this.version,

                initialized:
                    this.initialized,

                running:
                    this.running

            },


            memory:
                this.getMemoryInfo(),


            cpu:
                this.getCPUState(),


            game:
                this.game
                    ? {

                        loaded:
                            true,

                        name:
                            this.game.name ||
                            "XBE",

                        entryPoint:
                            this.game.entryPoint

                    }
                    : {

                        loaded:
                            false

                    }

        };

    }


    /* ========================================================
       ENSURE INITIALIZED
    ======================================================== */

    ensureInitialized() {

        if (
            !this.initialized
        ) {

            if (
                !WebBktxModulesReady
            ) {

                throw new Error(
                    "WebBktx Core modules are still loading."
                );

            }


            this.initialize();

        }

    }


    /* ========================================================
       LOGS
    ======================================================== */

    getLogs() {

        return [
            ...this.logBuffer
        ];

    }

}


/* ============================================================
   GLOBAL API
============================================================ */

window.WebBktxCore = {

    WebBktxCore,

    version:
        WEBBKTX_CORE_VERSION,

    ready:
        WebBktxReady,

    modules:
        WEBBKTX_MODULES

};


/* ============================================================
   GLOBAL READY EVENT
============================================================ */

WebBktxReady
    .then(
        () => {

            console.log(
                `%cWebBktx Core ${WEBBKTX_CORE_VERSION} READY`,
                "font-weight:bold"
            );


            window.dispatchEvent(
                new CustomEvent(
                    "webbktxcore-ready"
                )
            );

        }
    )
    .catch(
        error => {

            console.error(
                "[WebBktx] CORE ERROR:",
                error
            );


            window.dispatchEvent(
                new CustomEvent(
                    "webbktxcore-error",
                    {
                        detail:
                            error
                    }
                )
            );

        }
    );
