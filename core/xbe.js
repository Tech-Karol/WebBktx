/*
 * ============================================================
 * WebBktx XBE Loader
 *
 * Version: 1.0
 *
 * Xbox XBE parser / loader / execution preparation layer
 *
 * Compatible with:
 *   - memory.js
 *   - cpu.js
 *   - decoder.js
 *   - core.js
 *   - future WebBktx Kernel
 *
 * Supports:
 *   - XBE signature
 *   - header parsing
 *   - section parsing
 *   - section names
 *   - virtual/file address mapping
 *   - entry point detection
 *   - entry-point byte extraction
 *   - XBE -> WebBktx memory loading
 *   - CPU entry address
 *   - executable section detection
 *   - safe bounds checking
 *   - diagnostics
 *
 * NOTE:
 * This is an XBE loader, not a complete Xbox kernel.
 * Xbox kernel APIs, GPU, audio, input, DirectX and
 * hardware services must be implemented separately.
 *
 * ============================================================
 */

"use strict";


/* ============================================================
   CONSTANTS
============================================================ */

const WEBBKTX_XBE_VERSION = "1.0";

const XBE_MAGIC = 0x48454258;

const XBE_DEFAULT_BASE = 0x00010000;

const XBE_SECTION_SIZE = 56;


/* ============================================================
   HELPERS
============================================================ */

function xbeHex(value, digits = 8) {

    return (
        "0x" +
        (value >>> 0)
            .toString(16)
            .padStart(digits, "0")
            .toUpperCase()
    );

}


function isInteger(value) {

    return Number.isInteger(value);

}


function safeRange(
    offset,
    size,
    length
) {

    return (
        isInteger(offset) &&
        isInteger(size) &&
        offset >= 0 &&
        size >= 0 &&
        offset <= length &&
        size <= length - offset
    );

}


function bytesToHex(bytes) {

    return Array.from(bytes)
        .map(
            b =>
                b
                    .toString(16)
                    .padStart(2, "0")
                    .toUpperCase()
        )
        .join(" ");

}


/* ============================================================
   XBE SECTION
============================================================ */

class WebBktxXBESection {

    constructor(
        parser,
        index,
        flags,
        virtualAddress,
        virtualSize,
        rawAddress,
        rawSize,
        nameAddress
    ) {

        this.parser = parser;

        this.index = index;

        this.flags =
            flags >>> 0;

        this.virtualAddress =
            virtualAddress >>> 0;

        this.virtualSize =
            virtualSize >>> 0;

        this.rawAddress =
            rawAddress >>> 0;

        this.rawSize =
            rawSize >>> 0;

        this.nameAddress =
            nameAddress >>> 0;

        this.name = "";

        this.loaded = false;

    }


    get endVirtualAddress() {

        return (
            this.virtualAddress +
            this.virtualSize
        ) >>> 0;

    }


    get endRawAddress() {

        return (
            this.rawAddress +
            this.rawSize
        ) >>> 0;

    }


    containsVirtualAddress(address) {

        address >>>= 0;

        return (
            address >= this.virtualAddress &&
            address < this.endVirtualAddress
        );

    }


    containsFileOffset(offset) {

        offset >>>= 0;

        return (
            offset >= this.rawAddress &&
            offset < this.endRawAddress
        );

    }


    get executable() {

        return (
            (this.flags & 0x00000001) !== 0
        );

    }


    get writable() {

        return (
            (this.flags & 0x00000002) !== 0
        );

    }


    get readable() {

        return (
            (this.flags & 0x00000004) !== 0
        );

    }


    get size() {

        return this.rawSize >>> 0;

    }


    toJSON() {

        return {

            index:
                this.index,

            name:
                this.name,

            flags:
                xbeHex(this.flags),

            virtualAddress:
                xbeHex(
                    this.virtualAddress
                ),

            virtualSize:
                xbeHex(
                    this.virtualSize
                ),

            rawAddress:
                xbeHex(
                    this.rawAddress
                ),

            rawSize:
                xbeHex(
                    this.rawSize
                ),

            executable:
                this.executable,

            writable:
                this.writable,

            readable:
                this.readable,

            loaded:
                this.loaded

        };

    }

}


/* ============================================================
   XBE PARSER
============================================================ */

class WebBktxXBEParser {

