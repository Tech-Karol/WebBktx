/*
 * ============================================================
 * WebBktx — Game Boy CPU / Sharp LR35902
 * ============================================================
 *
 * 8-bit CPU used by Nintendo Game Boy.
 *
 * Registers:
 *
 * AF
 * BC
 * DE
 * HL
 * SP
 * PC
 *
 * Flags:
 *
 * Z  7  Zero
 * N  6  Subtract
 * H  5  Half Carry
 * C  4  Carry
 *
 * CPU clock:
 *
 * 4.194304 MHz
 *
 * This implementation executes the complete
 * unprefixed and CB-prefixed opcode space.
 *
 * ============================================================
 */

export default class CPU {

    constructor(memory) {

        this.memory =
            memory;


        /*
         * ----------------------------------------------------
         * Registers
         * ----------------------------------------------------
         */

        this.a = 0;
        this.f = 0;

        this.b = 0;
        this.c = 0;

        this.d = 0;
        this.e = 0;

        this.h = 0;
        this.l = 0;


        /*
         * ----------------------------------------------------
         * Stack / Program Counter
         * ----------------------------------------------------
         */

        this.sp = 0;
        this.pc = 0;


        /*
         * ----------------------------------------------------
         * CPU state
         * ----------------------------------------------------
         */

        this.halted = false;
        this.stopped = false;

        this.ime = false;

        this.imeDelay = 0;

        this.haltBug = false;


        /*
         * ----------------------------------------------------
         * Last instruction
         * ----------------------------------------------------
         */

        this.lastOpcode = 0;

        this.lastPC = 0;


        /*
         * ----------------------------------------------------
         * Cycle counter
         * ----------------------------------------------------
         */

        this.cycles = 0;


        /*
         * ----------------------------------------------------
         * Debug
         * ----------------------------------------------------
         */

        this.instructions =
            0;

    }


    /*
     * ========================================================
     * RESET
     * ========================================================
     *
     * DMG post-boot state.
     *
     * This assumes the Nintendo boot ROM has already
     * completed.
     *
     * ========================================================
     */

    reset() {

        this.a = 0x01;
        this.f = 0xB0;

        this.b = 0x00;
        this.c = 0x13;

        this.d = 0x00;
        this.e = 0xD8;

        this.h = 0x01;
        this.l = 0x4D;

        this.sp =
            0xFFFE;

        this.pc =
            0x0100;


        this.halted =
            false;

        this.stopped =
            false;

        this.ime =
            false;

        this.imeDelay =
            0;

        this.haltBug =
            false;

        this.lastOpcode =
            0;

        this.lastPC =
            0;

        this.cycles =
            0;

        this.instructions =
            0;

    }


    /*
     * ========================================================
     * 8-BIT REGISTER ACCESS
     * ========================================================
     */

    readReg8(index) {

        switch (
            index & 7
        ) {

            case 0:
                return this.b;

            case 1:
                return this.c;

            case 2:
                return this.d;

            case 3:
                return this.e;

            case 4:
                return this.h;

            case 5:
                return this.l;

            case 6:
                return this.readByte(
                    this.getHL()
                );

            case 7:
                return this.a;

        }

        return 0;

    }


    writeReg8(
        index,
        value
    ) {

        value &=
            0xFF;


        switch (
            index & 7
        ) {

            case 0:
                this.b = value;
                break;

            case 1:
                this.c = value;
                break;

            case 2:
                this.d = value;
                break;

            case 3:
                this.e = value;
                break;

            case 4:
                this.h = value;
                break;

            case 5:
                this.l = value;
                break;

            case 6:

                this.writeByte(
                    this.getHL(),
                    value
                );

                break;

            case 7:
                this.a = value;
                break;

        }

    }


    /*
     * ========================================================
     * 16-BIT REGISTERS
     * ========================================================
     */

    getAF() {

        return (
            this.a << 8 |
            this.f
        ) & 0xFFF0;

    }


    setAF(
        value
    ) {

        this.a =
            (value >> 8) &
            0xFF;

        this.f =
            value &
            0xF0;

    }


    getBC() {

        return (
            this.b << 8 |
            this.c
        );

    }


    setBC(
        value
    ) {

        this.b =
            (value >> 8) &
            0xFF;

        this.c =
            value & 0xFF;

    }


    getDE() {

        return (
            this.d << 8 |
            this.e
        );

    }


    setDE(
        value
    ) {

        this.d =
            (value >> 8) &
            0xFF;

        this.e =
            value & 0xFF;

    }


    getHL() {

        return (
            this.h << 8 |
            this.l
        );

    }


    setHL(
        value
    ) {

        this.h =
            (value >> 8) &
            0xFF;

        this.l =
            value & 0xFF;

    }


    /*
     * ========================================================
     * MEMORY
     * ========================================================
     */

    readByte(
        address
    ) {

        return this.memory.readByte(
            address & 0xFFFF
        );

    }


    writeByte(
        address,
        value
    ) {

        this.memory.writeByte(
            address & 0xFFFF,
            value & 0xFF
        );

    }


    fetch8() {

        const value =
            this.readByte(
                this.pc
            );


        this.pc =
            (
                this.pc + 1
            ) & 0xFFFF;


        return value;

    }


