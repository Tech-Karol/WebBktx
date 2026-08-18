/*
 * ============================================================
 * WebBktx — Game Boy Memory Bus
 * ============================================================
 *
 * Game Boy DMG memory map
 *
 * 0000-7FFF   Cartridge ROM
 * 8000-9FFF   VRAM
 * A000-BFFF   Cartridge RAM
 * C000-CFFF   Work RAM
 * D000-DFFF   Work RAM
 * E000-FDFF   Echo RAM
 * FE00-FE9F   OAM
 * FEA0-FEFF   Unusable
 * FF00-FF7F   I/O
 * FF80-FFFE   HRAM
 * FFFF        Interrupt Enable
 *
 * ============================================================
 */

export default class GameBoyMemory {

    constructor() {

        /*
         * ----------------------------------------------------
         * WRAM
         * ----------------------------------------------------
         */

        this.wram = new Uint8Array(0x2000);

        /*
         * C000-DFFF
         *
         * 8 KB total
         */


        /*
         * ----------------------------------------------------
         * HRAM
         * ----------------------------------------------------
         */

        this.hram = new Uint8Array(0x7F);


        /*
         * ----------------------------------------------------
         * VRAM
         * ----------------------------------------------------
         *
         * 8000-9FFF
         *
         * 8 KB DMG VRAM
         */

        this.vram = new Uint8Array(0x2000);


        /*
         * ----------------------------------------------------
         * OAM
         * ----------------------------------------------------
         *
         * FE00-FE9F
         *
         * 160 bytes
         */

        this.oam = new Uint8Array(0xA0);


        /*
         * ----------------------------------------------------
         * Cartridge
         * ----------------------------------------------------
         */

        this.cartridge = null;


        /*
         * ----------------------------------------------------
         * Hardware devices
         * ----------------------------------------------------
         */

        this.ppu = null;
        this.timer = null;
        this.input = null;
        this.audio = null;


        /*
         * ----------------------------------------------------
         * Interrupt registers
         * ----------------------------------------------------
         *
         * IF = FF0F
         * IE = FFFF
         */

        this.interruptEnable = 0x00;

        this.interruptFlags = 0xE1;


        /*
         * ----------------------------------------------------
         * I/O registers
         * ----------------------------------------------------
         */

        this.io = new Uint8Array(0x80);


        /*
         * ----------------------------------------------------
         * Boot ROM
         * ----------------------------------------------------
         */

        this.bootRom = null;

        this.bootRomEnabled = false;


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
         * Divider
         * ----------------------------------------------------
         */

        this.io[0x04] = 0x00;


        /*
         * ----------------------------------------------------
         * Sound register defaults
         * ----------------------------------------------------
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
         * ----------------------------------------------------
         * LCD / PPU defaults
         * ----------------------------------------------------
         */

        /*
         * LCDC
         *
         * 0x91:
         *
         * LCD enabled
         * BG enabled
         * Window enabled
         * Tile data 8000
         * BG map 9800
         */

        this.io[0x40] = 0x91;


        /*
         * STAT
         */

        this.io[0x41] = 0x85;


        /*
         * SCY
         */

        this.io[0x42] = 0x00;


        /*
         * SCX
         */

        this.io[0x43] = 0x00;


        /*
         * LY
         */

        this.io[0x44] = 0x00;


        /*
         * LYC
         */

        this.io[0x45] = 0x00;


        /*
         * BGP
         *
         * DMG default palette
         */

        this.io[0x47] = 0xFC;


        /*
         * OBP0
         */

        this.io[0x48] = 0xFF;


        /*
         * OBP1
         */

        this.io[0x49] = 0xFF;


        /*
         * WY
         */

        this.io[0x4A] = 0x00;


        /*
         * WX
         */

        this.io[0x4B] = 0x00;


        /*
         * ----------------------------------------------------
         * Debug state
         * ----------------------------------------------------
         */

        this.lastRead = 0x00;

        this.lastWrite = 0x00;

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


        /*
         * Share VRAM.
         */

        if (ppu) {

            ppu.vram = this.vram;

            ppu.oam = this.oam;


            /*
             * Interrupt callback.
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

    }


    /*
     * ========================================================
     * CONNECT TIMER
     * ========================================================
     */

    connectTimer(timer) {

        this.timer = timer;


        if (
            timer &&
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


        if (
            input &&
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
     * RESET
     * ========================================================
     */

    reset() {

        this.wram.fill(0);

        this.hram.fill(0);

        this.vram.fill(0);

        this.oam.fill(0);

        this.io.fill(0);


        this.interruptEnable = 0x00;

        this.interruptFlags = 0xE1;


        this.joyp = 0xCF;


        this.serialData = 0x00;

        this.serialControl = 0x00;


        /*
         * ----------------------------------------------------
         * Sound defaults
         * ----------------------------------------------------
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
         * ----------------------------------------------------
         * LCD defaults
         * ----------------------------------------------------
         */

        this.io[0x40] = 0x91;
        this.io[0x41] = 0x85;

        this.io[0x42] = 0x00;
        this.io[0x43] = 0x00;

        this.io[0x44] = 0x00;
        this.io[0x45] = 0x00;

        this.io[0x47] = 0xFC;
        this.io[0x48] = 0xFF;
        this.io[0x49] = 0xFF;

        this.io[0x4A] = 0x00;
        this.io[0x4B] = 0x00;


        /*
         * ----------------------------------------------------
         * Debug
         * ----------------------------------------------------
         */

        this.lastRead = 0x00;

        this.lastWrite = 0x00;

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

            /*
             * VRAM blocking disabled temporarily.
             *
             * This is intentional while debugging PPU.
             */

            value =
                this.vram[
                    address - 0x8000
                ];

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
         *
         * E000-FDFF mirrors C000-DDFF.
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

            /*
             * OAM blocking disabled temporarily.
             */

            value =
                this.oam[
                    address - 0xFE00
                ];

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
         * Interrupt Enable
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

    readWord(address) {

        const low =
            this.readByte(address);


        const high =
            this.readByte(
                (address + 1) & 0xFFFF
            );


        return (
            low |
            (high << 8)
        ) & 0xFFFF;

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

            /*
             * No VRAM blocking during development.
             */

            this.vram[
                address - 0x8000
            ] = value;

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

            /*
             * No OAM blocking during development.
             */

            this.oam[
                address - 0xFE00
            ] = value;

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
                value;

        }

    }


    /*
     * ========================================================
     * WRITE WORD
     * ========================================================
     */

    writeWord(address, value) {

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
            ) & 0xFF;

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
     * IO READ
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

                return this.timer.readRegister(
                    address
                ) & 0xFF;

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

                return this.ppu.readRegister(
                    address
                ) & 0xFF;

            }

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

                return this.audio.readRegister(
                    address
                ) & 0xFF;

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
        ) & 0xFF;

    }


    /*
     * ========================================================
     * IO WRITE
     * ========================================================
     */

    writeIO(address, value) {

        const reg =
            address - 0xFF00;


        /*
         * ----------------------------------------------------
         * JOYP
         * ----------------------------------------------------
         */

        if (address === 0xFF00) {

            this.joyp =
                (value & 0x30) |
                0xC0;

            this.updateJoypad();

            return;

        }


        /*
         * ----------------------------------------------------
         * SERIAL
         * ----------------------------------------------------
         */

        if (address === 0xFF01) {

            this.serialData =
                value;

            return;

        }


        if (address === 0xFF02) {

            this.serialControl =
                value;

            return;

        }


        /*
         * ----------------------------------------------------
         * TIMER
         * ----------------------------------------------------
         */

        if (
            address >= 0xFF04 &&
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

            }

            return;

        }


        /*
         * ----------------------------------------------------
         * INTERRUPT FLAGS
         * ----------------------------------------------------
         */

        if (address === 0xFF0F) {

            this.interruptFlags =
                value | 0xE0;

            return;

        }


        /*
         * ----------------------------------------------------
         * DMA
         *
         * IMPORTANT:
         *
         * This MUST happen before FF40-FF4B.
         * ----------------------------------------------------
         */

        if (address === 0xFF46) {

            this.io[0x46] =
                value;

            this.doDMA(value);

            return;

        }


        /*
         * ----------------------------------------------------
         * AUDIO
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

            this.io[reg] =
                value;

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

            this.io[reg] =
                value;

            return;

        }


        /*
         * ----------------------------------------------------
         * GENERIC I/O
         * ----------------------------------------------------
         */

        this.io[reg] =
            value;

    }


    /*
     * ========================================================
     * DMA
     * ========================================================
     *
     * FF46 = XX
     *
     * Source:
     *
     * XX00-XX9F
     *
     * Destination:
     *
     * FE00-FE9F
     *
     * ========================================================
     */

    doDMA(value) {

        const source =
            (value & 0xFF) << 8;


        for (
            let i = 0;
            i < 0xA0;
            i++
        ) {

            this.oam[i] =
                this.readByte(
                    (
                        source +
                        i
                    ) & 0xFFFF
                );

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


        const selectButtons =
            !(this.joyp & 0x20);


        const selectDirections =
            !(this.joyp & 0x10);


        if (
            this.input &&
            typeof this.input.getState ===
            "function"
        ) {

            const state =
                this.input.getState();


            /*
             * ------------------------------------------------
             * Directions
             * ------------------------------------------------
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
             * ------------------------------------------------
             * Buttons
             * ------------------------------------------------
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

        /*
         * Keep currently selected lines.
         */

        const selection =
            this.joyp & 0x30;


        /*
         * Calculate current button state.
         */

        const state =
            this.readJoypad();


        /*
         * Preserve selection bits.
         */

        this.joyp =
            (
                state &
                0xCF
            ) |
            selection;

    }


    /*
     * ========================================================
     * INTERRUPT REQUEST
     * ========================================================
     */

    requestInterrupt(bit) {

        if (
            bit < 0 ||
            bit > 4
        ) {

            return;

        }


        this.interruptFlags |=
            (1 << bit);


        /*
         * Upper IF bits read as 1.
         */

        this.interruptFlags |=
            0xE0;

    }


    /*
     * ========================================================
     * GET PENDING INTERRUPTS
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

        if (
            bit < 0 ||
            bit > 4
        ) {

            return;

        }


        this.interruptFlags &=
            ~(1 << bit);


        this.interruptFlags |=
            0xE0;

    }


    /*
     * ========================================================
     * VRAM ACCESS
     * ========================================================
     *
     * Disabled during development.
     *
     * Later we can restore Mode 3 blocking.
     * ========================================================
     */

    isVRAMBlocked() {

        return false;

    }


    /*
     * ========================================================
     * OAM ACCESS
     * ========================================================
     *
     * Disabled during development.
     *
     * Later we can restore Mode 2/3 blocking.
     * ========================================================
     */

    isOAMBlocked() {

        return false;

    }


    /*
     * ========================================================
     * MEMORY STATE
     * ========================================================
     */

    getState() {

        return {

            interruptEnable:
                this.interruptEnable,

            interruptFlags:
                this.interruptFlags,

            joyp:
                this.joyp,

            serialData:
                this.serialData,

            serialControl:
                this.serialControl,

            lastRead:
                this.lastRead,

            lastWrite:
                this.lastWrite

        };

    }


    /*
     * ========================================================
     * DEBUG DUMP
     * ========================================================
     */

    dump(start, end) {

        start &= 0xFFFF;

        end &= 0xFFFF;


        const result = [];


        for (
            let address = start;
            address <= end;
            address++
        ) {

            result.push(
                this.readByte(address)
            );

        }


        return new Uint8Array(result);

    }

}