    constructor(source = null) {

        this.source = source;

        this.buffer = null;

        this.bytes = null;

        this.view = null;

        this.valid = false;

        this.loaded = false;

        this.header = null;

        this.sections = [];

        this.entryPoint = null;

        this.entryVirtualAddress = null;

        this.entryFileOffset = null;

        this.entrySection = null;

        this.analysis = null;

    }


    /* ========================================================
       LOAD
    ======================================================== */

    async load(source = this.source) {

        if (!source) {

            throw new Error(
                "No XBE source supplied."
            );

        }


        this.source = source;


        this.buffer =
            await this.normalizeSource(
                source
            );


        this.bytes =
            new Uint8Array(
                this.buffer
            );


        this.view =
            new DataView(
                this.buffer
            );


        if (
            this.bytes.byteLength < 0x178
        ) {

            throw new Error(
                "XBE file is too small."
            );

        }


        this.checkMagic();

        this.parseHeader();

        this.parseSections();

        this.analyzeEntryPoint();


        this.loaded = true;


        return this;

    }


    /* ========================================================
       SOURCE NORMALIZATION
    ======================================================== */

    async normalizeSource(source) {

        if (
            source instanceof ArrayBuffer
        ) {

            return source.slice(0);

        }


        if (
            source instanceof Uint8Array
        ) {

            return source.buffer.slice(
                source.byteOffset,
                source.byteOffset +
                source.byteLength
            );

        }


        if (
            typeof Blob !== "undefined" &&
            source instanceof Blob
        ) {

            return await source.arrayBuffer();

        }


        /*
         * Some applications may pass:
         *
         * { buffer: ArrayBuffer }
         */

        if (
            source &&
            source.buffer instanceof ArrayBuffer
        ) {

            return source.buffer.slice(0);

        }


        throw new Error(
            "Unsupported XBE source type."
        );

    }


    /* ========================================================
       MAGIC
    ======================================================== */

    checkMagic() {

        const magic =
            this.view.getUint32(
                0x00,
                true
            );


        if (
            magic !== XBE_MAGIC
        ) {

            throw new Error(
                "Invalid XBE signature: " +
                xbeHex(magic)
            );

        }


        this.valid = true;

    }


    /* ========================================================
       HEADER
    ======================================================== */

    parseHeader() {

        const v = this.view;


        this.header = {

            magic:
                v.getUint32(
                    0x00,
                    true
                ),

            digitalSignature:
                this.bytes.slice(
                    0x04,
                    0x104
                ),

            baseAddress:
                v.getUint32(
                    0x104,
                    true
                ),

            sizeOfHeaders:
                v.getUint32(
                    0x108,
                    true
                ),

            sizeOfImage:
                v.getUint32(
                    0x10C,
                    true
                ),

            sizeOfImageHeader:
                v.getUint32(
                    0x110,
                    true
                ),

            timestamp:
                v.getUint32(
                    0x114,
                    true
                ),

            certificateAddress:
                v.getUint32(
                    0x118,
                    true
                ),

            numberOfSections:
                v.getUint32(
                    0x11C,
                    true
                ),

            sectionHeadersAddress:
                v.getUint32(
                    0x120,
                    true
                ),

            initFlags:
                v.getUint32(
                    0x124,
                    true
                ),

            entryPoint:
                v.getUint32(
                    0x128,
                    true
                ),

            tlsAddress:
                v.getUint32(
                    0x12C,
                    true
                ),

            peStackCommit:
                v.getUint32(
                    0x130,
                    true
                ),

            peHeapReserve:
                v.getUint32(
                    0x134,
                    true
                ),

            peHeapCommit:
                v.getUint32(
                    0x138,
                    true
                ),

            peBaseAddress:
                v.getUint32(
                    0x13C,
                    true
                ),

            peImageSize:
                v.getUint32(
                    0x140,
                    true
                ),

            peChecksum:
                v.getUint32(
                    0x144,
                    true
                ),

            peTimestamp:
                v.getUint32(
                    0x148,
                    true
                ),

            debugPathAddress:
                v.getUint32(
                    0x14C,
                    true
                ),

            debugFilenameAddress:
                v.getUint32(
                    0x150,
                    true
                ),

            debugUnicodeFilenameAddress:
                v.getUint32(
                    0x154,
                    true
                ),

            kernelThunkAddress:
                v.getUint32(
                    0x158,
                    true
                ),

            nonKernelImportDirAddress:
                v.getUint32(
                    0x15C,
                    true
                ),

            numberOfLibraries:
                v.getUint32(
                    0x160,
                    true
                ),

            libraryVersionsAddress:
                v.getUint32(
                    0x164,
                    true
                ),

            kernelLibraryVersionAddress:
                v.getUint32(
                    0x168,
                    true
                ),

            xapiLibraryVersionAddress:
                v.getUint32(
                    0x16C,
                    true
                ),

            logoBitmapAddress:
                v.getUint32(
                    0x170,
                    true
                ),

            logoBitmapSize:
                v.getUint32(
                    0x174,
                    true
                )

        };


        this.entryPoint =
            this.header.entryPoint >>> 0;

    }


