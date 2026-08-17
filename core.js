/*
 * ============================================================
 * WebBktx Core 0.6
 *
 * Experimental Original Xbox XBE execution core
 *
 * Features:
 *   - 32 MB emulated RAM
 *   - XBE header parser
 *   - XBE section parser
 *   - Entry Point XOR decoding
 *   - Virtual -> file offset translation
 *   - x86 instruction decoder
 *   - Basic x86 execution
 *   - Execution trace
 *   - Safe instruction limit
 *
 * IMPORTANT:
 * This is NOT a complete Xbox emulator.
 * Xbox Kernel / GPU / audio / MMU / full x86 are not implemented.
 * ============================================================
 */

"use strict";


/* ============================================================
   CONSTANTS
============================================================ */

const WEBBKTX_VERSION = "0.6";

const RAM_SIZE = 32 * 1024 * 1024;

const XBE_MAGIC = 0x48454258;

const XBE_ENTRY_DEBUG  = 0x94859D4B;
const XBE_ENTRY_RETAIL = 0xA8FC57AB;


/*
 * Maximum number of instructions executed
 * from an XBE during experimental boot.
 */

const DEFAULT_EXECUTION_LIMIT = 256;


/* ============================================================
   UTILITY
============================================================ */

function u32(value) {
    return value >>> 0;
}


function hex(value, digits = 8) {

    return (
        "0x" +
        (value >>> 0)
            .toString(16)
            .toUpperCase()
            .padStart(digits, "0")
    );

}


function sign8(value) {

    value &= 0xFF;

    return value & 0x80
        ? value - 0x100
        : value;

}


