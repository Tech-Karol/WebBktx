/*
 * ============================================================
 * WebBktx Core
 *
 * Version: 0.5
 *
 * Experimental x86 execution core
 * Xbox-compatible memory foundation
 *
 * Components:
 *
 *   - 64 MB emulated RAM
 *   - x86 register file
 *   - EIP
 *   - EFLAGS
 *   - stack
 *   - instruction fetch
 *   - opcode decoder
 *   - ModR/M decoder
 *   - MOV
 *   - ADD
 *   - SUB
 *   - INC
 *   - DEC
 *   - XOR
 *   - PUSH
 *   - POP
 *   - JMP
 *   - RET
 *   - NOP
 *   - HLT
 *   - XBE detection
 *   - XBE loading
 *
 * IMPORTANT:
 *
 * This is NOT a complete Xbox emulator.
 *
 * It does not yet emulate:
 *
 *   - Xbox kernel
 *   - NV2A GPU
 *   - MCPX
 *   - audio hardware
 *   - DirectX/XDK environment
 *   - Xbox memory mapping
 *   - interrupts
 *   - DMA
 *   - PCI devices
 *   - BIOS
 *   - full x86 instruction set
 *
 * ============================================================
 */

"use strict";


/* ============================================================
   VERSION
============================================================ */

const WEBBKTX_CORE_VERSION =
    "0.5";


/* ============================================================
   MEMORY
============================================================ */

/*
 * Classic Xbox:
 *
 * 64 MB unified system memory.
 *
 * We use exactly 64 MB as the default
 * physical emulated memory.
 */

const RAM_SIZE =
    64 * 1024 * 1024;


/*
 * Default program location.
 *
 * This is only a simplified development
 * mapping and is NOT the real Xbox
 * virtual memory layout.
 */

const DEFAULT_LOAD_ADDRESS =
    0x00010000;


/* ============================================================
   FLAGS
============================================================ */

const FLAG_CF = 1 << 0;
const FLAG_PF = 1 << 2;
const FLAG_ZF = 1 << 6;
const FLAG_SF = 1 << 7;
const FLAG_OF = 1 << 11;


/* ============================================================
   REGISTER IDS
============================================================ */

const REG_EAX = 0;
const REG_ECX = 1;
const REG_EDX = 2;
const REG_EBX = 3;
const REG_ESP = 4;
const REG_EBP = 5;
const REG_ESI = 6;
const REG_EDI = 7;


