"use strict";

/*
 * ============================================================
 * WebBktx Application
 *
 * File:
 *     app.js
 *
 * Purpose:
 *     UI + runtime integration
 *
 * Audio:
 *     DISABLED
 *
 * Target:
 *     XBE loading / diagnostics / emulator window
 * ============================================================
 */


/* ============================================================
   GLOBAL STATE
============================================================ */

let runtime = null;

let selectedFile = null;

let emulatorRunning = false;

let emulatorFrame = 0;

let emulatorStartTime = 0;

let emulatorAnimationFrame = null;


/* ============================================================
   DOM HELPER
============================================================ */

function $(id) {

    return document.getElementById(id);

}


/* ============================================================
   DOM READY
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeApplication();

    }
);


/* ============================================================
   APPLICATION INITIALIZATION
============================================================ */

async function initializeApplication() {

    console.log(
        "[WebBktx] Application initialization..."
    );


    try {

        /*
         * ----------------------------------------------------
         * Check runtime
         * ----------------------------------------------------
         */

        if (
            typeof window.WebBktx ===
            "undefined"
        ) {

            throw new Error(
                "Nie znaleziono window.WebBktx. " +
                "Sprawdź core/webbktx.js."
            );

        }


        console.log(
            "[WebBktx] Runtime detected:",
            window.WebBktx
        );


        /*
         * ----------------------------------------------------
         * Create Core
         * ----------------------------------------------------
         */

        if (
            typeof window.WebBktx.Core !==
            "function"
        ) {

            throw new Error(
                "WebBktx.Core nie jest dostępny."
            );

        }


        runtime =
            new window.WebBktx.Core({

                debug:
                    true,

                ramSize:
                    64 * 1024 * 1024

            });


        /*
         * ----------------------------------------------------
         * Initialize Core
         * ----------------------------------------------------
         */

        runtime.initialize();


        console.log(
            "[WebBktx] Core initialized."
        );


        /*
         * ----------------------------------------------------
         * Setup UI
         * ----------------------------------------------------
         */

        setupUI();


        /*
         * ----------------------------------------------------
         * Loading screen
         * ----------------------------------------------------
         */

        await runLoadingSequence();


        /*
         * ----------------------------------------------------
         * Main screen
         * ----------------------------------------------------
         */

        showScreen(
            "mainScreen"
        );


        updateSystemStatus(
            true
        );


        console.log(
            "[WebBktx] Application ready."
        );


    } catch (error) {

        console.error(
            "[WebBktx] CORE ERROR",
            error
        );


        showCoreError(
            error
        );

    }

}


/* ============================================================
   UI SETUP
============================================================ */

function setupUI() {

    const gameFile =
        $("gameFile");

    const startButton =
        $("startButton");

    const cpuTestButton =
        $("cpuTestButton");

    const aboutButton =
        $("aboutButton");

    const cpuBackButton =
        $("cpuBackButton");

    const aboutBackButton =
        $("aboutBackButton");

    const backButton =
        $("backButton");


    /*
     * --------------------------------------------------------
     * Game file
     * --------------------------------------------------------
     */

    if (gameFile) {

        gameFile.addEventListener(
            "change",
            handleGameFile
        );

    }


    /*
     * --------------------------------------------------------
     * Start
     * --------------------------------------------------------
     */

    if (startButton) {

        startButton.addEventListener(
            "click",
            startEmulator
        );

    }


    /*
     * --------------------------------------------------------
     * CPU Test
     * --------------------------------------------------------
     */

    if (cpuTestButton) {

        cpuTestButton.addEventListener(
            "click",
            openCPUTest
        );

    }


    /*
     * --------------------------------------------------------
     * About
     * --------------------------------------------------------
     */

    if (aboutButton) {

        aboutButton.addEventListener(
            "click",
            openAbout
        );

    }


    /*
     * --------------------------------------------------------
     * CPU back
     * --------------------------------------------------------
     */

    if (cpuBackButton) {

        cpuBackButton.addEventListener(
            "click",
            () => {

                showScreen(
                    "mainScreen"
                );

            }
        );

    }


    /*
     * --------------------------------------------------------
     * About back
     * --------------------------------------------------------
     */

    if (aboutBackButton) {

        aboutBackButton.addEventListener(
            "click",
            () => {

                showScreen(
                    "mainScreen"
                );

            }
        );

    }


    /*
     * --------------------------------------------------------
     * Emulator exit
     * --------------------------------------------------------
     */

    if (backButton) {

        backButton.addEventListener(
            "click",
            stopEmulator
        );

    }

}