    fetch16() {

        const low =
            this.fetch8();


        const high =
            this.fetch8();


        return (
            low |
            high << 8
        );

    }


    /*
     * ========================================================
     * STACK
     * ========================================================
     */

    push16(
        value
    ) {

        value &=
            0xFFFF;


        this.sp =
            (
                this.sp - 1
            ) & 0xFFFF;

        this.writeByte(
            this.sp,
            value >> 8
        );


        this.sp =
            (
                this.sp - 1
            ) & 0xFFFF;

        this.writeByte(
            this.sp,
            value & 0xFF
        );

    }


    pop16() {

        const low =
            this.readByte(
                this.sp
            );


        this.sp =
            (
                this.sp + 1
            ) & 0xFFFF;


        const high =
            this.readByte(
                this.sp
            );


        this.sp =
            (
                this.sp + 1
            ) & 0xFFFF;


        return (
            low |
            high << 8
        );

    }


    /*
     * ========================================================
     * FLAGS
     * ========================================================
     */

    getZ() {

        return Boolean(
            this.f & 0x80
        );

    }


    getN() {

        return Boolean(
            this.f & 0x40
        );

    }


    getH() {

        return Boolean(
            this.f & 0x20
        );

    }


    getC() {

        return Boolean(
            this.f & 0x10
        );

    }


    setFlag(
        mask,
        enabled
    ) {

        if (
            enabled
        ) {

            this.f |=
                mask;

        } else {

            this.f &=
                ~mask;

        }


        this.f &=
            0xF0;

    }


    /*
     * ========================================================
     * ADD 8
     * ========================================================
     */

    add8(
        value,
        carry = false
    ) {

        const a =
            this.a;


        const c =
            carry &&
            this.getC()
                ? 1
                : 0;


        const result =
            a +
            value +
            c;


        this.setFlag(
            0x80,
            (result & 0xFF) === 0
        );

        this.setFlag(
            0x40,
            false
        );

        this.setFlag(
            0x20,
            (
                (a & 0x0F) +
                (value & 0x0F) +
                c
            ) > 0x0F
        );

        this.setFlag(
            0x10,
            result > 0xFF
        );


        this.a =
            result & 0xFF;

    }


    /*
     * ========================================================
     * SUB 8
     * ========================================================
     */

    sub8(
        value,
        carry = false
    ) {

        const a =
            this.a;


        const c =
            carry &&
            this.getC()
                ? 1
                : 0;


        const result =
            a -
            value -
            c;


        this.setFlag(
            0x80,
            (result & 0xFF) === 0
        );

        this.setFlag(
            0x40,
            true
        );

        this.setFlag(
            0x20,
            (
                (a & 0x0F) -
                (value & 0x0F) -
                c
            ) < 0
        );

        this.setFlag(
            0x10,
            result < 0
        );


        this.a =
            result & 0xFF;

    }


    /*
     * ========================================================
     * INC 8
     * ========================================================
     */

    inc8(
        value
    ) {

        const result =
            (
                value + 1
            ) & 0xFF;


        this.setFlag(
            0x80,
            result === 0
        );

        this.setFlag(
            0x40,
            false
        );

        this.setFlag(
            0x20,
            (
                (value & 0x0F) +
                1
            ) > 0x0F
        );


        return result;

    }


    /*
     * ========================================================
     * DEC 8
     * ========================================================
     */

    dec8(
        value
    ) {

        const result =
            (
                value - 1
            ) & 0xFF;


        this.setFlag(
            0x80,
            result === 0
        );

        this.setFlag(
            0x40,
            true
        );

        this.setFlag(
            0x20,
            (value & 0x0F) === 0
        );


        return result;

    }


    /*
     * ========================================================
     * ADD HL
     * ========================================================
     */

    addHL(
        value
    ) {

        const hl =
            this.getHL();


        const result =
            hl +
            value;


        this.setFlag(
            0x40,
            false
        );

        this.setFlag(
            0x20,
            (
                (hl & 0x0FFF) +
                (value & 0x0FFF)
            ) > 0x0FFF
        );

        this.setFlag(
            0x10,
            result > 0xFFFF
        );


        this.setHL(
            result & 0xFFFF
        );

    }


    /*
     * ========================================================
     * ROTATE
     * ========================================================
     */

    rlc(
        value
    ) {

        const result =
            (
                value << 1 |
                value >> 7
            ) & 0xFF;


        this.f =
            0;


        if (
            result === 0
        ) {

            this.f |=
                0x80;

        }


        if (
            value & 0x80
        ) {

            this.f |=
                0x10;

        }


        return result;

    }


    rrc(
        value
    ) {

        const result =
            (
                value >> 1 |
                (
                    value & 1
                ) << 7
            ) & 0xFF;


        this.f =
            0;


        if (
            result === 0
        ) {

            this.f |=
                0x80;

        }


        if (
            value & 1
        ) {

            this.f |=
                0x10;

        }


        return result;

    }


    rl(
        value
    ) {

        const carry =
            this.getC()
                ? 1
                : 0;


        const newCarry =
            Boolean(
                value & 0x80
            );


        const result =
            (
                value << 1 |
                carry
            ) & 0xFF;


        this.f =
            0;


        if (
            result === 0
        ) {

            this.f |=
                0x80;

        }


        if (
            newCarry
        ) {

            this.f |=
                0x10;

        }


        return result;

    }


