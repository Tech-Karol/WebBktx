/*
 * ============================================================
 * WebBktx — Game Boy DMG PPU
 * ppu.js
 * ============================================================
 *
 * DMG PPU / LCD Controller
 *
 * Rozdzielczość:
 *   160 x 144
 *
 * VRAM:
 *   8000-9FFF
 *
 * OAM:
 *   FE00-FE9F
 *
 * LCD:
 *   FF40 LCDC
 *   FF41 STAT
 *   FF42 SCY
 *   FF43 SCX
 *   FF44 LY
 *   FF45 LYC
 *   FF47 BGP
 *   FF48 OBP0
 *   FF49 OBP1
 *   FF4A WY
 *   FF4B WX
 *
 * Timing DMG:
 *   Mode 2 = 80 dots
 *   Mode 3 = 172 dots + variable
 *   Mode 0 = reszta linii
 *   Mode 1 = VBlank
 *
 * CPU/PPU clock:
 *   4.194304 MHz
 *
 * ============================================================
 */

export default class PPU {

    constructor(memory = null) {

        this.memory = memory;

        this.canvas = null;
        this.context = null;

        this.WIDTH = 160;
        this.HEIGHT = 144;

        this.DOTS_PER_LINE = 456;
        this.VISIBLE_LINES = 144;
        this.TOTAL_LINES = 154;

        /*
         * PPU mode:
         *
         * 0 HBlank
         * 1 VBlank
         * 2 OAM
         * 3 Pixel transfer
         */

        this.mode = 2;

        this.lineCycles = 0;
        this.ly = 0;

        this.frameCount = 0;
        this.frameReady = false;

        /*
         * VRAM/OAM są podłączane z Memory.
         */

        this.vram = null;
        this.oam = null;

        /*
         * Callback do IF.
         */

        this.interruptCallback = null;

        /*
         * Framebuffer przechowuje wartości 0-3.
         */

        this.frameBuffer = new Uint8Array(
            this.WIDTH * this.HEIGHT
        );

        /*
         * Canvas RGBA.
         */

        this.rgbaBuffer = new Uint8ClampedArray(
            this.WIDTH *
            this.HEIGHT *
            4
        );

        /*
         * Klasyczna paleta DMG.
         */

        this.palette = [
            [224, 248, 208],
            [136, 192, 112],
            [52, 104, 86],
            [8, 24, 32]
        ];

        /*
         * Poprzedni stan STAT.
         * Używany do edge-triggered STAT IRQ.
         */

        this.statSignal = false;

        this.debug = false;

        this.reset();
    }


    /*
     * ========================================================
     * CONNECT MEMORY
     * ========================================================
     */

    connectMemory(memory) {

        this.memory = memory;

        if (memory) {

            if (memory.vram) {
                this.vram = memory.vram;
            }

            if (memory.oam) {
                this.oam = memory.oam;
            }

            if (
                typeof memory.connectPPU === "function" &&
                memory.ppu !== this
            ) {
                /*
                 * Nie wywołujemy tutaj connectPPU(),
                 * aby uniknąć rekurencji.
                 */
            }
        }
    }


    /*
     * ========================================================
     * CONNECT
     * ========================================================
     */

    connect(components = {}) {

        if (components.memory) {
            this.connectMemory(
                components.memory
            );
        }

        if (components.canvas) {
            this.attachCanvas(
                components.canvas
            );
        }
    }


    /*
     * ========================================================
     * INTERRUPT CALLBACK
     * ========================================================
     */

    setInterruptCallback(callback) {

        this.interruptCallback =
            typeof callback === "function"
                ? callback
                : null;
    }


    requestInterrupt(bit) {

        if (this.interruptCallback) {

            this.interruptCallback(
                bit
            );

            return;
        }

        /*
         * Fallback — jeżeli PPU nie jest podłączone
         * przez callback, ustawiamy IF bezpośrednio.
         */

        if (this.memory) {

            const value =
                this.memory.readByte(
                    0xFF0F
                );

            this.memory.writeByte(
                0xFF0F,
                value | (1 << bit)
            );
        }
    }


    /*
     * ========================================================
     * CANVAS
     * ========================================================
     */

    attachCanvas(canvas) {

        this.canvas = canvas;

        if (!canvas) {

            this.context = null;

            return;
        }

        canvas.width = this.WIDTH;
        canvas.height = this.HEIGHT;

        this.context =
            canvas.getContext(
                "2d",
                {
                    alpha: false
                }
            );

        if (this.context) {

            this.context.imageSmoothingEnabled =
                false;

            this.context.imageSmoothingEnabled =
                false;
        }

        this.render();
    }


