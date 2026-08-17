/*
 * ============================================================
 * WebBktx Memory
 *
 * Version: 1.0 MAX
 *
 * Emulated Xbox memory subsystem
 *
 * Features:
 *   - Emulated RAM
 *   - 32-bit address space handling
 *   - Read/write 8/16/32
 *   - Bulk read/write
 *   - Read-only regions
 *   - Memory mapped regions
 *   - Address translation
 *   - Bounds checking
 *   - Stack support
 *   - Zero-filled memory
 *   - Memory dump
 *   - Memory statistics
 *   - Fast Uint8Array backing store
 *
 * Compatible with:
 *   CPU
 *   XBE Loader
 *   Kernel
 *   Core
 *
 * ============================================================
 */

"use strict";


/* ============================================================
   VERSION
============================================================ */

const WEBBKTX_MEMORY_VERSION = "1.0 MAX";


/* ============================================================
   DEFAULTS
============================================================ */

const MEMORY_DEFAULT_SIZE =
    64 * 1024 * 1024;


/* ============================================================
   MEMORY ERRORS
============================================================ */

class WebBktxMemoryError extends Error {

    constructor(
        message,
        address = null
    ) {

        super(message);

        this.name =
            "WebBktxMemoryError";

        this.address =
            address === null
                ? null
                : address >>> 0;

    }

}


/* ============================================================
   MEMORY REGION
============================================================ */

class WebBktxMemoryRegion {

    constructor(
        options = {}
    ) {

        this.name =
            options.name ||
            "region";

        this.start =
            options.start >>> 0;

        this.size =
            options.size >>> 0;

        this.end =
            (
                this.start +
                this.size
            ) >>> 0;

        this.read =
            options.read !== false;

        this.write =
            options.write !== false;

        this.execute =
            options.execute !== false;

        this.type =
            options.type ||
            "RAM";

        this.handler =
            options.handler ||
            null;

    }


    contains(
        address
    ) {

        address >>>= 0;

        return (
            address >= this.start &&
            address < this.end
        );

    }


    toJSON() {

        return {

            name:
                this.name,

            start:
                "0x" +
                this.start
                    .toString(16)
                    .padStart(8, "0")
                    .toUpperCase(),

            size:
                this.size,

            end:
                "0x" +
                this.end
                    .toString(16)
                    .padStart(8, "0")
                    .toUpperCase(),

            type:
                this.type,

            read:
                this.read,

            write:
                this.write,

            execute:
                this.execute

        };

    }

}


/* ============================================================
   MEMORY
============================================================ */

class WebBktxMemory {

    constructor(
        size = MEMORY_DEFAULT_SIZE,
        options = {}
    ) {

        /*
         * Support:
         *
         * new WebBktxMemory(size)
         *
         * new WebBktxMemory({
         *     size: ...
         * })
         */

        if (
            typeof size ===
            "object"
        ) {

            options =
                size;

            size =
                options.size ||
                MEMORY_DEFAULT_SIZE;

        }


        if (
            !Number.isSafeInteger(size) ||
            size <= 0
        ) {

            throw new WebBktxMemoryError(
                "Invalid memory size."
            );

        }


        this.size =
            size;


        /*
         * Main emulated RAM.
         */

        this.buffer =
            new ArrayBuffer(
                this.size
            );


        this.bytes =
            new Uint8Array(
                this.buffer
            );


        this.view =
            new DataView(
                this.buffer
            );


        /*
         * Regions.
         */

        this.regions =
            [];


        /*
         * Memory statistics.
         */

        this.stats = {

            reads8: 0,
            reads16: 0,
            reads32: 0,

            writes8: 0,
            writes16: 0,
            writes32: 0,

            bulkReads: 0,
            bulkWrites: 0,

            faults: 0

        };


        /*
         * Optional callbacks.
         */

        this.onRead =
            typeof options.onRead ===
            "function"
                ? options.onRead
                : null;


        this.onWrite =
            typeof options.onWrite ===
            "function"
                ? options.onWrite
                : null;


        /*
         * Clear RAM initially.
         */

        this.clear();


        /*
         * Create default RAM region.
         */

        this.addRegion({

            name:
                "Xbox RAM",

            start:
                0,

            size:
                this.size,

            type:
                "RAM",

            read:
                true,

            write:
                true,

            execute:
                true

        });

    }


    /* ========================================================
       ADDRESS VALIDATION
    ======================================================== */

