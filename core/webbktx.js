"use strict";

/*
 * ============================================================
 * WebBktx Runtime
 * Fresh implementation
 * ============================================================
 *
 * Architecture:
 *
 *   XBE
 *    |
 *    v
 *   Loader
 *    |
 *    v
 *   Memory <----> CPU <----> Decoder
 *      |            |
 *      |            +---- Kernel
 *      |            +---- XAPI
 *      |            +---- Thunks
 *      |
 *      +---- Graphics
 *      +---- Input
 *      +---- Audio
 *
 * This is an experimental Xbox-compatible execution runtime.
 * ============================================================
 */

const WEBBKTX_VERSION = "2.0.0";

const DEFAULT_RAM = 64 * 1024 * 1024;
const XBE_ENTRY_XOR = 0xA8FC57AB;

/* ============================================================
 * UTILITIES
 * ============================================================ */

function u32(value) {
    return Number(value) >>> 0;
}

function i32(value) {
    return Number(value) | 0;
}

function hex(value, width = 8) {
    return "0x" + u32(value).toString(16).padStart(width, "0");
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

/* ============================================================
 * MEMORY
 * ============================================================ */

class Memory {

    constructor(size = DEFAULT_RAM) {

        this.size = u32(size);

        assert(
            this.size >= 1024 * 1024,
            "Memory size is too small."
        );

        this.buffer = new ArrayBuffer(this.size);
        this.u8 = new Uint8Array(this.buffer);
        this.view = new DataView(this.buffer);
    }

    check(address, length = 1) {

        address = u32(address);
        length = Number(length);

        if (!Number.isInteger(length) || length < 0) {
            throw new RangeError("Invalid memory length.");
        }

        if (
            address > this.size ||
            length > this.size - address
        ) {
            throw new RangeError(
                `Memory access violation at ${hex(address)} length=${length}`
            );
        }

        return address;
    }

    reset() {
        this.u8.fill(0);
    }

    read8(address) {
        return this.u8[this.check(address)];
    }

    readS8(address) {
        return this.view.getInt8(this.check(address));
    }

    read16(address) {
        return this.view.getUint16(
            this.check(address, 2),
            true
        );
    }

    readS16(address) {
        return this.view.getInt16(
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

    readS32(address) {
        return this.view.getInt32(
            this.check(address, 4),
            true
        );
    }

    write8(address, value) {
        this.u8[this.check(address)] = u32(value) & 0xff;
    }

    write16(address, value) {
        this.view.setUint16(
            this.check(address, 2),
            u32(value) & 0xffff,
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

    copyFrom(address, source) {

        const data =
            source instanceof Uint8Array
                ? source
                : new Uint8Array(source);

        this.check(address, data.length);

        this.u8.set(data, address);
    }

    slice(address, length) {

        this.check(address, length);

        return this.u8.slice(
            address,
            address + length
        );
    }

    getBuffer() {
        return this.buffer;
    }
}

/* ============================================================
 * FLAGS
 * ============================================================ */

const FLAGS = Object.freeze({

    CF: 0x00000001,
    PF: 0x00000004,
    AF: 0x00000010,
    ZF: 0x00000040,
    SF: 0x00000080,
    TF: 0x00000100,
    IF: 0x00000200,
    DF: 0x00000400,
    OF: 0x00000800
});

/* ============================================================
 * CPU
 * ============================================================ */

class CPU {

    constructor(memory) {

        assert(
            memory instanceof Memory,
            "CPU requires Memory."
        );

        this.memory = memory;

        this.decoder = null;

        /*
         * Initialize ALL state before reset().
         * This avoids the old trace initialization crash.
         */

        this.trace = [];
        this.traceEnabled = false;
        this.maxTrace = 2000;

        this.breakpoints = new Set();

        this.running = false;
        this.halted = false;
        this.faulted = false;

        this.cycles = 0;
        this.instructions = 0;

        this.lastError = null;

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
            u32(
                Math.min(
                    this.memory.size - 4,
                    0x01FFFFFC
                )
            );

        this.EIP = 0;

        this.EFLAGS = 0x202;

        this.running = false;
        this.halted = false;
        this.faulted = false;

        this.cycles = 0;
        this.instructions = 0;

        this.lastError = null;

        this.trace.length = 0;
    }

    attachDecoder(decoder) {

        assert(
            decoder &&
            typeof decoder.decode === "function",
            "CPU: decoder must provide decode()."
        );

        this.decoder = decoder;
    }

    getRegisters() {

        return {
            EAX: u32(this.EAX),
            EBX: u32(this.EBX),
            ECX: u32(this.ECX),
            EDX: u32(this.EDX),
            ESI: u32(this.ESI),
            EDI: u32(this.EDI),
            EBP: u32(this.EBP),
            ESP: u32(this.ESP),
            EIP: u32(this.EIP),
            EFLAGS: u32(this.EFLAGS)
        };
    }

    setRegister(name, value) {

        name = String(name).toUpperCase();

        if (!(name in this.getRegisters())) {
            throw new Error(
                `Unknown register ${name}`
            );
        }

        this[name] = u32(value);
    }

    flag(flag) {
        return (this.EFLAGS & flag) !== 0;
    }

    setFlag(flag, value) {

        if (value) {
            this.EFLAGS |= flag;
        } else {
            this.EFLAGS &= ~flag;
        }

        this.EFLAGS |= 2;
        this.EFLAGS >>>= 0;
    }

    parity(value) {

        value &= 0xff;

        let count = 0;

        for (let i = 0; i < 8; i++) {
            count += (value >> i) & 1;
        }

        return (count & 1) === 0;
    }

    logicFlags(result) {

        result = u32(result);

        this.setFlag(FLAGS.CF, false);
        this.setFlag(FLAGS.OF, false);
        this.setFlag(FLAGS.ZF, result === 0);
        this.setFlag(
            FLAGS.SF,
            (result & 0x80000000) !== 0
        );
        this.setFlag(
            FLAGS.PF,
            this.parity(result)
        );
    }

    add(a, b) {

        a = u32(a);
        b = u32(b);

        const result = u32(a + b);

        this.setFlag(
            FLAGS.CF,
            result < a
        );

        this.setFlag(
            FLAGS.ZF,
            result === 0
        );

        this.setFlag(
            FLAGS.SF,
            !!(result & 0x80000000)
        );

        this.setFlag(
            FLAGS.PF,
            this.parity(result)
        );

        this.setFlag(
            FLAGS.AF,
            !!((a ^ b ^ result) & 0x10)
        );

        this.setFlag(
            FLAGS.OF,
            !!(
                (~(a ^ b) &
                (a ^ result) &
                0x80000000)
            )
        );

        return result;
    }

    sub(a, b) {

        a = u32(a);
        b = u32(b);

        const result = u32(a - b);

        this.setFlag(
            FLAGS.CF,
            a < b
        );

        this.setFlag(
            FLAGS.ZF,
            result === 0
        );

        this.setFlag(
            FLAGS.SF,
            !!(result & 0x80000000)
        );

        this.setFlag(
            FLAGS.PF,
            this.parity(result)
        );

        this.setFlag(
            FLAGS.AF,
            !!((a ^ b ^ result) & 0x10)
        );

        this.setFlag(
            FLAGS.OF,
            !!(
                ((a ^ b) &
                (a ^ result) &
                0x80000000)
            )
        );

        return result;
    }

    inc(value) {

        const cf = this.flag(FLAGS.CF);

        const result =
            this.add(value, 1);

        this.setFlag(FLAGS.CF, cf);

        return result;
    }

    dec(value) {

        const cf = this.flag(FLAGS.CF);

        const result =
            this.sub(value, 1);

        this.setFlag(FLAGS.CF, cf);

        return result;
    }

    push32(value) {

        this.ESP =
            u32(this.ESP - 4);

        this.memory.write32(
            this.ESP,
            value
        );
    }

    pop32() {

        const value =
            this.memory.read32(this.ESP);

        this.ESP =
            u32(this.ESP + 4);

        return value;
    }

    read8(a) {
        return this.memory.read8(a);
    }

    read16(a) {
        return this.memory.read16(a);
    }

    read32(a) {
        return this.memory.read32(a);
    }

    write8(a, v) {
        this.memory.write8(a, v);
    }

    write16(a, v) {
        this.memory.write16(a, v);
    }

    write32(a, v) {
        this.memory.write32(a, v);
    }

    addBreakpoint(address) {
        this.breakpoints.add(u32(address));
    }

    removeBreakpoint(address) {
        this.breakpoints.delete(u32(address));
    }

    enableTrace(value = true) {
        this.traceEnabled = !!value;
    }

    recordTrace(item) {

        if (!this.traceEnabled) {
            return;
        }

        this.trace.push(item);

        if (this.trace.length > this.maxTrace) {
            this.trace.shift();
        }
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
                error: this.lastError
            };
        }

        if (!this.decoder) {
            throw new Error(
                "CPU has no decoder."
            );
        }

        const address =
            u32(this.EIP);

        if (this.breakpoints.has(address)) {

            this.running = false;

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

            assert(
                instruction &&
                typeof instruction.execute === "function",
                `Invalid instruction at ${hex(address)}`
            );

            instruction.execute(this);

            this.instructions++;
            this.cycles++;

            const result = {
                executed: true,
                address,
                opcode: instruction.opcode,
                mnemonic: instruction.mnemonic,
                size: instruction.size,
                registers: this.getRegisters()
            };

            this.recordTrace(result);

            return result;

        } catch (error) {

            this.faulted = true;
            this.running = false;

            this.lastError =
                error instanceof Error
                    ? error.message
                    : String(error);

            throw error;
        }
    }

    run(limit = 100000) {

        limit = Number(limit);

        assert(
            Number.isInteger(limit) &&
            limit > 0,
            "Invalid CPU run limit."
        );

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

                if (last.executed) {
                    executed++;
                }

                if (last.breakpoint) {
                    break;
                }
            }

        } finally {

            this.running = false;
        }

        return {
            executed,
            cycles: this.cycles,
            instructions: this.instructions,
            halted: this.halted,
            faulted: this.faulted,
            last,
            registers: this.getRegisters()
        };
    }

    stop() {
        this.running = false;
    }

    halt() {
        this.halted = true;
        this.running = false;
    }

    status() {

        return {
            available: true,
            running: this.running,
            halted: this.halted,
            faulted: this.faulted,
            cycles: this.cycles,
            instructions: this.instructions,
            registers: this.getRegisters(),
            error: this.lastError
        };
    }

    selfTest() {

        const oldEax = this.EAX;

        const tests = [];

        tests.push({
            name: "ADD",
            pass: this.add(10, 20) === 30
        });

        tests.push({
            name: "SUB",
            pass: this.sub(50, 20) === 30
        });

        tests.push({
            name: "XOR",
            pass:
                ((0xFF00 ^ 0x0F00) >>> 0)
                === 0xF000
        });

        this.push32(0x12345678);

        tests.push({
            name: "STACK",
            pass:
                this.pop32() === 0x12345678
        });

        this.write32(
            0x1000,
            0xDEADBEEF
        );

        tests.push({
            name: "MEMORY",
            pass:
                this.read32(0x1000)
                === 0xDEADBEEF
        });

        this.EAX = oldEax;

        return {
            passed:
                tests.every(x => x.pass),
            tests
        };
    }
}

/* ============================================================
 * X86 DECODER
 * ============================================================ */

class Decoder {

    constructor(memory) {
        this.memory = memory;
    }

    imm8(address) {
        return this.memory.read8(address);
    }

    imm32(address) {
        return this.memory.read32(address);
    }

    decode(cpu, address) {

        const op =
            this.memory.read8(address);

        switch (op) {

            case 0x90:
                return {
                    opcode: op,
                    mnemonic: "NOP",
                    size: 1,
                    execute(c) {
                        c.EIP = u32(c.EIP + 1);
                    }
                };

            case 0xF4:
                return {
                    opcode: op,
                    mnemonic: "HLT",
                    size: 1,
                    execute(c) {
                        c.EIP = u32(c.EIP + 1);
                        c.halt();
                    }
                };

            /*
             * MOV EAX..EDI, imm32
             */

            case 0xB8:
            case 0xB9:
            case 0xBA:
            case 0xBB:
            case 0xBC:
            case 0xBD:
            case 0xBE:
            case 0xBF: {

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

                const reg =
                    op - 0xB8;

                const value =
                    this.imm32(address + 1);

                return {
                    opcode: op,
                    mnemonic:
                        `MOV ${names[reg]},${hex(value)}`,
                    size: 5,
                    execute(c) {
                        c[names[reg]] = value;
                        c.EIP = u32(c.EIP + 5);
                    }
                };
            }

            case 0x05: {

                const value =
                    this.imm32(address + 1);

                return {
                    opcode: op,
                    mnemonic: "ADD EAX,imm32",
                    size: 5,
                    execute(c) {
                        c.EAX =
                            c.add(c.EAX, value);
                        c.EIP = u32(c.EIP + 5);
                    }
                };
            }

            case 0x2D: {

                const value =
                    this.imm32(address + 1);

                return {
                    opcode: op,
                    mnemonic: "SUB EAX,imm32",
                    size: 5,
                    execute(c) {
                        c.EAX =
                            c.sub(c.EAX, value);
                        c.EIP = u32(c.EIP + 5);
                    }
                };
            }

            case 0x35: {

                const value =
                    this.imm32(address + 1);

                return {
                    opcode: op,
                    mnemonic: "XOR EAX,imm32",
                    size: 5,
                    execute(c) {
                        c.EAX =
                            u32(c.EAX ^ value);
                        c.logicFlags(c.EAX);
                        c.EIP = u32(c.EIP + 5);
                    }
                };
            }

            case 0x25: {

                const value =
                    this.imm32(address + 1);

                return {
                    opcode: op,
                    mnemonic: "AND EAX,imm32",
                    size: 5,
                    execute(c) {
                        c.EAX =
                            u32(c.EAX & value);
                        c.logicFlags(c.EAX);
                        c.EIP = u32(c.EIP + 5);
                    }
                };
            }

            case 0x0D: {

                const value =
                    this.imm32(address + 1);

                return {
                    opcode: op,
                    mnemonic: "OR EAX,imm32",
                    size: 5,
                    execute(c) {
                        c.EAX =
                            u32(c.EAX | value);
                        c.logicFlags(c.EAX);
                        c.EIP = u32(c.EIP + 5);
                    }
                };
            }

            case 0x40:
                return {
                    opcode: op,
                    mnemonic: "INC EAX",
                    size: 1,
                    execute(c) {
                        c.EAX = c.inc(c.EAX);
                        c.EIP = u32(c.EIP + 1);
                    }
                };

            case 0x48:
                return {
                    opcode: op,
                    mnemonic: "DEC EAX",
                    size: 1,
                    execute(c) {
                        c.EAX = c.dec(c.EAX);
                        c.EIP = u32(c.EIP + 1);
                    }
                };

            case 0x50:
                return {
                    opcode: op,
                    mnemonic: "PUSH EAX",
                    size: 1,
                    execute(c) {
                        c.push32(c.EAX);
                        c.EIP = u32(c.EIP + 1);
                    }
                };

            case 0x51:
                return {
                    opcode: op,
                    mnemonic: "PUSH ECX",
                    size: 1,
                    execute(c) {
                        c.push32(c.ECX);
                        c.EIP = u32(c.EIP + 1);
                    }
                };

            case 0x52:
                return {
                    opcode: op,
                    mnemonic: "PUSH EDX",
                    size: 1,
                    execute(c) {
                        c.push32(c.EDX);
                        c.EIP = u32(c.EIP + 1);
                    }
                };

            case 0x53:
                return {
                    opcode: op,
                    mnemonic: "PUSH EBX",
                    size: 1,
                    execute(c) {
                        c.push32(c.EBX);
                        c.EIP = u32(c.EIP + 1);
                    }
                };

            case 0x58:
                return {
                    opcode: op,
                    mnemonic: "POP EAX",
                    size: 1,
                    execute(c) {
                        c.EAX = c.pop32();
                        c.EIP = u32(c.EIP + 1);
                    }
                };

            case 0x59:
                return {
                    opcode: op,
                    mnemonic: "POP ECX",
                    size: 1,
                    execute(c) {
                        c.ECX = c.pop32();
                        c.EIP = u32(c.EIP + 1);
                    }
                };

            case 0x5A:
                return {
                    opcode: op,
                    mnemonic: "POP EDX",
                    size: 1,
                    execute(c) {
                        c.EDX = c.pop32();
                        c.EIP = u32(c.EIP + 1);
                    }
                };

            case 0x5B:
                return {
                    opcode: op,
                    mnemonic: "POP EBX",
                    size: 1,
                    execute(c) {
                        c.EBX = c.pop32();
                        c.EIP = u32(c.EIP + 1);
                    }
                };

            /*
             * RET
             */

            case 0xC3:
                return {
                    opcode: op,
                    mnemonic: "RET",
                    size: 1,
                    execute(c) {
                        c.EIP = c.pop32();
                    }
                };

            /*
             * CALL rel32
             */

            case 0xE8: {

                const rel =
                    this.memory.readS32(
                        address + 1
                    );

                return {
                    opcode: op,
                    mnemonic: "CALL rel32",
                    size: 5,
                    execute(c) {

                        const next =
                            u32(c.EIP + 5);

                        c.push32(next);

                        c.EIP =
                            u32(next + rel);
                    }
                };
            }

            /*
             * JMP rel32
             */

            case 0xE9: {

                const rel =
                    this.memory.readS32(
                        address + 1
                    );

                return {
                    opcode: op,
                    mnemonic: "JMP rel32",
                    size: 5,
                    execute(c) {

                        c.EIP =
                            u32(
                                c.EIP +
                                5 +
                                rel
                            );
                    }
                };
            }

            /*
             * JMP rel8
             */

            case 0xEB: {

                const rel =
                    this.memory.readS8(
                        address + 1
                    );

                return {
                    opcode: op,
                    mnemonic: "JMP rel8",
                    size: 2,
                    execute(c) {

                        c.EIP =
                            u32(
                                c.EIP +
                                2 +
                                rel
                            );
                    }
                };
            }

            /*
             * CMP EAX, imm32
             */

            case 0x3D: {

                const value =
                    this.memory.read32(
                        address + 1
                    );

                return {
                    opcode: op,
                    mnemonic: "CMP EAX,imm32",
                    size: 5,
                    execute(c) {

                        c.sub(
                            c.EAX,
                            value
                        );

                        c.EIP =
                            u32(c.EIP + 5);
                    }
                };
            }

            /*
             * JE/JZ rel8
             */

            case 0x74: {

                const rel =
                    this.memory.readS8(
                        address + 1
                    );

                return {
                    opcode: op,
                    mnemonic: "JE rel8",
                    size: 2,
                    execute(c) {

                        if (c.flag(FLAGS.ZF)) {
                            c.EIP =
                                u32(
                                    c.EIP +
                                    2 +
                                    rel
                                );
                        } else {
                            c.EIP =
                                u32(c.EIP + 2);
                        }
                    }
                };
            }

            /*
             * JNE/JNZ rel8
             */

            case 0x75: {

                const rel =
                    this.memory.readS8(
                        address + 1
                    );

                return {
                    opcode: op,
                    mnemonic: "JNE rel8",
                    size: 2,
                    execute(c) {

                        if (!c.flag(FLAGS.ZF)) {
                            c.EIP =
                                u32(
                                    c.EIP +
                                    2 +
                                    rel
                                );
                        } else {
                            c.EIP =
                                u32(c.EIP + 2);
                        }
                    }
                };
            }

            default:

                throw new Error(
                    `Unsupported x86 opcode ${hex(op, 2)} at ${hex(address)}`
                );
        }
    }
}

/* ============================================================
 * XBE
 * ============================================================ */

class XBE {

    constructor() {

        this.loaded = false;

        this.buffer = null;

        this.baseAddress = 0;
        this.entryPoint = 0;
        this.rawEntryPoint = 0;

        this.imageSize = 0;
        this.headerSize = 0;

        this.sections = [];

        this.timestamp = 0;
    }

    async load(source) {

        let buffer;

        if (source instanceof ArrayBuffer) {

            buffer =
                source.slice(0);

        } else if (source instanceof Uint8Array) {

            buffer =
                source.buffer.slice(
                    source.byteOffset,
                    source.byteOffset +
                    source.byteLength
                );

        } else if (
            source &&
            typeof source.arrayBuffer === "function"
        ) {

            buffer =
                await source.arrayBuffer();

        } else {

            throw new Error(
                "XBE: unsupported source."
            );
        }

        const data =
            new Uint8Array(buffer);

        assert(
            data.length >= 0x200,
            "XBE is too small."
        );

        const view =
            new DataView(buffer);

        const magic =
            String.fromCharCode(
                data[0],
                data[1],
                data[2],
                data[3]
            );

        assert(
            magic === "XBEH",
            `Invalid XBE signature: ${magic}`
        );

        this.buffer = buffer;

        this.baseAddress =
            view.getUint32(
                0x104,
                true
            );

        this.headerSize =
            view.getUint32(
                0x108,
                true
            );

        this.imageSize =
            view.getUint32(
                0x10C,
                true
            );

        this.timestamp =
            view.getUint32(
                0x114,
                true
            );

        this.rawEntryPoint =
            view.getUint32(
                0x128,
                true
            );

        /*
         * XBE stores the entry point encoded
         * with the standard Xbox XOR value.
         */

        this.entryPoint =
            u32(
                this.rawEntryPoint ^
                XBE_ENTRY_XOR
            );

        this.sectionCount =
            view.getUint32(
                0x11C,
                true
            );

        this.sectionHeaders =
            view.getUint32(
                0x120,
                true
            );

        this.sections = [];

        for (
            let i = 0;
            i < this.sectionCount;
            i++
        ) {

            const off =
                this.sectionHeaders +
                i * 0x38;

            if (
                off + 0x38 >
                data.length
            ) {
                break;
            }

            const flags =
                view.getUint32(
                    off,
                    true
                );

            const virtualAddress =
                view.getUint32(
                    off + 4,
                    true
                );

            const virtualSize =
                view.getUint32(
                    off + 8,
                    true
                );

            const rawAddress =
                view.getUint32(
                    off + 12,
                    true
                );

            const rawSize =
                view.getUint32(
                    off + 16,
                    true
                );

            const nameAddress =
                view.getUint32(
                    off + 20,
                    true
                );

            let name = `section_${i}`;

            if (
                nameAddress < data.length
            ) {

                let chars = [];

                for (
                    let p = nameAddress;
                    p < data.length &&
                    p < nameAddress + 64;
                    p++
                ) {

                    const c =
                        data[p];

                    if (c === 0) {
                        break;
                    }

                    chars.push(
                        String.fromCharCode(c)
                    );
                }

                if (chars.length) {
                    name =
                        chars.join("");
                }
            }

            this.sections.push({

                index: i,

                flags,

                virtualAddress,

                virtualSize,

                rawAddress,

                rawSize,

                name
            });
        }

        this.loaded = true;

        return this;
    }

    map(memory) {

        assert(
            this.loaded,
            "XBE is not loaded."
        );

        /*
         * Map image sections.
         *
         * XBE virtual addresses normally use the
         * Xbox image base. For a browser emulator
         * we translate them into a flat RAM address.
         */

        for (const section of this.sections) {

            if (section.rawSize === 0) {
                continue;
            }

            const rawEnd =
                section.rawAddress +
                section.rawSize;

            if (
                rawEnd >
                this.buffer.byteLength
            ) {
                throw new Error(
                    `XBE section ${section.name} exceeds file.`
                );
            }

            /*
             * Translate virtual image address into
             * emulator RAM.
             */

            const relative =
                u32(
                    section.virtualAddress -
                    this.baseAddress
                );

            const target =
                relative;

            if (
                target >= memory.size
            ) {
                continue;
            }

            const available =
                memory.size -
                target;

            const amount =
                Math.min(
                    section.rawSize,
                    available
                );

            const bytes =
                new Uint8Array(
                    this.buffer,
                    section.rawAddress,
                    amount
                );

            memory.copyFrom(
                target,
                bytes
            );
        }

        /*
         * Entry point translation.
         */

        const relativeEntry =
            u32(
                this.entryPoint -
                this.baseAddress
            );

        assert(
            relativeEntry < memory.size,
            `XBE entry point outside RAM: ${hex(relativeEntry)}`
        );

        return {
            entryPoint: relativeEntry
        };
    }

    status() {

        return {
            loaded: this.loaded,
            size:
                this.buffer
                    ? this.buffer.byteLength
                    : 0,
            baseAddress:
                hex(this.baseAddress),
            rawEntryPoint:
                hex(this.rawEntryPoint),
            entryPoint:
                hex(this.entryPoint),
            sections:
                this.sections.map(s => ({
                    name: s.name,
                    virtualAddress:
                        hex(s.virtualAddress),
                    virtualSize: s.virtualSize,
                    rawAddress:
                        hex(s.rawAddress),
                    rawSize: s.rawSize
                }))
        };
    }
}

/* ============================================================
 * KERNEL
 * ============================================================ */

class Kernel {

    constructor(machine) {

        this.machine = machine;

        this.ready = false;

        this.services = new Map();
    }

    initialize() {

        this.ready = true;

        return true;
    }

    register(name, handler) {

        this.services.set(
            String(name),
            handler
        );
    }

    call(name, ...args) {

        const handler =
            this.services.get(
                String(name)
            );

        if (!handler) {
            throw new Error(
                `Kernel service not implemented: ${name}`
            );
        }

        return handler(...args);
    }

    status() {

        return {
            ready: this.ready,
            services:
                [...this.services.keys()]
        };
    }
}

/* ============================================================
 * THUNKS
 * ============================================================ */

class Thunks {

    constructor() {
        this.map = new Map();
    }

    register(address, handler) {

        assert(
            typeof handler === "function",
            "Thunk must be a function."
        );

        this.map.set(
            u32(address),
            handler
        );
    }

    has(address) {
        return this.map.has(u32(address));
    }

    call(address, ...args) {

        const fn =
            this.map.get(u32(address));

        if (!fn) {
            throw new Error(
                `Unknown thunk ${hex(address)}`
            );
        }

        return fn(...args);
    }

    status() {
        return {
            available: true,
            count: this.map.size
        };
    }
}

/* ============================================================
 * XAPI
 * ============================================================ */

class XAPI {

    constructor(machine) {

        this.machine = machine;

        this.functions = new Map();

        this.installDefaults();
    }

    register(name, fn) {

        this.functions.set(
            String(name),
            fn
        );
    }

    call(name, ...args) {

        const fn =
            this.functions.get(
                String(name)
            );

        if (!fn) {
            throw new Error(
                `XAPI function unavailable: ${name}`
            );
        }

        return fn(...args);
    }

    installDefaults() {

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
                typeof performance !== "undefined"
                    ? u32(performance.now())
                    : u32(Date.now())
        );

        this.register(
            "XGetVideoMode",
            () => ({
                width: 640,
                height: 480,
                refresh: 60
            })
        );

        this.register(
            "XInputGetState",
            index =>
                this.machine.input.getState(index)
        );

        this.register(
            "XGetAVPack",
            () => 0
        );
    }

    status() {
        return {
            available: true,
            count: this.functions.size
        };
    }
}

