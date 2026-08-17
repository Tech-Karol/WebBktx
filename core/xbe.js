/*
 * ============================================================
 * WebBktx XBE Loader / Analyzer
 *
 * Version: 0.7D
 *
 * Experimental Microsoft Xbox XBE parser
 *
 * Features:
 *
 *   - XBEH signature detection
 *   - XBE header parsing
 *   - base address
 *   - entry point
 *   - kernel thunk information
 *   - library information
 *   - section table
 *   - section names
 *   - section address mapping
 *   - virtual address -> file offset
 *   - entry point analysis
 *   - code extraction
 *   - safe memory mapping
 *
 * NOTE:
 *
 * This is NOT a complete Xbox kernel loader.
 *
 * XBE execution requires:
 *
 *   Xbox memory model
 *   kernel
 *   imports/thunks
 *   executable sections
 *   page mapping
 *   exception handling
 *   hardware abstraction
 *   GPU
 *   audio
 *   input
 *   DirectX/Xbox APIs
 *
 * Those components will be implemented separately.
 *
 * ============================================================
 */

"use strict";


/* ============================================================
   CONSTANTS
============================================================ */

const XBE_MAGIC =
    0x48454258;


/*
 * XBE default virtual base.
 *
 * Most XBE files use:
 *
 * 0x00010000
 *
 * but we always read the actual value
 * from the header.
 */

const XBE_DEFAULT_BASE =
    0x00010000;


/* ============================================================
   HELPERS
============================================================ */

function xbeHex(
    value,
    digits = 8
) {

    return (
        "0x" +
        (
            value >>> 0
        )
        .toString(16)
        .padStart(
            digits,
            "0"
        )
        .toUpperCase()
    );

}


function xbeString(
    bytes
) {

    let output = "";


    for (
        let i = 0;
        i < bytes.length;
        i++
    ) {

        const c =
            bytes[i];


        if (
            c === 0
        ) {

            break;

        }


        if (
            c >= 32 &&
            c <= 126
        ) {

            output +=
                String.fromCharCode(c);

        } else {

            output +=
                ".";

        }

    }


    return output;

}


/* ============================================================
   XBE SECTION
============================================================ */

class XBESection {

