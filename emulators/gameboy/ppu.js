/*
 * WebBktx Game Boy DMG PPU
 *
 * 160 x 144
 * 456 dots / scanline
 * 154 scanlines / frame
 *
 * DMG:
 *   Mode 2 = 80
 *   Mode 3 = 172
 *   Mode 0 = 204
 *   Line = 456
 */

export default class PPU {

    constructor(memory = null) {

        this.memory = memory;

        this.cpu = null;

        this.canvas = null;
        this.context = null;

        this.WIDTH = 160;
        this.HEIGHT = 144;

        this.DOTS_PER_LINE = 456;

        this.mode = 2;
        this.lineCycles = 0;
        this.ly = 0;

        this.frameCount = 0;
        this.frameReady = false;

        this.vram =
            memory?.vram ||
            new Uint8Array(0x2000);

        this.oam =
            memory?.oam ||
            new Uint8Array(0xA0);

        /*
         * Rejestry LCD lokalnie.
         *
         * Dzięki temu PPU nie potrzebuje
         * zapisywać ich przez Memory.
         */

        this.lcdc = 0x91;
        this.stat = 0x85;

        this.scy = 0;
        this.scx = 0;

        this.lyc = 0;

        this.bgp = 0xFC;
        this.obp0 = 0xFF;
        this.obp1 = 0xFF;

        this.wy = 0;
        this.wx = 0;

        this.frameBuffer =
            new Uint8Array(
                this.WIDTH *
                this.HEIGHT
            );

        this.rgbaBuffer =
            new Uint8ClampedArray(
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

        this.debug = false;

        this.interruptCallback = null;

        this.statLine = false;

        this.reset();

    }


    /* ========================================================
       CONNECTION
       ======================================================== */

    connect(components = {}) {

        if (components.memory) {

            this.memory =
                components.memory;

            this.vram =
                this.memory.vram;

            this.oam =
                this.memory.oam;

        }

        if (components.cpu) {

            this.cpu =
                components.cpu;

        }

    }


    setInterruptCallback(callback) {

        this.interruptCallback =
            typeof callback === "function"
                ? callback
                : null;

    }


    requestInterrupt(bit) {

        if (this.interruptCallback) {

            this.interruptCallback(bit);

        } else if (
            this.memory &&
            typeof this.memory.requestInterrupt ===
            "function"
        ) {

            this.memory.requestInterrupt(bit);

        }

    }


    /* ========================================================
       CANVAS
       ======================================================== */

    attachCanvas(canvas) {

        this.canvas = canvas;

        if (!canvas) {

            this.context = null;
            return;

        }

        /*
         * Wewnętrzna rozdzielczość Game Boy.
         *
         * CSS może ją później skalować.
         */

        canvas.width = 160;
        canvas.height = 144;

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

        }

        this.render();

    }


    /* ========================================================
       RESET
       ======================================================== */

    reset() {

        this.mode = 2;
        this.lineCycles = 0;
        this.ly = 0;

        this.frameCount = 0;
        this.frameReady = false;

        this.lcdc = 0x91;
        this.stat = 0x85;

        this.scy = 0;
        this.scx = 0;

        this.lyc = 0;

        this.bgp = 0xFC;
        this.obp0 = 0xFF;
        this.obp1 = 0xFF;

        this.wy = 0;
        this.wx = 0;

        this.statLine = false;

        this.frameBuffer.fill(0);

        this.rgbaBuffer.fill(0);

        this.updateSTAT();

        this.render();

    }


    /* ========================================================
       REGISTER READ
       ======================================================== */

    readRegister(address) {

        switch (address) {

            case 0xFF40:
                return this.lcdc;

            case 0xFF41:
                return this.stat | 0x80;

            case 0xFF42:
                return this.scy;

            case 0xFF43:
                return this.scx;

            case 0xFF44:
                return this.ly;

            case 0xFF45:
                return this.lyc;

            case 0xFF47:
                return this.bgp;

            case 0xFF48:
                return this.obp0;

            case 0xFF49:
                return this.obp1;

            case 0xFF4A:
                return this.wy;

            case 0xFF4B:
                return this.wx;

            default:
                return 0xFF;

        }

    }


    /* ========================================================
       REGISTER WRITE
       ======================================================== */

    /*
     * Memory.js wywołuje tę funkcję.
     *
     * NIE używamy tutaj memory.writeByte().
     */