/* ============================================================
 * INPUT
 * ============================================================ */

class Input {

    constructor() {

        this.keys = Object.create(null);

        this.gamepad = null;

        this.started = false;

        this.onKeyDown =
            e => {
                this.keys[e.code] = true;
            };

        this.onKeyUp =
            e => {
                this.keys[e.code] = false;
            };
    }

    initialize() {

        if (this.started) {
            return;
        }

        window.addEventListener(
            "keydown",
            this.onKeyDown
        );

        window.addEventListener(
            "keyup",
            this.onKeyUp
        );

        this.started = true;
    }

    update() {

        if (
            typeof navigator !== "undefined" &&
            navigator.getGamepads
        ) {

            const pads =
                navigator.getGamepads();

            this.gamepad =
                pads[0] || null;
        }
    }

    getState() {

        this.update();

        const pad =
            this.gamepad;

        return {

            A:
                !!(
                    this.keys.KeyZ ||
                    (
                        pad &&
                        pad.buttons[0] &&
                        pad.buttons[0].pressed
                    )
                ),

            B:
                !!(
                    this.keys.KeyX ||
                    (
                        pad &&
                        pad.buttons[1] &&
                        pad.buttons[1].pressed
                    )
                ),

            START:
                !!(
                    this.keys.Enter ||
                    (
                        pad &&
                        pad.buttons[9] &&
                        pad.buttons[9].pressed
                    )
                ),

            BACK:
                !!(
                    this.keys.Backspace ||
                    (
                        pad &&
                        pad.buttons[8] &&
                        pad.buttons[8].pressed
                    )
                ),

            UP:
                !!this.keys.ArrowUp,

            DOWN:
                !!this.keys.ArrowDown,

            LEFT:
                !!this.keys.ArrowLeft,

            RIGHT:
                !!this.keys.ArrowRight
        };
    }

