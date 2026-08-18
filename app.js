"use strict";

/*
 * webbktx - Virtual Machine Web Controller
 * app.js
 *
 * Aktualnie:
 * - wybór ISO
 * - walidacja ISO
 * - automatyczna konfiguracja VM
 * - START / PAUSE / RESET
 * - fullscreen
 * - informacje o urządzeniu
 * - log VM
 *
 * Następny etap:
 * - podłączenie prawdziwego emulatora x86/WASM
 */

const VM = {
    state: "stopped",
    iso: null,
    isoURL: null,
    startTime: null,
    elapsed: 0,
    timer: null,

    config: {
        ramMB: 512,
        cpuCores: 1,
        cacheMB: 4,
        screenWidth: 1024,
        screenHeight: 768
    }
};


/* =========================================================
   ELEMENTY INTERFEJSU
   ========================================================= */

const $ = (selector) => document.querySelector(selector);

const isoInput =
    $("#isoInput") ||
    $("#iso") ||
    document.querySelector('input[type="file"]');

const startButton =
    $("#startButton") ||
    $("#start") ||
    document.querySelector('[data-action="start"]');

const pauseButton =
    $("#pauseButton") ||
    $("#pause") ||
    document.querySelector('[data-action="pause"]');

const resetButton =
    $("#resetButton") ||
    $("#reset") ||
    document.querySelector('[data-action="reset"]');

const fullscreenButton =
    $("#fullscreenButton") ||
    $("#fullscreen") ||
    document.querySelector('[data-action="fullscreen"]');

const screen =
    $("#vmScreen") ||
    $("#screen") ||
    document.querySelector("canvas");

const statusElement =
    $("#vmStatus") ||
    $("#status");

const logElement =
    $("#vmLog") ||
    $("#log");


/* =========================================================
   LOGOWANIE
   ========================================================= */

function log(message, type = "info") {
    const time = new Date().toLocaleTimeString();

    console.log(`[webbktx ${time}] ${message}`);

    if (!logElement) return;

    const line = document.createElement("div");

    line.textContent = `[${time}] ${message}`;
    line.dataset.type = type;

    logElement.appendChild(line);

    // Ograniczenie liczby wpisów
    while (logElement.children.length > 200) {
        logElement.removeChild(logElement.firstChild);
    }

    logElement.scrollTop = logElement.scrollHeight;
}


/* =========================================================
   STATUS
   ========================================================= */

function setStatus(text) {
    if (!statusElement) return;

    statusElement.textContent = text;
    statusElement.dataset.state = VM.state;
}


/* =========================================================
   WYKRYWANIE URZĄDZENIA
   ========================================================= */

function detectDevice() {
    const ua = navigator.userAgent.toLowerCase();

    const mobile =
        /android|iphone|ipad|ipod|windows phone/i.test(ua);

    const tablet =
        /ipad|tablet|android(?!.*mobile)/i.test(ua);

    let type = "PC";

    if (tablet) {
        type = "Tablet";
    } else if (mobile) {
        type = "Telefon";
    }

    let cores =
        navigator.hardwareConcurrency ||
        2;

    let memoryGB =
        navigator.deviceMemory ||
        4;

    /*
     * deviceMemory nie jest obsługiwane
     * przez każdą przeglądarkę.
     */
    memoryGB = Number(memoryGB) || 4;

    return {
        type,
        cores,
        memoryGB,
        touch: navigator.maxTouchPoints > 0,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight
    };
}


/* =========================================================
   AUTOMATYCZNA KONFIGURACJA VM
   ========================================================= */

function configureVM() {
    const device = detectDevice();

    let ramMB;
    let cacheMB;
    let cpuCores;

    if (device.type === "Telefon") {
        ramMB = 512;
        cacheMB = 2;
        cpuCores = 1;
    } else if (device.type === "Tablet") {
        ramMB = 768;
        cacheMB = 4;
        cpuCores = 1;
    } else {
        /*
         * Nie przydzielamy całej pamięci urządzenia.
         * Zostawiamy część dla przeglądarki/systemu.
         */
        ramMB = Math.min(
            Math.max(1024, Math.floor(device.memoryGB * 256)),
            4096
        );

        cacheMB = 8;
        cpuCores = Math.max(
            1,
            Math.min(4, Math.floor(device.cores / 2))
        );
    }

    VM.config = {
        ramMB,
        cacheMB,
        cpuCores,
        screenWidth:
            Math.min(window.innerWidth, 1280),

        screenHeight:
            Math.min(window.innerHeight, 720)
    };

    log(
        `Urządzenie: ${device.type}, ` +
        `CPU: ${device.cores} wątków, ` +
        `RAM urządzenia: około ${device.memoryGB} GB`
    );

    log(
        `Konfiguracja VM: ` +
        `${ramMB} MB RAM, ` +
        `${cacheMB} MB cache, ` +
        `${cpuCores} CPU`
    );

    return VM.config;
}