    constructor(
        parser,
        index,
        virtualAddress,
        virtualSize,
        rawAddress,
        rawSize,
        flags,
        nameAddress
    ) {

        this.parser =
            parser;

        this.index =
            index;

        this.virtualAddress =
            virtualAddress >>> 0;

        this.virtualSize =
            virtualSize >>> 0;

        this.rawAddress =
            rawAddress >>> 0;

        this.rawSize =
            rawSize >>> 0;

        this.flags =
            flags >>> 0;

        this.nameAddress =
            nameAddress >>> 0;


        this.name =
            "";


        this.loaded =
            false;

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


    containsVirtualAddress(
        address
    ) {

        address >>>= 0;


        return (
            address >=
                this.virtualAddress &&

            address <
                this.endVirtualAddress
        );

    }


    containsFileOffset(
        offset
    ) {

        offset >>>= 0;


        return (
            offset >=
                this.rawAddress &&

            offset <
                this.endRawAddress
        );

    }


    get executable() {

        /*
         * XBE section flags are not treated
         * as a perfect PE-style permission model.
         *
         * For WebBktx we use the common
         * executable section flag interpretation.
         */

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


    toJSON() {

        return {

            index:
                this.index,

            name:
                this.name,

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

            flags:
                xbeHex(
                    this.flags
                ),

            executable:
                this.executable,

            writable:
                this.writable,

            readable:
                this.readable

        };

    }

}


/* ============================================================
   XBE PARSER
============================================================ */

class XBEParser {

    constructor(
        source
    ) {

        this.source =
            source;


        this.buffer =
            null;


        this.bytes =
            null;


        this.view =
            null;


        this.valid =
            false;


        this.loaded =
            false;


        this.header =
            null;


        this.sections =
            [];


        this.entryPoint =
            null;


        this.entrySection =
            null;


        this.entryFileOffset =
            null;


        this.analysis =
            null;

    }


    /* ========================================================
       LOAD
    ======================================================== */

    async load() {

        if (!this.source) {

            throw new Error(
                "No XBE source supplied."
            );

        }


        if (
            this.source instanceof
            ArrayBuffer
        ) {

            this.buffer =
                this.source.slice(
                    0
                );

        } else if (
            this.source instanceof
            Uint8Array
        ) {

            this.buffer =
                this.source.buffer.slice(
                    this.source.byteOffset,
                    this.source.byteOffset +
                    this.source.byteLength
                );

        } else if (
            typeof Blob !==
            "undefined" &&
            this.source instanceof Blob
        ) {

            this.buffer =
                await this.source.arrayBuffer();

        } else {

            throw new Error(
                "Unsupported XBE source type."
            );

        }


        this.bytes =
            new Uint8Array(
                this.buffer
            );


        this.view =
            new DataView(
                this.buffer
            );


        if (
            this.bytes.length <
            0x100
        ) {

            throw new Error(
                "XBE file is too small."
            );

        }


        this.checkMagic();


        this.parseHeader();


        this.parseSections();


        this.analyzeEntryPoint();


        this.loaded =
            true;


        return this;

    }


    /* ========================================================
       MAGIC
    ======================================================== */

    checkMagic() {

        const magic =
            this.view.getUint32(
                0,
                true
            );


        if (
            magic !== XBE_MAGIC
        ) {

            throw new Error(
                `Invalid XBE signature: ${
                    xbeHex(magic)
                }`
            );

        }


        this.valid =
            true;

    }


    /* ========================================================
       HEADER
    ======================================================== */

    parseHeader() {

        const v =
            this.view;


        /*
         * These offsets follow the standard
         * XBE header layout.
         */

        const magic =
            v.getUint32(
                0x00,
                true
            );


        const digitalSignature =
            this.bytes.slice(
                0x04,
                0x104
            );


        /*
         * Base address.
         */

        const baseAddress =
            v.getUint32(
                0x104,
                true
            );


        /*
         * Size of headers.
         */

        const sizeOfHeaders =
            v.getUint32(
                0x108,
                true
            );


        /*
         * Size of image.
         */

        const sizeOfImage =
            v.getUint32(
                0x10C,
                true
            );


        /*
         * Size of image header.
         */

        const sizeOfImageHeader =
            v.getUint32(
                0x110,
                true
            );


        /*
         * Timestamp.
         */

        const timestamp =
            v.getUint32(
                0x114,
                true
            );


        /*
         * Certificate address.
         */

        const certificateAddress =
            v.getUint32(
                0x118,
                true
            );


        /*
         * Number of sections.
         */

        const numberOfSections =
            v.getUint32(
                0x11C,
                true
            );


        /*
         * Section headers address.
         */

        const sectionHeadersAddress =
            v.getUint32(
                0x120,
                true
            );


        /*
         * Initialization flags.
         */

        const initFlags =
            v.getUint32(
                0x124,
                true
            );


        /*
         * Entry point.
         */

        const entryPoint =
            v.getUint32(
                0x128,
                true
            );


        /*
         * TLS address.
         */

        const tlsAddress =
            v.getUint32(
                0x12C,
                true
            );


        /*
         * PE stack commit.
         */

        const peStackCommit =
            v.getUint32(
                0x130,
                true
            );


        /*
         * PE heap reserve.
         */

        const peHeapReserve =
            v.getUint32(
                0x134,
                true
            );


        /*
         * PE heap commit.
         */

        const peHeapCommit =
            v.getUint32(
                0x138,
                true
            );


        /*
         * PE base address.
         */

        const peBaseAddress =
            v.getUint32(
                0x13C,
                true
            );


        /*
         * PE image size.
         */

        const peImageSize =
            v.getUint32(
                0x140,
                true
            );


        /*
         * PE checksum.
         */

        const peChecksum =
            v.getUint32(
                0x144,
                true
            );


        /*
         * PE timestamp.
         */

        const peTimestamp =
            v.getUint32(
                0x148,
                true
            );


        /*
         * Debug path address.
         */

        const debugPathAddress =
            v.getUint32(
                0x14C,
                true
            );


        /*
         * Debug filename address.
         */

        const debugFilenameAddress =
            v.getUint32(
                0x150,
                true
            );


        /*
         * Debug Unicode filename address.
         */

        const debugUnicodeFilenameAddress =
            v.getUint32(
                0x154,
                true
            );


        /*
         * Kernel thunk address.
         */

        const kernelThunkAddress =
            v.getUint32(
                0x158,
                true
            );


        /*
         * Non-kernel import directory.
         */

        const nonKernelImportDirAddress =
            v.getUint32(
                0x15C,
                true
            );


        /*
         * Number of libraries.
         */

        const numberOfLibraries =
            v.getUint32(
                0x160,
                true
            );


        /*
         * Library versions address.
         */

        const libraryVersionsAddress =
            v.getUint32(
                0x164,
                true
            );


        /*
         * Kernel library version address.
         */

        const kernelLibraryVersionAddress =
            v.getUint32(
                0x168,
                true
            );


        /*
         * XAPI library version address.
         */

        const xapiLibraryVersionAddress =
            v.getUint32(
                0x16C,
                true
            );


        /*
         * Logo bitmap address.
         */

        const logoBitmapAddress =
            v.getUint32(
                0x170,
                true
            );


        /*
         * Logo bitmap size.
         */

        const logoBitmapSize =
            v.getUint32(
                0x174,
                true
            );


        this.header = {

            magic,

            digitalSignature,

            baseAddress,

            sizeOfHeaders,

            sizeOfImage,

            sizeOfImageHeader,

            timestamp,

            certificateAddress,

            numberOfSections,

            sectionHeadersAddress,

            initFlags,

            entryPoint,

            tlsAddress,

            peStackCommit,

            peHeapReserve,

            peHeapCommit,

            peBaseAddress,

            peImageSize,

            peChecksum,

            peTimestamp,

            debugPathAddress,

            debugFilenameAddress,

            debugUnicodeFilenameAddress,

            kernelThunkAddress,

            nonKernelImportDirAddress,

            numberOfLibraries,

            libraryVersionsAddress,

            kernelLibraryVersionAddress,

            xapiLibraryVersionAddress,

            logoBitmapAddress,

            logoBitmapSize

        };


        this.entryPoint =
            entryPoint >>> 0;

    }


    /* ========================================================
       ADDRESS CONVERSION
    ======================================================== */

    virtualToFileOffset(
        virtualAddress
    ) {

        virtualAddress >>>= 0;


        /*
         * Search sections.
         */

        for (
            const section
            of this.sections
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
                    delta >=
                    section.rawSize
                ) {

                    return null;

                }


                return (
                    section.rawAddress +
                    delta
                ) >>> 0;

            }

        }


        /*
         * Header mapping.
         */

        const base =
            this.header
                ? this.header.baseAddress
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
                offset <
                this.header.sizeOfHeaders
            ) {

                return offset;

            }

        }


        return null;

    }


    /* ========================================================
       FILE OFFSET -> VIRTUAL
    ======================================================== */

    fileOffsetToVirtual(
        fileOffset
    ) {

        fileOffset >>>= 0;


        for (
            const section
            of this.sections
        ) {

            if (
                section.containsFileOffset(
                    fileOffset
                )
            ) {

                const delta =
                    (
                        fileOffset -
                        section.rawAddress
                    ) >>> 0;


                return (
                    section.virtualAddress +
                    delta
                ) >>> 0;

            }

        }


        const base =
            this.header
                ? this.header.baseAddress
                : XBE_DEFAULT_BASE;


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
       SECTION PARSER
    ======================================================== */

    parseSections() {

        this.sections =
            [];


        const count =
            this.header
                .numberOfSections;


        const table =
            this.header
                .sectionHeadersAddress;


        /*
         * XBE section header size.
         */

        const SECTION_SIZE =
            56;


        if (
            count === 0
        ) {

            return;

        }


        /*
         * Validate section table.
         */

        const tableSize =
            count *
            SECTION_SIZE;


        if (
            table +
            tableSize >
            this.bytes.length
        ) {

            console.warn(
                "XBE section table extends beyond file."
            );

        }


        for (
            let i = 0;
            i < count;
            i++
        ) {

            const offset =
                table +
                (
                    i *
                    SECTION_SIZE
                );


            if (
                offset + 40 >
                this.bytes.length
            ) {

                break;

            }


            /*
             * Section flags.
             */

            const flags =
                this.view.getUint32(
                    offset,
                    true
                );


            /*
             * Virtual address.
             */

            const virtualAddress =
                this.view.getUint32(
                    offset + 4,
                    true
                );


            /*
             * Virtual size.
             */

            const virtualSize =
                this.view.getUint32(
                    offset + 8,
                    true
                );


            /*
             * Raw address.
             */

            const rawAddress =
                this.view.getUint32(
                    offset + 12,
                    true
                );


            /*
             * Raw size.
             */

            const rawSize =
                this.view.getUint32(
                    offset + 16,
                    true
                );


            /*
             * Section name address.
             */

            const sectionNameAddress =
                this.view.getUint32(
                    offset + 20,
                    true
                );


            const section =
                new XBESection(

                    this,

                    i,

                    virtualAddress,

                    virtualSize,

                    rawAddress,

                    rawSize,

                    flags,

                    sectionNameAddress

                );


            section.name =
                this.readCStringVirtual(
                    sectionNameAddress
                );


            this.sections.push(
                section
            );

        }

    }


    /* ========================================================
       C STRING
    ======================================================== */

    readCStringVirtual(
        virtualAddress,
        maxLength = 256
    ) {

        const offset =
            this.virtualToFileOffset(
                virtualAddress
            );


        if (
            offset === null
        ) {

            /*
             * Some XBE fields can point
             * into special structures.
             *
             * Try direct offset as fallback.
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


        return this.readCString(
            offset,
            maxLength
        );

    }


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


        let output =
            "";


        for (
            let i = 0;
            i < maxLength &&
            offset + i <
            this.bytes.length;
            i++
        ) {

            const c =
                this.bytes[
                    offset + i
                ];


            if (
                c === 0
            ) {

                break;

            }


            if (
                c >= 32 &&
                c <= 126
            ) {

                output +=
                    String.fromCharCode(
                        c
                    );

            } else {

                output +=
                    ".";

            }

        }


        return output;

    }


    /* ========================================================
       ENTRY POINT ANALYSIS
    ======================================================== */

    analyzeEntryPoint() {

        const entry =
            this.entryPoint >>> 0;


        /*
         * XBE entry point is generally stored
         * as an RVA relative to the image base.
         *
         * Convert it to virtual address.
         */

        let virtualAddress;


        const base =
            this.header.baseAddress
                || XBE_DEFAULT_BASE;


        virtualAddress =
            (
                base +
                entry
            ) >>> 0;


        /*
         * Some test files/tools may provide
         * an already-based address.
         *
         * If the calculated address doesn't map,
         * try the raw value.
         */

        let section =
            this.findSection(
                virtualAddress
            );


        let interpretedAsRVA =
            true;


        if (
            !section
        ) {

            section =
                this.findSection(
                    entry
                );


            if (
                section
            ) {

                virtualAddress =
                    entry;

                interpretedAsRVA =
                    false;

            }

        }


        this.entrySection =
            section || null;


        this.entryFileOffset =
            this.virtualToFileOffset(
                virtualAddress
            );


        this.analysis = {

            rawEntryPoint:
                entry,

            virtualEntryPoint:
                virtualAddress,

            fileOffset:
                this.entryFileOffset,

            section:
                section
                    ? section.name
                    : null,

            interpretedAsRVA,

            mapped:
                this.entryFileOffset !== null

        };


        return this.analysis;

    }


    /* ========================================================
       FIND SECTION
    ======================================================== */

    findSection(
        virtualAddress
    ) {

        for (
            const section
            of this.sections
        ) {

            if (
                section.containsVirtualAddress(
                    virtualAddress
                )
            ) {

                return section;

            }

        }


        return null;

    }


    /* ========================================================
       ENTRY BYTES
    ======================================================== */

    getEntryBytes(
        count = 64
    ) {

        if (
            this.entryFileOffset === null
        ) {

            return new Uint8Array();

        }


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
       HEX DUMP
    ======================================================== */

    hexDump(
        bytes = this.getEntryBytes(64),
        startAddress =
            this.analysis
                ? this.analysis.virtualEntryPoint
                : 0
    ) {

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
                Array.from(
                    chunk
                )
                .map(
                    byte => {

                        if (
                            byte >= 32 &&
                            byte <= 126
                        ) {

                            return String
                                .fromCharCode(
                                    byte
                                );

                        }


                        return ".";

                    }
                )
                .join("");


            lines.push(

                `${xbeHex(
                    startAddress + i
                )}  ` +

                `${hex
                    .padEnd(
                        47,
                        " "
                    )}  ` +

                `${ascii}`

            );

        }


        return lines.join(
            "\n"
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
                "Section does not exist."
            );

        }


        const start =
            section.rawAddress;


        const end =
            Math.min(
                start +
                section.rawSize,
                this.bytes.length
            );


        return this.bytes.slice(
            start,
            end
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


        const bytes =
            this.extractSection(
                section
            );


        let address =
            section.virtualAddress;


        /*
         * XBE virtual addresses may not directly
         * correspond to the WebBktx RAM address.
         *
         * Translate using image base.
         */

        if (
            options.translateBase !== false
        ) {

            const base =
                this.header.baseAddress
                    || XBE_DEFAULT_BASE;


            if (
                address >= base
            ) {

                address =
                    (
                        address -
                        base
                    ) >>> 0;

            }

        }


        if (
            address +
            bytes.length >
            memory.size
        ) {

            throw new Error(

                `Section ${section.name} ` +
                `does not fit in WebBktx memory. ` +

                `Address=${xbeHex(address)} ` +
                `Size=${xbeHex(bytes.length)} ` +
                `RAM=${xbeHex(memory.size)}`

            );

        }


        memory.writeBytes(
            address,
            bytes
        );


        section.loaded =
            true;


        return {

            address,

            size:
                bytes.length,

            section:
                section.name

        };

    }


    /* ========================================================
       LOAD ENTRY SECTION
    ======================================================== */

    loadEntrySectionIntoMemory(
        memory
    ) {

        if (
            !this.entrySection
        ) {

            throw new Error(
                "Entry point section could not be found."
            );

        }


        return this.loadSectionIntoMemory(
            memory,
            this.entrySection
        );

    }


    /* ========================================================
       GET CPU ENTRY ADDRESS
    ======================================================== */

    getCPUEntryAddress(
        memory
    ) {

        if (
            !this.analysis ||
            !this.analysis.mapped
        ) {

            return null;

        }


        const base =
            this.header.baseAddress
                || XBE_DEFAULT_BASE;


        let address =
            this.analysis.virtualEntryPoint;


        /*
         * Translate Xbox virtual address
         * into WebBktx RAM address.
         */

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
       ANALYZE
    ======================================================== */

    getReport() {

        return {

            valid:
                this.valid,

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

                        sizeOfHeaders:
                            xbeHex(
                                this.header.sizeOfHeaders
                            ),

                        sizeOfImage:
                            xbeHex(
                                this.header.sizeOfImage
                            ),

                        numberOfSections:
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

                        numberOfLibraries:
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
                this.analysis
                    ? xbeHex(
                        this.analysis
                            .virtualEntryPoint
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

}


/* ============================================================
   XBE FILE CLASS
============================================================ */

class WebBktxXBE {

    constructor(
        source
    ) {

        this.parser =
            new XBEParser(
                source
            );

    }


    async load() {

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


    getReport() {

        return this.parser.getReport();

    }


    getStatus() {

        return this.parser.getStatus();

    }


    getEntryBytes(
        count
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


    loadEntrySectionIntoMemory(
        memory
    ) {

        return this.parser
            .loadEntrySectionIntoMemory(
                memory
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

}


/* ============================================================
   BYTE FORMATTER
============================================================ */

function xbeBytesToHex(
    bytes
) {

    return Array.from(
        bytes
    )
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

}


/* ============================================================
   PUBLIC API
============================================================ */

window.WebBktxXBE =
    WebBktxXBE;


window.WebBktxXBEParser =
    XBEParser;


window.WebBktxXBESection =
    XBESection;


window.WebBktxXBEUtils = {

    hex:
        xbeHex,

    bytesToHex:
        xbeBytesToHex

};


/* ============================================================
   READY
============================================================ */

console.log(
    "WebBktx XBE Loader 0.7D loaded."
);