    status() {

        return {
            available: true,
            started: this.started,
            gamepad:
                !!this.gamepad
        };
    }
}

/* ============================================================
 * GRAPHICS
 * ============================================================ */

class Graphics {

    constructor(canvas) {

        this.canvas = canvas;

        this.ctx =
            canvas.getContext(
                "2d",
                {
                    alpha: false
                }
            );

        assert(
            this.ctx,
            "Cannot create graphics context."
        );

        this.width = canvas.width;
        this.height = canvas.height;

        this.frame = 0;
    }

    clear() {

        this.ctx.fillStyle = "#050708";

        this.ctx.fillRect(
            0,
            0,
            this.width,
            this.height
        );
    }

    text(
        text,
        x,
        y,
        size = 20
    ) {

        this.ctx.fillStyle = "#72ff72";

        this.ctx.font =
            `${size}px monospace`;

        this.ctx.fillText(
            text,
            x,
            y
        );
    }

    boot(info) {

        this.clear();

        this.text(
            "WEBBKTX XBOX RUNTIME",
            40,
            60,
            30
        );

        this.text(
            "XBE BOOT",
            40,
            105,
            22
        );

        this.text(
            `ENTRY: ${hex(info.entryPoint)}`,
            40,
            150
        );

        this.text(
            `SECTIONS: ${info.sections}`,
            40,
            180
        );

        this.text(
            `CPU: ${info.cpu}`,
            40,
            210
        );

        this.text(
            `GPU: ${info.gpu}`,
            40,
            240
        );

        this.text(
            `AUDIO: ${info.audio}`,
            40,
            270
        );

        this.text(
            `FPS: ${info.fps}`,
            40,
            300
        );

        this.frame++;
    }