    /*
     * ========================================================
     * MEMORY HELPERS
     * ========================================================
     */

    readMemory(address) {

        address &= 0xFFFF;

        /*
         * Najpierw bezpośredni VRAM.
         */

        if (
            address >= 0x8000 &&
            address <= 0x9FFF &&
            this.vram
        ) {

            return this.vram[
                address - 0x8000
            ] & 0xFF;
        }

        /*
         * OAM.
         */

        if (
            address >= 0xFE00 &&
            address <= 0xFE9F &&
            this.oam
        ) {

            return this.oam[
                address - 0xFE00
            ] & 0xFF;
        }

        /*
         * Memory.js.
         */

        if (
            this.memory &&
            typeof this.memory.readByte === "function"
        ) {

            return this.memory.readByte(
                address
            ) & 0xFF;
        }

        /*
         * Kompatybilność ze starszą wersją Memory.
         */

        if (
            this.memory &&
            typeof this.memory.read8 === "function"
        ) {

            return this.memory.read8(
                address
            ) & 0xFF;
        }

        return 0xFF;
    }


    writeMemory(address, value) {

        address &= 0xFFFF;
        value &= 0xFF;

        if (
            this.memory &&
            typeof this.memory.writeByte === "function"
        ) {

            this.memory.writeByte(
                address,
                value
            );

            return;
        }

        if (
            this.memory &&
            typeof this.memory.write8 === "function"
        ) {

            this.memory.write8(
                address,
                value
            );
        }
    }


    /*
     * ========================================================
     * REGISTER ACCESS
     * ========================================================
     */

    readRegister(address) {

        address &= 0xFFFF;

        switch (address) {

            case 0xFF40:
                return this.readMemory(address);

            case 0xFF41:
                return (
                    this.readMemory(address) |
                    0x80
                );

            case 0xFF42:
            case 0xFF43:
            case 0xFF44:
            case 0xFF45:
            case 0xFF47:
            case 0xFF48:
            case 0xFF49:
            case 0xFF4A:
            case 0xFF4B:
                return this.readMemory(address);

            default:
                return 0xFF;
        }
    }


    writeRegister(address, value) {

        address &= 0xFFFF;
        value &= 0xFF;

        /*
         * FF44 LY jest read-only.
         */

        if (address === 0xFF44) {
            return;
        }

        if (address === 0xFF41) {

            /*
             * STAT:
             * b7 = 1
             * b6-b3 = interrupt enable
             * b2 = coincidence
             * b1-b0 = mode
             *
             * CPU może zapisywać b6-b3.
             */

            const old =
                this.readMemory(0xFF41);

            const next =
                (
                    value &
                    0x78
                ) |
                (
                    old &
                    0x07
                ) |
                0x80;

            this.writeMemory(
                0xFF41,
                next
            );

            this.updateSTAT();

            return;
        }

        this.writeMemory(
            address,
            value
        );

        /*
         * LCDC OFF.
         */

        if (address === 0xFF40) {

            if (!(value & 0x80)) {

                this.mode = 0;
                this.lineCycles = 0;
                this.ly = 0;

                this.writeLY(0);

                this.clearFrame();
            }
        }

        /*
         * LYC zmienione.
         */

        if (address === 0xFF45) {

            this.updateSTAT();
        }
    }


    /*
     * ========================================================
     * RESET
     * ========================================================
     */

    reset() {

        this.mode = 2;

        this.lineCycles = 0;

        this.ly = 0;

        this.frameCount = 0;

        this.frameReady = false;

        this.statSignal = false;

        this.frameBuffer.fill(0);

        this.rgbaBuffer.fill(0);

        /*
         * Memory może być jeszcze niepodłączone.
         */

        if (this.memory) {

            /*
             * Nie zapisujemy FF44 przez writeRegister,
             * ponieważ LY jest read-only.
             */

            this.writeMemory(
                0xFF40,
                0x91
            );

            this.writeMemory(
                0xFF41,
                0x85
            );

            this.writeMemory(
                0xFF42,
                0x00
            );

            this.writeMemory(
                0xFF43,
                0x00
            );

            this.writeMemory(
                0xFF44,
                0x00
            );

            this.writeMemory(
                0xFF45,
                0x00
            );

            this.writeMemory(
                0xFF47,
                0xFC
            );

            this.writeMemory(
                0xFF48,
                0xFF
            );

            this.writeMemory(
                0xFF49,
                0xFF
            );

            this.writeMemory(
                0xFF4A,
                0x00
            );

            this.writeMemory(
                0xFF4B,
                0x00
            );
        }

        this.clearFrame();
    }


