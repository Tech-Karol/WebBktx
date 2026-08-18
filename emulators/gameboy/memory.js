/*
 * ============================================================
 * WebBktx — Game Boy DMG Memory Bus
 * memory.js
 * ============================================================
 *
 * Memory map:
 *
 * 0000-7FFF   Cartridge ROM
 * 8000-9FFF   VRAM
 * A000-BFFF   Cartridge RAM
 * C000-CFFF   WRAM
 * D000-DFFF   WRAM
 * E000-FDFF   Echo RAM
 * FE00-FE9F   OAM
 * FEA0-FEFF   Unusable
 * FF00-FF7F   I/O
 * FF80-FFFE   HRAM
 * FFFF        Interrupt Enable
 *
 * Compatible with:
 *
 *   CPU
 *   PPU
 *   Timer
 *   Input
 *   Audio
 *   Cartridge
 *   emulator.js
 *
 * ============================================================
 */

export default class GameBoyMemory {

    constructor() {

        /*
         * ----------------------------------------------------
         * RAM
         * ----------------------------------------------------
         */

        this.wram = new Uint8Array(0x2000);

        this.hram = new Uint8Array(0x7F);

        this.vram = new Uint8Array(0x2000);

        this.oam = new Uint8Array(0xA0);


        /*
         * ----------------------------------------------------
         * Cartridge
         * ----------------------------------------------------
         */

        this.cartridge = null;


        /*
         * ----------------------------------------------------
         * Connected hardware
         * ----------------------------------------------------
         */

        this.ppu = null;
        this.timer = null;
        this.input = null;
        this.audio = null;
        this.cpu = null;


        /*
         * ----------------------------------------------------
         * Generic I/O
         * ----------------------------------------------------
         */

        this.io = new Uint8Array(0x80);


        /*
         * ----------------------------------------------------
         * Interrupt registers
         * ----------------------------------------------------
         */

        this.interruptEnable = 0x00;

        /*
         * DMG unused upper bits normally read as 1.
         */
        this.interruptFlags = 0xE1;


        /*
         * ----------------------------------------------------
         * Joypad
         * ----------------------------------------------------
         */

        this.joyp = 0xCF;


        /*
         * ----------------------------------------------------
         * Serial
         * ----------------------------------------------------
         */

        this.serialData = 0x00;
        this.serialControl = 0x00;


        /*
         * ----------------------------------------------------
         * Boot ROM
         * ----------------------------------------------------
         */

        this.bootRom = null;
        this.bootRomEnabled = false;


        /*
         * ----------------------------------------------------
         * Debug
         * ----------------------------------------------------
         */

        this.lastRead = 0;
        this.lastWrite = 0;


        /*
         * ----------------------------------------------------
         * Hardware defaults
         * ----------------------------------------------------
         */

        this.setDefaultRegisters();

    }


    /*
     * ========================================================
     * DEFAULT REGISTERS
     * ========================================================
     */

    setDefaultRegisters() {

        this.io.fill(0);


        /*
         * DIV
         */
        this.io[0x04] = 0x00;


        /*
         * TIMA
         */
        this.io[0x05] = 0x00;

        /*
         * TMA
         */
        this.io[0x06] = 0x00;

        /*
         * TAC
         */
        this.io[0x07] = 0x00;


        /*
         * Sound defaults
         */

        this.io[0x10] = 0x80;
        this.io[0x11] = 0xBF;
        this.io[0x12] = 0xF3;
        this.io[0x14] = 0xBF;

        this.io[0x16] = 0x3F;
        this.io[0x17] = 0x00;
        this.io[0x19] = 0xBF;

        this.io[0x1A] = 0x7F;
        this.io[0x1B] = 0xFF;
        this.io[0x1C] = 0x9F;
        this.io[0x1E] = 0xBF;

        this.io[0x20] = 0xFF;
        this.io[0x21] = 0x00;
        this.io[0x22] = 0x00;
        this.io[0x23] = 0xBF;

        this.io[0x24] = 0x77;
        this.io[0x25] = 0xF3;
        this.io[0x26] = 0xF1;


        /*
         * LCD
         */

        this.io[0x40] = 0x91; // LCDC
        this.io[0x41] = 0x85; // STAT
        this.io[0x42] = 0x00; // SCY
        this.io[0x43] = 0x00; // SCX
        this.io[0x44] = 0x00; // LY
        this.io[0x45] = 0x00; // LYC

        this.io[0x47] = 0xFC; // BGP
        this.io[0x48] = 0xFF; // OBP0
        this.io[0x49] = 0xFF; // OBP1

        this.io[0x4A] = 0x00; // WY
        this.io[0x4B] = 0x00; // WX


        /*
         * KEY1 / VBK / etc.
         */

        this.io[0x4D] = 0x00;
        this.io[0x4F] = 0x00;


        /*
         * Boot ROM disable register.
         */

        this.io[0x50] = 0x00;

    }


