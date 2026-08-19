/*
 * ============================================================
 * WebBktx — Game Boy PPU / LCD Controller
 * ============================================================
 *
 * DMG-compatible PPU.
 *
 * Resolution:
 *   160 x 144
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
 *   FF4A WY
 *   FF4B WX
 *
 * ============================================================
 */

export default class PPU {

    constructor(memory = null) {

        this.memory = memory;

        /* ----------------------------------------------------
         * Video memory
         * ---------------------------------------------------- */

        this.vram = new Uint8Array(0x2000);
        this.oam = new Uint8Array(0xA0);


        /* ----------------------------------------------------
         * LCD registers
         * ---------------------------------------------------- */

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


        /* ----------------------------------------------------
         * Timing
         * ---------------------------------------------------- */

        this.mode = 2;
        this.modeClock = 0;

        this.frame = 0;
        this.frames = 0;

        this.enabled = true;


        /* ----------------------------------------------------
         * LCD
         * ---------------------------------------------------- */

        this.lcdEnabled = true;

        this.statInterruptLine = false;


        /* ----------------------------------------------------
         * Window
         * ---------------------------------------------------- */

        this.windowLine = 0;


        /* ----------------------------------------------------
         * Screen
         * ---------------------------------------------------- */

        this.width = 160;
        this.height = 144;

        this.framebuffer =
            new Uint32Array(
                this.width * this.height
            );


        /* ----------------------------------------------------
         * Canvas
         * ---------------------------------------------------- */

        this.canvas = null;
        this.ctx = null;
        this.imageData = null;


        /* ----------------------------------------------------
         * Palette
         *
         * Game Boy grayscale:
         *
         * 0 = darkest
         * 3 = lightest
         * ---------------------------------------------------- */

        this.palette = [
            0xFF0F380F,
            0xFF306230,
            0xFF8BAC0F,
            0xFF9BBC0F
        ];


        this.reset();
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

        this.frame = 0;
        this.frames = 0;

        this.windowLine = 0;

        this.lcdEnabled =
            true;

        this.statInterruptLine =
            false;

        this.clearFramebuffer();
    }


    /*
     * ========================================================
     * CANVAS
     * ========================================================
     */

    connectCanvas(canvas) {

        this.canvas = canvas || null;

        if (!this.canvas) {
            this.ctx = null;
            this.imageData = null;
            return;
        }

        this.canvas.width =
            this.width;

        this.canvas.height =
            this.height;

        this.ctx =
            this.canvas.getContext("2d", {
                alpha: false
            });

        if (this.ctx) {

            this.ctx.imageSmoothingEnabled =
                false;

            this.imageData =
                this.ctx.createImageData(
                    this.width,
                    this.height
                );

        }

        this.present();
    }


    attachCanvas(canvas) {
        this.connectCanvas(canvas);
    }


    setCanvas(canvas) {
        this.connectCanvas(canvas);
    }


    /*
     * ========================================================
     * FRAMEBUFFER
     * ========================================================
     */

    clearFramebuffer() {

        const color =
            this.palette[3];

        this.framebuffer.fill(color);
    }


    /*
     * ========================================================
     * VRAM
     * ========================================================
     */

    readVRAM(address) {

        address &=
            0x1FFF;

        return this.vram[address];
    }


    writeVRAM(address, value) {

        address &=
            0x1FFF;

        this.vram[address] =
            value & 0xFF;
    }


    readVideoRAM(address) {
        return this.readVRAM(address);
    }


    writeVideoRAM(address, value) {
        this.writeVRAM(address, value);
    }


    /*
     * ========================================================
     * OAM
     * ========================================================
     */

    readOAM(address) {

        address &=
            0x9F;

        return this.oam[address];
    }


    writeOAM(address, value) {

        address &=
            0x9F;

        this.oam[address] =
            value & 0xFF;
    }


    /*
     * ========================================================
     * LCD REGISTERS
     * ========================================================
     */

