/*
 * ============================================================
 * WebBktx Core
 * Xbox Browser Emulator Project
 *
 * VERSION 0.8
 *
 * Main controller for:
 *   - Memory
 *   - CPU
 *   - XBE loader
 *   - Entry point analysis
 *   - Instruction stepping
 *   - Diagnostics
 *
 * This file DOES NOT replace:
 *   memory.js
 *   cpu.js
 *   xbe.js
 *
 * It connects them together.
 * ============================================================
 */

"use strict";


/* ============================================================
   VERSION
============================================================ */

const WEBBKTX_VERSION = "0.8";


/* ============================================================
   SAFE MODULE RESOLUTION
============================================================ */

function resolveModule(names) {

    for (const name of names) {

        if (
            typeof window[name] !== "undefined"
        ) {

            return window[name];

        }

    }

    return null;

}


/* ============================================================
   CORE CLASS
============================================================ */

class WebBktxCore {

    constructor(options = {}) {

        this.version =
            WEBBKTX_VERSION;


        this.options = {

            ramSize:
                options.ramSize ||
                64 * 1024 * 1024,

            debug:
                options.debug !== false,

            maxInstructions:
                options.maxInstructions ||
                10000

        };


        this.memory = null;

        this.cpu = null;

        this.xbe = null;

        this.game = null;


        this.initialized = false;

        this.running = false;


        this.logs = [];

    }


    /* ========================================================
       LOG
    ======================================================== */