function sign32(value) {

    value >>>= 0;

    return value & 0x80000000
        ? value - 0x100000000
        : value;

}


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

        address >>>= 0;

        if (
            address + bytes > this.size
        ) {

            throw new RangeError(
                `RAM access outside range: ${hex(address)}`
            );

        }

    }


    read8(address) {

        this.checkAddress(address, 1);

        return this.view.getUint8(address);

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


    readS8(address) {

        return sign8(
            this.read8(address)
        );

    }


    readS32(address) {

        return sign32(
            this.read32(address)
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
            ECX: 0,
            EDX: 0,
            EBX: 0,

            ESP: 0,
            EBP: 0,
            ESI: 0,
            EDI: 0

        };


        this.EIP = 0;

        this.EFLAGS = 0x00000002;

        this.running = false;

        this.halted = false;

        this.cycles = 0;

        this.instructions = 0;

        this.trace = [];

    }


    reset() {

        for (
            const name
            of Object.keys(
                this.registers
            )
        ) {

            this.registers[name] = 0;

        }


        this.EIP = 0;

        this.EFLAGS = 0x00000002;

        this.running = false;

        this.halted = false;

        this.cycles = 0;

        this.instructions = 0;

        this.trace = [];

    }


    getRegister(index) {

        const names = [

            "EAX",
            "ECX",
            "EDX",
            "EBX",
            "ESP",
            "EBP",
            "ESI",
            "EDI"

        ];

        return this.registers[
            names[index & 7]
        ];

    }


    setRegister(index, value) {

        const names = [

            "EAX",
            "ECX",
            "EDX",
            "EBX",
            "ESP",
            "EBP",
            "ESI",
            "EDI"

        ];

        this.registers[
            names[index & 7]
        ] = u32(value);

    }


    fetch8() {

        const value =
            this.memory.read8(
                this.EIP
            );

        this.EIP =
            u32(
                this.EIP + 1
            );

        return value;

    }


    fetch32() {

        const value =
            this.memory.read32(
                this.EIP
            );

        this.EIP =
            u32(
                this.EIP + 4
            );

        return value;

    }


    push32(value) {

        this.registers.ESP =
            u32(
                this.registers.ESP - 4
            );

        this.memory.write32(
            this.registers.ESP,
            value
        );

    }


    pop32() {

        const value =
            this.memory.read32(
                this.registers.ESP
            );

        this.registers.ESP =
            u32(
                this.registers.ESP + 4
            );

        return value;

    }


    updateZeroSign(value) {

        value >>>= 0;

        /*
         * ZF = bit 6
         * SF = bit 7
         */

        this.EFLAGS &=
            ~(
                (1 << 6) |
                (1 << 7)
            );


        if (value === 0) {

            this.EFLAGS |=
                (1 << 6);

        }


        if (value & 0x80000000) {

            this.EFLAGS |=
                (1 << 7);

        }

    }


    decodeModRM(byte) {

        return {

            mod:
                (byte >> 6) & 3,

            reg:
                (byte >> 3) & 7,

            rm:
                byte & 7

        };

    }


    /*
     * --------------------------------------------------------
     * Decode one instruction
     * --------------------------------------------------------
     */

    decodeInstruction(address = this.EIP) {

        const start =
            address >>> 0;


        const opcode =
            this.memory.read8(
                start
            );


        const result = {

            address: start,

            opcode,

            length: 1,

            mnemonic: "UNKNOWN",

            bytes: [

                opcode

            ]

        };


        /*
         * NOP
         */

        if (opcode === 0x90) {

            result.mnemonic = "NOP";

            return result;

        }


        /*
         * RET
         */

        if (opcode === 0xC3) {

            result.mnemonic = "RET";

            return result;

        }


        /*
         * HLT
         */

        if (opcode === 0xF4) {

            result.mnemonic = "HLT";

            return result;

        }


        /*
         * MOV r32, imm32
         *
         * B8 + register
         */

        if (
            opcode >= 0xB8 &&
            opcode <= 0xBF
        ) {

            const reg =
                opcode - 0xB8;

            const value =
                this.memory.read32(
                    start + 1
                );


            result.length = 5;

            result.mnemonic =
                `MOV ${
                    Object.keys(
                        this.registers
                    )[reg]
                }, ${hex(value)}`;

            result.bytes =
                Array.from(
                    this.memory.readBytes(
                        start,
                        5
                    )
                );

            return result;

        }


        /*
         * PUSH imm32
         */

        if (opcode === 0x68) {

            const value =
                this.memory.read32(
                    start + 1
                );


            result.length = 5;

            result.mnemonic =
                `PUSH ${hex(value)}`;

            result.bytes =
                Array.from(
                    this.memory.readBytes(
                        start,
                        5
                    )
                );

            return result;

        }


        /*
         * PUSH register
         */

        if (
            opcode >= 0x50 &&
            opcode <= 0x57
        ) {

            const reg =
                opcode - 0x50;

            const name =
                Object.keys(
                    this.registers
                )[reg];


            result.mnemonic =
                `PUSH ${name}`;

            return result;

        }


        /*
         * POP register
         */

        if (
            opcode >= 0x58 &&
            opcode <= 0x5F
        ) {

            const reg =
                opcode - 0x58;

            const name =
                Object.keys(
                    this.registers
                )[reg];


            result.mnemonic =
                `POP ${name}`;

            return result;

        }


        /*
         * CALL rel32
         */

        if (opcode === 0xE8) {

            const rel =
                this.memory.readS32(
                    start + 1
                );


            const target =
                u32(
                    start +
                    5 +
                    rel
                );


            result.length = 5;

            result.mnemonic =
                `CALL ${hex(target)}`;

            result.bytes =
                Array.from(
                    this.memory.readBytes(
                        start,
                        5
                    )
                );

            return result;

        }


        /*
         * JMP rel32
         */

        if (opcode === 0xE9) {

            const rel =
                this.memory.readS32(
                    start + 1
                );


            const target =
                u32(
                    start +
                    5 +
                    rel
                );


            result.length = 5;

            result.mnemonic =
                `JMP ${hex(target)}`;

            result.bytes =
                Array.from(
                    this.memory.readBytes(
                        start,
                        5
                    )
                );

            return result;

        }


        /*
         * JMP rel8
         */

        if (opcode === 0xEB) {

            const rel =
                this.memory.readS8(
                    start + 1
                );


            const target =
                u32(
                    start +
                    2 +
                    rel
                );


            result.length = 2;

            result.mnemonic =
                `JMP ${hex(target)}`;

            result.bytes =
                Array.from(
                    this.memory.readBytes(
                        start,
                        2
                    )
                );

            return result;

        }


        /*
         * MOV r/m32, r32
         *
         * 89 /r
         */

        if (opcode === 0x89) {

            const modrm =
                this.memory.read8(
                    start + 1
                );


            const decoded =
                this.decodeModRM(
                    modrm
                );


            result.length = 2;

            result.mnemonic =
                `MOV r/m32, ${
                    Object.keys(
                        this.registers
                    )[decoded.reg]
                }`;

            return result;

        }


        /*
         * MOV r32, r/m32
         *
         * 8B /r
         */

        if (opcode === 0x8B) {

            const modrm =
                this.memory.read8(
                    start + 1
                );


            const decoded =
                this.decodeModRM(
                    modrm
                );


            result.length = 2;

            result.mnemonic =
                `MOV ${
                    Object.keys(
                        this.registers
                    )[decoded.reg]
                }, r/m32`;

            return result;

        }


        /*
         * ADD EAX, imm32
         *
         * 05
         */

        if (opcode === 0x05) {

            const value =
                this.memory.read32(
                    start + 1
                );


            result.length = 5;

            result.mnemonic =
                `ADD EAX, ${hex(value)}`;

            return result;

        }


        /*
         * SUB EAX, imm32
         *
         * 2D
         */

        if (opcode === 0x2D) {

            const value =
                this.memory.read32(
                    start + 1
                );


            result.length = 5;

            result.mnemonic =
                `SUB EAX, ${hex(value)}`;

            return result;

        }


        /*
         * XOR EAX, EAX
         */

        if (opcode === 0x31) {

            const modrm =
                this.memory.read8(
                    start + 1
                );


            if (
                modrm === 0xC0
            ) {

                result.length = 2;

                result.mnemonic =
                    "XOR EAX, EAX";

                return result;

            }

        }


        /*
         * INC EAX
         */

        if (opcode === 0x40) {

            result.mnemonic =
                "INC EAX";

            return result;

        }


        /*
         * DEC EAX
         */

        if (opcode === 0x48) {

            result.mnemonic =
                "DEC EAX";

            return result;

        }


        return result;

    }


    /*
     * --------------------------------------------------------
     * Execute instruction
     * --------------------------------------------------------
     */

    executeInstruction() {

        const start =
            this.EIP;


        const opcode =
            this.fetch8();


        let mnemonic =
            "UNKNOWN";


        /*
         * NOP
         */

        if (opcode === 0x90) {

            mnemonic = "NOP";

        }


        /*
         * HLT
         */

        else if (opcode === 0xF4) {

            mnemonic = "HLT";

            this.halted = true;

            this.running = false;

        }


        /*
         * RET
         */

        else if (opcode === 0xC3) {

            mnemonic = "RET";

            this.EIP =
                this.pop32();

        }


        /*
         * MOV r32, imm32
         */

        else if (
            opcode >= 0xB8 &&
            opcode <= 0xBF
        ) {

            const reg =
                opcode - 0xB8;

            const value =
                this.fetch32();


            this.setRegister(
                reg,
                value
            );


            mnemonic =
                `MOV ${
                    Object.keys(
                        this.registers
                    )[reg]
                }, ${hex(value)}`;

        }


        /*
         * PUSH imm32
         */

        else if (opcode === 0x68) {

            const value =
                this.fetch32();


            this.push32(
                value
            );


            mnemonic =
                `PUSH ${hex(value)}`;

        }


        /*
         * PUSH register
         */

        else if (
            opcode >= 0x50 &&
            opcode <= 0x57
        ) {

            const reg =
                opcode - 0x50;


            const value =
                this.getRegister(
                    reg
                );


            this.push32(
                value
            );


            mnemonic =
                `PUSH ${
                    Object.keys(
                        this.registers
                    )[reg]
                }`;

        }


        /*
         * POP register
         */

        else if (
            opcode >= 0x58 &&
            opcode <= 0x5F
        ) {

            const reg =
                opcode - 0x58;


            const value =
                this.pop32();


            this.setRegister(
                reg,
                value
            );


            mnemonic =
                `POP ${
                    Object.keys(
                        this.registers
                    )[reg]
                }`;

        }


        /*
         * ADD EAX, imm32
         */

        else if (opcode === 0x05) {

            const value =
                this.fetch32();


            this.registers.EAX =
                u32(
                    this.registers.EAX +
                    value
                );


            this.updateZeroSign(
                this.registers.EAX
            );


            mnemonic =
                `ADD EAX, ${hex(value)}`;

        }


        /*
         * SUB EAX, imm32
         */

        else if (opcode === 0x2D) {

            const value =
                this.fetch32();


            this.registers.EAX =
                u32(
                    this.registers.EAX -
                    value
                );


            this.updateZeroSign(
                this.registers.EAX
            );


            mnemonic =
                `SUB EAX, ${hex(value)}`;

        }


        /*
         * XOR EAX,EAX
         */

        else if (
            opcode === 0x31 &&
            this.memory.read8(
                this.EIP
            ) === 0xC0
        ) {

            this.EIP++;

            this.registers.EAX = 0;

            this.updateZeroSign(
                0
            );


            mnemonic =
                "XOR EAX, EAX";

        }


        /*
         * INC EAX
         */

        else if (opcode === 0x40) {

            this.registers.EAX =
                u32(
                    this.registers.EAX + 1
                );


            this.updateZeroSign(
                this.registers.EAX
            );


            mnemonic =
                "INC EAX";

        }


        /*
         * DEC EAX
         */

        else if (opcode === 0x48) {

            this.registers.EAX =
                u32(
                    this.registers.EAX - 1
                );


            this.updateZeroSign(
                this.registers.EAX
            );


            mnemonic =
                "DEC EAX";

        }


        /*
         * CALL rel32
         */

        else if (opcode === 0xE8) {

            const rel =
                this.fetch32();


            const signed =
                sign32(rel);


            const target =
                u32(
                    this.EIP +
                    signed
                );


            this.push32(
                this.EIP
            );


            this.EIP =
                target;


            mnemonic =
                `CALL ${hex(target)}`;

        }


        /*
         * JMP rel32
         */

        else if (opcode === 0xE9) {

            const rel =
                this.fetch32();


            this.EIP =
                u32(
                    this.EIP +
                    sign32(rel)
                );


            mnemonic =
                `JMP ${hex(this.EIP)}`;

        }


        /*
         * JMP rel8
         */

        else if (opcode === 0xEB) {

            const rel =
                this.fetch8();


            this.EIP =
                u32(
                    this.EIP +
                    sign8(rel)
                );


            mnemonic =
                `JMP ${hex(this.EIP)}`;

        }


        /*
         * UNKNOWN
         */

        else {

            mnemonic =
                `UNKNOWN OPCODE ${hex(opcode, 2)}`;

            this.running = false;

        }


        this.cycles++;

        this.instructions++;


        this.trace.push({

            address:
                start,

            opcode,

            mnemonic,

            EAX:
                this.registers.EAX,

            EBX:
                this.registers.EBX,

            ECX:
                this.registers.ECX,

            EDX:
                this.registers.EDX,

            EIP:
                this.EIP

        });


        if (
            this.trace.length > 512
        ) {

            this.trace.shift();

        }


        return {

            address:
                start,

            opcode,

            mnemonic

        };

    }


    run(
        startAddress,
        instructionLimit =
            DEFAULT_EXECUTION_LIMIT
    ) {

        this.EIP =
            u32(startAddress);

        this.running = true;

        this.halted = false;


        let executed = 0;


        while (
            this.running &&
            !this.halted &&
            executed < instructionLimit
        ) {

            try {

                this.executeInstruction();

            } catch (error) {

                this.running = false;

                return {

                    stopped:
                        true,

                    reason:
                        "MEMORY_ERROR",

                    error:
                        error.message,

                    executed

                };

            }


            executed++;

        }


        if (
            executed >=
            instructionLimit
        ) {

            this.running = false;

        }


        return {

            stopped:
                true,

            reason:
                this.halted
                    ? "HLT"
                    : "LIMIT",

            executed,

            registers:
                { ...this.registers },

            EIP:
                this.EIP,

            EFLAGS:
                this.EFLAGS,

            trace:
                this.trace.slice()

        };

    }


    stop() {

        this.running = false;

    }

}


