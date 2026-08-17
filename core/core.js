/*
 * ============================================================
 * WebBktx Core
 * Xbox Browser Emulator Project
 *
 * Version: 0.7
 *
 * Main emulator controller
 *
 * Components:
 *   CPU
 *   Memory
 *   XBE Loader
 *
 * ============================================================
 */

"use strict";


/* ============================================================
   VERSION
============================================================ */

const WEBBKTX_CORE_VERSION = "0.7";


/* ============================================================
   CORE
============================================================ */

class WebBktxCore {

    constructor(options = {}) {

        this.version =
            WEBBKTX_CORE_VERSION;


        this.cpu = null;

        this.memory = null;

        this.xbe = null;

        this.game = null;


        this.running = false;

        this.initialized = false;


        this.settings = {

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

    }


    /* ========================================================
       LOGGING
    ======================================================== */

    log(message, data = null) {

        const entry = {

            time:
                new Date().toISOString(),

            message,

            data

        };


        this.logBuffer.push(entry);


        if (
            this.logBuffer.length > 500
        ) {

            this.logBuffer.shift();

        }


        if (this.settings.debug) {

            if (data !== null) {

                console.log(
                    `[WebBktx] ${message}`,
                    data
                );

            } else {

                console.log(
                    `[WebBktx] ${message}`
                );

            }

        }

    }


    error(message, error = null) {

        const entry = {

            time:
                new Date().toISOString(),

            error:
                message,

            detail:
                error
                    ? error.message
                    : null

        };


        this.logBuffer.push(entry);


        console.error(
            `[WebBktx] ${message}`,
            error || ""
        );

    }


    /* ========================================================
       INITIALIZATION
    ======================================================== */

    initialize() {

        if (this.initialized) {

            return true;

        }


        this.log(
            "Initializing WebBktx Core..."
        );


        /*
         * Check required modules
         */

        if (
            typeof WebBktxMemory ===
            "undefined"
        ) {

            throw new Error(
                "WebBktxMemory is not loaded."
            );

        }


        if (
            typeof WebBktxCPU ===
            "undefined"
        ) {

            throw new Error(
                "WebBktxCPU is not loaded."
            );

        }


        if (
            typeof WebBktxXBE ===
            "undefined"
        ) {

            throw new Error(
                "WebBktxXBE is not loaded."
            );

        }


        /*
         * Create memory
         */

        this.memory =
            new WebBktxMemory(
                this.settings.ramSize
            );


        this.log(
            "RAM initialized.",
            {
                bytes:
                    this.settings.ramSize
            }
        );


        /*
         * Create CPU
         */

        this.cpu =
            new WebBktxCPU(
                this.memory
            );


        this.log(
            "CPU initialized."
        );


        /*
         * Create XBE loader
         */

        this.xbe =
            new WebBktxXBE();


        this.log(
            "XBE loader initialized."
        );


        this.initialized =
            true;


        this.reset();


        this.log(
            "WebBktx Core initialized successfully."
        );


        return true;

    }


    /* ========================================================
       RESET
    ======================================================== */

    reset() {

        this.ensureInitialized();


        this.stop();


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


        this.game = null;


        this.log(
            "Core reset."
        );

    }


    /* ========================================================
       LOAD XBE
    ======================================================== */

    async loadGame(file) {

        this.ensureInitialized();


        if (!file) {

            throw new Error(
                "No game file supplied."
            );

        }


        this.log(
            "Loading XBE...",
            {
                name:
                    file.name,

                size:
                    file.size
            }
        );


        /*
         * Load through XBE module.
         */

        const image =
            await this.xbe.load(
                file
            );


        this.game =
            image;


        /*
         * Load executable sections
         * into emulated memory.
         */

        let memoryMap = null;


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
         * Configure CPU entry point.
         */

        if (
            image.entryPoint !==
            undefined &&
            image.entryPoint !== null
        ) {

            if (
                typeof this.cpu.setInstructionPointer ===
                "function"
            ) {

                this.cpu.setInstructionPointer(
                    image.entryPoint
                );

            } else {

                this.cpu.EIP =
                    image.entryPoint >>> 0;

            }

        }


        this.log(
            "XBE loaded.",
            {
                entryPoint:
                    image.entryPoint,

                memoryMap
            }
        );


        return {

            success: true,

            image,

            memory:
                memoryMap,

            entryPoint:
                image.entryPoint

        };

    }


    /* ========================================================
       EXECUTE ONE INSTRUCTION
    ======================================================== */

    step() {

        this.ensureInitialized();


        if (!this.game) {

            throw new Error(
                "No XBE loaded."
            );

        }


        if (
            typeof this.cpu.step !==
            "function"
        ) {

            throw new Error(
                "CPU step() is unavailable."
            );

        }


        const result =
            this.cpu.step();


        this.log(
            "CPU instruction executed.",
            result
        );


        return result;

    }


    /* ========================================================
       EXECUTE MULTIPLE INSTRUCTIONS
    ======================================================== */

    run(
        instructionLimit =
            this.settings.maxInstructions
    ) {

        this.ensureInitialized();


        if (!this.game) {

            throw new Error(
                "No XBE loaded."
            );

        }


        this.running =
            true;


        let executed = 0;

        let lastResult = null;


        try {

            while (
                this.running &&
                executed <
                instructionLimit
            ) {

                lastResult =
                    this.step();


                executed++;


                /*
                 * CPU may report HALT.
                 */

                if (
                    lastResult &&
                    lastResult.halted
                ) {

                    this.running =
                        false;

                    break;

                }

            }

        } catch (error) {

            this.error(
                "CPU execution stopped.",
                error
            );


            this.running =
                false;


            throw error;

        }


        this.running =
            false;


        return {

            executed,

            last:
                lastResult,

            running:
                this.running

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


        this.log(
            "CPU execution stopped."
        );

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
            typeof this.cpu.getState ===
            "function"
        ) {

            return this.cpu.getState();

        }


        return {

            EIP:
                this.cpu.EIP,

            EAX:
                this.cpu.EAX,

            EBX:
                this.cpu.EBX,

            ECX:
                this.cpu.ECX,

            EDX:
                this.cpu.EDX

        };

    }


    /* ========================================================
       MEMORY STATE
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


        const result = {

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

                        loaded: true,

                        name:
                            this.game.name ||
                            "XBE",

                        entryPoint:
                            this.game.entryPoint

                    }
                    : {

                        loaded: false

                    }

        };


        this.log(
            "Diagnostics generated.",
            result
        );


        return result;

    }


    /* ========================================================
       UTILITY
    ======================================================== */

    ensureInitialized() {

        if (!this.initialized) {

            this.initialize();

        }

    }


    getLogs() {

        return [
            ...this.logBuffer
        ];

    }

}


/* ============================================================
   GLOBAL API
============================================================ */

window.WebBktxCore =
    WebBktxCore;


/*
 * Compatibility:
 *
 * Older app.js versions may expect:
 *
 * window.WebBktxCore.WebBktxCore
 */

window.WebBktxCoreAPI = {

    WebBktxCore

};


/* ============================================================
   BOOT MESSAGE
============================================================ */

console.log(
    `%cWebBktx Core ${WEBBKTX_CORE_VERSION}`,
    "font-weight:bold"
);

console.log(
    "Xbox browser emulation core loaded."
);