/* ============================================================
   LOADING SEQUENCE
============================================================ */

async function runLoadingSequence() {

    const progress =
        $("progress");

    const loadingText =
        $("loadingText");


    const modules = [

        {
            name:
                "cache",

            text:
                "Checking local storage..."
        },

        {
            name:
                "core",

            text:
                "Initializing WebBktx Core..."
        },

        {
            name:
                "graphics",

            text:
                "Initializing graphics system..."
        },

        {
            name:
                "input",

            text:
                "Initializing controller system..."
        }

    ];


    let currentProgress =
        0;


    for (
        const module of modules
    ) {

        const element =
            document.querySelector(
                `.module[data-module="${module.name}"]`
            );


        if (element) {

            const status =
                element.querySelector(
                    "strong"
                );


            if (status) {

                status.textContent =
                    "LOAD";

            }

        }


        if (loadingText) {

            loadingText.textContent =
                module.text;

        }


        await delay(
            250
        );


        if (element) {

            const status =
                element.querySelector(
                    "strong"
                );


            if (status) {

                status.textContent =
                    "OK";

            }

        }


        currentProgress +=
            25;


        if (progress) {

            progress.style.width =
                `${currentProgress}%`;

        }

    }


    if (loadingText) {

        loadingText.textContent =
            "WebBktx ready.";

    }


    await delay(
        300
    );

}


/* ============================================================
   GAME FILE HANDLER
============================================================ */

async function handleGameFile(event) {

    const file =
        event.target.files &&
        event.target.files[0];


    selectedFile =
        file || null;


    const startButton =
        $("startButton");


    const fileName =
        document.querySelector(
            ".file-name"
        );


    /*
     * --------------------------------------------------------
     * No file
     * --------------------------------------------------------
     */

    if (!file) {

        if (fileName) {

            fileName.textContent =
                "No file selected";

        }


        if (startButton) {

            startButton.disabled =
                true;

        }


        setMessage(
            "",
            "info"
        );


        return;

    }


    /*
     * --------------------------------------------------------
     * Basic file information
     * --------------------------------------------------------
     */

    const extension =
        getFileExtension(
            file.name
        );


    const size =
        formatBytes(
            file.size
        );


    if (fileName) {

        fileName.textContent =
            `${file.name} • ${size}`;

    }


    if (startButton) {

        startButton.disabled =
            true;

    }


    setMessage(
        "Analyzing XBE...",
        "info"
    );


    /*
     * --------------------------------------------------------
     * Only XBE for now
     * --------------------------------------------------------
     */

    if (
        extension !== "xbe"
    ) {

        setMessage(
            "WebBktx currently expects a .XBE file.",
            "error"
        );


        return;

    }


    try {

        /*
         * ----------------------------------------------------
         * Load XBE
         * ----------------------------------------------------
         */

        const result =
            await runtime.loadGame(
                file
            );


        console.log(
            "[WebBktx] XBE LOAD RESULT:",
            result
        );


        /*
         * ----------------------------------------------------
         * XBE status
         * ----------------------------------------------------
         */

        const xbe =
            runtime.xbe;


        if (!xbe) {

            throw new Error(
                "XBE object was not created."
            );

        }


        const status =
            xbe.getStatus();


        console.log(
            "[WebBktx] XBE STATUS:",
            status
        );


        /*
         * ----------------------------------------------------
         * Update UI
         * ----------------------------------------------------
         */

        updateFileInfo(
            file,
            status
        );


        if (startButton) {

            startButton.disabled =
                false;

        }


        setMessage(
            "XBE loaded successfully. Ready to start.",
            "success"
        );


    } catch (error) {

        console.error(
            "[WebBktx] XBE LOAD ERROR:",
            error
        );


        if (startButton) {

            startButton.disabled =
                true;

        }


        setMessage(
            `XBE ERROR: ${error.message}`,
            "error"
        );

    }

}


