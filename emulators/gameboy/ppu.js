/*
 * ============================================================
 * WebBktx Game Boy — PPU / LCD Controller
 * ============================================================
 *
 * DMG-compatible PPU.
 *
 * API używane przez obecny emulator.js:
 *
 *   connectCanvas(canvas)
 *   step(cycles)
 *   advanceMode()
 *   renderScanline()
 *   consumeFrame()
 *   lcdEnabled()
 *
 * Rejestry:
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
 * VRAM: 8000-9FFF
 * OAM : FE00-FE9F
 *
 * ============================================================
 */

export default class PPU {

    constructor(memory = null, canvas = null) {

        this.memory = memory;

        /*
         * ----------------------------------------------------
         * Canvas
         * ----------------------------------------------------
         */

        this.canvas = null;
        this.ctx = null;

        this.imageData = null;
        this.frameBuffer = null;

        this.frameReady = false;

        this.connectCanvas(canvas);


        /*
         * ----------------------------------------------------
         * VRAM
         * ----------------------------------------------------
         */

        this.vram = new Uint8Array(0x2000);


        /*
         * ----------------------------------------------------
         * OAM
         * ----------------------------------------------------
         */

        this.oam = new Uint8Array(0xA0);


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

        this.lineCycles = 0;

        this.frameCounter = 0;

        this.totalCycles = 0;


        /*
         * ----------------------------------------------------
         * Frame
         * ----------------------------------------------------
         */

        this.frameWidth = 160;
        this.frameHeight = 144;

        this.frameBuffer =
            new Uint8ClampedArray(
                this.frameWidth *
                this.frameHeight *
                4
            );


        /*
         * ----------------------------------------------------
         * Temporary scanline buffers
         * ----------------------------------------------------
         */

        this.bgColorLine =
            new Uint8Array(160);

        this.bgPriorityLine =
            new Uint8Array(160);

        this.objColorLine =
            new Uint8Array(160);

        this.objPaletteLine =
            new Uint8Array(160);

        this.objPriorityLine =
            new Uint8Array(160);

        this.objPresentLine =
            new Uint8Array(160);


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
         * Interrupt callback
         * ----------------------------------------------------
         */

        this.interruptCallback = null;


        /*
         * ----------------------------------------------------
         * Reset
         * ----------------------------------------------------
         */

        this.reset();
    }


    /*
     * ========================================================
     * CANVAS
     * ========================================================
     */

    connectCanvas(canvas) {

        /*
         * Canvas może nie być przekazany podczas konstrukcji.
         */

        if (!canvas) {
            return false;
        }

        /*
         * Nie zakładamy, że obiekt posiada getContext.
         */

        if (
            typeof canvas.getContext !== "function"
        ) {
            return false;
        }

        this.canvas =
            canvas;

        this.ctx =
            canvas.getContext("2d", {
                alpha: false
            });

        if (!this.ctx) {
            return false;
        }

        this.canvas.width =
            160;

        this.canvas.height =
            144;


        /*
         * Skalowanie wykonywane przez CSS,
         * ale wyłączamy interpolację.
         */

        this.ctx.imageSmoothingEnabled =
            false;


        try {

            this.imageData =
                this.ctx.createImageData(
                    160,
                    144
                );

        } catch (e) {

            this.imageData = null;

        }


        return true;
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

        this.lineCycles = 0;

        this.frameCounter = 0;

        this.totalCycles = 0;

        this.windowLine = 0;

        this.windowTriggered = false;

        this.frameReady = false;


        this.vram.fill(0);

        this.oam.fill(0);


        this.clearFrame();


        this.updateSTAT();

    }


    /*
     * ========================================================
     * INTERRUPTS
     * ========================================================
     */

    setInterruptCallback(callback) {

        this.interruptCallback =
            typeof callback === "function"
                ? callback
                : null;
    }


    requestInterrupt(bit) {

        /*
         * VBlank = 0
         * STAT   = 1
         */

        if (
            this.interruptCallback
        ) {

            this.interruptCallback(
                bit
            );

            return;
        }


        if (
            this.memory &&
            typeof this.memory.requestInterrupt === "function"
        ) {

            this.memory.requestInterrupt(
                bit
            );

            return;
        }


        if (
            this.memory &&
            typeof this.memory.setInterruptFlag === "function"
        ) {

            this.memory.setInterruptFlag(
                bit
            );
        }
    }


