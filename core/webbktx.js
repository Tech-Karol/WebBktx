/*
 * ============================================================
 * WebBktx Unified Runtime
 *
 * File:
 *     core/webbktx.js
 *
 * Version:
 *     1.1
 *
 * Unified browser runtime:
 *
 *     Memory
 *     CPU
 *     Decoder
 *     XBE
 *     Thunks
 *     XAPI
 *     XFile
 *     Kernel
 *     XInput
 *     XGraphics
 *     Core
 *
 * IMPORTANT:
 * This is an experimental Xbox-compatible runtime framework.
 * It is NOT a complete Xbox emulator.
 *
 * It does not implement:
 *
 *     - complete Xbox hardware
 *     - complete Intel Pentium III behavior
 *     - NV2A GPU
 *     - DirectX 8
 *     - complete Xbox kernel
 *     - complete XDK
 *     - complete XAPI
 *     - complete XBE loader
 *
 * The purpose of this runtime is to provide a clean,
 * extensible foundation for WebBktx.
 * ============================================================
 */

"use strict";


/* ============================================================
   GLOBAL CONFIGURATION
============================================================ */

const WEBBKTX_VERSION =
    "1.1";

const WEBBKTX_CPU_VERSION =
    "1.1";

const WEBBKTX_RAM_SIZE =
    64 * 1024 * 1024;


/* ============================================================
   UTILITY
============================================================ */

function webBktxU32(value) {

    return Number(value) >>> 0;

}


function webBktxHex(value, width = 8) {

    return (
        webBktxU32(value)
            .toString(16)
            .padStart(width, "0")
            .toUpperCase()
    );

}


function webBktxNow() {

    if (
        typeof performance !== "undefined" &&
        typeof performance.now === "function"
    ) {

        return performance.now();

    }

    return Date.now();

}


/* ============================================================
   MEMORY
============================================================ */

class WebBktxMemory {

    constructor(
        size = WEBBKTX_RAM_SIZE
    ) {

        size =
            Number(size);

        if (
            !Number.isInteger(size) ||
            size <= 0
        ) {

            throw new Error(
                "Invalid memory size."
            );

        }

        this.size =
            size;

        this.buffer =
            new ArrayBuffer(
                size
            );

        this.view =
            new DataView(
                this.buffer
            );

        this.u8 =
            new Uint8Array(
                this.buffer
            );

        this.reset();

    }


    reset() {

        this.u8.fill(0);

    }


    check(
        address,
        bytes = 1
    ) {

        const start =
            Number(address);

        const length =
            Number(bytes);

        if (
            !Number.isFinite(start) ||
            !Number.isFinite(length) ||
            start < 0 ||
            length < 0 ||
            !Number.isInteger(start) ||
            !Number.isInteger(length)
        ) {

            throw new RangeError(
                "Invalid memory access."
            );

        }

        if (
            start + length >
            this.size
        ) {

            throw new RangeError(
                `Memory access violation: 0x${webBktxHex(start)} ` +
                `(size=${length}, RAM=${this.size})`
            );

        }

        return start;

    }


    read8(address) {

        return this.u8[
            this.check(address)
        ];

    }


    read16(address) {

        return this.view.getUint16(
            this.check(address, 2),
            true
        );

    }


    read32(address) {

        return this.view.getUint32(
            this.check(address, 4),
            true
        );

    }


    readSigned8(address) {

        return this.view.getInt8(
            this.check(address)
        );

    }


    readSigned16(address) {

        return this.view.getInt16(
            this.check(address, 2),
            true
        );

    }


    readSigned32(address) {

        return this.view.getInt32(
            this.check(address, 4),
            true
        );

    }


    write8(
        address,
        value
    ) {

        this.u8[
            this.check(address)
        ] =
            Number(value) & 0xFF;

    }


    write16(
        address,
        value
    ) {

        this.view.setUint16(
            this.check(address, 2),
            Number(value) & 0xFFFF,
            true
        );

    }


    write32(
        address,
        value
    ) {

        this.view.setUint32(
            this.check(address, 4),
            Number(value) >>> 0,
            true
        );

    }


    writeBytes(
        address,
        bytes
    ) {

        const data =
            bytes instanceof Uint8Array
                ? bytes
                : new Uint8Array(bytes);

        const start =
            this.check(
                address,
                data.length
            );

        this.u8.set(
            data,
            start
        );

    }


    readBytes(
        address,
        length
    ) {

        const start =
            Number(address) >>> 0;

        const size =
            Number(length);

        this.check(
            start,
            size
        );

        return this.u8.slice(
            start,
            start + size
        );

    }


    load(
        address,
        data
    ) {

        this.writeBytes(
            address,
            data
        );

    }


    fill(
        address,
        length,
        value = 0
    ) {

        const start =
            this.check(
                address,
                length
            );

        const end =
            start +
            Number(length);

        this.u8.fill(
            Number(value) & 0xFF,
            start,
            end
        );

    }


    getBuffer() {

        return this.buffer;

    }


    getView() {

        return this.view;

    }


    getUint8Array() {

        return this.u8;

    }


    getStatus() {

        return {

            size:
                this.size,

            bytes:
                this.size,

            megabytes:
                this.size /
                (1024 * 1024)

        };

    }

}


/* ============================================================
   X86 FLAGS
============================================================ */

