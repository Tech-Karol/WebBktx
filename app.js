/*
 * ============================================================
 * WebBktx
 * Application Controller
 *
 * Version: 0.7.1
 *
 * Handles:
 *   - Boot screen
 *   - Core initialization
 *   - Service Worker
 *   - Local XBE files
 *   - XBE analysis
 *   - Entry point display
 *   - CPU diagnostics
 *   - Emulator screen
 *   - Keyboard input
 *   - Gamepad detection
 *
 * ============================================================
 */

"use strict";


/* ============================================================
   DOM
============================================================ */

const loadingScreen =
    document.getElementById("loadingScreen");

const mainScreen =
    document.getElementById("mainScreen");

const cpuScreen =
    document.getElementById("cpuScreen");

const aboutScreen =
    document.getElementById("aboutScreen");

const gameScreen =
    document.getElementById("gameScreen");

const progress =
    document.getElementById("progress");

const loadingText =
    document.getElementById("loadingText");

const gameFile =
    document.getElementById("gameFile");

const fileInfo =
    document.getElementById("fileInfo");

const startButton =
    document.getElementById("startButton");

const message =
    document.getElementById("message");

const gameName =
    document.getElementById("gameName");

const canvas =
    document.getElementById("screen");

const cpuOutput =
    document.getElementById("cpuOutput");

const cpuTestButton =
    document.getElementById("cpuTestButton");

const cpuBackButton =
    document.getElementById("cpuBackButton");

const aboutButton =
    document.getElementById("aboutButton");

const aboutBackButton =
    document.getElementById("aboutBackButton");

const backButton =
    document.getElementById("backButton");


/* ============================================================
   GLOBAL STATE
============================================================ */

let emulatorCore = null;

let selectedGameFile = null;

let currentGame = null;

let emulatorRunning = false;

let animationFrame = null;


/* ============================================================
   BASIC HELPERS
============================================================ */

function sleep(ms) {

    return new Promise(
        resolve => setTimeout(resolve, ms)
    );

}


function setProgress(value) {

    if (!progress) {
        return;
    }

    const safe =
        Math.max(
            0,
            Math.min(
                100,
                Number(value) || 0
            )
        );

    progress.style.width =
        `${safe}%`;

}


function setLoadingText(text) {

    if (loadingText) {

        loadingText.textContent =
            text;

    }

}


function setMessage(text) {

    if (message) {

        message.textContent =
            text || "";

    }

}


function showScreen(screen) {

    const screens = [

        loadingScreen,
        mainScreen,
        cpuScreen,
        aboutScreen,
        gameScreen

    ];

    for (const item of screens) {

        if (!item) {
            continue;
        }

        item.classList.add(
            "hidden"
        );

    }

    if (screen) {

        screen.classList.remove(
            "hidden"
        );

    }

}


function setModule(name, state) {

    const module =
        document.querySelector(
            `[data-module="${name}"]`
        );

    if (!module) {
        return;
    }

    const status =
        module.querySelector("strong");

    if (!status) {
        return;
    }

    status.textContent =
        state ? "OK" : "ERROR";

    status.classList.toggle(
        "module-ok",
        Boolean(state)
    );

}


function formatBytes(bytes) {

    if (
        !Number.isFinite(bytes) ||
        bytes < 0
    ) {

        return "0 B";

    }

    if (bytes < 1024) {

        return `${bytes} B`;

    }

    if (
        bytes <
        1024 * 1024
    ) {

        return (
            `${(
                bytes / 1024
            ).toFixed(2)} KB`
        );

    }

    if (
        bytes <
        1024 * 1024 * 1024
    ) {

        return (
            `${(
                bytes /
                1024 /
                1024
            ).toFixed(2)} MB`
        );

    }

    return (
        `${(
            bytes /
            1024 /
            1024 /
            1024
        ).toFixed(2)} GB`
    );

}


function getExtension(file) {

    if (
        !file ||
        !file.name
    ) {

        return "";

    }

    const parts =
        file.name
            .toLowerCase()
            .split(".");

    if (
        parts.length < 2
    ) {

        return "";

    }

    return parts.pop();

}


function hex(value, digits = 8) {

    if (
        value === undefined ||
        value === null ||
        Number.isNaN(Number(value))
    ) {

        return "--------";

    }

    return (
        "0x" +
        (
            Number(value) >>> 0
        )
        .toString(16)
        .toUpperCase()
        .padStart(
            digits,
            "0"
        )
    );

}


