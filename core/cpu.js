/*
 * ============================================================
 * WebBktx CPU
 * Experimental x86-32 Execution Engine
 *
 * Version: 0.8 MAX
 *
 * Features:
 *   - 32-bit general purpose registers
 *   - EIP / EFLAGS
 *   - 64-bit-style cycle counter
 *   - stack operations
 *   - arithmetic flags
 *   - logical flags
 *   - CALL / RET
 *   - JMP
 *   - conditional jumps
 *   - CMP / TEST
 *   - MOV
 *   - ADD / SUB
 *   - INC / DEC
 *   - AND / OR / XOR
 *   - PUSH / POP
 *   - NOP
 *   - HLT
 *   - decoder integration
 *   - instruction tracing
 *   - execution limits
 *   - breakpoints
 *   - CPU snapshots
 *
 * NOTE:
 * This is an experimental x86 CPU layer.
 * It is NOT a complete Xbox CPU/emulation environment.
 * ============================================================
 */

"use strict";


/* ============================================================
   VERSION
============================================================ */

const WEBBKTX_CPU_VERSION = "0.8 MAX";


/* ============================================================
   EFLAGS
============================================================ */

const X86_FLAGS = {

    CF: 0x00000001,

    PF: 0x00000004,

    AF: 0x00000010,

    ZF: 0x00000040,

    SF: 0x00000080,

    IF: 0x00000200,

    DF: 0x00000400,

    OF: 0x00000800

};


/* ============================================================
   REGISTER NAMES
============================================================ */