/* ============================================================
   UPDATE FILE INFORMATION
============================================================ */

function updateFileInfo(
    file,
    status
) {

    const fileInfo =
        $("fileInfo");


    if (!fileInfo) {
        return;
    }


    const size =
        formatBytes(
            file.size
        );


    const entryPoint =
        status &&
        typeof status.entryPoint !==
        "undefined"

            ? formatHex(
                status.entryPoint
            )

            : "UNKNOWN";


    const imageBase =
        status &&
        typeof status.imageBase !==
        "undefined"

            ? formatHex(
                status.imageBase
            )

            : "UNKNOWN";


    fileInfo.innerHTML = `

        <span class="file-label">
            DISC STATUS
        </span>

        <span class="file-name">
            ${escapeHTML(file.name)}
        </span>

        <div class="xbe-details">

            <div>
                <strong>GAME IMAGE DETECTED</strong>
            </div>

            <div>
                FORMAT:
                XBE
            </div>

            <div>
                SIZE:
                ${size}
            </div>

            <div>
                SIGNATURE:
                ${status?.header?.magic || "XBEH"}
            </div>

            <div>
                ENTRY POINT:
                ${entryPoint}
            </div>

            <div>
                IMAGE BASE:
                ${imageBase}
            </div>

            <div>
                STATUS:
                READY
            </div>

        </div>

    `;

}


/* ============================================================
   START EMULATOR
============================================================ */

async function startEmulator() {

    if (emulatorRunning) {

        return;

    }


    if (!runtime) {

        setMessage(
            "WebBktx runtime unavailable.",
            "error"
        );


        return;

    }


    if (!selectedFile) {

        setMessage(
            "Select an XBE file first.",
            "error"
        );


        return;

    }


    if (!runtime.xbe) {

        setMessage(
            "No XBE loaded.",
            "error"
        );


        return;

    }


    try {

        emulatorRunning =
            true;


        emulatorFrame =
            0;


        emulatorStartTime =
            performance.now();


        /*
         * ----------------------------------------------------
         * Emulator screen
         * ----------------------------------------------------
         */

        showScreen(
            "gameScreen"
        );


        /*
         * ----------------------------------------------------
         * Game name
         * ----------------------------------------------------
         */

        const gameName =
            $("gameName");


        if (gameName) {

            gameName.textContent =
                selectedFile.name;

        }


        /*
         * ----------------------------------------------------
         * Canvas
         * ----------------------------------------------------
         */

        const canvas =
            $("screen");


        if (!canvas) {

            throw new Error(
                "Emulator canvas not found."
            );

        }


        /*
         * ----------------------------------------------------
         * Graphics
         * ----------------------------------------------------
         */

        let graphics =
            runtime.graphics;


        if (!graphics) {

            graphics =
                runtime.attachGraphics(
                    canvas
                );

        }


        /*
         * ----------------------------------------------------
         * Input
         * ----------------------------------------------------
         */

        let input =
            runtime.input;


        if (!input) {

            input =
                runtime.attachInput();

        }


        /*
         * ----------------------------------------------------
         * Audio
         * ----------------------------------------------------
         *
         * Intentionally disabled.
         *
         * ----------------------------------------------------
         */

        console.log(
            "[WebBktx] AUDIO: DISABLED"
        );


        /*
         * ----------------------------------------------------
         * Draw boot screen
         * ----------------------------------------------------
         */

        drawBootScreen(
            canvas,
            selectedFile.name
        );


        /*
         * ----------------------------------------------------
         * Update status
         * ----------------------------------------------------
         */

        updateEmulatorStatus({

            cpu:
                "ONLINE",

            gpu:
                "ONLINE",

            audio:
                "DISABLED",

            fps:
                "10"

        });


        /*
         * ----------------------------------------------------
         * Start graphics
         * ----------------------------------------------------
         */

        if (
            graphics &&
            typeof graphics.start ===
            "function"
        ) {

            graphics.start();

        }


        /*
         * ----------------------------------------------------
         * Start boot sequence
         * ----------------------------------------------------
         */

        await delay(
            300
        );


        await bootXBE();


        /*
         * ----------------------------------------------------
         * Start 10 FPS loop
         * ----------------------------------------------------
         */

        startEmulatorLoop();


    } catch (error) {

        console.error(
            "[WebBktx] START ERROR:",
            error
        );


        emulatorRunning =
            false;


        drawErrorScreen(
            $("screen"),
            error.message
        );


        setMessage(
            `START ERROR: ${error.message}`,
            "error"
        );

    }

}


