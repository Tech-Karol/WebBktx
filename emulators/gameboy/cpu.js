/*
 * ============================================================
 * WebBktx — Game Boy CPU
 * ============================================================
 *
 * Sharp LR35902
 * 8-bit CPU used in Nintendo Game Boy DMG.
 *
 * CPU:
 *   - 8-bit ALU
 *   - 16-bit address bus
 *   - 8-bit registers
 *   - 16-bit register pairs
 *
 * Registers:
 *
 *   A
 *   F
 *   B
 *   C
 *   D
 *   E
 *   H
 *   L
 *
 *   AF
 *   BC
 *   DE
 *   HL
 *
 *   SP
 *   PC
 *
 * Flags:
 *
 *   Z = Zero
 *   N = Subtract
 *   H = Half Carry
 *   C = Carry
 *
 * ============================================================
 */

import GameBoyMemory from "./memory.js";


export class GameBoyCPU {

    constructor(memory = null) {

        /*
         * ----------------------------------------------------
         * MEMORY
         * ----------------------------------------------------
         */

        this.memory =
            memory ||
            new GameBoyMemory();


        /*
         * ----------------------------------------------------
         * 8-BIT REGISTERS
         * ----------------------------------------------------
         */

        this.A = 0x01;

        this.F = 0xB0;

        this.B = 0x00;
        this.C = 0x13;

        this.D = 0x00;
        this.E = 0xD8;

        this.H = 0x01;
        this.L = 0x4D;


        /*
         * ----------------------------------------------------
         * 16-BIT REGISTERS
         * ----------------------------------------------------
         */

        this.SP = 0xFFFE;

        this.PC = 0x0100;


        /*
         * ----------------------------------------------------
         * CPU STATE
         * ----------------------------------------------------
         */

        this.halted = false;

        this.stopped = false;

        this.ime = false;

        this.imeDelay = 0;


        /*
         * ----------------------------------------------------
         * INTERRUPTS
         * ----------------------------------------------------
         */

        this.interruptEnable = 0;

        this.interruptFlags = 0;


        /*
         * ----------------------------------------------------
         * CYCLES
         * ----------------------------------------------------
         */

        this.cycles = 0;

        this.lastOpcode = 0;


        /*
         * ----------------------------------------------------
         * DEBUG
         * ----------------------------------------------------
         */

        this.debug =
            false;

    }


    /*
     * ========================================================
     * RESET
     * ========================================================
     */

    reset() {

        this.A = 0x01;
        this.F = 0xB0;

        this.B = 0x00;
        this.C = 0x13;

        this.D = 0x00;
        this.E = 0xD8;

        this.H = 0x01;
        this.L = 0x4D;

        this.SP = 0xFFFE;

        this.PC = 0x0100;

        this.halted = false;

        this.stopped = false;

        this.ime = false;

        this.imeDelay = 0;

        this.cycles = 0;

        this.lastOpcode = 0;

    }


    /*
     * ========================================================
     * STEP
     * ========================================================
     *
     * Executes one instruction.
     *
     * Returns machine cycles.
     * ========================================================
     */

    step() {

        /*
         * CPU stopped.
         */

        if (this.stopped) {

            return 4;

        }


        /*
         * HALT.
         */

        if (this.halted) {

            if (this.hasPendingInterrupt()) {

                this.halted = false;

            } else {

                this.cycles += 4;

                return 4;

            }

        }


        /*
         * Interrupt handling.
         */

        if (this.ime && this.hasPendingInterrupt()) {

            return this.serviceInterrupt();

        }


        /*
         * Fetch opcode.
         */

        const opcode =
            this.fetch8();


        this.lastOpcode =
            opcode;


        /*
         * Execute.

         */

        const cycles =
            this.execute(opcode);


        this.cycles +=
            cycles;


        /*
         * EI delay.
         */

        if (this.imeDelay > 0) {

            this.imeDelay--;

            if (this.imeDelay === 0) {

                this.ime = true;

            }

        }


        return cycles;

    }


    /*
     * ========================================================
     * FETCH
     * ========================================================
     */

    fetch8() {

        const value =
            this.memory.read(
                this.PC
            );


        this.PC =
            (this.PC + 1) & 0xFFFF;


        return value;

    }


    fetch16() {

        const low =
            this.fetch8();


        const high =
            this.fetch8();


        return (
            low |
            (high << 8)
        );

    }


    /*
     * ========================================================
     * EXECUTE
     * ========================================================
     */

