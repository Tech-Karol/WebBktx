/*
 * ============================================================
 * WebBktx — Game Boy Cartridge
 * ============================================================
 *
 * Obsługa:
 *
 * ROM ONLY
 * MBC1
 * MBC2
 * MBC3
 * MBC5
 *
 * + RAM kartridża
 * + bankowanie ROM
 * + bankowanie RAM
 * + battery-backed RAM w pamięci emulatora
 *
 * ============================================================
 */

export default class Cartridge {

    constructor() {

        this.rom = null;

        this.ram = null;

        this.title = "";

        this.type = 0x00;

        this.romSizeCode = 0;

        this.ramSizeCode = 0;

        this.romBanks = 0;

        this.ramBanks = 0;

        this.romBank = 1;

        this.ramBank = 0;

        this.ramEnabled = false;

        this.mode = 0;

        this.mbc = "ROM";


        /*
         * MBC1
         */

        this.mbc1Low5 = 1;

        this.mbc1High2 = 0;


        /*
         * MBC3
         */

        this.rtcRegister = 0;


        /*
         * MBC5
         */

        this.mbc5Low8 = 1;

        this.mbc5High1 = 0;


        /*
         * RTC placeholder.
         *
         * Pokémon Yellow nie potrzebuje RTC,
         * ale MBC3 obsługujemy dla kompatybilności.
         */

        this.rtc = {

            seconds: 0,
            minutes: 0,
            hours: 0,
            days: 0,

            halt: false,
            carry: false

        };

    }


    /*
     * ========================================================
     * LOAD ROM
     * ========================================================
     */

    load(buffer) {

        if (
            buffer instanceof ArrayBuffer
        ) {

            this.rom =
                new Uint8Array(
                    buffer
                );

        } else if (
            buffer instanceof Uint8Array
        ) {

            this.rom =
                buffer;

        } else {

            throw new Error(
                "Cartridge: nieprawidłowy ROM."
            );

        }


        if (
            this.rom.length <
            0x150
        ) {

            throw new Error(
                "Cartridge: ROM jest za mały."
            );

        }


        this.readHeader();

        this.allocateRAM();

        this.resetMapper();


        console.log(
            "[WebBktx] Cartridge:",
            this.title,
            this.mbc,
            "ROM:",
            this.rom.length,
            "bytes"
        );

    }


    /*
     * ========================================================
     * HEADER
     * ========================================================
     */

    readHeader() {

        /*
         * Title: 0x0134 - 0x0143
         */

        let title = "";


        for (
            let i = 0x134;
            i <= 0x143;
            i++
        ) {

            const c =
                this.rom[i];


            if (
                c === 0
            ) {

                break;

            }


            if (
                c >= 32 &&
                c <= 126
            ) {

                title +=
                    String.fromCharCode(c);

            }

        }


        this.title =
            title.trim();


        /*
         * Cartridge type
         */

        this.type =
            this.rom[0x147];


        /*
         * ROM size
         */

        this.romSizeCode =
            this.rom[0x148];


        /*
         * RAM size
         */

        this.ramSizeCode =
            this.rom[0x149];


        this.romBanks =
            this.getROMBankCount(
                this.romSizeCode
            );


        this.ramBanks =
            this.getRAMBankCount(
                this.ramSizeCode
            );


        /*
         * Detect mapper.
         */

        this.mbc =
            this.detectMBC(
                this.type
            );

    }


    /*
     * ========================================================
     * MAPPER
     * ========================================================
     */

    detectMBC(
        type
    ) {

        switch (
            type
        ) {

            /*
             * ROM ONLY
             */

            case 0x00:
                return "ROM";


            /*
             * MBC1
             */

            case 0x01:
            case 0x02:
            case 0x03:
                return "MBC1";


            /*
             * MBC2
             */

            case 0x05:
            case 0x06:
                return "MBC2";


            /*
             * MBC3
             */

            case 0x0F:
            case 0x10:
            case 0x11:
            case 0x12:
            case 0x13:
                return "MBC3";


            /*
             * MBC5
             */

            case 0x19:
            case 0x1A:
            case 0x1B:
            case 0x1C:
            case 0x1D:
            case 0x1E:
                return "MBC5";


            default:

                console.warn(
                    "[WebBktx] Nieznany cartridge type:",
                    "0x" +
                    type
                        .toString(16)
                        .padStart(2, "0")
                );


                return "ROM";

        }

    }


    /*
     * ========================================================
     * ROM SIZE
     * ========================================================
     */

