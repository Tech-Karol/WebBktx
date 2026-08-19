/*
 * ============================================================
 * WebBktx Game Boy — PPU v2
 * DMG-compatible LCD / PPU
 * ============================================================
 *
 * Kompatybilność:
 *
 *   emulator.js:
 *      ppu.step(cycles)
 *      ppu.consumeFrame()
 *
 *   memory.js:
 *      ppu.lcdEnabled()
 *      ppu.readVRAM()
 *      ppu.writeVRAM()
 *      ppu.readOAM()
 *      ppu.writeOAM()
 *      ppu.readRegister()
 *      ppu.writeRegister()
 *
 * ============================================================
 */

export default class PPU {

    constructor(memory = null, canvas = null) {

        this.memory = memory;
        this.canvas = null;
        this.ctx = null;

        this.width = 160;
        this.height = 144;

        /*
         * Framebuffer przechowuje SHADE 0..3.
         */
        this.frameBuffer =
            new Uint8Array(
                this.width * this.height
            );

        /*
         * Rzeczywisty kolor BG 0..3.
         * Potrzebny do priority sprite'ów.
         */
        this.bgColorBuffer =
            new Uint8Array(
                this.width * this.height
            );

        this.displayBuffer =
            new Uint8ClampedArray(
                this.width *
                this.height *
                4
            );

        this.frameReady = false;

        /*
         * ----------------------------------------------------
         * VRAM
         * ----------------------------------------------------
         */

        this.vram =
            new Uint8Array(0x2000);

        /*
         * ----------------------------------------------------
         * OAM
         * ----------------------------------------------------
         */

        this.oam =
            new Uint8Array(0xA0);

        /*
         * ----------------------------------------------------
         * LCD registers
         * ----------------------------------------------------
         */

        this.lcdc = 0x91;
        this.stat = 0x85;

        this.scy = 0x00;
        this.scx = 0x00;

        this.ly = 0x00;
        this.lyc = 0x00;

        this.bgp = 0xFC;
        this.obp0 = 0xFF;
        this.obp1 = 0xFF;

        this.wy = 0x00;
        this.wx = 0x00;

        /*
         * ----------------------------------------------------
         * Timing
         * ----------------------------------------------------
         */

        this.mode = 2;
        this.modeClock = 0;

        this.frameCycles = 0;

        this.MODE2_CYCLES = 80;
        this.MODE3_CYCLES = 172;
        this.MODE0_CYCLES = 204;
        this.LINE_CYCLES = 456;

        /*
         * ----------------------------------------------------
         * Window
         * ----------------------------------------------------
         */

        this.windowLine = 0;

        /*
         * ----------------------------------------------------
         * STAT interrupt edge
         * ----------------------------------------------------
         */

        this.statSignal = false;

        /*
         * ----------------------------------------------------
         * Palette
         * ----------------------------------------------------
         */

        this.palette = [
            255,
            192,
            96,
            0
        ];

        this.attachCanvas(canvas);

        this.reset();
    }


    /*
     * ========================================================
     * CANVAS
     * ========================================================
     */

    attachCanvas(canvas) {

        this.canvas = canvas || null;
        this.ctx = null;

        if (!this.canvas) {
            return;
        }

        try {

            this.ctx =
                this.canvas.getContext(
                    "2d",
                    {
                        alpha: false
                    }
                );

            if (this.ctx) {

                this.canvas.width =
                    this.width;

                this.canvas.height =
                    this.height;

                this.ctx.imageSmoothingEnabled =
                    false;
            }

        } catch (e) {

            this.ctx = null;
        }
    }


    setCanvas(canvas) {

        this.attachCanvas(canvas);
    }


    /*
     * ========================================================
     * RESET
     * ========================================================
     */

