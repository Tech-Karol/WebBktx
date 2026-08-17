/*
 * ============================================================
 * WebBktx
 * Application Controller
 * Version 0.2
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


    screens.forEach(currentScreen => {

        currentScreen.classList.add("hidden");

    });


    screen.classList.remove("hidden");

}



function setProgress(value) {

    progress.style.width =
        `${Math.max(0, Math.min(100, value))}%`;

}



function setModule(moduleName, status) {

    const module =
        document.querySelector(
            `[data-module="${moduleName}"]`
        );


    if (!module) {
        return;
    }


    const state =
        module.querySelector("strong");


    state.textContent =
        status ? "OK" : "ERROR";


    if (status) {

        state.classList.add("module-ok");

    }

}



/* ============================================================
   SERVICE WORKER
============================================================ */


async function initializeLocalSystem() {

    loadingText.textContent =
        "Checking local storage...";

    setProgress(10);


    if (
        "serviceWorker" in navigator
    ) {

        try {

            await navigator.serviceWorker.register(
                "sw.js"
            );


            await navigator.serviceWorker.ready;


            setModule(
                "cache",
                true
            );


        } catch (error) {

            console.error(
                "Service Worker error:",
                error
            );


            setModule(
                "cache",
                false
            );

        }

    } else {

        console.warn(
            "Service Worker not supported."
        );


        setModule(
            "cache",
            false
        );

    }


    await sleep(350);


    loadingText.textContent =
        "Loading WebBktx Core...";

    setProgress(35);


    await sleep(450);


    if (
        window.WebBktxCore &&
        window.WebBktxCore.X86CPU
    ) {

        setModule(
            "core",
            true
        );

    } else {

        setModule(
            "core",
            false
        );

    }


    await sleep(350);


    loadingText.textContent =
        "Checking graphics system...";

    setProgress(60);


    await sleep(450);


    if (
        "gpu" in navigator
    ) {

        setModule(
            "graphics",
            true
        );

    } else {

        /*
         * WebGPU nie jest jeszcze wymagane
         * przez wersję 0.2.
         */

        setModule(
            "graphics",
            true
        );

    }


    await sleep(350);


    loadingText.textContent =
        "Checking controller system...";

    setProgress(80);


    await sleep(450);


    if (
        "getGamepads" in navigator
    ) {

        setModule(
            "input",
            true
        );

    } else {

        setModule(
            "input",
            false
        );

    }


    await sleep(400);


    loadingText.textContent =
        "System ready.";

    setProgress(100);


    await sleep(600);


    showScreen(
        mainScreen
    );

}



/* ============================================================
   GAME FILE
============================================================ */


gameFile.addEventListener(
    "change",
    () => {

        const file =
            gameFile.files[0];


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


            return;

        }


        const sizeMB =
            file.size /
            1024 /
            1024;


        fileInfo.innerHTML = `

            <span class="file-label">
                DISC READY
            </span>

            <span class="file-name">
                ${escapeHTML(file.name)}
            </span>

            <span class="file-size">
                ${sizeMB.toFixed(2)} MB
            </span>

        `;


        startButton.disabled =
            false;


        message.textContent =
            "Disc mounted locally. " +
            "The game file remains on this device.";

    }
);



/* ============================================================
   START EMULATOR
============================================================ */


startButton.addEventListener(
    "click",
    async () => {

        const file =
            gameFile.files[0];


        if (!file) {
            return;
        }


        message.textContent =
            "Initializing emulator...";


        await sleep(500);


        gameName.textContent =
            file.name;


        showScreen(
            gameScreen
        );


        initializeDisplay(
            file
        );

    }
);



/* ============================================================
   DISPLAY
============================================================ */


function initializeDisplay(file) {

    const context =
        canvas.getContext(
            "2d"
        );


    if (!context) {
        return;
    }


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
        canvas.height / 2 - 50
    );


    context.font =
        "22px Arial";


    context.fillStyle =
        "#78a896";


    context.fillText(
        "VIRTUAL DISC MOUNTED",
        canvas.width / 2,
        canvas.height / 2 + 10
    );


    context.font =
        "16px Arial";


    context.fillStyle =
        "#7d858a";


    context.fillText(
        file.name,
        canvas.width / 2,
        canvas.height / 2 + 50
    );


    context.fillText(
        "Xbox emulation core is under development.",
        canvas.width / 2,
        canvas.height / 2 + 90
    );

}



/* ============================================================
   CPU DIAGNOSTICS
============================================================ */


document
    .getElementById("cpuTestButton")
    .addEventListener(
        "click",
        runCPUDiagnostics
    );


document
    .getElementById("cpuBackButton")
    .addEventListener(
        "click",
        () => {

            showScreen(
                mainScreen
            );

        }
    );



function runCPUDiagnostics() {

    showScreen(
        cpuScreen
    );


    const output =
        document.getElementById(
            "cpuOutput"
        );


    output.textContent =
        "Initializing CPU...\n";


    if (
        !window.WebBktxCore ||
        !window.WebBktxCore.X86CPU
    ) {

        output.textContent +=
            "\nERROR: WebBktx Core unavailable.";

        return;

    }


    try {

        const cpu =
            new WebBktxCore.X86CPU();


        output.textContent +=
            "CPU: X86 TEST CORE\n";


        output.textContent +=
            "RAM: 1 MB\n";


        output.textContent +=
            "STATUS: ONLINE\n\n";


        output.textContent +=
            "Executing test program...\n";


        /*
         * MOV EAX, 10
         * ADD EAX, 20
         */

        const program = [

            {
                opcode: 0x01,
                value: 10
            },

            {
                opcode: 0x02,
                value: 20
            }

        ];


        const registers =
            cpu.run(
                program
            );


        output.textContent +=
            "\nMOV EAX, 10\n";


        output.textContent +=
            "ADD EAX, 20\n\n";


        output.textContent +=
            `EAX = ${registers.EAX}\n`;


        if (
            registers.EAX === 30
        ) {

            output.textContent +=
                "\nCPU TEST: PASS\n";

        } else {

            output.textContent +=
                "\nCPU TEST: FAIL\n";

        }

    } catch (error) {

        console.error(error);


        output.textContent +=
            "\nCPU TEST: ERROR\n";


        output.textContent +=
            error.message;

    }

}



/* ============================================================
   ABOUT
============================================================ */


document
    .getElementById("aboutButton")
    .addEventListener(
        "click",
        () => {

            showScreen(
                aboutScreen
            );

        }
    );


document
    .getElementById("aboutBackButton")
    .addEventListener(
        "click",
        () => {

            showScreen(
                mainScreen
            );

        }
    );



/* ============================================================
   EXIT EMULATOR
============================================================ */


document
    .getElementById("backButton")
    .addEventListener(
        "click",
        () => {

            showScreen(
                mainScreen
            );

        }
    );



/* ============================================================
   HTML ESCAPE
============================================================ */


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
   START
============================================================ */


initializeLocalSystem();
