/*
 * ============================================================
 * WebBktx Application
 *
 * Version: 0.8 FIXED
 *
 * Features:
 *   - Hybrid Core API detection
 *   - No Service Worker
 *   - No PWA
 *   - No cache
 *   - Core initialization
 *   - XBE file selection
 *   - XBE loading
 *   - Entry Point display
 *   - CPU diagnostics
 *   - RAM diagnostics
 *   - Emulator screen
 *   - Keyboard input
 *   - Gamepad detection
 *
 * Compatible with:
 *
 *   window.WebBktxCore = Class
 *
 * AND
 *
 *   window.WebBktxCore = {
 *       WebBktxCore: Class
 *   }
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
   STATE
============================================================ */

let emulatorCore = null;

let CoreClass = null;

let selectedGameFile = null;

let currentGame = null;

let emulatorRunning = false;


/* ============================================================
   UTILITY
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

    value = Math.max(
        0,
        Math.min(100, Number(value) || 0)
    );

    progress.style.width =
        value + "%";

}


function setMessage(text) {

    if (!message) {
        return;
    }

    message.textContent =
        text || "";

}


function setLoadingText(text) {

    if (!loadingText) {
        return;
    }

    loadingText.textContent =
        text || "";

}


function showScreen(screen) {

    const screens = [

        loadingScreen,
        mainScreen,
        cpuScreen,
        aboutScreen,
        gameScreen

    ];

    for (const current of screens) {

        if (current) {

            current.classList.add(
                "hidden"
            );

        }

    }

    if (screen) {

        screen.classList.remove(
            "hidden"
        );

    }

}


function setModule(name, status) {

    const module =
        document.querySelector(
            `[data-module="${name}"]`
        );

    if (!module) {
        return;
    }

    const state =
        module.querySelector("strong");

    if (!state) {
        return;
    }

    state.textContent =
        status ? "OK" : "ERROR";

    state.classList.toggle(
        "module-ok",
        !!status
    );

}


function formatBytes(bytes) {

    bytes = Number(bytes);

    if (!Number.isFinite(bytes)) {
        return "0 B";
    }

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {

        return (
            `${(bytes / 1024).toFixed(2)} KB`
        );

    }

    if (bytes < 1024 * 1024 * 1024) {

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

    if (!file || !file.name) {
        return "";
    }

    const name =
        file.name.toLowerCase();

    const index =
        name.lastIndexOf(".");

    if (index === -1) {
        return "";
    }

    return name.substring(
        index + 1
    );

}


/* ============================================================
   HYBRID CORE DETECTION
============================================================ */

/*
 * Supports both:
 *
 * window.WebBktxCore = class
 *
 * and:
 *
 * window.WebBktxCore = {
 *     WebBktxCore: class
 * }
 *
 * Also checks WebBktxCoreAPI.
 */

function detectCoreClass() {

    let candidate =
        window.WebBktxCore;


    /*
     * Direct class/function.
     */

    if (
        typeof candidate ===
        "function"
    ) {

        return candidate;

    }


    /*
     * Object containing class.
     */

    if (
        candidate &&
        typeof candidate.WebBktxCore ===
        "function"
    ) {

        return candidate.WebBktxCore;

    }


    /*
     * Compatibility API.
     */

    if (
        window.WebBktxCoreAPI &&
        typeof window.WebBktxCoreAPI.WebBktxCore ===
        "function"
    ) {

        return window.WebBktxCoreAPI.WebBktxCore;

    }


    return null;

}


/* ============================================================
   MODULE CHECK
============================================================ */

function checkModules() {

    const memoryOK =
        typeof window.WebBktxMemory ===
        "function";

    const cpuOK =
        typeof window.WebBktxCPU ===
        "function";

    const xbeOK =
        typeof window.WebBktxXBE ===
        "function";

    CoreClass =
        detectCoreClass();


    const coreOK =
        typeof CoreClass ===
        "function";


    console.log(
        "[WebBktx] Module status:",
        {
            memory: memoryOK,
            cpu: cpuOK,
            xbe: xbeOK,
            core: coreOK,
            coreType:
                typeof window.WebBktxCore
        }
    );


    setModule(
        "core",
        coreOK
    );


    return {

        memory: memoryOK,

        cpu: cpuOK,

        xbe: xbeOK,

        core: coreOK,

        all:
            memoryOK &&
            cpuOK &&
            xbeOK &&
            coreOK

    };

}


