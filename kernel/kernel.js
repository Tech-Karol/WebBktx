/*
 * ============================================================
 * WebBktx Xbox Kernel
 *
 * Version: 1.0
 *
 * Experimental Xbox-compatible kernel layer
 *
 * Purpose:
 *   - Kernel initialization
 *   - XBE integration
 *   - Import/thunk registry
 *   - Virtual handles
 *   - Memory services
 *   - Thread bookkeeping
 *   - Timing
 *   - Filesystem hooks
 *   - Debugging
 *
 * IMPORTANT:
 *   This is an original compatibility layer for WebBktx.
 *   It is NOT the original Microsoft Xbox kernel.
 *
 * ============================================================
 */

"use strict";


/* ============================================================
   VERSION
============================================================ */

const WEBBKTX_KERNEL_VERSION = "1.0";


/* ============================================================
   KERNEL STATUS
============================================================ */

const WebBktxKernelStatus = {

    CREATED: "created",
    READY: "ready",
    RUNNING: "running",
    STOPPED: "stopped",
    ERROR: "error"

};


/* ============================================================
   KERNEL
============================================================ */

class WebBktxKernel {

    constructor(options = {}) {

        this.version =
            WEBBKTX_KERNEL_VERSION;


        this.name =
            "WebBktx Xbox Compatibility Kernel";


        this.status =
            WebBktxKernelStatus.CREATED;


        /* ----------------------------------------------------
           REFERENCES
        ---------------------------------------------------- */

        this.core =
            options.core || null;

        this.cpu =
            options.cpu || null;

        this.memory =
            options.memory || null;

        this.xbe =
            options.xbe || null;


        /* ----------------------------------------------------
           CONFIGURATION
        ---------------------------------------------------- */

        this.settings = {

            debug:
                options.debug !== false,

            maxThreads:
                options.maxThreads ||
                64,

            maxHandles:
                options.maxHandles ||
                4096,

            strictImports:
                options.strictImports === true

        };


        /* ----------------------------------------------------
           REGISTRIES
        ---------------------------------------------------- */

        this.imports =
            new Map();

        this.thunks =
            new Map();

        this.handles =
            new Map();

        this.threads =
            new Map();


        /* ----------------------------------------------------
           ID GENERATORS
        ---------------------------------------------------- */

        this.nextHandle =
            1;

        this.nextThreadId =
            1;


        /* ----------------------------------------------------
           EXECUTION
        ---------------------------------------------------- */

        this.running =
            false;

        this.startTime =
            0;


        /* ----------------------------------------------------
           LOG
        ---------------------------------------------------- */

        this.logs =
            [];

        this.maxLogs =
            1000;


        /* ----------------------------------------------------
           SERVICES
        ---------------------------------------------------- */

        this.services = {

            memory:
                true,

            threads:
                true,

            timing:
                true,

            filesystem:
                true,

            synchronization:
                true

        };

    }


    /* ========================================================
       LOGGING
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
            this.logs.length >
            this.maxLogs
        ) {

            this.logs.shift();

        }


        if (this.settings.debug) {

            if (data !== null) {

                console.log(
                    `[WebBktx Kernel] ${message}`,
                    data
                );

            } else {

                console.log(
                    `[WebBktx Kernel] ${message}`
                );

            }

        }

    }


    error(message, error = null) {

        this.status =
            WebBktxKernelStatus.ERROR;


        const detail =
            error &&
            error.message
                ? error.message
                : null;


        this.log(
            message,
            {
                error:
                    detail
            }
        );


        console.error(
            `[WebBktx Kernel] ${message}`,
            error || ""
        );

    }


    /* ========================================================
       INITIALIZE
    ======================================================== */

    initialize(options = {}) {

        if (
            options.core
        ) {

            this.core =
                options.core;

        }

        if (
            options.cpu
        ) {

            this.cpu =
                options.cpu;

        }

        if (
            options.memory
        ) {

            this.memory =
                options.memory;

        }

        if (
            options.xbe
        ) {

            this.xbe =
                options.xbe;

        }


        if (!this.memory) {

            throw new Error(
                "WebBktx Kernel requires memory."
            );

        }


        if (!this.cpu) {

            throw new Error(
                "WebBktx Kernel requires CPU."
            );

        }


        this.registerBuiltinServices();


        this.status =
            WebBktxKernelStatus.READY;


        this.log(
            "Kernel initialized.",
            {
                version:
                    this.version
            }
        );


        return true;

    }