    /* ========================================================
       SECTION PARSER
    ======================================================== */

    parseSections() {

        this.sections = [];


        const count =
            this.header.numberOfSections;


        const table =
            this.header.sectionHeadersAddress;


        if (
            count > 4096
        ) {

            throw new Error(
                "Invalid XBE section count."
            );

        }


        if (
            !safeRange(
                table,
                count * XBE_SECTION_SIZE,
                this.bytes.length
            )
        ) {

            throw new Error(
                "XBE section table is outside the file."
            );

        }


        for (
            let i = 0;
            i < count;
            i++
        ) {

            const offset =
                table +
                i * XBE_SECTION_SIZE;


            const flags =
                this.view.getUint32(
                    offset,
                    true
                );


            const virtualAddress =
                this.view.getUint32(
                    offset + 4,
                    true
                );


            const virtualSize =
                this.view.getUint32(
                    offset + 8,
                    true
                );


            const rawAddress =
                this.view.getUint32(
                    offset + 12,
                    true
                );


            const rawSize =
                this.view.getUint32(
                    offset + 16,
                    true
                );


            const nameAddress =
                this.view.getUint32(
                    offset + 20,
                    true
                );


            if (
                rawSize > 0 &&
                !safeRange(
                    rawAddress,
                    rawSize,
                    this.bytes.length
                )
            ) {

                throw new Error(
                    `Invalid raw section ${i}.`
                );

            }


            const section =
                new WebBktxXBESection(
                    this,
                    i,
                    flags,
                    virtualAddress,
                    virtualSize,
                    rawAddress,
                    rawSize,
                    nameAddress
                );


            section.name =
                this.readCStringVirtual(
                    nameAddress
                );


            this.sections.push(
                section
            );

        }

    }


    /* ========================================================
       VIRTUAL -> FILE
    ======================================================== */

    virtualToFileOffset(
        virtualAddress
    ) {

        virtualAddress >>>= 0;


        for (
            const section of this.sections
        ) {

            if (
                section.containsVirtualAddress(
                    virtualAddress
                )
            ) {

                const delta =
                    (
                        virtualAddress -
                        section.virtualAddress
                    ) >>> 0;


                if (
                    delta >= section.rawSize
                ) {

                    return null;

                }


                return (
                    section.rawAddress +
                    delta
                ) >>> 0;

            }

        }


        const base =
            this.header
                ? (
                    this.header.baseAddress ||
                    XBE_DEFAULT_BASE
                )
                : XBE_DEFAULT_BASE;


        if (
            virtualAddress >= base
        ) {

            const offset =
                (
                    virtualAddress -
                    base
                ) >>> 0;


            if (
                this.header &&
                offset < this.header.sizeOfHeaders &&
                offset < this.bytes.length
            ) {

                return offset;

            }

        }


        return null;

    }


    /* ========================================================
       FILE -> VIRTUAL
    ======================================================== */

    fileOffsetToVirtual(
        fileOffset
    ) {

        fileOffset >>>= 0;


        for (
            const section of this.sections
        ) {

            if (
                section.containsFileOffset(
                    fileOffset
                )
            ) {

                return (
                    section.virtualAddress +
                    (
                        fileOffset -
                        section.rawAddress
                    )
                ) >>> 0;

            }

        }


        const base =
            this.header.baseAddress ||
            XBE_DEFAULT_BASE;


        if (
            fileOffset <
            this.header.sizeOfHeaders
        ) {

            return (
                base +
                fileOffset
            ) >>> 0;

        }


        return null;

    }


    /* ========================================================
       STRING
    ======================================================== */