    execute(opcode) {

        switch (opcode) {

            /*
             * NOP
             */

            case 0x00:
                return 4;


            /*
             * LD BC,d16
             */

            case 0x01:

                this.setBC(
                    this.fetch16()
                );

                return 12;


            /*
             * LD (BC),A
             */

            case 0x02:

                this.memory.write(
                    this.getBC(),
                    this.A
                );

                return 8;


            /*
             * INC BC
             */

            case 0x03:

                this.setBC(
                    (this.getBC() + 1) & 0xFFFF
                );

                return 8;


            /*
             * INC B
             */

            case 0x04:

                this.B =
                    this.inc8(this.B);

                return 4;


            /*
             * DEC B
             */

            case 0x05:

                this.B =
                    this.dec8(this.B);

                return 4;


            /*
             * LD B,d8
             */

            case 0x06:

                this.B =
                    this.fetch8();

                return 8;


            /*
             * RLCA
             */

            case 0x07:

                this.rlca();

                return 4;


            /*
             * LD (a16),SP
             */

            case 0x08: {

                const address =
                    this.fetch16();

                this.memory.write16(
                    address,
                    this.SP
                );

                return 20;
            }


            /*
             * ADD HL,BC
             */

            case 0x09:

                this.addHL(
                    this.getBC()
                );

                return 8;


            /*
             * LD A,(BC)
             */

            case 0x0A:

                this.A =
                    this.memory.read(
                        this.getBC()
                    );

                return 8;


            /*
             * DEC BC
             */

            case 0x0B:

                this.setBC(
                    (this.getBC() - 1) & 0xFFFF
                );

                return 8;


            /*
             * INC C
             */

            case 0x0C:

                this.C =
                    this.inc8(this.C);

                return 4;


            /*
             * DEC C
             */

            case 0x0D:

                this.C =
                    this.dec8(this.C);

                return 4;


            /*
             * LD C,d8
             */

            case 0x0E:

                this.C =
                    this.fetch8();

                return 8;


            /*
             * RRCA
             */

            case 0x0F:

                this.rrca();

                return 4;


            /*
             * STOP
             */

            case 0x10:

                this.fetch8();

                this.stopped =
                    true;

                return 4;


            /*
             * LD DE,d16
             */

            case 0x11:

                this.setDE(
                    this.fetch16()
                );

                return 12;


            /*
             * LD (DE),A
             */

            case 0x12:

                this.memory.write(
                    this.getDE(),
                    this.A
                );

                return 8;


            /*
             * INC DE
             */

            case 0x13:

                this.setDE(
                    (this.getDE() + 1) & 0xFFFF
                );

                return 8;


            /*
             * INC D
             */

            case 0x14:

                this.D =
                    this.inc8(this.D);

                return 4;


            /*
             * DEC D
             */

            case 0x15:

                this.D =
                    this.dec8(this.D);

                return 4;


            /*
             * LD D,d8
             */

            case 0x16:

                this.D =
                    this.fetch8();

                return 8;


            /*
             * RLA
             */

            case 0x17:

                this.rla();

                return 4;


            /*
             * JR r8
             */

            case 0x18:

                this.jr();

                return 12;


            /*
             * ADD HL,DE
             */

            case 0x19:

                this.addHL(
                    this.getDE()
                );

                return 8;


            /*
             * LD A,(DE)
             */

            case 0x1A:

                this.A =
                    this.memory.read(
                        this.getDE()
                    );

                return 8;


            /*
             * DEC DE
             */

            case 0x1B:

                this.setDE(
                    (this.getDE() - 1) & 0xFFFF
                );

                return 8;


            /*
             * INC E
             */

            case 0x1C:

                this.E =
                    this.inc8(this.E);

                return 4;


            /*
             * DEC E
             */

            case 0x1D:

                this.E =
                    this.dec8(this.E);

                return 4;


            /*
             * LD E,d8
             */

            case 0x1E:

                this.E =
                    this.fetch8();

                return 8;


            /*
             * RRA
             */

            case 0x1F:

                this.rra();

                return 4;


            /*
             * JR NZ,r8
             */

            case 0x20:

                return this.jrCondition(
                    !this.getFlagZ()
                );


            /*
             * LD HL,d16
             */

            case 0x21:

                this.setHL(
                    this.fetch16()
                );

                return 12;


            /*
             * LD (HL+),A
             */

            case 0x22:

                this.memory.write(
                    this.getHL(),
                    this.A
                );

                this.setHL(
                    (this.getHL() + 1) & 0xFFFF
                );

                return 8;


            /*
             * INC HL
             */

            case 0x23:

                this.setHL(
                    (this.getHL() + 1) & 0xFFFF
                );

                return 8;


            /*
             * INC H
             */

            case 0x24:

                this.H =
                    this.inc8(this.H);

                return 4;


            /*
             * DEC H
             */

            case 0x25:

                this.H =
                    this.dec8(this.H);

                return 4;


            /*
             * LD H,d8
             */

            case 0x26:

                this.H =
                    this.fetch8();

                return 8;


            /*
             * DAA
             */

            case 0x27:

                this.daa();

                return 4;


            /*
             * JR Z,r8
             */

            case 0x28:

                return this.jrCondition(
                    this.getFlagZ()
                );


            /*
             * ADD HL,HL
             */

            case 0x29:

                this.addHL(
                    this.getHL()
                );

                return 8;


            /*
             * LD A,(HL+)
             */

            case 0x2A:

                this.A =
                    this.memory.read(
                        this.getHL()
                    );

                this.setHL(
                    (this.getHL() + 1) & 0xFFFF
                );

                return 8;


            /*
             * DEC HL
             */

            case 0x2B:

                this.setHL(
                    (this.getHL() - 1) & 0xFFFF
                );

                return 8;


            /*
             * INC L
             */

            case 0x2C:

                this.L =
                    this.inc8(this.L);

                return 4;


            /*
             * DEC L
             */

            case 0x2D:

                this.L =
                    this.dec8(this.L);

                return 4;


            /*
             * LD L,d8
             */

            case 0x2E:

                this.L =
                    this.fetch8();

                return 8;


            /*
             * CPL
             */

            case 0x2F:

                this.A =
                    (~this.A) & 0xFF;

                this.setFlagN(true);
                this.setFlagH(true);

                return 4;


            /*
             * JR NC,r8
             */

            case 0x30:

                return this.jrCondition(
                    !this.getFlagC()
                );


            /*
             * LD SP,d16
             */

            case 0x31:

                this.SP =
                    this.fetch16();

                return 12;


            /*
             * LD (HL-),A
             */

            case 0x32:

                this.memory.write(
                    this.getHL(),
                    this.A
                );

                this.setHL(
                    (this.getHL() - 1) & 0xFFFF
                );

                return 8;


            /*
             * INC SP
             */

            case 0x33:

                this.SP =
                    (this.SP + 1) & 0xFFFF;

                return 8;


            /*
             * INC (HL)
             */

            case 0x34: {

                const address =
                    this.getHL();

                const value =
                    this.memory.read(address);

                this.memory.write(
                    address,
                    this.inc8(value)
                );

                return 12;
            }


            /*
             * DEC (HL)
             */

            case 0x35: {

                const address =
                    this.getHL();

                const value =
                    this.memory.read(address);

                this.memory.write(
                    address,
                    this.dec8(value)
                );

                return 12;
            }


            /*
             * LD (HL),d8
             */

            case 0x36:

                this.memory.write(
                    this.getHL(),
                    this.fetch8()
                );

                return 12;


            /*
             * SCF
             */

            case 0x37:

                this.setFlagN(false);
                this.setFlagH(false);
                this.setFlagC(true);

                return 4;


            /*
             * JR C,r8
             */

            case 0x38:

                return this.jrCondition(
                    this.getFlagC()
                );


            /*
             * ADD HL,SP
             */

            case 0x39:

                this.addHL(
                    this.SP
                );

                return 8;


            /*
             * LD A,(HL-)
             */

            case 0x3A:

                this.A =
                    this.memory.read(
                        this.getHL()
                    );

                this.setHL(
                    (this.getHL() - 1) & 0xFFFF
                );

                return 8;


            /*
             * DEC SP
             */

            case 0x3B:

                this.SP =
                    (this.SP - 1) & 0xFFFF;

                return 8;


            /*
             * INC A
             */

            case 0x3C:

                this.A =
                    this.inc8(this.A);

                return 4;


            /*
             * DEC A
             */

            case 0x3D:

                this.A =
                    this.dec8(this.A);

                return 4;


            /*
             * LD A,d8
             */

            case 0x3E:

                this.A =
                    this.fetch8();

                return 8;


            /*
             * CCF
             */

            case 0x3F:

                this.setFlagN(false);
                this.setFlagH(false);

                this.setFlagC(
                    !this.getFlagC()
                );

                return 4;


            /*
             * LD B,B
             */

            case 0x40:
                return 4;

            case 0x41:
                this.B = this.C;
                return 4;

            case 0x42:
                this.B = this.D;
                return 4;

            case 0x43:
                this.B = this.E;
                return 4;

            case 0x44:
                this.B = this.H;
                return 4;

            case 0x45:
                this.B = this.L;
                return 4;

            case 0x46:
                this.B = this.memory.read(this.getHL());
                return 8;

            case 0x47:
                this.B = this.A;
                return 4;


            /*
             * LD C,r
             */

            case 0x48:
                this.C = this.B;
                return 4;

            case 0x49:
                return 4;

            case 0x4A:
                this.C = this.D;
                return 4;

            case 0x4B:
                this.C = this.E;
                return 4;

            case 0x4C:
                this.C = this.H;
                return 4;

            case 0x4D:
                this.C = this.L;
                return 4;

            case 0x4E:
                this.C = this.memory.read(this.getHL());
                return 8;

            case 0x4F:
                this.C = this.A;
                return 4;


            /*
             * LD D,r
             */

            case 0x50:
                this.D = this.B;
                return 4;

            case 0x51:
                this.D = this.C;
                return 4;

            case 0x52:
                return 4;

            case 0x53:
                this.D = this.E;
                return 4;

            case 0x54:
                this.D = this.H;
                return 4;

            case 0x55:
                this.D = this.L;
                return 4;

            case 0x56:
                this.D = this.memory.read(this.getHL());
                return 8;

            case 0x57:
                this.D = this.A;
                return 4;


            /*
             * LD E,r
             */

            case 0x58:
                this.E = this.B;
                return 4;

            case 0x59:
                this.E = this.C;
                return 4;

            case 0x5A:
                this.E = this.D;
                return 4;

            case 0x5B:
                return 4;

            case 0x5C:
                this.E = this.H;
                return 4;

            case 0x5D:
                this.E = this.L;
                return 4;

            case 0x5E:
                this.E = this.memory.read(this.getHL());
                return 8;

            case 0x5F:
                this.E = this.A;
                return 4;


            /*
             * LD H,r
             */

            case 0x60:
                this.H = this.B;
                return 4;

            case 0x61:
                this.H = this.C;
                return 4;

            case 0x62:
                this.H = this.D;
                return 4;

            case 0x63:
                this.H = this.E;
                return 4;

            case 0x64:
                return 4;

            case 0x65:
                this.H = this.L;
                return 4;

            case 0x66:
                this.H = this.memory.read(this.getHL());
                return 8;

            case 0x67:
                this.H = this.A;
                return 4;


            /*
             * LD L,r
             */

            case 0x68:
                this.L = this.B;
                return 4;

            case 0x69:
                this.L = this.C;
                return 4;

            case 0x6A:
                this.L = this.D;
                return 4;

            case 0x6B:
                this.L = this.E;
                return 4;

            case 0x6C:
                this.L = this.H;
                return 4;

            case 0x6D:
                return 4;

            case 0x6E:
                this.L = this.memory.read(this.getHL());
                return 8;

            case 0x6F:
                this.L = this.A;
                return 4;


            /*
             * LD (HL),r
             */

            case 0x70:
                this.memory.write(this.getHL(), this.B);
                return 8;

            case 0x71:
                this.memory.write(this.getHL(), this.C);
                return 8;

            case 0x72:
                this.memory.write(this.getHL(), this.D);
                return 8;

            case 0x73:
                this.memory.write(this.getHL(), this.E);
                return 8;

            case 0x74:
                this.memory.write(this.getHL(), this.H);
                return 8;

            case 0x75:
                this.memory.write(this.getHL(), this.L);
                return 8;


            /*
             * HALT
             */

            case 0x76:

                this.halted =
                    true;

                return 4;


            case 0x77:
                this.memory.write(this.getHL(), this.A);
                return 8;


            /*
             * LD A,r
             */

            case 0x78:
                this.A = this.B;
                return 4;

            case 0x79:
                this.A = this.C;
                return 4;

            case 0x7A:
                this.A = this.D;
                return 4;

            case 0x7B:
                this.A = this.E;
                return 4;

            case 0x7C:
                this.A = this.H;
                return 4;

            case 0x7D:
                this.A = this.L;
                return 4;

            case 0x7E:
                this.A = this.memory.read(this.getHL());
                return 8;

            case 0x7F:
                return 4;


            /*
             * ADD A,r
             */

            case 0x80:
                this.A = this.add8(this.A, this.B);
                return 4;

            case 0x81:
                this.A = this.add8(this.A, this.C);
                return 4;

            case 0x82:
                this.A = this.add8(this.A, this.D);
                return 4;

            case 0x83:
                this.A = this.add8(this.A, this.E);
                return 4;

            case 0x84:
                this.A = this.add8(this.A, this.H);
                return 4;

            case 0x85:
                this.A = this.add8(this.A, this.L);
                return 4;

            case 0x86:
                this.A =
                    this.add8(
                        this.A,
                        this.memory.read(
                            this.getHL()
                        )
                    );
                return 8;

            case 0x87:
                this.A = this.add8(this.A, this.A);
                return 4;


            /*
             * ADC A,r
             */

            case 0x88:
                this.A = this.adc8(this.A, this.B);
                return 4;

            case 0x89:
                this.A = this.adc8(this.A, this.C);
                return 4;

            case 0x8A:
                this.A = this.adc8(this.A, this.D);
                return 4;

            case 0x8B:
                this.A = this.adc8(this.A, this.E);
                return 4;

            case 0x8C:
                this.A = this.adc8(this.A, this.H);
                return 4;

            case 0x8D:
                this.A = this.adc8(this.A, this.L);
                return 4;

            case 0x8E:
                this.A =
                    this.adc8(
                        this.A,
                        this.memory.read(
                            this.getHL()
                        )
                    );
                return 8;

            case 0x8F:
                this.A = this.adc8(this.A, this.A);
                return 4;


            /*
             * SUB
             */

            case 0x90:
                this.A = this.sub8(this.A, this.B);
                return 4;

            case 0x91:
                this.A = this.sub8(this.A, this.C);
                return 4;

            case 0x92:
                this.A = this.sub8(this.A, this.D);
                return 4;

            case 0x93:
                this.A = this.sub8(this.A, this.E);
                return 4;

            case 0x94:
                this.A = this.sub8(this.A, this.H);
                return 4;

            case 0x95:
                this.A = this.sub8(this.A, this.L);
                return 4;

            case 0x96:
                this.A =
                    this.sub8(
                        this.A,
                        this.memory.read(
                            this.getHL()
                        )
                    );
                return 8;

            case 0x97:
                this.A = this.sub8(this.A, this.A);
                return 4;


            /*
             * SBC
             */

            case 0x98:
                this.A = this.sbc8(this.A, this.B);
                return 4;

            case 0x99:
                this.A = this.sbc8(this.A, this.C);
                return 4;

            case 0x9A:
                this.A = this.sbc8(this.A, this.D);
                return 4;

            case 0x9B:
                this.A = this.sbc8(this.A, this.E);
                return 4;

            case 0x9C:
                this.A = this.sbc8(this.A, this.H);
                return 4;

            case 0x9D:
                this.A = this.sbc8(this.A, this.L);
                return 4;

            case 0x9E:
                this.A =
                    this.sbc8(
                        this.A,
                        this.memory.read(
                            this.getHL()
                        )
                    );
                return 8;

            case 0x9F:
                this.A = this.sbc8(this.A, this.A);
                return 4;


            /*
             * AND
             */

            case 0xA0:
                this.A = this.and8(this.A, this.B);
                return 4;

            case 0xA1:
                this.A = this.and8(this.A, this.C);
                return 4;

            case 0xA2:
                this.A = this.and8(this.A, this.D);
                return 4;

            case 0xA3:
                this.A = this.and8(this.A, this.E);
                return 4;

            case 0xA4:
                this.A = this.and8(this.A, this.H);
                return 4;

            case 0xA5:
                this.A = this.and8(this.A, this.L);
                return 4;

            case 0xA6:
                this.A =
                    this.and8(
                        this.A,
                        this.memory.read(
                            this.getHL()
                        )
                    );
                return 8;

            case 0xA7:
                this.A = this.and8(this.A, this.A);
                return 4;


            /*
             * XOR
             */

            case 0xA8:
                this.A = this.xor8(this.A, this.B);
                return 4;

            case 0xA9:
                this.A = this.xor8(this.A, this.C);
                return 4;

            case 0xAA:
                this.A = this.xor8(this.A, this.D);
                return 4;

            case 0xAB:
                this.A = this.xor8(this.A, this.E);
                return 4;

            case 0xAC:
                this.A = this.xor8(this.A, this.H);
                return 4;

            case 0xAD:
                this.A = this.xor8(this.A, this.L);
                return 4;

            case 0xAE:
                this.A =
                    this.xor8(
                        this.A,
                        this.memory.read(
                            this.getHL()
                        )
                    );
                return 8;

            case 0xAF:
                this.A = this.xor8(this.A, this.A);
                return 4;


            /*
             * OR
             */

            case 0xB0:
                this.A = this.or8(this.A, this.B);
                return 4;

            case 0xB1:
                this.A = this.or8(this.A, this.C);
                return 4;

            case 0xB2:
                this.A = this.or8(this.A, this.D);
                return 4;

            case 0xB3:
                this.A = this.or8(this.A, this.E);
                return 4;

            case 0xB4:
                this.A = this.or8(this.A, this.H);
                return 4;

            case 0xB5:
                this.A = this.or8(this.A, this.L);
                return 4;

            case 0xB6:
                this.A =
                    this.or8(
                        this.A,
                        this.memory.read(
                            this.getHL()
                        )
                    );
                return 8;

            case 0xB7:
                this.A = this.or8(this.A, this.A);
                return 4;


            /*
             * CP
             */

            case 0xB8:
                this.cp8(this.A, this.B);
                return 4;

            case 0xB9:
                this.cp8(this.A, this.C);
                return 4;

            case 0xBA:
                this.cp8(this.A, this.D);
                return 4;

            case 0xBB:
                this.cp8(this.A, this.E);
                return 4;

            case 0xBC:
                this.cp8(this.A, this.H);
                return 4;

            case 0xBD:
                this.cp8(this.A, this.L);
                return 4;

            case 0xBE:
                this.cp8(
                    this.A,
                    this.memory.read(
                        this.getHL()
                    )
                );
                return 8;

            case 0xBF:
                this.cp8(this.A, this.A);
                return 4;


            /*
             * RET NZ
             */

            case 0xC0:

                if (!this.getFlagZ()) {

                    this.PC =
                        this.pop16();

                    return 20;

                }

                return 8;


            /*
             * POP BC
             */

            case 0xC1:

                this.setBC(
                    this.pop16()
                );

                return 12;


            /*
             * JP NZ,a16
             */

            case 0xC2:

                return this.jpCondition(
                    !this.getFlagZ()
                );


            /*
             * JP a16
             */

            case 0xC3:

                this.PC =
                    this.fetch16();

                return 16;


            /*
             * CALL NZ,a16
             */

            case 0xC4:

                return this.callCondition(
                    !this.getFlagZ()
                );


            /*
             * PUSH BC
             */

            case 0xC5:

                this.push16(
                    this.getBC()
                );

                return 16;


            /*
             * ADD A,d8
             */

            case 0xC6:

                this.A =
                    this.add8(
                        this.A,
                        this.fetch8()
                    );

                return 8;


            /*
             * RST 00
             */

            case 0xC7:

                this.rst(0x00);

                return 16;


            /*
             * RET Z
             */

            case 0xC8:

                if (this.getFlagZ()) {

                    this.PC =
                        this.pop16();

                    return 20;

                }

                return 8;


            /*
             * RET
             */

            case 0xC9:

                this.PC =
                    this.pop16();

                return 16;


            /*
             * JP Z,a16
             */

            case 0xCA:

                return this.jpCondition(
                    this.getFlagZ()
                );


            /*
             * CALL Z,a16
             */

            case 0xCC:

                return this.callCondition(
                    this.getFlagZ()
                );


            /*
             * CALL a16
             */

            case 0xCD:

                this.call(
                    this.fetch16()
                );

                return 24;


            /*
             * ADC A,d8
             */

            case 0xCE:

                this.A =
                    this.adc8(
                        this.A,
                        this.fetch8()
                    );

                return 8;


            /*
             * RST 08
             */

            case 0xCF:

                this.rst(0x08);

                return 16;


            /*
             * RET NC
             */

            case 0xD0:

                if (!this.getFlagC()) {

                    this.PC =
                        this.pop16();

                    return 20;

                }

                return 8;


            /*
             * POP DE
             */

            case 0xD1:

                this.setDE(
                    this.pop16()
                );

                return 12;


            /*
             * JP NC
             */

            case 0xD2:

                return this.jpCondition(
                    !this.getFlagC()
                );


            /*
             * CALL NC
             */

            case 0xD4:

                return this.callCondition(
                    !this.getFlagC()
                );


            /*
             * PUSH DE
             */

            case 0xD5:

                this.push16(
                    this.getDE()
                );

                return 16;


            /*
             * SUB d8
             */

            case 0xD6:

                this.A =
                    this.sub8(
                        this.A,
                        this.fetch8()
                    );

                return 8;


            /*
             * RST 10
             */

            case 0xD7:

                this.rst(0x10);

                return 16;


            /*
             * RET C
             */

            case 0xD8:

                if (this.getFlagC()) {

                    this.PC =
                        this.pop16();

                    return 20;

                }

                return 8;


            /*
             * JP C
             */

            case 0xDA:

                return this.jpCondition(
                    this.getFlagC()
                );


            /*
             * SBC d8
             */

            case 0xDE:

                this.A =
                    this.sbc8(
                        this.A,
                        this.fetch8()
                    );

                return 8;


            /*
             * RST 18
             */

            case 0xDF:

                this.rst(0x18);

                return 16;


            /*
             * POP HL
             */

            case 0xE1:

                this.setHL(
                    this.pop16()
                );

                return 12;


            /*
             * JP HL
             */

            case 0xE9:

                this.PC =
                    this.getHL();

                return 4;


            /*
             * PUSH HL
             */

            case 0xE5:

                this.push16(
                    this.getHL()
                );

                return 16;


            /*
             * AND d8
             */

            case 0xE6:

                this.A =
                    this.and8(
                        this.A,
                        this.fetch8()
                    );

                return 8;


            /*
             * RST 20
             */

            case 0xE7:

                this.rst(0x20);

                return 16;


            /*
             * LDH (a8),A
             */

            case 0xE0: {

                const offset =
                    this.fetch8();

                this.memory.write(
                    0xFF00 + offset,
                    this.A
                );

                return 12;
            }


            /*
             * LD (C),A
             */

            case 0xE2:

                this.memory.write(
                    0xFF00 + this.C,
                    this.A
                );

                return 8;


            /*
             * XOR d8
             */

            case 0xEE:

                this.A =
                    this.xor8(
                        this.A,
                        this.fetch8()
                    );

                return 8;


            /*
             * RST 28
             */

            case 0xEF:

                this.rst(0x28);

                return 16;


            /*
             * RET Z / remaining stack operations
             */

            case 0xF1:

                this.setAF(
                    this.pop16()
                );

                return 12;


            /*
             * DI
             */

            case 0xF3:

                this.ime =
                    false;

                this.imeDelay =
                    0;

                return 4;


            /*
             * PUSH AF
             */

            case 0xF5:

                this.push16(
                    this.getAF()
                );

                return 16;


            /*
             * OR d8
             */

            case 0xF6:

                this.A =
                    this.or8(
                        this.A,
                        this.fetch8()
                    );

                return 8;


            /*
             * RST 30
             */

            case 0xF7:

                this.rst(0x30);

                return 16;


            /*
             * LDH A,(a8)
             */

            case 0xF0: {

                const offset =
                    this.fetch8();

                this.A =
                    this.memory.read(
                        0xFF00 + offset
                    );

                return 12;
            }


            /*
             * LD A,(C)
             */

            case 0xF2:

                this.A =
                    this.memory.read(
                        0xFF00 + this.C
                    );

                return 8;


            /*
             * EI
             */

            case 0xFB:

                this.imeDelay =
                    2;

                return 4;


            /*
             * CP d8
             */

            case 0xFE:

                this.cp8(
                    this.A,
                    this.fetch8()
                );

                return 8;


            /*
             * RST 38
             */

            case 0xFF:

                this.rst(0x38);

                return 16;


            /*
             * CB PREFIX
             */

            case 0xCB:

                return this.executeCB(
                    this.fetch8()
                );


            /*
             * Unsupported opcode
             */

            default:

                throw new Error(
                    `Unimplemented Game Boy opcode: ` +
                    `0x${opcode.toString(16).padStart(2, "0")}`
                );

        }

    }