    getROMBankCount(
        code
    ) {

        /*
         * Standard Game Boy ROM sizes.
         */

        if (
            code <= 0x08
        ) {

            return 2 << code;

        }


        /*
         * Special sizes:
         *
         * 0x52 = 72 banks
         * 0x53 = 80 banks
         * 0x54 = 96 banks
         */

        switch (
            code
        ) {

            case 0x52:
                return 72;

            case 0x53:
                return 80;

            case 0x54:
                return 96;

            default:
                return 2;

        }

    }


    /*
     * ========================================================
     * RAM SIZE
     * ========================================================
     */

    getRAMBankCount(
        code
    ) {

        switch (
            code
        ) {

            case 0x00:
                return 0;

            case 0x01:
                return 1;

            case 0x02:
                return 1;

            case 0x03:
                return 4;

            case 0x04:
                return 16;

            case 0x05:
                return 8;

            default:
                return 0;

        }

    }


    /*
     * ========================================================
     * RAM ALLOCATION
     * ========================================================
     */

    allocateRAM() {

        let size = 0;


        switch (
            this.ramSizeCode
        ) {

            case 0x00:
                size = 0;
                break;

            case 0x01:
                size = 2 * 1024;
                break;

            case 0x02:
                size = 8 * 1024;
                break;

            case 0x03:
                size = 32 * 1024;
                break;

            case 0x04:
                size = 128 * 1024;
                break;

            case 0x05:
                size = 64 * 1024;
                break;

            default:
                size = 0;

        }


        /*
         * MBC2 has internal 512 × 4-bit RAM.
         */

        if (
            this.mbc === "MBC2"
        ) {

            size =
                512;

        }


        if (
            size > 0
        ) {

            this.ram =
                new Uint8Array(
                    size
                );

        } else {

            this.ram =
                null;

        }


        /*
         * RAM starts as FF.
         */

        if (
            this.ram
        ) {

            this.ram.fill(
                0xFF
            );

        }

    }


    /*
     * ========================================================
     * RESET
     * ========================================================
     */

    resetMapper() {

        this.romBank =
            1;

        this.ramBank =
            0;

        this.ramEnabled =
            false;

        this.mode =
            0;


        this.mbc1Low5 =
            1;

        this.mbc1High2 =
            0;


        this.mbc5Low8 =
            1;

        this.mbc5High1 =
            0;

    }


    /*
     * ========================================================
     * READ
     * ========================================================
     *
     * CPU address:
     *
     * 0000-3FFF = fixed ROM bank
     * 4000-7FFF = switchable ROM bank
     * A000-BFFF = cartridge RAM
     *
     * ========================================================
     */

    read(
        address
    ) {

        address &=
            0xFFFF;


        /*
         * Fixed ROM area.
         */

        if (
            address < 0x4000
        ) {

            let bank =
                this.getFixedROMBank();


            const offset =
                bank *
                0x4000 +
                address;


            return this.rom[offset]
                ?? 0xFF;

        }


        /*
         * Switchable ROM area.
         */

        if (
            address < 0x8000
        ) {

            const bank =
                this.getSwitchableROMBank();


            const offset =
                bank *
                0x4000 +
                (
                    address -
                    0x4000
                );


            return this.rom[offset]
                ?? 0xFF;

        }


        /*
         * External RAM.
         */

        if (
            address >= 0xA000 &&
            address < 0xC000
        ) {

            return this.readRAM(
                address -
                0xA000
            );

        }


        return 0xFF;

    }


    /*
     * ========================================================
     * WRITE
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


        /*
         * Cartridge control area.
         */

        if (
            address < 0x8000
        ) {

            this.writeMapper(
                address,
                value
            );

            return;

        }


        /*
         * External RAM.
         */

