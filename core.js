/*
 * ============================================================
 * WebBktx Core 0.5
 * Experimental Xbox / x86 emulation core
 *
 * Components:
 *
 *   - 32-bit x86 CPU
 *   - 16 MB emulated RAM
 *   - Register file
 *   - EFLAGS
 *   - Instruction fetch
 *   - Basic x86 decoder
 *   - Basic x86 execution
 *   - Stack
 *   - Memory addressing
 *   - XBE detection
 *   - XBE header parser
 *   - XBE section parser
 *   - XBE image loader
 *   - CPU diagnostics
 *
 * Supported instructions:
 *
 *   NOP
 *   MOV r32, imm32
 *   MOV r32, r/m32
 *   MOV r/m32, r32
 *   MOV EAX, moffs32
 *   MOV moffs32, EAX
 *   ADD EAX, imm32
 *   ADD r/m32, r32
 *   ADD r32, r/m32
 *   SUB EAX, imm32
 *   SUB r/m32, r32
 *   SUB r32, r/m32
 *   INC r32
 *   DEC r32
 *   CMP EAX, imm32
 *   CMP r32, r/m32
 *   TEST EAX, imm32
 *   JMP rel8
 *   JMP rel32
 *   JZ / JE
 *   JNZ / JNE
 *   PUSH r32
 *   PUSH imm32
 *   POP r32
 *   CALL rel32
 *   RET
 *   HLT
 *
 * NOTE:
 * This is an educational/emulation core.
 * It is NOT a complete Xbox emulator.
 * ============================================================
 */

"use strict";


/* ============================================================
   CONSTANTS
============================================================ */

const WEBBKTX_CORE_VERSION = "0.5";

const RAM_SIZE =
    16 * 1024 * 1024;


/*
 * XBE magic:
 *
 * ASCII:
 *
 * X B E H
 *
 * Little endian:
 *
 * 0x48454258
 */

const XBE_MAGIC =
    0x48454258;


/* ============================================================
   FLAGS
============================================================ */

const FLAG_CF = 1 << 0;
const FLAG_ZF = 1 << 6;
const FLAG_SF = 1 << 7;
const FLAG_OF = 1 << 11;


/* ============================================================
   UTILITY
============================================================ */

function toUint32(value) {

    return value >>> 0;

}


function toInt32(value) {

    return value | 0;

}


function signExtend8(value) {

    return (
        (value & 0x80)
            ? value | 0xFFFFFF00
            : value
    ) | 0;

}


function signExtend32(value) {

    return value | 0;

}


function hex(value, digits = 8) {

    return (
        "0x" +
        (
            value >>> 0
        )
        .toString(16)
        .toUpperCase()
        .padStart(digits, "0")
    );

}


/* ============================================================
   MEMORY
============================================================ */

class WebBktxMemory {

