/*
 * ============================================================
 * WebBktx CPU
 *
 * Version: 0.7B
 *
 * Experimental 32-bit x86 CPU
 *
 * Features:
 *   - 8 general-purpose registers
 *   - EIP
 *   - EFLAGS
 *   - stack
 *   - memory access
 *   - CPU reset
 *   - instruction stepping
 *   - execution cycle counter
 *   - basic arithmetic helpers
 *   - flags
 *   - safe execution limit
 *
 * Instructions are decoded by decoder.js.
 *
 * ============================================================
 */

"use strict";


/* ============================================================
   FLAGS
============================================================ */

const X86_FLAGS = {

    CF: 1 << 0,
    ZF: 1 << 6,
    SF: 1 << 7,
    OF: 1 << 11

};


/* ============================================================
   CPU
============================================================ */

class WebBktxCPU {

    constructor(memory) {

        if (!memory) {

            throw new Error(
                "WebBktxCPU requires a memory object."
            );

        }


        this.memory =
            memory;


        /* ----------------------------------------------------
           GENERAL PURPOSE REGISTERS
        ---------------------------------------------------- */

        this.EAX = 0;
        this.EBX = 0;
        this.ECX = 0;
        this.EDX = 0;

        this.ESI = 0;
        this.EDI = 0;

        this.EBP = 0;
        this.ESP = 0;


        /* ----------------------------------------------------
           PROGRAM COUNTER
        ---------------------------------------------------- */

        this.EIP = 0;


        /* ----------------------------------------------------
           FLAGS
        ---------------------------------------------------- */

        this.EFLAGS = 0;


        /* ----------------------------------------------------
           EXECUTION STATE
        ---------------------------------------------------- */

        this.running = false;

        this.halted = false;

        this.cycles = 0;

        this.instructionsExecuted = 0;


        /*
         * Maximum number of instructions allowed
         * during one run().
         */

        this.maxInstructions =
            100000;


        /*
         * Decoder will be attached later.
         */

        this.decoder = null;


        /*
         * Optional debugging callback.
         */

        this.onInstruction = null;

    }


    /* ========================================================
       RESET
    ======================================================== */

    reset() {

        this.EAX = 0;
        this.EBX = 0;
        this.ECX = 0;
        this.EDX = 0;

        this.ESI = 0;
        this.EDI = 0;

        this.EBP = 0;

        /*
         * Put the stack near the end of RAM.
         */

        this.ESP =
            this.memory.size - 4;


        this.EIP = 0;

        this.EFLAGS = 0;


        this.running = false;

        this.halted = false;

        this.cycles = 0;

        this.instructionsExecuted = 0;

    }


    /* ========================================================
       REGISTER ACCESS
    ======================================================== */

    getRegister(name) {

        const register =
            String(name).toUpperCase();


        switch (register) {

            case "EAX":
                return this.EAX;

            case "EBX":
                return this.EBX;

            case "ECX":
                return this.ECX;

            case "EDX":
                return this.EDX;

            case "ESI":
                return this.ESI;

            case "EDI":
                return this.EDI;

            case "EBP":
                return this.EBP;

            case "ESP":
                return this.ESP;

            default:

                throw new Error(
                    `Unknown register: ${register}`
                );

        }

    }


    setRegister(
        name,
        value
    ) {

        const register =
            String(name).toUpperCase();


        const normalized =
            value >>> 0;


        switch (register) {

            case "EAX":
                this.EAX = normalized;
                break;

            case "EBX":
                this.EBX = normalized;
                break;

            case "ECX":
                this.ECX = normalized;
                break;

            case "EDX":
                this.EDX = normalized;
                break;

            case "ESI":
                this.ESI = normalized;
                break;

            case "EDI":
                this.EDI = normalized;
                break;

            case "EBP":
                this.EBP = normalized;
                break;

            case "ESP":
                this.ESP = normalized;
                break;

            default:

                throw new Error(
                    `Unknown register: ${register}`
                );

        }

    }


