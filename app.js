/*
 * ============================================================
 * WebBktx Application Controller
 *
 * Version: 1.0
 *
 * LOCAL / NO CACHE / NO PWA / OFFLINE
 *
 * Responsible for:
 *   - UI
 *   - Core initialization
 *   - Kernel initialization
 *   - XBE loading
 *   - CPU diagnostics
 *   - Canvas initialization
 *   - Emulator start/stop
 *   - Safe module detection
 *
 * ============================================================
 */

"use strict";


/* ============================================================
   VERSION
============================================================ */

const WEBBKTX_APP_VERSION = "1.0";


/* ============================================================
   GLOBAL APPLICATION
============================================================ */

window.WebBktxApp = {

    version: WEBBKTX_APP_VERSION,

    core: null,
    kernel: null,
    xbe: null,
    gameFile: null,

    canvas: null,
    context: null,

    initialized: false,
    running: false,

    modules: {},

    animationFrame: null,

    lastFrameTime: 0,
    frameCount: 0,
    fps: 0,
    fpsTimer: 0

};


/* ============================================================
   DOM HELPERS
============================================================ */

function $(id) {

    return document.getElementById(id);

}


function showScreen(id) {

    document
        .querySelectorAll(".screen")
        .forEach(screen => {

            screen.classList.add("hidden");

        });


    const screen = $(id);

    if (screen) {

        screen.classList.remove("hidden");

    }

}


function setModuleStatus(
    name,
    status
) {

    const element =
        document.querySelector(
            `.module[data-module="${name}"] strong`
        );


    if (!element) {

        return;

    }


    element.textContent =
        status;

}


function setLoadingText(text) {

    const element =
        $("loadingText");


    if (element) {

        element.textContent =
            text;

    }

}


function setProgress(value) {

    const element =
        $("progress");


    if (!element) {

        return;

    }


    value =
        Math.max(
            0,
            Math.min(
                100,
                value
            )
        );


    element.style.width =
        `${value}%`;

}


function message(
    text,
    type = "info"
) {

    const element =
        $("message");


    if (!element) {

        return;

    }


    element.textContent =
        text;


    element.dataset.type =
        type;

}


/* ============================================================
   SAFE ERROR DISPLAY
============================================================ */

function showFatalError(error) {

    console.error(
        "[WebBktx App]",
        error
    );


    const text =
        error instanceof Error
            ? error.message
            : String(error);


    setLoadingText(
        `ERROR: ${text}`
    );


    setProgress(100);


    message(
        text,
        "error"
    );

}


/* ============================================================
   MODULE DETECTION
============================================================ */

function detectModules() {

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
            "function",

        decoder:
            typeof window.WebBktxDecoder !==
            "undefined",

        kernel:
            typeof window.WebBktxKernel !==
            "undefined",

        thunks:
            typeof window.WebBktxThunks !==
            "undefined",

        xapi:
            typeof window.WebBktxXAPI !==
            "undefined",

        xfile:
            typeof window.WebBktxXFile !==
            "undefined",

        xinput:
            typeof window.WebBktxXInput !==
            "undefined",

        graphics:
            typeof window.WebBktxGraphics !==
            "undefined"

    };


    WebBktxApp.modules =
        modules;


    console.table(
        modules
    );


    return modules;

}


/* ============================================================
   REQUIRED MODULE CHECK
============================================================ */

function checkRequiredModules() {

    const modules =
        WebBktxApp.modules;


    const required = [

        "memory",
        "cpu",
        "xbe",
        "core"

    ];


    const missing =
        required.filter(
            name =>
                !modules[name]
        );


    if (missing.length) {

        throw new Error(
            "Brak wymaganych modułów: " +
            missing.join(", ") +
            ". Sprawdź kolejność <script>."
        );

    }


    return true;

}


/* ============================================================
   OPTIONAL MODULE REPORT
============================================================ */

function reportOptionalModules() {

    const modules =
        WebBktxApp.modules;


    const optional = [

        "decoder",
        "kernel",
        "thunks",
        "xapi",
        "xfile",
        "xinput",
        "graphics"

    ];


    optional.forEach(
        name => {

            if (modules[name]) {

                console.log(
                    `[WebBktx] ${name}: ONLINE`
                );

            } else {

                console.warn(
                    `[WebBktx] ${name}: NOT LOADED`
                );

            }

        }
    );

}