/* ============================================================
   XBE IMAGE
============================================================ */

class XBEImage {

    constructor(file) {

        this.file = file;

        this.buffer = null;

        this.bytes = null;

        this.valid = false;

        this.header = {};

        this.sections = [];

        this.entryPointEncoded = 0;

        this.entryPoint = null;

        this.entryPointKey = null;

        this.entryPointType = null;

    }


    async load() {

        if (!this.file) {

            throw new Error(
                "No XBE file supplied."
            );

        }


        this.buffer =
            await this.file.arrayBuffer();


        this.bytes =
            new Uint8Array(
                this.buffer
            );


        if (
            this.bytes.length <
            0x130
        ) {

            throw new Error(
                "File is too small to contain an XBE header."
            );

        }


        const view =
            new DataView(
                this.buffer
            );


        const magic =
            view.getUint32(
                0,
                true
            );


        if (
            magic !== XBE_MAGIC
        ) {

            throw new Error(
                "Invalid XBE signature. Expected XBEH."
            );

        }


        this.valid = true;


        this.parseHeader(
            view
        );


        this.parseSections(
            view
        );


        this.decodeEntryPoint();


        return this;

    }


    parseHeader(view) {

        this.header = {

            magic:
                view.getUint32(
                    0x00,
                    true
                ),

            baseAddress:
                view.getUint32(
                    0x104,
                    true
                ),

            sizeOfHeaders:
                view.getUint32(
                    0x108,
                    true
                ),

            sizeOfImage:
                view.getUint32(
                    0x10C,
                    true
                ),

            sizeOfImageHeader:
                view.getUint32(
                    0x110,
                    true
                ),

            timeDate:
                view.getUint32(
                    0x114,
                    true
                ),

            certificateAddress:
                view.getUint32(
                    0x118,
                    true
                ),

            numberOfSections:
                view.getUint32(
                    0x11C,
                    true
                ),

            sectionHeadersAddress:
                view.getUint32(
                    0x120,
                    true
                ),

            initializationFlags:
                view.getUint32(
                    0x124,
                    true
                ),

            entryPointEncoded:
                view.getUint32(
                    0x128,
                    true
                ),

            tlsAddress:
                view.getUint32(
                    0x12C,
                    true
                ),

            stackCommit:
                view.getUint32(
                    0x130,
                    true
                ),

            heapReserve:
                view.getUint32(
                    0x134,
                    true
                ),

            heapCommit:
                view.getUint32(
                    0x138,
                    true
                ),

            peBaseAddress:
                view.getUint32(
                    0x13C,
                    true
                ),

            peSizeOfImage:
                view.getUint32(
                    0x140,
                    true
                ),

            peChecksum:
                view.getUint32(
                    0x144,
                    true
                ),

            peTimeDate:
                view.getUint32(
                    0x148,
                    true
                )

        };


        this.entryPointEncoded =
            this.header.entryPointEncoded;

    }


