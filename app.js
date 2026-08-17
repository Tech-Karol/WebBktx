/*
 * ============================================================
 * WebBktx
 * Application Controller
 *
 * Version: 0.7
 *
 * Responsibilities:
 *
 *   - Boot sequence
 *   - Service Worker / cache
 *   - Core detection
 *   - Graphics detection
 *   - Controller detection
 *   - Local XBE loading
 *   - CPU diagnostics
 *   - RAM diagnostics
 *   - Emulator screen
 *   - Keyboard input
 *
 * NOTE:
 * This file does NOT implement the CPU itself.
 * The emulation core lives inside /core/
 * ============================================================
 */

"use strict";


/* ============================================================
   VERSION
============================================================ */

const WEBBKTX_VERSION = "0.7";


/* ============================================================
   DOM HELPERS
============================================================ */

function $(id) {
    return document.getElementById(id);
}


/* ============================================================
   DOM REFERENCES
============================================================ */

const loadingScreen = $("loadingScreen");
const mainScreen = $("mainScreen");
const cpuScreen = $("cpuScreen");
const aboutScreen = $("aboutScreen");
const gameScreen = $("gameScreen");

const progress = $("progress");
const loadingText = $("loadingText");

const gameFile = $("gameFile");
const fileInfo = $("fileInfo");
const startButton = $("startButton");
const message = $("message");

const gameName = $("gameName");
const canvas = $("screen");

const cpuOutput = $("cpuOutput");

const cpuTestButton = $("cpuTestButton");
const cpuBackButton = $("cpuBackButton");

const aboutButton = $("aboutButton");
const aboutBackButton = $("aboutBackButton");

const backButton = $("backButton");


/* ============================================================
   APPLICATION STATE
============================================================ */

let emulatorCore = null;

let selectedGameFile = null;

let currentGame = null;

let emulatorRunning = false;

let bootComplete = false;


/* ============================================================
   BASIC UTILITIES
============================================================ */

function sleep(ms) {

    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });

}


function clamp(value, min, max) {

    return Math.max(
        min,
        Math.min(max, value)
    );

}


function setProgress(value) {

    if (!progress) {
        return;
    }

    progress.style.width =
        `${clamp(value, 0, 100)}%`;

}


function setLoadingText(text) {

    if (loadingText) {
        loadingText.textContent = text;
    }

}


function setMessage(text) {

    if (message) {
        message.textContent =
            text || "";
    }

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


    if (bytes < 1024 * 1024) {

        return `${(
            bytes / 1024
        ).toFixed(2)} KB`;

    }


    if (bytes < 1024 * 1024 * 1024) {

        return `${(
            bytes / 1024 / 1024
        ).toFixed(2)} MB`;

    }


    return `${(
        bytes /
        1024 /
        1024 /
        1024
    ).toFixed(2)} GB`;

}


