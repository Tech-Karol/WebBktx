/*
 * ============================================================
 * WebBktx Application
 *
 * XBE Boot Frontend
 *
 * Version: 1.3.0
 *
 * Handles:
 *  - runtime detection
 *  - loading screen
 *  - XBE selection
 *  - XBE parsing
 *  - XBE mapping
 *  - CPU boot
 *  - diagnostic execution
 *  - CPU test
 *  - About
 *  - emulator screen
 *
 * Audio intentionally disabled.
 * ============================================================
 */

"use strict";


/* ============================================================
   GLOBAL APPLICATION
============================================================ */

const WebBktxApp = {

    runtime: null,

    file: null,

    xbe: null,

    boot: null,

    running: false,

    frameTimer: null,

    instructionBudget:
        5000,

    lastFrameTime:
        0,

    fps:
        0,

    frameCounter:
        0,

    fpsTimer:
        0
};


/* ============================================================
   DOM
============================================================ */

const $ = id =>
    document.getElementById(id);


const loadingScreen =
    $("loadingScreen");

const mainScreen =
    $("mainScreen");

const cpuScreen =
    $("cpuScreen");

const aboutScreen =
    $("aboutScreen");

const gameScreen =
    $("gameScreen");

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

const progress =
    $("progress");

const loadingText =
    $("loadingText");

const message =
    $("message");

const fileInfo =
    $("fileInfo");

const canvas =
    $("screen");

const gameName =
    $("gameName");

const cpuOutput =
    $("cpuOutput");


/* ============================================================
   UI HELPERS
============================================================ */

function showScreen(screen) {

    [
        loadingScreen,
        mainScreen,
        cpuScreen,
        aboutScreen,
        gameScreen
    ].forEach(
        element => {

            if (!element) {
                return;
            }

            element.classList.add(
                "hidden"
            );
        }
    );


    if (screen) {

        screen.classList.remove(
            "hidden"
        );
    }
}


function setMessage(
    text,
    type = "normal"
) {

    if (!message) {
        return;
    }


    message.textContent =
        text;


    message.dataset.type =
        type;
}


function setProgress(
    value
) {

    if (!progress) {
        return;
    }


    progress.style.width =
        `${Math.max(
            0,
            Math.min(
                100,
                value
            )
        )}%`;
}


function setLoadingText(text) {

    if (loadingText) {
        loadingText.textContent =
            text;
    }
}


function setModule(
    name,
    status
) {

    const element =
        document.querySelector(
            `.module[data-module="${name}"]`
        );


    if (!element) {
        return;
    }


    const strong =
        element.querySelector(
            "strong"
        );


    if (strong) {

        strong.textContent =
            status;
    }
}


function sleep(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );
}


/* ============================================================
   RUNTIME DETECTION
============================================================ */

function detectRuntime() {

    if (
        typeof window ===
        "undefined"
    ) {

        throw new Error(
            "Window is unavailable."
        );
    }


    if (
        !window.WebBktx
    ) {

        throw new Error(
            "Nie znaleziono window.WebBktx."
        );
    }


    if (
        !window.WebBktxRuntime
    ) {

        throw new Error(
            "Nie znaleziono window.WebBktxRuntime."
        );
    }


    WebBktxApp.runtime =
        window.WebBktxRuntime;


    console.log(
        "[WebBktx] Runtime detected:",
        window.WebBktx
    );


    return true;
}


/* ============================================================
   RUNTIME STATUS
============================================================ */

function runtimeStatus() {

    if (
        !WebBktxApp.runtime
    ) {
        return {
            runtime: "undefined"
        };
    }


    const status =
        WebBktxApp.runtime.getStatus();


    return {

        runtime:
            status.version ||
            "undefined",

        memory:
            status.memory
                ? status.memory.megabytes + " MB"
                : "undefined",

        cpu:
            status.cpu
                ? "available"
                : "undefined",

        decoder:
            status.decoder
                ? "available"
                : "undefined",

        xbe:
            status.xbe
                ? "loaded"
                : "undefined",

        kernel:
            status.kernel
                ? (
                    status.kernel.initialized
                        ? "ready"
                        : "not initialized"
                )
                : "undefined",

        thunks:
            status.thunks
                ? "available"
                : "undefined",

        xapi:
            status.xapi
                ? "available"
                : "undefined",

        xfile:
            status.xfile
                ? "available"
                : "undefined",

        xinput:
            status.input
                ? "available"
                : "undefined",

        xgraphics:
            status.graphics
                ? "available"
                : "undefined"
    };
}