    /*
     * ========================================================
     * CONNECT CPU
     * ========================================================
     */

    connectCPU(cpu) {

        this.cpu = cpu;

    }


    /*
     * ========================================================
     * CONNECT CARTRIDGE
     * ========================================================
     */

    connectCartridge(cartridge) {

        this.cartridge = cartridge;

    }


    /*
     * ========================================================
     * CONNECT PPU
     * ========================================================
     */

    connectPPU(ppu) {

        this.ppu = ppu;

        if (!ppu) {
            return;
        }


        /*
         * Share VRAM.
         */

        ppu.vram = this.vram;

        ppu.oam = this.oam;


        /*
         * PPU interrupt callback.
         */

        if (
            typeof ppu.setInterruptCallback ===
            "function"
        ) {

            ppu.setInterruptCallback(
                bit => {

                    this.requestInterrupt(bit);

                }
            );

        }

    }


    /*
     * ========================================================
     * CONNECT TIMER
     * ========================================================
     */

    connectTimer(timer) {

        this.timer = timer;

        if (!timer) {
            return;
        }


        if (
            typeof timer.setInterruptCallback ===
            "function"
        ) {

            timer.setInterruptCallback(
                () => {

                    this.requestInterrupt(2);

                }
            );

        }

    }


    /*
     * ========================================================
     * CONNECT INPUT
     * ========================================================
     */

    connectInput(input) {

        this.input = input;

        if (!input) {
            return;
        }


        if (
            typeof input.setInterruptCallback ===
            "function"
        ) {

            input.setInterruptCallback(
                () => {

                    this.requestInterrupt(4);

                }
            );

        }

    }


    /*
     * ========================================================
     * CONNECT AUDIO
     * ========================================================
     */

    connectAudio(audio) {

        this.audio = audio;

    }


    /*
     * ========================================================
     * BOOT ROM
     * ========================================================
     */

    setBootRom(data) {

        if (!data) {

            this.bootRom = null;
            this.bootRomEnabled = false;

            return;
        }


        this.bootRom =
            data instanceof Uint8Array
                ? data
                : new Uint8Array(data);


        this.bootRomEnabled = true;

    }


    disableBootRom() {

        this.bootRomEnabled = false;

        this.io[0x50] = 0x01;

    }


    /*
     * ========================================================
     * RESET
     * ========================================================
     */

    reset() {

        this.wram.fill(0);

        this.hram.fill(0);

        this.vram.fill(0);

        this.oam.fill(0);


        this.interruptEnable = 0x00;

        this.interruptFlags = 0xE1;


        this.joyp = 0xCF;


        this.serialData = 0x00;

        this.serialControl = 0x00;


        this.lastRead = 0;

        this.lastWrite = 0;


        this.setDefaultRegisters();

    }


    /*
     * ========================================================
     * READ 8
     * ========================================================
     *
     * Main API.
     *
     * PPU and CPU can use:
     *
     *   memory.read8(address)
     *
     * ========================================================
     */

    read8(address) {

        return this.readByte(address);

    }


    /*
     * ========================================================
     * WRITE 8
     * ========================================================
     */

    write8(address, value) {

        this.writeByte(address, value);

    }


    /*
     * ========================================================
     * READ BYTE
     * ========================================================
     */