    /*
     * ========================================================
     * LCD
     * ========================================================
     */

    lcdEnabled() {

        return (
            this.readMemory(
                0xFF40
            ) & 0x80
        ) !== 0;
    }


    /*
     * ========================================================
     * STEP
     * ========================================================
     */

    step(cycles) {

        cycles =
            Number(cycles);

        if (
            !Number.isFinite(cycles) ||
            cycles <= 0
        ) {
            return;
        }

        /*
         * LCD disabled.
         */

        if (!this.lcdEnabled()) {

            this.mode = 0;
            this.lineCycles = 0;
            this.ly = 0;

            this.writeLY(0);

            this.updateSTAT();

            return;
        }

        while (cycles > 0) {

            let target;

            switch (this.mode) {

                case 2:
                    target = 80;
                    break;

                case 3:
                    target = 252;
                    break;

                case 0:
                case 1:
                    target = 456;
                    break;

                default:
                    this.mode = 2;
                    this.lineCycles = 0;
                    target = 80;
                    break;
            }

            const remaining =
                Math.max(
                    1,
                    target -
                    this.lineCycles
                );

            const amount =
                Math.min(
                    cycles,
                    remaining
                );

            this.lineCycles += amount;
            cycles -= amount;

            this.processTiming();
        }
    }


    /*
     * ========================================================
     * TIMING
     * ========================================================
     */

    processTiming() {

        /*
         * MODE 2 -> MODE 3
         */

        if (
            this.mode === 2 &&
            this.lineCycles >= 80
        ) {

            this.mode = 3;

            this.updateSTAT();

            return;
        }


        /*
         * MODE 3 -> MODE 0
         */

        if (
            this.mode === 3 &&
            this.lineCycles >= 252
        ) {

            if (this.ly < 144) {

                this.renderScanline(
                    this.ly
                );
            }

            this.mode = 0;

            this.updateSTAT();

            return;
        }


        /*
         * MODE 0 -> następna linia.
         */

        if (
            this.mode === 0 &&
            this.lineCycles >= 456
        ) {

            this.lineCycles -= 456;

            this.ly++;

            this.writeLY(
                this.ly
            );

            if (this.ly >= 144) {

                /*
                 * VBlank.
                 */

                this.mode = 1;

                this.frameReady = true;

                this.frameCount++;

                this.requestInterrupt(0);

                this.render();

            } else {

                this.mode = 2;
            }

            this.updateSTAT();

            return;
        }


        /*
         * MODE 1 VBLANK
         */

        if (
            this.mode === 1 &&
            this.lineCycles >= 456
        ) {

            this.lineCycles -= 456;

            this.ly++;

            if (this.ly >= 154) {

                this.ly = 0;

                this.writeLY(0);

                this.mode = 2;

            } else {

                this.writeLY(
                    this.ly
                );
            }

            this.updateSTAT();
        }
    }


    /*
     * ========================================================
     * LY
     * ========================================================
     */

    writeLY(value) {

        /*
         * Bezpośredni zapis, ponieważ FF44 jest read-only
         * dla CPU.
         */

        if (
            this.memory &&
            this.memory.io
        ) {

            this.memory.io[
                0x44
            ] =
                value & 0xFF;

        }

        this.updateLYC();
    }


    /*
     * ========================================================
     * STAT
     * ========================================================
     */

    updateSTAT() {

        if (!this.memory) {
            return;
        }

        const old =
            this.readMemory(
                0xFF41
            );

        let stat =
            old &
            0x78;

        stat |=
            this.mode & 3;

        /*
         * Coincidence flag.
         */

        if (
            this.ly ===
            this.readMemory(
                0xFF45
            )
        ) {

            stat |= 0x04;
        }

        /*
         * STAT bit 7.
         */

        stat |= 0x80;

        /*
         * Zapisujemy bez przechodzenia przez
         * writeRegister(), żeby nie robić pętli.
         */

        if (this.memory.io) {

            this.memory.io[
                0x41
            ] =
                stat & 0xFF;

        }

        /*
         * STAT interrupt signal.
         *
         * Jest edge-triggered.
         */

        const coincidence =
            (
                stat & 0x04
            ) !== 0;

        const mode0 =
            this.mode === 0 &&
            (stat & 0x08);

        const mode1 =
            this.mode === 1 &&
            (stat & 0x10);

        const mode2 =
            this.mode === 2 &&
            (stat & 0x20);

        const signal =
            Boolean(
                coincidence &&
                (stat & 0x40)
            ) ||
            Boolean(mode0) ||
            Boolean(mode1) ||
            Boolean(mode2);

        if (
            signal &&
            !this.statSignal
        ) {

            this.requestInterrupt(1);
        }

        this.statSignal =
            signal;
    }


