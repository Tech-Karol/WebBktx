/*
 * ============================================================
 * WebBktx — Game Boy CPU / Sharp LR35902
 *
 * Complete DMG CPU implementation
 *
 * - 256 primary opcodes
 * - 256 CB-prefixed opcodes
 * - Correct flags
 * - Correct instruction timing
 * - HALT + HALT bug
 * - STOP
 * - EI/DI delayed IME
 * - Interrupt handling
 * - Stack operations
 * - All documented LR35902 instructions
 *
 * Undocumented/illegal opcodes:
 *   Treated as 4-cycle NOPs.
 *
 * ============================================================
 */

export default class CPU {

    constructor(memory) {
        this.memory = memory;

        /* ====================================================
         * 8-bit registers
         * ==================================================== */

        this.a = 0;
        this.f = 0;

        this.b = 0;
        this.c = 0;

        this.d = 0;
        this.e = 0;

        this.h = 0;
        this.l = 0;

        /* ====================================================
         * 16-bit registers
         * ==================================================== */

        this.sp = 0;
        this.pc = 0;

        /* ====================================================
         * CPU state
         * ==================================================== */

        this.halted = false;
        this.stopped = false;

        this.ime = false;

        /*
         * EI delay:
         *
         * EI -> delay = 2
         * end EI          -> 1
         * end next instr. -> 0, IME = true
         */
        this.imeDelay = 0;

        /*
         * HALT bug:
         *
         * The next opcode fetch does not increment PC.
         * Operand fetches afterwards behave normally.
         */
        this.haltBug = false;

        /* ====================================================
         * Statistics
         * ==================================================== */

        this.cycles = 0;
        this.instructions = 0;

        this.lastOpcode = 0;
        this.lastPC = 0;
    }

    /* ========================================================
     * RESET
     * ======================================================== */

    reset() {
        /*
         * DMG post-boot CPU state.
         */
        this.a = 0x01;
        this.f = 0xB0;

        this.b = 0x00;
        this.c = 0x13;

        this.d = 0x00;
        this.e = 0xD8;

        this.h = 0x01;
        this.l = 0x4D;

        this.sp = 0xFFFE;
        this.pc = 0x0100;

        this.halted = false;
        this.stopped = false;

        this.ime = false;
        this.imeDelay = 0;
        this.haltBug = false;

        this.cycles = 0;
        this.instructions = 0;

        this.lastOpcode = 0;
        this.lastPC = 0;
    }

    /* ========================================================
     * MEMORY
     * ======================================================== */

    readByte(address) {
        address &= 0xFFFF;

        if (!this.memory) {
            return 0xFF;
        }

        const value = this.memory.readByte(address);

        if (value === undefined || value === null) {
            return 0xFF;
        }

        return value & 0xFF;
    }

    writeByte(address, value) {
        if (!this.memory) {
            return;
        }

        this.memory.writeByte(
            address & 0xFFFF,
            value & 0xFF
        );
    }

    /*
     * Normal data/program fetch.
     *
     * HALT bug MUST NOT affect operand fetches.
     */
    fetch8() {
        const value = this.readByte(this.pc);

        this.pc = (this.pc + 1) & 0xFFFF;

        return value;
    }

    /*
     * Opcode fetch.
     *
     * During HALT bug the opcode is read without incrementing PC.
     */
    fetchOpcode() {
        const value = this.readByte(this.pc);

        if (this.haltBug) {
            this.haltBug = false;
        } else {
            this.pc = (this.pc + 1) & 0xFFFF;
        }

        return value;
    }

    fetch16() {
        const lo = this.fetch8();
        const hi = this.fetch8();

        return lo | (hi << 8);
    }

    /* ========================================================
     * 8-BIT REGISTERS
     * ======================================================== */

    readReg8(index) {
        switch (index & 7) {
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
                return this.readByte(this.getHL());

            case 7:
                return this.a;
        }

        return 0xFF;
    }

    writeReg8(index, value) {
        value &= 0xFF;

        switch (index & 7) {
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
                this.writeByte(this.getHL(), value);
                break;

            case 7:
                this.a = value;
                break;
        }
    }

    /* ========================================================
     * 16-BIT REGISTERS
     * ======================================================== */

    getAF() {
        return ((this.a << 8) | (this.f & 0xF0)) & 0xFFFF;
    }

    setAF(value) {
        value &= 0xFFFF;

        this.a = (value >> 8) & 0xFF;

        /*
         * Lower four F bits are always zero.
         */
        this.f = value & 0xF0;
    }

    getBC() {
        return ((this.b << 8) | this.c) & 0xFFFF;
    }

    setBC(value) {
        value &= 0xFFFF;

        this.b = (value >> 8) & 0xFF;
        this.c = value & 0xFF;
    }

    getDE() {
        return ((this.d << 8) | this.e) & 0xFFFF;
    }

    setDE(value) {
        value &= 0xFFFF;

        this.d = (value >> 8) & 0xFF;
        this.e = value & 0xFF;
    }

    getHL() {
        return ((this.h << 8) | this.l) & 0xFFFF;
    }

    setHL(value) {
        value &= 0xFFFF;

        this.h = (value >> 8) & 0xFF;
        this.l = value & 0xFF;
    }

    /* ========================================================
     * FLAGS
     *
     * Z = 0x80
     * N = 0x40
     * H = 0x20
     * C = 0x10
     * ======================================================== */

    getZ() {
        return (this.f & 0x80) !== 0;
    }

    getN() {
        return (this.f & 0x40) !== 0;
    }

    getH() {
        return (this.f & 0x20) !== 0;
    }

    getC() {
        return (this.f & 0x10) !== 0;
    }

