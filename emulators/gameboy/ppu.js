/*
 * ============================================================
 * WebBktx — Game Boy DMG PPU
 * ppu.js
 * ============================================================
 *
 * Nintendo Game Boy DMG LCD / PPU
 *
 * Display:
 *   160 × 144
 *
 * VRAM:
 *   0x8000 - 0x9FFF
 *
 * OAM:
 *   0xFE00 - 0xFE9F
 *
 * LCD registers:
 *   FF40 LCDC
 *   FF41 STAT
 *   FF42 SCY
 *   FF43 SCX
 *   FF44 LY
 *   FF45 LYC
 *   FF47 BGP
 *   FF48 OBP0
 *   FF49 OBP1
 *
 * Timing:
 *   Mode 2: 80 cycles
 *   Mode 3: ~172 cycles
 *   Mode 0: ~204 cycles
 *   Mode 1: 456 cycles / line
 *
 * One frame:
 *   154 scanlines × 456 cycles
 *
 * ============================================================
 */

export default class PPU {

    constructor(memory = null) {

        this.memory =
            memory;

        this.cpu =
            null;

        this.canvas =
            null;

        this.context =
            null;


        /*
         * ----------------------------------------------------
         * Game Boy display
         * ----------------------------------------------------
         */

        this.WIDTH =
            160;

        this.HEIGHT =
            144;


        /*
         * ----------------------------------------------------
         * Timing
         * ----------------------------------------------------
         */

        this.DOTS_PER_LINE =
            456;

        this.VISIBLE_LINES =
            144;

        this.TOTAL_LINES =
            154;


        /*
         * ----------------------------------------------------
         * PPU state
         * ----------------------------------------------------
         */

        this.mode =
            0;

        this.lineCycles =
            0;

        this.ly =
            0;


        /*
         * ----------------------------------------------------
         * Frame state
         * ----------------------------------------------------
         */

        this.frameReady =
            false;

        this.frameCount =
            0;


        /*
         * ----------------------------------------------------
         * Framebuffer
         *
         * Each pixel is stored as a Game Boy
         * shade 0..3.
         * ----------------------------------------------------
         */

        this.frameBuffer =
            new Uint8Array(
                this.WIDTH *
                this.HEIGHT
            );


        /*
         * RGBA framebuffer used by Canvas.
         */

        this.rgbaBuffer =
            new Uint8ClampedArray(
                this.WIDTH *
                this.HEIGHT *
                4
            );


        /*
         * ----------------------------------------------------
         * Palette
         * ----------------------------------------------------
         *
         * Classic DMG green palette.
         *
         * BGP/OBP registers contain color mapping.
         *
         * 0 = lightest
         * 3 = darkest
         * ----------------------------------------------------
         */

        this.palette = [

            [224, 248, 208],

            [136, 192, 112],

            [52, 104, 86],

            [8, 24, 32]

        ];


        /*
         * Optional debug state.
         */

        this.debug =
            false;


        /*
         * Initial hardware state.
         */

        this.reset();

    }


    /*
     * ========================================================
     * CONNECT
     * ========================================================
     */

    connect(
        components = {}
    ) {

        if (
            components.memory
        ) {

            this.memory =
                components.memory;

        }


        if (
            components.cpu
        ) {

            this.cpu =
                components.cpu;

        }

    }


    /*
     * ========================================================
     * CANVAS
     * ========================================================
     */

    attachCanvas(
        canvas
    ) {

        this.canvas =
            canvas;


        if (
            !canvas
        ) {

            this.context =
                null;

            return;

        }


        canvas.width =
            this.WIDTH;

        canvas.height =
            this.HEIGHT;


        this.context =
            canvas.getContext(
                "2d",
                {
                    alpha: false
                }
            );


        if (
            this.context
        ) {

            this.context.imageSmoothingEnabled =
                false;

        }


        this.render();

    }


    /*
     * ========================================================
     * RESET
     * ========================================================
     */