    /* ========================================================
       BUILTIN SERVICES
    ======================================================== */

    registerBuiltinServices() {

        /*
         * These names are WebBktx internal
         * compatibility services.
         *
         * More Xbox-compatible mappings can
         * be added through thunks.js.
         */

        this.registerImport(
            "NtAllocateVirtualMemory",
            args =>
                this.allocateVirtualMemory(
                    args
                )
        );


        this.registerImport(
            "NtFreeVirtualMemory",
            args =>
                this.freeVirtualMemory(
                    args
                )
        );


        this.registerImport(
            "KeQueryPerformanceCounter",
            () =>
                this.queryPerformanceCounter()
        );


        this.registerImport(
            "KeGetCurrentThread",
            () =>
                this.getCurrentThread()
        );


        this.registerImport(
            "KeDelayExecutionThread",
            args =>
                this.delayExecutionThread(
                    args
                )
        );


        this.registerImport(
            "IoCreateFile",
            args =>
                this.createFile(
                    args
                )
        );


        this.registerImport(
            "NtClose",
            args =>
                this.closeHandle(
                    args
                )
        );

    }


    /* ========================================================
       IMPORT REGISTRATION
    ======================================================== */

    registerImport(
        name,
        handler
    ) {

        if (
            typeof name !==
            "string"
        ) {

            throw new TypeError(
                "Import name must be a string."
            );

        }


        if (
            typeof handler !==
            "function"
        ) {

            throw new TypeError(
                `Import handler for ${name} ` +
                `must be a function.`
            );

        }


        this.imports.set(
            name,
            handler
        );


        this.log(
            "Kernel import registered.",
            {
                name
            }
        );


        return true;

    }


    unregisterImport(
        name
    ) {

        return this.imports.delete(
            name
        );

    }


    hasImport(
        name
    ) {

        return this.imports.has(
            name
        );

    }


    /* ========================================================
       IMPORT CALL
    ======================================================== */

    callImport(
        name,
        args = {}
    ) {

        const handler =
            this.imports.get(
                name
            );


        if (!handler) {

            if (
                this.settings.strictImports
            ) {

                throw new Error(
                    `Unimplemented kernel import: ${name}`
                );

            }


            this.log(
                "Unhandled kernel import.",
                {
                    name,
                    args
                }
            );


            return 0;

        }


        this.log(
            "Kernel import called.",
            {
                name,
                args
            }
        );


        try {

            return handler(
                args,
                this
            );

        } catch (error) {

            this.error(
                `Kernel import failed: ${name}`,
                error
            );


            throw error;

        }

    }


    /* ========================================================
       THUNKS
    ======================================================== */

    registerThunk(
        address,
        name
    ) {

        address >>=
            0;


        this.thunks.set(
            address >>> 0,
            name
        );


        return true;

    }


    resolveThunk(
        address
    ) {

        address >>>=
            0;


        return (
            this.thunks.get(
                address >>> 0
            ) ||
            null
        );

    }


    /* ========================================================
       MEMORY SERVICE
    ======================================================== */

    allocateVirtualMemory(
        args = {}
    ) {

        if (!this.memory) {

            throw new Error(
                "Kernel memory service unavailable."
            );

        }


        const size =
            Number(
                args.size ||
                0
            );


        if (
            !Number.isSafeInteger(size) ||
            size <= 0
        ) {

            throw new Error(
                "Invalid virtual memory allocation size."
            );

        }


        /*
         * Use Memory.allocate() when available.
         */

        if (
            typeof this.memory.allocate ===
            "function"
        ) {

            const address =
                this.memory.allocate(
                    size,
                    args.alignment || 4
                );


            this.log(
                "Virtual memory allocated.",
                {
                    address,
                    size
                }
            );


            return {

                address:
                    address >>> 0,

                size

            };

        }


        /*
         * Fallback:
         * WebBktx Memory may not yet provide
         * a dynamic allocator.
         */

        throw new Error(
            "Memory allocator is not implemented."
        );

    }