/* ============================================================
   INITIALIZE CANVAS
============================================================ */

function initializeGraphics() {

    const canvas =
        $("screen");


    if (!canvas) {

        console.warn(
            "[WebBktx] Canvas #screen not found."
        );

        return;

    }


    WebBktxApp.canvas =
        canvas;


    const context =
        canvas.getContext(
            "2d",
            {
                alpha: false,
                desynchronized: true
            }
        );


    if (!context) {

        throw new Error(
            "Nie można utworzyć Canvas 2D."
        );

    }


    WebBktxApp.context =
        context;


    context.imageSmoothingEnabled =
        false;


    context.fillStyle =
        "#000000";


    context.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    /*
     * If xgraphics.js exists, connect it.
     */

    if (
        window.WebBktxGraphics
    ) {

        try {

            WebBktxApp.graphics =
                new window.WebBktxGraphics(
                    canvas
                );

            console.log(
                "[WebBktx] XGraphics connected."
            );

        } catch (error) {

            console.warn(
                "[WebBktx] XGraphics initialization failed.",
                error
            );

        }

    }


    setModuleStatus(
        "graphics",
        WebBktxApp.modules.graphics
            ? "READY"
            : "BASIC"
    );

}


/* ============================================================
   INITIALIZE KERNEL
============================================================ */

function initializeKernel() {

    /*
     * Kernel is optional for basic UI/Core startup.
     */

    if (
        !WebBktxApp.modules.kernel
    ) {

        console.warn(
            "[WebBktx] Kernel not loaded."
        );

        return null;

    }


    const Kernel =
        window.WebBktxKernel;


    try {

        let kernel = null;


        /*
         * Try common constructor patterns.
         */

        try {

            kernel =
                new Kernel(
                    {
                        core:
                            WebBktxApp.core,

                        memory:
                            WebBktxApp.core.memory,

                        cpu:
                            WebBktxApp.core.cpu,

                        graphics:
                            WebBktxApp.graphics
                    }
                );

        } catch (firstError) {

            kernel =
                new Kernel();

        }


        WebBktxApp.kernel =
            kernel;


        /*
         * Optional initialize().
         */

        if (
            kernel &&
            typeof kernel.initialize ===
            "function"
        ) {

            kernel.initialize();

        }


        console.log(
            "[WebBktx] Kernel initialized."
        );


        return kernel;

    } catch (error) {

        console.error(
            "[WebBktx] Kernel initialization failed.",
            error
        );


        return null;

    }

}


/* ============================================================
   INITIALIZE CORE
============================================================ */

function initializeCore() {

    setLoadingText(
        "Initializing WebBktx Core..."
    );


    setProgress(25);


    const Core =
        window.WebBktxCore;


    if (
        typeof Core !==
        "function"
    ) {

        throw new Error(
            "Nie znaleziono WebBktxCore."
        );

    }


    WebBktxApp.core =
        new Core({

            debug: true,

            /*
             * 64 MB Xbox-style baseline.
             *
             * The Memory module can later
             * expose a different configuration.
             */

            ramSize:
                64 * 1024 * 1024,

            maxInstructions:
                100000

        });


    /*
     * Explicit initialization.
     */

    if (
        typeof WebBktxApp.core.initialize ===
        "function"
    ) {

        WebBktxApp.core.initialize();

    }


    console.log(
        "[WebBktx] Core initialized."
    );


    setModuleStatus(
        "core",
        "READY"
    );


    return WebBktxApp.core;

}


/* ============================================================
   CONNECT DECODER
============================================================ */

function connectDecoder() {

    if (
        !WebBktxApp.core ||
        !WebBktxApp.core.cpu
    ) {

        return false;

    }


    const cpu =
        WebBktxApp.core.cpu;


    /*
     * Different decoder versions can expose
     * different names.
     */

    let decoder =
        window.WebBktxDecoder ||
        window.WebBktxX86Decoder ||
        window.WebBktxCPUDecoder ||
        null;


    if (
        !decoder
    ) {

        console.warn(
            "[WebBktx] No decoder detected."
        );

        return false;

    }


    try {

        /*
         * Existing decoder instance.
         */

        if (
            typeof decoder.decode ===
            "function"
        ) {

            cpu.attachDecoder(
                decoder
            );

            return true;

        }


        /*
         * Constructor.
         */

        if (
            typeof decoder ===
            "function"
        ) {

            const instance =
                new decoder(
                    WebBktxApp.core.memory
                );


            cpu.attachDecoder(
                instance
            );


            return true;

        }

    } catch (error) {

        console.warn(
            "[WebBktx] Decoder connection failed.",
            error
        );

    }


    return false;

}