const WebBktxCPUFlags = {

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
   CPU REGISTER NAMES
============================================================ */

const WEBBKTX_REGISTER_NAMES = [

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

        if (
            !(memory instanceof WebBktxMemory)
        ) {

            throw new Error(
                "WebBktxCPU requires WebBktxMemory."
            );

        }


        this.memory =
            memory;


        this.decoder =
            null;


        /*
         * IMPORTANT:
         *
         * These properties must exist BEFORE
         * reset() is called.
         *
         * The previous version crashed because
         * reset() executed:
         *
         *     this.trace.length = 0
         *
         * before this.trace existed.
         */

        this.maxInstructions =
            100000;


        this.breakpoints =
            new Set();


        this.traceEnabled =
            false;


        this.trace =
            [];


        this.maxTraceEntries =
            1000;


        this.onInstruction =
            null;


        this.onBreakpoint =
            null;


        this.onHalt =
            null;


        this.onFault =
            null;


        this.reset();

    }


    reset() {

        this.EAX = 0;
        this.EBX = 0;
        this.ECX = 0;
        this.EDX = 0;

        this.ESI = 0;
        this.EDI = 0;

        this.EBP = 0;


        /*
         * Stack begins near the end of RAM.
         */

        this.ESP =
            Math.max(
                0,
                this.memory.size - 4
            ) >>> 0;


        this.EIP =
            0;


        /*
         * x86 reserved bit 1.
         */

        this.EFLAGS =
            0x00000002;


        this.running =
            false;


        this.halted =
            false;


        this.faulted =
            false;


        this.lastError =
            null;


        this.cycles =
            0;


        this.instructionsExecuted =
            0;


        if (
            Array.isArray(this.trace)
        ) {

            this.trace.length =
                0;

        } else {

            this.trace =
                [];

        }

    }


    getRegister(name) {

        const register =
            String(name)
                .toUpperCase();


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


    setRegister(
        name,
        value
    ) {

        const register =
            String(name)
                .toUpperCase();


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
                this.EIP = normalized;
                break;

            case "EFLAGS":

                this.EFLAGS =
                    normalized;

                this.EFLAGS |=
                    0x02;

                this.EFLAGS >>>=
                    0;

                break;

            default:

                throw new Error(
                    `Unknown register: ${register}`
                );

        }

    }


    getRegisters() {

        return {

            EAX:
                this.EAX >>> 0,

            EBX:
                this.EBX >>> 0,

            ECX:
                this.ECX >>> 0,

            EDX:
                this.EDX >>> 0,

            ESI:
                this.ESI >>> 0,

            EDI:
                this.EDI >>> 0,

            EBP:
                this.EBP >>> 0,

            ESP:
                this.ESP >>> 0,

            EIP:
                this.EIP >>> 0,

            EFLAGS:
                this.EFLAGS >>> 0

        };

    }


    setEIP(address) {

        this.EIP =
            Number(address) >>> 0;

    }


    getFlag(flag) {

        return (
            (
                this.EFLAGS &
                flag
            ) !== 0
        );

    }


    setFlag(
        flag,
        enabled
    ) {

        if (enabled) {

            this.EFLAGS |=
                flag;

        } else {

            this.EFLAGS &=
                ~flag;

        }


        /*
         * Reserved x86 bit 1.
         */

        this.EFLAGS |=
            0x02;

        this.EFLAGS >>>=
            0;

    }


    clearArithmeticFlags() {

        this.EFLAGS &= ~(
            WebBktxCPUFlags.CF |
            WebBktxCPUFlags.PF |
            WebBktxCPUFlags.AF |
            WebBktxCPUFlags.ZF |
            WebBktxCPUFlags.SF |
            WebBktxCPUFlags.OF
        );


        this.EFLAGS |=
            0x02;

        this.EFLAGS >>>=
            0;

    }


    parity8(value) {

        value &=
            0xFF;

        let parity =
            0;


        while (value) {

            parity ^=
                value & 1;

            value >>>=
                1;

        }


        return parity === 0;

    }


    updateLogicFlags(
        result
    ) {

        result >>>
            = 0;


        this.setFlag(
            WebBktxCPUFlags.CF,
            false
        );


        this.setFlag(
            WebBktxCPUFlags.OF,
            false
        );


        this.setFlag(
            WebBktxCPUFlags.ZF,
            result === 0
        );


        this.setFlag(
            WebBktxCPUFlags.SF,
            (
                result &
                0x80000000
            ) !== 0
        );


        this.setFlag(
            WebBktxCPUFlags.PF,
            this.parity8(
                result
            )
        );

    }


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
            WebBktxCPUFlags.CF,
            result < a
        );


        this.setFlag(
            WebBktxCPUFlags.ZF,
            result === 0
        );


        this.setFlag(
            WebBktxCPUFlags.SF,
            (
                result &
                0x80000000
            ) !== 0
        );


        this.setFlag(
            WebBktxCPUFlags.PF,
            this.parity8(
                result
            )
        );


        this.setFlag(
            WebBktxCPUFlags.AF,
            (
                (
                    a ^
                    b ^
                    result
                ) &
                0x10
            ) !== 0
        );


        this.setFlag(
            WebBktxCPUFlags.OF,
            (
                (
                    (~(a ^ b)) &
                    (a ^ result) &
                    0x80000000
                ) !== 0
            )
        );

    }


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
            WebBktxCPUFlags.CF,
            a < b
        );


        this.setFlag(
            WebBktxCPUFlags.ZF,
            result === 0
        );


        this.setFlag(
            WebBktxCPUFlags.SF,
            (
                result &
                0x80000000
            ) !== 0
        );


        this.setFlag(
            WebBktxCPUFlags.PF,
            this.parity8(
                result
            )
        );


        this.setFlag(
            WebBktxCPUFlags.AF,
            (
                (
                    a ^
                    b ^
                    result
                ) &
                0x10
            ) !== 0
        );


        this.setFlag(
            WebBktxCPUFlags.OF,
            (
                (
                    (a ^ b) &
                    (a ^ result) &
                    0x80000000
                ) !== 0
            )
        );

    }


    add32(
        a,
        b
    ) {

        a >>>=
            0;

        b >>>=
            0;


        const result =
            (
                a + b
            ) >>> 0;


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

        a >>>=
            0;

        b >>>=
            0;


        const result =
            (
                a - b
            ) >>> 0;


        this.updateSubFlags(
            a,
            b,
            result
        );


        return result;

    }


    inc32(
        value
    ) {

        const oldCF =
            this.getFlag(
                WebBktxCPUFlags.CF
            );


        const result =
            (
                (value >>> 0) +
                1
            ) >>> 0;


        this.updateAddFlags(
            value,
            1,
            result
        );


        /*
         * INC preserves CF.
         */

        this.setFlag(
            WebBktxCPUFlags.CF,
            oldCF
        );


        return result;

    }


    dec32(
        value
    ) {

        const oldCF =
            this.getFlag(
                WebBktxCPUFlags.CF
            );


        const result =
            (
                (value >>> 0) -
                1
            ) >>> 0;


        this.updateSubFlags(
            value,
            1,
            result
        );


        /*
         * DEC preserves CF.
         */

        this.setFlag(
            WebBktxCPUFlags.CF,
            oldCF
        );


        return result;

    }


    xor32(
        a,
        b
    ) {

        const result =
            (
                (a >>> 0) ^
                (b >>> 0)
            ) >>> 0;


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
            (
                (a >>> 0) &
                (b >>> 0)
            ) >>> 0;


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
            (
                (a >>> 0) |
                (b >>> 0)
            ) >>> 0;


        this.updateLogicFlags(
            result
        );


        return result;

    }


    push32(
        value
    ) {

        if (
            this.ESP < 4
        ) {

            throw new Error(
                "Stack underflow."
            );

        }


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

        if (
            this.ESP >
            this.memory.size - 4
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
                Number(offset)
            ) >>> 0;


        return this.memory.read32(
            address
        );

    }


    read8(address) {

        return this.memory.read8(
            address
        );

    }


    read16(address) {

        return this.memory.read16(
            address
        );

    }


    read32(address) {

        return this.memory.read32(
            address
        );

    }


    write8(
        address,
        value
    ) {

        this.memory.write8(
            address,
            value
        );

    }


    write16(
        address,
        value
    ) {

        this.memory.write16(
            address,
            value
        );

    }


    write32(
        address,
        value
    ) {

        this.memory.write32(
            address,
            value
        );

    }


    attachDecoder(
        decoder
    ) {

        if (
            !decoder ||
            typeof decoder.decode !==
            "function"
        ) {

            throw new Error(
                "Invalid decoder."
            );

        }


        this.decoder =
            decoder;


        return true;

    }


    addBreakpoint(
        address
    ) {

        this.breakpoints.add(
            Number(address) >>> 0
        );

    }


    removeBreakpoint(
        address
    ) {

        this.breakpoints.delete(
            Number(address) >>> 0
        );

    }


    clearBreakpoints() {

        this.breakpoints.clear();

    }


    hasBreakpoint(
        address
    ) {

        return this.breakpoints.has(
            Number(address) >>> 0
        );

    }


    enableTrace(
        enabled = true
    ) {

        this.traceEnabled =
            Boolean(enabled);

    }


    clearTrace() {

        if (
            Array.isArray(this.trace)
        ) {

            this.trace.length =
                0;

        } else {

            this.trace =
                [];

        }

    }


    getTrace() {

        return [
            ...this.trace
        ];

    }


    addTrace(
        entry
    ) {

        if (
            !this.traceEnabled
        ) {

            return;

        }


        this.trace.push(
            entry
        );


        while (
            this.trace.length >
            this.maxTraceEntries
        ) {

            this.trace.shift();

        }

    }


    step() {

        if (
            this.halted
        ) {

            return {

                executed:
                    false,

                halted:
                    true,

                reason:
                    "CPU HALTED"

            };

        }


        if (
            this.faulted
        ) {

            return {

                executed:
                    false,

                faulted:
                    true,

                reason:
                    this.lastError ||
                    "CPU FAULT"

            };

        }


        if (
            !this.decoder
        ) {

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
            this.hasBreakpoint(
                address
            )
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

                executed:
                    false,

                breakpoint:
                    true,

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


            if (
                !instruction
            ) {

                throw new Error(
                    `Decoder returned no instruction at 0x${webBktxHex(address)}`
                );

            }


            if (
                typeof instruction.execute !==
                "function"
            ) {

                throw new Error(
                    "Decoded instruction has no execute()."
                );

            }


            instruction.execute(
                this
            );


            this.cycles +=
                1;


            this.instructionsExecuted +=
                1;


            const result = {

                executed:
                    true,

                address:
                    address,

                opcode:
                    instruction.opcode ??
                    null,

                mnemonic:
                    instruction.mnemonic ??
                    instruction.name ??
                    "UNKNOWN",

                size:
                    instruction.size ??
                    null,

                registers:
                    this.getRegisters(),

                cycles:
                    this.cycles,

                instructionsExecuted:
                    this.instructionsExecuted,

                halted:
                    this.halted

            };


            this.addTrace(
                result
            );


            if (
                typeof this.onInstruction ===
                "function"
            ) {

                this.onInstruction(
                    result
                );

            }


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

        } catch (error) {

            this.raiseFault(
                error
            );

            throw error;

        }

    }


    run(
        limit =
            this.maxInstructions
    ) {

        limit =
            Number(limit);


        if (
            !Number.isInteger(limit) ||
            limit <= 0
        ) {

            throw new Error(
                "Invalid CPU execution limit."
            );

        }


        this.running =
            true;


        let executed =
            0;


        let last =
            null;


        try {

            while (
                this.running &&
                !this.halted &&
                !this.faulted &&
                executed < limit
            ) {

                last =
                    this.step();


                if (
                    last &&
                    last.breakpoint
                ) {

                    break;

                }


                if (
                    last &&
                    !last.executed
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

            halted:
                this.halted,

            faulted:
                this.faulted,

            registers:
                this.getRegisters(),

            last

        };

    }


    stop() {

        this.running =
            false;

    }


    halt() {

        this.halted =
            true;

        this.running =
            false;

    }


    raiseFault(
        error
    ) {

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
                        WebBktxCPUFlags.CF
                    ),

                PF:
                    this.getFlag(
                        WebBktxCPUFlags.PF
                    ),

                AF:
                    this.getFlag(
                        WebBktxCPUFlags.AF
                    ),

                ZF:
                    this.getFlag(
                        WebBktxCPUFlags.ZF
                    ),

                SF:
                    this.getFlag(
                        WebBktxCPUFlags.SF
                    ),

                OF:
                    this.getFlag(
                        WebBktxCPUFlags.OF
                    )

            },

            breakpoints:
                this.breakpoints.size,

            traceEntries:
                this.trace.length

        };

    }


    getState() {

        return this.getStatus();

    }


    snapshot() {

        return {

            EAX:
                this.EAX >>> 0,

            EBX:
                this.EBX >>> 0,

            ECX:
                this.ECX >>> 0,

            EDX:
                this.EDX >>> 0,

            ESI:
                this.ESI >>> 0,

            EDI:
                this.EDI >>> 0,

            EBP:
                this.EBP >>> 0,

            ESP:
                this.ESP >>> 0,

            EIP:
                this.EIP >>> 0,

            EFLAGS:
                this.EFLAGS >>> 0,

            cycles:
                this.cycles,

            instructionsExecuted:
                this.instructionsExecuted,

            halted:
                this.halted,

            faulted:
                this.faulted,

            lastError:
                this.lastError

        };

    }


    selfTest() {

        /*
         * Start from a clean CPU state.
         */

        this.reset();


        const tests =
            [];


        /*
         * ADD
         */

        let result =
            this.add32(
                10,
                20
            );


        tests.push({

            name:
                "ADD",

            pass:
                result === 30

        });


        /*
         * SUB
         */

        result =
            this.sub32(
                50,
                20
            );


        tests.push({

            name:
                "SUB",

            pass:
                result === 30

        });


        /*
         * XOR
         */

        result =
            this.xor32(
                0xFF00,
                0x0F00
            );


        tests.push({

            name:
                "XOR",

            pass:
                result === 0xF000

        });


        /*
         * AND
         */

        result =
            this.and32(
                0xFFFF,
                0x00FF
            );


        tests.push({

            name:
                "AND",

            pass:
                result === 0x00FF

        });


        /*
         * OR
         */

        result =
            this.or32(
                0xF000,
                0x000F
            );


        tests.push({

            name:
                "OR",

            pass:
                result === 0xF00F

        });


        /*
         * INC
         */

        result =
            this.inc32(
                9
            );


        tests.push({

            name:
                "INC",

            pass:
                result === 10

        });


        /*
         * DEC
         */

        result =
            this.dec32(
                10
            );


        tests.push({

            name:
                "DEC",

            pass:
                result === 9

        });


        /*
         * STACK
         */

        const oldESP =
            this.ESP;


        this.push32(
            0x12345678
        );


        const popped =
            this.pop32();


        tests.push({

            name:
                "STACK",

            pass:
                popped ===
                0x12345678 &&
                this.ESP ===
                oldESP

        });


        /*
         * MEMORY
         */

        const testAddress =
            0x1000;


        this.write32(
            testAddress,
            0xDEADBEEF
        );


        tests.push({

            name:
                "MEMORY",

            pass:
                this.read32(
                    testAddress
                ) ===
                0xDEADBEEF

        });


        /*
         * FLAGS
         */

        this.sub32(
            10,
            10
        );


        tests.push({

            name:
                "ZF",

            pass:
                this.getFlag(
                    WebBktxCPUFlags.ZF
                )

        });


        /*
         * Final result.
         */

        const passed =
            tests.every(
                test =>
                    test.pass
            );


        return {

            passed,

            cpu:
                WEBBKTX_CPU_VERSION,

            tests,

            registers:
                this.getRegisters()

        };

    }

}


