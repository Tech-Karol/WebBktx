/*
 * ============================================================
 * WebBktx
 * Application Controller
 *
 * Version: 0.7
 *
 * NO SERVICE WORKER
 * NO CACHE INITIALIZATION
 *
 * Handles:
 *   - Boot screen
 *   - Core initialization
 *   - RAM diagnostics
 *   - CPU diagnostics
 *   - XBE file selection
 *   - XBE loading
 *   - Entry-point analysis
 *   - Emulator display
 *   - Keyboard input
 *   - Gamepad detection
 * ============================================================
 */

"use strict";


/* ============================================================
   GLOBAL STATE
============================================================ */

let emulatorCore = null;
let selectedGameFile = null;
let currentGame = null;
let emulatorRunning = false;


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


/* ============================================================
   BASIC HELPERS
============================================================ */

function sleep(ms) {

    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });

}


function setProgress(value) {

    if (!progress) return;

    value = Math.max(
        0,
        Math.min(100, value)
    );

    progress.style.width =
        value + "%";

}


function setMessage(text) {

    if (!message) return;

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

        if (!item) continue;

        item.classList.add("hidden");

    }

    if (screen) {

        screen.classList.remove("hidden");

    }

}


function setModule(name, success) {

    const module =
        document.querySelector(
            `[data-module="${name}"]`
        );

    if (!module) return;

    const status =
        module.querySelector("strong");

    if (!status) return;

    status.textContent =
        success ? "OK" : "ERROR";

    status.classList.toggle(
        "module-ok",
        success
    );

}


