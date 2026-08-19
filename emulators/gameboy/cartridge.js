/*
 * ============================================================
 * WebBktx — Game Boy Cartridge
 * cartridge.js
 * ============================================================
 *
 * Obsługa:
 *
 * DMG
 * GBC ROM-y mogą zostać załadowane, ale emulator pracuje
 * w trybie DMG.
 *
 * MBC:
 *   ROM ONLY
 *   MBC1
 *   MBC2
 *   MBC3
 *   MBC5
 *
 * RAM:
 *   brak
 *   2 KB
 *   8 KB
 *   32 KB
 *   64 KB
 *   128 KB
 *
 * Pokémon Yellow:
 *   MBC5
 *   ROM 1 MB
 *   RAM 32 KB
 *
 * ============================================================
 */

export default class Cartridge {

    constructor() {

        /*
         * ----------------------------------------------------
         * ROM
         * ----------------------------------------------------
         */

        this.rom =
            null;

        this.romSize =
            0;

        this.romBanks =
            0;


        /*
         * ----------------------------------------------------
         * RAM
         * ----------------------------------------------------
         */

        this.ram =
            null;

        this.ramSize =
            0;

        this.ramBanks =
            0;


        /*
         * ----------------------------------------------------
         * Cartridge info
         * ----------------------------------------------------
         */

        this.title =
            "";

        this.type =
            0x00;

        this.typeName =
            "ROM ONLY";

        this.manufacturer =
            "";

        this.version =
            0;


        /*
         * ----------------------------------------------------
         * MBC
         * ----------------------------------------------------
         */

        this.mbc =
            "ROM";

        this.ramEnabled =
            false;


        /*
         * ----------------------------------------------------
         * MBC1
         * ----------------------------------------------------
         */

        this.mbc1RomBank =
            1;

        this.mbc1RamBank =
            0;

        this.mbc1Mode =
            0;


        /*
         * ----------------------------------------------------
         * MBC2
         * ----------------------------------------------------
         */

        this.mbc2RomBank =
            1;


        /*
         * ----------------------------------------------------
         * MBC3
         * ----------------------------------------------------
         */

        this.mbc3RomBank =
            1;

        this.mbc3RamBank =
            0;


        /*
         * ----------------------------------------------------
         * MBC5
         * ----------------------------------------------------
         */

        this.mbc5RomBank =
            1;

        this.mbc5RomHigh =
            0;

        this.mbc5RamBank =
            0;


        /*
         * ----------------------------------------------------
         * RTC
         * ----------------------------------------------------
         */

        this.rtc =
            new Uint8Array(5);


        this.rtcSelected =
            false;


        /*
         * ----------------------------------------------------
         * Battery
         * ----------------------------------------------------
         */

        this.hasBattery =
            false;

        this.hasRAM =
            false;

        this.hasRTC =
            false;


        /*
         * ----------------------------------------------------
         * Debug
         * ----------------------------------------------------
         */

        this.debug =
            false;

    }


    /*
     * ========================================================
     * LOAD ROM
     * ========================================================
     */

    load(
        data
    ) {

        if (
            data instanceof ArrayBuffer
        ) {

            data =
                new Uint8Array(
                    data
                );

        }


        if (
            ArrayBuffer.isView(data)
        ) {

            data =
                new Uint8Array(
                    data.buffer,
                    data.byteOffset,
                    data.byteLength
                );

        }


        if (
            !data ||
            data.length < 0x150
        ) {

            throw new Error(
                "ROM jest za mały lub nieprawidłowy."
            );

        }


        /*
         * Kopiujemy ROM.
         *
         * Nie przechowujemy obcego ArrayBuffer,
         * który może zostać zmieniony przez UI.
         */

        this.rom =
            new Uint8Array(
                data.length
            );


        this.rom.set(
            data
        );


        this.romSize =
            this.rom.length;


        this.readHeader();


        this.resetMBC();


        this.log(
            "Cartridge: " +
            this.title +
            " " +
            this.typeName +
            " ROM: " +
            this.romSize +
            " bytes"
        );


        return true;

    }


    /*
     * ========================================================
     * LOAD ROM ALIAS
     * ========================================================
     */

