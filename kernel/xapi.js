/*
 * ============================================================
 * WebBktx XAPI
 *
 * Version: 1.0
 *
 * Experimental Xbox API compatibility layer
 *
 * Connects:
 *
 *     XBE
 *      |
 *     CPU
 *      |
 *    Kernel
 *      |
 *    Thunks
 *      |
 *    XAPI
 *
 * Provides:
 *
 *   - API registration
 *   - API resolution
 *   - kernel integration
 *   - memory services
 *   - file services
 *   - input state
 *   - thread stubs
 *   - timing
 *   - debug services
 *   - safe fallback handlers
 *
 * This is NOT the original Microsoft Xbox XAPI.
 * It is an emulator-side compatibility layer.
 *
 * ============================================================
 */

"use strict";


/* ============================================================
   VERSION
============================================================ */

const WEBBKTX_XAPI_VERSION = "1.0";


/* ============================================================
   ERROR
============================================================ */

class WebBktxXAPIError extends Error {

    constructor(message) {

        super(message);

        this.name =
            "WebBktxXAPIError";

    }

}


/* ============================================================
   XAPI
============================================================ */

class WebBktxXAPI {

    constructor(options = {}) {

        this.version =
            WEBBKTX_XAPI_VERSION;


        this.kernel =
            options.kernel || null;


        this.thunks =
            options.thunks || null;


        this.memory =
            options.memory || null;


        this.cpu =
            options.cpu || null;


        this.debug =
            options.debug !== false;


        this.apis =
            new Map();


        this.calls =
            [];


        this.maxCallLog =
            1000;


        this.initialized =
            false;


        this.input =
            {

                buttons: 0,

                leftX: 0,

                leftY: 0,

                rightX: 0,

                rightY: 0,

                leftTrigger: 0,

                rightTrigger: 0

            };


        this.handles =
            new Map();


        this.nextHandle =
            1;


        this.initialize();

    }


    /* ========================================================
       LOG
    ======================================================== */

    log(...args) {

        if (this.debug) {

            console.log(
                "[WebBktx XAPI]",
                ...args
            );

        }

    }


    /* ========================================================
       INITIALIZE
    ======================================================== */

    initialize() {

        if (this.initialized) {

            return;

        }


        this.registerCoreAPIs();


        this.initialized =
            true;


        this.log(
            `XAPI ${this.version} initialized.`
        );

    }


    /* ========================================================
       REGISTER API
    ======================================================== */

    register(
        name,
        handler,
        options = {}
    ) {

        if (
            typeof name !==
            "string"
        ) {

            throw new TypeError(
                "XAPI name must be a string."
            );

        }


        if (
            typeof handler !==
            "function"
        ) {

            throw new TypeError(
                `XAPI ${name} requires a function.`
            );

        }


        const api = {

            name,

            handler,

            module:
                options.module ||
                "xapi",

            calls: 0

        };


        this.apis.set(
            name,
            api
        );


        this.log(
            `Registered ${name}`
        );


        return api;

    }


    /* ========================================================
       RESOLVE
    ======================================================== */

    resolve(name) {

        return this.apis.get(
            name
        ) || null;

    }


    /* ========================================================
       CALL
    ======================================================== */