    rr(
        value
    ) {

        const carry =
            this.getC()
                ? 0x80
                : 0;


        const newCarry =
            Boolean(
                value & 1
            );


        const result =
            (
                value >> 1 |
                carry
            ) & 0xFF;


        this.f =
            0;


        if (
            result === 0
        ) {

            this.f |=
                0x80;

        }


        if (
            newCarry
        ) {

            this.f |=
                0x10;

        }


        return result;

    }


    sla(
        value
    ) {

        const carry =
            Boolean(
                value & 0x80
            );


        const result =
            (
                value << 1
            ) & 0xFF;


        this.f =
            0;


        if (
            result === 0
        ) {

            this.f |=
                0x80;

        }


        if (
            carry
        ) {

            this.f |=
                0x10;

        }


        return result;

    }


    sra(
        value
    ) {

        const carry =
            Boolean(
                value & 1
            );


        const result =
            (
                value >> 1 |
                value & 0x80
            ) & 0xFF;


        this.f =
            0;


        if (
            result === 0
        ) {

            this.f |=
                0x80;

        }


        if (
            carry
        ) {

            this.f |=
                0x10;

        }


        return result;

    }


    srl(
        value
    ) {

        const carry =
            Boolean(
                value & 1
            );


        const result =
            value >> 1;


        this.f =
            0;


        if (
            result === 0
        ) {

            this.f |=
                0x80;

        }


        if (
            carry
        ) {

            this.f |=
                0x10;

        }


        return result;

    }


    swap(
        value
    ) {

        const result =
            (
                value >> 4 |
                value << 4
            ) & 0xFF;


        this.f =
            result === 0
                ? 0x80
                : 0;


        return result;

    }


    /*
     * ========================================================
     * DAA
     * ========================================================
     */

    daa() {

        let correction =
            0;

        let carry =
            this.getC();


        if (
            !this.getN()
        ) {

            if (
                this.getH() ||
                (
                    this.a &
                    0x0F
                ) > 9
            ) {

                correction |=
                    0x06;

            }


            if (
                this.getC() ||
                this.a > 0x99
            ) {

                correction |=
                    0x60;

                carry = true;

            }


            this.a =
                (
                    this.a +
                    correction
                ) & 0xFF;

        } else {

            if (
                this.getH()
            ) {

                correction |=
                    0x06;

            }


            if (
                this.getC()
            ) {

                correction |=
                    0x60;

            }


            this.a =
                (
                    this.a -
                    correction
                ) & 0xFF;

        }


        this.setFlag(
            0x80,
            this.a === 0
        );

        this.setFlag(
            0x20,
            false
        );

        this.setFlag(
            0x10,
            carry
        );

    }


    /*
     * ========================================================
     * CP
     * ========================================================
     */

    cp(
        value
    ) {

        const a =
            this.a;


        const result =
            a -
            value;


        this.setFlag(
            0x80,
            (
                result & 0xFF
            ) === 0
        );

        this.setFlag(
            0x40,
            true
        );

        this.setFlag(
            0x20,
            (
                (a & 0x0F) <
                (value & 0x0F)
            )
        );

        this.setFlag(
            0x10,
            a < value
        );

    }


    /*
     * ========================================================
     * BIT
     * ========================================================
     */

    bit(
        bit,
        value
    ) {

        this.setFlag(
            0x80,
            (
                value &
                (
                    1 << bit
                )
            ) === 0
        );

        this.setFlag(
            0x40,
            false
        );

        this.setFlag(
            0x20,
            true
        );

    }


    /*
     * ========================================================
     * STEP
     * ========================================================
     */

    step() {

        /*
         * ----------------------------------------------------
         * STOPPED
         * ----------------------------------------------------
         */

        if (
            this.stopped
        ) {

            return 4;

        }


        /*
         * ----------------------------------------------------
         * HALTED
         * ----------------------------------------------------
         */

        if (
            this.halted
        ) {

            const pending =
                this.getPendingInterrupts();


            if (
                pending
            ) {

                this.halted =
                    false;

            } else {

                this.cycles +=
                    4;

                return 4;

            }

        }


        /*
         * ----------------------------------------------------
         * Interrupts
         * ----------------------------------------------------
         */

        if (
            this.ime
        ) {

            const pending =
                this.getPendingInterrupts();


            if (
                pending
            ) {

                return this.serviceInterrupt(
                    pending
                );

            }

        }


        /*
         * ----------------------------------------------------
         * Fetch
         * ----------------------------------------------------
         */

        this.lastPC =
            this.pc;


        let opcode =
            this.fetch8();


        /*
         * HALT bug.
         *
         * On the real CPU, PC handling is special.
         */

        if (
            this.haltBug
        ) {

            this.pc =
                (
                    this.pc -
                    1
                ) & 0xFFFF;

            this.haltBug =
                false;

        }


        this.lastOpcode =
            opcode;


        this.instructions++;


        /*
         * ----------------------------------------------------
         * CB prefix
         * ----------------------------------------------------
         */

        if (
            opcode ===
            0xCB
        ) {

            const cb =
                this.fetch8();


            const cycles =
                this.executeCB(
                    cb
                );


            this.cycles +=
                cycles;


            this.finishEI();


            return cycles;

        }


        /*
         * ----------------------------------------------------
         * Normal opcode
         * ----------------------------------------------------
         */

        const cycles =
            this.executeOpcode(
                opcode
            );


        this.cycles +=
            cycles;


        this.finishEI();


        return cycles;

    }


