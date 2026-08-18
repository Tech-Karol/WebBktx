/*
 * ============================================================
 * WebBktx — Game Boy PPU / LCD
 * ============================================================
 *
 * Nintendo Game Boy DMG
 *
 * Resolution:
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
 * ============================================================
 */

export default class GameBoyPPU {

    constructor(memory, canvas) {

        this.memory = memory;

        /*
         * ----------------------------------------------------
         * Display
         * ----------------------------------------------------
         */

        this.width = 160;
        this.height = 144;

        this.canvas = canvas;

        this.ctx =
            canvas.getContext("2d", {
                alpha: false
            });

        this.canvas.width =
            this.width;

        this.canvas.height =
            this.height;


        /*
         * ----------------------------------------------------
         * Image buffer
         * ----------------------------------------------------
         */

        this.imageData =
            this.ctx.createImageData(
                this.width,
                this.height
            );

        this.pixels =
            this.imageData.data;


        /*
         * ----------------------------------------------------
         * Timing
         * ----------------------------------------------------
         *
         * One scanline = 456 T-cycles
         *
         * 154 scanlines:
         *   144 visible
         *   10 VBlank
         *
         * Approx. 59.7 FPS.
         */

        this.cycles = 0;

        this.mode = 2;

        this.ly = 0;


        /*
         * ----------------------------------------------------
         * Palette
         * ----------------------------------------------------
         *
         * DMG grayscale.
         */

        this.palette = [
            [255, 255, 255, 255],
            [192, 192, 192, 255],
            [96, 96, 96, 255],
            [0, 0, 0, 255]
        ];


        /*
         * ----------------------------------------------------
         * Frame state
         * ----------------------------------------------------
         */

        this.frameReady = false;

        this.frameCount = 0;


        /*
         * ----------------------------------------------------
         * LCD state
         * ----------------------------------------------------
         */

        this.lcdEnabled = true;

    }


    /*
     * ========================================================
     * RESET
     * ========================================================
     */

    reset() {

        this.cycles = 0;

        this.mode = 2;

        this.ly = 0;

        this.frameReady = false;

        this.frameCount = 0;

        this.clearScreen();

    }


    /*
     * ========================================================
     * STEP
     * ========================================================
     *
     * cycles = CPU cycles passed
     * ========================================================
     */

    step(cycles = 4) {

        const lcdc =
            this.read(0xFF40);


        /*
         * LCD disabled.
         */

        if (!(lcdc & 0x80)) {

            this.cycles = 0;

            this.ly = 0;

            this.setLY(0);

            this.setMode(0);

            return;

        }


        this.cycles += cycles;


        /*
         * Current PPU mode.
         */

        const newMode =
            this.getModeForCycle();


        if (newMode !== this.mode) {

            this.setMode(
                newMode
            );


            this.onModeChange(
                newMode
            );

        }


        /*
         * Scanline finished.
         */

        if (this.cycles >= 456) {

            this.cycles -= 456;

            this.ly++;


            /*
             * Visible scanlines.
             */

            if (this.ly < 144) {

                this.renderScanline();

            }


            /*
             * Enter VBlank.
             */

            if (this.ly === 144) {

                this.frameReady =
                    true;

                this.frameCount++;


                this.requestInterrupt(
                    0
                );

                this.present();

            }


            /*
             * End of VBlank.
             */

            if (this.ly >= 154) {

                this.ly = 0;

            }


            this.setLY(
                this.ly
            );


            /*
             * LYC coincidence.
             */

            this.updateLYC();

        }

    }


    /*
     * ========================================================
     * PPU MODE
     * ========================================================
     *
     * Mode 0 = HBlank
     * Mode 1 = VBlank
     * Mode 2 = OAM
     * Mode 3 = Drawing
     * ========================================================
     */

    getModeForCycle() {

        if (this.ly >= 144) {

            return 1;

        }


        if (this.cycles < 80) {

            return 2;

        }


        if (this.cycles < 252) {

            return 3;

        }


        return 0;

    }


    setMode(mode) {

        this.mode =
            mode;


        let stat =
            this.read(0xFF41);


        stat =
            (stat & 0xFC) |
            mode;


        this.write(
            0xFF41,
            stat
        );

    }


