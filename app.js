/*
 * ============================================================
 * WebBktx Application
 * Version 0.8
 *
 * No PWA
 * No Service Worker
 * No cache
 *
 * Handles:
 *   - Core initialization
 *   - XBE file selection
 *   - XBE loading
 *   - Entry point display
 *   - CPU diagnostics
 *   - Emulator screen
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
   STATE
============================================================ */

let emulatorCore = null;
let selectedGameFile = null;
let currentGame = null;


/* ============================================================
   HELPERS
============================================================ */

function sleep(ms) {

    return new Promise(
        resolve => setTimeout(resolve, ms)
    );

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


    for (const s of screens) {

        if (s) {

            s.classList.add("hidden");

        }

    }


    if (screen) {

        screen.classList.remove("hidden");

    }

}


function setModule(name, ok) {

    const module =
        document.querySelector(
            `[data-module="${name}"]`
        );


    if (!module) return;


    const state =
        module.querySelector("strong");


    if (!state) return;


    state.textContent =
        ok ? "OK" : "ERROR";


    state.classList.toggle(
        "module-ok",
        ok
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
            (bytes / 1024).toFixed(2) +
            " KB"
        );

    }


    return (
        (bytes / 1024 / 1024).toFixed(2) +
        " MB"
    );

}


function getExtension(file) {

    if (!file || !file.name) {

        return "";

    }


    const parts =
        file.name
            .toLowerCase()
            .split(".");


    if (parts.length < 2) {

        return "";

    }


    return parts.pop();

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


    const coreOK =
        typeof window.WebBktxCore ===
        "function";


    setModule(
        "core",
        coreOK &&
        memoryOK &&
        cpuOK &&
        xbeOK
    );


    console.log(
        "WebBktx modules:",
        {
            memory: memoryOK,
            cpu: cpuOK,
            xbe: xbeOK,
            core: coreOK
        }
    );


    return (
        memoryOK &&
        cpuOK &&
        xbeOK &&
        coreOK
    );

}


/* ============================================================
   CORE INITIALIZATION
============================================================ */

function initializeCore() {

    console.log(
        "Initializing WebBktx Core..."
    );


    if (
        typeof window.WebBktxCore !==
        "function"
    ) {

        throw new Error(
            "WebBktxCore is not loaded. " +
            "Check script paths in index.html."
        );

    }


    emulatorCore =
        new window.WebBktxCore({

            /*
             * 64 MB emulated RAM.
             */

            ramSize:
                64 * 1024 * 1024,

            debug:
                true

        });


    /*
     * Explicit initialization.
     */

    emulatorCore.initialize();


    console.log(
        "WebBktx Core initialized."
    );


    return true;

}


/* ============================================================
   BOOT
============================================================ */

async function boot() {

    try {

        setProgress(5);

        if (loadingText) {

            loadingText.textContent =
                "Checking emulator modules...";

        }


        await sleep(200);


        /*
         * Check modules.
         */

        const modulesOK =
            checkModules();


        if (!modulesOK) {

            throw new Error(
                "One or more Core modules are missing. " +
                "Check the <script> paths in index.html."
            );

        }


        setProgress(30);


        if (loadingText) {

            loadingText.textContent =
                "Initializing WebBktx Core...";

        }


        await sleep(200);


        /*
         * Create core.
         */

        initializeCore();


        setProgress(55);


        if (loadingText) {

            loadingText.textContent =
                "Checking graphics system...";

        }


        await sleep(200);


        /*
         * Canvas check.
         */

        let graphicsOK = false;


        if (canvas) {

            graphicsOK =
                !!canvas.getContext("2d");

        }


        setModule(
            "graphics",
            graphicsOK
        );


        setProgress(75);


        if (loadingText) {

            loadingText.textContent =
                "Checking controller system...";

        }


        await sleep(200);


        const controllerOK =
            typeof navigator.getGamepads ===
            "function";


        setModule(
            "input",
            controllerOK
        );


        setProgress(90);


        if (loadingText) {

            loadingText.textContent =
                "Running diagnostics...";

        }


        await sleep(300);


        /*
         * Diagnostics.
         */

        const diagnostics =
            emulatorCore.diagnostics();


        console.log(
            "WebBktx diagnostics:",
            diagnostics
        );


        setProgress(100);


        if (loadingText) {

            loadingText.textContent =
                "System ready.";

        }


        await sleep(500);


        showScreen(mainScreen);


        console.log(
            "WebBktx boot complete."
        );

    } catch (error) {

        console.error(
            "BOOT ERROR:",
            error
        );


        if (loadingText) {

            loadingText.textContent =
                "BOOT ERROR: " +
                error.message;

        }


        setProgress(100);


        setModule(
            "core",
            false
        );

    }

}


/* ============================================================
   FILE SELECTION
============================================================ */

if (gameFile) {

    gameFile.addEventListener(
        "change",
        () => {

            const files =
                gameFile.files;


            if (
                !files ||
                files.length === 0
            ) {

                selectedGameFile = null;

                if (startButton) {

                    startButton.disabled =
                        true;

                }


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


                return;

            }


            selectedGameFile =
                files[0];


            const extension =
                getExtension(
                    selectedGameFile
                );


            console.log(
                "Selected file:",
                selectedGameFile.name
            );


            console.log(
                "Extension:",
                extension
            );


            if (fileInfo) {

                fileInfo.innerHTML = `

                    <span class="file-label">
                        FILE SELECTED
                    </span>

                    <span class="file-name">
                        ${selectedGameFile.name}
                    </span>

                    <span class="file-size">
                        ${formatBytes(
                            selectedGameFile.size
                        )}
                    </span>

                `;

            }


            /*
             * We allow selection of XBE.
             */

            if (extension === "xbe") {

                setMessage(
                    "XBE executable selected."
                );

                if (startButton) {

                    startButton.disabled =
                        false;

                }

            } else {

                setMessage(
                    "Select an .XBE file."
                );

                if (startButton) {

                    startButton.disabled =
                        true;

                }

            }

        }
    );

}