/* ============================================================
   DECODER
============================================================ */

class WebBktxDecoder {

    constructor(
        memory
    ) {

        if (
            !(memory instanceof WebBktxMemory)
        ) {

            throw new Error(
                "WebBktxDecoder requires WebBktxMemory."
            );

        }


        this.memory =
            memory;


        this.version =
            "1.1";

    }


    decode(
        cpu,
        address
    ) {

        const ip =
            Number(address) >>> 0;


        const opcode =
            this.memory.read8(
                ip
            );


        switch (opcode) {


            /* ------------------------------------------------
               NOP
            ------------------------------------------------ */

            case 0x90:

                return {

                    opcode,

                    mnemonic:
                        "NOP",

                    size:
                        1,

                    execute() {

                        cpu.EIP =
                            (
                                cpu.EIP + 1
                            ) >>> 0;

                    }

                };


            /* ------------------------------------------------
               HLT
            ------------------------------------------------ */

            case 0xF4:

                return {

                    opcode,

                    mnemonic:
                        "HLT",

                    size:
                        1,

                    execute() {

                        cpu.EIP =
                            (
                                cpu.EIP + 1
                            ) >>> 0;

                        cpu.halt();

                    }

                };


            /* ------------------------------------------------
               MOV r32, imm32
            ------------------------------------------------ */

            case 0xB8:
            case 0xB9:
            case 0xBA:
            case 0xBB:
            case 0xBC:
            case 0xBD:
            case 0xBE:
            case 0xBF: {

                const registerIndex =
                    opcode -
                    0xB8;


                const registerName =
                    WEBBKTX_REGISTER_NAMES[
                        registerIndex
                    ];


                const value =
                    this.memory.read32(
                        ip + 1
                    );


                return {

                    opcode,

                    mnemonic:
                        `MOV ${registerName}, imm32`,

                    size:
                        5,

                    execute() {

                        cpu.setRegister(
                            registerName,
                            value
                        );


                        cpu.EIP =
                            (
                                cpu.EIP + 5
                            ) >>> 0;

                    }

                };

            }


            /* ------------------------------------------------
               ADD EAX, imm32
            ------------------------------------------------ */

            case 0x05: {

                const value =
                    this.memory.read32(
                        ip + 1
                    );


                return {

                    opcode,

                    mnemonic:
                        "ADD EAX, imm32",

                    size:
                        5,

                    execute() {

                        cpu.EAX =
                            cpu.add32(
                                cpu.EAX,
                                value
                            );


                        cpu.EIP =
                            (
                                cpu.EIP + 5
                            ) >>> 0;

                    }

                };

            }


            /* ------------------------------------------------
               SUB EAX, imm32
            ------------------------------------------------ */

            case 0x2D: {

                const value =
                    this.memory.read32(
                        ip + 1
                    );


                return {

                    opcode,

                    mnemonic:
                        "SUB EAX, imm32",

                    size:
                        5,

                    execute() {

                        cpu.EAX =
                            cpu.sub32(
                                cpu.EAX,
                                value
                            );


                        cpu.EIP =
                            (
                                cpu.EIP + 5
                            ) >>> 0;

                    }

                };

            }


            /* ------------------------------------------------
               INC EAX
            ------------------------------------------------ */

            case 0x40:

                return {

                    opcode,

                    mnemonic:
                        "INC EAX",

                    size:
                        1,

                    execute() {

                        cpu.EAX =
                            cpu.inc32(
                                cpu.EAX
                            );


                        cpu.EIP =
                            (
                                cpu.EIP + 1
                            ) >>> 0;

                    }

                };


            /* ------------------------------------------------
               DEC EAX
            ------------------------------------------------ */

            case 0x48:

                return {

                    opcode,

                    mnemonic:
                        "DEC EAX",

                    size:
                        1,

                    execute() {

                        cpu.EAX =
                            cpu.dec32(
                                cpu.EAX
                            );


                        cpu.EIP =
                            (
                                cpu.EIP + 1
                            ) >>> 0;

                    }

                };


            /* ------------------------------------------------
               PUSH EAX
            ------------------------------------------------ */

            case 0x50:

                return {

                    opcode,

                    mnemonic:
                        "PUSH EAX",

                    size:
                        1,

                    execute() {

                        cpu.push32(
                            cpu.EAX
                        );


                        cpu.EIP =
                            (
                                cpu.EIP + 1
                            ) >>> 0;

                    }

                };


            /* ------------------------------------------------
               POP EAX
            ------------------------------------------------ */

            case 0x58:

                return {

                    opcode,

                    mnemonic:
                        "POP EAX",

                    size:
                        1,

                    execute() {

                        cpu.EAX =
                            cpu.pop32();


                        cpu.EIP =
                            (
                                cpu.EIP + 1
                            ) >>> 0;

                    }

                };


            /* ------------------------------------------------
               RET
            ------------------------------------------------ */

            case 0xC3:

                return {

                    opcode,

                    mnemonic:
                        "RET",

                    size:
                        1,

                    execute() {

                        cpu.EIP =
                            cpu.pop32();

                    }

                };


            default:

                throw new Error(
                    `Unsupported x86 opcode 0x${
                        opcode
                            .toString(16)
                            .padStart(2, "0")
                    } at 0x${
                        webBktxHex(ip)
                    }`
                );

        }

    }

}


