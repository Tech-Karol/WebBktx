/*
 * ============================================================
 * WebBktx Core
 * Experimental Original Xbox Emulator
 *
 * Version: 0.4
 *
 * Components:
 *   - 32-bit x86 test CPU
 *   - 64 MB emulated RAM
 *   - Memory read/write
 *   - RAM diagnostics
 *   - XBE detection
 *   - XBE header parsing
 *   - XBE image loading
 *   - Local game file support
 *
 * NOTE:
 * This is an experimental emulator core.
 * It is NOT yet a complete Xbox emulator.
 * ============================================================
 */

"use strict";


/* ============================================================
   VERSION
============================================================ */

const WEBBKTX_VERSION = "0.4";


/* ============================================================
   MEMORY
============================================================ */

/*
 * 64 MB experimental RAM.
 *
 * Later this can be replaced with a more accurate
 * Xbox memory map.
 */

const RAM_SIZE =
    64 * 1024 * 1024;


/* ============================================================
   XBE
============================================================ */

/*
 * XBE magic:
 *
 * ASCII:
 * X B E H
 *
 * Little endian:
 * 0x48454258
 */

const XBE_MAGIC =
    0x48454258;


/* ============================================================
   MEMORY CLASS
============================================================ */

class WebBktxMemory {

    constructor(
        size = RAM_SIZE
    ) {

        this.size =
            size;


        this.buffer =
            new ArrayBuffer(
                size
            );


        this.memory =
            new Uint8Array(
                this.buffer
            );


        this.view =
            new DataView(
                this.buffer
            );

    }


    clear() {

        this.memory.fill(
            0
        );

    }


    checkAddress(
        address,
        bytes = 1
    ) {

        if (
            !Number.isInteger(
                address
            )
        ) {

            throw new TypeError(
                "Memory address must be an integer."
            );

        }


        if (
            address < 0 ||
            address + bytes > this.size
        ) {

            throw new RangeError(

                "RAM address out of range: 0x" +

                address
                    .toString(16)
                    .toUpperCase()

            );

        }

    }


    read8(
        address
    ) {

        this.checkAddress(
            address,
            1
        );


        return this.view.getUint8(
            address
        );

    }


    read16(
        address
    ) {

        this.checkAddress(
            address,
            2
        );


        return this.view.getUint16(
            address,
            true
        );

    }


    read32(
        address
    ) {

        this.checkAddress(
            address,
            4
        );


        return this.view.getUint32(
            address,
            true
        );

    }


    write8(
        address,
        value
    ) {

        this.checkAddress(
            address,
            1
        );


        this.view.setUint8(
            address,
            value & 0xFF
        );

    }


    write16(
        address,
        value
    ) {

        this.checkAddress(
            address,
            2
        );


        this.view.setUint16(
            address,
            value & 0xFFFF,
            true
        );

    }


    write32(
        address,
        value
    ) {

        this.checkAddress(
            address,
            4
        );


        this.view.setUint32(
            address,
            value >>> 0,
            true
        );

    }


    writeBytes(
        address,
        bytes
    ) {

        this.checkAddress(
            address,
            bytes.length
        );


        this.memory.set(
            bytes,
            address
        );

    }


    readBytes(
        address,
        length
    ) {

        this.checkAddress(
            address,
            length
        );


        return this.memory.slice(
            address,
            address + length
        );

    }


    get bufferView() {

        return this.memory;

    }

}


/* ============================================================
   X86 CPU
============================================================ */

class X86CPU {

    constructor(
        memory
    ) {

        this.memory =
            memory ||
            new WebBktxMemory();


        this.registers = {

            EAX: 0,
            EBX: 0,
            ECX: 0,
            EDX: 0,

            ESI: 0,
            EDI: 0,

            EBP: 0,
            ESP: 0

        };


        this.EIP = 0;

        this.EFLAGS = 0;

        this.running = false;

        this.cycles = 0;

    }


    reset() {

        for (
            const name
            of Object.keys(
                this.registers
            )
        ) {

            this.registers[name] =
                0;

        }


        this.EIP =
            0;


        this.EFLAGS =
            0;


        this.cycles =
            0;


        this.running =
            false;

    }


