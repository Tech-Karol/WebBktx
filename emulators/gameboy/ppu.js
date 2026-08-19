/*
 * ============================================================
 * WebBktx — Game Boy PPU / LCD Controller
 * ============================================================
 *
 * DMG-compatible PPU.
 *
 * Public API expected by emulator.js / memory.js:
 *
 *   step(cycles)
 *   advanceMode()
 *   renderScanline()
 *   lcdEnabled()
 *   consumeFrame()
 *
 * Memory-facing API:
 *
 *   readVRAM()
 *   writeVRAM()
 *   readOAM()
 *   writeOAM()
 *   readRegister()
 *   writeRegister()
 *
 * Registers:
 *
 * FF40 LCDC
 * FF41 STAT
 * FF42 SCY
 * FF43 SCX
 * FF44 LY
 * FF45 LYC
 * FF47 BGP
 * FF48 OBP0
 * FF49 OBP1
 * FF4A WY
 * FF4B WX
 *
 * ============================================================
 */

export default class PPU {

    constructor(memory = null, canvas = null) {

        this.memory = memory;
        this.canvas = canvas;

        this.ctx = null;

        /*
         * ----------------------------------------------------
         * Game Boy resolution
         * ----------------------------------------------------
         */

        this.width = 160;
        this.height = 144;

        this.frameBuffer =
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
         * VRAM / OAM
         * ----------------------------------------------------
         */

        this.vram =
            new Uint8Array(0x2000);

        this.oam =
            new Uint8Array(0xA0);


        /*
         * ----------------------------------------------------
         * LCD registers
         * ----------------------------------------------------
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
         * ----------------------------------------------------
         * Timing
         * ----------------------------------------------------
         */

        this.mode = 2;
        this.modeClock = 0;

        this.frameCycles = 0;

        /*
         * DMG:
         *
         * Mode 2 = 80 cycles
         * Mode 3 = ~172 cycles
         * Mode 0 = ~204 cycles
         * Line   = 456 cycles
         *
         * Exact mode-3 timing can vary on real hardware.
         */

        this.MODE2_CYCLES = 80;
        this.MODE3_CYCLES = 172;
        this.MODE0_CYCLES = 204;
        this.LINE_CYCLES = 456;


        /*
         * ----------------------------------------------------
         * LCD state
         * ----------------------------------------------------
         */

        this.lcdOn = true;

        this.windowLine = 0;

        this.statSignal = false;


        /*
         * ----------------------------------------------------
         * Palette
         * ----------------------------------------------------
         *
         * Values are grayscale indices.
         */

        this.palette = [
            255,
            192,
            96,
            0
        ];


        /*
         * ----------------------------------------------------
         * Canvas
         * ----------------------------------------------------
         */

        this.attachCanvas(canvas);

        this.reset();
    }


    /*
     * ========================================================
     * CANVAS
     * ========================================================
     */

