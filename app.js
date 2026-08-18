"use strict";

/*
 * ============================================================
 * WebBktx Application
 * ============================================================
 */

(function () {

    const App = {

        runtime: null,

        currentFile: null,

        running: false,

        animationFrame: 0,

        elements: {},

        init() {

            console.log(
                "[WebBktx] Application initialization..."
            );

            this.cacheElements();

            if (
                !window.WebBktx
            ) {

                this.fatal(
                    "webbktx.js nie został załadowany."
                );

                return;
            }

            this.runtime =
                window.WebBktx.machine;

            console.log(
                "[WebBktx] Runtime detected:",
                window.WebBktx
            );

            this.bindEvents();

            this.initializeRuntime();

            this.showScreen(
                "mainScreen"
            );

            this.setMessage(
                "SYSTEM READY",
                "success"
            );

            console.log(
                "[WebBktx] Application ready."
            );
        },

        cacheElements() {

            const ids = [

                "loadingScreen",
                "mainScreen",
                "cpuScreen",
                "aboutScreen",
                "gameScreen",

                "gameFile",
                "fileInfo",
                "startButton",

                "message",

                "cpuTestButton",
                "cpuBackButton",

                "aboutButton",
                "aboutBackButton",

                "backButton",

                "cpuOutput",

                "screen",
                "gameName"

            ];

            for (const id of ids) {

                this.elements[id] =
                    document.getElementById(id);
            }
        },

        bindEvents() {

            const e =
                this.elements;

            if (e.gameFile) {

                e.gameFile.addEventListener(
                    "change",
                    event =>
                        this.onFileSelected(
                            event
                        )
                );
            }

            if (e.startButton) {

                e.startButton.addEventListener(
                    "click",
                    () =>
                        this.startGame()
                );
            }

            if (e.cpuTestButton) {

                e.cpuTestButton.addEventListener(
                    "click",
                    () =>
                        this.showCPU()
                );
            }

            if (e.cpuBackButton) {

                e.cpuBackButton.addEventListener(
                    "click",
                    () =>
                        this.showScreen(
                            "mainScreen"
                        )
                );
            }

            if (e.aboutButton) {

                e.aboutButton.addEventListener(
                    "click",
                    () =>
                        this.showScreen(
                            "aboutScreen"
                        )
                );
            }

            if (e.aboutBackButton) {

                e.aboutBackButton.addEventListener(
                    "click",
                    () =>
                        this.showScreen(
                            "mainScreen"
                        )
                );
            }

            if (e.backButton) {

                e.backButton.addEventListener(
                    "click",
                    () =>
                        this.stopGame()
                );
            }
        },

        initializeRuntime() {

            try {

                this.runtime.initialize();

                console.log(
                    "[WebBktx] Core initialized."
                );

            } catch (error) {

                console.error(
                    error
                );

                this.fatal(
                    error.message
                );
            }
        },

        showScreen(id) {

            const screens = [

                "loadingScreen",
                "mainScreen",
                "cpuScreen",
                "aboutScreen",
                "gameScreen"

            ];

            for (const screen of screens) {

                const node =
                    document.getElementById(
                        screen
                    );

                if (!node) {
                    continue;
                }

                if (screen === id) {

                    node.classList.remove(
                        "hidden"
                    );

                } else {

                    node.classList.add(
                        "hidden"
                    );
                }
            }
        },

        setMessage(
            text,
            type = ""
        ) {

            const node =
                this.elements.message;

            if (!node) {
                return;
            }

            node.textContent =
                String(text);

            node.className =
                "system-message";

            if (type) {
                node.classList.add(type);
            }
        },

        onFileSelected(event) {

            const file =
                event.target.files &&
                event.target.files[0];

            if (!file) {

                this.currentFile = null;

                this.updateFileInfo(
                    "No file selected"
                );

                if (this.elements.startButton) {
                    this.elements.startButton.disabled =
                        true;
                }

                return;
            }

            this.currentFile = file;

            this.updateFileInfo(
                `${file.name} • ${this.formatBytes(file.size)}`
            );

            if (this.elements.gameName) {

                this.elements.gameName.textContent =
                    file.name;
            }

            if (this.elements.startButton) {

                this.elements.startButton.disabled =
                    false;
            }

            this.setMessage(
                "XBE selected. Ready to boot.",
                "success"
            );

            console.log(
                "[WebBktx] Selected file:",
                file.name,
                file.size
            );
        },

        updateFileInfo(text) {

            const node =
                this.elements.fileInfo;

            if (!node) {
                return;
            }

            const name =
                node.querySelector(
                    ".file-name"
                );

            if (name) {
                name.textContent = text;
            }
        },

        formatBytes(bytes) {

            if (bytes < 1024) {
                return `${bytes} B`;
            }

            if (bytes < 1024 * 1024) {

                return `${
                    (bytes / 1024)
                        .toFixed(1)
                } KB`;
            }

            return `${
                (bytes / 1024 / 1024)
                    .toFixed(2)
            } MB`;
        },

        async startGame() {

            if (!this.currentFile) {

                this.setMessage(
                    "Najpierw wybierz plik XBE.",
                    "error"
                );

                return;
            }

            const file =
                this.currentFile;

            try {

                this.setMessage(
                    "Loading XBE...",
                    "loading"
                );

                console.log(
                    "[WebBktx] Loading XBE:",
                    file.name
                );

                const result =
                    await this.runtime.loadXBE(
                        file
                    );

                console.log(
                    "[WebBktx] XBE LOAD RESULT:",
                    result
                );

                this.updateBootInformation(
                    result
                );

                const canvas =
                    this.elements.screen;

                if (!canvas) {

                    throw new Error(
                        "Canvas #screen not found."
                    );
                }

                this.runtime.attachCanvas(
                    canvas
                );

                const boot =
                    this.runtime.boot();

                console.log(
                    "[WebBktx] BOOT:",
                    boot
                );

                this.showScreen(
                    "gameScreen"
                );

                this.setMessage(
                    "XBE boot started.",
                    "success"
                );

                this.running = true;

                this.gameLoop();

            } catch (error) {

                console.error(
                    "[WebBktx] XBE BOOT ERROR:",
                    error
                );

                this.running = false;

                this.setMessage(
                    `XBE ERROR: ${error.message}`,
                    "error"
                );

                /*
                 * Keep the user in the application.
                 * Do not reload the page.
                 */
            }
        },

        updateBootInformation(result) {

            if (!result) {
                return;
            }

            console.log(
                "[WebBktx] Entry point:",
                result.entryPoint
            );

            console.log(
                "[WebBktx] XBE:",
                result.xbe
            );
        },

        gameLoop() {

            if (!this.running) {
                return;
            }

            try {

                const result =
                    this.runtime.runFrame();

                this.updateStatus(
                    result
                );

            } catch (error) {

                console.error(
                    "[WebBktx] Runtime frame error:",
                    error
                );

                this.running = false;

                this.setMessage(
                    `CPU ERROR: ${error.message}`,
                    "error"
                );

                return;
            }

            this.animationFrame =
                requestAnimationFrame(
                    () =>
                        this.gameLoop()
                );
        },

        updateStatus(result) {

            const status =
                this.runtime.status();

            const statusNodes =
                document.querySelectorAll(
                    ".emulator-status span"
                );

            if (
                statusNodes.length >= 4
            ) {

                statusNodes[0].textContent =
                    status.cpu.halted
                        ? "CPU: HALTED"
                        : "CPU: ONLINE";

                statusNodes[1].textContent =
                    "GPU: ONLINE";

                statusNodes[2].textContent =
                    "AUDIO: DISABLED";

                statusNodes[3].textContent =
                    `FPS: ${
                        status.graphics &&
                        status.graphics.frame
                            ? status.graphics.frame
                            : "--"
                    }`;
            }

            /*
             * Display CPU faults without killing
             * the application.
             */

            if (
                result &&
                result.faulted
            ) {

                this.running = false;

                this.setMessage(
                    `CPU FAULT: ${result.error}`,
                    "error"
                );
            }
        },

        stopGame() {

            this.running = false;

            if (
                this.animationFrame
            ) {

                cancelAnimationFrame(
                    this.animationFrame
                );

                this.animationFrame = 0;
            }

            try {

                this.runtime.stop();

            } catch (error) {

                console.error(
                    error
                );
            }

            this.showScreen(
                "mainScreen"
            );

            this.setMessage(
                "Emulator stopped.",
                ""
            );
        },

        showCPU() {

            this.showScreen(
                "cpuScreen"
            );

            const output =
                this.elements.cpuOutput;

            if (!output) {
                return;
            }

            try {

                const result =
                    this.runtime.selfTest();

                const status =
                    this.runtime.status();

                const lines = [];

                lines.push(
                    "WEBBKTX CPU DIAGNOSTIC"
                );

                lines.push(
                    "======================"
                );

                lines.push(
                    ""
                );

                lines.push(
                    `Runtime: ${status.runtime}`
                );

                lines.push(
                    `CPU: ${
                        result.cpu.passed
                            ? "AVAILABLE"
                            : "ERROR"
                    }`
                );

                lines.push(
                    "Decoder: AVAILABLE"
                );

                lines.push(
                    `Kernel: ${
                        status.kernel.ready
                            ? "READY"
                            : "ERROR"
                    }`
                );

                lines.push("");

                for (
                    const test
                    of result.cpu.tests
                ) {

                    lines.push(
                        `${
                            test.pass
                                ? "[PASS]"
                                : "[FAIL]"
                        } ${test.name}`
                    );
                }

                lines.push("");

                lines.push(
                    result.passed
                        ? "RESULT: CPU AVAILABLE"
                        : "RESULT: CPU ERROR"
                );

                lines.push("");

                lines.push(
                    "Runtime status:"
                );

                lines.push(
                    JSON.stringify(
                        {
                            runtime:
                                status.runtime,

                            memory:
                                status.memory,

                            cpu:
                                result.passed
                                    ? "available"
                                    : "error",

                            decoder:
                                "available",

                            xbe:
                                status.xbe
                                    ? "loaded"
                                    : "undefined",

                            kernel:
                                status.kernel.ready
                                    ? "ready"
                                    : "error",

                            thunks:
                                "available",

                            xapi:
                                "available",

                            xfile:
                                "available",

                            xinput:
                                status.xinput
                                    ? "available"
                                    : "undefined",

                            xgraphics:
                                status.graphics.available
                                    ? "available"
                                    : "undefined"
                        },
                        null,
                        2
                    )
                );

                output.textContent =
                    lines.join("\n");

                output.textContent +=
                    "\n\n" +
                    JSON.stringify(
                        {
                            runtime:
                                status.runtime,

                            memory:
                                status.memory,

                            cpu:
                                result.passed
                                    ? "available"
                                    : "error",

                            decoder:
                                "available",

                            xbe:
                                status.xbe
                                    ? "loaded"
                                    : "undefined",

                            kernel:
                                status.kernel.ready
                                    ? "ready"
                                    : "error",

                            thunks:
                                "available",

                            xapi:
                                "available",

                            xinput:
                                "available",

                            xgraphics:
                                "available"
                        },
                        null,
                        2
                    );

            } catch (error) {

                console.error(
                    "[WebBktx] CPU diagnostic:",
                    error
                );

                output.textContent =
                    "CPU DIAGNOSTIC ERROR\n\n" +
                    error.stack;
            }
        },

        fatal(message) {

            console.error(
                "[WebBktx] Runtime unavailable:",
                message
            );

            document.body.innerHTML = "";

            const box =
                document.createElement(
                    "pre"
                );

            box.style.cssText = `
                white-space: pre-wrap;
                margin: 40px;
                padding: 30px;
                background: #080b0d;
                color: #ff5555;
                border: 1px solid #552222;
                font-family: monospace;
                font-size: 16px;
            `;

            box.textContent =
                "WEBBKTX RUNTIME ERROR\n\n" +
                message;

            document.body.appendChild(
                box
            );
        }
    };

    window.WebBktxApp = App;

    /*
     * IMPORTANT:
     *
     * This must execute after webbktx.js.
     */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            () =>
                App.init()
        );

    } else {

        App.init();
    }

})();