/* ============================================================
   INITIALIZATION
============================================================ */

async function initializeApp() {

    try {

        setLoadingText(
            "Starting WebBktx..."
        );


        setProgress(5);


        /*
         * No cache.
         *
         * This application deliberately does
         * NOT use localStorage, IndexedDB,
         * ServiceWorker, Cache API or PWA.
         */

        setModuleStatus(
            "cache",
            "OFF"
        );


        /*
         * Detect scripts already loaded
         * by HTML.
         */

        detectModules();


        reportOptionalModules();


        setProgress(15);


        /*
         * Required modules.
         */

        checkRequiredModules();


        /*
         * Core.
         */

        initializeCore();


        setProgress(45);


        /*
         * Decoder.
         */

        const decoderReady =
            connectDecoder();


        console.log(
            "[WebBktx] Decoder:",
            decoderReady
                ? "READY"
                : "WAITING"
        );


        /*
         * Kernel.
         */

        setLoadingText(
            "Initializing Kernel..."
        );


        initializeKernel();


        setProgress(65);


        /*
         * Graphics.
         */

        setLoadingText(
            "Initializing Graphics..."
        );


        initializeGraphics();


        setProgress(80);


        /*
         * Input.
         */

        initializeInput();


        setProgress(90);


        /*
         * Application ready.
         */

        WebBktxApp.initialized =
            true;


        setModuleStatus(
            "core",
            "READY"
        );


        setModuleStatus(
            "input",
            WebBktxApp.modules.xinput
                ? "READY"
                : "BASIC"
        );


        setLoadingText(
            "WebBktx ready."
        );


        setProgress(100);


        /*
         * Small delay so the loading
         * screen doesn't disappear
         * before the browser paints it.
         */

        await delay(150);


        showScreen(
            "mainScreen"
        );


        console.log(
            `%cWebBktx App ${WEBBKTX_APP_VERSION} READY`,
            "font-weight:bold"
        );

    } catch (error) {

        showFatalError(
            error
        );

    }

}


/* ============================================================
   INPUT
============================================================ */

function initializeInput() {

    /*
     * If xinput.js provides its own API,
     * initialize it.
     */

    if (
        window.WebBktxXInput
    ) {

        try {

            const XInput =
                window.WebBktxXInput;


            if (
                typeof XInput ===
                "function"
            ) {

                try {

                    WebBktxApp.input =
                        new XInput();

                } catch (error) {

                    WebBktxApp.input =
                        XInput;

                }

            } else {

                WebBktxApp.input =
                    XInput;

            }


            if (
                WebBktxApp.input &&
                typeof WebBktxApp.input.initialize ===
                "function"
            ) {

                WebBktxApp.input.initialize();

            }


            console.log(
                "[WebBktx] XInput initialized."
            );

            return;

        } catch (error) {

            console.warn(
                "[WebBktx] XInput failed.",
                error
            );

        }

    }


    /*
     * Basic keyboard fallback.
     */

    WebBktxApp.input = {

        keyboard: {},

        initialize() {}

    };


    window.addEventListener(
        "keydown",
        event => {

            WebBktxApp.input.keyboard[
                event.code
            ] = true;

        }
    );


    window.addEventListener(
        "keyup",
        event => {

            WebBktxApp.input.keyboard[
                event.code
            ] = false;

        }
    );


    console.log(
        "[WebBktx] Keyboard input fallback enabled."
    );

}


/* ============================================================
   XBE FILE
============================================================ */