    readByte(address) {

        address &= 0xFFFF;


        let value = 0xFF;


        /*
         * ----------------------------------------------------
         * Boot ROM
         * ----------------------------------------------------
         */

        if (
            this.bootRomEnabled &&
            this.bootRom &&
            address < this.bootRom.length
        ) {

            value = this.bootRom[address];

            this.lastRead = value;

            return value;

        }


        /*
         * ----------------------------------------------------
         * Cartridge ROM
         * ----------------------------------------------------
         */

        if (address <= 0x7FFF) {

            value =
                this.readCartridgeROM(address);

        }


        /*
         * ----------------------------------------------------
         * VRAM
         * ----------------------------------------------------
         */

        else if (
            address >= 0x8000 &&
            address <= 0x9FFF
        ) {

            if (this.isVRAMBlocked()) {

                value = 0xFF;

            } else {

                value =
                    this.vram[
                        address - 0x8000
                    ];

            }

        }


        /*
         * ----------------------------------------------------
         * Cartridge RAM
         * ----------------------------------------------------
         */

        else if (
            address >= 0xA000 &&
            address <= 0xBFFF
        ) {

            value =
                this.readCartridgeRAM(address);

        }


        /*
         * ----------------------------------------------------
         * WRAM
         * ----------------------------------------------------
         */

        else if (
            address >= 0xC000 &&
            address <= 0xDFFF
        ) {

            value =
                this.wram[
                    address - 0xC000
                ];

        }


        /*
         * ----------------------------------------------------
         * Echo RAM
         * ----------------------------------------------------
         *
         * E000-FDFF mirrors C000-DDFF.
         *
         * ----------------------------------------------------
         */

        else if (
            address >= 0xE000 &&
            address <= 0xFDFF
        ) {

            value =
                this.wram[
                    address - 0xE000
                ];

        }


        /*
         * ----------------------------------------------------
         * OAM
         * ----------------------------------------------------
         */

        else if (
            address >= 0xFE00 &&
            address <= 0xFE9F
        ) {

            if (this.isOAMBlocked()) {

                value = 0xFF;

            } else {

                value =
                    this.oam[
                        address - 0xFE00
                    ];

            }

        }


        /*
         * ----------------------------------------------------
         * Unusable
         * ----------------------------------------------------
         */

        else if (
            address >= 0xFEA0 &&
            address <= 0xFEFF
        ) {

            value = 0xFF;

        }


        /*
         * ----------------------------------------------------
         * I/O
         * ----------------------------------------------------
         */

        else if (
            address >= 0xFF00 &&
            address <= 0xFF7F
        ) {

            value =
                this.readIO(address);

        }


        /*
         * ----------------------------------------------------
         * HRAM
         * ----------------------------------------------------
         */

        else if (
            address >= 0xFF80 &&
            address <= 0xFFFE
        ) {

            value =
                this.hram[
                    address - 0xFF80
                ];

        }


        /*
         * ----------------------------------------------------
         * IE
         * ----------------------------------------------------
         */

        else if (address === 0xFFFF) {

            value =
                this.interruptEnable;

        }


        this.lastRead =
            value & 0xFF;


        return value & 0xFF;

    }


    /*
     * ========================================================
     * READ WORD
     * ========================================================
     */

    read16(address) {

        const low =
            this.readByte(address);

        const high =
            this.readByte(
                (address + 1) & 0xFFFF
            );


        return (
            low |
            (high << 8)
        );

    }


    /*
     * Compatibility alias.
     */

    readWord(address) {

        return this.read16(address);

    }


    /*
     * ========================================================
     * WRITE BYTE
     * ========================================================
     */

