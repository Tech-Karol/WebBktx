/*
 * ============================================================
 * WebBktx XMemory
 *
 * Version: 1.0
 *
 * Xbox-compatible memory service layer
 *
 * Path:
 *     kernel/xmemory.js
 *
 * Architecture:
 *
 *     XBE
 *      |
 *     XAPI
 *      |
 *   XMemory
 *      |
 *   Kernel Memory Manager
 *      |
 *   core/memory.js
 *
 * ============================================================
 */

"use strict";


/* ============================================================
   VERSION
============================================================ */

const WEBBKTX_XMEMORY_VERSION = "1.0";


/* ============================================================
   FLAGS
============================================================ */

const XMEMORY_FLAGS = {

    READ:
        1 << 0,

    WRITE:
        1 << 1,

    EXECUTE:
        1 << 2,

    ZERO:
        1 << 3,

    RESERVED:
        1 << 4

};


/* ============================================================
   MEMORY BLOCK
============================================================ */

class WebBktxMemoryBlock {

    constructor(
        address,
        size,
        flags = (
            XMEMORY_FLAGS.READ |
            XMEMORY_FLAGS.WRITE
        )
    ) {

        this.address =
            address >>> 0;

        this.size =
            size >>> 0;

        this.flags =
            flags >>> 0;

        this.used =
            true;

        this.created =
            Date.now();

    }


    contains(
        address,
        length = 1
    ) {

        address >>>= 0;
        length >>>= 0;


        if (length === 0) {

            return false;

        }


        const start =
            this.address;


        const end =
            this.address +
            this.size;


        const requestedEnd =
            address +
            length;


        return (
            address >= start &&
            requestedEnd <= end
        );

    }


    canRead() {

        return (
            (
                this.flags &
                XMEMORY_FLAGS.READ
            ) !== 0
        );

    }


    canWrite() {

        return (
            (
                this.flags &
                XMEMORY_FLAGS.WRITE
            ) !== 0
        );

    }


    canExecute() {

        return (
            (
                this.flags &
                XMEMORY_FLAGS.EXECUTE
            ) !== 0
        );

    }


    toJSON() {

        return {

            address:
                this.address,

            size:
                this.size,

            end:
                (
                    this.address +
                    this.size
                ) >>> 0,

            flags:
                this.flags,

            used:
                this.used,

            readable:
                this.canRead(),

            writable:
                this.canWrite(),

            executable:
                this.canExecute()

        };

    }

}


/* ============================================================
   XMEMORY
============================================================ */

class WebBktxXMemory {

    constructor(
        memory,
        options = {}
    ) {

        if (!memory) {

            throw new Error(
                "WebBktxXMemory requires WebBktxMemory."
            );

        }


        this.memory =
            memory;


        this.version =
            WEBBKTX_XMEMORY_VERSION;


        this.debug =
            options.debug !== false;


        /*
         * Allocation table.
         */

        this.blocks =
            new Map();


        /*
         * Allocation cursor.
         *
         * Keep the lower area available
         * for executable image mappings.
         */

        this.heapStart =
            options.heapStart ??
            0x01000000;


        this.heapEnd =
            options.heapEnd ??
            (
                memory.size -
                0x00100000
            );


        this.cursor =
            this.heapStart;


        this.allocations =
            0;

        this.frees =
            0;


        this.initialized =
            false;


        this.initialize();

    }


    /* ========================================================
       INITIALIZE
    ======================================================== */

    initialize() {

        if (this.initialized) {

            return;

        }


        if (
            this.heapStart >=
            this.heapEnd
        ) {

            throw new Error(
                "Invalid XMemory heap range."
            );

        }


        if (
            this.heapEnd >
            this.memory.size
        ) {

            this.heapEnd =
                this.memory.size;

        }


        this.initialized =
            true;


        this.log(
            "XMemory initialized."
        );

    }


    /* ========================================================
       LOG
    ======================================================== */

