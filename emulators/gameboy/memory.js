/*
 * ============================================================
 * WebBktx — Game Boy Memory Bus
 * ============================================================
 *
 * DMG Memory Map
 *
 * 0000-7FFF  Cartridge ROM
 * 8000-9FFF  VRAM
 * A000-BFFF  Cartridge RAM
 * C000-DFFF  WRAM
 * E000-FDFF  Echo RAM
 * FE00-FE9F  OAM
 * FEA0-FEFF  Unusable
 * FF00-FF7F  I/O Registers
 * FF80-FFFE  HRAM
 * FFFF       IE
 *
 * ============================================================
 */

export default class GameBoyMemory {

    constructor() {

        /*
         * ====================================================
         * RAM
         * ====================================================
         */

        this.vram =
            new Uint8Array(0x2000);

        this.wram =
            new Uint8Array(0x2000);

        this.oam =
            new Uint8Array(0xA0);

        this.io =
            new Uint8Array(0x80);

        this.hram =
            new Uint8Array(0x7F);


        /*
         * Interrupt Enable
         */

        this.ie = 0x00;


        /*
         * Cartridge
         */

        this.cartridge = null;


        /*
         * External modules
         */

        this.ppu = null;
        this.timer = null;
        this.input = null;
        this.audio = null;


        /*
         * Boot ROM state
         */

        this.bootRom = null;
        this.bootRomEnabled = false;


        /*
         * Open bus value.
         */

        this.openBus = 0xFF;


        /*
         * Initial DMG I/O state.
         */

        this.resetIO();

    }


    /*
     * ========================================================
     * RESET
     * ========================================================
     */

    reset() {

        this.vram.fill(0);
        this.wram.fill(0);
        this.oam.fill(0);
        this.io.fill(0);
        this.hram.fill(0);

        this.ie = 0x00;

        this.openBus = 0xFF;

        this.resetIO();

    }


    /*
     * ========================================================
     * INITIAL I/O VALUES
     * ========================================================
     */

    resetIO() {

        /*
         * Joypad
         */

        this.io[0x00] = 0xCF;


        /*
         * Serial
         */

        this.io[0x01] = 0x00;
        this.io[0x02] = 0x7E;


        /*
         * Timer
         */

        this.io[0x04] = 0x00;
        this.io[0x05] = 0x00;
        this.io[0x06] = 0x00;
        this.io[0x07] = 0xF8;


        /*
         * Interrupt flag
         */

        this.io[0x0F] = 0xE1;


        /*
         * Sound registers
         */

        this.io[0x10] = 0x80;
        this.io[0x11] = 0xBF;
        this.io[0x12] = 0xF3;
        this.io[0x13] = 0xFF;
        this.io[0x14] = 0xBF;

        this.io[0x16] = 0x3F;
        this.io[0x17] = 0x00;
        this.io[0x18] = 0xFF;
        this.io[0x19] = 0xBF;

        this.io[0x1A] = 0x7F;
        this.io[0x1B] = 0xFF;
        this.io[0x1C] = 0x9F;
        this.io[0x1D] = 0xFF;
        this.io[0x1E] = 0xBF;

        this.io[0x20] = 0xFF;
        this.io[0x21] = 0x00;
        this.io[0x22] = 0x00;
        this.io[0x23] = 0xBF;

        this.io[0x24] = 0x77;
        this.io[0x25] = 0xF3;
        this.io[0x26] = 0xF1;


        /*
         * PPU
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
         * Interrupt Enable is separate.
         */

        this.ie = 0x00;

    }


    /*
     * ========================================================
     * CONNECT MODULES
     * ========================================================
     */

    connectCartridge(cartridge) {

        this.cartridge =
            cartridge;

    }


    connectPPU(ppu) {

        this.ppu =
            ppu;

    }


    connectTimer(timer) {

        this.timer =
            timer;

    }


    connectInput(input) {

        this.input =
            input;

    }


    connectAudio(audio) {

        this.audio =
            audio;

    }


    /*
     * ========================================================
     * BOOT ROM
     * ========================================================
     */

    loadBootROM(data) {

        if (
            !data ||
            data.length === 0
        ) {

            return false;

        }

        this.bootRom =
            new Uint8Array(data);

        this.bootRomEnabled =
            true;

        return true;

    }


    disableBootROM() {

        this.bootRomEnabled =
            false;

    }


    /*
     * ========================================================
     * READ
     * ========================================================
     */

