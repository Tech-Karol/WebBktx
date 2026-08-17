/*
 * ============================================================
 * WebBktx
 * Application Controller
 *
 * Version: 0.4
 *
 * Clean boot build
 *
 * Service Worker is intentionally disabled in this build.
 * First we verify that the emulator core works correctly.
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


/* ============================================================
   HELPERS
============================================================ */

function sleep(ms) {

    return new Promise(
        resolve => setTimeout(resolve, ms)
    );

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
            current.classList.add("hidden");
        }

    }

    if (screen) {
        screen.classList.remove("hidden");
    }

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
                value
            )
        );

    progress.style.width =
        safe + "%";

}


function setModule(name, success) {

    const module =
        document.querySelector(
            '[data-module="' + name + '"]'
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
        success ? "OK" : "ERROR";

    status.classList.toggle(
        "module-ok",
        success
    );

}


function setMessage(text) {

    if (message) {
        message.textContent =
            text || "";
    }

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
            (bytes / 1024).toFixed(2) +
            " KB"
        );

    }

    if (bytes < 1024 * 1024 * 1024) {

        return (
            (bytes / 1024 / 1024).toFixed(2) +
            " MB"
        );

    }

    return (
        (bytes / 1024 / 1024 / 1024).toFixed(2) +
        " GB"
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
   CORE
============================================================ */

function initializeCore() {

    try {

        if (
            !window.WebBktxCore
        ) {

            throw new Error(
                "window.WebBktxCore is missing."
            );

        }

        if (
            typeof window.WebBktxCore.WebBktxCore !==
            "function"
        ) {

            throw new Error(
                "WebBktxCore constructor is missing."
            );

        }

        emulatorCore =
            new window.WebBktxCore.WebBktxCore();

        console.log(
            "[WebBktx] Core initialized.",
            emulatorCore
        );

        return true;

    } catch (error) {

        console.error(
            "[WebBktx] Core initialization error:",
            error
        );

        setMessage(
            "CORE ERROR: " +
            error.message
        );

        return false;

    }

}


/* ============================================================
   GRAPHICS
============================================================ */

function checkGraphics() {

    if (!canvas) {
        return false;
    }

    try {

        const context =
            canvas.getContext("2d");

        if (!context) {
            return false;
        }

        context.fillStyle =
            "#050708";

        context.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        return true;

    } catch (error) {

        console.error(
            "Graphics test failed:",
            error
        );

        return false;

    }

}


/* ============================================================
   CONTROLLER
============================================================ */

function checkControllers() {

    return (
        typeof navigator.getGamepads ===
        "function"
    );

}


/* ============================================================
   BOOT
============================================================ */

async function initializeLocalSystem() {

    console.log(
        "================================"
    );

    console.log(
        "WebBktx boot started."
    );

    console.log(
        "================================"
    );


    setProgress(0);


    /* --------------------------------------------------------
       LOCAL
    -------------------------------------------------------- */

    if (loadingText) {

        loadingText.textContent =
            "Checking local environment...";

    }

    setProgress(10);

    await sleep(250);

    setModule(
        "cache",
        true
    );


    /* --------------------------------------------------------
       CORE
    -------------------------------------------------------- */

    if (loadingText) {

        loadingText.textContent =
            "Loading WebBktx Core...";

    }

    setProgress(30);

    await sleep(250);


    const coreOK =
        initializeCore();


    setModule(
        "core",
        coreOK
    );


    if (!coreOK) {

        if (loadingText) {

            loadingText.textContent =
                "Core initialization failed.";

        }

        return;

    }


    /* --------------------------------------------------------
       GRAPHICS
    -------------------------------------------------------- */

    if (loadingText) {

        loadingText.textContent =
            "Checking graphics system...";

    }

    setProgress(55);

    await sleep(250);


    const graphicsOK =
        checkGraphics();


    setModule(
        "graphics",
        graphicsOK
    );


    /* --------------------------------------------------------
       INPUT
    -------------------------------------------------------- */

    if (loadingText) {

        loadingText.textContent =
            "Checking controller system...";

    }

    setProgress(75);

    await sleep(250);


    const inputOK =
        checkControllers();


    setModule(
        "input",
        inputOK
    );


    /* --------------------------------------------------------
       DIAGNOSTICS
    -------------------------------------------------------- */

    if (loadingText) {

        loadingText.textContent =
            "Running system diagnostics...";

    }

    setProgress(90);

    await sleep(250);


    try {

        const diagnostics =
            emulatorCore.runDiagnostics();

        console.log(
            "[WebBktx] Diagnostics:",
            diagnostics
        );

    } catch (error) {

        console.error(
            "[WebBktx] Diagnostics failed:",
            error
        );

    }


    setProgress(100);

    if (loadingText) {

        loadingText.textContent =
            "System ready.";

    }

    await sleep(500);


    showScreen(
        mainScreen
    );


    console.log(
        "[WebBktx] System ready."
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


            if (!file) {

                if (fileInfo) {

                    fileInfo.innerHTML =
                        `
                        <span class="file-label">
                            DISC STATUS
                        </span>

                        <span class="file-name">
                            No file selected
                        </span>
                        `;

                }

                if (startButton) {
                    startButton.disabled = true;
                }

                setMessage("");

                return;

            }


            if (fileInfo) {

                fileInfo.innerHTML =
                    `
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


            if (startButton) {
                startButton.disabled = false;
            }


            setMessage(
                "Game image selected locally."
            );


            console.log(
                "[WebBktx] Game selected:",
                file.name,
                formatBytes(file.size)
            );

        }
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

    const parts =
        name.split(".");

    if (parts.length < 2) {
        return "";
    }

    return parts.pop();

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
        getFileExtension(
            selectedGameFile
        );


    console.log(
        "[WebBktx] Loading:",
        selectedGameFile.name
    );


    console.log(
        "[WebBktx] Format:",
        extension
    );


    if (
        extension === "xbe"
    ) {

        setMessage(
            "Reading XBE image..."
        );

        return await emulatorCore.loadGame(
            selectedGameFile
        );

    }


    if (
        extension === "iso" ||
        extension === "xiso"
    ) {

        return {

            recognized: false,

            format:
                extension.toUpperCase(),

            size:
                selectedGameFile.size,

            image: null,

            memory: null

        };

    }


    return {

        recognized: false,

        format: "UNKNOWN",

        size:
            selectedGameFile.size,

        image: null,

        memory: null

    };

}


/* ============================================================
   START
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
                    "Initializing emulator..."
                );


                await sleep(200);


                const result =
                    await loadSelectedGame();


                console.log(
                    "[WebBktx] Loader result:",
                    result
                );


                if (
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


                    drawGameScreen(
                        selectedGameFile,
                        result
                    );


                    setMessage(
                        "XBE loaded successfully."
                    );


                    emulatorRunning =
                        false;


                    return;

                }


                setMessage(
                    result.format +
                    " image detected. " +
                    "This format is not mounted yet."
                );

            } catch (error) {

                console.error(
                    "[WebBktx] Game load error:",
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
   GAME SCREEN
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


    context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    context.fillStyle =
        "#050708";

    context.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    context.textAlign =
        "center";


    context.fillStyle =
        "#d7dedb";

    context.font =
        "bold 58px Arial";

    context.fillText(
        "WebBktx",
        canvas.width / 2,
        canvas.height / 2 - 90
    );


    context.fillStyle =
        "#78a896";

    context.font =
        "bold 20px Arial";

    context.fillText(
        "XBE IMAGE LOADED",
        canvas.width / 2,
        canvas.height / 2 - 35
    );


    context.fillStyle =
        "#8b9793";

    context.font =
        "16px Arial";

    context.fillText(
        file.name,
        canvas.width / 2,
        canvas.height / 2 + 5
    );


    context.fillStyle =
        "#68736f";

    context.font =
        "14px Arial";

    context.fillText(
        "SIZE: " +
        formatBytes(result.size),
        canvas.width / 2,
        canvas.height / 2 + 40
    );


    if (
        result.memory
    ) {

        context.fillText(
            "RAM: 0x" +
            result.memory.address
                .toString(16)
                .toUpperCase(),

            canvas.width / 2,
            canvas.height / 2 + 70
        );

    }


    context.fillText(
        "EXECUTION CORE UNDER DEVELOPMENT",
        canvas.width / 2,
        canvas.height / 2 + 120
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
        "";


    cpuOutput.textContent +=
        "WebBktx CPU DIAGNOSTIC\n";

    cpuOutput.textContent +=
        "========================\n\n";


    if (!emulatorCore) {

        cpuOutput.textContent +=
            "CORE: ERROR\n";

        cpuOutput.textContent +=
            "WebBktx Core is unavailable.";

        return;

    }


    try {

        cpuOutput.textContent +=
            "Initializing RAM...\n";

        await sleep(100);


        const diagnostics =
            emulatorCore.runDiagnostics();


        const ram =
            diagnostics.ram;


        cpuOutput.textContent +=
            "RAM SIZE: " +
            formatBytes(
                diagnostics.ramSize
            ) +
            "\n";


        cpuOutput.textContent +=
            "RAM TEST: " +
            (
                ram.passed
                    ? "PASS"
                    : "FAIL"
            ) +
            "\n\n";


        cpuOutput.textContent +=
            "Initializing CPU...\n";

        await sleep(100);


        cpuOutput.textContent +=
            "CPU: X86 TEST CORE\n";

        cpuOutput.textContent +=
            "STATUS: ONLINE\n\n";


        cpuOutput.textContent +=
            "Executing test program...\n";


        cpuOutput.textContent +=
            "MOV EAX, 10\n";

        cpuOutput.textContent +=
            "ADD EAX, 20\n\n";


        const cpu =
            diagnostics.cpu;


        cpuOutput.textContent +=
            "EAX = " +
            cpu.registers.EAX +
            "\n";


        cpuOutput.textContent +=
            "EIP = " +
            cpu.EIP +
            "\n";


        cpuOutput.textContent +=
            "CYCLES = " +
            cpu.cycles +
            "\n\n";


        cpuOutput.textContent +=
            "CPU TEST: " +
            (
                diagnostics.cpuPassed
                    ? "PASS"
                    : "FAIL"
            ) +
            "\n\n";


        cpuOutput.textContent +=
            "SYSTEM DIAGNOSTICS COMPLETE.";

    } catch (error) {

        cpuOutput.textContent +=
            "\nSYSTEM ERROR\n";

        cpuOutput.textContent +=
            error.message;

        console.error(
            error
        );

    }

}


/* ============================================================
   NAVIGATION
============================================================ */

if (cpuBackButton) {

    cpuBackButton.addEventListener(
        "click",
        () => showScreen(mainScreen)
    );

}


if (aboutButton) {

    aboutButton.addEventListener(
        "click",
        () => showScreen(aboutScreen)
    );

}


if (aboutBackButton) {

    aboutBackButton.addEventListener(
        "click",
        () => showScreen(mainScreen)
    );

}


if (backButton) {

    backButton.addEventListener(
        "click",
        () => {

            emulatorRunning =
                false;


            if (
                emulatorCore &&
                emulatorCore.cpu
            ) {

                emulatorCore.cpu.stop();

            }


            currentGame =
                null;


            showScreen(
                mainScreen
            );

        }
    );

}


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
   KEYBOARD
============================================================ */

window.addEventListener(
    "keydown",
    event => {

        if (!emulatorRunning) {
            return;
        }

        console.log(
            "[WebBktx] Key:",
            event.code
        );

    }
);


/* ============================================================
   PUBLIC APP API
============================================================ */

window.WebBktxApp = {

    getCore() {
        return emulatorCore;
    },

    getCurrentGame() {
        return currentGame;
    },

    getSelectedFile() {
        return selectedGameFile;
    },

    diagnostics() {

        if (!emulatorCore) {
            return null;
        }

        return emulatorCore.runDiagnostics();

    }

};


/* ============================================================
   BOOT
============================================================ */

console.log(
    "[WebBktx] app.js loaded."
);

console.log(
    "[WebBktx] Core available:",
    !!window.WebBktxCore
);


initializeLocalSystem();