function formatBytes(bytes) {

    if (!Number.isFinite(bytes)) {

        return "0 B";

    }

    if (bytes < 1024) {

        return bytes + " B";

    }

    if (bytes < 1024 * 1024) {

        return (
            (bytes / 1024).toFixed(2)
            + " KB"
        );

    }

    if (bytes < 1024 * 1024 * 1024) {

        return (
            (bytes / 1024 / 1024).toFixed(2)
            + " MB"
        );

    }

    return (
        (bytes / 1024 / 1024 / 1024).toFixed(2)
        + " GB"
    );

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
   CORE INITIALIZATION
============================================================ */

function initializeCore() {

    console.log(
        "[WebBktx] Initializing core..."
    );

    if (
        !window.WebBktxCore
    ) {

        console.error(
            "[WebBktx] WebBktxCore API missing."
        );

        setModule(
            "core",
            false
        );

        return false;

    }


    if (
        typeof window.WebBktxCore.WebBktxCore !==
        "function"
    ) {

        console.error(
            "[WebBktx] WebBktxCore class missing."
        );

        setModule(
            "core",
            false
        );

        return false;

    }


    try {

        emulatorCore =
            new window.WebBktxCore.WebBktxCore();

        console.log(
            "[WebBktx] Core initialized.",
            emulatorCore
        );

        setModule(
            "core",
            true
        );

        return true;

    } catch (error) {

        console.error(
            "[WebBktx] Core initialization error:",
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
            canvas.getContext("2d");

        if (!context) {

            setModule(
                "graphics",
                false
            );

            return false;

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
            "[WebBktx] Graphics error:",
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
   CONTROLLER
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
   DIAGNOSTICS
============================================================ */

function runInitialDiagnostics() {

    if (!emulatorCore) {

        return false;

    }

    try {

        const result =
            emulatorCore.runDiagnostics();

        console.log(
            "[WebBktx] Diagnostics:",
            result
        );

        return true;

    } catch (error) {

        console.error(
            "[WebBktx] Diagnostics error:",
            error
        );

        return false;

    }

}


/* ============================================================
   BOOT
============================================================ */

async function bootWebBktx() {

    console.log(
        "================================="
    );

    console.log(
        " WebBktx boot"
    );

    console.log(
        " Cache: DISABLED"
    );

    console.log(
        "================================="
    );


    setProgress(0);

    if (loadingText) {

        loadingText.textContent =
            "Starting WebBktx...";

    }


    /*
     * IMPORTANT:
     *
     * No Service Worker.
     * No cache.
     * No navigator.serviceWorker.
     */

    await sleep(250);


    /* CORE */

    if (loadingText) {

        loadingText.textContent =
            "Loading WebBktx Core...";

    }

    setProgress(25);

    const coreReady =
        initializeCore();

    await sleep(300);


    /* GRAPHICS */

    if (loadingText) {

        loadingText.textContent =
            "Checking graphics system...";

    }

    setProgress(50);

    initializeGraphics();

    await sleep(300);


    /* INPUT */

    if (loadingText) {

        loadingText.textContent =
            "Checking controller system...";

    }

    setProgress(70);

    initializeInput();

    await sleep(300);


    /* DIAGNOSTICS */

    if (loadingText) {

        loadingText.textContent =
            "Running system diagnostics...";

    }

    setProgress(85);

    if (coreReady) {

        runInitialDiagnostics();

    }

    await sleep(300);


    /* COMPLETE */

    setProgress(100);

    if (loadingText) {

        loadingText.textContent =
            coreReady
                ? "System ready."
                : "Core initialization failed.";

    }

    await sleep(500);


    /*
     * Even if diagnostics fail,
     * open the main interface.
     */

    showScreen(mainScreen);


    if (!coreReady) {

        setMessage(
            "WARNING: WebBktx Core is unavailable."
        );

    }

}


/* ============================================================
   FILE EXTENSION
============================================================ */

function getFileExtension(file) {

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
   FILE SELECTION
============================================================ */

if (gameFile) {

    gameFile.addEventListener(
        "change",
        function () {

            const file =
                gameFile.files &&
                gameFile.files[0];

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
                getFileExtension(file);


            console.log(
                "[WebBktx] Selected:",
                file.name
            );


            console.log(
                "[WebBktx] Extension:",
                extension
            );


            if (fileInfo) {

                fileInfo.innerHTML = `

                    <span class="file-label">
                        DISC READY
                    </span>

                    <span class="file-name">
                        ${escapeHTML(file.name)}
                    </span>

                    <span class="file-size">
                        ${formatBytes(file.size)}
                    </span>

                `;

            }


            startButton.disabled =
                false;


            setMessage(
                "Local game selected: " +
                file.name
            );

        }
    );

}


/* ============================================================
   XBE LOADING
============================================================ */

async function loadXBE(file) {

    if (!emulatorCore) {

        throw new Error(
            "WebBktx Core is not initialized."
        );

    }


    if (!file) {

        throw new Error(
            "No game file selected."
        );

    }


    console.log(
        "[WebBktx] Loading XBE:",
        file.name
    );


    /*
     * New core API
     */

    if (
        typeof emulatorCore.loadGame ===
        "function"
    ) {

        return await emulatorCore.loadGame(
            file
        );

    }


    throw new Error(
        "Core does not provide loadGame()."
    );

}


/* ============================================================
   START
============================================================ */

if (startButton) {

    startButton.addEventListener(
        "click",
        async function () {

            if (!selectedGameFile) {

                setMessage(
                    "No game file selected."
                );

                return;

            }


            if (!emulatorCore) {

                setMessage(
                    "ERROR: WebBktx Core not initialized."
                );

                return;

            }


            startButton.disabled =
                true;


            try {

                setMessage(
                    "Loading local game..."
                );


                await sleep(200);


                const extension =
                    getFileExtension(
                        selectedGameFile
                    );


                console.log(
                    "[WebBktx] Format:",
                    extension
                );


                /* XBE */

                if (
                    extension === "xbe"
                ) {

                    const result =
                        await loadXBE(
                            selectedGameFile
                        );


                    console.log(
                        "[WebBktx] XBE result:",
                        result
                    );


                    currentGame =
                        result;


                    if (
                        gameName
                    ) {

                        gameName.textContent =
                            selectedGameFile.name;

                    }


                    showScreen(
                        gameScreen
                    );


                    renderXBEResult(
                        selectedGameFile,
                        result
                    );


                    setMessage(
                        "XBE loaded successfully."
                    );


                    return;

                }


                /* ISO */

                if (
                    extension === "iso" ||
                    extension === "xiso"
                ) {

                    setMessage(
                        "ISO/XISO detected. " +
                        "Disc filesystem is not implemented yet."
                    );

                    return;

                }


                setMessage(
                    "Unsupported file format."
                );

            } catch (error) {

                console.error(
                    "[WebBktx] Game error:",
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
   XBE RESULT DISPLAY
============================================================ */

function renderXBEResult(
    file,
    result
) {

    if (!canvas) return;


    const ctx =
        canvas.getContext("2d");

    if (!ctx) return;


    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    ctx.fillStyle =
        "#050708";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    ctx.textAlign =
        "center";


    /* TITLE */

    ctx.fillStyle =
        "#d7dedb";

    ctx.font =
        "bold 52px Arial";

    ctx.fillText(
        "WebBktx",
        canvas.width / 2,
        190
    );


    /* STATUS */

    ctx.fillStyle =
        "#78a896";

    ctx.font =
        "bold 22px Arial";

    ctx.fillText(
        "XBE IMAGE LOADED",
        canvas.width / 2,
        250
    );


    /* FILE */

    ctx.fillStyle =
        "#9aa5a1";

    ctx.font =
        "17px Arial";

    ctx.fillText(
        file.name,
        canvas.width / 2,
        295
    );


    /* SIZE */

    ctx.fillStyle =
        "#707b77";

    ctx.font =
        "14px Arial";

    ctx.fillText(
        "IMAGE SIZE: " +
        formatBytes(file.size),
        canvas.width / 2,
        335
    );


    /*
     * FORMAT
     */

    let format =
        "UNKNOWN";

    if (
        result &&
        result.format
    ) {

        format =
            result.format;

    }


    ctx.fillText(
        "FORMAT: " + format,
        canvas.width / 2,
        365
    );


    /*
     * MEMORY
     */

    if (
        result &&
        result.memory
    ) {

        ctx.fillText(
            "RAM ADDRESS: 0x" +
            result.memory.address
                .toString(16)
                .toUpperCase(),
            canvas.width / 2,
            400
        );

    }


    /*
     * ENTRY POINT
     */

    if (
        result &&
        result.image &&
        result.image.entryPoint !==
        undefined
    ) {

        ctx.fillStyle =
            "#8ba99d";

        ctx.fillText(
            "ENTRY POINT: 0x" +
            Number(
                result.image.entryPoint
            )
                .toString(16)
                .toUpperCase(),
            canvas.width / 2,
            435
        );

    }


    /*
     * LIMITATION
     */

    ctx.fillStyle =
        "#59635f";

    ctx.font =
        "13px Arial";

    ctx.fillText(
        "X86/Xbox execution environment under development",
        canvas.width / 2,
        500
    );

}


/* ============================================================
   CPU TEST
============================================================ */

const cpuTestButton =
    document.getElementById(
        "cpuTestButton"
    );


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


    if (!cpuOutput) return;


    cpuOutput.textContent =
        "WebBktx CPU DIAGNOSTICS\n" +
        "========================\n\n";


    await sleep(200);


    if (!emulatorCore) {

        cpuOutput.textContent +=
            "ERROR: CORE OFFLINE\n";

        return;

    }


    try {

        const diagnostics =
            emulatorCore.runDiagnostics();


        /* RAM */

        cpuOutput.textContent +=
            "MEMORY\n";

        cpuOutput.textContent +=
            "------\n";

        cpuOutput.textContent +=
            "RAM: 1 MB\n";

        cpuOutput.textContent +=
            "STATUS: " +
            (
                diagnostics.ram &&
                diagnostics.ram.passed
                    ? "ONLINE"
                    : "FAIL"
            ) +
            "\n\n";


        /* CPU */

        cpuOutput.textContent +=
            "CPU\n";

        cpuOutput.textContent +=
            "---\n";

        cpuOutput.textContent +=
            "ARCH: X86 TEST CORE\n";

        cpuOutput.textContent +=
            "STATUS: ONLINE\n\n";


        cpuOutput.textContent +=
            "PROGRAM\n";

        cpuOutput.textContent +=
            "MOV EAX, 10\n";

        cpuOutput.textContent +=
            "ADD EAX, 20\n\n";


        if (
            diagnostics.cpu
        ) {

            cpuOutput.textContent +=
                "EAX = " +
                diagnostics.cpu.registers.EAX +
                "\n";

            cpuOutput.textContent +=
                "EIP = " +
                diagnostics.cpu.EIP +
                "\n";

            cpuOutput.textContent +=
                "CYCLES = " +
                diagnostics.cpu.cycles +
                "\n\n";

        }


        cpuOutput.textContent +=
            diagnostics.cpuPassed
                ? "CPU TEST: PASS\n"
                : "CPU TEST: FAIL\n";


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

const cpuBackButton =
    document.getElementById(
        "cpuBackButton"
    );


if (cpuBackButton) {

    cpuBackButton.addEventListener(
        "click",
        function () {

            showScreen(
                mainScreen
            );

        }
    );

}


/* ============================================================
   ABOUT
============================================================ */

const aboutButton =
    document.getElementById(
        "aboutButton"
    );

const aboutBackButton =
    document.getElementById(
        "aboutBackButton"
    );


if (aboutButton) {

    aboutButton.addEventListener(
        "click",
        function () {

            showScreen(
                aboutScreen
            );

        }
    );

}


if (aboutBackButton) {

    aboutBackButton.addEventListener(
        "click",
        function () {

            showScreen(
                mainScreen
            );

        }
    );

}


/* ============================================================
   EXIT
============================================================ */

const backButton =
    document.getElementById(
        "backButton"
    );


if (backButton) {

    backButton.addEventListener(
        "click",
        function () {

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


    if (
        emulatorCore &&
        emulatorCore.cpu &&
        typeof emulatorCore.cpu.stop ===
        "function"
    ) {

        emulatorCore.cpu.stop();

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

window.addEventListener(
    "gamepadconnected",
    function (event) {

        console.log(
            "[WebBktx] Gamepad connected:",
            event.gamepad.id
        );

    }
);


window.addEventListener(
    "gamepaddisconnected",
    function (event) {

        console.log(
            "[WebBktx] Gamepad disconnected:",
            event.gamepad.id
        );

    }
);


/* ============================================================
   KEYBOARD
============================================================ */

window.addEventListener(
    "keydown",
    function (event) {

        if (!emulatorRunning) {
            return;
        }

        console.log(
            "[WebBktx] Key:",
            event.code
        );

    }
);


window.addEventListener(
    "keyup",
    function (event) {

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


    diagnostics() {

        if (!emulatorCore) {

            return null;

        }

        return emulatorCore.runDiagnostics();

    },


    stop() {

        stopEmulator();

    }

};


/* ============================================================
   START
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
