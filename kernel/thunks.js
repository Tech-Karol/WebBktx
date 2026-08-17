/*
 * ============================================================
 * WebBktx Xbox Kernel Thunks
 *
 * Version: 1.0
 *
 * Experimental Xbox kernel thunk dispatcher
 *
 * Purpose:
 *   - emulate XBE kernel imports
 *   - resolve thunk addresses
 *   - dispatch imported functions
 *   - provide safe stubs for unsupported APIs
 *   - communicate with kernel.js
 *
 * IMPORTANT:
 *   This is an emulator-side compatibility layer.
 *   It is NOT Microsoft's original Xbox kernel.
 * ============================================================
 */

"use strict";


/* ============================================================
   VERSION
============================================================ */

const WEBBKTX_THUNKS_VERSION = "1.0";


/* ============================================================
   THUNK ERROR
============================================================ */

class WebBktxThunkError extends Error {

    constructor(message, address = null) {

        super(message);

        this.name =
            "WebBktxThunkError";

        this.address =
            address;

    }

}


/* ============================================================
   THUNK DISPATCHER
============================================================ */

class WebBktxThunkDispatcher {

    constructor(options = {}) {

        this.version =
            WEBBKTX_THUNKS_VERSION;

        this.kernel =
            options.kernel || null;

        this.cpu =
            options.cpu || null;

        this.memory =
            options.memory || null;

        this.debug =
            options.debug !== false;

        this.nextAddress =
            options.baseAddress ||
            0x80000000;

        this.thunks =
            new Map();

        this.addressToName =
            new Map();

        this.calls =
            [];

        this.maxCallLog =
            1000;

        this.registerBuiltins();

    }


    /* ========================================================
       LOG
    ======================================================== */

    log(...args) {

        if (this.debug) {

            console.log(
                "[WebBktx Thunks]",
                ...args
            );

        }

    }


    /* ========================================================
       REGISTER THUNK
    ======================================================== */

    register(
        name,
        handler,
        options = {}
    ) {

        if (
            typeof name !== "string" ||
            !name.length
        ) {

            throw new TypeError(
                "Thunk name must be a string."
            );

        }


        if (
            typeof handler !== "function"
        ) {

            throw new TypeError(
                `Thunk ${name} requires a function.`
            );

        }


        let address =
            options.address;


        if (
            address === undefined ||
            address === null
        ) {

            address =
                this.allocateAddress();

        }


        address >>>
            0;


        const thunk = {

            name,

            address,

            handler,

            module:
                options.module ||
                "kernel",

            calls: 0

        };


        this.thunks.set(
            name,
            thunk
        );

        this.addressToName.set(
            address,
            name
        );


        this.log(
            `Registered ${name} at 0x${address.toString(16)}`
        );


        return thunk;

    }


    /* ========================================================
       ADDRESS ALLOCATION
    ======================================================== */

    allocateAddress() {

        const address =
            this.nextAddress >>> 0;


        this.nextAddress =
            (
                this.nextAddress +
                4
            ) >>> 0;


        return address;

    }


    /* ========================================================
       RESOLVE NAME
    ======================================================== */

    resolve(
        name
    ) {

        const thunk =
            this.thunks.get(
                name
            );


        if (!thunk) {

            return null;

        }


        return thunk.address >>> 0;

    }


    /* ========================================================
       RESOLVE ADDRESS
    ======================================================== */

    resolveAddress(
        address
    ) {

        address >>>= 0;


        return (
            this.addressToName.get(
                address
            ) ||
            null
        );

    }


    /* ========================================================
       CALL BY NAME
    ======================================================== */

    call(
        name,
        args = [],
        context = {}
    ) {

        const thunk =
            this.thunks.get(
                name
            );


        if (!thunk) {

            throw new WebBktxThunkError(
                `Unknown kernel thunk: ${name}`
            );

        }


        thunk.calls++;


        const record = {

            time:
                Date.now(),

            name,

            address:
                thunk.address >>> 0,

            args:
                Array.from(args)

        };


        this.calls.push(
            record
        );


        if (
            this.calls.length >
            this.maxCallLog
        ) {

            this.calls.shift();

        }


        this.log(
            `${name}()`,
            args
        );


        return thunk.handler(
            ...args,
            context
        );

    }