async function loadGameFile(
    file
) {

    if (!file) {

        throw new Error(
            "Nie wybrano pliku XBE."
        );

    }


    if (
        !WebBktxApp.core
    ) {

        throw new Error(
            "Core nie jest zainicjalizowany."
        );

    }


    /*
     * At this stage we intentionally
     * support direct XBE files.
     *
     * ISO/XISO requires filesystem
     * extraction/mounting first.
     */

    const name =
        file.name
            .toLowerCase();


    if (
        !name.endsWith(".xbe")
    ) {

        throw new Error(
            "Na tym etapie wybierz bezpośrednio plik .xbe."
        );

    }


    setLoadingText(
        "Loading XBE..."
    );


    /*
     * Use Core.loadGame() when available.
     */

    if (
        typeof WebBktxApp.core.loadGame ===
        "function"
    ) {

        const result =
            await WebBktxApp.core.loadGame(
                file
            );


        WebBktxApp.xbe =
            result.image ||
            WebBktxApp.core.game ||
            null;


        return result;

    }


    /*
     * Fallback direct loader.
     */

    const bytes =
        await file.arrayBuffer();


    const XBE =
        window.WebBktxXBE;


    if (
        typeof XBE !==
        "function"
    ) {

        throw new Error(
            "WebBktxXBE nie jest dostępny."
        );

    }


    const loader =
        new XBE(
            bytes
        );


    await loader.load();


    WebBktxApp.xbe =
        loader;


    return {

        success: true,

        image:
            loader,

        entryPoint:
            loader.entryPoint

    };

}


/* ============================================================
   FILE INPUT
============================================================ */

function setupFileInput() {

    const input =
        $("gameFile");


    const startButton =
        $("startButton");


    if (!input) {

        return;

    }


    input.addEventListener(
        "change",
        async event => {

            const file =
                event.target.files &&
                event.target.files[0];


            if (!file) {

                return;

            }


            WebBktxApp.gameFile =
                file;


            const fileName =
                document.querySelector(
                    ".file-name"
                );


            if (fileName) {

                fileName.textContent =
                    `${file.name} (${formatBytes(file.size)})`;

            }


            try {

                message(
                    "Sprawdzanie pliku XBE...",
                    "info"
                );


                const result =
                    await loadGameFile(
                        file
                    );


                if (
                    startButton
                ) {

                    startButton.disabled =
                        false;

                }


                const gameName =
                    getGameName(
                        file,
                        result
                    );


                const gameNameElement =
                    $("gameName");


                if (
                    gameNameElement
                ) {

                    gameNameElement.textContent =
                        gameName;

                }


                message(
                    "XBE załadowany. Emulator jest gotowy do startu.",
                    "success"
                );


            } catch (error) {

                if (
                    startButton
                ) {

                    startButton.disabled =
                        true;

                }


                message(
                    `XBE ERROR: ${error.message}`,
                    "error"
                );


                console.error(
                    "[WebBktx] XBE load error:",
                    error
                );

            }

        }
    );

}


/* ============================================================
   GAME NAME
============================================================ */

function getGameName(
    file,
    result
) {

    if (
        result &&
        result.image
    ) {

        if (
            result.image.name
        ) {

            return result.image.name;

        }

    }


    if (
        WebBktxApp.xbe &&
        WebBktxApp.xbe.name
    ) {

        return WebBktxApp.xbe.name;

    }


    return file.name
        .replace(
            /\.xbe$/i,
            ""
        );

}


/* ============================================================
   START EMULATOR
============================================================ */

async function startEmulator() {

    if (
        WebBktxApp.running
    ) {

        return;

    }


    if (
        !WebBktxApp.gameFile
    ) {

        message(
            "Najpierw wybierz plik XBE.",
            "error"
        );

        return;

    }


    try {

        /*
         * Make sure XBE is loaded.
         */

        if (
            !WebBktxApp.xbe
        ) {

            await loadGameFile(
                WebBktxApp.gameFile
            );

        }


        /*
         * Get CPU entry point.
         */

        let entryPoint =
            null;


        if (
            WebBktxApp.core &&
            typeof WebBktxApp.core.getEntryPoint ===
            "function"
        ) {

            entryPoint =
                WebBktxApp.core.getEntryPoint();

        }


        /*
         * If core exposes CPU directly,
         * configure EIP.
         */

        if (
            entryPoint !== null &&
            WebBktxApp.core &&
            WebBktxApp.core.cpu
        ) {

            const cpu =
                WebBktxApp.core.cpu;


            if (
                typeof cpu.setEIP ===
                "function"
            ) {

                try {

                    /*
                     * Core/XBE may already have
                     * translated the address.
                     */

                    cpu.setEIP(
                        entryPoint
                    );

                } catch (error) {

                    console.warn(
                        "[WebBktx] Could not set EIP:",
                        error
                    );

                }

            } else if (
                typeof cpu.setInstructionPointer ===
                "function"
            ) {

                cpu.setInstructionPointer(
                    entryPoint
                );

            }

        }


        WebBktxApp.running =
            true;


        showScreen(
            "gameScreen"
        );


        startRenderLoop();


        /*
         * Do NOT automatically execute
         * arbitrary CPU instructions forever.
         *
         * Run only when CPU/decoder/kernel
         * report that the execution environment
         * is ready.
         */

        runEmulationFrame();


    } catch (error) {

        WebBktxApp.running =
            false;


        message(
            `START ERROR: ${error.message}`,
            "error"
        );


        console.error(
            "[WebBktx] Start error:",
            error
        );

    }

}


