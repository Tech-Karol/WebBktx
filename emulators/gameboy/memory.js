/*
 * WebBktx Game Boy Memory Bus
 * DMG compatible
 *
 * Kompatybilne API:
 *   readByte()
 *   writeByte()
 *   readWord()
 *   writeWord()
 *   connectCartridge()
 *   connectPPU()
 *   connectTimer()
 *   connectInput()
 *   connectAudio()
 */

export default class GameBoyMemory {

    constructor() {

        this.wram = new Uint8Array(0x2000);
        this.hram = new Uint8Array(0x7F);

        this.vram = new Uint8Array(0x2000);
        this.oam = new Uint8Array(0xA0);

        this.io = new Uint8Array(0x80);

        this.cartridge = null;

        this.ppu = null;
        this.timer = null;
        this.input = null;
        this.audio = null;

        this.interruptEnable = 0;
        this.interruptFlags = 0xE1;

        this.joyp = 0xCF;

        this.serialData = 0;
        this.serialControl = 0;

        this.lastRead = 0;
        this.lastWrite = 0;

        this.reset();

    }


    /* ========================================================
       CONNECTIONS
       ======================================================== */

    connectCartridge(cartridge) {
        this.cartridge = cartridge;
    }

    connectPPU(ppu) {

        this.ppu = ppu;

        if (ppu) {

            ppu.memory = this;

            ppu.vram = this.vram;
            ppu.oam = this.oam;

            if (typeof ppu.setInterruptCallback === "function") {

                ppu.setInterruptCallback((bit) => {

                    this.requestInterrupt(bit);

                });

            }

        }

    }

    connectTimer(timer) {

        this.timer = timer;

        if (
            timer &&
            typeof timer.setInterruptCallback === "function"
        ) {

            timer.setInterruptCallback(() => {

                this.requestInterrupt(2);

            });

        }

    }

    connectInput(input) {

        this.input = input;

        if (
            input &&
            typeof input.setInterruptCallback === "function"
        ) {

            input.setInterruptCallback(() => {

                this.requestInterrupt(4);

            });

        }

    }

    connectAudio(audio) {
        this.audio = audio;
    }


    /* ========================================================
       RESET
       ======================================================== */

    reset() {

        this.wram.fill(0);
        this.hram.fill(0);
        this.vram.fill(0);
        this.oam.fill(0);
        this.io.fill(0);

        this.interruptEnable = 0;
        this.interruptFlags = 0xE1;

        this.joyp = 0xCF;

        this.serialData = 0;
        this.serialControl = 0;

        /*
         * DMG post-boot style registers.
         */

        this.io[0x00] = 0xCF;

        this.io[0x04] = 0x00;

        this.io[0x0F] = 0xE1;

        /* Sound */

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
         * LCD.
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

        this.io[0x4D] = 0xFF;

        this.lastRead = 0;
        this.lastWrite = 0;

    }


    /* ========================================================
       BYTE READ
       ======================================================== */

    readByte(address) {

        address &= 0xFFFF;

        let value = 0xFF;

        /* ROM */

        if (address <= 0x7FFF) {

            value = this.readCartridgeROM(address);

        }

        /* VRAM */

        else if (
            address >= 0x8000 &&
            address <= 0x9FFF
        ) {

            if (this.isVRAMBlocked()) {

                value = 0xFF;

            } else {

                value =
                    this.vram[address - 0x8000];

            }

        }

        /* Cartridge RAM */

        else if (
            address >= 0xA000 &&
            address <= 0xBFFF
        ) {

            value =
                this.readCartridgeRAM(address);

        }

        /* WRAM */

        else if (
            address >= 0xC000 &&
            address <= 0xDFFF
        ) {

            value =
                this.wram[address - 0xC000];

        }

        /* Echo */

        else if (
            address >= 0xE000 &&
            address <= 0xFDFF
        ) {

            value =
                this.wram[address - 0xE000];

        }

        /* OAM */

        else if (
            address >= 0xFE00 &&
            address <= 0xFE9F
        ) {

            if (this.isOAMBlocked()) {

                value = 0xFF;

            } else {

                value =
                    this.oam[address - 0xFE00];

            }

        }

        /* Unusable */

        else if (
            address >= 0xFEA0 &&
            address <= 0xFEFF
        ) {

            value = 0xFF;

        }

        /* I/O */

        else if (
            address >= 0xFF00 &&
            address <= 0xFF7F
        ) {

            value =
                this.readIO(address);

        }

        /* HRAM */

        else if (
            address >= 0xFF80 &&
            address <= 0xFFFE
        ) {

            value =
                this.hram[address - 0xFF80];

        }

        /* IE */

        else if (address === 0xFFFF) {

            value =
                this.interruptEnable;

        }

        this.lastRead = value & 0xFF;

        return value & 0xFF;

    }


