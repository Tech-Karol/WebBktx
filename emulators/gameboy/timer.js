/*
 * ============================================================
 * WebBktx — Game Boy Timer
 * ============================================================
 *
 * Registers:
 *
 * FF04 = DIV
 * FF05 = TIMA
 * FF06 = TMA
 * FF07 = TAC
 *
 * Interrupt:
 *
 * IF bit 2 = Timer interrupt
 *
 * ============================================================
 */

export default class GameBoyTimer {

    constructor(memory) {

        this.memory = memory;

        /*
         * Internal 16-bit divider.
         *
         * DIV is the upper 8 bits.
         */

        this.divider = 0;


        /*
         * TIMA overflow state.
         */

        this.reloadPending = false;

        this.reloadDelay = 0;


        /*
         * Timer frequencies.
         *
         * CPU clock:
         *
         * 4,194,304 Hz
         *
         * TAC:
         *
         * 00 = 4096 Hz
         * 01 = 262144 Hz
         * 10 = 65536 Hz
         * 11 = 16384 Hz
         */

        this.timerCycles = 0;


        /*
         * Last timer signal.
         *
         * Used for falling-edge detection.
         */

        this.timerSignal = false;

    }


    /*
     * ========================================================
     * RESET
     * ========================================================
     */

    reset() {

        this.divider = 0;

        this.timerCycles = 0;

        this.reloadPending = false;

        this.reloadDelay = 0;

        this.timerSignal = false;


        this.writeRegister(
            0xFF04,
            0x00
        );

        this.writeRegister(
            0xFF05,
            0x00
        );

        this.writeRegister(
            0xFF06,
            0x00
        );

        this.writeRegister(
            0xFF07,
            0x00
        );

    }


    /*
     * ========================================================
     * STEP
     * ========================================================
     *
     * cycles = number of CPU T-cycles
     *
     * ========================================================
     */

    step(cycles = 4) {

        for (
            let i = 0;
            i < cycles;
            i++
        ) {

            this.stepCycle();

        }

    }


    /*
     * ========================================================
     * SINGLE CPU CYCLE
     * ========================================================
     */

    stepCycle() {

        /*
         * ----------------------------------------------------
         * Divider
         * ----------------------------------------------------
         *
         * DIV increments every 256 T-cycles.
         *
         * Internal divider increments every T-cycle.
         */

        const oldDivider =
            this.divider;


        this.divider =
            (
                this.divider + 1
            ) & 0xFFFF;


        /*
         * Update FF04.
         */

        this.writeRegister(
            0xFF04,
            (this.divider >> 8) & 0xFF
        );


        /*
         * ----------------------------------------------------
         * Timer signal
         * ----------------------------------------------------
         */

        const oldSignal =
            this.getTimerSignal(
                oldDivider
            );


        const newSignal =
            this.getTimerSignal(
                this.divider
            );


        /*
         * Timer increments on falling edge.
         */

        if (
            oldSignal &&
            !newSignal
        ) {

            this.incrementTIMA();

        }


        this.timerSignal =
            newSignal;


        /*
         * ----------------------------------------------------
         * Delayed TIMA reload
         * ----------------------------------------------------
         */

        if (
            this.reloadPending
        ) {

            this.reloadDelay--;


            if (
                this.reloadDelay <= 0
            ) {

                this.reloadPending =
                    false;


                this.writeRegister(
                    0xFF05,
                    this.readRegister(
                        0xFF06
                    )
                );


                /*
                 * Timer interrupt.
                 */

                this.requestInterrupt();

            }

        }

    }


    /*
     * ========================================================
     * TIMER SIGNAL
     * ========================================================
     *
     * Timer input is based on selected divider bit.
     *
     * TAC:
     *
     * bit 2 = timer enable
     * bits 1-0 = frequency
     *
     * ========================================================
     */

    getTimerSignal(divider) {

        const tac =
            this.readRegister(
                0xFF07
            );


        /*
         * Timer disabled.
         */

        if (!(tac & 0x04)) {

            return false;

        }


        const frequency =
            tac & 0x03;


        let bit;


        switch (
            frequency
        ) {

            /*
             * 4096 Hz
             *
             * divider bit 9
             */

            case 0:

                bit = 9;

                break;


            /*
             * 262144 Hz
             *
             * divider bit 3
             */

            case 1:

                bit = 3;

                break;


            /*
             * 65536 Hz
             *
             * divider bit 5
             */

            case 2:

                bit = 5;

                break;


            /*
             * 16384 Hz
             *
             * divider bit 7
             */

            case 3:

                bit = 7;

                break;


            default:

                bit = 9;

        }


        return (
            (divider &
                (1 << bit)) !== 0
        );

    }