    /*
     * ========================================================
     * CB INSTRUCTIONS
     * ========================================================
     */

    executeCB(opcode) {

        const group =
            opcode >> 6;

        const bit =
            (opcode >> 3) & 7;

        const target =
            opcode & 7;


        /*
         * ----------------------------------------------------
         * Target helpers
         * ----------------------------------------------------
         */

        const getTarget = () => {

            switch (target) {

                case 0: return this.B;
                case 1: return this.C;
                case 2: return this.D;
                case 3: return this.E;
                case 4: return this.H;
                case 5: return this.L;
                case 6:
                    return this.memory.read(
                        this.getHL()
                    );
                case 7: return this.A;

            }

        };


        const setTarget = value => {

            value &=
                0xFF;


            switch (target) {

                case 0:
                    this.B = value;
                    break;

                case 1:
                    this.C = value;
                    break;

                case 2:
                    this.D = value;
                    break;

                case 3:
                    this.E = value;
                    break;

                case 4:
                    this.H = value;
                    break;

                case 5:
                    this.L = value;
                    break;

                case 6:

                    this.memory.write(
                        this.getHL(),
                        value
                    );

                    break;

                case 7:
                    this.A = value;
                    break;

            }

        };


        /*
         * ----------------------------------------------------
         * BIT
         * ----------------------------------------------------
         */

        if (group === 1) {

            const value =
                getTarget();


            this.setFlagZ(
                (value & (1 << bit)) === 0
            );

            this.setFlagN(false);

            this.setFlagH(true);


            return target === 6
                ? 12
                : 8;

        }


        /*
         * ----------------------------------------------------
         * RES
         * ----------------------------------------------------
         */

        if (group === 2) {

            const value =
                getTarget();


            setTarget(
                value &
                ~(1 << bit)
            );


            return target === 6
                ? 16
                : 8;

        }


        /*
         * ----------------------------------------------------
         * SET
         * ----------------------------------------------------
         */

        if (group === 3) {

            const value =
                getTarget();


            setTarget(
                value |
                (1 << bit)
            );


            return target === 6
                ? 16
                : 8;

        }


        /*
         * ----------------------------------------------------
         * ROTATE / SHIFT
         * ----------------------------------------------------
         */

        let value =
            getTarget();


        let result =
            value;


        switch (bit) {

            /*
             * RLC
             */

            case 0:

                result =
                    (
                        (value << 1) |
                        (value >> 7)
                    ) & 0xFF;


                this.setFlagZ(
                    result === 0
                );

                this.setFlagN(false);
                this.setFlagH(false);

                this.setFlagC(
                    (value & 0x80) !== 0
                );

                break;


            /*
             * RRC
             */

            case 1:

                result =
                    (
                        (value >> 1) |
                        ((value & 1) << 7)
                    ) & 0xFF;


                this.setFlagZ(
                    result === 0
                );

                this.setFlagN(false);
                this.setFlagH(false);

                this.setFlagC(
                    (value & 1) !== 0
                );

                break;


            /*
             * RL
             */

            case 2: {

                const carry =
                    this.getFlagC()
                        ? 1
                        : 0;


                const newCarry =
                    (value & 0x80) !== 0;


                result =
                    (
                        (value << 1) |
                        carry
                    ) & 0xFF;


                this.setFlagZ(
                    result === 0
                );

                this.setFlagN(false);
                this.setFlagH(false);

                this.setFlagC(
                    newCarry
                );

                break;
            }


            /*
             * RR
             */

            case 3: {

                const carry =
                    this.getFlagC()
                        ? 0x80
                        : 0;


                const newCarry =
                    (value & 1) !== 0;


                result =
                    (
                        (value >> 1) |
                        carry
                    ) & 0xFF;


                this.setFlagZ(
                    result === 0
                );

                this.setFlagN(false);
                this.setFlagH(false);

                this.setFlagC(
                    newCarry
                );

                break;
            }


            /*
             * SLA
             */

            case 4:

                this.setFlagC(
                    (value & 0x80) !== 0
                );


                result =
                    (value << 1) & 0xFF;


                this.setFlagZ(
                    result === 0
                );

                this.setFlagN(false);
                this.setFlagH(false);

                break;


            /*
             * SRA
             */

            case 5:

                this.setFlagC(
                    (value & 1) !== 0
                );


                result =
                    (
                        (value >> 1) |
                        (value & 0x80)
                    ) & 0xFF;


                this.setFlagZ(
                    result === 0
                );

                this.setFlagN(false);
                this.setFlagH(false);

                break;


            /*
             * SWAP
             */

            case 6:

                result =
                    (
                        ((value & 0x0F) << 4) |
                        ((value & 0xF0) >> 4)
                    );


                this.setFlagZ(
                    result === 0
                );

                this.setFlagN(false);
                this.setFlagH(false);
                this.setFlagC(false);

                break;


            /*
             * SRL
             */

            case 7:

                this.setFlagC(
                    (value & 1) !== 0
                );


                result =
                    value >> 1;


                this.setFlagZ(
                    result === 0
                );

                this.setFlagN(false);
                this.setFlagH(false);

                break;

        }


        setTarget(
            result
        );


        return target === 6
            ? 16
            : 8;

    }