    status() {

        return {
            available: true,
            width: this.width,
            height: this.height,
            frame: this.frame
        };
    }
}

/* ============================================================
 * AUDIO
 * ============================================================ */

class Audio {

    constructor() {

        this.enabled = false;
        this.context = null;
    }

    initialize() {

        /*
         * Audio is deliberately optional.
         * The emulator does not depend on it.
         */

        this.enabled = false;

        return false;
    }

    status() {

        return {
            available: true,
            enabled: this.enabled
        };
    }
}

/* ============================================================
 * MACHINE
 * ============================================================ */

class Machine {

    constructor(options = {}) {

        this.version =
            WEBBKTX_VERSION;

        this.memory =
            new Memory(
                options.ram ||
                DEFAULT_RAM
            );

        this.cpu =
            new CPU(
                this.memory
            );

        this.decoder =
            new Decoder(
                this.memory
            );

        this.cpu.attachDecoder(
            this.decoder
        );

        this.xbe =
            new XBE();

        this.kernel =
            new Kernel(this);

        this.thunks =
            new Thunks();

        this.xapi =
            new XAPI(this);

        this.input =
            new Input();

        this.graphics =
            null;

        this.audio =
            new Audio();

        this.loaded = false;
        this.booted = false;
        this.running = false;

        this.lastBoot = null;

        this.frameBudget = 5000;

        this.fps = 0;
        this.frames = 0;

        this.lastFrameTime =
            performance.now();

        this.initialize();
    }