    onModeChange(mode) {

        const stat =
            this.read(0xFF41);


        /*
         * Mode 0 interrupt.
         */

        if (
            mode === 0 &&
            (stat & 0x08)
        ) {

            this.requestInterrupt(
                1
            );

        }


        /*
         * Mode 1 interrupt.
         */

        if (
            mode === 1 &&
            (stat & 0x10)
        ) {

            this.requestInterrupt(
                1
            );

        }


        /*
         * Mode 2 interrupt.
         */

        if (
            mode === 2 &&
            (stat & 0x20)
        ) {

            this.requestInterrupt(
                1
            );

        }

    }


    /*
     * ========================================================
     * RENDER SCANLINE
     * ========================================================
     */

    renderScanline() {

        const lcdc =
            this.read(0xFF40);


        /*
         * Background
         */

        if (lcdc & 0x01) {

            this.renderBackground();

        } else {

            this.renderBlankBackground();

        }


        /*
         * Window
         */

        if (
            (lcdc & 0x20) &&
            this.ly >= this.read(0xFF4A)
        ) {

            this.renderWindow();

        }


        /*
         * Sprites
         */

        if (lcdc & 0x02) {

            this.renderSprites();

        }

    }


    /*
     * ========================================================
     * BACKGROUND
     * ========================================================
     */

    renderBackground() {

        const lcdc =
            this.read(0xFF40);


        const scy =
            this.read(0xFF42);


        const scx =
            this.read(0xFF43);


        /*
         * Tile map.

         * LCDC bit 3:
         *
         * 0 = 9800
         * 1 = 9C00
         */

        const tileMap =
            (lcdc & 0x08)
                ? 0x9C00
                : 0x9800;


        /*
         * Tile data.

         * LCDC bit 4:
         *
         * 1 = 8000 unsigned
         * 0 = 8800 signed
         */

        const unsignedTiles =
            (lcdc & 0x10) !== 0;


        for (
            let screenX = 0;
            screenX < 160;
            screenX++
        ) {

            const x =
                (screenX + scx) & 0xFF;


            const y =
                (this.ly + scy) & 0xFF;


            const tileX =
                x >> 3;


            const tileY =
                y >> 3;


            const tileAddress =
                tileMap +
                tileY * 32 +
                tileX;


            const tileNumber =
                this.read(
                    tileAddress
                );


            let tileAddressData;


            if (unsignedTiles) {

                tileAddressData =
                    0x8000 +
                    tileNumber * 16;

            } else {

                const signedTile =
                    tileNumber < 128
                        ? tileNumber
                        : tileNumber - 256;


                tileAddressData =
                    0x9000 +
                    signedTile * 16;

            }


            const row =
                y & 7;


            const low =
                this.read(
                    tileAddressData +
                    row * 2
                );


            const high =
                this.read(
                    tileAddressData +
                    row * 2 +
                    1
                );


            const bit =
                7 - (x & 7);


            const color =
                (
                    ((high >> bit) & 1) << 1
                ) |
                ((low >> bit) & 1);


            const shade =
                this.getPaletteColor(
                    0xFF47,
                    color
                );


            this.setPixel(
                screenX,
                this.ly,
                shade
            );

        }

    }


    /*
     * ========================================================
     * BLANK BACKGROUND
     * ========================================================
     */

    renderBlankBackground() {

        for (
            let x = 0;
            x < 160;
            x++
        ) {

            this.setPixel(
                x,
                this.ly,
                0
            );

        }

    }


    /*
     * ========================================================
     * WINDOW
     * ========================================================
     */