    /*
     * ========================================================
     * 8-BIT ARITHMETIC
     * ========================================================
     */

    add8(a, b) {

        const result =
            a + b;


        this.setFlagZ(
            (result & 0xFF) === 0
        );

        this.setFlagN(false);

        this.setFlagH(
            ((a & 0x0F) + (b & 0x0F)) > 0x0F
        );

        this.setFlagC(
            result > 0xFF
        );


        return result & 0xFF;

    }


    adc8(a, b) {

        const carry =
            this.getFlagC()
                ? 1
                : 0;


        const result =
            a + b + carry;


        this.setFlagZ(
            (result & 0xFF) === 0
        );

        this.setFlagN(false);

        this.setFlagH(
            ((a & 0x0F) +
             (b & 0x0F) +
             carry) > 0x0F
        );

        this.setFlagC(
            result > 0xFF
        );


        return result & 0xFF;

    }


    sub8(a, b) {

        const result =
            a - b;


        this.setFlagZ(
            (result & 0xFF) === 0
        );

        this.setFlagN(true);

        this.setFlagH(
            (a & 0x0F) <
            (b & 0x0F)
        );

        this.setFlagC(
            a < b
        );


        return result & 0xFF;

    }


    sbc8(a, b) {

        const carry =
            this.getFlagC()
                ? 1
                : 0;


        const result =
            a - b - carry;


        this.setFlagZ(
            (result & 0xFF) === 0
        );

        this.setFlagN(true);

        this.setFlagH(
            (a & 0x0F) <
            ((b & 0x0F) + carry)
        );

        this.setFlagC(
            result < 0
        );


        return result & 0xFF;

    }


