/*
 * ============================================================
 * WebBktx — Game Boy Memory
 * ============================================================
 *
 * Nintendo Game Boy DMG memory bus.
 *
 * Address map:
 *
 * 0000–3FFF  ROM Bank 0
 * 4000–7FFF  ROM Bank N
 * 8000–9FFF  VRAM
 * A000–BFFF  External RAM
 * C000–CFFF  Work RAM
 * D000–DFFF  Work RAM
 * E000–FDFF  Echo RAM
 * FE00–FE9F  OAM
 * FEA0–FEFF  Unusable
 * FF00–FF7F  I/O
 * FF80–FFFE  High RAM
 * FFFF        Interrupt Enable
 *
 * ============================================================
 */


export class GameBoyMemory {

    constructor() {

        /*
         * ----------------------------------------------------
         * MEMORY
         * ----------------------------------------------------
         *
         * The Game Boy has a 16-bit address bus:
         *
         * 0x0000 → 0xFFFF
         *
         * That's 65,536 addressable bytes.
         */

        this.memory =
            new Uint8Array(0x10000);


        /*
         * ----------------------------------------------------
         * CARTRIDGE
         * ----------------------------------------------------
         */

        this.rom =
            new Uint8Array(0);


        this.externalRAM =
            new Uint8Array(0);


        this.romBank =
            1;


        this.ramBank =
            0;


        /*
         * ----------------------------------------------------
         * MBC
         * ----------------------------------------------------
         *
         * Start with MBC0.
         *
         * Later cartridge.js will provide:
         *
         * MBC1
         * MBC2
         * MBC3
         * MBC5
         */

        this.mbc =
            "MBC0";


        /*
         * ----------------------------------------------------
         * INTERRUPTS
         * ----------------------------------------------------
         */

        this.interruptEnable =
            0;


        /*
         * ----------------------------------------------------
         * RESET
         * ----------------------------------------------------
         */

        this.reset();

    }


    /*
     * ========================================================
     * RESET
     * ========================================================
     */

    reset() {

        this.memory.fill(0);


        this.romBank =
            1;


        this.ramBank =
            0;


        this.interruptEnable =
            0;


        /*
         * Default Game Boy I/O values.
         *
         * These are the initial values expected by many
         * Game Boy programs after boot.
         */

        const registers = {

            0xFF00: 0xCF, // JOYP
            0xFF04: 0x00, // DIV
            0xFF05: 0x00, // TIMA
            0xFF06: 0x00, // TMA
            0xFF07: 0x00, // TAC

            0xFF0F: 0xE1, // IF

            0xFF10: 0x80,
            0xFF11: 0xBF,
            0xFF12: 0xF3,
            0xFF14: 0xBF,

            0xFF16: 0x3F,
            0xFF17: 0x00,
            0xFF19: 0xBF,

            0xFF1A: 0x7F,
            0xFF1B: 0xFF,
            0xFF1C: 0x9F,
            0xFF1E: 0xBF,

            0xFF20: 0xFF,
            0xFF21: 0x00,
            0xFF22: 0x00,
            0xFF23: 0xBF,

            0xFF24: 0x77,
            0xFF25: 0xF3,
            0xFF26: 0xF1,

            0xFF40: 0x91, // LCDC
            0xFF41: 0x85, // STAT
            0xFF42: 0x00, // SCY
            0xFF43: 0x00, // SCX
            0xFF44: 0x00, // LY
            0xFF45: 0x00, // LYC
            0xFF47: 0xFC, // BGP
            0xFF48: 0xFF, // OBP0
            0xFF49: 0xFF, // OBP1
            0xFF4A: 0x00, // WY
            0xFF4B: 0x00  // WX

        };


        for (
            const [address, value]
            of Object.entries(registers)
        ) {

            this.memory[
                Number(address)
            ] = value;

        }

    }


    /*
     * ========================================================
     * LOAD ROM
     * ========================================================
     *
     * Loads a .GB file into cartridge memory.
     *
     * The actual ROM is NOT copied into the complete
     * 0x0000–0xFFFF memory array.
     *
     * ROM banking is handled by read().
     * ========================================================
     */