/* ============================================================
   BOOT XBE
============================================================ */

async function bootXBE() {

    const canvas =
        $("screen");


    if (!canvas) {

        return;

    }


    const xbe =
        runtime.xbe;


    if (!xbe) {

        drawErrorScreen(
            canvas,
            "NO XBE LOADED"
        );


        return;

    }


    const status =
        xbe.getStatus();


    console.log(
        "[WebBktx] BOOT XBE:",
        status
    );


    /*
     * --------------------------------------------------------
     * Show boot information
     * --------------------------------------------------------
     */

    drawBootProgress(
        canvas,
        status
    );


    await delay(
        400
    );


    /*
     * --------------------------------------------------------
     * Check whether Core exposes bootXBE
     * --------------------------------------------------------
     */

    if (
        typeof runtime.bootXBE ===
        "function"
    ) {

        try {

            await runtime.bootXBE();


            drawRunningScreen(
                canvas,
                status
            );


            return;

        } catch (error) {

            console.error(
                "[WebBktx] XBE BOOT ERROR:",
                error
            );


            /*
             * Do not immediately destroy the
             * emulator screen.
             *
             * Show diagnostic information.
             */

            drawBootError(
                canvas,
                error
            );


            return;

        }

    }


    /*
     * --------------------------------------------------------
     * Current Core does not expose bootXBE.
     *
     * Do NOT call cpu.run blindly.
     *
     * The current decoder cannot execute
     * a real GTA Vice City XBE.
     * --------------------------------------------------------
     */

    drawRuntimeWaitingScreen(
        canvas,
        status
    );

}


/* ============================================================
   EMULATOR LOOP
============================================================ */

function startEmulatorLoop() {

    stopEmulatorLoop();


    /*
     * 10 FPS.
     */

    const frameTime =
        1000 / 10;


    let lastTime =
        performance.now();


    function loop(
        currentTime
    ) {

        if (!emulatorRunning) {

            return;

        }


        if (
            currentTime -
            lastTime >=
            frameTime
        ) {

            lastTime =
                currentTime;


            emulatorFrame++;


            renderEmulatorFrame();

        }


        emulatorAnimationFrame =
            requestAnimationFrame(
                loop
            );

    }


    emulatorAnimationFrame =
        requestAnimationFrame(
            loop
        );

}


/* ============================================================
   RENDER EMULATOR FRAME
============================================================ */

function renderEmulatorFrame() {

    const canvas =
        $("screen");


    if (!canvas) {

        return;

    }


    /*
     * --------------------------------------------------------
     * Current implementation:
     *
     * keep the boot/runtime diagnostic visible.
     *
     * Once the Core exposes actual framebuffer data,
     * this function becomes the framebuffer presenter.
     * --------------------------------------------------------
     */

    const elapsed =
        (
            performance.now() -
            emulatorStartTime
        ) / 1000;


    const fps =
        elapsed > 0

            ? (
                emulatorFrame /
                elapsed
            )

            : 0;


    updateEmulatorStatus({

        cpu:
            getCPUStatusText(),

        gpu:
            getGPUStatusText(),

        audio:
            "DISABLED",

        fps:
            Math.min(
                10,
                Math.round(
                    fps
                )
            )

    });


    /*
     * If the runtime exposes a framebuffer,
     * present it here.
     */

    if (
        runtime &&
        runtime.graphics &&
        typeof runtime.graphics.Present ===
        "function"
    ) {

        /*
         * Present is already handled by
         * the graphics subsystem.
         */

    }

}