    /*
     * ========================================================
     * LYC
     * ========================================================
     */

    updateLYC() {

        if (!this.memory) {
            return;
        }

        const stat =
            this.readMemory(
                0xFF41
            );

        let next =
            stat &
            0x78;

        next |=
            this.mode & 3;

        if (
            this.ly ===
            this.readMemory(
                0xFF45
            )
        ) {

            next |= 0x04;
        }

        next |= 0x80;

        if (this.memory.io) {

            this.memory.io[
                0x41
            ] =
                next & 0xFF;
        }
    }


    /*
     * ========================================================
     * BACKGROUND
     * ========================================================
     */

    renderBackground(line) {

        const lcdc =
            this.readMemory(
                0xFF40
            );

        const scy =
            this.readMemory(
                0xFF42
            );

        const scx =
            this.readMemory(
                0xFF43
            );

        const bgp =
            this.readMemory(
                0xFF47
            );


        /*
         * Tile map.
         */

        const tileMap =
            (lcdc & 0x08)
                ? 0x9C00
                : 0x9800;


        /*
         * Tile addressing.
         *
         * bit 4 = 1 -> 8000
         * bit 4 = 0 -> 8800 signed
         */

        const unsignedMode =
            Boolean(
                lcdc & 0x10
            );


        const y =
            (
                line +
                scy
            ) & 0xFF;

        const tileY =
            (
                y >> 3
            ) & 31;

        const row =
            y & 7;


        for (
            let x = 0;
            x < 160;
            x++
        ) {

            const mapX =
                (
                    x +
                    scx
                ) & 0xFF;

            const tileX =
                (
                    mapX >> 3
                ) & 31;

            const mapAddress =
                tileMap +
                tileY * 32 +
                tileX;

            const tile =
                this.readMemory(
                    mapAddress
                );

            let tileAddress;

            if (unsignedMode) {

                tileAddress =
                    0x8000 +
                    tile * 16;

            } else {

                const signed =
                    tile < 128
                        ? tile
                        : tile - 256;

                tileAddress =
                    0x9000 +
                    signed * 16;
            }

            const address =
                tileAddress +
                row * 2;

            const low =
                this.readMemory(
                    address
                );

            const high =
                this.readMemory(
                    address + 1
                );

            const bit =
                7 -
                (
                    mapX & 7
                );

            const color =
                (
                    (low >> bit) & 1
                ) |
                (
                    ((high >> bit) & 1)
                    << 1
                );

            const shade =
                this.paletteIndex(
                    color,
                    bgp
                );

            this.setPixel(
                x,
                line,
                shade
            );
        }
    }


    /*
     * ========================================================
     * WINDOW
     * ========================================================
     */

    renderWindow(line) {

        const lcdc =
            this.readMemory(
                0xFF40
            );

        const wy =
            this.readMemory(
                0xFF4A
            );

        const wx =
            this.readMemory(
                0xFF4B
            );

        if (
            line < wy
        ) {
            return;
        }

        const screenX =
            wx - 7;

        if (
            screenX >= 160
        ) {
            return;
        }

        const tileMap =
            (lcdc & 0x40)
                ? 0x9C00
                : 0x9800;

        const unsignedMode =
            Boolean(
                lcdc & 0x10
            );

        const windowLine =
            line - wy;

        const tileY =
            (
                windowLine >> 3
            ) & 31;

        const row =
            windowLine & 7;

        const bgp =
            this.readMemory(
                0xFF47
            );

        for (
            let x = Math.max(0, screenX);
            x < 160;
            x++
        ) {

            const wxPixel =
                x - screenX;

            const tileX =
                (
                    wxPixel >> 3
                ) & 31;

            const pixelX =
                wxPixel & 7;

            const tile =
                this.readMemory(
                    tileMap +
                    tileY * 32 +
                    tileX
                );

            let tileAddress;

            if (unsignedMode) {

                tileAddress =
                    0x8000 +
                    tile * 16;

            } else {

                const signed =
                    tile < 128
                        ? tile
                        : tile - 256;

                tileAddress =
                    0x9000 +
                    signed * 16;
            }

            const address =
                tileAddress +
                row * 2;

            const low =
                this.readMemory(
                    address
                );

            const high =
                this.readMemory(
                    address + 1
                );

            const bit =
                7 -
                pixelX;

            const color =
                (
                    (low >> bit) & 1
                ) |
                (
                    ((high >> bit) & 1)
                    << 1
                );

            const shade =
                this.paletteIndex(
                    color,
                    bgp
                );

            this.setPixel(
                x,
                line,
                shade
            );
        }
    }