    writeByte(address, value) {

        address &= 0xFFFF;

        value &= 0xFF;


        this.lastWrite = value;


        /*
         * ----------------------------------------------------
         * Cartridge ROM / MBC
         * ----------------------------------------------------
         */

        if (address <= 0x7FFF) {

            this.writeCartridge(
                address,
                value
            );

            return;

        }


        /*
         * ----------------------------------------------------
         * VRAM
         * ----------------------------------------------------
         */

        if (
            address >= 0x8000 &&
            address <= 0x9FFF
        ) {

            if (!this.isVRAMBlocked()) {

                this.vram[
                    address - 0x8000
                ] = value;

            }

            return;

        }


        /*
         * ----------------------------------------------------
         * Cartridge RAM
         * ----------------------------------------------------
         */

        if (
            address >= 0xA000 &&
            address <= 0xBFFF
        ) {

            this.writeCartridgeRAM(
                address,
                value
            );

            return;

        }


        /*
         * ----------------------------------------------------
         * WRAM
         * ----------------------------------------------------
         */

        if (
            address >= 0xC000 &&
            address <= 0xDFFF
        ) {

            this.wram[
                address - 0xC000
            ] = value;

            return;

        }


        /*
         * ----------------------------------------------------
         * Echo RAM
         * ----------------------------------------------------
         */

        if (
            address >= 0xE000 &&
            address <= 0xFDFF
        ) {

            this.wram[
                address - 0xE000
            ] = value;

            return;

        }


        /*
         * ----------------------------------------------------
         * OAM
         * ----------------------------------------------------
         */

        if (
            address >= 0xFE00 &&
            address <= 0xFE9F
        ) {

            if (!this.isOAMBlocked()) {

                this.oam[
                    address - 0xFE00
                ] = value;

            }

            return;

        }


        /*
         * ----------------------------------------------------
         * Unusable
         * ----------------------------------------------------
         */

        if (
            address >= 0xFEA0 &&
            address <= 0xFEFF
        ) {

            return;

        }


        /*
         * ----------------------------------------------------
         * I/O
         * ----------------------------------------------------
         */

        if (
            address >= 0xFF00 &&
            address <= 0xFF7F
        ) {

            this.writeIO(
                address,
                value
            );

            return;

        }


        /*
         * ----------------------------------------------------
         * HRAM
         * ----------------------------------------------------
         */

        if (
            address >= 0xFF80 &&
            address <= 0xFFFE
        ) {

            this.hram[
                address - 0xFF80
            ] = value;

            return;

        }


        /*
         * ----------------------------------------------------
         * IE
         * ----------------------------------------------------
         */

        if (address === 0xFFFF) {

            this.interruptEnable =
                value & 0x1F;

        }

    }


    /*
     * ========================================================
     * WRITE 16
     * ========================================================
     */

    write16(address, value) {

        this.writeByte(
            address,
            value & 0xFF
        );

        this.writeByte(
            (address + 1) & 0xFFFF,
            (value >> 8) & 0xFF
        );

    }


    /*
     * Compatibility alias.
     */

    writeWord(address, value) {

        this.write16(address, value);

    }


    /*
     * ========================================================
     * CARTRIDGE ROM
     * ========================================================
     */

    readCartridgeROM(address) {

        if (!this.cartridge) {
            return 0xFF;
        }


        if (
            typeof this.cartridge.read ===
            "function"
        ) {

            return (
                this.cartridge.read(address) &
                0xFF
            );

        }


        if (
            typeof this.cartridge.readROM ===
            "function"
        ) {

            return (
                this.cartridge.readROM(address) &
                0xFF
            );

        }


        if (this.cartridge.rom) {

            return (
                this.cartridge.rom[address] ??
                0xFF
            );

        }


        return 0xFF;

    }


    /*
     * ========================================================
     * CARTRIDGE RAM
     * ========================================================
     */

    readCartridgeRAM(address) {

        if (!this.cartridge) {
            return 0xFF;
        }


        if (
            typeof this.cartridge.readRAM ===
            "function"
        ) {

            return (
                this.cartridge.readRAM(address) &
                0xFF
            );

        }


        /*
         * Some cartridge implementations expose
         * all memory through read().
         */

        if (
            typeof this.cartridge.read ===
            "function"
        ) {

            return (
                this.cartridge.read(address) &
                0xFF
            );

        }


        return 0xFF;

    }


    /*
     * ========================================================
     * CARTRIDGE WRITE
     * ========================================================
     */

    writeCartridge(address, value) {

        if (!this.cartridge) {
            return;
        }


        if (
            typeof this.cartridge.write ===
            "function"
        ) {

            this.cartridge.write(
                address,
                value
            );

            return;

        }


        if (
            typeof this.cartridge.writeROM ===
            "function"
        ) {

            this.cartridge.writeROM(
                address,
                value
            );

        }

    }


