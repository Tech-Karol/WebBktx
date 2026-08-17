/*
 * ============================================================
 * WebBktx Core
 * Experimental Xbox-compatible emulation core
 *
 * Version: 0.3
 *
 * Current components:
 *   - 32-bit CPU test core
 *   - 1 MB emulated RAM
 *   - memory read/write
 *   - RAM diagnostics
 *   - instruction execution
 *   - local game file loader
 *   - XBE header detection
 *
 * NOTE:
 * This is NOT yet a complete Xbox emulator.
 * ============================================================
 */

"use strict";


/* ============================================================
   CONSTANTS
============================================================ */

const RAM_SIZE = 1024 * 1024;

const XBE_MAGIC = 0x48454258;


/* ============================================================
   MEMORY
============================================================ */

class WebBktxMemory {

    constructor(size = RAM_SIZE) {

        this.size = size;

        this.buffer =
            new ArrayBuffer(size);

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

        this.memory.fill(0);

    }


    checkAddress(address, bytes = 1) {

        if (
            !Number.isInteger(address) ||
            address < 0 ||
            address + bytes > this.size
        ) {

            throw new RangeError(
                `RAM address out of range: 0x${
                    address.toString(16)
                }`
            );

        }

    }


    read8(address) {

        this.checkAddress(address, 1);

        return this.view.getUint8(
            address
        );

    }


    read16(address) {

        this.checkAddress(address, 2);

        return this.view.getUint16(
            address,
            true
        );

    }


    read32(address) {

        this.checkAddress(address, 4);

        return this.view.getUint32(
            address,
            true
        );

    }


    write8(address, value) {

        this.checkAddress(address, 1);

        this.view.setUint8(
            address,
            value & 0xFF
        );

    }


    write16(address, value) {

        this.checkAddress(address, 2);

        this.view.setUint16(
            address,
            value & 0xFFFF,
            true
        );

    }


    write32(address, value) {

        this.checkAddress(address, 4);

        this.view.setUint32(
            address,
            value >>> 0,
            true
        );

    }


    writeBytes(address, bytes) {

        this.checkAddress(
            address,
            bytes.length
        );

        this.memory.set(
            bytes,
            address
        );

    }


    readBytes(address, length) {

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

    constructor(memory) {

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
            const register
            of Object.keys(
                this.registers
            )
        ) {

            this.registers[
                register
            ] = 0;

        }


        this.EIP = 0;

        this.EFLAGS = 0;

        this.cycles = 0;

        this.running = false;

        this.memory.clear();

    }


    /*
     * --------------------------------------------------------
     * Test instruction set
     * --------------------------------------------------------
     *
     * 0x01 = MOV EAX, immediate
     * 0x02 = ADD EAX, immediate
     * 0x03 = SUB EAX, immediate
     *
     */


    executeInstruction(
        instruction
    ) {

        if (
            !instruction ||
            typeof instruction.opcode !== "number"
        ) {

            throw new Error(
                "Invalid instruction."
            );

        }


        switch (
            instruction.opcode
        ) {


            case 0x01:

                this.registers.EAX =
                    instruction.value >>> 0;

                break;


            case 0x02:

                this.registers.EAX =
                    (
                        this.registers.EAX +
                        instruction.value
                    ) >>> 0;

                break;


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
                );

        }


        this.EIP++;

        this.cycles++;

    }


    run(program) {

        this.reset();

        this.running = true;


        for (
            const instruction
            of program
        ) {

            if (!this.running) {
                break;
            }


            this.executeInstruction(
                instruction
            );

        }


        this.running = false;


        return {
            registers:
                { ...this.registers },

            EIP:
                this.EIP,

            cycles:
                this.cycles

        };

    }


    stop() {

        this.running = false;

    }

}


/* ============================================================
   RAM DIAGNOSTICS
============================================================ */

function testRAM(memory) {

    const addresses = [

        0x00000,
        0x00001,
        0x00100,
        0x01000,
        0x10000,
        0x80000,
        0xFFFFF

    ];


    /*
     * Pattern AA
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
     * Pattern 55
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
   XBE LOADER
============================================================ */

class XBEImage {

    constructor(file) {

        this.file = file;

        this.buffer = null;

        this.bytes = null;

        this.valid = false;

        this.magic = null;

        this.header = {};

    }


    async load() {

        if (!this.file) {

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


        /*
         * XBE magic:
         *
         * "XBEH"
         *
         * Little endian:
         * 0x48454258
         */

        this.magic =
            new DataView(
                this.buffer
            ).getUint32(
                0,
                true
            );


        this.valid =
            this.magic === XBE_MAGIC;


        if (this.valid) {

            this.parseHeader();

        }


        return this;

    }


    parseHeader() {

        const view =
            new DataView(
                this.buffer
            );


        this.header.magic =
            view.getUint32(
                0,
                true
            );


        /*
         * Keep parsing deliberately conservative.
         *
         * The complete XBE format will be implemented
         * later as part of the loader.
         */


        this.header.size =
            this.bytes.length;

    }


    get status() {

        if (this.valid) {

            return "XBE";

        }


        return "UNKNOWN";

    }


    get size() {

        return this.bytes
            ? this.bytes.length
            : 0;

    }


    loadIntoMemory(
        memory,
        address = 0x10000
    ) {

        if (!this.bytes) {

            throw new Error(
                "XBE image has not been loaded."
            );

        }


        if (
            address +
            this.bytes.length >
            memory.size
        ) {

            throw new Error(
                "Game image does not fit in emulated RAM."
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
   GAME IMAGE LOADER
============================================================ */

async function loadGameFile(
    file,
    memory
) {

    const image =
        new XBEImage(
            file
        );


    await image.load();


    let memoryInfo =
        null;


    /*
     * Only load a recognized XBE
     * into the experimental RAM.
     */

    if (image.valid) {

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

        size:
            image.size,

        memory:
            memoryInfo

    };

}


/* ============================================================
   CORE
============================================================ */

class WebBktxCore {

    constructor() {

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

        this.game = null;

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

            ram,

            cpu,

            cpuPassed:
                cpu.registers.EAX === 30

        };

    }


    async loadGame(file) {

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

    X86CPU,

    WebBktxMemory,

    XBEImage,

    WebBktxCore,

    testRAM,

    loadGameFile

};
