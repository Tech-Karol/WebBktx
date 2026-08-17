/*
 * ============================================================
 * WebBktx Memory
 *
 * Version: 0.7A
 *
 * Emulated memory subsystem
 *
 * Features:
 *   - 16 MB emulated RAM
 *   - 8 / 16 / 32-bit read
 *   - 8 / 16 / 32-bit write
 *   - byte block read/write
 *   - memory clear
 *   - address validation
 *   - memory diagnostics
 *   - hexadecimal memory dump
 *
 * ============================================================
 */

"use strict";


/* ============================================================
   CONFIGURATION
============================================================ */

const WEBBKTX_RAM_SIZE =
    16 * 1024 * 1024;


/* ============================================================
   MEMORY CLASS
============================================================ */

class WebBktxMemory {

    constructor(size = WEBBKTX_RAM_SIZE) {

        if (
            !Number.isInteger(size) ||
            size <= 0
        ) {

            throw new Error(
                "Invalid memory size."
            );

        }


        this.size = size;


        /*
         * Main memory buffer.
         */

        this.buffer =
            new ArrayBuffer(
                this.size
            );


        /*
         * Byte access.
         */

        this.bytes =
            new Uint8Array(
                this.buffer
            );


        /*
         * Multi-byte access.
         */

        this.view =
            new DataView(
                this.buffer
            );


        /*
         * Statistics.
         */

        this.readOperations = 0;

        this.writeOperations = 0;

    }


    /* ========================================================
       RESET / CLEAR
    ======================================================== */

    clear() {

        this.bytes.fill(0);

        this.readOperations = 0;

        this.writeOperations = 0;

    }


    /* ========================================================
       ADDRESS VALIDATION
    ======================================================== */

    checkAddress(
        address,
        length = 1
    ) {

        if (
            !Number.isInteger(address)
        ) {

            throw new TypeError(
                "Memory address must be an integer."
            );

        }


        if (
            !Number.isInteger(length) ||
            length < 1
        ) {

            throw new TypeError(
                "Memory access length is invalid."
            );

        }


        if (
            address < 0
        ) {

            throw new RangeError(
                `Negative memory address: 0x${
                    address.toString(16)
                }`
            );

        }


        if (
            address + length > this.size
        ) {

            throw new RangeError(
                `Memory access outside RAM: ` +
                `0x${address.toString(16)}`
            );

        }

    }


    /* ========================================================
       8-BIT
    ======================================================== */