/* ============================================================
   LOAD XBE
============================================================ */

async function loadXBE() {

    if (!selectedGameFile) {

        throw new Error(
            "No XBE supplied."
        );

    }


    if (
        getExtension(selectedGameFile) !==
        "xbe"
    ) {

        throw new Error(
            "Selected file is not an XBE."
        );

    }


    if (!emulatorCore) {

        throw new Error(
            "WebBktx Core is not initialized."
        );

    }


    console.log(
        "Loading XBE:",
        selectedGameFile.name
    );


    setMessage(
        "Loading XBE..."
    );


    /*
     * This is the ONLY place where
     * the File is passed to Core.
     */

    const result =
        await emulatorCore.loadGame(
            selectedGameFile
        );


    console.log(
        "XBE result:",
        result
    );


    if (!result) {

        throw new Error(
            "XBE loader returned no result."
        );

    }


    return result;

}


/* ============================================================
   START BUTTON
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

                const result =
                    await loadXBE();


                currentGame =
                    result;


                if (gameName) {

                    gameName.textContent =
                        selectedGameFile.name;

                }


                showScreen(
                    gameScreen
                );


                drawXBEStatus(
                    result
                );


                setMessage(
                    "XBE loaded successfully."
                );


            } catch (error) {

                console.error(
                    "XBE LOAD ERROR:",
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
   XBE DISPLAY
============================================================ */

function drawXBEStatus(result) {

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


    ctx.fillStyle =
        "#d7dedb";


    ctx.font =
        "bold 42px Arial";


    ctx.fillText(
        "WebBktx",
        canvas.width / 2,
        220
    );


    ctx.fillStyle =
        "#78a896";


    ctx.font =
        "bold 20px Arial";


    ctx.fillText(
        "XBE LOADED",
        canvas.width / 2,
        275
    );


    ctx.fillStyle =
        "#9aa5a1";


    ctx.font =
        "16px Arial";


    ctx.fillText(
        selectedGameFile.name,
        canvas.width / 2,
        320
    );


    ctx.fillText(
        "SIZE: " +
        formatBytes(
            selectedGameFile.size
        ),
        canvas.width / 2,
        350
    );


    /*
     * Entry point.
     */

    if (
        result.entryPoint !==
        undefined &&
        result.entryPoint !== null
    ) {

        ctx.fillStyle =
            "#c5ccc9";


        ctx.fillText(
            "ENTRY POINT: 0x" +
            Number(
                result.entryPoint
            )
                .toString(16)
                .toUpperCase(),
            canvas.width / 2,
            400
        );

    }


    ctx.fillStyle =
        "#68736f";


    ctx.font =
        "14px Arial";


    ctx.fillText(
        "XBE execution core under development",
        canvas.width / 2,
        455
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
        runCPUTest
    );

}


async function runCPUTest() {

    showScreen(cpuScreen);


    if (!cpuOutput) return;


    cpuOutput.textContent =
        "WebBktx CPU Diagnostics\n" +
        "========================\n\n";


    if (!emulatorCore) {

        cpuOutput.textContent +=
            "ERROR: CORE NOT INITIALIZED\n";

        return;

    }


    try {

        const diagnostics =
            emulatorCore.diagnostics();


        cpuOutput.textContent +=
            "CORE: " +
            diagnostics.core.version +
            "\n";


        cpuOutput.textContent +=
            "RAM: " +
            diagnostics.memory.sizeMB +
            " MB\n";


        cpuOutput.textContent +=
            "STATUS: ONLINE\n\n";


        cpuOutput.textContent +=
            "CPU STATE\n";


        cpuOutput.textContent +=
            "----------\n";


        const cpu =
            diagnostics.cpu;


        for (
            const key
            of Object.keys(cpu)
        ) {

            cpuOutput.textContent +=
                key +
                " = " +
                cpu[key] +
                "\n";

        }


        cpuOutput.textContent +=
            "\nDIAGNOSTICS COMPLETE.\n";

    } catch (error) {

        cpuOutput.textContent +=
            "\nERROR:\n" +
            error.message;

    }

}


/* ============================================================
   BACK BUTTONS
============================================================ */

const cpuBackButton =
    document.getElementById(
        "cpuBackButton"
    );

if (cpuBackButton) {

    cpuBackButton.onclick =
        () => showScreen(mainScreen);

}


const aboutButton =
    document.getElementById(
        "aboutButton"
    );

const aboutBackButton =
    document.getElementById(
        "aboutBackButton"
    );


if (aboutButton) {

    aboutButton.onclick =
        () => showScreen(aboutScreen);

}


if (aboutBackButton) {

    aboutBackButton.onclick =
        () => showScreen(mainScreen);

}


const backButton =
    document.getElementById(
        "backButton"
    );


if (backButton) {

    backButton.onclick =
        () => {

            if (
                emulatorCore &&
                typeof emulatorCore.stop ===
                "function"
            ) {

                emulatorCore.stop();

            }


            currentGame = null;

            showScreen(mainScreen);

        };

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
   DEBUG API
============================================================ */

window.WebBktxApp = {

    getCore() {

        return emulatorCore;

    },


    getGame() {

        return currentGame;

    },


    getFile() {

        return selectedGameFile;

    },


    diagnostics() {

        if (!emulatorCore) {

            return null;

        }

        return emulatorCore.diagnostics();

    }

};


/* ============================================================
   START
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        boot();

    }
);