    setFlags(z, n, h, c) {
        this.f =
            (z ? 0x80 : 0) |
            (n ? 0x40 : 0) |
            (h ? 0x20 : 0) |
            (c ? 0x10 : 0);
    }

    /* ========================================================
     * STACK
     * ======================================================== */

    push16(value) {
        value &= 0xFFFF;

        /*
         * Game Boy stack:
         *
         * SP-- -> high
         * SP-- -> low
         */

        this.sp = (this.sp - 1) & 0xFFFF;
        this.writeByte(
            this.sp,
            (value >> 8) & 0xFF
        );

        this.sp = (this.sp - 1) & 0xFFFF;
        this.writeByte(
            this.sp,
            value & 0xFF
        );
    }

    pop16() {
        const lo = this.readByte(this.sp);

        this.sp = (this.sp + 1) & 0xFFFF;

        const hi = this.readByte(this.sp);

        this.sp = (this.sp + 1) & 0xFFFF;

        return lo | (hi << 8);
    }

    /* ========================================================
     * SIGNED 8-BIT
     * ======================================================== */

    sign8(value) {
        value &= 0xFF;

        return (value & 0x80)
            ? value - 0x100
            : value;
    }

    /* ========================================================
     * CONDITIONS
     * ======================================================== */

    condition(code) {
        switch (code & 3) {
            case 0:
                return !this.getZ(); // NZ

            case 1:
                return this.getZ();  // Z

            case 2:
                return !this.getC(); // NC

            case 3:
                return this.getC();  // C
        }

        return false;
    }

    /* ========================================================
     * 8-BIT ALU
     * ======================================================== */

    add8(value, withCarry = false) {
        value &= 0xFF;

        const carry =
            withCarry && this.getC()
                ? 1
                : 0;

        const a = this.a;

        const result =
            a + value + carry;

        const output =
            result & 0xFF;

        this.a = output;

        this.setFlags(
            output === 0,
            false,
            ((a & 0x0F) +
                (value & 0x0F) +
                carry) > 0x0F,
            result > 0xFF
        );
    }

    sub8(value, withCarry = false) {
        value &= 0xFF;

        const carry =
            withCarry && this.getC()
                ? 1
                : 0;

        const a = this.a;

        const result =
            a - value - carry;

        const output =
            result & 0xFF;

        this.a = output;

        this.setFlags(
            output === 0,
            true,
            (a & 0x0F) <
                ((value & 0x0F) + carry),
            result < 0
        );
    }

    cp(value) {
        value &= 0xFF;

        const a = this.a;
        const result = a - value;

        this.setFlags(
            (result & 0xFF) === 0,
            true,
            (a & 0x0F) < (value & 0x0F),
            a < value
        );
    }

    inc8(value) {
        value &= 0xFF;

        const result =
            (value + 1) & 0xFF;

        /*
         * INC does not modify Carry.
         */
        this.f =
            (result === 0 ? 0x80 : 0) |
            (this.f & 0x10) |
            (
                ((value & 0x0F) + 1) > 0x0F
                    ? 0x20
                    : 0
            );

        return result;
    }

    dec8(value) {
        value &= 0xFF;

        const result =
            (value - 1) & 0xFF;

        /*
         * DEC does not modify Carry.
         */
        this.f =
            (result === 0 ? 0x80 : 0) |
            0x40 |
            (
                (value & 0x0F) === 0
                    ? 0x20
                    : 0
            ) |
            (this.f & 0x10);

        return result;
    }

    and8(value) {
        this.a =
            this.a & (value & 0xFF);

        this.a &= 0xFF;

        this.f =
            (this.a === 0 ? 0x80 : 0) |
            0x20;
    }

    xor8(value) {
        this.a =
            (this.a ^ (value & 0xFF)) & 0xFF;

        this.f =
            this.a === 0
                ? 0x80
                : 0;
    }

    or8(value) {
        this.a =
            (this.a | (value & 0xFF)) & 0xFF;

        this.f =
            this.a === 0
                ? 0x80
                : 0;
    }

    /* ========================================================
     * 16-BIT ALU
     * ======================================================== */

    addHL(value) {
        value &= 0xFFFF;

        const hl = this.getHL();
        const result = hl + value;

        this.f =
            (this.f & 0x80) |
            (
                ((hl & 0x0FFF) +
                    (value & 0x0FFF)) > 0x0FFF
                    ? 0x20
                    : 0
            ) |
            (
                result > 0xFFFF
                    ? 0x10
                    : 0
            );

        this.setHL(result);
    }

    /* ========================================================
     * DAA
     * ======================================================== */

    daa() {
        let a = this.a;
        let correction = 0;
        let carry = this.getC();

        if (!this.getN()) {

            if (
                this.getH() ||
                (a & 0x0F) > 9
            ) {
                correction |= 0x06;
            }

            if (
                carry ||
                a > 0x99
            ) {
                correction |= 0x60;
                carry = true;
            }

            a =
                (a + correction) & 0xFF;

        } else {

            if (this.getH()) {
                correction |= 0x06;
            }

            if (carry) {
                correction |= 0x60;
            }

            a =
                (a - correction) & 0xFF;
        }

        this.a = a;

        this.f =
            (a === 0 ? 0x80 : 0) |
            (this.f & 0x40) |
            (carry ? 0x10 : 0);
    }

    /* ========================================================
     * ROTATES / SHIFTS
     * ======================================================== */

    rlc(value) {
        value &= 0xFF;

        const carry =
            (value & 0x80) !== 0;

        const result =
            ((value << 1) |
                (carry ? 1 : 0)) & 0xFF;

        this.setFlags(
            result === 0,
            false,
            false,
            carry
        );

        return result;
    }