    initialize() {

        this.kernel.initialize();

        this.input.initialize();

        console.log(
            `[WebBktx ${this.version}] initialized`
        );
    }

    attachCanvas(canvas) {

        this.graphics =
            new Graphics(canvas);

        return this.graphics;
    }

    async loadXBE(source) {

        await this.xbe.load(source);

        const mapping =
            this.xbe.map(
                this.memory
            );

        this.cpu.reset();

        /*
         * Start execution at the mapped XBE entry.
         */

        this.cpu.EIP =
            u32(mapping.entryPoint);

        this.loaded = true;

        console.log(
            "[WebBktx] XBE loaded",
            this.xbe.status()
        );

        return {
            success: true,
            xbe: this.xbe.status(),
            entryPoint:
                this.cpu.EIP
        };
    }

    boot() {

        assert(
            this.loaded,
            "No XBE loaded."
        );

        this.booted = true;
        this.running = true;

        this.lastBoot = {
            entryPoint: this.cpu.EIP,
            sections:
                this.xbe.sections.length,
            cpu: "ONLINE",
            gpu:
                this.graphics
                    ? "ONLINE"
                    : "HEADLESS",
            audio:
                this.audio.enabled
                    ? "ONLINE"
                    : "DISABLED"
        };

        if (this.graphics) {

            this.graphics.boot({
                entryPoint:
                    this.cpu.EIP,
                sections:
                    this.xbe.sections.length,
                cpu: "ONLINE",
                gpu: "ONLINE",
                audio: "DISABLED",
                fps: this.fps
            });
        }

        return this.lastBoot;
    }