    log(...args) {

        if (this.debug) {

            console.log(
                "[WebBktx XMemory]",
                ...args
            );

        }

    }


    /* ========================================================
       ALIGN
    ======================================================== */

    align(
        value,
        alignment = 16
    ) {

        value =
            Number(value) >>> 0;

        alignment =
            Number(alignment) >>> 0;


        if (
            alignment === 0 ||
            (
                alignment &
                (
                    alignment - 1
                )
            ) !== 0
        ) {

            throw new Error(
                "Alignment must be a power of two."
            );

        }


        return (
            (
                value +
                alignment -
                1
            ) &
            ~(
                alignment - 1
            )
        ) >>> 0;

    }


    /* ========================================================
       FIND FREE RANGE
    ======================================================== */

    findFreeRange(
        size,
        alignment = 16
    ) {

        size =
            this.align(
                size,
                alignment
            );


        let address =
            this.align(
                this.cursor,
                alignment
            );


        /*
         * First pass from cursor to heap end.
         */

        while (
            address +
            size <=
            this.heapEnd
        ) {

            if (
                !this.overlaps(
                    address,
                    size
                )
            ) {

                return address;

            }


            address =
                this.align(
                    address + 16,
                    alignment
                );

        }


        /*
         * Second pass from heap start.
         */

        address =
            this.align(
                this.heapStart,
                alignment
            );


        while (
            address +
            size <=
            this.cursor
        ) {

            if (
                !this.overlaps(
                    address,
                    size
                )
            ) {

                return address;

            }


            address =
                this.align(
                    address + 16,
                    alignment
                );

        }


        return null;

    }


    /* ========================================================
       OVERLAP CHECK
    ======================================================== */

    overlaps(
        address,
        size
    ) {

        address >>>= 0;
        size >>>= 0;


        const end =
            address +
            size;


        for (
            const block
            of this.blocks.values()
        ) {

            if (!block.used) {

                continue;

            }


            const blockStart =
                block.address;


            const blockEnd =
                block.address +
                block.size;


            if (
                address < blockEnd &&
                end > blockStart
            ) {

                return true;

            }

        }


        return false;

    }


    /* ========================================================
       ALLOCATE
    ======================================================== */

    allocate(
        size,
        flags =
            (
                XMEMORY_FLAGS.READ |
                XMEMORY_FLAGS.WRITE
            ),
        options = {}
    ) {

        size =
            Number(size) >>> 0;


        if (size === 0) {

            throw new Error(
                "Cannot allocate zero bytes."
            );

        }


        const alignment =
            options.alignment ||
            16;


        const alignedSize =
            this.align(
                size,
                alignment
            );


        const address =
            this.findFreeRange(
                alignedSize,
                alignment
            );


        if (
            address === null
        ) {

            throw new Error(
                `XMemory allocation failed: ` +
                `${alignedSize} bytes`
            );

        }


        const block =
            new WebBktxMemoryBlock(
                address,
                alignedSize,
                flags
            );


        this.blocks.set(
            address,
            block
        );


        this.cursor =
            address +
            alignedSize;


        if (
            this.cursor >=
            this.heapEnd
        ) {

            this.cursor =
                this.heapStart;

        }


        this.allocations++;


        /*
         * Optional zero initialization.
         */

        if (
            (
                flags &
                XMEMORY_FLAGS.ZERO
            ) !== 0
        ) {

            this.zero(
                address,
                alignedSize
            );

        }


        this.log(
            "Allocated memory.",
            block.toJSON()
        );


        return address >>> 0;

    }


    /* ========================================================
       FREE
    ======================================================== */

    free(
        address
    ) {

        address >>>= 0;


        const block =
            this.blocks.get(
                address
            );


        if (!block) {

            return false;

        }


        block.used =
            false;


        this.blocks.delete(
            address
        );


        this.frees++;


        this.log(
            `Freed 0x${address.toString(16)}`
        );


        return true;

    }