    read(address) {

        address &=
            0xFFFF;


        /*
         * ----------------------------------------------------
         * Boot ROM
         * ----------------------------------------------------
         */

        if (
            this.bootRomEnabled &&
            this.bootRom
        ) {

            if (
                address < 0x0100 &&
                address <
                this.bootRom.length
            ) {

                return this.bootRom[
                    address
                ];

            }

        }


        /*
         * ----------------------------------------------------
         * Cartridge ROM
         * ----------------------------------------------------
         */

        if (
            address <= 0x7FFF
        ) {

            return this.readCartridgeROM(
                address
            );

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

            return this.readVRAM(
                address
            );

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

            return this.readCartridgeRAM(
                address
            );

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

            return this.wram[
                address - 0xC000
            ];

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

            return this.wram[
                address - 0xE000
            ];

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

            return this.oam[
                address - 0xFE00
            ];

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

            return 0xFF;

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

            return this.readIO(
                address
            );

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

            return this.hram[
                address - 0xFF80
            ];

        }


        /*
         * ----------------------------------------------------
         * Interrupt Enable
         * ----------------------------------------------------
         */

        if (
            address === 0xFFFF
        ) {

            return this.ie;

        }


        return this.openBus;

    }


    /*
     * ========================================================
     * WRITE
     * ========================================================
     */

    write(address, value) {

        address &=
            0xFFFF;

        value &=
            0xFF;


        this.openBus =
            value;


        /*
         * ----------------------------------------------------
         * Cartridge
         * ----------------------------------------------------
         */

        if (
            address <= 0x7FFF
        ) {

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

            this.writeVRAM(
                address,
                value
            );

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
            ] =
                value;

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
            ] =
                value;

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