    /* ========================================================
       CALL BY ADDRESS
    ======================================================== */

    callAddress(
        address,
        args = [],
        context = {}
    ) {

        const name =
            this.resolveAddress(
                address
            );


        if (!name) {

            throw new WebBktxThunkError(
                `Unknown thunk address: 0x${
                    (address >>> 0)
                        .toString(16)
                        .padStart(8, "0")
                        .toUpperCase()
                }`,
                address
            );

        }


        return this.call(
            name,
            args,
            context
        );

    }


    /* ========================================================
       REGISTER BUILTIN THUNKS
    ======================================================== */

    registerBuiltins() {

        /*
         * ----------------------------------------------------
         * Debug / diagnostic
         * ----------------------------------------------------
         */

        this.register(
            "DbgPrint",
            (...args) => {

                const values =
                    args.filter(
                        value =>
                            value !== undefined
                    );

                console.log(
                    "[Xbox DbgPrint]",
                    ...values
                );

                return 0;

            }
        );


        /*
         * ----------------------------------------------------
         * Memory
         * ----------------------------------------------------
         */

        this.register(
            "KeGetCurrentIrql",
            () => {

                if (
                    this.kernel &&
                    typeof this.kernel.getIRQL ===
                    "function"
                ) {

                    return this.kernel.getIRQL();

                }

                return 0;

            }
        );


        this.register(
            "MmAllocateContiguousMemory",
            size => {

                if (
                    this.kernel &&
                    typeof this.kernel.allocateMemory ===
                    "function"
                ) {

                    return this.kernel.allocateMemory(
                        size
                    );

                }

                return 0;

            }
        );


        this.register(
            "MmFreeContiguousMemory",
            address => {

                if (
                    this.kernel &&
                    typeof this.kernel.freeMemory ===
                    "function"
                ) {

                    this.kernel.freeMemory(
                        address
                    );

                }

                return 0;

            }
        );


        /*
         * ----------------------------------------------------
         * Timing
         * ----------------------------------------------------
         */

        this.register(
            "KeQueryPerformanceCounter",
            () => {

                if (
                    typeof performance !==
                    "undefined"
                ) {

                    return Math.floor(
                        performance.now() *
                        1000
                    );

                }

                return Date.now() * 1000;

            }
        );


        /*
         * ----------------------------------------------------
         * Thread / execution stubs
         * ----------------------------------------------------
         */

        this.register(
            "KeYieldProcessor",
            () => {

                return 0;

            }
        );


        this.register(
            "KeStallExecutionProcessor",
            microseconds => {

                /*
                 * Browser JavaScript cannot perform
                 * a true Xbox CPU stall.
                 *
                 * Keep this deterministic and non-blocking.
                 */

                return 0;

            }
        );


        /*
         * ----------------------------------------------------
         * File-system compatibility
         * ----------------------------------------------------
         */

        this.register(
            "NtClose",
            handle => {

                if (
                    this.kernel &&
                    typeof this.kernel.closeHandle ===
                    "function"
                ) {

                    return this.kernel.closeHandle(
                        handle
                    );

                }

                return 0;

            }
        );


        /*
         * ----------------------------------------------------
         * Xbox notification / debug stubs
         * ----------------------------------------------------
         */

        this.register(
            "KeBugCheck",
            code => {

                console.error(
                    "[WebBktx] Xbox KeBugCheck:",
                    code
                );


                if (
                    this.cpu &&
                    typeof this.cpu.halt ===
                    "function"
                ) {

                    this.cpu.halt();

                }


                return 0;

            }
        );


        this.register(
            "KeBugCheckEx",
            (
                code,
                parameter1,
                parameter2,
                parameter3,
                parameter4
            ) => {

                console.error(
                    "[WebBktx] Xbox KeBugCheckEx",
                    {
                        code,
                        parameter1,
                        parameter2,
                        parameter3,
                        parameter4
                    }
                );


                if (
                    this.cpu &&
                    typeof this.cpu.halt ===
                    "function"
                ) {

                    this.cpu.halt();

                }


                return 0;

            }
        );


        /*
         * ----------------------------------------------------
         * Unsupported API fallback
         * ----------------------------------------------------
         */

        this.register(
            "Unsupported",
            () => {

                return 0;

            }
        );

    }