    freeVirtualMemory(
        args = {}
    ) {

        const address =
            Number(
                args.address
            );


        if (
            !Number.isInteger(address)
        ) {

            return false;

        }


        if (
            typeof this.memory.free ===
            "function"
        ) {

            return this.memory.free(
                address >>> 0
            );

        }


        /*
         * Some early Memory versions do not
         * support freeing individual blocks.
         */

        this.log(
            "Memory free requested but allocator " +
            "does not expose free().",
            {
                address
            }
        );


        return false;

    }


    /* ========================================================
       HANDLES
    ======================================================== */

    createHandle(
        object,
        type = "generic"
    ) {

        if (
            this.handles.size >=
            this.settings.maxHandles
        ) {

            throw new Error(
                "Kernel handle limit reached."
            );

        }


        let handle =
            this.nextHandle++;


        /*
         * Keep handles non-zero.
         */

        if (
            handle === 0
        ) {

            handle =
                this.nextHandle++;

        }


        this.handles.set(
            handle,
            {

                handle,

                type,

                object,

                created:
                    Date.now()

            }
        );


        return handle;

    }


    getHandle(
        handle
    ) {

        return this.handles.get(
            handle >>> 0
        ) || null;

    }


    closeHandle(
        args
    ) {

        const handle =
            typeof args ===
            "object"
                ? args.handle
                : args;


        if (
            !this.handles.has(
                handle >>> 0
            )
        ) {

            return false;

        }


        this.handles.delete(
            handle >>> 0
        );


        this.log(
            "Handle closed.",
            {
                handle:
                    handle >>> 0
            }
        );


        return true;

    }


    /* ========================================================
       THREADS
    ======================================================== */

    createThread(
        entryPoint,
        options = {}
    ) {

        if (
            this.threads.size >=
            this.settings.maxThreads
        ) {

            throw new Error(
                "Kernel thread limit reached."
            );

        }


        const id =
            this.nextThreadId++;


        const thread = {

            id,

            entryPoint:
                entryPoint >>> 0,

            priority:
                options.priority ||
                0,

            state:
                "ready",

            created:
                Date.now(),

            name:
                options.name ||
                `thread-${id}`

        };


        this.threads.set(
            id,
            thread
        );


        this.log(
            "Thread created.",
            thread
        );


        return thread;

    }


    destroyThread(
        id
    ) {

        return this.threads.delete(
            id
        );

    }


    getCurrentThread() {

        /*
         * The first thread is used as the
         * bootstrap thread until the scheduler
         * becomes more sophisticated.
         */

        for (
            const thread
            of this.threads.values()
        ) {

            return thread.id;

        }


        return 0;

    }


    getThread(
        id
    ) {

        return this.threads.get(
            id
        ) || null;

    }


    /* ========================================================
       TIMING
    ======================================================== */

    startClock() {

        this.startTime =
            performance.now
                ? performance.now()
                : Date.now();

    }


    queryPerformanceCounter() {

        const now =
            performance.now
                ? performance.now()
                : Date.now();


        const start =
            this.startTime ||
            now;


        return Math.floor(
            now - start
        );

    }


    getSystemTime() {

        return Date.now();

    }


    delayExecutionThread(
        args = {}
    ) {

        const milliseconds =
            Math.max(
                0,
                Number(
                    args.milliseconds ||
                    0
                )
            );


        /*
         * Kernel execution remains synchronous.
         *
         * We return the requested delay rather
         * than blocking the browser thread.
         */

        this.log(
            "Thread delay requested.",
            {
                milliseconds
            }
        );


        return {

            delayed:
                true,

            milliseconds

        };

    }


    /* ========================================================
       FILESYSTEM
    ======================================================== */

    createFile(
        args = {}
    ) {

        const path =
            String(
                args.path ||
                ""
            );


        if (!path) {

            return 0;

        }


        /*
         * Files are represented by virtual handles.
         * Actual browser file access is supplied later
         * by filesystem.js.
         */

        const file = {

            path,

            position:
                0,

            opened:
                Date.now()

        };


        const handle =
            this.createHandle(
                file,
                "file"
            );


        this.log(
            "Virtual file opened.",
            {
                path,
                handle
            }
        );


        return handle;

    }


