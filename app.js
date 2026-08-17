/*
 * ============================================================
 * WebBktx
 * Application Controller
 *
 * Version: 0.6
 *
 * Features:
 *   - Boot screen
 *   - Service Worker
 *   - Local XBE loading
 *   - XBE header analysis
 *   - Entry Point detection
 *   - Code byte inspection
 *   - Basic x86 instruction decoding
 *   - CPU diagnostics
 *   - RAM diagnostics
 *   - Emulator analysis screen
 *   - Gamepad detection
 *
 * Works with the existing WebBktx 0.3 HTML layout.
 *
 * IMPORTANT:
 * This is an experimental emulator-development environment.
 * It does NOT yet execute a complete Xbox game.
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
let emulatorRunning = false;


/* ============================================================
   HELPERS
============================================================ */

function sleep(ms) {

    return new Promise(resolve => {
        setTimeout(resolve, ms);
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

    for (const item of screens) {

        if (item) {
            item.classList.add("hidden");
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

    value = Math.max(
        0,
        Math.min(100, value)
    );

    progress.style.width =
        `${value}%`;

}


function setModule(name, ok) {

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
        ok ? "OK" : "ERROR";

    state.classList.toggle(
        "module-ok",
        ok
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
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(2)} KB`;
    }

    if (bytes < 1024 * 1024 * 1024) {
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


function hex(value, digits = 8) {

    if (!Number.isFinite(value)) {
        value = 0;
    }

    return (
        "0x" +
        (value >>> 0)
            .toString(16)
            .toUpperCase()
            .padStart(digits, "0")
    );

}


function getFileExtension(file) {

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
            new window.WebBktxCore.WebBktxCore();

        console.log(
            "WebBktx Core 0.6 initialized."
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

        setModule("cache", false);

        return false;
    }

    try {

        await navigator.serviceWorker.register(
            "sw.js"
        );

        await navigator.serviceWorker.ready;

        setModule("cache", true);

        return true;

    } catch (error) {

        console.warn(
            "Service Worker unavailable:",
            error
        );

        setModule("cache", false);

        return false;
    }

}


/* ============================================================
   GRAPHICS
============================================================ */

function checkGraphics() {

    if (!canvas) {

        setModule("graphics", false);

        return false;
    }

    const context =
        canvas.getContext("2d");

    const ok =
        !!context;

    setModule(
        "graphics",
        ok
    );

    return ok;

}


/* ============================================================
   INPUT
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

    loadingText.textContent =
        "Checking local storage...";

    setProgress(10);

    await initializeServiceWorker();

    await sleep(250);


    loadingText.textContent =
        "Loading WebBktx Core 0.6...";

    setProgress(30);

    const coreReady =
        initializeCore();

    setModule(
        "core",
        coreReady
    );

    await sleep(300);


    loadingText.textContent =
        "Checking graphics system...";

    setProgress(50);

    checkGraphics();

    await sleep(250);


    loadingText.textContent =
        "Checking controller system...";

    setProgress(70);

    checkControllers();

    await sleep(250);


    loadingText.textContent =
        "Running system diagnostics...";

    setProgress(88);

    if (emulatorCore) {

        try {

            emulatorCore.runDiagnostics();

        } catch (error) {

            console.warn(
                "Diagnostics failed:",
                error
            );

        }

    }

    await sleep(350);

    setProgress(100);

    loadingText.textContent =
        "System ready.";

    await sleep(600);

    showScreen(mainScreen);

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

                fileInfo.innerHTML = `
                    <span class="file-label">
                        DISC STATUS
                    </span>

                    <span class="file-name">
                        No file selected
                    </span>
                `;

                startButton.disabled = true;

                setMessage("");

                return;
            }

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

            startButton.disabled = false;

            setMessage(
                "Local game file selected."
            );

            console.log(
                "Selected XBE:",
                file.name
            );

        }
    );

}


/* ============================================================
   RAW XBE ANALYSIS
============================================================ */

async function analyzeXBE(file) {

    const buffer =
        await file.arrayBuffer();

    const bytes =
        new Uint8Array(buffer);

    const view =
        new DataView(buffer);


    const result = {

        valid: false,

        magic: 0,

        fileSize:
            bytes.length,

        baseAddress: 0,

        headerSize: 0,

        imageSize: 0,

        certificateAddress: 0,

        sectionCount: 0,

        sectionHeadersAddress: 0,

        entryPoint: 0,

        entryPointFileOffset: null,

        entryPointMemoryAddress: 0,

        codeBytes: [],

        sections: []

    };


    if (bytes.length < 0x130) {

        result.error =
            "XBE file is too small for a normal header.";

        return result;
    }


    result.magic =
        view.getUint32(
            0x00,
            true
        );


    /*
     * XBE magic = "XBEH"
     *
     * Little endian:
     * 0x48454258
     */

    result.valid =
        result.magic === 0x48454258;


    if (!result.valid) {

        result.error =
            "XBEH signature was not found.";

        return result;
    }


    /*
     * XBE header fields.
     */

    result.baseAddress =
        view.getUint32(
            0x104,
            true
        );

    result.headerSize =
        view.getUint32(
            0x108,
            true
        );

    result.imageSize =
        view.getUint32(
            0x10C,
            true
        );

    result.certificateAddress =
        view.getUint32(
            0x118,
            true
        );

    result.sectionCount =
        view.getUint32(
            0x11C,
            true
        );

    result.sectionHeadersAddress =
        view.getUint32(
            0x120,
            true
        );

    result.entryPoint =
        view.getUint32(
            0x128,
            true
        );


    /*
     * The XBE entry point is a virtual address
     * encoded relative to the image base.
     *
     * Convert it into an image-relative offset.
     */

    const entryRelative =
        (
            result.entryPoint -
            result.baseAddress
        ) >>> 0;


    result.entryPointMemoryAddress =
        result.entryPoint;


    /*
     * First attempt:
     * entry point inside XBE image.
     */

    if (
        entryRelative < bytes.length
    ) {

        result.entryPointFileOffset =
            entryRelative;

    }


    /*
     * Section table.
     *
     * XBE section headers are commonly
     * 0x38 bytes each.
     */

    const sectionTable =
        result.sectionHeadersAddress;


    if (
        sectionTable < bytes.length &&
        result.sectionCount < 4096
    ) {

        for (
            let i = 0;
            i < result.sectionCount;
            i++
        ) {

            const offset =
                sectionTable +
                i * 0x38;

            if (
                offset + 0x38 >
                bytes.length
            ) {
                break;
            }

            const virtualAddress =
                view.getUint32(
                    offset + 0x00,
                    true
                );

            const virtualSize =
                view.getUint32(
                    offset + 0x04,
                    true
                );

            const rawAddress =
                view.getUint32(
                    offset + 0x08,
                    true
                );

            const rawSize =
                view.getUint32(
                    offset + 0x0C,
                    true
                );

            const nameAddress =
                view.getUint32(
                    offset + 0x10,
                    true
                );

            result.sections.push({

                index: i,

                virtualAddress,

                virtualSize,

                rawAddress,

                rawSize,

                nameAddress

            });

        }

    }


    /*
     * More accurate entry point resolution:
     *
     * Look for a section whose virtual address
     * contains the entry point.
     */

    for (const section of result.sections) {

        const start =
            section.virtualAddress;

        const end =
            (
                start +
                Math.max(
                    section.virtualSize,
                    section.rawSize
                )
            ) >>> 0;

        if (
            result.entryPoint >= start &&
            result.entryPoint < end
        ) {

            const relative =
                (
                    result.entryPoint -
                    start
                ) >>> 0;

            const fileOffset =
                (
                    section.rawAddress +
                    relative
                ) >>> 0;

            if (
                fileOffset < bytes.length
            ) {

                result.entryPointFileOffset =
                    fileOffset;

            }

            break;
        }

    }


    /*
     * Read first 64 bytes from entry point.
     */

    if (
        Number.isInteger(
            result.entryPointFileOffset
        )
    ) {

        const offset =
            result.entryPointFileOffset;

        const length =
            Math.min(
                64,
                bytes.length - offset
            );

        result.codeBytes =
            Array.from(
                bytes.slice(
                    offset,
                    offset + length
                )
            );

    }


    return result;

}


/* ============================================================
   BYTE FORMATTER
============================================================ */

function formatByteArray(bytes) {

    if (!bytes || !bytes.length) {
        return "(no code bytes)";
    }

    return bytes
        .map(
            byte =>
                byte
                    .toString(16)
                    .toUpperCase()
                    .padStart(2, "0")
        )
        .join(" ");

}


/* ============================================================
   BASIC x86 DECODER
============================================================ */

function decodeX86(bytes, startAddress = 0) {

    const instructions = [];

    if (!bytes || !bytes.length) {
        return instructions;
    }


    let i = 0;


    while (
        i < bytes.length &&
        instructions.length < 16
    ) {

        const address =
            (
                startAddress +
                i
            ) >>> 0;

        const opcode =
            bytes[i];


        /*
         * NOP
         */

        if (opcode === 0x90) {

            instructions.push({
                address,
                bytes: [opcode],
                text: "NOP"
            });

            i += 1;
            continue;
        }


        /*
         * RET
         */

        if (opcode === 0xC3) {

            instructions.push({
                address,
                bytes: [opcode],
                text: "RET"
            });

            i += 1;
            continue;
        }


        /*
         * INT 3
         */

        if (opcode === 0xCC) {

            instructions.push({
                address,
                bytes: [opcode],
                text: "INT 3"
            });

            i += 1;
            continue;
        }


        /*
         * PUSH EAX..EDI
         */

        if (
            opcode >= 0x50 &&
            opcode <= 0x57
        ) {

            const names = [
                "EAX",
                "ECX",
                "EDX",
                "EBX",
                "ESP",
                "EBP",
                "ESI",
                "EDI"
            ];

            instructions.push({
                address,
                bytes: [opcode],
                text:
                    `PUSH ${names[opcode - 0x50]}`
            });

            i += 1;
            continue;
        }


        /*
         * POP EAX..EDI
         */

        if (
            opcode >= 0x58 &&
            opcode <= 0x5F
        ) {

            const names = [
                "EAX",
                "ECX",
                "EDX",
                "EBX",
                "ESP",
                "EBP",
                "ESI",
                "EDI"
            ];

            instructions.push({
                address,
                bytes: [opcode],
                text:
                    `POP ${names[opcode - 0x58]}`
            });

            i += 1;
            continue;
        }


        /*
         * PUSH imm32
         */

        if (
            opcode === 0x68 &&
            i + 4 < bytes.length
        ) {

            const value =
                (
                    bytes[i + 1] |
                    (bytes[i + 2] << 8) |
                    (bytes[i + 3] << 16) |
                    (bytes[i + 4] << 24)
                ) >>> 0;

            const raw =
                Array.from(
                    bytes.slice(i, i + 5)
                );

            instructions.push({
                address,
                bytes: raw,
                text:
                    `PUSH ${hex(value)}`
            });

            i += 5;
            continue;
        }


        /*
         * MOV reg, imm32
         *
         * B8-BF
         */

        if (
            opcode >= 0xB8 &&
            opcode <= 0xBF &&
            i + 4 < bytes.length
        ) {

            const names = [
                "EAX",
                "ECX",
                "EDX",
                "EBX",
                "ESP",
                "EBP",
                "ESI",
                "EDI"
            ];

            const value =
                (
                    bytes[i + 1] |
                    (bytes[i + 2] << 8) |
                    (bytes[i + 3] << 16) |
                    (bytes[i + 4] << 24)
                ) >>> 0;

            const raw =
                Array.from(
                    bytes.slice(i, i + 5)
                );

            instructions.push({
                address,
                bytes: raw,
                text:
                    `MOV ${names[opcode - 0xB8]}, ${hex(value)}`
            });

            i += 5;
            continue;
        }


        /*
         * XOR EAX,EAX
         *
         * 31 C0
         */

        if (
            opcode === 0x31 &&
            i + 1 < bytes.length &&
            bytes[i + 1] === 0xC0
        ) {

            instructions.push({
                address,
                bytes: [0x31, 0xC0],
                text: "XOR EAX, EAX"
            });

            i += 2;
            continue;
        }


        /*
         * ADD EAX, imm32
         *
         * 05 id
         */

        if (
            opcode === 0x05 &&
            i + 4 < bytes.length
        ) {

            const value =
                (
                    bytes[i + 1] |
                    (bytes[i + 2] << 8) |
                    (bytes[i + 3] << 16) |
                    (bytes[i + 4] << 24)
                ) >>> 0;

            instructions.push({
                address,
                bytes:
                    Array.from(
                        bytes.slice(i, i + 5)
                    ),
                text:
                    `ADD EAX, ${hex(value)}`
            });

            i += 5;
            continue;
        }


        /*
         * SUB EAX, imm32
         *
         * 2D id
         */

        if (
            opcode === 0x2D &&
            i + 4 < bytes.length
        ) {

            const value =
                (
                    bytes[i + 1] |
                    (bytes[i + 2] << 8) |
                    (bytes[i + 3] << 16) |
                    (bytes[i + 4] << 24)
                ) >>> 0;

            instructions.push({
                address,
                bytes:
                    Array.from(
                        bytes.slice(i, i + 5)
                    ),
                text:
                    `SUB EAX, ${hex(value)}`
            });

            i += 5;
            continue;
        }


        /*
         * CALL rel32
         *
         * E8 xx xx xx xx
         */

        if (
            opcode === 0xE8 &&
            i + 4 < bytes.length
        ) {

            const displacement =
                (
                    bytes[i + 1] |
                    (bytes[i + 2] << 8) |
                    (bytes[i + 3] << 16) |
                    (bytes[i + 4] << 24)
                ) | 0;

            const target =
                (
                    address +
                    5 +
                    displacement
                ) >>> 0;

            instructions.push({
                address,
                bytes:
                    Array.from(
                        bytes.slice(i, i + 5)
                    ),
                text:
                    `CALL ${hex(target)}`
            });

            i += 5;
            continue;
        }


        /*
         * JMP rel32
         *
         * E9 xx xx xx xx
         */

        if (
            opcode === 0xE9 &&
            i + 4 < bytes.length
        ) {

            const displacement =
                (
                    bytes[i + 1] |
                    (bytes[i + 2] << 8) |
                    (bytes[i + 3] << 16) |
                    (bytes[i + 4] << 24)
                ) | 0;

            const target =
                (
                    address +
                    5 +
                    displacement
                ) >>> 0;

            instructions.push({
                address,
                bytes:
                    Array.from(
                        bytes.slice(i, i + 5)
                    ),
                text:
                    `JMP ${hex(target)}`
            });

            i += 5;
            continue;
        }


        /*
         * Conditional jumps:
         *
         * 0F 8x rel32
         */

        if (
            opcode === 0x0F &&
            i + 5 < bytes.length &&
            bytes[i + 1] >= 0x80 &&
            bytes[i + 1] <= 0x8F
        ) {

            const conditionNames = [
                "JO",
                "JNO",
                "JB",
                "JAE",
                "JE",
                "JNE",
                "JBE",
                "JA",
                "JS",
                "JNS",
                "JP",
                "JNP",
                "JL",
                "JGE",
                "JLE",
                "JG"
            ];

            const condition =
                conditionNames[
                    bytes[i + 1] - 0x80
                ];

            const displacement =
                (
                    bytes[i + 2] |
                    (bytes[i + 3] << 8) |
                    (bytes[i + 4] << 16) |
                    (bytes[i + 5] << 24)
                ) | 0;

            const target =
                (
                    address +
                    6 +
                    displacement
                ) >>> 0;

            instructions.push({
                address,
                bytes:
                    Array.from(
                        bytes.slice(i, i + 6)
                    ),
                text:
                    `${condition} ${hex(target)}`
            });

            i += 6;
            continue;
        }


        /*
         * Unknown instruction.
         */

        instructions.push({
            address,
            bytes: [opcode],
            text:
                `DB ${hex(opcode, 2)} ; unknown`
        });

        i += 1;

    }


    return instructions;

}


/* ============================================================
   CORE GAME LOADING
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


    if (extension !== "xbe") {

        return {

            recognized: false,

            format:
                extension.toUpperCase(),

            size:
                selectedGameFile.size,

            analysis: null,

            image: null,

            memory: null

        };

    }


    /*
     * Use core loader when available.
     */

    let coreResult = null;

    try {

        if (
            typeof emulatorCore.loadGame ===
            "function"
        ) {

            coreResult =
                await emulatorCore.loadGame(
                    selectedGameFile
                );

        }

    } catch (error) {

        console.warn(
            "Core XBE loader reported:",
            error
        );

    }


    /*
     * Always perform application-side
     * header analysis as well.
     */

    const analysis =
        await analyzeXBE(
            selectedGameFile
        );


    return {

        recognized:
            analysis.valid,

        format:
            analysis.valid
                ? "XBE"
                : "UNKNOWN",

        size:
            selectedGameFile.size,

        analysis,

        core:
            coreResult,

        image:
            coreResult
                ? coreResult.image
                : null,

        memory:
            coreResult
                ? coreResult.memory
                : null

    };

}


/* ============================================================
   EMULATOR SCREEN
============================================================ */

function initializeEmulatorDisplay(
    file,
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


    ctx.fillStyle = "#050708";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    ctx.textAlign =
        "center";


    /*
     * Logo
     */

    ctx.fillStyle =
        "#d7dedb";

    ctx.font =
        "bold 58px Arial";

    ctx.fillText(
        "WebBktx",
        canvas.width / 2,
        120
    );


    /*
     * XBE status
     */

    ctx.fillStyle =
        "#78a896";

    ctx.font =
        "bold 20px Arial";

    ctx.fillText(
        "XBE ANALYSIS MODE",
        canvas.width / 2,
        165
    );


    const analysis =
        result.analysis;


    if (!analysis) {

        ctx.fillStyle =
            "#9aa39f";

        ctx.font =
            "16px monospace";

        ctx.fillText(
            "No XBE analysis available.",
            canvas.width / 2,
            230
        );

        return;
    }


    const lines = [

        `FILE: ${file.name}`,

        `SIZE: ${formatBytes(analysis.fileSize)}`,

        `MAGIC: ${hex(analysis.magic)}`,

        `BASE: ${hex(analysis.baseAddress)}`,

        `ENTRY POINT: ${hex(analysis.entryPoint)}`,

        `ENTRY FILE OFFSET: ${
            Number.isInteger(
                analysis.entryPointFileOffset
            )
                ? hex(
                    analysis.entryPointFileOffset
                )
                : "NOT RESOLVED"
        }`,

        `SECTIONS: ${analysis.sectionCount}`

    ];


    ctx.textAlign =
        "left";

    ctx.font =
        "16px monospace";

    ctx.fillStyle =
        "#9ca6a2";


    let y = 230;

    for (const line of lines) {

        ctx.fillText(
            line,
            100,
            y
        );

        y += 28;

    }


    /*
     * Decoder output.
     */

    ctx.fillStyle =
        "#78a896";

    ctx.font =
        "bold 16px monospace";

    ctx.fillText(
        "FIRST X86 INSTRUCTIONS",
        100,
        y + 25
    );

    y += 55;


    const instructions =
        decodeX86(
            analysis.codeBytes,
            analysis.entryPoint
        );


    ctx.font =
        "14px monospace";

    ctx.fillStyle =
        "#aeb8b4";


    if (!instructions.length) {

        ctx.fillText(
            "No executable bytes resolved.",
            100,
            y
        );

    } else {

        for (
            const instruction
            of instructions.slice(0, 9)
        ) {

            const address =
                hex(
                    instruction.address
                );

            const text =
                instruction.text;

            ctx.fillText(
                `${address}  ${text}`,
                100,
                y
            );

            y += 23;

        }

    }


    /*
     * Footer.
     */

    ctx.textAlign =
        "center";

    ctx.fillStyle =
        "#626d69";

    ctx.font =
        "13px Arial";

    ctx.fillText(
        "CPU EXECUTION CORE: DEVELOPMENT",
        canvas.width / 2,
        canvas.height - 55
    );

    ctx.fillText(
        "XBE analyzed locally — no game code executed",
        canvas.width / 2,
        canvas.height - 32
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
                    "Loading XBE..."
                );


                await sleep(200);


                const result =
                    await loadSelectedGame();


                currentGame =
                    result;


                console.log(
                    "WebBktx 0.6 result:",
                    result
                );


                if (
                    !result.recognized
                ) {

                    setMessage(
                        `${result.format || "UNKNOWN"} ` +
                        "image detected. XBE required."
                    );

                    return;
                }


                /*
                 * Update emulator title.
                 */

                if (gameName) {

                    gameName.textContent =
                        selectedGameFile.name;

                }


                /*
                 * Show actual analysis.
                 */

                showScreen(
                    gameScreen
                );


                initializeEmulatorDisplay(
                    selectedGameFile,
                    result
                );


                emulatorRunning =
                    false;


                setMessage(
                    "XBE analyzed successfully."
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
        "WebBktx 0.6 CPU DIAGNOSTICS\n" +
        "============================\n\n";


    await sleep(150);


    if (!emulatorCore) {

        cpuOutput.textContent +=
            "ERROR: CORE UNAVAILABLE\n";

        return;
    }


    try {

        const diagnostics =
            emulatorCore.runDiagnostics();


        cpuOutput.textContent +=
            "MEMORY SYSTEM\n";

        cpuOutput.textContent +=
            "--------------\n";

        cpuOutput.textContent +=
            "RAM TEST: " +
            (
                diagnostics.ram &&
                diagnostics.ram.passed
                    ? "PASS"
                    : "FAIL"
            ) +
            "\n\n";


        cpuOutput.textContent +=
            "CPU SYSTEM\n";

        cpuOutput.textContent +=
            "----------\n";

        cpuOutput.textContent +=
            "CPU: X86 TEST CORE\n";

        cpuOutput.textContent +=
            "STATUS: ONLINE\n\n";


        if (
            diagnostics.cpu
        ) {

            cpuOutput.textContent +=
                "TEST PROGRAM:\n";

            cpuOutput.textContent +=
                "MOV EAX, 10\n";

            cpuOutput.textContent +=
                "ADD EAX, 20\n\n";

            cpuOutput.textContent +=
                `EAX = ${
                    diagnostics.cpu.registers.EAX
                }\n`;

            cpuOutput.textContent +=
                `EIP = ${
                    diagnostics.cpu.EIP
                }\n`;

            cpuOutput.textContent +=
                `CYCLES = ${
                    diagnostics.cpu.cycles
                }\n\n`;

        }


        cpuOutput.textContent +=
            "CPU TEST: " +
            (
                diagnostics.cpuPassed
                    ? "PASS"
                    : "FAIL"
            ) +
            "\n\n";


        cpuOutput.textContent +=
            "X86 DECODER: AVAILABLE\n";

        cpuOutput.textContent +=
            "XBE ANALYZER: AVAILABLE\n";

        cpuOutput.textContent +=
            "ENTRY POINT ANALYSIS: AVAILABLE\n\n";

        cpuOutput.textContent +=
            "SYSTEM DIAGNOSTICS COMPLETE.\n";


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
   EXIT
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
   STOP
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

}


/* ============================================================
   GAMEPAD
============================================================ */

function checkGamepads() {

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

        console.log(
            "Controller:",
            pad.id
        );

        break;

    }

}


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
            "Emulator key:",
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

    analyzeXBE(file) {

        return analyzeXBE(file);

    },

    decodeX86(bytes, address) {

        return decodeX86(
            bytes,
            address
        );

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
   START
============================================================ */

initializeLocalSystem();