    loadROM(buffer) {

        if (!(buffer instanceof ArrayBuffer)) {

            throw new TypeError(
                "GameBoyMemory.loadROM() oczekuje ArrayBuffer."
            );

        }


        this.rom =
            new Uint8Array(buffer);


        if (this.rom.length < 0x150) {

            throw new Error(
                "ROM jest zbyt mały — brak kompletnego nagłówka Game Boy."
            );

        }


        /*
         * ----------------------------------------------------
         * CARTRIDGE HEADER
         * ----------------------------------------------------
         */

        const cartridgeType =
            this.rom[0x0147];


        const romSize =
            this.rom[0x0148];


        const ramSize =
            this.rom[0x0149];


        this.mbc =
            this.detectMBC(
                cartridgeType
            );


        /*
         * Allocate external RAM.
         */

        const ramBytes =
            this.getRAMSize(
                ramSize
            );


        this.externalRAM =
            new Uint8Array(
                ramBytes
            );


        console.info(
            "[WebBktx] Game Boy ROM loaded:",
            {
                size: this.rom.length,
                cartridgeType:
                    "0x" +
                    cartridgeType
                        .toString(16)
                        .padStart(2, "0"),
                romSizeCode:
                    "0x" +
                    romSize
                        .toString(16)
                        .padStart(2, "0"),
                ramSizeCode:
                    "0x" +
                    ramSize
                        .toString(16)
                        .padStart(2, "0"),
                mbc: this.mbc,
                externalRAM:
                    this.externalRAM.length
            }
        );

    }


    /*
     * ========================================================
     * READ BYTE
     * ========================================================
     */

    read(address) {

        address &=
            0xFFFF;


        /*
         * ROM BANK 0
         *
         * 0000–3FFF
         */

        if (
            address <= 0x3FFF
        ) {

            return this.readROM(
                address
            );

        }


        /*
         * SWITCHABLE ROM BANK
         *
         * 4000–7FFF
         */

        if (
            address <= 0x7FFF
        ) {

            return this.readROMBank(
                address
            );

        }


        /*
         * VRAM
         *
         * 8000–9FFF
         */

        if (
            address <= 0x9FFF
        ) {

            return this.memory[
                address
            ];

        }


        /*
         * EXTERNAL CARTRIDGE RAM
         *
         * A000–BFFF
         */

        if (
            address <= 0xBFFF
        ) {

            return this.readExternalRAM(
                address
            );

        }


        /*
         * WORK RAM
         *
         * C000–DFFF
         */

        if (
            address <= 0xDFFF
        ) {

            return this.memory[
                address
            ];

        }


        /*
         * ECHO RAM
         *
         * E000–FDFF
         *
         * Mirrors C000–DDFF.
         */

        if (
            address <= 0xFDFF
        ) {

            return this.memory[
                address - 0x2000
            ];

        }


        /*
         * OAM
         *
         * FE00–FE9F
         */

        if (
            address <= 0xFE9F
        ) {

            return this.memory[
                address
            ];

        }


        /*
         * Unusable memory
         *
         * FEA0–FEFF
         */

        if (
            address <= 0xFEFF
        ) {

            return 0xFF;

        }


        /*
         * I/O
         *
         * FF00–FF7F
         */

        if (
            address <= 0xFF7F
        ) {

            return this.readIO(
                address
            );

        }


        /*
         * HRAM
         *
         * FF80–FFFE
         */

        if (
            address <= 0xFFFE
        ) {

            return this.memory[
                address
            ];

        }


        /*
         * IE
         *
         * FFFF
         */

        return this.interruptEnable;

    }


    /*
     * ========================================================
     * WRITE BYTE
     * ========================================================
     */

