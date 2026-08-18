/*
 * ============================================================
 * WebBktx — Nintendo Game Boy CPU
 * Sharp LR35902
 * ============================================================
 *
 * CPU:
 *   - 8-bit ALU
 *   - 16-bit registers
 *   - AF / BC / DE / HL
 *   - SP / PC
 *   - Z N H C flags
 *   - IME / HALT / STOP
 *   - Interrupt handling
 *   - Opcodes 00-FF
 *   - CB-prefixed opcodes
 *
 * ============================================================
 */

export default class GameBoyCPU {

    constructor(memory) {

        this.memory = memory;

        this.reset();

    }


    /*
     * ========================================================
     * RESET
     * ========================================================
     */

    reset() {

        /*
         * Registers
         */

        this.a = 0x01;
        this.f = 0xB0;

        this.b = 0x00;
        this.c = 0x13;

        this.d = 0x00;
        this.e = 0xD8;

        this.h = 0x01;
        this.l = 0x4D;


        /*
         * Stack / Program Counter
         */

        this.sp = 0xFFFE;
        this.pc = 0x0100;


        /*
         * Interrupt Master Enable
         */

        this.ime = false;

        this.imePending = 0;


        /*
         * CPU state
         */

        this.halted = false;
        this.stopped = false;

        this.haltBug = false;


        /*
         * Statistics
         */

        this.cycles = 0;
        this.instructions = 0;

    }


    /*
     * ========================================================
     * REGISTER PAIRS
     * ========================================================
     */

    getAF() {

        return (
            ((this.a & 0xFF) << 8) |
            (this.f & 0xF0)
        );

    }


    setAF(value) {

        this.a =
            (value >> 8) & 0xFF;

        this.f =
            value & 0xF0;

    }


    getBC() {

        return (
            (this.b << 8) |
            this.c
        );

    }


    setBC(value) {

        this.b =
            (value >> 8) & 0xFF;

        this.c =
            value & 0xFF;

    }


    getDE() {

        return (
            (this.d << 8) |
            this.e
        );

    }


    setDE(value) {

        this.d =
            (value >> 8) & 0xFF;

        this.e =
            value & 0xFF;

    }


    getHL() {

        return (
            (this.h << 8) |
            this.l
        );

    }


    setHL(value) {

        this.h =
            (value >> 8) & 0xFF;

        this.l =
            value & 0xFF;

    }


    /*
     * ========================================================
     * FLAGS
     * ========================================================
     *
     * F:
     *
     * bit 7 = Z
     * bit 6 = N
     * bit 5 = H
     * bit 4 = C
     *
     * ========================================================
     */

    getFlagZ() {

        return (
            (this.f & 0x80) !== 0
        );

    }


    getFlagN() {

        return (
            (this.f & 0x40) !== 0
        );

    }


    getFlagH() {

        return (
            (this.f & 0x20) !== 0
        );

    }


    getFlagC() {

        return (
            (this.f & 0x10) !== 0
        );

    }


    setFlagZ(value) {

        if (value) {

            this.f |= 0x80;

        } else {

            this.f &= ~0x80;

        }

    }


    setFlagN(value) {

        if (value) {

            this.f |= 0x40;

        } else {

            this.f &= ~0x40;

        }

    }


    setFlagH(value) {

        if (value) {

            this.f |= 0x20;

        } else {

            this.f &= ~0x20;

        }

    }


    setFlagC(value) {

        if (value) {

            this.f |= 0x10;

        } else {

            this.f &= ~0x10;

        }

    }


    /*
     * ========================================================
     * MEMORY
     * ========================================================
     */

    read8(address) {

        return this.memory.read(
            address & 0xFFFF
        ) & 0xFF;

    }


    write8(address, value) {

        this.memory.write(
            address & 0xFFFF,
            value & 0xFF
        );

    }


    read16(address) {

        const low =
            this.read8(address);

        const high =
            this.read8(
                (address + 1) & 0xFFFF
            );

        return (
            low |
            (high << 8)
        );

    }


    write16(address, value) {

        this.write8(
            address,
            value & 0xFF
        );

        this.write8(
            (address + 1) & 0xFFFF,
            (value >> 8) & 0xFF
        );

    }


    /*
     * ========================================================
     * FETCH
     * ========================================================
     */

    fetch8() {

        const value =
            this.read8(this.pc);

        this.pc =
            (this.pc + 1) & 0xFFFF;

        return value;

    }


    fetch16() {

        const value =
            this.read16(this.pc);

        this.pc =
            (this.pc + 2) & 0xFFFF;

        return value;

    }


    /*
     * ========================================================
     * STACK
     * ========================================================
     */