function escapeHTML(value) {

    return String(value)

        .replace(/&/g, "&amp;")

        .replace(/</g, "&lt;")

        .replace(/>/g, "&gt;")

        .replace(/"/g, "&quot;")

        .replace(/'/g, "&#039;");

}


/* ============================================================
   SCREEN MANAGEMENT
============================================================ */

function showScreen(screen) {

    const screens = [

        loadingScreen,
        mainScreen,
        cpuScreen,
        aboutScreen,
        gameScreen

    ];


    for (const current of screens) {

        if (!current) {
            continue;
        }

        current.classList.add("hidden");

    }


    if (screen) {

        screen.classList.remove("hidden");

    }

}


/* ============================================================
   BOOT MODULE STATUS
============================================================ */

function setModule(name, success) {

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
        success
            ? "OK"
            : "ERROR";


    status.classList.toggle(
        "module-ok",
        success
    );

}


/* ============================================================
   CORE INITIALIZATION
============================================================ */

function initializeCore() {

    console.log(
        "[WebBktx] Searching for emulation core..."
    );


    /*
     * Expected public API:
     *
     * window.WebBktxCore
     */

    if (
        !window.WebBktxCore
    ) {

        console.error(
            "[WebBktx] WebBktxCore namespace missing."
        );

        return false;

    }


    /*
     * Expected constructor:
     *
     * new WebBktxCore.WebBktxCore()
     */

    if (
        typeof window.WebBktxCore.WebBktxCore !==
        "function"
    ) {

        console.error(
            "[WebBktx] WebBktxCore constructor missing."
        );

        return false;

    }


    try {

        emulatorCore =
            new window.WebBktxCore.WebBktxCore();


        console.log(
            "[WebBktx] Core initialized:",
            emulatorCore
        );


        return true;

    } catch (error) {

        console.error(
            "[WebBktx] Core initialization failed:",
            error
        );

        emulatorCore = null;

        return false;

    }

}


/* ============================================================
   SERVICE WORKER
============================================================ */

/*
 * IMPORTANT:
 *
 * Service Worker is OPTIONAL.
 *
 * Failure here MUST NOT stop WebBktx.
 */

async function initializeServiceWorker() {

    if (
        !("serviceWorker" in navigator)
    ) {

        console.warn(
            "[WebBktx] Service Worker unsupported."
        );

        setModule(
            "cache",
            false
        );

        return false;

    }


    try {

        const registration =
            await navigator.serviceWorker.register(
                "./sw.js"
            );


        console.log(
            "[WebBktx] Service Worker registered:",
            registration.scope
        );


        setModule(
            "cache",
            true
        );


        /*
         * DO NOT WAIT FOR:
         *
         * navigator.serviceWorker.ready
         *
         * Cache must never block boot.
         */

        return true;

    } catch (error) {

        console.warn(
            "[WebBktx] Service Worker unavailable:",
            error
        );


        setModule(
            "cache",
            false
        );


        return false;

    }

}


/* ============================================================
   GRAPHICS TEST
============================================================ */

function checkGraphics() {

    if (!canvas) {

        console.error(
            "[WebBktx] Canvas missing."
        );

        setModule(
            "graphics",
            false
        );

        return false;

    }


    try {

        const context =
            canvas.getContext("2d");


        if (!context) {

            setModule(
                "graphics",
                false
            );

            return false;

        }


        context.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        setModule(
            "graphics",
            true
        );


        return true;

    } catch (error) {

        console.error(
            "[WebBktx] Graphics test failed:",
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
   CONTROLLER TEST
============================================================ */

function checkControllers() {

    const supported =
        typeof navigator.getGamepads ===
        "function";


    setModule(
        "input",
        supported
    );


    if (supported) {

        console.log(
            "[WebBktx] Gamepad API available."
        );

    } else {

        console.warn(
            "[WebBktx] Gamepad API unavailable."
        );

    }


    return supported;

}


/* ============================================================
   DIAGNOSTICS
============================================================ */

function runCoreDiagnostics() {

    if (!emulatorCore) {

        throw new Error(
            "WebBktx Core is not initialized."
        );

    }


    if (
        typeof emulatorCore.runDiagnostics !==
        "function"
    ) {

        throw new Error(
            "Core diagnostics API unavailable."
        );

    }


    return emulatorCore.runDiagnostics();

}


/* ============================================================
   BOOT SEQUENCE
============================================================ */

async function initializeLocalSystem() {

    console.log(
        `%cWebBktx ${WEBBKTX_VERSION} boot`,
        "font-weight:bold"
    );


    showScreen(
        loadingScreen
    );


    setProgress(0);


    /*
     * --------------------------------------------------------
     * CACHE
     * --------------------------------------------------------
     */

    setLoadingText(
        "Checking browser cache..."
    );


    setProgress(10);


    /*
     * IMPORTANT:
     *
     * Awaiting this is safe because
     * initializeServiceWorker() never waits
     * for navigator.serviceWorker.ready.
     */

    await initializeServiceWorker();


    await sleep(200);


    /*
     * --------------------------------------------------------
     * CORE
     * --------------------------------------------------------
     */

    setLoadingText(
        "Loading WebBktx Core..."
    );


    setProgress(30);


    const coreReady =
        initializeCore();


    setModule(
        "core",
        coreReady
    );


    if (!coreReady) {

        console.error(
            "[WebBktx] Core failed to initialize."
        );

        setLoadingText(
            "Core initialization failed."
        );


        /*
         * We intentionally continue.
         *
         * This allows the UI to open and
         * the user can inspect the problem.
         */

    }


    await sleep(300);


    /*
     * --------------------------------------------------------
     * GRAPHICS
     * --------------------------------------------------------
     */

    setLoadingText(
        "Checking graphics system..."
    );


    setProgress(55);


    checkGraphics();


    await sleep(300);


    /*
     * --------------------------------------------------------
     * INPUT
     * --------------------------------------------------------
     */

    setLoadingText(
        "Checking controller system..."
    );


    setProgress(70);


    checkControllers();


    await sleep(300);


    /*
     * --------------------------------------------------------
     * DIAGNOSTICS
     * --------------------------------------------------------
     */

    setLoadingText(
        "Running system diagnostics..."
    );


    setProgress(85);


    if (emulatorCore) {

        try {

            const diagnostics =
                runCoreDiagnostics();


            console.log(
                "[WebBktx] Diagnostics:",
                diagnostics
            );


        } catch (error) {

            console.warn(
                "[WebBktx] Diagnostics failed:",
                error
            );

        }

    }


    await sleep(300);


    /*
     * --------------------------------------------------------
     * COMPLETE
     * --------------------------------------------------------
     */

    setProgress(100);


    setLoadingText(
        "System ready."
    );


    await sleep(500);


    bootComplete =
        true;


    showScreen(
        mainScreen
    );


    console.log(
        "[WebBktx] Boot complete."
    );

}


/* ============================================================
   FILE EXTENSION
============================================================ */

function getFileExtension(file) {

    if (
        !file ||
        !file.name
    ) {
        return "";
    }


    const name =
        file.name.toLowerCase();


    const index =
        name.lastIndexOf(".");


    if (
        index === -1
    ) {
        return "";
    }


    return name.substring(
        index + 1
    );

}


/* ============================================================
   GAME FILE SELECTION
============================================================ */

function updateSelectedFileUI() {

    if (!fileInfo) {
        return;
    }


    if (!selectedGameFile) {

        fileInfo.innerHTML = `

            <span class="file-label">
                DISC STATUS
            </span>

            <span class="file-name">
                No file selected
            </span>

        `;


        if (startButton) {
            startButton.disabled = true;
        }


        return;

    }


    const name =
        escapeHTML(
            selectedGameFile.name
        );


    const size =
        formatBytes(
            selectedGameFile.size
        );


    fileInfo.innerHTML = `

        <span class="file-label">
            DISC READY
        </span>

        <span class="file-name">
            ${name}
        </span>

        <span class="file-size">
            ${size}
        </span>

    `;


    if (startButton) {
        startButton.disabled = false;
    }

}


/* ============================================================
   FILE INPUT
============================================================ */

if (gameFile) {

    gameFile.addEventListener(
        "change",
        event => {

            const files =
                event.target.files;


            selectedGameFile =
                files &&
                files.length > 0
                    ? files[0]
                    : null;


            currentGame =
                null;


            updateSelectedFileUI();


            if (!selectedGameFile) {

                setMessage(
                    ""
                );

                return;

            }


            const extension =
                getFileExtension(
                    selectedGameFile
                );


            console.log(
                "[WebBktx] Selected:",
                selectedGameFile.name
            );


            console.log(
                "[WebBktx] Format:",
                extension
            );


            setMessage(
                `Local game selected: ${
                    selectedGameFile.name
                }`
            );

        }
    );

}


/* ============================================================
   GAME LOADING
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
        getFileExtension(
            selectedGameFile
        );


    console.log(
        "[WebBktx] Loading:",
        selectedGameFile.name
    );


    /*
     * --------------------------------------------------------
     * XBE
     * --------------------------------------------------------
     */

    if (
        extension === "xbe"
    ) {

        if (
            typeof emulatorCore.loadGame !==
            "function"
        ) {

            throw new Error(
                "Core XBE loader is unavailable."
            );

        }


        const result =
            await emulatorCore.loadGame(
                selectedGameFile
            );


        return result;

    }


    /*
     * --------------------------------------------------------
     * ISO
     * --------------------------------------------------------
     */

    if (
        extension === "iso" ||
        extension === "xiso"
    ) {

        const buffer =
            await selectedGameFile.arrayBuffer();


        return {

            recognized: false,

            format:
                extension.toUpperCase(),

            size:
                buffer.byteLength,

            image:
                null,

            memory:
                null,

            executable:
                false,

            message:
                "ISO/XISO loading is not implemented yet."

        };

    }


    /*
     * --------------------------------------------------------
     * UNKNOWN
     * --------------------------------------------------------
     */

    return {

        recognized: false,

        format:
            "UNKNOWN",

        size:
            selectedGameFile.size,

        image:
            null,

        memory:
            null,

        executable:
            false,

        message:
            "Unsupported file format."

    };

}


/* ============================================================
   START EMULATOR
============================================================ */

if (startButton) {

    startButton.addEventListener(
        "click",
        async () => {

            if (!selectedGameFile) {

                setMessage(
                    "Select a game file first."
                );

                return;

            }


            if (!emulatorCore) {

                setMessage(
                    "ERROR: WebBktx Core is unavailable."
                );

                console.error(
                    "[WebBktx] Start requested without core."
                );

                return;

            }


            startButton.disabled =
                true;


            try {

                setMessage(
                    "Initializing emulator..."
                );


                await sleep(150);


                setMessage(
                    "Reading game image..."
                );


                const result =
                    await loadSelectedGame();


                console.log(
                    "[WebBktx] Loader result:",
                    result
                );


                /*
                 * ------------------------------------------------
                 * XBE SUCCESS
                 * ------------------------------------------------
                 */

                if (
                    result &&
                    result.recognized
                ) {

                    currentGame =
                        result;


                    if (gameName) {

                        gameName.textContent =
                            selectedGameFile.name;

                    }


                    showScreen(
                        gameScreen
                    );


                    setMessage(
                        "XBE loaded successfully."
                    );


                    drawGameScreen(
                        selectedGameFile,
                        result
                    );


                    emulatorRunning =
                        false;


                    return;

                }


                /*
                 * ------------------------------------------------
                 * XBE INVALID
                 * ------------------------------------------------
                 */

                if (
                    result &&
                    result.format === "XBE"
                ) {

                    setMessage(
                        "XBE detected, but the image was not recognized by the core."
                    );


                    return;

                }


                /*
                 * ------------------------------------------------
                 * ISO / XISO
                 * ------------------------------------------------
                 */

                if (
                    result &&
                    (
                        result.format === "ISO" ||
                        result.format === "XISO"
                    )
                ) {

                    setMessage(
                        `${result.format} detected. Disc mounting is not implemented yet.`
                    );


                    return;

                }


                /*
                 * ------------------------------------------------
                 * UNKNOWN
                 * ------------------------------------------------
                 */

                setMessage(
                    "Unsupported or unrecognized game image."
                );

            } catch (error) {

                console.error(
                    "[WebBktx] Game loading error:",
                    error
                );


                setMessage(
                    "GAME LOAD ERROR: " +
                    (
                        error &&
                        error.message
                            ? error.message
                            : String(error)
                    )
                );

            } finally {

                startButton.disabled =
                    !selectedGameFile;

            }

        }
    );

}


/* ============================================================
   CANVAS DISPLAY
============================================================ */

function drawGameScreen(
    file,
    result
) {

    if (!canvas) {
        return;
    }


    const context =
        canvas.getContext("2d");


    if (!context) {
        return;
    }


    const width =
        canvas.width;


    const height =
        canvas.height;


    /*
     * Background
     */

    context.fillStyle =
        "#050708";


    context.fillRect(
        0,
        0,
        width,
        height
    );


    /*
     * Main title
     */

    context.textAlign =
        "center";


    context.fillStyle =
        "#d7dedb";


    context.font =
        "bold 52px Arial";


    context.fillText(
        "WebBktx",
        width / 2,
        height / 2 - 100
    );


    /*
     * Status
     */

    context.fillStyle =
        "#78a896";


    context.font =
        "bold 20px Arial";


    context.fillText(
        "XBE IMAGE LOADED",
        width / 2,
        height / 2 - 45
    );


    /*
     * Filename
     */

    context.fillStyle =
        "#9aa6a2";


    context.font =
        "16px Arial";


    context.fillText(
        file.name,
        width / 2,
        height / 2
    );


    /*
     * File size
     */

    context.fillStyle =
        "#69736f";


    context.font =
        "14px Arial";


    context.fillText(
        `Image size: ${formatBytes(result.size)}`,
        width / 2,
        height / 2 + 35
    );


    /*
     * Memory location
     */

    if (
        result.memory &&
        Number.isFinite(
            result.memory.address
        )
    ) {

        context.fillText(
            `Loaded at RAM: 0x${
                result.memory.address
                    .toString(16)
                    .toUpperCase()
            }`,
            width / 2,
            height / 2 + 65
        );

    }


    /*
     * Execution status
     */

    context.fillStyle =
        "#59635f";


    context.font =
        "13px Arial";


    context.fillText(
        "Execution core under development.",
        width / 2,
        height / 2 + 115
    );


    context.fillText(
        "XBE analysis completed.",
        width / 2,
        height / 2 + 140
    );

}


/* ============================================================
   CPU DIAGNOSTICS
============================================================ */

async function runCPUDiagnostics() {

    showScreen(
        cpuScreen
    );


    if (!cpuOutput) {
        return;
    }


    cpuOutput.textContent =
        "";


    function write(text = "") {

        cpuOutput.textContent +=
            text + "\n";

    }


    write(
        `WebBktx ${WEBBKTX_VERSION} Diagnostics`
    );


    write(
        "================================"
    );


    await sleep(100);


    /*
     * Core
     */

    if (!emulatorCore) {

        write(
            ""
        );

        write(
            "ERROR: WebBktx Core unavailable."
        );


        write(
            ""
        );


        write(
            "Check:"
        );


        write(
            "1. core/memory.js"
        );


        write(
            "2. core/cpu.js"
        );


        write(
            "3. core/xbe.js"
        );


        write(
            "4. core/core.js"
        );


        write(
            "5. script order in index.html"
        );


        return;

    }


    write(
        ""
    );


    write(
        "Initializing WebBktx Core..."
    );


    await sleep(150);


    let diagnostics;


    try {

        diagnostics =
            runCoreDiagnostics();

    } catch (error) {

        write(
            ""
        );


        write(
            "DIAGNOSTIC ERROR:"
        );


        write(
            error.message
        );


        console.error(
            "[WebBktx] Diagnostic error:",
            error
        );


        return;

    }


    /*
     * RAM
     */

    write(
        ""
    );


    write(
        "MEMORY"
    );


    write(
        "------"
    );


    write(
        "RAM TEST"
    );


    if (
        diagnostics &&
        diagnostics.ram
    ) {

        const ram =
            diagnostics.ram;


        if (ram.passed) {

            write(
                "RAM TEST: PASS"
            );

        } else {

            write(
                "RAM TEST: FAIL"
            );


            if (
                Number.isFinite(
                    ram.address
                )
            ) {

                write(
                    `Address: 0x${
                        ram.address
                            .toString(16)
                            .toUpperCase()
                    }`
                );

            }

        }

    } else {

        write(
            "RAM TEST: NO RESULT"
        );

    }


    /*
     * CPU
     */

    write(
        ""
    );


    write(
        "CPU"
    );


    write(
        "---"
    );


    if (
        diagnostics &&
        diagnostics.cpu
    ) {

        const cpu =
            diagnostics.cpu;


        const registers =
            cpu.registers || {};


        write(
            "CPU: X86 TEST CORE"
        );


        write(
            "STATUS: ONLINE"
        );


        write(
            ""
        );


        write(
            "Executing test program..."
        );


        write(
            "MOV EAX, 10"
        );


        write(
            "ADD EAX, 20"
        );


        write(
            ""
        );


        write(
            `EAX = ${
                registers.EAX !== undefined
                    ? registers.EAX
                    : "?"
            }`
        );


        write(
            `EIP = ${
                cpu.EIP !== undefined
                    ? cpu.EIP
                    : "?"
            }`
        );


        write(
            `CYCLES = ${
                cpu.cycles !== undefined
                    ? cpu.cycles
                    : "?"
            }`
        );


        write(
            ""
        );


        if (
            diagnostics.cpuPassed
        ) {

            write(
                "CPU TEST: PASS"
            );

        } else {

            write(
                "CPU TEST: FAIL"
            );

        }

    } else {

        write(
            "CPU TEST: NO RESULT"
        );

    }


    /*
     * End
     */

    write(
        ""
    );


    write(
        "================================"
    );


    write(
        "SYSTEM DIAGNOSTICS COMPLETE."
    );

}


/* ============================================================
   CPU TEST BUTTON
============================================================ */

if (cpuTestButton) {

    cpuTestButton.addEventListener(
        "click",
        runCPUDiagnostics
    );

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
   EXIT EMULATOR
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
   EMULATOR STOP
============================================================ */

function stopEmulator() {

    emulatorRunning =
        false;


    if (
        emulatorCore &&
        emulatorCore.cpu &&
        typeof emulatorCore.cpu.stop ===
        "function"
    ) {

        try {

            emulatorCore.cpu.stop();

        } catch (error) {

            console.warn(
                "[WebBktx] CPU stop error:",
                error
            );

        }

    }


    currentGame =
        null;


    console.log(
        "[WebBktx] Emulator stopped."
    );

}


/* ============================================================
   GAMEPAD
============================================================ */

function pollGamepads() {

    if (
        typeof navigator.getGamepads !==
        "function"
    ) {
        return;
    }


    const pads =
        navigator.getGamepads();


    for (const pad of pads) {

        if (!pad) {
            continue;
        }


        /*
         * Controller is detected.
         *
         * Actual Xbox controller mapping
         * will be implemented later.
         */

        break;

    }

}


window.addEventListener(
    "gamepadconnected",
    event => {

        console.log(
            "[WebBktx] Gamepad connected:",
            event.gamepad.id
        );

    }
);


window.addEventListener(
    "gamepaddisconnected",
    event => {

        console.log(
            "[WebBktx] Gamepad disconnected:",
            event.gamepad.id
        );

    }
);


/* ============================================================
   KEYBOARD INPUT
============================================================ */

const keyboardState =
    new Set();


window.addEventListener(
    "keydown",
    event => {

        keyboardState.add(
            event.code
        );


        if (!emulatorRunning) {
            return;
        }


        console.log(
            "[WebBktx] Key down:",
            event.code
        );

    }
);


window.addEventListener(
    "keyup",
    event => {

        keyboardState.delete(
            event.code
        );


        if (!emulatorRunning) {
            return;
        }


        console.log(
            "[WebBktx] Key up:",
            event.code
        );

    }
);


/* ============================================================
   INPUT LOOP
============================================================ */

function inputLoop() {

    pollGamepads();


    requestAnimationFrame(
        inputLoop
    );

}


inputLoop();


/* ============================================================
   DEBUG API
============================================================ */

window.WebBktxApp = {

    version:
        WEBBKTX_VERSION,


    isBootComplete() {

        return bootComplete;

    },


    getCore() {

        return emulatorCore;

    },


    getSelectedFile() {

        return selectedGameFile;

    },


    getCurrentGame() {

        return currentGame;

    },


    isRunning() {

        return emulatorRunning;

    },


    diagnostics() {

        if (!emulatorCore) {
            return null;
        }


        try {

            return runCoreDiagnostics();

        } catch (error) {

            console.error(
                "[WebBktx] Diagnostics:",
                error
            );


            return null;

        }

    },


    stop() {

        stopEmulator();

    },


    showMain() {

        showScreen(
            mainScreen
        );

    }

};


/* ============================================================
   START
============================================================ */

console.log(
    `[WebBktx] Application ${WEBBKTX_VERSION} loaded.`
);


initializeLocalSystem()
    .catch(error => {

        console.error(
            "[WebBktx] Fatal boot error:",
            error
        );


        setLoadingText(
            "Boot error — check console."
        );


        setMessage(
            error.message
        );

    });
