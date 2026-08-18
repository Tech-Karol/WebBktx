/*
 * ============================================================
 * WebBktx — Nintendo Game Boy DMG PPU
 * ============================================================
 *
 * Obsługuje:
 *
 *  - LCDC
 *  - STAT
 *  - SCX / SCY
 *  - LY / LYC
 *  - BGP
 *  - OBP0 / OBP1
 *  - VRAM
 *  - OAM
 *  - Background
 *  - Window
 *  - Sprites / Objects
 *  - 8x8 / 8x16 sprites
 *  - HBlank
 *  - VBlank
 *  - OAM scan
 *  - Pixel transfer
 *  - Framebuffer 160x144
 *
 * DMG:
 *
 *  456 dots / scanline
 *  154 scanlines / frame
 *  70224 dots / frame
 *
 * CPU clock:
 *  4194304 Hz
 *
 * ============================================================
 */

export default class PPU {

    constructor() {

        /*
         * ----------------------------------------------------
         * Display
         * ----------------------------------------------------
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
         * ----------------------------------------------------
         * VRAM
         * ----------------------------------------------------
         *
         * 8000-9FFF
         *
         */

        this.vram =
            new Uint8Array(0x2000);


        /*
         * ----------------------------------------------------
         * OAM
         * ----------------------------------------------------
         *
         * FE00-FE9F
         *
         * 40 sprites × 4 bytes
         *
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

        this.wy = 0x00;
        this.wx = 0x00;

        this.bgp = 0xFC;
        this.obp0 = 0xFF;
        this.obp1 = 0xFF;


        /*
         * ----------------------------------------------------
         * Timing
         * ----------------------------------------------------
         */

        this.mode =
            2;

        this.modeClock =
            0;

        this.frameReady =
            false;


        /*
         * ----------------------------------------------------
         * Interrupt callback
         * ----------------------------------------------------
         */

        this.interruptCallback =
            null;


        /*
         * ----------------------------------------------------
         * STAT edge tracking
         * ----------------------------------------------------
         */

        this.statSignal =
            false;


        /*
         * ----------------------------------------------------
         * Window
         * ----------------------------------------------------
         */

        this.windowLine =
            0;

        this.windowTriggered =
            false;


        /*
         * ----------------------------------------------------
         * Current scanline
         * ----------------------------------------------------
         */

        this.lineSprites = [];


        /*
         * ----------------------------------------------------
         * Debug
         * ----------------------------------------------------
         */

        this.frameCount =
            0;


        /*
         * ----------------------------------------------------
         * Initial framebuffer
         * ----------------------------------------------------
         */

        this.clearFrame();

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

        this.wy = 0;
        this.wx = 0;

        this.bgp = 0xFC;
        this.obp0 = 0xFF;
        this.obp1 = 0xFF;

        this.mode = 2;
        this.modeClock = 0;

        this.frameReady = false;

        this.windowLine = 0;
        this.windowTriggered = false;

        this.lineSprites.length = 0;

        this.frameCount = 0;

        this.clearFrame();

        this.updateLYC();

    }


    /*
     * ========================================================
     * CONNECT INTERRUPT
     * ========================================================
     */

    setInterruptCallback(callback) {

        this.interruptCallback =
            callback;

    }


    /*
     * ========================================================
     * INTERRUPT
     * ========================================================
     */

    requestInterrupt(bit) {

        if (
            typeof this.interruptCallback ===
            "function"
        ) {

            this.interruptCallback(bit);

        }

    }


    /*
     * ========================================================
     * CLEAR FRAME
     * ========================================================
     */

    clearFrame() {

        /*
         * Default DMG palette.
         *
         * Lightest color.
         */

        for (
            let i = 0;
            i < this.framebuffer.length;
            i += 4
        ) {

            this.framebuffer[i] =
                155;

            this.framebuffer[i + 1] =
                188;

            this.framebuffer[i + 2] =
                15;

            this.framebuffer[i + 3] =
                255;

        }

    }


    /*
     * ========================================================
     * STEP
     * ========================================================
     *
     * cycles = CPU cycles
     *
     * DMG PPU operates at 4 dots per CPU cycle.
     *
     * ========================================================
     */

