/*
 * ============================================================
 * WebBktx x86 Decoder
 *
 * Version: 1.0 MAX
 *
 * 32-bit x86 instruction decoder
 *
 * Designed for:
 *
 *   WebBktx CPU 0.7B+
 *   WebBktx Memory 1.0 MAX
 *   WebBktx XBE 0.7D+
 *
 * Supported:
 *
 *   NOP
 *   HLT
 *
 *   MOV
 *   ADD
 *   SUB
 *   XOR
 *   AND
 *   OR
 *   CMP
 *
 *   INC
 *   DEC
 *
 *   PUSH
 *   POP
 *
 *   JMP
 *   CALL
 *   RET
 *
 *   JE / JZ
 *   JNE / JNZ
 *   JC
 *   JNC
 *   JS
 *   JNS
 *   JO
 *   JNO
 *   JL
 *   JLE
 *   JG
 *   JGE
 *
 *   ModR/M register operands
 *   ModR/M memory operands
 *
 * ============================================================
 */

"use strict";


/* ============================================================
   CONSTANTS
============================================================ */

const WEBBKTX_DECODER_VERSION =
    "1.0 MAX";


const X86_REGISTERS = [
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
   HELPERS
============================================================ */

function u8(
    value
) {

    return value & 0xFF;

}


function s8(
    value
) {

    value &=
        0xFF;

    return value & 0x80
        ? value - 0x100
        : value;

}


function u32(
    value
) {

    return value >>> 0;

}


function s32(
    value
) {

    value >>>= 0;

    return value | 0;

}


/* ============================================================
   DECODER
============================================================ */

class WebBktxDecoder {

    constructor(
        options = {}
    ) {

        this.version =
            WEBBKTX_DECODER_VERSION;


        this.strict =
            options.strict !== false;


        this.lastInstruction =
            null;


        this.instructionsDecoded =
            0;

    }


    /* ========================================================
       BYTE ACCESS
    ======================================================== */

    read8(
        cpu,
        address
    ) {

        return cpu.memory.read8(
            address
        );

    }


    read16(
        cpu,
        address
    ) {

        return cpu.memory.read16(
            address
        );

    }


    read32(
        cpu,
        address
    ) {

        return cpu.memory.read32(
            address
        );

    }


    readS8(
        cpu,
        address
    ) {

        return s8(
            this.read8(
                cpu,
                address
            )
        );

    }


    readS32(
        cpu,
        address
    ) {

        return s32(
            this.read32(
                cpu,
                address
            )
        );

    }


    /* ========================================================
       MODR/M
    ======================================================== */

    decodeModRM(
        cpu,
        address
    ) {

        const value =
            this.read8(
                cpu,
                address
            );


        const mod =
            value >> 6;


        const reg =
            (
                value >> 3
            ) & 7;


        const rm =
            value & 7;


        let length =
            1;


        const result = {

            value,

            mod,

            reg,

            rm,

            regName:
                X86_REGISTERS[reg],

            rmName:
                null,

            isRegister:
                mod === 3,

            address:
                null,

            length,

            displacement:
                0

        };


        /*
         * Register operand.
         */

        if (
            mod === 3
        ) {

            result.rmName =
                X86_REGISTERS[rm];

            return result;

        }


        /*
         * 32-bit addressing.
         *
         * SIB handling.
         */

        if (
            rm === 4
        ) {

            const sib =
                this.read8(
                    cpu,
                    address + length
                );


            length++;


            const scale =
                1 <<
                (
                    sib >> 6
                );


            const index =
                (
                    sib >> 3
                ) & 7;


            const base =
                sib & 7;


            result.sib = {

                value:
                    sib,

                scale,

                index,

                base

            };


            if (
                base === 5 &&
                mod === 0
            ) {

                result.base =
                    null;

                result.displacement =
                    this.read32(
                        cpu,
                        address + length
                    );

                length += 4;

            } else {

                result.base =
                    X86_REGISTERS[base];

            }


            if (
                index !== 4
            ) {

                result.index =
                    X86_REGISTERS[index];

            } else {

                result.index =
                    null;

            }

        } else {

            if (
                rm === 5 &&
                mod === 0
            ) {

                result.base =
                    null;

                result.displacement =
                    this.read32(
                        cpu,
                        address + length
                    );

                length += 4;

            } else {

                result.base =
                    X86_REGISTERS[rm];

            }

        }


        /*
         * Displacement.
         */

        if (
            mod === 1
        ) {

            result.displacement =
                s8(
                    this.read8(
                        cpu,
                        address + length
                    )
                );

            length++;

        } else if (
            mod === 2
        ) {

            result.displacement =
                this.readS32(
                    cpu,
                    address + length
                );

            length += 4;

        }


        result.length =
            length;


        return result;

    }


    /* ========================================================
       CALCULATE EFFECTIVE ADDRESS
    ======================================================== */

    getEffectiveAddress(
        cpu,
        modrm
    ) {

        if (
            modrm.isRegister
        ) {

            throw new Error(
                "Register operand has no memory address."
            );

        }


        let address =
            modrm.displacement | 0;


        if (
            modrm.base
        ) {

            address =
                (
                    address +
                    cpu.getRegister(
                        modrm.base
                    )
                ) | 0;

        }


        if (
            modrm.index
        ) {

            const indexValue =
                cpu.getRegister(
                    modrm.index
                );


            address =
                (
                    address +
                    (
                        indexValue *
                        (
                            modrm.sib
                                ? modrm.sib.scale
                                : 1
                        )
                    )
                ) | 0;

        }


        return address >>> 0;

    }


    /* ========================================================
       OPERAND READ
    ======================================================== */

    readRM32(
        cpu,
        modrm
    ) {

        if (
            modrm.isRegister
        ) {

            return cpu.getRegister(
                modrm.rmName
            );

        }


        const address =
            this.getEffectiveAddress(
                cpu,
                modrm
            );


        return cpu.read32(
            address
        );

    }


    /* ========================================================
       OPERAND WRITE
    ======================================================== */

    writeRM32(
        cpu,
        modrm,
        value
    ) {

        value >>>= 0;


        if (
            modrm.isRegister
        ) {

            cpu.setRegister(
                modrm.rmName,
                value
            );

            return;

        }


        const address =
            this.getEffectiveAddress(
                cpu,
                modrm
            );


        cpu.write32(
            address,
            value
        );

    }


    /* ========================================================
       RELATIVE TARGET
    ======================================================== */

    relativeTarget(
        cpu,
        instructionEnd,
        displacement
    ) {

        return (
            instructionEnd +
            displacement
        ) >>> 0;

    }


    /* ========================================================
       CREATE INSTRUCTION
    ======================================================== */

    instruction(
        address,
        length,
        mnemonic,
        operands,
        execute,
        bytes = []
    ) {

        const result = {

            address:
                address >>> 0,

            length,

            mnemonic,

            operands,

            bytes:
                Array.from(bytes),

            text:
                operands
                    ? `${mnemonic} ${operands}`
                    : mnemonic,

            execute

        };


        this.lastInstruction =
            result;


        this.instructionsDecoded++;


        return result;

    }


    /* ========================================================
       DECODE
    ======================================================== */

    decode(
        cpu,
        address
    ) {

        address >>>=
            0;


        const opcode =
            this.read8(
                cpu,
                address
            );


        /* ----------------------------------------------------
           NOP
        ---------------------------------------------------- */

        if (
            opcode === 0x90
        ) {

            return this.instruction(

                address,

                1,

                "NOP",

                "",

                cpu => {

                    cpu.EIP =
                        (
                            address +
                            1
                        ) >>> 0;

                },

                [opcode]

            );

        }


        /* ----------------------------------------------------
           HLT
        ---------------------------------------------------- */

        if (
            opcode === 0xF4
        ) {

            return this.instruction(

                address,

                1,

                "HLT",

                "",

                cpu => {

                    cpu.EIP =
                        (
                            address +
                            1
                        ) >>> 0;

                    cpu.halt();

                },

                [opcode]

            );

        }


        /* ----------------------------------------------------
           MOV EAX, imm32
           B8 + rd
        ---------------------------------------------------- */

        if (
            opcode >= 0xB8 &&
            opcode <= 0xBF
        ) {

            const reg =
                X86_REGISTERS[
                    opcode - 0xB8
                ];


            const immediate =
                this.read32(
                    cpu,
                    address + 1
                );


            return this.instruction(

                address,

                5,

                "MOV",

                `${reg}, 0x${immediate
                    .toString(16)
                    .padStart(8, "0")}`,

                cpu => {

                    cpu.setRegister(
                        reg,
                        immediate
                    );


                    cpu.EIP =
                        (
                            address +
                            5
                        ) >>> 0;

                },

                [

                    opcode,

                    this.read8(
                        cpu,
                        address + 1
                    ),

                    this.read8(
                        cpu,
                        address + 2
                    ),

                    this.read8(
                        cpu,
                        address + 3
                    ),

                    this.read8(
                        cpu,
                        address + 4
                    )

                ]

            );

        }


        /* ----------------------------------------------------
           MOV r/m32, r32
           89 /r
        ---------------------------------------------------- */

        if (
            opcode === 0x89
        ) {

            const modrm =
                this.decodeModRM(
                    cpu,
                    address + 1
                );


            return this.instruction(

                address,

                1 +
                modrm.length,

                "MOV",

                `${modrm.rmName ||
                    "[mem]"}, ${modrm.regName}`,

                cpu => {

                    const value =
                        cpu.getRegister(
                            modrm.regName
                        );


                    this.writeRM32(
                        cpu,
                        modrm,
                        value
                    );


                    cpu.EIP =
                        (
                            address +
                            1 +
                            modrm.length
                        ) >>> 0;

                }

            );

        }


        /* ----------------------------------------------------
           MOV r32, r/m32
           8B /r
        ---------------------------------------------------- */

        if (
            opcode === 0x8B
        ) {

            const modrm =
                this.decodeModRM(
                    cpu,
                    address + 1
                );


            return this.instruction(

                address,

                1 +
                modrm.length,

                "MOV",

                `${modrm.regName}, ${modrm.rmName ||
                    "[mem]"}`,

                cpu => {

                    const value =
                        this.readRM32(
                            cpu,
                            modrm
                        );


                    cpu.setRegister(
                        modrm.regName,
                        value
                    );


                    cpu.EIP =
                        (
                            address +
                            1 +
                            modrm.length
                        ) >>> 0;

                }

            );

        }


        /* ----------------------------------------------------
           ADD r/m32, r32
           01 /r
        ---------------------------------------------------- */

        if (
            opcode === 0x01
        ) {

            const modrm =
                this.decodeModRM(
                    cpu,
                    address + 1
                );


            return this.instruction(

                address,

                1 +
                modrm.length,

                "ADD",

                `${modrm.rmName ||
                    "[mem]"}, ${modrm.regName}`,

                cpu => {

                    const a =
                        this.readRM32(
                            cpu,
                            modrm
                        );


                    const b =
                        cpu.getRegister(
                            modrm.regName
                        );


                    const result =
                        cpu.add32(
                            a,
                            b
                        );


                    this.writeRM32(
                        cpu,
                        modrm,
                        result
                    );


                    cpu.EIP =
                        (
                            address +
                            1 +
                            modrm.length
                        ) >>> 0;

                }

            );

        }


        /* ----------------------------------------------------
           ADD r32, r/m32
           03 /r
        ---------------------------------------------------- */

        if (
            opcode === 0x03
        ) {

            const modrm =
                this.decodeModRM(
                    cpu,
                    address + 1
                );


            return this.instruction(

                address,

                1 +
                modrm.length,

                "ADD",

                `${modrm.regName}, ${modrm.rmName ||
                    "[mem]"}`,

                cpu => {

                    const a =
                        cpu.getRegister(
                            modrm.regName
                        );


                    const b =
                        this.readRM32(
                            cpu,
                            modrm
                        );


                    cpu.setRegister(
                        modrm.regName,
                        cpu.add32(
                            a,
                            b
                        )
                    );


                    cpu.EIP =
                        (
                            address +
                            1 +
                            modrm.length
                        ) >>> 0;

                }

            );

        }


        /* ----------------------------------------------------
           SUB r/m32, r32
           29 /r
        ---------------------------------------------------- */

        if (
            opcode === 0x29
        ) {

            const modrm =
                this.decodeModRM(
                    cpu,
                    address + 1
                );


            return this.instruction(

                address,

                1 +
                modrm.length,

                "SUB",

                `${modrm.rmName ||
                    "[mem]"}, ${modrm.regName}`,

                cpu => {

                    const a =
                        this.readRM32(
                            cpu,
                            modrm
                        );


                    const b =
                        cpu.getRegister(
                            modrm.regName
                        );


                    const result =
                        cpu.sub32(
                            a,
                            b
                        );


                    this.writeRM32(
                        cpu,
                        modrm,
                        result
                    );


                    cpu.EIP =
                        (
                            address +
                            1 +
                            modrm.length
                        ) >>> 0;

                }

            );

        }


        /* ----------------------------------------------------
           SUB r32, r/m32
           2B /r
        ---------------------------------------------------- */

        if (
            opcode === 0x2B
        ) {

            const modrm =
                this.decodeModRM(
                    cpu,
                    address + 1
                );


            return this.instruction(

                address,

                1 +
                modrm.length,

                "SUB",

                `${modrm.regName}, ${modrm.rmName ||
                    "[mem]"}`,

                cpu => {

                    const a =
                        cpu.getRegister(
                            modrm.regName
                        );


                    const b =
                        this.readRM32(
                            cpu,
                            modrm
                        );


                    cpu.setRegister(
                        modrm.regName,
                        cpu.sub32(
                            a,
                            b
                        )
                    );


                    cpu.EIP =
                        (
                            address +
                            1 +
                            modrm.length
                        ) >>> 0;

                }

            );

        }


        /* ----------------------------------------------------
           XOR
           31 /r
        ---------------------------------------------------- */

        if (
            opcode === 0x31
        ) {

            const modrm =
                this.decodeModRM(
                    cpu,
                    address + 1
                );


            return this.instruction(

                address,

                1 +
                modrm.length,

                "XOR",

                `${modrm.rmName ||
                    "[mem]"}, ${modrm.regName}`,

                cpu => {

                    const a =
                        this.readRM32(
                            cpu,
                            modrm
                        );


                    const b =
                        cpu.getRegister(
                            modrm.regName
                        );


                    this.writeRM32(
                        cpu,
                        modrm,
                        cpu.xor32(
                            a,
                            b
                        )
                    );


                    cpu.EIP =
                        (
                            address +
                            1 +
                            modrm.length
                        ) >>> 0;

                }

            );

        }


        /* ----------------------------------------------------
           AND
           21 /r
        ---------------------------------------------------- */

        if (
            opcode === 0x21
        ) {

            const modrm =
                this.decodeModRM(
                    cpu,
                    address + 1
                );


            return this.instruction(

                address,

                1 +
                modrm.length,

                "AND",

                `${modrm.rmName ||
                    "[mem]"}, ${modrm.regName}`,

                cpu => {

                    const a =
                        this.readRM32(
                            cpu,
                            modrm
                        );


                    const b =
                        cpu.getRegister(
                            modrm.regName
                        );


                    this.writeRM32(
                        cpu,
                        modrm,
                        cpu.and32(
                            a,
                            b
                        )
                    );


                    cpu.EIP =
                        (
                            address +
                            1 +
                            modrm.length
                        ) >>> 0;

                }

            );

        }


        /* ----------------------------------------------------
           OR
           09 /r
        ---------------------------------------------------- */

        if (
            opcode === 0x09
        ) {

            const modrm =
                this.decodeModRM(
                    cpu,
                    address + 1
                );


            return this.instruction(

                address,

                1 +
                modrm.length,

                "OR",

                `${modrm.rmName ||
                    "[mem]"}, ${modrm.regName}`,

                cpu => {

                    const a =
                        this.readRM32(
                            cpu,
                            modrm
                        );


                    const b =
                        cpu.getRegister(
                            modrm.regName
                        );


                    this.writeRM32(
                        cpu,
                        modrm,
                        cpu.or32(
                            a,
                            b
                        )
                    );


                    cpu.EIP =
                        (
                            address +
                            1 +
                            modrm.length
                        ) >>> 0;

                }

            );

        }


        /* ----------------------------------------------------
           CMP r/m32, r32
           39 /r
        ---------------------------------------------------- */

        if (
            opcode === 0x39
        ) {

            const modrm =
                this.decodeModRM(
                    cpu,
                    address + 1
                );


            return this.instruction(

                address,

                1 +
                modrm.length,

                "CMP",

                `${modrm.rmName ||
                    "[mem]"}, ${modrm.regName}`,

                cpu => {

                    const a =
                        this.readRM32(
                            cpu,
                            modrm
                        );


                    const b =
                        cpu.getRegister(
                            modrm.regName
                        );


                    cpu.sub32(
                        a,
                        b
                    );


                    cpu.EIP =
                        (
                            address +
                            1 +
                            modrm.length
                        ) >>> 0;

                }

            );

        }


        /* ----------------------------------------------------
           INC r32
           40 + rd
        ---------------------------------------------------- */

        if (
            opcode >= 0x40 &&
            opcode <= 0x47
        ) {

            const reg =
                X86_REGISTERS[
                    opcode - 0x40
                ];


            return this.instruction(

                address,

                1,

                "INC",

                reg,

                cpu => {

                    cpu.setRegister(
                        reg,
                        cpu.inc32(
                            cpu.getRegister(
                                reg
                            )
                        )
                    );


                    cpu.EIP =
                        (
                            address +
                            1
                        ) >>> 0;

                },

                [opcode]

            );

        }


        /* ----------------------------------------------------
           DEC r32
           48 + rd
        ---------------------------------------------------- */

        if (
            opcode >= 0x48 &&
            opcode <= 0x4F
        ) {

            const reg =
                X86_REGISTERS[
                    opcode - 0x48
                ];


            return this.instruction(

                address,

                1,

                "DEC",

                reg,

                cpu => {

                    cpu.setRegister(
                        reg,
                        cpu.dec32(
                            cpu.getRegister(
                                reg
                            )
                        )
                    );


                    cpu.EIP =
                        (
                            address +
                            1
                        ) >>> 0;

                },

                [opcode]

            );

        }


        /* ----------------------------------------------------
           PUSH r32
           50 + rd
        ---------------------------------------------------- */

        if (
            opcode >= 0x50 &&
            opcode <= 0x57
        ) {

            const reg =
                X86_REGISTERS[
                    opcode - 0x50
                ];


            return this.instruction(

                address,

                1,

                "PUSH",

                reg,

                cpu => {

                    cpu.push32(
                        cpu.getRegister(
                            reg
                        )
                    );


                    cpu.EIP =
                        (
                            address +
                            1
                        ) >>> 0;

                }

            );

        }


        /* ----------------------------------------------------
           POP r32
           58 + rd
        ---------------------------------------------------- */

        if (
            opcode >= 0x58 &&
            opcode <= 0x5F
        ) {

            const reg =
                X86_REGISTERS[
                    opcode - 0x58
                ];


            return this.instruction(

                address,

                1,

                "POP",

                reg,

                cpu => {

                    cpu.setRegister(
                        reg,
                        cpu.pop32()
                    );


                    cpu.EIP =
                        (
                            address +
                            1
                        ) >>> 0;

                }

            );

        }


        /* ----------------------------------------------------
           PUSH imm32
           68
        ---------------------------------------------------- */

        if (
            opcode === 0x68
        ) {

            const value =
                this.read32(
                    cpu,
                    address + 1
                );


            return this.instruction(

                address,

                5,

                "PUSH",

                `0x${value
                    .toString(16)
                    .padStart(8, "0")}`,

                cpu => {

                    cpu.push32(
                        value
                    );


                    cpu.EIP =
                        (
                            address +
                            5
                        ) >>> 0;

                }

            );

        }


        /* ----------------------------------------------------
           PUSH imm8
           6A
        ---------------------------------------------------- */

        if (
            opcode === 0x6A
        ) {

            const value =
                this.readS8(
                    cpu,
                    address + 1
                );


            return this.instruction(

                address,

                2,

                "PUSH",

                String(value),

                cpu => {

                    cpu.push32(
                        value >>> 0
                    );


                    cpu.EIP =
                        (
                            address +
                            2
                        ) >>> 0;

                }

            );

        }


        /* ----------------------------------------------------
           JMP rel8
           EB
        ---------------------------------------------------- */

        if (
            opcode === 0xEB
        ) {

            const displacement =
                this.readS8(
                    cpu,
                    address + 1
                );


            const target =
                this.relativeTarget(
                    cpu,
                    address + 2,
                    displacement
                );


            return this.instruction(

                address,

                2,

                "JMP",

                `0x${target
                    .toString(16)
                    .padStart(8, "0")}`,

                cpu => {

                    cpu.EIP =
                        target;

                }

            );

        }


        /* ----------------------------------------------------
           JMP rel32
           E9
        ---------------------------------------------------- */

        if (
            opcode === 0xE9
        ) {

            const displacement =
                this.readS32(
                    cpu,
                    address + 1
                );


            const target =
                this.relativeTarget(
                    cpu,
                    address + 5,
                    displacement
                );


            return this.instruction(

                address,

                5,

                "JMP",

                `0x${target
                    .toString(16)
                    .padStart(8, "0")}`,

                cpu => {

                    cpu.EIP =
                        target;

                }

            );

        }


        /* ----------------------------------------------------
           CALL rel32
           E8
        ---------------------------------------------------- */

        if (
            opcode === 0xE8
        ) {

            const displacement =
                this.readS32(
                    cpu,
                    address + 1
                );


            const returnAddress =
                (
                    address +
                    5
                ) >>> 0;


            const target =
                (
                    returnAddress +
                    displacement
                ) >>> 0;


            return this.instruction(

                address,

                5,

                "CALL",

                `0x${target
                    .toString(16)
                    .padStart(8, "0")}`,

                cpu => {

                    cpu.push32(
                        returnAddress
                    );


                    cpu.EIP =
                        target;

                }

            );

        }


        /* ----------------------------------------------------
           RET
           C3
        ---------------------------------------------------- */

        if (
            opcode === 0xC3
        ) {

            return this.instruction(

                address,

                1,

                "RET",

                "",

                cpu => {

                    cpu.EIP =
                        cpu.pop32();

                }

            );

        }


        /* ----------------------------------------------------
           JZ / JE
           74
        ---------------------------------------------------- */

        if (
            opcode === 0x74
        ) {

            const displacement =
                this.readS8(
                    cpu,
                    address + 1
                );


            const target =
                this.relativeTarget(
                    cpu,
                    address + 2,
                    displacement
                );


            return this.conditionalJump(
                address,
                2,
                "JZ",
                target,
                cpu =>
                    cpu.getFlag(
                        1 << 6
                    )
            );

        }


        /* ----------------------------------------------------
           JNZ / JNE
           75
        ---------------------------------------------------- */

        if (
            opcode === 0x75
        ) {

            const displacement =
                this.readS8(
                    cpu,
                    address + 1
                );


            const target =
                this.relativeTarget(
                    cpu,
                    address + 2,
                    displacement
                );


            return this.conditionalJump(
                address,
                2,
                "JNZ",
                target,
                cpu =>
                    !cpu.getFlag(
                        1 << 6
                    )
            );

        }


        /* ----------------------------------------------------
           JC
           72
        ---------------------------------------------------- */

        if (
            opcode === 0x72
        ) {

            const displacement =
                this.readS8(
                    cpu,
                    address + 1
                );


            const target =
                this.relativeTarget(
                    cpu,
                    address + 2,
                    displacement
                );


            return this.conditionalJump(
                address,
                2,
                "JC",
                target,
                cpu =>
                    cpu.getFlag(
                        1 << 0
                    )
            );

        }


        /* ----------------------------------------------------
           JNC
           73
        ---------------------------------------------------- */

        if (
            opcode === 0x73
        ) {

            const displacement =
                this.readS8(
                    cpu,
                    address + 1
                );


            const target =
                this.relativeTarget(
                    cpu,
                    address + 2,
                    displacement
                );


            return this.conditionalJump(
                address,
                2,
                "JNC",
                target,
                cpu =>
                    !cpu.getFlag(
                        1 << 0
                    )
            );

        }


        /* ----------------------------------------------------
           JS
           78
        ---------------------------------------------------- */

        if (
            opcode === 0x78
        ) {

            const displacement =
                this.readS8(
                    cpu,
                    address + 1
                );


            const target =
                this.relativeTarget(
                    cpu,
                    address + 2,
                    displacement
                );


            return this.conditionalJump(
                address,
                2,
                "JS",
                target,
                cpu =>
                    cpu.getFlag(
                        1 << 7
                    )
            );

        }


        /* ----------------------------------------------------
           JNS
           79
        ---------------------------------------------------- */

        if (
            opcode === 0x79
        ) {

            const displacement =
                this.readS8(
                    cpu,
                    address + 1
                );


            const target =
                this.relativeTarget(
                    cpu,
                    address + 2,
                    displacement
                );


            return this.conditionalJump(
                address,
                2,
                "JNS",
                target,
                cpu =>
                    !cpu.getFlag(
                        1 << 7
                    )
            );

        }


        /* ----------------------------------------------------
           UNKNOWN
        ---------------------------------------------------- */

        throw new Error(

            `Unsupported x86 opcode ` +
            `0x${opcode
                .toString(16)
                .padStart(2, "0")
                .toUpperCase()} ` +
            `at 0x${address
                .toString(16)
                .padStart(8, "0")
                .toUpperCase()}`

        );

    }


    /* ========================================================
       CONDITIONAL JUMP
    ======================================================== */

    conditionalJump(
        address,
        length,
        mnemonic,
        target,
        condition
    ) {

        return this.instruction(

            address,

            length,

            mnemonic,

            `0x${target
                .toString(16)
                .padStart(8, "0")}`,

            cpu => {

                if (
                    condition(cpu)
                ) {

                    cpu.EIP =
                        target;

                } else {

                    cpu.EIP =
                        (
                            address +
                            length
                        ) >>> 0;

                }

            }

        );

    }


    /* ========================================================
       STATUS
    ======================================================== */

    getStatus() {

        return {

            version:
                this.version,

            instructionsDecoded:
                this.instructionsDecoded,

            lastInstruction:
                this.lastInstruction
                    ? this.lastInstruction.text
                    : null

        };

    }


    /* ========================================================
       SELF TEST
    ======================================================== */

    selfTest(
        cpu
    ) {

        if (
            !cpu
        ) {

            throw new Error(
                "Decoder selfTest requires CPU."
            );

        }


        /*
         * Program:
         *
         * MOV EAX,10
         * MOV EBX,20
         * ADD EAX,EBX
         * HLT
         */

        const address =
            0x1000;


        cpu.memory.writeBytes(
            address,
            new Uint8Array([

                0xB8,
                0x0A,
                0x00,
                0x00,
                0x00,

                0xBB,
                0x14,
                0x00,
                0x00,
                0x00,

                0x01,
                0xD8,

                0xF4

            ])
        );


        cpu.reset();


        cpu.setEIP(
            address
        );


        cpu.attachDecoder(
            this
        );


        cpu.run(
            10
        );


        if (
            cpu.EAX !==
            30
        ) {

            return {

                passed: false,

                test:
                    "MOV/ADD",

                expected:
                    30,

                received:
                    cpu.EAX

            };

        }


        return {

            passed: true,

            decoder:
                WEBBKTX_DECODER_VERSION,

            result:
                "EAX = 30",

            instructions:
                cpu.instructionsExecuted

        };

    }

}


/* ============================================================
   GLOBAL INSTANCE
============================================================ */

window.WebBktxDecoder =
    WebBktxDecoder;


/*
 * Compatibility aliases.
 */

window.WebBktxX86Decoder =
    WebBktxDecoder;


/* ============================================================
   READY
============================================================ */

console.log(
    `WebBktx x86 Decoder ${WEBBKTX_DECODER_VERSION} loaded.`
);