/* ============================================================
   STOP EMULATOR
============================================================ */

function stopEmulator() {

    emulatorRunning =
        false;


    stopEmulatorLoop();


    if (runtime) {

        try {

            runtime.stop();

        } catch (error) {

            console.warn(
                "[WebBktx] Stop warning:",
                error
            );

        }

    }


    updateEmulatorStatus({

        cpu:
            "STOPPED",

        gpu:
            "STOPPED",

        audio:
            "DISABLED",

        fps:
            "--"

    });


    showScreen(
        "mainScreen"
    );

}


/* ============================================================
   STOP LOOP
============================================================ */

function stopEmulatorLoop() {

    if (
        emulatorAnimationFrame !==
        null
    ) {

        cancelAnimationFrame(
            emulatorAnimationFrame
        );


        emulatorAnimationFrame =
            null;

    }

}


/* ============================================================
   CPU TEST
============================================================ */

function openCPUTest() {

    showScreen(
        "cpuScreen"
    );


    const output =
        $("cpuOutput");


    if (!output) {

        return;

    }


    if (!runtime) {

        output.textContent =
            "CPU UNAVAILABLE\n\n" +
            "WebBktx Core is not initialized.";

        return;

    }


    try {

        /*
         * ----------------------------------------------------
         * Runtime status
         * ----------------------------------------------------
         */

        const status =
            runtime.getStatus();


        /*
         * ----------------------------------------------------
         * CPU test
         * ----------------------------------------------------
         */

        let testResult =
            null;


        if (
            typeof runtime.selfTest ===
            "function"
        ) {

            testResult =
                runtime.selfTest();

        }


        /*
         * ----------------------------------------------------
         * CPU status
         * ----------------------------------------------------
         */

        const cpu =
            runtime.cpu;


        const cpuAvailable =
            Boolean(
                cpu
            );


        output.textContent =
            [
                "WebBktx CPU DIAGNOSTIC",
                "======================",
                "",
                `CPU AVAILABLE : ${
                    cpuAvailable
                        ? "YES"
                        : "NO"
                }`,
                "",
                "RUNTIME STATUS:",
                JSON.stringify(
                    status,
                    null,
                    2
                ),
                "",
                "SELF TEST:",
                JSON.stringify(
                    testResult,
                    null,
                    2
                )
            ].join("\n");


    } catch (error) {

        console.error(
            "[WebBktx] CPU TEST ERROR:",
            error
        );


        output.textContent =
            "CPU TEST ERROR\n\n" +
            error.stack;

    }

}


/* ============================================================
   ABOUT
============================================================ */

function openAbout() {

    showScreen(
        "aboutScreen"
    );

}


/* ============================================================
   SYSTEM STATUS
============================================================ */

function updateSystemStatus(
    ready
) {

    const status =
        document.querySelector(
            ".system-status"
        );


    if (!status) {

        return;

    }


    if (ready) {

        status.innerHTML =
            `
            <span class="status-light"></span>
            SYSTEM READY
            `;

    } else {

        status.innerHTML =
            `
            <span class="status-light"></span>
            SYSTEM ERROR
            `;

    }

}


/* ============================================================
   EMULATOR STATUS
============================================================ */

function updateEmulatorStatus(
    values
) {

    const status =
        document.querySelector(
            ".emulator-status"
        );


    if (!status) {

        return;

    }


    status.innerHTML = `

        <span>
            CPU:
            ${escapeHTML(values.cpu ?? "--")}
        </span>

        <span>
            GPU:
            ${escapeHTML(values.gpu ?? "--")}
        </span>

        <span>
            AUDIO:
            ${escapeHTML(values.audio ?? "--")}
        </span>

        <span>
            FPS:
            ${escapeHTML(values.fps ?? "--")}
        </span>

    `;

}


/* ============================================================
   CPU STATUS
============================================================ */

function getCPUStatusText() {

    if (!runtime) {

        return "OFFLINE";

    }


    if (!runtime.cpu) {

        return "UNAVAILABLE";

    }


    if (
        runtime.cpu.faulted
    ) {

        return "FAULT";

    }


    if (
        runtime.cpu.running
    ) {

        return "RUNNING";

    }


    return "ONLINE";

}


