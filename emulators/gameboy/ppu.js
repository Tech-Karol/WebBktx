/*
 * ============================================================
 * WebBktx Game Boy — PPU / LCD Controller
 * ============================================================
 *
 * DMG-compatible PPU.
 *
 * Public API expected by memory.js / emulator.js:
 *
 *   reset()
 *   step(cycles)
 *   readRegister(address)
 *   writeRegister(address, value)
 *   readVRAM(address)
 *   writeVRAM(address, value)
 *   readOAM(address)
 *   writeOAM(address, value)
 *   lcdEnabled()
 *   renderScanline()
 *
 * LCD:
 *   160 x 144
 *
 * VRAM:
 *   0x8000 - 0x9FFF
 *
 * OAM:
 *   0xFE00 - 0xFE9F
 *
 * Modes:
 *   0 = HBlank
 *   1 = VBlank
 *   2 = OAM
 *   3 = Drawing
 *
 * ============================================================
 */

export default class PPU {

    constructor(memory = null, canvas = null) {

        this.memory = memory;
        this.canvas = canvas;

        this.ctx = null;

        this.width = 160;
        this.height = 144;

        this.vram = new Uint8Array(0x2000);
        this.oam = new Uint8Array(0xA0);

        this.frameBuffer =
            new Uint8ClampedArray(
                this.width *
                this.height *
                4
            );

        this.bgMap =
            new Uint8Array(
                this.width *
                this.height
            );

        this.lineBuffer =
            new Uint8Array(
                this.width
            );

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

        this.enabled = true;

        this.statLine = false;

        this.frameReady = false;

        this.totalCycles = 0;

        this.reset();

        if (canvas) {
            this.attachCanvas(canvas);
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
            this.ctx = null;
            return;
        }

        canvas.width = this.width;
        canvas.height = this.height;

        this.ctx =
            canvas.getContext("2d", {
                alpha: false
            });

        if (this.ctx) {

            this.ctx.imageSmoothingEnabled =
                false;

            this.present();
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

        this.frame = 0;
        this.frames = 0;

        this.windowLine = 0;

        this.enabled = true;

        this.statLine = false;

        this.frameReady = false;

        this.totalCycles = 0;

        this.vram.fill(0);
        this.oam.fill(0);

        this.frameBuffer.fill(255);
        this.bgMap.fill(0);
        this.lineBuffer.fill(0);

        this.updateSTAT();
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
     * REGISTER ACCESS
     * ========================================================
     */

    readRegister(address) {

        address &= 0xFF;

        switch (address) {

            case 0x40:
                return this.lcdc;

            case 0x41:
                return this.stat | 0x80;

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

                const old =
                    this.lcdc;

                this.lcdc =
                    value;

                const oldEnabled =
                    (old & 0x80) !== 0;

                const newEnabled =
                    (value & 0x80) !== 0;

                if (
                    oldEnabled &&
                    !newEnabled
                ) {
                    this.disableLCD();
                }

                if (
                    !oldEnabled &&
                    newEnabled
                ) {
                    this.enableLCD();
                }

                break;
            }

            case 0x41:

                /*
                 * STAT bits 0-2 are read-only.
                 */

                this.stat =
                    (
                        this.stat &
                        0x87
                    ) |
                    (
                        value &
                        0x78
                    );

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
                 * LY is read-only on real hardware.
                 */

                break;

            case 0x45:

                this.lyc =
                    value;

                this.updateSTAT();

                break;

            case 0x46:

                /*
                 * DMA is handled by memory.js.
                 */

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
         * During mode 3 VRAM is inaccessible.
         * Keep this behavior simple and DMG-compatible.
         */

        if (
            this.lcdEnabled() &&
            this.mode === 3
        ) {
            return;
        }

        this.vram[address] =
            value & 0xFF;
    }


    /*
     * ========================================================
     * OAM
     * ========================================================
     */

    readOAM(address) {

        address &= 0xFF;

        if (address >= 0xA0) {
            return 0xFF;
        }

        if (
            this.lcdEnabled() &&
            (
                this.mode === 2 ||
                this.mode === 3
            )
        ) {
            return 0xFF;
        }

        return this.oam[address];
    }


    writeOAM(address, value) {

        address &= 0xFF;

        if (address >= 0xA0) {
            return;
        }

        if (
            this.lcdEnabled() &&
            (
                this.mode === 2 ||
                this.mode === 3
            )
        ) {
            return;
        }

        this.oam[address] =
            value & 0xFF;
    }


    /*
     * ========================================================
     * LCD STATE
     * ========================================================
     */

    enableLCD() {

        this.enabled = true;

        this.ly = 0;

        this.mode = 2;

        this.modeClock = 0;

        this.windowLine = 0;

        this.updateSTAT();
    }


    disableLCD() {

        this.enabled = false;

        this.mode = 0;

        this.modeClock = 0;

        this.ly = 0;

        this.windowLine = 0;

        this.updateSTAT();

        /*
         * When LCD is disabled, screen becomes color 0.
         */

        this.clearScreen(0);

        this.present();
    }


    /*
     * ========================================================
     * STEP
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

        this.totalCycles +=
            cycles;

        this.modeClock +=
            cycles;

        /*
         * A mode can sometimes consume more than
         * one transition when a large cycle count
         * is supplied.
         */

        while (true) {

            let limit;

            switch (this.mode) {

                case 2:
                    limit = 80;
                    break;

                case 3:
                    limit = 172;
                    break;

                case 0:
                    limit = 204;
                    break;

                case 1:
                    limit = 456;
                    break;

                default:
                    this.mode = 2;
                    this.modeClock = 0;
                    this.updateSTAT();
                    return;
            }

            if (
                this.modeClock < limit
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
     * MODE MACHINE
     * ========================================================
     */

    advanceMode() {

        switch (this.mode) {

            /*
             * ------------------------------------------------
             * OAM -> DRAW
             * ------------------------------------------------
             */

            case 2:

                this.mode = 3;

                this.updateSTAT();

                break;


            /*
             * ------------------------------------------------
             * DRAW -> HBLANK
             * ------------------------------------------------
             */

            case 3:

                this.renderScanline();

                this.mode = 0;

                this.updateSTAT();

                break;


            /*
             * ------------------------------------------------
             * HBLANK -> NEXT LINE
             * ------------------------------------------------
             */

            case 0:

                this.ly++;

                if (
                    this.ly >= 144
                ) {

                    this.ly = 144;

                    this.mode = 1;

                    this.frame++;

                    this.frames++;

                    this.frameReady = true;

                    this.requestInterrupt(
                        0
                    );

                    this.present();

                } else {

                    this.mode = 2;
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

                if (
                    this.ly > 153
                ) {

                    this.ly = 0;

                    this.windowLine = 0;

                    this.mode = 2;

                    this.frameReady = false;

                } else {

                    this.mode = 1;
                }

                this.updateSTAT();

                break;
        }
    }


    /*
     * ========================================================
     * STAT
     * ========================================================
     */

    updateSTAT() {

        /*
         * Preserve interrupt-enable bits.
         */

        let stat =
            this.stat &
            0x78;

        stat |=
            this.mode &
            0x03;

        if (
            this.ly === this.lyc
        ) {

            stat |= 0x04;

        }

        this.stat =
            stat |
            0x80;

        const coincidence =
            (
                this.ly ===
                this.lyc
            );

        const source =
            (
                (
                    this.mode === 0 &&
                    (this.stat & 0x08)
                ) ||
                (
                    this.mode === 1 &&
                    (this.stat & 0x10)
                ) ||
                (
                    this.mode === 2 &&
                    (this.stat & 0x20)
                ) ||
                (
                    coincidence &&
                    (this.stat & 0x40)
                )
            );

        if (
            source &&
            !this.statLine
        ) {

            this.requestInterrupt(
                1
            );
        }

        this.statLine =
            Boolean(source);
    }


    /*
     * ========================================================
     * INTERRUPTS
     * ========================================================
     */

    requestInterrupt(bit) {

        if (
            !this.memory
        ) {
            return;
        }

        if (
            typeof this.memory.requestInterrupt ===
            "function"
        ) {

            this.memory.requestInterrupt(
                bit
            );

            return;
        }

        if (
            typeof this.memory.setInterruptFlag ===
            "function"
        ) {

            this.memory.setInterruptFlag(
                bit
            );

            return;
        }

        if (
            "interruptFlags" in this.memory
        ) {

            this.memory.interruptFlags |=
                1 << bit;

            this.memory.interruptFlags &=
                0x1F;
        }
    }


    /*
     * ========================================================
     * SCANLINE RENDERER
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

        /*
         * Render background first.
         */

        if (
            this.lcdc &
            0x01
        ) {

            this.renderBackground(
                y
            );

        } else {

            for (
                let x = 0;
                x < 160;
                x++
            ) {

                this.lineBuffer[x] =
                    0;
            }
        }


        /*
         * Window.
         */

        if (
            this.lcdc &
            0x20
        ) {

            if (
                y >= this.wy &&
                this.wy < 144
            ) {

                this.renderWindow(
                    y
                );
            }
        }


        /*
         * Sprites.

         */

        if (
            this.lcdc &
            0x02
        ) {

            this.renderSprites(
                y
            );
        }


        /*
         * Convert palette indices
         * into RGBA pixels.
         */

        for (
            let x = 0;
            x < 160;
            x++
        ) {

            const paletteIndex =
                this.lineBuffer[x] &
                3;

            const shade =
                this.paletteColor(
                    this.bgp,
                    paletteIndex
                );

            const offset =
                (
                    y *
                    160 +
                    x
                ) * 4;

            this.setPixel(
                offset,
                shade
            );
        }
    }


    /*
     * ========================================================
     * BACKGROUND
     * ========================================================
     */

    renderBackground(y) {

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

        const scrollY =
            (
                y +
                this.scy
            ) & 0xFF;

        const tileY =
            (
                scrollY >> 3
            ) & 31;

        const pixelY =
            scrollY & 7;

        for (
            let x = 0;
            x < 160;
            x++
        ) {

            const scrollX =
                (
                    x +
                    this.scx
                ) & 0xFF;

            const tileX =
                (
                    scrollX >> 3
                ) & 31;

            const mapAddress =
                tileMapBase +
                tileY * 32 +
                tileX;

            const tileNumber =
                this.vram[
                    mapAddress & 0x1FFF
                ];

            let tileAddress;

            if (unsignedTiles) {

                tileAddress =
                    0x0000 +
                    tileNumber * 16;

            } else {

                const signed =
                    tileNumber & 0x80
                        ? tileNumber - 256
                        : tileNumber;

                tileAddress =
                    0x1000 +
                    signed * 16;
            }

            const row =
                tileAddress +
                pixelY * 2;

            const low =
                this.vram[
                    row & 0x1FFF
                ];

            const high =
                this.vram[
                    (
                        row + 1
                    ) & 0x1FFF
                ];

            const bit =
                7 -
                (
                    scrollX & 7
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

            this.lineBuffer[x] =
                color;

            this.bgMap[
                y * 160 + x
            ] =
                color;
        }
    }


    /*
     * ========================================================
     * WINDOW
     * ========================================================
     */

    renderWindow(y) {

        if (
            !(
                this.lcdc &
                0x20
            )
        ) {
            return;
        }

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

        const windowX =
            this.wx - 7;

        if (
            windowX >= 160
        ) {
            return;
        }

        const windowY =
            y -
            this.wy;

        if (
            windowY < 0
        ) {
            return;
        }

        const tileY =
            (
                windowY >> 3
            ) & 31;

        const pixelY =
            windowY & 7;

        let visible =
            false;

        for (
            let x = 0;
            x < 160;
            x++
        ) {

            if (
                x < windowX
            ) {
                continue;
            }

            const wx =
                x -
                windowX;

            const tileX =
                (
                    wx >> 3
                ) & 31;

            const mapAddress =
                tileMapBase +
                tileY * 32 +
                tileX;

            const tileNumber =
                this.vram[
                    mapAddress & 0x1FFF
                ];

            let tileAddress;

            if (unsignedTiles) {

                tileAddress =
                    tileNumber *
                    16;

            } else {

                const signed =
                    tileNumber & 0x80
                        ? tileNumber - 256
                        : tileNumber;

                tileAddress =
                    0x1000 +
                    signed * 16;
            }

            const row =
                tileAddress +
                pixelY * 2;

            const low =
                this.vram[
                    row & 0x1FFF
                ];

            const high =
                this.vram[
                    (
                        row + 1
                    ) & 0x1FFF
                ];

            const bit =
                7 -
                (
                    wx & 7
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

            this.lineBuffer[x] =
                color;

            this.bgMap[
                y * 160 + x
            ] =
                color;

            visible = true;
        }

        if (visible) {
            this.windowLine++;
        }
    }


    /*
     * ========================================================
     * SPRITES
     * ========================================================
     */

    renderSprites(y) {

        const height =
            (
                this.lcdc &
                0x04
            )
                ? 16
                : 8;

        const sprites = [];

        /*
         * Hardware can evaluate 40 OAM entries,
         * but only 10 sprites are visible per scanline.
         */

        for (
            let i = 0;
            i < 40;
            i++
        ) {

            const base =
                i * 4;

            const sy =
                this.oam[base] -
                16;

            const sx =
                this.oam[
                    base + 1
                ] -
                8;

            const tile =
                this.oam[
                    base + 2
                ];

            const flags =
                this.oam[
                    base + 3
                ];

            if (
                y >= sy &&
                y < sy + height
            ) {

                sprites.push({
                    index: i,
                    x: sx,
                    y: sy,
                    tile: tile,
                    flags: flags
                });

                if (
                    sprites.length >= 10
                ) {
                    break;
                }
            }
        }

        /*
         * DMG priority is affected by X coordinate
         * and OAM order. Reverse iteration gives
         * earlier OAM entries priority when pixels
         * overlap.
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

            let line =
                y -
                sprite.y;

            const flags =
                sprite.flags;

            const flipY =
                Boolean(
                    flags &
                    0x40
                );

            const flipX =
                Boolean(
                    flags &
                    0x20
                );

            if (flipY) {
                line =
                    height -
                    1 -
                    line;
            }

            let tile =
                sprite.tile;

            if (
                height === 16
            ) {
                tile &=
                    0xFE;
            }

            const tileAddress =
                tile * 16 +
                line * 2;

            const low =
                this.vram[
                    tileAddress &
                    0x1FFF
                ];

            const high =
                this.vram[
                    (
                        tileAddress +
                        1
                    ) &
                    0x1FFF
                ];

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
                 * Color 0 is transparent.
                 */

                if (
                    color === 0
                ) {
                    continue;
                }

                /*
                 * Behind-background flag.
                 */

                if (
                    flags &
                    0x80
                ) {

                    const bg =
                        this.bgMap[
                            y * 160 +
                            screenX
                        ];

                    if (
                        bg !== 0
                    ) {
                        continue;
                    }
                }

                /*
                 * Sprite palette.
                 */

                const palette =
                    (
                        flags &
                        0x10
                    )
                        ? this.obp1
                        : this.obp0;

                const shade =
                    this.paletteColor(
                        palette,
                        color
                    );

                const offset =
                    (
                        y * 160 +
                        screenX
                    ) * 4;

                this.setPixel(
                    offset,
                    shade
                );
            }
        }
    }


    /*
     * ========================================================
     * PALETTE
     * ========================================================
     */

    paletteColor(
        palette,
        index
    ) {

        return (
            palette >>
            (
                index * 2
            )
        ) & 3;
    }


    /*
     * ========================================================
     * PIXELS
     * ========================================================
     */

    setPixel(
        offset,
        shade
    ) {

        /*
         * Classic Game Boy shades.
         *
         * Using fixed values avoids CSS/browser
         * color management affecting the emulator.
         */

        let value;

        switch (
            shade & 3
        ) {

            case 0:
                value = 255;
                break;

            case 1:
                value = 192;
                break;

            case 2:
                value = 96;
                break;

            default:
                value = 0;
                break;
        }

        this.frameBuffer[offset] =
            value;

        this.frameBuffer[offset + 1] =
            value;

        this.frameBuffer[offset + 2] =
            value;

        this.frameBuffer[offset + 3] =
            255;
    }


    clearScreen(shade = 0) {

        for (
            let y = 0;
            y < 144;
            y++
        ) {

            for (
                let x = 0;
                x < 160;
                x++
            ) {

                const offset =
                    (
                        y * 160 +
                        x
                    ) * 4;

                this.setPixel(
                    offset,
                    shade
                );
            }
        }
    }


    /*
     * ========================================================
     * PRESENT
     * ========================================================
     */

    present() {

        if (
            !this.ctx
        ) {
            return;
        }

        let image;

        try {

            image =
                this.ctx.createImageData(
                    160,
                    144
                );

            image.data.set(
                this.frameBuffer
            );

            this.ctx.putImageData(
                image,
                0,
                0
            );

        } catch (error) {

            /*
             * Canvas should never be allowed to
             * stop the CPU.
             */

            if (
                typeof console !==
                "undefined"
            ) {

                console.warn(
                    "[WebBktx] PPU canvas error:",
                    error
                );
            }
        }
    }


    /*
     * ========================================================
     * FRAME
     * ========================================================
     */

    getFrameBuffer() {

        return this.frameBuffer;
    }


    getFrame() {

        return this.frame;
    }


    isFrameReady() {

        return this.frameReady;
    }


    clearFrameReady() {

        this.frameReady =
            false;
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

            enabled:
                this.lcdEnabled()
        };
    }


    /*
     * ========================================================
     * SERIALIZATION
     * ========================================================
     */

    serialize() {

        return {

            lcdc: this.lcdc,
            stat: this.stat,

            scy: this.scy,
            scx: this.scx,

            ly: this.ly,
            lyc: this.lyc,

            bgp: this.bgp,
            obp0: this.obp0,
            obp1: this.obp1,

            wy: this.wy,
            wx: this.wx,

            mode: this.mode,
            modeClock: this.modeClock,

            frame: this.frame,
            frames: this.frames,

            windowLine:
                this.windowLine,

            vram:
                Array.from(
                    this.vram
                ),

            oam:
                Array.from(
                    this.oam
                )
        };
    }


    deserialize(state) {

        if (!state) {
            return;
        }

        this.lcdc =
            state.lcdc ??
            0x91;

        this.stat =
            state.stat ??
            0x85;

        this.scy =
            state.scy ??
            0;

        this.scx =
            state.scx ??
            0;

        this.ly =
            state.ly ??
            0;

        this.lyc =
            state.lyc ??
            0;

        this.bgp =
            state.bgp ??
            0xFC;

        this.obp0 =
            state.obp0 ??
            0xFF;

        this.obp1 =
            state.obp1 ??
            0xFF;

        this.wy =
            state.wy ??
            0;

        this.wx =
            state.wx ??
            0;

        this.mode =
            state.mode ??
            2;

        this.modeClock =
            state.modeClock ??
            0;

        this.frame =
            state.frame ??
            0;

        this.frames =
            state.frames ??
            0;

        this.windowLine =
            state.windowLine ??
            0;

        if (
            Array.isArray(
                state.vram
            )
        ) {

            this.vram.set(
                state.vram.slice(
                    0,
                    0x2000
                )
            );
        }

        if (
            Array.isArray(
                state.oam
            )
        ) {

            this.oam.set(
                state.oam.slice(
                    0,
                    0xA0
                )
            );
        }

        this.enabled =
            this.lcdEnabled();

        this.updateSTAT();
    }
}
