"use strict";

/*
 * ============================================================
 * WebBktx application
 *
 * Fresh frontend for WebBktx 2.0 runtime.
 * ============================================================
 */

(() => {

    const $ = selector =>
        document.querySelector(selector);


    const runtime =
        window.WebBktxRuntime;


    const WebBktx =
        window.WebBktx;


    if (!WebBktx || !runtime) {

        console.error(
            "[WebBktx] Runtime unavailable."
        );

        document.body.innerHTML = `
            <div style="
                background:#080b0d;
                color:#ff4040;
                font:16px monospace;
                padding:40px;
            ">
                WEBBKTX RUNTIME ERROR<br><br>
                webbktx.js nie został załadowany.
            </div>
        `;

        return;
    }


    const state = {

        file: null,

        xbe: null,

        booted: false,

        audio: false,

        fps: 0,

        frames: 0,

        lastFrameTime: performance.now()
    };


    /* ========================================================
       SCREEN HELPERS
    ======================================================== */

    function show(id) {

        document
            .querySelectorAll(".screen")
            .forEach(screen => {

                screen.classList.add(
                    "hidden"
                );
            });

        const element =
            document.getElementById(id);

        if (element) {

            element.classList.remove(
                "hidden"
            );
        }
    }


    function message(text, type = "info") {

        const element =
            $("#message");

        if (!element) {
            return;
        }

        element.textContent = text;

        element.dataset.type = type;
    }


    function setLoading(
        text,
        progress
    ) {

        const label =
            $("#loadingText");

        const bar =
            $("#progress");

        if (label) {
            label.textContent = text;
        }

        if (bar) {
            bar.style.width =
                `${Math.max(
                    0,
                    Math.min(
                        100,
                        progress
                    )
                )}%`;
        }
    }


    function moduleState(
        name,
        stateText
    ) {

        const element =
            document.querySelector(
                `.module[data-module="${name}"] strong`
            );

        if (element) {
            element.textContent =
                stateText;
        }
    }


    /* ========================================================
       INITIALIZATION
    ======================================================== */

    async function initialize() {

        setLoading(
            "Initializing WebBktx runtime...",
            10
        );

        moduleState(
            "cache",
            "OK"
        );

        await sleep(100);

        setLoading(
            "Initializing memory...",
            30
        );

        moduleState(
            "core",
            "OK"
        );

        await sleep(100);

        setLoading(
            "Initializing CPU...",
            50
        );

        moduleState(
            "graphics",
            "OK"
        );

        await sleep(100);

        setLoading(
            "Initializing input...",
            70
        );

        moduleState(
            "input",
            "OK"
        );

        await sleep(100);

        setLoading(
            "Running diagnostics...",
            90
        );

        const test =
            runtime.selfTest();

        console.log(
            "[WebBktx] Runtime self-test:",
            test
        );

        if (!test.passed) {

            setLoading(
                "Runtime diagnostic failed.",
                100
            );

            return;
        }

        setLoading(
            "WebBktx ready.",
            100
        );

        await sleep(300);

        show("mainScreen");

        updateRuntimeStatus();

        console.log(
            "[WebBktx] Application ready."
        );
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


    /* ========================================================
       FILE SELECTION
    ======================================================== */

    async function handleFile(
        event
    ) {

        const file =
            event.target.files[0];

        if (!file) {
            return;
        }

        state.file = file;

        const name =
            file.name.toLowerCase();


        const fileName =
            document.querySelector(
                ".file-name"
            );

        if (fileName) {

            fileName.textContent =
                `${file.name} (${formatBytes(
                    file.size
                )})`;
        }


        message(
            "Analizowanie XBE...",
            "info"
        );


        try {

            const status =
                await runtime.loadXBE(
                    file
                );

            state.xbe =
                status;

            console.log(
                "[WebBktx] XBE loaded:",
                status
            );


            const title =
                document.querySelector(
                    ".disc-info h2"
                );

            const description =
                document.querySelector(
                    ".disc-info p"
                );


            if (title) {

                title.textContent =
                    "XBE loaded";
            }


            if (description) {

                description.textContent =
                    `${file.name} • ${formatBytes(
                        file.size
                    )}`;
            }


            const start =
                $("#startButton");

            if (start) {
                start.disabled = false;
            }


            message(
                "XBE poprawnie załadowany. Można rozpocząć boot.",
                "success"
            );


            if (
                !name.endsWith(".xbe")
            ) {

                message(
                    "Plik nie ma rozszerzenia .xbe, ale został zaakceptowany przez loader.",
                    "warning"
                );
            }


        } catch (error) {

            console.error(
                "[WebBktx] XBE error:",
                error
            );

            message(
                `XBE ERROR: ${error.message}`,
                "error"
            );

            state.xbe = null;

            const start =
                $("#startButton");

            if (start) {
                start.disabled = true;
            }
        }
    }


    /* ========================================================
       BOOT
    ======================================================== */

    async function boot() {

        if (!state.file) {

            message(
                "Najpierw wybierz plik XBE.",
                "error"
            );

            return;
        }


        try {

            message(
                "Preparing Xbox machine...",
                "info"
            );


            show("gameScreen");


            const canvas =
                $("#screen");


            runtime.initialize(
                canvas
            );


            setGameName(
                state.file.name
            );


            const bootInfo =
                runtime.bootXBE();


            state.booted = true;


            console.log(
                "[WebBktx] BOOT:",
                bootInfo
            );


            message(
                "XBE boot sequence started.",
                "success"
            );


            updateGameStatus();


            /*
             * Start the CPU/frame scheduler.
             *
             * Audio is deliberately disabled.
             */

            runtime.start();


            startFPSCounter();


        } catch (error) {

            console.error(
                "[WebBktx] Boot error:",
                error
            );


            state.booted = false;


            show("mainScreen");


            message(
                `BOOT ERROR: ${error.message}`,
                "error"
            );
        }
    }


    function setGameName(name) {

        const element =
            $("#gameName");

        if (element) {

            element.textContent =
                String(name)
                    .replace(
                        /\.xbe$/i,
                        ""
                    );
        }
    }


    /* ========================================================
       FPS
    ======================================================== */

    function startFPSCounter() {

        state.frames = 0;

        state.lastFrameTime =
            performance.now();


        function update() {

            if (!state.booted) {
                return;
            }

            state.frames++;


            const now =
                performance.now();

            const elapsed =
                now -
                state.lastFrameTime;


            if (elapsed >= 1000) {

                state.fps =
                    state.frames *
                    1000 /
                    elapsed;

                state.frames = 0;

                state.lastFrameTime =
                    now;


                updateFPSDisplay();
            }


            requestAnimationFrame(
                update
            );
        }


        requestAnimationFrame(
            update
        );
    }


    function updateFPSDisplay() {

        const status =
            document.querySelector(
                ".emulator-status"
            );

        if (!status) {
            return;
        }


        const spans =
            status.querySelectorAll(
                "span"
            );


        if (spans.length >= 4) {

            spans[0].textContent =
                `CPU: ${
                    runtime.cpu.running
                        ? "ONLINE"
                        : "STOPPED"
                }`;

            spans[1].textContent =
                `GPU: ${
                    runtime.graphics.ready
                        ? "ONLINE"
                        : "WAITING"
                }`;

            spans[2].textContent =
                "AUDIO: DISABLED";

            spans[3].textContent =
                `FPS: ${
                    state.fps.toFixed(1)
                }`;
        }
    }


    function updateGameStatus() {

        updateFPSDisplay();
    }


    /* ========================================================
       CPU DIAGNOSTICS
    ======================================================== */

    function runCPUDiagnostics() {

        show("cpuScreen");


        const output =
            $("#cpuOutput");

        if (!output) {
            return;
        }


        const result =
            runtime.selfTest();


        const cpu =
            result.cpu;


        const lines = [];


        lines.push(
            "WebBktx CPU DIAGNOSTIC"
        );

        lines.push(
            "======================"
        );

        lines.push(
            `Runtime: ${WebBktx.VERSION}`
        );

        lines.push(
            `CPU: ${
                cpu.passed
                    ? "AVAILABLE"
                    : "FAILED"
            }`
        );

        lines.push(
            "Decoder: AVAILABLE"
        );

        lines.push(
            `Kernel: ${
                runtime.kernel.ready
                    ? "READY"
                    : "NOT READY"
            }`
        );

        lines.push("");


        for (
            const test of cpu.tests
        ) {

            lines.push(
                `[${test.pass ? "PASS" : "FAIL"}] ${test.name}`
            );
        }


        lines.push("");

        lines.push(
            `RESULT: ${
                result.passed
                    ? "CPU AVAILABLE"
                    : "CPU TEST FAILED"
            }`
        );


        lines.push("");

        lines.push(
            "Runtime status:"
        );


        lines.push(
            JSON.stringify(
                runtime.status(),
                null,
                2
            )
        );


        output.textContent =
            lines.join("\n");
    }


    /* ========================================================
       ABOUT
    ======================================================== */

    function showAbout() {

        show("aboutScreen");
    }


    /* ========================================================
       RETURN
    ======================================================== */

    function backToMain() {

        if (state.booted) {

            runtime.stop();

            state.booted = false;
        }

        show("mainScreen");

        updateRuntimeStatus();
    }


    function exitGame() {

        runtime.stop();

        state.booted = false;

        show("mainScreen");

        message(
            "Emulator stopped.",
            "info"
        );
    }


    /* ========================================================
       RUNTIME STATUS
    ======================================================== */

    function updateRuntimeStatus() {

        const status =
            runtime.status();

        console.log(
            "[WebBktx] STATUS:",
            status
        );
    }


    /* ========================================================
       DRAG & DROP
    ======================================================== */

    function setupDragDrop() {

        const area =
            document.querySelector(
                ".disc-panel"
            );

        if (!area) {
            return;
        }


        area.addEventListener(
            "dragover",
            event => {

                event.preventDefault();

                area.classList.add(
                    "drag-over"
                );
            }
        );


        area.addEventListener(
            "dragleave",
            () => {

                area.classList.remove(
                    "drag-over"
                );
            }
        );


        area.addEventListener(
            "drop",
            event => {

                event.preventDefault();

                area.classList.remove(
                    "drag-over"
                );


                const file =
                    event.dataTransfer.files[0];

                if (!file) {
                    return;
                }


                const input =
                    $("#gameFile");

                if (input) {

                    /*
                     * Browsers generally do not allow
                     * assigning arbitrary FileList values
                     * to input.files. Therefore process the
                     * dropped file directly.
                     */

                    handleDroppedFile(
                        file
                    );
                }
            }
        );
    }


    async function handleDroppedFile(file) {

        state.file = file;


        const fileName =
            document.querySelector(
                ".file-name"
            );

        if (fileName) {

            fileName.textContent =
                `${file.name} (${formatBytes(
                    file.size
                )})`;
        }


        try {

            const status =
                await runtime.loadXBE(
                    file
                );

            state.xbe =
                status;


            const start =
                $("#startButton");

            if (start) {
                start.disabled = false;
            }


            message(
                "XBE loaded from drag & drop.",
                "success"
            );

        } catch (error) {

            message(
                `XBE ERROR: ${error.message}`,
                "error"
            );
        }
    }


    /* ========================================================
       UTILITIES
    ======================================================== */

    function formatBytes(bytes) {

        bytes =
            Number(bytes);


        if (bytes < 1024) {
            return `${bytes} B`;
        }


        if (bytes < 1024 * 1024) {

            return `${
                (bytes / 1024).toFixed(1)
            } KB`;
        }


        return `${
            (bytes / 1024 / 1024).toFixed(2)
        } MB`;
    }


    /* ========================================================
       EVENTS
    ======================================================== */

    function bindEvents() {

        const file =
            $("#gameFile");

        if (file) {

            file.addEventListener(
                "change",
                handleFile
            );
        }


        const start =
            $("#startButton");

        if (start) {

            start.addEventListener(
                "click",
                boot
            );
        }


        const cpu =
            $("#cpuTestButton");

        if (cpu) {

            cpu.addEventListener(
                "click",
                runCPUDiagnostics
            );
        }


        const about =
            $("#aboutButton");

        if (about) {

            about.addEventListener(
                "click",
                showAbout
            );
        }


        const cpuBack =
            $("#cpuBackButton");

        if (cpuBack) {

            cpuBack.addEventListener(
                "click",
                () => show("mainScreen")
            );
        }


        const aboutBack =
            $("#aboutBackButton");

        if (aboutBack) {

            aboutBack.addEventListener(
                "click",
                () => show("mainScreen")
            );
        }


        const exit =
            $("#backButton");

        if (exit) {

            exit.addEventListener(
                "click",
                exitGame
            );
        }


        setupDragDrop();
    }


    /* ========================================================
       START
    ======================================================== */

    bindEvents();

    console.log(
        "[WebBktx] app.js loaded."
    );


    initialize();

})();
