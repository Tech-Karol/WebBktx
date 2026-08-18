/*
 * ============================================================
 * WebBktx APP
 *
 * Version: 1.1
 *
 * Local launcher / UI controller
 *
 * Automatic module loader
 *
 * Loads:
 *
 *   memory.js
 *   cpu.js
 *   decoder.js
 *   xbe.js
 *   thunks.js
 *   xapi.js
 *   xfile.js
 *   kernel.js
 *   xinput.js
 *   xgraphics.js
 *   core.js
 *
 * core.js is intentionally loaded LAST.
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
   CONFIG
============================================================ */

const WEBBKTX_APP_VERSION = "1.1";

const WEBBKTX_CORE_PATH = "core/";


/*
 * IMPORTANT:
 *
 * Dependency order.
 *
 * Core must be loaded after the components it uses.
 */

const WEBBKTX_MODULES = [

    {
        name: "memory",
        file: "memory.js",
        global: "WebBktxMemory",
        required: true
    },

    {
        name: "cpu",
        file: "cpu.js",
        global: "WebBktxCPU",
        required: true
    },

    {
        name: "decoder",
        file: "decoder.js",
        global: "WebBktxDecoder",
        required: false
    },

    {
        name: "xbe",
        file: "xbe.js",
        global: "WebBktxXBE",
        required: true
    },

    {
        name: "thunks",
        file: "thunks.js",
        global: "WebBktxThunks",
        required: false
    },

    {
        name: "xapi",
        file: "xapi.js",
        global: "WebBktxXAPI",
        required: false
    },

    {
        name: "xfile",
        file: "xfile.js",
        global: "WebBktxXFile",
        required: false
    },

    {
        name: "kernel",
        file: "kernel.js",
        global: "WebBktxKernel",
        required: false
    },

    {
        name: "xinput",
        file: "xinput.js",
        global: "WebBktxXInput",
        required: false
    },

    {
        name: "xgraphics",
        file: "xgraphics.js",
        global: "WebBktxXGraphics",
        required: false
    },

    /*
     * CORE LAST.
     */

    {
        name: "core",
        file: "core.js",
        global: "WebBktxCore",
        required: true
    }

];


/* ============================================================
   APP
============================================================ */