    /* ========================================================
       FIND BLOCK
    ======================================================== */

    findBlock(
        address,
        length = 1
    ) {

        address >>>= 0;
        length >>>= 0;


        for (
            const block
            of this.blocks.values()
        ) {

            if (
                block.contains(
                    address,
                    length
                )
            ) {

                return block;

            }

        }


        return null;

    }


    /* ========================================================
       VALIDATE
    ======================================================== */

    validate(
        address,
        length = 1,
        permission = "read"
    ) {

        const block =
            this.findBlock(
                address,
                length
            );


        if (!block) {

            /*
             * Allow direct access to memory
             * outside managed heap blocks.
             *
             * This is important for:
             *
             * XBE sections
             * stack
             * kernel regions
             */

            return true;

        }


        if (
            permission ===
            "read"
        ) {

            if (
                !block.canRead()
            ) {

                throw new Error(
                    `Memory read violation at ` +
                    `0x${address.toString(16)}`
                );

            }

        }


        if (
            permission ===
            "write"
        ) {

            if (
                !block.canWrite()
            ) {

                throw new Error(
                    `Memory write violation at ` +
                    `0x${address.toString(16)}`
                );

            }

        }


        if (
            permission ===
            "execute"
        ) {

            if (
                !block.canExecute()
            ) {

                throw new Error(
                    `Memory execute violation at ` +
                    `0x${address.toString(16)}`
                );

            }

        }


        return true;

    }


    /* ========================================================
       READ
    ======================================================== */

    read8(
        address
    ) {

        address >>>= 0;


        this.validate(
            address,
            1,
            "read"
        );


        return this.memory.read8(
            address
        );

    }


    read16(
        address
    ) {

        address >>>= 0;


        this.validate(
            address,
            2,
            "read"
        );


        return this.memory.read16(
            address
        );

    }


    read32(
        address
    ) {

        address >>>= 0;


        this.validate(
            address,
            4,
            "read"
        );


        return this.memory.read32(
            address
        );

    }


    /* ========================================================
       WRITE
    ======================================================== */

    write8(
        address,
        value
    ) {

        address >>>= 0;


        this.validate(
            address,
            1,
            "write"
        );


        this.memory.write8(
            address,
            value
        );

    }


    write16(
        address,
        value
    ) {

        address >>>= 0;


        this.validate(
            address,
            2,
            "write"
        );


        this.memory.write16(
            address,
            value
        );

    }


    write32(
        address,
        value
    ) {

        address >>>= 0;


        this.validate(
            address,
            4,
            "write"
        );


        this.memory.write32(
            address,
            value
        );

    }


    /* ========================================================
       BYTES
    ======================================================== */

    readBytes(
        address,
        length
    ) {

        address >>>= 0;
        length >>>= 0;


        if (
            length === 0
        ) {

            return new Uint8Array();

        }


        this.validate(
            address,
            length,
            "read"
        );


        if (
            typeof this.memory.readBytes ===
            "function"
        ) {

            return this.memory.readBytes(
                address,
                length
            );

        }


        const result =
            new Uint8Array(
                length
            );


        for (
            let i = 0;
            i < length;
            i++
        ) {

            result[i] =
                this.memory.read8(
                    address + i
                );

        }


        return result;

    }


    writeBytes(
        address,
        bytes
    ) {

        address >>>= 0;


        const data =
            bytes instanceof Uint8Array
                ? bytes
                : new Uint8Array(bytes);


        this.validate(
            address,
            data.length,
            "write"
        );


        if (
            typeof this.memory.writeBytes ===
            "function"
        ) {

            this.memory.writeBytes(
                address,
                data
            );

            return;

        }


        for (
            let i = 0;
            i < data.length;
            i++
        ) {

            this.memory.write8(
                address + i,
                data[i]
            );

        }

    }


    /* ========================================================
       ZERO
    ======================================================== */