    readCString(
        offset,
        maxLength = 256
    ) {

        if (
            offset < 0 ||
            offset >= this.bytes.length
        ) {

            return "";

        }


        let result = "";


        for (
            let i = 0;
            i < maxLength &&
            offset + i <
            this.bytes.length;
            i++
        ) {

            const value =
                this.bytes[
                    offset + i
                ];


            if (
                value === 0
            ) {

                break;

            }


            if (
                value >= 32 &&
                value <= 126
            ) {

                result +=
                    String.fromCharCode(
                        value
                    );

            } else {

                result += ".";

            }

        }


        return result;

    }


    readCStringVirtual(
        virtualAddress,
        maxLength = 256
    ) {

        const offset =
            this.virtualToFileOffset(
                virtualAddress
            );


        if (
            offset !== null
        ) {

            return this.readCString(
                offset,
                maxLength
            );

        }


        /*
         * Fallback for malformed/test XBE files.
         */

        if (
            virtualAddress <
            this.bytes.length
        ) {

            return this.readCString(
                virtualAddress,
                maxLength
            );

        }


        return "";

    }


    /* ========================================================
       FIND SECTION
    ======================================================== */

    findSection(
        virtualAddress
    ) {

        virtualAddress >>>= 0;


        return (
            this.sections.find(
                section =>
                    section.containsVirtualAddress(
                        virtualAddress
                    )
            ) ||
            null
        );

    }


    /* ========================================================
       ENTRY POINT
    ======================================================== */

    analyzeEntryPoint() {

        const raw =
            this.entryPoint >>> 0;


        const base =
            this.header.baseAddress ||
            XBE_DEFAULT_BASE;


        /*
         * Standard interpretation:
         *
         * entry = image base + RVA
         */

        let virtualAddress =
            (
                base +
                raw
            ) >>> 0;


        let section =
            this.findSection(
                virtualAddress
            );


        let interpretedAsRVA =
            true;


        /*
         * Compatibility fallback:
         *
         * Some development/test images may contain
         * an already-based virtual address.
         */

        if (!section) {

            section =
                this.findSection(
                    raw
                );


            if (section) {

                virtualAddress =
                    raw;

                interpretedAsRVA =
                    false;

            }

        }


        this.entryVirtualAddress =
            virtualAddress >>> 0;


        this.entrySection =
            section;


        this.entryFileOffset =
            this.virtualToFileOffset(
                virtualAddress
            );


        this.analysis = {

            rawEntryPoint:
                raw,

            virtualEntryPoint:
                this.entryVirtualAddress,

            fileOffset:
                this.entryFileOffset,

            section:
                section
                    ? section.name
                    : null,

            sectionIndex:
                section
                    ? section.index
                    : null,

            interpretedAsRVA,

            mapped:
                this.entryFileOffset !== null,

            executable:
                section
                    ? section.executable
                    : false

        };


        return this.analysis;

    }


    /* ========================================================
       ENTRY BYTES
    ======================================================== */

    getEntryBytes(
        count = 128
    ) {

        if (
            this.entryFileOffset === null
        ) {

            return new Uint8Array();

        }


        count =
            Math.max(
                0,
                Math.min(
                    count,
                    1024 * 1024
                )
            );


        const start =
            this.entryFileOffset;


        const end =
            Math.min(
                start + count,
                this.bytes.length
            );


        return this.bytes.slice(
            start,
            end
        );

    }


    /* ========================================================
       EXTRACT SECTION
    ======================================================== */

    extractSection(
        section
    ) {

        if (
            !section
        ) {

            throw new Error(
                "Section is required."
            );

        }


        if (
            !safeRange(
                section.rawAddress,
                section.rawSize,
                this.bytes.length
            )
        ) {

            throw new Error(
                "Section data is outside XBE."
            );

        }


        return this.bytes.slice(
            section.rawAddress,
            section.rawAddress +
            section.rawSize
        );

    }


    /* ========================================================
       LOAD SECTION INTO MEMORY
    ======================================================== */

