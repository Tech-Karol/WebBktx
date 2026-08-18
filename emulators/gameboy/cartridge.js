/*
 * ============================================================
 * WebBktx — Game Boy Cartridge
 * ============================================================
 *
 * Obsługuje:
 *   - ROM .GB
 *   - Cartridge Header
 *   - Nintendo logo
 *   - tytuł gry
 *   - typ cartridge
 *   - rozmiar ROM
 *   - rozmiar RAM
 *   - MBC1
 *   - MBC3
 *   - MBC5
 *   - ROM-only
 *
 * ============================================================
 */

export default class GameBoyCartridge {

    constructor() {

        this.rom = null;

        this.ram = null;

        this.loaded = false;


        /*
         * Cartridge information
         */

        this.title = "";

        this.manufacturer = "";

        this.cartridgeType = 0x00;

        this.romSizeCode = 0x00;

        this.ramSizeCode = 0x00;

        this.romBanks = 0;

        this.ramBanks = 0;


        /*
         * MBC
         */

        this.mbc = "ROM_ONLY";

        this.romBank = 1;

        this.ramBank = 0;

        this.ramEnabled = false;

        this.bankingMode = 0;


        /*
         * MBC3 RTC placeholder
         */

        this.rtc = {

            enabled: false,

            register: 0,

            latch: 0

        };

    }


    /*
     * ========================================================
     * LOAD ROM
     * ========================================================
     */

    load(data) {

        if (!(data instanceof Uint8Array)) {

            data =
                new Uint8Array(data);

        }


        if (data.length < 0x150) {

            throw new Error(
                "ROM jest za mały, aby był prawidłowym Game Boy ROM."
            );

        }


        this.rom = data;

        this.readHeader();

        this.createRAM();

        this.configureMBC();

        this.loaded = true;


        console.log(
            `[WebBktx] Loaded Game Boy ROM: ${this.title}`
        );

        console.log(
            `[WebBktx] MBC: ${this.mbc}`
        );

        console.log(
            `[WebBktx] ROM banks: ${this.romBanks}`
        );

        console.log(
            `[WebBktx] RAM banks: ${this.ramBanks}`
        );


        return this.getInfo();

    }


    /*
     * ========================================================
     * READ HEADER
     * ========================================================
     */

    readHeader() {

        /*
         * Title:
         *
         * 0x0134 - 0x0143
         */

        this.title =
            this.readString(
                0x0134,
                16
            );


        /*
         * Manufacturer:
         *
         * 0x013F - 0x0142
         */

        this.manufacturer =
            this.readString(
                0x013F,
                4
            );


        /*
         * Cartridge type:
         *
         * 0x0147
         */

        this.cartridgeType =
            this.rom[0x0147];


        /*
         * ROM size:
         *
         * 0x0148
         */

        this.romSizeCode =
            this.rom[0x0148];


        /*
         * RAM size:
         *
         * 0x0149
         */

        this.ramSizeCode =
            this.rom[0x0149];

    }


    /*
     * ========================================================
     * CONFIGURE MBC
     * ========================================================
     */

    configureMBC() {

        switch (
            this.cartridgeType
        ) {

            /*
             * ROM ONLY
             */

            case 0x00:

            case 0x08:

            case 0x09:

                this.mbc =
                    "ROM_ONLY";

                break;


            /*
             * MBC1
             */

            case 0x01:

            case 0x02:

            case 0x03:

                this.mbc =
                    "MBC1";

                break;


            /*
             * MBC2
             */

            case 0x05:

            case 0x06:

                this.mbc =
                    "MBC2";

                break;


            /*
             * MBC3
             */

            case 0x0F:

            case 0x10:

            case 0x11:

            case 0x12:

            case 0x13:

                this.mbc =
                    "MBC3";

                break;


            /*
             * MBC5
             */

            case 0x19:

            case 0x1A:

            case 0x1B:

            case 0x1C:

            case 0x1D:

            case 0x1E:

                this.mbc =
                    "MBC5";

                break;


            default:

                this.mbc =
                    "UNKNOWN";

                console.warn(
                    `[WebBktx] Unknown cartridge type: 0x${this.cartridgeType.toString(16)}`
                );

                break;

        }

    }


    /*
     * ========================================================
     * ROM SIZE
     * ========================================================
     */

    getROMBanks() {

        /*
         * 32 KB = 2 banks
         */

        const sizes = {

            0x00: 2,

            0x01: 4,

            0x02: 8,

            0x03: 16,

            0x04: 32,

            0x05: 64,

            0x06: 128,

            0x07: 256,

            0x08: 512,

            0x52: 72,

            0x53: 80,

            0x54: 96

        };


        return (
            sizes[
                this.romSizeCode
            ] || 2
        );

    }


    /*
     * ========================================================
     * RAM SIZE
     * ========================================================
     */