    readRegister(address) {

        address &=
            0xFFFF;

        switch (address) {

            case 0xFF40:
                return this.lcdc;

            case 0xFF41:
                return this.getSTAT();

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


    writeRegister(address, value) {

        address &=
            0xFFFF;

        value &=
            0xFF;


        switch (address) {

            case 0xFF40:

                this.writeLCDC(value);

                break;


            case 0xFF41:

                /*
                 * Bits 0-2 are read-only.
                 * Bits 3-6 are writable.
                 */

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
                 * LY is read-only on DMG.
                 * Writes effectively reset it on many
                 * emulator implementations.
                 */

                this.ly =
                    0;

                this.mode =
                    2;

                this.modeClock =
                    0;

                this.updateSTAT();

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


    /*
     * --------------------------------------------------------
     * Aliases used by different memory implementations
     * --------------------------------------------------------
     */

    readIO(address) {
        return this.readRegister(address);
    }


    writeIO(address, value) {
        this.writeRegister(address, value);
    }


    readMemory(address) {

        if (
            address >= 0x8000 &&
            address <= 0x9FFF
        ) {
            return this.readVRAM(
                address - 0x8000
            );
        }

        if (
            address >= 0xFE00 &&
            address <= 0xFE9F
        ) {
            return this.readOAM(
                address - 0xFE00
            );
        }

        if (
            address >= 0xFF40 &&
            address <= 0xFF4B
        ) {
            return this.readRegister(
                address
            );
        }

        return 0xFF;
    }


    writeMemory(address, value) {

        /*
         * IMPORTANT:
         *
         * Never call memory.writeByte() here for
         * PPU-owned addresses.
         *
         * That would create:
         *
         * PPU -> memory -> PPU -> memory
         *
         * recursion.
         */

        if (
            address >= 0x8000 &&
            address <= 0x9FFF
        ) {

            this.writeVRAM(
                address - 0x8000,
                value
            );

            return;
        }


        if (
            address >= 0xFE00 &&
            address <= 0xFE9F
        ) {

            this.writeOAM(
                address - 0xFE00,
                value
            );

            return;
        }


        if (
            address >= 0xFF40 &&
            address <= 0xFF4B
        ) {

            this.writeRegister(
                address,
                value
            );

        }
    }


    /*
     * ========================================================
     * LCDC
     * ========================================================
     *
     * Bit 7 LCD enable
     * Bit 6 Window tile map
     * Bit 5 Window enable
     * Bit 4 BG/window tile data
     * Bit 3 BG tile map
     * Bit 2 OBJ size
     * Bit 1 OBJ enable
     * Bit 0 BG/window enable
     */

    writeLCDC(value) {

        const oldEnabled =
            Boolean(
                this.lcdc & 0x80
            );

        const newEnabled =
            Boolean(
                value & 0x80
            );

        this.lcdc =
            value & 0xFF;


        if (
            oldEnabled &&
            !newEnabled
        ) {

            this.lcdEnabled =
                false;

            this.mode =
                0;

            this.modeClock =
                0;

            this.ly =
                0;

            this.windowLine =
                0;

            this.clearFramebuffer();

            this.updateSTAT();

            this.present();

            return;
        }


        if (
            !oldEnabled &&
            newEnabled
        ) {

            this.lcdEnabled =
                true;

            this.mode =
                2;

            this.modeClock =
                0;

            this.ly =
                0;

            this.windowLine =
                0;

            this.updateSTAT();
        }
    }


    isLCDEnabled() {

        return Boolean(
            this.lcdc & 0x80
        );
    }


    /*
     * ========================================================
     * STAT
     * ========================================================
     */

    getSTAT() {

        let value =
            this.stat & 0x78;

        value |=
            0x80;

        value |=
            this.mode & 0x03;


        if (
            this.ly === this.lyc
        ) {

            value |=
                0x04;
        }


        return value;
    }


    updateSTAT() {

        this.stat =
            (
                this.stat &
                0xF8
            ) |
            (
                this.mode &
                0x03
            );


        if (
            this.ly === this.lyc
        ) {

            this.stat |=
                0x04;

        } else {

            this.stat &=
                ~0x04;
        }


        this.requestSTATInterrupt();
    }


    requestSTATInterrupt() {

        let signal =
            false;


        if (
            this.ly === this.lyc &&
            (
                this.stat & 0x40
            )
        ) {

            signal = true;
        }


        if (
            this.mode === 0 &&
            (
                this.stat & 0x08
            )
        ) {

            signal = true;
        }


        if (
            this.mode === 1 &&
            (
                this.stat & 0x10
            )
        ) {

            signal = true;
        }


        if (
            this.mode === 2 &&
            (
                this.stat & 0x20
            )
        ) {

            signal = true;
        }


        /*
         * Interrupt only on rising edge.
         */

        if (
            signal &&
            !this.statInterruptLine
        ) {

            this.requestInterrupt(1);
        }


        this.statInterruptLine =
            signal;
    }


    requestInterrupt(bit) {

        if (
            this.memory &&
            typeof this.memory.requestInterrupt ===
                "function"
        ) {

            this.memory.requestInterrupt(
                bit
            );

            return;
        }


        if (
            this.memory &&
            typeof this.memory.setInterruptFlag ===
                "function"
        ) {

            this.memory.setInterruptFlag(
                bit
            );

            return;
        }


        if (
            this.memory
        ) {

            this.memory.interruptFlags =
                (
                    this.memory.interruptFlags |
                    (
                        1 << bit
                    )
                ) & 0x1F;
        }
    }


    /*
     * ========================================================
     * PPU STEP
     * ========================================================
     *
     * One argument = machine cycles.
     *
     * Game Boy:
     *
     * Mode 2 = 80 dots
     * Mode 3 = ~172 dots
     * Mode 0 = ~204 dots
     *
     * Total visible line = 456 dots.
     * VBlank = 10 lines.
     *
     * CPU cycles are 4x slower than PPU dots,
     * so this routine uses 4 CPU cycles as one PPU dot.
     *
     * ========================================================
     */

    step(cycles = 4) {

        cycles =
            Math.max(
                0,
                cycles | 0
            );


        if (
            !this.lcdEnabled
        ) {

            return;
        }


        this.modeClock +=
            cycles;


        /*
         * Process potentially multiple transitions.
         */

        let safety = 16;


        while (
            safety-- > 0
        ) {

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

                break;
            }


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

                break;
            }


            if (
                this.mode === 0
            ) {

                if (
                    this.modeClock >= 204
                ) {

                    this.modeClock -=
                        204;

                    this.ly++;


                    if (
                        this.ly >= 144
                    ) {

                        this.ly =
                            144;

                        this.mode =
                            1;

                        this.frame++;
                        this.frames++;

                        this.requestInterrupt(0);

                        this.present();

                    } else {

                        this.mode =
                            2;
                    }


                    this.updateSTAT();
                }

                break;
            }


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
                        this.ly > 153
                    ) {

                        this.ly =
                            0;

                        this.windowLine =
                            0;

                        this.mode =
                            2;

                    }


                    this.updateSTAT();
                }

                break;
            }


            /*
             * Safety fallback.
             */

            this.mode =
                2;

            this.modeClock =
                0;

            this.updateSTAT();

            break;
        }
    }


    tick(cycles) {
        this.step(cycles);
    }


    clock(cycles) {
        this.step(cycles);
    }


    /*
     * ========================================================
     * SCANLINE
     * ========================================================
     *
     * THIS is the function missing in your current PPU.
     *
     * ========================================================
     */

    renderScanline() {

        const y =
            this.ly & 0xFF;


        if (
            y >= 144
        ) {

            return;
        }


        /*
         * BG
         */

        if (
            this.lcdc & 0x01
        ) {

            this.renderBackground(
                y
            );

        } else {

            this.renderBlankLine(
                y
            );
        }


        /*
         * Window
         */

        if (
            (
                this.lcdc & 0x20
            ) &&
            (
                this.lcdc & 0x01
            ) &&
            y >= this.wy
        ) {

            this.renderWindow(
                y
            );
        }


        /*
         * Sprites
         */

        if (
            this.lcdc & 0x02
        ) {

            this.renderSprites(
                y
            );
        }


        /*
         * Window line counter.
         */

        if (
            (
                this.lcdc & 0x20
            ) &&
            y >= this.wy
        ) {

            this.windowLine++;
        }
    }


    /*
     * ========================================================
     * BACKGROUND
     * ========================================================
     */

    renderBackground(y) {

        const bgMap =
            (
                this.lcdc & 0x08
            )
                ? 0x1C00
                : 0x1800;


        const unsignedTiles =
            Boolean(
                this.lcdc & 0x10
            );


        const scy =
            this.scy;


        const scx =
            this.scx;


        const bgY =
            (
                scy +
                y
            ) & 0xFF;


        const tileRow =
            bgY >> 3;


        const pixelY =
            bgY & 7;


        const mapBase =
            bgMap;


        const tileDataBase =
            unsignedTiles
                ? 0x0000
                : 0x1000;


        const signedTiles =
            !unsignedTiles;


        for (
            let x = 0;
            x < 160;
            x++
        ) {

            const bgX =
                (
                    scx +
                    x
                ) & 0xFF;


            const tileX =
                bgX >> 3;


            const mapIndex =
                (
                    mapBase +
                    tileRow * 32 +
                    tileX
                ) & 0x1FFF;


            const tileNumber =
                this.vram[
                    mapIndex
                ];


            let tileAddress;


            if (
                signedTiles
            ) {

                const signed =
                    tileNumber & 0x80
                        ? tileNumber - 0x100
                        : tileNumber;

                tileAddress =
                    (
                        0x1000 +
                        signed * 16
                    );

            } else {

                tileAddress =
                    tileNumber * 16;
            }


            tileAddress =
                (
                    tileAddress +
                    pixelY * 2
                ) & 0x1FFF;


            const lo =
                this.vram[
                    tileAddress
                ];


            const hi =
                this.vram[
                    (
                        tileAddress +
                        1
                    ) & 0x1FFF
                ];


            const bit =
                7 -
                (
                    bgX & 7
                );


            const color =
                (
                    (
                        hi >> bit
                    ) & 1
                ) << 1 |
                (
                    lo >> bit
                ) & 1;


            this.framebuffer[
                y * 160 +
                x
            ] =
                this.getBGColor(
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

        const windowMap =
            (
                this.lcdc & 0x40
            )
                ? 0x1C00
                : 0x1800;


        const unsignedTiles =
            Boolean(
                this.lcdc & 0x10
            );


        const tileDataBase =
            unsignedTiles
                ? 0x0000
                : 0x1000;


        const windowY =
            this.windowLine & 0xFF;


        const tileRow =
            windowY >> 3;


        const pixelY =
            windowY & 7;


        const startX =
            this.wx - 7;


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


            const tileX =
                windowX >> 3;


            if (
                tileX >= 32
            ) {

                continue;
            }


            const mapIndex =
                (
                    windowMap +
                    tileRow * 32 +
                    tileX
                ) & 0x1FFF;


            const tileNumber =
                this.vram[
                    mapIndex
                ];


            let tileAddress;


            if (
                unsignedTiles
            ) {

                tileAddress =
                    tileNumber * 16;

            } else {

                const signed =
                    tileNumber & 0x80
                        ? tileNumber - 0x100
                        : tileNumber;

                tileAddress =
                    0x1000 +
                    signed * 16;
            }


            tileAddress =
                (
                    tileAddress +
                    pixelY * 2
                ) & 0x1FFF;


            const lo =
                this.vram[
                    tileAddress
                ];


            const hi =
                this.vram[
                    (
                        tileAddress +
                        1
                    ) & 0x1FFF
                ];


            const bit =
                7 -
                (
                    windowX & 7
                );


            const color =
                (
                    (
                        hi >> bit
                    ) & 1
                ) << 1 |
                (
                    lo >> bit
                ) & 1;


            this.framebuffer[
                y * 160 +
                x
            ] =
                this.getBGColor(
                    color
                );
        }
    }


    /*
     * ========================================================
     * SPRITES
     * ========================================================
     */

    renderSprites(y) {

        const tall =
            Boolean(
                this.lcdc & 0x04
            );


        const spriteHeight =
            tall
                ? 16
                : 8;


        const sprites = [];


        /*
         * Game Boy can display max 10 sprites
         * per scanline.
         */

        for (
            let i = 0;
            i < 40;
            i++
        ) {

            const base =
                i * 4;


            const spriteY =
                this.oam[
                    base
                ] - 16;


            const spriteX =
                this.oam[
                    base + 1
                ] - 8;


            const tile =
                this.oam[
                    base + 2
                ];


            const flags =
                this.oam[
                    base + 3
                ];


            if (
                y < spriteY ||
                y >= spriteY + spriteHeight
            ) {

                continue;
            }


            sprites.push({
                index: i,
                x: spriteX,
                y: spriteY,
                tile: tile,
                flags: flags
            });


            if (
                sprites.length >= 10
            ) {

                break;
            }
        }


        /*
         * DMG priority:
         * smaller X wins, then lower OAM index.
         *
         * Rendering back-to-front makes earlier priority
         * sprites remain visible.
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
                tall
            );
        }
    }


    /*
     * ========================================================
     * ONE SPRITE
     * ========================================================
     */

    renderSprite(
        sprite,
        y,
        tall
    ) {

        let line =
            y -
            sprite.y;


        const flags =
            sprite.flags;


        /*
         * Vertical flip.
         */

        if (
            flags & 0x40
        ) {

            line =
                (
                    tall
                        ? 15
                        : 7
                ) -
                line;
        }


        let tile =
            sprite.tile;


        /*
         * In 8x16 mode, tile number bit 0 is ignored.
         */

        if (
            tall
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


        const lo =
            this.vram[
                address
            ];


        const hi =
            this.vram[
                (
                    address +
                    1
                ) & 0x1FFF
            ];


        const palette =
            (
                flags & 0x10
            )
                ? this.obp1
                : this.obp0;


        const flipX =
            Boolean(
                flags & 0x20
            );


        const behindBG =
            Boolean(
                flags & 0x80
            );


        for (
            let px = 0;
            px < 8;
            px++
        ) {

            const bit =
                flipX
                    ? px
                    : 7 - px;


            const color =
                (
                    (
                        hi >> bit
                    ) & 1
                ) << 1 |
                (
                    lo >> bit
                ) & 1;


            /*
             * Color 0 is transparent.
             */

            if (
                color === 0
            ) {

                continue;
            }


            const x =
                sprite.x +
                px;


            if (
                x < 0 ||
                x >= 160
            ) {

                continue;
            }


            const index =
                y * 160 +
                x;


            /*
             * OBJ-to-BG priority.
             *
             * We need to determine the underlying BG color.
             */

            if (
                behindBG
            ) {

                const bgColor =
                    this.getBackgroundPixelColor(
                        x,
                        y
                    );


                if (
                    bgColor !== 0
                ) {

                    continue;
                }
            }


            this.framebuffer[index] =
                this.getOBJColor(
                    palette,
                    color
                );
        }
    }


    /*
     * ========================================================
     * BACKGROUND PIXEL COLOR
     * ========================================================
     */

    getBackgroundPixelColor(
        x,
        y
    ) {

        if (
            !(this.lcdc & 0x01)
        ) {

            return 0;
        }


        const bgY =
            (
                this.scy +
                y
            ) & 0xFF;


        const bgX =
            (
                this.scx +
                x
            ) & 0xFF;


        const mapBase =
            (
                this.lcdc & 0x08
            )
                ? 0x1C00
                : 0x1800;


        const unsignedTiles =
            Boolean(
                this.lcdc & 0x10
            );


        const tileNumber =
            this.vram[
                (
                    mapBase +
                    (
                        bgY >> 3
                    ) * 32 +
                    (
                        bgX >> 3
                    )
                ) & 0x1FFF
            ];


        let tileAddress;


        if (
            unsignedTiles
        ) {

            tileAddress =
                tileNumber * 16;

        } else {

            const signed =
                tileNumber & 0x80
                    ? tileNumber - 0x100
                    : tileNumber;

            tileAddress =
                0x1000 +
                signed * 16;
        }


        tileAddress =
            (
                tileAddress +
                (
                    bgY & 7
                ) * 2
            ) & 0x1FFF;


        const bit =
            7 -
            (
                bgX & 7
            );


        const lo =
            this.vram[
                tileAddress
            ];


        const hi =
            this.vram[
                (
                    tileAddress + 1
                ) & 0x1FFF
            ];


        return (
            (
                (
                    hi >> bit
                ) & 1
            ) << 1 |
            (
                lo >> bit
            ) & 1
        );
    }


    /*
     * ========================================================
     * PALETTE
     * ========================================================
     */

    getBGColor(index) {

        index &=
            3;


        const shade =
            (
                this.bgp >>
                (
                    index * 2
                )
            ) & 3;


        return this.palette[
            shade
        ];
    }


    getOBJColor(
        palette,
        index
    ) {

        index &=
            3;


        if (
            index === 0
        ) {

            return 0;
        }


        const shade =
            (
                palette >>
                (
                    index * 2
                )
            ) & 3;


        return this.palette[
            shade
        ];
    }


    /*
     * ========================================================
     * BLANK LINE
     * ========================================================
     */

    renderBlankLine(y) {

        const color =
            this.getBGColor(0);


        const offset =
            y * 160;


        for (
            let x = 0;
            x < 160;
            x++
        ) {

            this.framebuffer[
                offset + x
            ] =
                color;
        }
    }


    /*
     * ========================================================
     * PRESENT
     * ========================================================
     */

    present() {

        if (
            !this.ctx ||
            !this.imageData
        ) {

            return;
        }


        const data =
            this.imageData.data;


        for (
            let i = 0;
            i < this.framebuffer.length;
            i++
        ) {

            const color =
                this.framebuffer[i];


            const p =
                i * 4;


            data[p] =
                (
                    color >> 16
                ) & 0xFF;


            data[p + 1] =
                (
                    color >> 8
                ) & 0xFF;


            data[p + 2] =
                color & 0xFF;


            data[p + 3] =
                0xFF;
        }


        this.ctx.putImageData(
            this.imageData,
            0,
            0
        );
    }


    /*
     * ========================================================
     * DEBUG / INFO
     * ========================================================
     */

    getInfo() {

        return {

            lcdc:
                this.lcdc,

            stat:
                this.getSTAT(),

            scx:
                this.scx,

            scy:
                this.scy,

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

            wx:
                this.wx,

            wy:
                this.wy,

            mode:
                this.mode,

            modeClock:
                this.modeClock,

            frame:
                this.frame,

            lcdEnabled:
                this.lcdEnabled

        };
    }


    getState() {
        return this.getInfo();
    }


    /*
     * ========================================================
     * SAVE STATE
     * ========================================================
     */

    serialize() {

        return {

            vram:
                Array.from(this.vram),

            oam:
                Array.from(this.oam),

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

            frame:
                this.frame,

            frames:
                this.frames,

            windowLine:
                this.windowLine
        };
    }


    deserialize(state) {

        if (!state) {
            return;
        }


        if (
            Array.isArray(state.vram)
        ) {

            this.vram.set(
                state.vram.slice(
                    0,
                    0x2000
                )
            );
        }


        if (
            Array.isArray(state.oam)
        ) {

            this.oam.set(
                state.oam.slice(
                    0,
                    0xA0
                )
            );
        }


        const fields = [
            "lcdc",
            "stat",
            "scy",
            "scx",
            "ly",
            "lyc",
            "bgp",
            "obp0",
            "obp1",
            "wy",
            "wx",
            "mode",
            "modeClock",
            "frame",
            "frames",
            "windowLine"
        ];


        for (
            const key of fields
        ) {

            if (
                state[key] !== undefined
            ) {

                this[key] =
                    state[key];
            }
        }


        this.updateSTAT();
    }


    saveState() {
        return this.serialize();
    }


    loadState(state) {
        this.deserialize(state);
    }
}