            this.oam[
                address - 0xFE00
            ] =
                value;

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
            ] =
                value;

            return;

        }


        /*
         * ----------------------------------------------------
         * IE
         * ----------------------------------------------------
         */

        if (
            address === 0xFFFF
        ) {

            this.ie =
                value;

        }

    }


    /*
     * ========================================================
     * CARTRIDGE ROM
     * ========================================================
     */

    readCartridgeROM(address) {

        if (
            !this.cartridge
        ) {

            return 0xFF;

        }


        if (
            typeof this.cartridge.readROM ===
            "function"
        ) {

            return this.cartridge.readROM(
                address
            ) & 0xFF;

        }


        /*
         * Fallback for simple cartridge
         * implementations.
         */

        if (
            this.cartridge.rom
        ) {

            return (
                this.cartridge.rom[
                    address %
                    this.cartridge.rom.length
                ] ?? 0xFF
            );

        }


        return 0xFF;

    }


    /*
     * ========================================================
     * CARTRIDGE WRITE
     * ========================================================
     */

    writeCartridge(
        address,
        value
    ) {

        if (
            !this.cartridge
        ) {

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
     * CARTRIDGE RAM
     * ========================================================
     */

    readCartridgeRAM(address) {

        if (
            !this.cartridge
        ) {

            return 0xFF;

        }


        if (
            typeof this.cartridge.readRAM ===
            "function"
        ) {

            return this.cartridge.readRAM(
                address
            ) & 0xFF;

        }


        return 0xFF;

    }


    writeCartridgeRAM(
        address,
        value
    ) {

        if (
            !this.cartridge
        ) {

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

        }

    }


    /*
     * ========================================================
     * VRAM
     * ========================================================
     */

    readVRAM(address) {

        /*
         * PPU can later enforce VRAM
         * access restrictions.
         */

        return this.vram[
            address - 0x8000
        ];

    }


    writeVRAM(
        address,
        value
    ) {

        this.vram[
            address - 0x8000
        ] =
            value;

    }


    /*
     * ========================================================
     * I/O READ
     * ========================================================
     */

    readIO(address) {

        const offset =
            address - 0xFF00;


        /*
         * ----------------------------------------------------
         * Joypad
         * ----------------------------------------------------
         */

        if (
            address === 0xFF00
        ) {

            if (
                this.input &&
                typeof this.input.read ===
                "function"
            ) {

                return this.input.read();

            }

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
                typeof this.timer.read ===
                "function"
            ) {

                return this.timer.read(
                    address
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

                return this.ppu.readRegister(
                    address
                );

            }

        }


        /*
         * Default I/O.
         */

        return this.io[
            offset
        ];

    }


    /*
     * ========================================================
     * I/O WRITE
     * ========================================================
     */

    writeIO(
        address,
        value
    ) {

        const offset =
            address - 0xFF00;


        /*
         * ----------------------------------------------------
         * Joypad
         * ----------------------------------------------------
         */

        if (
            address === 0xFF00
        ) {

            this.io[0x00] =
                (
                    this.io[0x00] &
                    0x0F
                ) |
                (
                    value &
                    0xF0
                );


            if (
                this.input &&
                typeof this.input.write ===
                "function"
            ) {

                this.input.write(
                    value
                );

            }

            return;

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
                typeof this.timer.write ===
                "function"
            ) {

                this.timer.write(
                    address,
                    value
                );

                return;

            }

            this.io[offset] =
                value;

            return;

        }


        /*
         * ----------------------------------------------------
         * DIV
         * ----------------------------------------------------
         */

        if (
            address === 0xFF04
        ) {

            this.io[0x04] =
                0;

            return;

        }


        /*
         * ----------------------------------------------------
         * LCD / PPU
         * ----------------------------------------------------
         */

        if (
            address >= 0xFF40 &&
            address <= 0xFF4B
        ) {

            this.io[offset] =
                value;


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

            return;

        }


        /*
         * ----------------------------------------------------
         * DMA
         * ----------------------------------------------------
         */

        if (
            address === 0xFF46
        ) {

            this.io[0x46] =
                value;


            this.doDMA(
                value
            );

            return;

        }


        /*
         * ----------------------------------------------------
         * Sound
         * ----------------------------------------------------
         */

        if (
            address >= 0xFF10 &&
            address <= 0xFF26
        ) {

            this.io[offset] =
                value;


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

            return;

        }


        /*
         * ----------------------------------------------------
         * Wave RAM
         * ----------------------------------------------------
         *
         * FF30-FF3F
         */

        if (
            address >= 0xFF30 &&
            address <= 0xFF3F
        ) {

            this.io[offset] =
                value;

            return;

        }


        /*
         * ----------------------------------------------------
         * Interrupt Flag
         * ----------------------------------------------------
         */

        if (
            address === 0xFF0F
        ) {

            this.io[0x0F] =
                (
                    value |
                    0xE0
                ) & 0xFF;

            return;

        }


        /*
         * ----------------------------------------------------
         * Boot ROM disable
         * ----------------------------------------------------
         */

        if (
            address === 0xFF50
        ) {

            this.io[0x50] =
                value;


            if (
                value !== 0
            ) {

                this.disableBootROM();

            }

            return;

        }


        /*
         * Default I/O register.
         */

        this.io[offset] =
            value;

    }


    /*
     * ========================================================
     * DMA TRANSFER
     * ========================================================
     *
     * FF46 = XX
     *
     * Copies XX00-XX9F to FE00-FE9F.
     *
     * ========================================================
     */

    doDMA(value) {

        const source =
            (
                value &
                0xFF
            ) << 8;


        for (
            let i = 0;
            i < 0xA0;
            i++
        ) {

            this.oam[i] =
                this.readDMAByte(
                    source + i
                );

        }

    }


    /*
     * DMA read avoids some recursive
     * behavior of normal writes.
     */

    readDMAByte(address) {

        address &=
            0xFFFF;


        if (
            address < 0x8000
        ) {

            return this.read(
                address
            );

        }


        if (
            address < 0xA000
        ) {

            return this.vram[
                address - 0x8000
            ];

        }


        if (
            address < 0xC000
        ) {

            return this.read(
                address
            );

        }


        if (
            address < 0xE000
        ) {

            return this.wram[
                address - 0xC000
            ];

        }


        if (
            address < 0xFE00
        ) {

            return this.wram[
                address - 0xE000
            ];

        }


        if (
            address < 0xFEA0
        ) {

            return this.oam[
                address - 0xFE00
            ];

        }


        if (
            address >= 0xFF80
        ) {

            return this.hram[
                address - 0xFF80
            ];

        }


        return this.read(
            address
        );

    }


    /*
     * ========================================================
     * 16-BIT HELPERS
     * ========================================================
     */

    read16(address) {

        const low =
            this.read(address);

        const high =
            this.read(
                (address + 1) &
                0xFFFF
            );


        return (
            low |
            (high << 8)
        );

    }


    write16(
        address,
        value
    ) {

        this.write(
            address,
            value & 0xFF
        );

        this.write(
            (address + 1) &
            0xFFFF,
            (value >> 8) & 0xFF
        );

    }


    /*
     * ========================================================
     * INTERRUPTS
     * ========================================================
     */

    requestInterrupt(bit) {

        const flags =
            this.read8IF();


        this.write8IF(
            flags |
            (1 << bit)
        );

    }


    read8IF() {

        return (
            this.io[0x0F] |
            0xE0
        ) & 0xFF;

    }


    write8IF(value) {

        this.io[0x0F] =
            (
                value |
                0xE0
            ) & 0xFF;

    }


    /*
     * ========================================================
     * DEBUG
     * ========================================================
     */

    getState() {

        return {

            ie:
                this.ie,

            if:
                this.io[0x0F],

            bootRomEnabled:
                this.bootRomEnabled,

            cartridge:
                Boolean(
                    this.cartridge
                ),

            modules: {

                ppu:
                    Boolean(this.ppu),

                timer:
                    Boolean(this.timer),

                input:
                    Boolean(this.input),

                audio:
                    Boolean(this.audio)

            }

        };

    }

}