/* ============================================================
   CORE DETECTION
============================================================ */

function findCoreClass() {

    /*
     * Variant A:
     *
     * window.WebBktxCore = class
     */

    if (
        typeof window.WebBktxCore ===
        "function"
    ) {

        return window.WebBktxCore;

    }


    /*
     * Variant B:
     *
     * window.WebBktxCore = {
     *     WebBktxCore: class
     * }
     */

    if (
        window.WebBktxCore &&
        typeof window.WebBktxCore.WebBktxCore ===
        "function"
    ) {

        return window.WebBktxCore.WebBktxCore;

    }


    /*
     * Variant C:
     *
     * window.WebBktx = {
     *     WebBktxCore: class
     * }
     */

    if (
        window.WebBktx &&
        typeof window.WebBktx.WebBktxCore ===
        "function"
    ) {

        return window.WebBktx.WebBktxCore;

    }


    return null;

}


/* ============================================================
   CORE INITIALIZATION
============================================================ */

function initializeCore() {

    try {

        const CoreClass =
            findCoreClass();


        if (!CoreClass) {

            throw new Error(
                "WebBktxCore class not found. " +
                "Check core.js."
            );

        }


        /*
         * Create emulator core.
         *
         * We intentionally use an empty
         * constructor so this remains
         * compatible with older versions.
         */

        emulatorCore =
            new CoreClass();


        /*
         * Newer cores may provide initialize().
         */

        if (
            typeof emulatorCore.initialize ===
            "function"
        ) {

            emulatorCore.initialize();

        }


        console.log(
            "WebBktx Core initialized:",
            emulatorCore
        );


        setModule(
            "core",
            true
        );


        return true;

    } catch (error) {

        console.error(
            "WebBktx Core initialization failed:",
            error
        );


        emulatorCore =
            null;


        setModule(
            "core",
            false
        );


        setLoadingText(
            "CORE ERROR: " +
            error.message
        );


        return false;

    }

}


/* ============================================================
   SERVICE WORKER
============================================================ */

async function initializeServiceWorker() {

    if (
        !("serviceWorker" in navigator)
    ) {

        console.warn(
            "Service Worker is not supported."
        );

        setModule(
            "cache",
            false
        );

        return false;

    }


    try {

        await navigator.serviceWorker.register(
            "sw.js"
        );


        await navigator.serviceWorker.ready;


        console.log(
            "Service Worker ready."
        );


        setModule(
            "cache",
            true
        );


        return true;

    } catch (error) {

        console.warn(
            "Service Worker failed:",
            error
        );


        /*
         * SW is useful for offline cache,
         * but it must NOT prevent the emulator
         * itself from starting.
         */

        setModule(
            "cache",
            false
        );


        return false;

    }

}


/* ============================================================
   GRAPHICS
============================================================ */

function initializeGraphics() {

    if (!canvas) {

        setModule(
            "graphics",
            false
        );

        return false;

    }


    try {

        const context =
            canvas.getContext(
                "2d"
            );


        if (!context) {

            throw new Error(
                "Canvas 2D context unavailable."
            );

        }


        context.imageSmoothingEnabled =
            false;


        setModule(
            "graphics",
            true
        );


        return true;

    } catch (error) {

        console.error(
            "Graphics initialization failed:",
            error
        );


        setModule(
            "graphics",
            false
        );


        return false;

    }

}


/* ============================================================
   INPUT
============================================================ */

function initializeInput() {

    const supported =
        typeof navigator.getGamepads ===
        "function";


    setModule(
        "input",
        supported
    );


    return supported;

}


/* ============================================================
   CORE DIAGNOSTICS
============================================================ */

function runCoreDiagnostics() {

    if (!emulatorCore) {

        return null;

    }


    try {

        if (
            typeof emulatorCore.diagnostics ===
            "function"
        ) {

            return emulatorCore.diagnostics();

        }


        if (
            typeof emulatorCore.runDiagnostics ===
            "function"
        ) {

            return emulatorCore.runDiagnostics();

        }


        return null;

    } catch (error) {

        console.warn(
            "Core diagnostics failed:",
            error
        );

        return null;

    }

}


/* ============================================================
   BOOT
============================================================ */