    /* ========================================================
       XBE ATTACHMENT
    ======================================================== */

    attachXBE(
        xbe
    ) {

        if (!xbe) {

            throw new Error(
                "Cannot attach empty XBE."
            );

        }


        this.xbe =
            xbe;


        this.log(
            "XBE attached to kernel.",
            {
                entryPoint:
                    xbe.entryPoint
            }
        );


        return true;

    }


    /* ========================================================
       START
    ======================================================== */

    start() {

        if (
            this.status ===
            WebBktxKernelStatus.CREATED
        ) {

            this.initialize();

        }


        this.startClock();


        this.running =
            true;


        this.status =
            WebBktxKernelStatus.RUNNING;


        /*
         * Bootstrap thread.
         */

        if (
            this.threads.size ===
            0 &&
            this.cpu
        ) {

            this.createThread(
                this.cpu.EIP >>> 0,
                {
                    name:
                        "xbe-main"
                }
            );

        }


        this.log(
            "Kernel started."
        );


        return true;

    }


    /* ========================================================
       STOP
    ======================================================== */

    stop() {

        this.running =
            false;


        this.status =
            WebBktxKernelStatus.STOPPED;


        this.log(
            "Kernel stopped."
        );

    }


    /* ========================================================
       RESET
    ======================================================== */

    reset() {

        this.stop();


        this.handles.clear();

        this.threads.clear();

        this.thunks.clear();


        this.nextHandle =
            1;

        this.nextThreadId =
            1;


        this.startTime =
            0;


        this.status =
            WebBktxKernelStatus.CREATED;


        this.log(
            "Kernel reset."
        );

    }


    /* ========================================================
       CPU INTEGRATION
    ======================================================== */

    beforeInstruction() {

        if (!this.running) {

            return;

        }


        /*
         * Future scheduler and interrupt handling
         * will execute here.
         */

    }


    afterInstruction(
        result
    ) {

        if (!this.running) {

            return;

        }


        /*
         * Future:
         *   - interrupts
         *   - thread scheduling
         *   - deferred callbacks
         *   - timers
         */

        return result;

    }


    /* ========================================================
       EXECUTE XBE
    ======================================================== */

    execute(
        maxInstructions = 10000
    ) {

        if (!this.cpu) {

            throw new Error(
                "Kernel has no CPU."
            );

        }


        if (!this.xbe) {

            throw new Error(
                "Kernel has no XBE."
            );

        }


        this.start();


        let result;


        try {

            result =
                this.cpu.run(
                    maxInstructions
                );

        } catch (error) {

            this.error(
                "XBE execution failed.",
                error
            );


            throw error;

        } finally {

            this.stop();

        }


        return result;

    }


    /* ========================================================
       STATUS
    ======================================================== */

    getStatus() {

        return {

            version:
                this.version,

            name:
                this.name,

            status:
                this.status,

            running:
                this.running,

            imports:
                this.imports.size,

            thunks:
                this.thunks.size,

            handles:
                this.handles.size,

            threads:
                this.threads.size,

            xbeLoaded:
                !!this.xbe,

            memory:
                !!this.memory,

            cpu:
                !!this.cpu

        };

    }


    /* ========================================================
       DIAGNOSTICS
    ======================================================== */

    diagnostics() {

        return {

            kernel:
                this.getStatus(),

            cpu:
                this.cpu &&
                typeof this.cpu.getStatus ===
                "function"
                    ? this.cpu.getStatus()
                    : null,

            memory:
                this.memory
                    ? {

                        size:
                            this.memory.size

                    }
                    : null,

            xbe:
                this.xbe &&
                typeof this.xbe.getStatus ===
                "function"
                    ? this.xbe.getStatus()
                    : null,

            imports:
                Array.from(
                    this.imports.keys()
                ),

            threads:
                Array.from(
                    this.threads.values()
                ),

            handles:
                this.handles.size

        };

    }


    /* ========================================================
       LOG ACCESS
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

window.WebBktxKernel =
    WebBktxKernel;


window.WebBktxKernelStatus =
    WebBktxKernelStatus;


/* ============================================================
   READY
============================================================ */

console.log(
    `WebBktx Kernel ${WEBBKTX_KERNEL_VERSION} loaded.`
);
