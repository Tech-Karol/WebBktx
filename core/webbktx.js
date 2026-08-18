/*
 * ============================================================
 * WebBktx Unified Runtime
 * XBE BOOT RUNTIME
 *
 * Version: 1.3.0
 *
 * Pipeline:
 *
 * XBE
 *  ↓
 * Parse header
 *  ↓
 * Parse certificate
 *  ↓
 * Parse sections
 *  ↓
 * Map sections into RAM
 *  ↓
 * Resolve EntryPoint
 *  ↓
 * Setup CPU
 *  ↓
 * Execute x86
 *  ↓
 * Diagnostics
 *
 * Experimental Xbox-compatible browser runtime.
 * ============================================================
 */

"use strict";

const WEBBKTX_VERSION = "1.3.0";

const WEBBKTX_RAM_SIZE =
    64 * 1024 * 1024;


/* ============================================================
   UTILITIES
============================================================ */

function u32(value) {
    return Number(value) >>> 0;
}

function hex(value, width = 8) {
    return "0x" +
        u32(value)
            .toString(16)
            .toUpperCase()
            .padStart(width, "0");
}

function clamp(value, min, max) {
    return Math.max(
        min,
        Math.min(max, value)
    );
}


/* ============================================================
   MEMORY
============================================================ */

class WebBktxMemory {