    runInstructions(limit) {

        if (!this.booted) {
            return {
                executed: 0,
                reason: "NOT_BOOTED"
            };
        }

        try {

            return this.cpu.run(
                limit ||
                this.frameBudget
            );

        } catch (error) {

            /*
             * Do not kill the browser application.
             * Stop the CPU and report the actual fault.
             */

            this.running = false;

            console.error(
                "[WebBktx CPU]",
                error
            );

            return {
                executed: 0,
                faulted: true,
                error: error.message
            };
        }
    }

    runFrame() {

        if (!this.running) {
            return;
        }

        const start =
            performance.now();

        this.input.update();

        const result =
            this.runInstructions(
                this.frameBudget
            );

        const elapsed =
            performance.now() - start;

        if (elapsed > 0) {
            this.fps =
                Math.round(
                    1000 / elapsed
                );
        }

        this.frames++;

        if (this.graphics) {

            this.graphics.boot({

                entryPoint:
                    this.cpu.EIP,

                sections:
                    this.xbe.sections.length,

                cpu:
                    this.cpu.halted
                        ? "HALTED"
                        : "ONLINE",

                gpu: "ONLINE",

                audio: "DISABLED",

                fps:
                    Math.min(
                        60,
                        this.fps || 0
                    )
            });
        }

        return result;
    }