/* ============================================================
   EMULATION FRAME
============================================================ */

function runEmulationFrame() {

    if (
        !WebBktxApp.running
    ) {

        return;

    }


    const core =
        WebBktxApp.core;


    if (
        !core
    ) {

        return;

    }


    /*
     * Prefer kernel tick if available.
     */

    if (
        WebBktxApp.kernel &&
        typeof WebBktxApp.kernel.tick ===
        "function"
    ) {

        try {

            WebBktxApp.kernel.tick();

        } catch (error) {

            console.error(
                "[WebBktx] Kernel tick error:",
                error
            );

            stopEmulator();

            return;

        }

    }


    /*
     * If a decoder exists, execute a small
     * bounded CPU slice.
     *
     * This avoids freezing the browser.
     */

    if (
        core.cpu &&
        core.cpu.decoder &&
        typeof core.cpu.step ===
        "function"
    ) {

        const instructionsPerFrame =
            100;


        try {

            for (
                let i = 0;
                i < instructionsPerFrame;
                i++
            ) {

                if (
                    !WebBktxApp.running
                ) {

                    break;

                }


                if (
                    core.cpu.halted
                ) {

                    break;

                }


                core.cpu.step();

            }

        } catch (error) {

            console.error(
                "[WebBktx] CPU execution error:",
                error
            );


            stopEmulator();

            return;

        }

    }


    /*
     * Continue next emulation slice.
     */

    if (
        WebBktxApp.running
    ) {

        setTimeout(
            runEmulationFrame,
            0
        );

    }

}


/* ============================================================
   RENDER LOOP
============================================================ */

function startRenderLoop() {

    if (
        WebBktxApp.animationFrame
    ) {

        cancelAnimationFrame(
            WebBktxApp.animationFrame
        );

    }


    WebBktxApp.lastFrameTime =
        performance.now();


    WebBktxApp.frameCount =
        0;


    WebBktxApp.fpsTimer =
        WebBktxApp.lastFrameTime;


    function frame(
        time
    ) {

        if (
            !WebBktxApp.running
        ) {

            return;

        }


        WebBktxApp.frameCount++;


        const elapsed =
            time -
            WebBktxApp.fpsTimer;


        if (
            elapsed >= 1000
        ) {

            WebBktxApp.fps =
                WebBktxApp.frameCount *
                1000 /
                elapsed;


            WebBktxApp.frameCount =
                0;


            WebBktxApp.fpsTimer =
                time;


            updateFPS();

        }


        /*
         * Prefer XGraphics Present().
         */

        if (
            WebBktxApp.graphics &&
            typeof WebBktxApp.graphics.Present ===
            "function"
        ) {

            try {

                WebBktxApp.graphics.Present();

            } catch (error) {

                console.warn(
                    "[WebBktx] Graphics Present error:",
                    error
                );

            }

        }


        WebBktxApp.animationFrame =
            requestAnimationFrame(
                frame
            );

    }


    WebBktxApp.animationFrame =
        requestAnimationFrame(
            frame
        );

}


/* ============================================================
   FPS
============================================================ */

function updateFPS() {

    const elements =
        document.querySelectorAll(
            ".emulator-status span"
        );


    elements.forEach(
        element => {

            if (
                element.textContent
                    .startsWith("FPS:")
            ) {

                element.textContent =
                    `FPS: ${Math.round(WebBktxApp.fps)}`;

            }

        }
    );

}


/* ============================================================
   STOP EMULATOR
============================================================ */