    loadROM(
        data
    ) {

        return this.load(
            data
        );

    }


    /*
     * ========================================================
     * INSERT
     * ========================================================
     */

    insert(
        data
    ) {

        return this.load(
            data
        );

    }


    /*
     * ========================================================
     * READ HEADER
     * ========================================================
     */

    readHeader() {

        if (
            !this.rom
        ) {

            throw new Error(
                "Brak ROM."
            );

        }


        /*
         * Title:
         *
         * 0134-0143
         */

        let title =
            "";


        for (
            let i = 0x134;
            i <= 0x143;
            i++
        ) {

            const value =
                this.rom[i];


            if (
                value === 0
            ) {

                continue;

            }


            if (
                value >= 32 &&
                value <= 126
            ) {

                title +=
                    String.fromCharCode(
                        value
                    );

            }

        }


        this.title =
            title
                .replace(
                    /\0/g,
                    ""
                )
                .trim();


        /*
         * Old/new GBC flag.
         */

        const gbcFlag =
            this.rom[0x143] ?? 0;


        /*
         * Cartridge type.
         */

        this.type =
            this.rom[0x147] ?? 0;


        /*
         * ROM size.
         */

        const romSizeCode =
            this.rom[0x148] ?? 0;


        this.romBanks =
            this.decodeROMBanks(
                romSizeCode
            );


        /*
         * RAM size.
         */

        const ramSizeCode =
            this.rom[0x149] ?? 0;


        this.ramSize =
            this.decodeRAMSize(
                ramSizeCode
            );


        this.ramBanks =
            this.ramSize > 0
                ? Math.ceil(
                    this.ramSize /
                    0x2000
                )
                : 0;


        /*
         * Cartridge type.
         */

        this.decodeType(
            this.type
        );


        /*
         * Manufacturer.
         *
         * Newer cartridges contain
         * manufacturer data at 013F-0142.
         */

        let manufacturer =
            "";


        for (
            let i = 0x13F;
            i <= 0x142;
            i++
        ) {

            const value =
                this.rom[i];


            if (
                value >= 32 &&
                value <= 126
            ) {

                manufacturer +=
                    String.fromCharCode(
                        value
                    );

            }

        }


        this.manufacturer =
            manufacturer.trim();


        /*
         * Version.
         */

        this.version =
            this.rom[0x14C] ?? 0;


        /*
         * GBC flag isn't used by DMG PPU,
         * but keep it available.
         */

        this.isGBC =
            gbcFlag === 0x80 ||
            gbcFlag === 0xC0;

    }


    /*
     * ========================================================
     * ROM BANK COUNT
     * ========================================================
     */

