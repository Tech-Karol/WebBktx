/*
 * ============================================================
 * WebBktx — Game Boy PPU / LCD
 * DMG compatible
 *
 * API kompatybilne z obecnym GameBoyMemory:
 *
 *   lcdEnabled()
 *   readRegister()
 *   onRegisterWrite()
 *   step()
 *   consumeFrame()
 *   connectCanvas()
 *   setInterruptCallback()
 *
 * PPU does NOT write its registers through memory.writeByte().
 * VRAM/OAM are shared directly with GameBoyMemory.
 * ============================================================
 */

export default class PPU {

    constructor(canvas = null) {

        this.memory = null;

        /*
         * Shared by GameBoyMemory.connectPPU().
         */
        this.vram = null;
        this.oam = null;

        /*
         * LCD registers.
         */
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

        /*
         * LCD state.
         */
        this.mode = 2;
        this.modeClock = 0;

        /*
         * Current frame.
         */
        this.frameReady = false;

        this.frameCounter = 0;

        /*
         * 160x144 RGBA framebuffer.
         */
        this.width = 160;
        this.height = 144;

        this.framebuffer =
            new Uint8ClampedArray(
                this.width *
                this.height *
                4
            );

        /*
         * Temporary scanline buffers.
         */
        this.bgColor =
            new Uint8Array(this.width);

        this.bgPriority =
            new Uint8Array(this.width);

        /*
         * DMG grayscale palette.
         *
         * Index 0 = lightest.
         * Index 3 = darkest.
         */
        this.palette = [
            [224, 248, 208, 255],
            [136, 192, 112, 255],
            [52, 104, 86, 255],
            [8, 24, 32, 255]
        ];

        /*
         * Canvas.
         */
        this.canvas = null;
        this.ctx = null;
        this.imageData = null;

        /*
         * Interrupt callback.
         */
        this.interruptCallback = null;

        /*
         * STAT edge tracking.
         */
        this.statLine = false;

        /*
         * Sprite buffer.
         */
        this.spriteList = new Array(10);

        this.connectCanvas(canvas);

        this.reset();

    }


    /* ========================================================
       RESET
       ======================================================== */

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

        this.frameReady = false;

        this.frameCounter = 0;

        this.statLine = false;

        this.framebuffer.fill(0);

        this.updateSTAT();

