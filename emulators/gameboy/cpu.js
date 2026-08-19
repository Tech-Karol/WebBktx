/*
 * ============================================================
 * WebBktx — Game Boy CPU / Sharp LR35902
 * Complete instruction implementation
 * ============================================================
 */

export default class CPU {

    constructor(memory) {
        this.memory = memory;

        this.a = 0;
        this.f = 0;
        this.b = 0;
        this.c = 0;
        this.d = 0;
        this.e = 0;
        this.h = 0;
        this.l = 0;

        this.sp = 0;
        this.pc = 0;

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
     * RESET
     * ======================================================== */

    reset() {
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

        if (!this.memory) return 0xFF;

        const value = this.memory.readByte(address);

        return value === undefined || value === null
            ? 0xFF
            : value & 0xFF;
    }

    writeByte(address, value) {
        if (!this.memory) return;

        this.memory.writeByte(
            address & 0xFFFF,
            value & 0xFF
        );
    }

    fetch8() {
        const value = this.readByte(this.pc);

        this.pc = (this.pc + 1) & 0xFFFF;

        return value;
    }

    fetch16() {
        const lo = this.fetch8();
        const hi = this.fetch8();

        return lo | (hi << 8);
    }

    /* ========================================================
     * 8 BIT REGISTERS
     * ======================================================== */

    readReg8(r) {
        switch (r & 7) {
            case 0: return this.b;
            case 1: return this.c;
            case 2: return this.d;
            case 3: return this.e;
            case 4: return this.h;
            case 5: return this.l;
            case 6: return this.readByte(this.getHL());
            case 7: return this.a;
        }

        return 0xFF;
    }

    writeReg8(r, value) {
        value &= 0xFF;

        switch (r & 7) {
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
     * 16 BIT REGISTERS
     * ======================================================== */

    getAF() {
        return ((this.a << 8) | (this.f & 0xF0)) & 0xFFF0;
    }

    setAF(value) {
        value &= 0xFFFF;

        this.a = (value >> 8) & 0xFF;
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
     * ======================================================== */

    getZ() {
        return !!(this.f & 0x80);
    }

    getN() {
        return !!(this.f & 0x40);
    }

    getH() {
        return !!(this.f & 0x20);
    }

    getC() {
        return !!(this.f & 0x10);
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

        this.sp = (this.sp - 1) & 0xFFFF;
        this.writeByte(this.sp, (value >> 8) & 0xFF);

        this.sp = (this.sp - 1) & 0xFFFF;
        this.writeByte(this.sp, value & 0xFF);
    }

    pop16() {
        const lo = this.readByte(this.sp);

        this.sp = (this.sp + 1) & 0xFFFF;

        const hi = this.readByte(this.sp);

        this.sp = (this.sp + 1) & 0xFFFF;

        return lo | (hi << 8);
    }

    /* ========================================================
     * ARITHMETIC
     * ======================================================== */

    add8(value, carry = false) {
        value &= 0xFF;

        const c = carry && this.getC() ? 1 : 0;
        const a = this.a;
        const result = a + value + c;

        this.a = result & 0xFF;

        this.setFlags(
            this.a === 0,
            false,
            ((a & 0x0F) + (value & 0x0F) + c) > 0x0F,
            result > 0xFF
        );
    }

    sub8(value, carry = false) {
        value &= 0xFF;

        const c = carry && this.getC() ? 1 : 0;
        const a = this.a;
        const result = a - value - c;

        this.a = result & 0xFF;

        this.setFlags(
            this.a === 0,
            true,
            ((a & 0x0F) - (value & 0x0F) - c) < 0,
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

        const result = (value + 1) & 0xFF;

        this.f =
            (result === 0 ? 0x80 : 0) |
            (this.f & 0x10) |
            (((value & 0x0F) + 1 > 0x0F) ? 0x20 : 0);

        return result;
    }

    dec8(value) {
        value &= 0xFF;

        const result = (value - 1) & 0xFF;

        this.f =
            (result === 0 ? 0x80 : 0) |
            0x40 |
            ((value & 0x0F) === 0 ? 0x20 : 0) |
            (this.f & 0x10);

        return result;
    }

    addHL(value) {
        const hl = this.getHL();

        value &= 0xFFFF;

        const result = hl + value;

        this.f =
            (this.f & 0x80) |
            (((hl & 0x0FFF) + (value & 0x0FFF)) > 0x0FFF ? 0x20 : 0) |
            (result > 0xFFFF ? 0x10 : 0);

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
            if (this.getH() || (a & 0x0F) > 9) {
                correction |= 0x06;
            }

            if (carry || a > 0x99) {
                correction |= 0x60;
                carry = true;
            }

            a = (a + correction) & 0xFF;
        } else {
            if (this.getH()) correction |= 0x06;
            if (carry) correction |= 0x60;

            a = (a - correction) & 0xFF;
        }

        this.a = a;

        this.f =
            (a === 0 ? 0x80 : 0) |
            (this.f & 0x40) |
            (carry ? 0x10 : 0);
    }

    /* ========================================================
     * ROTATES
     * ======================================================== */

    rlc(value) {
        value &= 0xFF;

        const carry = !!(value & 0x80);
        const result = ((value << 1) | (carry ? 1 : 0)) & 0xFF;

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

        const carry = !!(value & 1);
        const result =
            ((value >> 1) | (carry ? 0x80 : 0)) & 0xFF;

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

        const oldCarry = this.getC();
        const carry = !!(value & 0x80);

        const result =
            ((value << 1) | (oldCarry ? 1 : 0)) & 0xFF;

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

        const oldCarry = this.getC();
        const carry = !!(value & 1);

        const result =
            ((value >> 1) | (oldCarry ? 0x80 : 0)) & 0xFF;

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

        const carry = !!(value & 0x80);
        const result = (value << 1) & 0xFF;

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

        const carry = !!(value & 1);

        const result =
            ((value >> 1) | (value & 0x80)) & 0xFF;

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

        const carry = !!(value & 1);
        const result = value >> 1;

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
            ((value >> 4) | (value << 4)) & 0xFF;

        this.setFlags(
            result === 0,
            false,
            false,
            false
        );

        return result;
    }

    /* ========================================================
     * SIGNED
     * ======================================================== */

    sign8(value) {
        value &= 0xFF;

        return value & 0x80
            ? value - 0x100
            : value;
    }

    /* ========================================================
     * CONDITIONS
     * ======================================================== */

    condition(code) {
        switch (code & 3) {
            case 0: return !this.getZ(); // NZ
            case 1: return this.getZ();  // Z
            case 2: return !this.getC(); // NC
            case 3: return this.getC();  // C
        }

        return false;
    }

    /* ========================================================
     * CB INSTRUCTIONS
     * ======================================================== */

    executeCB(op) {
        const r = op & 7;
        const bit = (op >> 3) & 7;
        const group = op >> 6;

        let value = this.readReg8(r);

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

            return r === 6 ? 16 : 8;
        }

        if (group === 1) {

            const mask = 1 << bit;

            this.f =
                (value & mask ? 0 : 0x80) |
                0x20 |
                (this.f & 0x10);

            return r === 6 ? 12 : 8;
        }

        if (group === 2) {

            value &= ~(1 << bit);

            this.writeReg8(r, value);

            return r === 6 ? 16 : 8;
        }

        value |= 1 << bit;

        this.writeReg8(r, value);

        return r === 6 ? 16 : 8;
    }

    /* ========================================================
     * INTERRUPTS
     * ======================================================== */

    getPendingInterrupts() {
        if (!this.memory) return 0;

        const ie =
            this.memory.interruptEnable !== undefined
                ? this.memory.interruptEnable
                : this.readByte(0xFFFF);

        const flags =
            this.memory.interruptFlags !== undefined
                ? this.memory.interruptFlags
                : this.readByte(0xFF0F);

        return (ie & flags & 0x1F);
    }

    serviceInterrupt(pending) {
        let bit = 0;

        while (
            bit < 5 &&
            !(pending & (1 << bit))
        ) {
            bit++;
        }

        this.halted = false;
        this.ime = false;
        this.imeDelay = 0;

        if (this.memory.clearInterrupt) {
            this.memory.clearInterrupt(bit);
        } else {
            const flags = this.readByte(0xFF0F);

            this.writeByte(
                0xFF0F,
                flags & ~(1 << bit)
            );
        }

        this.push16(this.pc);

        this.pc = [
            0x40,
            0x48,
            0x50,
            0x58,
            0x60
        ][bit];

        return 20;
    }

    /* ========================================================
     * STEP
     * ======================================================== */

    step() {

        if (this.stopped) {
            this.cycles += 4;
            return 4;
        }

        if (this.halted) {

            const pending =
                this.getPendingInterrupts();

            if (pending) {
                this.halted = false;
            } else {
                this.cycles += 4;
                return 4;
            }
        }

        const pending =
            this.getPendingInterrupts();

        if (this.ime && pending) {

            const cycles =
                this.serviceInterrupt(pending);

            this.cycles += cycles;

            return cycles;
        }

        this.lastPC = this.pc;

        let opcode = this.fetch8();

        /*
         * HALT bug:
         *
         * The opcode following HALT is fetched without
         * incrementing PC once.
         */

        if (this.haltBug) {
            this.pc =
                (this.pc - 1) & 0xFFFF;

            this.haltBug = false;
        }

        this.lastOpcode = opcode;

        this.instructions++;

        let cycles;

        if (opcode === 0xCB) {
            cycles =
                this.executeCB(
                    this.fetch8()
                );
        } else {
            cycles =
                this.executeOpcode(opcode);
        }

        /*
         * EI delay.
         *
         * EI sets delay=2.
         * At the end of the next instruction it becomes 1,
         * and after that instruction IME becomes enabled.
         */

        if (this.imeDelay > 0) {
            this.imeDelay--;

            if (this.imeDelay === 0) {
                this.ime = true;
            }
        }

        this.cycles += cycles;

        return cycles;
    }

    /* ========================================================
     * OPCODES
     * ======================================================== */

    executeOpcode(op) {

        /* ----------------------------------------------------
         * 00 NOP
         * ---------------------------------------------------- */

        if (op === 0x00) {
            return 4;
        }

        /* ----------------------------------------------------
         * 01 / 11 / 21 / 31 LD rr,d16
         * ---------------------------------------------------- */

        if ((op & 0x0F) === 0x01) {

            const value = this.fetch16();

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
         * 02 / 12 LD (BC/DE),A
         * ---------------------------------------------------- */

        if (op === 0x02) {
            this.writeByte(this.getBC(), this.a);
            return 8;
        }

        if (op === 0x12) {
            this.writeByte(this.getDE(), this.a);
            return 8;
        }

        /* ----------------------------------------------------
         * 03 / 13 / 23 / 33 INC rr
         * ---------------------------------------------------- */

        if ((op & 0x0F) === 0x03) {

            switch ((op >> 4) & 3) {
                case 0:
                    this.setBC(this.getBC() + 1);
                    break;

                case 1:
                    this.setDE(this.getDE() + 1);
                    break;

                case 2:
                    this.setHL(this.getHL() + 1);
                    break;

                case 3:
                    this.sp =
                        (this.sp + 1) & 0xFFFF;
                    break;
            }

            return 8;
        }

        /* ----------------------------------------------------
         * 04/0C/14/1C/24/2C/34/3C INC r
         * ---------------------------------------------------- */

        if (
            (op & 0x07) === 0x04 &&
            (op & 0xC0) === 0
        ) {
            const r = (op >> 3) & 7;

            const value =
                this.inc8(
                    this.readReg8(r)
                );

            this.writeReg8(r, value);

            return r === 6 ? 12 : 4;
        }

        /* ----------------------------------------------------
         * DEC r
         * ---------------------------------------------------- */

        if (
            (op & 0x07) === 0x05 &&
            (op & 0xC0) === 0
        ) {
            const r = (op >> 3) & 7;

            const value =
                this.dec8(
                    this.readReg8(r)
                );

            this.writeReg8(r, value);

            return r === 6 ? 12 : 4;
        }

        /* ----------------------------------------------------
         * LD r,d8
         * ---------------------------------------------------- */

        if ((op & 0xC7) === 0x06) {

            const r = (op >> 3) & 7;

            this.writeReg8(
                r,
                this.fetch8()
            );

            return r === 6 ? 12 : 8;
        }

        /* ----------------------------------------------------
         * RLCA
         * ---------------------------------------------------- */

        if (op === 0x07) {

            const carry =
                !!(this.a & 0x80);

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
                this.sp >> 8
            );

            return 20;
        }

        /* ----------------------------------------------------
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
         * LD A,(BC)/(DE)
         * ---------------------------------------------------- */

        if (op === 0x0A) {
            this.a =
                this.readByte(this.getBC());
            return 8;
        }

        if (op === 0x1A) {
            this.a =
                this.readByte(this.getDE());
            return 8;
        }

        /* ----------------------------------------------------
         * INC rr already handled
         * ---------------------------------------------------- */

        /* ----------------------------------------------------
         * DEC rr
         * ---------------------------------------------------- */

        if ((op & 0x0F) === 0x0B) {

            switch ((op >> 4) & 3) {
                case 0:
                    this.setBC(this.getBC() - 1);
                    break;

                case 1:
                    this.setDE(this.getDE() - 1);
                    break;

                case 2:
                    this.setHL(this.getHL() - 1);
                    break;

                case 3:
                    this.sp =
                        (this.sp - 1) & 0xFFFF;
                    break;
            }

            return 8;
        }

        /* ----------------------------------------------------
         * RRCA
         * ---------------------------------------------------- */

        if (op === 0x0F) {

            const carry =
                !!(this.a & 1);

            this.a =
                (this.a >> 1) |
                (carry ? 0x80 : 0);

            this.f =
                carry ? 0x10 : 0;

            return 4;
        }

        /* ----------------------------------------------------
         * STOP
         * ---------------------------------------------------- */

        if (op === 0x10) {
            this.fetch8();
            this.stopped = true;
            return 4;
        }

        /* ----------------------------------------------------
         * RLA
         * ---------------------------------------------------- */

        if (op === 0x17) {

            const oldCarry = this.getC();
            const newCarry = !!(this.a & 0x80);

            this.a =
                ((this.a << 1) |
                (oldCarry ? 1 : 0)) & 0xFF;

            this.f =
                newCarry ? 0x10 : 0;

            return 4;
        }

        /* ----------------------------------------------------
         * JR
         * ---------------------------------------------------- */

        if (op === 0x18) {

            const offset =
                this.sign8(this.fetch8());

            this.pc =
                (this.pc + offset) & 0xFFFF;

            return 12;
        }

        /* ----------------------------------------------------
         * JR cc
         * ---------------------------------------------------- */

        if ((op & 0xE7) === 0x20) {

            const offset =
                this.sign8(this.fetch8());

            const condition =
                this.condition(
                    (op >> 3) & 3
                );

            if (condition) {
                this.pc =
                    (this.pc + offset) & 0xFFFF;

                return 12;
            }

            return 8;
        }

        /* ----------------------------------------------------
         * RRA
         * ---------------------------------------------------- */

        if (op === 0x1F) {

            const oldCarry = this.getC();
            const newCarry = !!(this.a & 1);

            this.a =
                (this.a >> 1) |
                (oldCarry ? 0x80 : 0);

            this.f =
                newCarry ? 0x10 : 0;

            return 4;
        }

        /* ----------------------------------------------------
         * LD (HL+),A
         * ---------------------------------------------------- */

        if (op === 0x22) {

            this.writeByte(
                this.getHL(),
                this.a
            );

            this.setHL(
                this.getHL() + 1
            );

            return 8;
        }

        /* ----------------------------------------------------
         * LD (HL-),A
         * ---------------------------------------------------- */

        if (op === 0x32) {

            this.writeByte(
                this.getHL(),
                this.a
            );

            this.setHL(
                this.getHL() - 1
            );

            return 8;
        }

        /* ----------------------------------------------------
         * LD A,(HL+)
         * ---------------------------------------------------- */

        if (op === 0x2A) {

            this.a =
                this.readByte(this.getHL());

            this.setHL(
                this.getHL() + 1
            );

            return 8;
        }

        /* ----------------------------------------------------
         * LD A,(HL-)
         * ---------------------------------------------------- */

        if (op === 0x3A) {

            this.a =
                this.readByte(this.getHL());

            this.setHL(
                this.getHL() - 1
            );

            return 8;
        }

        /* ----------------------------------------------------
         * DAA
         * ---------------------------------------------------- */

        if (op === 0x27) {
            this.daa();
            return 4;
        }

        /* ----------------------------------------------------
         * CPL
         * ---------------------------------------------------- */

        if (op === 0x2F) {

            this.a ^= 0xFF;

            this.f =
                (this.f & 0x90) | 0x60;

            return 4;
        }

        /* ----------------------------------------------------
         * SCF
         * ---------------------------------------------------- */

        if (op === 0x37) {

            this.f =
                (this.f & 0x80) | 0x10;

            return 4;
        }

        /* ----------------------------------------------------
         * CCF
         * ---------------------------------------------------- */

        if (op === 0x3F) {

            this.f =
                (this.f & 0x80) |
                (this.getC() ? 0 : 0x10);

            return 4;
        }

        /* ----------------------------------------------------
         * LD r,r / HALT
         * ---------------------------------------------------- */

        if (op >= 0x40 && op <= 0x7F) {

            if (op === 0x76) {

                const pending =
                    this.getPendingInterrupts();

                if (!this.ime && pending) {
                    this.haltBug = true;
                } else {
                    this.halted = true;
                }

                return 4;
            }

            const dst = (op >> 3) & 7;
            const src = op & 7;

            const value =
                this.readReg8(src);

            this.writeReg8(dst, value);

            return (
                dst === 6 ||
                src === 6
            ) ? 8 : 4;
        }

        /* ----------------------------------------------------
         * ALU A,r
         * ---------------------------------------------------- */

        if (op >= 0x80 && op <= 0xBF) {

            const group =
                (op >> 3) & 7;

            const value =
                this.readReg8(op & 7);

            switch (group) {

                case 0:
                    this.add8(value);
                    break;

                case 1:
                    this.add8(value, true);
                    break;

                case 2:
                    this.sub8(value);
                    break;

                case 3:
                    this.sub8(value, true);
                    break;

                case 4:
                    this.a &= value;

                    this.f =
                        this.a === 0
                            ? 0xA0
                            : 0x20;
                    break;

                case 5:
                    this.a ^= value;

                    this.f =
                        this.a === 0
                            ? 0x80
                            : 0;
                    break;

                case 6:
                    this.a |= value;

                    this.f =
                        this.a === 0
                            ? 0x80
                            : 0;
                    break;

                case 7:
                    this.cp(value);
                    break;
            }

            return (op & 7) === 6
                ? 8
                : 4;
        }

        /* ----------------------------------------------------
         * RET cc
         * ---------------------------------------------------- */

        if ((op & 0xE7) === 0xC0) {

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
         * POP
         * ---------------------------------------------------- */

        if ((op & 0xCF) === 0xC1) {

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
         * JP cc
         * ---------------------------------------------------- */

        if ((op & 0xE7) === 0xC2) {

            const address =
                this.fetch16();

            if (
                this.condition(
                    (op >> 3) & 3
                )
            ) {
                this.pc = address;
                return 16;
            }

            return 12;
        }

        /* ----------------------------------------------------
         * JP
         * ---------------------------------------------------- */

        if (op === 0xC3) {

            this.pc =
                this.fetch16();

            return 16;
        }

        /* ----------------------------------------------------
         * CALL cc
         * ---------------------------------------------------- */

        if ((op & 0xE7) === 0xC4) {

            const address =
                this.fetch16();

            if (
                this.condition(
                    (op >> 3) & 3
                )
            ) {
                this.push16(this.pc);
                this.pc = address;

                return 24;
            }

            return 12;
        }

        /* ----------------------------------------------------
         * PUSH
         * ---------------------------------------------------- */

        if ((op & 0xCF) === 0xC5) {

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
         * ---------------------------------------------------- */

        if (op === 0xC6) {

            this.add8(
                this.fetch8()
            );

            return 8;
        }

        /* ----------------------------------------------------
         * RST
         * ---------------------------------------------------- */

        if ((op & 0xC7) === 0xC7) {

            const vector =
                op & 0x38;

            this.push16(this.pc);
            this.pc = vector;

            return 16;
        }

        /* ----------------------------------------------------
         * RET
         * ---------------------------------------------------- */

        if (op === 0xC9) {

            this.pc =
                this.pop16();

            return 16;
        }

        /* ----------------------------------------------------
         * CALL
         * ---------------------------------------------------- */

        if (op === 0xCD) {

            const address =
                this.fetch16();

            this.push16(this.pc);

            this.pc = address;

            return 24;
        }

        /* ----------------------------------------------------
         * ADC A,d8
         * ---------------------------------------------------- */

        if (op === 0xCE) {

            this.add8(
                this.fetch8(),
                true
            );

            return 8;
        }

        /* ----------------------------------------------------
         * SUB d8
         * ---------------------------------------------------- */

        if (op === 0xD6) {

            this.sub8(
                this.fetch8()
            );

            return 8;
        }

        /* ----------------------------------------------------
         * SBC A,d8
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
         * ---------------------------------------------------- */

        if (op === 0xD9) {

            this.pc =
                this.pop16();

            this.ime = true;
            this.imeDelay = 0;

            return 16;
        }

        /* ----------------------------------------------------
         * LDH (a8),A
         * ---------------------------------------------------- */

        if (op === 0xE0) {

            this.writeByte(
                0xFF00 | this.fetch8(),
                this.a
            );

            return 12;
        }

        /* ----------------------------------------------------
         * LD (C),A
         * ---------------------------------------------------- */

        if (op === 0xE2) {

            this.writeByte(
                0xFF00 | this.c,
                this.a
            );

            return 8;
        }

        /* ----------------------------------------------------
         * ADD SP,r8
         * ---------------------------------------------------- */

        if (op === 0xE8) {

            const value =
                this.sign8(this.fetch8());

            const sp = this.sp;

            const u =
                value & 0xFF;

            this.f = 0;

            if (
                ((sp & 0x0F) + (u & 0x0F)) > 0x0F
            ) {
                this.f |= 0x20;
            }

            if (
                ((sp & 0xFF) + u) > 0xFF
            ) {
                this.f |= 0x10;
            }

            this.sp =
                (sp + value) & 0xFFFF;

            return 16;
        }

        /* ----------------------------------------------------
         * LD (a16),A
         * ---------------------------------------------------- */

        if (op === 0xEA) {

            this.writeByte(
                this.fetch16(),
                this.a
            );

            return 16;
        }

        /* ----------------------------------------------------
         * XOR A
         * ---------------------------------------------------- */

        if (op === 0xAF) {

            this.a = 0;
            this.f = 0x80;

            return 4;
        }

        /* ----------------------------------------------------
         * JP HL
         * ---------------------------------------------------- */

        if (op === 0xE9) {

            this.pc =
                this.getHL();

            return 4;
        }

        /* ----------------------------------------------------
         * LDH A,(a8)
         * ---------------------------------------------------- */

        if (op === 0xF0) {

            this.a =
                this.readByte(
                    0xFF00 | this.fetch8()
                );

            return 12;
        }

        /* ----------------------------------------------------
         * LD A,(C)
         * ---------------------------------------------------- */

        if (op === 0xF2) {

            this.a =
                this.readByte(
                    0xFF00 | this.c
                );

            return 8;
        }

        /* ----------------------------------------------------
         * LD A,(a16)
         * ---------------------------------------------------- */

        if (op === 0xFA) {

            this.a =
                this.readByte(
                    this.fetch16()
                );

            return 16;
        }

        /* ----------------------------------------------------
         * AND d8
         * ---------------------------------------------------- */

        if (op === 0xE6) {

            this.a &=
                this.fetch8();

            this.a &= 0xFF;

            this.f =
                this.a === 0
                    ? 0xA0
                    : 0x20;

            return 8;
        }

        /* ----------------------------------------------------
         * XOR d8
         * ---------------------------------------------------- */

        if (op === 0xEE) {

            this.a ^=
                this.fetch8();

            this.a &= 0xFF;

            this.f =
                this.a === 0
                    ? 0x80
                    : 0;

            return 8;
        }

        /* ----------------------------------------------------
         * OR d8
         * ---------------------------------------------------- */

        if (op === 0xF6) {

            this.a |=
                this.fetch8();

            this.a &= 0xFF;

            this.f =
                this.a === 0
                    ? 0x80
                    : 0;

            return 8;
        }

        /* ----------------------------------------------------
         * CP d8
         * ---------------------------------------------------- */

        if (op === 0xFE) {

            this.cp(
                this.fetch8()
            );

            return 8;
        }

        /* ----------------------------------------------------
         * DI
         * ---------------------------------------------------- */

        if (op === 0xF3) {

            this.ime = false;
            this.imeDelay = 0;

            return 4;
        }

        /* ----------------------------------------------------
         * EI
         * ---------------------------------------------------- */

        if (op === 0xFB) {

            this.imeDelay = 2;

            return 4;
        }

        /* ----------------------------------------------------
         * LD SP,d16
         * ---------------------------------------------------- */

        if (op === 0x31) {

            this.sp =
                this.fetch16();

            return 12;
        }

        /* ----------------------------------------------------
         * LD HL,SP+r8
         * ---------------------------------------------------- */

        if (op === 0xF8) {

            const value =
                this.sign8(this.fetch8());

            const sp = this.sp;
            const u = value & 0xFF;

            const result =
                (sp + value) & 0xFFFF;

            this.f = 0;

            if (
                ((sp & 0x0F) + (u & 0x0F)) > 0x0F
            ) {
                this.f |= 0x20;
            }

            if (
                ((sp & 0xFF) + u) > 0xFF
            ) {
                this.f |= 0x10;
            }

            this.setHL(result);

            return 12;
        }

        /* ----------------------------------------------------
         * LD SP,HL
         * ---------------------------------------------------- */

        if (op === 0xF9) {

            this.sp =
                this.getHL();

            return 8;
        }

        /* ----------------------------------------------------
         * Remaining documented opcodes
         * ---------------------------------------------------- */

        /*
         * 0xC0 etc are handled by generic groups above.
         *
         * The following are the individual instructions
         * that do not fit those groups.
         */

        if (op === 0xC7) {
            this.push16(this.pc);
            this.pc = 0x00;
            return 16;
        }

        if (op === 0xCF) {
            this.push16(this.pc);
            this.pc = 0x08;
            return 16;
        }

        if (op === 0xD7) {
            this.push16(this.pc);
            this.pc = 0x10;
            return 16;
        }

        if (op === 0xDF) {
            this.push16(this.pc);
            this.pc = 0x18;
            return 16;
        }

        if (op === 0xE7) {
            this.push16(this.pc);
            this.pc = 0x20;
            return 16;
        }

        if (op === 0xEF) {
            this.push16(this.pc);
            this.pc = 0x28;
            return 16;
        }

        if (op === 0xF7) {
            this.push16(this.pc);
            this.pc = 0x30;
            return 16;
        }

        if (op === 0xFF) {
            this.push16(this.pc);
            this.pc = 0x38;
            return 16;
        }

        /* ----------------------------------------------------
         * 0xD0 / 0xD8 / etc are RET cc
         * handled by generic RET group.
         * ---------------------------------------------------- */

        /* ----------------------------------------------------
         * LD HL,SP+r8 / ADD SP,r8 already handled.
         * ---------------------------------------------------- */

        /*
         * Illegal opcodes:
         *
         * On LR35902 these are unused. Treat as NOP during
         * development rather than crashing the complete
         * emulator.
         */

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
            halted: this.halted,
            stopped: this.stopped,
            haltBug: this.haltBug,

            lastOpcode: this.lastOpcode,
            lastPC: this.lastPC,

            cycles: this.cycles,
            instructions: this.instructions
        };
    }
}