/* ============================================================
   CORE INITIALIZATION
============================================================ */

function initializeCore() {

    CoreClass =
        detectCoreClass();


    if (!CoreClass) {

        throw new Error(
            "WebBktxCore class was not found."
        );

    }


    console.log(
        "[WebBktx] Creating Core..."
    );


    emulatorCore =
        new CoreClass({

            ramSize:
                64 * 1024 * 1024,

            debug:
                true,

            maxInstructions:
                100000

        });


    /*
     * Some Core versions initialize
     * automatically.
     *
     * Others require initialize().
     */

    if (
        typeof emulatorCore.initialize ===
        "function"
    ) {

        emulatorCore.initialize();

    }


    console.log(
        "[WebBktx] Core initialized:",
        emulatorCore
    );


    return emulatorCore;

}


/* ============================================================
   BOOT
============================================================ */

async function bootApplication() {

    try {

        setProgress(5);

        setLoadingText(
            "Checking WebBktx modules..."
        );


        await sleep(150);


        const modules =
            checkModules();


        if (!modules.all) {

            const missing = [];


            if (!modules.memory) {
                missing.push("memory.js");
            }

            if (!modules.cpu) {
                missing.push("cpu.js");
            }

            if (!modules.xbe) {
                missing.push("xbe.js");
            }

            if (!modules.core) {
                missing.push("core.js");
            }


            throw new Error(
                "Missing modules: " +
                missing.join(", ")
            );

        }


        setProgress(25);

        setLoadingText(
            "Initializing WebBktx Core..."
        );


        await sleep(200);


        initializeCore();


        setProgress(50);

        setLoadingText(
            "Checking graphics system..."
        );


        await sleep(200);


        let graphicsOK =
            false;


        if (canvas) {

            try {

                graphicsOK =
                    !!canvas.getContext(
                        "2d"
                    );

            } catch (error) {

                console.error(
                    error
                );

            }

        }


        setModule(
            "graphics",
            graphicsOK
        );


        setProgress(70);

        setLoadingText(
            "Checking controller system..."
        );


        await sleep(200);


        const controllerOK =
            typeof navigator.getGamepads ===
            "function";


        setModule(
            "input",
            controllerOK
        );


        setProgress(85);

        setLoadingText(
            "Running diagnostics..."
        );


        await sleep(200);


        if (
            emulatorCore &&
            typeof emulatorCore.diagnostics ===
            "function"
        ) {

            try {

                console.log(
                    "[WebBktx] Diagnostics:",
                    emulatorCore.diagnostics()
                );

            } catch (error) {

                console.warn(
                    "[WebBktx] Diagnostics warning:",
                    error
                );

            }

        }


        setProgress(100);

        setLoadingText(
            "System ready."
        );


        await sleep(500);


        showScreen(
            mainScreen
        );


        console.log(
            "%cWebBktx READY",
            "font-weight:bold"
        );

    } catch (error) {

        console.error(
            "[WebBktx] BOOT ERROR:",
            error
        );


        setLoadingText(
            "CORE ERROR: " +
            error.message
        );


        setProgress(100);

        setModule(
            "core",
            false
        );


        /*
         * Do NOT hide the loading screen.
         *
         * This makes the error visible.
         */

    }

}


/* ============================================================
   FILE INFORMATION
============================================================ */

function updateFileInfo(file) {

    if (!fileInfo) {
        return;
    }


    if (!file) {

        fileInfo.innerHTML = `

            <span class="file-label">
                DISC STATUS
            </span>

            <span class="file-name">
                No file selected
            </span>

        `;

        return;

    }


    fileInfo.innerHTML = `

        <span class="file-label">
            XBE SELECTED
        </span>

        <span class="file-name">
            ${escapeHTML(file.name)}
        </span>

        <span class="file-size">
            ${formatBytes(file.size)}
        </span>

    `;

}


function escapeHTML(value) {

    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}


/* ============================================================
   FILE SELECTION
============================================================ */

if (gameFile) {

    gameFile.addEventListener(
        "change",
        () => {

            const file =
                gameFile.files &&
                gameFile.files[0];


            selectedGameFile =
                file || null;


            updateFileInfo(
                selectedGameFile
            );


            if (!selectedGameFile) {

                if (startButton) {

                    startButton.disabled =
                        true;

                }

                setMessage(
                    ""
                );

                return;

            }


            const extension =
                getExtension(
                    selectedGameFile
                );


            console.log(
                "[WebBktx] Selected:",
                {
                    name:
                        selectedGameFile.name,

                    size:
                        selectedGameFile.size,

                    type:
                        selectedGameFile.type,

                    extension
                }
            );


            if (
                extension !== "xbe"
            ) {

                setMessage(
                    "ERROR: Select an .XBE file."
                );


                if (startButton) {

                    startButton.disabled =
                        true;

                }

                return;

            }


            setMessage(
                "XBE ready."
            );


            if (startButton) {

                startButton.disabled =
                    false;

            }

        }
    );

}