    rrc(value) {
        value &= 0xFF;

        const carry =
            (value & 0x01) !== 0;

        const result =
            ((value >> 1) |
                (carry ? 0x80 : 0)) & 0xFF;

        this.setFlags(
            result === 0,
            false,
            false,
            carry
        );

        return result;
    }

    rl(value) {
        value &= 0xFF;

        const oldCarry =
            this.getC();

        const carry =
            (value & 0x80) !== 0;

        const result =
            ((value << 1) |
                (oldCarry ? 1 : 0)) & 0xFF;

        this.setFlags(
            result === 0,
            false,
            false,
            carry
        );

        return result;
    }

    rr(value) {
        value &= 0xFF;

        const oldCarry =
            this.getC();

        const carry =
            (value & 0x01) !== 0;

        const result =
            ((value >> 1) |
                (oldCarry ? 0x80 : 0)) & 0xFF;

        this.setFlags(
            result === 0,
            false,
            false,
            carry
        );

        return result;
    }

    sla(value) {
        value &= 0xFF;

        const carry =
            (value & 0x80) !== 0;

        const result =
            (value << 1) & 0xFF;

        this.setFlags(
            result === 0,
            false,
            false,
            carry
        );

        return result;
    }

    sra(value) {
        value &= 0xFF;

        const carry =
            (value & 0x01) !== 0;

        const result =
            ((value >> 1) |
                (value & 0x80)) & 0xFF;

        this.setFlags(
            result === 0,
            false,
            false,
            carry
        );

        return result;
    }

    srl(value) {
        value &= 0xFF;

        const carry =
            (value & 0x01) !== 0;

        const result =
            (value >> 1) & 0xFF;

        this.setFlags(
            result === 0,
            false,
            false,
            carry
        );

        return result;
    }

    swap(value) {
        value &= 0xFF;

        const result =
            ((value >> 4) |
                (value << 4)) & 0xFF;

        this.setFlags(
            result === 0,
            false,
            false,
            false
        );

        return result;
    }

    /* ========================================================
     * CB PREFIX
     * ======================================================== */

    executeCB(op) {
        op &= 0xFF;

        const r =
            op & 0x07;

        const bit =
            (op >> 3) & 0x07;

        const group =
            op >> 6;

        let value =
            this.readReg8(r);

        /* ----------------------------------------------------
         * 00-3F
         *
         * Rotates / shifts / SWAP
         * ---------------------------------------------------- */

        if (group === 0) {

            switch (bit) {

                case 0:
                    value = this.rlc(value);
                    break;

                case 1:
                    value = this.rrc(value);
                    break;

                case 2:
                    value = this.rl(value);
                    break;

                case 3:
                    value = this.rr(value);
                    break;

                case 4:
                    value = this.sla(value);
                    break;

                case 5:
                    value = this.sra(value);
                    break;

                case 6:
                    value = this.swap(value);
                    break;

                case 7:
                    value = this.srl(value);
                    break;
            }

            this.writeReg8(r, value);

            return r === 6
                ? 16
                : 8;
        }

        /* ----------------------------------------------------
         * 40-7F
         *
         * BIT b,r
         *
         * Z = inverse of selected bit
         * N = 0
         * H = 1
         * C preserved
         * ---------------------------------------------------- */

        if (group === 1) {

            const mask =
                1 << bit;

            const carry =
                this.f & 0x10;

            this.f =
                (value & mask ? 0 : 0x80) |
                0x20 |
                carry;

            return r === 6
                ? 12
                : 8;
        }

        /* ----------------------------------------------------
         * 80-BF
         *
         * RES b,r
         * ---------------------------------------------------- */

        if (group === 2) {

            value =
                value & ~(1 << bit);

            this.writeReg8(r, value);

            return r === 6
                ? 16
                : 8;
        }

        /* ----------------------------------------------------
         * C0-FF
         *
         * SET b,r
         * ---------------------------------------------------- */

        value =
            value | (1 << bit);

        this.writeReg8(r, value);

        return r === 6
            ? 16
            : 8;
    }

    /* ========================================================
     * INTERRUPTS
     * ======================================================== */

    getInterruptEnable() {
        if (
            this.memory &&
            this.memory.interruptEnable !== undefined
        ) {
            return this.memory.interruptEnable & 0x1F;
        }

        return this.readByte(0xFFFF) & 0x1F;
    }

    getInterruptFlags() {
        if (
            this.memory &&
            this.memory.interruptFlags !== undefined
        ) {
            return this.memory.interruptFlags & 0x1F;
        }

        return this.readByte(0xFF0F) & 0x1F;
    }

    getPendingInterrupts() {
        return (
            this.getInterruptEnable() &
            this.getInterruptFlags() &
            0x1F
        );
    }

    clearInterrupt(bit) {
        if (
            this.memory &&
            typeof this.memory.clearInterrupt === "function"
        ) {
            this.memory.clearInterrupt(bit);
            return;
        }

        const flags =
            this.readByte(0xFF0F);

        this.writeByte(
            0xFF0F,
            flags & ~(1 << bit)
        );
    }

    serviceInterrupt(pending) {
        let bit = 0;

        while (
            bit < 5 &&
            !(pending & (1 << bit))
        ) {
            bit++;
        }

        if (bit >= 5) {
            return 0;
        }

        /*
         * Interrupt entry:
         *
         * IME = 0
         * HALT = false
         * push current PC
         * jump to vector
         *
         * 20 T-cycles
         */

        this.ime = false;
        this.imeDelay = 0;

        this.halted = false;
        this.stopped = false;
        this.haltBug = false;

        this.clearInterrupt(bit);

        this.push16(this.pc);

        const vectors = [
            0x40, // V-Blank
            0x48, // LCD STAT
            0x50, // Timer
            0x58, // Serial
            0x60  // Joypad
        ];

        this.pc =
            vectors[bit];

        return 20;
    }