    /*
     * ========================================================
     * CARTRIDGE RAM WRITE
     * ========================================================
     */

    writeCartridgeRAM(address, value) {

        if (!this.cartridge) {
            return;
        }


        if (
            typeof this.cartridge.writeRAM ===
            "function"
        ) {

            this.cartridge.writeRAM(
                address,
                value
            );

            return;

        }


        if (
            typeof this.cartridge.write ===
            "function"
        ) {

            this.cartridge.write(
                address,
                value
            );

        }

    }


    /*
     * ========================================================
     * I/O READ
     * ========================================================
     */

    readIO(address) {

        const reg =
            address - 0xFF00;


        /*
         * ----------------------------------------------------
         * Joypad
         * ----------------------------------------------------
         */

        if (address === 0xFF00) {

            return this.readJoypad();

        }


        /*
         * ----------------------------------------------------
         * Serial
         * ----------------------------------------------------
         */

        if (address === 0xFF01) {

            return this.serialData;

        }


        if (address === 0xFF02) {

            return this.serialControl;

        }


        /*
         * ----------------------------------------------------
         * Timer
         * ----------------------------------------------------
         */

        if (
            address >= 0xFF04 &&
            address <= 0xFF07
        ) {

            if (
                this.timer &&
                typeof this.timer.readRegister ===
                "function"
            ) {

                return (
                    this.timer.readRegister(address) &
                    0xFF
                );

            }

        }


        /*
         * ----------------------------------------------------
         * IF
         * ----------------------------------------------------
         */

        if (address === 0xFF0F) {

            return (
                this.interruptFlags |
                0xE0
            );

        }


        /*
         * ----------------------------------------------------
         * Audio
         * ----------------------------------------------------
         */

        if (
            address >= 0xFF10 &&
            address <= 0xFF3F
        ) {

            if (
                this.audio &&
                typeof this.audio.readRegister ===
                "function"
            ) {

                return (
                    this.audio.readRegister(address) &
                    0xFF
                );

            }

        }


        /*
         * ----------------------------------------------------
         * PPU
         * ----------------------------------------------------
         */

        if (
            address >= 0xFF40 &&
            address <= 0xFF4B
        ) {

            if (
                this.ppu &&
                typeof this.ppu.readRegister ===
                "function"
            ) {

                return (
                    this.ppu.readRegister(address) &
                    0xFF
                );

            }

        }


        /*
         * ----------------------------------------------------
         * Default
         * ----------------------------------------------------
         */

        return (
            this.io[reg] ??
            0xFF
        );

    }


    /*
     * ========================================================
     * I/O WRITE
     * ========================================================
     */

