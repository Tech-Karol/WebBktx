"use strict";

console.log("=== WebBktx module test ===");

console.log(
    "Memory:",
    typeof window.WebBktxMemory
);

console.log(
    "CPU:",
    typeof window.WebBktxCPU
);

console.log(
    "XBE:",
    typeof window.WebBktxXBE
);

console.log(
    "Core:",
    typeof window.WebBktxCore
);

if (typeof window.WebBktxCore !== "function") {

    document.body.innerHTML = `
        <div style="
            background:#080b0d;
            color:#ddd;
            font-family:monospace;
            padding:30px;
        ">
            <h1>WebBktx CORE ERROR</h1>

            <p>Nie znaleziono WebBktxCore.</p>

            <pre>
Memory: ${typeof window.WebBktxMemory}
CPU:    ${typeof window.WebBktxCPU}
XBE:    ${typeof window.WebBktxXBE}
Core:   ${typeof window.WebBktxCore}
            </pre>

            <p>
            Sprawdź folder core/ i kolejność skryptów.
            </p>
        </div>
    `;

} else {

    document.body.innerHTML = `
        <div style="
            background:#080b0d;
            color:#ddd;
            font-family:monospace;
            padding:30px;
        ">
            <h1>WebBktx</h1>
            <p>CORE MODULES FOUND</p>
            <pre>
Memory: ${typeof window.WebBktxMemory}
CPU:    ${typeof window.WebBktxCPU}
XBE:    ${typeof window.WebBktxXBE}
Core:   ${typeof window.WebBktxCore}
            </pre>
        </div>
    `;

}