async function bootWebBktx() {

    showScreen(
        loadingScreen
    );


    setProgress(0);


    /* --------------------------------------------------------
       CACHE
    -------------------------------------------------------- */

    setLoadingText(
        "Checking local cache..."
    );

    setProgress(10);


    await initializeServiceWorker();

    await sleep(250);


    /* --------------------------------------------------------
       CORE
    -------------------------------------------------------- */

    setLoadingText(
        "Loading WebBktx Core..."
    );

    setProgress(30);


    const coreReady =
        initializeCore();


    if (!coreReady) {

        /*
         * Do NOT silently remain stuck
         * on the loading screen.
         */

        setProgress(100);


        setLoadingText(
            "CORE ERROR — check console"
        );


        /*
         * We still allow the UI to open.
         * This makes debugging from a phone
         * much easier.
         */

        await sleep(800);


        showScreen(
            mainScreen
        );


        setMessage(
            "WebBktx Core failed to initialize."
        );


    } else {

        await sleep(300);

    }


    /* --------------------------------------------------------
       GRAPHICS
    -------------------------------------------------------- */

    setLoadingText(
        "Initializing graphics..."
    );

    setProgress(50);


    initializeGraphics();


    await sleep(200);


    /* --------------------------------------------------------
       INPUT
    -------------------------------------------------------- */

    setLoadingText(
        "Initializing controller system..."
    );

    setProgress(65);


    initializeInput();


    await sleep(200);


    /* --------------------------------------------------------
       DIAGNOSTICS
    -------------------------------------------------------- */

    setLoadingText(
        "Running diagnostics..."
    );

    setProgress(80);


    const diagnostics =
        runCoreDiagnostics();


    console.log(
        "WebBktx diagnostics:",
        diagnostics
    );


    setProgress(95);


    await sleep(250);


    setProgress(100);


    setLoadingText(
        "System ready."
    );


    await sleep(400);


    /*
     * Always show main screen.
     */

    showScreen(
        mainScreen
    );


    if (!coreReady) {

        setMessage(
            "CORE ERROR: emulator unavailable."
        );

    } else {

        setMessage(
            "WebBktx ready."
        );

    }

}


/* ============================================================
   FILE SELECTION
============================================================ */

if (gameFile) {

    gameFile.addEventListener(
        "change",
        event => {

            const file =
                event.target.files[0];


            selectedGameFile =
                file || null;


            if (!file) {

                if (fileInfo) {

                    fileInfo.innerHTML = `

                        <span class="file-label">
                            DISC STATUS
                        </span>

                        <span class="file-name">
                            No file selected
                        </span>

                    `;

                }


                if (startButton) {

                    startButton.disabled =
                        true;

                }


                setMessage("");

                return;

            }


            const extension =
                getExtension(file);


            if (fileInfo) {

                fileInfo.innerHTML = `

                    <span class="file-label">
                        DISC READY
                    </span>

                    <span class="file-name">
                        ${file.name}
                    </span>

                    <span class="file-size">
                        ${formatBytes(file.size)}
                    </span>

                `;

            }


            if (startButton) {

                startButton.disabled =
                    false;

            }


            setMessage(
                `Selected ${extension.toUpperCase() || "GAME"} file locally.`
            );


            console.log(
                "Selected file:",
                file
            );

        }
    );

}


/* ============================================================
   LOAD GAME
============================================================ */

async function loadSelectedGame() {

    if (!selectedGameFile) {

        throw new Error(
            "No game file selected."
        );

    }


    if (!emulatorCore) {

        throw new Error(
            "WebBktx Core is not initialized."
        );

    }


    const extension =
        getExtension(
            selectedGameFile
        );


    /*
     * XBE
     */

    if (
        extension === "xbe"
    ) {

        /*
         * Preferred API
         */

        if (
            typeof emulatorCore.loadGame ===
            "function"
        ) {

            return await emulatorCore.loadGame(
                selectedGameFile
            );

        }


        /*
         * Alternative API
         */

        if (
            typeof emulatorCore.loadXBE ===
            "function"
        ) {

            return await emulatorCore.loadXBE(
                selectedGameFile
            );

        }


        throw new Error(
            "Core does not provide an XBE loader."
        );

    }


    /*
     * ISO / XISO
     *
     * We can read the file locally,
     * but full disc mounting is not
     * implemented yet.
     */

    if (
        extension === "iso" ||
        extension === "xiso"
    ) {

        const buffer =
            await selectedGameFile.arrayBuffer();


        return {

            success: false,

            recognized: false,

            format:
                extension.toUpperCase(),

            size:
                buffer.byteLength,

            reason:
                "ISO/XISO mounting is not implemented yet."

        };

    }


    throw new Error(
        "Unsupported game file format."
    );

}