    /*
     * ========================================================
     * LCDC
     * ========================================================
     */

    lcdEnabled() {

        return Boolean(
            this.lcdc & 0x80
        );
    }


    isLCDEnabled() {

        return this.lcdEnabled();
    }


    /*
     * ========================================================
     * REGISTERS
     * ========================================================
     */

    readRegister(address) {

        switch (
            address & 0xFF
        ) {

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


    readIO(address) {

        return this.readRegister(address);
    }


    writeRegister(address, value) {

        address &=
            0xFF;

        value &=
            0xFF;


        switch (address) {

            case 0x40:

                this.writeLCDC(value);

                break;


            case 0x41:

                /*
                 * Bits 0-2 są read-only.
                 */

                this.stat =
                    (
                        this.stat &
                        0x07
                    ) |
                    (
                        value &
                        0xF8
                    );

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
                 * LY jest read-only.
                 */

                break;


            case 0x45:

                this.lyc =
                    value;

                this.updateLYC();

                break;


            case 0x46:

                /*
                 * DMA jest obsługiwane przez memory.
                 */

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


    writeIO(address, value) {

        this.writeRegister(
            address,
            value
        );
    }


    /*
     * ========================================================
     * LCDC WRITE
     * ========================================================
     */

    writeLCDC(value) {

        value &=
            0xFF;


        const oldEnabled =
            this.lcdEnabled();

        const newEnabled =
            Boolean(
                value & 0x80
            );


        this.lcdc =
            value;


        /*
         * LCD OFF
         */

        if (
            oldEnabled &&
            !newEnabled
        ) {

            this.mode =
                0;

            this.ly =
                0;

            this.modeClock =
                0;

            this.lineCycles =
                0;

            this.windowLine =
                0;

            this.windowTriggered =
                false;

            this.clearFrame();

            this.updateSTAT();

            return;
        }


        /*
         * LCD ON
         */

        if (
            !oldEnabled &&
            newEnabled
        ) {

            this.mode =
                2;

            this.ly =
                0;

            this.modeClock =
                0;

            this.lineCycles =
                0;

            this.windowLine =
                0;

            this.windowTriggered =
                false;

            this.updateSTAT();
        }
    }


    /*
     * ========================================================
     * VRAM
     * ========================================================
     */

    readVRAM(address) {

        const offset =
            (
                address -
                0x8000
            ) & 0x1FFF;

        return this.vram[offset];
    }


    writeVRAM(address, value) {

        const offset =
            (
                address -
                0x8000
            ) & 0x1FFF;

        this.vram[offset] =
            value & 0xFF;
    }


    /*
     * ========================================================
     * OAM
     * ========================================================
     */

    readOAM(address) {

        const offset =
            (
                address -
                0xFE00
            ) & 0xFF;

        if (
            offset >= 0xA0
        ) {
            return 0xFF;
        }

        return this.oam[offset];
    }


    writeOAM(address, value) {

        const offset =
            (
                address -
                0xFE00
            ) & 0xFF;

        if (
            offset >= 0xA0
        ) {
            return;
        }

        this.oam[offset] =
            value & 0xFF;
    }


    /*
     * ========================================================
     * PPU ACCESS RESTRICTIONS
     * ========================================================
     */

    vramBlocked() {

        return (
            this.lcdEnabled() &&
            this.mode === 3
        );
    }


    oamBlocked() {

        return (
            this.lcdEnabled() &&
            (
                this.mode === 2 ||
                this.mode === 3
            )
        );
    }


    /*
     * ========================================================
     * MODE
     * ========================================================
     */

    getMode() {

        return this.mode;
    }


    setMode(mode) {

        mode &=
            3;

        const oldMode =
            this.mode;

        this.mode =
            mode;


        this.updateSTAT();


        /*
         * STAT mode interrupts.
         */

        if (
            oldMode !== mode
        ) {

            if (
                mode === 0 &&
                (this.stat & 0x08)
            ) {

                this.requestInterrupt(1);
            }


            if (
                mode === 1 &&
                (this.stat & 0x10)
            ) {

                this.requestInterrupt(1);
            }


            if (
                mode === 2 &&
                (this.stat & 0x20)
            ) {

                this.requestInterrupt(1);
            }
        }
    }


    /*
     * ========================================================
     * STAT / LYC
     * ========================================================
     */

    updateLYC() {

        const old =
            Boolean(
                this.stat & 0x04
            );

        const equal =
            this.ly === this.lyc;


        if (equal) {

            this.stat |=
                0x04;

        } else {

            this.stat &=
                ~0x04;
        }


        if (
            equal &&
            !old &&
            (this.stat & 0x40)
        ) {

            this.requestInterrupt(1);
        }
    }


    updateSTAT() {

        this.stat =
            (
                this.stat &
                0xF8
            ) |
            (
                this.mode &
                3
            );


        this.updateLYC();
    }


    /*
     * ========================================================
     * STEP
     * ========================================================
     */

    step(cycles = 4) {

        cycles =
            Math.max(
                0,
                cycles | 0
            );


        if (
            !this.lcdEnabled()
        ) {

            return;
        }


        this.totalCycles +=
            cycles;


        this.modeClock +=
            cycles;

        this.lineCycles =
            this.modeClock;


        /*
         * Jedno wywołanie może przeskoczyć
         * przez kilka stanów PPU.
         */

        while (
            this.modeClock >=
            this.modeDuration()
        ) {

            this.modeClock -=
                this.modeDuration();

            this.advanceMode();
        }
    }


    /*
     * ========================================================
     * MODE DURATION
     * ========================================================
     */

    modeDuration() {

        switch (
            this.mode
        ) {

            case 2:
                return 80;

            case 3:
                return 172;

            case 0:
                return 204;

            case 1:
                return 456;

            default:
                return 456;
        }
    }


    /*
     * ========================================================
     * ADVANCE MODE
     * ========================================================
     */

    advanceMode() {

        if (
            !this.lcdEnabled()
        ) {

            return;
        }


        switch (
            this.mode
        ) {

            /*
             * ------------------------------------------------
             * OAM
             * ------------------------------------------------
             */

            case 2:

                this.setMode(3);

                break;


            /*
             * ------------------------------------------------
             * DRAW
             * ------------------------------------------------
             */

            case 3:

                this.renderScanline();

                this.setMode(0);

                break;


            /*
             * ------------------------------------------------
             * HBLANK
             * ------------------------------------------------
             */

            case 0:

                this.ly++;


                if (
                    this.ly === 144
                ) {

                    this.setMode(1);

                    this.frameCounter++;

                    this.frameReady =
                        true;

                    this.requestInterrupt(0);

                    this.presentFrame();

                } else {

                    this.setMode(2);
                }

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

                    this.ly =
                        0;

                    this.windowLine =
                        0;

                    this.windowTriggered =
                        false;

                    this.setMode(2);
                } else {

                    this.updateSTAT();
                }

                break;
        }
    }


    /*
     * ========================================================
     * RENDER SCANLINE
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
         * Zerujemy scanline.
         */

        this.bgColorLine.fill(0);

        this.bgPriorityLine.fill(0);

        this.objColorLine.fill(0);

        this.objPaletteLine.fill(0);

        this.objPriorityLine.fill(0);

        this.objPresentLine.fill(0);


        /*
         * BG / WINDOW
         */

        if (
            this.lcdc & 0x01
        ) {

            this.renderBackground(y);

        } else {

            /*
             * Gdy BG jest wyłączone,
             * kolor 0.
             */

            for (
                let x = 0;
                x < 160;
                x++
            ) {

                this.bgColorLine[x] =
                    0;
            }
        }


        /*
         * Sprites.
         */

        if (
            this.lcdc & 0x02
        ) {

            this.renderSprites(y);
        }


        /*
         * Finalny compositing.
         */

        this.compositeScanline(y);
    }


    /*
     * ========================================================
     * BACKGROUND + WINDOW
     * ========================================================
     */

    renderBackground(y) {

        const tileMapBase =
            (
                this.lcdc & 0x08
            )
                ? 0x1C00
                : 0x1800;


        const tileDataUnsigned =
            Boolean(
                this.lcdc & 0x10
            );


        const windowEnabled =
            Boolean(
                this.lcdc & 0x20
            );


        const windowMapBase =
            (
                this.lcdc & 0x40
            )
                ? 0x1C00
                : 0x1800;


        let windowUsed =
            false;


        for (
            let x = 0;
            x < 160;
            x++
        ) {

            let px =
                (
                    x +
                    this.scx
                ) & 0xFF;

            let py =
                (
                    y +
                    this.scy
                ) & 0xFF;


            /*
             * WINDOW
             */

            if (
                windowEnabled &&
                y >= this.wy &&
                x + 7 >= this.wx
            ) {

                const wx =
                    x -
                    (
                        this.wx -
                        7
                    );


                if (
                    wx >= 0
                ) {

                    px =
                        wx;

                    py =
                        this.windowLine;

                    windowUsed =
                        true;
                }
            }


            const tileX =
                (
                    px >> 3
                ) & 31;

            const tileY =
                (
                    py >> 3
                ) & 31;


            const tileMapAddress =
                tileMapBase +
                tileY * 32 +
                tileX;


            let tile =
                this.vram[
                    tileMapAddress &
                    0x1FFF
                ];


            if (
                tileDataUnsigned
            ) {

                tile &=
                    0xFF;

            } else {

                tile =
                    (
                        tile < 128
                    )
                        ? tile
                        : tile - 256;
            }


            let tileAddress;


            if (
                tileDataUnsigned
            ) {

                tileAddress =
                    0x0000 +
                    tile * 16;

            } else {

                tileAddress =
                    0x1000 +
                    tile * 16;
            }


            tileAddress &=
                0x1FFF;


            const row =
                py & 7;


            const low =
                this.vram[
                    (
                        tileAddress +
                        row * 2
                    ) & 0x1FFF
                ];


            const high =
                this.vram[
                    (
                        tileAddress +
                        row * 2 +
                        1
                    ) & 0x1FFF
                ];


            const bit =
                7 -
                (
                    px & 7
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


            this.bgColorLine[x] =
                color;


            /*
             * BG priority dla DMG jest zasadniczo
             * związane z kolorem 0.
             */

            this.bgPriorityLine[x] =
                color !== 0
                    ? 1
                    : 0;
        }


        if (
            windowUsed
        ) {

            this.windowTriggered =
                true;

            this.windowLine++;
        }
    }


    /*
     * ========================================================
     * SPRITES
     * ========================================================
     */

    renderSprites(y) {

        const spriteHeight =
            (
                this.lcdc & 0x04
            )
                ? 16
                : 8;


        const visible =
            [];


        /*
         * Game Boy może wyświetlić maksymalnie
         * 10 sprite'ów na scanline.
         *
         * Zachowujemy kolejność OAM.
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
                this.oam[base + 1] -
                8;

            const tile =
                this.oam[base + 2];

            const flags =
                this.oam[base + 3];


            if (
                y < sy ||
                y >= sy + spriteHeight
            ) {
                continue;
            }


            visible.push({
                index: i,
                x: sx,
                y: sy,
                tile,
                flags
            });


            if (
                visible.length >= 10
            ) {
                break;
            }
        }


        /*
         * DMG priorytet:
         *
         * niższy X ma wyższy priorytet,
         * a przy równym X niższy indeks OAM.
         */

        visible.sort(
            (a, b) => {

                if (
                    a.x !== b.x
                ) {

                    return a.x - b.x;
                }

                return a.index - b.index;
            }
        );


        for (
            let s = visible.length - 1;
            s >= 0;
            s--
        ) {

            const sprite =
                visible[s];


            let row =
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


            const behindBG =
                Boolean(
                    flags & 0x80
                );


            const palette =
                (
                    flags & 0x10
                )
                    ? 1
                    : 0;


            const height =
                spriteHeight;


            if (
                flipY
            ) {

                row =
                    height -
                    1 -
                    row;
            }


            let tile =
                sprite.tile;


            /*
             * 8x16 sprite:
             * bit 0 tile is ignored.
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


            const address =
                (
                    tile * 16 +
                    row * 2
                ) & 0x1FFF;


            const low =
                this.vram[address];


            const high =
                this.vram[
                    address + 1
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
                 * Sprite color 0 = transparent.
                 */

                if (
                    color === 0
                ) {
                    continue;
                }


                /*
                 * Już istniejący sprite ma priorytet.
                 */

                if (
                    this.objPresentLine[screenX]
                ) {
                    continue;
                }


                this.objPresentLine[screenX] =
                    1;

                this.objColorLine[screenX] =
                    color;

                this.objPaletteLine[screenX] =
                    palette;

                this.objPriorityLine[screenX] =
                    behindBG
                        ? 1
                        : 0;
            }
        }
    }


    /*
     * ========================================================
     * COMPOSITE
     * ========================================================
     */

    compositeScanline(y) {

        const base =
            y * 160 * 4;


        for (
            let x = 0;
            x < 160;
            x++
        ) {

            let colorIndex =
                this.bgColorLine[x];


            /*
             * Sprite.
             */

            if (
                this.objPresentLine[x]
            ) {

                const spriteColor =
                    this.objColorLine[x];


                const behind =
                    this.objPriorityLine[x];


                /*
                 * OBJ priority bit:
                 *
                 * sprite jest za BG, jeśli BG
                 * ma niezerowy kolor.
                 */

                if (
                    !behind ||
                    this.bgColorLine[x] === 0
                ) {

                    colorIndex =
                        this.mapOBJColor(
                            spriteColor,
                            this.objPaletteLine[x]
                        );
                }
            }


            /*
             * BG palette.
             */

            if (
                !this.objPresentLine[x] ||
                (
                    this.objPriorityLine[x] &&
                    this.bgColorLine[x] !== 0
                )
            ) {

                colorIndex =
                    this.mapBGColor(
                        this.bgColorLine[x]
                    );
            }


            const shade =
                colorIndex &
                3;


            const rgb =
                this.shadeToRGB(
                    shade
                );


            const offset =
                base +
                x * 4;


            this.frameBuffer[offset] =
                rgb[0];

            this.frameBuffer[offset + 1] =
                rgb[1];

            this.frameBuffer[offset + 2] =
                rgb[2];

            this.frameBuffer[offset + 3] =
                255;
        }
    }


    /*
     * ========================================================
     * PALETTE
     * ========================================================
     */

    mapBGColor(color) {

        return (
            this.bgp >>
            (
                color * 2
            )
        ) & 3;
    }


    mapOBJColor(color, palette) {

        const reg =
            palette === 0
                ? this.obp0
                : this.obp1;


        return (
            reg >>
            (
                color * 2
            )
        ) & 3;
    }


    /*
     * ========================================================
     * DMG SHADES
     * ========================================================
     */

    shadeToRGB(shade) {

        /*
         * Klasyczna paleta DMG.
         *
         * Możesz później zmienić ją na własną.
         */

        switch (
            shade & 3
        ) {

            case 0:
                return [224, 248, 208];

            case 1:
                return [136, 192, 112];

            case 2:
                return [52, 104, 86];

            case 3:
            default:
                return [8, 24, 32];
        }
    }


    /*
     * ========================================================
     * FRAMEBUFFER
     * ========================================================
     */

    clearFrame() {

        for (
            let i = 0;
            i < this.frameBuffer.length;
            i += 4
        ) {

            this.frameBuffer[i] =
                224;

            this.frameBuffer[i + 1] =
                248;

            this.frameBuffer[i + 2] =
                208;

            this.frameBuffer[i + 3] =
                255;
        }


        this.frameReady =
            false;
    }


    presentFrame() {

        if (
            !this.ctx
        ) {
            return;
        }


        if (
            !this.imageData
        ) {

            try {

                this.imageData =
                    this.ctx.createImageData(
                        160,
                        144
                    );

            } catch (e) {

                return;
            }
        }


        this.imageData.data.set(
            this.frameBuffer
        );


        /*
         * Najważniejsze:
         * obraz jest rysowany dopiero po całej
         * ukończonej klatce.
         */

        this.ctx.putImageData(
            this.imageData,
            0,
            0
        );
    }


    /*
     * ========================================================
     * CONSUME FRAME
     * ========================================================
     *
     * emulator.js może używać tego do sprawdzania,
     * czy pojawiła się nowa klatka.
     *
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
     * GET FRAME
     * ========================================================
     */

    getFrameBuffer() {

        return this.frameBuffer;
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
                this.frameCounter,

            lcdEnabled:
                this.lcdEnabled()
        };
    }


    /*
     * ========================================================
     * STATE
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

            frameCounter:
                this.frameCounter,

            windowLine:
                this.windowLine
        };
    }
}