    attachCanvas(canvas) {

        if (!canvas) {
            return;
        }

        this.canvas = canvas;

        try {

            this.ctx =
                canvas.getContext("2d", {
                    alpha: false
                });

            if (this.ctx) {

                canvas.width =
                    this.width;

                canvas.height =
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

        this.lcdOn = true;

        this.statSignal = false;

        this.frameReady = false;

        this.frameBuffer.fill(0);

        this.displayBuffer.fill(255);

        this.vram.fill(0);
        this.oam.fill(0);

        this.updateSTAT();
        this.renderBlankFrame();
    }


    /*
     * ========================================================
     * LCD ENABLE
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


    /*
     * ========================================================
     * LCDC HELPERS
     * ========================================================
     */

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

        /*
         * During mode 3 the CPU cannot normally access VRAM.
         * The memory layer may additionally enforce this.
         */

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

            case 0x46:
                return 0xFF;

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

                const oldEnabled =
                    this.lcdEnabled();

                this.lcdc =
                    value;

                const newEnabled =
                    this.lcdEnabled();

                if (
                    oldEnabled &&
                    !newEnabled
                ) {

                    this.disableLCD();

                } else if (
                    !oldEnabled &&
                    newEnabled
                ) {

                    this.enableLCD();
                }

                break;
            }


            case 0x41:

                /*
                 * Bits 0-2 are PPU-owned.
                 * Bits 3-6 are writable.
                 * Bit 7 always reads as 1.
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


            case 0x42:
                this.scy = value;
                break;


            case 0x43:
                this.scx = value;
                break;


            case 0x44:
                /*
                 * LY is read-only.
                 */
                break;


            case 0x45:
                this.lyc = value;
                this.updateSTAT();
                break;


            case 0x47:
                this.bgp = value;
                break;


            case 0x48:
                this.obp0 = value;
                break;


            case 0x49:
                this.obp1 = value;
                break;


            case 0x4A:
                this.wy = value;
                break;


            case 0x4B:
                this.wx = value;
                break;
        }
    }


    /*
     * Compatibility aliases.
     */

    readIO(address) {

        return this.readRegister(
            address
        );
    }


    writeIO(address, value) {

        this.writeRegister(
            address,
            value
        );
    }


    /*
     * ========================================================
     * LCD OFF / ON
     * ========================================================
     */

    disableLCD() {

        this.lcdOn = false;

        this.mode = 0;

        this.modeClock = 0;

        this.ly = 0;

        this.windowLine = 0;

        this.frameCycles = 0;

        this.statSignal = false;

        this.updateSTAT();

        this.renderBlankFrame();
    }


    enableLCD() {

        this.lcdOn = true;

        this.mode = 2;

        this.modeClock = 0;

        this.ly = 0;

        this.windowLine = 0;

        this.frameCycles = 0;

        this.statSignal = false;

        this.updateSTAT();
    }


    /*
     * ========================================================
     * TIMING
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

            let threshold;

            switch (this.mode) {

                case 2:
                    threshold =
                        this.MODE2_CYCLES;
                    break;

                case 3:
                    threshold =
                        this.MODE3_CYCLES;
                    break;

                case 0:
                    threshold =
                        this.MODE0_CYCLES;
                    break;

                case 1:
                    threshold =
                        this.LINE_CYCLES;
                    break;

                default:
                    threshold =
                        this.LINE_CYCLES;
                    break;
            }

            if (
                this.modeClock <
                threshold
            ) {
                break;
            }

            this.modeClock -=
                threshold;

            this.advanceMode();
        }
    }


    /*
     * Some emulator versions call advanceMode()
     * directly.
     */

    advanceMode() {

        if (!this.lcdEnabled()) {
            return;
        }


        switch (this.mode) {

            /*
             * ------------------------------------------------
             * OAM -> DRAW
             * ------------------------------------------------
             */

            case 2:

                this.setMode(3);

                break;


            /*
             * ------------------------------------------------
             * DRAW -> HBLANK
             * ------------------------------------------------
             */

            case 3:

                this.renderScanline();

                this.setMode(0);

                break;


            /*
             * ------------------------------------------------
             * HBLANK -> next line
             * ------------------------------------------------
             */

            case 0:

                this.ly++;

                if (this.ly >= 144) {

                    this.ly = 144;

                    this.setMode(1);

                    this.presentFrame();

                } else {

                    this.setMode(2);
                }

                this.updateSTAT();

                break;


            /*
             * ------------------------------------------------
             * VBLANK
             * ------------------------------------------------
             */

            case 1:

                this.ly++;

                if (this.ly > 153) {

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
     * MODE
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


    /*
     * ========================================================
     * STAT
     * ========================================================
     */

    updateSTAT() {

        if (
            this.ly ===
            this.lyc
        ) {

            this.stat |= 0x04;

        } else {

            this.stat &= ~0x04;
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
         * LYC=LY interrupt.
         */

        if (
            (this.stat & 0x40) &&
            this.ly === this.lyc
        ) {

            signal = true;
        }

        /*
         * Generate rising-edge STAT IRQ.
         */

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
            "interruptFlags" in this.memory
        ) {

            this.memory.interruptFlags |= 0x02;
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
            "interruptFlags" in this.memory
        ) {

            this.memory.interruptFlags |= 0x01;
        }
    }


    /*
     * ========================================================
     * SCANLINE RENDERER
     * ========================================================
     */

    renderScanline() {

        if (
            !this.lcdEnabled()
        ) {

            return;
        }

        if (
            this.ly >=
            this.height
        ) {

            return;
        }


        const y =
            this.ly;


        /*
         * Background first.
         */

        this.renderBackground(y);


        /*
         * Window overlays BG.
         */

        if (
            this.windowEnabled() &&
            y >= this.wy &&
            this.wx <= 166
        ) {

            this.renderWindow(y);
        }


        /*
         * Sprites are rendered last.
         */

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

        if (
            !this.bgEnabled()
        ) {

            /*
             * DMG LCDC bit 0 disables BG.
             * Fill with palette color 0.
             */

            const color =
                this.getPaletteColor(
                    this.bgp,
                    0
                );

            const start =
                y * this.width;

            for (
                let x = 0;
                x < this.width;
                x++
            ) {

                this.frameBuffer[
                    start + x
                ] = color;
            }

            return;
        }


        const mapBase =
            this.bgTileMap();

        const fineY =
            (
                y +
                this.scy
            ) & 0xFF;

        const tileY =
            (
                fineY >> 3
            ) & 31;

        const pixelY =
            fineY & 7;


        const lineStart =
            y * this.width;


        for (
            let x = 0;
            x < this.width;
            x++
        ) {

            const fineX =
                (
                    x +
                    this.scx
                ) & 0xFF;

            const tileX =
                (
                    fineX >> 3
                ) & 31;

            const pixelX =
                fineX & 7;


            const mapIndex =
                mapBase +
                tileY * 32 +
                tileX;


            const tileNumber =
                this.vram[
                    mapIndex
                ];


            const tileAddress =
                this.getTileAddress(
                    tileNumber
                );


            const rowAddress =
                tileAddress +
                pixelY * 2;


            const lo =
                this.vram[
                    rowAddress &
                    0x1FFF
                ];

            const hi =
                this.vram[
                    (
                        rowAddress + 1
                    ) &
                    0x1FFF
                ];


            const bit =
                7 - pixelX;


            const colorId =
                (
                    (
                        hi >> bit
                    ) & 1
                ) << 1 |
                (
                    lo >> bit
                ) & 1;


            this.frameBuffer[
                lineStart + x
            ] =
                this.getPaletteColor(
                    this.bgp,
                    colorId
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


        const windowX =
            this.wx - 7;

        const windowY =
            this.wy;


        if (
            y < windowY
        ) {

            return;
        }


        const winY =
            this.windowLine;


        const mapBase =
            this.windowTileMap();

        const tileY =
            (
                winY >> 3
            ) & 31;

        const pixelY =
            winY & 7;


        let drawn =
            false;


        for (
            let x = 0;
            x < this.width;
            x++
        ) {

            if (
                x < windowX
            ) {
                continue;
            }


            const winX =
                x - windowX;


            const tileX =
                (
                    winX >> 3
                ) & 31;

            const pixelX =
                winX & 7;


            const mapIndex =
                mapBase +
                tileY * 32 +
                tileX;


            const tileNumber =
                this.vram[
                    mapIndex
                ];


            const tileAddress =
                this.getTileAddress(
                    tileNumber
                );


            const row =
                tileAddress +
                pixelY * 2;


            const lo =
                this.vram[
                    row &
                    0x1FFF
                ];

            const hi =
                this.vram[
                    (
                        row + 1
                    ) &
                    0x1FFF
                ];


            const bit =
                7 - pixelX;


            const colorId =
                (
                    (
                        hi >> bit
                    ) & 1
                ) << 1 |
                (
                    lo >> bit
                ) & 1;


            this.frameBuffer[
                y * this.width + x
            ] =
                this.getPaletteColor(
                    this.bgp,
                    colorId
                );


            drawn = true;
        }


        if (drawn) {

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
         * Signed tile indices:
         *
         * 0x80 -> -128
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

        const spriteHeight =
            this.objTall()
                ? 16
                : 8;


        const sprites = [];


        /*
         * Hardware searches OAM in order and can select
         * at most 10 sprites per line.
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


            if (
                y >= spriteY &&
                y < spriteY + spriteHeight
            ) {

                sprites.push({
                    index: i,
                    y: spriteY,
                    x: this.oam[
                        base + 1
                    ] - 8,
                    tile: this.oam[
                        base + 2
                    ],
                    flags: this.oam[
                        base + 3
                    ]
                });


                if (
                    sprites.length >= 10
                ) {

                    break;
                }
            }
        }


        /*
         * DMG priority is primarily X coordinate,
         * then OAM order.
         */

        sprites.sort(
            (a, b) => {

                if (
                    a.x !== b.x
                ) {

                    return a.x - b.x;
                }

                return (
                    a.index -
                    b.index
                );
            }
        );


        /*
         * Render from lowest priority to highest so that
         * later writes have priority.
         */

        for (
            let s =
                sprites.length - 1;
            s >= 0;
            s--
        ) {

            this.renderSprite(
                sprites[s],
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


        const yFlip =
            (
                flags &
                0x40
            ) !== 0;


        const xFlip =
            (
                flags &
                0x20
            ) !== 0;


        if (
            yFlip
        ) {

            line =
                spriteHeight -
                1 -
                line;
        }


        let tile =
            sprite.tile;


        /*
         * 8x16 sprites ignore bit 0 of tile index.
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


        const tileAddress =
            tile *
            16;


        const row =
            tileAddress +
            line * 2;


        const lo =
            this.vram[
                row &
                0x1FFF
            ];

        const hi =
            this.vram[
                (
                    row + 1
                ) &
                0x1FFF
            ];


        const palette =
            (
                flags &
                0x10
            )
                ? this.obp1
                : this.obp0;


        const behindBG =
            (
                flags &
                0x80
            ) !== 0;


        for (
            let px = 0;
            px < 8;
            px++
        ) {

            const screenX =
                sprite.x + px;


            if (
                screenX < 0 ||
                screenX >= this.width
            ) {

                continue;
            }


            const bit =
                xFlip
                    ? px
                    : 7 - px;


            const colorId =
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
                colorId === 0
            ) {

                continue;
            }


            /*
             * Sprite behind BG.
             */

            if (
                behindBG &&
                this.bgEnabled()
            ) {

                const bgColor =
                    this.frameBuffer[
                        y * this.width +
                        screenX
                    ];


                const bgColorId =
                    this.paletteIndex(
                        this.bgp,
                        bgColor
                    );


                if (
                    bgColorId !== 0
                ) {

                    continue;
                }
            }


            this.frameBuffer[
                y * this.width +
                screenX
            ] =
                this.getPaletteColor(
                    palette,
                    colorId
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
        colorId
    ) {

        const shade =
            (
                palette >>
                (
                    colorId * 2
                )
            ) & 3;


        return shade;
    }


    paletteIndex(
        palette,
        framebufferColor
    ) {

        for (
            let i = 0;
            i < 4;
            i++
        ) {

            if (
                this.getPaletteColor(
                    palette,
                    i
                ) === framebufferColor
            ) {

                return i;
            }
        }

        return 0;
    }


    /*
     * ========================================================
     * FRAME BUFFER
     * ========================================================
     */

    convertFrameToRGBA() {

        for (
            let i = 0;
            i < this.frameBuffer.length;
            i++
        ) {

            const shade =
                this.palette[
                    this.frameBuffer[i] &
                    3
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
            !this.ctx
        ) {

            return;
        }


        try {

            const image =
                new ImageData(
                    this.displayBuffer,
                    this.width,
                    this.height
                );


            this.ctx.putImageData(
                image,
                0,
                0
            );

        } catch (e) {

            /*
             * Keep emulator alive even if the canvas
             * implementation is unavailable.
             */
        }


        /*
         * VBlank interrupt.
         */

        this.requestVBlankInterrupt();
    }


    /*
     * ========================================================
     * consumeFrame()
     * ========================================================
     *
     * emulator.js expects this function.
     *
     * Returns true exactly once for every completed frame.
     *
     * If your emulator.js expects an ImageData object,
     * return the displayBuffer instead by changing this
     * function. The current WebBktx loop only needs a
     * frame-ready signal.
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
     * BLANK FRAME
     * ========================================================
     */

    renderBlankFrame() {

        this.frameBuffer.fill(0);

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
                    this.width,
                    this.height
                );


            this.ctx.putImageData(
                image,
                0,
                0
            );

        } catch (e) {
            /* Ignore canvas errors. */
        }
    }


    /*
     * ========================================================
     * DEBUG / INFO
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