    executeInstruction(
        instruction
    ) {

        if (
            !instruction ||
            typeof instruction.opcode !==
            "number"
        ) {

            throw new Error(
                "Invalid instruction."
            );

        }


        switch (
            instruction.opcode
        ) {


            /*
             * TEST ISA
             *
             * 01:
             * MOV EAX, immediate
             */

            case 0x01:

                this.registers.EAX =
                    instruction.value >>> 0;

                break;


            /*
             * 02:
             * ADD EAX, immediate
             */

            case 0x02:

                this.registers.EAX =
                    (
                        this.registers.EAX +
                        instruction.value
                    ) >>> 0;

                break;


            /*
             * 03:
             * SUB EAX, immediate
             */

            case 0x03:

                this.registers.EAX =
                    (
                        this.registers.EAX -
                        instruction.value
                    ) >>> 0;

                break;


            default:

                throw new Error(

                    "Unknown test opcode: 0x" +

                    instruction.opcode
                        .toString(16)
                        .toUpperCase()

                );

        }


        this.EIP++;

        this.cycles++;

    }


    run(
        program
    ) {

        this.reset();

        this.running =
            true;


        for (
            const instruction
            of program
        ) {

            if (
                !this.running
            ) {

                break;

            }


            this.executeInstruction(
                instruction
            );

        }


        this.running =
            false;


        return {

            registers:
                {
                    ...this.registers
                },

            EIP:
                this.EIP,

            EFLAGS:
                this.EFLAGS,

            cycles:
                this.cycles

        };

    }


    stop() {

        this.running =
            false;

    }

}


/* ============================================================
   RAM DIAGNOSTICS
============================================================ */

function testRAM(
    memory
) {

    const addresses = [

        0x000000,
        0x000001,
        0x000100,
        0x001000,
        0x010000,
        0x100000,
        0x400000,
        0x800000,
        0xFFFFFF

    ];


    /*
     * 0xAA test
     */

    for (
        const address
        of addresses
    ) {

        memory.write8(
            address,
            0xAA
        );


        const value =
            memory.read8(
                address
            );


        if (
            value !== 0xAA
        ) {

            return {

                passed: false,

                test: "0xAA",

                address,

                expected: 0xAA,

                received: value

            };

        }

    }


    /*
     * 0x55 test
     */

    for (
        const address
        of addresses
    ) {

        memory.write8(
            address,
            0x55
        );


        const value =
            memory.read8(
                address
            );


        if (
            value !== 0x55
        ) {

            return {

                passed: false,

                test: "0x55",

                address,

                expected: 0x55,

                received: value

            };

        }

    }


    /*
     * Address test
     */

    for (
        let i = 0;
        i < addresses.length;
        i++
    ) {

        memory.write8(
            addresses[i],
            i + 1
        );

    }


    for (
        let i = 0;
        i < addresses.length;
        i++
    ) {

        const value =
            memory.read8(
                addresses[i]
            );


        if (
            value !== i + 1
        ) {

            return {

                passed: false,

                test: "ADDRESS",

                address:
                    addresses[i],

                expected:
                    i + 1,

                received:
                    value

            };

        }

    }


    return {

        passed: true,

        size:
            memory.size

    };

}


/* ============================================================
   XBE IMAGE
============================================================ */

class XBEImage {

    constructor(
        file
    ) {

        this.file =
            file;


        this.buffer =
            null;


        this.bytes =
            null;


        this.valid =
            false;


        this.magic =
            null;


        this.header =
            {};

    }


    async load() {

        if (
            !this.file
        ) {

            throw new Error(
                "No game file supplied."
            );

        }


        this.buffer =
            await this.file.arrayBuffer();


        this.bytes =
            new Uint8Array(
                this.buffer
            );


        if (
            this.bytes.length < 4
        ) {

            throw new Error(
                "Game file is too small."
            );

        }


        const view =
            new DataView(
                this.buffer
            );


        this.magic =
            view.getUint32(
                0,
                true
            );


        this.valid =
            this.magic ===
            XBE_MAGIC;


        if (
            this.valid
        ) {

            this.parseHeader();

        }


        return this;

    }