    write(address, value) {

        address &=
            0xFFFF;


        value &=
            0xFF;


        /*
         * ----------------------------------------------------
         * CARTRIDGE / MBC
         * ----------------------------------------------------
         *
         * 0000–7FFF isn't normal RAM.
         *
         * Writes here control the cartridge.
         */

        if (
            address <= 0x7FFF
        ) {

            this.writeMBC(
                address,
                value
            );

            return;

        }


        /*
         * External RAM
         */

        if (
            address >= 0xA000 &&
            address <= 0xBFFF
        ) {

            this.writeExternalRAM(
                address,
                value
            );

            return;

        }


        /*
         * Echo RAM
         */

        if (
            address >= 0xE000 &&
            address <= 0xFDFF
        ) {

            this.memory[
                address
            ] = value;


            this.memory[
                address - 0x2000
            ] = value;


            return;

        }


        /*
         * OAM
         */

        if (
            address >= 0xFE00 &&
            address <= 0xFE9F
        ) {

            this.memory[
                address
            ] = value;

            return;

        }


        /*
         * Unusable memory
         */

        if (
            address >= 0xFEA0 &&
            address <= 0xFEFF
        ) {

            return;

        }


        /*
         * I/O
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
         * HRAM
         */

        if (
            address >= 0xFF80 &&
            address <= 0xFFFE
        ) {

            this.memory[
                address
            ] = value;

            return;

        }


        /*
         * Interrupt Enable
         */

        if (
            address === 0xFFFF
        ) {

            this.interruptEnable =
                value;

        }

    }


    /*
     * ========================================================
     * READ 16-BIT
     * ========================================================
     */

    read16(address) {

        const low =
            this.read(
                address
            );


        const high =
            this.read(
                address + 1
            );


        return (
            low |
            (high << 8)
        );

    }


    /*
     * ========================================================
     * WRITE 16-BIT
     * ========================================================
     */

    write16(
        address,
        value
    ) {

        this.write(
            address,
            value & 0xFF
        );


        this.write(
            address + 1,
            (value >> 8) & 0xFF
        );

    }


    /*
     * ========================================================
     * ROM BANK 0
     * ========================================================
     */

    readROM(address) {

        if (
            address >= this.rom.length
        ) {

            return 0xFF;

        }


        return this.rom[
            address
        ];

    }


    /*
     * ========================================================
     * SWITCHABLE ROM BANK
     * ========================================================
     */

    readROMBank(address) {

        const offset =
            (
                this.romBank *
                0x4000
            ) +
            (
                address -
                0x4000
            );


        if (
            offset >= this.rom.length
        ) {

            return 0xFF;

        }


        return this.rom[
            offset
        ];

    }


    /*
     * ========================================================
     * EXTERNAL RAM
     * ========================================================
     */

    readExternalRAM(address) {

        if (
            this.externalRAM.length === 0
        ) {

            return 0xFF;

        }


        const offset =
            (
                this.ramBank *
                0x2000
            ) +
            (
                address -
                0xA000
            );


        if (
            offset >=
            this.externalRAM.length
        ) {

            return 0xFF;

        }


        return this.externalRAM[
            offset
        ];

    }


    writeExternalRAM(
        address,
        value
    ) {

        if (
            this.externalRAM.length === 0
        ) {

            return;

        }


        const offset =
            (
                this.ramBank *
                0x2000
            ) +
            (
                address -
                0xA000
            );


        if (
            offset >=
            this.externalRAM.length
        ) {

            return;

        }


        this.externalRAM[
            offset
        ] = value;

    }


    /*
     * ========================================================
     * MBC
     * ========================================================
     *
     * Initial implementation:
     *
     * MBC0
     * MBC1
     *
     * More controllers can be added later.
     * ========================================================
     */

    writeMBC(
        address,
        value
    ) {

        switch (
            this.mbc
        ) {

            case "MBC0":

                /*
                 * No banking.
                 */

                return;


            case "MBC1":

                this.writeMBC1(
                    address,
                    value
                );

                return;


            default:

                return;

        }

    }


    /*
     * ========================================================
     * MBC1
     * ========================================================
     */

    writeMBC1(
        address,
        value
    ) {

        /*
         * 0000–1FFF
         *
         * RAM enable
         */

        if (
            address <= 0x1FFF
        ) {

            return;

        }


        /*
         * 2000–3FFF
         *
         * ROM bank number
         */

        if (
            address <= 0x3FFF
        ) {

            let bank =
                value & 0x1F;


            /*
             * Bank 0 cannot be selected
             * for the switchable area.
             */

            if (
                bank === 0
            ) {

                bank = 1;

            }


            this.romBank =
                bank;


            return;

        }


        /*
         * 4000–5FFF
         *
         * RAM bank / upper ROM bits.
         *
         * Simplified for now.
         */

        if (
            address <= 0x5FFF
        ) {

            this.ramBank =
                value & 0x03;

            return;

        }


        /*
         * 6000–7FFF
         *
         * Banking mode.
         *
         * Not fully implemented yet.
         */

    }