    constructor(size = RAM_SIZE) {

        if (
            !Number.isInteger(size) ||
            size <= 0
        ) {

            throw new Error(
                "Invalid memory size."
            );

        }


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
            address + bytes >
            this.size
        ) {

            throw new RangeError(
                `Memory access outside RAM: ${hex(address)}`
            );

        }

    }


    read8(address) {

        this.checkAddress(
            address,
            1
        );


        return this.view.getUint8(
            address
        );

    }


    read16(address) {

        this.checkAddress(
            address,
            2
        );


        return this.view.getUint16(
            address,
            true
        );

    }


    read32(address) {

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
   CPU
============================================================ */

class X86CPU {

    constructor(
        memory
    ) {

        this.memory =
            memory ||
            new WebBktxMemory();


        /*
         * General purpose registers
         */

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


        this.EIP =
            0;


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


        this.lastInstruction =
            null;


        this.reset();

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


        /*
         * Stack starts near the end of RAM.
         */

        this.registers.ESP =
            (
                this.memory.size -
                4
            ) >>> 0;


        this.EIP =
            0;


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


        this.lastInstruction =
            null;

    }


    getRegister(
        index
    ) {

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


        if (
            index < 0 ||
            index > 7
        ) {

            throw new Error(
                "Invalid register index."
            );

        }


        return this.registers[
            names[index]
        ] >>> 0;

    }


    setRegister(
        index,
        value
    ) {

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


        if (
            index < 0 ||
            index > 7
        ) {

            throw new Error(
                "Invalid register index."
            );

        }


        this.registers[
            names[index]
        ] =
            value >>> 0;

    }


    push32(
        value
    ) {

        this.registers.ESP =
            (
                this.registers.ESP -
                4
            ) >>> 0;


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
            (
                this.registers.ESP +
                4
            ) >>> 0;


        return value;

    }


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
            this.EFLAGS &
            flag
        ) !== 0;

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


        const signedA =
            a | 0;

        const signedB =
            b | 0;

        const signedResult =
            result | 0;


        this.setFlag(
            FLAG_OF,
            (
                signedA >= 0 &&
                signedB >= 0 &&
                signedResult < 0
            ) ||
            (
                signedA < 0 &&
                signedB < 0 &&
                signedResult >= 0
            )
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


        const signedA =
            a | 0;

        const signedB =
            b | 0;

        const signedResult =
            result | 0;


        this.setFlag(
            FLAG_OF,
            (
                signedA >= 0 &&
                signedB < 0 &&
                signedResult < 0
            ) ||
            (
                signedA < 0 &&
                signedB >= 0 &&
                signedResult >= 0
            )
        );

    }


    fetch8() {

        const value =
            this.memory.read8(
                this.EIP
            );


        this.EIP =
            (
                this.EIP +
                1
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
                this.EIP +
                4
            ) >>> 0;


        return value;

    }


    decodeModRM() {

        const byte =
            this.fetch8();


        const mod =
            (byte >> 6) & 0x03;


        const reg =
            (byte >> 3) & 0x07;


        const rm =
            byte & 0x07;


        let displacement =
            0;


        let displacementSize =
            0;


        /*
         * 32-bit addressing.
         *
         * SIB is supported in basic form.
         */

        let sib = null;


        if (
            mod !== 3 &&
            rm === 4
        ) {

            sib =
                this.fetch8();

        }


        if (
            mod === 0
        ) {

            if (
                rm === 5
            ) {

                displacement =
                    this.fetch32();

                displacementSize =
                    4;

            }

            if (
                sib &&
                (sib & 7) === 5
            ) {

                displacement =
                    this.fetch32();

                displacementSize =
                    4;

            }

        } else if (
            mod === 1
        ) {

            displacement =
                signExtend8(
                    this.fetch8()
                );

            displacementSize =
                1;

        } else if (
            mod === 2
        ) {

            displacement =
                this.fetch32();

            displacementSize =
                4;

        }


        return {

            mod,
            reg,
            rm,
            sib,
            displacement,
            displacementSize

        };

    }


    getEffectiveAddress(
        modrm
    ) {

        if (
            modrm.mod === 3
        ) {

            return null;

        }


        let base =
            0;


        let index =
            0;


        let scale =
            1;


        if (
            modrm.sib
        ) {

            const sib =
                modrm.sib;


            const scaleBits =
                (sib >> 6) & 3;


            scale =
                1 << scaleBits;


            const indexReg =
                (sib >> 3) & 7;


            const baseReg =
                sib & 7;


            if (
                indexReg !== 4
            ) {

                index =
                    this.getRegister(
                        indexReg
                    );

            }


            if (
                modrm.mod === 0 &&
                baseReg === 5
            ) {

                base =
                    0;

            } else {

                base =
                    this.getRegister(
                        baseReg
                    );

            }

        } else {

            if (
                modrm.mod === 0 &&
                modrm.rm === 5
            ) {

                base =
                    0;

            } else {

                base =
                    this.getRegister(
                        modrm.rm
                    );

            }

        }


        return (
            base +
            index * scale +
            modrm.displacement
        ) >>> 0;

    }


    readRM32(
        modrm
    ) {

        if (
            modrm.mod === 3
        ) {

            return this.getRegister(
                modrm.rm
            );

        }


        const address =
            this.getEffectiveAddress(
                modrm
            );


        return this.memory.read32(
            address
        );

    }


    writeRM32(
        modrm,
        value
    ) {

        if (
            modrm.mod === 3
        ) {

            this.setRegister(
                modrm.rm,
                value
            );


            return;

        }


        const address =
            this.getEffectiveAddress(
                modrm
            );


        this.memory.write32(
            address,
            value
        );

    }


    executeInstruction() {

        const startEIP =
            this.EIP;


        const opcode =
            this.fetch8();


        let mnemonic =
            "UNKNOWN";


        switch (opcode) {


            /*
             * NOP
             */

            case 0x90:

                mnemonic =
                    "NOP";

                break;


            /*
             * MOV r32, imm32
             *
             * B8 + register
             */

            case 0xB8:
            case 0xB9:
            case 0xBA:
            case 0xBB:
            case 0xBC:
            case 0xBD:
            case 0xBE:
            case 0xBF: {

                const registerIndex =
                    opcode - 0xB8;


                const value =
                    this.fetch32();


                this.setRegister(
                    registerIndex,
                    value
                );


                mnemonic =
                    `MOV ${this.getRegisterName(registerIndex)}, ${hex(value)}`;

                break;

            }


            /*
             * MOV r/m32, r32
             *
             * 89 /r
             */

            case 0x89: {

                const modrm =
                    this.decodeModRM();


                const value =
                    this.getRegister(
                        modrm.reg
                    );


                this.writeRM32(
                    modrm,
                    value
                );


                mnemonic =
                    "MOV r/m32, r32";

                break;

            }


            /*
             * MOV r32, r/m32
             *
             * 8B /r
             */

            case 0x8B: {

                const modrm =
                    this.decodeModRM();


                const value =
                    this.readRM32(
                        modrm
                    );


                this.setRegister(
                    modrm.reg,
                    value
                );


                mnemonic =
                    "MOV r32, r/m32";

                break;

            }


            /*
             * ADD EAX, imm32
             *
             * 05 id
             */

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
                    `ADD EAX, ${hex(value)}`;

                break;

            }


            /*
             * ADD r/m32, r32
             *
             * 01 /r
             */

            case 0x01: {

                const modrm =
                    this.decodeModRM();


                const old =
                    this.readRM32(
                        modrm
                    );


                const value =
                    this.getRegister(
                        modrm.reg
                    );


                const result =
                    (
                        old +
                        value
                    ) >>> 0;


                this.writeRM32(
                    modrm,
                    result
                );


                this.updateAddFlags(
                    old,
                    value,
                    result
                );


                mnemonic =
                    "ADD r/m32, r32";

                break;

            }


            /*
             * ADD r32, r/m32
             *
             * 03 /r
             */

            case 0x03: {

                const modrm =
                    this.decodeModRM();


                const old =
                    this.getRegister(
                        modrm.reg
                    );


                const value =
                    this.readRM32(
                        modrm
                    );


                const result =
                    (
                        old +
                        value
                    ) >>> 0;


                this.setRegister(
                    modrm.reg,
                    result
                );


                this.updateAddFlags(
                    old,
                    value,
                    result
                );


                mnemonic =
                    "ADD r32, r/m32";

                break;

            }


            /*
             * SUB EAX, imm32
             *
             * 2D id
             */

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
                    `SUB EAX, ${hex(value)}`;

                break;

            }


            /*
             * SUB r/m32, r32
             *
             * 29 /r
             */

            case 0x29: {

                const modrm =
                    this.decodeModRM();


                const old =
                    this.readRM32(
                        modrm
                    );


                const value =
                    this.getRegister(
                        modrm.reg
                    );


                const result =
                    (
                        old -
                        value
                    ) >>> 0;


                this.writeRM32(
                    modrm,
                    result
                );


                this.updateSubFlags(
                    old,
                    value,
                    result
                );


                mnemonic =
                    "SUB r/m32, r32";

                break;

            }


            /*
             * INC r32
             *
             * 40 + register
             */

            case 0x40:
            case 0x41:
            case 0x42:
            case 0x43:
            case 0x44:
            case 0x45:
            case 0x46:
            case 0x47: {

                const index =
                    opcode - 0x40;


                const old =
                    this.getRegister(
                        index
                    );


                const result =
                    (
                        old +
                        1
                    ) >>> 0;


                this.setRegister(
                    index,
                    result
                );


                this.setFlag(
                    FLAG_ZF,
                    result === 0
                );


                this.setFlag(
                    FLAG_SF,
                    (
                        result &
                        0x80000000
                    ) !== 0
                );


                mnemonic =
                    `INC ${this.getRegisterName(index)}`;

                break;

            }


            /*
             * DEC r32
             *
             * 48 + register
             */

            case 0x48:
            case 0x49:
            case 0x4A:
            case 0x4B:
            case 0x4C:
            case 0x4D:
            case 0x4E:
            case 0x4F: {

                const index =
                    opcode - 0x48;


                const old =
                    this.getRegister(
                        index
                    );


                const result =
                    (
                        old -
                        1
                    ) >>> 0;


                this.setRegister(
                    index,
                    result
                );


                this.setFlag(
                    FLAG_ZF,
                    result === 0
                );


                this.setFlag(
                    FLAG_SF,
                    (
                        result &
                        0x80000000
                    ) !== 0
                );


                mnemonic =
                    `DEC ${this.getRegisterName(index)}`;

                break;

            }


            /*
             * CMP EAX, imm32
             *
             * 3D id
             */

            case 0x3D: {

                const value =
                    this.fetch32();


                const old =
                    this.registers.EAX;


                const result =
                    (
                        old -
                        value
                    ) >>> 0;


                this.updateSubFlags(
                    old,
                    value,
                    result
                );


                mnemonic =
                    `CMP EAX, ${hex(value)}`;

                break;

            }


            /*
             * CMP r32, r/m32
             *
             * 3B /r
             */

            case 0x3B: {

                const modrm =
                    this.decodeModRM();


                const a =
                    this.getRegister(
                        modrm.reg
                    );


                const b =
                    this.readRM32(
                        modrm
                    );


                const result =
                    (
                        a -
                        b
                    ) >>> 0;


                this.updateSubFlags(
                    a,
                    b,
                    result
                );


                mnemonic =
                    "CMP r32, r/m32";

                break;

            }


            /*
             * TEST EAX, imm32
             *
             * A9 id
             */

            case 0xA9: {

                const value =
                    this.fetch32();


                const result =
                    (
                        this.registers.EAX &
                        value
                    ) >>> 0;


                this.setFlag(
                    FLAG_ZF,
                    result === 0
                );


                this.setFlag(
                    FLAG_SF,
                    (
                        result &
                        0x80000000
                    ) !== 0
                );


                mnemonic =
                    `TEST EAX, ${hex(value)}`;

                break;

            }


            /*
             * JMP rel8
             *
             * EB cb
             */

            case 0xEB: {

                const displacement =
                    signExtend8(
                        this.fetch8()
                    );


                this.EIP =
                    (
                        this.EIP +
                        displacement
                    ) >>> 0;


                mnemonic =
                    "JMP rel8";

                break;

            }


            /*
             * JMP rel32
             *
             * E9 cd
             */

            case 0xE9: {

                const displacement =
                    signExtend32(
                        this.fetch32()
                    );


                this.EIP =
                    (
                        this.EIP +
                        displacement
                    ) >>> 0;


                mnemonic =
                    "JMP rel32";

                break;

            }


            /*
             * JZ / JE
             *
             * 74 cb
             */

            case 0x74: {

                const displacement =
                    signExtend8(
                        this.fetch8()
                    );


                if (
                    this.getFlag(
                        FLAG_ZF
                    )
                ) {

                    this.EIP =
                        (
                            this.EIP +
                            displacement
                        ) >>> 0;

                }


                mnemonic =
                    "JZ rel8";

                break;

            }


            /*
             * JNZ / JNE
             *
             * 75 cb
             */

            case 0x75: {

                const displacement =
                    signExtend8(
                        this.fetch8()
                    );


                if (
                    !this.getFlag(
                        FLAG_ZF
                    )
                ) {

                    this.EIP =
                        (
                            this.EIP +
                            displacement
                        ) >>> 0;

                }


                mnemonic =
                    "JNZ rel8";

                break;

            }


            /*
             * PUSH r32
             *
             * 50 + register
             */

            case 0x50:
            case 0x51:
            case 0x52:
            case 0x53:
            case 0x54:
            case 0x55:
            case 0x56:
            case 0x57: {

                const index =
                    opcode - 0x50;


                this.push32(
                    this.getRegister(
                        index
                    )
                );


                mnemonic =
                    `PUSH ${this.getRegisterName(index)}`;

                break;

            }


            /*
             * POP r32
             *
             * 58 + register
             */

            case 0x58:
            case 0x59:
            case 0x5A:
            case 0x5B:
            case 0x5C:
            case 0x5D:
            case 0x5E:
            case 0x5F: {

                const index =
                    opcode - 0x58;


                const value =
                    this.pop32();


                this.setRegister(
                    index,
                    value
                );


                mnemonic =
                    `POP ${this.getRegisterName(index)}`;

                break;

            }


            /*
             * PUSH imm32
             *
             * 68 id
             */

            case 0x68: {

                const value =
                    this.fetch32();


                this.push32(
                    value
                );


                mnemonic =
                    `PUSH ${hex(value)}`;

                break;

            }


            /*
             * CALL rel32
             *
             * E8 cd
             */

            case 0xE8: {

                const displacement =
                    signExtend32(
                        this.fetch32()
                    );


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
                    "CALL rel32";

                break;

            }


            /*
             * RET
             *
             * C3
             */

            case 0xC3: {

                this.EIP =
                    this.pop32();


                mnemonic =
                    "RET";

                break;

            }


            /*
             * HLT
             *
             * F4
             */

            case 0xF4:

                this.halted =
                    true;

                this.running =
                    false;


                mnemonic =
                    "HLT";

                break;


            default:

                throw new Error(
                    `Unsupported x86 opcode ${hex(opcode, 2)} at ${hex(startEIP)}`
                );

        }


        this.cycles++;

        this.instructions++;


        this.lastInstruction = {

            address:
                startEIP >>> 0,

            opcode,

            mnemonic

        };


        return this.lastInstruction;

    }


    getRegisterName(
        index
    ) {

        return [

            "EAX",
            "ECX",
            "EDX",
            "EBX",
            "ESP",
            "EBP",
            "ESI",
            "EDI"

        ][index];

    }


    run(
        maxInstructions = 100000
    ) {

        this.running =
            true;


        this.halted =
            false;


        let executed =
            0;


        while (
            this.running &&
            !this.halted &&
            executed < maxInstructions
        ) {

            this.executeInstruction();

            executed++;

        }


        if (
            executed >=
            maxInstructions
        ) {

            this.running =
                false;

        }


        return this.getState();

    }


    stop() {

        this.running =
            false;

    }


    getState() {

        return {

            registers:
                { ...this.registers },

            EIP:
                this.EIP >>> 0,

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

            lastInstruction:
                this.lastInstruction

        };

    }

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


        this.sections =
            [];


        this.entryPoint =
            null;

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
            this.bytes.length < 4
        ) {

            throw new Error(
                "XBE file is too small."
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
         * XBE header fields.
         *
         * We deliberately validate offsets before reading.
         */

        this.header.magic =
            view.getUint32(
                0,
                true
            );


        if (
            this.bytes.length >= 0x18
        ) {

            this.header.baseAddress =
                view.getUint32(
                    0x104,
                    true
                );

        }


        /*
         * Entry point.
         *
         * XBE header entry point is at 0x128.
         */

        if (
            this.bytes.length >= 0x12C
        ) {

            this.entryPoint =
                view.getUint32(
                    0x128,
                    true
                );


            this.header.entryPoint =
                this.entryPoint;

        }


        this.header.fileSize =
            this.bytes.length;


        /*
         * Try to parse section table.
         *
         * Number of sections:
         *
         * 0x11C
         *
         * Section headers:
         *
         * 0x11C + 4
         *
         * This parser remains conservative.
         */

        if (
            this.bytes.length >= 0x120
        ) {

            const sectionCount =
                view.getUint32(
                    0x11C,
                    true
                );


            const sectionTable =
                view.getUint32(
                    0x120,
                    true
                );


            this.header.sectionCount =
                sectionCount;


            this.header.sectionTable =
                sectionTable;


            this.parseSections(
                sectionCount,
                sectionTable
            );

        }

    }


    parseSections(
        count,
        tableOffset
    ) {

        const view =
            new DataView(
                this.buffer
            );


        this.sections =
            [];


        /*
         * Basic safety limits.
         */

        const safeCount =
            Math.min(
                count >>> 0,
                512
            );


        /*
         * XBE section header size
         * is 0x38 bytes.
         */

        const sectionSize =
            0x38;


        for (
            let i = 0;
            i < safeCount;
            i++
        ) {

            const offset =
                (
                    tableOffset +
                    i * sectionSize
                ) >>> 0;


            if (
                offset +
                sectionSize >
                this.bytes.length
            ) {

                break;

            }


            const section = {

                index:
                    i,

                flags:
                    view.getUint32(
                        offset,
                        true
                    ),

                virtualAddress:
                    view.getUint32(
                        offset + 4,
                        true
                    ),

                virtualSize:
                    view.getUint32(
                        offset + 8,
                        true
                    ),

                rawAddress:
                    view.getUint32(
                        offset + 12,
                        true
                    ),

                rawSize:
                    view.getUint32(
                        offset + 16,
                        true
                    ),

                nameAddress:
                    view.getUint32(
                        offset + 20,
                        true
                    )

            };


            this.sections.push(
                section
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
        address = 0x10000
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
                "XBE image does not fit in emulated RAM."
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
                this.entryPoint,

            sections:
                this.sections.length

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

    if (!file) {

        throw new Error(
            "No game file supplied."
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

        size:
            image.size,

        entryPoint:
            image.entryPoint,

        sections:
            image.sections,

        memory:
            memoryInfo

    };

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
        0x001000,
        0x010000,
        0x100000,
        0x400000,
        0x800000,
        0xFFFFFC

    ];


    /*
     * AA pattern
     */

    for (
        const address
        of addresses
    ) {

        memory.write32(
            address,
            0xAAAAAAAA
        );


        if (
            memory.read32(
                address
            ) !==
            0xAAAAAAAA
        ) {

            return {

                passed:
                    false,

                test:
                    "0xAA",

                address

            };

        }

    }


    /*
     * 55 pattern
     */

    for (
        const address
        of addresses
    ) {

        memory.write32(
            address,
            0x55555555
        );


        if (
            memory.read32(
                address
            ) !==
            0x55555555
        ) {

            return {

                passed:
                    false,

                test:
                    "0x55",

                address

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

        memory.write32(
            addresses[i],
            i + 1
        );

    }


    for (
        let i = 0;
        i < addresses.length;
        i++
    ) {

        if (
            memory.read32(
                addresses[i]
            ) !==
            i + 1
        ) {

            return {

                passed:
                    false,

                test:
                    "ADDRESS",

                address:
                    addresses[i]

            };

        }

    }


    return {

        passed:
            true,

        size:
            memory.size

    };

}


/* ============================================================
   CPU SELF TEST
============================================================ */

function testCPU() {

    const memory =
        new WebBktxMemory(
            1024 * 1024
        );


    const cpu =
        new X86CPU(
            memory
        );


    /*
     * Program:
     *
     * MOV EAX, 10
     * ADD EAX, 20
     * INC EAX
     * SUB EAX, 1
     * CMP EAX, 30
     * JZ +2
     * HLT
     * HLT
     *
     * Expected:
     *
     * EAX = 30
     * ZF = 1
     */

    const program = new Uint8Array([

        0xB8,
        0x0A, 0x00, 0x00, 0x00,

        0x05,
        0x14, 0x00, 0x00, 0x00,

        0x40,

        0x2D,
        0x01, 0x00, 0x00, 0x00,

        0x3D,
        0x1E, 0x00, 0x00, 0x00,

        0x74,
        0x01,

        0xF4,

        0xF4

    ]);


    memory.writeBytes(
        0,
        program
    );


    cpu.EIP =
        0;


    const state =
        cpu.run(
            100
        );


    const passed =
        state.registers.EAX === 30 &&
        cpu.getFlag(
            FLAG_ZF
        );


    return {

        passed,

        state

    };

}


/* ============================================================
   WEBBKTX CORE
============================================================ */

class WebBktxCore {

    constructor() {

        this.version =
            WEBBKTX_CORE_VERSION;


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


        this.initialized =
            true;

    }


    reset() {

        this.memory.clear();

        this.cpu.reset();

        this.game =
            null;

    }


    runDiagnostics() {

        const ram =
            testRAM(
                this.memory
            );


        const cpuTest =
            testCPU();


        /*
         * Preserve the existing app.js API.
         *
         * app.js expects:
         *
         * diagnostics.cpu.registers.EAX
         * diagnostics.cpu.EIP
         * diagnostics.cpu.cycles
         */

        const cpu =
            cpuTest.state;


        return {

            version:
                this.version,

            ram,

            cpu,

            cpuPassed:
                cpuTest.passed

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


    /*
     * Load an XBE and prepare CPU.
     *
     * This DOES NOT execute the XBE yet.
     */

    prepareGame() {

        if (
            !this.game ||
            !this.game.recognized
        ) {

            throw new Error(
                "No recognized XBE is loaded."
            );

        }


        if (
            this.game.entryPoint ===
            null ||
            this.game.entryPoint ===
            undefined
        ) {

            throw new Error(
                "XBE entry point is unavailable."
            );

        }


        /*
         * For now we keep the CPU in a controlled
         * state. The complete Xbox virtual address
         * mapping is not implemented yet.
         */

        this.cpu.reset();


        return {

            ready:
                true,

            entryPoint:
                this.game.entryPoint

        };

    }


    stop() {

        this.cpu.stop();

    }


    getState() {

        return {

            version:
                this.version,

            initialized:
                this.initialized,

            memory:
                {

                    size:
                        this.memory.size

                },

            cpu:
                this.cpu.getState(),

            game:
                this.game

        };

    }

}


/* ============================================================
   PUBLIC API
============================================================ */

window.WebBktxCore = {

    version:
        WEBBKTX_CORE_VERSION,

    X86CPU,

    WebBktxMemory,

    XBEImage,

    WebBktxCore,

    testRAM,

    testCPU,

    loadGameFile,

    constants: {

        RAM_SIZE,

        XBE_MAGIC,

        FLAG_CF,

        FLAG_ZF,

        FLAG_SF,

        FLAG_OF

    }

};


/* ============================================================
   CORE READY MESSAGE
============================================================ */

console.log(
    `%cWebBktx Core ${WEBBKTX_CORE_VERSION}`,
    "font-weight:bold"
);

console.log(
    `RAM: ${
        RAM_SIZE /
        1024 /
        1024
    } MB`
);

console.log(
    "x86 decoder: ONLINE"
);

console.log(
    "XBE loader: ONLINE"
);

console.log(
    "WebBktx Core: READY"
);