    parseSections(view) {

        this.sections = [];


        const count =
            this.header.numberOfSections;


        const table =
            this.header.sectionHeadersAddress;


        /*
         * XBE virtual addresses in the header are
         * normally addresses in the loaded image.
         *
         * SectionHeader is 0x38 bytes.
         */

        const SECTION_SIZE = 0x38;


        for (
            let i = 0;
            i < count;
            i++
        ) {

            const address =
                table +
                i * SECTION_SIZE;


            if (
                address +
                SECTION_SIZE >
                this.bytes.length
            ) {

                break;

            }


            const flags =
                view.getUint32(
                    address,
                    true
                );


            const virtualAddress =
                view.getUint32(
                    address + 4,
                    true
                );


            const virtualSize =
                view.getUint32(
                    address + 8,
                    true
                );


            const rawAddress =
                view.getUint32(
                    address + 12,
                    true
                );


            const rawSize =
                view.getUint32(
                    address + 16,
                    true
                );


            const nameAddress =
                view.getUint32(
                    address + 20,
                    true
                );


            let name =
                `section_${i}`;


            /*
             * XBE section name address is an
             * image virtual address.
             */

            const nameOffset =
                this.virtualToFileOffset(
                    nameAddress
                );


            if (
                nameOffset !== null &&
                nameOffset <
                    this.bytes.length
            ) {

                const chars = [];


                for (
                    let p = nameOffset;
                    p <
                        Math.min(
                            nameOffset + 32,
                            this.bytes.length
                        );
                    p++
                ) {

                    const c =
                        this.bytes[p];


                    if (c === 0) {
                        break;
                    }


                    if (
                        c >= 32 &&
                        c <= 126
                    ) {

                        chars.push(
                            String.fromCharCode(c)
                        );

                    }

                }


                if (chars.length) {

                    name =
                        chars.join("");

                }

            }


            this.sections.push({

                index: i,

                flags,

                writable:
                    !!(flags & 1),

                preload:
                    !!(flags & 2),

                executable:
                    !!(flags & 4),

                virtualAddress,

                virtualSize,

                rawAddress,

                rawSize,

                nameAddress,

                name

            });

        }

    }