    /* ========================================================
       REGISTER SNAPSHOT
    ======================================================== */

    getRegisters() {

        return {

            EAX: this.EAX >>> 0,
            EBX: this.EBX >>> 0,
            ECX: this.ECX >>> 0,
            EDX: this.EDX >>> 0,

            ESI: this.ESI >>> 0,
            EDI: this.EDI >>> 0,

            EBP: this.EBP >>> 0,
            ESP: this.ESP >>> 0,

            EIP: this.EIP >>> 0,

            EFLAGS:
                this.EFLAGS >>> 0

        };

    }


    /* ========================================================
       FLAG HELPERS
    ======================================================== */

    getFlag(flag) {

        return (
            (this.EFLAGS & flag) !== 0
        );

    }


    setFlag(
        flag,
        enabled
    ) {

        if (enabled) {

            this.EFLAGS |= flag;

        } else {

            this.EFLAGS &= ~flag;

        }


        this.EFLAGS >>>= 0;

    }


    clearFlags() {

        this.EFLAGS = 0;

    }


    /* ========================================================
       UPDATE FLAGS
    ======================================================== */

    updateLogicFlags(
        result
    ) {

        result >>>= 0;


        this.setFlag(
            X86_FLAGS.ZF,
            result === 0
        );


        this.setFlag(
            X86_FLAGS.SF,
            (result & 0x80000000) !== 0
        );


        /*
         * Logical operations clear CF and OF.
         */

        this.setFlag(
            X86_FLAGS.CF,
            false
        );


        this.setFlag(
            X86_FLAGS.OF,
            false
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


        /*
         * Carry.
         */

        this.setFlag(
            X86_FLAGS.CF,
            result < a
        );


        /*
         * Zero.
         */

        this.setFlag(
            X86_FLAGS.ZF,
            result === 0
        );


        /*
         * Sign.
         */

        this.setFlag(
            X86_FLAGS.SF,
            (result & 0x80000000) !== 0
        );


        /*
         * Signed overflow.
         */

        const overflow =
            (
                ((a ^ result) & 0x80000000) !== 0 &&
                ((b ^ result) & 0x80000000) !== 0
            );


        this.setFlag(
            X86_FLAGS.OF,
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


        /*
         * Borrow / carry.
         */

        this.setFlag(
            X86_FLAGS.CF,
            a < b
        );


        this.setFlag(
            X86_FLAGS.ZF,
            result === 0
        );


        this.setFlag(
            X86_FLAGS.SF,
            (result & 0x80000000) !== 0
        );


        /*
         * Signed overflow.
         */

        const overflow =
            (
                ((a ^ b) & 0x80000000) !== 0 &&
                ((a ^ result) & 0x80000000) !== 0
            );


        this.setFlag(
            X86_FLAGS.OF,
            overflow
        );

    }


    /* ========================================================
       ARITHMETIC
    ======================================================== */

    add32(
        a,
        b
    ) {

        a >>>= 0;
        b >>>= 0;


        const result =
            (a + b) >>> 0;


        this.updateAddFlags(
            a,
            b,
            result
        );


        return result;

    }


    sub32(
        a,
        b
    ) {

        a >>>= 0;
        b >>>= 0;


        const result =
            (a - b) >>> 0;


        this.updateSubFlags(
            a,
            b,
            result
        );


        return result;

    }


    inc32(value) {

        value >>>= 0;


        const result =
            (value + 1) >>> 0;


        /*
         * INC does not modify CF.
         */

        const oldCF =
            this.getFlag(
                X86_FLAGS.CF
            );


        this.updateAddFlags(
            value,
            1,
            result
        );


        this.setFlag(
            X86_FLAGS.CF,
            oldCF
        );


        return result;

    }


    dec32(value) {

        value >>>= 0;


        const result =
            (value - 1) >>> 0;


        /*
         * DEC does not modify CF.
         */

        const oldCF =
            this.getFlag(
                X86_FLAGS.CF
            );


        this.updateSubFlags(
            value,
            1,
            result
        );


        this.setFlag(
            X86_FLAGS.CF,
            oldCF
        );


        return result;

    }


    /* ========================================================
       LOGICAL OPERATIONS
    ======================================================== */

    xor32(
        a,
        b
    ) {

        const result =
            (a ^ b) >>> 0;


        this.updateLogicFlags(
            result
        );


        return result;

    }


    and32(
        a,
        b
    ) {

        const result =
            (a & b) >>> 0;


        this.updateLogicFlags(
            result
        );


        return result;

    }


    or32(
        a,
        b
    ) {

        const result =
            (a | b) >>> 0;


        this.updateLogicFlags(
            result
        );


        return result;

    }


    /* ========================================================
       STACK
    ======================================================== */

    push32(value) {

        /*
         * x86 stack grows downward.
         */

        this.ESP =
            (
                this.ESP - 4
            ) >>> 0;


        this.memory.write32(
            this.ESP,
            value
        );

    }


    pop32() {

        const value =
            this.memory.read32(
                this.ESP
            );


        this.ESP =
            (
                this.ESP + 4
            ) >>> 0;


        return value >>> 0;

    }


    peekStack32(
        offset = 0
    ) {

        const address =
            (
                this.ESP +
                offset
            ) >>> 0;


        return this.memory.read32(
            address
        );

    }


    /* ========================================================
       MEMORY HELPERS
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


    write8(
        address,
        value
    ) {

        this.memory.write8(
            address >>> 0,
            value
        );

    }


    write16(
        address,
        value
    ) {

        this.memory.write16(
            address >>> 0,
            value
        );

    }


    write32(
        address,
        value
    ) {

        this.memory.write32(
            address >>> 0,
            value
        );

    }


    /* ========================================================
       DECODER
    ======================================================== */

    attachDecoder(
        decoder
    ) {

        this.decoder =
            decoder;

    }


    /* ========================================================
       SINGLE CPU STEP
    ======================================================== */

    step() {

        if (this.halted) {

            return {

                executed: false,

                reason:
                    "CPU HALTED"

            };

        }


        if (!this.decoder) {

            throw new Error(
                "No x86 decoder attached."
            );

        }


        const oldEIP =
            this.EIP >>> 0;


        /*
         * Decoder is expected to return
         * an instruction object.
         */

        const instruction =
            this.decoder.decode(
                this,
                this.EIP
            );


        if (!instruction) {

            throw new Error(
                `Decoder returned no instruction ` +
                `at 0x${oldEIP.toString(16)}`
            );

        }


        /*
         * Execute decoded instruction.
         */

        if (
            typeof instruction.execute !==
            "function"
        ) {

            throw new Error(
                "Decoded instruction has no execute() method."
            );

        }


        instruction.execute(
            this
        );


        this.cycles++;

        this.instructionsExecuted++;


        /*
         * Debug callback.
         */

        if (
            typeof this.onInstruction ===
            "function"
        ) {

            this.onInstruction(
                {

                    address:
                        oldEIP,

                    instruction,

                    registers:
                        this.getRegisters(),

                    cycles:
                        this.cycles

                }
            );

        }


        return {

            executed: true,

            address:
                oldEIP,

            instruction

        };

    }


    /* ========================================================
       RUN
    ======================================================== */

    run(
        maxInstructions =
            this.maxInstructions
    ) {

        if (
            !Number.isInteger(
                maxInstructions
            ) ||
            maxInstructions <= 0
        ) {

            throw new Error(
                "Invalid execution limit."
            );

        }


        this.running = true;

        this.halted = false;


        let executed = 0;


        try {

            while (
                this.running &&
                !this.halted &&
                executed < maxInstructions
            ) {

                this.step();

                executed++;

            }

        } finally {

            this.running = false;

        }


        return {

            executed,

            cycles:
                this.cycles,

            instructions:
                this.instructionsExecuted,

            registers:
                this.getRegisters(),

            halted:
                this.halted

        };

    }


    /* ========================================================
       STOP
    ======================================================== */

    stop() {

        this.running = false;

    }


    /* ========================================================
       HALT
    ======================================================== */

    halt() {

        this.halted = true;

        this.running = false;

    }


    /* ========================================================
       SET ENTRY POINT
    ======================================================== */

    setEIP(address) {

        if (
            !Number.isInteger(address) ||
            address < 0 ||
            address >= this.memory.size
        ) {

            throw new RangeError(
                `Invalid EIP: 0x${
                    address.toString(16)
                }`
            );

        }


        this.EIP =
            address >>> 0;

    }


    /* ========================================================
       CPU STATUS
    ======================================================== */

    getStatus() {

        return {

            running:
                this.running,

            halted:
                this.halted,

            cycles:
                this.cycles,

            instructionsExecuted:
                this.instructionsExecuted,

            registers:
                this.getRegisters(),

            flags:
                {

                    CF:
                        this.getFlag(
                            X86_FLAGS.CF
                        ),

                    ZF:
                        this.getFlag(
                            X86_FLAGS.ZF
                        ),

                    SF:
                        this.getFlag(
                            X86_FLAGS.SF
                        ),

                    OF:
                        this.getFlag(
                            X86_FLAGS.OF
                        )

                }

        };

    }


    /* ========================================================
       CPU SELF TEST
    ======================================================== */

    selfTest() {

        this.reset();


        /*
         * Basic register test.
         */

        this.EAX =
            10;

        this.EBX =
            20;


        const add =
            this.add32(
                this.EAX,
                this.EBX
            );


        if (
            add !== 30
        ) {

            return {

                passed: false,

                test:
                    "ADD",

                expected:
                    30,

                received:
                    add

            };

        }


        /*
         * Subtraction.
         */

        const sub =
            this.sub32(
                50,
                20
            );


        if (
            sub !== 30
        ) {

            return {

                passed: false,

                test:
                    "SUB",

                expected:
                    30,

                received:
                    sub

            };

        }


        /*
         * Stack test.
         */

        const oldESP =
            this.ESP;


        this.push32(
            0x12345678
        );


        const stackValue =
            this.pop32();


        if (
            stackValue !==
            0x12345678
        ) {

            return {

                passed: false,

                test:
                    "STACK",

                expected:
                    "0x12345678",

                received:
                    "0x" +
                    stackValue
                        .toString(16)

            };

        }


        if (
            this.ESP !== oldESP
        ) {

            return {

                passed: false,

                test:
                    "STACK POINTER",

                expected:
                    oldESP,

                received:
                    this.ESP

            };

        }


        /*
         * Memory test.
         */

        const testAddress =
            0x2000;


        this.write32(
            testAddress,
            0xDEADBEEF
        );


        const memoryValue =
            this.read32(
                testAddress
            );


        if (
            memoryValue !==
            0xDEADBEEF
        ) {

            return {

                passed: false,

                test:
                    "MEMORY",

                expected:
                    "0xDEADBEEF",

                received:
                    "0x" +
                    memoryValue
                        .toString(16)

            };

        }


        return {

            passed: true,

            cpu:
                "WebBktx x86 CPU 0.7B",

            registers:
                this.getRegisters(),

            stack:
                "PASS",

            arithmetic:
                "PASS",

            memory:
                "PASS"

        };

    }

}


/* ============================================================
   EXPORT
============================================================ */

window.WebBktxCPU =
    WebBktxCPU;


window.WebBktxCPUFlags =
    X86_FLAGS;


console.log(
    "WebBktx CPU 0.7B loaded."
);