    reset() {

        this.mode =
            0;

        this.lineCycles =
            0;

        this.ly =
            0;

        this.frameReady =
            false;

        this.frameCount =
            0;


        this.frameBuffer.fill(
            0
        );


        this.rgbaBuffer.fill(
            0
        );


        /*
         * Synchronize hardware registers
         * when memory supports direct writes.
         */

        this.writeRegister(
            0xFF41,
            0x80
        );

        this.writeRegister(
            0xFF44,
            0
        );


        this.clearFrame();

    }


    /*
     * ========================================================
     * MEMORY READ
     * ========================================================
     */

    read8(
        address
    ) {

        address &=
            0xFFFF;


        if (
            this.memory &&
            typeof this.memory.read8 ===
            "function"
        ) {

            return (
                this.memory.read8(
                    address
                ) & 0xFF
            );

        }


        return 0xFF;

    }


    /*
     * ========================================================
     * MEMORY WRITE
     * ========================================================
     */

    writeRegister(
        address,
        value
    ) {

        if (
            !this.memory
        ) {

            return;

        }


        if (
            typeof this.memory.write8 ===
            "function"
        ) {

            this.memory.write8(
                address,
                value & 0xFF
            );

        }

    }


    /*
     * ========================================================
     * LCDC
     * ========================================================
     *
     * FF40
     *
     * Bit 7 LCD enable
     * Bit 6 Window tile map
     * Bit 5 Window enable
     * Bit 4 BG tile data
     * Bit 3 BG tile map
     * Bit 2 OBJ size
     * Bit 1 OBJ enable
     * Bit 0 BG/window enable
     *
     * ========================================================
     */

    getLCDC() {

        return this.read8(
            0xFF40
        );

    }


    /*
     * ========================================================
     * STAT
     * ========================================================
     */

    getSTAT() {

        return this.read8(
            0xFF41
        );

    }


    /*
     * ========================================================
     * SCY
     * ========================================================
     */

    getSCY() {

        return this.read8(
            0xFF42
        );

    }


    /*
     * ========================================================
     * SCX
     * ========================================================
     */

    getSCX() {

        return this.read8(
            0xFF43
        );

    }


    /*
     * ========================================================
     * LY
     * ========================================================
     */

    getLY() {

        return this.read8(
            0xFF44
        );

    }


    /*
     * ========================================================
     * LYC
     * ========================================================
     */

    getLYC() {

        return this.read8(
            0xFF45
        );

    }


    /*
     * ========================================================
     * BGP
     * ========================================================
     */

    getBGP() {

        return this.read8(
            0xFF47
        );

    }


    /*
     * ========================================================
     * OBP0
     * ========================================================
     */

    getOBP0() {

        return this.read8(
            0xFF48
        );

    }


    /*
     * ========================================================
     * OBP1
     * ========================================================
     */

    getOBP1() {

        return this.read8(
            0xFF49
        );

    }


    /*
     * ========================================================
     * LCD ENABLE
     * ========================================================
     */

    lcdEnabled() {

        return (
            (this.getLCDC() &
                0x80) !== 0
        );

    }


    /*
     * ========================================================
     * STEP
     * ========================================================
     *
     * Advance PPU by CPU cycles.
     *
     * ========================================================
     */

    step(
        cycles
    ) {

        if (
            !Number.isFinite(
                cycles
            ) ||
            cycles <= 0
        ) {

            return;

        }


        /*
         * If LCD is disabled, PPU remains
         * in a simple idle state.
         */

        if (
            !this.lcdEnabled()
        ) {

            this.mode =
                0;

            this.lineCycles =
                0;

            this.ly =
                0;


            this.setLY(
                0
            );


            this.updateSTAT();


            return;

        }


        while (
            cycles > 0
        ) {

            const remaining =
                this.cyclesUntilModeEnd();


            const step =
                Math.min(
                    cycles,
                    remaining
                );


            this.lineCycles +=
                step;


            cycles -=
                step;


            this.processMode();

        }

    }