    reset() {

        this.lcdc = 0x91;
        this.stat = 0x85;

        this.scy = 0;
        this.scx = 0;

        this.ly = 0;
        this.lyc = 0;

        this.bgp = 0xFC;
        this.obp0 = 0xFF;
        this.obp1 = 0xFF;

        this.wy = 0;
        this.wx = 0;

        this.mode = 2;
        this.modeClock = 0;
        this.frameCycles = 0;

        this.windowLine = 0;

        this.statSignal = false;

        this.frameReady = false;

        this.frameBuffer.fill(0);
        this.bgColorBuffer.fill(0);

        this.displayBuffer.fill(255);

        /*
         * Nie zerujemy VRAM/OAM podczas resetu.
         *
         * ROM może zostać załadowany przed resetem,
         * a emulator może oczekiwać zachowania pamięci.
         */

        this.updateSTAT();

        this.renderBlankFrame();
    }


    /*
     * ========================================================
     * LCD
     * ========================================================
     */

    lcdEnabled() {

        return (
            (this.lcdc & 0x80) !== 0
        );
    }


    isLCDEnabled() {

        return this.lcdEnabled();
    }


    bgEnabled() {

        return (
            (this.lcdc & 0x01) !== 0
        );
    }


    objEnabled() {

        return (
            (this.lcdc & 0x02) !== 0
        );
    }


    objTall() {

        return (
            (this.lcdc & 0x04) !== 0
        );
    }


    bgTileMap() {

        return (
            (this.lcdc & 0x08)
                ? 0x1C00
                : 0x1800
        );
    }


    tileDataUnsigned() {

        return (
            (this.lcdc & 0x10) !== 0
        );
    }


    windowEnabled() {

        return (
            (this.lcdc & 0x20) !== 0
        );
    }


    windowTileMap() {

        return (
            (this.lcdc & 0x40)
                ? 0x1C00
                : 0x1800
        );
    }


    /*
     * ========================================================
     * VRAM
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
     * OAM
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
     * REGISTERS
     * ========================================================
     */

    readRegister(address) {

        switch (address & 0xFF) {

            case 0x40:
                return this.lcdc;

            case 0x41:
                return (
                    this.stat |
                    0x80
                ) & 0xFF;

            case 0x42:
                return this.scy;

            case 0x43:
                return this.scx;

            case 0x44:
                return this.ly;

            case 0x45:
                return this.lyc;

            case 0x47:
                return this.bgp;

            case 0x48:
                return this.obp0;

            case 0x49:
                return this.obp1;

            case 0x4A:
                return this.wy;

            case 0x4B:
                return this.wx;

            default:
                return 0xFF;
        }
    }


    writeRegister(address, value) {

        address &= 0xFF;
        value &= 0xFF;

        switch (address) {

            case 0x40: {

                const wasEnabled =
                    this.lcdEnabled();

                this.lcdc =
                    value;

                const nowEnabled =
                    this.lcdEnabled();

                if (
                    wasEnabled &&
                    !nowEnabled
                ) {

                    this.disableLCD();

                } else if (
                    !wasEnabled &&
                    nowEnabled
                ) {

                    this.enableLCD();
                }

                break;
            }


            case 0x41:

                this.stat =
                    (
                        this.stat &
                        0x07
                    ) |
                    (
                        value &
                        0x78
                    ) |
                    0x80;

                this.updateSTAT();

                break;


            case 0x42:

                this.scy =
                    value;

                break;


            case 0x43:

                this.scx =
                    value;

                break;


            case 0x44:

                /*
                 * LY read-only.
                 */

                break;


            case 0x45:

                this.lyc =
                    value;

                this.updateSTAT();

                break;


            case 0x47:

                this.bgp =
                    value;

                break;


            case 0x48:

                this.obp0 =
                    value;

                break;


            case 0x49:

                this.obp1 =
                    value;

                break;


            case 0x4A:

                this.wy =
                    value;

                break;


            case 0x4B:

                this.wx =
                    value;

                break;
        }
    }


    readIO(address) {

        return this.readRegister(address);
    }


    writeIO(address, value) {

        this.writeRegister(
            address,
            value
        );
    }


    /*
     * ========================================================
     * LCD CONTROL
     * ========================================================
     */