        this.clearScreen();

    }


    /* ========================================================
       CANVAS
       ======================================================== */

    connectCanvas(canvas) {

        /*
         * Important:
         *
         * Some emulator versions may pass a wrapper/object
         * instead of the canvas itself.
         */

        if (
            !canvas ||
            typeof canvas.getContext !== "function"
        ) {

            this.canvas = null;
            this.ctx = null;
            this.imageData = null;

            return false;

        }

        this.canvas = canvas;

        this.canvas.width =
            this.width;

        this.canvas.height =
            this.height;

        this.ctx =
            this.canvas.getContext(
                "2d",
                {
                    alpha: false
                }
            );

        if (!this.ctx) {

            this.imageData = null;

            return false;

        }

        this.imageData =
            this.ctx.createImageData(
                this.width,
                this.height
            );

        this.clearScreen();

        return true;

    }


    clearScreen() {

        if (!this.framebuffer)
            return;

        /*
         * Black screen.
         */
        for (
            let i = 0;
            i < this.framebuffer.length;
            i += 4
        ) {

            this.framebuffer[i] = 8;
            this.framebuffer[i + 1] = 24;
            this.framebuffer[i + 2] = 32;
            this.framebuffer[i + 3] = 255;

        }

        this.present();

    }


    present() {

        if (
            !this.ctx ||
            !this.imageData
        ) {

            return;

        }

        this.imageData.data.set(
            this.framebuffer
        );

        this.ctx.putImageData(
            this.imageData,
            0,
            0
        );

    }


    /* ========================================================
       INTERRUPTS
       ======================================================== */

    setInterruptCallback(callback) {

        this.interruptCallback =
            typeof callback === "function"
                ? callback
                : null;

    }


    requestInterrupt(bit) {

        if (
            this.interruptCallback
        ) {

            this.interruptCallback(
                bit
            );

        }

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
       REGISTERS
       ======================================================== */

    readRegister(address) {

        address &= 0xFFFF;

        switch (address) {

            case 0xFF40:
                return this.lcdc;

            case 0xFF41:
                return (
                    this.stat |
                    0x80
                ) & 0xFF;

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

        }

        return 0xFF;

    }


    onRegisterWrite(address, value) {

        address &= 0xFFFF;
        value &= 0xFF;

        switch (address) {

            case 0xFF40:

                this.writeLCDC(
                    value
                );

                break;

            case 0xFF41:

                /*
                 * Bits 0-2 are read-only.
                 */
                this.stat =
                    (
                        value &
                        0x78
                    ) |
                    (
                        this.stat &
                        0x07
                    );

                this.updateSTAT();

                break;

            case 0xFF42:

                this.scy =
                    value;

                break;

            case 0xFF43:

                this.scx =
                    value;

                break;

            case 0xFF44:

                /*
                 * LY is read-only.
                 */
                break;

            case 0xFF45:

                this.lyc =
                    value;

                this.updateSTAT();

                break;

            case 0xFF47:

                this.bgp =
                    value;

                break;

            case 0xFF48:

                this.obp0 =
                    value;

                break;

            case 0xFF49:

                this.obp1 =
                    value;

                break;

            case 0xFF4A:

                this.wy =
                    value;

                break;

            case 0xFF4B:

                this.wx =
                    value;

                break;

        }

    }


    writeLCDC(value) {

        const old =
            this.lcdc;

        this.lcdc =
            value & 0xFF;

        const oldEnabled =
            (old & 0x80) !== 0;

        const newEnabled =
            (this.lcdc & 0x80) !== 0;

        /*
         * LCD turned off.
         */
        if (
            oldEnabled &&
            !newEnabled
        ) {

            this.mode =
                0;

            this.modeClock =
                0;

            this.ly =
                0;

            this.frameReady =
                false;

            this.updateSTAT();

            this.clearScreen();

            return;

        }

        /*
         * LCD turned on.
         */
        if (
            !oldEnabled &&
            newEnabled
        ) {

            this.mode =
                2;

            this.modeClock =
                0;

            this.ly =
                0;

            this.updateSTAT();

        }

    }


    /* ========================================================
       STAT
       ======================================================== */

    updateSTAT() {

        /*
         * Keep coincidence flag updated.
         */
        if (
            this.ly ===
            this.lyc
        ) {

            this.stat |=
                0x04;

        } else {

            this.stat &=
                ~0x04;

        }

        /*
         * Mode bits.
         */
        this.stat =
            (
                this.stat &
                0xFC
            ) |
            (
                this.mode &
                0x03
            );

        /*
         * STAT interrupt line.
         */
        let signal =
            false;

        /*
         * Mode 0 interrupt.
         */
        if (
            this.mode === 0 &&
            (this.stat & 0x08)
        ) {

            signal = true;

        }

        /*
         * Mode 1 interrupt.
         */
        if (
            this.mode === 1 &&
            (this.stat & 0x10)
        ) {

            signal = true;

        }

        /*
         * Mode 2 interrupt.
         */
        if (
            this.mode === 2 &&
            (this.stat & 0x20)
        ) {

            signal = true;

        }

        /*
         * LYC interrupt.
         */
        if (
            this.ly === this.lyc &&
            (this.stat & 0x40)
        ) {

            signal = true;

        }

        /*
         * Rising edge.
         */
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
       STEP
       ======================================================== */

    step(cycles = 4) {

        if (
            !this.lcdEnabled()
        ) {

            return;

        }

        cycles =
            Math.max(
                0,
                cycles | 0
            );

        this.modeClock +=
            cycles;

        /*
         * A single call can contain more than
         * one PPU transition.
         */
        while (true) {

            if (
                this.mode === 2
            ) {

                if (
                    this.modeClock < 80
                ) {

                    break;

                }

                this.modeClock -=
                    80;

                this.mode =
                    3;

                this.updateSTAT();

                continue;

            }


            if (
                this.mode === 3
            ) {

                if (
                    this.modeClock < 172
                ) {

                    break;

                }

                this.modeClock -=
                    172;

                /*
                 * Render current visible scanline.
                 */
                if (
                    this.ly < 144
                ) {

                    this.renderScanline(
                        this.ly
                    );

                }

                this.mode =
                    0;

                this.updateSTAT();

                continue;

            }


            if (
                this.mode === 0
            ) {

                if (
                    this.modeClock < 204
                ) {

                    break;

                }

                this.modeClock -=
                    204;

                this.ly++;

                if (
                    this.ly === 144
                ) {

                    /*
                     * Enter VBlank.
                     */
                    this.mode =
                        1;

                    this.frameReady =
                        true;

                    this.frameCounter++;

                    this.requestInterrupt(0);

                    /*
                     * Present completed frame.
                     */
                    this.present();

                    this.updateSTAT();

                    continue;

                }

                this.mode =
                    2;

                this.updateSTAT();

                continue;

            }


            if (
                this.mode === 1
            ) {

                if (
                    this.modeClock < 456
                ) {

                    break;

                }

                this.modeClock -=
                    456;

                this.ly++;

                if (
                    this.ly > 153
                ) {

                    this.ly =
                        0;

                    this.mode =
                        2;

                    this.updateSTAT();

                } else {

                    this.updateSTAT();

                }

                continue;

            }

            break;

        }

    }


    /*
     * Kept as public API because older emulator.js
     * may call it directly.
     */
    advanceMode() {

        this.step(456);

    }


    /* ========================================================
       FRAME
       ======================================================== */

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


    /* ========================================================
       SCANLINE RENDERER
       ======================================================== */

    renderScanline(y) {

        if (
            y < 0 ||
            y >= 144
        ) {

            return;

        }

        /*
         * If LCD is disabled, show blank.
         */
        if (
            !this.lcdEnabled()
        ) {

            return;

        }

        this.renderBackground(
            y
        );

        this.renderWindow(
            y
        );

        this.renderSprites(
            y
        );

    }


    /* ========================================================
       BACKGROUND
       ======================================================== */

    renderBackground(y) {

        /*
         * LCDC bit 0:
         *
         * DMG:
         * 0 = background disabled
         * 1 = enabled
         */
        if (
            !(this.lcdc & 0x01)
        ) {

            for (
                let x = 0;
                x < 160;
                x++
            ) {

                this.bgColor[x] =
                    0;

                this.bgPriority[x] =
                    0;

                this.putPixel(
                    x,
                    y,
                    this.getPaletteColor(
                        0,
                        this.bgp
                    )
                );

            }

            return;

        }

        const tileMapBase =
            (
                this.lcdc &
                0x08
            )
                ? 0x1C00
                : 0x1800;

        const unsignedTiles =
            Boolean(
                this.lcdc &
                0x10
            );

        const mapY =
            (
                this.scy +
                y
            ) & 0xFF;

        const tileRow =
            (
                mapY >> 3
            ) & 31;

        const pixelY =
            mapY & 7;

        for (
            let x = 0;
            x < 160;
            x++
        ) {

            const mapX =
                (
                    this.scx +
                    x
                ) & 0xFF;

            const tileColumn =
                (
                    mapX >> 3
                ) & 31;

            const tileAddress =
                tileMapBase +
                tileRow * 32 +
                tileColumn;

            const tileNumber =
                this.readVRAM(
                    tileAddress
                );

            let tileDataAddress;

            if (
                unsignedTiles
            ) {

                tileDataAddress =
                    0x0000 +
                    tileNumber * 16;

            } else {

                /*
                 * Signed tile number mode.
                 */
                const signed =
                    tileNumber & 0x80
                        ? tileNumber - 256
                        : tileNumber;

                tileDataAddress =
                    0x1000 +
                    signed * 16;

            }

            tileDataAddress =
                (
                    tileDataAddress +
                    pixelY * 2
                ) & 0x1FFF;

            const low =
                this.readVRAM(
                    tileDataAddress
                );

            const high =
                this.readVRAM(
                    tileDataAddress + 1
                );

            const bit =
                7 -
                (
                    mapX & 7
                );

            const color =
                (
                    (
                        high >> bit
                    ) & 1
                ) << 1 |
                (
                    low >> bit
                ) & 1;

            this.bgColor[x] =
                color;

            this.bgPriority[x] =
                color !== 0
                    ? 1
                    : 0;

            this.putPixel(
                x,
                y,
                this.getPaletteColor(
                    color,
                    this.bgp
                )
            );

        }

    }


    /* ========================================================
       WINDOW
       ======================================================== */

    renderWindow(y) {

        /*
         * LCDC bit 5:
         * Window enable.
         */
        if (
            !(this.lcdc & 0x20)
        ) {

            return;

        }

        /*
         * Window starts at WY.
         */
        if (
            y < this.wy
        ) {

            return;

        }

        /*
         * WX is screen X + 7.
         */
        const startX =
            this.wx - 7;

        /*
         * LCDC bit 6:
         * Window tile map.
         */
        const tileMapBase =
            (
                this.lcdc &
                0x40
            )
                ? 0x1C00
                : 0x1800;

        const unsignedTiles =
            Boolean(
                this.lcdc &
                0x10
            );

        const windowY =
            y -
            this.wy;

        const tileRow =
            (
                windowY >> 3
            ) & 31;

        const pixelY =
            windowY & 7;

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

            const windowX =
                x -
                startX;

            const tileColumn =
                (
                    windowX >> 3
                ) & 31;

            const tileAddress =
                tileMapBase +
                tileRow * 32 +
                tileColumn;

            const tileNumber =
                this.readVRAM(
                    tileAddress
                );

            let tileDataAddress;

            if (
                unsignedTiles
            ) {

                tileDataAddress =
                    tileNumber * 16;

            } else {

                const signed =
                    tileNumber & 0x80
                        ? tileNumber - 256
                        : tileNumber;

                tileDataAddress =
                    0x1000 +
                    signed * 16;

            }

            tileDataAddress =
                (
                    tileDataAddress +
                    pixelY * 2
                ) & 0x1FFF;

            const low =
                this.readVRAM(
                    tileDataAddress
                );

            const high =
                this.readVRAM(
                    tileDataAddress + 1
                );

            const bit =
                7 -
                (
                    windowX & 7
                );

            const color =
                (
                    (
                        high >> bit
                    ) & 1
                ) << 1 |
                (
                    low >> bit
                ) & 1;

            this.bgColor[x] =
                color;

            this.bgPriority[x] =
                color !== 0
                    ? 1
                    : 0;

            this.putPixel(
                x,
                y,
                this.getPaletteColor(
                    color,
                    this.bgp
                )
            );

        }

    }


    /* ========================================================
       SPRITES
       ======================================================== */

    renderSprites(y) {

        if (
            !(this.lcdc & 0x02)
        ) {

            return;

        }

        const spriteHeight =
            (
                this.lcdc &
                0x04
            )
                ? 16
                : 8;

        let count = 0;

        /*
         * DMG evaluates OAM in order and only
         * up to 10 sprites can appear per line.
         */
        for (
            let i = 0;
            i < 40 &&
            count < 10;
            i++
        ) {

            const base =
                i * 4;

            const spriteY =
                this.readOAM(
                    base
                ) - 16;

            const spriteX =
                this.readOAM(
                    base + 1
                ) - 8;

            const tile =
                this.readOAM(
                    base + 2
                );

            const flags =
                this.readOAM(
                    base + 3
                );

            if (
                y < spriteY ||
                y >=
                spriteY +
                spriteHeight
            ) {

                continue;

            }

            this.spriteList[count++] = {
                index: i,
                x: spriteX,
                y: spriteY,
                tile: tile,
                flags: flags
            };

        }

        /*
         * DMG priority:
         * lower X first; OAM index breaks ties.
         *
         * Draw backwards so earlier sprites remain
         * visible on top.
         */
        this.spriteList
            .slice(
                0,
                count
            )
            .sort(
                (a, b) => {

                    if (
                        a.x !== b.x
                    ) {

                        return b.x - a.x;

                    }

                    return b.index -
                           a.index;

                }
            );

        for (
            let i = 0;
            i < count;
            i++
        ) {

            const sprite =
                this.spriteList[i];

            this.renderSprite(
                sprite,
                y,
                spriteHeight
            );

        }

    }


    renderSprite(
        sprite,
        y,
        spriteHeight
    ) {

        let line =
            y -
            sprite.y;

        const flags =
            sprite.flags;

        const flipY =
            Boolean(
                flags & 0x40
            );

        const flipX =
            Boolean(
                flags & 0x20
            );

        const palette =
            (
                flags & 0x10
            )
                ? this.obp1
                : this.obp0;

        if (
            flipY
        ) {

            line =
                spriteHeight -
                1 -
                line;

        }

        let tile =
            sprite.tile;

        /*
         * 8x16 sprites ignore bit 0.
         */
        if (
            spriteHeight === 16
        ) {

            tile &=
                0xFE;

            if (
                line >= 8
            ) {

                tile++;

                line -= 8;

            }

        }

        const address =
            (
                tile * 16 +
                line * 2
            ) & 0x1FFF;

        const low =
            this.readVRAM(
                address
            );

        const high =
            this.readVRAM(
                address + 1
            );

        for (
            let px = 0;
            px < 8;
            px++
        ) {

            const screenX =
                sprite.x +
                px;

            if (
                screenX < 0 ||
                screenX >= 160
            ) {

                continue;

            }

            const bit =
                flipX
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
             * Sprite color 0 is transparent.
             */
            if (
                color === 0
            ) {

                continue;

            }

            /*
             * OAM priority flag.
             *
             * If set, sprite is behind non-zero BG.
             */
            if (
                flags & 0x80
            ) {

                if (
                    this.bgPriority[screenX]
                ) {

                    continue;

                }

            }

            this.putPixel(
                screenX,
                y,
                this.getPaletteColor(
                    color,
                    palette
                )
            );

        }

    }


    /* ========================================================
       VRAM / OAM
       ======================================================== */

    readVRAM(address) {

        address &=
            0x1FFF;

        if (
            this.vram
        ) {

            return this.vram[address];

        }

        if (
            this.memory &&
            this.memory.vram
        ) {

            return this.memory.vram[address];

        }

        return 0xFF;

    }


    writeVRAM(address, value) {

        address &=
            0x1FFF;

        value &=
            0xFF;

        if (
            this.vram
        ) {

            this.vram[address] =
                value;

        }

    }


    readOAM(address) {

        address &=
            0x9F;

        if (
            this.oam
        ) {

            return this.oam[address];

        }

        if (
            this.memory &&
            this.memory.oam
        ) {

            return this.memory.oam[address];

        }

        return 0xFF;

    }


    writeOAM(address, value) {

        address &=
            0x9F;

        value &=
            0xFF;

        if (
            this.oam
        ) {

            this.oam[address] =
                value;

        }

    }


    /* ========================================================
       PIXEL
       ======================================================== */

    putPixel(
        x,
        y,
        color
    ) {

        if (
            x < 0 ||
            x >= this.width ||
            y < 0 ||
            y >= this.height
        ) {

            return;

        }

        const index =
            (
                y *
                this.width +
                x
            ) * 4;

        this.framebuffer[index] =
            color[0];

        this.framebuffer[index + 1] =
            color[1];

        this.framebuffer[index + 2] =
            color[2];

        this.framebuffer[index + 3] =
            255;

    }


    getPaletteColor(
        color,
        palette
    ) {

        const shade =
            (
                palette >>
                (
                    color * 2
                )
            ) & 3;

        return this.palette[
            shade
        ];

    }


    /* ========================================================
       DEBUG
       ======================================================== */

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

            frameReady:
                this.frameReady,

            frameCounter:
                this.frameCounter

        };

    }

}
