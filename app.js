
/*
 * ============================================================
 * WebBktx
 * Application Controller
 *
 * Version: 0.3
 *
 * Handles:
 *   - Boot screen
 *   - Service Worker
 *   - Local game files
 *   - XBE loading
 *   - CPU diagnostics
 *   - RAM diagnostics
 *   - Emulator screen
 *   - Controller input detection
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


/* ============================================================
   GLOBAL EMULATOR STATE
============================================================ */

let emulatorCore = null;

let selectedGameFile = null;

let currentGame = null;

let emulatorRunning = false;


/* ============================================================
   HELPERS
============================================================ */

function sleep(milliseconds) {

    return new Promise(resolve => {

        setTimeout(
            resolve,
            milliseconds
        );

    });

}


function showScreen(screen) {

    const screens = [

        loadingScreen,
        mainScreen,
        cpuScreen,
        aboutScreen,
        gameScreen

    ];


    for (
        const currentScreen
        of screens
    ) {

        if (!currentScreen) {
            continue;
        }

        currentScreen.classList.add(
            "hidden"
        );

    }


    screen.classList.remove(
        "hidden"
    );

}


function setProgress(value) {

    if (!progress) {
        return;
    }


    const safeValue =
        Math.max(
            0,
            Math.min(
                100,
                value
            )
        );


    progress.style.width =
        `${safeValue}%`;

}


function setModule(
    moduleName,
    status
) {

    const module =
        document.querySelector(
            `[data-module="${moduleName}"]`
        );


    if (!module) {
        return;
    }


    const state =
        module.querySelector(
            "strong"
        );


    if (!state) {
        return;
    }


    state.textContent =
        status
            ? "OK"
            : "ERROR";


    state.classList.toggle(
        "module-ok",
        status
    );

}


function setMessage(text) {

    if (!message) {
        return;
    }


    message.textContent =
        text || "";

}