    decodeROMBanks(
        code
    ) {

        const table = {

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


        if (
            table[code]
        ) {

            return table[code];

        }


        /*
         * Fallback based on actual ROM.
         */

        return Math.max(
            1,
            Math.ceil(
                this.romSize /
                0x4000
            )
        );

    }


    /*
     * ========================================================
     * RAM SIZE
     * ========================================================
     */

    decodeRAMSize(
        code
    ) {

        switch (
            code
        ) {

            case 0x00:
                return 0;

            case 0x01:
                return 0x0800;

            case 0x02:
                return 0x2000;

            case 0x03:
                return 0x8000;

            case 0x04:
                return 0x20000;

            case 0x05:
                return 0x10000;

            default:
                return 0;

        }

    }


    /*
     * ========================================================
     * CARTRIDGE TYPE
     * ========================================================
     */

    decodeType(
        type
    ) {

        this.mbc =
            "ROM";

        this.typeName =
            "ROM ONLY";

        this.hasRAM =
            false;

        this.hasBattery =
            false;

        this.hasRTC =
            false;


        switch (
            type
        ) {

            /*
             * ------------------------------------------------
             * ROM ONLY
             * ------------------------------------------------
             */

            case 0x00:

                this.mbc =
                    "ROM";

                this.typeName =
                    "ROM ONLY";

                break;


            /*
             * ------------------------------------------------
             * MBC1
             * ------------------------------------------------
             */

            case 0x01:

                this.mbc =
                    "MBC1";

                this.typeName =
                    "MBC1";

                break;


            case 0x02:

                this.mbc =
                    "MBC1";

                this.hasRAM =
                    true;

                this.typeName =
                    "MBC1+RAM";

                break;


            case 0x03:

                this.mbc =
                    "MBC1";

                this.hasRAM =
                    true;

                this.hasBattery =
                    true;

                this.typeName =
                    "MBC1+RAM+BATTERY";

                break;


            /*
             * ------------------------------------------------
             * MBC2
             * ------------------------------------------------
             */

            case 0x05:

                this.mbc =
                    "MBC2";

                this.typeName =
                    "MBC2";

                this.ramSize =
                    0x200;

                this.ramBanks =
                    1;

                break;


            case 0x06:

                this.mbc =
                    "MBC2";

                this.typeName =
                    "MBC2+BATTERY";

                this.ramSize =
                    0x200;

                this.ramBanks =
                    1;

                this.hasBattery =
                    true;

                break;


            /*
             * ------------------------------------------------
             * MBC3
             * ------------------------------------------------
             */

            case 0x0F:

                this.mbc =
                    "MBC3";

                this.hasRTC =
                    true;

                this.hasBattery =
                    true;

                this.typeName =
                    "MBC3+TIMER+BATTERY";

                break;


            case 0x10:

                this.mbc =
                    "MBC3";

                this.hasRAM =
                    true;

                this.hasRTC =
                    true;

                this.hasBattery =
                    true;

                this.typeName =
                    "MBC3+TIMER+RAM+BATTERY";

                break;


            case 0x11:

                this.mbc =
                    "MBC3";

                this.typeName =
                    "MBC3";

                break;


            case 0x12:

                this.mbc =
                    "MBC3";

                this.hasRAM =
                    true;

                this.typeName =
                    "MBC3+RAM";

                break;


            case 0x13:

                this.mbc =
                    "MBC3";

                this.hasRAM =
                    true;

                this.hasBattery =
                    true;

                this.typeName =
                    "MBC3+RAM+BATTERY";

                break;


            /*
             * ------------------------------------------------
             * MBC5
             * ------------------------------------------------
             */

            case 0x19:

                this.mbc =
                    "MBC5";

                this.typeName =
                    "MBC5";

                break;


            case 0x1A:

                this.mbc =
                    "MBC5";

                this.hasRAM =
                    true;

                this.typeName =
                    "MBC5+RAM";

                break;


            case 0x1B:

                this.mbc =
                    "MBC5";

                this.hasRAM =
                    true;

                this.hasBattery =
                    true;

                this.typeName =
                    "MBC5+RAM+BATTERY";

                break;


            case 0x1C:

                this.mbc =
                    "MBC5";

                this.typeName =
                    "MBC5+RUMBLE";

                break;


            case 0x1D:

                this.mbc =
                    "MBC5";

                this.hasRAM =
                    true;

                this.typeName =
                    "MBC5+RUMBLE+RAM";

                break;


            case 0x1E:

                this.mbc =
                    "MBC5";

                this.hasRAM =
                    true;

                this.hasBattery =
                    true;

                this.typeName =
                    "MBC5+RUMBLE+RAM+BATTERY";

                break;


            default:

                /*
                 * Nieznany typ.
                 *
                 * Lepiej potraktować go jako ROM
                 * niż dopuścić do null reference.
                 */

                this.mbc =
                    "ROM";

                this.typeName =
                    "UNKNOWN";

                break;

        }

    }


    /*
     * ========================================================
     * RESET MBC
     * ========================================================
     */

    resetMBC() {

        this.ramEnabled =
            false;


        this.mbc1RomBank =
            1;

        this.mbc1RamBank =
            0;

        this.mbc1Mode =
            0;


        this.mbc2RomBank =
            1;


        this.mbc3RomBank =
            1;

        this.mbc3RamBank =
            0;


        this.mbc5RomBank =
            1;

        this.mbc5RomHigh =
            0;

        this.mbc5RamBank =
            0;


        this.rtcSelected =
            false;


        /*
         * Zawsze zapewnij RAM, jeśli cartridge
         * deklaruje RAM.
         */

        if (
            this.ramSize > 0
        ) {

            this.ram =
                new Uint8Array(
                    this.ramSize
                );

        } else {

            this.ram =
                null;

        }

    }


    /*
     * ========================================================
     * READ
     * ========================================================
     *
     * Memory bus może wywoływać:
     *
     * cartridge.read(address)
     *
     * ========================================================
     */

    read(
        address
    ) {

        address &=
            0xFFFF;


        /*
         * ROM nie może być null.
         */

        if (
            !this.rom
        ) {

            return 0xFF;

        }


        /*
         * 0000-7FFF
         *
         * ROM
         */

        if (
            address <=
            0x7FFF
        ) {

            return this.readROM(
                address
            );

        }


        /*
         * A000-BFFF
         *
         * Cartridge RAM
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
     * READ ROM
     * ========================================================
     */

    readROM(
        address
    ) {

        if (
            !this.rom ||
            this.rom.length === 0
        ) {

            return 0xFF;

        }


        let bank =
            0;


        let offset =
            0;


        /*
         * ----------------------------------------------------
         * ROM ONLY
         * ----------------------------------------------------
         */

        if (
            this.mbc ===
            "ROM"
        ) {

            if (
                address < 0x4000
            ) {

                offset =
                    address;

            } else {

                /*
                 * Przy małych ROM-ach bank 1 może nie istnieć.
                 */

                bank =
                    1 % Math.max(
                        1,
                        this.romBanks
                    );

                offset =
                    (
                        bank *
                        0x4000
                    ) +
                    (
                        address -
                        0x4000
                    );

            }

        }


        /*
         * ----------------------------------------------------
         * MBC1
         * ----------------------------------------------------
         */

        else if (
            this.mbc ===
            "MBC1"
        ) {

            if (
                address < 0x4000
            ) {

                if (
                    this.mbc1Mode ===
                    0
                ) {

                    bank =
                        0;

                } else {

                    bank =
                        (
                            this.mbc1RamBank <<
                            5
                        );

                }

                bank %=
                    Math.max(
                        1,
                        this.romBanks
                    );


                offset =
                    (
                        bank *
                        0x4000
                    ) +
                    address;

            } else {

                bank =
                    (
                        this.mbc1RomBank &
                        0x1F
                    ) ||
                    1;


                bank |=
                    (
                        this.mbc1RamBank <<
                        5
                    );


                bank %=
                    Math.max(
                        1,
                        this.romBanks
                    );


                offset =
                    (
                        bank *
                        0x4000
                    ) +
                    (
                        address -
                        0x4000
                    );

            }

        }


        /*
         * ----------------------------------------------------
         * MBC2
         * ----------------------------------------------------
         */

        else if (
            this.mbc ===
            "MBC2"
        ) {

            if (
                address < 0x4000
            ) {

                offset =
                    address;

            } else {

                bank =
                    this.mbc2RomBank &
                    0x0F;


                if (
                    bank ===
                    0
                ) {

                    bank =
                        1;

                }


                bank %=
                    Math.max(
                        1,
                        this.romBanks
                    );


                offset =
                    (
                        bank *
                        0x4000
                    ) +
                    (
                        address -
                        0x4000
                    );

            }

        }


        /*
         * ----------------------------------------------------
         * MBC3
         * ----------------------------------------------------
         */

        else if (
            this.mbc ===
            "MBC3"
        ) {

            if (
                address < 0x4000
            ) {

                offset =
                    address;

            } else {

                bank =
                    this.mbc3RomBank &
                    0x7F;


                if (
                    bank ===
                    0
                ) {

                    bank =
                        1;

                }


                bank %=
                    Math.max(
                        1,
                        this.romBanks
                    );


                offset =
                    (
                        bank *
                        0x4000
                    ) +
                    (
                        address -
                        0x4000
                    );

            }

        }


        /*
         * ----------------------------------------------------
         * MBC5
         * ----------------------------------------------------
         */

        else if (
            this.mbc ===
            "MBC5"
        ) {

            if (
                address < 0x4000
            ) {

                /*
                 * Bank 0.
                 */

                bank =
                    0;

                offset =
                    address;

            } else {

                /*
                 * MBC5 has 9-bit ROM bank.
                 */

                bank =
                    (
                        this.mbc5RomBank &
                        0xFF
                    ) |
                    (
                        (
                            this.mbc5RomHigh &
                            0x01
                        ) << 8
                    );


                bank %=
                    Math.max(
                        1,
                        this.romBanks
                    );


                offset =
                    (
                        bank *
                        0x4000
                    ) +
                    (
                        address -
                        0x4000
                    );

            }

        }


        /*
         * ----------------------------------------------------
         * SAFE ROM READ
         * ----------------------------------------------------
         *
         * To jest ważne dla Twojego wcześniejszego błędu.
         *
         * Nigdy nie zwracamy:
         *
         * this.rom[offset]
         *
         * bez sprawdzenia offsetu.
         *
         * ----------------------------------------------------
         */

        if (
            offset < 0 ||
            offset >=
            this.rom.length
        ) {

            return 0xFF;

        }


        return (
            this.rom[offset] ??
            0xFF
        ) & 0xFF;

    }


    /*
     * ========================================================
     * READ RAM
     * ========================================================
     */

    readRAM(
        address
    ) {

        /*
         * RAM disabled.
         */

        if (
            !this.ramEnabled
        ) {

            /*
             * MBC2 behaves slightly differently,
             * but FF is safe for generic access.
             */

            return 0xFF;

        }


        /*
         * MBC3 RTC registers.
         */

        if (
            this.mbc ===
            "MBC3" &&
            this.rtcSelected
        ) {

            return this.readRTC(
                this.mbc3RamBank
            );

        }


        /*
         * No RAM.
         */

        if (
            !this.ram ||
            this.ram.length === 0
        ) {

            return 0xFF;

        }


        let offset =
            address -
            0xA000;


        /*
         * MBC1 RAM banking.
         */

        if (
            this.mbc ===
            "MBC1"
        ) {

            let bank =
                0;


            if (
                this.mbc1Mode !==
                0
            ) {

                bank =
                    this.mbc1RamBank &
                    0x03;

            }


            offset +=
                bank *
                0x2000;

        }


        /*
         * MBC2 internal RAM.
         */

        else if (
            this.mbc ===
            "MBC2"
        ) {

            offset &=
                0x01FF;


            /*
             * MBC2 RAM stores only lower nibble.
             */

            return (
                this.ram[offset] |
                0xF0
            ) & 0xFF;

        }


        /*
         * MBC3 RAM.
         */

        else if (
            this.mbc ===
            "MBC3"
        ) {

            const bank =
                this.mbc3RamBank &
                0x03;


            offset +=
                bank *
                0x2000;

        }


        /*
         * MBC5 RAM.
         */

        else if (
            this.mbc ===
            "MBC5"
        ) {

            const bank =
                this.mbc5RamBank &
                0x0F;


            offset +=
                bank *
                0x2000;

        }


        if (
            offset < 0 ||
            offset >=
            this.ram.length
        ) {

            return 0xFF;

        }


        return (
            this.ram[offset] ??
            0xFF
        ) & 0xFF;

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


        if (
            address <=
            0x7FFF
        ) {

            this.writeControl(
                address,
                value
            );

            return;

        }


        if (
            address >= 0xA000 &&
            address <= 0xBFFF
        ) {

            this.writeRAM(
                address,
                value
            );

        }

    }


    /*
     * ========================================================
     * WRITE CONTROL
     * ========================================================
     */

    writeControl(
        address,
        value
    ) {

        /*
         * ROM ONLY.
         */

        if (
            this.mbc ===
            "ROM"
        ) {

            return;

        }


        /*
         * MBC1
         */

        if (
            this.mbc ===
            "MBC1"
        ) {

            /*
             * 0000-1FFF
             *
             * RAM enable.
             */

            if (
                address <=
                0x1FFF
            ) {

                this.ramEnabled =
                    (
                        value &
                        0x0F
                    ) ===
                    0x0A;

                return;

            }


            /*
             * 2000-3FFF
             *
             * ROM bank low 5 bits.
             */

            if (
                address <=
                0x3FFF
            ) {

                this.mbc1RomBank =
                    value &
                    0x1F;


                if (
                    this.mbc1RomBank ===
                    0
                ) {

                    this.mbc1RomBank =
                        1;

                }


                return;

            }


            /*
             * 4000-5FFF
             *
             * RAM bank / ROM high bits.
             */

            if (
                address <=
                0x5FFF
            ) {

                value &=
                    0x03;


                this.mbc1RamBank =
                    value;

                return;

            }


            /*
             * 6000-7FFF
             *
             * Banking mode.
             */

            if (
                address <=
                0x7FFF
            ) {

                this.mbc1Mode =
                    value &
                    0x01;

                return;

            }

        }


        /*
         * MBC2
         */

        if (
            this.mbc ===
            "MBC2"
        ) {

            if (
                address <=
                0x1FFF
            ) {

                /*
                 * A8 must be 0.
                 */

                if (
                    (
                        address &
                        0x0100
                    ) ===
                    0
                ) {

                    this.ramEnabled =
                        (
                            value &
                            0x0F
                        ) ===
                        0x0A;

                }


                return;

            }


            if (
                address <=
                0x3FFF
            ) {

                /*
                 * A8 must be 1.
                 */

                if (
                    (
                        address &
                        0x0100
                    ) !==
                    0
                ) {

                    this.mbc2RomBank =
                        value &
                        0x0F;


                    if (
                        this.mbc2RomBank ===
                        0
                    ) {

                        this.mbc2RomBank =
                            1;

                    }

                }


                return;

            }

        }


        /*
         * MBC3
         */

        if (
            this.mbc ===
            "MBC3"
        ) {

            if (
                address <=
                0x1FFF
            ) {

                this.ramEnabled =
                    (
                        value &
                        0x0F
                    ) ===
                    0x0A;

                return;

            }


            if (
                address <=
                0x3FFF
            ) {

                this.mbc3RomBank =
                    value &
                    0x7F;


                if (
                    this.mbc3RomBank ===
                    0
                ) {

                    this.mbc3RomBank =
                        1;

                }


                return;

            }


            if (
                address <=
                0x5FFF
            ) {

                this.mbc3RamBank =
                    value;


                this.rtcSelected =
                    value >= 0x08 &&
                    value <= 0x0C;


                return;

            }


            if (
                address <=
                0x7FFF
            ) {

                /*
                 * RTC latch command.
                 *
                 * Minimal implementation.
                 */

                return;

            }

        }


        /*
         * MBC5
         */

        if (
            this.mbc ===
            "MBC5"
        ) {

            /*
             * 0000-1FFF
             *
             * RAM enable.
             */

            if (
                address <=
                0x1FFF
            ) {

                this.ramEnabled =
                    (
                        value &
                        0x0F
                    ) ===
                    0x0A;

                return;

            }


            /*
             * 2000-2FFF
             *
             * ROM bank low 8 bits.
             */

            if (
                address <=
                0x2FFF
            ) {

                this.mbc5RomBank =
                    value &
                    0xFF;

                return;

            }


            /*
             * 3000-3FFF
             *
             * ROM bank bit 8.
             */

            if (
                address <=
                0x3FFF
            ) {

                this.mbc5RomHigh =
                    value &
                    0x01;

                return;

            }


            /*
             * 4000-5FFF
             *
             * RAM bank.
             */

            if (
                address <=
                0x5FFF
            ) {

                this.mbc5RamBank =
                    value &
                    0x0F;

                return;

            }


            /*
             * 6000-7FFF.
             *
             * Rumble/other control.
             */

            return;

        }

    }


    /*
     * ========================================================
     * WRITE RAM
     * ========================================================
     */

    writeRAM(
        address,
        value
    ) {

        if (
            !this.ramEnabled
        ) {

            return;

        }


        /*
         * MBC3 RTC.
         */

        if (
            this.mbc ===
            "MBC3" &&
            this.rtcSelected
        ) {

            this.writeRTC(
                this.mbc3RamBank,
                value
            );

            return;

        }


        /*
         * No RAM.
         */

        if (
            !this.ram ||
            this.ram.length === 0
        ) {

            return;

        }


        let offset =
            address -
            0xA000;


        /*
         * MBC1
         */

        if (
            this.mbc ===
            "MBC1"
        ) {

            let bank =
                0;


            if (
                this.mbc1Mode !==
                0
            ) {

                bank =
                    this.mbc1RamBank &
                    0x03;

            }


            offset +=
                bank *
                0x2000;

        }


        /*
         * MBC2
         */

        else if (
            this.mbc ===
            "MBC2"
        ) {

            offset &=
                0x01FF;


            /*
             * Only lower nibble exists.
             */

            this.ram[offset] =
                value &
                0x0F;

            return;

        }


        /*
         * MBC3
         */

        else if (
            this.mbc ===
            "MBC3"
        ) {

            const bank =
                this.mbc3RamBank &
                0x03;


            offset +=
                bank *
                0x2000;

        }


        /*
         * MBC5
         */

        else if (
            this.mbc ===
            "MBC5"
        ) {

            const bank =
                this.mbc5RamBank &
                0x0F;


            offset +=
                bank *
                0x2000;

        }


        if (
            offset < 0 ||
            offset >=
            this.ram.length
        ) {

            return;

        }


        this.ram[offset] =
            value & 0xFF;

    }


    /*
     * ========================================================
     * READ RTC
     * ========================================================
     */

    readRTC(
        register
    ) {

        const index =
            register -
            0x08;


        if (
            index < 0 ||
            index >= 5
        ) {

            return 0xFF;

        }


        return (
            this.rtc[index] ??
            0
        ) & 0xFF;

    }


    /*
     * ========================================================
     * WRITE RTC
     * ========================================================
     */

    writeRTC(
        register,
        value
    ) {

        const index =
            register -
            0x08;


        if (
            index < 0 ||
            index >= 5
        ) {

            return;

        }


        this.rtc[index] =
            value & 0xFF;

    }


    /*
     * ========================================================
     * SAVE RAM
     * ========================================================
     */

    getRAM() {

        if (
            !this.ram
        ) {

            return null;

        }


        return new Uint8Array(
            this.ram
        );

    }


    /*
     * ========================================================
     * LOAD RAM
     * ========================================================
     */

    setRAM(
        data
    ) {

        if (
            !data
        ) {

            return false;

        }


        if (
            data instanceof ArrayBuffer
        ) {

            data =
                new Uint8Array(
                    data
                );

        }


        if (
            !ArrayBuffer.isView(data)
        ) {

            return false;

        }


        /*
         * Jeżeli cartridge nie deklaruje RAM,
         * nie tworzymy go przypadkowo.
         */

        if (
            this.ramSize <= 0
        ) {

            return false;

        }


        if (
            !this.ram
        ) {

            this.ram =
                new Uint8Array(
                    this.ramSize
                );

        }


        this.ram.fill(
            0
        );


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
     * BATTERY STATE
     * ========================================================
     */

    getSaveState() {

        return {

            ram:
                this.getRAM(),

            rtc:
                new Uint8Array(
                    this.rtc
                ),

            ramEnabled:
                this.ramEnabled,

            mbc1RomBank:
                this.mbc1RomBank,

            mbc1RamBank:
                this.mbc1RamBank,

            mbc1Mode:
                this.mbc1Mode,

            mbc2RomBank:
                this.mbc2RomBank,

            mbc3RomBank:
                this.mbc3RomBank,

            mbc3RamBank:
                this.mbc3RamBank,

            mbc5RomBank:
                this.mbc5RomBank,

            mbc5RomHigh:
                this.mbc5RomHigh,

            mbc5RamBank:
                this.mbc5RamBank

        };

    }


    /*
     * ========================================================
     * LOAD SAVE STATE
     * ========================================================
     */

    setSaveState(
        state
    ) {

        if (
            !state
        ) {

            return false;

        }


        if (
            state.ram
        ) {

            this.setRAM(
                state.ram
            );

        }


        if (
            state.rtc
        ) {

            this.rtc.set(
                new Uint8Array(
                    state.rtc
                ).subarray(
                    0,
                    5
                )
            );

        }


        if (
            typeof state.ramEnabled ===
            "boolean"
        ) {

            this.ramEnabled =
                state.ramEnabled;

        }


        if (
            Number.isFinite(
                state.mbc1RomBank
            )
        ) {

            this.mbc1RomBank =
                state.mbc1RomBank;

        }


        if (
            Number.isFinite(
                state.mbc1RamBank
            )
        ) {

            this.mbc1RamBank =
                state.mbc1RamBank;

        }


        if (
            Number.isFinite(
                state.mbc1Mode
            )
        ) {

            this.mbc1Mode =
                state.mbc1Mode;

        }


        if (
            Number.isFinite(
                state.mbc2RomBank
            )
        ) {

            this.mbc2RomBank =
                state.mbc2RomBank;

        }


        if (
            Number.isFinite(
                state.mbc3RomBank
            )
        ) {

            this.mbc3RomBank =
                state.mbc3RomBank;

        }


        if (
            Number.isFinite(
                state.mbc3RamBank
            )
        ) {

            this.mbc3RamBank =
                state.mbc3RamBank;

        }


        if (
            Number.isFinite(
                state.mbc5RomBank
            )
        ) {

            this.mbc5RomBank =
                state.mbc5RomBank;

        }


        if (
            Number.isFinite(
                state.mbc5RomHigh
            )
        ) {

            this.mbc5RomHigh =
                state.mbc5RomHigh;

        }


        if (
            Number.isFinite(
                state.mbc5RamBank
            )
        ) {

            this.mbc5RamBank =
                state.mbc5RamBank;

        }


        return true;

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

            type:
                this.type,

            typeName:
                this.typeName,

            mbc:
                this.mbc,

            romSize:
                this.romSize,

            romBanks:
                this.romBanks,

            ramSize:
                this.ramSize,

            ramBanks:
                this.ramBanks,

            ramEnabled:
                this.ramEnabled,

            battery:
                this.hasBattery,

            rtc:
                this.hasRTC,

            gbc:
                Boolean(
                    this.isGBC
                ),

            bankROM:
                this.getCurrentROMBank(),

            bankRAM:
                this.getCurrentRAMBank()

        };

    }


    /*
     * ========================================================
     * CURRENT ROM BANK
     * ========================================================
     */

    getCurrentROMBank() {

        switch (
            this.mbc
        ) {

            case "MBC1":

                return (
                    this.mbc1RomBank &
                    0x1F
                ) |
                (
                    (
                        this.mbc1RamBank &
                        0x03
                    ) << 5
                );


            case "MBC2":

                return (
                    this.mbc2RomBank &
                    0x0F
                );


            case "MBC3":

                return (
                    this.mbc3RomBank &
                    0x7F
                );


            case "MBC5":

                return (
                    this.mbc5RomBank &
                    0xFF
                ) |
                (
                    (
                        this.mbc5RomHigh &
                        1
                    ) << 8
                );


            default:

                return 0;

        }

    }


    /*
     * ========================================================
     * CURRENT RAM BANK
     * ========================================================
     */

    getCurrentRAMBank() {

        switch (
            this.mbc
        ) {

            case "MBC1":

                return this.mbc1RamBank & 3;

            case "MBC3":

                return this.mbc3RamBank & 3;

            case "MBC5":

                return this.mbc5RamBank & 0x0F;

            default:

                return 0;

        }

    }


    /*
     * ========================================================
     * HAS ROM
     * ========================================================
     */

    hasROM() {

        return Boolean(
            this.rom &&
            this.rom.length > 0
        );

    }


    /*
     * ========================================================
     * GET ROM
     * ========================================================
     */

    getROM() {

        return this.rom;

    }


    /*
     * ========================================================
     * RESET
     * ========================================================
     */

    reset() {

        this.resetMBC();

    }


    /*
     * ========================================================
     * DEBUG
     * ========================================================
     */

    setDebug(
        value
    ) {

        this.debug =
            Boolean(
                value
            );

    }


    /*
     * ========================================================
     * LOG
     * ========================================================
     */

    log(
        message
    ) {

        if (
            !this.debug
        ) {

            /*
             * Cartridge load information
             * is still useful for emulator logs.
             */

            console.log(
                "[WebBktx] " +
                message
            );

            return;

        }


        console.log(
            "[WebBktx] " +
            message
        );

    }

}
