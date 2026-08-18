/*
 * ============================================================
 * WebBktx Core
 *
 * Version: 1.0
 *
 * Main emulator runtime controller
 *
 * Responsibilities:
 *
 *   - Memory
 *   - CPU
 *   - Decoder
 *   - XBE
 *   - Xbox Kernel
 *
 * Architecture:
 *
 *   app.js
 *      |
 *      v
 *   WebBktxCore
 *      |
 *      +---- Memory
 *      |
 *      +---- CPU
 *      |
 *      +---- Decoder
 *      |
 *      +---- XBE
 *      |
 *      v
 *   WebBktxKernel
 *      |
 *      +---- Thunks
 *      +---- XAPI
 *      +---- XFile
 *      +---- XInput
 *      +---- XGraphics
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

const WEBBKTX_CORE_VERSION = "1.0";


/* ============================================================
   CORE
============================================================ */

class WebBktxCore {

    constructor(options = {}) {

        this.version =
            WEBBKTX_CORE_VERSION;


        /* ----------------------------------------------------
           COMPONENTS
        ---------------------------------------------------- */

        this.memory = null;

        this.cpu = null;

        this.decoder = null;

        this.xbe = null;

        this.kernel = null;


        /* ----------------------------------------------------
           GAME
        ---------------------------------------------------- */

        this.game = null;

        this.gameFile = null;


        /* ----------------------------------------------------
           STATE
        ---------------------------------------------------- */

        this.initialized = false;

        this.running = false;

        this.paused = false;


        /* ----------------------------------------------------
           SETTINGS
        ---------------------------------------------------- */

        this.settings = {

            ramSize:
                Number.isInteger(
                    options.ramSize
                )
                    ? options.ramSize
                    : 64 * 1024 * 1024,

            debug:
                options.debug !== false,

            maxInstructions:
                Number.isInteger(
                    options.maxInstructions
                )
                    ? options.maxInstructions
                    : 100000,

            autoKernel:
                options.autoKernel !== false

        };


        /* ----------------------------------------------------
           LOG
        ---------------------------------------------------- */

        this.logBuffer = [];


        /* ----------------------------------------------------
           CALLBACKS
        ---------------------------------------------------- */

        this.onReady = null;

        this.onGameLoaded = null;

        this.onError = null;

        this.onStop = null;

    }


    /* ========================================================
       LOGGING
    ======================================================== */

    log(
        message,
        data = null
    ) {

        const entry = {

            time:
                new Date().toISOString(),

            type:
                "log",

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
            this.settings.debug &&
            typeof console !==
            "undefined"
        ) {

            if (
                data !== null
            ) {

                console.log(
                    `[WebBktx Core] ${message}`,
                    data
                );

            } else {

                console.log(
                    `[WebBktx Core] ${message}`
                );

            }

        }

    }