    decodeEntryPoint() {

        const encoded =
            this.entryPointEncoded;


        const retail =
            u32(
                encoded ^
                XBE_ENTRY_RETAIL
            );


        const debug =
            u32(
                encoded ^
                XBE_ENTRY_DEBUG
            );


        /*
         * Prefer an address that belongs
         * to an executable section.
         */

        const retailSection =
            this.findSectionByVirtualAddress(
                retail
            );


        const debugSection =
            this.findSectionByVirtualAddress(
                debug
            );


        if (
            retailSection &&
            retailSection.executable
        ) {

            this.entryPoint =
                retail;

            this.entryPointKey =
                XBE_ENTRY_RETAIL;

            this.entryPointType =
                "RETAIL";

            return;

        }


        if (
            debugSection &&
            debugSection.executable
        ) {

            this.entryPoint =
                debug;

            this.entryPointKey =
                XBE_ENTRY_DEBUG;

            this.entryPointType =
                "DEBUG";

            return;

        }


        /*
         * If section flags are inconclusive,
         * keep retail as the primary candidate.
         */

        this.entryPoint =
            retail;

        this.entryPointKey =
            XBE_ENTRY_RETAIL;

        this.entryPointType =
            "RETAIL?";

    }


    findSectionByVirtualAddress(
        address
    ) {

        address >>>= 0;


        for (
            const section
            of this.sections
        ) {

            const start =
                section.virtualAddress >>> 0;


            const end =
                u32(
                    start +
                    section.virtualSize
                );


            if (
                address >= start &&
                address < end
            ) {

                return section;

            }

        }


        return null;

    }