    writeIO(address, value) {

        const reg =
            address - 0xFF00;


        value &= 0xFF;


        /*
         * ----------------------------------------------------
         * JOYP
         * ----------------------------------------------------
         */

        if (address === 0xFF00) {

            /*
             * Bits 4-5 are writable.
             * Upper bits read high.
             */

            this.joyp =
                (
                    value & 0x30
                ) |
                0xC0;

            this.updateJoypad();

            return;

        }


        /*
         * ----------------------------------------------------
         * Serial
         * ----------------------------------------------------
         */

        if (address === 0xFF01) {

            this.serialData = value;

            this.io[0x01] = value;

            return;

        }


        if (address === 0xFF02) {

            this.serialControl = value;

            this.io[0x02] = value;

            return;

        }


        /*
         * ----------------------------------------------------
         * DIV
         * ----------------------------------------------------
         *
         * Writing anything resets DIV.
         *
         * ----------------------------------------------------
         */

        if (address === 0xFF04) {

            if (
                this.timer &&
                typeof this.timer.writeRegister ===
                "function"
            ) {

                this.timer.writeRegister(
                    address,
                    value
                );

            } else {

                this.io[0x04] = 0;

            }

            return;

        }


        /*
         * ----------------------------------------------------
         * Timer
         * ----------------------------------------------------
         */

        if (
            address >= 0xFF05 &&
            address <= 0xFF07
        ) {

            if (
                this.timer &&
                typeof this.timer.writeRegister ===
                "function"
            ) {

                this.timer.writeRegister(
                    address,
                    value
                );

            } else {

                this.io[reg] = value;

            }

            return;

        }


        /*
         * ----------------------------------------------------
         * IF
         * ----------------------------------------------------
         */

        if (address === 0xFF0F) {

            this.interruptFlags =
                (
                    value & 0x1F
                ) |
                0xE0;

            return;

        }


        /*
         * ----------------------------------------------------
         * Audio
         * ----------------------------------------------------
         */

        if (
            address >= 0xFF10 &&
            address <= 0xFF3F
        ) {

            if (
                this.audio &&
                typeof this.audio.writeRegister ===
                "function"
            ) {

                this.audio.writeRegister(
                    address,
                    value
                );

            }

            this.io[reg] = value;

            return;

        }


        /*
         * ----------------------------------------------------
         * DMA
         * ----------------------------------------------------
         *
         * FF46 MUST be handled before the generic
         * PPU FF40-FF4B range.
         *
         * ----------------------------------------------------
         */

        if (address === 0xFF46) {

            this.io[0x46] = value;

            this.doDMA(value);

            return;

        }


        /*
         * ----------------------------------------------------
         * PPU
         * ----------------------------------------------------
         */

        if (
            address >= 0xFF40 &&
            address <= 0xFF4B
        ) {

            /*
             * LY is read-only on DMG.
             */

            if (address === 0xFF44) {

                /*
                 * Writing LY has no useful effect.
                 */

                return;

            }


            if (
                this.ppu &&
                typeof this.ppu.writeRegister ===
                "function"
            ) {

                this.ppu.writeRegister(
                    address,
                    value
                );

            }


            this.io[reg] = value;

            return;

        }


        /*
         * ----------------------------------------------------
         * Boot ROM disable
         * ----------------------------------------------------
         */

        if (address === 0xFF50) {

            this.io[0x50] = value;

            if (value !== 0) {

                this.bootRomEnabled = false;

            }

            return;

        }


        /*
         * ----------------------------------------------------
         * Generic register
         * ----------------------------------------------------
         */

        this.io[reg] = value;

    }


    /*
     * ========================================================
     * DMA
     * ========================================================
     *
     * FF46 = XX
     *
     * XX00 -> FE00
     * XX01 -> FE01
     * ...
     * XX9F -> FE9F
     *
     * ========================================================
     */

    doDMA(value) {

        const source =
            (
                value &
                0xFF
            ) << 8;


        /*
         * DMA should read from the normal
         * memory bus.
         */

        for (
            let i = 0;
            i < 0xA0;
            i++
        ) {

            const sourceAddress =
                (
                    source +
                    i
                ) & 0xFFFF;


            let byte;


            /*
             * Avoid OAM access restrictions while
             * performing DMA.
             */

            if (
                sourceAddress >= 0xFE00 &&
                sourceAddress <= 0xFE9F
            ) {

                byte =
                    this.oam[
                        sourceAddress - 0xFE00
                    ];

            } else {

                byte =
                    this.readByte(
                        sourceAddress
                    );

            }


            this.oam[i] =
                byte;

        }

    }


    /*
     * ========================================================
     * JOYPAD
     * ========================================================
     */

    readJoypad() {

        let result =
            this.joyp |
            0xC0;


        const selectDirections =
            (
                this.joyp &
                0x10
            ) === 0;


        const selectButtons =
            (
                this.joyp &
                0x20
            ) === 0;


        if (
            this.input &&
            typeof this.input.getState ===
            "function"
        ) {

            const state =
                this.input.getState();


            /*
             * Directions
             */

            if (selectDirections) {

                if (state.right) {
                    result &= ~0x01;
                }

                if (state.left) {
                    result &= ~0x02;
                }

                if (state.up) {
                    result &= ~0x04;
                }

                if (state.down) {
                    result &= ~0x08;
                }

            }


            /*
             * Buttons
             */

            if (selectButtons) {

                if (state.a) {
                    result &= ~0x01;
                }

                if (state.b) {
                    result &= ~0x02;
                }

                if (state.select) {
                    result &= ~0x04;
                }

                if (state.start) {
                    result &= ~0x08;
                }

            }

        }


        return result & 0xFF;

    }