const REGISTER_NAMES = [

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


        /*
         * ----------------------------------------------------
         * General purpose registers
         * ----------------------------------------------------
         */

        this.EAX = 0;
        this.EBX = 0;
        this.ECX = 0;
        this.EDX = 0;

        this.ESI = 0;
        this.EDI = 0;

        this.EBP = 0;
        this.ESP = 0;


        /*
         * ----------------------------------------------------
         * Program state
         * ----------------------------------------------------
         */

        this.EIP = 0;

        this.EFLAGS =
            0x00000002;


        /*
         * ----------------------------------------------------
         * Execution state
         * ----------------------------------------------------
         */

        this.running = false;

        this.halted = false;

        this.faulted = false;

        this.lastError = null;


        /*
         * ----------------------------------------------------
         * Counters
         * ----------------------------------------------------
         */

        this.cycles = 0;

        this.instructionsExecuted = 0;


        /*
         * ----------------------------------------------------
         * Limits
         * ----------------------------------------------------
         */

        this.maxInstructions =
            100000;


        /*
         * ----------------------------------------------------
         * Decoder
         * ----------------------------------------------------
         */

        this.decoder = null;


        /*
         * ----------------------------------------------------
         * Debugging
         * ----------------------------------------------------
         */

        this.traceEnabled = false;

        this.trace = [];

        this.maxTraceEntries =
            1000;


        /*
         * ----------------------------------------------------
         * Breakpoints
         * ----------------------------------------------------
         */

        this.breakpoints =
            new Set();


        /*
         * ----------------------------------------------------
         * Callbacks
         * ----------------------------------------------------
         */

        this.onInstruction = null;

        this.onBreakpoint = null;

        this.onHalt = null;

        this.onFault = null;


        this.reset();

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
         * Stack starts near top of RAM.
         */

        this.ESP =
            (
                this.memory.size -
                4
            ) >>> 0;


        this.EIP = 0;


        /*
         * Bit 1 of EFLAGS is normally always set.
         */

        this.EFLAGS =
            0x00000002;


        this.running = false;

        this.halted = false;

        this.faulted = false;

        this.lastError = null;


        this.cycles = 0;

        this.instructionsExecuted = 0;


        this.trace.length = 0;

    }


    /* ========================================================
       REGISTER ACCESS
    ======================================================== */

    getRegister(name) {

        const register =
            String(name).toUpperCase();


        switch (register) {

            case "EAX":
                return this.EAX >>> 0;

            case "EBX":
                return this.EBX >>> 0;

            case "ECX":
                return this.ECX >>> 0;

            case "EDX":
                return this.EDX >>> 0;

            case "ESI":
                return this.ESI >>> 0;

            case "EDI":
                return this.EDI >>> 0;

            case "EBP":
                return this.EBP >>> 0;

            case "ESP":
                return this.ESP >>> 0;

            case "EIP":
                return this.EIP >>> 0;

            case "EFLAGS":
                return this.EFLAGS >>> 0;

            default:

                throw new Error(
                    `Unknown register: ${register}`
                );

        }

    }


    setRegister(name, value) {

        const register =
            String(name).toUpperCase();

        const normalized =
            Number(value) >>> 0;


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

            case "EIP":

                this.setEIP(
                    normalized
                );

                break;

            default:

                throw new Error(
                    `Unknown register: ${register}`
                );

        }

    }


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
       EIP
    ======================================================== */

    setEIP(address) {

        const value =
            Number(address) >>> 0;


        /*
         * We allow addresses outside the physical
         * RAM range to support future virtual mapping,
         * but instruction fetching itself remains
         * protected by the memory subsystem.
         */

        this.EIP =
            value;

    }


    /* ========================================================
       FLAGS
    ======================================================== */

    getFlag(flag) {

        return (
            (
                this.EFLAGS &
                flag
            ) !== 0
        );

    }


    setFlag(flag, enabled) {

        if (enabled) {

            this.EFLAGS |= flag;

        } else {

            this.EFLAGS &= ~flag;

        }


        /*
         * EFLAGS bit 1 stays set.
         */

        this.EFLAGS |= 0x02;

        this.EFLAGS >>>= 0;

    }


    clearArithmeticFlags() {

        this.EFLAGS &= ~(
            X86_FLAGS.CF |
            X86_FLAGS.PF |
            X86_FLAGS.AF |
            X86_FLAGS.ZF |
            X86_FLAGS.SF |
            X86_FLAGS.OF
        );


        this.EFLAGS |= 0x02;

        this.EFLAGS >>>= 0;

    }


    /* ========================================================
       PARITY
    ======================================================== */

    parity8(value) {

        value &= 0xFF;

        let parity = 0;


        while (value) {

            parity ^= value & 1;

            value >>>
                1;

        }


        return parity === 0;

    }


    updateLogicFlags(result) {

        result >>>
            = 0;


        this.setFlag(
            X86_FLAGS.CF,
            false
        );


        this.setFlag(
            X86_FLAGS.OF,
            false
        );


        this.setFlag(
            X86_FLAGS.ZF,
            result === 0
        );


        this.setFlag(
            X86_FLAGS.SF,
            (
                result &
                0x80000000
            ) !== 0
        );


        this.setFlag(
            X86_FLAGS.PF,
            this.parity8(result)
        );

    }


    /* ========================================================
       ADD FLAGS
    ======================================================== */

    updateAddFlags(
        a,
        b,
        result
    ) {

        a >>>=
            0;

        b >>>=
            0;

        result >>>
            = 0;


        this.setFlag(
            X86_FLAGS.CF,
            result < a
        );


        this.setFlag(
            X86_FLAGS.ZF,
            result === 0
        );


        this.setFlag(
            X86_FLAGS.SF,
            (
                result &
                0x80000000
            ) !== 0
        );


        this.setFlag(
            X86_FLAGS.PF,
            this.parity8(result)
        );


        this.setFlag(
            X86_FLAGS.AF,
            (
                (
                    a ^
                    b ^
                    result
                ) &
                0x10
            ) !== 0
        );


        const overflow =
            (
                (
                    (~(
                        a ^ b
                    )) &
                    (
                        a ^
                        result
                    ) &
                    0x80000000
                ) !== 0
            );


        this.setFlag(
            X86_FLAGS.OF,
            overflow
        );

    }


    /* ========================================================
       SUB FLAGS
    ======================================================== */

    updateSubFlags(
        a,
        b,
        result
    ) {

        a >>>=
            0;

        b >>>=
            0;

        result >>>
            = 0;


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
            (
                result &
                0x80000000
            ) !== 0
        );


        this.setFlag(
            X86_FLAGS.PF,
            this.parity8(result)
        );


        this.setFlag(
            X86_FLAGS.AF,
            (
                (
                    a ^
                    b ^
                    result
                ) &
                0x10
            ) !== 0
        );


        const overflow =
            (
                (
                    (
                        a ^
                        b
                    ) &
                    (
                        a ^
                        result
                    ) &
                    0x80000000
                ) !== 0
            );


        this.setFlag(
            X86_FLAGS.OF,
            overflow
        );

    }


    /* ========================================================
       ARITHMETIC
    ======================================================== */

    add32(a, b) {

        a >>>=
            0;

        b >>>=
            0;


        const result =
            (
                a +
                b
            ) >>> 0;


        this.updateAddFlags(
            a,
            b,
            result
        );


        return result;

    }


    sub32(a, b) {

        a >>>=
            0;

        b >>>=
            0;


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


        return result;

    }


    inc32(value) {

        const oldCF =
            this.getFlag(
                X86_FLAGS.CF
            );


        const result =
            (
                (
                    value >>> 0
                ) +
                1
            ) >>> 0;


        this.updateAddFlags(
            value >>> 0,
            1,
            result
        );


        /*
         * INC does not change CF.
         */

        this.setFlag(
            X86_FLAGS.CF,
            oldCF
        );


        return result;

    }


    dec32(value) {

        const oldCF =
            this.getFlag(
                X86_FLAGS.CF
            );


        const result =
            (
                (
                    value >>> 0
                ) -
                1
            ) >>> 0;


        this.updateSubFlags(
            value >>> 0,
            1,
            result
        );


        /*
         * DEC does not change CF.
         */

        this.setFlag(
            X86_FLAGS.CF,
            oldCF
        );


        return result;

    }


    /* ========================================================
       LOGICAL
    ======================================================== */

    xor32(a, b) {

        const result =
            (
                (
                    a >>> 0
                ) ^
                (
                    b >>> 0
                )
            ) >>> 0;


        this.updateLogicFlags(
            result
        );


        return result;

    }


    and32(a, b) {

        const result =
            (
                (
                    a >>> 0
                ) &
                (
                    b >>> 0
                )
            ) >>> 0;


        this.updateLogicFlags(
            result
        );


        return result;

    }


    or32(a, b) {

        const result =
            (
                (
                    a >>> 0
                ) |
                (
                    b >>> 0
                )
            ) >>> 0;


        this.updateLogicFlags(
            result
        );


        return result;

    }


    /* ========================================================
       STACK
    ======================================================== */

    push32(value) {

        if (
            this.ESP < 4
        ) {

            throw new Error(
                "Stack underflow."
            );

        }


        this.ESP =
            (
                this.ESP -
                4
            ) >>> 0;


        this.memory.write32(
            this.ESP,
            value
        );

    }


    pop32() {

        if (
            this.ESP + 4 >
            this.memory.size
        ) {

            throw new Error(
                "Stack overflow."
            );

        }


        const value =
            this.memory.read32(
                this.ESP
            );


        this.ESP =
            (
                this.ESP +
                4
            ) >>> 0;


        return value >>> 0;

    }


    peekStack32(offset = 0) {

        const address =
            (
                this.ESP +
                offset
            ) >>> 0;


        return this.memory.read32(
            address
        ) >>> 0;

    }


    /* ========================================================
       MEMORY
    ======================================================== */

    read8(address) {

        return this.memory.read8(
            Number(address) >>> 0
        );

    }


    read16(address) {

        return this.memory.read16(
            Number(address) >>> 0
        );

    }


    read32(address) {

        return this.memory.read32(
            Number(address) >>> 0
        );

    }


    write8(address, value) {

        this.memory.write8(
            Number(address) >>> 0,
            value
        );

    }


    write16(address, value) {

        this.memory.write16(
            Number(address) >>> 0,
            value
        );

    }


    write32(address, value) {

        this.memory.write32(
            Number(address) >>> 0,
            value
        );

    }


    /* ========================================================
       DECODER
    ======================================================== */

    attachDecoder(decoder) {

        if (!decoder) {

            throw new Error(
                "Cannot attach empty decoder."
            );

        }


        this.decoder =
            decoder;


        return true;

    }


    /* ========================================================
       BREAKPOINTS
    ======================================================== */

    addBreakpoint(address) {

        this.breakpoints.add(
            Number(address) >>> 0
        );

    }


    removeBreakpoint(address) {

        this.breakpoints.delete(
            Number(address) >>> 0
        );

    }


    clearBreakpoints() {

        this.breakpoints.clear();

    }


    hasBreakpoint(address) {

        return this.breakpoints.has(
            Number(address) >>> 0
        );

    }


    /* ========================================================
       TRACE
    ======================================================== */

    clearTrace() {

        this.trace.length = 0;

    }


    enableTrace(enabled = true) {

        this.traceEnabled =
            Boolean(enabled);

    }


    addTrace(entry) {

        if (!this.traceEnabled) {

            return;

        }


        this.trace.push(
            entry
        );


        if (
            this.trace.length >
            this.maxTraceEntries
        ) {

            this.trace.shift();

        }

    }


    getTrace() {

        return [
            ...this.trace
        ];

    }


    /* ========================================================
       SINGLE STEP
    ======================================================== */

    step() {

        if (this.halted) {

            return {

                executed: false,

                halted: true,

                reason:
                    "CPU HALTED"

            };

        }


        if (this.faulted) {

            return {

                executed: false,

                faulted: true,

                reason:
                    this.lastError ||
                    "CPU FAULT"

            };

        }


        if (!this.decoder) {

            throw new Error(
                "No x86 decoder attached."
            );

        }


        const address =
            this.EIP >>> 0;


        /*
         * Breakpoint.
         */

        if (
            this.hasBreakpoint(address)
        ) {

            this.running =
                false;


            if (
                typeof this.onBreakpoint ===
                "function"
            ) {

                this.onBreakpoint(
                    address
                );

            }


            return {

                executed: false,

                breakpoint: true,

                address

            };

        }


        let instruction;


        try {

            instruction =
                this.decoder.decode(
                    this,
                    address
                );

        } catch (error) {

            this.raiseFault(
                error
            );

            throw error;

        }


        if (!instruction) {

            const error =
                new Error(
                    `Decoder returned no instruction at 0x${
                        address.toString(16)
                    }`
                );


            this.raiseFault(
                error
            );


            throw error;

        }


        if (
            typeof instruction.execute !==
            "function"
        ) {

            const error =
                new Error(
                    "Decoded instruction has no execute() method."
                );


            this.raiseFault(
                error
            );


            throw error;

        }


        /*
         * Execute.
         */

        try {

            instruction.execute(
                this
            );

        } catch (error) {

            this.raiseFault(
                error
            );

            throw error;

        }


        this.cycles++;

        this.instructionsExecuted++;


        const result = {

            executed: true,

            address,

            opcode:
                instruction.opcode ??
                null,

            mnemonic:
                instruction.mnemonic ??
                instruction.name ??
                "UNKNOWN",

            instruction,

            registers:
                this.getRegisters(),

            cycles:
                this.cycles,

            halted:
                this.halted

        };


        /*
         * Trace.
         */

        this.addTrace(
            result
        );


        /*
         * Debug callback.
         */

        if (
            typeof this.onInstruction ===
            "function"
        ) {

            this.onInstruction(
                result
            );

        }


        /*
         * HLT callback.
         */

        if (
            this.halted &&
            typeof this.onHalt ===
            "function"
        ) {

            this.onHalt(
                result
            );

        }


        return result;

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


        this.running =
            true;


        this.halted =
            false;


        let executed = 0;

        let last = null;


        try {

            while (
                this.running &&
                !this.halted &&
                !this.faulted &&
                executed <
                maxInstructions
            ) {

                last =
                    this.step();


                if (
                    last &&
                    last.breakpoint
                ) {

                    break;

                }


                executed++;

            }

        } finally {

            this.running =
                false;

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
                this.halted,

            faulted:
                this.faulted,

            last

        };

    }


    /* ========================================================
       STOP
    ======================================================== */

    stop() {

        this.running =
            false;

    }


    /* ========================================================
       HALT
    ======================================================== */

    halt() {

        this.halted =
            true;

        this.running =
            false;

    }


    /* ========================================================
       FAULT
    ======================================================== */

    raiseFault(error) {

        this.faulted =
            true;

        this.running =
            false;

        this.lastError =
            error instanceof Error
                ? error.message
                : String(error);


        if (
            typeof this.onFault ===
            "function"
        ) {

            this.onFault(
                error
            );

        }

    }


    /* ========================================================
       CPU STATE
    ======================================================== */

    getStatus() {

        return {

            version:
                WEBBKTX_CPU_VERSION,

            running:
                this.running,

            halted:
                this.halted,

            faulted:
                this.faulted,

            error:
                this.lastError,

            cycles:
                this.cycles,

            instructionsExecuted:
                this.instructionsExecuted,

            registers:
                this.getRegisters(),

            flags: {

                CF:
                    this.getFlag(
                        X86_FLAGS.CF
                    ),

                PF:
                    this.getFlag(
                        X86_FLAGS.PF
                    ),

                AF:
                    this.getFlag(
                        X86_FLAGS.AF
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


    getState() {

        return this.getStatus();

    }


    /* ========================================================
       SNAPSHOT
    ======================================================== */

    snapshot() {

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
                this.EFLAGS >>> 0,

            cycles:
                this.cycles,

            instructionsExecuted:
                this.instructionsExecuted,

            halted:
                this.halted,

            faulted:
                this.faulted

        };

    }


    /* ========================================================
       CPU SELF TEST
    ======================================================== */

    selfTest() {

        this.reset();


        /*
         * ADD
         */

        const add =
            this.add32(
                10,
                20
            );


        if (
            add !== 30
        ) {

            return {

                passed: false,

                test: "ADD",

                expected: 30,

                received: add

            };

        }


        /*
         * SUB
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

                test: "SUB",

                expected: 30,

                received: sub

            };

        }


        /*
         * XOR
         */

        const xor =
            this.xor32(
                0xFF00,
                0x0F00
            );


        if (
            xor !== 0xF000
        ) {

            return {

                passed: false,

                test: "XOR",

                expected:
                    "0xF000",

                received:
                    "0x" +
                    xor.toString(16)

            };

        }


        /*
         * Stack.
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

                test: "STACK",

                expected:
                    "0x12345678",

                received:
                    "0x" +
                    stackValue.toString(16)

            };

        }


        if (
            this.ESP !==
            oldESP
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
         * Memory.
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

                test: "MEMORY",

                expected:
                    "0xDEADBEEF",

                received:
                    "0x" +
                    memoryValue.toString(16)

            };

        }


        /*
         * INC / DEC
         */

        const inc =
            this.inc32(
                9
            );


        if (
            inc !== 10
        ) {

            return {

                passed: false,

                test: "INC",

                expected: 10,

                received: inc

            };

        }


        const dec =
            this.dec32(
                10
            );


        if (
            dec !== 9
        ) {

            return {

                passed: false,

                test: "DEC",

                expected: 9,

                received: dec

            };

        }


        return {

            passed: true,

            cpu:
                WEBBKTX_CPU_VERSION,

            arithmetic:
                "PASS",

            logic:
                "PASS",

            stack:
                "PASS",

            memory:
                "PASS",

            incDec:
                "PASS",

            registers:
                this.getRegisters()

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


window.WebBktxCPUVersion =
    WEBBKTX_CPU_VERSION;


console.log(
    `%cWebBktx CPU ${WEBBKTX_CPU_VERSION} loaded.`,
    "font-weight:bold"
);