    log(message, data = null) {

        const entry = {

            time:
                Date.now(),

            message,

            data

        };


        this.logs.push(entry);


        if (
            this.logs.length > 500
        ) {

            this.logs.shift();

        }


        if (this.options.debug) {

            if (data !== null) {

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


    error(message, error = null) {

        console.error(
            "[WebBktx]",
            message,
            error || ""
        );


        this.logs.push({

            time:
                Date.now(),

            error:
                message,

            detail:
                error
                    ? error.message
                    : null

        });

    }


    /* ========================================================
       INITIALIZE
    ======================================================== */

    initialize() {

        if (this.initialized) {

            return true;

        }


        this.log(
            "Initializing WebBktx Core 0.8..."
        );


        /*
         * ----------------------------------------------------
         * Find Memory
         * ----------------------------------------------------
         */

        const MemoryClass =
            resolveModule([

                "WebBktxMemory",

                "Memory",

                "XboxMemory"

            ]);


        if (!MemoryClass) {

            throw new Error(
                "WebBktxMemory not found. " +
                "Load core/memory.js before core.js."
            );

        }


        /*
         * ----------------------------------------------------
         * Find CPU
         * ----------------------------------------------------
         */

        const CPUClass =
            resolveModule([

                "WebBktxCPU",

                "X86CPU",

                "CPU",

                "XboxCPU"

            ]);


        if (!CPUClass) {

            throw new Error(
                "WebBktxCPU not found. " +
                "Load core/cpu.js before core.js."
            );

        }


        /*
         * ----------------------------------------------------
         * Find XBE
         * ----------------------------------------------------
         */

        const XBEClass =
            resolveModule([

                "WebBktxXBE",

                "XBEImage",

                "XBE",

                "XboxXBE"

            ]);


        if (!XBEClass) {

            throw new Error(
                "WebBktxXBE not found. " +
                "Load core/xbe.js before core.js."
            );

        }


        /*
         * ----------------------------------------------------
         * Create Memory
         * ----------------------------------------------------
         */

        try {

            this.memory =
                new MemoryClass(
                    this.options.ramSize
                );

        } catch (error) {

            throw new Error(
                "Memory initialization failed: " +
                error.message
            );

        }


        this.log(
            "Memory initialized.",
            {
                size:
                    this.memory.size
            }
        );


        /*
         * ----------------------------------------------------
         * Create CPU
         * ----------------------------------------------------
         */

        try {

            this.cpu =
                new CPUClass(
                    this.memory
                );

        } catch (error) {

            throw new Error(
                "CPU initialization failed: " +
                error.message
            );

        }


        this.log(
            "CPU initialized."
        );


        /*
         * ----------------------------------------------------
         * Create XBE loader
         * ----------------------------------------------------
         */

        try {

            this.xbe =
                new XBEClass();

        } catch (error) {

            throw new Error(
                "XBE loader initialization failed: " +
                error.message
            );

        }


        this.log(
            "XBE loader initialized."
        );


        this.initialized =
            true;


        this.reset();


        this.log(
            "WebBktx Core 0.8 READY."
        );


        return true;

    }


    /* ========================================================
       RESET
    ======================================================== */

    reset() {

        if (!this.initialized) {

            return;

        }


        this.running =
            false;


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


        this.game =
            null;


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
                "No XBE supplied."
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


        let image;


        /*
         * ----------------------------------------------------
         * Use xbe.js
         * ----------------------------------------------------
         */

        if (
            this.xbe &&
            typeof this.xbe.load ===
            "function"
        ) {

            image =
                await this.xbe.load(
                    file
                );

        }


        /*
         * Some XBE modules expose loadFile()
         */

        else if (
            this.xbe &&
            typeof this.xbe.loadFile ===
            "function"
        ) {

            image =
                await this.xbe.loadFile(
                    file
                );

        }


        else {

            throw new Error(
                "XBE loader does not provide load() " +
                "or loadFile()."
            );

        }


        if (!image) {

            throw new Error(
                "XBE loader returned no image."
            );

        }


        this.game =
            image;


        /*
         * ----------------------------------------------------
         * Load executable into RAM
         * ----------------------------------------------------
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

        else if (
            typeof image.loadIntoMemory ===
            "function"
        ) {

            memoryMap =
                image.loadIntoMemory(
                    this.memory
                );

        }


        /*
         * ----------------------------------------------------
         * ENTRY POINT
         * ----------------------------------------------------
         */

        const entryPoint =
            this.getImageEntryPoint(
                image
            );


        if (
            entryPoint !== null
        ) {

            this.setEIP(
                entryPoint
            );

        }


        this.log(
            "XBE loaded successfully.",
            {

                entryPoint,

                memoryMap

            }
        );


        return {

            success: true,

            image,

            entryPoint,

            memory:
                memoryMap

        };

    }


    /* ========================================================
       GET ENTRY POINT
    ======================================================== */

    getImageEntryPoint(image) {

        if (!image) {

            return null;

        }


        const possible = [

            image.entryPoint,

            image.entrypoint,

            image.EntryPoint,

            image.header &&
                image.header.entryPoint,

            image.header &&
                image.header.entrypoint

        ];


        for (
            const value
            of possible
        ) {

            if (
                typeof value ===
                "number"
            ) {

                return value >>> 0;

            }

        }


        return null;

    }


    /* ========================================================
       SET EIP
    ======================================================== */

    setEIP(value) {

        const address =
            value >>> 0;


        if (
            this.cpu &&
            typeof this.cpu.setInstructionPointer ===
            "function"
        ) {

            this.cpu.setInstructionPointer(
                address
            );

            return;

        }


        if (
            this.cpu
        ) {

            this.cpu.EIP =
                address;

        }

    }


    /* ========================================================
       GET EIP
    ======================================================== */

    getEIP() {

        if (!this.cpu) {

            return 0;

        }


        if (
            typeof this.cpu.getInstructionPointer ===
            "function"
        ) {

            return (
                this.cpu.getInstructionPointer()
                >>> 0
            );

        }


        return (
            this.cpu.EIP
            >>> 0
        );

    }


    /* ========================================================
       READ MEMORY
    ======================================================== */

    readMemory(address, length = 16) {

        this.ensureInitialized();


        if (
            !this.memory
        ) {

            throw new Error(
                "Memory unavailable."
            );

        }


        if (
            typeof this.memory.readBytes ===
            "function"
        ) {

            return this.memory.readBytes(
                address >>> 0,
                length
            );

        }


        if (
            this.memory.memory
        ) {

            return this.memory.memory.slice(
                address >>> 0,
                (address >>> 0) + length
            );

        }


        throw new Error(
            "Memory read API unavailable."
        );

    }


    /* ========================================================
       PEEK ENTRY POINT
    ======================================================== */

    peekEntryPoint(length = 16) {

        const entry =
            this.getEntryPoint();


        if (
            entry === null
        ) {

            return null;

        }


        try {

            const bytes =
                this.readMemory(
                    entry,
                    length
                );


            return {

                address:
                    entry,

                bytes:

                    Array.from(
                        bytes
                    )

            };

        } catch (error) {

            this.error(
                "Unable to read entry point.",
                error
            );


            return null;

        }

    }


    /* ========================================================
       STEP ONE INSTRUCTION
    ======================================================== */

    step() {

        this.ensureInitialized();


        if (!this.game) {

            throw new Error(
                "No XBE loaded."
            );

        }


        if (
            !this.cpu ||
            typeof this.cpu.step !==
            "function"
        ) {

            throw new Error(
                "CPU step() is not available."
            );

        }


        const result =
            this.cpu.step();


        return result;

    }


    /* ========================================================
       RUN
    ======================================================== */

    run(limit = null) {

        this.ensureInitialized();


        if (!this.game) {

            throw new Error(
                "No XBE loaded."
            );

        }


        const maximum =
            limit ||
            this.options.maxInstructions;


        let executed = 0;

        let last =
            null;


        this.running =
            true;


        try {

            while (
                this.running &&
                executed <
                maximum
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
                "CPU execution error.",
                error
            );


            throw error;

        }


        this.running =
            false;


        return {

            executed,

            last,

            EIP:
                this.getEIP()

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


        const state = {

            EIP:
                this.getEIP(),

            EAX:
                0,

            EBX:
                0,

            ECX:
                0,

            EDX:
                0,

            ESI:
                0,

            EDI:
                0,

            EBP:
                0,

            ESP:
                0

        };


        if (
            this.cpu &&
            this.cpu.registers
        ) {

            Object.assign(
                state,
                this.cpu.registers
            );

        }


        return state;

    }


    /* ========================================================
       MEMORY INFO
    ======================================================== */

    getMemoryInfo() {

        this.ensureInitialized();


        const size =
            this.memory &&
            Number.isFinite(
                this.memory.size
            )
                ? this.memory.size
                : 0;


        return {

            bytes:
                size,

            megabytes:
                size /
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


            modules: {

                memory:
                    !!this.memory,

                cpu:
                    !!this.cpu,

                xbe:
                    !!this.xbe

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
                            this.getEntryPoint(),

                        firstBytes:
                            this.peekEntryPoint(16)

                    }

                    : {

                        loaded:
                            false

                    }

        };

    }


    /* ========================================================
       STATUS
    ======================================================== */

    getStatus() {

        return {

            version:
                this.version,

            initialized:
                this.initialized,

            running:
                this.running,

            gameLoaded:
                !!this.game,

            entryPoint:
                this.getEntryPoint()

        };

    }


    /* ========================================================
       ENSURE INITIALIZED
    ======================================================== */

    ensureInitialized() {

        if (
            !this.initialized
        ) {

            this.initialize();

        }

    }


    /* ========================================================
       LOGS
    ======================================================== */

    getLogs() {

        return [
            ...this.logs
        ];

    }

}


/* ============================================================
   GLOBAL EXPORT
============================================================ */

/*
 * Main export
 */

window.WebBktxCore =
    WebBktxCore;


/*
 * Compatibility with older app.js
 */

window.WebBktxCoreAPI = {

    WebBktxCore:
        WebBktxCore

};


/*
 * Explicit API object.
 *
 * This also allows:
 *
 * WebBktxCoreAPI.WebBktxCore
 */

window.WebBktx =
    {

        version:
            WEBBKTX_VERSION,

        Core:
            WebBktxCore

    };


/* ============================================================
   READY MESSAGE
============================================================ */

console.log(
    `%cWebBktx Core ${WEBBKTX_VERSION} loaded`,
    "font-weight:bold"
);


/* ============================================================
   MODULE STATUS
============================================================ */

console.log(
    "Memory:",
    typeof window.WebBktxMemory
);


console.log(
    "CPU:",
    typeof window.WebBktxCPU
);


console.log(
    "XBE:",
    typeof window.WebBktxXBE
);


console.log(
    "Core:",
    typeof window.WebBktxCore
);