    loadSectionIntoMemory(
        memory,
        section,
        options = {}
    ) {

        if (
            !memory
        ) {

            throw new Error(
                "Memory object is required."
            );

        }


        if (
            !section
        ) {

            throw new Error(
                "Section is required."
            );

        }


        const data =
            this.extractSection(
                section
            );


        let address =
            section.virtualAddress;


        const translateBase =
            options.translateBase !== false;


        const base =
            this.header.baseAddress ||
            XBE_DEFAULT_BASE;


        if (
            translateBase &&
            address >= base
        ) {

            address =
                (
                    address -
                    base
                ) >>> 0;

        }


        if (
            address > memory.size
        ) {

            throw new RangeError(
                `Section address outside RAM: ${
                    xbeHex(address)
                }`
            );

        }


        if (
            data.length >
            memory.size - address
        ) {

            throw new RangeError(
                `Section ${section.name} ` +
                `does not fit into RAM.`
            );

        }


        if (
            typeof memory.writeBytes !==
            "function"
        ) {

            throw new Error(
                "Memory.writeBytes() is required."
            );

        }


        memory.writeBytes(
            address,
            data
        );


        /*
         * Zero-fill virtual tail.
         */

        const virtualTail =
            Math.max(
                0,
                section.virtualSize -
                data.length
            );


        if (
            virtualTail > 0 &&
            typeof memory.write8 ===
            "function"
        ) {

            for (
                let i = 0;
                i < virtualTail;
                i++
            ) {

                const target =
                    address +
                    data.length +
                    i;


                if (
                    target >=
                    memory.size
                ) {

                    break;

                }


                memory.write8(
                    target,
                    0
                );

            }

        }


        section.loaded = true;


        return {

            section:
                section.name,

            index:
                section.index,

            address:
                address >>> 0,

            virtualAddress:
                section.virtualAddress,

            size:
                data.length,

            virtualSize:
                section.virtualSize,

            executable:
                section.executable

        };

    }


    /* ========================================================
       LOAD ALL SECTIONS
    ======================================================== */

    loadIntoMemory(
        memory,
        options = {}
    ) {

        if (
            !memory
        ) {

            throw new Error(
                "Memory object is required."
            );

        }


        const results = [];


        for (
            const section of this.sections
        ) {

            /*
             * Skip empty sections.
             */

            if (
                section.rawSize === 0 &&
                section.virtualSize === 0
            ) {

                continue;

            }


            results.push(
                this.loadSectionIntoMemory(
                    memory,
                    section,
                    options
                )
            );

        }


        return {

            loaded:
                results.length,

            sections:
                results

        };

    }


    /* ========================================================
       ENTRY SECTION
    ======================================================== */

    loadEntrySectionIntoMemory(
        memory,
        options = {}
    ) {

        if (
            !this.entrySection
        ) {

            throw new Error(
                "Entry point section not found."
            );

        }


        return this.loadSectionIntoMemory(
            memory,
            this.entrySection,
            options
        );

    }


    /* ========================================================
       CPU ADDRESS
    ======================================================== */

    getCPUEntryAddress(
        memory = null
    ) {

        if (
            !this.analysis ||
            !this.analysis.mapped
        ) {

            return null;

        }


        const base =
            this.header.baseAddress ||
            XBE_DEFAULT_BASE;


        let address =
            this.entryVirtualAddress;


        if (
            address >= base
        ) {

            address =
                (
                    address -
                    base
                ) >>> 0;

        }


        if (
            memory &&
            address >= memory.size
        ) {

            return null;

        }


        return address >>> 0;

    }


    /* ========================================================
       HEX DUMP
    ======================================================== */

    hexDump(
        bytes = this.getEntryBytes(128),
        startAddress =
            this.entryVirtualAddress || 0
    ) {

        const lines = [];


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
                bytesToHex(
                    chunk
                );


            let ascii = "";


            for (
                const byte of chunk
            ) {

                ascii +=
                    (
                        byte >= 32 &&
                        byte <= 126
                    )
                        ? String.fromCharCode(byte)
                        : ".";

            }


            lines.push(
                `${xbeHex(
                    startAddress + i
                )}  ` +
                `${hex.padEnd(
                    47,
                    " "
                )}  ${ascii}`
            );

        }