        if (
            address >= 0xA000 &&
            address < 0xC000
        ) {

            this.writeRAM(
                address -
                0xA000,
                value
            );

        }

    }


    /*
     * ========================================================
     * MAPPER WRITE
     * ========================================================
     */

    writeMapper(
        address,
        value
    ) {

        switch (
            this.mbc
        ) {

            case "MBC1":

                this.writeMBC1(
                    address,
                    value
                );

                break;


            case "MBC2":

                this.writeMBC2(
                    address,
                    value
                );

                break;


            case "MBC3":

                this.writeMBC3(
                    address,
                    value
                );

                break;


            case "MBC5":

                this.writeMBC5(
                    address,
                    value
                );

                break;


            case "ROM":

                /*
                 * ROM-only cartridges ignore writes.
                 */

                break;

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

        if (
            address < 0x2000
        ) {

            this.ramEnabled =
                (
                    value & 0x0F
                ) === 0x0A;

            return;

        }


        if (
            address < 0x4000
        ) {

            this.mbc1Low5 =
                value & 0x1F;


            if (
                this.mbc1Low5 === 0
            ) {

                this.mbc1Low5 =
                    1;

            }


            return;

        }


        if (
            address < 0x6000
        ) {

            this.mbc1High2 =
                value & 0x03;

            return;

        }


        this.mode =
            value & 1;

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
            address < 0x4000
        ) {

            /*
             * A8 determines operation.
             */

            if (
                (
                    address &
                    0x0100
                ) === 0
            ) {

                this.ramEnabled =
                    (
                        value & 0x0F
                    ) === 0x0A;

            } else {

                let bank =
                    value & 0x0F;


                if (
                    bank === 0
                ) {

                    bank = 1;

                }


                this.romBank =
                    bank;

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
            address < 0x2000
        ) {

            this.ramEnabled =
                (
                    value & 0x0F
                ) === 0x0A;

            return;

        }


        if (
            address < 0x4000
        ) {

            let bank =
                value & 0x7F;


            if (
                bank === 0
            ) {

                bank = 1;

            }


            this.romBank =
                bank;


            return;

        }


        if (
            address < 0x6000
        ) {

            this.ramBank =
                value;


            return;

        }


        /*
         * RTC latch.
         *
         * Basic implementation.
         */

        if (
            address >= 0x6000
        ) {

            /*
             * 0 -> 1 latches RTC.
             */

            if (
                value === 1
            ) {

                this.updateRTC();

            }

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

        /*
         * RAM enable
         */

        if (
            address < 0x2000
        ) {

            this.ramEnabled =
                (
                    value & 0x0F
                ) === 0x0A;

            return;

        }


        /*
         * ROM bank low 8 bits
         */

        if (
            address < 0x3000
        ) {

            this.mbc5Low8 =
                value;

            this.updateMBC5Bank();

            return;

        }


        /*
         * ROM bank bit 8
         */

        if (
            address < 0x4000
        ) {

            this.mbc5High1 =
                value & 1;

            this.updateMBC5Bank();

            return;

        }


        /*
         * RAM bank
         */

        if (
            address < 0x6000
        ) {

            this.ramBank =
                value & 0x0F;

        }

    }


    /*
     * ========================================================
     * MBC5 BANK
     * ========================================================
     */

    updateMBC5Bank() {

        this.romBank =
            (
                this.mbc5High1 << 8
            ) |
            this.mbc5Low8;


        this.romBank %=
            Math.max(
                1,
                this.romBanks
            );

    }


    /*
     * ========================================================
     * FIXED ROM BANK
     * ========================================================
     */

    getFixedROMBank() {

        if (
            this.mbc === "MBC1" &&
            this.mode === 1
        ) {

            return (
                this.mbc1High2 << 5
            ) %
            this.romBanks;

        }


        return 0;

    }


    /*
     * ========================================================
     * SWITCHABLE ROM BANK
     * ========================================================
     */

    getSwitchableROMBank() {

        let bank =
            this.romBank;


        if (
            this.mbc === "MBC1"
        ) {

            bank =
                this.mbc1Low5;


            if (
                this.mode === 0
            ) {

                bank |=
                    this.mbc1High2 << 5;

            }


            bank %=
                this.romBanks;


            if (
                bank === 0
            ) {

                bank = 1;

            }

        }


        if (
            this.mbc === "MBC2"
        ) {

            bank %=
                16;

            if (
                bank === 0
            ) {

                bank = 1;

            }

        }


        if (
            this.mbc === "MBC3"
        ) {

            bank %=
                this.romBanks;

            if (
                bank === 0
            ) {

                bank = 1;

            }

        }


        if (
            this.mbc === "MBC5"
        ) {

            bank %=
                this.romBanks;

        }


        return bank;

    }


    /*
     * ========================================================
     * RAM READ
     * ========================================================
     */

    readRAM(
        offset
    ) {

        if (
            !this.ram ||
            !this.ramEnabled
        ) {

            return 0xFF;

        }


        /*
         * MBC3 RTC registers.
         */

        if (
            this.mbc === "MBC3" &&
            this.ramBank >= 0x08 &&
            this.ramBank <= 0x0C
        ) {

            return this.readRTC(
                this.ramBank
            );

        }


        if (
            this.mbc === "MBC2"
        ) {

            const index =
                offset & 0x01FF;


            return (
                this.ram[index] |
                0xF0
            );

        }


        const bank =
            this.getRAMBank();


        const index =
            bank *
            0x2000 +
            offset;


        if (
            index >= this.ram.length
        ) {

            return 0xFF;

        }


        return this.ram[index];

    }


    /*
     * ========================================================
     * RAM WRITE
     * ========================================================
     */

    writeRAM(
        offset,
        value
    ) {

        if (
            !this.ram ||
            !this.ramEnabled
        ) {

            return;

        }


        /*
         * MBC3 RTC.
         */

        if (
            this.mbc === "MBC3" &&
            this.ramBank >= 0x08 &&
            this.ramBank <= 0x0C
        ) {

            this.writeRTC(
                this.ramBank,
                value
            );

            return;

        }


        /*
         * MBC2 = only lower 4 bits.
         */

        if (
            this.mbc === "MBC2"
        ) {

            this.ram[
                offset & 0x01FF
            ] =
                value & 0x0F;

            return;

        }


        const bank =
            this.getRAMBank();


        const index =
            bank *
            0x2000 +
            offset;


        if (
            index >= this.ram.length
        ) {

            return;

        }


        this.ram[index] =
            value;

    }


    /*
     * ========================================================
     * RAM BANK
     * ========================================================
     */

    getRAMBank() {

        if (
            this.mbc === "MBC1"
        ) {

            if (
                this.mode === 1
            ) {

                return (
                    this.mbc1High2
                ) %
                Math.max(
                    1,
                    this.ramBanks
                );

            }


            return 0;

        }


        if (
            this.mbc === "MBC2"
        ) {

            return 0;

        }


        if (
            this.mbc === "MBC3"
        ) {

            return (
                this.ramBank
            ) %
            Math.max(
                1,
                this.ramBanks
            );

        }


        if (
            this.mbc === "MBC5"
        ) {

            return (
                this.ramBank
            ) %
            Math.max(
                1,
                this.ramBanks
            );

        }


        return 0;

    }


    /*
     * ========================================================
     * RTC
     * ========================================================
     */

    updateRTC() {

        /*
         * Minimal RTC implementation.
         *
         * Full RTC persistence can be added later.
         */

        const now =
            new Date();


        this.rtc.seconds =
            now.getUTCSeconds();


        this.rtc.minutes =
            now.getUTCMinutes();


        this.rtc.hours =
            now.getUTCHours();


        this.rtc.days =
            Math.floor(
                Date.now() /
                86400000
            );

    }


    readRTC(
        register
    ) {

        switch (
            register
        ) {

            case 0x08:
                return this.rtc.seconds;

            case 0x09:
                return this.rtc.minutes;

            case 0x0A:
                return this.rtc.hours;

            case 0x0B:
                return this.rtc.days & 0xFF;

            case 0x0C:

                return (
                    (
                        this.rtc.days >>
                        8
                    ) & 1
                ) |
                (
                    this.rtc.halt
                        ? 0x40
                        : 0
                ) |
                (
                    this.rtc.carry
                        ? 0x80
                        : 0
                );

        }


        return 0xFF;

    }


    writeRTC(
        register,
        value
    ) {

        switch (
            register
        ) {

            case 0x08:
                this.rtc.seconds =
                    value % 60;
                break;

            case 0x09:
                this.rtc.minutes =
                    value % 60;
                break;

            case 0x0A:
                this.rtc.hours =
                    value % 24;
                break;

            case 0x0B:

                this.rtc.days =
                    (
                        this.rtc.days &
                        0x100
                    ) |
                    value;

                break;

            case 0x0C:

                this.rtc.days =
                    (
                        this.rtc.days &
                        0xFF
                    ) |
                    (
                        (value & 1)
                        << 8
                    );


                this.rtc.halt =
                    Boolean(
                        value & 0x40
                    );


                this.rtc.carry =
                    Boolean(
                        value & 0x80
                    );

                break;

        }

    }


    /*
     * ========================================================
     * BATTERY SAVE
     * ========================================================
     */

    exportRAM() {

        if (
            !this.ram
        ) {

            return null;

        }


        return new Uint8Array(
            this.ram
        );

    }


    importRAM(
        data
    ) {

        if (
            !this.ram ||
            !data
        ) {

            return;

        }


        const source =
            data instanceof Uint8Array
                ? data
                : new Uint8Array(data);


        this.ram.set(
            source.subarray(
                0,
                this.ram.length
            )
        );

    }


    /*
     * ========================================================
     * INFORMATION
     * ========================================================
     */

    getInfo() {

        return {

            title:
                this.title,

            type:
                this.type,

            mbc:
                this.mbc,

            romSize:
                this.rom.length,

            romBanks:
                this.romBanks,

            ramSize:
                this.ram
                    ? this.ram.length
                    : 0,

            ramBanks:
                this.ramBanks,

            romBank:
                this.getSwitchableROMBank(),

            ramBank:
                this.getRAMBank(),

            ramEnabled:
                this.ramEnabled

        };

    }

}