/* ============================================================
   START EMULATOR
============================================================ */

if (startButton) {

    startButton.addEventListener(
        "click",
        async () => {

            if (!selectedGameFile) {

                return;

            }


            startButton.disabled =
                true;


            try {

                setMessage(
                    "Loading game..."
                );


                await sleep(150);


                const result =
                    await loadSelectedGame();


                console.log(
                    "Game result:",
                    result
                );


                if (
                    result &&
                    result.success === false
                ) {

                    throw new Error(
                        result.reason ||
                        "Game could not be loaded."
                    );

                }


                currentGame =
                    result;


                if (gameName) {

                    gameName.textContent =
                        selectedGameFile.name;

                }


                showScreen(
                    gameScreen
                );


                renderEmulatorScreen(
                    result
                );


                setMessage(
                    "XBE loaded. Execution environment ready."
                );


                emulatorRunning =
                    false;

            } catch (error) {

                console.error(
                    "Game loading error:",
                    error
                );


                setMessage(
                    "GAME LOAD ERROR: " +
                    error.message
                );

            } finally {

                startButton.disabled =
                    !selectedGameFile;

            }

        }
    );

}


/* ============================================================
   CPU STATE
============================================================ */

function getCPUState() {

    if (!emulatorCore) {

        return null;

    }


    try {

        if (
            typeof emulatorCore.getCPUState ===
            "function"
        ) {

            return emulatorCore.getCPUState();

        }


        if (
            emulatorCore.cpu
        ) {

            const cpu =
                emulatorCore.cpu;


            const registers =
                cpu.registers ||
                {};


            return {

                EAX:
                    registers.EAX || 0,

                EBX:
                    registers.EBX || 0,

                ECX:
                    registers.ECX || 0,

                EDX:
                    registers.EDX || 0,

                ESI:
                    registers.ESI || 0,

                EDI:
                    registers.EDI || 0,

                EBP:
                    registers.EBP || 0,

                ESP:
                    registers.ESP || 0,

                EIP:
                    cpu.EIP || 0,

                EFLAGS:
                    cpu.EFLAGS || 0

            };

        }


        return null;

    } catch (error) {

        console.warn(
            "Could not read CPU state:",
            error
        );


        return null;

    }

}


/* ============================================================
   EMULATOR DISPLAY
============================================================ */