    disableLCD() {

        this.mode = 0;
        this.modeClock = 0;
        this.frameCycles = 0;

        this.ly = 0;

        this.windowLine = 0;

        this.statSignal = false;

        this.updateSTAT();

        this.renderBlankFrame();
    }


    enableLCD() {

        this.mode = 2;
        this.modeClock = 0;
        this.frameCycles = 0;

        this.ly = 0;

        this.windowLine = 0;

        this.statSignal = false;

        this.updateSTAT();
    }


    /*
     * ========================================================
     * PPU STEP
     * ========================================================
     */

    step(cycles = 4) {

        cycles |= 0;

        if (cycles <= 0) {
            return;
        }

        if (!this.lcdEnabled()) {
            return;
        }

        this.modeClock += cycles;
        this.frameCycles += cycles;

        while (true) {

            let limit;

            switch (this.mode) {

                case 0:
                    limit =
                        this.MODE0_CYCLES;
                    break;

                case 1:
                    limit =
                        this.LINE_CYCLES;
                    break;

                case 2:
                    limit =
                        this.MODE2_CYCLES;
                    break;

                case 3:
                    limit =
                        this.MODE3_CYCLES;
                    break;

                default:
                    this.mode = 2;
                    limit =
                        this.MODE2_CYCLES;
                    break;
            }

            if (
                this.modeClock <
                limit
            ) {

                break;
            }

            this.modeClock -=
                limit;

            this.advanceMode();
        }
    }


    /*
     * ========================================================
     * MODE TRANSITION
     * ========================================================
     */

    advanceMode() {

        if (!this.lcdEnabled()) {
            return;
        }

        switch (this.mode) {

            /*
             * OAM
             */

            case 2:

                this.setMode(3);

                break;


            /*
             * DRAW
             */

            case 3:

                this.renderScanline();

                this.setMode(0);

                break;


            /*
             * HBLANK
             */

            case 0:

                this.ly++;

                if (
                    this.ly === 144
                ) {

                    this.setMode(1);

                    this.presentFrame();

                } else {

                    this.setMode(2);
                }

                this.updateSTAT();

                break;


            /*
             * VBLANK
             */

            case 1:

                this.ly++;

                if (
                    this.ly > 153
                ) {

                    this.ly = 0;

                    this.windowLine = 0;

                    this.setMode(2);
                }

                this.updateSTAT();

                break;
        }
    }


    /*
     * ========================================================
     * MODE / STAT
     * ========================================================
     */

    setMode(mode) {

        this.mode =
            mode & 3;

        this.stat =
            (
                this.stat &
                0xFC
            ) |
            this.mode;

        this.updateSTATInterrupt();
    }


    updateSTAT() {

        if (
            this.ly === this.lyc
        ) {

            this.stat |=
                0x04;

        } else {

            this.stat &=
                ~0x04;
        }

        this.stat =
            (
                this.stat &
                0xFC
            ) |
            this.mode;

        this.updateSTATInterrupt();
    }


    updateSTATInterrupt() {

        let signal = false;

        if (
            this.mode === 0 &&
            (this.stat & 0x08)
        ) {

            signal = true;
        }

        if (
            this.mode === 1 &&
            (this.stat & 0x10)
        ) {

            signal = true;
        }

        if (
            this.mode === 2 &&
            (this.stat & 0x20)
        ) {

            signal = true;
        }

        if (
            (this.stat & 0x40) &&
            this.ly === this.lyc
        ) {

            signal = true;
        }

        if (
            signal &&
            !this.statSignal
        ) {

            this.requestSTATInterrupt();
        }

        this.statSignal =
            signal;
    }


    requestSTATInterrupt() {

        if (
            this.memory &&
            typeof this.memory.requestInterrupt ===
            "function"
        ) {

            this.memory.requestInterrupt(1);

            return;
        }

        if (
            this.memory &&
            typeof this.memory.requestInterruptFlag ===
            "function"
        ) {

            this.memory.requestInterruptFlag(1);

            return;
        }

        if (
            this.memory &&
            typeof this.memory.interruptFlags ===
            "number"
        ) {

            this.memory.interruptFlags |=
                0x02;
        }
    }