    /* ========================================================
     * EI DELAY
     * ======================================================== */

    updateIMEDelay() {
        if (this.imeDelay <= 0) {
            return;
        }

        this.imeDelay--;

        if (this.imeDelay === 0) {
            this.ime = true;
        }
    }

    /* ========================================================
     * STEP
     * ======================================================== */

    step() {

        /* ----------------------------------------------------
         * STOP
         * ---------------------------------------------------- */

        if (this.stopped) {

            /*
             * An interrupt request wakes STOP.
             *
             * Whether the interrupt is actually serviced
             * still depends on IME.
             */
            const pending =
                this.getPendingInterrupts();

            if (pending) {
                this.stopped = false;
            } else {
                this.cycles += 4;
                return 4;
            }
        }

        /* ----------------------------------------------------
         * HALT
         * ---------------------------------------------------- */

        if (this.halted) {

            const pending =
                this.getPendingInterrupts();

            if (pending) {
                /*
                 * Any pending interrupt wakes HALT.
                 *
                 * If IME is enabled, the interrupt is serviced
                 * below during this same step.
                 */
                this.halted = false;
            } else {
                this.cycles += 4;
                return 4;
            }
        }

        /* ----------------------------------------------------
         * INTERRUPT SERVICE
         * ---------------------------------------------------- */

        const pending =
            this.getPendingInterrupts();

        if (this.ime && pending) {

            const cycles =
                this.serviceInterrupt(pending);

            this.cycles += cycles;

            return cycles;
        }

        /* ----------------------------------------------------
         * FETCH OPCODE
         * ---------------------------------------------------- */

        this.lastPC =
            this.pc;

        const opcode =
            this.fetchOpcode();

        this.lastOpcode =
            opcode;

        this.instructions++;

        let cycles;

        /* ----------------------------------------------------
         * CB PREFIX
         * ---------------------------------------------------- */

        if (opcode === 0xCB) {

            const cbOpcode =
                this.fetch8();

            cycles =
                this.executeCB(cbOpcode);

        } else {

            cycles =
                this.executeOpcode(opcode);
        }

        /*
         * EI delay is updated after the instruction.
         */
        this.updateIMEDelay();

        /*
         * F lower nibble is always zero.
         */
        this.f &= 0xF0;

        this.cycles += cycles;

        return cycles;
    }

    /* ========================================================
     * OPCODE DECODER
     * ======================================================== */