    /*
     * ========================================================
     * SPRITES
     * ========================================================
     */

    renderSprites(line) {

        const lcdc =
            this.readMemory(
                0xFF40
            );

        const tall =
            Boolean(
                lcdc & 0x04
            );

        const height =
            tall
                ? 16
                : 8;

        const sprites = [];


        /*
         * OAM entries.
         */

        for (
            let i = 0;
            i < 40;
            i++
        ) {

            const address =
                0xFE00 +
                i * 4;

            const y =
                this.readMemory(
                    address
                ) - 16;

            const x =
                this.readMemory(
                    address + 1
                ) - 8;

            const tile =
                this.readMemory(
                    address + 2
                );

            const flags =
                this.readMemory(
                    address + 3
                );

            if (
                line >= y &&
                line < y + height
            ) {

                sprites.push({
                    index: i,
                    x,
                    y,
                    tile,
                    flags
                });

                if (
                    sprites.length >= 10
                ) {
                    break;
                }
            }
        }


        /*
         * DMG priority:
         *
         * niższe X = wyższy priorytet
         * przy tym samym X niższy OAM index.
         *
         * Rysujemy od najniższego priorytetu.
         */

        sprites.sort(
            (a, b) => {

                if (a.x !== b.x) {
                    return b.x - a.x;
                }

                return b.index - a.index;
            }
        );


        for (
            const sprite of sprites
        ) {

            this.renderSprite(
                sprite,
                line,
                height
            );
        }
    }


    /*
     * ========================================================
     * SINGLE SPRITE
     * ========================================================
     */

    renderSprite(
        sprite,
        line,
        height
    ) {

        const flags =
            sprite.flags;

        const flipX =
            Boolean(
                flags & 0x20
            );

        const flipY =
            Boolean(
                flags & 0x40
            );

        const behind =
            Boolean(
                flags & 0x80
            );

        const palette =
            (
                flags & 0x10
            )
                ? this.readMemory(0xFF49)
                : this.readMemory(0xFF48);

        let tile =
            sprite.tile;

        /*
         * 8x16:
         * bit 0 ignored.
         */

        if (height === 16) {
            tile &= 0xFE;
        }

        let row =
            line -
            sprite.y;

        if (flipY) {

            row =
                height -
                1 -
                row;
        }

        if (
            height === 16 &&
            row >= 8
        ) {

            tile++;
            row -= 8;
        }

        const address =
            0x8000 +
            tile * 16 +
            row * 2;

        const low =
            this.readMemory(
                address
            );

        const high =
            this.readMemory(
                address + 1
            );

        for (
            let px = 0;
            px < 8;
            px++
        ) {

            const x =
                sprite.x +
                px;

            if (
                x < 0 ||
                x >= 160
            ) {
                continue;
            }

            const bit =
                flipX
                    ? px
                    : 7 - px;

            const color =
                (
                    (low >> bit) & 1
                ) |
                (
                    ((high >> bit) & 1)
                    << 1
                );

            /*
             * OBJ color 0 = transparent.
             */

            if (color === 0) {
                continue;
            }

            /*
             * OBJ priority.
             *
             * Jeżeli BG ma kolor 1-3,
             * sprite jest za nim.
             */

            if (behind) {

                const bg =
                    this.getPixel(
                        x,
                        line
                    );

                if (bg !== 0) {
                    continue;
                }
            }

            const shade =
                this.paletteIndex(
                    color,
                    palette
                );

            this.setPixel(
                x,
                line,
                shade
            );
        }
    }


    /*
     * ========================================================
     * PALETTE
     * ========================================================
     */

    paletteIndex(
        color,
        palette
    ) {

        return (
            palette >>
            (
                color * 2
            )
        ) & 3;
    }


    /*
     * ========================================================
     * SCANLINE
     * ========================================================
     */