    normalizeAddress(
        address
    ) {

        if (
            !Number.isInteger(address)
        ) {

            throw new WebBktxMemoryError(
                "Memory address must be an integer.",
                address
            );

        }


        return address >>> 0;

    }


    checkRange(
        address,
        length = 1
    ) {

        address =
            this.normalizeAddress(
                address
            );


        if (
            !Number.isInteger(length) ||
            length < 0
        ) {

            throw new WebBktxMemoryError(
                "Invalid memory range.",
                address
            );

        }


        /*
         * Avoid 32-bit overflow.
         */

        if (
            address >= this.size ||
            length > this.size - address
        ) {

            this.stats.faults++;


            throw new WebBktxMemoryError(

                `Memory access out of range: ` +
                `0x${address.toString(16)}`,

                address

            );

        }


        return true;

    }


    /* ========================================================
       CLEAR
    ======================================================== */

    clear(
        value = 0
    ) {

        this.bytes.fill(
            value & 0xFF
        );

    }


    /* ========================================================
       REGIONS
    ======================================================== */

    addRegion(
        options
    ) {

        const region =
            options instanceof
            WebBktxMemoryRegion

                ? options

                : new WebBktxMemoryRegion(
                    options
                );


        this.regions.push(
            region
        );


        return region;

    }


    removeRegion(
        name
    ) {

        this.regions =
            this.regions.filter(
                region =>
                    region.name !== name
            );

    }


    findRegion(
        address
    ) {

        address >>>= 0;


        /*
         * Search backwards so newer mappings
         * can override older ones.
         */

        for (
            let i =
                this.regions.length - 1;

            i >= 0;

            i--
        ) {

            const region =
                this.regions[i];


            if (
                region.contains(
                    address
                )
            ) {

                return region;

            }

        }


        return null;

    }


    /* ========================================================
       PERMISSIONS
    ======================================================== */

    checkRead(
        address,
        length
    ) {

        const region =
            this.findRegion(
                address
            );


        if (
            region &&
            !region.read
        ) {

            throw new WebBktxMemoryError(
                `Read access denied in ${region.name}.`,
                address
            );

        }


        this.checkRange(
            address,
            length
        );

    }


    checkWrite(
        address,
        length
    ) {

        const region =
            this.findRegion(
                address
            );


        if (
            region &&
            !region.write
        ) {

            throw new WebBktxMemoryError(
                `Write access denied in ${region.name}.`,
                address
            );

        }


        this.checkRange(
            address,
            length
        );

    }


    /* ========================================================
       READ 8
    ======================================================== */

    read8(
        address
    ) {

        address =
            this.normalizeAddress(
                address
            );


        this.checkRead(
            address,
            1
        );


        this.stats.reads8++;


        const value =
            this.bytes[address];


        if (
            this.onRead
        ) {

            this.onRead(
                address,
                1,
                value
            );

        }


        return value;

    }


    /* ========================================================
       READ 16
    ======================================================== */

    read16(
        address
    ) {

        address =
            this.normalizeAddress(
                address
            );


        this.checkRead(
            address,
            2
        );


        this.stats.reads16++;


        const value =
            this.view.getUint16(
                address,
                true
            );


        if (
            this.onRead
        ) {

            this.onRead(
                address,
                2,
                value
            );

        }


        return value;

    }


    /* ========================================================
       READ 32
    ======================================================== */

    read32(
        address
    ) {

        address =
            this.normalizeAddress(
                address
            );


        this.checkRead(
            address,
            4
        );


        this.stats.reads32++;


        const value =
            this.view.getUint32(
                address,
                true
            );


        if (
            this.onRead
        ) {

            this.onRead(
                address,
                4,
                value
            );

        }


        return value >>> 0;

    }


    /* ========================================================
       WRITE 8
    ======================================================== */

    write8(
        address,
        value
    ) {

        address =
            this.normalizeAddress(
                address
            );


        this.checkWrite(
            address,
            1
        );


        value &=
            0xFF;


        this.bytes[address] =
            value;


        this.stats.writes8++;


        if (
            this.onWrite
        ) {

            this.onWrite(
                address,
                1,
                value
            );

        }

    }


    /* ========================================================
       WRITE 16
    ======================================================== */

    write16(
        address,
        value
    ) {

        address =
            this.normalizeAddress(
                address
            );


        this.checkWrite(
            address,
            2
        );


        this.view.setUint16(
            address,
            value & 0xFFFF,
            true
        );


        this.stats.writes16++;


        if (
            this.onWrite
        ) {

            this.onWrite(
                address,
                2,
                value & 0xFFFF
            );

        }

    }