    step(cycles) {

        /*
         * LCD disabled.
         */

        if (
            !(this.lcdc & 0x80)
        ) {

            this.mode = 0;
            this.modeClock = 0;
            this.ly = 0;

            return;

        }


        /*
         * CPU cycle → PPU dots.
         */

        const dots =
            cycles * 4;


        this.modeClock +=
            dots;


        /*
         * ----------------------------------------------------
         * MODE 2 — OAM
         * ----------------------------------------------------
         */

        if (
            this.mode === 2
        ) {

            if (
                this.modeClock >= 80
            ) {

                this.modeClock -=
                    80;

                this.mode =
                    3;

                this.updateSTAT();

            }

            return;

        }


        /*
         * ----------------------------------------------------
         * MODE 3 — TRANSFER
         * ----------------------------------------------------
         */

        if (
            this.mode === 3
        ) {

            if (
                this.modeClock >= 172
            ) {

                this.modeClock -=
                    172;

                this.renderScanline();

                this.mode =
                    0;

                this.updateSTAT();

            }

            return;

        }


        /*
         * ----------------------------------------------------
         * MODE 0 — HBLANK
         * ----------------------------------------------------
         */

        if (
            this.mode === 0
        ) {

            if (
                this.modeClock >= 204
            ) {

                this.modeClock -=
                    204;

                this.nextLine();

            }

            return;

        }


        /*
         * ----------------------------------------------------
         * MODE 1 — VBLANK
         * ----------------------------------------------------
         */

        if (
            this.mode === 1
        ) {

            if (
                this.modeClock >= 456
            ) {

                this.modeClock -=
                    456;

                this.ly++;

                if (
                    this.ly >= 154
                ) {

                    this.ly =
                        0;

                    this.mode =
                        2;

                    this.windowLine =
                        0;

                    this.windowTriggered =
                        false;

                    this.frameCount++;

                    this.frameReady =
                        true;

                    this.updateSTAT();

                } else {

                    this.updateLYC();

                }

            }

        }

    }


    /*
     * ========================================================
     * NEXT LINE
     * ========================================================
     */

    nextLine() {

        this.ly++;

        this.updateLYC();


        /*
         * Last visible line.
         */

        if (
            this.ly === 144
        ) {

            this.mode =
                1;

            this.modeClock =
                0;

            this.frameReady =
                true;

            this.frameCount++;

            /*
             * VBlank interrupt.
             */

            this.requestInterrupt(0);

            this.updateSTAT();

            return;

        }


        /*
         * Visible line.
         */

        if (
            this.ly < 144
        ) {

            this.mode =
                2;

            this.modeClock =
                0;

            this.scanSprites();

            this.updateSTAT();

        }

    }


    /*
     * ========================================================
     * STAT
     * ========================================================
     */

    updateSTAT() {

        /*
         * Bits 0-1 = mode
         *
         * Bit 2 = LYC=LY
         */

        this.stat =
            (
                this.stat &
                0xFC
            ) |
            this.mode;


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
         * STAT interrupt sources.
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
         * STAT IRQ is edge triggered.
         */

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


        this.updateSTAT();

    }


    /*
     * ========================================================
     * SCAN SPRITES
     * ========================================================
     */

    scanSprites() {

        this.lineSprites.length =
            0;


        const spriteHeight =
            (this.lcdc & 0x04)
                ? 16
                : 8;


        for (
            let i = 0;
            i < 40;
            i++
        ) {

            const base =
                i * 4;


            const y =
                this.oam[base] -
                16;


            const x =
                this.oam[base + 1] -
                8;


            const tile =
                this.oam[base + 2];


            const flags =
                this.oam[base + 3];


            if (
                this.ly >= y &&
                this.ly <
                y + spriteHeight
            ) {

                this.lineSprites.push({

                    index: i,

                    x: x,

                    y: y,

                    tile: tile,

                    flags: flags

                });


                /*
                 * DMG can display max 10
                 * sprites per scanline.
                 */

                if (
                    this.lineSprites.length >=
                    10
                ) {

                    break;

                }

            }

        }


        /*
         * DMG sprite priority is primarily
         * X position, then OAM order.
         */

        this.lineSprites.sort(
            (a, b) => {

                if (
                    a.x !== b.x
                ) {

                    return a.x - b.x;

                }

                return a.index - b.index;

            }
        );

    }