    constructor(size = WEBBKTX_RAM_SIZE) {

        size = Number(size);

        if (
            !Number.isInteger(size) ||
            size <= 0
        ) {
            throw new Error(
                "Invalid memory size."
            );
        }

        this.size = size;

        this.buffer =
            new ArrayBuffer(size);

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


    check(address, bytes = 1) {

        address = u32(address);
        bytes = Number(bytes);

        if (
            !Number.isInteger(bytes) ||
            bytes < 0
        ) {
            throw new RangeError(
                "Invalid memory access size."
            );
        }

        if (
            address > this.size ||
            bytes > this.size - address
        ) {
            throw new RangeError(
                `Memory access violation at ${hex(address)}`
            );
        }

        return address;
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


    write8(address, value) {

        this.u8[
            this.check(address)
        ] =
            Number(value) & 0xFF;
    }


    write16(address, value) {

        this.view.setUint16(
            this.check(address, 2),
            Number(value) & 0xFFFF,
            true
        );
    }


    write32(address, value) {

        this.view.setUint32(
            this.check(address, 4),
            u32(value),
            true
        );
    }


    readBytes(address, length) {

        length = Number(length);

        this.check(
            address,
            length
        );

        return this.u8.slice(
            u32(address),
            u32(address) + length
        );
    }


    writeBytes(address, data) {

        const bytes =
            data instanceof Uint8Array
                ? data
                : new Uint8Array(data);

        const target =
            this.check(
                address,
                bytes.length
            );

        this.u8.set(
            bytes,
            target
        );
    }


    fill(
        address,
        length,
        value = 0
    ) {

        address = u32(address);
        length = Number(length);

        this.check(
            address,
            length
        );

        this.u8.fill(
            Number(value) & 0xFF,
            address,
            address + length
        );
    }


    getStatus() {

        return {
            size: this.size,
            bytes: this.size,
            megabytes:
                this.size / 1024 / 1024
        };
    }
}


/* ============================================================
   CPU FLAGS
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

        this.memory = memory;

        this.decoder = null;

        this.maxInstructions = 100000;

        this.breakpoints = new Set();

        this.traceEnabled = false;

        this.trace = [];

        this.maxTraceEntries = 2000;

        this.onInstruction = null;
        this.onBreakpoint = null;
        this.onHalt = null;
        this.onFault = null;

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

        this.ESP =
            Math.max(
                0,
                this.memory.size - 4
            ) >>> 0;

        this.EIP = 0;

        this.EFLAGS = 0x00000002;

        this.running = false;
        this.halted = false;
        this.faulted = false;

        this.lastError = null;
        this.lastInstruction = null;

        this.cycles = 0;
        this.instructionsExecuted = 0;

        this.trace.length = 0;
    }


    attachDecoder(decoder) {

        if (!decoder) {
            throw new Error(
                "Invalid decoder."
            );
        }

        this.decoder = decoder;

        return true;
    }


    getRegister(name) {

        const n =
            String(name)
                .toUpperCase();

        switch (n) {

            case "EAX":
            case "EBX":
            case "ECX":
            case "EDX":
            case "ESI":
            case "EDI":
            case "EBP":
            case "ESP":
            case "EIP":
            case "EFLAGS":

                return this[n] >>> 0;

            default:

                throw new Error(
                    `Unknown register: ${n}`
                );
        }
    }


    setRegister(name, value) {

        const n =
            String(name)
                .toUpperCase();

        if (n === "EFLAGS") {

            this.EFLAGS =
                u32(value) | 0x02;

            return;
        }

        switch (n) {

            case "EAX":
            case "EBX":
            case "ECX":
            case "EDX":
            case "ESI":
            case "EDI":
            case "EBP":
            case "ESP":
            case "EIP":

                this[n] = u32(value);

                return;

            default:

                throw new Error(
                    `Unknown register: ${n}`
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


    getFlag(flag) {

        return (
            (this.EFLAGS & flag) !== 0
        );
    }


    setFlag(flag, enabled) {

        if (enabled) {
            this.EFLAGS |= flag;
        } else {
            this.EFLAGS &= ~flag;
        }

        this.EFLAGS |= 0x02;
        this.EFLAGS >>>= 0;
    }


    parity8(value) {

        value &= 0xFF;

        let parity = 0;

        while (value) {

            parity ^=
                value & 1;

            value >>>= 1;
        }

        return parity === 0;
    }


    updateLogicFlags(result) {

        result >>>= 0;

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
            Boolean(
                result & 0x80000000
            )
        );

        this.setFlag(
            WebBktxCPUFlags.PF,
            this.parity8(result)
        );
    }


    updateAddFlags(a, b, result) {

        a >>>= 0;
        b >>>= 0;
        result >>>= 0;

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
            Boolean(
                result & 0x80000000
            )
        );

        this.setFlag(
            WebBktxCPUFlags.PF,
            this.parity8(result)
        );

        this.setFlag(
            WebBktxCPUFlags.AF,
            Boolean(
                (a ^ b ^ result) & 0x10
            )
        );

        this.setFlag(
            WebBktxCPUFlags.OF,
            Boolean(
                (
                    (~(a ^ b)) &
                    (a ^ result) &
                    0x80000000
                )
            )
        );
    }


    updateSubFlags(a, b, result) {

        a >>>= 0;
        b >>>= 0;
        result >>>= 0;

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
            Boolean(
                result & 0x80000000
            )
        );

        this.setFlag(
            WebBktxCPUFlags.PF,
            this.parity8(result)
        );

        this.setFlag(
            WebBktxCPUFlags.AF,
            Boolean(
                (a ^ b ^ result) & 0x10
            )
        );

        this.setFlag(
            WebBktxCPUFlags.OF,
            Boolean(
                (
                    (a ^ b) &
                    (a ^ result) &
                    0x80000000
                )
            )
        );
    }


    add32(a, b) {

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


    sub32(a, b) {

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

        const oldCF =
            this.getFlag(
                WebBktxCPUFlags.CF
            );

        const result =
            ((value >>> 0) + 1) >>> 0;

        this.updateAddFlags(
            value,
            1,
            result
        );

        this.setFlag(
            WebBktxCPUFlags.CF,
            oldCF
        );

        return result;
    }


    dec32(value) {

        const oldCF =
            this.getFlag(
                WebBktxCPUFlags.CF
            );

        const result =
            ((value >>> 0) - 1) >>> 0;

        this.updateSubFlags(
            value,
            1,
            result
        );

        this.setFlag(
            WebBktxCPUFlags.CF,
            oldCF
        );

        return result;
    }


    xor32(a, b) {

        const result =
            (
                (a >>> 0) ^
                (b >>> 0)
            ) >>> 0;

        this.updateLogicFlags(result);

        return result;
    }


    and32(a, b) {

        const result =
            (
                (a >>> 0) &
                (b >>> 0)
            ) >>> 0;

        this.updateLogicFlags(result);

        return result;
    }


    or32(a, b) {

        const result =
            (
                (a >>> 0) |
                (b >>> 0)
            ) >>> 0;

        this.updateLogicFlags(result);

        return result;
    }


    push32(value) {

        if (this.ESP < 4) {

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


    read8(address) {
        return this.memory.read8(address);
    }


    read16(address) {
        return this.memory.read16(address);
    }


    read32(address) {
        return this.memory.read32(address);
    }


    write8(address, value) {
        this.memory.write8(address, value);
    }


    write16(address, value) {
        this.memory.write16(address, value);
    }


    write32(address, value) {
        this.memory.write32(address, value);
    }


    addBreakpoint(address) {

        this.breakpoints.add(
            u32(address)
        );
    }


    removeBreakpoint(address) {

        this.breakpoints.delete(
            u32(address)
        );
    }


    clearBreakpoints() {

        this.breakpoints.clear();
    }


    hasBreakpoint(address) {

        return this.breakpoints.has(
            u32(address)
        );
    }


    enableTrace(enabled = true) {

        this.traceEnabled =
            Boolean(enabled);
    }


    clearTrace() {

        this.trace.length = 0;
    }


    getTrace() {

        return [
            ...this.trace
        ];
    }


    addTrace(entry) {

        if (!this.traceEnabled) {
            return;
        }

        this.trace.push(entry);

        while (
            this.trace.length >
            this.maxTraceEntries
        ) {
            this.trace.shift();
        }
    }


    step() {

        if (this.halted) {

            return {
                executed: false,
                halted: true,
                reason: "CPU HALTED"
            };
        }


        if (this.faulted) {

            return {
                executed: false,
                faulted: true,
                reason: this.lastError
            };
        }


        if (!this.decoder) {

            throw new Error(
                "No decoder attached."
            );
        }


        const address =
            this.EIP >>> 0;


        if (
            this.hasBreakpoint(address)
        ) {

            this.running = false;

            if (
                typeof this.onBreakpoint ===
                "function"
            ) {
                this.onBreakpoint(address);
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


            if (!instruction) {

                throw new Error(
                    `No instruction at ${hex(address)}`
                );
            }


            if (
                typeof instruction.execute !==
                "function"
            ) {

                throw new Error(
                    "Instruction has no execute()."
                );
            }


            instruction.execute(this);

            this.cycles++;
            this.instructionsExecuted++;


            const result = {

                executed: true,

                address,

                opcode:
                    instruction.opcode ?? null,

                mnemonic:
                    instruction.mnemonic ??
                    "UNKNOWN",

                size:
                    instruction.size ??
                    1,

                registers:
                    this.getRegisters(),

                cycles:
                    this.cycles,

                halted:
                    this.halted
            };


            this.lastInstruction =
                result;


            this.addTrace(result);


            if (
                typeof this.onInstruction ===
                "function"
            ) {
                this.onInstruction(result);
            }


            if (
                this.halted &&
                typeof this.onHalt ===
                "function"
            ) {
                this.onHalt(result);
            }


            return result;

        } catch (error) {

            this.raiseFault(error);

            throw error;
        }
    }


    run(limit = this.maxInstructions) {

        limit = Number(limit);

        if (
            !Number.isInteger(limit) ||
            limit <= 0
        ) {
            throw new Error(
                "Invalid CPU execution limit."
            );
        }


        this.running = true;

        let executed = 0;
        let last = null;


        try {

            while (
                this.running &&
                !this.halted &&
                !this.faulted &&
                executed < limit
            ) {

                last = this.step();

                if (
                    last &&
                    last.breakpoint
                ) {
                    break;
                }

                if (
                    last &&
                    last.executed
                ) {
                    executed++;
                }
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

        this.running = false;
    }


    halt() {

        this.halted = true;
        this.running = false;
    }


    raiseFault(error) {

        this.faulted = true;
        this.running = false;

        this.lastError =
            error instanceof Error
                ? error.message
                : String(error);


        if (
            typeof this.onFault ===
            "function"
        ) {
            this.onFault(error);
        }
    }


    getStatus() {

        return {

            version:
                WEBBKTX_VERSION,

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
                this.getRegisters()
        };
    }


    selfTest() {

        this.reset();

        const tests = [];


        tests.push({
            name: "ADD",
            pass:
                this.add32(10, 20) === 30
        });


        tests.push({
            name: "SUB",
            pass:
                this.sub32(50, 20) === 30
        });


        tests.push({
            name: "XOR",
            pass:
                this.xor32(
                    0xFF00,
                    0x0F00
                ) === 0xF000
        });


        const oldESP = this.ESP;

        this.push32(
            0x12345678
        );


        tests.push({
            name: "STACK",
            pass:
                this.pop32() ===
                    0x12345678 &&
                this.ESP === oldESP
        });


        this.write32(
            0x1000,
            0xDEADBEEF
        );


        tests.push({
            name: "MEMORY",
            pass:
                this.read32(0x1000) ===
                0xDEADBEEF
        });


        return {

            version:
                WEBBKTX_VERSION,

            passed:
                tests.every(
                    x => x.pass
                ),

            tests
        };
    }
}


/* ============================================================
   DECODER
============================================================ */

class WebBktxDecoder {

    constructor(memory) {

        this.memory = memory;

        this.version =
            WEBBKTX_VERSION;
    }


    decode(cpu, address) {

        const opcode =
            this.memory.read8(address);


        switch (opcode) {

            case 0x90:

                return {

                    opcode,

                    mnemonic: "NOP",

                    size: 1,

                    execute() {

                        cpu.EIP =
                            (
                                cpu.EIP + 1
                            ) >>> 0;
                    }
                };


            case 0xF4:

                return {

                    opcode,

                    mnemonic: "HLT",

                    size: 1,

                    execute() {

                        cpu.EIP =
                            (
                                cpu.EIP + 1
                            ) >>> 0;

                        cpu.halt();
                    }
                };


            /*
             * MOV r32, imm32
             */

            case 0xB8:
            case 0xB9:
            case 0xBA:
            case 0xBB:
            case 0xBC:
            case 0xBD:
            case 0xBE:
            case 0xBF: {

                const reg =
                    opcode - 0xB8;

                const value =
                    this.memory.read32(
                        address + 1
                    );


                const names = [

                    "EAX",
                    "ECX",
                    "EDX",
                    "EBX",
                    "ESP",
                    "EBP",
                    "ESI",
                    "EDI"

                ];


                return {

                    opcode,

                    mnemonic:
                        `MOV ${names[reg]}, imm32`,

                    size: 5,

                    execute() {

                        cpu.setRegister(
                            names[reg],
                            value
                        );

                        cpu.EIP =
                            (
                                cpu.EIP + 5
                            ) >>> 0;
                    }
                };
            }


            /*
             * ADD EAX, imm32
             */

            case 0x05: {

                const value =
                    this.memory.read32(
                        address + 1
                    );


                return {

                    opcode,

                    mnemonic:
                        "ADD EAX, imm32",

                    size: 5,

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


            /*
             * SUB EAX, imm32
             */

            case 0x2D: {

                const value =
                    this.memory.read32(
                        address + 1
                    );


                return {

                    opcode,

                    mnemonic:
                        "SUB EAX, imm32",

                    size: 5,

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


            /*
             * INC / DEC
             */

            case 0x40:

                return {

                    opcode,

                    mnemonic: "INC EAX",

                    size: 1,

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


            case 0x48:

                return {

                    opcode,

                    mnemonic: "DEC EAX",

                    size: 1,

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


            /*
             * PUSH / POP EAX
             */

            case 0x50:

                return {

                    opcode,

                    mnemonic: "PUSH EAX",

                    size: 1,

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


            case 0x58:

                return {

                    opcode,

                    mnemonic: "POP EAX",

                    size: 1,

                    execute() {

                        cpu.EAX =
                            cpu.pop32();

                        cpu.EIP =
                            (
                                cpu.EIP + 1
                            ) >>> 0;
                    }
                };


            /*
             * RET
             */

            case 0xC3:

                return {

                    opcode,

                    mnemonic: "RET",

                    size: 1,

                    execute() {

                        cpu.EIP =
                            cpu.pop32();
                    }
                };


            /*
             * XOR EAX,EAX
             */

            case 0x31: {

                const modrm =
                    this.memory.read8(
                        address + 1
                    );


                if (modrm === 0xC0) {

                    return {

                        opcode,

                        mnemonic:
                            "XOR EAX,EAX",

                        size: 2,

                        execute() {

                            cpu.EAX =
                                cpu.xor32(
                                    cpu.EAX,
                                    cpu.EAX
                                );

                            cpu.EIP =
                                (
                                    cpu.EIP + 2
                                ) >>> 0;
                        }
                    };
                }

                break;
            }


            /*
             * TEST EAX,EAX
             */

            case 0x85: {

                const modrm =
                    this.memory.read8(
                        address + 1
                    );


                if (modrm === 0xC0) {

                    return {

                        opcode,

                        mnemonic:
                            "TEST EAX,EAX",

                        size: 2,

                        execute() {

                            cpu.updateLogicFlags(
                                cpu.EAX
                            );

                            cpu.EIP =
                                (
                                    cpu.EIP + 2
                                ) >>> 0;
                        }
                    };
                }

                break;
            }


            /*
             * JMP rel32
             */

            case 0xE9: {

                const relative =
                    this.memory.readSigned32(
                        address + 1
                    );


                return {

                    opcode,

                    mnemonic:
                        "JMP rel32",

                    size: 5,

                    execute() {

                        cpu.EIP =
                            (
                                cpu.EIP +
                                5 +
                                relative
                            ) >>> 0;
                    }
                };
            }


            /*
             * CALL rel32
             */

            case 0xE8: {

                const relative =
                    this.memory.readSigned32(
                        address + 1
                    );


                return {

                    opcode,

                    mnemonic:
                        "CALL rel32",

                    size: 5,

                    execute() {

                        cpu.push32(
                            (
                                cpu.EIP + 5
                            ) >>> 0
                        );

                        cpu.EIP =
                            (
                                cpu.EIP +
                                5 +
                                relative
                            ) >>> 0;
                    }
                };
            }


            /*
             * JMP short
             */

            case 0xEB: {

                const relative =
                    this.memory.readSigned8(
                        address + 1
                    );


                return {

                    opcode,

                    mnemonic:
                        "JMP rel8",

                    size: 2,

                    execute() {

                        cpu.EIP =
                            (
                                cpu.EIP +
                                2 +
                                relative
                            ) >>> 0;
                    }
                };
            }


            /*
             * JZ / JE short
             */

            case 0x74: {

                const relative =
                    this.memory.readSigned8(
                        address + 1
                    );


                return {

                    opcode,

                    mnemonic:
                        "JZ rel8",

                    size: 2,

                    execute() {

                        if (
                            cpu.getFlag(
                                WebBktxCPUFlags.ZF
                            )
                        ) {

                            cpu.EIP =
                                (
                                    cpu.EIP +
                                    2 +
                                    relative
                                ) >>> 0;

                        } else {

                            cpu.EIP =
                                (
                                    cpu.EIP + 2
                                ) >>> 0;
                        }
                    }
                };
            }


            /*
             * JNZ / JNE short
             */

            case 0x75: {

                const relative =
                    this.memory.readSigned8(
                        address + 1
                    );


                return {

                    opcode,

                    mnemonic:
                        "JNZ rel8",

                    size: 2,

                    execute() {

                        if (
                            !cpu.getFlag(
                                WebBktxCPUFlags.ZF
                            )
                        ) {

                            cpu.EIP =
                                (
                                    cpu.EIP +
                                    2 +
                                    relative
                                ) >>> 0;

                        } else {

                            cpu.EIP =
                                (
                                    cpu.EIP + 2
                                ) >>> 0;
                        }
                    }
                };
            }


            default:

                throw new Error(
                    `Unsupported x86 opcode ${hex(opcode, 2)} at ${hex(address)}`
                );
        }


        throw new Error(
            `Unsupported x86 instruction ${hex(opcode, 2)} at ${hex(address)}`
        );
    }
}


/* ============================================================
   XBE
============================================================ */

class WebBktxXBE {

    constructor(source = null) {

        this.source = source;

        this.loaded = false;

        this.buffer = null;

        this.bytes = null;

        this.header = null;

        this.certificate = null;

        this.sections = [];

        this.entryPointRaw = 0;

        this.entryPoint = 0;

        this.imageBase = 0;

        this.baseAddress = 0;

        this.name = "UNKNOWN.XBE";

        this.bootReady = false;

        this.mapping = [];
    }


    readU32(offset) {

        if (
            offset < 0 ||
            offset + 4 >
            this.bytes.length
        ) {
            throw new Error(
                `XBE header read outside file at ${hex(offset)}`
            );
        }

        return (
            this.bytes[offset] |
            (this.bytes[offset + 1] << 8) |
            (this.bytes[offset + 2] << 16) |
            (this.bytes[offset + 3] << 24)
        ) >>> 0;
    }


    readU16(offset) {

        if (
            offset < 0 ||
            offset + 2 >
            this.bytes.length
        ) {
            throw new Error(
                `XBE header read outside file at ${hex(offset)}`
            );
        }

        return (
            this.bytes[offset] |
            (this.bytes[offset + 1] << 8)
        ) >>> 0;
    }


    readString(offset, max = 256) {

        if (
            offset < 0 ||
            offset >= this.bytes.length
        ) {
            return "";
        }

        let result = "";

        const end =
            Math.min(
                this.bytes.length,
                offset + max
            );


        for (
            let i = offset;
            i < end;
            i++
        ) {

            const c =
                this.bytes[i];

            if (c === 0) {
                break;
            }

            if (
                c >= 32 &&
                c <= 126
            ) {
                result +=
                    String.fromCharCode(c);
            } else {
                result += "?";
            }
        }

        return result;
    }


    async load(source = this.source) {

        if (!source) {

            throw new Error(
                "No XBE source."
            );
        }


        this.source = source;


        if (
            source instanceof ArrayBuffer
        ) {

            this.buffer =
                source.slice(0);

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


        this.bytes =
            new Uint8Array(
                this.buffer
            );


        if (
            this.bytes.length < 0x130
        ) {

            throw new Error(
                "XBE file is too small."
            );
        }


        const magic =
            String.fromCharCode(
                this.bytes[0],
                this.bytes[1],
                this.bytes[2],
                this.bytes[3]
            );


        if (
            magic !== "XBEH"
        ) {

            throw new Error(
                `Invalid XBE signature: ${magic}`
            );
        }


        const baseAddress =
            this.readU32(0x104);

        const headerSize =
            this.readU32(0x108);

        const imageSize =
            this.readU32(0x10C);

        const imageHeaderSize =
            this.readU32(0x110);

        const certificateAddress =
            this.readU32(0x118);

        const sectionCount =
            this.readU32(0x11C);

        const sectionHeadersAddress =
            this.readU32(0x120);

        const initFlags =
            this.readU32(0x124);

        const rawEntryPoint =
            this.readU32(0x128);


        this.baseAddress =
            baseAddress;

        this.imageBase =
            baseAddress;

        this.entryPointRaw =
            rawEntryPoint;


        /*
         * Retail XBE entry point is commonly
         * XOR encoded with this value.
         *
         * We try both forms and select the one
         * which points into a mapped section.
         */

        const decodedRetail =
            (
                rawEntryPoint ^
                0xA8FC57AB
            ) >>> 0;


        const decodedDebug =
            (
                rawEntryPoint ^
                0x94859D48
            ) >>> 0;


        this.header = {

            magic,

            baseAddress,

            headerSize,

            imageSize,

            imageHeaderSize,

            certificateAddress,

            sectionCount,

            sectionHeadersAddress,

            initFlags,

            entryPointRaw:
                rawEntryPoint,

            entryPointRetail:
                decodedRetail,

            entryPointDebug:
                decodedDebug
        };


        this.sections = [];


        const maxSections =
            Math.min(
                sectionCount,
                4096
            );


        for (
            let i = 0;
            i < maxSections;
            i++
        ) {

            const offset =
                sectionHeadersAddress +
                i * 56;


            if (
                offset + 56 >
                this.bytes.length
            ) {
                break;
            }


            const flags =
                this.readU32(offset);

            const virtualAddress =
                this.readU32(
                    offset + 4
                );

            const virtualSize =
                this.readU32(
                    offset + 8
                );

            const rawAddress =
                this.readU32(
                    offset + 12
                );

            const rawSize =
                this.readU32(
                    offset + 16
                );

            const nameAddress =
                this.readU32(
                    offset + 20
                );

            const name =
                this.readString(
                    nameAddress,
                    64
                );


            this.sections.push({

                index: i,

                flags,

                virtualAddress,

                virtualSize,

                rawAddress,

                rawSize,

                nameAddress,

                name,

                headerOffset: offset
            });
        }


        /*
         * Certificate.
         */

        this.certificate = null;


        if (
            certificateAddress !== 0 &&
            certificateAddress + 4 <=
            this.bytes.length
        ) {

            const certSize =
                this.readU32(
                    certificateAddress
                );


            const certVersion =
                certificateAddress + 4 <=
                this.bytes.length
                    ? this.readU32(
                        certificateAddress + 4
                    )
                    : 0;


            this.certificate = {

                address:
                    certificateAddress,

                size:
                    certSize,

                version:
                    certVersion
            };


            /*
             * Try to obtain a title name.
             *
             * XBE certificate layout contains
             * a Unicode title name pointer.
             */

            const titleNameOffset =
                certificateAddress + 0x0C;


            if (
                titleNameOffset + 4 <=
                this.bytes.length
            ) {

                const titlePointer =
                    this.readU32(
                        titleNameOffset
                    );


                if (
                    titlePointer !== 0 &&
                    titlePointer <
                    this.bytes.length
                ) {

                    this.name =
                        this.readUTF16String(
                            titlePointer,
                            256
                        ) ||
                        this.name;
                }
            }
        }


        /*
         * Fallback filename.
         */

        if (
            this.name === "UNKNOWN.XBE" &&
            this.source &&
            this.source.name
        ) {

            this.name =
                this.source.name;
        }


        /*
         * Resolve entry point.
         */

        const candidates = [

            decodedRetail,
            decodedDebug,
            rawEntryPoint

        ];


        let selected =
            0;


        for (
            const candidate of candidates
        ) {

            if (
                this.addressInSection(
                    candidate
                )
            ) {

                selected =
                    candidate;

                break;
            }
        }


        if (
            selected === 0 &&
            this.sections.length > 0
        ) {

            /*
             * We do not blindly execute zero.
             *
             * Keep decoded retail as primary
             * fallback if it looks like an
             * Xbox virtual address.
             */

            if (
                decodedRetail >= 0x10000 &&
                decodedRetail <
                0x80000000
            ) {

                selected =
                    decodedRetail;

            } else {

                selected =
                    this.sections[0]
                        .virtualAddress;
            }
        }


        this.entryPoint =
            u32(selected);


        this.loaded = true;


        return this;
    }


    readUTF16String(offset, maxChars = 256) {

        if (
            offset < 0 ||
            offset + 2 >
            this.bytes.length
        ) {
            return "";
        }


        let result = "";


        for (
            let i = 0;
            i < maxChars;
            i++
        ) {

            const pos =
                offset + i * 2;


            if (
                pos + 2 >
                this.bytes.length
            ) {
                break;
            }


            const code =
                this.bytes[pos] |
                (
                    this.bytes[pos + 1] << 8
                );


            if (code === 0) {
                break;
            }


            result +=
                String.fromCharCode(
                    code
                );
        }


        return result;
    }


    addressInSection(address) {

        address = u32(address);


        return this.sections.some(
            section => {

                const start =
                    section.virtualAddress;

                const size =
                    Math.max(
                        section.virtualSize,
                        section.rawSize
                    );


                if (size === 0) {
                    return false;
                }


                return (
                    address >= start &&
                    address <
                    start + size
                );
            }
        );
    }


    mapIntoMemory(memory) {

        if (!this.loaded) {

            throw new Error(
                "XBE is not loaded."
            );
        }


        if (
            !(memory instanceof WebBktxMemory)
        ) {

            throw new Error(
                "mapIntoMemory requires WebBktxMemory."
            );
        }


        this.mapping = [];


        for (
            const section of this.sections
        ) {

            const destination =
                u32(
                    section.virtualAddress
                );


            const rawAddress =
                u32(
                    section.rawAddress
                );


            const rawSize =
                u32(
                    section.rawSize
                );


            const virtualSize =
                u32(
                    section.virtualSize
                );


            /*
             * Some XBE tools can provide
             * absolute virtual addresses.
             */

            if (
                destination >= memory.size
            ) {

                this.mapping.push({

                    index:
                        section.index,

                    name:
                        section.name,

                    mapped:
                        false,

                    reason:
                        "Virtual address outside RAM",

                    virtualAddress:
                        destination
                });

                continue;
            }


            const safeRawStart =
                Math.min(
                    rawAddress,
                    this.bytes.length
                );


            const available =
                Math.max(
                    0,
                    this.bytes.length -
                    safeRawStart
                );


            const copySize =
                Math.min(
                    rawSize,
                    available,
                    memory.size -
                    destination
                );


            if (copySize > 0) {

                memory.writeBytes(
                    destination,
                    this.bytes.slice(
                        safeRawStart,
                        safeRawStart +
                        copySize
                    )
                );
            }


            const zeroStart =
                destination +
                copySize;


            const zeroSize =
                Math.min(
                    Math.max(
                        0,
                        virtualSize -
                        copySize
                    ),
                    memory.size -
                    zeroStart
                );


            if (zeroSize > 0) {

                memory.fill(
                    zeroStart,
                    zeroSize,
                    0
                );
            }


            this.mapping.push({

                index:
                    section.index,

                name:
                    section.name,

                mapped:
                    true,

                virtualAddress:
                    destination,

                virtualSize,

                rawAddress,

                rawSize,

                copied:
                    copySize
            });
        }


        this.bootReady =
            this.addressInSection(
                this.entryPoint
            );


        return this.mapping;
    }


    getEntryPoint() {

        return this.entryPoint >>> 0;
    }


    getSize() {

        return this.buffer
            ? this.buffer.byteLength
            : 0;
    }


    getStatus() {

        return {

            loaded:
                this.loaded,

            bootReady:
                this.bootReady,

            name:
                this.name,

            size:
                this.getSize(),

            imageBase:
                this.imageBase >>> 0,

            baseAddress:
                this.baseAddress >>> 0,

            entryPointRaw:
                this.entryPointRaw >>> 0,

            entryPoint:
                this.entryPoint >>> 0,

            entryPointHex:
                hex(this.entryPoint),

            sections:
                this.sections.map(
                    section => ({
                        index:
                            section.index,

                        name:
                            section.name,

                        virtualAddress:
                            section.virtualAddress,

                        virtualSize:
                            section.virtualSize,

                        rawAddress:
                            section.rawAddress,

                        rawSize:
                            section.rawSize
                    })
                ),

            mapping:
                this.mapping,

            certificate:
                this.certificate,

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
    }


    register(address, handler) {

        if (
            typeof handler !==
            "function"
        ) {
            throw new Error(
                "Thunk handler must be a function."
            );
        }

        this.table.set(
            u32(address),
            handler
        );
    }


    has(address) {

        return this.table.has(
            u32(address)
        );
    }


    call(address, ...args) {

        const handler =
            this.table.get(
                u32(address)
            );


        if (!handler) {

            throw new Error(
                `Unknown thunk ${hex(address)}`
            );
        }


        return handler(...args);
    }


    getStatus() {

        return {

            count:
                this.table.size
        };
    }
}


/* ============================================================
   XAPI
============================================================ */

class WebBktxXAPI {

    constructor(core = null) {

        this.core = core;

        this.functions =
            new Map();

        this.registerDefaults();
    }


    register(name, handler) {

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


    call(name, ...args) {

        const fn =
            this.functions.get(
                String(name)
            );


        if (!fn) {

            throw new Error(
                `Unknown XAPI function: ${name}`
            );
        }


        return fn(...args);
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

                if (
                    typeof performance !==
                    "undefined"
                ) {

                    return Math.floor(
                        performance.now()
                    ) >>> 0;
                }

                return Date.now() >>> 0;
            }
        );


        this.register(
            "Sleep",
            milliseconds => {

                return Number(
                    milliseconds
                ) || 0;
            }
        );
    }


    getStatus() {

        return {

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

        this.nextHandle = 1;
    }


    async open(file) {

        if (!file) {
            throw new Error(
                "No file."
            );
        }


        const buffer =
            await file.arrayBuffer();


        const handle =
            this.nextHandle++;


        this.files.set(
            handle,
            {
                name:
                    file.name ||
                    "file",

                size:
                    buffer.byteLength,

                buffer
            }
        );


        return handle;
    }


    get(handle) {

        return (
            this.files.get(handle) ||
            null
        );
    }


    close(handle) {

        return this.files.delete(
            handle
        );
    }


    getStatus() {

        return {

            openFiles:
                this.files.size
        };
    }
}


/* ============================================================
   KERNEL
============================================================ */

class WebBktxKernel {

    constructor(core = null) {

        this.core = core;

        this.initialized = false;

        this.services =
            new Map();
    }


    initialize() {

        this.initialized = true;

        return true;
    }


    registerService(name, service) {

        this.services.set(
            String(name),
            service
        );
    }


    getService(name) {

        return (
            this.services.get(
                String(name)
            ) ||
            null
        );
    }


    start() {

        this.initialized = true;

        return true;
    }


    stop() {

        this.initialized = false;
    }


    getStatus() {

        return {

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

        this.started = false;

        this.keyboard =
            Object.create(null);

        this.gamepadIndex = null;

        this.axes = {

            leftX: 0,
            leftY: 0,

            rightX: 0,
            rightY: 0,

            leftTrigger: 0,
            rightTrigger: 0
        };


        this.buttons =
            Object.create(null);


        this.boundKeyDown =
            event => {

                this.keyboard[
                    event.code
                ] = true;
            };


        this.boundKeyUp =
            event => {

                this.keyboard[
                    event.code
                ] = false;
            };


        this.boundBlur =
            () => {

                this.keyboard =
                    Object.create(null);
            };


        this.raf =
            null;
    }


    initialize() {

        if (this.started) {
            return true;
        }


        if (
            typeof window ===
            "undefined"
        ) {
            return false;
        }


        window.addEventListener(
            "keydown",
            this.boundKeyDown
        );


        window.addEventListener(
            "keyup",
            this.boundKeyUp
        );


        window.addEventListener(
            "blur",
            this.boundBlur
        );


        this.started = true;

        this.poll();

        return true;
    }


    poll() {

        if (!this.started) {
            return;
        }


        if (
            typeof navigator !==
            "undefined" &&
            typeof navigator.getGamepads ===
            "function"
        ) {

            const pads =
                navigator.getGamepads();


            let found = false;


            for (
                let i = 0;
                i < pads.length;
                i++
            ) {

                const pad =
                    pads[i];


                if (!pad) {
                    continue;
                }


                found = true;

                this.gamepadIndex = i;


                this.buttons =
                    Object.create(null);


                for (
                    let j = 0;
                    j < pad.buttons.length;
                    j++
                ) {

                    this.buttons[j] =
                        Boolean(
                            pad.buttons[j] &&
                            pad.buttons[j].pressed
                        );
                }


                if (
                    pad.axes.length >= 4
                ) {

                    this.axes.leftX =
                        pad.axes[0] || 0;

                    this.axes.leftY =
                        pad.axes[1] || 0;

                    this.axes.rightX =
                        pad.axes[2] || 0;

                    this.axes.rightY =
                        pad.axes[3] || 0;
                }


                break;
            }


            if (!found) {
                this.gamepadIndex = null;
            }
        }


        if (
            typeof requestAnimationFrame ===
            "function"
        ) {

            this.raf =
                requestAnimationFrame(
                    () => this.poll()
                );
        }
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

            window.removeEventListener(
                "blur",
                this.boundBlur
            );
        }


        if (
            this.raf !== null &&
            typeof cancelAnimationFrame ===
            "function"
        ) {

            cancelAnimationFrame(
                this.raf
            );
        }


        this.raf = null;

        this.started = false;
    }


    getStatus() {

        return {

            started:
                this.started,

            gamepadIndex:
                this.gamepadIndex
        };
    }
}


/* ============================================================
   GRAPHICS
============================================================ */

class WebBktxXGraphics {

    constructor(canvas = null) {

        this.canvas = null;
        this.context = null;

        this.width = 1280;
        this.height = 720;

        this.frameCount = 0;

        this.running = false;

        if (canvas) {
            this.initialize(canvas);
        }
    }


    initialize(canvas) {

        if (!canvas) {
            throw new Error(
                "Graphics requires canvas."
            );
        }


        this.canvas = canvas;


        this.context =
            canvas.getContext(
                "2d",
                {
                    alpha: false
                }
            );


        if (!this.context) {
            throw new Error(
                "Unable to create 2D context."
            );
        }


        this.setResolution(
            this.width,
            this.height
        );


        this.clear();

        return true;
    }


    setResolution(width, height) {

        this.width =
            Math.max(
                1,
                Math.floor(Number(width))
            );

        this.height =
            Math.max(
                1,
                Math.floor(Number(height))
            );


        if (this.canvas) {

            this.canvas.width =
                this.width;

            this.canvas.height =
                this.height;
        }
    }


    clear(
        r = 0,
        g = 0,
        b = 0,
        a = 255
    ) {

        if (!this.context) {
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

        this.frameCount++;
    }


    getStatus() {

        return {

            initialized:
                Boolean(this.context),

            width:
                this.width,

            height:
                this.height,

            frameCount:
                this.frameCount,

            running:
                this.running
        };
    }
}


const WebBktxGraphics =
    WebBktxXGraphics;


/* ============================================================
   CORE
============================================================ */

class WebBktxCore {

    constructor(options = {}) {

        this.version =
            WEBBKTX_VERSION;


        this.options =
            options;


        this.debug =
            options.debug !== false;


        this.ramSize =
            Number(
                options.ramSize ||
                WEBBKTX_RAM_SIZE
            );


        this.memory =
            new WebBktxMemory(
                this.ramSize
            );


        this.decoder =
            new WebBktxDecoder(
                this.memory
            );


        this.cpu =
            new WebBktxCPU(
                this.memory
            );


        this.cpu.attachDecoder(
            this.decoder
        );


        this.xbe = null;

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


        this.input = null;

        this.graphics = null;

        this.initialized = false;

        this.running = false;

        this.bootState =
            "OFFLINE";

        this.bootError = null;

        this.bootStartedAt = 0;

        this.bootFinishedAt = 0;


        this.cpu.onFault =
            error => {

                this.bootError =
                    error instanceof Error
                        ? error.message
                        : String(error);

                if (this.debug) {

                    console.error(
                        "[WebBktx CPU FAULT]",
                        error
                    );
                }
            };
    }


    initialize() {

        if (this.initialized) {
            return true;
        }


        this.kernel.initialize();

        this.initialized = true;

        this.bootState = "READY";


        console.log(
            `[WebBktx Core ${this.version}] initialized`
        );


        return true;
    }


    async loadGame(source) {

        this.initialize();


        this.bootState =
            "LOADING XBE";


        this.bootError = null;


        this.xbe =
            new WebBktxXBE(
                source
            );


        await this.xbe.load();


        this.bootState =
            "XBE PARSED";


        console.log(
            "[WebBktx] XBE:",
            this.xbe.getStatus()
        );


        /*
         * Map XBE sections into RAM.
         */

        const mapping =
            this.xbe.mapIntoMemory(
                this.memory
            );


        this.bootState =
            "XBE MAPPED";


        console.log(
            "[WebBktx] XBE mapping:",
            mapping
        );


        return {

            success: true,

            image:
                this.xbe,

            xbe:
                this.xbe,

            mapping,

            status:
                this.xbe.getStatus()
        };
    }


    bootXBE() {

        if (!this.xbe) {

            throw new Error(
                "No XBE loaded."
            );
        }


        if (!this.xbe.bootReady) {

            throw new Error(
                "XBE entry point is not mapped."
            );
        }


        const entry =
            this.xbe.getEntryPoint();


        /*
         * Prepare CPU.
         */

        this.cpu.reset();


        /*
         * Give the emulated program a safe
         * stack near the end of available RAM.
         */

        this.cpu.ESP =
            (
                this.memory.size - 0x100
            ) >>> 0;


        this.cpu.EIP =
            entry >>> 0;


        /*
         * Some basic boot registers.
         */

        this.cpu.EAX = 0;
        this.cpu.EBX = 0;
        this.cpu.ECX = 0;
        this.cpu.EDX = 0;

        this.cpu.ESI = 0;
        this.cpu.EDI = 0;
        this.cpu.EBP = this.cpu.ESP;


        this.cpu.running = false;
        this.cpu.halted = false;
        this.cpu.faulted = false;

        this.cpu.lastError = null;


        this.bootState =
            "XBE BOOTING";


        this.bootStartedAt =
            typeof performance !==
            "undefined"
                ? performance.now()
                : Date.now();


        console.log(
            "[WebBktx] XBE BOOT:",
            {
                name:
                    this.xbe.name,

                entryPoint:
                    hex(entry),

                imageBase:
                    hex(
                        this.xbe.imageBase
                    ),

                stack:
                    hex(this.cpu.ESP)
            }
        );


        return {

            success: true,

            entryPoint: entry,

            entryPointHex:
                hex(entry),

            cpu:
                this.cpu.getRegisters(),

            xbe:
                this.xbe.getStatus()
        };
    }


    runFrame(
        instructionLimit = 10000
    ) {

        if (!this.xbe) {

            throw new Error(
                "No XBE loaded."
            );
        }


        if (this.cpu.faulted) {

            return {

                executed: 0,

                faulted: true,

                error:
                    this.cpu.lastError
            };
        }


        this.running = true;

        this.cpu.running = true;


        try {

            const result =
                this.cpu.run(
                    instructionLimit
                );


            if (result.faulted) {

                this.bootState =
                    "CPU FAULT";
            }


            if (result.halted) {

                this.bootState =
                    "CPU HALTED";
            }


            return result;

        } finally {

            this.running = false;
        }
    }


    step() {

        if (!this.xbe) {

            throw new Error(
                "No XBE loaded."
            );
        }


        return this.cpu.step();
    }


    stop() {

        this.running = false;

        this.cpu.stop();
    }


    reset() {

        this.stop();

        this.memory.reset();

        this.cpu.reset();

        this.xbe = null;

        this.bootState = "READY";

        this.bootError = null;
    }


    attachGraphics(canvas) {

        this.graphics =
            new WebBktxXGraphics(
                canvas
            );

        return this.graphics;
    }


    attachInput() {

        if (this.input) {
            this.input.destroy();
        }

        this.input =
            new WebBktxXInput();

        this.input.initialize();

        return this.input;
    }


    getStatus() {

        return {

            version:
                this.version,

            initialized:
                this.initialized,

            bootState:
                this.bootState,

            bootError:
                this.bootError,

            running:
                this.running,

            memory:
                this.memory.getStatus(),

            cpu:
                this.cpu.getStatus(),

            decoder:
                {
                    version:
                        this.decoder.version
                },

            xbe:
                this.xbe
                    ? this.xbe.getStatus()
                    : null,

            thunks:
                this.thunks.getStatus(),

            xapi:
                this.xapi.getStatus(),

            xfile:
                this.xfile.getStatus(),

            kernel:
                this.kernel.getStatus(),

            input:
                this.input
                    ? this.input.getStatus()
                    : null,

            graphics:
                this.graphics
                    ? this.graphics.getStatus()
                    : null
        };
    }


    selfTest() {

        const cpu =
            this.cpu.selfTest();


        if (!this.kernel.initialized) {
            this.kernel.initialize();
        }


        return {

            version:
                this.version,

            memory:
                true,

            cpu,

            decoder:
                Boolean(this.decoder),

            kernel:
                this.kernel.initialized,

            passed:
                Boolean(
                    cpu.passed &&
                    this.decoder &&
                    this.kernel.initialized
                )
        };
    }
}


/* ============================================================
   GLOBAL EXPORTS
============================================================ */

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


/* ============================================================
   UNIFIED OBJECT
============================================================ */

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


/* ============================================================
   AUTO CORE INSTANCE
============================================================ */

try {

    window.WebBktxRuntime =
        new WebBktxCore({
            debug: true,
            ramSize:
                WEBBKTX_RAM_SIZE
        });


    window.WebBktxRuntime.initialize();


    console.log(
        "[WebBktx] Unified runtime loaded."
    );


    console.log(
        "[WebBktx] Version:",
        WEBBKTX_VERSION
    );


    const selfTest =
        window.WebBktxRuntime.selfTest();


    console.log(
        "[WebBktx] Self-test:",
        selfTest
    );


    if (selfTest.passed) {

        console.log(
            "[WebBktx] CORE STATUS: READY"
        );

    } else {

        console.error(
            "[WebBktx] CORE STATUS: FAILED"
        );
    }

} catch (error) {

    console.error(
        "[WebBktx] CORE INITIALIZATION ERROR",
        error
    );
}
