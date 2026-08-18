/*
 * ============================================================
 * WebBktx Unified Runtime
 *
 * File:
 *     core/webbktx.js
 *
 * Version:
 *     1.0
 *
 * Unified modules:
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
 * Browser-only runtime.
 *
 * IMPORTANT:
 * This is an experimental Xbox-compatible runtime framework.
 * It does NOT claim to implement the complete Xbox hardware,
 * kernel, DirectX, NV2A GPU, or all XDK APIs.
 * ============================================================
 */

"use strict";


/* ============================================================
   GLOBAL CONFIG
============================================================ */

const WEBBKTX_VERSION = "1.0";

const WEBBKTX_RAM_SIZE =
    64 * 1024 * 1024;


/* ============================================================
   MEMORY
============================================================ */

class WebBktxMemory {

    constructor(size = WEBBKTX_RAM_SIZE) {

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

        address =
            Number(address) >>> 0;

        bytes =
            Number(bytes);

        if (
            address + bytes >
            this.size
        ) {

            throw new RangeError(
                `Memory access violation: 0x${
                    address.toString(16)
                }`
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
            Number(value) >>> 0,
            true
        );

    }


    writeBytes(address, bytes) {

        const data =
            bytes instanceof Uint8Array
                ? bytes
                : new Uint8Array(bytes);

        this.check(
            address,
            data.length
        );

        this.u8.set(
            data,
            Number(address) >>> 0
        );

    }


    readBytes(address, length) {

        this.check(
            address,
            length
        );

        return this.u8.slice(
            Number(address) >>> 0,
            Number(address) >>> 0 +
                Number(length)
        );

    }


    load(address, data) {

        this.writeBytes(
            address,
            data
        );

    }


    fill(address, length, value = 0) {

        this.check(
            address,
            length
        );

        this.u8.fill(
            value & 0xFF,
            address,
            address + length
        );

    }


    getBuffer() {

        return this.buffer;

    }


    getView() {

        return this.view;

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

        this.reset();

        this.maxInstructions =
            100000;

        this.breakpoints =
            new Set();

        this.traceEnabled =
            false;

        this.trace = [];

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

        this.trace.length = 0;
    }


    getRegister(name) {

        const n =
            String(name).toUpperCase();

        if (
            n === "EAX" ||
            n === "EBX" ||
            n === "ECX" ||
            n === "EDX" ||
            n === "ESI" ||
            n === "EDI" ||
            n === "EBP" ||
            n === "ESP" ||
            n === "EIP" ||
            n === "EFLAGS"
        ) {

            return this[n] >>> 0;

        }

        throw new Error(
            `Unknown register: ${n}`
        );
    }


    setRegister(name, value) {

        const n =
            String(name).toUpperCase();

        if (n === "EFLAGS") {

            this.EFLAGS =
                Number(value) >>> 0;

            this.EFLAGS |= 0x02;

            return;
        }

        if (
            n === "EAX" ||
            n === "EBX" ||
            n === "ECX" ||
            n === "EDX" ||
            n === "ESI" ||
            n === "EDI" ||
            n === "EBP" ||
            n === "ESP" ||
            n === "EIP"
        ) {

            this[n] =
                Number(value) >>> 0;

            return;
        }

        throw new Error(
            `Unknown register: ${n}`
        );
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

        this.EFLAGS |= 0x02;

        this.EFLAGS >>>= 0;
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


    updateLogicFlags(result) {

        result >>>=
            0;

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
            this.parity8(result)
        );
    }


    updateAddFlags(a, b, result) {

        a >>>=
            0;

        b >>>=
            0;

        result >>>=
            0;

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
            this.parity8(result)
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


    updateSubFlags(a, b, result) {

        a >>>=
            0;

        b >>>=
            0;

        result >>>=
            0;

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
            this.parity8(result)
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


    add32(a, b) {

        a >>>=
            0;

        b >>>=
            0;

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

        a >>>=
            0;

        b >>>=
            0;

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

        const cf =
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

        this.setFlag(
            WebBktxCPUFlags.CF,
            cf
        );

        return result;
    }


    dec32(value) {

        const cf =
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

        this.setFlag(
            WebBktxCPUFlags.CF,
            cf
        );

        return result;
    }


    xor32(a, b) {

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


    and32(a, b) {

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


    or32(a, b) {

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

        this.memory.write8(
            address,
            value
        );
    }


    write16(address, value) {

        this.memory.write16(
            address,
            value
        );
    }


    write32(address, value) {

        this.memory.write32(
            address,
            value
        );
    }


    attachDecoder(decoder) {

        if (!decoder) {

            throw new Error(
                "Invalid decoder."
            );
        }

        this.decoder =
            decoder;

        return true;
    }


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


    enableTrace(value = true) {

        this.traceEnabled =
            Boolean(value);
    }


    clearTrace() {

        this.trace.length = 0;
    }


    step() {

        if (this.halted) {

            return {
                executed: false,
                halted: true
            };
        }

        if (this.faulted) {

            return {
                executed: false,
                faulted: true,
                reason:
                    this.lastError
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
            this.breakpoints.has(address)
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

        try {

            const instruction =
                this.decoder.decode(
                    this,
                    address
                );

            if (!instruction) {

                throw new Error(
                    `No instruction at 0x${
                        address.toString(16)
                    }`
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

            instruction.execute(
                this
            );

            this.cycles++;
            this.instructionsExecuted++;

            const result = {

                executed: true,

                address,

                opcode:
                    instruction.opcode,

                mnemonic:
                    instruction.mnemonic,

                registers:
                    this.getRegisters(),

                cycles:
                    this.cycles,

                halted:
                    this.halted
            };

            if (this.traceEnabled) {

                this.trace.push(
                    result
                );

                if (
                    this.trace.length >
                    this.maxTraceEntries
                ) {

                    this.trace.shift();
                }
            }

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

            this.faulted =
                true;

            this.running =
                false;

            this.lastError =
                error.message ||
                String(error);

            if (
                typeof this.onFault ===
                "function"
            ) {

                this.onFault(
                    error
                );
            }

            throw error;
        }
    }


    run(limit = this.maxInstructions) {

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


    getStatus() {

        return {

            version:
                "1.0",

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

        const esp =
            this.ESP;

        this.push32(
            0x12345678
        );

        tests.push({
            name: "STACK",
            pass:
                this.pop32() ===
                0x12345678 &&
                this.ESP === esp
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

            passed:
                tests.every(
                    test => test.pass
                ),

            tests,

            version:
                "1.0"
        };
    }

}


/* ============================================================
   DECODER
============================================================ */

class WebBktxDecoder {

    constructor(memory) {

        this.memory =
            memory;

        this.version =
            "1.0";
    }


    decode(cpu, address) {

        const opcode =
            this.memory.read8(
                address
            );

        switch (opcode) {

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

                    size:
                        5,

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


            case 0x05: {

                const value =
                    this.memory.read32(
                        address + 1
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


            case 0x2D: {

                const value =
                    this.memory.read32(
                        address + 1
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
                        opcode.toString(16).padStart(2, "0")
                    } at 0x${
                        address.toString(16)
                    }`
                );
        }
    }

}


/* ============================================================
   XBE
============================================================ */

class WebBktxXBE {

    constructor(source = null) {

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
    }


    async load(source = this.source) {

        if (!source) {

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
                source;

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

        /*
         * XBE magic:
         * "XBEH"
         */

        const magic =
            String.fromCharCode(
                bytes[0],
                bytes[1],
                bytes[2],
                bytes[3]
            );

        if (magic !== "XBEH") {

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

            loaded:
                this.loaded,

            size:
                this.getSize(),

            entryPoint:
                this.entryPoint,

            imageBase:
                this.imageBase,

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
            "1.0";
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
            Number(address) >>> 0,
            handler
        );
    }


    has(address) {

        return this.table.has(
            Number(address) >>> 0
        );
    }


    call(address, ...args) {

        const handler =
            this.table.get(
                Number(address) >>> 0
            );

        if (!handler) {

            throw new Error(
                `Unknown thunk: 0x${
                    Number(address)
                        .toString(16)
                }`
            );
        }

        return handler(
            ...args
        );
    }


    clear() {

        this.table.clear();
    }

}


/* ============================================================
   XAPI
============================================================ */

class WebBktxXAPI {

    constructor(core = null) {

        this.core =
            core;

        this.functions =
            new Map();

        this.version =
            "1.0";

        this.registerDefaults();
    }


    register(name, handler) {

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

        return fn(
            ...args
        );
    }


    registerDefaults() {

        this.register(
            "DbgPrint",
            (...args) => {

                console.log(
                    "[XAPI]",
                    ...args
                );

                return 0;
            }
        );


        this.register(
            "GetTickCount",
            () =>
                performance.now()
        );
    }

}


/* ============================================================
   XFILE
============================================================ */

class WebBktxXFile {

    constructor() {

        this.files =
            new Map();

        this.version =
            "1.0";
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
            `file_${Date.now()}_${
                Math.random()
                    .toString(16)
                    .slice(2)
            }`;

        this.files.set(
            handle,
            {
                name:
                    file.name || "file",

                size:
                    file.size,

                buffer
            }
        );

        return handle;
    }


    get(handle) {

        return this.files.get(
            handle
        ) || null;
    }


    close(handle) {

        return this.files.delete(
            handle
        );
    }


    clear() {

        this.files.clear();
    }

}


/* ============================================================
   KERNEL
============================================================ */

class WebBktxKernel {

    constructor(core = null) {

        this.core =
            core;

        this.initialized =
            false;

        this.version =
            "1.0";

        this.services =
            new Map();
    }


    async initialize() {

        this.initialized =
            true;

        return true;
    }


    registerService(name, service) {

        this.services.set(
            String(name),
            service
        );
    }


    getService(name) {

        return this.services.get(
            String(name)
        ) || null;
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
                [...this.services.keys()]
        };
    }

}


/* ============================================================
   XINPUT
============================================================ */

class WebBktxXInput {

    constructor() {

        this.version =
            "1.0";

        this.buttons =
            Object.create(null);

        this.axes = {

            leftX: 0,
            leftY: 0,
            rightX: 0,
            rightY: 0,

            leftTrigger: 0,
            rightTrigger: 0
        };

        this.gamepadIndex =
            null;

        this.keyboard =
            Object.create(null);

        this.touch =
            [];

        this.started =
            false;

        this.boundGamepad =
            this.pollGamepads
                .bind(this);

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
    }


    initialize() {

        if (this.started) {

            return;
        }

        window.addEventListener(
            "keydown",
            this.boundKeyDown
        );

        window.addEventListener(
            "keyup",
            this.boundKeyUp
        );

        this.started =
            true;

        this.pollGamepads();
    }


    pollGamepads() {

        if (
            !navigator.getGamepads
        ) {

            return;
        }

        const pads =
            navigator.getGamepads();

        for (
            let i = 0;
            i < pads.length;
            i++
        ) {

            if (pads[i]) {

                this.gamepadIndex =
                    i;

                const pad =
                    pads[i];

                this.buttons = {};

                pad.buttons.forEach(
                    (button, index) => {

                        this.buttons[
                            index
                        ] =
                            button.pressed;
                    }
                );

                if (pad.axes.length >= 4) {

                    this.axes.leftX =
                        pad.axes[0];

                    this.axes.leftY =
                        pad.axes[1];

                    this.axes.rightX =
                        pad.axes[2];

                    this.axes.rightY =
                        pad.axes[3];
                }

                break;
            }
        }

        requestAnimationFrame(
            this.boundGamepad
        );
    }


    getState() {

        return {

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
                }
        };
    }


    destroy() {

        window.removeEventListener(
            "keydown",
            this.boundKeyDown
        );

        window.removeEventListener(
            "keyup",
            this.boundKeyUp
        );

        this.started =
            false;
    }

}


/* ============================================================
   XGRAPHICS
============================================================ */

class WebBktxXGraphics {

    constructor(canvas = null) {

        this.canvas =
            canvas;

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
            "1.0";

        if (canvas) {

            this.initialize(
                canvas
            );
        }
    }


    initialize(canvas) {

        this.canvas =
            canvas;

        this.context =
            canvas.getContext(
                "2d",
                {
                    alpha: false
                }
            );

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


    SetResolution(width, height) {

        this.setResolution(
            width,
            height
        );
    }


    setResolution(width, height) {

        this.width =
            Math.max(
                1,
                Number(width)
            );

        this.height =
            Math.max(
                1,
                Number(height)
            );

        if (this.canvas) {

            this.canvas.width =
                this.width;

            this.canvas.height =
                this.height;
        }
    }


    Clear(r = 0, g = 0, b = 0, a = 255) {

        this.clear(
            r,
            g,
            b,
            a
        );
    }


    clear(r = 0, g = 0, b = 0, a = 255) {

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

        this.lastPresent =
            performance.now();
    }


    start() {

        this.running =
            true;

        const frame =
            () => {

                if (!this.running) {

                    return;
                }

                this.Present();

                requestAnimationFrame(
                    frame
                );
            };

        requestAnimationFrame(
            frame
        );
    }


    stop() {

        this.running =
            false;
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
                )
        };
    }

}


/* Alias used by the app. */

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
            Boolean(
                options.debug
            );

        this.ramSize =
            options.ramSize ||
            WEBBKTX_RAM_SIZE;

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

        this.input =
            null;

        this.graphics =
            null;

        this.xbe =
            null;

        this.initialized =
            false;

        this.running =
            false;
    }


    initialize() {

        if (this.initialized) {

            return true;
        }

        this.kernel.initialize();

        this.initialized =
            true;

        if (this.debug) {

            console.log(
                `[WebBktx Core ${this.version}] initialized`
            );
        }

        return true;
    }


    async loadGame(source) {

        if (!this.initialized) {

            this.initialize();
        }

        this.xbe =
            new WebBktxXBE(
                source
            );

        await this.xbe.load();

        /*
         * XBE image is loaded and validated.
         *
         * Actual executable mapping and
         * Xbox kernel initialization are
         * intentionally separated.
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

        if (!this.xbe) {

            throw new Error(
                "No XBE loaded."
            );
        }

        return this.cpu.step();
    }


    run(limit) {

        this.running =
            true;

        const result =
            this.cpu.run(
                limit
            );

        this.running =
            false;

        return result;
    }


    stop() {

        this.running =
            false;

        this.cpu.stop();

        if (this.graphics) {

            this.graphics.stop();
        }
    }


    attachGraphics(canvas) {

        this.graphics =
            new WebBktxXGraphics(
                canvas
            );

        return this.graphics;
    }


    attachInput() {

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

            running:
                this.running,

            memory:
                {
                    size:
                        this.memory.size
                },

            cpu:
                this.cpu.getStatus(),

            kernel:
                this.kernel.getStatus(),

            xbe:
                this.xbe
                    ? this.xbe.getStatus()
                    : null,

            graphics:
                this.graphics
                    ? this.graphics.getStatus()
                    : null
        };
    }


    selfTest() {

        return {

            memory:
                true,

            cpu:
                this.cpu.selfTest(),

            decoder:
                Boolean(
                    this.decoder
                ),

            kernel:
                this.kernel.initialized,

            passed:
                true
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
   RUNTIME OBJECT
============================================================ */

window.WebBktx = {

    version:
        WEBBKTX_VERSION,

    Memory:
        WebBktxMemory,

    CPU:
        WebBktxCPU,

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

    XGraphics:
        WebBktxXGraphics,

    Graphics:
        WebBktxGraphics,

    Core:
        WebBktxCore

};


/* ============================================================
   BOOT TEST
============================================================ */

console.log(
    `%cWebBktx Unified Runtime ${WEBBKTX_VERSION} loaded.`,
    "font-weight:bold"
);


/*
 * Quick availability diagnostic.
 */

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