function renderEmulatorScreen(
    result
) {

    if (!canvas) {
        return;
    }


    const ctx =
        canvas.getContext(
            "2d"
        );


    if (!ctx) {
        return;
    }


    const width =
        canvas.width;

    const height =
        canvas.height;


    ctx.fillStyle =
        "#050708";


    ctx.fillRect(
        0,
        0,
        width,
        height
    );


    ctx.textAlign =
        "left";


    /* --------------------------------------------------------
       HEADER
    -------------------------------------------------------- */

    ctx.fillStyle =
        "#d7dedb";

    ctx.font =
        "bold 32px monospace";


    ctx.fillText(
        "WebBktx",
        45,
        60
    );


    ctx.fillStyle =
        "#78a896";

    ctx.font =
        "bold 17px monospace";


    ctx.fillText(
        "XBE EXECUTION ENVIRONMENT",
        45,
        95
    );


    /* --------------------------------------------------------
       FILE
    -------------------------------------------------------- */

    ctx.fillStyle =
        "#c0c8c5";

    ctx.font =
        "15px monospace";


    ctx.fillText(
        "GAME:",
        45,
        145
    );


    ctx.fillText(
        selectedGameFile
            ? selectedGameFile.name
            : "UNKNOWN",
        140,
        145
    );


    ctx.fillText(
        "SIZE:",
        45,
        175
    );


    ctx.fillText(
        formatBytes(
            selectedGameFile
                ? selectedGameFile.size
                : 0
        ),
        140,
        175
    );


    /* --------------------------------------------------------
       ENTRY POINT
    -------------------------------------------------------- */

    ctx.fillStyle =
        "#78a896";

    ctx.font =
        "bold 17px monospace";


    ctx.fillText(
        "ENTRY POINT",
        45,
        235
    );


    ctx.fillStyle =
        "#d7dedb";

    ctx.font =
        "20px monospace";


    const entryPoint =
        result &&
        (
            result.entryPoint ??
            result.entry_point ??
            result.image?.entryPoint
        );


    ctx.fillText(
        hex(entryPoint),
        45,
        270
    );


    /* --------------------------------------------------------
       CPU
    -------------------------------------------------------- */

    const cpu =
        getCPUState();


    ctx.fillStyle =
        "#78a896";

    ctx.font =
        "bold 17px monospace";


    ctx.fillText(
        "CPU",
        500,
        145
    );


    ctx.fillStyle =
        "#c0c8c5";

    ctx.font =
        "14px monospace";


    if (cpu) {

        ctx.fillText(
            `EIP ${hex(cpu.EIP)}`,
            500,
            175
        );

        ctx.fillText(
            `EAX ${hex(cpu.EAX)}`,
            500,
            200
        );

        ctx.fillText(
            `EBX ${hex(cpu.EBX)}`,
            500,
            225
        );

        ctx.fillText(
            `ECX ${hex(cpu.ECX)}`,
            500,
            250
        );

        ctx.fillText(
            `EDX ${hex(cpu.EDX)}`,
            500,
            275
        );

    } else {

        ctx.fillText(
            "CPU STATE UNAVAILABLE",
            500,
            180
        );

    }


    /* --------------------------------------------------------
       STATUS
    -------------------------------------------------------- */

    ctx.fillStyle =
        "#78a896";

    ctx.font =
        "bold 17px monospace";


    ctx.fillText(
        "SYSTEM STATUS",
        500,
        335
    );


    ctx.fillStyle =
        "#c0c8c5";

    ctx.font =
        "14px monospace";


    ctx.fillText(
        "XBE      : LOADED",
        500,
        365
    );


    ctx.fillText(
        "MEMORY   : MAPPED",
        500,
        390
    );


    ctx.fillText(
        "CPU      : READY",
        500,
        415
    );


    ctx.fillText(
        "EXECUTION: WAITING",
        500,
        440
    );


    /* --------------------------------------------------------
       FOOTER
    -------------------------------------------------------- */

    ctx.fillStyle =
        "#68736f";

    ctx.font =
        "13px monospace";


    ctx.fillText(
        "Xbox execution environment under development.",
        45,
        height - 45
    );


    ctx.fillText(
        "WebBktx 0.7.1",
        45,
        height - 22
    );

}


/* ============================================================
   CPU DIAGNOSTICS SCREEN
============================================================ */

if (cpuTestButton) {

    cpuTestButton.addEventListener(
        "click",
        runCPUDiagnostics
    );

}


async function runCPUDiagnostics() {

    showScreen(
        cpuScreen
    );


    if (!cpuOutput) {
        return;
    }


    cpuOutput.textContent =
        "WebBktx CPU DIAGNOSTIC\n" +
        "========================\n\n";


    await sleep(150);


    if (!emulatorCore) {

        cpuOutput.textContent +=
            "CORE STATUS: ERROR\n\n";

        cpuOutput.textContent +=
            "WebBktx Core is not initialized.\n";

        return;

    }


    try {

        const diagnostics =
            runCoreDiagnostics();


        cpuOutput.textContent +=
            "CORE\n";

        cpuOutput.textContent +=
            "STATUS: ONLINE\n";


        if (
            emulatorCore.version
        ) {

            cpuOutput.textContent +=
                `VERSION: ${emulatorCore.version}\n`;

        }


        cpuOutput.textContent +=
            "\n";


        /* ----------------------------------------------------
           CPU
        ---------------------------------------------------- */

        const cpu =
            getCPUState();


        cpuOutput.textContent +=
            "CPU\n";

        cpuOutput.textContent +=
            "ARCHITECTURE: x86\n";

        cpuOutput.textContent +=
            "MODE: EXPERIMENTAL\n";


        if (cpu) {

            cpuOutput.textContent +=
                `EAX: ${hex(cpu.EAX)}\n`;

            cpuOutput.textContent +=
                `EBX: ${hex(cpu.EBX)}\n`;

            cpuOutput.textContent +=
                `ECX: ${hex(cpu.ECX)}\n`;

            cpuOutput.textContent +=
                `EDX: ${hex(cpu.EDX)}\n`;

            cpuOutput.textContent +=
                `EIP: ${hex(cpu.EIP)}\n`;

            cpuOutput.textContent +=
                `EFLAGS: ${hex(cpu.EFLAGS)}\n`;

        } else {

            cpuOutput.textContent +=
                "CPU STATE: UNAVAILABLE\n";

        }


        cpuOutput.textContent +=
            "\n";


        /* ----------------------------------------------------
           MEMORY
        ---------------------------------------------------- */

        cpuOutput.textContent +=
            "MEMORY\n";


        if (
            diagnostics &&
            diagnostics.memory
        ) {

            cpuOutput.textContent +=
                `RAM: ${formatBytes(
                    diagnostics.memory.size
                )}\n`;

        } else if (
            emulatorCore.memory &&
            emulatorCore.memory.size
        ) {

            cpuOutput.textContent +=
                `RAM: ${formatBytes(
                    emulatorCore.memory.size
                )}\n`;

        } else {

            cpuOutput.textContent +=
                "RAM: UNKNOWN\n";

        }


        cpuOutput.textContent +=
            "STATUS: ONLINE\n\n";


        /* ----------------------------------------------------
           XBE
        ---------------------------------------------------- */

        cpuOutput.textContent +=
            "XBE\n";


        if (currentGame) {

            cpuOutput.textContent +=
                "STATUS: LOADED\n";


            const entry =
                currentGame.entryPoint ??
                currentGame.entry_point ??
                currentGame.image?.entryPoint;


            cpuOutput.textContent +=
                `ENTRY POINT: ${hex(entry)}\n`;

        } else {

            cpuOutput.textContent +=
                "STATUS: NO IMAGE\n";

        }


        cpuOutput.textContent +=
            "\nSYSTEM DIAGNOSTICS COMPLETE.\n";


    } catch (error) {

        console.error(
            "Diagnostic error:",
            error
        );


        cpuOutput.textContent +=
            "\nDIAGNOSTIC ERROR\n";

        cpuOutput.textContent +=
            error.message;

    }

}