    /*
     * ========================================================
     * TIMA
     * ========================================================
     */

    incrementTIMA() {

        const tima =
            this.readRegister(
                0xFF05
            );


        /*
         * Normal increment.
         */

        if (
            tima !== 0xFF
        ) {

            this.writeRegister(
                0xFF05,
                tima + 1
            );

            return;

        }


        /*
         * Overflow.
         *
         * Hardware reloads TMA and
         * requests timer interrupt.
         */

        this.writeRegister(
            0xFF05,
            0x00
        );


        this.reloadPending =
            true;


        /*
         * Delay is represented in
         * internal timer cycles.
         */

        this.reloadDelay =
            1;

    }


    /*
     * ========================================================
     * TIMER INTERRUPT
     * ========================================================
     */

    requestInterrupt() {

        const flags =
            this.readRegister(
                0xFF0F
            );


        this.writeRegister(
            0xFF0F,
            flags | 0x04
        );

    }


    /*
     * ========================================================
     * READ
     * ========================================================
     */

    read(address) {

        return this.readRegister(
            address
        );

    }


    /*
     * ========================================================
     * WRITE
     * ========================================================
     */

    write(
        address,
        value
    ) {

        value &=
            0xFF;


        /*
         * ----------------------------------------------------
         * DIV
         * ----------------------------------------------------
         *
         * Writing any value to DIV resets it.
         */

        if (
            address === 0xFF04
        ) {

            /*
             * Reset divider.
             */

            this.divider =
                0;


            this.writeRegister(
                0xFF04,
                0
            );


            /*
             * Reset signal.
             */

            this.timerSignal =
                this.getTimerSignal(
                    this.divider
                );


            return;

        }


        /*
         * ----------------------------------------------------
         * TIMA
         * ----------------------------------------------------
         */

        if (
            address === 0xFF05
        ) {

            this.writeRegister(
                0xFF05,
                value
            );


            /*
             * Writing TIMA during reload
             * cancels pending reload.
             */

            if (
                this.reloadPending
            ) {

                this.reloadPending =
                    false;

            }


            return;

        }


        /*
         * ----------------------------------------------------
         * TMA
         * ----------------------------------------------------
         */

        if (
            address === 0xFF06
        ) {

            this.writeRegister(
                0xFF06,
                value
            );


            return;

        }


        /*
         * ----------------------------------------------------
         * TAC
         * ----------------------------------------------------
         */

        if (
            address === 0xFF07
        ) {

            /*
             * Only lower 3 bits are writable.
             */

            const oldTAC =
                this.readRegister(
                    0xFF07
                );


            const oldSignal =
                this.getTimerSignal(
                    this.divider
                );


            this.writeRegister(
                0xFF07,
                value | 0xF8
            );


            const newSignal =
                this.getTimerSignal(
                    this.divider
                );


            /*
             * TAC changes can cause
             * a timer falling edge.
             */

            if (
                oldSignal &&
                !newSignal
            ) {

                this.incrementTIMA();

            }


            this.timerSignal =
                newSignal;


            return;

        }


        this.writeRegister(
            address,
            value
        );

    }


    /*
     * ========================================================
     * INTERNAL READ
     * ========================================================
     */

    readRegister(address) {

        if (
            this.memory &&
            typeof this.memory.read ===
            "function"
        ) {

            return this.memory.read(
                address
            ) & 0xFF;

        }


        return 0xFF;

    }


    /*
     * ========================================================
     * INTERNAL WRITE
     * ========================================================
     */

    writeRegister(
        address,
        value
    ) {

        if (
            this.memory &&
            typeof this.memory.write ===
            "function"
        ) {

            this.memory.write(
                address,
                value & 0xFF
            );

        }

    }


    /*
     * ========================================================
     * STATE
     * ========================================================
     */

    getState() {

        return {

            divider:
                this.divider,

            div:
                this.readRegister(
                    0xFF04
                ),

            tima:
                this.readRegister(
                    0xFF05
                ),

            tma:
                this.readRegister(
                    0xFF06
                ),

            tac:
                this.readRegister(
                    0xFF07
                ),

            enabled:
                Boolean(
                    this.readRegister(
                        0xFF07
                    ) & 0x04
                ),

            reloadPending:
                this.reloadPending

        };

    }

}
