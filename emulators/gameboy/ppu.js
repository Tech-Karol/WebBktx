/*
 * ============================================================
 * WebBktx Game Boy — PPU
 * DMG-compatible baseline PPU
 * ============================================================
 */

export default class PPU {

    constructor(canvas = null) {

        this.canvas = canvas;
        this.ctx = null;

        if (canvas) {
            this.connectCanvas(canvas);
        }

        // -----------------------------------------------------
        // Game Boy screen
        // -----------------------------------------------------

        this.WIDTH = 160;
        this.HEIGHT = 144;

        this.framebuffer =
            new Uint8Array(
                this.WIDTH * this.HEIGHT
            );

        this.imageData = null;

        // DMG palette
        this.palette = [
            0xFF,
            0xAA,
            0x55,
            0x00
        ];

        // -----------------------------------------------------
        // VRAM / OAM
        // -----------------------------------------------------

        this.vram =
            new Uint8Array(0x2000);

        this.oam =
            new Uint8Array(0xA0);

        // -----------------------------------------------------
        // LCD registers
        // -----------------------------------------------------

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

        // -----------------------------------------------------
        // Timing
        // -----------------------------------------------------

        this.mode = 2;

        this.modeCycles = 0;

        this.frameReady = false;

        this.frameCounter = 0;

        this.windowLine = 0;

        this.lcdWasEnabled = false;

        // -----------------------------------------------------
        // Interrupt callback
        // -----------------------------------------------------

        this.interruptCallback = null;

        // -----------------------------------------------------
        // Debug
        // -----------------------------------------------------

        this.enabled = true;
    }


    /*
     * ========================================================
     * CANVAS
     * ========================================================
     */

    connectCanvas(canvas) {

        this.canvas = canvas;

        this.ctx =
            canvas.getContext("2d", {
                alpha: false
            });

        if (this.ctx) {

            this.imageData =
                this.ctx.createImageData(
                    this.WIDTH,
                    this.HEIGHT
                );

            this.clearScreen();
        }
    }


    setInterruptCallback(callback) {

        this.interruptCallback =
            callback;
    }


    /*
     * ========================================================
     * LCD ENABLE
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
        this.modeCycles = 0;

        this.frameReady = false;

        this.frameCounter = 0;

        this.windowLine = 0;

        this.vram.fill(0);
        this.oam.fill(0);

        this.clearScreen();
    }


    /*
     * ========================================================
     * CLEAR
     * ========================================================
     */

    clearScreen() {

        this.framebuffer.fill(0);

        if (!this.imageData) {
            return;
        }

        for (
            let i = 0;
            i < this.imageData.data.length;
            i += 4
        ) {

            this.imageData.data[i] =
                255;

            this.imageData.data[i + 1] =
                255;

            this.imageData.data[i + 2] =
                255;

            this.imageData.data[i + 3] =
                255;
        }

        this.present();
    }


    /*
     * ========================================================
     * PPU STEP
     * ========================================================
     *
     * Emulator may call this with:
     *
     * ppu.step(cycles)
     *
     * or:
     *
     * ppu.step()
     *
     * ========================================================
     */

    step(cycles = 4) {

        cycles |= 0;

        if (cycles <= 0) {
            cycles = 4;
        }

        if (!this.lcdEnabled()) {

            this.mode = 0;
            this.modeCycles = 0;
            this.ly = 0;
            this.frameReady = false;

            return;
        }

        this.modeCycles += cycles;

        while (true) {

            const limit =
                this.getModeCycles();

            if (
                this.modeCycles < limit
            ) {
                break;
            }

            this.modeCycles -= limit;

            this.advanceMode();
        }
    }


    /*
     * ========================================================
     * MODE TIMING
     * ========================================================
     */