    renderWindow() {

        const lcdc =
            this.read(0xFF40);


        const wx =
            this.read(0xFF4B) - 7;


        const wy =
            this.read(0xFF4A);


        const tileMap =
            (lcdc & 0x40)
                ? 0x9C00
                : 0x9800;


        const windowY =
            this.ly - wy;


        if (windowY < 0) {

            return;

        }


        for (
            let screenX = 0;
            screenX < 160;
            screenX++
        ) {

            if (screenX < wx) {

                continue;

            }


            const windowX =
                screenX - wx;


            const tileX =
                windowX >> 3;


            const tileY =
                windowY >> 3;


            const tileAddress =
                tileMap +
                tileY * 32 +
                tileX;


            const tileNumber =
                this.read(
                    tileAddress
                );


            const tileData =
                0x8000 +
                tileNumber * 16;


            const row =
                windowY & 7;


            const low =
                this.read(
                    tileData +
                    row * 2
                );


            const high =
                this.read(
                    tileData +
                    row * 2 +
                    1
                );


            const bit =
                7 - (windowX & 7);


            const color =
                (
                    ((high >> bit) & 1) << 1
                ) |
                ((low >> bit) & 1);


            const shade =
                this.getPaletteColor(
                    0xFF47,
                    color
                );


            this.setPixel(
                screenX,
                this.ly,
                shade
            );

        }

    }


    /*
     * ========================================================
     * SPRITES
     * ========================================================
     */

    renderSprites() {

        const lcdc =
            this.read(0xFF40);


        const spriteHeight =
            (lcdc & 0x04)
                ? 16
                : 8;


        const sprites = [];


        /*
         * Find sprites visible on current line.
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
                this.read(address) - 16;


            const x =
                this.read(address + 1) - 8;


            const tile =
                this.read(address + 2);


            const flags =
                this.read(address + 3);


            if (
                this.ly >= y &&
                this.ly < y + spriteHeight
            ) {

                sprites.push({
                    index: i,
                    x,
                    y,
                    tile,
                    flags
                });

            }


            /*
             * Game Boy can display
             * max 10 sprites per line.
             */

            if (sprites.length >= 10) {

                break;

            }

        }


        /*
         * Sprite priority.
         */

        sprites.sort(
            (a, b) => {

                if (a.x !== b.x) {

                    return a.x - b.x;

                }

                return a.index - b.index;

            }
        );


        /*
         * Draw backwards so earlier sprites
         * have priority.
         */

