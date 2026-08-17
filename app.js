/*
 * ============================================================
 * WebBktx
 * Application Controller
 *
 * Version: 0.7
 *
 * Handles:
 *   - Boot screen
 *   - Core initialization
 *   - Service Worker
 *   - Local XBE files
 *   - XBE analysis
 *   - Entry point display
 *   - CPU diagnostics
 *   - Emulator window
 *   - Keyboard / Gamepad input
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
   STATE
============================================================ */

let emulatorCore = null;

let selectedGameFile = null;

let currentGame = null;

let emulatorRunning = false;

let animationFrame = null;


/* ============================================================
   HELPERS
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

    value =
        Math.max(
            0,
            Math.min(
                100,
                value
            )
        );

    progress.style.width =
        `${value}%`;

}


function setMessage(text) {

    if (!message) {
        return;
    }

    message.textContent =
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

    for (const item of screens) {

        if (!item) {
            continue;
        }

        item.classList.add("hidden");

    }

    if (screen) {

        screen.classList.remove("hidden");

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


/* ============================================================
   CORE
============================================================ */

function initializeCore() {

    try {

        if (
            typeof window.WebBktxCore !==
            "function"
        ) {

            throw new Error(
                "WebBktxCore class not found."
            );

        }

        emulatorCore =
            new window.WebBktxCore({

                /*
                 * 64 MB initial RAM.
                 *
                 * This is still only an
                 * experimental memory model.
                 */

                ramSize:
                    64 * 1024 * 1024,

                debug:
                    true,

                maxInstructions:
                    100000

            });


        emulatorCore.initialize();


        console.log(
            "WebBktx Core initialized.",
            emulatorCore
        );


        setModule(
            "core",
            true
        );


        return true;

    } catch (error) {

        console.error(
            "Core initialization failed:",
            error
        );


        setModule(
            "core",
            false
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
            "Service Worker unsupported."
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


        setModule(
            "cache",
            true
        );


        console.log(
            "WebBktx Service Worker ready."
        );


        return true;

    } catch (error) {

        console.error(
            "Service Worker error:",
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


    const ctx =
        canvas.getContext("2d");


    if (!ctx) {

        setModule(
            "graphics",
            false
        );

        return false;

    }


    ctx.imageSmoothingEnabled =
        false;


    setModule(
        "graphics",
        true
    );


    return true;

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
   BOOT
============================================================ */

async function bootWebBktx() {

    setProgress(0);


    /* --------------------------------------------------------
       CACHE
    -------------------------------------------------------- */

    loadingText.textContent =
        "Checking local cache...";

    setProgress(10);


    await initializeServiceWorker();

    await sleep(250);


    /* --------------------------------------------------------
       CORE
    -------------------------------------------------------- */

    loadingText.textContent =
        "Loading WebBktx Core...";

    setProgress(30);


    const coreReady =
        initializeCore();


    if (!coreReady) {

        loadingText.textContent =
            "CORE ERROR";

        return;

    }


    await sleep(300);


    /* --------------------------------------------------------
       GRAPHICS
    -------------------------------------------------------- */

    loadingText.textContent =
        "Initializing graphics...";

    setProgress(50);


    initializeGraphics();


    await sleep(250);


    /* --------------------------------------------------------
       INPUT
    -------------------------------------------------------- */

    loadingText.textContent =
        "Initializing controller system...";

    setProgress(65);


    initializeInput();


    await sleep(250);


    /* --------------------------------------------------------
       DIAGNOSTICS
    -------------------------------------------------------- */

    loadingText.textContent =
        "Running diagnostics...";

    setProgress(80);


    try {

        const diagnostics =
            emulatorCore.diagnostics();


        console.log(
            "WebBktx diagnostics:",
            diagnostics
        );

    } catch (error) {

        console.warn(
            "Diagnostics unavailable:",
            error
        );

    }


    setProgress(95);

    await sleep(300);


    setProgress(100);


    loadingText.textContent =
        "System ready.";


    await sleep(600);


    showScreen(
        mainScreen
    );

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

                startButton.disabled =
                    true;


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


            startButton.disabled =
                false;


            setMessage(
                `Local ${extension.toUpperCase() || "GAME"} file selected.`
            );


            console.log(
                "Selected game:",
                {
                    name:
                        file.name,

                    size:
                        file.size,

                    type:
                        file.type,

                    extension
                }
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
            "WebBktx Core is unavailable."
        );

    }


    const extension =
        getExtension(
            selectedGameFile
        );


    /*
     * Currently XBE is the main
     * supported executable format.
     */

    if (
        extension !== "xbe"
    ) {

        return {

            success: false,

            recognized: false,

            format:
                extension.toUpperCase(),

            size:
                selectedGameFile.size,

            reason:
                "Only XBE executable analysis is currently implemented."

        };

    }


    return await emulatorCore.loadGame(
        selectedGameFile
    );

}


/* ============================================================
   START BUTTON
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
                    "Analyzing XBE..."
                );


                await sleep(200);


                const result =
                    await loadSelectedGame();


                console.log(
                    "XBE result:",
                    result
                );


                if (
                    !result ||
                    !result.success
                ) {

                    throw new Error(
                        result?.reason ||
                        "XBE analysis failed."
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


                renderXBEDebugScreen(
                    result
                );


                setMessage(
                    "XBE analyzed successfully."
                );


                /*
                 * Important:
                 *
                 * We do NOT automatically
                 * execute the XBE yet.
                 *
                 * 0.7 displays the executable
                 * information and prepares
                 * the CPU.
                 */

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
   XBE DEBUG DISPLAY
============================================================ */

function renderXBEDebugScreen(
    result
) {

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


    /* --------------------------------------------------------
       CLEAR
    -------------------------------------------------------- */

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
       TITLE
    -------------------------------------------------------- */

    ctx.fillStyle =
        "#d7dedb";

    ctx.font =
        "bold 34px monospace";


    ctx.fillText(
        "WebBktx XBE ANALYZER",
        50,
        70
    );


    /* --------------------------------------------------------
       GAME
    -------------------------------------------------------- */

    ctx.fillStyle =
        "#78a896";

    ctx.font =
        "bold 18px monospace";


    ctx.fillText(
        "EXECUTABLE",
        50,
        115
    );


    ctx.fillStyle =
        "#c0c8c5";

    ctx.font =
        "16px monospace";


    ctx.fillText(
        selectedGameFile.name,
        50,
        145
    );


    ctx.fillText(
        `SIZE: ${formatBytes(result.image?.size || selectedGameFile.size)}`,
        50,
        175
    );


    /* --------------------------------------------------------
       ENTRY POINT
    -------------------------------------------------------- */

    ctx.fillStyle =
        "#78a896";

    ctx.font =
        "bold 18px monospace";


    ctx.fillText(
        "ENTRY POINT",
        50,
        225
    );


    ctx.fillStyle =
        "#d7dedb";

    ctx.font =
        "20px monospace";


    ctx.fillText(
        hex(result.entryPoint),
        50,
        258
    );


    /* --------------------------------------------------------
       CPU
    -------------------------------------------------------- */

    let cpuState = null;


    try {

        cpuState =
            emulatorCore.getCPUState();

    } catch (error) {

        console.warn(
            "CPU state unavailable:",
            error
        );

    }


    ctx.fillStyle =
        "#78a896";

    ctx.font =
        "bold 18px monospace";


    ctx.fillText(
        "CPU STATE",
        50,
        315
    );


    ctx.fillStyle =
        "#c0c8c5";

    ctx.font =
        "15px monospace";


    if (cpuState) {

        ctx.fillText(
            `EIP  ${hex(cpuState.EIP)}`,
            50,
            345
        );

        ctx.fillText(
            `EAX  ${hex(cpuState.EAX)}`,
            50,
            370
        );

        ctx.fillText(
            `EBX  ${hex(cpuState.EBX)}`,
            50,
            395
        );

        ctx.fillText(
            `ECX  ${hex(cpuState.ECX)}`,
            50,
            420
        );

        ctx.fillText(
            `EDX  ${hex(cpuState.EDX)}`,
            50,
            445
        );

    } else {

        ctx.fillText(
            "CPU STATE UNAVAILABLE",
            50,
            350
        );

    }


    /* --------------------------------------------------------
       STATUS
    -------------------------------------------------------- */

    ctx.fillStyle =
        "#78a896";

    ctx.font =
        "bold 18px monospace";


    ctx.fillText(
        "STATUS",
        500,
        115
    );


    ctx.fillStyle =
        "#c0c8c5";

    ctx.font =
        "15px monospace";


    ctx.fillText(
        "XBE: LOADED",
        500,
        150
    );


    ctx.fillText(
        "MEMORY: MAPPED",
        500,
        180
    );


    ctx.fillText(
        "CPU: READY",
        500,
        210
    );


    ctx.fillText(
        "EXECUTION: WAITING",
        500,
        240
    );


    /* --------------------------------------------------------
       DEVELOPMENT MESSAGE
    -------------------------------------------------------- */

    ctx.fillStyle =
        "#68736f";

    ctx.font =
        "13px monospace";


    ctx.fillText(
        "XBOX EXECUTION ENVIRONMENT UNDER DEVELOPMENT",
        50,
        height - 55
    );


    ctx.fillText(
        "WebBktx 0.7",
        50,
        height - 30
    );

}


/* ============================================================
   CPU TEST
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
        "WebBktx CPU DIAGNOSTIC\n";

    cpuOutput.textContent +=
        "========================\n\n";


    await sleep(150);


    if (!emulatorCore) {

        cpuOutput.textContent +=
            "ERROR: CORE NOT INITIALIZED\n";

        return;

    }


    try {

        const diagnostics =
            emulatorCore.diagnostics();


        /* ----------------------------------------------------
           CORE
        ---------------------------------------------------- */

        cpuOutput.textContent +=
            "CORE\n";

        cpuOutput.textContent +=
            `VERSION: ${emulatorCore.version}\n`;

        cpuOutput.textContent +=
            "STATUS: ONLINE\n\n";


        /* ----------------------------------------------------
           MEMORY
        ---------------------------------------------------- */

        cpuOutput.textContent +=
            "MEMORY\n";

        cpuOutput.textContent +=
            `RAM: ${formatBytes(
                diagnostics.memory.size
            )}\n`;

        cpuOutput.textContent +=
            "STATUS: ONLINE\n\n";


        /* ----------------------------------------------------
           CPU
        ---------------------------------------------------- */

        cpuOutput.textContent +=
            "CPU\n";

        cpuOutput.textContent +=
            "ARCHITECTURE: x86\n";

        cpuOutput.textContent +=
            "MODE: EXPERIMENTAL\n";

        cpuOutput.textContent +=
            `EIP: ${hex(
                diagnostics.cpu.EIP
            )}\n`;

        cpuOutput.textContent +=
            `EAX: ${hex(
                diagnostics.cpu.EAX
            )}\n`;

        cpuOutput.textContent +=
            `EBX: ${hex(
                diagnostics.cpu.EBX
            )}\n`;

        cpuOutput.textContent +=
            `ECX: ${hex(
                diagnostics.cpu.ECX
            )}\n`;

        cpuOutput.textContent +=
            `EDX: ${hex(
                diagnostics.cpu.EDX
            )}\n\n`;


        /* ----------------------------------------------------
           GAME
        ---------------------------------------------------- */

        cpuOutput.textContent +=
            "XBE\n";


        if (
            diagnostics.game.loaded
        ) {

            cpuOutput.textContent +=
                "STATUS: LOADED\n";

            cpuOutput.textContent +=
                `ENTRY POINT: ${hex(
                    diagnostics.game.entryPoint
                )}\n`;

        } else {

            cpuOutput.textContent +=
                "STATUS: NO IMAGE\n";

        }


        cpuOutput.textContent +=
            "\nSYSTEM DIAGNOSTICS COMPLETE.\n";

    } catch (error) {

        console.error(
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


    if (
        emulatorCore &&
        typeof emulatorCore.stop ===
        "function"
    ) {

        emulatorCore.stop();

    }


    currentGame =
        null;


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
   DEBUG API
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


    stop() {

        stopEmulator();

    },


    diagnostics() {

        if (!emulatorCore) {

            return null;

        }

        return emulatorCore.diagnostics();

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
   START
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        bootWebBktx();

    }
);