/* =========================================================
   ISO
   ========================================================= */

function handleISO(file) {
    if (!file) {
        return;
    }

    if (VM.isoURL) {
        URL.revokeObjectURL(VM.isoURL);
        VM.isoURL = null;
    }

    const filename = file.name.toLowerCase();

    if (!filename.endsWith(".iso")) {
        log("Wybrany plik nie ma rozszerzenia .iso", "error");

        if (isoInput) {
            isoInput.value = "";
        }

        VM.iso = null;
        return;
    }

    VM.iso = file;

    /*
     * Lokalny URL do pliku.
     * ISO nie jest wysyłane na GitHub.
     */
    VM.isoURL = URL.createObjectURL(file);

    const sizeGB =
        file.size / (1024 * 1024 * 1024);

    log(
        `Wybrano ISO: ${file.name} ` +
        `(${sizeGB.toFixed(2)} GB)`
    );

    setStatus("ISO gotowe");

    updateISOInfo();
}


function updateISOInfo() {
    const element =
        $("#isoInfo") ||
        $("#selectedISO");

    if (!element) return;

    if (!VM.iso) {
        element.textContent = "Nie wybrano ISO";
        return;
    }

    const sizeMB =
        VM.iso.size / (1024 * 1024);

    element.textContent =
        `${VM.iso.name} — ${sizeMB.toFixed(1)} MB`;
}


/* =========================================================
   START VM
   ========================================================= */

function startVM() {
    if (VM.state === "running") {
        log("VM jest już uruchomiona.");
        return;
    }

    if (!VM.iso) {
        log("Najpierw wybierz plik ISO.", "error");
        setStatus("Brak ISO");
        return;
    }

    configureVM();

    VM.state = "running";
    VM.startTime = Date.now();

    setStatus("Uruchomiona");

    log("Uruchamianie wirtualnego komputera...");
    log("Inicjalizacja CPU...");
    log("Inicjalizacja RAM...");
    log("Inicjalizacja urządzeń...");
    log(`Montowanie ISO: ${VM.iso.name}`);
    log("Przygotowanie bootowania...");

    /*
     * TODO:
     *
     * Tutaj zostanie podłączony prawdziwy
     * emulator x86/WASM.
     *
     * Przykład:
     *
     * await Emulator.load();
     * Emulator.mountISO(VM.iso);
     * Emulator.start();
     */

    startTimer();

    drawBootScreen();
}


/* =========================================================
   PAUZA
   ========================================================= */

function pauseVM() {
    if (VM.state !== "running") {
        log("VM nie jest uruchomiona.");
        return;
    }

    VM.state = "paused";

    setStatus("Wstrzymana");

    stopTimer();

    log("Wirtualna maszyna została wstrzymana.");

    /*
     * TODO:
     * Emulator.pause();
     */
}


/* =========================================================
   RESET
   ========================================================= */

function resetVM() {
    stopTimer();

    VM.state = "stopped";
    VM.elapsed = 0;
    VM.startTime = null;

    setStatus("Zatrzymana");

    log("Resetowanie VM...");

    /*
     * TODO:
     * Emulator.reset();
     */

    drawIdleScreen();
}


/* =========================================================
   TIMER
   ========================================================= */

function startTimer() {
    stopTimer();

    VM.timer = setInterval(() => {
        if (VM.state !== "running") {
            return;
        }

        VM.elapsed =
            Math.floor(
                (Date.now() - VM.startTime) / 1000
            );

        updateRuntime();
    }, 1000);
}


function stopTimer() {
    if (VM.timer) {
        clearInterval(VM.timer);
        VM.timer = null;
    }
}


function updateRuntime() {
    const element =
        $("#vmRuntime") ||
        $("#runtime");

    if (!element) return;

    const minutes =
        Math.floor(VM.elapsed / 60);

    const seconds =
        VM.elapsed % 60;

    element.textContent =
        `${String(minutes).padStart(2, "0")}:` +
        `${String(seconds).padStart(2, "0")}`;
}