    onRegisterWrite(address, value) {

        value &= 0xFF;

        switch (address) {

            case 0xFF40: {

                const old =
                    this.lcdc;

                this.lcdc =
                    value;

                /*
                 * LCD został wyłączony.
                 */

                if (
                    (old & 0x80) &&
                    !(value & 0x80)
                ) {

                    this.mode = 0;
                    this.lineCycles = 0;
                    this.ly = 0;

                    this.updateSTAT();

                }

                /*
                 * LCD został włączony.
                 */

                else if (
                    !(old & 0x80) &&
                    (value & 0x80)
                ) {

                    this.mode = 2;
                    this.lineCycles = 0;
                    this.ly = 0;

                    this.updateSTAT();

                }

                break;

            }

            case 0xFF41:

                /*
                 * Bits 6-3 są zapisywalne.
                 * Bits 1-0 generuje PPU.
                 * Bit 2 coincidence.
                 */

                this.stat =
                    (
                        this.stat &
                        0x07
                    ) |
                    (
                        value &
                        0x78
                    );

                this.updateSTAT();

                break;

            case 0xFF42:

                this.scy = value;
                break;

            case 0xFF43:

                this.scx = value;
                break;

            case 0xFF44:

                /*
                 * LY jest read-only.
                 */

                break;

            case 0xFF45:

                this.lyc = value;
                this.updateSTAT();
                break;

            case 0xFF47:

                this.bgp = value;
                break;

            case 0xFF48:

                this.obp0 = value;
                break;

            case 0xFF49:

                this.obp1 = value;
                break;

            case 0xFF4A:

                this.wy = value;
                break;

            case 0xFF4B:

                this.wx = value;
                break;

        }

    }


    /*
     * Alias dla starszego emulator.js.
     */

    writeRegister(address, value) {

        this.onRegisterWrite(
            address,
            value
        );

    }


    /* ========================================================
       MEMORY HELPERS
       ======================================================== */

    readVRAM(address) {

        address &= 0x1FFF;

        return this.vram[address];

    }


    readOAM(address) {

        address &= 0x9F;

        return this.oam[address];

    }


    read8(address) {

        address &= 0xFFFF;

        if (
            address >= 0x8000 &&
            address <= 0x9FFF
        ) {

            return this.vram[
                address - 0x8000
            ];

        }

        if (
            address >= 0xFE00 &&
            address <= 0xFE9F
        ) {

            return this.oam[
                address - 0xFE00
            ];

        }

        /*
         * PPU czyta własne rejestry bez
         * wchodzenia ponownie przez memory.
         */

        if (
            address >= 0xFF40 &&
            address <= 0xFF4B
        ) {

            return this.readRegister(address);

        }

        if (this.memory) {

            if (
                typeof this.memory.readByte ===
                "function"
            ) {

                return this.memory.readByte(address);

            }

            if (
                typeof this.memory.read8 ===
                "function"
            ) {

                return this.memory.read8(address);

            }

        }

        return 0xFF;

    }


    /* ========================================================
       LCD
       ======================================================== */

    lcdEnabled() {

        return (
            (this.lcdc & 0x80) !== 0
        );

    }


    /* ========================================================
       STEP
       ======================================================== */

    step(cycles) {

        if (
            !Number.isFinite(cycles) ||
            cycles <= 0
        ) {

            return;

        }

        /*
         * LCD OFF.
         */

        if (!this.lcdEnabled()) {

            this.mode = 0;
            this.lineCycles = 0;
            this.ly = 0;

            this.updateSTAT();

            return;

        }

        while (cycles > 0) {

            let limit;

            switch (this.mode) {

                case 2:
                    limit = 80;
                    break;

                case 3:
                    limit = 252;
                    break;

                case 0:
                    limit = 456;
                    break;

                case 1:
                    limit = 456;
                    break;

                default:
                    this.mode = 2;
                    this.lineCycles = 0;
                    limit = 80;

            }

            const remaining =
                Math.max(
                    1,
                    limit - this.lineCycles
                );

            const amount =
                Math.min(
                    cycles,
                    remaining
                );

            this.lineCycles += amount;

            cycles -= amount;

            if (
                this.lineCycles >= limit
            ) {

                this.advanceMode();

            }

        }

    }


    /* ========================================================
       MODE ADVANCE
       ======================================================== */

    advanceMode() {

        switch (this.mode) {

            case 2:

                this.mode = 3;

                this.updateSTAT();

                break;


            case 3:

                /*
                 * Render scanline po zakończeniu
                 * transferu pikseli.
                 */

                if (this.ly < 144) {

                    this.renderScanline(
                        this.ly
                    );

                }

                this.mode = 0;

                this.updateSTAT();

                break;


            case 0:

                this.lineCycles -= 456;

                this.ly++;

                if (this.ly === 144) {

                    this.mode = 1;

                    this.frameReady = true;

                    this.frameCount++;

                    this.requestInterrupt(0);

                    this.render();

                } else {

                    this.mode = 2;

                }

                this.updateSTAT();

                break;


            case 1:

                this.lineCycles -= 456;

                this.ly++;

                if (this.ly >= 154) {

                    this.ly = 0;

                    this.mode = 2;

                }

                this.updateSTAT();

                break;

        }

    }