    /*
     * ========================================================
     * INTERRUPTS
     * ========================================================
     */

    getPendingInterrupts() {

        if (
            !this.memory
        ) {

            return 0;

        }


        return (
            this.memory.interruptEnable &
            this.memory.interruptFlags &
            0x1F
        );

    }


    serviceInterrupt(
        pending
    ) {

        let bit =
            0;


        while (
            bit < 5 &&
            !(
                pending &
                (
                    1 << bit
                )
            )
        ) {

            bit++;

        }


        this.halted =
            false;

        this.ime =
            false;


        this.memory.clearInterrupt(
            bit
        );


        this.push16(
            this.pc
        );


        this.pc =
            [
                0x40,
                0x48,
                0x50,
                0x58,
                0x60
            ][bit];


        this.cycles +=
            20;


        return 20;

    }


    /*
     * ========================================================
     * EI DELAY
     * ========================================================
     */

    finishEI() {

        if (
            this.imeDelay > 0
        ) {

            this.imeDelay--;

            if (
                this.imeDelay === 0
            ) {

                this.ime =
                    true;

            }

        }

    }


    /*
     * ========================================================
     * CONDITION
     * ========================================================
     */

    condition(
        code
    ) {

        switch (
            code & 3
        ) {

            case 0:
                return !this.getZ();

            case 1:
                return this.getZ();

            case 2:
                return !this.getC();

            case 3:
                return this.getC();

        }

        return false;

    }


    /*
     * ========================================================
     * NORMAL OPCODES
     * ========================================================
     */