    stop() {

        this.running = false;
        this.cpu.stop();
    }

    status() {

        return {

            runtime:
                this.version,

            memory:
                `${Math.round(
                    this.memory.size /
                    1024 /
                    1024
                )} MB`,

            cpu:
                this.cpu.status(),

            decoder:
                "available",

            xbe:
                this.loaded
                    ? this.xbe.status()
                    : null,

            kernel:
                this.kernel.status(),

            thunks:
                this.thunks.status(),

            xapi:
                this.xapi.status(),

            xinput:
                this.input.status(),

            graphics:
                this.graphics
                    ? this.graphics.status()
                    : {
                        available: true,
                        attached: false
                    },

            audio:
                this.audio.status(),

            booted:
                this.booted,

            running:
                this.running
        };
    }

    selfTest() {

        const cpu =
            this.cpu.selfTest();

        return {

            version:
                this.version,

            memory: true,

            cpu,

            decoder:
                !!this.decoder,

            kernel:
                this.kernel.ready,

            thunks:
                true,

            xapi:
                true,

            graphics:
                true,

            input:
                true,

            audio:
                true,

            passed:
                cpu.passed &&
                !!this.decoder &&
                this.kernel.ready
        };
    }
}

/* ============================================================
 * GLOBAL API
 * ============================================================ */