        for (
            let i = sprites.length - 1;
            i >= 0;
            i--
        ) {

            this.renderSprite(
                sprites[i],
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

        let {
            x,
            y,
            tile,
            flags
        } = sprite;


        /*
         * Sprite palette.

         * Bit 4:
         *
         * 0 = OBP0
         * 1 = OBP1
         */

        const paletteAddress =
            (flags & 0x10)
                ? 0xFF49
                : 0xFF48;


        /*
         * Flip X/Y.
         */

        const flipX =
            (flags & 0x20) !== 0;


        const flipY =
            (flags & 0x40) !== 0;


        /*
         * Background priority.
         */

        const behindBackground =
            (flags & 0x80) !== 0;


        let row =
            this.ly - y;


        if (flipY) {

            row =
                spriteHeight -
                1 -
                row;

        }


        /*
         * 8x16 sprites use two tiles.
         */

        if (spriteHeight === 16) {

            tile &=
                0xFE;

        }


        const tileAddress =
            0x8000 +
            tile * 16 +
            row * 2;


        const low =
            this.read(
                tileAddress
            );


        const high =
            this.read(
                tileAddress + 1
            );


        for (
            let pixel = 0;
            pixel < 8;
            pixel++
        ) {

            let bit =
                pixel;


            if (!flipX) {

                bit =
                    7 - pixel;

            }


            const color =
                (
                    ((high >> bit) & 1) << 1
                ) |
                ((low >> bit) & 1);


            /*
             * Color 0 of sprite is transparent.
             */

            if (color === 0) {

                continue;

            }


            const screenX =
                x + pixel;


            if (
                screenX < 0 ||
                screenX >= 160
            ) {

                continue;

            }


            /*
             * Priority handling.
             *
             * Simplified DMG behaviour:
             * sprite appears behind BG color 1-3.
             */

            if (behindBackground) {

                const bgColor =
                    this.getBackgroundColor(
                        screenX
                    );


                if (bgColor !== 0) {

                    continue;

                }

            }


            const shade =
                this.getPaletteColor(
                    paletteAddress,
                    color
                );


            this.setPixel(
                screenX,
                this.ly,
                shade
            );

        }

    }


    /*
     * ========================================================
     * BACKGROUND COLOR
     * ========================================================
     *
     * Used for sprite priority.
     * ========================================================
     */

    getBackgroundColor(screenX) {

        const lcdc =
            this.read(0xFF40);


        const scy =
            this.read(0xFF42);


        const scx =
            this.read(0xFF43);


        const x =
            (screenX + scx) & 0xFF;


        const y =
            (this.ly + scy) & 0xFF;


        const tileMap =
            (lcdc & 0x08)
                ? 0x9C00
                : 0x9800;


        const tileNumber =
            this.read(
                tileMap +
                (y >> 3) * 32 +
                (x >> 3)
            );


        let tileAddress;


        if (lcdc & 0x10) {

            tileAddress =
                0x8000 +
                tileNumber * 16;

        } else {

            const signed =
                tileNumber < 128
                    ? tileNumber
                    : tileNumber - 256;


            tileAddress =
                0x9000 +
                signed * 16;

        }


        const row =
            y & 7;


        const low =
            this.read(
                tileAddress +
                row * 2
            );


        const high =
            this.read(
                tileAddress +
                row * 2 +
                1
            );


        const bit =
            7 - (x & 7);


        return (
            ((high >> bit) & 1) << 1 |
            ((low >> bit) & 1)
        );

    }


    /*
     * ========================================================
     * PALETTE
     * ========================================================
     */

    getPaletteColor(
        address,
        color
    ) {

        const palette =
            this.read(address);


        const shade =
            (palette >>
                (color * 2)) & 0x03;


        return shade;

    }


    /*
     * ========================================================
     * PIXEL
     * ========================================================
     */

    setPixel(
        x,
        y,
        shade
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


        const color =
            this.palette[
                shade
            ];


        this.pixels[index] =
            color[0];

        this.pixels[index + 1] =
            color[1];

        this.pixels[index + 2] =
            color[2];

        this.pixels[index + 3] =
            color[3];

    }


    /*
     * ========================================================
     * CLEAR SCREEN
     * ========================================================
     */

    clearScreen() {

        for (
            let i = 0;
            i < this.pixels.length;
            i += 4
        ) {

            this.pixels[i] =
                255;

            this.pixels[i + 1] =
                255;

            this.pixels[i + 2] =
                255;

            this.pixels[i + 3] =
                255;

        }


        this.present();

    }


    /*
     * ========================================================
     * PRESENT FRAME
     * ========================================================
     */

    present() {

        this.ctx.putImageData(
            this.imageData,
            0,
            0
        );


        this.frameReady =
            false;

    }


    /*
     * ========================================================
     * LYC
     * ========================================================
     */

    updateLYC() {

        const lyc =
            this.read(0xFF45);


        let stat =
            this.read(0xFF41);


        if (this.ly === lyc) {

            stat |=
                0x04;


            if (stat & 0x40) {

                this.requestInterrupt(
                    1
                );

            }

        } else {

            stat &=
                ~0x04;

        }


        this.write(
            0xFF41,
            stat
        );

    }


    /*
     * ========================================================
     * INTERRUPTS
     * ========================================================
     *
     * IF register:
     *
     * Bit 0 = VBlank
     * Bit 1 = LCD STAT
     * ========================================================
     */

    requestInterrupt(
        bit
    ) {

        const flags =
            this.read(
                0xFF0F
            );


        this.write(
            0xFF0F,
            flags |
            (1 << bit)
        );

    }


    /*
     * ========================================================
     * MEMORY ACCESS
     * ========================================================
     */

    read(address) {

        return this.memory.read(
            address & 0xFFFF
        );

    }


    write(address, value) {

        this.memory.write(
            address & 0xFFFF,
            value & 0xFF
        );

    }


    /*
     * ========================================================
     * DEBUG INFO
     * ========================================================
     */

    getState() {

        return {

            mode:
                this.mode,

            ly:
                this.ly,

            cycles:
                this.cycles,

            frame:
                this.frameCount,

            frameReady:
                this.frameReady,

            lcdEnabled:
                this.lcdEnabled

        };

    }

}