    executeOpcode(op) {
        op &= 0xFF;

        /* ====================================================
         * 00-3F
         *
         * Structured opcode groups.
         * ==================================================== */

        /* ----------------------------------------------------
         * 00 NOP
         * ---------------------------------------------------- */

        if (op === 0x00) {
            return 4;
        }

        /* ----------------------------------------------------
         * 01 / 11 / 21 / 31
         *
         * LD rr,d16
         * ---------------------------------------------------- */

        if ((op & 0x0F) === 0x01) {

            const value =
                this.fetch16();

            switch ((op >> 4) & 3) {

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
                    this.sp = value;
                    break;
            }

            return 12;
        }

        /* ----------------------------------------------------
         * 02 LD (BC),A
         * 12 LD (DE),A
         * ---------------------------------------------------- */

        if (op === 0x02) {
            this.writeByte(
                this.getBC(),
                this.a
            );

            return 8;
        }

        if (op === 0x12) {
            this.writeByte(
                this.getDE(),
                this.a
            );

            return 8;
        }

        /* ----------------------------------------------------
         * 03 / 13 / 23 / 33
         *
         * INC rr
         * ---------------------------------------------------- */

        if ((op & 0x0F) === 0x03) {

            switch ((op >> 4) & 3) {

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
                        (this.sp + 1) & 0xFFFF;
                    break;
            }

            return 8;
        }

        /* ----------------------------------------------------
         * 04 / 0C / 14 / 1C / 24 / 2C / 34 / 3C
         *
         * INC r
         * ---------------------------------------------------- */

        if (
            (op & 0x07) === 0x04 &&
            op < 0x40
        ) {

            const r =
                (op >> 3) & 7;

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

        /* ----------------------------------------------------
         * 05 / 0D / 15 / 1D / 25 / 2D / 35 / 3D
         *
         * DEC r
         * ---------------------------------------------------- */

        if (
            (op & 0x07) === 0x05 &&
            op < 0x40
        ) {

            const r =
                (op >> 3) & 7;

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

        /* ----------------------------------------------------
         * 06 / 0E / ... / 3E
         *
         * LD r,d8
         * ---------------------------------------------------- */

        if (
            (op & 0x07) === 0x06 &&
            op < 0x40
        ) {

            const r =
                (op >> 3) & 7;

            this.writeReg8(
                r,
                this.fetch8()
            );

            return r === 6
                ? 12
                : 8;
        }

        /* ----------------------------------------------------
         * 07 RLCA
         * ---------------------------------------------------- */

        if (op === 0x07) {

            const carry =
                (this.a & 0x80) !== 0;

            this.a =
                ((this.a << 1) |
                    (carry ? 1 : 0)) & 0xFF;

            this.f =
                carry ? 0x10 : 0;

            return 4;
        }

        /* ----------------------------------------------------
         * 08 LD (a16),SP
         * ---------------------------------------------------- */

        if (op === 0x08) {

            const address =
                this.fetch16();

            this.writeByte(
                address,
                this.sp & 0xFF
            );

            this.writeByte(
                (address + 1) & 0xFFFF,
                (this.sp >> 8) & 0xFF
            );

            return 20;
        }

        /* ----------------------------------------------------
         * 09 / 19 / 29 / 39
         *
         * ADD HL,rr
         * ---------------------------------------------------- */

        if ((op & 0x0F) === 0x09) {

            let value;

            switch ((op >> 4) & 3) {

                case 0:
                    value = this.getBC();
                    break;

                case 1:
                    value = this.getDE();
                    break;

                case 2:
                    value = this.getHL();
                    break;

                default:
                    value = this.sp;
                    break;
            }

            this.addHL(value);

            return 8;
        }

        /* ----------------------------------------------------
         * 0A LD A,(BC)
         * 1A LD A,(DE)
         * ---------------------------------------------------- */

        if (op === 0x0A) {

            this.a =
                this.readByte(
                    this.getBC()
                );

            return 8;
        }

        if (op === 0x1A) {

            this.a =
                this.readByte(
                    this.getDE()
                );

            return 8;
        }

        /* ----------------------------------------------------
         * 0B / 1B / 2B / 3B
         *
         * DEC rr
         * ---------------------------------------------------- */

        if ((op & 0x0F) === 0x0B) {

            switch ((op >> 4) & 3) {

                case 0:
                    this.setBC(
                        this.getBC() - 1
                    );
                    break;

                case 1:
                    this.setDE(
                        this.getDE() - 1
                    );
                    break;

                case 2:
                    this.setHL(
                        this.getHL() - 1
                    );
                    break;

                case 3:
                    this.sp =
                        (this.sp - 1) & 0xFFFF;
                    break;
            }

            return 8;
        }

        /* ----------------------------------------------------
         * 0F RRCA
         * ---------------------------------------------------- */

        if (op === 0x0F) {

            const carry =
                (this.a & 1) !== 0;

            this.a =
                ((this.a >> 1) |
                    (carry ? 0x80 : 0)) & 0xFF;

            this.f =
                carry ? 0x10 : 0;

            return 4;
        }

        /* ----------------------------------------------------
         * 10 STOP
         * ---------------------------------------------------- */

        if (op === 0x10) {

            /*
             * STOP has a second byte on DMG.
             */
            this.fetch8();

            this.stopped = true;
            this.halted = false;

            return 4;
        }

        /* ----------------------------------------------------
         * 17 RLA
         * ---------------------------------------------------- */

        if (op === 0x17) {

            const oldCarry =
                this.getC();

            const newCarry =
                (this.a & 0x80) !== 0;

            this.a =
                ((this.a << 1) |
                    (oldCarry ? 1 : 0)) & 0xFF;

            this.f =
                newCarry ? 0x10 : 0;

            return 4;
        }

        /* ----------------------------------------------------
         * 18 JR r8
         * ---------------------------------------------------- */

        if (op === 0x18) {

            const offset =
                this.sign8(
                    this.fetch8()
                );

            this.pc =
                (this.pc + offset) & 0xFFFF;

            return 12;
        }

        /* ----------------------------------------------------
         * 20 / 28 / 30 / 38
         *
         * JR cc,r8
         * ---------------------------------------------------- */

        if (
            op === 0x20 ||
            op === 0x28 ||
            op === 0x30 ||
            op === 0x38
        ) {

            const offset =
                this.sign8(
                    this.fetch8()
                );

            if (
                this.condition(
                    (op >> 3) & 3
                )
            ) {

                this.pc =
                    (this.pc + offset) & 0xFFFF;

                return 12;
            }

            return 8;
        }

        /* ----------------------------------------------------
         * 1F RRA
         * ---------------------------------------------------- */

        if (op === 0x1F) {

            const oldCarry =
                this.getC();

            const newCarry =
                (this.a & 1) !== 0;

            this.a =
                ((this.a >> 1) |
                    (oldCarry ? 0x80 : 0)) & 0xFF;

            this.f =
                newCarry ? 0x10 : 0;

            return 4;
        }

        /* ----------------------------------------------------
         * 22 LD (HL+),A
         * ---------------------------------------------------- */

        if (op === 0x22) {

            const hl =
                this.getHL();

            this.writeByte(
                hl,
                this.a
            );

            this.setHL(
                hl + 1
            );

            return 8;
        }

        /* ----------------------------------------------------
         * 27 DAA
         * ---------------------------------------------------- */

        if (op === 0x27) {

            this.daa();

            return 4;
        }

        /* ----------------------------------------------------
         * 2A LD A,(HL+)
         * ---------------------------------------------------- */

        if (op === 0x2A) {

            const hl =
                this.getHL();

            this.a =
                this.readByte(hl);

            this.setHL(
                hl + 1
            );

            return 8;
        }

        /* ----------------------------------------------------
         * 2F CPL
         * ---------------------------------------------------- */

        if (op === 0x2F) {

            this.a =
                this.a ^ 0xFF;

            /*
             * Z preserved
             * N = 1
             * H = 1
             * C preserved
             */
            this.f =
                (this.f & 0x90) |
                0x60;

            return 4;
        }

        /* ----------------------------------------------------
         * 32 LD (HL-),A
         * ---------------------------------------------------- */

        if (op === 0x32) {

            const hl =
                this.getHL();

            this.writeByte(
                hl,
                this.a
            );

            this.setHL(
                hl - 1
            );

            return 8;
        }

        /* ----------------------------------------------------
         * 3A LD A,(HL-)
         * ---------------------------------------------------- */

        if (op === 0x3A) {

            const hl =
                this.getHL();

            this.a =
                this.readByte(hl);

            this.setHL(
                hl - 1
            );

            return 8;
        }

        /* ----------------------------------------------------
         * 37 SCF
         * ---------------------------------------------------- */

        if (op === 0x37) {

            this.f =
                (this.f & 0x80) |
                0x10;

            return 4;
        }

        /* ----------------------------------------------------
         * 3F CCF
         * ---------------------------------------------------- */

        if (op === 0x3F) {

            this.f =
                (this.f & 0x80) |
                (this.getC()
                    ? 0
                    : 0x10);

            return 4;
        }

        /* ====================================================
         * 40-7F
         *
         * LD r,r
         * HALT
         * ==================================================== */

        if (
            op >= 0x40 &&
            op <= 0x7F
        ) {

            /* ------------------------------------------------
             * 76 HALT
             * ------------------------------------------------ */

            if (op === 0x76) {

                const pending =
                    this.getPendingInterrupts();

                /*
                 * HALT bug condition:
                 *
                 * IME = 0
                 * pending interrupt exists
                 *
                 * CPU does NOT remain halted.
                 * Instead next opcode fetch does not
                 * increment PC.
                 */
                if (
                    !this.ime &&
                    pending
                ) {

                    this.haltBug = true;
                    this.halted = false;

                } else {

                    this.halted = true;
                }

                return 4;
            }

            const dst =
                (op >> 3) & 7;

            const src =
                op & 7;

            const value =
                this.readReg8(src);

            this.writeReg8(
                dst,
                value
            );

            return (
                dst === 6 ||
                src === 6
            )
                ? 8
                : 4;
        }

        /* ====================================================
         * 80-BF
         *
         * ALU A,r
         * ==================================================== */

        if (
            op >= 0x80 &&
            op <= 0xBF
        ) {

            const group =
                (op >> 3) & 7;

            const r =
                op & 7;

            const value =
                this.readReg8(r);

            switch (group) {

                case 0:
                    /* ADD A,r */
                    this.add8(value);
                    break;

                case 1:
                    /* ADC A,r */
                    this.add8(value, true);
                    break;

                case 2:
                    /* SUB r */
                    this.sub8(value);
                    break;

                case 3:
                    /* SBC A,r */
                    this.sub8(value, true);
                    break;

                case 4:
                    /* AND r */
                    this.and8(value);
                    break;

                case 5:
                    /* XOR r */
                    this.xor8(value);
                    break;

                case 6:
                    /* OR r */
                    this.or8(value);
                    break;

                case 7:
                    /* CP r */
                    this.cp(value);
                    break;
            }

            return r === 6
                ? 8
                : 4;
        }

        /* ====================================================
         * C0-FF
         * ==================================================== */

        /* ----------------------------------------------------
         * RET cc
         *
         * C0 / C8 / D0 / D8
         * ---------------------------------------------------- */

        if (
            op === 0xC0 ||
            op === 0xC8 ||
            op === 0xD0 ||
            op === 0xD8
        ) {

            if (
                this.condition(
                    (op >> 3) & 3
                )
            ) {

                this.pc =
                    this.pop16();

                return 20;
            }

            return 8;
        }

        /* ----------------------------------------------------
         * POP BC/DE/HL/AF
         *
         * C1 / D1 / E1 / F1
         * ---------------------------------------------------- */

        if (
            op === 0xC1 ||
            op === 0xD1 ||
            op === 0xE1 ||
            op === 0xF1
        ) {

            const value =
                this.pop16();

            switch ((op >> 4) & 3) {

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

        /* ----------------------------------------------------
         * JP cc,a16
         *
         * C2 / CA / D2 / DA
         * ---------------------------------------------------- */

        if (
            op === 0xC2 ||
            op === 0xCA ||
            op === 0xD2 ||
            op === 0xDA
        ) {

            const address =
                this.fetch16();

            if (
                this.condition(
                    (op >> 3) & 3
                )
            ) {

                this.pc =
                    address;

                return 16;
            }

            return 12;
        }

        /* ----------------------------------------------------
         * JP a16
         *
         * C3
         * ---------------------------------------------------- */

        if (op === 0xC3) {

            this.pc =
                this.fetch16();

            return 16;
        }

        /* ----------------------------------------------------
         * CALL cc,a16
         *
         * C4 / CC / D4 / DC
         * ---------------------------------------------------- */

        if (
            op === 0xC4 ||
            op === 0xCC ||
            op === 0xD4 ||
            op === 0xDC
        ) {

            const address =
                this.fetch16();

            if (
                this.condition(
                    (op >> 3) & 3
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

        /* ----------------------------------------------------
         * PUSH BC/DE/HL/AF
         *
         * C5 / D5 / E5 / F5
         * ---------------------------------------------------- */

        if (
            op === 0xC5 ||
            op === 0xD5 ||
            op === 0xE5 ||
            op === 0xF5
        ) {

            let value;

            switch ((op >> 4) & 3) {

                case 0:
                    value = this.getBC();
                    break;

                case 1:
                    value = this.getDE();
                    break;

                case 2:
                    value = this.getHL();
                    break;

                default:
                    value = this.getAF();
                    break;
            }

            this.push16(value);

            return 16;
        }

        /* ----------------------------------------------------
         * ADD A,d8
         *
         * C6
         * ---------------------------------------------------- */

        if (op === 0xC6) {

            this.add8(
                this.fetch8()
            );

            return 8;
        }

        /* ----------------------------------------------------
         * RST 00
         *
         * C7
         * ---------------------------------------------------- */

        if (op === 0xC7) {

            this.push16(this.pc);
            this.pc = 0x00;

            return 16;
        }

        /* ----------------------------------------------------
         * RST 08
         *
         * CF
         * ---------------------------------------------------- */

        if (op === 0xCF) {

            this.push16(this.pc);
            this.pc = 0x08;

            return 16;
        }

        /* ----------------------------------------------------
         * RET
         *
         * C9
         * ---------------------------------------------------- */

        if (op === 0xC9) {

            this.pc =
                this.pop16();

            return 16;
        }

        /* ----------------------------------------------------
         * ADC A,d8
         *
         * CE
         * ---------------------------------------------------- */

        if (op === 0xCE) {

            this.add8(
                this.fetch8(),
                true
            );

            return 8;
        }

        /* ----------------------------------------------------
         * RST 10
         *
         * D7
         * ---------------------------------------------------- */

        if (op === 0xD7) {

            this.push16(this.pc);
            this.pc = 0x10;

            return 16;
        }

        /* ----------------------------------------------------
         * SUB d8
         *
         * D6
         * ---------------------------------------------------- */

        if (op === 0xD6) {

            this.sub8(
                this.fetch8()
            );

            return 8;
        }

        /* ----------------------------------------------------
         * RST 18
         *
         * DF
         * ---------------------------------------------------- */

        if (op === 0xDF) {

            this.push16(this.pc);
            this.pc = 0x18;

            return 16;
        }

        /* ----------------------------------------------------
         * SBC A,d8
         *
         * DE
         * ---------------------------------------------------- */

        if (op === 0xDE) {

            this.sub8(
                this.fetch8(),
                true
            );

            return 8;
        }

        /* ----------------------------------------------------
         * RETI
         *
         * D9
         * ---------------------------------------------------- */

        if (op === 0xD9) {

            this.pc =
                this.pop16();

            this.ime = true;
            this.imeDelay = 0;

            return 16;
        }

        /* ----------------------------------------------------
         * RST 20
         *
         * E7
         * ---------------------------------------------------- */

        if (op === 0xE7) {

            this.push16(this.pc);
            this.pc = 0x20;

            return 16;
        }

        /* ----------------------------------------------------
         * AND d8
         *
         * E6
         * ---------------------------------------------------- */

        if (op === 0xE6) {

            this.and8(
                this.fetch8()
            );

            return 8;
        }

        /* ----------------------------------------------------
         * JP HL
         *
         * E9
         * ---------------------------------------------------- */

        if (op === 0xE9) {

            this.pc =
                this.getHL();

            return 4;
        }

        /* ----------------------------------------------------
         * LD (C),A
         *
         * E2
         * ---------------------------------------------------- */

        if (op === 0xE2) {

            this.writeByte(
                0xFF00 | this.c,
                this.a
            );

            return 8;
        }

        /* ----------------------------------------------------
         * LDH (a8),A
         *
         * E0
         * ---------------------------------------------------- */

        if (op === 0xE0) {

            const offset =
                this.fetch8();

            this.writeByte(
                0xFF00 | offset,
                this.a
            );

            return 12;
        }

        /* ----------------------------------------------------
         * RST 28
         *
         * EF
         * ---------------------------------------------------- */

        if (op === 0xEF) {

            this.push16(this.pc);
            this.pc = 0x28;

            return 16;
        }

        /* ----------------------------------------------------
         * XOR d8
         *
         * EE
         * ---------------------------------------------------- */

        if (op === 0xEE) {

            this.xor8(
                this.fetch8()
            );

            return 8;
        }

        /* ----------------------------------------------------
         * ADD SP,r8
         *
         * E8
         * ---------------------------------------------------- */

        if (op === 0xE8) {

            const value =
                this.sign8(
                    this.fetch8()
                );

            const sp =
                this.sp;

            /*
             * For ADD SP,e8 the H/C flags are calculated
             * using the unsigned 8-bit immediate.
             */
            const u =
                value & 0xFF;

            const halfCarry =
                ((sp & 0x0F) +
                    (u & 0x0F)) > 0x0F;

            const carry =
                ((sp & 0xFF) +
                    u) > 0xFF;

            this.f =
                (halfCarry ? 0x20 : 0) |
                (carry ? 0x10 : 0);

            this.sp =
                (sp + value) & 0xFFFF;

            return 16;
        }

        /* ----------------------------------------------------
         * RST 30
         *
         * F7
         * ---------------------------------------------------- */

        if (op === 0xF7) {

            this.push16(this.pc);
            this.pc = 0x30;

            return 16;
        }

        /* ----------------------------------------------------
         * OR d8
         *
         * F6
         * ---------------------------------------------------- */

        if (op === 0xF6) {

            this.or8(
                this.fetch8()
            );

            return 8;
        }

        /* ----------------------------------------------------
         * LD A,(C)
         *
         * F2
         * ---------------------------------------------------- */

        if (op === 0xF2) {

            this.a =
                this.readByte(
                    0xFF00 | this.c
                );

            return 8;
        }

        /* ----------------------------------------------------
         * LDH A,(a8)
         *
         * F0
         * ---------------------------------------------------- */

        if (op === 0xF0) {

            const offset =
                this.fetch8();

            this.a =
                this.readByte(
                    0xFF00 | offset
                );

            return 12;
        }

        /* ----------------------------------------------------
         * DI
         *
         * F3
         * ---------------------------------------------------- */

        if (op === 0xF3) {

            this.ime = false;

            /*
             * DI cancels a pending EI delay.
             */
            this.imeDelay = 0;

            return 4;
        }

        /* ----------------------------------------------------
         * LD HL,SP+r8
         *
         * F8
         * ---------------------------------------------------- */

        if (op === 0xF8) {

            const value =
                this.sign8(
                    this.fetch8()
                );

            const sp =
                this.sp;

            const u =
                value & 0xFF;

            const halfCarry =
                ((sp & 0x0F) +
                    (u & 0x0F)) > 0x0F;

            const carry =
                ((sp & 0xFF) +
                    u) > 0xFF;

            const result =
                (sp + value) & 0xFFFF;

            this.f =
                (halfCarry ? 0x20 : 0) |
                (carry ? 0x10 : 0);

            this.setHL(result);

            return 12;
        }

        /* ----------------------------------------------------
         * LD SP,HL
         *
         * F9
         * ---------------------------------------------------- */

        if (op === 0xF9) {

            this.sp =
                this.getHL();

            return 8;
        }

        /* ----------------------------------------------------
         * EI
         *
         * FB
         * ---------------------------------------------------- */

        if (op === 0xFB) {

            /*
             * Do not enable IME immediately.
             *
             * The following instruction executes before
             * IME becomes active.
             */
            this.imeDelay = 2;

            return 4;
        }

        /* ----------------------------------------------------
         * CP d8
         *
         * FE
         * ---------------------------------------------------- */

        if (op === 0xFE) {

            this.cp(
                this.fetch8()
            );

            return 8;
        }

        /* ----------------------------------------------------
         * RST 38
         *
         * FF
         * ---------------------------------------------------- */

        if (op === 0xFF) {

            this.push16(this.pc);
            this.pc = 0x38;

            return 16;
        }

        /* ====================================================
         * CALL a16
         *
         * CD
         * ==================================================== */

        if (op === 0xCD) {

            const address =
                this.fetch16();

            this.push16(
                this.pc
            );

            this.pc =
                address;

            return 24;
        }

        /* ====================================================
         * LD (a16),A
         *
         * EA
         * ==================================================== */

        if (op === 0xEA) {

            const address =
                this.fetch16();

            this.writeByte(
                address,
                this.a
            );

            return 16;
        }

        /* ====================================================
         * LD A,(a16)
         *
         * FA
         * ==================================================== */

        if (op === 0xFA) {

            const address =
                this.fetch16();

            this.a =
                this.readByte(address);

            return 16;
        }

        /* ====================================================
         * LD A,d8
         *
         * 3E
         * ==================================================== */

        if (op === 0x3E) {

            this.a =
                this.fetch8();

            return 8;
        }

        /* ====================================================
         * XOR A
         *
         * AF
         * ==================================================== */

        if (op === 0xAF) {

            this.a = 0;
            this.f = 0x80;

            return 4;
        }

        /* ====================================================
         * LD SP,d16
         *
         * 31
         * ==================================================== */

        if (op === 0x31) {

            this.sp =
                this.fetch16();

            return 12;
        }

        /* ====================================================
         * RST instructions not covered above
         *
         * Generic RST pattern:
         *
         * C7, CF, D7, DF, E7, EF, F7, FF
         *
         * All should already be handled, but keeping this
         * generic path makes the decoder robust.
         * ==================================================== */

        if (
            (op & 0xC7) === 0xC7
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

        /* ====================================================
         * Generic immediate ALU instructions
         *
         * These are kept here as a safety net.
         * ==================================================== */

        if (
            op === 0xC6 ||
            op === 0xCE ||
            op === 0xD6 ||
            op === 0xDE ||
            op === 0xE6 ||
            op === 0xEE ||
            op === 0xF6 ||
            op === 0xFE
        ) {

            const value =
                this.fetch8();

            switch (op) {

                case 0xC6:
                    this.add8(value);
                    break;

                case 0xCE:
                    this.add8(value, true);
                    break;

                case 0xD6:
                    this.sub8(value);
                    break;

                case 0xDE:
                    this.sub8(value, true);
                    break;

                case 0xE6:
                    this.and8(value);
                    break;

                case 0xEE:
                    this.xor8(value);
                    break;

                case 0xF6:
                    this.or8(value);
                    break;

                case 0xFE:
                    this.cp(value);
                    break;
            }

            return 8;
        }

        /* ====================================================
         * Unknown / illegal opcode
         *
         * LR35902 has 11 unused opcodes:
         *
         * D3 DB DD E3 E4 EB EC ED F4 FC FD
         *
         * They are treated as 4-cycle NOPs for emulator
         * development rather than crashing the CPU.
         * ==================================================== */

        return 4;
    }

    /* ========================================================
     * DEBUG / STATE
     * ======================================================== */

    getState() {
        return {
            af: this.getAF(),
            bc: this.getBC(),
            de: this.getDE(),
            hl: this.getHL(),

            sp: this.sp,
            pc: this.pc,

            a: this.a,
            f: this.f,

            b: this.b,
            c: this.c,

            d: this.d,
            e: this.e,

            h: this.h,
            l: this.l,

            ime: this.ime,
            imeDelay: this.imeDelay,

            halted: this.halted,
            stopped: this.stopped,
            haltBug: this.haltBug,

            lastOpcode: this.lastOpcode,
            lastPC: this.lastPC,

            cycles: this.cycles,
            instructions: this.instructions
        };
    }

    /* ========================================================
     * DEBUG HELPERS
     * ======================================================== */

    getFlagsString() {
        return [
            this.getZ() ? "Z" : "-",
            this.getN() ? "N" : "-",
            this.getH() ? "H" : "-",
            this.getC() ? "C" : "-"
        ].join("");
    }

    getDebugState() {
        return {
            pc: this.pc,
            sp: this.sp,

            af: this.getAF(),
            bc: this.getBC(),
            de: this.getDE(),
            hl: this.getHL(),

            flags: this.getFlagsString(),

            ime: this.ime,
            imeDelay: this.imeDelay,

            halted: this.halted,
            stopped: this.stopped,
            haltBug: this.haltBug,

            opcode: this.lastOpcode,
            opcodeAddress: this.lastPC,

            cycles: this.cycles,
            instructions: this.instructions
        };
    }
}