    inc8(value) {

        const result =
            (value + 1) & 0xFF;


        this.setFlagZ(
            result === 0
        );

        this.setFlagN(false);

        this.setFlagH(
            (value & 0x0F) === 0x0F
        );


        return result;

    }


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


    and8(a, b) {

        const result =
            a & b;


        this.setFlagZ(
            result === 0
        );

        this.setFlagN(false);

        this.setFlagH(true);

        this.setFlagC(false);


        return result;

    }


    xor8(a, b) {

        const result =
            a ^ b;


        this.setFlagZ(
            result === 0
        );

        this.setFlagN(false);

        this.setFlagH(false);

        this.setFlagC(false);


        return result;

    }


    or8(a, b) {

        const result =
            a | b;


        this.setFlagZ(
            result === 0
        );

        this.setFlagN(false);

        this.setFlagH(false);

        this.setFlagC(false);


        return result;

    }


    cp8(a, b) {

        this.sub8(
            a,
            b
        );

    }


    /*
     * ========================================================
     * 16-BIT ADD
     * ========================================================
     */

    addHL(value) {

        const hl =
            this.getHL();


        const result =
            hl + value;


        this.setFlagN(false);

        this.setFlagH(
            ((hl & 0x0FFF) +
             (value & 0x0FFF)) > 0x0FFF
        );

        this.setFlagC(
            result > 0xFFFF
        );


        this.setHL(
            result & 0xFFFF
        );

    }