    /* ========================================================
       WRITE 32
    ======================================================== */

    write32(
        address,
        value
    ) {

        address =
            this.normalizeAddress(
                address
            );


        this.checkWrite(
            address,
            4
        );


        value >>>
            0;


        this.view.setUint32(
            address,
            value >>> 0,
            true
        );


        this.stats.writes32++;


        if (
            this.onWrite
        ) {

            this.onWrite(
                address,
                4,
                value >>> 0
            );

        }

    }


    /* ========================================================
       BULK READ
    ======================================================== */

    readBytes(
        address,
        length
    ) {

        address =
            this.normalizeAddress(
                address
            );


        this.checkRead(
            address,
            length
        );


        this.stats.bulkReads++;


        return this.bytes.slice(
            address,
            address + length
        );

    }


    /* ========================================================
       BULK WRITE
    ======================================================== */

    writeBytes(
        address,
        data
    ) {

        address =
            this.normalizeAddress(
                address
            );


        if (
            data instanceof
            ArrayBuffer
        ) {

            data =
                new Uint8Array(
                    data
                );

        }


        if (
            !(data instanceof Uint8Array)
        ) {

            throw new WebBktxMemoryError(
                "writeBytes requires Uint8Array or ArrayBuffer.",
                address
            );

        }


        this.checkWrite(
            address,
            data.length
        );


        this.bytes.set(
            data,
            address
        );


        this.stats.bulkWrites++;


        if (
            this.onWrite
        ) {

            this.onWrite(
                address,
                data.length,
                data
            );

        }

    }


    /* ========================================================
       COPY
    ======================================================== */