    call(
        name,
        args = [],
        context = {}
    ) {

        const api =
            this.apis.get(
                name
            );


        if (!api) {

            throw new WebBktxXAPIError(
                `Unknown XAPI function: ${name}`
            );

        }


        api.calls++;


        const record = {

            time:
                Date.now(),

            name,

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


        return api.handler(
            ...args,
            context
        );

    }


    /* ========================================================
       HANDLE SYSTEM
    ======================================================== */

    createHandle(
        object
    ) {

        const handle =
            this.nextHandle++;


        this.handles.set(
            handle,
            object
        );


        return handle >>> 0;

    }


    getHandle(
        handle
    ) {

        return this.handles.get(
            handle >>> 0
        ) || null;

    }


    closeHandle(
        handle
    ) {

        return this.handles.delete(
            handle >>> 0
        );

    }


    /* ========================================================
       CORE API
    ======================================================== */

    registerCoreAPIs() {

        /* ----------------------------------------------------
           DEBUG
        ---------------------------------------------------- */

        this.register(
            "XDebugPrint",
            (...args) => {

                console.log(
                    "[Xbox]",
                    ...args
                );

                return 0;

            },
            {
                module: "debug"
            }
        );


        /* ----------------------------------------------------
           TIME
        ---------------------------------------------------- */

        this.register(
            "XGetTickCount",
            () => {

                return (
                    Date.now()
                    >>> 0
                );

            },
            {
                module: "system"
            }
        );


        this.register(
            "XGetPerformanceCounter",
            () => {

                if (
                    typeof performance !==
                    "undefined"
                ) {

                    return Math.floor(
                        performance.now() *
                        1000000
                    );

                }


                return (
                    Date.now() *
                    1000
                );

            },
            {
                module: "system"
            }
        );


        /* ----------------------------------------------------
           MEMORY
        ---------------------------------------------------- */

        this.register(
            "XMemAlloc",
            size => {

                size =
                    Number(size) >>> 0;


                if (
                    this.kernel &&
                    typeof this.kernel.allocateMemory ===
                    "function"
                ) {

                    return this.kernel.allocateMemory(
                        size
                    );

                }


                if (
                    this.memory &&
                    typeof this.memory.allocate ===
                    "function"
                ) {

                    return this.memory.allocate(
                        size
                    );

                }


                return 0;

            },
            {
                module: "memory"
            }
        );


        this.register(
            "XMemFree",
            address => {

                address >>>
                    0;


                if (
                    this.kernel &&
                    typeof this.kernel.freeMemory ===
                    "function"
                ) {

                    this.kernel.freeMemory(
                        address
                    );

                }


                if (
                    this.memory &&
                    typeof this.memory.free ===
                    "function"
                ) {

                    this.memory.free(
                        address
                    );

                }


                return 0;

            },
            {
                module: "memory"
            }
        );


        /* ----------------------------------------------------
           INPUT
        ---------------------------------------------------- */

        this.register(
            "XInputGetState",
            () => {

                return {

                    buttons:
                        this.input.buttons,

                    leftX:
                        this.input.leftX,

                    leftY:
                        this.input.leftY,

                    rightX:
                        this.input.rightX,

                    rightY:
                        this.input.rightY,

                    leftTrigger:
                        this.input.leftTrigger,

                    rightTrigger:
                        this.input.rightTrigger

                };

            },
            {
                module: "input"
            }
        );


        /* ----------------------------------------------------
           THREADS
        ---------------------------------------------------- */

        this.register(
            "XCreateThread",
            (
                entryPoint,
                parameter
            ) => {

                const thread = {

                    entryPoint:
                        entryPoint >>> 0,

                    parameter:
                        parameter >>> 0,

                    running:
                        false,

                    created:
                        Date.now()

                };


                return this.createHandle(
                    thread
                );

            },
            {
                module: "thread"
            }
        );


        this.register(
            "XResumeThread",
            handle => {

                const thread =
                    this.getHandle(
                        handle
                    );


                if (!thread) {

                    return -1;

                }


                thread.running =
                    true;


                return 0;

            },
            {
                module: "thread"
            }
        );


        this.register(
            "XTerminateThread",
            handle => {

                const thread =
                    this.getHandle(
                        handle
                    );


                if (!thread) {

                    return -1;

                }


                thread.running =
                    false;


                return 0;

            },
            {
                module: "thread"
            }
        );


        /* ----------------------------------------------------
           FILES
        ---------------------------------------------------- */

        this.register(
            "XFileCreate",
            (
                name,
                mode = "r"
            ) => {

                const file = {

                    name:
                        String(name),

                    mode:
                        String(mode),

                    opened:
                        true,

                    created:
                        Date.now()

                };


                return this.createHandle(
                    file
                );

            },
            {
                module: "file"
            }
        );


        this.register(
            "XFileClose",
            handle => {

                return this.closeHandle(
                    handle
                )
                ? 0
                : -1;

            },
            {
                module: "file"
            }
        );


        /* ----------------------------------------------------
           EVENT
        ---------------------------------------------------- */

        this.register(
            "XCreateEvent",
            (
                manualReset = false,
                initialState = false
            ) => {

                const event = {

                    manualReset:
                        !!manualReset,

                    signaled:
                        !!initialState

                };


                return this.createHandle(
                    event
                );

            },
            {
                module: "event"
            }
        );


        this.register(
            "XSetEvent",
            handle => {

                const event =
                    this.getHandle(
                        handle
                    );


                if (!event) {

                    return -1;

                }


                event.signaled =
                    true;


                return 0;

            },
            {
                module: "event"
            }
        );


        this.register(
            "XResetEvent",
            handle => {

                const event =
                    this.getHandle(
                        handle
                    );


                if (!event) {

                    return -1;

                }


                event.signaled =
                    false;


                return 0;

            },
            {
                module: "event"
            }
        );


        /* ----------------------------------------------------
           YIELD
        ---------------------------------------------------- */

        this.register(
            "XThreadYield",
            () => {

                return 0;

            },
            {
                module: "thread"
            }
        );


        /* ----------------------------------------------------
           EXIT
        ---------------------------------------------------- */

        this.register(
            "XExitThread",
            code => {

                if (
                    this.cpu &&
                    typeof this.cpu.stop ===
                    "function"
                ) {

                    this.cpu.stop();

                }


                return (
                    Number(code) >>> 0
                );

            },
            {
                module: "thread"
            }
        );

    }


    /* ========================================================
       UPDATE INPUT
    ======================================================== */

    setInputState(
        state = {}
    ) {

        this.input = {

            buttons:
                Number(
                    state.buttons || 0
                ) >>> 0,

            leftX:
                Number(
                    state.leftX || 0
                ),

            leftY:
                Number(
                    state.leftY || 0
                ),

            rightX:
                Number(
                    state.rightX || 0
                ),

            rightY:
                Number(
                    state.rightY || 0
                ),

            leftTrigger:
                Number(
                    state.leftTrigger || 0
                ),

            rightTrigger:
                Number(
                    state.rightTrigger || 0
                )

        };

    }


    /* ========================================================
       CONNECT THUNKS
    ======================================================== */

    connectThunks(
        thunkDispatcher
    ) {

        if (!thunkDispatcher) {

            throw new Error(
                "Thunk dispatcher required."
            );

        }


        this.thunks =
            thunkDispatcher;


        /*
         * Export all XAPI functions
         * as callable thunk handlers.
         */

        for (
            const api
            of this.apis.values()
        ) {

            const thunkName =
                `XAPI_${api.name}`;


            if (
                typeof thunkDispatcher.register ===
                "function"
            ) {

                thunkDispatcher.register(
                    thunkName,
                    (...args) => {

                        return this.call(
                            api.name,
                            args
                        );

                    },
                    {
                        module:
                            api.module
                    }
                );

            }

        }


        return true;

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

            apiCount:
                this.apis.size,

            handleCount:
                this.handles.size,

            calls:
                this.calls.length,

            APIs:
                Array.from(
                    this.apis.values()
                )
                .map(
                    api => ({

                        name:
                            api.name,

                        module:
                            api.module,

                        calls:
                            api.calls

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


    /* ========================================================
       RESET
    ======================================================== */

    reset() {

        this.calls.length =
            0;


        this.handles.clear();


        this.nextHandle =
            1;


        this.input = {

            buttons: 0,

            leftX: 0,

            leftY: 0,

            rightX: 0,

            rightY: 0,

            leftTrigger: 0,

            rightTrigger: 0

        };

    }

}


/* ============================================================
   GLOBAL EXPORT
============================================================ */

window.WebBktxXAPI =
    WebBktxXAPI;

window.WebBktxXAPIError =
    WebBktxXAPIError;


/* ============================================================
   READY
============================================================ */

console.log(
    `WebBktx XAPI ${WEBBKTX_XAPI_VERSION} loaded.`
);