    /* ========================================================
       INSTALL XBE THUNK TABLE
    ======================================================== */

    installThunkTable(
        imports = []
    ) {

        const result = [];


        for (
            const entry of imports
        ) {

            let name;


            if (
                typeof entry === "string"
            ) {

                name =
                    entry;

            } else if (
                entry &&
                typeof entry.name ===
                "string"
            ) {

                name =
                    entry.name;

            } else {

                continue;

            }


            let thunk =
                this.thunks.get(
                    name
                );


            /*
             * Unknown imports receive a safe
             * placeholder rather than crashing
             * the entire loader immediately.
             */

            if (!thunk) {

                thunk =
                    this.register(
                        name,
                        (...args) => {

                            this.log(
                                `Unimplemented thunk: ${name}`,
                                args
                            );

                            return 0;

                        }
                    );

            }


            result.push({

                name,

                address:
                    thunk.address >>> 0

            });

        }


        return result;

    }


    /* ========================================================
       WRITE THUNK ADDRESS
    ======================================================== */

    writeThunkAddress(
        memory,
        address,
        thunkAddress
    ) {

        if (
            !memory ||
            typeof memory.write32 !==
            "function"
        ) {

            throw new Error(
                "Valid memory object required."
            );

        }


        memory.write32(
            address >>> 0,
            thunkAddress >>> 0
        );

    }


    /* ========================================================
       PATCH POINTER
    ======================================================== */

    patchImport(
        memory,
        importAddress,
        thunkName
    ) {

        const thunkAddress =
            this.resolve(
                thunkName
            );


        if (
            thunkAddress === null
        ) {

            throw new WebBktxThunkError(
                `Cannot resolve import: ${thunkName}`
            );

        }


        this.writeThunkAddress(
            memory,
            importAddress,
            thunkAddress
        );


        return thunkAddress;

    }


    /* ========================================================
       CALL FROM CPU
    ======================================================== */

    invokeFromCPU(
        address,
        cpu = this.cpu
    ) {

        const name =
            this.resolveAddress(
                address
            );


        if (!name) {

            throw new WebBktxThunkError(
                `CPU called unknown thunk 0x${
                    (address >>> 0)
                        .toString(16)
                }`
            );

        }


        /*
         * Standard experimental ABI:
         *
         * arguments are read from the stack.
         *
         * ESP points to the return address.
         * Arguments begin at ESP + 4.
         */

        const args = [];


        if (
            cpu &&
            typeof cpu.peekStack32 ===
            "function"
        ) {

            /*
             * Start with a conservative
             * maximum argument count.
             */

            for (
                let i = 0;
                i < 16;
                i++
            ) {

                try {

                    args.push(
                        cpu.peekStack32(
                            4 +
                            i * 4
                        )
                    );

                } catch {

                    break;

                }

            }

        }


        return this.call(
            name,
            args,
            {
                cpu,
                kernel: this.kernel
            }
        );

    }


    /* ========================================================
       STATUS
    ======================================================== */

    getStatus() {

        return {

            version:
                this.version,

            thunkCount:
                this.thunks.size,

            calls:
                this.calls.length,

            thunks:
                Array.from(
                    this.thunks.values()
                )
                .map(
                    thunk => ({

                        name:
                            thunk.name,

                        address:
                            thunk.address,

                        module:
                            thunk.module,

                        calls:
                            thunk.calls

                    })
                )

        };

    }


    /* ========================================================
       CALL LOG
    ======================================================== */

    getCallLog() {

        return [
            ...this.calls
        ];

    }


    /* ========================================================
       CLEAR LOG
    ======================================================== */

    clearCallLog() {

        this.calls.length =
            0;

    }

}


/* ============================================================
   EXPORT
============================================================ */

window.WebBktxThunkDispatcher =
    WebBktxThunkDispatcher;

window.WebBktxThunkError =
    WebBktxThunkError;


/* ============================================================
   READY
============================================================ */

console.log(
    `WebBktx Thunks ${WEBBKTX_THUNKS_VERSION} loaded.`
);