    getModeCycles() {

        switch (this.mode) {

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

        switch (this.mode) {

            // -----------------------------------------------
            // OAM
            // -----------------------------------------------

            case 2:

                this.mode = 3;

                this.updateSTAT();

                break;


            // -----------------------------------------------
            // VRAM
            // -----------------------------------------------

            case 3:

                this.mode = 0;

                this.renderScanline();

                this.updateSTAT();

                break;


            // -----------------------------------------------
            // HBLANK
            // -----------------------------------------------

            case 0:

                this.ly++;

                if (this.ly === 144) {

                    this.mode = 1;

                    this.frameReady = true;

                    this.frameCounter++;

                    this.present();

                    this.requestInterrupt(0);

                } else {

                    this.mode = 2;
                }

                this.updateLYC();
                this.updateSTAT();

                break;


            // -----------------------------------------------
            // VBLANK
            // -----------------------------------------------

            case 1:

                this.ly++;

                if (this.ly > 153) {

                    this.ly = 0;

                    this.windowLine = 0;

                    this.mode = 2;

                    this.updateLYC();
                    this.updateSTAT();

                } else {

                    this.updateLYC();
                    this.updateSTAT();
                }

                break;
        }
    }


    /*
     * ========================================================
     * STAT
     * ========================================================
     */

    updateSTAT() {

        this.stat &= 0xFC;

        this.stat |=
            this.mode & 3;

        if (this.ly === this.lyc) {

            this.stat |= 0x04;

        } else {

            this.stat &= ~0x04;
        }

        // STAT interrupts

        let interrupt = false;

        if (
            this.mode === 0 &&
            (this.stat & 0x08)
        ) {
            interrupt = true;
        }

        if (
            this.mode === 1 &&
            (this.stat & 0x10)
        ) {
            interrupt = true;
        }

        if (
            this.mode === 2 &&
            (this.stat & 0x20)
        ) {
            interrupt = true;
        }

        if (
            this.ly === this.lyc &&
            (this.stat & 0x40)
        ) {
            interrupt = true;
        }

        if (interrupt) {

            this.requestInterrupt(1);
        }
    }


    updateLYC() {

        if (this.ly === this.lyc) {

            this.stat |= 0x04;

        } else {

            this.stat &= ~0x04;
        }
    }


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
     * VRAM ACCESS
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
     * OAM ACCESS
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
     * LCD REGISTERS
     * ========================================================
     */

    readRegister(address) {

        address &= 0xFF;

        switch (address) {

            case 0x40:
                return this.lcdc;

            case 0x41:
                return (
                    this.stat |
                    0x80
                );

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

            case 0x40:

                this.writeLCDC(value);

                break;

            case 0x41:

                this.stat =
                    (
                        this.stat &
                        0x07
                    ) |
                    (
                        value &
                        0x78
                    );

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

                // LY is read-only
                break;

            case 0x45:

                this.lyc =
                    value;

                this.updateLYC();

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


    /*
     * ========================================================
     * LCDC
     * ========================================================
     */

    writeLCDC(value) {

        const old =
            this.lcdEnabled();

        this.lcdc =
            value & 0xFF;

        const enabled =
            this.lcdEnabled();

        if (
            !old &&
            enabled
        ) {

            this.mode = 2;
            this.modeCycles = 0;
            this.ly = 0;
            this.windowLine = 0;

            this.updateLYC();
            this.updateSTAT();

        } else if (
            old &&
            !enabled
        ) {

            this.mode = 0;
            this.modeCycles = 0;
            this.ly = 0;

            this.frameReady = false;

            this.clearScreen();
        }
    }


    /*
     * ========================================================
     * SCANLINE RENDERER
     * ========================================================
     */

    renderScanline() {

        if (
            this.ly >= 144
        ) {
            return;
        }

        // First render BG/window.
        this.renderBackground();

        // Then sprites.
        this.renderSprites();
    }


    /*
     * ========================================================
     * BACKGROUND
     * ========================================================
     */

    renderBackground() {

        const bgEnabled =
            Boolean(
                this.lcdc & 0x01
            );

        if (!bgEnabled) {

            const color =
                this.paletteColor(
                    this.bgp,
                    0
                );

            const base =
                this.ly *
                this.WIDTH;

            for (
                let x = 0;
                x < this.WIDTH;
                x++
            ) {

                this.framebuffer[
                    base + x
                ] =
                    color;
            }

            return;
        }

        const tileMapBase =
            (
                this.lcdc & 0x08
            )
                ? 0x1C00
                : 0x1800;

        const unsignedTiles =
            Boolean(
                this.lcdc & 0x10
            );

        const y =
            (
                this.scy +
                this.ly
            ) & 0xFF;

        const tileY =
            y >> 3;

        const row =
            y & 7;

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

        const windowActive =
            windowEnabled &&
            this.ly >= this.wy &&
            this.wx <= 166;

        const base =
            this.ly *
            this.WIDTH;

        let usedWindow =
            false;

        for (
            let screenX = 0;
            screenX < this.WIDTH;
            screenX++
        ) {

            let px;
            let py;
            let mapBase;

            if (
                windowActive &&
                screenX >=
                this.wx - 7
            ) {

                px =
                    screenX -
                    (this.wx - 7);

                py =
                    this.windowLine;

                mapBase =
                    windowMapBase;

                usedWindow = true;

            } else {

                px =
                    (
                        this.scx +
                        screenX
                    ) & 0xFF;

                py =
                    y;

                mapBase =
                    tileMapBase;
            }

            const tileX =
                px >> 3;

            const tileRow =
                py >> 3;

            const tileIndexAddress =
                mapBase +
                tileRow * 32 +
                tileX;

            const tileNumber =
                this.vram[
                    tileIndexAddress &
                    0x1FFF
                ];

            let tileAddress;

            if (
                unsignedTiles
            ) {

                tileAddress =
                    tileNumber *
                    16;

            } else {

                const signedTile =
                    tileNumber < 128
                        ? tileNumber
                        : tileNumber - 256;

                tileAddress =
                    0x1000 +
                    signedTile * 16;
            }

            const tileRowAddress =
                (
                    tileAddress +
                    (
                        py & 7
                    ) * 2
                ) & 0x1FFF;

            const lo =
                this.vram[
                    tileRowAddress
                ];

            const hi =
                this.vram[
                    (
                        tileRowAddress + 1
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
                        hi >> bit
                    ) & 1
                ) << 1 |
                (
                    lo >> bit
                ) & 1;

            this.framebuffer[
                base + screenX
            ] =
                this.paletteColor(
                    this.bgp,
                    color
                );
        }

        if (usedWindow) {

            this.windowLine++;
        }
    }


    /*
     * ========================================================
     * SPRITES
     * ========================================================
     */

    renderSprites() {

        if (
            !(this.lcdc & 0x02)
        ) {
            return;
        }

        const spriteHeight =
            (
                this.lcdc & 0x04
            )
                ? 16
                : 8;

        /*
         * Game Boy has max 10 sprites per line.
         */

        const visible = [];

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

            const attr =
                this.oam[base + 3];

            if (
                this.ly <
                y ||
                this.ly >=
                y + spriteHeight
            ) {
                continue;
            }

            visible.push({
                index: i,
                x,
                y,
                tile,
                attr
            });

            if (
                visible.length >= 10
            ) {
                break;
            }
        }

        /*
         * DMG priority:
         * smaller X first, then lower OAM index.
         *
         * Draw reverse so higher priority ends up visible.
         */

        visible.sort(
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
            const sprite of visible
        ) {

            this.renderSprite(
                sprite,
                spriteHeight
            );
        }
    }


    renderSprite(
        sprite,
        spriteHeight
    ) {

        let tile =
            sprite.tile;

        if (
            spriteHeight === 16
        ) {

            tile &=
                0xFE;
        }

        let row =
            this.ly -
            sprite.y;

        const yFlip =
            Boolean(
                sprite.attr & 0x40
            );

        if (yFlip) {

            row =
                spriteHeight -
                1 -
                row;
        }

        const tileRow =
            row >= 8
                ? tile + 1
                : tile;

        const rowInTile =
            row & 7;

        const address =
            tileRow *
            16 +
            rowInTile *
            2;

        const lo =
            this.vram[
                address &
                0x1FFF
            ];

        const hi =
            this.vram[
                (
                    address + 1
                ) &
                0x1FFF
            ];

        const xFlip =
            Boolean(
                sprite.attr & 0x20
            );

        const palette =
            (
                sprite.attr & 0x10
            )
                ? this.obp1
                : this.obp0;

        const behindBG =
            Boolean(
                sprite.attr & 0x80
            );

        for (
            let px = 0;
            px < 8;
            px++
        ) {

            let bit =
                xFlip
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

            const screenX =
                sprite.x +
                px;

            if (
                screenX < 0 ||
                screenX >=
                this.WIDTH
            ) {
                continue;
            }

            const index =
                this.ly *
                this.WIDTH +
                screenX;

            /*
             * Sprite priority against BG.
             */

            if (
                behindBG &&
                this.framebuffer[index] !==
                this.paletteColor(
                    this.bgp,
                    0
                )
            ) {
                continue;
            }

            this.framebuffer[index] =
                this.paletteColor(
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

    paletteColor(
        palette,
        color
    ) {

        return (
            palette >>
            (
                color * 2
            )
        ) & 3;
    }


    /*
     * ========================================================
     * FRAME PRESENT
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

            const shade =
                this.palette[
                    this.framebuffer[i] & 3
                ];

            const p =
                i * 4;

            data[p] =
                shade;

            data[p + 1] =
                shade;

            data[p + 2] =
                shade;

            data[p + 3] =
                255;
        }

        this.ctx.putImageData(
            this.imageData,
            0,
            0
        );
    }


    /*
     * ========================================================
     * FRAME CONSUMPTION
     * ========================================================
     *
     * emulator.js expects this.
     *
     * Returns true once per completed frame.
     * ========================================================
     */

    consumeFrame() {

        if (
            this.frameReady
        ) {

            this.frameReady =
                false;

            return true;
        }

        return false;
    }


    /*
     * ========================================================
     * DEBUG INFO
     * ========================================================
     */

    getInfo() {

        return {

            lcdc:
                this.lcdc,

            stat:
                this.stat,

            ly:
                this.ly,

            lyc:
                this.lyc,

            scx:
                this.scx,

            scy:
                this.scy,

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

            frame:
                this.frameCounter,

            lcdEnabled:
                this.lcdEnabled()
        };
    }
}