/* ============================================================
   XBE
============================================================ */

class WebBktxXBE {

    constructor(
        source = null
    ) {

        this.source =
            source;


        this.loaded =
            false;


        this.buffer =
            null;


        this.header =
            null;


        this.entryPoint =
            0;


        this.imageBase =
            0;


        this.sections =
            [];


        this.version =
            "1.1";

    }


    async load(
        source = this.source
    ) {

        if (
            !source
        ) {

            throw new Error(
                "No XBE source."
            );

        }


        this.source =
            source;


        if (
            source instanceof ArrayBuffer
        ) {

            this.buffer =
                source.slice(
                    0
                );

        } else if (
            source instanceof Uint8Array
        ) {

            this.buffer =
                source.buffer.slice(
                    source.byteOffset,
                    source.byteOffset +
                    source.byteLength
                );

        } else if (
            typeof source.arrayBuffer ===
            "function"
        ) {

            this.buffer =
                await source.arrayBuffer();

        } else {

            throw new Error(
                "Unsupported XBE source."
            );

        }


        const bytes =
            new Uint8Array(
                this.buffer
            );


        if (
            bytes.length < 4
        ) {

            throw new Error(
                "File is too small to be an XBE."
            );

        }


        const magic =
            String.fromCharCode(
                bytes[0],
                bytes[1],
                bytes[2],
                bytes[3]
            );


        if (
            magic !== "XBEH"
        ) {

            throw new Error(
                `Invalid XBE signature: ${magic}`
            );

        }


        this.header = {

            magic,

            size:
                bytes.length

        };


        this.loaded =
            true;


        return this;

    }


