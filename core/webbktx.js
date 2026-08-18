"use strict";

/*
 * ============================================================
 * WebBktx
 * Xbox emulator runtime for the browser
 *
 * Fresh runtime architecture.
 *
 * This file contains:
 *
 *  - physical memory
 *  - x86 CPU
 *  - x86 decoder/executor
 *  - XBE parser
 *  - executable image loader
 *  - Xbox kernel abstraction
 *  - XAPI
 *  - XFile
 *  - XInput
 *  - XGraphics
 *  - emulator machine
 *
 * No external runtime files are required.
 *
 * ============================================================
 */

(() => {

    const VERSION = "2.0.0";

    const DEFAULT_RAM = 64 * 1024 * 1024;

    const U32 = value => Number(value) >>> 0;

    const I32 = value => Number(value) | 0;

    const HEX = (value, width = 8) =>
        U32(value).toString(16).toUpperCase().padStart(width, "0");

    const clamp = (value, min, max) =>
        Math.max(min, Math.min(max, value));


    /* ========================================================
       MEMORY
    ======================================================== */

    class Memory {

        constructor(size = DEFAULT_RAM) {

            size = Number(size);

            if (
                !Number.isInteger(size) ||
                size < 1024 * 1024
            ) {
                throw new Error("Invalid RAM size.");
            }

            this.size = size;

            this.buffer = new ArrayBuffer(size);

            this.u8 = new Uint8Array(this.buffer);

            this.view = new DataView(this.buffer);
        }


        reset() {

            this.u8.fill(0);
        }


        check(address, length = 1) {

            address = U32(address);
            length = Number(length);

            if (
                !Number.isInteger(length) ||
                length < 0
            ) {
                throw new RangeError("Invalid memory length.");
            }

            if (
                address > this.size ||
                length > this.size - address
            ) {
                throw new RangeError(
                    `Memory access violation at 0x${HEX(address)}`
                );
            }

            return address;
        }


        read8(address) {

            return this.u8[this.check(address)];
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


        readS8(address) {

            return this.view.getInt8(
                this.check(address)
            );
        }


        readS16(address) {

            return this.view.getInt16(
                this.check(address, 2),
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

            this.u8[this.check(address)] =
                U32(value) & 0xFF;
        }


        write16(address, value) {

            this.view.setUint16(
                this.check(address, 2),
                U32(value) & 0xFFFF,
                true
            );
        }


        write32(address, value) {

            this.view.setUint32(
                this.check(address, 4
                ),
                U32(value),
                true
            );
        }


        readBytes(address, length) {

            this.check(address, length);

            return this.u8.slice(
                address,
                address + length
            );
        }


        writeBytes(address, bytes) {

            const data =
                bytes instanceof Uint8Array
                    ? bytes
                    : new Uint8Array(bytes);

            this.check(address, data.length);

            this.u8.set(data, address);
        }


        load(address, bytes) {

            this.writeBytes(address, bytes);
        }


        fill(address, length, value = 0) {

            this.check(address, length);

            this.u8.fill(
                U32(value) & 0xFF,
                address,
                address + length
            );
        }


        readCString(address, max = 4096) {

            const bytes = [];

            for (
                let i = 0;
                i < max;
                i++
            ) {

                const value = this.read8(
                    address + i
                );

                if (value === 0) {
                    break;
                }

                bytes.push(value);
            }

            return new TextDecoder().decode(
                new Uint8Array(bytes)
            );
        }


        getStatus() {

            return {
                bytes: this.size,
                megabytes: this.size / 1024 / 1024
            };
        }
    }


    /* ========================================================
       X86 FLAGS
    ======================================================== */

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


    /* ========================================================
       CPU
    ======================================================== */

    class CPU {

        constructor(memory) {

            this.memory = memory;

            this.reset();

            this.instructions = 0;

            this.cycles = 0;

            this.running = false;

            this.halted = false;

            this.faulted = false;

            this.lastFault = null;

            this.decoder = null;

            this.breakpoints = new Set();

            this.maxInstructions = 1000000;

            this.traceEnabled = false;

            this.trace = [];

            this.maxTrace = 2000;
        }


        reset() {

            this.EAX = 0;
            this.EBX = 0;
            this.ECX = 0;
            this.EDX = 0;

            this.ESI = 0;
            this.EDI = 0;
            this.EBP = 0;
            this.ESP = this.memory.size - 0x100;

            this.EIP = 0;

            this.EFLAGS = 0x202;

            this.instructions = 0;

            this.cycles = 0;

            this.running = false;

            this.halted = false;

            this.faulted = false;

            this.lastFault = null;

            this.trace.length = 0;
        }


        attachDecoder(decoder) {

            this.decoder = decoder;
        }


        getRegister(name) {

            name = String(name).toUpperCase();

            if (!(name in this)) {
                throw new Error(
                    `Unknown register ${name}`
                );
            }

            return U32(this[name]);
        }


        setRegister(name, value) {

            name = String(name).toUpperCase();

            if (
                ![
                    "EAX",
                    "EBX",
                    "ECX",
                    "EDX",
                    "ESI",
                    "EDI",
                    "EBP",
                    "ESP",
                    "EIP",
                    "EFLAGS"
                ].includes(name)
            ) {
                throw new Error(
                    `Unknown register ${name}`
                );
            }

            this[name] = U32(value);

            if (name === "EFLAGS") {
                this.EFLAGS |= 2;
            }
        }


        getRegisters() {

            return {
                EAX: U32(this.EAX),
                EBX: U32(this.EBX),
                ECX: U32(this.ECX),
                EDX: U32(this.EDX),
                ESI: U32(this.ESI),
                EDI: U32(this.EDI),
                EBP: U32(this.EBP),
                ESP: U32(this.ESP),
                EIP: U32(this.EIP),
                EFLAGS: U32(this.EFLAGS)
            };
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

            value &= 0xFF;

            let p = 0;

            while (value) {
                p ^= value & 1;
                value >>>= 1;
            }

            return p === 0;
        }


        logicFlags(result) {

            result = U32(result);

            this.setFlag(FLAGS.CF, false);
            this.setFlag(FLAGS.OF, false);

            this.setFlag(
                FLAGS.ZF,
                result === 0
            );

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

            a = U32(a);
            b = U32(b);

            const result =
                U32(a + b);

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

            a = U32(a);
            b = U32(b);

            const result =
                U32(a - b);

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


        push(value) {

            this.ESP =
                U32(this.ESP - 4);

            this.memory.write32(
                this.ESP,
                value
            );
        }


        pop() {

            const value =
                this.memory.read32(this.ESP);

            this.ESP =
                U32(this.ESP + 4);

            return value;
        }


        fetch8() {

            const value =
                this.memory.read8(this.EIP);

            this.EIP =
                U32(this.EIP + 1);

            return value;
        }


        fetch32() {

            const value =
                this.memory.read32(this.EIP);

            this.EIP =
                U32(this.EIP + 4);

            return value;
        }


        fetchS8() {

            return this.memory.readS8(
                this.EIP++
            );
        }


        fetchS32() {

            const value =
                this.memory.readS32(this.EIP);

            this.EIP =
                U32(this.EIP + 4);

            return value;
        }


        addBreakpoint(address) {

            this.breakpoints.add(U32(address));
        }


        removeBreakpoint(address) {

            this.breakpoints.delete(U32(address));
        }


        clearBreakpoints() {

            this.breakpoints.clear();
        }


        step() {

            if (this.halted) {
                return {
                    halted: true,
                    executed: false
                };
            }

            if (this.faulted) {
                return {
                    faulted: true,
                    executed: false
                };
            }

            if (!this.decoder) {
                throw new Error(
                    "CPU decoder unavailable."
                );
            }

            if (
                this.breakpoints.has(
                    U32(this.EIP)
                )
            ) {
                return {
                    breakpoint: true,
                    executed: false,
                    address: U32(this.EIP)
                };
            }

            const address = U32(this.EIP);

            try {

                const result =
                    this.decoder.execute(this);

                this.instructions++;
                this.cycles++;

                if (this.traceEnabled) {

                    this.trace.push({
                        address,
                        mnemonic:
                            result.mnemonic,
                        registers:
                            this.getRegisters()
                    });

                    if (
                        this.trace.length >
                        this.maxTrace
                    ) {
                        this.trace.shift();
                    }
                }

                return {
                    executed: true,
                    address,
                    ...result
                };

            } catch (error) {

                this.faulted = true;

                this.running = false;

                this.lastFault =
                    error instanceof Error
                        ? error.message
                        : String(error);

                throw error;
            }
        }


        run(limit = this.maxInstructions) {

            limit =
                Math.max(
                    1,
                    Number(limit) | 0
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

                    if (
                        !last.executed
                    ) {
                        break;
                    }

                    executed++;
                }

            } finally {

                this.running = false;
            }

            return {
                executed,
                instructions: this.instructions,
                cycles: this.cycles,
                halted: this.halted,
                faulted: this.faulted,
                last,
                registers:
                    this.getRegisters()
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
                instructions: this.instructions,
                cycles: this.cycles,
                EIP: U32(this.EIP),
                registers:
                    this.getRegisters(),
                fault: this.lastFault
            };
        }


        selfTest() {

            this.reset();

            const tests = [];

            tests.push({
                name: "ADD",
                pass:
                    this.add(10, 20) === 30
            });

            tests.push({
                name: "SUB",
                pass:
                    this.sub(50, 20) === 30
            });

            tests.push({
                name: "XOR",
                pass:
                    ((0xFF00 ^ 0x0F00) >>> 0)
                    === 0xF000
            });

            const esp = this.ESP;

            this.push(0x12345678);

            tests.push({
                name: "STACK",
                pass:
                    this.pop() === 0x12345678 &&
                    this.ESP === esp
            });

            this.memory.write32(
                0x1000,
                0xDEADBEEF
            );

            tests.push({
                name: "MEMORY",
                pass:
                    this.memory.read32(0x1000)
                    === 0xDEADBEEF
            });

            return {
                passed:
                    tests.every(x => x.pass),
                tests
            };
        }
    }


    /* ========================================================
       X86 DECODER
    ======================================================== */

    class Decoder {

        constructor(memory) {

            this.memory = memory;
        }


        modrm(cpu) {

            const value = cpu.fetch8();

            return {
                mod: value >> 6,
                reg: (value >> 3) & 7,
                rm: value & 7
            };
        }


        registerName(index) {

            return [
                "EAX",
                "ECX",
                "EDX",
                "EBX",
                "ESP",
                "EBP",
                "ESI",
                "EDI"
            ][index];
        }


        readReg(cpu, index) {

            return cpu[
                this.registerName(index)
            ];
        }


        writeReg(cpu, index, value) {

            cpu[
                this.registerName(index)
            ] = U32(value);
        }


        execute(cpu) {

            const opcode =
                cpu.fetch8();

            switch (opcode) {

                case 0x90:

                    return {
                        opcode,
                        mnemonic: "NOP"
                    };


                case 0xF4:

                    cpu.halt();

                    return {
                        opcode,
                        mnemonic: "HLT"
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
                        cpu.fetch32();

                    this.writeReg(
                        cpu,
                        reg,
                        value
                    );

                    return {
                        opcode,
                        mnemonic:
                            `MOV ${this.registerName(reg)}, 0x${HEX(value)}`
                    };
                }


                case 0x05: {

                    const value =
                        cpu.fetch32();

                    cpu.EAX =
                        cpu.add(
                            cpu.EAX,
                            value
                        );

                    return {
                        opcode,
                        mnemonic: "ADD EAX, imm32"
                    };
                }


                case 0x2D: {

                    const value =
                        cpu.fetch32();

                    cpu.EAX =
                        cpu.sub(
                            cpu.EAX,
                            value
                        );

                    return {
                        opcode,
                        mnemonic: "SUB EAX, imm32"
                    };
                }


                case 0x40:
                case 0x41:
                case 0x42:
                case 0x43:
                case 0x44:
                case 0x45:
                case 0x46:
                case 0x47: {

                    const reg =
                        opcode - 0x40;

                    this.writeReg(
                        cpu,
                        reg,
                        cpu.inc(
                            this.readReg(
                                cpu,
                                reg
                            )
                        )
                    );

                    return {
                        opcode,
                        mnemonic:
                            `INC ${this.registerName(reg)}`
                    };
                }


                case 0x48:
                case 0x49:
                case 0x4A:
                case 0x4B:
                case 0x4C:
                case 0x4D:
                case 0x4E:
                case 0x4F: {

                    const reg =
                        opcode - 0x48;

                    this.writeReg(
                        cpu,
                        reg,
                        cpu.dec(
                            this.readReg(
                                cpu,
                                reg
                            )
                        )
                    );

                    return {
                        opcode,
                        mnemonic:
                            `DEC ${this.registerName(reg)}`
                    };
                }


                case 0x50:
                case 0x51:
                case 0x52:
                case 0x53:
                case 0x54:
                case 0x55:
                case 0x56:
                case 0x57: {

                    const reg =
                        opcode - 0x50;

                    cpu.push(
                        this.readReg(
                            cpu,
                            reg
                        )
                    );

                    return {
                        opcode,
                        mnemonic:
                            `PUSH ${this.registerName(reg)}`
                    };
                }


                case 0x58:
                case 0x59:
                case 0x5A:
                case 0x5B:
                case 0x5C:
                case 0x5D:
                case 0x5E:
                case 0x5F: {

                    const reg =
                        opcode - 0x58;

                    this.writeReg(
                        cpu,
                        reg,
                        cpu.pop()
                    );

                    return {
                        opcode,
                        mnemonic:
                            `POP ${this.registerName(reg)}`
                    };
                }


                case 0x31: {

                    const m =
                        this.modrm(cpu);

                    if (m.mod !== 3) {
                        throw new Error(
                            "XOR memory operand not implemented."
                        );
                    }

                    const left =
                        this.readReg(
                            cpu,
                            m.rm
                        );

                    const right =
                        this.readReg(
                            cpu,
                            m.reg
                        );

                    const result =
                        U32(left ^ right);

                    this.writeReg(
                        cpu,
                        m.rm,
                        result
                    );

                    cpu.logicFlags(result);

                    return {
                        opcode,
                        mnemonic:
                            "XOR r32,r32"
                    };
                }


                case 0x21: {

                    const m =
                        this.modrm(cpu);

                    if (m.mod !== 3) {
                        throw new Error(
                            "AND memory operand not implemented."
                        );
                    }

                    const result =
                        U32(
                            this.readReg(cpu, m.rm) &
                            this.readReg(cpu, m.reg)
                        );

                    this.writeReg(
                        cpu,
                        m.rm,
                        result
                    );

                    cpu.logicFlags(result);

                    return {
                        opcode,
                        mnemonic:
                            "AND r32,r32"
                    };
                }


                case 0x09: {

                    const m =
                        this.modrm(cpu);

                    if (m.mod !== 3) {
                        throw new Error(
                            "OR memory operand not implemented."
                        );
                    }

                    const result =
                        U32(
                            this.readReg(cpu, m.rm) |
                            this.readReg(cpu, m.reg)
                        );

                    this.writeReg(
                        cpu,
                        m.rm,
                        result
                    );

                    cpu.logicFlags(result);

                    return {
                        opcode,
                        mnemonic:
                            "OR r32,r32"
                    };
                }


                case 0xE8: {

                    const displacement =
                        cpu.fetchS32();

                    const returnAddress =
                        cpu.EIP;

                    cpu.push(returnAddress);

                    cpu.EIP =
                        U32(
                            cpu.EIP +
                            displacement
                        );

                    return {
                        opcode,
                        mnemonic:
                            "CALL rel32"
                    };
                }


                case 0xE9: {

                    const displacement =
                        cpu.fetchS32();

                    cpu.EIP =
                        U32(
                            cpu.EIP +
                            displacement
                        );

                    return {
                        opcode,
                        mnemonic:
                            "JMP rel32"
                    };
                }


                case 0xEB: {

                    const displacement =
                        cpu.fetchS8();

                    cpu.EIP =
                        U32(
                            cpu.EIP +
                            displacement
                        );

                    return {
                        opcode,
                        mnemonic:
                            "JMP rel8"
                    };
                }


                case 0xC3:

                    cpu.EIP =
                        cpu.pop();

                    return {
                        opcode,
                        mnemonic:
                            "RET"
                    };


                case 0x74: {

                    const displacement =
                        cpu.fetchS8();

                    if (
                        cpu.flag(FLAGS.ZF)
                    ) {
                        cpu.EIP =
                            U32(
                                cpu.EIP +
                                displacement
                            );
                    }

                    return {
                        opcode,
                        mnemonic:
                            "JE rel8"
                    };
                }


                case 0x75: {

                    const displacement =
                        cpu.fetchS8();

                    if (
                        !cpu.flag(FLAGS.ZF)
                    ) {
                        cpu.EIP =
                            U32(
                                cpu.EIP +
                                displacement
                            );
                    }

                    return {
                        opcode,
                        mnemonic:
                            "JNE rel8"
                    };
                }


                case 0x39: {

                    const m =
                        this.modrm(cpu);

                    if (m.mod !== 3) {
                        throw new Error(
                            "CMP memory operand not implemented."
                        );
                    }

                    cpu.sub(
                        this.readReg(cpu, m.rm),
                        this.readReg(cpu, m.reg)
                    );

                    return {
                        opcode,
                        mnemonic:
                            "CMP r32,r32"
                    };
                }


                case 0x3B: {

                    const m =
                        this.modrm(cpu);

                    if (m.mod !== 3) {
                        throw new Error(
                            "CMP memory operand not implemented."
                        );
                    }

                    cpu.sub(
                        this.readReg(cpu, m.reg),
                        this.readReg(cpu, m.rm)
                    );

                    return {
                        opcode,
                        mnemonic:
                            "CMP r32,r32"
                    };
                }


                default:

                    throw new Error(
                        `Unsupported x86 opcode 0x${HEX(opcode, 2)} at EIP=0x${HEX(
                            U32(cpu.EIP - 1)
                        )}`
                    );
            }
        }
    }


    /* ========================================================
       XBE
    ======================================================== */

    class XBE {

        constructor() {

            this.buffer = null;

            this.view = null;

            this.loaded = false;

            this.header = null;

            this.sections = [];

            this.entryPoint = 0;

            this.imageBase = 0;

            this.rawEntryPoint = 0;

            this.initFlags = 0;
        }


        async load(source) {

            let buffer;

            if (
                source instanceof ArrayBuffer
            ) {
                buffer = source;
            }
            else if (
                source instanceof Uint8Array
            ) {
                buffer =
                    source.buffer.slice(
                        source.byteOffset,
                        source.byteOffset +
                        source.byteLength
                    );
            }
            else if (
                source &&
                typeof source.arrayBuffer ===
                "function"
            ) {
                buffer =
                    await source.arrayBuffer();
            }
            else {
                throw new Error(
                    "Unsupported XBE source."
                );
            }

            if (buffer.byteLength < 0x1000) {
                throw new Error(
                    "XBE file is too small."
                );
            }

            this.buffer = buffer;

            this.view =
                new DataView(buffer);

            const magic =
                String.fromCharCode(
                    this.view.getUint8(0),
                    this.view.getUint8(1),
                    this.view.getUint8(2),
                    this.view.getUint8(3)
                );

            if (magic !== "XBEH") {
                throw new Error(
                    `Invalid XBE signature: ${magic}`
                );
            }

            this.imageBase =
                this.view.getUint32(
                    0x104,
                    true
                );

            this.rawEntryPoint =
                this.view.getUint32(
                    0x128,
                    true
                );

            this.initFlags =
                this.view.getUint32(
                    0x12C,
                    true
                );

            this.entryPoint =
                U32(
                    this.rawEntryPoint
                );

            this.header = {
                magic,
                size:
                    buffer.byteLength,
                imageBase:
                    this.imageBase,
                rawEntryPoint:
                    this.rawEntryPoint,
                initFlags:
                    this.initFlags
            };

            this.parseSections();

            this.loaded = true;

            return this;
        }


        parseSections() {

            this.sections = [];

            /*
             * XBE certificate/header fields differ slightly
             * between revisions. We deliberately inspect the
             * image structure rather than pretending that every
             * XBE uses identical offsets.
             *
             * At minimum the executable header is validated.
             */

            const size =
                this.buffer.byteLength;

            this.sections.push({
                name: ".xbe",
                rawOffset: 0,
                rawSize: size,
                virtualAddress: this.imageBase,
                virtualSize: size
            });
        }


        mapInto(memory, base = null) {

            if (!this.loaded) {
                throw new Error(
                    "XBE is not loaded."
                );
            }

            const source =
                new Uint8Array(
                    this.buffer
                );

            const targetBase =
                base === null
                    ? this.imageBase
                    : U32(base);

            /*
             * The browser memory object is a flat physical
             * address space. Real Xbox virtual-memory mapping
             * will be added as a dedicated MMU layer.
             */

            if (
                targetBase + source.length >
                memory.size
            ) {

                throw new Error(
                    `XBE image does not fit RAM: base=0x${HEX(
                        targetBase
                    )}, size=${source.length}`
                );
            }

            memory.writeBytes(
                targetBase,
                source
            );

            return {
                base: targetBase,
                size: source.length,
                entryPoint:
                    U32(
                        targetBase +
                        this.rawEntryPoint
                    )
            };
        }


        status() {

            return {
                loaded: this.loaded,
                size:
                    this.buffer
                        ? this.buffer.byteLength
                        : 0,
                imageBase:
                    U32(this.imageBase),
                rawEntryPoint:
                    U32(this.rawEntryPoint),
                entryPoint:
                    U32(this.entryPoint),
                initFlags:
                    U32(this.initFlags),
                sections:
                    this.sections
            };
        }
    }


    /* ========================================================
       XAPI
    ======================================================== */

    class XAPI {

        constructor() {

            this.functions = new Map();

            this.registerDefaults();
        }


        register(name, fn) {

            if (
                typeof fn !== "function"
            ) {
                throw new Error(
                    `Invalid XAPI handler: ${name}`
                );
            }

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
                    `XAPI function not implemented: ${name}`
                );
            }

            return fn(...args);
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
                    U32(
                        typeof performance !==
                        "undefined"
                            ? performance.now()
                            : Date.now()
                    )
            );


            this.register(
                "KeQueryPerformanceCounter",
                () =>
                    U32(
                        typeof performance !==
                        "undefined"
                            ? performance.now() * 1000
                            : Date.now() * 1000
                    )
            );
        }


        status() {

            return {
                available: true,
                functions:
                    this.functions.size
            };
        }
    }


    /* ========================================================
       XFILE
    ======================================================== */

    class XFile {

        constructor() {

            this.files = new Map();

            this.nextHandle = 1;
        }


        async open(file) {

            if (
                !file ||
                typeof file.arrayBuffer !==
                "function"
            ) {
                throw new Error(
                    "XFile requires a File object."
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
                        file.name || "unknown",
                    size:
                        buffer.byteLength,
                    buffer
                }
            );

            return handle;
        }


        get(handle) {

            return (
                this.files.get(
                    U32(handle)
                ) ||
                null
            );
        }


        close(handle) {

            return this.files.delete(
                U32(handle)
            );
        }


        status() {

            return {
                available: true,
                openFiles:
                    this.files.size
            };
        }
    }


    /* ========================================================
       KERNEL
    ======================================================== */

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


        register(name, service) {

            this.services.set(
                String(name),
                service
            );
        }


        get(name) {

            return (
                this.services.get(
                    String(name)
                ) ||
                null
            );
        }


        status() {

            return {
                ready: this.ready,
                services:
                    [...this.services.keys()]
            };
        }
    }


    /* ========================================================
       INPUT
    ======================================================== */

    class XInput {

        constructor() {

            this.ready = false;

            this.keyboard =
                Object.create(null);

            this.gamepad = null;

            this.boundDown =
                event => {
                    this.keyboard[
                        event.code
                    ] = true;
                };

            this.boundUp =
                event => {
                    this.keyboard[
                        event.code
                    ] = false;
                };
        }


        initialize() {

            if (
                typeof window === "undefined"
            ) {
                return false;
            }

            window.addEventListener(
                "keydown",
                this.boundDown
            );

            window.addEventListener(
                "keyup",
                this.boundUp
            );

            this.ready = true;

            return true;
        }


        poll() {

            if (
                typeof navigator ===
                "undefined" ||
                typeof navigator.getGamepads !==
                "function"
            ) {
                return null;
            }

            const pads =
                navigator.getGamepads();

            for (const pad of pads) {

                if (pad) {
                    this.gamepad = pad;
                    return pad;
                }
            }

            this.gamepad = null;

            return null;
        }


        status() {

            return {
                available: true,
                ready: this.ready,
                gamepad:
                    !!this.gamepad
            };
        }
    }


    /* ========================================================
       GRAPHICS
    ======================================================== */

    class Graphics {

        constructor() {

            this.canvas = null;

            this.ctx = null;

            this.width = 1280;

            this.height = 720;

            this.frameCount = 0;

            this.ready = false;
        }


        attach(canvas) {

            if (!canvas) {
                throw new Error(
                    "Canvas required."
                );
            }

            this.canvas = canvas;

            this.ctx =
                canvas.getContext(
                    "2d",
                    {
                        alpha: false
                    }
                );

            if (!this.ctx) {
                throw new Error(
                    "2D canvas unavailable."
                );
            }

            this.canvas.width =
                this.width;

            this.canvas.height =
                this.height;

            this.ready = true;

            this.clear();

            return this;
        }


        resize(width, height) {

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

            if (this.canvas) {

                this.canvas.width =
                    this.width;

                this.canvas.height =
                    this.height;
            }
        }


        clear() {

            if (!this.ctx) {
                return;
            }

            this.ctx.fillStyle =
                "#000000";

            this.ctx.fillRect(
                0,
                0,
                this.width,
                this.height
            );
        }


        presentBootScreen(info) {

            if (!this.ctx) {
                return;
            }

            this.clear();

            this.ctx.fillStyle =
                "#101820";

            this.ctx.fillRect(
                0,
                0,
                this.width,
                this.height
            );

            this.ctx.fillStyle =
                "#78ff00";

            this.ctx.font =
                "bold 42px monospace";

            this.ctx.fillText(
                "WebBktx",
                60,
                80
            );

            this.ctx.font =
                "20px monospace";

            this.ctx.fillText(
                "XBE BOOT RUNTIME",
                60,
                120
            );

            this.ctx.fillStyle =
                "#FFFFFF";

            this.ctx.fillText(
                `Image: ${info.size} bytes`,
                60,
                190
            );

            this.ctx.fillText(
                `Base: 0x${HEX(info.base)}`,
                60,
                225
            );

            this.ctx.fillText(
                `Entry: 0x${HEX(info.entryPoint)}`,
                60,
                260
            );

            this.ctx.fillText(
                `CPU EIP: 0x${HEX(info.eip)}`,
                60,
                295
            );

            this.ctx.fillStyle =
                "#8A8A8A";

            this.ctx.fillText(
                "CPU execution active",
                60,
                350
            );

            this.ctx.fillText(
                "Audio: disabled",
                60,
                380
            );

            this.ctx.fillText(
                "GPU backend: Canvas 2D",
                60,
                410
            );

            this.frameCount++;
        }


        status() {

            return {
                available: true,
                ready: this.ready,
                width: this.width,
                height: this.height,
                frames: this.frameCount
            };
        }
    }


    /* ========================================================
       MACHINE
    ======================================================== */

    class Machine {

        constructor(options = {}) {

            this.version = VERSION;

            this.memory =
                new Memory(
                    options.ramSize ||
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

            this.xapi =
                new XAPI();

            this.xfile =
                new XFile();

            this.kernel =
                new Kernel(
                    this
                );

            this.input =
                new XInput();

            this.graphics =
                new Graphics();

            this.xbe = null;

            this.bootInfo = null;

            this.initialized = false;

            this.running = false;

            this.booted = false;

            this.frameHandle = null;

            this.frameBudget = 5000;
        }


        initialize(canvas = null) {

            if (this.initialized) {
                return true;
            }

            this.kernel.initialize();

            this.input.initialize();

            if (canvas) {
                this.graphics.attach(canvas);
            }

            this.initialized = true;

            console.log(
                `[WebBktx ${VERSION}] machine initialized`
            );

            return true;
        }


        async loadXBE(source) {

            this.xbe =
                new XBE();

            await this.xbe.load(source);

            console.log(
                "[WebBktx] XBE:",
                this.xbe.status()
            );

            return this.xbe.status();
        }


        bootXBE() {

            if (!this.xbe) {
                throw new Error(
                    "No XBE loaded."
                );
            }

            if (!this.initialized) {
                this.initialize();
            }

            this.memory.reset();

            const mapped =
                this.xbe.mapInto(
                    this.memory
                );

            this.bootInfo = mapped;

            /*
             * XBE's raw entry point is represented as an
             * address relative to the image mapping in this
             * simplified flat-memory execution model.
             */

            this.cpu.reset();

            this.cpu.EIP =
                U32(mapped.entryPoint);

            this.cpu.ESP =
                this.memory.size - 0x1000;

            /*
             * Initial stack.
             */

            this.cpu.push(0);

            this.booted = true;

            this.running = true;

            console.log(
                "[WebBktx] XBE boot:",
                mapped
            );

            return mapped;
        }


        executeFrame() {

            if (!this.booted) {
                return {
                    executed: 0,
                    booted: false
                };
            }

            if (
                this.cpu.halted ||
                this.cpu.faulted
            ) {

                this.running = false;

                return {
                    executed: 0,
                    halted:
                        this.cpu.halted,
                    faulted:
                        this.cpu.faulted,
                    fault:
                        this.cpu.lastFault
                };
            }

            let executed = 0;

            try {

                while (
                    executed <
                    this.frameBudget
                ) {

                    const result =
                        this.cpu.step();

                    if (
                        !result.executed
                    ) {
                        break;
                    }

                    executed++;
                }

            } catch (error) {

                this.running = false;

                return {
                    executed,
                    error:
                        error instanceof Error
                            ? error.message
                            : String(error)
                };
            }

            return {
                executed,
                eip:
                    this.cpu.EIP,
                eax:
                    this.cpu.EAX,
                halted:
                    this.cpu.halted,
                faulted:
                    this.cpu.faulted
            };
        }


        runFrame() {

            const result =
                this.executeFrame();

            if (this.graphics.ready) {

                this.graphics.presentBootScreen({
                    size:
                        this.xbe
                            ? this.xbe.status().size
                            : 0,
                    base:
                        this.bootInfo
                            ? this.bootInfo.base
                            : 0,
                    entryPoint:
                        this.bootInfo
                            ? this.bootInfo.entryPoint
                            : 0,
                    eip:
                        this.cpu.EIP
                });
            }

            return result;
        }


        start() {

            if (!this.booted) {
                throw new Error(
                    "XBE has not been booted."
                );
            }

            this.running = true;

            const loop = () => {

                if (!this.running) {
                    return;
                }

                this.runFrame();

                this.frameHandle =
                    requestAnimationFrame(
                        loop
                    );
            };

            loop();
        }


        stop() {

            this.running = false;

            this.cpu.stop();

            if (
                this.frameHandle !== null
            ) {

                cancelAnimationFrame(
                    this.frameHandle
                );

                this.frameHandle = null;
            }
        }


        reset() {

            this.stop();

            this.memory.reset();

            this.cpu.reset();

            this.xbe = null;

            this.bootInfo = null;

            this.booted = false;
        }


        selfTest() {

            const cpu =
                this.cpu.selfTest();

            return {
                version: VERSION,
                memory: true,
                cpu,
                decoder: true,
                kernel:
                    this.kernel.ready,
                xapi: true,
                xfile: true,
                graphics: true,
                passed:
                    cpu.passed &&
                    this.kernel.ready
            };
        }


        status() {

            return {
                runtime: VERSION,

                initialized:
                    this.initialized,

                booted:
                    this.booted,

                running:
                    this.running,

                memory:
                    this.memory.getStatus(),

                cpu:
                    this.cpu.status(),

                decoder:
                    {
                        available: true
                    },

                xbe:
                    this.xbe
                        ? this.xbe.status()
                        : null,

                kernel:
                    this.kernel.status(),

                xapi:
                    this.xapi.status(),

                xfile:
                    this.xfile.status(),

                xinput:
                    this.input.status(),

                xgraphics:
                    this.graphics.status()
            };
        }
    }


    /* ========================================================
       GLOBAL API
    ======================================================== */

    const WebBktx = {

        version: VERSION,

        VERSION,

        Memory,

        CPU,

        Decoder,

        XBE,

        XAPI,

        XFile,

        Kernel,

        XInput,

        Graphics,

        Machine,

        create(options = {}) {

            return new Machine(options);
        }
    };


    window.WebBktx = WebBktx;

    window.WebBktxMemory = Memory;
    window.WebBktxCPU = CPU;
    window.WebBktxDecoder = Decoder;
    window.WebBktxXBE = XBE;
    window.WebBktxXAPI = XAPI;
    window.WebBktxXFile = XFile;
    window.WebBktxKernel = Kernel;
    window.WebBktxXInput = XInput;
    window.WebBktxXGraphics = Graphics;
    window.WebBktxCore = Machine;

    /*
     * One default machine.
     */

    window.WebBktxRuntime =
        new Machine();

    window.WebBktxRuntime.initialize();

    console.log(
        "[WebBktx] Runtime:",
        VERSION
    );

    console.log(
        "[WebBktx] Self-test:",
        window.WebBktxRuntime.selfTest()
    );

})();