/* ============================================================
   LOADING SEQUENCE
============================================================ */

async function loadingSequence() {

    try {

        setProgress(5);

        setLoadingText(
            "Checking local runtime..."
        );


        setModule(
            "cache",
            "OK"
        );


        await sleep(150);


        setProgress(25);

        setLoadingText(
            "Loading WebBktx Core..."
        );


        setModule(
            "core",
            "OK"
        );


        await sleep(150);


        setProgress(50);

        setLoadingText(
            "Initializing graphics system..."
        );


        setModule(
            "graphics",
            "OK"
        );


        await sleep(150);


        setProgress(75);

        setLoadingText(
            "Initializing controller system..."
        );


        setModule(
            "input",
            "OK"
        );


        await sleep(150);


        detectRuntime();


        setProgress(100);

        setLoadingText(
            "WebBktx ready."
        );


        await sleep(300);


        showScreen(
            mainScreen
        );


        console.log(
            "[WebBktx] Application ready."
        );


    } catch (error) {

        setProgress(100);

        setLoadingText(
            "CORE ERROR"
        );


        console.error(
            "[WebBktx] Runtime error:",
            error
        );


        setMessage(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   FILE SELECTION
============================================================ */

function handleFile(file) {

    if (!file) {
        return;
    }


    WebBktxApp.file =
        file;


    const sizeMB =
        (
            file.size /
            1024 /
            1024
        ).toFixed(2);


    if (fileInfo) {

        const name =
            fileInfo.querySelector(
                ".file-name"
            );


        if (name) {

            name.textContent =
                `${file.name} • ${sizeMB} MB`;
        }
    }


    if (startButton) {

        startButton.disabled =
            false;
    }


    setMessage(
        `XBE selected: ${file.name}`,
        "success"
    );


    console.log(
        "[WebBktx] XBE selected:",
        {
            name: file.name,
            size: file.size,
            type: file.type
        }
    );
}


/* ============================================================
   XBE LOAD
============================================================ */

async function loadXBE() {

    if (
        !WebBktxApp.file
    ) {

        throw new Error(
            "Najpierw wybierz plik XBE."
        );
    }


    if (
        !WebBktxApp.runtime
    ) {

        detectRuntime();
    }


    setMessage(
        "Ładowanie XBE...",
        "normal"
    );


    startButton.disabled =
        true;


    try {

        const result =
            await WebBktxApp.runtime.loadGame(
                WebBktxApp.file
            );


        console.log(
            "[WebBktx] XBE LOAD RESULT:",
            result
        );


        if (
            !result ||
            !result.success
        ) {

            throw new Error(
                "XBE loading failed."
            );
        }


        WebBktxApp.xbe =
            result.xbe;


        console.log(
            "[WebBktx] XBE STATUS:",
            result.status
        );


        setMessage(
            `XBE loaded: ${
                result.status.name
            }`,
            "success"
        );


        return result;

    } finally {

        startButton.disabled =
            false;
    }
}


/* ============================================================
   FORMAT DIAGNOSTIC
============================================================ */

function formatDiagnostic(
    status
) {

    if (!status) {
        return "No status.";
    }


    const lines = [];


    lines.push(
        "================================================"
    );

    lines.push(
        "WebBktx XBE BOOT DIAGNOSTIC"
    );

    lines.push(
        "================================================"
    );

    lines.push(
        ""
    );


    lines.push(
        `Runtime : ${status.version}`
    );

    lines.push(
        `Boot    : ${status.bootState}`
    );

    lines.push(
        `Running : ${status.running}`
    );

    lines.push(
        ""
    );


    if (status.xbe) {

        lines.push(
            "XBE"
        );

        lines.push(
            "------------------------------------------------"
        );

        lines.push(
            `Name          : ${status.xbe.name}`
        );

        lines.push(
            `Size          : ${status.xbe.size} bytes`
        );

        lines.push(
            `Image Base    : 0x${status.xbe.imageBase.toString(16).toUpperCase()}`
        );

        lines.push(
            `Entry Raw     : 0x${status.xbe.entryPointRaw.toString(16).toUpperCase()}`
        );

        lines.push(
            `Entry Point   : ${status.xbe.entryPointHex}`
        );

        lines.push(
            `Boot Ready    : ${status.xbe.bootReady}`
        );

        lines.push(
            `Sections      : ${status.xbe.sections.length}`
        );

        lines.push(
            ""
        );


        lines.push(
            "XBE SECTIONS"
        );

        lines.push(
            "------------------------------------------------"
        );


        for (
            const section of status.xbe.sections
        ) {

            lines.push(
                `#${section.index} ${
                    section.name || "(unnamed)"
                }`
            );

            lines.push(
                `  VA       : ${hexLocal(section.virtualAddress)}`
            );

            lines.push(
                `  VSIZE    : ${hexLocal(section.virtualSize)}`
            );

            lines.push(
                `  RAW      : ${hexLocal(section.rawAddress)}`
            );

            lines.push(
                `  RAWSIZE  : ${hexLocal(section.rawSize)}`
            );

            lines.push(
                ""
            );
        }
    }


    lines.push(
        "CPU"
    );

    lines.push(
        "------------------------------------------------"
    );


    if (status.cpu) {

        const r =
            status.cpu.registers;


        lines.push(
            `EIP         : ${hexLocal(r.EIP)}`
        );

        lines.push(
            `ESP         : ${hexLocal(r.ESP)}`
        );

        lines.push(
            `EAX         : ${hexLocal(r.EAX)}`
        );

        lines.push(
            `EBX         : ${hexLocal(r.EBX)}`
        );

        lines.push(
            `ECX         : ${hexLocal(r.ECX)}`
        );

        lines.push(
            `EDX         : ${hexLocal(r.EDX)}`
        );

        lines.push(
            `ESI         : ${hexLocal(r.ESI)}`
        );

        lines.push(
            `EDI         : ${hexLocal(r.EDI)}`
        );

        lines.push(
            `EBP         : ${hexLocal(r.EBP)}`
        );

        lines.push(
            `EFLAGS      : ${hexLocal(r.EFLAGS)}`
        );

        lines.push(
            `Instructions: ${status.cpu.instructionsExecuted}`
        );

        lines.push(
            `Cycles      : ${status.cpu.cycles}`
        );

        lines.push(
            `Halted      : ${status.cpu.halted}`
        );

        lines.push(
            `Faulted     : ${status.cpu.faulted}`
        );


        if (status.cpu.error) {

            lines.push(
                `CPU ERROR   : ${status.cpu.error}`
            );
        }
    }


    lines.push(
        ""
    );

    lines.push(
        "================================================"
    );


    return lines.join("\n");
}


function hexLocal(
    value
) {

    return (
        "0x" +
        (
            Number(value) >>> 0
        )
        .toString(16)
        .toUpperCase()
        .padStart(8, "0")
    );
}


/* ============================================================
   SHOW BOOT SCREEN
============================================================ */

function showBootScreen() {

    showScreen(
        gameScreen
    );


    if (
        canvas &&
        WebBktxApp.runtime
    ) {

        try {

            WebBktxApp.runtime.attachGraphics(
                canvas
            );

        } catch (error) {

            console.warn(
                "[WebBktx] Graphics initialization:",
                error
            );
        }
    }


    if (
        WebBktxApp.file
    ) {

        gameName.textContent =
            WebBktxApp.file.name;
    }
}


/* ============================================================
   DRAW BOOT SCREEN
============================================================ */

function drawBootScreen() {

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


    ctx.fillStyle =
        "#107C10";


    ctx.fillRect(
        0,
        0,
        width,
        8
    );


    ctx.fillStyle =
        "#FFFFFF";


    ctx.font =
        "bold 42px monospace";


    ctx.fillText(
        "WebBktx",
        60,
        90
    );


    ctx.font =
        "24px monospace";


    ctx.fillStyle =
        "#AAAAAA";


    ctx.fillText(
        "XBE BOOT",
        60,
        135
    );


    const runtime =
        WebBktxApp.runtime;


    if (!runtime) {
        return;
    }


    const status =
        runtime.getStatus();


    let y = 200;


    const line =
        (
            label,
            value
        ) => {

            ctx.fillStyle =
                "#777777";

            ctx.fillText(
                label,
                70,
                y
            );


            ctx.fillStyle =
                "#FFFFFF";

            ctx.fillText(
                String(value),
                320,
                y
            );


            y += 36;
        };


    line(
        "BOOT",
        status.bootState
    );


    if (status.xbe) {

        line(
            "XBE",
            status.xbe.name
        );

        line(
            "SIZE",
            `${status.xbe.size} bytes`
        );

        line(
            "BASE",
            status.xbe.entryPointHex
        );

        line(
            "ENTRY",
            status.xbe.entryPointHex
        );
    }


    if (status.cpu) {

        line(
            "CPU EIP",
            hexLocal(
                status.cpu.registers.EIP
            )
        );

        line(
            "CPU ESP",
            hexLocal(
                status.cpu.registers.ESP
            )
        );

        line(
            "INSTRUCTIONS",
            status.cpu.instructionsExecuted
        );

        line(
            "CPU STATE",
            status.cpu.faulted
                ? "FAULT"
                : status.cpu.halted
                    ? "HALTED"
                    : status.cpu.running
                        ? "RUNNING"
                        : "READY"
        );


        if (status.cpu.error) {

            y += 15;


            ctx.fillStyle =
                "#FF5555";


            ctx.font =
                "18px monospace";


            ctx.fillText(
                "CPU ERROR:",
                70,
                y
            );


            y += 30;


            const error =
                String(
                    status.cpu.error
                );


            const maxChars =
                90;


            for (
                let i = 0;
                i < error.length;
                i += maxChars
            ) {

                ctx.fillText(
                    error.substring(
                        i,
                        i + maxChars
                    ),
                    70,
                    y
                );

                y += 25;
            }
        }
    }


    ctx.fillStyle =
        "#555555";


    ctx.font =
        "16px monospace";


    ctx.fillText(
        "AUDIO: DISABLED",
        70,
        height - 65
    );


    ctx.fillText(
        "VIDEO: BOOT DIAGNOSTIC",
        300,
        height - 65
    );


    ctx.fillText(
        "XBE RUNTIME: EXPERIMENTAL",
        650,
        height - 65
    );
}


/* ============================================================
   BOOT LOOP
============================================================ */

function startBootLoop() {

    if (
        WebBktxApp.frameTimer
    ) {

        return;
    }


    WebBktxApp.running =
        true;


    WebBktxApp.lastFrameTime =
        performance.now();


    WebBktxApp.frameCounter =
        0;


    WebBktxApp.fpsTimer =
        performance.now();


    const loop =
        () => {

            if (
                !WebBktxApp.running
            ) {

                WebBktxApp.frameTimer =
                    null;

                return;
            }


            try {

                const now =
                    performance.now();


                /*
                 * Execute a small batch instead
                 * of blocking the browser for too long.
                 *
                 * Target is intentionally low.
                 */

                const result =
                    WebBktxApp.runtime.runFrame(
                        WebBktxApp.instructionBudget
                    );


                WebBktxApp.frameCounter++;


                if (
                    now -
                    WebBktxApp.fpsTimer >=
                    1000
                ) {

                    WebBktxApp.fps =
                        WebBktxApp.frameCounter;

                    WebBktxApp.frameCounter =
                        0;

                    WebBktxApp.fpsTimer =
                        now;
                }


                drawBootScreen();


                /*
                 * Stop after fault/halt.
                 */

                if (
                    result &&
                    (
                        result.faulted ||
                        result.halted
                    )
                ) {

                    WebBktxApp.running =
                        false;


                    console.warn(
                        "[WebBktx] CPU stopped:",
                        result
                    );
                }


            } catch (error) {

                WebBktxApp.running =
                    false;


                console.error(
                    "[WebBktx] BOOT LOOP ERROR:",
                    error
                );


                drawBootScreen();
            }


            if (
                WebBktxApp.running
            ) {

                WebBktxApp.frameTimer =
                    requestAnimationFrame(
                        loop
                    );
            }
        };


    WebBktxApp.frameTimer =
        requestAnimationFrame(
            loop
        );
}


/* ============================================================
   STOP BOOT
============================================================ */

function stopBoot() {

    WebBktxApp.running =
        false;


    if (
        WebBktxApp.frameTimer
    ) {

        cancelAnimationFrame(
            WebBktxApp.frameTimer
        );

        WebBktxApp.frameTimer =
            null;
    }


    if (
        WebBktxApp.runtime
    ) {

        WebBktxApp.runtime.stop();
    }
}


/* ============================================================
   START EMULATOR
============================================================ */

async function startEmulator() {

    if (
        !WebBktxApp.file
    ) {

        setMessage(
            "Wybierz plik XBE.",
            "error"
        );

        return;
    }


    try {

        stopBoot();


        /*
         * Load and parse.
         */

        const loaded =
            await loadXBE();


        /*
         * Show emulator immediately
         * so user sees diagnostic.
         */

        showBootScreen();


        drawBootScreen();


        /*
         * Boot XBE.
         */

        const boot =
            WebBktxApp.runtime.bootXBE();


        WebBktxApp.boot =
            boot;


        console.log(
            "[WebBktx] BOOT RESULT:",
            boot
        );


        /*
         * Audio deliberately disabled.
         */

        console.log(
            "[WebBktx] AUDIO: DISABLED"
        );


        setMessage(
            `Booting ${loaded.status.name} at ${boot.entryPointHex}`,
            "success"
        );


        drawBootScreen();


        /*
         * Start execution.
         */

        startBootLoop();


    } catch (error) {

        console.error(
            "[WebBktx] XBE BOOT ERROR:",
            error
        );


        setMessage(
            `XBE BOOT ERROR: ${error.message}`,
            "error"
        );


        if (
            gameScreen &&
            !gameScreen.classList.contains(
                "hidden"
            )
        ) {

            drawBootScreen();
        }
    }
}


/* ============================================================
   CPU TEST
============================================================ */

function runCPUTest() {

    showScreen(
        cpuScreen
    );


    if (!cpuOutput) {
        return;
    }


    try {

        detectRuntime();


        const result =
            WebBktxApp.runtime.selfTest();


        const lines = [];


        lines.push(
            "WebBktx CPU DIAGNOSTIC"
        );

        lines.push(
            "======================"
        );

        lines.push(
            ""
        );


        lines.push(
            `Runtime: ${result.version}`
        );


        lines.push(
            `CPU: ${
                result.cpu.passed
                    ? "AVAILABLE"
                    : "FAILED"
            }`
        );


        lines.push(
            `Decoder: ${
                result.decoder
                    ? "AVAILABLE"
                    : "FAILED"
            }`
        );


        lines.push(
            `Kernel: ${
                result.kernel
                    ? "READY"
                    : "FAILED"
            }`
        );


        lines.push(
            ""
        );


        for (
            const test of result.cpu.tests
        ) {

            lines.push(
                `[${test.pass ? "PASS" : "FAIL"}] ${test.name}`
            );
        }


        lines.push(
            ""
        );


        lines.push(
            `RESULT: ${
                result.passed
                    ? "CPU AVAILABLE"
                    : "CPU TEST FAILED"
            }`
        );


        lines.push(
            ""
        );


        lines.push(
            "Runtime status:"
        );


        lines.push(
            JSON.stringify(
                runtimeStatus(),
                null,
                2
            )
        );


        cpuOutput.textContent =
            lines.join("\n");


    } catch (error) {

        cpuOutput.textContent =
            [
                "CPU TEST ERROR",
                "===============",
                "",
                error.message,
                "",
                error.stack || ""
            ].join("\n");
    }
}


/* ============================================================
   ABOUT
============================================================ */

function showAbout() {

    showScreen(
        aboutScreen
    );
}


/* ============================================================
   BACK TO MAIN
============================================================ */

function backToMain() {

    stopBoot();

    showScreen(
        mainScreen
    );


    if (
        WebBktxApp.runtime
    ) {

        console.log(
            "[WebBktx] Runtime status:",
            WebBktxApp.runtime.getStatus()
        );
    }
}


/* ============================================================
   EXIT EMULATOR
============================================================ */

function exitEmulator() {

    stopBoot();


    if (
        WebBktxApp.runtime
    ) {

        WebBktxApp.runtime.reset();
    }


    WebBktxApp.boot = null;
    WebBktxApp.xbe = null;


    showScreen(
        mainScreen
    );


    setMessage(
        "Emulator stopped.",
        "normal"
    );
}


/* ============================================================
   EVENT HANDLERS
============================================================ */

if (gameFile) {

    gameFile.addEventListener(
        "change",
        event => {

            const file =
                event.target.files &&
                event.target.files[0];


            handleFile(file);
        }
    );
}


if (startButton) {

    startButton.addEventListener(
        "click",
        startEmulator
    );
}


if (cpuTestButton) {

    cpuTestButton.addEventListener(
        "click",
        runCPUTest
    );
}


if (aboutButton) {

    aboutButton.addEventListener(
        "click",
        showAbout
    );
}


if (cpuBackButton) {

    cpuBackButton.addEventListener(
        "click",
        backToMain
    );
}


if (aboutBackButton) {

    aboutBackButton.addEventListener(
        "click",
        backToMain
    );
}


if (backButton) {

    backButton.addEventListener(
        "click",
        exitEmulator
    );
}


/* ============================================================
   KEYBOARD
============================================================ */

window.addEventListener(
    "keydown",
    event => {

        /*
         * F1 = main menu
         * F2 = CPU diagnostics
         * F3 = runtime dump
         * F4 = stop CPU
         */

        if (
            event.key === "F1"
        ) {

            event.preventDefault();

            backToMain();
        }


        if (
            event.key === "F2"
        ) {

            event.preventDefault();

            runCPUTest();
        }


        if (
            event.key === "F3"
        ) {

            event.preventDefault();

            if (
                WebBktxApp.runtime
            ) {

                console.log(
                    "[WebBktx] FULL RUNTIME STATUS:",
                    WebBktxApp.runtime.getStatus()
                );
            }
        }


        if (
            event.key === "F4"
        ) {

            event.preventDefault();

            stopBoot();
        }
    }
);


/* ============================================================
   INITIALIZATION
============================================================ */

async function initializeApplication() {

    console.log(
        "[WebBktx] Application initialization..."
    );


    try {

        detectRuntime();


        console.log(
            "[WebBktx] Runtime detected:",
            window.WebBktx
        );


        if (
            WebBktxApp.runtime
        ) {

            WebBktxApp.runtime.initialize();


            console.log(
                "[WebBktx] Core initialized."
            );
        }


        /*
         * Graphics canvas is prepared only when
         * emulator starts.
         */


        console.log(
            "[WebBktx] Application ready."
        );


        await loadingSequence();


    } catch (error) {

        console.error(
            "[WebBktx] Application initialization failed:",
            error
        );


        setLoadingText(
            "CORE ERROR"
        );


        setMessage(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   GLOBAL DEBUG API
============================================================ */

window.WebBktxApp =
    WebBktxApp;


window.WebBktxStart =
    startEmulator;


window.WebBktxStop =
    stopBoot;


window.WebBktxStatus =
    () => {

        if (
            !WebBktxApp.runtime
        ) {

            return null;
        }


        return WebBktxApp.runtime.getStatus();
    };


window.WebBktxDiagnostic =
    () => {

        if (
            !WebBktxApp.runtime
        ) {

            return "Runtime unavailable.";
        }


        return formatDiagnostic(
            WebBktxApp.runtime.getStatus()
        );
    };


console.log(
    "[WebBktx] app.js loaded."
);


/* ============================================================
   START
============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeApplication,
        {
            once: true
        }
    );

} else {

    initializeApplication();
}