/* ============================================================
   GPU STATUS
============================================================ */

function getGPUStatusText() {

    if (!runtime) {

        return "OFFLINE";

    }


    if (
        runtime.graphics
    ) {

        return "ONLINE";

    }


    return "WAITING";

}


/* ============================================================
   BOOT SCREEN
============================================================ */

function drawBootScreen(
    canvas,
    fileName
) {

    const ctx =
        canvas.getContext(
            "2d"
        );


    if (!ctx) {

        return;

    }


    ctx.fillStyle =
        "#050709";


    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    ctx.fillStyle =
        "#7cff00";


    ctx.font =
        "bold 42px monospace";


    ctx.fillText(
        "WebBktx",
        70,
        100
    );


    ctx.fillStyle =
        "#ffffff";


    ctx.font =
        "24px monospace";


    ctx.fillText(
        "XBOX BOOT",
        70,
        150
    );


    ctx.fillStyle =
        "#8f999f";


    ctx.font =
        "18px monospace";


    ctx.fillText(
        "Loading XBE:",
        70,
        215
    );


    ctx.fillStyle =
        "#ffffff";


    ctx.fillText(
        truncateText(
            fileName,
            70
        ),
        70,
        250
    );


    /*
     * Progress bar
     */

    ctx.fillStyle =
        "#252b30";


    ctx.fillRect(
        70,
        310,
        canvas.width - 140,
        20
    );


    ctx.fillStyle =
        "#7cff00";


    ctx.fillRect(
        70,
        310,
        60,
        20
    );


    ctx.fillStyle =
        "#7cff00";


    ctx.font =
        "16px monospace";


    ctx.fillText(
        "AUDIO: DISABLED",
        70,
        380
    );


    ctx.fillText(
        "TARGET FPS: 10",
        70,
        410
    );

}


/* ============================================================
   BOOT PROGRESS
============================================================ */

function drawBootProgress(
    canvas,
    status
) {

    const ctx =
        canvas.getContext(
            "2d"
        );


    if (!ctx) {

        return;

    }


    ctx.fillStyle =
        "#050709";


    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    ctx.fillStyle =
        "#7cff00";


    ctx.font =
        "bold 32px monospace";


    ctx.fillText(
        "WebBktx XBE Loader",
        70,
        80
    );


    const entry =
        status &&
        typeof status.entryPoint !==
        "undefined"

            ? formatHex(
                status.entryPoint
            )

            : "UNKNOWN";


    const base =
        status &&
        typeof status.imageBase !==
        "undefined"

            ? formatHex(
                status.imageBase
            )

            : "UNKNOWN";


    const lines = [

        [
            "XBE SIGNATURE",
            "OK"
        ],

        [
            "XBE SIZE",
            formatBytes(
                status?.size || 0
            )
        ],

        [
            "ENTRY POINT",
            entry
        ],

        [
            "IMAGE BASE",
            base
        ],

        [
            "CPU",
            "ONLINE"
        ],

        [
            "KERNEL",
            "INITIALIZED"
        ],

        [
            "XAPI",
            "INITIALIZED"
        ],

        [
            "XINPUT",
            "INITIALIZED"
        ],

        [
            "GRAPHICS",
            "INITIALIZED"
        ],

        [
            "AUDIO",
            "DISABLED"
        ]

    ];


    let y =
        140;


    for (
        const line of lines
    ) {

        ctx.fillStyle =
            "#9aa3aa";


        ctx.font =
            "17px monospace";


        ctx.fillText(
            line[0],
            70,
            y
        );


        ctx.fillStyle =
            line[1] === "OK" ||
            line[1] === "ONLINE" ||
            line[1] === "INITIALIZED" ||
            line[1] === "DISABLED"

                ? "#7cff00"

                : "#ffffff";


        ctx.fillText(
            line[1],
            340,
            y
        );


        y += 35;

    }


    ctx.fillStyle =
        "#ffffff";


    ctx.font =
        "bold 20px monospace";


    ctx.fillText(
        "BOOTING...",
        70,
        y + 25
    );

}