    getSize() {

        return this.buffer
            ? this.buffer.byteLength
            : 0;

    }


    getEntryPoint() {

        return this.entryPoint >>> 0;

    }


    getStatus() {

        return {

            version:
                this.version,

            loaded:
                this.loaded,

            size:
                this.getSize(),

            entryPoint:
                this.entryPoint >>> 0,

            imageBase:
                this.imageBase >>> 0,

            sections:
                this.sections.length,

            header:
                this.header

        };

    }

}


/* ============================================================
   THUNKS
============================================================ */

class WebBktxThunks {

    constructor() {

        this.table =
            new Map();


        this.version =
            "1.1";

    }


    register(
        address,
        handler
    ) {

        if (
            typeof handler !==
            "function"
        ) {

            throw new Error(
                "Thunk handler must be a function."
            );

        }


        this.table.set(
            Number(address) >>> 0,
            handler
        );

    }


    unregister(
        address
    ) {

        return this.table.delete(
            Number(address) >>> 0
        );

    }


    has(
        address
    ) {

        return this.table.has(
            Number(address) >>> 0
        );

    }


    call(
        address,
        ...args
    ) {

        const key =
            Number(address) >>> 0;


        const handler =
            this.table.get(
                key
            );


        if (
            !handler
        ) {

            throw new Error(
                `Unknown thunk: 0x${webBktxHex(key)}`
            );

        }


        return handler(
            ...args
        );

    }


    clear() {

        this.table.clear();

    }


    getStatus() {

        return {

            version:
                this.version,

            count:
                this.table.size

        };

    }

}


/* ============================================================
   XAPI
============================================================ */

class WebBktxXAPI {

    constructor(
        core = null
    ) {

        this.core =
            core;


        this.functions =
            new Map();


        this.version =
            "1.1";


        this.registerDefaults();

    }


    register(
        name,
        handler
    ) {

        if (
            typeof handler !==
            "function"
        ) {

            throw new Error(
                `XAPI handler for ${name} must be a function.`
            );

        }


        this.functions.set(
            String(name),
            handler
        );

    }


    unregister(
        name
    ) {

        return this.functions.delete(
            String(name)
        );

    }


    has(
        name
    ) {

        return this.functions.has(
            String(name)
        );

    }


    call(
        name,
        ...args
    ) {

        const key =
            String(name);


        const fn =
            this.functions.get(
                key
            );


        if (
            !fn
        ) {

            throw new Error(
                `Unknown XAPI function: ${key}`
            );

        }


        return fn(
            ...args
        );

    }


    registerDefaults() {

        this.register(
            "DbgPrint",
            (...args) => {

                console.log(
                    "[WebBktx XAPI]",
                    ...args
                );


                return 0;

            }
        );


        this.register(
            "GetTickCount",
            () => {

                return Math.floor(
                    webBktxNow()
                );

            }
        );


        this.register(
            "GetVersion",
            () => {

                return WEBBKTX_VERSION;

            }
        );

    }


    getStatus() {

        return {

            version:
                this.version,

            functions:
                this.functions.size

        };

    }

}


/* ============================================================
   XFILE
============================================================ */

class WebBktxXFile {

    constructor() {

        this.files =
            new Map();


        this.nextHandle =
            1;


        this.version =
            "1.1";

    }


    async open(
        file
    ) {

        if (
            !file
        ) {

            throw new Error(
                "No file."
            );

        }


        let buffer;


        if (
            file instanceof ArrayBuffer
        ) {

            buffer =
                file.slice(
                    0
                );

        } else if (
            file instanceof Uint8Array
        ) {

            buffer =
                file.buffer.slice(
                    file.byteOffset,
                    file.byteOffset +
                    file.byteLength
                );

        } else if (
            typeof file.arrayBuffer ===
            "function"
        ) {

            buffer =
                await file.arrayBuffer();

        } else {

            throw new Error(
                "Unsupported file source."
            );

        }


        const handle =
            `file_${this.nextHandle++}`;


        this.files.set(
            handle,
            {

                name:
                    file.name ||
                    "memory-file",

                size:
                    buffer.byteLength,

                buffer

            }
        );


        return handle;

    }