    /*
     * ========================================================
     * CYCLES UNTIL MODE END
     * ========================================================
     */

    cyclesUntilModeEnd() {

        switch (
            this.mode
        ) {

            case 2:

                return Math.max(
                    1,
                    80 -
                    this.lineCycles
                );


            case 3:

                /*
                 * Standard DMG mode 3.
                 *
                 * Real hardware varies slightly,
                 * but 172 is a useful base
                 * implementation.
                 */

                return Math.max(
                    1,
                    252 -
                    this.lineCycles
                );


            case 0:

                return Math.max(
                    1,
                    456 -
                    this.lineCycles
                );


            case 1:

                return Math.max(
                    1,
                    456 -
                    this.lineCycles
                );


            default:

                return 1;

        }

    }


    /*
     * ========================================================
     * PROCESS MODE
     * ========================================================
     */

    processMode() {

        /*
         * MODE 2
         *
         * OAM scan
         */

        if (
            this.mode === 2 &&
            this.lineCycles >= 80
        ) {

            this.mode =
                3;

            this.updateSTAT();

            return;

        }


        /*
         * MODE 3
         *
         * Pixel transfer
         */

        if (
            this.mode === 3 &&
            this.lineCycles >= 252
        ) {

            /*
             * Render current scanline.
             */

            if (
                this.ly <
                this.HEIGHT
            ) {

                this.renderScanline(
                    this.ly
                );

            }


            this.mode =
                0;

            this.updateSTAT();

            return;

        }


        /*
         * MODE 0
         *
         * HBlank
         */

        if (
            this.mode === 0 &&
            this.lineCycles >= 456
        ) {

            this.lineCycles -=
                456;


            this.ly++;


            this.setLY(
                this.ly
            );


            if (
                this.ly >=
                144
            ) {

                /*
                 * Enter VBlank.
                 */

                this.mode =
                    1;


                this.frameReady =
                    true;

                this.frameCount++;


                /*
                 * VBlank interrupt.
                 */

                this.requestInterrupt(
                    0
                );


                /*
                 * Draw the complete frame
                 * immediately when VBlank starts.
                 */

                this.render();

            } else {

                /*
                 * Next visible scanline.
                 */

                this.mode =
                    2;

            }


            this.updateSTAT();

            return;

        }


        /*
         * MODE 1
         *
         * VBlank lines 144-153.
         */

        if (
            this.mode === 1 &&
            this.lineCycles >= 456
        ) {

            this.lineCycles -=
                456;


            this.ly++;


            if (
                this.ly >=
                154
            ) {

                /*
                 * New frame.
                 */

                this.ly =
                    0;


                this.setLY(
                    0
                );


                this.mode =
                    2;

            } else {

                this.setLY(
                    this.ly
                );

            }


            this.updateSTAT();

        }

    }


    /*
     * ========================================================
     * SET LY
     * ========================================================
     */

    setLY(
        value
    ) {

        this.writeRegister(
            0xFF44,
            value & 0xFF
        );


        this.updateLYC();

    }


    /*
     * ========================================================
     * UPDATE STAT
     * ========================================================
     */

    updateSTAT() {

        let stat =
            this.read8(
                0xFF41
            );


        /*
         * Preserve interrupt enable bits.
         *
         * Bits 3-6 are interrupt sources.
         */

        stat =
            (
                stat &
                0xF8
            );


        /*
         * Mode bits.
         */

        stat |=
            this.mode & 3;


        /*
         * Coincidence flag.
         */

        if (
            this.ly ===
            this.getLYC()
        ) {

            stat |=
                0x04;

        }


        /*
         * Keep bit 7 set on DMG.
         */

        stat |=
            0x80;


        this.writeRegister(
            0xFF41,
            stat
        );


        /*
         * STAT interrupts.
         *
         * These are kept conservative to avoid
         * repeatedly firing them every step.
         */

        if (
            this.mode === 0 &&
            (stat & 0x08)
        ) {

            this.requestInterrupt(
                1
            );

        }


        if (
            this.mode === 1 &&
            (stat & 0x10)
        ) {

            this.requestInterrupt(
                1
            );

        }


        if (
            this.mode === 2 &&
            (stat & 0x20)
        ) {

            this.requestInterrupt(
                1
            );

        }

    }