/* =========================================================
   EKRAN VM
   ========================================================= */

function drawIdleScreen() {
    if (!screen) return;

    const ctx = screen.getContext?.("2d");

    if (!ctx) return;

    screen.width = 800;
    screen.height = 500;

    ctx.fillStyle = "#111";
    ctx.fillRect(
        0,
        0,
        screen.width,
        screen.height
    );

    ctx.fillStyle = "#aaa";
    ctx.font = "20px monospace";
    ctx.textAlign = "center";

    ctx.fillText(
        "webbktx",
        screen.width / 2,
        screen.height / 2 - 20
    );

    ctx.font = "14px monospace";

    ctx.fillText(
        "Wybierz ISO i kliknij START",
        screen.width / 2,
        screen.height / 2 + 20
    );
}


function drawBootScreen() {
    if (!screen) return;

    const ctx = screen.getContext?.("2d");

    if (!ctx) return;

    screen.width = 800;
    screen.height = 500;

    ctx.fillStyle = "#000";
    ctx.fillRect(
        0,
        0,
        screen.width,
        screen.height
    );

    ctx.fillStyle = "#fff";
    ctx.font = "16px monospace";
    ctx.textAlign = "left";

    const lines = [
        "webbktx Virtual Machine",
        "",
        "BIOS",
        "Initializing CPU...",
        `RAM: ${VM.config.ramMB} MB`,
        `CPU: ${VM.config.cpuCores}`,
        `CACHE: ${VM.config.cacheMB} MB`,
        "",
        `CD/DVD: ${VM.iso?.name || "brak"}`,
        "",
        "Booting from CD/DVD...",
        "",
        "Emulator x86/WASM: oczekiwanie na podłączenie"
    ];

    lines.forEach((line, index) => {
        ctx.fillText(
            line,
            30,
            35 + index * 25
        );
    });
}


/* =========================================================
   FULLSCREEN
   ========================================================= */

async function fullscreen() {
    const target =
        $("#vmContainer") ||
        screen ||
        document.documentElement;

    try {
        if (!document.fullscreenElement) {
            await target.requestFullscreen();
            log("Włączono tryb pełnoekranowy.");
        } else {
            await document.exitFullscreen();
            log("Wyłączono tryb pełnoekranowy.");
        }
    } catch (error) {
        log(
            "Nie można uruchomić fullscreen: " +
            error.message,
            "error"
        );
    }
}


/* =========================================================
   OBSŁUGA PRZYCISKÓW
   ========================================================= */

if (isoInput) {
    isoInput.addEventListener(
        "change",
        (event) => {
            const file =
                event.target.files?.[0];

            handleISO(file);
        }
    );
}


if (startButton) {
    startButton.addEventListener(
        "click",
        startVM
    );
}


if (pauseButton) {
    pauseButton.addEventListener(
        "click",
        pauseVM
    );
}


if (resetButton) {
    resetButton.addEventListener(
        "click",
        resetVM
    );
}


if (fullscreenButton) {
    fullscreenButton.addEventListener(
        "click",
        fullscreen
    );
}


/* =========================================================
   KLAWIATURA
   ========================================================= */

document.addEventListener(
    "keydown",
    (event) => {

        // F11 / Ctrl+Shift+F
        if (
            event.key === "F11" ||
            (
                event.ctrlKey &&
                event.shiftKey &&
                event.key.toLowerCase() === "f"
            )
        ) {
            event.preventDefault();
            fullscreen();
        }

        // Ctrl + Alt + R = reset
        if (
            event.ctrlKey &&
            event.altKey &&
            event.key.toLowerCase() === "r"
        ) {
            event.preventDefault();
            resetVM();
        }
    }
);


/* =========================================================
   RESPONSIVE
   ========================================================= */

window.addEventListener(
    "resize",
    () => {
        if (VM.state === "stopped") {
            configureVM();
        }
    }
);


/* =========================================================
   START APLIKACJI
   ========================================================= */

function init() {
    log("webbktx uruchomiony.");

    configureVM();

    setStatus("Gotowa");

    updateISOInfo();

    drawIdleScreen();

    log(
        "Wybierz obraz ISO, aby przygotować wirtualny komputer."
    );
}


document.addEventListener(
    "DOMContentLoaded",
    init
);