    read8(address) {

        this.checkAddress(
            address,
            1
        );


        this.readOperations++;


        return this.view.getUint8(
            address
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


        this.writeOperations++;


        this.view.setUint8(
            address,
            value & 0xFF
        );

    }


    /* ========================================================
       16-BIT
    ======================================================== */

    read16(address) {

        this.checkAddress(
            address,
            2
        );


        this.readOperations++;


        /*
         * Xbox/x86 is little-endian.
         */

        return this.view.getUint16(
            address,
            true
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


        this.writeOperations++;


        this.view.setUint16(
            address,
            value & 0xFFFF,
            true
        );

    }


    /* ========================================================
       32-BIT
    ======================================================== */

    read32(address) {

        this.checkAddress(
            address,
            4
        );


        this.readOperations++;


        return this.view.getUint32(
            address,
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


        this.writeOperations++;


        this.view.setUint32(
            address,
            value >>> 0,
            true
        );

    }


    /* ========================================================
       SIGNED READS
    ======================================================== */

    readS8(address) {

        this.checkAddress(
            address,
            1
        );


        this.readOperations++;


        return this.view.getInt8(
            address
        );

    }


    readS16(address) {

        this.checkAddress(
            address,
            2
        );


        this.readOperations++;


        return this.view.getInt16(
            address,
            true
        );

    }


    readS32(address) {

        this.checkAddress(
            address,
            4
        );


        this.readOperations++;


        return this.view.getInt32(
            address,
            true
        );

    }


    /* ========================================================
       BYTE BLOCKS
    ======================================================== */

    readBytes(
        address,
        length
    ) {

        this.checkAddress(
            address,
            length
        );


        this.readOperations++;


        return this.bytes.slice(
            address,
            address + length
        );

    }


    writeBytes(
        address,
        data
    ) {

        if (
            !(data instanceof Uint8Array)
        ) {

            data =
                new Uint8Array(
                    data
                );

        }


        this.checkAddress(
            address,
            data.length
        );


        this.writeOperations++;


        this.bytes.set(
            data,
            address
        );

    }


    /* ========================================================
       FILL
    ======================================================== */

    fill(
        address,
        length,
        value = 0
    ) {

        this.checkAddress(
            address,
            length
        );


        this.bytes.fill(
            value & 0xFF,
            address,
            address + length
        );


        this.writeOperations++;

    }


    /* ========================================================
       COPY
    ======================================================== */

    copy(
        source,
        destination,
        length
    ) {

        this.checkAddress(
            source,
            length
        );


        this.checkAddress(
            destination,
            length
        );


        const data =
            this.bytes.slice(
                source,
                source + length
            );


        this.bytes.set(
            data,
            destination
        );


        this.readOperations++;

        this.writeOperations++;

    }


    /* ========================================================
       ZERO BLOCK
    ======================================================== */

    zero(
        address,
        length
    ) {

        this.fill(
            address,
            length,
            0
        );

    }


    /* ========================================================
       MEMORY DUMP
    ======================================================== */

    dump(
        address,
        length = 64
    ) {

        this.checkAddress(
            address,
            length
        );


        const data =
            this.bytes.slice(
                address,
                address + length
            );


        const lines = [];


        for (
            let offset = 0;
            offset < data.length;
            offset += 16
        ) {

            const row =
                data.slice(
                    offset,
                    offset + 16
                );


            const hex =
                Array.from(row)
                    .map(
                        byte =>
                            byte
                                .toString(16)
                                .padStart(
                                    2,
                                    "0"
                                )
                                .toUpperCase()
                    )
                    .join(" ");


            const ascii =
                Array.from(row)
                    .map(
                        byte =>
                            byte >= 32 &&
                            byte <= 126
                                ? String.fromCharCode(byte)
                                : "."
                    )
                    .join("");


            lines.push(
                `${(
                    address + offset
                )
                    .toString(16)
                    .padStart(
                        8,
                        "0"
                    )
                    .toUpperCase()}  ` +
                `${hex.padEnd(47, " ")}  ` +
                `|${ascii}|`
            );

        }


        return lines.join("\n");

    }


    /* ========================================================
       MEMORY INFORMATION
    ======================================================== */

    getInfo() {

        return {

            size:
                this.size,

            sizeMB:
                this.size /
                1024 /
                1024,

            readOperations:
                this.readOperations,

            writeOperations:
                this.writeOperations

        };

    }


    /* ========================================================
       TEST
    ======================================================== */

    selfTest() {

        const testAddress =
            0x1000;


        /*
         * Save original value.
         */

        const original =
            this.read32(
                testAddress
            );


        /*
         * 32-bit test.
         */

        this.write32(
            testAddress,
            0x12345678
        );


        const value32 =
            this.read32(
                testAddress
            );


        if (
            value32 !== 0x12345678
        ) {

            return {

                passed: false,

                test:
                    "32-BIT",

                expected:
                    "0x12345678",

                received:
                    "0x" +
                    value32
                        .toString(16)
                        .padStart(
                            8,
                            "0"
                        )

            };

        }


        /*
         * 16-bit test.
         */

        this.write16(
            testAddress,
            0xABCD
        );


        const value16 =
            this.read16(
                testAddress
            );


        if (
            value16 !== 0xABCD
        ) {

            return {

                passed: false,

                test:
                    "16-BIT",

                expected:
                    "0xABCD",

                received:
                    "0x" +
                    value16
                        .toString(16)
                        .padStart(
                            4,
                            "0"
                        )

            };

        }


        /*
         * 8-bit test.
         */

        this.write8(
            testAddress,
            0xEF
        );


        const value8 =
            this.read8(
                testAddress
            );


        if (
            value8 !== 0xEF
        ) {

            return {

                passed: false,

                test:
                    "8-BIT",

                expected:
                    "0xEF",

                received:
                    "0x" +
                    value8
                        .toString(16)
                        .padStart(
                            2,
                            "0"
                        )

            };

        }


        /*
         * Restore original memory.
         */

        this.write32(
            testAddress,
            original
        );


        return {

            passed:
                true,

            test:
                "MEMORY",

            size:
                this.size,

            sizeMB:
                this.size /
                1024 /
                1024

        };

    }

}


/* ============================================================
   GLOBAL EXPORT
============================================================ */

window.WebBktxMemory =
    WebBktxMemory;


window.WebBktxMemoryConfig = {

    RAM_SIZE:
        WEBBKTX_RAM_SIZE

};


console.log(
    `WebBktx Memory 0.7A loaded — ` +
    `${WEBBKTX_RAM_SIZE / 1024 / 1024} MB RAM`
);