    virtualToFileOffset(
        virtualAddress
    ) {

        virtualAddress >>>= 0;


        /*
         * Header area.
         */

        if (
            virtualAddress >=
                this.header.baseAddress &&
            virtualAddress <
                this.header.baseAddress +
                this.header.sizeOfHeaders
        ) {

            return (
                virtualAddress -
                this.header.baseAddress
            );

        }


        for (
            const section
            of this.sections
        ) {

            const start =
                section.virtualAddress >>> 0;


            const end =
                u32(
                    start +
                    Math.max(
                        section.virtualSize,
                        section.rawSize
                    )
                );


            if (
                virtualAddress >= start &&
                virtualAddress < end
            ) {

                const relative =
                    virtualAddress -
                    start;


                if (
                    relative >=
                    section.rawSize
                ) {

                    return null;

                }


                return (
                    section.rawAddress +
                    relative
                );

            }

        }


        /*
         * Some XBE layouts use addresses relative
         * to the image base. Try that as fallback.
         */

        const relative =
            u32(
                virtualAddress -
                this.header.baseAddress
            );


        if (
            relative <
            this.bytes.length
        ) {

            return relative;

        }


        return null;

    }


    getEntryPointFileOffset() {

        if (
            this.entryPoint === null
        ) {

            return null;

        }


        return this.virtualToFileOffset(
            this.entryPoint
        );

    }