    /*
     * ========================================================
     * ROTATES
     * ========================================================
     */

    rlca() {

        const carry =
            (this.A & 0x80) !== 0;


        this.A =
            (
                (this.A << 1) |
                (carry ? 1 : 0)
            ) & 0xFF;


        this.setFlagZ(false);
        this.setFlagN(false);
        this.setFlagH(false);
        this.setFlagC(carry);

    }


    rrca() {

        const carry =
            (this.A & 1) !== 0;


        this.A =
            (
                (this.A >> 1) |
                (carry ? 0x80 : 0)
            );


        this.setFlagZ(false);
        this.setFlagN(false);
        this.setFlagH(false);
        this.setFlagC(carry);

    }


    rla() {

        const oldCarry =
            this.getFlagC();


        const newCarry =
            (this.A & 0x80) !== 0;


        this.A =
            (
                (this.A << 1) |
                (oldCarry ? 1 : 0)
            ) & 0xFF;


        this.setFlagZ(false);
        this.setFlagN(false);
        this.setFlagH(false);
        this.setFlagC(newCarry);

    }


    rra() {

        const oldCarry =
            this.getFlagC();


        const newCarry =
            (this.A & 1) !== 0;


        this.A =
            (
                (this.A >> 1) |
                (oldCarry ? 0x80 : 0)
            );


        this.setFlagZ(false);
        this.setFlagN(false);
        this.setFlagH(false);
        this.setFlagC(newCarry);

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
            this.getFlagC();


        if (!this.getFlagN()) {

            if (
                this.getFlagH() ||
                (this.A & 0x0F) > 9
            ) {

                correction |=
                    0x06;

            }


            if (
                carry ||
                this.A > 0x99
            ) {

                correction |=
                    0x60;

                carry =
                    true;

            }


            this.A =
                (
                    this.A +
                    correction
                ) & 0xFF;

        } else {

            if (this.getFlagH()) {

                correction |=
                    0x06;

            }


            if (carry) {

                correction |=
                    0x60;

            }


            this.A =
                (
                    this.A -
                    correction
                ) & 0xFF;

        }


        this.setFlagZ(
            this.A === 0
        );

        this.setFlagH(false);

        this.setFlagC(carry);

    }