const REGISTER_NAMES = [
    "EAX",
    "ECX",
    "EDX",
    "EBX",
    "ESP",
    "EBP",
    "ESI",
    "EDI"
];


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

        this.memory.fill(0);

    }


    checkAddress(
        address,
        bytes = 1
    ) {

        address =
            address >>> 0;


        if (
            !Number.isInteger(address) ||
            address < 0 ||
            address + bytes > this.size
        ) {

            throw new RangeError(
                "RAM address out of range: 0x" +
                address.toString(16)
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


    read8s(
        address
    ) {

        this.checkAddress(
            address,
            1
        );

        return this.view.getInt8(
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


    read16s(
        address
    ) {

        this.checkAddress(
            address,
            2
        );

        return this.view.getInt16(
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


    read32s(
        address
    ) {

        this.checkAddress(
            address,
            4
        );

        return this.view.getInt32(
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


        this.EIP =
            DEFAULT_LOAD_ADDRESS;


        this.EFLAGS =
            0x00000002;


        this.running =
            false;


        this.halted =
            false;


        this.cycles =
            0;


        this.instructions =
            0;


        this.lastOpcode =
            0;


        this.lastInstruction =
            "NONE";


        this.stackBase =
            this.memory.size -
            0x1000;


        this.stackSize =
            0x1000;


        this.reset();

    }


    /* --------------------------------------------------------
       RESET
    -------------------------------------------------------- */

    reset() {

        this.registers.EAX = 0;
        this.registers.EBX = 0;
        this.registers.ECX = 0;
        this.registers.EDX = 0;

        this.registers.ESI = 0;
        this.registers.EDI = 0;

        this.registers.EBP =
            this.stackBase;

        this.registers.ESP =
            this.stackBase;

        this.EIP =
            DEFAULT_LOAD_ADDRESS;

        this.EFLAGS =
            0x00000002;

        this.running =
            false;

        this.halted =
            false;

        this.cycles =
            0;

        this.instructions =
            0;

        this.lastOpcode =
            0;

        this.lastInstruction =
            "RESET";

    }


    /* --------------------------------------------------------
       REGISTER ACCESS
    -------------------------------------------------------- */

    getRegister(
        index
    ) {

        switch (
            index & 7
        ) {

            case REG_EAX:
                return this.registers.EAX;

            case REG_ECX:
                return this.registers.ECX;

            case REG_EDX:
                return this.registers.EDX;

            case REG_EBX:
                return this.registers.EBX;

            case REG_ESP:
                return this.registers.ESP;

            case REG_EBP:
                return this.registers.EBP;

            case REG_ESI:
                return this.registers.ESI;

            case REG_EDI:
                return this.registers.EDI;

        }


        return 0;

    }


    setRegister(
        index,
        value
    ) {

        value =
            value >>> 0;


        switch (
            index & 7
        ) {

            case REG_EAX:
                this.registers.EAX = value;
                break;

            case REG_ECX:
                this.registers.ECX = value;
                break;

            case REG_EDX:
                this.registers.EDX = value;
                break;

            case REG_EBX:
                this.registers.EBX = value;
                break;

            case REG_ESP:
                this.registers.ESP = value;
                break;

            case REG_EBP:
                this.registers.EBP = value;
                break;

            case REG_ESI:
                this.registers.ESI = value;
                break;

            case REG_EDI:
                this.registers.EDI = value;
                break;

        }

    }


    /* --------------------------------------------------------
       FETCH
    -------------------------------------------------------- */

    fetch8() {

        const value =
            this.memory.read8(
                this.EIP
            );

        this.EIP =
            (
                this.EIP + 1
            ) >>> 0;

        return value;

    }


    fetch16() {

        const value =
            this.memory.read16(
                this.EIP
            );

        this.EIP =
            (
                this.EIP + 2
            ) >>> 0;

        return value;

    }


    fetch32() {

        const value =
            this.memory.read32(
                this.EIP
            );

        this.EIP =
            (
                this.EIP + 4
            ) >>> 0;

        return value;

    }


    fetch32s() {

        const value =
            this.memory.read32s(
                this.EIP
            );

        this.EIP =
            (
                this.EIP + 4
            ) >>> 0;

        return value;

    }


    /* --------------------------------------------------------
       FLAGS
    -------------------------------------------------------- */

    setFlag(
        flag,
        state
    ) {

        if (state) {

            this.EFLAGS |= flag;

        } else {

            this.EFLAGS &= ~flag;

        }

    }


    getFlag(
        flag
    ) {

        return (
            (this.EFLAGS & flag) !== 0
        );

    }


    updateLogicFlags(
        result
    ) {

        result =
            result >>> 0;


        this.setFlag(
            FLAG_CF,
            false
        );


        this.setFlag(
            FLAG_OF,
            false
        );


        this.setFlag(
            FLAG_ZF,
            result === 0
        );


        this.setFlag(
            FLAG_SF,
            (result & 0x80000000) !== 0
        );


        this.setFlag(
            FLAG_PF,
            parity8(result & 0xFF)
        );

    }


    updateAddFlags(
        a,
        b,
        result
    ) {

        a >>>= 0;
        b >>>= 0;
        result >>>= 0;


        this.setFlag(
            FLAG_CF,
            result < a
        );


        this.setFlag(
            FLAG_ZF,
            result === 0
        );


        this.setFlag(
            FLAG_SF,
            (result & 0x80000000) !== 0
        );


        this.setFlag(
            FLAG_PF,
            parity8(result & 0xFF)
        );


        const overflow =
            (
                (~(a ^ b) &
                (a ^ result) &
                0x80000000) !== 0
            );


        this.setFlag(
            FLAG_OF,
            overflow
        );

    }


    updateSubFlags(
        a,
        b,
        result
    ) {

        a >>>= 0;
        b >>>= 0;
        result >>>= 0;


        this.setFlag(
            FLAG_CF,
            a < b
        );


        this.setFlag(
            FLAG_ZF,
            result === 0
        );


        this.setFlag(
            FLAG_SF,
            (result & 0x80000000) !== 0
        );


        this.setFlag(
            FLAG_PF,
            parity8(result & 0xFF)
        );


        const overflow =
            (
                ((a ^ b) &
                (a ^ result) &
                0x80000000) !== 0
            );


        this.setFlag(
            FLAG_OF,
            overflow
        );

    }


    /* --------------------------------------------------------
       MODRM
    -------------------------------------------------------- */

    decodeModRM() {

        const modrm =
            this.fetch8();


        const mod =
            (modrm >> 6) & 3;


        const reg =
            (modrm >> 3) & 7;


        const rm =
            modrm & 7;


        if (
            mod === 3
        ) {

            return {

                mod,
                reg,
                rm,
                register: true

            };

        }


        let address = 0;


        /*
         * Simple 32-bit addressing.
         */

        if (
            rm === 4
        ) {

            /*
             * SIB byte.
             */

            const sib =
                this.fetch8();


            const scale =
                (sib >> 6) & 3;


            const index =
                (sib >> 3) & 7;


            const base =
                sib & 7;


            if (
                index !== 4
            ) {

                address =
                    (
                        address +
                        (
                            this.getRegister(
                                index
                            ) *
                            (1 << scale)
                        )
                    ) >>> 0;

            }


            if (
                base === 5 &&
                mod === 0
            ) {

                address =
                    (
                        address +
                        this.fetch32s()
                    ) >>> 0;

            } else {

                address =
                    (
                        address +
                        this.getRegister(
                            base
                        )
                    ) >>> 0;

            }

        } else {

            if (
                mod === 0 &&
                rm === 5
            ) {

                address =
                    this.fetch32s() >>> 0;

            } else {

                address =
                    this.getRegister(
                        rm
                    );

            }

        }


        if (
            mod === 1
        ) {

            address =
                (
                    address +
                    this.fetch8Signed()
                ) >>> 0;

        }


        if (
            mod === 2
        ) {

            address =
                (
                    address +
                    this.fetch32s()
                ) >>> 0;

        }


        return {

            mod,
            reg,
            rm,
            register: false,
            address

        };

    }


    fetch8Signed() {

        return this.memory.read8s(
            this.EIP++
        );

    }


    readRM32(
        operand
    ) {

        if (
            operand.register
        ) {

            return this.getRegister(
                operand.rm
            );

        }


        return this.memory.read32(
            operand.address
        );

    }


    writeRM32(
        operand,
        value
    ) {

        value =
            value >>> 0;


        if (
            operand.register
        ) {

            this.setRegister(
                operand.rm,
                value
            );

            return;

        }


        this.memory.write32(
            operand.address,
            value
        );

    }


    /* --------------------------------------------------------
       STACK
    -------------------------------------------------------- */

    push32(
        value
    ) {

        const newESP =
            (
                this.registers.ESP -
                4
            ) >>> 0;


        if (
            newESP >= this.memory.size
        ) {

            throw new Error(
                "Stack overflow."
            );

        }


        this.registers.ESP =
            newESP;


        this.memory.write32(
            newESP,
            value
        );

    }


    pop32() {

        const esp =
            this.registers.ESP;


        if (
            esp + 4 >
            this.memory.size
        ) {

            throw new Error(
                "Stack underflow."
            );

        }


        const value =
            this.memory.read32(
                esp
            );


        this.registers.ESP =
            (
                esp + 4
            ) >>> 0;


        return value;

    }


    /* --------------------------------------------------------
       EXECUTE ONE INSTRUCTION
    -------------------------------------------------------- */

    step() {

        if (
            this.halted
        ) {

            return {

                opcode: 0xF4,

                mnemonic: "HLT"

            };

        }


        const startEIP =
            this.EIP;


        const opcode =
            this.fetch8();


        this.lastOpcode =
            opcode;


        let mnemonic =
            "UNKNOWN";


        switch (opcode) {

            /* ================================================
               NOP
            ================================================= */

            case 0x90:

                mnemonic =
                    "NOP";

                break;


            /* ================================================
               HLT
            ================================================= */

            case 0xF4:

                mnemonic =
                    "HLT";

                this.halted =
                    true;

                this.running =
                    false;

                break;


            /* ================================================
               MOV r32, imm32
               
               B8 + register
            ================================================= */

            case 0xB8:
            case 0xB9:
            case 0xBA:
            case 0xBB:
            case 0xBC:
            case 0xBD:
            case 0xBE:
            case 0xBF: {

                const reg =
                    opcode -
                    0xB8;


                const value =
                    this.fetch32();


                this.setRegister(
                    reg,
                    value
                );


                mnemonic =
                    "MOV " +
                    REGISTER_NAMES[reg] +
                    ", 0x" +
                    value
                        .toString(16)
                        .toUpperCase();

                break;

            }


            /* ================================================
               ADD EAX, imm32
               
               05 id
            ================================================= */

            case 0x05: {

                const value =
                    this.fetch32();


                const old =
                    this.registers.EAX;


                const result =
                    (
                        old +
                        value
                    ) >>> 0;


                this.registers.EAX =
                    result;


                this.updateAddFlags(
                    old,
                    value,
                    result
                );


                mnemonic =
                    "ADD EAX, 0x" +
                    value
                        .toString(16)
                        .toUpperCase();

                break;

            }


            /* ================================================
               SUB EAX, imm32
               
               2D id
            ================================================= */

            case 0x2D: {

                const value =
                    this.fetch32();


                const old =
                    this.registers.EAX;


                const result =
                    (
                        old -
                        value
                    ) >>> 0;


                this.registers.EAX =
                    result;


                this.updateSubFlags(
                    old,
                    value,
                    result
                );


                mnemonic =
                    "SUB EAX, 0x" +
                    value
                        .toString(16)
                        .toUpperCase();

                break;

            }


            /* ================================================
               INC r32
               
               40 + register
            ================================================= */

            case 0x40:
            case 0x41:
            case 0x42:
            case 0x43:
            case 0x44:
            case 0x45:
            case 0x46:
            case 0x47: {

                const reg =
                    opcode -
                    0x40;


                const old =
                    this.getRegister(
                        reg
                    );


                const result =
                    (
                        old +
                        1
                    ) >>> 0;


                this.setRegister(
                    reg,
                    result
                );


                /*
                 * INC does not modify CF.
                 */

                const oldCF =
                    this.getFlag(
                        FLAG_CF
                    );


                this.updateAddFlags(
                    old,
                    1,
                    result
                );


                this.setFlag(
                    FLAG_CF,
                    oldCF
                );


                mnemonic =
                    "INC " +
                    REGISTER_NAMES[reg];

                break;

            }


            /* ================================================
               DEC r32
               
               48 + register
            ================================================= */

            case 0x48:
            case 0x49:
            case 0x4A:
            case 0x4B:
            case 0x4C:
            case 0x4D:
            case 0x4E:
            case 0x4F: {

                const reg =
                    opcode -
                    0x48;


                const old =
                    this.getRegister(
                        reg
                    );


                const result =
                    (
                        old -
                        1
                    ) >>> 0;


                this.setRegister(
                    reg,
                    result
                );


                const oldCF =
                    this.getFlag(
                        FLAG_CF
                    );


                this.updateSubFlags(
                    old,
                    1,
                    result
                );


                this.setFlag(
                    FLAG_CF,
                    oldCF
                );


                mnemonic =
                    "DEC " +
                    REGISTER_NAMES[reg];

                break;

            }


            /* ================================================
               XOR r/m32, r32
               
               31 /r
            ================================================= */

            case 0x31: {

                const operand =
                    this.decodeModRM();


                const source =
                    this.getRegister(
                        operand.reg
                    );


                const destination =
                    this.readRM32(
                        operand
                    );


                const result =
                    (
                        destination ^
                        source
                    ) >>> 0;


                this.writeRM32(
                    operand,
                    result
                );


                this.updateLogicFlags(
                    result
                );


                mnemonic =
                    "XOR " +
                    this.operandName(
                        operand
                    ) +
                    ", " +
                    REGISTER_NAMES[
                        operand.reg
                    ];

                break;

            }


            /* ================================================
               MOV r/m32, r32
               
               89 /r
            ================================================= */

            case 0x89: {

                const operand =
                    this.decodeModRM();


                const source =
                    this.getRegister(
                        operand.reg
                    );


                this.writeRM32(
                    operand,
                    source
                );


                mnemonic =
                    "MOV " +
                    this.operandName(
                        operand
                    ) +
                    ", " +
                    REGISTER_NAMES[
                        operand.reg
                    ];

                break;

            }


            /* ================================================
               MOV r32, r/m32
               
               8B /r
            ================================================= */

            case 0x8B: {

                const operand =
                    this.decodeModRM();


                const value =
                    this.readRM32(
                        operand
                    );


                this.setRegister(
                    operand.reg,
                    value
                );


                mnemonic =
                    "MOV " +
                    REGISTER_NAMES[
                        operand.reg
                    ] +
                    ", " +
                    this.operandName(
                        operand
                    );

                break;

            }


            /* ================================================
               PUSH r32
               
               50 + register
            ================================================= */

            case 0x50:
            case 0x51:
            case 0x52:
            case 0x53:
            case 0x54:
            case 0x55:
            case 0x56:
            case 0x57: {

                const reg =
                    opcode -
                    0x50;


                const value =
                    this.getRegister(
                        reg
                    );


                this.push32(
                    value
                );


                mnemonic =
                    "PUSH " +
                    REGISTER_NAMES[reg];

                break;

            }


            /* ================================================
               POP r32
               
               58 + register
            ================================================= */

            case 0x58:
            case 0x59:
            case 0x5A:
            case 0x5B:
            case 0x5C:
            case 0x5D:
            case 0x5E:
            case 0x5F: {

                const reg =
                    opcode -
                    0x58;


                const value =
                    this.pop32();


                this.setRegister(
                    reg,
                    value
                );


                mnemonic =
                    "POP " +
                    REGISTER_NAMES[reg];

                break;

            }


            /* ================================================
               JMP rel32
               
               E9 cd
            ================================================= */

            case 0xE9: {

                const displacement =
                    this.fetch32s();


                this.EIP =
                    (
                        this.EIP +
                        displacement
                    ) >>> 0;


                mnemonic =
                    "JMP " +
                    displacement;

                break;

            }


            /* ================================================
               JMP rel8
               
               EB cb
            ================================================= */

            case 0xEB: {

                const displacement =
                    this.fetch8Signed();


                this.EIP =
                    (
                        this.EIP +
                        displacement
                    ) >>> 0;


                mnemonic =
                    "JMP " +
                    displacement;

                break;

            }


            /* ================================================
               RET
               
               C3
            ================================================= */

            case 0xC3: {

                this.EIP =
                    this.pop32();


                mnemonic =
                    "RET";

                break;

            }


            /* ================================================
               CALL rel32
               
               E8 cd
            ================================================= */

            case 0xE8: {

                const displacement =
                    this.fetch32s();


                const returnAddress =
                    this.EIP;


                this.push32(
                    returnAddress
                );


                this.EIP =
                    (
                        this.EIP +
                        displacement
                    ) >>> 0;


                mnemonic =
                    "CALL " +
                    displacement;

                break;

            }


            /* ================================================
               MOV r/m32, imm32
               
               C7 /0
            ================================================= */

            case 0xC7: {

                const operand =
                    this.decodeModRM();


                if (
                    operand.reg !== 0
                ) {

                    throw new Error(
                        "Unsupported C7 /" +
                        operand.reg
                    );

                }


                const value =
                    this.fetch32();


                this.writeRM32(
                    operand,
                    value
                );


                mnemonic =
                    "MOV " +
                    this.operandName(
                        operand
                    ) +
                    ", 0x" +
                    value
                        .toString(16)
                        .toUpperCase();

                break;

            }


            default:

                throw new Error(
                    "Unsupported x86 opcode 0x" +
                    opcode
                        .toString(16)
                        .padStart(2, "0")
                        .toUpperCase() +
                    " at EIP 0x" +
                    startEIP
                        .toString(16)
                        .padStart(8, "0")
                        .toUpperCase()
                );

        }


        this.cycles++;
        this.instructions++;

        this.lastInstruction =
            mnemonic;


        return {

            opcode,

            mnemonic,

            address:
                startEIP,

            nextEIP:
                this.EIP,

            cycles:
                this.cycles

        };

    }


    /* --------------------------------------------------------
       OPERAND NAME
    -------------------------------------------------------- */

    operandName(
        operand
    ) {

        if (
            operand.register
        ) {

            return REGISTER_NAMES[
                operand.rm
            ];

        }


        return (
            "[0x" +
            operand.address
                .toString(16)
                .padStart(8, "0")
                .toUpperCase() +
            "]"
        );

    }


    /* --------------------------------------------------------
       RUN
    -------------------------------------------------------- */

    run(
        programOrOptions
    ) {

        /*
         * Compatibility with old WebBktx
         * diagnostic API.
         *
         * Example:
         *
         * cpu.run([
         *   { opcode: 0x01, value: 10 },
         *   { opcode: 0x02, value: 20 }
         * ])
         */

        if (
            Array.isArray(
                programOrOptions
            )
        ) {

            return this.runTestProgram(
                programOrOptions
            );

        }


        const options =
            programOrOptions ||
            {};


        const maxCycles =
            options.maxCycles ||
            100000;


        this.running =
            true;


        this.halted =
            false;


        let executed =
            0;


        while (
            this.running &&
            !this.halted &&
            executed < maxCycles
        ) {

            this.step();

            executed++;

        }


        if (
            executed >= maxCycles
        ) {

            this.running =
                false;

        }


        return this.getState();

    }


    /* --------------------------------------------------------
       TEST PROGRAM COMPATIBILITY
    -------------------------------------------------------- */

    runTestProgram(
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


            switch (
                instruction.opcode
            ) {

                /*
                 * Legacy:
                 *
                 * 01 = MOV EAX, immediate
                 */

                case 0x01:

                    this.registers.EAX =
                        instruction.value >>> 0;

                    this.EIP++;

                    this.cycles++;

                    this.instructions++;

                    this.lastInstruction =
                        "MOV EAX, " +
                        instruction.value;

                    break;


                /*
                 * Legacy:
                 *
                 * 02 = ADD EAX, immediate
                 */

                case 0x02: {

                    const old =
                        this.registers.EAX;


                    const value =
                        instruction.value >>> 0;


                    const result =
                        (
                            old +
                            value
                        ) >>> 0;


                    this.registers.EAX =
                        result;


                    this.updateAddFlags(
                        old,
                        value,
                        result
                    );


                    this.EIP++;

                    this.cycles++;

                    this.instructions++;

                    this.lastInstruction =
                        "ADD EAX, " +
                        instruction.value;

                    break;

                }


                /*
                 * Legacy:
                 *
                 * 03 = SUB EAX, immediate
                 */

                case 0x03: {

                    const old =
                        this.registers.EAX;


                    const value =
                        instruction.value >>> 0;


                    const result =
                        (
                            old -
                            value
                        ) >>> 0;


                    this.registers.EAX =
                        result;


                    this.updateSubFlags(
                        old,
                        value,
                        result
                    );


                    this.EIP++;

                    this.cycles++;

                    this.instructions++;

                    this.lastInstruction =
                        "SUB EAX, " +
                        instruction.value;

                    break;

                }


                default:

                    throw new Error(
                        "Unknown test opcode: 0x" +
                        instruction.opcode
                            .toString(16)
                    );

            }

        }


        this.running =
            false;


        return this.getState();

    }


    /* --------------------------------------------------------
       STATE
    -------------------------------------------------------- */

    getState() {

        return {

            registers:
                {
                    ...this.registers
                },

            EIP:
                this.EIP,

            EFLAGS:
                this.EFLAGS >>> 0,

            cycles:
                this.cycles,

            instructions:
                this.instructions,

            halted:
                this.halted,

            running:
                this.running,

            lastOpcode:
                this.lastOpcode,

            lastInstruction:
                this.lastInstruction

        };

    }


    /* --------------------------------------------------------
       LOAD CODE
    -------------------------------------------------------- */

    loadCode(
        bytes,
        address = DEFAULT_LOAD_ADDRESS
    ) {

        this.memory.writeBytes(
            address,
            bytes
        );


        this.EIP =
            address >>> 0;


        return {

            address:
                address >>> 0,

            size:
                bytes.length

        };

    }


    /* --------------------------------------------------------
       STOP
    -------------------------------------------------------- */

    stop() {

        this.running =
            false;

    }

}


/* ============================================================
   PARITY
============================================================ */

function parity8(
    value
) {

    value &=
        0xFF;


    let count =
        0;


    for (
        let i = 0;
        i < 8;
        i++
    ) {

        count +=
            (value >> i) & 1;

    }


    return (
        (count & 1) === 0
    );

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
        0x1000000,
        0x2000000,
        0x3FFFFF,
        memory.size - 1

    ];


    /*
     * 0xAA
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
     * 0x55
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
     * Address pattern
     */

    for (
        let i = 0;
        i < addresses.length;
        i++
    ) {

        memory.write8(
            addresses[i],
            (
                i + 1
            ) & 0xFF
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
            value !==
            (
                i + 1
            ) & 0xFF
        ) {

            return {

                passed: false,

                test: "ADDRESS",

                address:
                    addresses[i],

                expected:
                    (
                        i + 1
                    ) & 0xFF,

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
   XBE
============================================================ */

const XBE_MAGIC =
    0x48454258;


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
            this.magic === XBE_MAGIC;


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


        this.header.magic =
            view.getUint32(
                0,
                true
            );


        this.header.size =
            this.bytes.length;


        /*
         * XBE header fields.
         *
         * These are read conservatively because
         * the full XBE image/section mapping is
         * not implemented yet.
         */


        if (
            this.bytes.length >= 0x104
        ) {

            this.header.baseAddress =
                view.getUint32(
                    0x104,
                    true
                );

        }


        /*
         * Entry point is normally represented
         * by an RVA-like value in the XBE
         * header.
         */

        if (
            this.bytes.length >= 0x128
        ) {

            this.header.entryPoint =
                view.getUint32(
                    0x128,
                    true
                );

        }

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


    loadIntoMemory(
        memory,
        address = DEFAULT_LOAD_ADDRESS
    ) {

        if (
            !this.bytes
        ) {

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
                "Game image does not fit in emulated RAM. " +
                "Image: " +
                this.bytes.length +
                " bytes, RAM: " +
                memory.size +
                " bytes."
            );

        }


        memory.writeBytes(
            address,
            this.bytes
        );


        return {

            address:
                address >>> 0,

            size:
                this.bytes.length,

            entryPoint:
                this.header.entryPoint ||
                0,

            baseAddress:
                this.header.baseAddress ||
                0

        };

    }

}


/* ============================================================
   GAME LOADER
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

        size:
            image.size,

        memory:
            memoryInfo

    };

}


/* ============================================================
   WEBBKTX CORE
============================================================ */

class WebBktxCore {

    constructor(
        options = {}
    ) {

        const memorySize =
            options.memorySize ||
            RAM_SIZE;


        this.memory =
            new WebBktxMemory(
                memorySize
            );


        this.cpu =
            new X86CPU(
                this.memory
            );


        this.game =
            null;


        this.version =
            WEBBKTX_CORE_VERSION;

    }


    /* --------------------------------------------------------
       RESET
    -------------------------------------------------------- */

    reset() {

        this.memory.clear();

        this.cpu.reset();

        this.game =
            null;

    }


    /* --------------------------------------------------------
       DIAGNOSTICS
    -------------------------------------------------------- */

    runDiagnostics() {

        const ram =
            testRAM(
                this.memory
            );


        /*
         * Legacy test API.
         *
         * This remains because app.js 0.4
         * expects the diagnostic program.
         */

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

            ramSize:
                this.memory.size,

            cpu,

            cpuPassed:
                cpu.registers.EAX === 30

        };

    }


    /* --------------------------------------------------------
       REAL X86 TEST
    -------------------------------------------------------- */

    runRealX86Test() {

        this.cpu.reset();


        /*
         * Program:
         *
         * MOV EAX,10
         * ADD EAX,20
         * SUB EAX,5
         * INC EAX
         * DEC EAX
         * HLT
         *
         * Expected:
         *
         * EAX = 25
         */

        const program =
            new Uint8Array([

                0xB8,
                0x0A, 0x00, 0x00, 0x00,

                0x05,
                0x14, 0x00, 0x00, 0x00,

                0x2D,
                0x05, 0x00, 0x00, 0x00,

                0x40,

                0x48,

                0xF4

            ]);


        this.cpu.loadCode(
            program,
            DEFAULT_LOAD_ADDRESS
        );


        return this.cpu.run({
            maxCycles: 100
        });

    }


    /* --------------------------------------------------------
       LOAD GAME
    -------------------------------------------------------- */

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


    /* --------------------------------------------------------
       EXECUTE LOADED CODE
    -------------------------------------------------------- */

    run(
        maxCycles = 10000
    ) {

        if (
            !this.game ||
            !this.game.memory
        ) {

            throw new Error(
                "No executable image is loaded."
            );

        }


        this.cpu.EIP =
            this.game.memory.address;


        return this.cpu.run({
            maxCycles
        });

    }


    /* --------------------------------------------------------
       STOP
    -------------------------------------------------------- */

    stop() {

        this.cpu.stop();

    }


    /* --------------------------------------------------------
       INFO
    -------------------------------------------------------- */

    getInfo() {

        return {

            version:
                this.version,

            ram:
                this.memory.size,

            ramMB:
                this.memory.size /
                1024 /
                1024,

            cpu:
                "x86 experimental",

            registers:
                Object.keys(
                    this.cpu.registers
                )

        };

    }

}


/* ============================================================
   PUBLIC API
============================================================ */

window.WebBktxCore = {

    version:
        WEBBKTX_CORE_VERSION,

    RAM_SIZE,

    X86CPU,

    WebBktxMemory,

    XBEImage,

    WebBktxCore,

    testRAM,

    loadGameFile

};


/* ============================================================
   CORE READY MESSAGE
============================================================ */

console.log(
    "========================================"
);

console.log(
    "WebBktx Core " +
    WEBBKTX_CORE_VERSION
);

console.log(
    "64 MB RAM"
);

console.log(
    "x86 decoder: ONLINE"
);

console.log(
    "XBE loader: ONLINE"
);

console.log(
    "========================================"
);