function stopEmulator() {

    WebBktxApp.running =
        false;


    if (
        WebBktxApp.animationFrame
    ) {

        cancelAnimationFrame(
            WebBktxApp.animationFrame
        );

        WebBktxApp.animationFrame =
            null;

    }


    if (
        WebBktxApp.core &&
        typeof WebBktxApp.core.stop ===
        "function"
    ) {

        try {

            WebBktxApp.core.stop();

        } catch (error) {

            console.warn(
                "[WebBktx] Core stop failed:",
                error
            );

        }

    }


    if (
        WebBktxApp.core &&
        WebBktxApp.core.cpu &&
        typeof WebBktxApp.core.cpu.stop ===
        "function"
    ) {

        WebBktxApp.core.cpu.stop();

    }


    showScreen(
        "mainScreen"
    );

}


/* ============================================================
   CPU DIAGNOSTICS
============================================================ */

function runCPUDiagnostics() {

    const output =
        $("cpuOutput");


    if (!output) {

        return;

    }


    output.textContent =
        "Running CPU diagnostics...\n";


    try {

        const cpu =
            WebBktxApp.core &&
            WebBktxApp.core.cpu;


        if (!cpu) {

            throw new Error(
                "CPU is not initialized."
            );

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

        } else if (
            typeof cpu.getState ===
            "function"
        ) {

            result =
                cpu.getState();

        } else {

            result = {

                EAX:
                    cpu.EAX,

                EBX:
                    cpu.EBX,

                ECX:
                    cpu.ECX,

                EDX:
                    cpu.EDX,

                EIP:
                    cpu.EIP,

                EFLAGS:
                    cpu.EFLAGS

            };

        }


        output.textContent =
            JSON.stringify(
                result,
                null,
                2
            );

    } catch (error) {

        output.textContent =
            "CPU ERROR\n\n" +
            error.stack ||
            error.message;

    }

}


/* ============================================================
   ABOUT
============================================================ */

function setupNavigation() {

    const cpuButton =
        $("cpuTestButton");


    const aboutButton =
        $("aboutButton");


    const cpuBack =
        $("cpuBackButton");


    const aboutBack =
        $("aboutBackButton");


    const backButton =
        $("backButton");


    if (cpuButton) {

        cpuButton.addEventListener(
            "click",
            () => {

                showScreen(
                    "cpuScreen"
                );


                runCPUDiagnostics();

            }
        );

    }


    if (aboutButton) {

        aboutButton.addEventListener(
            "click",
            () => {

                showScreen(
                    "aboutScreen"
                );

            }
        );

    }


    if (cpuBack) {

        cpuBack.addEventListener(
            "click",
            () => {

                showScreen(
                    "mainScreen"
                );

            }
        );

    }


    if (aboutBack) {

        aboutBack.addEventListener(
            "click",
            () => {

                showScreen(
                    "mainScreen"
                );

            }
        );

    }


    if (backButton) {

        backButton.addEventListener(
            "click",
            () => {

                stopEmulator();

            }
        );

    }


    const startButton =
        $("startButton");


    if (startButton) {

        startButton.addEventListener(
            "click",
            () => {

                startEmulator();

            }
        );

    }

}


/* ============================================================
   HELPERS
============================================================ */

function delay(
    milliseconds
) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                milliseconds
            )
    );

}


function formatBytes(
    bytes
) {

    if (
        !Number.isFinite(bytes) ||
        bytes <= 0
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
            Math.floor(
                Math.log(bytes) /
                Math.log(1024)
            ),
            units.length - 1
        );


    const value =
        bytes /
        Math.pow(
            1024,
            index
        );


    return (
        value.toFixed(
            index === 0
                ? 0
                : 2
        ) +
        " " +
        units[index]
    );

}


/* ============================================================
   STARTUP
============================================================ */

function boot() {

    console.log(
        `%cWebBktx App ${WEBBKTX_APP_VERSION}`,
        "font-weight:bold"
    );


    /*
     * UI setup first.
     */

    setupFileInput();

    setupNavigation();


    /*
     * Then emulator initialization.
     */

    initializeApp();

}


/* ============================================================
   DOM READY
============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        boot,
        {
            once: true
        }
    );

} else {

    boot();

}


/* ============================================================
   PUBLIC API
============================================================ */

window.WebBktxStart =
    startEmulator;


window.WebBktxStop =
    stopEmulator;


window.WebBktxDiagnostics =
    runCPUDiagnostics;


window.WebBktxLoadXBE =
    loadGameFile;