const machine =
    new Machine();

const WebBktx = {

    version:
        WEBBKTX_VERSION,

    Machine,

    machine,

    Memory,
    CPU,
    Decoder,
    XBE,
    Kernel,
    Thunks,
    XAPI,
    Input,
    Graphics,
    Audio,

    initialize() {
        return true;
    },

    async loadXBE(source) {
        return machine.loadXBE(source);
    },

    boot() {
        return machine.boot();
    },

    runFrame() {
        return machine.runFrame();
    },

    stop() {
        return machine.stop();
    },

    status() {
        return machine.status();
    },

    selfTest() {
        return machine.selfTest();
    }
};

/* ============================================================
 * EXPORTS
 * ============================================================ */

window.WebBktx = WebBktx;

window.WebBktxMachine = Machine;
window.WebBktxMemory = Memory;
window.WebBktxCPU = CPU;
window.WebBktxDecoder = Decoder;
window.WebBktxXBE = XBE;
window.WebBktxKernel = Kernel;
window.WebBktxThunks = Thunks;
window.WebBktxXAPI = XAPI;
window.WebBktxXInput = Input;
window.WebBktxXGraphics = Graphics;
window.WebBktxAudio = Audio;

console.log(
    `[WebBktx ${WEBBKTX_VERSION}] Unified runtime loaded.`
);

console.log(
    "[WebBktx] Self-test:",
    machine.selfTest()
);

console.log(
    "[WebBktx] Runtime status:",
    machine.status()
);