    getRAMBanks() {

        const sizes = {

            0x00: 0,

            0x01: 1,

            0x02: 1,

            0x03: 4,

            0x04: 16,

            0x05: 8

        };


        return (
            sizes[
                this.ramSizeCode
            ] || 0
        );

    }


    /*
     * ========================================================
     * CREATE RAM
     * ========================================================
     */

    createRAM() {

        this.romBanks =
            this.getROMBanks();


        this.ramBanks =
            this.getRAMBanks();


        if (this.ramBanks === 0) {

            this.ram =
                new Uint8Array(0);

            return;

        }


        const size =
            this.ramBanks *
            0x2000;


        this.ram =
            new Uint8Array(
                size
            );

    }


    /*
     * ========================================================
     * ROM READ
     * ========================================================
     *
     * 0000 - 3FFF
     *   Fixed ROM bank
     *
     * 4000 - 7FFF
     *   Switchable ROM bank
     * ========================================================
     */

    readROM(address) {

        address &=
            0x7FFF;


        /*
         * Fixed bank.
         */

        if (address < 0x4000) {

            return this.rom[
                address %
                this.rom.length
            ];

        }


        /*
         * Switchable bank.
         */

        const bank =
            this.getCurrentROMBank();


        const offset =
            bank *
            0x4000 +
            (address - 0x4000);


        return this.rom[
            offset %
            this.rom.length
        ];

    }


    /*
     * ========================================================
     * CURRENT ROM BANK
     * ========================================================
     */

    getCurrentROMBank() {

        let bank =
            this.romBank;


        if (bank === 0) {

            bank = 1;

        }


        bank %=
            this.romBanks;


        if (bank === 0) {

            bank = 1;

        }


        return bank;

    }


    /*
     * ========================================================
     * CARTRIDGE READ
     * ========================================================
     */

    read(address) {

        address &=
            0xFFFF;


        /*
         * ROM
         */

        if (
            address >= 0x0000 &&
            address <= 0x7FFF
        ) {

            return this.readROM(
                address
            );

        }


        /*
         * External RAM
         */

        if (
            address >= 0xA000 &&
            address <= 0xBFFF
        ) {

            return this.readRAM(
                address
            );

        }


        return 0xFF;

    }


    /*
     * ========================================================
     * CARTRIDGE WRITE
     * ========================================================
     */