    renderScanline(line) {

        if (
            line < 0 ||
            line >= 144
        ) {
            return;
        }

        const lcdc =
            this.readMemory(
                0xFF40
            );

        /*
         * BG / Window.
         */

        if (lcdc & 0x01) {

            this.renderBackground(
                line
            );

            /*
             * Window.
             */

            if (lcdc & 0x20) {

                this.renderWindow(
                    line
                );
            }

        } else {

            /*
             * Gdy BG/WIN wyłączone,
             * wszystkie piksele są koloru 0.
             */

            this.fillLine(
                line,
                0
            );
        }

        /*
         * Sprites.
         */

        if (lcdc & 0x02) {

            this.renderSprites(
                line
            );
        }
    }


    /*
     * ========================================================
     * PIXELS
     * ========================================================
     */

    setPixel(
        x,
        y,
        value
    ) {

        if (
            x < 0 ||
            x >= 160 ||
            y < 0 ||
            y >= 144
        ) {
            return;
        }

        this.frameBuffer[
            y * 160 + x
        ] =
            value & 3;
    }


    getPixel(
        x,
        y
    ) {

        if (
            x < 0 ||
            x >= 160 ||
            y < 0 ||
            y >= 144
        ) {
            return 0;
        }

        return this.frameBuffer[
            y * 160 + x
        ] & 3;
    }


    fillLine(
        y,
        value
    ) {

        if (
            y < 0 ||
            y >= 144
        ) {
            return;
        }

        const start =
            y * 160;

        this.frameBuffer.fill(
            value & 3,
            start,
            start + 160
        );
    }


    /*
     * ========================================================
     * FRAME -> RGBA
     * ========================================================
     */

    updateRGBA() {

        for (
            let i = 0;
            i < this.frameBuffer.length;
            i++
        ) {

            const shade =
                this.frameBuffer[i] & 3;

            const color =
                this.palette[shade];

            const offset =
                i * 4;

            this.rgbaBuffer[
                offset
            ] = color[0];

            this.rgbaBuffer[
                offset + 1
            ] = color[1];

            this.rgbaBuffer[
                offset + 2
            ] = color[2];

            this.rgbaBuffer[
                offset + 3
            ] = 255;
        }
    }


    /*
     * ========================================================
     * CANVAS RENDER
     * ========================================================
     */

    render() {

        if (!this.context) {
            return;
        }

        this.updateRGBA();

        const image =
            new ImageData(
                this.rgbaBuffer,
                160,
                144
            );

        this.context.putImageData(
            image,
            0,
            0
        );
    }


    /*
     * ========================================================
     * CLEAR FRAME
     * ========================================================
     */

    clearFrame() {

        this.frameBuffer.fill(0);

        this.updateRGBA();

        if (!this.context) {
            return;
        }

        const image =
            new ImageData(
                this.rgbaBuffer,
                160,
                144
            );

        this.context.putImageData(
            image,
            0,
            0
        );
    }


    /*
     * ========================================================
     * FRAMEBUFFER
     * ========================================================
     */

    getFrameBuffer() {

        return this.frameBuffer;
    }


    getRGBABuffer() {

        this.updateRGBA();

        return this.rgbaBuffer;
    }


    isFrameReady() {

        return this.frameReady;
    }


    consumeFrame() {

        const ready =
            this.frameReady;

        this.frameReady = false;

        return ready;
    }


    /*
     * ========================================================
     * STATE
     * ========================================================
     */

    getState() {

        return {

            mode:
                this.mode,

            ly:
                this.ly,

            lineCycles:
                this.lineCycles,

            frame:
                this.frameCount,

            frameReady:
                this.frameReady,

            lcdEnabled:
                this.lcdEnabled(),

            lcdc:
                this.readMemory(0xFF40),

            stat:
                this.readMemory(0xFF41),

            scx:
                this.readMemory(0xFF43),

            scy:
                this.readMemory(0xFF42),

            lyc:
                this.readMemory(0xFF45),

            bgp:
                this.readMemory(0xFF47),

            obp0:
                this.readMemory(0xFF48),

            obp1:
                this.readMemory(0xFF49),

            wy:
                this.readMemory(0xFF4A),

            wx:
                this.readMemory(0xFF4B)
        };
    }


    /*
     * ========================================================
     * DEBUG
     * ========================================================
     */

    setDebug(enabled) {

        this.debug =
            Boolean(enabled);
    }


    /*
     * ========================================================
     * DESTROY
     * ========================================================
     */

    destroy() {

        this.canvas = null;
        this.context = null;
        this.memory = null;
        this.vram = null;
        this.oam = null;
        this.interruptCallback = null;
    }
}