    get(
        handle
    ) {

        return this.files.get(
            String(handle)
        ) || null;

    }


    close(
        handle
    ) {

        return this.files.delete(
            String(handle)
        );

    }


    clear() {

        this.files.clear();

    }


    getStatus() {

        return {

            version:
                this.version,

            openFiles:
                this.files.size

        };

    }

}


/* ============================================================
   KERNEL
============================================================ */

class WebBktxKernel {

    constructor(
        core = null
    ) {

        this.core =
            core;


        this.initialized =
            false;


        this.version =
            "1.1";


        this.services =
            new Map();

    }


    async initialize() {

        this.initialized =
            true;


        return true;

    }


    registerService(
        name,
        service
    ) {

        this.services.set(
            String(name),
            service
        );

    }


    unregisterService(
        name
    ) {

        return this.services.delete(
            String(name)
        );

    }


    getService(
        name
    ) {

        return this.services.get(
            String(name)
        ) || null;

    }


    hasService(
        name
    ) {

        return this.services.has(
            String(name)
        );

    }


    start() {

        this.initialized =
            true;


        return true;

    }


    stop() {

        this.initialized =
            false;

    }


    getStatus() {

        return {

            version:
                this.version,

            initialized:
                this.initialized,

            services:
                [
                    ...this.services.keys()
                ]

        };

    }

}


/* ============================================================
   XINPUT
============================================================ */

class WebBktxXInput {

    constructor() {

        this.version =
            "1.1";


        this.buttons =
            Object.create(
                null
            );


        this.axes = {

            leftX:
                0,

            leftY:
                0,

            rightX:
                0,

            rightY:
                0,

            leftTrigger:
                0,

            rightTrigger:
                0

        };


        this.gamepadIndex =
            null;


        this.keyboard =
            Object.create(
                null
            );


        this.touch =
            [];


        this.started =
            false;


        this.animationHandle =
            null;


        this.boundGamepad =
            this.pollGamepads.bind(
                this
            );


        this.boundKeyDown =
            event => {

                this.keyboard[
                    event.code
                ] =
                    true;

            };


        this.boundKeyUp =
            event => {

                this.keyboard[
                    event.code
                ] =
                    false;

            };

    }


    initialize() {

        if (
            this.started
        ) {

            return;

        }


        if (
            typeof window !==
            "undefined"
        ) {

            window.addEventListener(
                "keydown",
                this.boundKeyDown
            );


            window.addEventListener(
                "keyup",
                this.boundKeyUp
            );

        }


        this.started =
            true;


        this.pollGamepads();

    }


    pollGamepads() {

        if (
            !this.started
        ) {

            return;

        }


        if (
            typeof navigator ===
            "undefined" ||
            typeof navigator.getGamepads !==
            "function"
        ) {

            return;

        }


        const pads =
            navigator.getGamepads();


        let found =
            false;


        for (
            let i = 0;
            i < pads.length;
            i++
        ) {

            const pad =
                pads[i];


            if (
                !pad
            ) {

                continue;

            }


            found =
                true;


            this.gamepadIndex =
                i;


            this.buttons =
                Object.create(
                    null
                );


            for (
                let b = 0;
                b < pad.buttons.length;
                b++
            ) {

                this.buttons[b] =
                    Boolean(
                        pad.buttons[b].pressed
                    );

            }


            if (
                pad.axes.length >= 4
            ) {

                this.axes.leftX =
                    pad.axes[0];

                this.axes.leftY =
                    pad.axes[1];

                this.axes.rightX =
                    pad.axes[2];

                this.axes.rightY =
                    pad.axes[3];

            }


            if (
                pad.buttons.length >= 8
            ) {

                this.axes.leftTrigger =
                    pad.buttons[6]
                        .value ??
                    0;

                this.axes.rightTrigger =
                    pad.buttons[7]
                        .value ??
                    0;

            }


            break;

        }


        if (
            !found
        ) {

            this.gamepadIndex =
                null;

        }


        if (
            typeof requestAnimationFrame ===
            "function"
        ) {

            this.animationHandle =
                requestAnimationFrame(
                    this.boundGamepad
                );

        }

    }


    getState() {

        return {

            version:
                this.version,

            started:
                this.started,

            gamepadIndex:
                this.gamepadIndex,

            buttons:
                {
                    ...this.buttons
                },

            axes:
                {
                    ...this.axes
                },

            keyboard:
                {
                    ...this.keyboard
                },

            touch:
                [
                    ...this.touch
                ]

        };

    }


    isButtonPressed(
        button
    ) {

        return Boolean(
            this.buttons[
                button
            ]
        );

    }


    isKeyDown(
        code
    ) {

        return Boolean(
            this.keyboard[
                code
            ]
        );

    }


    destroy() {

        if (
            typeof window !==
            "undefined"
        ) {

            window.removeEventListener(
                "keydown",
                this.boundKeyDown
            );


            window.removeEventListener(
                "keyup",
                this.boundKeyUp
            );

        }


        if (
            this.animationHandle !==
            null &&
            typeof cancelAnimationFrame ===
            "function"
        ) {

            cancelAnimationFrame(
                this.animationHandle
            );

        }


        this.animationHandle =
            null;


        this.started =
            false;

    }

}


/* ============================================================
   XGRAPHICS
============================================================ */

class WebBktxXGraphics {

    constructor(
        canvas = null
    ) {

        this.canvas =
            null;


        this.context =
            null;


        this.width =
            1280;


        this.height =
            720;


        this.running =
            false;


        this.frameCount =
            0;


        this.lastPresent =
            0;


        this.version =
            "1.1";


        this.animationHandle =
            null;


        if (
            canvas
        ) {

            this.initialize(
                canvas
            );

        }

    }


    initialize(
        canvas
    ) {

        if (
            !canvas ||
            typeof canvas.getContext !==
            "function"
        ) {

            throw new Error(
                "Invalid graphics canvas."
            );

        }


        this.canvas =
            canvas;


        this.context =
            canvas.getContext(
                "2d",
                {
                    alpha:
                        false
                }
            );


        if (
            !this.context
        ) {

            throw new Error(
                "Unable to create 2D graphics context."
            );

        }


        this.setResolution(
            this.width,
            this.height
        );


        this.clear(
            0,
            0,
            0,
            255
        );

    }