    /*
     * ========================================================
     * RENDER SCANLINE
     * ========================================================
     */

    renderScanline() {

        if (
            this.ly >=
            this.height
        ) {

            return;

        }


        /*
         * Clear line.
         */

        this.renderBackground();


        /*
         * Window.

         */

        if (
            this.lcdc & 0x20
        ) {

            this.renderWindow();

        }


        /*
         * Sprites.

         */

        if (
            this.lcdc & 0x02
        ) {

            this.renderSprites();

        }

    }


    /*
     * ========================================================
     * BACKGROUND
     * ========================================================
     */

    renderBackground() {

        /*
         * LCDC bit 0:
         *
         * BG enable / priority
         */

        const bgEnabled =
            Boolean(
                this.lcdc & 0x01
            );


        if (
            !bgEnabled
        ) {

            for (
                let x = 0;
                x < 160;
                x++
            ) {

                this.putPixel(
                    x,
                    this.ly,
                    0
                );

            }

            return;

        }


        /*
         * Tile map.
         *
         * LCDC bit 3
         */

        const tileMap =
            (
                this.lcdc & 0x08
            )
                ? 0x1C00
                : 0x1800;


        /*
         * Tile addressing.
         *
         * LCDC bit 4
         */

        const unsignedTiles =
            Boolean(
                this.lcdc & 0x10
            );


        const y =
            (
                this.scy +
                this.ly
            ) & 0xFF;


        const tileRow =
            Math.floor(
                y / 8
            );


        const pixelY =
            y & 7;


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
                Math.floor(
                    mapX / 8
                );


            const tileIndex =
                this.vram[
                    tileMap +
                    tileRow * 32 +
                    tileColumn
                ];


            let tileAddress;


            if (
                unsignedTiles
            ) {

                tileAddress =
                    tileIndex *
                    16;

            } else {

                /*
                 * Signed tile index.
                 */

                const signed =
                    tileIndex < 128
                        ? tileIndex
                        : tileIndex - 256;


                tileAddress =
                    0x1000 +
                    signed * 16;

            }


            const tileX =
                mapX & 7;


            const color =
                this.getTilePixel(
                    tileAddress,
                    pixelY,
                    tileX
                );


            this.putPixel(
                x,
                this.ly,
                this.applyPalette(
                    color,
                    this.bgp
                )
            );

        }

    }


    /*
     * ========================================================
     * WINDOW
     * ========================================================
     */

    renderWindow() {

        /*
         * Window visible when:
         *
         * WX - 7 <= 159
         * LY >= WY
         */

        const windowX =
            this.wx - 7;


        if (
            windowX >= 160
        ) {

            return;

        }


        if (
            this.ly <
            this.wy
        ) {

            return;

        }


        /*
         * LCDC bit 6:
         *
         * Window tile map.
         */

        const tileMap =
            (
                this.lcdc & 0x40
            )
                ? 0x1C00
                : 0x1800;


        const unsignedTiles =
            Boolean(
                this.lcdc & 0x10
            );


        const windowY =
            this.windowLine;


        const tileRow =
            Math.floor(
                windowY / 8
            );


        const pixelY =
            windowY & 7;


        for (
            let screenX = Math.max(
                0,
                windowX
            );
            screenX < 160;
            screenX++
        ) {

            const windowPixelX =
                screenX -
                windowX;


            const tileColumn =
                Math.floor(
                    windowPixelX / 8
                );


            const tileIndex =
                this.vram[
                    tileMap +
                    tileRow * 32 +
                    tileColumn
                ];


            let tileAddress;


            if (
                unsignedTiles
            ) {

                tileAddress =
                    tileIndex *
                    16;

            } else {

                const signed =
                    tileIndex < 128
                        ? tileIndex
                        : tileIndex - 256;


                tileAddress =
                    0x1000 +
                    signed * 16;

            }


            const tileX =
                windowPixelX & 7;


            const color =
                this.getTilePixel(
                    tileAddress,
                    pixelY,
                    tileX
                );


            this.putPixel(
                screenX,
                this.ly,
                this.applyPalette(
                    color,
                    this.bgp
                )
            );


            this.windowTriggered =
                true;

        }


        if (
            this.windowTriggered
        ) {

            this.windowLine++;

        }

    }


    /*
     * ========================================================
     * SPRITES
     * ========================================================
     */

    renderSprites() {

        const spriteHeight =
            (this.lcdc & 0x04)
                ? 16
                : 8;


        /*
         * Draw in reverse priority order.
         */

        for (
            let i =
                this.lineSprites.length - 1;
            i >= 0;
            i--
        ) {

            const sprite =
                this.lineSprites[i];


            this.renderSprite(
                sprite,
                spriteHeight
            );

        }

    }


    /*
     * ========================================================
     * RENDER SPRITE
     * ========================================================
     */

    renderSprite(
        sprite,
        spriteHeight
    ) {

        let tile =
            sprite.tile;


        const flags =
            sprite.flags;


        /*
         * 8x16 sprites use pairs of
         * tiles. Lowest bit ignored.
         */

        if (
            spriteHeight === 16
        ) {

            tile &=
                0xFE;

        }


        /*
         * Y flip.
         */

        let line =
            this.ly -
            sprite.y;


        if (
            flags & 0x40
        ) {

            line =
                spriteHeight -
                1 -
                line;

        }


        /*
         * 8x16 tile selection.
         */

        if (
            spriteHeight === 16 &&
            line >= 8
        ) {

            tile += 1;

            line -= 8;

        }


        const tileAddress =
            tile * 16;


        const low =
            this.vram[
                tileAddress +
                line * 2
            ];


        const high =
            this.vram[
                tileAddress +
                line * 2 +
                1
            ];


        /*
         * Palette.
         */

        const palette =
            (
                flags & 0x10
            )
                ? this.obp1
                : this.obp0;


        /*
         * X flip.
         */

        for (
            let px = 0;
            px < 8;
            px++
        ) {

            let bit =
                7 - px;


            if (
                flags & 0x20
            ) {

                bit =
                    px;

            }


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
             * Color 0 is transparent.
             */

            if (
                color === 0
            ) {

                continue;

            }


            const screenX =
                sprite.x +
                px;


            if (
                screenX < 0 ||
                screenX >= 160
            ) {

                continue;

            }


            /*
             * BG priority.
             */

            if (
                flags & 0x80
            ) {

                const bgColor =
                    this.getCurrentBackgroundColor(
                        screenX
                    );


                if (
                    bgColor !== 0
                ) {

                    continue;

                }

            }


            const finalColor =
                this.applyPalette(
                    color,
                    palette
                );


            this.putPixel(
                screenX,
                this.ly,
                finalColor
            );

        }

    }


    /*
     * ========================================================
     * TILE PIXEL
     * ========================================================
     */

    getTilePixel(
        tileAddress,
        y,
        x
    ) {

        tileAddress &=
            0x1FFE;


        const low =
            this.vram[
                tileAddress +
                y * 2
            ];


        const high =
            this.vram[
                tileAddress +
                y * 2 +
                1
            ];


        const bit =
            7 - x;


        return (
            (
                high >> bit
            ) & 1
        ) << 1 |
        (
            low >> bit
        ) & 1;

    }


    /*
     * ========================================================
     * BACKGROUND COLOR AT PIXEL
     * ========================================================
     */

    getCurrentBackgroundColor(
        screenX
    ) {

        const y =
            (
                this.scy +
                this.ly
            ) & 0xFF;


        const x =
            (
                this.scx +
                screenX
            ) & 0xFF;


        const tileMap =
            (
                this.lcdc & 0x08
            )
                ? 0x1C00
                : 0x1800;


        const unsignedTiles =
            Boolean(
                this.lcdc & 0x10
            );


        const tileIndex =
            this.vram[
                tileMap +
                Math.floor(y / 8) * 32 +
                Math.floor(x / 8)
            ];


        let tileAddress;


        if (
            unsignedTiles
        ) {

            tileAddress =
                tileIndex * 16;

        } else {

            const signed =
                tileIndex < 128
                    ? tileIndex
                    : tileIndex - 256;


            tileAddress =
                0x1000 +
                signed * 16;

        }


        return this.getTilePixel(
            tileAddress,
            y & 7,
            x & 7
        );

    }


    /*
     * ========================================================
     * PALETTE
     * ========================================================
     *
     * Palette format:
     *
     * bits 1-0 = color 0
     * bits 3-2 = color 1
     * bits 5-4 = color 2
     * bits 7-6 = color 3
     *
     * ========================================================
     */

    applyPalette(
        color,
        palette
    ) {

        return (
            palette >>
            (color * 2)
        ) & 0x03;

    }


    /*
     * ========================================================
     * WRITE PIXEL
     * ========================================================
     */

    putPixel(
        x,
        y,
        color
    ) {

        if (
            x < 0 ||
            x >= 160 ||
            y < 0 ||
            y >= 144
        ) {

            return;

        }


        const index =
            (
                y * 160 +
                x
            ) * 4;


        /*
         * DMG grayscale.
         */

        let r;
        let g;
        let b;


        switch (
            color & 3
        ) {

            case 0:

                r = 224;
                g = 248;
                b = 208;

                break;


            case 1:

                r = 136;
                g = 192;
                b = 112;

                break;


            case 2:

                r = 52;
                g = 104;
                b = 86;

                break;


            default:

                r = 8;
                g = 24;
                b = 32;

                break;

        }


        this.framebuffer[index] =
            r;

        this.framebuffer[index + 1] =
            g;

        this.framebuffer[index + 2] =
            b;

        this.framebuffer[index + 3] =
            255;

    }


    /*
     * ========================================================
     * REGISTER READ
     * ========================================================
     */

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


    /*
     * ========================================================
     * REGISTER WRITE
     * ========================================================
     */

    writeRegister(
        address,
        value
    ) {

        value &=
            0xFF;


        switch (address) {

            /*
             * LCDC
             */

            case 0xFF40:

                const wasEnabled =
                    Boolean(
                        this.lcdc & 0x80
                    );


                const enabled =
                    Boolean(
                        value & 0x80
                    );


                this.lcdc =
                    value;


                /*
                 * LCD turned off.
                 */

                if (
                    wasEnabled &&
                    !enabled
                ) {

                    this.mode =
                        0;

                    this.modeClock =
                        0;

                    this.ly =
                        0;

                    this.clearFrame();

                }


                /*
                 * LCD turned on.
                 */

                if (
                    !wasEnabled &&
                    enabled
                ) {

                    this.mode =
                        2;

                    this.modeClock =
                        0;

                    this.ly =
                        0;

                    this.windowLine =
                        0;

                    this.windowTriggered =
                        false;

                    this.scanSprites();

                }

                this.updateSTAT();

                break;


            /*
             * STAT
             */

            case 0xFF41:

                /*
                 * Bits 6-3 writable.
                 * Bits 2-0 are PPU controlled.
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

                this.updateLYC();

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


    /*
     * ========================================================
     * VRAM READ
     * ========================================================
     */

    readVRAM(address) {

        return this.vram[
            (address - 0x8000) &
            0x1FFF
        ];

    }


    /*
     * ========================================================
     * VRAM WRITE
     * ========================================================
     */

    writeVRAM(
        address,
        value
    ) {

        this.vram[
            (address - 0x8000) &
            0x1FFF
        ] =
            value & 0xFF;

    }


    /*
     * ========================================================
     * OAM READ
     * ========================================================
     */

    readOAM(address) {

        return this.oam[
            (address - 0xFE00) &
            0x9F
        ];

    }


    /*
     * ========================================================
     * OAM WRITE
     * ========================================================
     */

    writeOAM(
        address,
        value
    ) {

        this.oam[
            (address - 0xFE00) &
            0x9F
        ] =
            value & 0xFF;

    }


    /*
     * ========================================================
     * FRAME READY
     * ========================================================
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
     * GET FRAMEBUFFER
     * ========================================================
     */

    getFrameBuffer() {

        return this.framebuffer;

    }


    /*
     * ========================================================
     * DEBUG
     * ========================================================
     */

    getState() {

        return {

            lcdc:
                this.lcdc,

            stat:
                this.stat,

            scx:
                this.scx,

            scy:
                this.scy,

            ly:
                this.ly,

            lyc:
                this.lyc,

            wx:
                this.wx,

            wy:
                this.wy,

            bgp:
                this.bgp,

            obp0:
                this.obp0,

            obp1:
                this.obp1,

            mode:
                this.mode,

            modeClock:
                this.modeClock,

            frameCount:
                this.frameCount,

            frameReady:
                this.frameReady

        };

    }

}