    error(
        message,
        error = null
    ) {

        const entry = {

            time:
                new Date().toISOString(),

            type:
                "error",

            message,

            detail:
                error
                    ? (
                        error.message ||
                        String(error)
                    )
                    : null

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


        console.error(
            `[WebBktx Core] ${message}`,
            error || ""
        );


        if (
            typeof this.onError ===
            "function"
        ) {

            try {

                this.onError(
                    entry
                );

            } catch (_) {}

        }

    }


    /* ========================================================
       MODULE CHECK
    ======================================================== */

    checkModules() {

        const modules = {

            memory:
                typeof WebBktxMemory !==
                "undefined",

            cpu:
                typeof WebBktxCPU !==
                "undefined",

            xbe:
                typeof WebBktxXBE !==
                "undefined",

            decoder:
                typeof WebBktxDecoder !==
                "undefined",

            kernel:
                typeof WebBktxKernel !==
                "undefined"

        };


        this.log(
            "Module check.",
            modules
        );


        return modules;

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


        this.log(
            "Initializing WebBktx Core 1.0..."
        );


        const modules =
            this.checkModules();


        /*
         * Memory
         */

        if (
            !modules.memory
        ) {

            throw new Error(
                "WebBktxMemory is not loaded."
            );

        }


        /*
         * CPU
         */

        if (
            !modules.cpu
        ) {

            throw new Error(
                "WebBktxCPU is not loaded."
            );

        }


        /*
         * XBE
         */

        if (
            !modules.xbe
        ) {

            throw new Error(
                "WebBktxXBE is not loaded."
            );

        }


        /* ----------------------------------------------------
           MEMORY
        ---------------------------------------------------- */

        this.memory =
            new WebBktxMemory(
                this.settings.ramSize
            );


        this.log(
            "Memory initialized.",
            {
                size:
                    this.settings.ramSize,

                sizeMB:
                    this.settings.ramSize /
                    1024 /
                    1024

            }
        );


        /* ----------------------------------------------------
           CPU
        ---------------------------------------------------- */

        this.cpu =
            new WebBktxCPU(
                this.memory
            );


        this.log(
            "CPU initialized."
        );


        /* ----------------------------------------------------
           DECODER
        ---------------------------------------------------- */

        if (
            modules.decoder
        ) {

            try {

                if (
                    typeof WebBktxDecoder ===
                    "function"
                ) {

                    this.decoder =
                        new WebBktxDecoder(
                            this.memory
                        );

                } else {

                    this.decoder =
                        WebBktxDecoder;

                }


                if (
                    this.cpu &&
                    typeof this.cpu.attachDecoder ===
                    "function"
                ) {

                    this.cpu.attachDecoder(
                        this.decoder
                    );

                }


                this.log(
                    "Decoder attached."
                );

            } catch (error) {

                this.error(
                    "Decoder initialization failed.",
                    error
                );

            }

        } else {

            this.log(
                "Decoder not available. CPU can be initialized without it."
            );

        }


        /* ----------------------------------------------------
           XBE
        ---------------------------------------------------- */

        this.xbe =
            new WebBktxXBE();


        this.log(
            "XBE subsystem initialized."
        );


        /* ----------------------------------------------------
           KERNEL
        ---------------------------------------------------- */

        if (
            this.settings.autoKernel
        ) {

            this.initializeKernel(
                modules.kernel
            );

        }


        /* ----------------------------------------------------
           CPU RESET
        ---------------------------------------------------- */

        if (
            this.cpu &&
            typeof this.cpu.reset ===
            "function"
        ) {

            this.cpu.reset();

        }


        this.initialized =
            true;


        this.log(
            "WebBktx Core 1.0 initialized."
        );


        if (
            typeof this.onReady ===
            "function"
        ) {

            try {

                this.onReady(
                    this
                );

            } catch (_) {}

        }


        return true;

    }


    /* ========================================================
       KERNEL INITIALIZATION
    ======================================================== */

    initializeKernel(
        available = true
    ) {

        if (
            !available ||
            typeof WebBktxKernel ===
            "undefined"
        ) {

            this.log(
                "Kernel not available. Core will continue without Kernel."
            );

            return null;

        }


        try {

            const options = {

                memory:
                    this.memory,

                cpu:
                    this.cpu,

                xbe:
                    this.xbe,

                decoder:
                    this.decoder,

                core:
                    this

            };


            this.kernel =
                new WebBktxKernel(
                    options
                );


            /*
             * Optional kernel initialization.
             */

            if (
                typeof this.kernel.initialize ===
                "function"
            ) {

                this.kernel.initialize();

            }


            this.log(
                "Xbox Kernel attached."
            );


            return this.kernel;

        } catch (error) {

            this.error(
                "Kernel initialization failed.",
                error
            );


            /*
             * Do not destroy the entire
             * emulator if the optional
             * kernel is unavailable.
             */

            this.kernel =
                null;


            return null;

        }

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
       LOAD GAME
    ======================================================== */

    async loadGame(
        source
    ) {

        this.ensureInitialized();


        if (
            !source
        ) {

            throw new Error(
                "No XBE supplied."
            );

        }


        this.log(
            "Loading XBE..."
        );


        /*
         * Store original source.
         */

        this.gameFile =
            source;


        try {

            /*
             * Create a new XBE instance
             * for this game.
             */

            this.xbe =
                new WebBktxXBE(
                    source
                );


            /*
             * XBE loader accepts:
             *
             * ArrayBuffer
             * Uint8Array
             * Blob
             */

            await this.xbe.load();


            this.game =
                this.xbe;


            this.log(
                "XBE loaded.",
                this.getGameInfo()
            );


            /*
             * Reconnect XBE to Kernel.
             */

            if (
                this.kernel
            ) {

                if (
                    typeof this.kernel.attachXBE ===
                    "function"
                ) {

                    this.kernel.attachXBE(
                        this.xbe
                    );

                }


                if (
                    typeof this.kernel.loadGame ===
                    "function"
                ) {

                    await this.kernel.loadGame(
                        this.xbe
                    );

                }

            }


            /*
             * Load executable section.
             */

            const memoryResult =
                this.mapXBEIntoMemory();


            /*
             * Set CPU entry point.
             */

            const cpuEntry =
                this.getCPUEntryAddress();


            if (
                cpuEntry !== null
            ) {

                this.setCPUEntry(
                    cpuEntry
                );

            }


            /*
             * Notify.
             */

            if (
                typeof this.onGameLoaded ===
                "function"
            ) {

                try {

                    this.onGameLoaded(
                        this.game
                    );

                } catch (_) {}

            }


            return {

                success:
                    true,

                xbe:
                    this.xbe,

                game:
                    this.game,

                memory:
                    memoryResult,

                entryPoint:
                    cpuEntry,

                info:
                    this.getGameInfo()

            };

        } catch (error) {

            this.game =
                null;


            this.error(
                "XBE loading failed.",
                error
            );


            throw error;

        }

    }


    /* ========================================================
       MAP XBE
    ======================================================== */

    mapXBEIntoMemory() {

        this.ensureInitialized();


        if (
            !this.xbe
        ) {

            throw new Error(
                "XBE subsystem is unavailable."
            );

        }


        if (
            !this.xbe.parser ||
            !this.xbe.parser.sections
        ) {

            /*
             * Newer XBE implementations may
             * expose sections directly.
             */

            if (
                Array.isArray(
                    this.xbe.sections
                )
            ) {

                const results = [];


                for (
                    const section
                    of this.xbe.sections
                ) {

                    if (
                        typeof this.xbe.loadSectionIntoMemory ===
                        "function"
                    ) {

                        results.push(
                            this.xbe
                                .loadSectionIntoMemory(
                                    this.memory,
                                    section
                                )
                        );

                    } else if (
                        this.xbe.parser &&
                        typeof this.xbe.parser.loadSectionIntoMemory ===
                        "function"
                    ) {

                        results.push(
                            this.xbe.parser
                                .loadSectionIntoMemory(
                                    this.memory,
                                    section
                                )
                        );

                    }

                }


                return results;

            }


            return null;

        }


        const sections =
            this.xbe.parser.sections;


        const results =
            [];


        for (
            const section
            of sections
        ) {

            try {

                if (
                    typeof this.xbe.parser
                        .loadSectionIntoMemory ===
                    "function"
                ) {

                    const result =
                        this.xbe.parser
                            .loadSectionIntoMemory(
                                this.memory,
                                section
                            );


                    results.push(
                        result
                    );

                }

            } catch (error) {

                /*
                 * Do not silently ignore
                 * malformed sections.
                 */

                this.error(
                    `Failed to map XBE section: ${
                        section.name ||
                        section.index
                    }`,
                    error
                );

            }

        }


        return results;

    }


    /* ========================================================
       CPU ENTRY
    ======================================================== */

    getCPUEntryAddress() {

        if (
            !this.game
        ) {

            return null;

        }


        /*
         * Preferred XBE API.
         */

        if (
            typeof this.xbe.getCPUEntryAddress ===
            "function"
        ) {

            const address =
                this.xbe.getCPUEntryAddress(
                    this.memory
                );


            if (
                address !== null &&
                address !== undefined
            ) {

                return address >>> 0;

            }

        }


        /*
         * Fallback through parser.
         */

        if (
            this.xbe.parser &&
            typeof this.xbe.parser.getCPUEntryAddress ===
            "function"
        ) {

            const address =
                this.xbe.parser.getCPUEntryAddress(
                    this.memory
                );


            if (
                address !== null &&
                address !== undefined
            ) {

                return address >>> 0;

            }

        }


        /*
         * Last-resort entry point handling.
         */

        if (
            this.xbe.entryPoint !==
            undefined &&
            this.xbe.entryPoint !==
            null
        ) {

            const entry =
                this.xbe.entryPoint >>> 0;


            if (
                entry <
                this.memory.size
            ) {

                return entry;

            }

        }


        return null;

    }


    setCPUEntry(
        address
    ) {

        address >>>
            = 0;


        if (
            !this.cpu
        ) {

            throw new Error(
                "CPU is unavailable."
            );

        }


        if (
            typeof this.cpu.setEIP ===
            "function"
        ) {

            this.cpu.setEIP(
                address
            );

        } else if (
            typeof this.cpu.setInstructionPointer ===
            "function"
        ) {

            this.cpu.setInstructionPointer(
                address
            );

        } else {

            this.cpu.EIP =
                address >>> 0;

        }


        this.log(
            "CPU entry point configured.",
            {
                EIP:
                    "0x" +
                    address
                        .toString(16)
                        .padStart(
                            8,
                            "0"
                        )
                        .toUpperCase()
            }
        );

    }


    /* ========================================================
       STEP
    ======================================================== */

    step() {

        this.ensureInitialized();


        if (
            !this.game
        ) {

            throw new Error(
                "No XBE supplied."
            );

        }


        /*
         * Let Kernel prepare the execution
         * environment if it provides a hook.
         */

        if (
            this.kernel &&
            typeof this.kernel.beforeCPUInstruction ===
            "function"
        ) {

            this.kernel.beforeCPUInstruction(
                this.cpu
            );

        }


        let result;


        try {

            result =
                this.cpu.step();

        } catch (error) {

            this.error(
                "CPU execution error.",
                error
            );


            this.stop();


            throw error;

        }


        /*
         * Kernel instruction hook.
         */

        if (
            this.kernel &&
            typeof this.kernel.afterCPUInstruction ===
            "function"
        ) {

            this.kernel.afterCPUInstruction(
                this.cpu,
                result
            );

        }


        return result;

    }


    /* ========================================================
       RUN
    ======================================================== */

    run(
        instructionLimit =
            this.settings.maxInstructions
    ) {

        this.ensureInitialized();


        if (
            !this.game
        ) {

            throw new Error(
                "No XBE supplied."
            );

        }


        if (
            !Number.isInteger(
                instructionLimit
            ) ||
            instructionLimit <= 0
        ) {

            throw new Error(
                "Invalid instruction limit."
            );

        }


        this.running =
            true;

        this.paused =
            false;


        let executed =
            0;

        let last =
            null;


        try {

            /*
             * Kernel start hook.
             */

            if (
                this.kernel &&
                typeof this.kernel.startProcess ===
                "function"
            ) {

                this.kernel.startProcess(
                    this.game
                );

            }


            while (
                this.running &&
                !this.paused &&
                executed <
                instructionLimit
            ) {

                last =
                    this.step();


                executed++;


                /*
                 * CPU HALT.
                 */

                if (
                    last &&
                    last.halted
                ) {

                    break;

                }


                if (
                    this.cpu &&
                    this.cpu.halted
                ) {

                    break;

                }

            }

        } catch (error) {

            this.running =
                false;


            this.error(
                "Execution stopped because of an error.",
                error
            );


            throw error;

        }


        this.running =
            false;


        /*
         * Kernel stop hook.
         */

        if (
            this.kernel &&
            typeof this.kernel.stopProcess ===
            "function"
        ) {

            try {

                this.kernel.stopProcess();

            } catch (error) {

                this.error(
                    "Kernel stop hook failed.",
                    error
                );

            }

        }


        return {

            executed,

            last,

            running:
                this.running,

            paused:
                this.paused

        };

    }


    /* ========================================================
       PAUSE
    ======================================================== */

    pause() {

        this.paused =
            true;

        this.running =
            false;


        if (
            this.cpu &&
            typeof this.cpu.stop ===
            "function"
        ) {

            this.cpu.stop();

        }


        if (
            this.kernel &&
            typeof this.kernel.pause ===
            "function"
        ) {

            try {

                this.kernel.pause();

            } catch (_) {}

        }


        this.log(
            "Execution paused."
        );

    }


    /* ========================================================
       STOP
    ======================================================== */

    stop() {

        this.running =
            false;

        this.paused =
            false;


        if (
            this.cpu &&
            typeof this.cpu.stop ===
            "function"
        ) {

            this.cpu.stop();

        }


        if (
            this.kernel &&
            typeof this.kernel.stop ===
            "function"
        ) {

            try {

                this.kernel.stop();

            } catch (_) {}

        }


        if (
            typeof this.onStop ===
            "function"
        ) {

            try {

                this.onStop();

            } catch (_) {}

        }


        this.log(
            "Execution stopped."
        );

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


        if (
            this.kernel &&
            typeof this.kernel.reset ===
            "function"
        ) {

            try {

                this.kernel.reset();

            } catch (error) {

                this.error(
                    "Kernel reset failed.",
                    error
                );

            }

        }


        this.game =
            null;

        this.gameFile =
            null;


        this.log(
            "Core reset."
        );

    }


    /* ========================================================
       GAME INFORMATION
    ======================================================== */

    getGameInfo() {

        if (
            !this.game
        ) {

            return {

                loaded:
                    false

            };

        }


        let report =
            null;


        if (
            typeof this.game.getReport ===
            "function"
        ) {

            try {

                report =
                    this.game.getReport();

            } catch (_) {}

        }


        return {

            loaded:
                true,

            entryPoint:
                this.game.entryPoint !==
                undefined
                    ? this.game.entryPoint
                    : null,

            sections:
                Array.isArray(
                    this.game.sections
                )
                    ? this.game.sections.length
                    : 0,

            report

        };

    }


    /* ========================================================
       CPU STATE
    ======================================================== */

    getCPUState() {

        this.ensureInitialized();


        if (
            !this.cpu
        ) {

            return null;

        }


        if (
            typeof this.cpu.getStatus ===
            "function"
        ) {

            return this.cpu.getStatus();

        }


        if (
            typeof this.cpu.getRegisters ===
            "function"
        ) {

            return {

                registers:
                    this.cpu.getRegisters(),

                running:
                    this.cpu.running,

                halted:
                    this.cpu.halted

            };

        }


        return {

            EAX:
                this.cpu.EAX >>> 0,

            EBX:
                this.cpu.EBX >>> 0,

            ECX:
                this.cpu.ECX >>> 0,

            EDX:
                this.cpu.EDX >>> 0,

            ESI:
                this.cpu.ESI >>> 0,

            EDI:
                this.cpu.EDI >>> 0,

            EBP:
                this.cpu.EBP >>> 0,

            ESP:
                this.cpu.ESP >>> 0,

            EIP:
                this.cpu.EIP >>> 0,

            EFLAGS:
                this.cpu.EFLAGS >>> 0

        };

    }


    /* ========================================================
       MEMORY INFO
    ======================================================== */

    getMemoryInfo() {

        this.ensureInitialized();


        if (
            !this.memory
        ) {

            return null;

        }


        return {

            size:
                this.memory.size ||
                0,

            sizeMB:
                (
                    this.memory.size ||
                    0
                ) /
                1024 /
                1024

        };

    }


    /* ========================================================
       KERNEL STATUS
    ======================================================== */

    getKernelStatus() {

        if (
            !this.kernel
        ) {

            return {

                available:
                    false

            };

        }


        if (
            typeof this.kernel.getStatus ===
            "function"
        ) {

            try {

                return {

                    available:
                        true,

                    ...this.kernel.getStatus()

                };

            } catch (error) {

                return {

                    available:
                        true,

                    error:
                        error.message

                };

            }

        }


        return {

            available:
                true

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
                    this.running,

                paused:
                    this.paused

            },

            modules:
                this.checkModules(),

            memory:
                this.getMemoryInfo(),

            cpu:
                this.getCPUState(),

            kernel:
                this.getKernelStatus(),

            game:
                this.getGameInfo()

        };

    }


    /* ========================================================
       LOGS
    ======================================================== */

    getLogs() {

        return [
            ...this.logBuffer
        ];

    }


    clearLogs() {

        this.logBuffer =
            [];

    }

}


/* ============================================================
   GLOBAL API
============================================================ */

if (
    typeof window !==
    "undefined"
) {

    window.WebBktxCore =
        WebBktxCore;


    window.WebBktxCoreAPI = {

        WebBktxCore,

        version:
            WEBBKTX_CORE_VERSION

    };

}


/* ============================================================
   READY
============================================================ */

console.log(
    `%cWebBktx Core ${WEBBKTX_CORE_VERSION}`,
    "font-weight:bold"
);

console.log(
    "Core → CPU → XBE → Xbox Kernel architecture ready."
);