    /*
     * ========================================================
     * LYC
     * ========================================================
     */

    updateLYC() {

        const stat =
            this.read8(
                0xFF41
            );


        let value =
            stat;


        if (
            this.ly ===
            this.getLYC()
        ) {

            value |=
                0x04;

        } else {

            value &=
                ~0x04;

        }


        this.writeRegister(
            0xFF41,
            value
        );

    }


    /*
     * ========================================================
     * INTERRUPT
     * ========================================================
     *
     * IF register:
     *
     * FF0F
     *
     * Bit 0 = VBlank
     * Bit 1 = LCD STAT
     *
     * ========================================================
     */

    requestInterrupt(
        bit
    ) {

        const address =
            0xFF0F;


        const value =
            this.read8(
                address
            );


        this.writeRegister(
            address,
            value |
            (1 << bit)
        );

    }


    /*
     * ========================================================
     * RENDER SCANLINE
     * ========================================================
     */

    renderScanline(
        line
    ) {

        const lcdc =
            this.getLCDC();


        /*
         * Background.
         */

        if (
            lcdc & 0x01
        ) {

            this.renderBackground(
                line
            );

        } else {

            /*
             * BG disabled:
             * DMG displays color 0.
             */

            this.fillLine(
                line,
                0
            );

        }


        /*
         * Window.
         */

        if (
            lcdc & 0x20
        ) {

            this.renderWindow(
                line
            );

        }


        /*
         * Sprites.
         */

        if (
            lcdc & 0x02
        ) {

            this.renderSprites(
                line
            );

        }

    }


    /*
     * ========================================================
     * RENDER BACKGROUND
     * ========================================================
     */

