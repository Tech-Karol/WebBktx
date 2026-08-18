/* ============================================================
   WEBBKTX GLOBAL RUNTIME EXPORT
============================================================ */

(function () {

    "use strict";

    if (typeof window === "undefined") {
        throw new Error(
            "WebBktx requires a browser window."
        );
    }

    /*
     * Unified runtime object.
     *
     * Everything is contained in this single runtime.
     */
    window.WebBktx = {

        version: WEBBKTX_VERSION,

        Memory: WebBktxMemory,

        CPU: WebBktxCPU,

        Decoder: WebBktxDecoder,

        XBE: WebBktxXBE,

        Thunks: WebBktxThunks,

        XAPI: WebBktxXAPI,

        XFile: WebBktxXFile,

        Kernel: WebBktxKernel,

        XInput: WebBktxXInput,

        Input: WebBktxXInput,

        XGraphics: WebBktxXGraphics,

        Graphics: WebBktxXGraphics,

        Core: WebBktxCore
    };


    /*
     * Legacy/global aliases.
     *
     * These are kept so existing app.js code
     * can continue working.
     */

    window.WebBktxMemory =
        WebBktxMemory;

    window.WebBktxCPU =
        WebBktxCPU;

    window.WebBktxCPUFlags =
        WebBktxCPUFlags;

    window.WebBktxDecoder =
        WebBktxDecoder;

    window.WebBktxXBE =
        WebBktxXBE;

    window.WebBktxThunks =
        WebBktxThunks;

    window.WebBktxXAPI =
        WebBktxXAPI;

    window.WebBktxXFile =
        WebBktxXFile;

    window.WebBktxKernel =
        WebBktxKernel;

    window.WebBktxXInput =
        WebBktxXInput;

    window.WebBktxInput =
        WebBktxXInput;

    window.WebBktxXGraphics =
        WebBktxXGraphics;

    window.WebBktxGraphics =
        WebBktxXGraphics;

    window.WebBktxCore =
        WebBktxCore;

    window.WebBktxVersion =
        WEBBKTX_VERSION;


    /*
     * Runtime diagnostic.
     */

    const status = {

        runtime:
            typeof window.WebBktx,

        version:
            window.WebBktx.version,

        memory:
            typeof window.WebBktx.Memory,

        cpu:
            typeof window.WebBktx.CPU,

        decoder:
            typeof window.WebBktx.Decoder,

        xbe:
            typeof window.WebBktx.XBE,

        thunks:
            typeof window.WebBktx.Thunks,

        xapi:
            typeof window.WebBktx.XAPI,

        xfile:
            typeof window.WebBktx.XFile,

        kernel:
            typeof window.WebBktx.Kernel,

        xinput:
            typeof window.WebBktx.XInput,

        xgraphics:
            typeof window.WebBktx.XGraphics,

        graphics:
            typeof window.WebBktx.Graphics,

        core:
            typeof window.WebBktx.Core
    };


    /*
     * Hard validation.
     */

    const required = [
        "Memory",
        "CPU",
        "Decoder",
        "XBE",
        "Thunks",
        "XAPI",
        "XFile",
        "Kernel",
        "XInput",
        "XGraphics",
        "Core"
    ];


    const missing =
        required.filter(
            name =>
                typeof window.WebBktx[name] !==
                "function"
        );


    if (missing.length > 0) {

        console.error(
            "[WebBktx] RUNTIME INCOMPLETE",
            missing
        );

        console.table(status);

        throw new Error(
            "WebBktx runtime incomplete. " +
            "Missing: " +
            missing.join(", ")
        );
    }


    console.log(
        `%c[WebBktx] Unified Runtime ${WEBBKTX_VERSION} loaded`,
        "font-weight:bold"
    );

    console.table(status);

})();