    SetResolution(
        width,
        height
    ) {

        this.setResolution(
            width,
            height
        );

    }


    setResolution(
        width,
        height
    ) {

        this.width =
            Math.max(
                1,
                Number(width) | 0
            );


        this.height =
            Math.max(
                1,
                Number(height) | 0
            );


        if (
            this.canvas
        ) {

            this.canvas.width =
                this.width;


            this.canvas.height =
                this.height;

        }

    }


    Clear(
        r = 0,
        g = 0,
        b = 0,
        a = 255
    ) {

        this.clear(
            r,
            g,
            b,
            a
        );

    }


    clear(
        r = 0,
        g = 0,
        b = 0,
        a = 255
    ) {

        if (
            !this.context
        ) {

            return;

        }


        this.context.fillStyle =
            `rgba(${r},${g},${b},${a / 255})`;


        this.context.fillRect(
            0,
            0,
            this.width,
            this.height
        );

    }


    Present() {

        this.frameCount +=
            1;


        this.lastPresent =
            webBktxNow();

    }


    start() {

        if (
            this.running
        ) {

            return;

        }


        this.running =
            true;


        const frame =
            () => {

                if (
                    !this.running
                ) {

                    return;

                }


                this.Present();


                if (
                    typeof requestAnimationFrame ===
                    "function"
                ) {

                    this.animationHandle =
                        requestAnimationFrame(
                            frame
                        );

                }

            };


        if (
            typeof requestAnimationFrame ===
            "function"
        ) {

            this.animationHandle =
                requestAnimationFrame(
                    frame
                );

        }

    }


    stop() {

        this.running =
            false;


        if (
            this.animationHandle !==
            null &&
            typeof cancelAnimationFrame ===
            "function"
        ) {

            cancelAnimationFrame(
                this.animationHandle
            );

        }


        this.animationHandle =
            null;

    }


    getStatus() {

        return {

            version:
                this.version,

            width:
                this.width,

            height:
                this.height,

            frameCount:
                this.frameCount,

            initialized:
                Boolean(
                    this.context
                ),

            running:
                this.running

        };

    }

}


/* ============================================================
   GRAPHICS ALIAS
============================================================ */

const WebBktxGraphics =
    WebBktxXGraphics;


/* ============================================================
   CORE
============================================================ */

class WebBktxCore {

    constructor(
        options = {}
    ) {

        this.version =
            WEBBKTX_VERSION;


        this.options =
            options;


        this.debug =
            Boolean(
                options.debug
            );


        this.ramSize =
            Number(
                options.ramSize ||
                WEBBKTX_RAM_SIZE
            );


        /*
         * ----------------------------------------------------
         * MEMORY
         * ----------------------------------------------------
         */

        this.memory =
            new WebBktxMemory(
                this.ramSize
            );


        /*
         * ----------------------------------------------------
         * DECODER
         * ----------------------------------------------------
         */

        this.decoder =
            new WebBktxDecoder(
                this.memory
            );


        /*
         * ----------------------------------------------------
         * CPU
         * ----------------------------------------------------
         */

        this.cpu =
            new WebBktxCPU(
                this.memory
            );


        this.cpu.attachDecoder(
            this.decoder
        );


        /*
         * ----------------------------------------------------
         * SYSTEM SERVICES
         * ----------------------------------------------------
         */

        this.thunks =
            new WebBktxThunks();


        this.xapi =
            new WebBktxXAPI(
                this
            );


        this.xfile =
            new WebBktxXFile();


        this.kernel =
            new WebBktxKernel(
                this
            );


        /*
         * ----------------------------------------------------
         * OPTIONAL SUBSYSTEMS
         * ----------------------------------------------------
         */

        this.input =
            null;


        this.xinput =
            null;


        this.graphics =
            null;


        this.xgraphics =
            null;


        this.xbe =
            null;


        /*
         * ----------------------------------------------------
         * STATE
         * ----------------------------------------------------
         */

        this.initialized =
            false;


        this.running =
            false;


        this.lastError =
            null;

    }


    async initialize() {

        if (
            this.initialized
        ) {

            return true;

        }


        await this.kernel.initialize();


        /*
         * Register core services.
         */

        this.kernel.registerService(
            "memory",
            this.memory
        );


        this.kernel.registerService(
            "cpu",
            this.cpu
        );


        this.kernel.registerService(
            "decoder",
            this.decoder
        );


        this.kernel.registerService(
            "thunks",
            this.thunks
        );


        this.kernel.registerService(
            "xapi",
            this.xapi
        );


        this.kernel.registerService(
            "xfile",
            this.xfile
        );


        this.initialized =
            true;


        if (
            this.debug
        ) {

            console.log(
                `[WebBktx Core ${this.version}] initialized`
            );

        }


        return true;

    }


    reset() {

        this.stop();


        this.cpu.reset();


        this.memory.reset();


        this.xbe =
            null;


        this.lastError =
            null;

    }


    async loadGame(
        source
    ) {

        if (
            !this.initialized
        ) {

            await this.initialize();

        }


        this.xbe =
            new WebBktxXBE(
                source
            );


        await this.xbe.load();


        /*
         * The XBE is validated here.
         *
         * Actual Xbox image mapping remains a
         * separate subsystem.
         */

        return {

            success:
                true,

            image:
                this.xbe,

            xbe:
                this.xbe,

            status:
                this.xbe.getStatus()

        };

    }


    step() {

        if (
            !this.initialized
        ) {

            throw new Error(
                "WebBktx Core is not initialized."
            );

        }


        return this.cpu.step();

    }


    run(
        limit
    ) {

        if (
            !this.initialized
        ) {

            throw new Error(
                "WebBktx Core is not initialized."
            );

        }


        this.running =
            true;


        try {

            return this.cpu.run(
                limit
            );

        } finally {

            this.running =
                false;

        }

    }


    stop() {

        this.running =
            false;


        this.cpu.stop();


        if (
            this.graphics
        ) {

            this.graphics.stop();

        }

    }


    attachGraphics(
        canvas
    ) {

        if (
            this.graphics
        ) {

            this.graphics.stop();

        }


        this.graphics =
            new WebBktxXGraphics(
                canvas
            );


        this.xgraphics =
            this.graphics;


        this.kernel.registerService(
            "graphics",
            this.graphics
        );


        return this.graphics;

    }