    requestVBlankInterrupt() {

        if (
            this.memory &&
            typeof this.memory.requestInterrupt ===
            "function"
        ) {

            this.memory.requestInterrupt(0);

            return;
        }

        if (
            this.memory &&
            typeof this.memory.requestInterruptFlag ===
            "function"
        ) {

            this.memory.requestInterruptFlag(0);

            return;
        }

        if (
            this.memory &&
            typeof this.memory.interruptFlags ===
            "number"
        ) {

            this.memory.interruptFlags |=
                0x01;
        }
    }


    /*
     * ========================================================
     * SCANLINE
     * ========================================================
     */

    renderScanline() {

        const y =
            this.ly;

        if (
            y < 0 ||
            y >= 144
        ) {

            return;
        }

        this.renderBackground(y);

        if (
            this.windowEnabled()
        ) {

            this.renderWindow(y);
        }

        if (
            this.objEnabled()
        ) {

            this.renderSprites(y);
        }
    }


    /*
     * ========================================================
     * BACKGROUND
     * ========================================================
     */

    renderBackground(y) {

        const base =
            y * 160;

        /*
         * LCDC.0 off:
         *
         * Real DMG behavior is nuanced, but for an emulator
         * this gives a stable blank BG.
         */

        if (
            !this.bgEnabled()
        ) {

            for (
                let x = 0;
                x < 160;
                x++
            ) {

                this.bgColorBuffer[
                    base + x
                ] = 0;

                this.frameBuffer[
                    base + x
                ] =
                    this.getPaletteColor(
                        this.bgp,
                        0
                    );
            }

            return;
        }


        const mapBase =
            this.bgTileMap();

        const yPos =
            (
                y +
                this.scy
            ) & 0xFF;

        const tileRow =
            (
                yPos >> 3
            ) & 31;

        const pixelY =
            yPos & 7;


        for (
            let x = 0;
            x < 160;
            x++
        ) {

            const xPos =
                (
                    x +
                    this.scx
                ) & 0xFF;

            const tileColumn =
                (
                    xPos >> 3
                ) & 31;

            const pixelX =
                xPos & 7;


            /*
             * 32x32 tilemap.
             */

            const mapAddress =
                (
                    mapBase +
                    tileRow * 32 +
                    tileColumn
                ) & 0x1FFF;


            const tileNumber =
                this.vram[
                    mapAddress
                ];


            const tileAddress =
                this.getTileAddress(
                    tileNumber
                );


            const rowAddress =
                (
                    tileAddress +
                    pixelY * 2
                ) & 0x1FFF;


            const low =
                this.vram[
                    rowAddress
                ];

            const high =
                this.vram[
                    (
                        rowAddress + 1
                    ) & 0x1FFF
                ];


            const bit =
                7 - pixelX;


            const color =
                (
                    (
                        high >> bit
                    ) & 1
                ) << 1 |
                (
                    low >> bit
                ) & 1;


            this.bgColorBuffer[
                base + x
            ] =
                color;


            this.frameBuffer[
                base + x
            ] =
                this.getPaletteColor(
                    this.bgp,
                    color
                );
        }
    }


    /*
     * ========================================================
     * WINDOW
     * ========================================================
     */