    push16(value) {

        this.sp =
            (this.sp - 1) & 0xFFFF;

        this.write8(
            this.sp,
            (value >> 8) & 0xFF
        );

        this.sp =
            (this.sp - 1) & 0xFFFF;

        this.write8(
            this.sp,
            value & 0xFF
        );

    }


    pop16() {

        const low =
            this.read8(this.sp);

        this.sp =
            (this.sp + 1) & 0xFFFF;

        const high =
            this.read8(this.sp);

        this.sp =
            (this.sp + 1) & 0xFFFF;

        return (
            low |
            (high << 8)
        );

    }


    /*
     * ========================================================
     * MAIN STEP
     * ========================================================
     */

    step() {

        /*
         * Interrupts have priority.
         */

        const interruptCycles =
            this.handleInterrupts();

        if (
            interruptCycles > 0
        ) {

            this.cycles +=
                interruptCycles;

            return interruptCycles;

        }


        /*
         * HALT
         */

        if (this.halted) {

            /*
             * Wake when an interrupt
             * becomes pending.
             */

            const ie =
                this.read8(0xFFFF);

            const iflag =
                this.read8(0xFF0F);

            if (
                (ie & iflag & 0x1F) !== 0
            ) {

                this.halted = false;

            } else {

                this.cycles += 4;

                return 4;

            }

        }


        /*
         * STOP
         */

        if (this.stopped) {

            this.cycles += 4;

            return 4;

        }


        const opcode =
            this.fetch8();


        this.instructions++;


        let cycles =
            this.executeOpcode(
                opcode
            );


        /*
         * Delayed EI.
         */

        if (
            this.imePending > 0
        ) {

            this.imePending--;

            if (
                this.imePending === 0
            ) {

                this.ime = true;

            }

        }


        this.cycles += cycles;


        return cycles;

    }


    /*
     * ========================================================
     * INTERRUPTS
     * ========================================================
     */

    handleInterrupts() {

        const ie =
            this.read8(0xFFFF);

        const iflag =
            this.read8(0xFF0F);


        const pending =
            ie &
            iflag &
            0x1F;


        if (
            pending === 0
        ) {

            return 0;

        }


        /*
         * HALT wakes even when IME is disabled.
         */

        if (this.halted) {

            this.halted = false;

        }


        if (!this.ime) {

            return 0;

        }


        this.ime = false;


        let bit = 0;


        while (
            bit < 5 &&
            !(pending & (1 << bit))
        ) {

            bit++;

        }


        /*
         * Clear IF bit.
         */

        this.write8(
            0xFF0F,
            iflag &
            ~(1 << bit)
        );


        this.push16(
            this.pc
        );


        const vectors = [
            0x40,
            0x48,
            0x50,
            0x58,
            0x60
        ];


        this.pc =
            vectors[bit];


        return 20;

    }


    /*
     * ========================================================
     * 8-BIT INC
     * ========================================================
     */

    inc8(value) {

        const result =
            (value + 1) & 0xFF;


        this.setFlagZ(
            result === 0
        );

        this.setFlagN(false);

        this.setFlagH(
            ((value & 0x0F) + 1) > 0x0F
        );


        return result;

    }


    /*
     * ========================================================
     * 8-BIT DEC
     * ========================================================
     */

    dec8(value) {

        const result =
            (value - 1) & 0xFF;


        this.setFlagZ(
            result === 0
        );

        this.setFlagN(true);

        this.setFlagH(
            (value & 0x0F) === 0
        );


        return result;

    }


    /*
     * ========================================================
     * ADD A,n
     * ========================================================
     */

    addA(value, carry = false) {

        const c =
            carry &&
            this.getFlagC()
                ? 1
                : 0;


        const result =
            this.a +
            value +
            c;


        this.setFlagZ(
            (result & 0xFF) === 0
        );

        this.setFlagN(false);

        this.setFlagH(
            (
                (this.a & 0x0F) +
                (value & 0x0F) +
                c
            ) > 0x0F
        );

        this.setFlagC(
            result > 0xFF
        );


        this.a =
            result & 0xFF;

    }


    /*
     * ========================================================
     * SUB
     * ========================================================
     */

    subA(value, carry = false) {

        const c =
            carry &&
            this.getFlagC()
                ? 1
                : 0;


        const result =
            this.a -
            value -
            c;


        this.setFlagZ(
            (result & 0xFF) === 0
        );

        this.setFlagN(true);

        this.setFlagH(
            (
                (this.a & 0x0F) -
                (value & 0x0F) -
                c
            ) < 0
        );

        this.setFlagC(
            result