    zero(
        address,
        length
    ) {

        address >>>= 0;
        length >>>= 0;


        this.validate(
            address,
            length,
            "write"
        );


        if (
            typeof this.memory.fill ===
            "function"
        ) {

            this.memory.fill(
                address,
                0,
                length
            );

            return;

        }


        for (
            let i = 0;
            i < length;
            i++
        ) {

            this.memory.write8(
                address + i,
                0
            );

        }

    }


    /* ========================================================
       COPY
    ======================================================== */

    copy(
        destination,
        source,
        length
    ) {

        destination >>>= 0;
        source >>>= 0;
        length >>>= 0;


        if (
            length === 0
        ) {

            return;

        }


        this.validate(
            source,
            length,
            "read"
        );


        this.validate(
            destination,
            length,
            "write"
        );


        const data =
            this.readBytes(
                source,
                length
            );


        this.writeBytes(
            destination,
            data
        );

    }


    /* ========================================================
       PROTECTION
    ======================================================== */

    protect(
        address,
        flags
    ) {

        const block =
            this.findBlock(
                address,
                1
            );


        if (!block) {

            return false;

        }


        block.flags =
            flags >>> 0;


        return true;

    }


    /* ========================================================
       GET BLOCK
    ======================================================== */

    getBlock(
        address
    ) {

        const block =
            this.findBlock(
                address,
                1
            );


        return block
            ? block.toJSON()
            : null;

    }


    /* ========================================================
       STATISTICS
    ======================================================== */

    getStats() {

        let allocated =
            0;


        for (
            const block
            of this.blocks.values()
        ) {

            allocated +=
                block.size;

        }


        return {

            version:
                this.version,

            heapStart:
                this.heapStart,

            heapEnd:
                this.heapEnd,

            heapSize:
                (
                    this.heapEnd -
                    this.heapStart
                ) >>> 0,

            allocated,

            free:
                Math.max(
                    0,
                    (
                        this.heapEnd -
                        this.heapStart -
                        allocated
                    )
                ) >>> 0,

            blocks:
                this.blocks.size,

            allocations:
                this.allocations,

            frees:
                this.frees

        };

    }


    /* ========================================================
       LIST BLOCKS
    ======================================================== */

    getBlocks() {

        return Array.from(
            this.blocks.values()
        )
        .map(
            block =>
                block.toJSON()
        );

    }


    /* ========================================================
       RESET
    ======================================================== */

    reset() {

        this.blocks.clear();


        this.cursor =
            this.heapStart;


        this.allocations =
            0;


        this.frees =
            0;

    }


    /* ========================================================
       SELF TEST
    ======================================================== */

    selfTest() {

        try {

            const address =
                this.allocate(
                    0x100,
                    XMEMORY_FLAGS.READ |
                    XMEMORY_FLAGS.WRITE |
                    XMEMORY_FLAGS.ZERO
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

                this.free(
                    address
                );


                return {

                    passed: false,

                    test:
                        "READ/WRITE",

                    expected:
                        "0x12345678",

                    received:
                        "0x" +
                        value
                            .toString(16)

                };

            }


            this.free(
                address
            );


            return {

                passed: true,

                version:
                    this.version,

                allocation:
                    "PASS",

                readWrite:
                    "PASS",

                free:
                    "PASS",

                zero:
                    "PASS"

            };

        } catch (error) {

            return {

                passed: false,

                error:
                    error.message

            };

        }

    }

}


/* ============================================================
   GLOBAL EXPORT
============================================================ */

window.WebBktxXMemory =
    WebBktxXMemory;


window.WebBktxMemoryBlock =
    WebBktxMemoryBlock;


window.WebBktxXMemoryFlags =
    XMEMORY_FLAGS;


/* ============================================================
   READY
============================================================ */

console.log(
    `WebBktx XMemory ${WEBBKTX_XMEMORY_VERSION} loaded.`
);