    getEntryPointBytes(
        count = 32
    ) {

        const offset =
            this.getEntryPointFileOffset();


        if (
            offset === null
        ) {

            return null;

        }


        const available =
            Math.min(
                count,
                this.bytes.length -
                offset
            );


        return this.bytes.slice(
            offset,
            offset + available
        );

    }


    loadIntoMemory(
        memory
    ) {

        /*
         * Load headers.
         */

        const base =
            this.header.baseAddress >>> 0;


        if (
            base +
            this.header.sizeOfHeaders >
            memory.size
        ) {

            throw new Error(
                "XBE headers do not fit in RAM."
            );

        }


        memory.writeBytes(
            base,
            this.bytes.slice(
                0,
                this.header.sizeOfHeaders
            )
        );


        /*
         * Load sections at their virtual addresses.
         */

        for (
            const section
            of this.sections
        ) {

            if (
                section.rawSize === 0
            ) {

                continue;

            }


            const sourceStart =
                section.rawAddress;


            const sourceEnd =
                Math.min(
                    sourceStart +
                    section.rawSize,
                    this.bytes.length
                );


            const sectionBytes =
                this.bytes.slice(
                    sourceStart,
                    sourceEnd
                );


            const destination =
                section.virtualAddress;


            if (
                destination +
                sectionBytes.length >
                memory.size
            ) {

                throw new Error(
                    `Section ${section.name} does not fit in RAM.`
                );

            }


            memory.writeBytes(
                destination,
                sectionBytes
            );

        }


        return true;

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

}


/* ============================================================
   XBE EXECUTION RESULT
============================================================ */

class XBEExecutionResult {

    constructor() {

        this.success = false;

        this.reason = "";

        this.entryPoint = null;

        this.entryPointFileOffset = null;

        this.entryPointBytes = [];

        this.trace = [];

        this.registers = null;

        this.cycles = 0;

    }

}


/* ============================================================
   WEBBKTX CORE
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


        this.lastExecution =
            null;

    }


    reset() {

        this.memory.clear();

        this.cpu.reset();

        this.game = null;

        this.lastExecution = null;

    }


    runDiagnostics() {

        this.cpu.reset();


        /*
         * Small internal CPU test.
         */

        const testAddress =
            0x1000;


        const program =
            new Uint8Array([

                /*
                 * MOV EAX,10
                 */
                0xB8,
                0x0A,
                0x00,
                0x00,
                0x00,

                /*
                 * ADD EAX,20
                 */
                0x05,
                0x14,
                0x00,
                0x00,
                0x00,

                /*
                 * HLT
                 */
                0xF4

            ]);


        this.memory.writeBytes(
            testAddress,
            program
        );


        const result =
            this.cpu.run(
                testAddress,
                16
            );