    copy(
        source,
        destination,
        length
    ) {

        source =
            this.normalizeAddress(
                source
            );

        destination =
            this.normalizeAddress(
                destination
            );


        this.checkRead(
            source,
            length
        );

        this.checkWrite(
            destination,
            length
        );


        this.bytes.copyWithin(
            destination,
            source,
            source + length
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

        address =
            this.normalizeAddress(
                address
            );


        this.checkWrite(
            address,
            length
        );


        this.bytes.fill(
            value & 0xFF,
            address,
            address + length
        );

    }


    /* ========================================================
       STACK HELPERS
    ======================================================== */

    push32(
        stackPointer,
        value
    ) {

        stackPointer =
            (
                stackPointer -
                4
            ) >>> 0;


        this.write32(
            stackPointer,
            value
        );


        return stackPointer;

    }


    pop32(
        stackPointer
    ) {

        const value =
            this.read32(
                stackPointer
            );


        stackPointer =
            (
                stackPointer +
                4
            ) >>> 0;


        return {

            value:
                value >>> 0,

            stackPointer:
                stackPointer

        };

    }


    /* ========================================================
       EXECUTABLE CHECK
    ======================================================== */

    isExecutable(
        address
    ) {

        const region =
            this.findRegion(
                address
            );


        if (
            !region
        ) {

            return false;

        }


        return region.execute;

    }


    /* ========================================================
       READ STRING
    ======================================================== */

    readCString(
        address,
        maxLength = 256
    ) {

        address =
            this.normalizeAddress(
                address
            );


        let result = "";


        for (
            let i = 0;
            i < maxLength;
            i++
        ) {

            const value =
                this.read8(
                    address + i
                );


            if (
                value === 0
            ) {

                break;

            }


            result +=
                String.fromCharCode(
                    value
                );

        }


        return result;

    }


    /* ========================================================
       WRITE STRING
    ======================================================== */

    writeCString(
        address,
        text,
        maxLength = null
    ) {

        address =
            this.normalizeAddress(
                address
            );


        const string =
            String(text);


        const limit =
            maxLength === null
                ? string.length
                : Math.min(
                    string.length,
                    maxLength
                );


        this.checkWrite(
            address,
            limit + 1
        );


        for (
            let i = 0;
            i < limit;
            i++
        ) {

            this.bytes[
                address + i
            ] =
                string.charCodeAt(i)
                & 0xFF;

        }


        this.bytes[
            address + limit
        ] = 0;

    }


    /* ========================================================
       MEMORY DUMP
    ======================================================== */

    dump(
        address,
        length = 256
    ) {

        const bytes =
            this.readBytes(
                address,
                length
            );


        const lines =
            [];


        for (
            let i = 0;
            i < bytes.length;
            i += 16
        ) {

            const chunk =
                bytes.slice(
                    i,
                    i + 16
                );


            const hex =
                Array.from(
                    chunk
                )
                .map(
                    value =>
                        value
                            .toString(16)
                            .padStart(
                                2,
                                "0"
                            )
                            .toUpperCase()
                )
                .join(" ");


            const ascii =
                Array.from(
                    chunk
                )
                .map(
                    value =>
                        value >= 32 &&
                        value <= 126

                            ? String.fromCharCode(
                                value
                            )

                            : "."
                )
                .join("");


            lines.push(

                "0x" +
                (
                    address + i
                )
                .toString(16)
                .padStart(
                    8,
                    "0"
                )
                .toUpperCase() +

                "  " +

                hex.padEnd(
                    47,
                    " "
                ) +

                "  " +

                ascii

            );

        }


        return lines.join(
            "\n"
        );

    }


    /* ========================================================
       SNAPSHOT
    ======================================================== */

    snapshot() {

        return this.bytes.slice();

    }


    restore(
        snapshot
    ) {

        if (
            !(snapshot instanceof Uint8Array)
        ) {

            throw new WebBktxMemoryError(
                "Invalid memory snapshot."
            );

        }


        if (
            snapshot.length !==
            this.size
        ) {

            throw new WebBktxMemoryError(
                "Snapshot size does not match RAM size."
            );

        }


        this.bytes.set(
            snapshot
        );

    }


    /* ========================================================
       STATISTICS
    ======================================================== */

    getStatistics() {

        return {

            size:
                this.size,

            sizeMB:
                this.size /
                1024 /
                1024,

            reads8:
                this.stats.reads8,

            reads16:
                this.stats.reads16,

            reads32:
                this.stats.reads32,

            writes8:
                this.stats.writes8,

            writes16:
                this.stats.writes16,

            writes32:
                this.stats.writes32,

            bulkReads:
                this.stats.bulkReads,

            bulkWrites:
                this.stats.bulkWrites,

            faults:
                this.stats.faults

        };

    }


    /* ========================================================
       STATUS
    ======================================================== */

    getStatus() {

        return {

            version:
                WEBBKTX_MEMORY_VERSION,

            size:
                this.size,

            sizeMB:
                this.size /
                1024 /
                1024,

            regions:
                this.regions.map(
                    region =>
                        region.toJSON()
                ),

            statistics:
                this.getStatistics()

        };

    }


    /* ========================================================
       SELF TEST
    ======================================================== */

    selfTest() {

        const address =
            0x1000;


        const original =
            this.read32(
                address
            );


        this.write32(
            address,
            0x12345678
        );


        const value =
            this.read32(
                address
            );


        if (
            value !==
            0x12345678
        ) {

            return {

                passed: false,

                test:
                    "READ/WRITE32",

                expected:
                    "0x12345678",

                received:
                    "0x" +
                    value.toString(16)

            };

        }


        this.write16(
            address,
            0xABCD
        );


        if (
            this.read16(address) !==
            0xABCD
        ) {

            return {

                passed: false,

                test:
                    "READ/WRITE16"

            };

        }


        this.write8(
            address,
            0xEF
        );


        if (
            this.read8(address) !==
            0xEF
        ) {

            return {

                passed: false,

                test:
                    "READ/WRITE8"

            };

        }


        this.writeBytes(
            address,
            new Uint8Array([
                1,
                2,
                3,
                4
            ])
        );


        const bytes =
            this.readBytes(
                address,
                4
            );


        if (
            bytes[0] !== 1 ||
            bytes[1] !== 2 ||
            bytes[2] !== 3 ||
            bytes[3] !== 4
        ) {

            return {

                passed: false,

                test:
                    "BULK MEMORY"

            };

        }


        this.write32(
            address,
            original
        );


        return {

            passed: true,

            memory:
                "WebBktx Memory 1.0 MAX",

            ram:
                this.size,

            ramMB:
                this.size /
                1024 /
                1024,

            readWrite:
                "PASS",

            bulk:
                "PASS",

            regions:
                this.regions.length

        };

    }

}


/* ============================================================
   EXPORT
============================================================ */

window.WebBktxMemory =
    WebBktxMemory;


window.WebBktxMemoryRegion =
    WebBktxMemoryRegion;


window.WebBktxMemoryError =
    WebBktxMemoryError;


/* ============================================================
   READY
============================================================ */

console.log(
    `WebBktx Memory ${WEBBKTX_MEMORY_VERSION} loaded.`
);
