/*
 * ============================================================
 * WebBktx x86 Decoder
 *
 * Version: 0.7C
 *
 * Experimental 32-bit x86 instruction decoder
 *
 * Supported instructions:
 *
 *   B8-BF  MOV r32, imm32
 *   B9     MOV ECX, imm32
 *   05     ADD EAX, imm32
 *   2D     SUB EAX, imm32
 *   31     XOR r/m32, r32
 *   33     XOR r32, r/m32
 *   89     MOV r/m32, r32
 *   8B     MOV r32, r/m32
 *   40-47  INC r32
 *   48-4F  DEC r32
 *   50-57  PUSH r32
 *   58-5F  POP r32
 *   90     NOP
 *   C3     RET
 *   F4     HLT
 *
 * Basic ModR/M decoding:
 *
 *   register
 *   direct memory
 *
 * ============================================================
 */

"use strict";


/* ============================================================
   REGISTER TABLE
============================================================ */

const X86_REGISTER_NAMES = [

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
   DECODER
============================================================ */

class WebBktxX86Decoder {

    constructor(memory) {

        if (!memory) {

            throw new Error(
                "Decoder requires memory."
            );

        }


        this.memory =
            memory;

    }


    /* ========================================================
       BYTE READ
    ======================================================== */

    read8(address) {

        return this.memory.read8(
            address >>> 0
        );

    }


    read16(address) {

        return this.memory.read16(
            address >>> 0
        );

    }


    read32(address) {

        return this.memory.read32(
            address >>> 0
        );

    }


    /* ========================================================
       SIGN EXTENSION
    ======================================================== */

    sign8(value) {

        value &= 0xFF;


        if (
            value & 0x80
        ) {

            return value - 0x100;

        }


        return value;

    }


    sign16(value) {

        value &= 0xFFFF;


        if (
            value & 0x8000
        ) {

            return value - 0x10000;

        }


        return value;

    }


    sign32(value) {

        value >>>= 0;


        return value | 0;

    }


    /* ========================================================
       REGISTER NAME
    ======================================================== */

    registerName(index) {

        index &= 7;


        return X86_REGISTER_NAMES[
            index
        ];

    }


    /* ========================================================
       MODRM
    ======================================================== */

    decodeModRM(
        address
    ) {

        const value =
            this.read8(
                address
            );


        const mod =
            (value >> 6) & 3;


        const reg =
            (value >> 3) & 7;


        const rm =
            value & 7;


        return {

            value,

            mod,

            reg,

            rm,

            regName:
                this.registerName(
                    reg
                ),

            rmName:
                this.registerName(
                    rm
                )

        };

    }


    /* ========================================================
       OPERAND
    ======================================================== */

    decodeRM32(
        cpu,
        address,
        modrm
    ) {

        /*
         * Register operand.
         *
         * mod = 11
         */

        if (
            modrm.mod === 3
        ) {

            return {

                type:
                    "register",

                register:
                    this.registerName(
                        modrm.rm
                    )

            };

        }


        /*
         * Simple memory addressing.
         *
         * Full SIB addressing comes later.
         */

        if (
            modrm.rm === 4
        ) {

            throw new Error(
                "SIB addressing is not implemented yet."
            );

        }


        /*
         * Direct [disp32]
         */

        if (
            modrm.mod === 0 &&
            modrm.rm === 5
        ) {

            const displacement =
                this.read32(
                    address + 1
                );


            return {

                type:
                    "memory",

                address:
                    displacement >>> 0,

                length:
                    5

            };

        }


        /*
         * [register]
         */

        if (
            modrm.mod === 0
        ) {

            return {

                type:
                    "memory",

                register:
                    this.registerName(
                        modrm.rm
                    ),

                displacement:
                    0,

                length:
                    1

            };

        }


        /*
         * [register + disp8]
         */

        if (
            modrm.mod === 1
        ) {

            const displacement =
                this.sign8(
                    this.read8(
                        address + 1
                    )
                );


            return {

                type:
                    "memory",

                register:
                    this.registerName(
                        modrm.rm
                    ),

                displacement,

                length:
                    2

            };

        }


        /*
         * [register + disp32]
         */

        if (
            modrm.mod === 2
        ) {

            const displacement =
                this.read32(
                    address + 1
                );


            return {

                type:
                    "memory",

                register:
                    this.registerName(
                        modrm.rm
                    ),

                displacement:
                    this.sign32(
                        displacement
                    ),

                length:
                    5

            };

        }


        throw new Error(
            "Unsupported ModR/M addressing mode."
        );

    }


    /* ========================================================
       READ OPERAND
    ======================================================== */

    readOperand(
        cpu,
        operand
    ) {

        if (
            operand.type ===
            "register"
        ) {

            return cpu.getRegister(
                operand.register
            );

        }


        if (
            operand.type ===
            "memory"
        ) {

            let address;


            if (
                typeof operand.address ===
                "number"
            ) {

                address =
                    operand.address;

            } else {

                address =
                    (
                        cpu.getRegister(
                            operand.register
                        ) +
                        operand.displacement
                    ) >>> 0;

            }


            return cpu.read32(
                address
            );

        }


        throw new Error(
            "Unknown operand type."
        );

    }


    /* ========================================================
       WRITE OPERAND
    ======================================================== */

    writeOperand(
        cpu,
        operand,
        value
    ) {

        value >>>= 0;


        if (
            operand.type ===
            "register"
        ) {

            cpu.setRegister(
                operand.register,
                value
            );

            return;

        }


        if (
            operand.type ===
            "memory"
        ) {

            let address;


            if (
                typeof operand.address ===
                "number"
            ) {

                address =
                    operand.address;

            } else {

                address =
                    (
                        cpu.getRegister(
                            operand.register
                        ) +
                        operand.displacement
                    ) >>> 0;

            }


            cpu.write32(
                address,
                value
            );


            return;

        }


        throw new Error(
            "Unknown operand type."
        );

    }


    /* ========================================================
       MOV REGISTER, IMM32
    ======================================================== */

    decodeMOVImmediate(
        cpu,
        address,
        opcode
    ) {

        const registerIndex =
            opcode - 0xB8;


        const register =
            this.registerName(
                registerIndex
            );


        const value =
            this.read32(
                address + 1
            );


        return {

            address,

            opcode,

            mnemonic:
                `MOV ${register}, 0x${
                    value
                        .toString(16)
                        .toUpperCase()
                }`,

            length:
                5,

            execute: cpu => {

                cpu.setRegister(
                    register,
                    value
                );


                cpu.EIP =
                    (
                        address + 5
                    ) >>> 0;

            }

        };

    }


    /* ========================================================
       ADD EAX, IMM32
    ======================================================== */

    decodeAddEAX(
        cpu,
        address
    ) {

        const value =
            this.read32(
                address + 1
            );


        return {

            address,

            opcode:
                0x05,

            mnemonic:
                `ADD EAX, 0x${
                    value
                        .toString(16)
                        .toUpperCase()
                }`,

            length:
                5,

            execute: cpu => {

                cpu.EAX =
                    cpu.add32(
                        cpu.EAX,
                        value
                    );


                cpu.EIP =
                    (
                        address + 5
                    ) >>> 0;

            }

        };

    }


    /* ========================================================
       SUB EAX, IMM32
    ======================================================== */

    decodeSubEAX(
        cpu,
        address
    ) {

        const value =
            this.read32(
                address + 1
            );


        return {

            address,

            opcode:
                0x2D,

            mnemonic:
                `SUB EAX, 0x${
                    value
                        .toString(16)
                        .toUpperCase()
                }`,

            length:
                5,

            execute: cpu => {

                cpu.EAX =
                    cpu.sub32(
                        cpu.EAX,
                        value
                    );


                cpu.EIP =
                    (
                        address + 5
                    ) >>> 0;

            }

        };

    }


    /* ========================================================
       INC REGISTER
    ======================================================== */

    decodeINC(
        cpu,
        address,
        opcode
    ) {

        const register =
            this.registerName(
                opcode - 0x40
            );


        return {

            address,

            opcode,

            mnemonic:
                `INC ${register}`,

            length:
                1,

            execute: cpu => {

                const value =
                    cpu.getRegister(
                        register
                    );


                cpu.setRegister(
                    register,
                    cpu.inc32(
                        value
                    )
                );


                cpu.EIP =
                    (
                        address + 1
                    ) >>> 0;

            }

        };

    }


    /* ========================================================
       DEC REGISTER
    ======================================================== */

    decodeDEC(
        cpu,
        address,
        opcode
    ) {

        const register =
            this.registerName(
                opcode - 0x48
            );


        return {

            address,

            opcode,

            mnemonic:
                `DEC ${register}`,

            length:
                1,

            execute: cpu => {

                const value =
                    cpu.getRegister(
                        register
                    );


                cpu.setRegister(
                    register,
                    cpu.dec32(
                        value
                    )
                );


                cpu.EIP =
                    (
                        address + 1
                    ) >>> 0;

            }

        };

    }


    /* ========================================================
       PUSH REGISTER
    ======================================================== */

    decodePUSH(
        cpu,
        address,
        opcode
    ) {

        const register =
            this.registerName(
                opcode - 0x50
            );


        return {

            address,

            opcode,

            mnemonic:
                `PUSH ${register}`,

            length:
                1,

            execute: cpu => {

                cpu.push32(
                    cpu.getRegister(
                        register
                    )
                );


                cpu.EIP =
                    (
                        address + 1
                    ) >>> 0;

            }

        };

    }


    /* ========================================================
       POP REGISTER
    ======================================================== */

    decodePOP(
        cpu,
        address,
        opcode
    ) {

        const register =
            this.registerName(
                opcode - 0x58
            );


        return {

            address,

            opcode,

            mnemonic:
                `POP ${register}`,

            length:
                1,

            execute: cpu => {

                cpu.setRegister(
                    register,
                    cpu.pop32()
                );


                cpu.EIP =
                    (
                        address + 1
                    ) >>> 0;

            }

        };

    }


    /* ========================================================
       NOP
    ======================================================== */

    decodeNOP(
        cpu,
        address
    ) {

        return {

            address,

            opcode:
                0x90,

            mnemonic:
                "NOP",

            length:
                1,

            execute: cpu => {

                cpu.EIP =
                    (
                        address + 1
                    ) >>> 0;

            }

        };

    }


    /* ========================================================
       HLT
    ======================================================== */

    decodeHLT(
        cpu,
        address
    ) {

        return {

            address,

            opcode:
                0xF4,

            mnemonic:
                "HLT",

            length:
                1,

            execute: cpu => {

                cpu.EIP =
                    (
                        address + 1
                    ) >>> 0;

                cpu.halt();

            }

        };

    }


    /* ========================================================
       RET
    ======================================================== */

    decodeRET(
        cpu,
        address
    ) {

        return {

            address,

            opcode:
                0xC3,

            mnemonic:
                "RET",

            length:
                1,

            execute: cpu => {

                cpu.EIP =
                    cpu.pop32();

            }

        };

    }


    /* ========================================================
       XOR r/m32, r32
    ======================================================== */

    decodeXORRM32R32(
        cpu,
        address
    ) {

        const modrm =
            this.decodeModRM(
                address + 1
            );


        const operand =
            this.decodeRM32(
                cpu,
                address + 1,
                modrm
            );


        const length =
            2 +
            (
                operand.length
                    ? operand.length - 1
                    : 0
            );


        return {

            address,

            opcode:
                0x31,

            mnemonic:
                `XOR ${
                    operand.type === "register"
                        ? operand.register
                        : "[MEM]"
                }, ${modrm.regName}`,

            length,

            execute: cpu => {

                const left =
                    this.readOperand(
                        cpu,
                        operand
                    );


                const right =
                    cpu.getRegister(
                        modrm.regName
                    );


                const result =
                    cpu.xor32(
                        left,
                        right
                    );


                this.writeOperand(
                    cpu,
                    operand,
                    result
                );


                cpu.EIP =
                    (
                        address +
                        length
                    ) >>> 0;

            }

        };

    }


    /* ========================================================
       XOR r32, r/m32
    ======================================================== */

    decodeXORR32RM32(
        cpu,
        address
    ) {

        const modrm =
            this.decodeModRM(
                address + 1
            );


        const operand =
            this.decodeRM32(
                cpu,
                address + 1,
                modrm
            );


        const length =
            2 +
            (
                operand.length
                    ? operand.length - 1
                    : 0
            );


        return {

            address,

            opcode:
                0x33,

            mnemonic:
                `XOR ${modrm.regName}, ${
                    operand.type === "register"
                        ? operand.register
                        : "[MEM]"
                }`,

            length,

            execute: cpu => {

                const left =
                    cpu.getRegister(
                        modrm.regName
                    );


                const right =
                    this.readOperand(
                        cpu,
                        operand
                    );


                const result =
                    cpu.xor32(
                        left,
                        right
                    );


                cpu.setRegister(
                    modrm.regName,
                    result
                );


                cpu.EIP =
                    (
                        address +
                        length
                    ) >>> 0;

            }

        };

    }


    /* ========================================================
       MOV r/m32, r32
    ======================================================== */

    decodeMOVRM32R32(
        cpu,
        address
    ) {

        const modrm =
            this.decodeModRM(
                address + 1
            );


        const operand =
            this.decodeRM32(
                cpu,
                address + 1,
                modrm
            );


        const length =
            2 +
            (
                operand.length
                    ? operand.length - 1
                    : 0
            );


        return {

            address,

            opcode:
                0x89,

            mnemonic:
                `MOV ${
                    operand.type === "register"
                        ? operand.register
                        : "[MEM]"
                }, ${modrm.regName}`,

            length,

            execute: cpu => {

                const value =
                    cpu.getRegister(
                        modrm.regName
                    );


                this.writeOperand(
                    cpu,
                    operand,
                    value
                );


                cpu.EIP =
                    (
                        address +
                        length
                    ) >>> 0;

            }

        };

    }


    /* ========================================================
       MOV r32, r/m32
    ======================================================== */

    decodeMOVR32RM32(
        cpu,
        address
    ) {

        const modrm =
            this.decodeModRM(
                address + 1
            );


        const operand =
            this.decodeRM32(
                cpu,
                address + 1,
                modrm
            );


        const length =
            2 +
            (
                operand.length
                    ? operand.length - 1
                    : 0
            );


        return {

            address,

            opcode:
                0x8B,

            mnemonic:
                `MOV ${modrm.regName}, ${
                    operand.type === "register"
                        ? operand.register
                        : "[MEM]"
                }`,

            length,

            execute: cpu => {

                const value =
                    this.readOperand(
                        cpu,
                        operand
                    );


                cpu.setRegister(
                    modrm.regName,
                    value
                );


                cpu.EIP =
                    (
                        address +
                        length
                    ) >>> 0;

            }

        };

    }


    /* ========================================================
       DECODE
    ======================================================== */

    decode(
        cpu,
        address
    ) {

        const opcode =
            this.read8(
                address
            );


        /*
         * MOV r32, imm32
         *
         * B8-BF
         */

        if (
            opcode >= 0xB8 &&
            opcode <= 0xBF
        ) {

            return this.decodeMOVImmediate(
                cpu,
                address,
                opcode
            );

        }


        /*
         * ADD EAX, imm32
         */

        if (
            opcode === 0x05
        ) {

            return this.decodeAddEAX(
                cpu,
                address
            );

        }


        /*
         * SUB EAX, imm32
         */

        if (
            opcode === 0x2D
        ) {

            return this.decodeSubEAX(
                cpu,
                address
            );

        }


        /*
         * INC r32
         */

        if (
            opcode >= 0x40 &&
            opcode <= 0x47
        ) {

            return this.decodeINC(
                cpu,
                address,
                opcode
            );

        }


        /*
         * DEC r32
         */

        if (
            opcode >= 0x48 &&
            opcode <= 0x4F
        ) {

            return this.decodeDEC(
                cpu,
                address,
                opcode
            );

        }


        /*
         * PUSH r32
         */

        if (
            opcode >= 0x50 &&
            opcode <= 0x57
        ) {

            return this.decodePUSH(
                cpu,
                address,
                opcode
            );

        }


        /*
         * POP r32
         */

        if (
            opcode >= 0x58 &&
            opcode <= 0x5F
        ) {

            return this.decodePOP(
                cpu,
                address,
                opcode
            );

        }


        /*
         * NOP
         */

        if (
            opcode === 0x90
        ) {

            return this.decodeNOP(
                cpu,
                address
            );

        }


        /*
         * RET
         */

        if (
            opcode === 0xC3
        ) {

            return this.decodeRET(
                cpu,
                address
            );

        }


        /*
         * HLT
         */

        if (
            opcode === 0xF4
        ) {

            return this.decodeHLT(
                cpu,
                address
            );

        }


        /*
         * XOR r/m32,r32
         */

        if (
            opcode === 0x31
        ) {

            return this.decodeXORRM32R32(
                cpu,
                address
            );

        }


        /*
         * XOR r32,r/m32
         */

        if (
            opcode === 0x33
        ) {

            return this.decodeXORR32RM32(
                cpu,
                address
            );

        }


        /*
         * MOV r/m32,r32
         */

        if (
            opcode === 0x89
        ) {

            return this.decodeMOVRM32R32(
                cpu,
                address
            );

        }


        /*
         * MOV r32,r/m32
         */

        if (
            opcode === 0x8B
        ) {

            return this.decodeMOVR32RM32(
                cpu,
                address
            );

        }


        /*
         * Unknown opcode.
         */

        throw new Error(
            `Unsupported x86 opcode ` +
            `0x${opcode
                .toString(16)
                .padStart(2, "0")
                .toUpperCase()} ` +
            `at EIP=0x${address
                .toString(16)
                .padStart(8, "0")
                .toUpperCase()}`
        );

    }

}


/* ============================================================
   EXPORT
============================================================ */

window.WebBktxX86Decoder =
    WebBktxX86Decoder;


window.WebBktxX86Registers =
    X86_REGISTER_NAMES;


console.log(
    "WebBktx x86 Decoder 0.7C loaded."
);