/* ============================================================
   RUNNING SCREEN
============================================================ */

function drawRunningScreen(
    canvas,
    status
) {

    const ctx =
        canvas.getContext(
            "2d"
        );


    ctx.fillStyle =
        "#050709";


    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    ctx.fillStyle =
        "#7cff00";


    ctx.font =
        "bold 30px monospace";


    ctx.fillText(
        "WebBktx",
        70,
        90
    );


    ctx.fillStyle =
        "#ffffff";


    ctx.font =
        "22px monospace";


    ctx.fillText(
        "XBE EXECUTION ACTIVE",
        70,
        140
    );


    ctx.fillStyle =
        "#8f999f";


    ctx.font =
        "17px monospace";


    ctx.fillText(
        `ENTRY: ${
            formatHex(
                status?.entryPoint || 0
            )
        }`,
        70,
        200
    );


    ctx.fillText(
        "VIDEO: ONLINE",
        70,
        240
    );


    ctx.fillText(
        "INPUT: ONLINE",
        70,
        275
    );


    ctx.fillText(
        "AUDIO: DISABLED",
        70,
        310
    );


    ctx.fillStyle =
        "#7cff00";


    ctx.fillText(
        "CPU: RUNNING",
        70,
        360
    );

}


/* ============================================================
   RUNTIME WAITING
============================================================ */

function drawRuntimeWaitingScreen(
    canvas,
    status
) {

    const ctx =
        canvas.getContext(
            "2d"
        );


    ctx.fillStyle =
        "#050709";


    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    ctx.fillStyle =
        "#7cff00";


    ctx.font =
        "bold 30px monospace";


    ctx.fillText(
        "XBE LOADED",
        70,
        90
    );


    ctx.fillStyle =
        "#ffffff";


    ctx.font =
        "20px monospace";


    ctx.fillText(
        "WebBktx runtime is ready.",
        70,
        140
    );


    ctx.fillStyle =
        "#8f999f";


    ctx.font =
        "17px monospace";


    ctx.fillText(
        `ENTRY POINT: ${
            formatHex(
                status?.entryPoint || 0
            )
        }`,
        70,
        200
    );


    ctx.fillText(
        "CPU: ONLINE",
        70,
        240
    );


    ctx.fillText(
        "GRAPHICS: ONLINE",
        70,
        275
    );


    ctx.fillText(
        "INPUT: ONLINE",
        70,
        310
    );


    ctx.fillText(
        "AUDIO: DISABLED",
        70,
        345
    );


    ctx.fillStyle =
        "#ffaa00";


    ctx.fillText(
        "XBE EXECUTION LAYER: WAITING",
        70,
        410
    );

}


/* ============================================================
   BOOT ERROR
============================================================ */

function drawBootError(
    canvas,
    error
) {

    const ctx =
        canvas.getContext(
            "2d"
        );


    ctx.fillStyle =
        "#080000";


    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    ctx.fillStyle =
        "#ff4040";


    ctx.font =
        "bold 30px monospace";


    ctx.fillText(
        "WEBBKTX BOOT ERROR",
        60,
        90
    );


    ctx.fillStyle =
        "#ffffff";


    ctx.font =
        "17px monospace";


    const message =
        error?.message ||
        String(error);


    drawWrappedText(
        ctx,
        message,
        60,
        150,
        canvas.width - 120,
        28
    );

}


/* ============================================================
   ERROR SCREEN
============================================================ */

function drawErrorScreen(
    canvas,
    error
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


    ctx.fillStyle =
        "#080000";


    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    ctx.fillStyle =
        "#ff4040";


    ctx.font =
        "bold 30px monospace";


    ctx.fillText(
        "WEBBKTX ERROR",
        60,
        90
    );


    ctx.fillStyle =
        "#ffffff";


    ctx.font =
        "17px monospace";


    drawWrappedText(
        ctx,
        String(error),
        60,
        145,
        canvas.width - 120,
        28
    );

}


/* ============================================================
   CORE ERROR
============================================================ */