        return lines.join("\n");

    }


    /* ========================================================
       REPORT
    ======================================================== */

    getReport() {

        return {

            version:
                WEBBKTX_XBE_VERSION,

            valid:
                this.valid,

            loaded:
                this.loaded,

            fileSize:
                this.bytes
                    ? this.bytes.length
                    : 0,

            header:
                this.header
                    ? {

                        magic:
                            xbeHex(
                                this.header.magic
                            ),

                        baseAddress:
                            xbeHex(
                                this.header.baseAddress
                            ),

                        imageSize:
                            xbeHex(
                                this.header.sizeOfImage
                            ),

                        headersSize:
                            xbeHex(
                                this.header.sizeOfHeaders
                            ),

                        sections:
                            this.header
                                .numberOfSections,

                        entryPoint:
                            xbeHex(
                                this.header.entryPoint
                            ),

                        kernelThunk:
                            xbeHex(
                                this.header
                                    .kernelThunkAddress
                            ),

                        libraries:
                            this.header
                                .numberOfLibraries

                    }
                    : null,

            entryPoint:
                this.analysis,

            sections:
                this.sections.map(
                    section =>
                        section.toJSON()
                )

        };

    }


    /* ========================================================
       STATUS
    ======================================================== */

    getStatus() {

        return {

            version:
                WEBBKTX_XBE_VERSION,

            loaded:
                this.loaded,

            valid:
                this.valid,

            size:
                this.bytes
                    ? this.bytes.length
                    : 0,

            sections:
                this.sections.length,

            entryPoint:
                this.entryVirtualAddress !== null
                    ? xbeHex(
                        this.entryVirtualAddress
                    )
                    : null,

            entryFileOffset:
                this.entryFileOffset !== null
                    ? xbeHex(
                        this.entryFileOffset
                    )
                    : null,

            entrySection:
                this.entrySection
                    ? this.entrySection.name
                    : null,

            entryMapped:
                this.entryFileOffset !== null

        };

    }


    /* ========================================================
       RAW DATA
    ======================================================== */

    getBytes() {

        if (
            !this.bytes
        ) {

            return new Uint8Array();

        }


        return this.bytes.slice();

    }

}


/* ============================================================
   PUBLIC XBE CLASS
============================================================ */

class WebBktxXBE {

    constructor(source = null) {

        this.parser =
            new WebBktxXBEParser(
                source
            );

    }


    async load(source = null) {

        /*
         * IMPORTANT:
         *
         * This accepts:
         * File
         * Blob
         * ArrayBuffer
         * Uint8Array
         */

        if (
            source !== null &&
            source !== undefined
        ) {

            this.parser =
                new WebBktxXBEParser(
                    source
                );

        }


        await this.parser.load();


        return this;

    }


    get header() {

        return this.parser.header;

    }


    get sections() {

        return this.parser.sections;

    }


    get entryPoint() {

        return this.parser.entryPoint;

    }


    get analysis() {

        return this.parser.analysis;

    }


    get entrySection() {

        return this.parser.entrySection;

    }


    get entryFileOffset() {

        return this.parser.entryFileOffset;

    }


    get entryVirtualAddress() {

        return this.parser.entryVirtualAddress;

    }


    getReport() {

        return this.parser.getReport();

    }


    getStatus() {

        return this.parser.getStatus();

    }


    getEntryBytes(
        count = 128
    ) {

        return this.parser.getEntryBytes(
            count
        );

    }


    hexDump(
        bytes,
        address
    ) {

        return this.parser.hexDump(
            bytes,
            address
        );

    }


    extractSection(
        section
    ) {

        return this.parser.extractSection(
            section
        );

    }


    loadIntoMemory(
        memory,
        options = {}
    ) {

        return this.parser.loadIntoMemory(
            memory,
            options
        );

    }


    loadEntrySectionIntoMemory(
        memory,
        options = {}
    ) {

        return this.parser
            .loadEntrySectionIntoMemory(
                memory,
                options
            );

    }


    getCPUEntryAddress(
        memory
    ) {

        return this.parser
            .getCPUEntryAddress(
                memory
            );

    }


    virtualToFileOffset(
        address
    ) {

        return this.parser
            .virtualToFileOffset(
                address
            );

    }


    fileOffsetToVirtual(
        offset
    ) {

        return this.parser
            .fileOffsetToVirtual(
                offset
            );

    }


    findSection(
        address
    ) {

        return this.parser.findSection(
            address
        );

    }


    getBytes() {

        return this.parser.getBytes();

    }

}


/* ============================================================
   GLOBAL EXPORTS
============================================================ */

window.WebBktxXBE =
    WebBktxXBE;


window.WebBktxXBEParser =
    WebBktxXBEParser;


window.WebBktxXBESection =
    WebBktxXBESection;


/* ============================================================
   UTILS
============================================================ */

window.WebBktxXBEUtils = {

    hex:
        xbeHex,

    bytesToHex:

        bytesToHex,

    version:
        WEBBKTX_XBE_VERSION

};


/* ============================================================
   READY
============================================================ */

console.log(
    `%cWebBktx XBE Loader ${WEBBKTX_XBE_VERSION}`,
    "font-weight:bold"
);

console.log(
    "XBE loader ready."
);