    /*
     * ========================================================
     * UPDATE JOYPAD
     * ========================================================
     */

    updateJoypad() {

        const previous =
            this.joyp;


        const current =
            this.readJoypad();


        this.joyp =
            current;


        /*
         * Detect button press transition.
         */

        const changed =
            (
                previous &
                0x0F
            ) &
            ~(
                current &
                0x0F
            );


        if (changed) {

            this.requestInterrupt(4);

        }

    }


    /*
     * ========================================================
     * INTERRUPTS
     * ========================================================
     */

    requestInterrupt(bit) {

        bit &= 7;


        this.interruptFlags |=
            (
                1 << bit
            );


        this.interruptFlags |=
            0xE0;

    }


    /*
     * ========================================================
     * PENDING INTERRUPTS
     * ========================================================
     */

    getPendingInterrupts() {

        return (
            this.interruptEnable &
            this.interruptFlags &
            0x1F
        );

    }


    /*
     * ========================================================
     * CLEAR INTERRUPT
     * ========================================================
     */

    clearInterrupt(bit) {

        this.interruptFlags &=
            ~(
                1 << bit
            );


        this.interruptFlags |= 0xE0;

    }


    /*
     * ========================================================
     * INTERRUPT HELPERS
     * ========================================================
     */

    isInterruptPending(bit) {

        return (
            (
                this.getPendingInterrupts() &
                (
                    1 << bit
                )
            ) !== 0
        );

    }


    /*
     * ========================================================
     * VRAM BLOCK
     * ========================================================
     */

    isVRAMBlocked() {

        if (!this.ppu) {
            return false;
        }


        return (
            this.ppu.mode === 3 &&
            this.ppu.lcdEnabled !== false
        );

    }


    /*
     * ========================================================
     * OAM BLOCK
     * ========================================================
     */

    isOAMBlocked() {

        if (!this.ppu) {
            return false;
        }


        return (
            this.ppu.mode === 2 ||
            this.ppu.mode === 3
        );

    }


    /*
     * ========================================================
     * DIRECT VRAM ACCESS
     * ========================================================
     *
     * Used by PPU/debugging.
     * Ignores CPU access restrictions.
     *
     * ========================================================
     */

    readVRAM(address) {

        address &= 0x1FFF;

        return this.vram[address];

    }


    writeVRAM(address, value) {

        address &= 0x1FFF;

        this.vram[address] =
            value & 0xFF;

    }


    /*
     * ========================================================
     * DIRECT OAM ACCESS
     * ========================================================
     */

    readOAM(address) {

        address &= 0x9F;

        return this.oam[address];

    }


    writeOAM(address, value) {

        address &= 0x9F;

        this.oam[address] =
            value & 0xFF;

    }


    /*
     * ========================================================
     * MEMORY DUMP
     * ========================================================
     */

    dump(start, end) {

        start &= 0xFFFF;
        end &= 0xFFFF;


        if (end < start) {

            return new Uint8Array(0);

        }


        const result =
            new Uint8Array(
                end - start + 1
            );


        for (
            let i = 0;
            i < result.length;
            i++
        ) {

            result[i] =
                this.readByte(
                    start + i
                );

        }


        return result;

    }


    /*
     * ========================================================
     * GET STATE
     * ========================================================
     */

    getState() {

        return {

            interruptEnable:
                this.interruptEnable,

            interruptFlags:
                this.interruptFlags,

            pendingInterrupts:
                this.getPendingInterrupts(),

            joyp:
                this.joyp,

            serialData:
                this.serialData,

            serialControl:
                this.serialControl,

            bootRomEnabled:
                this.bootRomEnabled,

            hasCartridge:
                Boolean(this.cartridge),

            hasPPU:
                Boolean(this.ppu),

            hasTimer:
                Boolean(this.timer),

            hasInput:
                Boolean(this.input),

            hasAudio:
                Boolean(this.audio),

            lastRead:
                this.lastRead,

            lastWrite:
                this.lastWrite

        };

    }


    /*
     * ========================================================
     * DEBUG
     * ========================================================
     */

    peek(address) {

        return this.readByte(address);

    }


    poke(address, value) {

        this.writeByte(
            address,
            value
        );

    }

}