    /*
     * ========================================================
     * JUMP
     * ========================================================
     */

    jr() {

        const offset =
            this.fetch8();


        const signed =
            offset < 0x80
                ? offset
                : offset - 0x100;


        this.PC =
            (
                this.PC +
                signed
            ) & 0xFFFF;

    }


    jrCondition(
        condition
    ) {

        const offset =
            this.fetch8();


        if (!condition) {

            return 8;

        }


        const signed =
            offset < 0x80
                ? offset
                : offset - 0x100;


        this.PC =
            (
                this.PC +
                signed
            ) & 0xFFFF;


        return 12;

    }


    jpCondition(
        condition
    ) {

        const address =
            this.fetch16();


        if (condition) {

            this.PC =
                address;

            return 16;

        }


        return 12;

    }


    /*
     * ========================================================
     * CALL
     * ========================================================
     */

    call(address) {

        this.push16(
            this.PC
        );


        this.PC =
            address;

    }


    callCondition(
        condition
    ) {

        const address =
            this.fetch16();


        if (!condition) {

            return 12;

        }


        this.call(
            address
        );


        return 24;

    }


    /*
     * ========================================================
     * RST
     * ========================================================
     */

    rst(address) {

        this.push16(
            this.PC
        );


        this.PC =
            address;

    }