    renderBackground(
        line
    ) {

        const lcdc =
            this.getLCDC();


        const scx =
            this.getSCX();


        const scy =
            this.getSCY();


        /*
         * Tile map:
         *
         * LCDC bit 3
         *
         * 0 = 9800
         * 1 = 9C00
         */

        const tileMapBase =
            (
                lcdc & 0x08
            )
                ? 0x9C00
                : 0x9800;


        /*
         * Tile data:
         *
         * LCDC bit 4
         *
         * 1 = 8000 unsigned
         * 0 = 8800 signed
         */

        const unsignedTiles =
            (
                lcdc & 0x10
            ) !== 0;


        const y =
            (
                scy +
                line
            ) & 0xFF;


        const tileY =
            (
                y >> 3
            ) & 31;


        const pixelY =
            y & 7;


        for (
            let x = 0;
            x < this.WIDTH;
            x++
        ) {

            const bgX =
                (
                    scx +
                    x
                ) & 0xFF;


            const tileX =
                (
                    bgX >> 3
                ) & 31;


            const mapAddress =
                tileMapBase +
                (
                    tileY *
                    32
                ) +
                tileX;


            const tileNumber =
                this.read8(
                    mapAddress
                );


            let tileAddress;


            if (
                unsignedTiles
            ) {

                tileAddress =
                    0x8000 +
                    (
                        tileNumber *
                        16
                    );

            } else {

                /*
                 * Signed tile index.
                 *
                 * 0x8800 addressing mode
                 * has tile 0 at 0x9000.
                 */

                const signedTile =
                    tileNumber < 128
                        ? tileNumber
                        : tileNumber - 256;


                tileAddress =
                    0x9000 +
                    (
                        signedTile *
                        16
                    );

            }


            const rowAddress =
                tileAddress +
                (
                    pixelY *
                    2
                );


            const low =
                this.read8(
                    rowAddress
                );


            const high =
                this.read8(
                    rowAddress + 1
                );


            const bit =
                7 -
                (
                    bgX &
                    7
                );


            const colorBit0 =
                (
                    low >>
                    bit
                ) & 1;


            const colorBit1 =
                (
                    high >>
                    bit
                ) & 1;


            const color =
                colorBit0 |
                (
                    colorBit1 << 1
                );


            /*
             * Apply BGP.
             */

            const shade =
                this.mapPalette(
                    color,
                    this.getBGP()
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
     * RENDER WINDOW
     * ========================================================
     */

    renderWindow(
        line
    ) {

        const lcdc =
            this.getLCDC();


        const wx =
            this.read8(
                0xFF4B
            );


        const wy =
            this.read8(
                0xFF4A
            );


        /*
         * Window only visible after WY.
         */

        if (
            line <
            wy
        ) {

            return;

        }


        /*
         * WX is screen X + 7.
         */

        const windowX =
            wx - 7;


        if (
            windowX >=
            this.WIDTH
        ) {

            return;

        }


        const tileMapBase =
            (
                lcdc & 0x40
            )
                ? 0x9C00
                : 0x9800;


        const unsignedTiles =
            (
                lcdc & 0x10
            ) !== 0;


        const windowLine =
            line -
            wy;


        const tileY =
            (
                windowLine >>
                3
            ) & 31;


        const pixelY =
                windowLine &
                7;


        const startX =
            Math.max(
                0,
                windowX
            );


        for (
            let screenX = startX;
            screenX < this.WIDTH;
            screenX++
        ) {

            const windowPixelX =
                screenX -
                windowX;


            const tileX =
                (
                    windowPixelX >>
                    3
                ) & 31;


            const pixelX =
                windowPixelX &
                7;


            const mapAddress =
                tileMapBase +
                (
                    tileY *
                    32
                ) +
                tileX;


            const tileNumber =
                this.read8(
                    mapAddress
                );


            let tileAddress;


            if (
                unsignedTiles
            ) {

                tileAddress =
                    0x8000 +
                    (
                        tileNumber *
                        16
                    );

            } else {

                const signedTile =
                    tileNumber < 128
                        ? tileNumber
                        : tileNumber - 256;


                tileAddress =
                    0x9000 +
                    (
                        signedTile *
                        16
                    );

            }


            const row =
                tileAddress +
                (
                    pixelY *
                    2
                );


            const low =
                this.read8(
                    row
                );


            const high =
                this.read8(
                    row + 1
                );


            const bit =
                7 -
                pixelX;


            const color =
                (
                    low >> bit
                ) & 1
                |
                (
                    (
                        high >>
                        bit
                    ) & 1
                ) << 1;


            const shade =
                this.mapPalette(
                    color,
                    this.getBGP()
                );


            this.setPixel(
                screenX,
                line,
                shade
            );

        }

    }


    /*
     * ========================================================
     * RENDER SPRITES
     * ========================================================
     */

    renderSprites(
        line
    ) {

        const lcdc =
            this.getLCDC();


        const tall =
            (
                lcdc & 0x04
            ) !== 0;


        const spriteHeight =
            tall
                ? 16
                : 8;


        const sprites =
            [];


        /*
         * Game Boy can display up to 10 sprites
         * per scanline.
         */

        for (
            let i = 0;
            i < 40;
            i++
        ) {

            const address =
                0xFE00 +
                (
                    i *
                    4
                );


            const y =
                this.read8(
                    address
                ) -
                16;


            const x =
                this.read8(
                    address + 1
                ) -
                8;


            const tile =
                this.read8(
                    address + 2
                );


            const flags =
                this.read8(
                    address + 3
                );


            if (
                line >= y &&
                line <
                y +
                spriteHeight
            ) {

                sprites.push({

                    index:
                        i,

                    x:
                        x,

                    y:
                        y,

                    tile:
                        tile,

                    flags:
                        flags

                });

            }


            if (
                sprites.length >=
                10
            ) {

                break;

            }

        }


        /*
         * DMG priority:
         *
         * lower X first,
         * then lower OAM index.
         *
         * We draw backwards so that earlier
         * sprites remain visible.
         */

        sprites.sort(
            (
                a,
                b
            ) => {

                if (
                    a.x !==
                    b.x
                ) {

                    return (
                        b.x -
                        a.x
                    );

                }


                return (
                    b.index -
                    a.index
                );

            }
        );


        for (
            const sprite of sprites
        ) {

            this.renderSprite(
                sprite,
                line,
                spriteHeight
            );

        }

    }


    /*
     * ========================================================
     * RENDER SINGLE SPRITE
     * ========================================================
     */

    renderSprite(
        sprite,
        line,
        spriteHeight
    ) {

        const flags =
            sprite.flags;


        const flipX =
            (
                flags &
                0x20
            ) !== 0;


        const flipY =
            (
                flags &
                0x40
            ) !== 0;


        const behindBG =
            (
                flags &
                0x80
            ) !== 0;


        const palette =
            (
                flags &
                0x10
            )
                ? this.getOBP1()
                : this.getOBP0();


        let tile =
            sprite.tile;


        /*
         * In 8x16 mode the lowest bit
         * of the tile index is ignored.
         */

        if (
            spriteHeight ===
            16
        ) {

            tile &=
                0xFE;

        }


        let row =
            line -
            sprite.y;


        if (
            flipY
        ) {

            row =
                spriteHeight -
                1 -
                row;

        }


        /*
         * Select tile for lower half
         * of 8x16 sprite.
         */

        if (
            spriteHeight ===
            16 &&
            row >= 8
        ) {

            tile +=
                1;

            row -=
                8;

        }


        const tileAddress =
            0x8000 +
            (
                tile *
                16
            );


        const address =
            tileAddress +
            (
                row *
                2
            );


        const low =
            this.read8(
                address
            );


        const high =
            this.read8(
                address + 1
            );


        for (
            let pixel = 0;
            pixel < 8;
            pixel++
        ) {

            const screenX =
                sprite.x +
                pixel;


            if (
                screenX < 0 ||
                screenX >=
                this.WIDTH
            ) {

                continue;

            }


            const bit =
                flipX
                    ? pixel
                    : 7 - pixel;


            const color =
                (
                    low >>
                    bit
                ) & 1
                |
                (
                    (
                        high >>
                        bit
                    ) & 1
                ) << 1;


            /*
             * Sprite color 0 is transparent.
             */

            if (
                color ===
                0
            ) {

                continue;

            }


            /*
             * OBJ-to-BG priority.
             */

            if (
                behindBG
            ) {

                const bgShade =
                    this.getPixel(
                        screenX,
                        line
                    );


                /*
                 * BG color 0 allows sprite.
                 */

                if (
                    bgShade !==
                    0
                ) {

                    continue;

                }

            }


            const shade =
                this.mapPalette(
                    color,
                    palette
                );


            this.setPixel(
                screenX,
                line,
                shade
            );

        }

    }


    /*
     * ========================================================
     * MAP PALETTE
     * ========================================================
     *
     * Palette register:
     *
     * bits 1-0 = color 0
     * bits 3-2 = color 1
     * bits 5-4 = color 2
     * bits 7-6 = color 3
     * ========================================================
     */

    mapPalette(
        color,
        palette
    ) {

        return (
            palette >>
            (
                color *
                2
            )
        ) & 3;

    }


    /*
     * ========================================================
     * SET PIXEL
     * ========================================================
     */

    setPixel(
        x,
        y,
        value
    ) {

        if (
            x < 0 ||
            x >= this.WIDTH ||
            y < 0 ||
            y >= this.HEIGHT
        ) {

            return;

        }


        this.frameBuffer[
            y *
            this.WIDTH +
            x
        ] =
            value & 3;

    }


    /*
     * ========================================================
     * GET PIXEL
     * ========================================================
     */

    getPixel(
        x,
        y
    ) {

        if (
            x < 0 ||
            x >= this.WIDTH ||
            y < 0 ||
            y >= this.HEIGHT
        ) {

            return 0;

        }


        return this.frameBuffer[
            y *
            this.WIDTH +
            x
        ];

    }


    /*
     * ========================================================
     * FILL LINE
     * ========================================================
     */

    fillLine(
        y,
        value
    ) {

        if (
            y < 0 ||
            y >= this.HEIGHT
        ) {

            return;

        }


        const start =
            y *
            this.WIDTH;


        const end =
            start +
            this.WIDTH;


        this.frameBuffer.fill(
            value & 3,
            start,
            end
        );

    }


    /*
     * ========================================================
     * CLEAR FRAME
     * ========================================================
     */

    clearFrame() {

        this.frameBuffer.fill(
            0
        );


        if (
            this.context
        ) {

            this.context.fillStyle =
                "rgb(224,248,208)";


            this.context.fillRect(
                0,
                0,
                this.WIDTH,
                this.HEIGHT
            );

        }

    }


    /*
     * ========================================================
     * CONVERT TO RGBA
     * ========================================================
     */

    updateRGBA() {

        for (
            let i = 0;
            i <
            this.frameBuffer.length;
            i++
        ) {

            const shade =
                this.frameBuffer[
                    i
                ] & 3;


            const color =
                this.palette[
                    shade
                ];


            const offset =
                i *
                4;


            this.rgbaBuffer[
                offset
            ] =
                color[0];


            this.rgbaBuffer[
                offset + 1
            ] =
                color[1];


            this.rgbaBuffer[
                offset + 2
            ] =
                color[2];


            this.rgbaBuffer[
                offset + 3
            ] =
                255;

        }

    }


    /*
     * ========================================================
     * RENDER
     * ========================================================
     */

    render(
        context = null
    ) {

        if (
            context
        ) {

            this.context =
                context;

        }


        if (
            !this.context
        ) {

            return;

        }


        this.updateRGBA();


        const image =
            new ImageData(
                this.rgbaBuffer,
                this.WIDTH,
                this.HEIGHT
            );


        this.context.putImageData(
            image,
            0,
            0
        );

    }


    /*
     * ========================================================
     * GET FRAMEBUFFER
     * ========================================================
     */

    getFrameBuffer() {

        return this.frameBuffer;

    }


    /*
     * ========================================================
     * GET RGBA BUFFER
     * ========================================================
     */

    getRGBABuffer() {

        this.updateRGBA();


        return this.rgbaBuffer;

    }


    /*
     * ========================================================
     * IS FRAME READY
     * ========================================================
     */

    isFrameReady() {

        return this.frameReady;

    }


    /*
     * ========================================================
     * CONSUME FRAME
     * ========================================================
     */

    consumeFrame() {

        const ready =
            this.frameReady;


        this.frameReady =
            false;


        return ready;

    }


    /*
     * ========================================================
     * GET PPU STATE
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
                this.getLCDC(),

            stat:
                this.getSTAT(),

            scx:
                this.getSCX(),

            scy:
                this.getSCY(),

            lyc:
                this.getLYC(),

            bgp:
                this.getBGP(),

            obp0:
                this.getOBP0(),

            obp1:
                this.getOBP1()

        };

    }


    /*
     * ========================================================
     * DEBUG
     * ========================================================
     */

    setDebug(
        enabled
    ) {

        this.debug =
            Boolean(
                enabled
            );

    }


    /*
     * ========================================================
     * DESTROY
     * ========================================================
     */

    destroy() {

        this.canvas =
            null;

        this.context =
            null;

        this.memory =
            null;

        this.cpu =
            null;

    }

}