    /* ========================================================
       BYTE WRITE
       ======================================================== */

    writeByte(address, value) {

        address &= 0xFFFF;
        value &= 0xFF;

        this.lastWrite = value;

        /* Cartridge */

        if (address <= 0x7FFF) {

            this.writeCartridge(address, value);
            return;

        }

        /* VRAM */

        if (
            address >= 0x8000 &&
            address <= 0x9FFF
        ) {

            if (!this.isVRAMBlocked()) {

                this.vram[address - 0x8000] =
                    value;

            }

            return;

        }

        /* Cartridge RAM */

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

        /* WRAM */

        if (
            address >= 0xC000 &&
            address <= 0xDFFF
        ) {

            this.wram[address - 0xC000] =
                value;

            return;

        }

        /* Echo */

        if (
            address >= 0xE000 &&
            address <= 0xFDFF
        ) {

            this.wram[address - 0xE000] =
                value;

            return;

        }

        /* OAM */

        if (
            address >= 0xFE00 &&
            address <= 0xFE9F
        ) {

            if (!this.isOAMBlocked()) {

                this.oam[address - 0xFE00] =
                    value;

            }

            return;

        }

        /* Unusable */

        if (
            address >= 0xFEA0 &&
            address <= 0xFEFF
        ) {

            return;

        }

        /* I/O */

        if (
            address >= 0xFF00 &&
            address <= 0xFF7F
        ) {

            this.writeIO(address, value);
            return;

        }

        /* HRAM */

        if (
            address >= 0xFF80 &&
            address <= 0xFFFE
        ) {

            this.hram[address - 0xFF80] =
                value;

            return;

        }

        /* IE */

        if (address === 0xFFFF) {

            this.interruptEnable =
                value;

        }

    }


    /* ========================================================
       WORD ACCESS
       ======================================================== */

    readWord(address) {

        const lo =
            this.readByte(address);

        const hi =
            this.readByte(
                (address + 1) & 0xFFFF
            );

        return lo | (hi << 8);

    }


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


    /* ========================================================
       CARTRIDGE
       ======================================================== */

    readCartridgeROM(address) {

        if (!this.cartridge)
            return 0xFF;

        if (typeof this.cartridge.read === "function") {

            return this.cartridge.read(address) & 0xFF;

        }

        if (typeof this.cartridge.readROM === "function") {

            return this.cartridge.readROM(address) & 0xFF;

        }

        if (this.cartridge.rom) {

            return (
                this.cartridge.rom[address] ??
                0xFF
            ) & 0xFF;

        }

        return 0xFF;

    }


    readCartridgeRAM(address) {

        if (!this.cartridge)
            return 0xFF;

        if (
            typeof this.cartridge.readRAM ===
            "function"
        ) {

            return this.cartridge.readRAM(address) & 0xFF;

        }

        /*
         * Nie używamy cartridge.read()
         * jako fallback dla RAM.
         *
         * MBC5 powinien sam rozróżniać
         * przestrzeń ROM/RAM.
         */

        return 0xFF;

    }