    /*
     * ========================================================
     * STACK
     * ========================================================
     */

    push16(value) {

        this.SP =
            (this.SP - 1) & 0xFFFF;


        this.memory.write(
            this.SP,
            (value >> 8) & 0xFF
        );


        this.SP =
            (this.SP - 1) & 0xFFFF;


        this.memory.write(
            this.SP,
            value & 0xFF
        );

    }


    pop16() {

        const low =
            this.memory.read(
                this.SP
            );


        this.SP =
            (this.SP + 1) & 0xFFFF;


        const high =
            this.memory.read(
                this.SP
            );


        this.SP =
            (this.SP + 1) & 0xFFFF;


        return (
            low |
            (high << 8)
        );

    }


    /*
     * ========================================================
     * REGISTER PAIRS
     * ========================================================
     */

    getAF() {

        return (
            (this.A << 8) |
            (this.F & 0xF0)
        );

    }


    setAF(value) {

        this.A =
            (value >> 8) & 0xFF;


        this.F =
            value & 0xF0;

    }


    getBC() {

        return (
            (this.B << 8) |
            this.C
        );

    }


    setBC(value) {

        this.B =
            (value >> 8) & 0xFF;


        this.C =
            value & 0xFF;

    }


    getDE() {

        return (
            (this.D << 8) |
            this.E
        );

    }


    setDE(value) {

        this.D =
            (value >> 8) & 0xFF;


        this.E =
            value & 0xFF;

    }


    getHL() {

        return (
            (this.H << 8) |
            this.L
        );

    }


    setHL(value) {

        this.H =
            (value >> 8) & 0xFF;


        this.L =
            value & 0xFF;

    }


    /*
     * ========================================================
     * FLAGS
     * ========================================================
     */

    getFlagZ() {

        return (
            (this.F & 0x80) !== 0
        );

    }


    getFlagN() {

        return (
            (this.F & 0x40) !== 0
        );

    }


    getFlagH() {

        return (
            (this.F & 0x20) !== 0
        );

    }


    getFlagC() {

        return (
            (this.F & 0x10) !== 0
        );

    }


    setFlagZ(value) {

        this.F =
            value
                ? this.F | 0x80
                : this.F & ~0x80;

        this.F &= 0xF0;

    }


    setFlagN(value) {

        this.F =
            value
                ? this.F | 0x40
                : this.F & ~0x40;

        this.F &= 0xF0;

    }


    setFlagH(value) {

        this.F =
            value
                ? this.F | 0x20
                : this.F & ~0x20;

        this.F &= 0xF0;

    }


    setFlagC(value) {

        this.F =
            value
                ? this.F | 0x10
                : this.F & ~0x10;

        this.F &= 0xF0;

    }


    /*
     * ========================================================
     * INTERRUPTS
     * ========================================================
     */

    hasPendingInterrupt() {

        const ie =
            this.memory.read(
                0xFFFF
            );


        const flags =
            this.memory.read(
                0xFF0F
            );


        return (
            (ie & flags & 0x1F) !== 0
        );

    }


    serviceInterrupt() {

        const ie =
            this.memory.read(
                0xFFFF
            );


        let flags =
            this.memory.read(
                0xFF0F
            );


        const pending =
            ie &
            flags &
            0x1F;


        if (!pending) {

            return 0;

        }


        let vector;


        if (pending & 0x01) {

            vector =
                0x40;

            flags &=
                ~0x01;

        } else if (pending & 0x02) {

            vector =
                0x48;

            flags &=
                ~0x02;

        } else if (pending & 0x04) {

            vector =
                0x50;

            flags &=
                ~0x04;

        } else if (pending & 0x08) {

            vector =
                0x58;

            flags &=
                ~0x08;

        } else {

            vector =
                0x60;

            flags &=
                ~0x10;

        }


        this.memory.write(
            0xFF0F,
            flags
        );


        this.ime =
            false;


        this.halted =
            false;


        this.push16(
            this.PC
        );


        this.PC =
            vector;


        this.cycles +=
            20;


        return 20;

    }


    /*
     * ========================================================
     * DEBUG
     * ========================================================
     */

    getState() {

        return {

            A: this.A,
            F: this.F,

            B: this.B,
            C: this.C,

            D: this.D,
            E: this.E,

            H: this.H,
            L: this.L,

            AF: this.getAF(),
            BC: this.getBC(),
            DE: this.getDE(),
            HL: this.getHL(),

            SP: this.SP,
            PC: this.PC,

            halted: this.halted,
            stopped: this.stopped,

            ime: this.ime,

            cycles: this.cycles,

            opcode:
                this.lastOpcode

        };

    }


    dumpRegisters() {

        console.table(
            this.getState()
        );

    }

}


/*
 * ============================================================
 * DEFAULT EXPORT
 * ============================================================
 */

export default GameBoyCPU;