/* ============================================================
   XBE LOADING
============================================================ */

async function loadSelectedXBE() {

    if (!selectedGameFile) {

        throw new Error(
            "No XBE supplied."
        );

    }


    const extension =
        getExtension(
            selectedGameFile
        );


    if (extension !== "xbe") {

        throw new Error(
            "Selected file is not an XBE."
        );

    }


    if (!emulatorCore) {

        throw new Error(
            "WebBktx Core is not initialized."
        );

    }


    if (
        typeof emulatorCore.loadGame !==
        "function"
    ) {

        throw new Error(
            "Core.loadGame() is unavailable."
        );

    }


    console.log(
        "[WebBktx] Sending XBE to Core..."
    );


    setMessage(
        "Reading XBE..."
    );


    /*
     * IMPORTANT:
     *
     * selectedGameFile is a real browser
     * File object.
     *
     * This is what fixes:
     *
     * "No XBE supplied"
     */

    const result =
        await emulatorCore.loadGame(
            selectedGameFile
        );


    if (!result) {

        throw new Error(
            "XBE loader returned no result."
        );

    }


    return result;

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
                    "No XBE selected."
                );

                return;

            }


            startButton.disabled =
                true;


            try {

                setMessage(
                    "Initializing XBE..."
                );


                await sleep(150);


                const result =
                    await loadSelectedXBE();


                currentGame =
                    result;


                console.log(
                    "[WebBktx] XBE loaded:",
                    result
                );


                if (gameName) {

                    gameName.textContent =
                        selectedGameFile.name;

                }


                showScreen(
                    gameScreen
                );


                emulatorRunning =
                    false;


                drawEmulatorScreen(
                    result
                );


                setMessage(
                    "XBE loaded successfully."
                );


            } catch (error) {

                console.error(
                    "[WebBktx] XBE ERROR:",
                    error
                );


                setMessage(
                    "XBE ERROR: " +
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
   EMULATOR DISPLAY
============================================================ */

function drawEmulatorScreen(result) {

    if (!canvas) {
        return;
    }


    const ctx =
        canvas.getContext("2d");


    if (!ctx) {
        return;
    }


    const width =
        canvas.width;

    const height =
        canvas.height;


    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    ctx.fillStyle =
        "#050708";


    ctx.fillRect(
        0,
        0,
        width,
        height
    );


    ctx.textAlign =
        "center";


    ctx.fillStyle =
        "#d7dedb";


    ctx.font =
        "bold 48px Arial";


    ctx.fillText(
        "WebBktx",
        width / 2,
        height / 2 - 100
    );


    ctx.fillStyle =
        "#78a896";


    ctx.font =
        "bold 22px Arial";


    ctx.fillText(
        "XBE LOADED",
        width / 2,
        height / 2 - 45
    );


    ctx.fillStyle =
        "#a2aaa7";


    ctx.font =
        "16px Arial";


    ctx.fillText(
        selectedGameFile.name,
        width / 2,
        height / 2
    );


    ctx.fillText(
        "SIZE: " +
        formatBytes(
            selectedGameFile.size
        ),
        width / 2,
        height / 2 + 30
    );


    /*
     * Entry Point
     */

    let entryPoint =
        null;


    if (
        result &&
        result.entryPoint !==
        undefined &&
        result.entryPoint !==
        null
    ) {

        entryPoint =
            Number(
                result.entryPoint
            );

    }


    if (entryPoint !== null) {

        ctx.fillStyle =
            "#c7cfcc";


        ctx.fillText(
            "ENTRY POINT: 0x" +
            entryPoint
                .toString(16)
                .toUpperCase(),
            width / 2,
            height / 2 + 75
        );

    } else {

        ctx.fillStyle =
            "#8a9490";


        ctx.fillText(
            "ENTRY POINT: NOT DETECTED",
            width / 2,
            height / 2 + 75
        );

    }


    ctx.fillStyle =
        "#68736f";


    ctx.font =
        "14px Arial";


    ctx.fillText(
        "Execution core under development",
        width / 2,
        height / 2 + 130
    );

}


/* ============================================================
   CPU DIAGNOSTICS
============================================================ */

if (cpuTestButton) {

    cpuTestButton.addEventListener(
        "click",
        runDiagnostics
    );

}


async function runDiagnostics() {

    showScreen(
        cpuScreen
    );


    if (!cpuOutput) {
        return;
    }


    cpuOutput.textContent =
        "";


    function print(text = "") {

        cpuOutput.textContent +=
            text + "\n";

    }


    print(
        "WebBktx CPU DIAGNOSTICS"
    );

    print(
        "========================"
    );

    print();


    if (!emulatorCore) {

        print(
            "ERROR: CORE NOT INITIALIZED"
        );

        return;

    }


    try {

        print(
            "Core: ONLINE"
        );


        print(
            "Version: " +
            (
                emulatorCore.version ||
                "UNKNOWN"
            )
        );


        print();


        /*
         * Memory
         */

        print(
            "MEMORY"
        );

        print(
            "------"
        );


        if (
            typeof emulatorCore.getMemoryInfo ===
            "function"
        ) {

            const memory =
                emulatorCore.getMemoryInfo();


            print(
                "RAM: " +
                memory.sizeMB +
                " MB"
            );

            print(
                "STATUS: ONLINE"
            );

        } else {

            print(
                "RAM information unavailable"
            );

        }


        print();


        /*
         * CPU
         */

        print(
            "CPU"
        );

        print(
            "---"
        );


        if (
            typeof emulatorCore.getCPUState ===
            "function"
        ) {

            const cpu =
                emulatorCore.getCPUState();


            for (
                const key
                of Object.keys(cpu)
            ) {

                print(
                    `${key} = ${cpu[key]}`
                );

            }

        } else {

            print(
                "CPU state unavailable"
            );

        }


        print();


        /*
         * Game
         */

        print(
            "GAME"
        );

        print(
            "----"
        );


        if (currentGame) {

            print(
                "XBE: LOADED"
            );


            if (
                currentGame.entryPoint !==
                undefined
            ) {

                print(
                    "ENTRY POINT: 0x" +
                    Number(
                        currentGame.entryPoint
                    )
                        .toString(16)
                        .toUpperCase()
                );

            }

        } else {

            print(
                "XBE: NOT LOADED"
            );

        }


        print();


        print(
            "SYSTEM DIAGNOSTICS COMPLETE."
        );

    } catch (error) {

        console.error(
            "[WebBktx] Diagnostic error:",
            error
        );


        print();

        print(
            "DIAGNOSTIC ERROR:"
        );

        print(
            error.message
        );

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
   STOP
============================================================ */

function stopEmulator() {

    emulatorRunning =
        false;


    if (
        emulatorCore &&
        typeof emulatorCore.stop ===
        "function"
    ) {

        try {

            emulatorCore.stop();

        } catch (error) {

            console.warn(
                "[WebBktx] Stop warning:",
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
   KEYBOARD
============================================================ */

window.addEventListener(
    "keydown",
    event => {

        if (!emulatorRunning) {
            return;
        }


        console.log(
            "[WebBktx] KEY DOWN:",
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
            "[WebBktx] KEY UP:",
            event.code
        );

    }
);


/* ============================================================
   GAMEPAD
============================================================ */

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
   PUBLIC DEBUG API
============================================================ */

window.WebBktxApp = {

    getCore() {

        return emulatorCore;

    },


    getCoreClass() {

        return CoreClass;

    },


    getSelectedFile() {

        return selectedGameFile;

    },


    getCurrentGame() {

        return currentGame;

    },


    diagnostics() {

        if (!emulatorCore) {

            return null;

        }


        if (
            typeof emulatorCore.diagnostics ===
            "function"
        ) {

            return emulatorCore.diagnostics();

        }


        return null;

    },


    stop() {

        stopEmulator();

    }

};


/* ============================================================
   START
============================================================ */

function startApplication() {

    console.log(
        "%cWebBktx 0.8",
        "font-size:18px;font-weight:bold"
    );

    console.log(
        "Starting application..."
    );


    bootApplication();

}


/*
 * DOM is normally already parsed because
 * app.js is loaded at the bottom of index.html.
 *
 * This also works if it is loaded in <head>.
 */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        startApplication,
        {
            once: true
        }
    );

} else {

    startApplication();

}