    renderWindow(y) {

        if (
            !this.windowEnabled()
        ) {

            return;
        }

        /*
         * WX is screen X + 7.
         */

        const startX =
            this.wx - 7;

        if (
            startX >= 160
        ) {

            return;
        }

        if (
            y < this.wy
        ) {

            return;
        }


        const winY =
            this.windowLine;

        const mapBase =
            this.windowTileMap();

        const tileRow =
            (
                winY >> 3
            ) & 31;

        const pixelY =
            winY & 7;


        let visible =
            false;


        for (
            let x = 0;
            x < 160;
            x++
        ) {

            if (
                x < startX
            ) {

                continue;
            }


            const wxPos =
                x - startX;

            const tileColumn =
                (
                    wxPos >> 3
                ) & 31;

            const pixelX =
                wxPos & 7;


            const mapAddress =
                (
                    mapBase +
                    tileRow * 32 +
                    tileColumn
                ) & 0x1FFF;


            const tileNumber =
                this.vram[
                    mapAddress
                ];


            const tileAddress =
                this.getTileAddress(
                    tileNumber
                );


            const rowAddress =
                (
                    tileAddress +
                    pixelY * 2
                ) & 0x1FFF;


            const low =
                this.vram[
                    rowAddress
                ];

            const high =
                this.vram[
                    (
                        rowAddress + 1
                    ) & 0x1FFF
                ];


            const bit =
                7 - pixelX;


            const color =
                (
                    (
                        high >> bit
                    ) & 1
                ) << 1 |
                (
                    low >> bit
                ) & 1;


            const index =
                y * 160 + x;


            this.bgColorBuffer[
                index
            ] =
                color;


            this.frameBuffer[
                index
            ] =
                this.getPaletteColor(
                    this.bgp,
                    color
                );


            visible = true;
        }


        if (visible) {

            this.windowLine++;
        }
    }


    /*
     * ========================================================
     * TILE ADDRESS
     * ========================================================
     */

    getTileAddress(tileNumber) {

        tileNumber &= 0xFF;

        if (
            this.tileDataUnsigned()
        ) {

            return (
                tileNumber *
                16
            ) & 0x1FFF;
        }


        /*
         * 0x8800 addressing:
         *
         * 0x80 = tile -128
         * 0xFF = tile -1
         *
         * Base = 0x1000 inside VRAM.
         */

        const signed =
            tileNumber & 0x80
                ? tileNumber - 0x100
                : tileNumber;


        return (
            0x1000 +
            signed * 16
        ) & 0x1FFF;
    }


    /*
     * ========================================================
     * SPRITES
     * ========================================================
     */