    executeOpcode(
        op
    ) {

        /*
         * ----------------------------------------------------
         * NOP
         * ----------------------------------------------------
         */

        if (
            op === 0x00
        ) {

            return 4;

        }


        /*
         * ----------------------------------------------------
         * LD rr,d16
         * ----------------------------------------------------
         */

        if (
            (
                op & 0x0F
            ) === 0x01
        ) {

            const value =
                this.fetch16();


            switch (
                (op >> 4) & 3
            ) {

                case 0:
                    this.setBC(value);
                    break;

                case 1:
                    this.setDE(value);
                    break;

                case 2:
                    this.setHL(value);
                    break;

                case 3:
                    this.sp =
                        value;
                    break;

            }


            return 12;

        }


        /*
         * ----------------------------------------------------
         * LD (BC/DE),A
         * ----------------------------------------------------
         */

        if (
            op === 0x02
        ) {

            this.writeByte(
                this.getBC(),
                this.a
            );

            return 8;

        }


        if (
            op === 0x12
        ) {

            this.writeByte(
                this.getDE(),
                this.a
            );

            return 8;

        }


        /*
         * ----------------------------------------------------
         * INC rr
         * ----------------------------------------------------
         */

        if (
            (
                op & 0x0F
            ) === 0x03
        ) {

            switch (
                (op >> 4) & 3
            ) {

                case 0:
                    this.setBC(
                        this.getBC() + 1
                    );
                    break;

                case 1:
                    this.setDE(
                        this.getDE() + 1
                    );
                    break;

                case 2:
                    this.setHL(
                        this.getHL() + 1
                    );
                    break;

                case 3:
                    this.sp =
                        (
                            this.sp + 1
                        ) & 0xFFFF;
                    break;

            }


            return 8;

        }


        /*
         * ----------------------------------------------------
         * INC r
         * ----------------------------------------------------
         */

        if (
            (
                op & 7
            ) === 4 &&
            (
                op & 0xC0
            ) === 0
        ) {

            const r =
                (
                    op >> 3
                ) & 7;


            const value =
                this.inc8(
                    this.readReg8(r)
                );


            this.writeReg8(
                r,
                value
            );


            return r === 6
                ? 12
                : 4;

        }


        /*
         * ----------------------------------------------------
         * DEC r
         * ----------------------------------------------------
         */

        if (
            (
                op & 7
            ) === 5 &&
            (
                op & 0xC0
            ) === 0
        ) {

            const r =
                (
                    op >> 3
                ) & 7;


            const value =
                this.dec8(
                    this.readReg8(r)
                );


            this.writeReg8(
                r,
                value
            );


            return r === 6
                ? 12
                : 4;

        }


        /*
         * ----------------------------------------------------
         * LD r,d8
         * ----------------------------------------------------
         */

        if (
            (
                op & 0xC7
            ) === 0x06
        ) {

            const r =
                (
                    op >> 3
                ) & 7;


            this.writeReg8(
                r,
                this.fetch8()
            );


            return r === 6
                ? 12
                : 8;

        }


        /*
         * ----------------------------------------------------
         * RLCA
         * ----------------------------------------------------
         */

        if (
            op === 0x07
        ) {

            const carry =
                Boolean(
                    this.a & 0x80
                );


            this.a =
                (
                    this.a << 1 |
                    (
                        carry
                            ? 1
                            : 0
                    )
                ) & 0xFF;


            this.f =
                carry
                    ? 0x10
                    : 0;


            return 4;

        }


        /*
         * ----------------------------------------------------
         * RRCA
         * ----------------------------------------------------
         */

        if (
            op === 0x0F
        ) {

            const carry =
                Boolean(
                    this.a & 1
                );


            this.a =
                (
                    this.a >> 1 |
                    (
                        carry
                            ? 0x80
                            : 0
                    )
                );


            this.f =
                carry
                    ? 0x10
                    : 0;


            return 4;

        }


        /*
         * ----------------------------------------------------
         * RLA
         * ----------------------------------------------------
         */

        if (
            op === 0x17
        ) {

            const oldCarry =
                this.getC();


            const newCarry =
                Boolean(
                    this.a & 0x80
                );


            this.a =
                (
                    this.a << 1 |
                    (
                        oldCarry
                            ? 1
                            : 0
                    )
                ) & 0xFF;


            this.f =
                newCarry
                    ? 0x10
                    : 0;


            return 4;

        }


        /*
         * ----------------------------------------------------
         * RRA
         * ----------------------------------------------------
         */

        if (
            op === 0x1F
        ) {

            const oldCarry =
                this.getC();


            const newCarry =
                Boolean(
                    this.a & 1
                );


            this.a =
                (
                    this.a >> 1 |
                    (
                        oldCarry
                            ? 0x80
                            : 0
                    )
                );


            this.f =
                newCarry
                    ? 0x10
                    : 0;


            return 4;

        }


        /*
         * ----------------------------------------------------
         * STOP
         * ----------------------------------------------------
         */

        if (
            op === 0x10
        ) {

            this.fetch8();

            this.stopped =
                true;

            return 4;

        }


        /*
         * ----------------------------------------------------
         * JR r8
         * ----------------------------------------------------
         */

        if (
            op === 0x18
        ) {

            const offset =
                this.fetch8();


            this.pc =
                (
                    this.pc +
                    this.sign8(offset)
                ) & 0xFFFF;


            return 12;

        }


        /*
         * ----------------------------------------------------
         * JR cc,r8
         * ----------------------------------------------------
         */

        if (
            (
                op & 0xE7
            ) === 0x20
        ) {

            const offset =
                this.fetch8();


            const condition =
                this.condition(
                    (
                        op >> 3
                    ) & 3
                );


            if (
                condition
            ) {

                this.pc =
                    (
                        this.pc +
                        this.sign8(offset)
                    ) & 0xFFFF;

                return 12;

            }


            return 8;

        }


        /*
         * ----------------------------------------------------
         * ADD HL,rr
         * ----------------------------------------------------
         */

        if (
            (
                op & 0x0F
            ) === 0x09
        ) {

            let value;


            switch (
                (op >> 4) & 3
            ) {

                case 0:
                    value =
                        this.getBC();
                    break;

                case 1:
                    value =
                        this.getDE();
                    break;

                case 2:
                    value =
                        this.getHL();
                    break;

                default:
                    value =
                        this.sp;
                    break;

            }


            this.addHL(
                value
            );


            return 8;

        }


        /*
         * ----------------------------------------------------
         * LD A,(BC)
         * ----------------------------------------------------
         */

        if (
            op === 0x0A
        ) {

            this.a =
                this.readByte(
                    this.getBC()
                );

            return 8;

        }


        /*
         * ----------------------------------------------------
         * LD A,(DE)
         * ----------------------------------------------------
         */

        if (
            op === 0x1A
        ) {

            this.a =
                this.readByte(
                    this.getDE()
                );

            return 8;

        }


        /*
         * ----------------------------------------------------
         * LD (HL+),A
         * ----------------------------------------------------
         */

        if (
            op === 0x22
        ) {

            this.writeByte(
                this.getHL(),
                this.a
            );


            this.setHL(
                this.getHL() + 1
            );


            return 8;

        }


        /*
         * ----------------------------------------------------
         * LD (HL-),A
         * ----------------------------------------------------
         */

        if (
            op === 0x32
        ) {

            this.writeByte(
                this.getHL(),
                this.a
            );


            this.setHL(
                this.getHL() - 1
            );


            return 8;

        }


        /*
         * ----------------------------------------------------
         * LD A,(HL+)
         * ----------------------------------------------------
         */

        if (
            op === 0x2A
        ) {

            this.a =
                this.readByte(
                    this.getHL()
                );


            this.setHL(
                this.getHL() + 1
            );


            return 8;

        }


        /*
         * ----------------------------------------------------
         * LD A,(HL-)
         * ----------------------------------------------------
         */

        if (
            op === 0x3A
        ) {

            this.a =
                this.readByte(
                    this.getHL()
                );


            this.setHL(
                this.getHL() - 1
            );


            return 8;

        }


        /*
         * ----------------------------------------------------
         * INC/DEC (HL)
         * ----------------------------------------------------
         */

        if (
            op === 0x34
        ) {

            const value =
                this.inc8(
                    this.readByte(
                        this.getHL()
                    )
                );


            this.writeByte(
                this.getHL(),
                value
            );


            return 12;

        }


        if (
            op === 0x35
        ) {

            const value =
                this.dec8(
                    this.readByte(
                        this.getHL()
                    )
                );


            this.writeByte(
                this.getHL(),
                value
            );


            return 12;

        }


        /*
         * ----------------------------------------------------
         * LD (HL),d8
         * ----------------------------------------------------
         */

        if (
            op === 0x36
        ) {

            this.writeByte(
                this.getHL(),
                this.fetch8()
            );


            return 12;

        }


        /*
         * ----------------------------------------------------
         * DAA
         * ----------------------------------------------------
         */

        if (
            op === 0x27
        ) {

            this.daa();

            return 4;

        }


        /*
         * ----------------------------------------------------
         * CPL
         * ----------------------------------------------------
         */

        if (
            op === 0x2F
        ) {

            this.a ^=
                0xFF;

            this.f |=
                0x60;

            return 4;

        }


        /*
         * ----------------------------------------------------
         * SCF
         * ----------------------------------------------------
         */

        if (
            op === 0x37
        ) {

            this.f &=
                0x80;

            this.f |=
                0x10;

            return 4;

        }


        /*
         * ----------------------------------------------------
         * CCF
         * ----------------------------------------------------
         */

        if (
            op === 0x3F
        ) {

            const carry =
                !this.getC();


            this.f &=
                0x80;


            if (
                carry
            ) {

                this.f |=
                    0x10;

            }


            return 4;

        }


        /*
         * ----------------------------------------------------
         * LD r,r
         * ----------------------------------------------------
         */

        if (
            op >= 0x40 &&
            op <= 0x7F
        ) {

            /*
             * HALT.
             */

            if (
                op === 0x76
            ) {

                const pending =
                    this.getPendingInterrupts();


                if (
                    !this.ime &&
                    pending
                ) {

                    /*
                     * HALT bug.
                     */

                    this.haltBug =
                        true;

                } else {

                    this.halted =
                        true;

                }


                return 4;

            }


            const dest =
                (
                    op >> 3
                ) & 7;


            const src =
                op & 7;


            const value =
                this.readReg8(
                    src
                );


            this.writeReg8(
                dest,
                value
            );


            return (
                dest === 6 ||
                src === 6
            )
                ? 8
                : 4;

        }


        /*
         * ----------------------------------------------------
         * ALU A,r
         * ----------------------------------------------------
         */

        if (
            op >= 0x80 &&
            op <= 0xBF
        ) {

            const group =
                (
                    op >> 3
                ) & 7;


            const value =
                this.readReg8(
                    op & 7
                );


            switch (
                group
            ) {

                case 0:
                    this.add8(
                        value
                    );
                    break;

                case 1:
                    this.add8(
                        value,
                        true
                    );
                    break;

                case 2:
                    this.sub8(
                        value
                    );
                    break;

                case 3:
                    this.sub8(
                        value,
                        true
                    );
                    break;

                case 4:

                    this.a &=
                        value;

                    this.f =
                        this.a === 0
                            ? 0xA0
                            : 0x20;

                    break;

                case 5:

                    this.a ^=
                        value;

                    this.f =
                        this.a === 0
                            ? 0x80
                            : 0;

                    break;

                case 6:

                    this.a |=
                        value;

                    this.f =
                        this.a === 0
                            ? 0x80
                            : 0;

                    break;

                case 7:
                    this.cp(
                        value
                    );
                    break;

            }


            return (
                (op & 7) === 6
            )
                ? 8
                : 4;

        }


        /*
         * ----------------------------------------------------
         * RET cc
         * ----------------------------------------------------
         */

        if (
            (
                op & 0xE7
            ) === 0xC0
        ) {

            const condition =
                this.condition(
                    (
                        op >> 3
                    ) & 3
                );


            if (
                condition
            ) {

                this.pc =
                    this.pop16();

                return 20;

            }


            return 8;

        }


        /*
         * ----------------------------------------------------
         * POP rr
         * ----------------------------------------------------
         */

        if (
            (
                op & 0xCF
            ) === 0xC1
        ) {

            const value =
                this.pop16();


            switch (
                (op >> 4) & 3
            ) {

                case 0:
                    this.setBC(value);
                    break;

                case 1:
                    this.setDE(value);
                    break;

                case 2:
                    this.setHL(value);
                    break;

                case 3:
                    this.setAF(value);
                    break;

            }


            return 12;

        }


        /*
         * ----------------------------------------------------
         * JP cc,a16
         * ----------------------------------------------------
         */

        if (
            (
                op & 0xE7
            ) === 0xC2
        ) {

            const address =
                this.fetch16();


            if (
                this.condition(
                    (
                        op >> 3
                    ) & 3
                )
            ) {

                this.pc =
                    address;

                return 16;

            }


            return 12;

        }


        /*
         * ----------------------------------------------------
         * JP a16
         * ----------------------------------------------------
         */

        if (
            op === 0xC3
        ) {

            this.pc =
                this.fetch16();

            return 16;

        }


        /*
         * ----------------------------------------------------
         * CALL cc,a16
         * ----------------------------------------------------
         */

        if (
            (
                op & 0xE7
            ) === 0xC4
        ) {

            const address =
                this.fetch16();


            if (
                this.condition(
                    (
                        op >> 3
                    ) & 3
                )
            ) {

                this.push16(
                    this.pc
                );


                this.pc =
                    address;


                return 24;

            }


            return 12;

        }


        /*
         * ----------------------------------------------------
         * PUSH rr
         * ----------------------------------------------------
         */

        if (
            (
                op & 0xCF
            ) === 0xC5
        ) {

            let value;


            switch (
                (op >> 4) & 3
            ) {

                case 0:
                    value =
                        this.getBC();
                    break;

                case 1:
                    value =
                        this.getDE();
                    break;

                case 2:
                    value =
                        this.getHL();
                    break;

                default:
                    value =
                        this.getAF();
                    break;

            }


            this.push16(
                value
            );


            return 16;

        }


        /*
         * ----------------------------------------------------
         * ADD A,d8
         * ----------------------------------------------------
         */

        if (
            op === 0xC6
        ) {

            this.add8(
                this.fetch8()
            );

            return 8;

        }


        /*
         * ----------------------------------------------------
         * RST
         * ----------------------------------------------------
         */

        if (
            (
                op & 0xC7
            ) === 0xC7
        ) {

            const vector =
                op & 0x38;


            this.push16(
                this.pc
            );


            this.pc =
                vector;


            return 16;

        }


        /*
         * ----------------------------------------------------
         * RET
         * ----------------------------------------------------
         */

        if (
            op === 0xC9
        ) {

            this.pc =
                this.pop16();

            return 16;

        }


        /*
         * ----------------------------------------------------
         * JP HL
         * ----------------------------------------------------
         */

        if (
            op === 0xE9
        ) {

            this.pc =
                this.getHL();

            return 4;

        }


        /*
         * ----------------------------------------------------
         * LDH (a8),A
         * ----------------------------------------------------
         */

        if (
            op === 0xE0
        ) {

            this.writeByte(
                0xFF00 +
                this.fetch8(),
                this.a
            );


            return 12;

        }


        /*
         * ----------------------------------------------------
         * LDH A,(a8)
         * ----------------------------------------------------
         */

        if (
            op === 0xF0
        ) {

            this.a =
                this.readByte(
                    0xFF00 +
                    this.fetch8()
                );


            return 12;

        }


        /*
         * ----------------------------------------------------
         * LD (C),A
         * ----------------------------------------------------
         */

        if (
            op === 0xE2
        ) {

            this.writeByte(
                0xFF00 +
                this.c,
                this.a
            );


            return 8;

        }


        /*
         * ----------------------------------------------------
         * LD A,(C)
         * ----------------------------------------------------
         */

        if (
            op === 0xF2
        ) {

            this.a =
                this.readByte(
                    0xFF00 +
                    this.c
                );


            return 8;

        }


        /*
         * ----------------------------------------------------
         * LD (a16),A
         * ----------------------------------------------------
         */

        if (
            op === 0xEA
        ) {

            this.writeByte(
                this.fetch16(),
                this.a
            );


            return 16;

        }


        /*
         * ----------------------------------------------------
         * LD A,(a16)
         * ----------------------------------------------------
         */

        if (
            op === 0xFA
        ) {

            this.a =
                this.readByte(
                    this.fetch16()
                );


            return 16;

        }


        /*
         * ----------------------------------------------------
         * XOR A
         * ----------------------------------------------------
         */

        if (
            op === 0xAF
        ) {

            this.a =
                0;

            this.f =
                0x80;

            return 4;

        }


        /*
         * ----------------------------------------------------
         * OR / AND / XOR immediate
         * ----------------------------------------------------
         */

        if (
            op === 0xE6
        ) {

            this.a &=
                this.fetch8();


            this.f =
                this.a === 0
                    ? 0xA0
                    : 0x20;


            return 8;

        }


        if (
            op === 0xEE
        ) {

            this.a ^=
                this.fetch8();


            this.f =
                this.a === 0
                    ? 0x80
                    : 0;


            return 8;

        }


        if (
            op === 0xF6
        ) {

            this.a |=
                this.fetch8();


            this.f =
                this.a === 0
                    ? 0x80
                    : 0;


            return 8;

        }


        if (
            op === 0xFE
        ) {

            this.cp(
                this.fetch8()
            );


            return 8;

        }


        /*
         * ----------------------------------------------------
         * DI
         * ----------------------------------------------------
         */

        if (
            op === 0xF3
        ) {

            this.ime =
                false;

            this.imeDelay =
                0;

            return 4;

        }


        /*
         * ----------------------------------------------------
         * EI
         * ----------------------------------------------------
         */

        if (
            op === 0xFB
        ) {

            /*
             * EI becomes active after the following
             * instruction.
             */

            this.imeDelay =
                2;

            return 4;

        }


        /*
         * ----------------------------------------------------
         * RETI
         * ----------------------------------------------------
         */

        if (
            op === 0xD9
        ) {

            this.pc =
                this.pop16();

            this.ime =
                true;

            this.imeDelay =
                0;

            return 16;

        }


        /*
         * ----------------------------------------------------
         * CALL a16
         * ----------------------------------------------------
         */

        if (
            op === 0xCD
        ) {

            const address =
                this.fetch16();


            this.push16(
                this.pc
            );


            this.pc =
                address;


            return 24;

        }


        /*
         * ----------------------------------------------------
         * RETI / RET handled above
         * ----------------------------------------------------
         */


        /*
         * ----------------------------------------------------
         * Remaining immediate arithmetic
         * ----------------------------------------------------
         */

        if (
            op === 0xCE
        ) {

            this.add8(
                this.fetch8(),
                true
            );

            return 8;

        }


        if (
            op === 0xD6
        ) {

            this.sub8(
                this.fetch8()
            );

            return 8;

        }


        if (
            op === 0xDE
        ) {

            this.sub8(
                this.fetch8(),
                true
            );

            return 8;

        }


        /*
         * ----------------------------------------------------
         * LD SP,d16
         * ----------------------------------------------------
         */

        if (
            op === 0x31
        ) {

            this.sp =
                this.fetch16();

            return 12;

        }


        /*
         * ----------------------------------------------------
         * LD HL,SP+r8
         * ----------------------------------------------------
         */

        if (
            op === 0xF8
        ) {

            const value =
                this.sign8(
                    this.fetch8()
                );


            const sp =
                this.sp;


            const result =
                (
                    sp +
                    value
                ) & 0xFFFF;


            this.f =
                0;


            this.setFlag(
                0x20,
                (
                    (sp & 0x0F) +
                    (value & 0x0F)
                ) > 0x0F
            );


            this.setFlag(
                0x10,
                (
                    (sp & 0xFF) +
                    (value & 0xFF)
                ) > 0xFF
            );


            this.setHL(
                result
            );


            return 12;

        }


        /*
         * ----------------------------------------------------
         * ADD SP,r8
         * ----------------------------------------------------
         */

        if (
            op === 0xE8
        ) {

            const value =
                this.sign8(
                    this.fetch8()
                );


            const sp =
                this.sp;


            this.f =
                0;


            this.setFlag(
                0x20,
                (
                    (sp & 0x0F) +
                    (value & 0x0F)
                ) > 0x0F
            );


            this.setFlag(
                0x10,
                (
                    (sp & 0xFF) +
                    (value & 0xFF)
                ) > 0xFF
            );


            this.sp =
                (
                    sp +
                    value
                ) & 0xFFFF;


            return 16;

        }


        /*
         * ----------------------------------------------------
         * LD (a16),SP
         * ----------------------------------------------------
         */

        if (
            op === 0x08
        ) {

            const address =
                this.fetch16();


            this.writeByte(
                address,
                this.sp & 0xFF
            );


            this.writeByte(
                address + 1,
                this.sp >> 8
            );


            return 20;

        }


        /*
         * ----------------------------------------------------
         * PREFIX / illegal opcodes
         * ----------------------------------------------------
         *
         * The LR35902 has several unused opcodes.
         *
         * Treating them as NOP-like behavior is preferable
         * during development to crashing the whole emulator.
         *
         */

        return 4;

    }