        return {

            ram: {

                passed:
                    true,

                size:
                    this.memory.size

            },

            cpu:
                result,

            cpuPassed:
                result.registers.EAX === 30

        };

    }


    async loadGame(file) {

        const image =
            new XBEImage(
                file
            );


        await image.load();


        /*
         * Load XBE into virtual RAM.
         */

        image.loadIntoMemory(
            this.memory
        );


        this.game = {

            image,

            recognized:
                image.valid,

            format:
                image.status,

            size:
                image.size,

            entryPoint:
                image.entryPoint,

            entryPointHex:
                hex(
                    image.entryPoint
                ),

            entryPointType:
                image.entryPointType,

            entryPointFileOffset:
                image.getEntryPointFileOffset(),

            entryPointBytes:
                image.getEntryPointBytes(
                    32
                ),

            sections:
                image.sections

        };


        return this.game;

    }


    /*
     * --------------------------------------------------------
     * Analyze XBE entry point
     * --------------------------------------------------------
     */

    analyzeEntryPoint() {

        if (
            !this.game ||
            !this.game.image
        ) {

            throw new Error(
                "No XBE is loaded."
            );

        }


        const image =
            this.game.image;


        const bytes =
            image.getEntryPointBytes(
                32
            );


        const decoded = [];


        if (bytes) {

            /*
             * Temporarily place the first bytes
             * at the actual entry-point virtual address.
             *
             * They are already loaded there by the
             * section loader, so no copying is needed.
             */

            for (
                let offset = 0;
                offset < bytes.length;
            ) {

                const address =
                    u32(
                        image.entryPoint +
                        offset
                    );


                const instruction =
                    this.cpu.decodeInstruction(
                        address
                    );


                decoded.push(
                    instruction
                );


                if (
                    instruction.length <= 0
                ) {

                    break;

                }


                offset +=
                    instruction.length;


                /*
                 * Stop if instruction is unknown.
                 */

                if (
                    instruction.mnemonic
                        .startsWith(
                            "UNKNOWN"
                        )
                ) {

                    break;

                }

            }

        }


        return {

            entryPoint:
                image.entryPoint,

            entryPointHex:
                hex(
                    image.entryPoint
                ),

            entryPointFileOffset:
                image.getEntryPointFileOffset(),

            type:
                image.entryPointType,

            bytes:
                bytes
                    ? Array.from(bytes)
                    : [],

            instructions:
                decoded

        };

    }


    /*
     * --------------------------------------------------------
     * Execute first XBE instructions
     * --------------------------------------------------------
     */

    executeEntryPoint(
        instructionLimit = 32
    ) {

        if (
            !this.game ||
            !this.game.image
        ) {

            throw new Error(
                "No XBE is loaded."
            );

        }


        const image =
            this.game.image;


        if (
            image.entryPoint === null
        ) {

            throw new Error(
                "XBE entry point could not be decoded."
            );

        }


        /*
         * Set up an experimental stack.
         *
         * This is NOT the real Xbox process setup.
         */

        this.cpu.reset();


        this.cpu.registers.ESP =
            RAM_SIZE -
            0x1000;


        this.cpu.registers.EBP =
            this.cpu.registers.ESP;


        this.cpu.EIP =
            image.entryPoint;


        const result =
            new XBEExecutionResult();


        result.entryPoint =
            image.entryPoint;


        result.entryPointFileOffset =
            image.getEntryPointFileOffset();


        result.entryPointBytes =
            image.getEntryPointBytes(
                32
            ) || [];


        try {

            const execution =
                this.cpu.run(
                    image.entryPoint,
                    instructionLimit
                );


            result.success =
                execution.reason === "HLT" ||
                execution.executed > 0;


            result.reason =
                execution.reason;


            result.trace =
                execution.trace;


            result.registers =
                execution.registers;


            result.cycles =
                execution.cycles;

        } catch (error) {

            result.success = false;

            result.reason =
                "ERROR: " +
                error.message;

        }


        this.lastExecution =
            result;


        return result;

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

    RAM_SIZE,

    X86CPU,

    WebBktxMemory,

    XBEImage,

    XBEExecutionResult,

    WebBktxCore

};


/* ============================================================
   DEBUG INFORMATION
============================================================ */

console.log(
    `%cWebBktx Core ${WEBBKTX_VERSION}`,
    "font-weight:bold"
);

console.log(
    "32 MB RAM"
);

console.log(
    "XBE Entry Point Decoder: READY"
);

console.log(
    "x86 Experimental Executor: READY"
);