    write(
        address,
        value
    ) {

        address &=
            0xFFFF;

        value &=
            0xFF;


        switch (
            this.mbc
        ) {

            case "ROM_ONLY":

                return;


            case "MBC1":

                this.writeMBC1(
                    address,
                    value
                );

                return;


            case "MBC2":

                this.writeMBC2(
                    address,
                    value
                );

                return;


            case "MBC3":

                this.writeMBC3(
                    address,
                    value
                );

                return;


            case "MBC5":

                this.writeMBC5(
                    address,
                    value
                );

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
         * RAM enable
         */

        if (
            address >= 0x0000 &&
            address <= 0x1FFF
        ) {

            this.ramEnabled =
                (value & 0x0F) === 0x0A;

            return;

        }


        /*
         * ROM bank lower bits
         */

        if (
            address >= 0x2000 &&
            address <= 0x3FFF
        ) {

            let bank =
                value & 0x1F;


            if (bank === 0) {

                bank = 1;

            }


            this.romBank =
                (
                    this.romBank &
                    0x60
                ) |
                bank;

            return;

        }


        /*
         * Upper ROM/RAM bank bits
         */

        if (
            address >= 0x4000 &&
            address <= 0x5FFF
        ) {

            const upper =
                value & 0x03;


            this.romBank =
                (
                    this.romBank &
                    0x1F
                ) |
                (upper << 5);

            return;

        }


        /*
         * Banking mode
         */

        if (
            address >= 0x6000 &&
            address <= 0x7FFF
        ) {

            this.bankingMode =
                value & 1;

        }

    }


    /*
     * ========================================================
     * MBC2
     * ========================================================
     */

    writeMBC2(
        address,
        value
    ) {

        if (
            address >= 0x0000 &&
            address <= 0x3FFF
        ) {

            /*
             * A8 determines operation.
             */

            if (address & 0x0100) {

                let bank =
                    value & 0x0F;


                if (bank === 0) {

                    bank = 1;

                }


                this.romBank =
                    bank;

            } else {

                this.ramEnabled =
                    (value & 0x0F) === 0x0A;

            }

        }

    }


    /*
     * ========================================================
     * MBC3
     * ========================================================
     */

    writeMBC3(
        address,
        value
    ) {

        if (
            address >= 0x0000 &&
            address <= 0x1FFF
        ) {

            this.ramEnabled =
                (value & 0x0F) === 0x0A;

            return;

        }


        if (
            address >= 0x2000 &&
            address <= 0x3FFF
        ) {

            let bank =
                value & 0x7F;


            if (bank === 0) {

                bank = 1;

            }


            this.romBank =
                bank;

            return;

        }


        if (
            address >= 0x4000 &&
            address <= 0x5FFF
        ) {

            this.ramBank =
                value;

            this.rtc.register =
                value;

            return;

        }


        /*
         * RTC latch.
         */

        if (
            address >= 0x6000 &&
            address <= 0x7FFF
        ) {

            this.rtc.latch =
                value;

        }

    }


    /*
     * ========================================================
     * MBC5
     * ========================================================
     */

    writeMBC5(
        address,
        value
    ) {

        if (
            address >= 0x0000 &&
            address <= 0x1FFF
        ) {

            this.ramEnabled =
                (value & 0x0F) === 0x0A;

            return;

        }


        /*
         * ROM bank low 8 bits
         */

        if (
            address >= 0x2000 &&
            address <= 0x2FFF
        ) {

            this.romBank =
                (
                    this.romBank &
                    0x100
                ) |
                value;

            return;

        }


        /*
         * ROM bank bit 8
         */

        if (
            address >= 0x3000 &&
            address <= 0x3FFF
        ) {

            this.romBank =
                (
                    this.romBank &
                    0xFF
                ) |
                ((value & 1) << 8);

            return;

        }


        /*
         * RAM bank
         */

        if (
            address >= 0x4000 &&
            address <= 0x5FFF
        ) {

            this.ramBank =
                value & 0x0F;

        }

    }


    /*
     * ========================================================
     * RAM READ
     * ========================================================
     */

    readRAM(address) {

        if (!this.ramEnabled) {

            return 0xFF;

        }


        if (
            this.ram.length === 0
        ) {

            return 0xFF;

        }


        let bank =
            this.ramBank;


        /*
         * MBC2 has internal 512 × 4-bit RAM.
         *
         * This implementation currently exposes
         * a simplified RAM area.
         */

        if (
            this.mbc === "MBC2"
        ) {

            const offset =
                (address - 0xA000) &
                0x01FF;


            return this.ram[
                offset %
                this.ram.length
            ] | 0xF0;

        }


        const offset =
            bank *
            0x2000 +
            (address - 0xA000);


        return this.ram[
            offset %
            this.ram.length
        ];

    }


    /*
     * ========================================================
     * RAM WRITE
     * ========================================================
     */

    writeRAM(
        address,
        value
    ) {

        if (!this.ramEnabled) {

            return;

        }


        if (
            this.ram.length === 0
        ) {

            return;

        }


        value &=
            0xFF;


        if (
            this.mbc === "MBC2"
        ) {

            const offset =
                (address - 0xA000) &
                0x01FF;


            /*
             * MBC2 RAM stores only
             * lower 4 bits.
             */

            this.ram[
                offset %
                this.ram.length
            ] =
                value & 0x0F;

            return;

        }


        const offset =
            this.ramBank *
            0x2000 +
            (address - 0xA000);


        this.ram[
            offset %
            this.ram.length
        ] =
            value;

    }


    /*
     * ========================================================
     * SAVE RAM
     * ========================================================
     */

    getSaveData() {

        if (
            !this.ram ||
            this.ram.length === 0
        ) {

            return null;

        }


        return new Uint8Array(
            this.ram
        );

    }


    /*
     * ========================================================
     * LOAD SAVE
     * ========================================================
     */

    loadSave(data) {

        if (!data) {

            return false;

        }


        if (
            !(data instanceof Uint8Array)
        ) {

            data =
                new Uint8Array(data);

        }


        if (
            !this.ram ||
            this.ram.length === 0
        ) {

            return false;

        }


        this.ram.set(
            data.subarray(
                0,
                this.ram.length
            )
        );


        return true;

    }


    /*
     * ========================================================
     * STRING
     * ========================================================
     */

    readString(
        start,
        length
    ) {

        let result = "";


        for (
            let i = 0;
            i < length;
            i++
        ) {

            const value =
                this.rom[
                    start + i
                ];


            if (
                value === 0x00
            ) {

                break;

            }


            /*
             * Printable ASCII only.
             */

            if (
                value >= 32 &&
                value <= 126
            ) {

                result +=
                    String.fromCharCode(
                        value
                    );

            }

        }


        return result.trim();

    }


    /*
     * ========================================================
     * INFO
     * ========================================================
     */

    getInfo() {

        return {

            title:
                this.title,

            manufacturer:
                this.manufacturer,

            cartridgeType:
                `0x${this.cartridgeType
                    .toString(16)
                    .padStart(2, "0")}`,

            mbc:
                this.mbc,

            romSize:
                this.rom.length,

            romBanks:
                this.romBanks,

            ramSize:
                this.ram.length,

            ramBanks:
                this.ramBanks

        };

    }

}