    /*
     * ========================================================
     * CB OPCODES
     * ========================================================
     */

    executeCB(
        op
    ) {

        const r =
            op & 7;


        const group =
            op >> 6;


        const bit =
            (
                op >> 3
            ) & 7;


        let value =
            this.readReg8(r);


        /*
         * ----------------------------------------------------
         * Rotate / shift
         * ----------------------------------------------------
         */

        if (
            group === 0
        ) {

            switch (
                bit
            ) {

                case 0:
                    value =
                        this.rlc(value);
                    break;

                case 1:
                    value =
                        this.rrc(value);
                    break;

                case 2:
                    value =
                        this.rl(value);
                    break;

                case 3:
                    value =
                        this.rr(value);
                    break;

                case 4:
                    value =
                        this.sla(value);
                    break;

                case 5:
                    value =
                        this.sra(value);
                    break;

                case 6:
                    value =
                        this.swap(value);
                    break;

                case 7:
                    value =
                        this.srl(value);
                    break;

            }


            this.writeReg8(
                r,
                value
            );


            return r === 6
                ? 16
                : 8;

        }


        /*
         * ----------------------------------------------------
         * BIT
         * ----------------------------------------------------
         */

        if (
            group === 1
        ) {

            this.bit(
                bit,
                value
            );


            return r === 6
                ? 12
                : 8;

        }


        /*
         * ----------------------------------------------------
         * RES
         * ----------------------------------------------------
         */

        if (
            group === 2
        ) {

            value &=
                ~(
                    1 << bit
                );


            this.writeReg8(
                r,
                value
            );


            return r === 6
                ? 16
                : 8;

        }


        /*
         * ----------------------------------------------------
         * SET
         * ----------------------------------------------------
         */

        value |=
            (
                1 << bit
            );


        this.writeReg8(
            r,
            value
        );


        return r === 6
            ? 16
            : 8;

    }


    /*
     * ========================================================
     * SIGNED 8-BIT
     * ========================================================
     */

    sign8(
        value
    ) {

        value &=
            0xFF;


        return value & 0x80
            ? value - 0x100
            : value;

    }


    /*
     * ========================================================
     * DEBUG STATE
     * ========================================================
     */

    getState() {

        return {

            af:
                this.getAF(),

            bc:
                this.getBC(),

            de:
                this.getDE(),

            hl:
                this.getHL(),

            sp:
                this.sp,

            pc:
                this.pc,

            ime:
                this.ime,

            halted:
                this.halted,

            stopped:
                this.stopped,

            lastOpcode:
                this.lastOpcode,

            lastPC:
                this.lastPC,

            cycles:
                this.cycles,

            instructions:
                this.instructions

        };

    }

}