function formatBytes(bytes) {

    if (!Number.isFinite(bytes)) {
        return "0 B";
    }


    if (bytes < 1024) {

        return `${bytes} B`;

    }


    if (bytes < 1024 * 1024) {

        return (
            `${(
                bytes / 1024
            ).toFixed(2)} KB`
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


function escapeHTML(value) {

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


/* ============================================================
   CORE INITIALIZATION
============================================================ */

function initializeCore() {

    if (
        !window.WebBktxCore ||
        !window.WebBktxCore.WebBktxCore
    ) {

        console.error(
            "WebBktx Core is unavailable."
        );

        return false;

    }


    try {

        emulatorCore =
            new WebBktxCore.WebBktxCore();


        console.log(
            "WebBktx Core initialized."
        );


        return true;

    } catch (error) {

        console.error(
            "Core initialization failed:",
            error
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
            "WebBktx Service Worker ready."
        );


        setModule(
            "cache",
            true
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
   GRAPHICS CHECK
============================================================ */

function checkGraphics() {

    if (!canvas) {

        setModule(
            "graphics",
            false
        );

        return false;

    }


    const context =
        canvas.getContext(
            "2d"
        );


    if (!context) {

        setModule(
            "graphics",
            false
        );

        return false;

    }


    setModule(
        "graphics",
        true
    );


    return true;

}


/* ============================================================
   CONTROLLER CHECK
============================================================ */

function checkControllers() {

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
   SYSTEM BOOT
============================================================ */

async function initializeLocalSystem() {

    setProgress(0);


    /*
     * Cache
     */

    loadingText.textContent =
        "Checking local storage...";

    setProgress(10);


    await initializeServiceWorker();


    await sleep(300);


    /*
     * Core
     */

    loadingText.textContent =
        "Loading WebBktx Core...";

    setProgress(30);


    const coreReady =
        initializeCore();


    setModule(
        "core",
        coreReady
    );


    await sleep(400);


    /*
     * Graphics
     */

    loadingText.textContent =
        "Checking graphics system...";

    setProgress(55);


    checkGraphics();


    await sleep(400);


    /*
     * Input
     */

    loadingText.textContent =
        "Checking controller system...";

    setProgress(75);


    checkControllers();


    await sleep(400);


    /*
     * Finalization
     */

    loadingText.textContent =
        "Running system diagnostics...";

    setProgress(90);


    if (emulatorCore) {

        try {

            const diagnostics =
                emulatorCore.runDiagnostics();


            console.log(
                "WebBktx diagnostics:",
                diagnostics
            );

        } catch (error) {

            console.error(
                "Diagnostics failed:",
                error
            );

        }

    }


    await sleep(400);


    setProgress(100);


    loadingText.textContent =
        "System ready.";


    await sleep(700);


    showScreen(
        mainScreen
    );

}


/* ============================================================
   GAME FILE SELECTION
============================================================ */

if (gameFile) {

    gameFile.addEventListener(
        "change",
        () => {

            const file =
                gameFile.files[0];


            selectedGameFile =
                file || null;


            if (!file) {

                fileInfo.innerHTML = `

                    <span class="file-label">
                        DISC STATUS
                    </span>

                    <span class="file-name">
                        No file selected
                    </span>

                `;


                startButton.disabled =
                    true;


                setMessage(
                    ""
                );


                return;

            }


            const filename =
                escapeHTML(
                    file.name
                );


            const size =
                formatBytes(
                    file.size
                );


            fileInfo.innerHTML = `

                <span class="file-label">
                    DISC READY
                </span>

                <span class="file-name">
                    ${filename}
                </span>

                <span class="file-size">
                    ${size}
                </span>

            `;


            startButton.disabled =
                false;


            setMessage(
                "Game image selected locally."
            );


            console.log(
                "Selected game:",
                file.name
            );

        }
    );

}


/* ============================================================
   GAME FORMAT DETECTION
============================================================ */

function getFileExtension(file) {

    if (!file || !file.name) {
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


    setMessage(
        "Reading game image..."
    );


    const extension =
        getFileExtension(
            selectedGameFile
        );


    console.log(
        "File extension:",
        extension
    );


    /*
     * Currently the loader understands XBE.
     *
     * ISO/XISO parsing will be added later.
     */

    if (
        extension === "xbe"
    ) {

        return await emulatorCore.loadGame(
            selectedGameFile
        );

    }


    /*
     * ISO/XISO is detected but not yet mounted.
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
                null

        };

    }


    /*
     * Unknown extension.
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
            null

    };

}


/* ============================================================
   START EMULATOR
============================================================ */

if (startButton) {

    startButton.addEventListener(
        "click",
        async () => {

            if (
                !selectedGameFile
            ) {
                return;
            }


            startButton.disabled =
                true;


            try {

                setMessage(
                    "Initializing emulator..."
                );


                await sleep(250);


                const result =
                    await loadSelectedGame();


                console.log(
                    "Game loader result:",
                    result
                );


                /*
                 * XBE recognized
                 */

                if (
                    result.recognized
                ) {

                    currentGame =
                        result;


                    gameName.textContent =
                        selectedGameFile.name;


                    setMessage(
                        "XBE image loaded into emulated memory."
                    );


                    showScreen(
                        gameScreen
                    );


                    initializeEmulatorDisplay(
                        selectedGameFile,
                        result
                    );


                    /*
                     * At this stage we DO NOT
                     * execute arbitrary XBE code.
                     *
                     * The CPU still lacks the full
                     * Xbox execution environment.
                     */

                    emulatorRunning =
                        false;


                    return;

                }


                /*
                 * ISO/XISO/unknown
                 */

                setMessage(
                    `${result.format} image detected. ` +
                    "Disc mounting is not implemented yet."
                );


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
   EMULATOR DISPLAY
============================================================ */

function initializeEmulatorDisplay(
    file,
    result
) {

    if (!canvas) {
        return;
    }


    const context =
        canvas.getContext(
            "2d"
        );


    if (!context) {
        return;
    }


    /*
     * Background
     */

    context.fillStyle =
        "#050708";


    context.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    /*
     * Main logo
     */

    context.textAlign =
        "center";


    context.fillStyle =
        "#d7dedb";


    context.font =
        "bold 58px Arial";


    context.fillText(
        "WebBktx",
        canvas.width / 2,
        canvas.height / 2 - 80
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
        canvas.width / 2,
        canvas.height / 2 - 20
    );


    /*
     * Filename
     */

    context.fillStyle =
        "#8b9793";


    context.font =
        "16px Arial";


    context.fillText(
        file.name,
        canvas.width / 2,
        canvas.height / 2 + 20
    );


    /*
     * Size
     */

    context.fillStyle =
        "#5e6966";


    context.font =
        "14px Arial";


    context.fillText(
        `Image size: ${formatBytes(result.size)}`,
        canvas.width / 2,
        canvas.height / 2 + 55
    );


    /*
     * Memory information
     */

    if (
        result.memory
    ) {

        context.fillText(
            `Loaded at RAM address: 0x${
                result.memory.address
                    .toString(16)
                    .toUpperCase()
            }`,
            canvas.width / 2,
            canvas.height / 2 + 85
        );

    }


    /*
     * Current limitation
     */

    context.fillStyle =
        "#68736f";


    context.font =
        "13px Arial";


    context.fillText(
        "Execution core is under development.",
        canvas.width / 2,
        canvas.height / 2 + 135
    );

}


/* ============================================================
   CPU DIAGNOSTICS
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


    if (!cpuOutput) {
        return;
    }


    cpuOutput.textContent =
        "Initializing WebBktx diagnostics...\n";


    await sleep(150);


    /*
     * Check Core
     */

    if (!emulatorCore) {

        cpuOutput.textContent +=
            "\nERROR: WebBktx Core unavailable.";

        return;

    }


    try {

        /*
         * ----------------------------------------------------
         * RAM
         * ----------------------------------------------------
         */

        cpuOutput.textContent +=
            "Initializing RAM...\n";


        cpuOutput.textContent +=
            "RAM: 1 MB\n";


        cpuOutput.textContent +=
            "STATUS: ONLINE\n\n";


        cpuOutput.textContent +=
            "Memory test:\n";


        cpuOutput.textContent +=
            "WRITE 0xAA\n";


        cpuOutput.textContent +=
            "READ  0xAA\n";


        const diagnostics =
            emulatorCore.runDiagnostics();


        const ram =
            diagnostics.ram;


        if (!ram.passed) {

            cpuOutput.textContent +=
                "FAIL\n\n";


            cpuOutput.textContent +=
                "RAM TEST: FAIL\n";


            cpuOutput.textContent +=
                `Address: 0x${
                    ram.address
                        .toString(16)
                        .toUpperCase()
                }\n`;


            return;

        }


        cpuOutput.textContent +=
            "PASS\n\n";


        cpuOutput.textContent +=
            "WRITE 0x55\n";


        cpuOutput.textContent +=
            "READ  0x55\n";


        cpuOutput.textContent +=
            "PASS\n\n";


        cpuOutput.textContent +=
            "ADDRESS TEST\n";


        cpuOutput.textContent +=
            "PASS\n\n";


        cpuOutput.textContent +=
            "RAM TEST: PASS\n\n";


        /*
         * ----------------------------------------------------
         * CPU
         * ----------------------------------------------------
         */

        cpuOutput.textContent +=
            "Initializing CPU...\n";


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
            `EAX = ${cpu.registers.EAX}\n`;


        cpuOutput.textContent +=
            `EIP = ${cpu.EIP}\n`;


        cpuOutput.textContent +=
            `CYCLES = ${cpu.cycles}\n\n`;


        if (
            diagnostics.cpuPassed
        ) {

            cpuOutput.textContent +=
                "CPU TEST: PASS\n";

        } else {

            cpuOutput.textContent +=
                "CPU TEST: FAIL\n";

        }


        cpuOutput.textContent +=
            "\nSYSTEM DIAGNOSTICS COMPLETE.\n";

    } catch (error) {

        console.error(
            "Diagnostic error:",
            error
        );


        cpuOutput.textContent +=
            "\nSYSTEM TEST: ERROR\n";


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

const backButton =
    document.getElementById(
        "backButton"
    );


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
        emulatorCore.cpu
    ) {

        emulatorCore.cpu.stop();

    }


    currentGame =
        null;


    console.log(
        "WebBktx emulator stopped."
    );

}


/* ============================================================
   GAMEPAD MONITOR
============================================================ */

function checkGamepads() {

    if (
        typeof navigator.getGamepads !==
        "function"
    ) {

        return;

    }


    const gamepads =
        navigator.getGamepads();


    for (
        const gamepad
        of gamepads
    ) {

        if (!gamepad) {
            continue;
        }


        console.log(
            "Controller:",
            gamepad.id
        );


        break;

    }

}


/*
 * Browser will call this when controllers
 * are connected.
 */

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
   KEYBOARD INPUT
============================================================ */

window.addEventListener(
    "keydown",
    event => {

        if (
            !emulatorRunning
        ) {
            return;
        }


        console.log(
            "Emulator key down:",
            event.code
        );

    }
);


window.addEventListener(
    "keyup",
    event => {

        if (
            !emulatorRunning
        ) {
            return;
        }


        console.log(
            "Emulator key up:",
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


    getCurrentGame() {

        return currentGame;

    },


    getSelectedFile() {

        return selectedGameFile;

    },


    stop() {

        stopEmulator();

    },


    diagnostics() {

        if (!emulatorCore) {

            return null;

        }


        return emulatorCore.runDiagnostics();

    }

};


/* ============================================================
   START APPLICATION
============================================================ */

initializeLocalSystem();