    /* ========================================================
       STAT
       ======================================================== */

    updateSTAT() {

        let stat =
            this.stat & 0x78;

        stat |=
            this.mode & 3;

        if (
            this.ly === this.lyc
        ) {

            stat |= 0x04;

        }

        stat |= 0x80;

        this.stat =
            stat;

        /*
         * STAT interrupt.
         *
         * Edge triggered zamiast generowania
         * przerwania w każdej iteracji CPU.
         */

        let signal = false;

        if (
            this.mode === 0 &&
            (stat & 0x08)
        ) {

            signal = true;

        }

        if (
            this.mode === 1 &&
            (stat & 0x10)
        ) {

            signal = true;

        }

        if (
            this.mode === 2 &&
            (stat & 0x20)
        ) {

            signal = true;

        }

        if (
            (stat & 0x04) &&
            (stat & 0x40)
        ) {

            signal = true;

        }

        if (
            signal &&
            !this.statLine
        ) {

            this.requestInterrupt(1);

        }

        this.statLine =
            signal;

    }


    /* ========================================================
       BACKGROUND
       ======================================================== */

    renderBackground(line) {

        const lcdc =
            this.lcdc;

        const scx =
            this.scx;

        const scy =
            this.scy;

        const mapBase =
            (lcdc & 0x08)
                ? 0x1C00
                : 0x1800;

        const unsignedMode =
            (lcdc & 0x10) !== 0;

        const y =
            (line + scy) & 0xFF;

        const tileY =
            (y >> 3) & 31;

        const pixelY =
            y & 7;

        for (
            let x = 0;
            x < 160;
            x++
        ) {

            const worldX =
                (x + scx) & 0xFF;

            const tileX =
                (worldX >> 3) & 31;

            const mapOffset =
                mapBase +
                tileY * 32 +
                tileX;

            const tileNumber =
                this.vram[
                    mapOffset
                ];

            let tileAddress;

            if (unsignedMode) {

                tileAddress =
                    tileNumber * 16;

            } else {

                const signed =
                    tileNumber < 128
                        ? tileNumber
                        : tileNumber - 256;

                /*
                 * 0x8800 signed area.
                 * W VRAM indeksujemy od 0x0000,
                 * czyli 0x9000 = offset 0x1000.
                 */

                tileAddress =
                    0x1000 +
                    signed * 16;

            }

            tileAddress &= 0x1FFF;

            const row =
                (
                    tileAddress +
                    pixelY * 2
                ) & 0x1FFF;

            const lo =
                this.vram[row];

            const hi =
                this.vram[
                    (row + 1) & 0x1FFF
                ];

            const bit =
                7 -
                (worldX & 7);

            const color =
                (
                    (lo >> bit) & 1
                ) |
                (
                    ((hi >> bit) & 1) << 1
                );

            const shade =
                this.paletteColor(
                    color,
                    this.bgp
                );

            this.setPixel(
                x,
                line,
                shade
            );

        }

    }


    /* ========================================================
       WINDOW
       ======================================================== */

    renderWindow(line) {

        const wx =
            this.wx - 7;

        const wy =
            this.wy;

        if (line < wy)
            return;

        if (wx >= 160)
            return;

        const mapBase =
            (this.lcdc & 0x40)
                ? 0x1C00
                : 0x1800;

        const unsignedMode =
            (this.lcdc & 0x10) !== 0;

        const windowLine =
            line - wy;

        const tileY =
            (windowLine >> 3) & 31;

        const pixelY =
            windowLine & 7;

        for (
            let x = Math.max(0, wx);
            x < 160;
            x++
        ) {

            const windowX =
                x - wx;

            const tileX =
                (windowX >> 3) & 31;

            const pixelX =
                windowX & 7;

            const tileNumber =
                this.vram[
                    mapBase +
                    tileY * 32 +
                    tileX
                ];

            let tileAddress;

            if (unsignedMode) {

                tileAddress =
                    tileNumber * 16;

            } else {

                const signed =
                    tileNumber < 128
                        ? tileNumber
                        : tileNumber - 256;

                tileAddress =
                    0x1000 +
                    signed * 16;

            }

            tileAddress &= 0x1FFF;

            const row =
                (
                    tileAddress +
                    pixelY * 2
                ) & 0x1FFF;

            const lo =
                this.vram[row];

            const hi =
                this.vram[
                    (row + 1) & 0x1FFF
                ];

            const bit =
                7 - pixelX;

            const color =
                (
                    (lo >> bit) & 1
                ) |
                (
                    ((hi >> bit) & 1) << 1
                );

            this.setPixel(
                x,
                line,
                this.paletteColor(
                    color,
                    this.bgp
                )
            );

        }

    }