    /*
     * ========================================================
     * I/O READ
     * ========================================================
     */

    readIO(address) {

        /*
         * JOYP
         *
         * Input module will later provide
         * the actual value.
         */

        if (
            address === 0xFF00
        ) {

            return this.memory[
                address
            ];

        }


        /*
         * DIV
         *
         * Timer module will later own this.
         */

        if (
            address === 0xFF04
        ) {

            return this.memory[
                address
            ];

        }


        /*
         * LY
         *
         * PPU will update this.
         */

        if (
            address === 0xFF44
        ) {

            return this.memory[
                address
            ];

        }


        return this.memory[
            address
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

        /*
         * DIV
         *
         * Writing ANY value resets DIV.
         */

        if (
            address === 0xFF04
        ) {

            this.memory[
                address
            ] = 0;

            return;

        }


        /*
         * LY
         *
         * Read-only.
         *
         * PPU controls it.
         */

        if (
            address === 0xFF44
        ) {

            return;

        }


        /*
         * STAT
         *
         * Some bits are read-only.
         */

        if (
            address === 0xFF41
        ) {

            this.memory[
                address
            ] =
                (
                    value &
                    0x78
                ) |
                (
                    this.memory[
                        address
                    ] &
                    0x07
                );

            return;

        }


        /*
         * DMA transfer.
         *
         * FF46 → OAM.
         */

        if (
            address === 0xFF46
        ) {

            this.memory[
                address
            ] = value;


            this.doDMA(
                value
            );


            return;

        }


        /*
         * Normal I/O register.
         */

        this.memory[
            address
        ] = value;

    }


    /*
     * ========================================================
     * DMA
     * ========================================================
     *
     * Copies 160 bytes into OAM.
     *
     * Source:
     *
     * value << 8
     *
     * Destination:
     *
     * FE00–FE9F
     * ========================================================
     */

    doDMA(
        value
    ) {

        const source =
            value << 8;


        for (
            let i = 0;
            i < 0xA0;
            i++
        ) {

            this.memory[
                0xFE00 + i
            ] =
                this.read(
                    source + i
                );

        }

    }


    /*
     * ========================================================
     * MBC DETECTION
     * ========================================================
     */

    detectMBC(
        cartridgeType
    ) {

        switch (
            cartridgeType
        ) {

            case 0x00:
                return "MBC0";


            case 0x01:
            case 0x02:
            case 0x03:
                return "MBC1";


            /*
             * MBC2
             * MBC3
             * MBC5
             * will be implemented later.
             */

            default:
                return "MBC0";

        }

    }


    /*
     * ========================================================
     * RAM SIZE
     * ========================================================
     */

    getRAMSize(
        code
    ) {

        switch (
            code
        ) {

            case 0x00:
                return 0;


            case 0x01:
                return 2 * 1024;


            case 0x02:
                return 8 * 1024;


            case 0x03:
                return 32 * 1024;


            case 0x04:
                return 128 * 1024;


            case 0x05:
                return 64 * 1024;


            default:
                return 0;

        }

    }


    /*
     * ========================================================
     * DIRECT MEMORY ACCESS
     * ========================================================
     *
     * Useful for debugging and PPU.
     * ========================================================
     */

    get raw() {

        return this.memory;

    }


    /*
     * ========================================================
     * DEBUG
     * ========================================================
     */

    dump(
        start = 0x0000,
        end = 0x00FF
    ) {

        const result = [];


        for (
            let address = start;
            address <= end;
            address++
        ) {

            result.push(
                this.read(address)
            );

        }


        return Uint8Array.from(
            result
        );

    }

}


/*
 * ============================================================
 * DEFAULT EXPORT
 * ============================================================
 */

export default GameBoyMemory;