    parseHeader() {

        const view =
            new DataView(
                this.buffer
            );


        /*
         * Basic XBE header information.
         *
         * We deliberately keep this parser
         * conservative for now.
         */

        this.header = {

            magic:
                view.getUint32(
                    0x00,
                    true
                ),

            baseAddress:
                this.readSafe32(
                    view,
                    0x104
                ),

            size:
                this.bytes.length

        };

    }


    readSafe32(
        view,
        offset
    ) {

        if (
            offset + 4 >
            view.byteLength
        ) {

            return 0;

        }


        return view.getUint32(
            offset,
            true
        );

    }


    get status() {

        return this.valid
            ? "XBE"
            : "UNKNOWN";

    }


    get size() {

        return this.bytes
            ? this.bytes.length
            : 0;

    }


    get magicString() {

        if (
            !this.valid
        ) {

            return "UNKNOWN";

        }


        return "XBEH";

    }


    loadIntoMemory(
        memory,
        address = 0x10000
    ) {

        if (
            !this.bytes
        ) {

            throw new Error(
                "XBE image has not been loaded."
            );

        }


        /*
         * The image itself can be larger than
         * the available emulated RAM.
         */

        if (
            address +
            this.bytes.length >
            memory.size
        ) {

            throw new Error(

                "XBE image is too large for " +

                (
                    memory.size /
                    1024 /
                    1024
                ) +

                " MB emulated RAM."

            );

        }


        memory.writeBytes(
            address,
            this.bytes
        );


        return {

            address,

            size:
                this.bytes.length

        };

    }

}


/* ============================================================
   GAME FILE LOADER
============================================================ */

async function loadGameFile(
    file,
    memory
) {

    if (
        !memory
    ) {

        throw new Error(
            "Memory system unavailable."
        );

    }


    const image =
        new XBEImage(
            file
        );


    await image.load();


    let memoryInfo =
        null;


    if (
        image.valid
    ) {

        memoryInfo =
            image.loadIntoMemory(
                memory
            );

    }


    return {

        image,

        recognized:
            image.valid,

        format:
            image.status,

        magic:
            image.magicString,

        size:
            image.size,

        header:
            image.header,

        memory:
            memoryInfo

    };

}


/* ============================================================
   WEBBKTX CORE
============================================================ */

class WebBktxCore {

    constructor() {

        this.version =
            WEBBKTX_VERSION;


        this.memory =
            new WebBktxMemory(
                RAM_SIZE
            );


        this.cpu =
            new X86CPU(
                this.memory
            );


        this.game =
            null;

    }


    reset() {

        this.cpu.reset();

        this.memory.clear();

        this.game =
            null;

    }


    runDiagnostics() {

        const ram =
            testRAM(
                this.memory
            );


        const cpu =
            this.cpu.run([

                {
                    opcode: 0x01,
                    value: 10
                },

                {
                    opcode: 0x02,
                    value: 20
                }

            ]);


        return {

            version:
                this.version,

            ram,

            cpu,

            cpuPassed:
                cpu.registers.EAX === 30,

            ramSize:
                this.memory.size

        };

    }


    async loadGame(
        file
    ) {

        this.game =
            await loadGameFile(
                file,
                this.memory
            );


        return this.game;

    }


    stop() {

        this.cpu.stop();

    }

}


/* ============================================================
   PUBLIC API
============================================================ */

window.WebBktxCore = {

    version:
        WEBBKTX_VERSION,

    X86CPU:
        X86CPU,

    WebBktxMemory:
        WebBktxMemory,

    XBEImage:
        XBEImage,

    WebBktxCore:
        WebBktxCore,

    testRAM:
        testRAM,

    loadGameFile:
        loadGameFile

};


/* ============================================================
   CORE BOOT MESSAGE
============================================================ */

console.log(
    "[WebBktx] Core loaded successfully."
);

console.log(
    "[WebBktx] Version:",
    WEBBKTX_VERSION
);

console.log(
    "[WebBktx] RAM:",
    (
        RAM_SIZE /
        1024 /
        1024
    ) + " MB"
);

console.log(
    "[WebBktx] Public API:",
    window.WebBktxCore
);