    /* ========================================================
       SPRITES
       ======================================================== */

    renderSprites(line) {

        const height =
            (this.lcdc & 0x04)
                ? 16
                : 8;

        const sprites = [];

        for (
            let i = 0;
            i < 40;
            i++
        ) {

            const base =
                i * 4;

            const y =
                this.oam[base] - 16;

            const x =
                this.oam[base + 1] - 8;

            const tile =
                this.oam[base + 2];

            const flags =
                this.oam[base + 3];

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

            }

        }

        /*
         * DMG:
         * najpierw X,
         * potem OAM.
         *
         * Rysujemy od tyłu.
         */

        sprites.sort((a, b) => {

            if (a.x !== b.x)
                return b.x - a.x;

            return b.index - a.index;

        });

        /*
         * Maksymalnie 10 sprite'ów.
         */

        sprites.length =
            Math.min(
                sprites.length,
                10
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


    renderSprite(
        sprite,
        line,
        height
    ) {

        const flags =
            sprite.flags;

        const flipX =
            !!(flags & 0x20);

        const flipY =
            !!(flags & 0x40);

        const behind =
            !!(flags & 0x80);

        const palette =
            (flags & 0x10)
                ? this.obp1
                : this.obp0;

        let tile =
            sprite.tile;

        if (height === 16) {

            tile &= 0xFE;

        }

        let row =
            line - sprite.y;

        if (flipY) {

            row =
                height - 1 - row;

        }

        if (
            height === 16 &&
            row >= 8
        ) {

            tile++;
            row -= 8;

        }

        const tileAddress =
            (tile * 16) & 0x1FFF;

        const address =
            (
                tileAddress +
                row * 2
            ) & 0x1FFF;

        const lo =
            this.vram[address];

        const hi =
            this.vram[
                (address + 1) & 0x1FFF
            ];

        for (
            let px = 0;
            px < 8;
            px++
        ) {

            const x =
                sprite.x + px;

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
                    (lo >> bit) & 1
                ) |
                (
                    ((hi >> bit) & 1) << 1
                );

            /*
             * OBJ color 0 transparent.
             */

            if (color === 0)
                continue;

            /*
             * BG priority.
             *
             * W frameBuffer przechowujemy
             * shade po BGP, więc color 0 BG
             * odpowiada shade 0.
             */

            if (
                behind &&
                this.getPixel(x, line) !== 0
            ) {

                continue;

            }

            this.setPixel(
                x,
                line,
                this.paletteColor(
                    color,
                    palette
                )
            );

        }

    }


    /* ========================================================
       PALETTE
       ======================================================== */

    paletteColor(color, palette) {

        return (
            palette >>
            (color * 2)
        ) & 3;

    }


    /* ========================================================
       PIXEL
       ======================================================== */

    setPixel(x, y, value) {

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


    getPixel(x, y) {

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
        ];

    }


    /* ========================================================
       RGBA
       ======================================================== */

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

            const o =
                i * 4;

            this.rgbaBuffer[o] =
                color[0];

            this.rgbaBuffer[o + 1] =
                color[1];

            this.rgbaBuffer[o + 2] =
                color[2];

            this.rgbaBuffer[o + 3] =
                255;

        }

    }


    /* ========================================================
       RENDER
       ======================================================== */

    render(context = null) {

        if (context) {

            this.context =
                context;

        }

        if (!this.context)
            return;

        this.updateRGBA();

        /*
         * ImageData jest dostępne w przeglądarce.
         */

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


    /* ========================================================
       FRAMEBUFFER
       ======================================================== */

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

        const result =
            this.frameReady;

        this.frameReady = false;

        return result;

    }


    /* ========================================================
       STATE
       ======================================================== */

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
                this.lcdc,

            stat:
                this.stat,

            scx:
                this.scx,

            scy:
                this.scy,

            lyc:
                this.lyc,

            bgp:
                this.bgp,

            obp0:
                this.obp0,

            obp1:
                this.obp1,

            wy:
                this.wy,

            wx:
                this.wx

        };

    }


    /* ========================================================
       DEBUG
       ======================================================== */

    setDebug(enabled) {

        this.debug =
            Boolean(enabled);

    }


    /* ========================================================
       DESTROY
       ======================================================== */

    destroy() {

        this.canvas = null;
        this.context = null;
        this.memory = null;
        this.cpu = null;

    }

}