    attachInput() {

        if (
            this.input
        ) {

            this.input.destroy();

        }


        this.input =
            new WebBktxXInput();


        this.input.initialize();


        this.xinput =
            this.input;


        this.kernel.registerService(
            "xinput",
            this.input
        );


        return this.input;

    }


    getStatus() {

        return {

            version:
                this.version,

            initialized:
                this.initialized,

            running:
                this.running,

            lastError:
                this.lastError,

            memory:
                this.memory.getStatus(),

            cpu:
                this.cpu.getStatus(),

            kernel:
                this.kernel.getStatus(),

            thunks:
                this.thunks.getStatus(),

            xapi:
                this.xapi.getStatus(),

            xfile:
                this.xfile.getStatus(),

            xbe:
                this.xbe
                    ? this.xbe.getStatus()
                    : null,

            input:
                this.input
                    ? this.input.getState()
                    : null,

            graphics:
                this.graphics
                    ? this.graphics.getStatus()
                    : null

        };

    }


    getState() {

        return this.getStatus();

    }


    selfTest() {

        const results = {

            memory:
                false,

            cpu:
                null,

            decoder:
                false,

            thunks:
                false,

            xapi:
                false,

            kernel:
                false,

            passed:
                false

        };


        try {

            /*
             * MEMORY
             */

            const address =
                0x2000;


            this.memory.write32(
                address,
                0xDEADBEEF
            );


            results.memory =
                this.memory.read32(
                    address
                ) ===
                0xDEADBEEF;


            /*
             * CPU
             */

            results.cpu =
                this.cpu.selfTest();


            /*
             * DECODER
             */

            this.memory.write8(
                0,
                0x90
            );


            const decoded =
                this.decoder.decode(
                    this.cpu,
                    0
                );


            results.decoder =
                Boolean(
                    decoded &&
                    decoded.opcode ===
                    0x90 &&
                    typeof decoded.execute ===
                    "function"
                );


            /*
             * THUNKS
             */

            const testThunkAddress =
                0x1000;


            this.thunks.register(
                testThunkAddress,
                value =>
                    value + 1
            );


            results.thunks =
                this.thunks.call(
                    testThunkAddress,
                    41
                ) ===
                42;


            this.thunks.unregister(
                testThunkAddress
            );


            /*
             * XAPI
             */

            results.xapi =
                this.xapi.call(
                    "GetVersion"
                ) ===
                WEBBKTX_VERSION;


            /*
             * KERNEL
             */

            results.kernel =
                this.kernel.initialized;


            /*
             * FINAL
             */

            results.passed =
                Boolean(

                    results.memory &&

                    results.cpu &&
                    results.cpu.passed &&

                    results.decoder &&

                    results.thunks &&

                    results.xapi &&

                    results.kernel

                );

        } catch (error) {

            results.error =
                error instanceof Error
                    ? error.message
                    : String(error);


            results.passed =
                false;

        }


        return results;

    }

}


/* ============================================================
   GLOBAL EXPORTS
============================================================ */

if (
    typeof window !==
    "undefined"
) {

    window.WebBktxMemory =
        WebBktxMemory;


    window.WebBktxCPU =
        WebBktxCPU;


    window.WebBktxCPUFlags =
        WebBktxCPUFlags;


    window.WebBktxDecoder =
        WebBktxDecoder;


    window.WebBktxXBE =
        WebBktxXBE;


    window.WebBktxThunks =
        WebBktxThunks;


    window.WebBktxXAPI =
        WebBktxXAPI;


    window.WebBktxXFile =
        WebBktxXFile;


    window.WebBktxKernel =
        WebBktxKernel;


    window.WebBktxXInput =
        WebBktxXInput;


    window.WebBktxInput =
        WebBktxXInput;


    window.WebBktxXGraphics =
        WebBktxXGraphics;


    window.WebBktxGraphics =
        WebBktxGraphics;


    window.WebBktxCore =
        WebBktxCore;


    window.WebBktxVersion =
        WEBBKTX_VERSION;


    /*
     * Unified runtime object.
     */

    window.WebBktx = {

        version:
            WEBBKTX_VERSION,

        Memory:
            WebBktxMemory,

        CPU:
            WebBktxCPU,

        CPUFlags:
            WebBktxCPUFlags,

        Decoder:
            WebBktxDecoder,

        XBE:
            WebBktxXBE,

        Thunks:
            WebBktxThunks,

        XAPI:
            WebBktxXAPI,

        XFile:
            WebBktxXFile,

        Kernel:
            WebBktxKernel,

        XInput:
            WebBktxXInput,

        Input:
            WebBktxXInput,

        XGraphics:
            WebBktxXGraphics,

        Graphics:
            WebBktxXGraphics,

        Core:
            WebBktxCore

    };

}


/* ============================================================
   NODE / NON-BROWSER EXPORT
============================================================ */

if (
    typeof module !==
    "undefined" &&
    module.exports
) {

    module.exports = {

        WEBBKTX_VERSION,

        WebBktxMemory,

        WebBktxCPU,

        WebBktxCPUFlags,

        WebBktxDecoder,

        WebBktxXBE,

        WebBktxThunks,

        WebBktxXAPI,

        WebBktxXFile,

        WebBktxKernel,

        WebBktxXInput,

        WebBktxXGraphics,

        WebBktxGraphics,

        WebBktxCore

    };

}


/* ============================================================
   BOOT DIAGNOSTIC
============================================================ */

if (
    typeof console !==
    "undefined"
) {

    console.log(
        `%cWebBktx Unified Runtime ${WEBBKTX_VERSION} loaded.`,
        "font-weight:bold"
    );


    if (
        typeof window !==
        "undefined"
    ) {

        console.table({

            memory:
                typeof window.WebBktxMemory,

            cpu:
                typeof window.WebBktxCPU,

            decoder:
                typeof window.WebBktxDecoder,

            xbe:
                typeof window.WebBktxXBE,

            thunks:
                typeof window.WebBktxThunks,

            xapi:
                typeof window.WebBktxXAPI,

            xfile:
                typeof window.WebBktxXFile,

            kernel:
                typeof window.WebBktxKernel,

            xinput:
                typeof window.WebBktxXInput,

            xgraphics:
                typeof window.WebBktxXGraphics,

            graphics:
                typeof window.WebBktxGraphics,

            core:
                typeof window.WebBktxCore

        });

    }

}


/* ============================================================
   END
============================================================ */