    renderSprites(y) {

        const height =
            this.objTall()
                ? 16
                : 8;


        const sprites = [];


        /*
         * Hardware limit:
         * maximum 10 sprites per scanline.
         */

        for (
            let i = 0;
            i < 40;
            i++
        ) {

            const oam =
                i * 4;

            const spriteY =
                this.oam[oam] - 16;

            const spriteX =
                this.oam[oam + 1] - 8;


            if (
                y >= spriteY &&
                y < spriteY + height
            ) {

                sprites.push({
                    index: i,
                    x: spriteX,
                    y: spriteY,
                    tile: this.oam[oam + 2],
                    flags: this.oam[oam + 3]
                });


                if (
                    sprites.length === 10
                ) {

                    break;
                }
            }
        }


        /*
         * Draw low priority first.
         *
         * Higher priority sprite overwrites it.
         */

        sprites.sort(
            (a, b) => {

                if (
                    a.x !== b.x
                ) {

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
                y,
                height
            );
        }
    }


    renderSprite(
        sprite,
        y,
        height
    ) {

        let row =
            y -
            sprite.y;


        const flags =
            sprite.flags;


        const xFlip =
            (
                flags &
                0x20
            ) !== 0;

        const yFlip =
            (
                flags &
                0x40
            ) !== 0;

        const behindBG =
            (
                flags &
                0x80
            ) !== 0;


        if (yFlip) {

            row =
                height -
                1 -
                row;
        }


        let tile =
            sprite.tile;


        /*
         * 8x16 sprite:
         *
         * bit 0 is ignored.
         */

        if (
            height === 16
        ) {

            tile &=
                0xFE;

            if (
                row >= 8
            ) {

                tile++;

                row -= 8;
            }
        }


        const tileAddress =
            (
                tile *
                16
            ) & 0x1FFF;


        const rowAddress =
            (
                tileAddress +
                row * 2
            ) & 0x1FFF;


        const low =
            this.vram[
                rowAddress
            ];

        const high =
            this.vram[
                (
                    rowAddress + 1
                ) & 0x1FFF
            ];


        const palette =
            (
                flags &
                0x10
            )
                ? this.obp1
                : this.obp0;


        for (
            let px = 0;
            px < 8;
            px++
        ) {

            const screenX =
                sprite.x + px;


            if (
                screenX < 0 ||
                screenX >= 160
            ) {

                continue;
            }


            const bit =
                xFlip
                    ? px
                    : 7 - px;


            const color =
                (
                    (
                        high >> bit
                    ) & 1
                ) << 1 |
                (
                    low >> bit
                ) & 1;


            /*
             * Sprite color 0 = transparent.
             */

            if (
                color === 0
            ) {

                continue;
            }


            const index =
                y * 160 +
                screenX;


            /*
             * Sprite priority.
             *
             * If BG color is non-zero, sprite behind-BG
             * cannot overwrite it.
             */

            if (
                behindBG &&
                this.bgEnabled() &&
                this.bgColorBuffer[index] !== 0
            ) {

                continue;
            }


            this.frameBuffer[index] =
                this.getPaletteColor(
                    palette,
                    color
                );
        }
    }


    /*
     * ========================================================
     * PALETTE
     * ========================================================
     */

    getPaletteColor(
        palette,
        color
    ) {

        return (
            palette >>
            (
                (color & 3) * 2
            )
        ) & 3;
    }


    /*
     * ========================================================
     * FRAME OUTPUT
     * ========================================================
     */

    convertFrameToRGBA() {

        for (
            let i = 0;
            i < this.frameBuffer.length;
            i++
        ) {

            const shadeIndex =
                this.frameBuffer[i] & 3;

            const shade =
                this.palette[
                    shadeIndex
                ];


            const p =
                i * 4;


            this.displayBuffer[p] =
                shade;

            this.displayBuffer[p + 1] =
                shade;

            this.displayBuffer[p + 2] =
                shade;

            this.displayBuffer[p + 3] =
                255;
        }
    }


    presentFrame() {

        this.convertFrameToRGBA();

        this.frameReady = true;

        if (
            this.ctx
        ) {

            try {

                const image =
                    new ImageData(
                        this.displayBuffer,
                        160,
                        144
                    );


                this.ctx.putImageData(
                    image,
                    0,
                    0
                );

            } catch (e) {

                /*
                 * Canvas error must not kill CPU.
                 */
            }
        }


        this.requestVBlankInterrupt();
    }


    /*
     * ========================================================
     * consumeFrame()
     * ========================================================
     *
     * emulator.js already calls this method.
     */

    consumeFrame() {

        if (
            !this.frameReady
        ) {

            return false;
        }

        this.frameReady =
            false;

        return true;
    }


    /*
     * ========================================================
     * BLANK
     * ========================================================
     */

    renderBlankFrame() {

        this.frameBuffer.fill(0);
        this.bgColorBuffer.fill(0);

        this.convertFrameToRGBA();

        this.frameReady = false;

        if (
            !this.ctx
        ) {

            return;
        }

        try {

            const image =
                new ImageData(
                    this.displayBuffer,
                    160,
                    144
                );

            this.ctx.putImageData(
                image,
                0,
                0
            );

        } catch (e) {
            /* Ignore canvas failure. */
        }
    }


    /*
     * ========================================================
     * DEBUG
     * ========================================================
     */

    getMode() {

        return this.mode;
    }


    getLY() {

        return this.ly;
    }


    getFrameBuffer() {

        return this.frameBuffer;
    }


    getDisplayBuffer() {

        return this.displayBuffer;
    }


    getState() {

        return {

            lcdc:
                this.lcdc,

            stat:
                this.stat,

            scy:
                this.scy,

            scx:
                this.scx,

            ly:
                this.ly,

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
                this.wx,

            mode:
                this.mode,

            modeClock:
                this.modeClock,

            frameCycles:
                this.frameCycles,

            windowLine:
                this.windowLine,

            lcdEnabled:
                this.lcdEnabled()
        };
    }
}