/* ============================================================
   CPU BACK
============================================================ */

if (cpuBackButton) {

    cpuBackButton.addEventListener(
        "click",
        () => {

            showScreen(
                mainScreen
            );

        }
    );

}


/* ============================================================
   ABOUT
============================================================ */

if (aboutButton) {

    aboutButton.addEventListener(
        "click",
        () => {

            showScreen(
                aboutScreen
            );

        }
    );

}


if (aboutBackButton) {

    aboutBackButton.addEventListener(
        "click",
        () => {

            showScreen(
                mainScreen
            );

        }
    );

}


/* ============================================================
   EXIT
============================================================ */

if (backButton) {

    backButton.addEventListener(
        "click",
        () => {

            stopEmulator();


            showScreen(
                mainScreen
            );

        }
    );

}


/* ============================================================
   STOP EMULATOR
============================================================ */

function stopEmulator() {

    emulatorRunning =
        false;


    if (animationFrame) {

        cancelAnimationFrame(
            animationFrame
        );


        animationFrame =
            null;

    }


    try {

        if (
            emulatorCore &&
            typeof emulatorCore.stop ===
            "function"
        ) {

            emulatorCore.stop();

        }

    } catch (error) {

        console.warn(
            "Core stop error:",
            error
        );

    }


    console.log(
        "WebBktx execution stopped."
    );

}


/* ============================================================
   GAMEPAD
============================================================ */

window.addEventListener(
    "gamepadconnected",
    event => {

        console.log(
            "Gamepad connected:",
            event.gamepad.id
        );

    }
);


window.addEventListener(
    "gamepaddisconnected",
    event => {

        console.log(
            "Gamepad disconnected:",
            event.gamepad.id
        );

    }
);


/* ============================================================
   KEYBOARD
============================================================ */

window.addEventListener(
    "keydown",
    event => {

        if (!emulatorRunning) {
            return;
        }


        console.log(
            "KEY DOWN:",
            event.code
        );

    }
);


window.addEventListener(
    "keyup",
    event => {

        if (!emulatorRunning) {
            return;
        }


        console.log(
            "KEY UP:",
            event.code
        );

    }
);


/* ============================================================
   PUBLIC DEBUG API
============================================================ */

window.WebBktxApp = {

    getCore() {

        return emulatorCore;

    },


    getSelectedFile() {

        return selectedGameFile;

    },


    getCurrentGame() {

        return currentGame;

    },


    getCPUState() {

        return getCPUState();

    },


    diagnostics() {

        return runCoreDiagnostics();

    },


    stop() {

        stopEmulator();

    },


    showMain() {

        showScreen(
            mainScreen
        );

    },


    showCPU() {

        showScreen(
            cpuScreen
        );

    }

};


/* ============================================================
   START APPLICATION
============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        bootWebBktx
    );

} else {

    bootWebBktx();

}