const WebBktxApp = {

    version:
        WEBBKTX_APP_VERSION,

    initialized:
        false,

    modulesLoaded:
        false,

    gameFile:
        null,

    gameImage:
        null,

    core:
        null,

    kernel:
        null,

    graphics:
        null,

    input:
        null,

    animationFrame:
        null,

    running:
        false,

    elements:
        {},

    moduleStatus:
        {},


    /* ========================================================
       START
    ======================================================== */

    async start() {

        try {

            this.cacheElements();


            this.setLoading(
                "Preparing WebBktx..."
            );

            this.setProgress(
                5
            );


            this.updateModule(
                "cache",
                "SKIP"
            );


            /*
             * Automatically load modules.
             */

            await this.loadAllModules();


            this.setProgress(
                45
            );


            this.checkModules();


            this.setLoading(
                "Initializing WebBktx Core..."
            );


            await this.initializeCore();


            this.setProgress(
                75
            );


            this.initializeGraphics();


            this.updateModule(
                "graphics",
                this.graphics
                    ? "OK"
                    : "WAIT"
            );


            this.initializeInput();


            this.updateModule(
                "input",
                this.input
                    ? "OK"
                    : "WAIT"
            );


            this.setProgress(
                100
            );


            this.setLoading(
                "System ready."
            );


            await this.delay(
                200
            );


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


            console.table(
                this.moduleStatus
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
                document.getElementById(
                    id
                );

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
       MODULE LOADER
    ======================================================== */

    async loadAllModules() {

        this.setLoading(
            "Loading emulator modules..."
        );


        for (
            let i = 0;
            i < WEBBKTX_MODULES.length;
            i++
        ) {

            const module =
                WEBBKTX_MODULES[i];


            const progress =
                10 +
                Math.floor(
                    (
                        i /
                        WEBBKTX_MODULES.length
                    ) *
                    35
                );


            this.setProgress(
                progress
            );


            this.updateModule(
                module.name,
                "LOAD"
            );


            try {

                await this.loadModule(
                    module
                );


                this.moduleStatus[
                    module.name
                ] =
                    typeof window[
                        module.global
                    ];


                this.updateModule(
                    module.name,
                    "OK"
                );


            } catch (error) {

                this.moduleStatus[
                    module.name
                ] =
                    "ERROR";


                this.updateModule(
                    module.name,
                    "ERROR"
                );


                if (
                    module.required
                ) {

                    throw new Error(
                        `Nie można załadować wymaganego modułu ` +
                        `${module.name}: ${error.message}`
                    );

                }


                console.warn(
                    `[WebBktx] Optional module ${module.name} failed:`,
                    error
                );

            }

        }


        this.modulesLoaded =
            true;

    },


    /* ========================================================
       LOAD ONE MODULE
    ======================================================== */

    loadModule(module) {

        return new Promise(
            (
                resolve,
                reject
            ) => {

                /*
                 * Already loaded.
                 */

                if (
                    typeof window[
                        module.global
                    ] !==
                    "undefined"
                ) {

                    resolve();

                    return;

                }


                const existing =
                    document.querySelector(
                        `script[data-webbktx-module="${module.name}"]`
                    );


                if (existing) {

                    existing.addEventListener(
                        "load",
                        () => {

                            if (
                                typeof window[
                                    module.global
                                ] !==
                                "undefined"
                            ) {

                                resolve();

                            } else {

                                reject(
                                    new Error(
                                        `${module.file} loaded, ` +
                                        `but ${module.global} is missing.`
                                    )
                                );

                            }

                        },
                        {
                            once: true
                        }
                    );


                    existing.addEventListener(
                        "error",
                        () =>
                            reject(
                                new Error(
                                    `Failed to load ${module.file}`
                                )
                            ),
                        {
                            once: true
                        }
                    );


                    return;

                }


                const script =
                    document.createElement(
                        "script"
                    );


                script.src =
                    WEBBKTX_CORE_PATH +
                    module.file;


                script.async =
                    false;


                script.dataset.webbktxModule =
                    module.name;


                script.onload =
                    () => {

                        if (
                            typeof window[
                                module.global
                            ] ===
                            "undefined"
                        ) {

                            reject(
                                new Error(
                                    `${module.file} loaded, ` +
                                    `but ${module.global} is undefined.`
                                )
                            );

                            return;

                        }


                        resolve();

                    };


                script.onerror =
                    () => {

                        reject(
                            new Error(
                                `Cannot load ${WEBBKTX_CORE_PATH}${module.file}`
                            )
                        );

                    };


                document.head.appendChild(
                    script
                );

            }
        );

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

            decoder:
                typeof window.WebBktxDecoder ===
                "function",

            xbe:
                typeof window.WebBktxXBE ===
                "function",

            thunks:
                typeof window.WebBktxThunks ===
                "function",

            xapi:
                typeof window.WebBktxXAPI ===
                "function",

            xfile:
                typeof window.WebBktxXFile ===
                "function",

            kernel:
                typeof window.WebBktxKernel ===
                "function",

            xinput:
                typeof window.WebBktxXInput ===
                "function",

            xgraphics:
                typeof window.WebBktxXGraphics ===
                "function",

            core:
                typeof window.WebBktxCore ===
                "function"

        };


        console.log(
            "WebBktx module status:"
        );


        console.table(
            modules
        );


        this.moduleStatus =
            modules;


        /*
         * Mandatory modules.
         */

        const required = [

            "memory",
            "cpu",
            "xbe",
            "core"

        ];


        for (
            const name
            of required
        ) {

            if (
                !modules[name]
            ) {

                throw new Error(
                    `Brak wymaganego modułu: ${name}.`
                );

            }

        }


        return modules;

    },


    /* ========================================================
       CORE INITIALIZATION
    ======================================================== */

    async initializeCore() {

        if (
            typeof window.WebBktxCore !==
            "function"
        ) {

            throw new Error(
                "WebBktxCore constructor unavailable."
            );

        }


        /*
         * Create the main emulator core.
         */

        this.core =
            new window.WebBktxCore({

                ramSize:
                    64 *
                    1024 *
                    1024,

                debug:
                    true,

                maxInstructions:
                    100000

            });


        /*
         * Initialize Core.
         */

        if (
            typeof this.core.initialize ===
            "function"
        ) {

            const result =
                this.core.initialize();


            if (
                result instanceof Promise
            ) {

                await result;

            }

        }


        /*
         * Kernel.
         */

        if (
            typeof window.WebBktxKernel ===
            "function"
        ) {

            try {

                /*
                 * Prefer Core-aware constructor.
                 */

                this.kernel =
                    new window.WebBktxKernel(
                        this.core
                    );


                if (
                    typeof this.kernel.initialize ===
                    "function"
                ) {

                    const result =
                        this.kernel.initialize();


                    if (
                        result instanceof Promise
                    ) {

                        await result;

                    }

                }


                console.log(
                    "[WebBktx] Kernel online."
                );


            } catch (error) {

                console.warn(
                    "[WebBktx] Kernel initialization failed:",
                    error
                );

            }

        }


        /*
         * Attach Kernel to Core if supported.
         */

        if (
            this.core &&
            this.kernel
        ) {

            if (
                typeof this.core.attachKernel ===
                "function"
            ) {

                this.core.attachKernel(
                    this.kernel
                );

            } else {

                this.core.kernel =
                    this.kernel;

            }

        }


        /*
         * Attach decoder if supported.
         */

        if (
            typeof window.WebBktxDecoder ===
            "function"
        ) {

            try {

                let decoder;


                /*
                 * Most implementations will
                 * accept CPU/Core.
                 */

                try {

                    decoder =
                        new window.WebBktxDecoder(
                            this.core.cpu ||
                            this.core
                        );

                } catch {

                    decoder =
                        new window.WebBktxDecoder();

                }


                if (
                    typeof this.core.attachDecoder ===
                    "function"
                ) {

                    this.core.attachDecoder(
                        decoder
                    );

                } else {

                    this.core.decoder =
                        decoder;

                }


                console.log(
                    "[WebBktx] Decoder attached."
                );


            } catch (error) {

                console.warn(
                    "[WebBktx] Decoder initialization failed:",
                    error
                );

            }

        }


        return this.core;

    },


    /* ========================================================
       GRAPHICS
    ======================================================== */

    initializeGraphics() {

        const canvas =
            this.elements.screen;


        if (!canvas) {

            return;

        }


        /*
         * Prefer XGraphics 1.0.
         */

        if (
            typeof window.WebBktxXGraphics ===
            "function"
        ) {

            try {

                this.graphics =
                    new window.WebBktxXGraphics(
                        canvas
                    );


                this.attachGraphics();


                console.log(
                    "[WebBktx] XGraphics online."
                );


                return;

            } catch (error) {

                console.warn(
                    "[WebBktx] XGraphics failed:",
                    error
                );

            }

        }


        /*
         * Compatibility graphics API.
         */

        if (
            typeof window.WebBktxGraphics ===
            "function"
        ) {

            try {

                this.graphics =
                    new window.WebBktxGraphics(
                        canvas
                    );


                this.attachGraphics();


                console.log(
                    "[WebBktx] Graphics online."
                );


            } catch (error) {

                console.warn(
                    "[WebBktx] Graphics failed:",
                    error
                );

            }

        }

    },


    /* ========================================================
       ATTACH GRAPHICS
    ======================================================== */

    attachGraphics() {

        if (
            !this.core ||
            !this.graphics
        ) {

            return;

        }


        if (
            typeof this.core.attachGraphics ===
            "function"
        ) {

            this.core.attachGraphics(
                this.graphics
            );

        } else {

            this.core.graphics =
                this.graphics;

        }

    },


    /* ========================================================
       INPUT
    ======================================================== */

    initializeInput() {

        /*
         * Prefer XInput.
         */

        if (
            typeof window.WebBktxXInput ===
            "function"
        ) {

            try {

                this.input =
                    new window.WebBktxXInput();


                this.attachInput();


                console.log(
                    "[WebBktx] XInput online."
                );


                return;

            } catch (error) {

                console.warn(
                    "[WebBktx] XInput failed:",
                    error
                );

            }

        }


        /*
         * Compatibility input API.
         */

        if (
            typeof window.WebBktxInput ===
            "function"
        ) {

            try {

                this.input =
                    new window.WebBktxInput();


                this.attachInput();


            } catch (error) {

                console.warn(
                    "[WebBktx] Input failed:",
                    error
                );

            }

        }

    },


    /* ========================================================
       ATTACH INPUT
    ======================================================== */

    attachInput() {

        if (
            !this.core ||
            !this.input
        ) {

            return;

        }


        if (
            typeof this.core.attachInput ===
            "function"
        ) {

            this.core.attachInput(
                this.input
            );

        } else {

            this.core.input =
                this.input;

        }

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
                "XBE selected. Ready to load.",
                "success"
            );


            return;

        }


        if (
            name.endsWith(".iso") ||
            name.endsWith(".xiso")
        ) {

            /*
             * XFile support may be available.
             *
             * We don't falsely claim that every
             * ISO is directly executable.
             */

            if (
                typeof window.WebBktxXFile ===
                "function"
            ) {

                this.elements.startButton.disabled =
                    false;


                this.showMessage(
                    "Disc image selected. XFile will attempt to mount it.",
                    "info"
                );


            } else {

                this.elements.startButton.disabled =
                    true;


                this.showMessage(
                    "ISO/XISO selected, but XFile is unavailable.",
                    "warning"
                );

            }


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
                "No game selected.",
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
            "Loading game...",
            "info"
        );


        try {

            let result;


            /*
             * Preferred Core API.
             */

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
                 * Direct XBE fallback.
                 */

                const xbe =
                    new window.WebBktxXBE(
                        this.gameFile
                    );


                await xbe.load();


                this.gameImage =
                    xbe;


                result = {

                    success:
                        true,

                    image:
                        xbe

                };

            }


            if (
                result &&
                result.success === false
            ) {

                throw new Error(
                    result.error ||
                    "Core rejected the game."
                );

            }


            this.gameImage =
                result &&
                result.image
                    ? result.image
                    : result;


            this.elements.gameName.textContent =
                this.gameFile.name;


            this.showScreen(
                "gameScreen"
            );


            this.running =
                true;


            this.startRenderLoop();


            this.startExecution();


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
       CPU EXECUTION
    ======================================================== */

    startExecution() {

        if (
            !this.core
        ) {

            return;

        }


        if (
            typeof this.core.step !==
            "function"
        ) {

            console.warn(
                "[WebBktx] Core.step() unavailable."
            );

            return;

        }


        this.running =
            true;


        const tick =
            () => {

                if (
                    !this.running
                ) {

                    return;

                }


                try {

                    /*
                     * Keep batches small enough
                     * for browser responsiveness.
                     */

                    const batch =
                        100;


                    for (
                        let i = 0;
                        i < batch &&
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

                    console.error(
                        "[WebBktx] CPU execution error:",
                        error
                    );


                    this.running =
                        false;


                    this.showMessage(
                        "CPU stopped: " +
                        (
                            error.message ||
                            "unknown error"
                        ),
                        "error"
                    );


                    return;

                }


                if (
                    this.running
                ) {

                    /*
                     * Yield to browser.
                     */

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
                        this.graphics
                    ) {

                        /*
                         * Prefer Present().
                         */

                        if (
                            typeof this.graphics.Present ===
                            "function"
                        ) {

                            this.graphics.Present();

                        }

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
                    "[WebBktx] Core stop error:",
                    error
                );

            }

        }


        if (
            this.input &&
            typeof this.input.stop ===
            "function"
        ) {

            try {

                this.input.stop();

            } catch {}

        }


        if (
            this.graphics &&
            typeof this.graphics.stop ===
            "function"
        ) {

            try {

                this.graphics.stop();

            } catch {}

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

                result = {

                    constructor:
                        cpu.constructor
                            ?.name ||
                        "Unknown CPU",

                    state:
                        cpu

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


    /* ========================================================
       MODULE UI
    ======================================================== */

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
       FILE INFO
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
       ERROR
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
                "350px";


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

            decoder:
                typeof window.WebBktxDecoder,

            xbe:
                typeof window.WebBktxXBE,

            thunks:
                typeof window.WebBktxThunks,

            xapi:
                typeof window.WebBktxXAPI,

            xfile:
                typeof window.WebBktxXFile,

            kernel:
                typeof window.WebBktxKernel,

            xinput:
                typeof window.WebBktxXInput,

            xgraphics:
                typeof window.WebBktxXGraphics,

            graphics:
                typeof window.WebBktxGraphics,

            core:
                typeof window.WebBktxCore

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

            "\n\nMODULE PATH\n" +

            WEBBKTX_CORE_PATH +

            "\n\n" +

            "Ładowanie modułów zakończyło się " +
            "przed inicjalizacją Core.";

    },


    /* ========================================================
       FORMAT BYTES
    ======================================================== */

    formatBytes(bytes) {

        if (
            !bytes
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
            Math.min(
                units.length - 1,
                Math.floor(
                    Math.log(bytes) /
                    Math.log(1024)
                )
            );


        return (

            (
                bytes /
                Math.pow(
                    1024,
                    index
                )
            ).toFixed(2)

            +

            " "

            +

            units[index]

        );

    },


    /* ========================================================
       DELAY
    ======================================================== */

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
   GLOBAL API
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