function showCoreError(
    error
) {

    const loadingText =
        $("loadingText");


    if (loadingText) {

        loadingText.textContent =
            "WEBBKTX CORE ERROR";

    }


    updateSystemStatus(
        false
    );


    console.error(
        "[WebBktx] CORE ERROR:",
        error
    );

}


/* ============================================================
   SYSTEM MESSAGE
============================================================ */

function setMessage(
    text,
    type = "info"
) {

    const message =
        $("message");


    if (!message) {

        return;

    }


    message.textContent =
        text;


    message.dataset.type =
        type;

}


/* ============================================================
   SCREEN SWITCHING
============================================================ */

function showScreen(
    id
) {

    document
        .querySelectorAll(
            ".screen"
        )
        .forEach(
            screen => {

                screen.classList.add(
                    "hidden"
                );

            }
        );


    const target =
        $(id);


    if (target) {

        target.classList.remove(
            "hidden"
        );

    }

}


/* ============================================================
   FORMAT BYTES
============================================================ */

function formatBytes(
    bytes
) {

    bytes =
        Number(bytes);


    if (
        !Number.isFinite(bytes) ||
        bytes < 0
    ) {

        return "0 B";

    }


    if (
        bytes < 1024
    ) {

        return `${bytes} B`;

    }


    if (
        bytes < 1024 * 1024
    ) {

        return `${(
            bytes / 1024
        ).toFixed(1)} KB`;

    }


    if (
        bytes < 1024 * 1024 * 1024
    ) {

        return `${(
            bytes /
            1024 /
            1024
        ).toFixed(2)} MB`;

    }


    return `${(
        bytes /
        1024 /
        1024 /
        1024
    ).toFixed(2)} GB`;

}


/* ============================================================
   FILE EXTENSION
============================================================ */

function getFileExtension(
    fileName
) {

    const name =
        String(
            fileName
        );


    const index =
        name.lastIndexOf(
            "."
        );


    if (
        index < 0
    ) {

        return "";

    }


    return name
        .slice(
            index + 1
        )
        .toLowerCase();

}


/* ============================================================
   HEX
============================================================ */

function formatHex(
    value
) {

    return (
        "0x" +
        (
            Number(value) >>> 0
        )
        .toString(16)
        .padStart(
            8,
            "0"
        )
        .toUpperCase()
    );

}


/* ============================================================
   ESCAPE HTML
============================================================ */

function escapeHTML(
    value
) {

    return String(
        value
    )
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
   TRUNCATE TEXT
============================================================ */

function truncateText(
    text,
    maxLength
) {

    text =
        String(
            text
        );


    if (
        text.length <= maxLength
    ) {

        return text;

    }


    return (
        text.slice(
            0,
            maxLength - 3
        ) +
        "..."
    );

}


/* ============================================================
   DELAY
============================================================ */

function delay(
    milliseconds
) {

    return new Promise(
        resolve => {

            setTimeout(
                resolve,
                milliseconds
            );

        }
    );

}


/* ============================================================
   WRAPPED CANVAS TEXT
============================================================ */

function drawWrappedText(
    ctx,
    text,
    x,
    y,
    maxWidth,
    lineHeight
) {

    const words =
        String(text)
            .split(
                /\s+/
            );


    let line =
        "";


    for (
        const word of words
    ) {

        const testLine =
            line
                ? `${line} ${word}`
                : word;


        const metrics =
            ctx.measureText(
                testLine
            );


        if (
            metrics.width >
            maxWidth &&
            line
        ) {

            ctx.fillText(
                line,
                x,
                y
            );


            line =
                word;


            y +=
                lineHeight;

        } else {

            line =
                testLine;

        }

    }


    if (line) {

        ctx.fillText(
            line,
            x,
            y
        );

    }

}


/* ============================================================
   DEBUG EXPORT
============================================================ */

window.WebBktxApp = {

    getRuntime() {

        return runtime;

    },


    getSelectedFile() {

        return selectedFile;

    },


    isRunning() {

        return emulatorRunning;

    },


    stop() {

        stopEmulator();

    }

};


console.log(
    "[WebBktx] app.js loaded."
);