    writeCartridge(address, value) {

        if (!this.cartridge)
            return;

        if (typeof this.cartridge.write === "function") {

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


    writeCartridgeRAM(address, value) {

        if (!this.cartridge)
            return;

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


    /* ========================================================
       I/O READ
       ======================================================== */

    readIO(address) {

        const reg =
            address - 0xFF00;

        /* JOYP */

        if (address === 0xFF00) {

            return this.readJoypad();

        }

        /* Serial */

        if (address === 0xFF01) {

            return this.serialData;

        }

        if (address === 0xFF02) {

            return this.serialControl;

        }

        /* Timer */

        if (
            address >= 0xFF04 &&
            address <= 0xFF07
        ) {

            if (
                this.timer &&
                typeof this.timer.readRegister ===
                "function"
            ) {

                return this.timer.readRegister(address);

            }

        }

        /* IF */

        if (address === 0xFF0F) {

            return this.interruptFlags | 0xE0;

        }

        /* Audio */

        if (
            address >= 0xFF10 &&
            address <= 0xFF3F
        ) {

            if (
                this.audio &&
                typeof this.audio.readRegister ===
                "function"
            ) {

                return this.audio.readRegister(address);

            }

        }

        /* PPU */

        if (
            address >= 0xFF40 &&
            address <= 0xFF4B
        ) {

            if (
                this.ppu &&
                typeof this.ppu.readRegister ===
                "function"
            ) {

                return this.ppu.readRegister(address);

            }

        }

        return this.io[reg] ?? 0xFF;

    }


    /* ========================================================
       I/O WRITE
       ======================================================== */

    writeIO(address, value) {

        const reg =
            address - 0xFF00;

        /* JOYP */

        if (address === 0xFF00) {

            this.joyp =
                0xC0 |
                (value & 0x30);

            return;

        }

        /* Serial */

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

        /* Timer */

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

            } else {

                this.io[reg] = value;

            }

            return;

        }

        /* IF */

        if (address === 0xFF0F) {

            this.interruptFlags =
                value & 0x1F;

            this.io[0x0F] =
                this.interruptFlags | 0xE0;

            return;

        }

        /* Audio */

        if (
            address >= 0xFF10 &&
            address <= 0xFF3F
        ) {

            this.io[reg] = value;

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
         * PPU.
         *
         * WAŻNE:
         * PPU NIE może pisać przez memory.writeByte()
         * do tych samych rejestrów.
         *
         * Memory zapisuje rejestr lokalnie,
         * a PPU dostaje informację o zmianie.
         */

        if (
            address >= 0xFF40 &&
            address <= 0xFF4B
        ) {

            this.io[reg] = value;

            if (
                this.ppu &&
                typeof this.ppu.onRegisterWrite ===
                "function"
            ) {

                this.ppu.onRegisterWrite(
                    address,
                    value
                );

            }

            return;

        }

        /* DMA */

        if (address === 0xFF46) {

            this.io[0x46] = value;

            this.doDMA(value);

            return;

        }

        /* Generic */

        this.io[reg] = value;

    }


    /* ========================================================
       DMA
       ======================================================== */

    doDMA(value) {

        const source =
            (value & 0xFF) << 8;

        /*
         * DMA musi móc czytać ROM/WRAM.
         * Tymczasowo kopiujemy bez blokowania
         * przez PPU.
         */

        for (let i = 0; i < 0xA0; i++) {

            let data = 0xFF;

            const address =
                source + i;

            if (address <= 0x7FFF) {

                data =
                    this.readCartridgeROM(address);

            } else if (
                address >= 0x8000 &&
                address <= 0x9FFF
            ) {

                data =
                    this.vram[address - 0x8000];

            } else if (
                address >= 0xA000 &&
                address <= 0xBFFF
            ) {

                data =
                    this.readCartridgeRAM(address);

            } else if (
                address >= 0xC000 &&
                address <= 0xDFFF
            ) {

                data =
                    this.wram[address - 0xC000];

            } else if (
                address >= 0xE000 &&
                address <= 0xFDFF
            ) {

                data =
                    this.wram[address - 0xE000];

            }

            this.oam[i] =
                data & 0xFF;

        }

    }


    /* ========================================================
       JOYPAD
       ======================================================== */

    readJoypad() {

        let result =
            this.joyp | 0xC0;

        const directions =
            !(this.joyp & 0x10);

        const buttons =
            !(this.joyp & 0x20);

        const state =
            this.input &&
            typeof this.input.getState === "function"
                ? this.input.getState()
                : {};

        if (directions) {

            if (state.right) result &= ~0x01;
            if (state.left)  result &= ~0x02;
            if (state.up)    result &= ~0x04;
            if (state.down)  result &= ~0x08;

        }

        if (buttons) {

            if (state.a)      result &= ~0x01;
            if (state.b)      result &= ~0x02;
            if (state.select) result &= ~0x04;
            if (state.start)  result &= ~0x08;

        }

        return result & 0xFF;

    }


    /* ========================================================
       INTERRUPTS
       ======================================================== */

    requestInterrupt(bit) {

        this.interruptFlags |=
            (1 << bit);

        this.interruptFlags &=
            0x1F;

        this.io[0x0F] =
            this.interruptFlags | 0xE0;

    }


    getPendingInterrupts() {

        return (
            this.interruptEnable &
            this.interruptFlags &
            0x1F
        );

    }


    clearInterrupt(bit) {

        this.interruptFlags &=
            ~(1 << bit);

        this.interruptFlags &=
            0x1F;

        this.io[0x0F] =
            this.interruptFlags | 0xE0;

    }


    /* ========================================================
       PPU ACCESS BLOCKING
       ======================================================== */

    isVRAMBlocked() {

        if (!this.ppu)
            return false;

        if (!this.ppu.lcdEnabled())
            return false;

        return this.ppu.mode === 3;

    }


    isOAMBlocked() {

        if (!this.ppu)
            return false;

        if (!this.ppu.lcdEnabled())
            return false;

        return (
            this.ppu.mode === 2 ||
            this.ppu.mode === 3
        );

    }


    /* ========================================================
       STATE
       ======================================================== */

    getState() {

        return {

            interruptEnable:
                this.interruptEnable,

            interruptFlags:
                this.interruptFlags,

            joyp:
                this.readJoypad(),

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


    /* ========================================================
       DEBUG
       ======================================================== */

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
