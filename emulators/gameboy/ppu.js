/*
 * ============================================================
 * WebBktx Game Boy — PPU
 * Compatible with current emulator.js + memory.js
 * ============================================================
 *
 * Game Boy DMG-compatible LCD controller / PPU.
 *
 * Important compatibility API:
 *
 *   lcdEnabled()
 *   connectCanvas()
 *   consumeFrame()
 *   step()
 *   advanceMode()
 *   renderScanline()
 *   readRegister()
 *   writeRegister()
 *   readVRAM()
 *   writeVRAM()
 *   readOAM()
 *   writeOAM()
 *
 * ============================================================
 */

export default class PPU {

    constructor(canvas = null) {

        /*
         * ----------------------------------------------------
         * Canvas
         * ----------------------------------------------------
         */

        this.canvas = null;
        this.ctx = null;

        this.connectCanvas(canvas);


        /*
         * ----------------------------------------------------
         * Screen
         * ----------------------------------------------------
         */

        this.WIDTH = 160;
        this.HEIGHT = 144;

        this.imageData = null;

        this.frameReady = false;

        this.frameCounter = 0;


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

        this.dot = 0;

        this.frameCycles = 0;


        /*
         * ----------------------------------------------------
         * Interrupt state
         * ----------------------------------------------------
         */

        this.interruptFlags = 0;

        this.vblankInterrupt = false;
        this.statInterrupt = false;


        /*
         * ----------------------------------------------------
         * Internal flags
         * ----------------------------------------------------
         */

        this.windowLine = 0;

        this.windowActiveThisLine = false;

        this.statLine = false;


        /*
         * ----------------------------------------------------
         * Frame buffer
         * ----------------------------------------------------
         */

        this.framebuffer =
            new Uint8ClampedArray(
                this.WIDTH *
                this.HEIGHT *
                4
            );


        /*
         * ----------------------------------------------------
         * Initialize framebuffer
         * ----------------------------------------------------
         */

        this.clearFrame();


        /*
         * ----------------------------------------------------
         * Initial LCD state
         * ----------------------------------------------------
         */

        this.updateCoincidence();

        this.updateSTATLine();


        this.log(
            "PPU gotowe."
        );

    }


    /*
     * ========================================================
     * LOG
     * ========================================================
     */

    log(message) {

        if (
            typeof console !== "undefined"
        ) {

            console.log(
                "[WebBktx PPU] " +
                message
            );

        }

    }


    /*
     * ========================================================
     * CANVAS
     * ========================================================
     */

    connectCanvas(canvas = null) {

        /*
         * Already connected.
         */

        if (
            this.ctx &&
            this.canvas
        ) {

            return true;

        }


        /*
         * No canvas supplied.
         *
         * Try common browser lookup methods.
         */

        let target =
            canvas;


        /*
         * If an object was supplied but it isn't
         * an actual canvas, try common wrappers.
         */

        if (
            target &&
            typeof target.getContext !== "function"
        ) {

            if (
                target.canvas &&
                typeof target.canvas.getContext === "function"
            ) {

                target =
                    target.canvas;

            } else if (
                target[0] &&
                typeof target[0].getContext === "function"
            ) {

                target =
                    target[0];

            } else {

                target =
                    null;

            }

        }


        /*
         * If a string was supplied, treat it as
         * an element ID.
         */

        if (
            typeof canvas === "string"
        ) {

            if (
                typeof document !== "undefined"
            ) {

                const element =
                    document.getElementById(
                        canvas
                    );

                if (
                    element &&
                    typeof element.getContext === "function"
                ) {

                    target =
                        element;

                }

            }

        }


        /*
         * Automatic canvas discovery.
         */

        if (
            !target &&
            typeof document !== "undefined"
        ) {

            target =
                document.querySelector(
                    "canvas"
                );

        }


        /*
         * Nothing available.
         *
         * PPU still works headless.
         */

        if (
            !target ||
            typeof target.getContext !== "function"
        ) {

            this.canvas = null;
            this.ctx = null;

            this.log(
                "Brak poprawnego canvas — tryb headless."
            );

            return false;

        }


        this.canvas =
            target;


        try {

            this.ctx =
                target.getContext(
                    "2d",
                    {
                        alpha: false
                    }
                );

        } catch (
            error
        ) {

            /*
             * Some browsers don't accept the
             * options object.
             */

            this.ctx =
                target.getContext(
                    "2d"
                );

        }


        if (
            !this.ctx
        ) {

            this.canvas = null;

            this.log(
                "Nie udało się uzyskać kontekstu 2D."
            );

            return false;

        }


        /*
         * Native resolution.
         */

        target.width =
            this.WIDTH;

        target.height =
            this.HEIGHT;


        /*
         * Disable smoothing for pixel art.
         */

        this.ctx.imageSmoothingEnabled =
            false;


        /*
         * Create ImageData.
         */

        try {

            this.imageData =
                this.ctx.createImageData(
                    this.WIDTH,
                    this.HEIGHT
                );

        } catch (
            error
        ) {

            this.imageData =
                null;

        }


        this.log(
            "Canvas podłączony."
        );


        return true;

    }


    /*
     * ========================================================
     * LCD ENABLE
     * ========================================================
     *
     * memory.js expects this to be a function.
     *
     * ========================================================
     */

    lcdEnabled() {

        return (
            (
                this.lcdc &
                0x80
            ) !== 0
        );

    }


    /*
     * Compatibility alias.
     */

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

        this.modeClock = 0;

        this.dot = 0;

        this.frameCycles = 0;

        this.windowLine = 0;

        this.windowActiveThisLine = false;

        this.statLine = false;

        this.frameReady = false;

        this.frameCounter = 0;

        this.interruptFlags = 0;

        this.vblankInterrupt = false;

        this.statInterrupt = false;

        this.clearFrame();

        this.updateCoincidence();

        this.updateSTATLine();

    }


    /*
     * ========================================================
     * CLEAR FRAME
     * ========================================================
     */

    clearFrame() {

        const buffer =
            this.framebuffer;


        for (
            let i = 0;
            i < buffer.length;
            i += 4
        ) {

            buffer[i] = 255;
            buffer[i + 1] = 255;
            buffer[i + 2] = 255;
            buffer[i + 3] = 255;

        }

    }


    /*
     * ========================================================
     * REGISTER READ
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


    /*
     * ========================================================
     * REGISTER WRITE
     * ========================================================
     *
     * IMPORTANT:
     * This function NEVER writes back through memory.writeByte().
     * That prevents the previous recursion:
     *
     * PPU -> memory -> PPU -> memory -> ...
     *
     * ========================================================
     */

    writeRegister(
        address,
        value
    ) {

        address &= 0xFF;
        value &= 0xFF;


        switch (
            address
        ) {

            /*
             * LCDC
             */

            case 0x40: {

                const old =
                    this.lcdc;

                this.lcdc =
                    value;


                /*
                 * LCD was disabled.
                 */

                if (
                    (
                        old & 0x80
                    ) &&
                    !(
                        value & 0x80
                    )
                ) {

                    this.disableLCD();

                }


                /*
                 * LCD was enabled.
                 */

                if (
                    !(
                        old & 0x80
                    ) &&
                    (
                        value & 0x80
                    )
                ) {

                    this.enableLCD();

                }

                break;

            }


            /*
             * STAT
             */

            case 0x41:

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

                this.updateSTATLine();

                break;


            /*
             * SCY
             */

            case 0x42:

                this.scy =
                    value;

                break;


            /*
             * SCX
             */

            case 0x43:

                this.scx =
                    value;

                break;


            /*
             * LY is read-only.
             */

            case 0x44:

                /*
                 * Hardware ignores writes.
                 */

                break;


            /*
             * LYC
             */

            case 0x45:

                this.lyc =
                    value;

                this.updateCoincidence();

                this.updateSTATLine();

                break;


            /*
             * DMA.
             *
             * Actual DMA is normally handled by memory.js.
             * Do not recurse into memory here.
             */

            case 0x46:

                break;


            /*
             * BGP
             */

            case 0x47:

                this.bgp =
                    value;

                break;


            /*
             * OBP0
             */

            case 0x48:

                this.obp0 =
                    value;

                break;


            /*
             * OBP1
             */

            case 0x49:

                this.obp1 =
                    value;

                break;


            /*
             * WY
             */

            case 0x4A:

                this.wy =
                    value;

                break;


            /*
             * WX
             */

            case 0x4B:

                this.wx =
                    value;

                break;

        }

    }


    /*
     * ========================================================
     * VRAM
     * ========================================================
     */

    readVRAM(address) {

        return this.vram[
            address & 0x1FFF
        ];

    }


    writeVRAM(
        address,
        value
    ) {

        this.vram[
            address & 0x1FFF
        ] =
            value & 0xFF;

    }


    /*
     * ========================================================
     * OAM
     * ========================================================
     */

    readOAM(address) {

        return this.oam[
            address & 0x9F
        ];

    }


    writeOAM(
        address,
        value
    ) {

        this.oam[
            address & 0x9F
        ] =
            value & 0xFF;

    }


    /*
     * ========================================================
     * LCD ON/OFF
     * ========================================================
     */

    disableLCD() {

        this.mode =
            0;

        this.modeClock =
            0;

        this.ly =
            0;

        this.windowLine =
            0;

        this.windowActiveThisLine =
            false;

        this.stat &=
            0xFC;

        this.frameReady =
            false;

        this.clearFrame();

    }


    enableLCD() {

        this.mode =
            2;

        this.modeClock =
            0;

        this.ly =
            0;

        this.windowLine =
            0;

        this.windowActiveThisLine =
            false;

        this.updateCoincidence();

        this.updateSTATLine();

    }


    /*
     * ========================================================
     * STEP
     * ========================================================
     *
     * cycles = CPU cycles.
     *
     * DMG LCD:
     *
     * mode 2 = 80 cycles
     * mode 3 = 172 cycles
     * mode 0 = 204 cycles
     * line   = 456 cycles
     *
     * visible lines 0-143
     * VBlank lines 144-153
     *
     * ========================================================
     */

    step(
        cycles = 4
    ) {

        cycles |= 0;


        if (
            cycles <= 0
        ) {

            return;

        }


        /*
         * LCD disabled.
         */

        if (
            !this.lcdEnabled()
        ) {

            return;

        }


        this.modeClock +=
            cycles;

        this.frameCycles +=
            cycles;


        /*
         * Handle multiple transitions.
         */

        while (
            true
        ) {

            const limit =
                this.getModeLimit();


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
     * MODE LIMIT
     * ========================================================
     */

    getModeLimit() {

        switch (
            this.mode
        ) {

            case 0:
                return 204;

            case 1:
                return 456;

            case 2:
                return 80;

            case 3:
                return 172;

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

        switch (
            this.mode
        ) {

            /*
             * ------------------------------------------------
             * HBlank -> next line
             * ------------------------------------------------
             */

            case 0:

                this.ly =
                    (
                        this.ly + 1
                    ) & 0xFF;


                if (
                    this.ly === 144
                ) {

                    /*
                     * Enter VBlank.
                     */

                    this.mode =
                        1;

                    this.requestVBlank();

                } else {

                    this.mode =
                        2;

                }


                this.updateCoincidence();

                this.updateSTATLine();

                break;


            /*
             * ------------------------------------------------
             * VBlank
             * ------------------------------------------------
             */

            case 1:

                this.ly =
                    (
                        this.ly + 1
                    ) & 0xFF;


                if (
                    this.ly > 153
                ) {

                    this.ly =
                        0;

                    this.mode =
                        2;

                    this.windowLine =
                        0;

                    this.frameCounter++;

                    this.frameReady =
                        true;

                    this.presentFrame();

                }


                this.updateCoincidence();

                this.updateSTATLine();

                break;


            /*
             * ------------------------------------------------
             * OAM
             * ------------------------------------------------
             */

            case 2:

                this.mode =
                    3;

                this.updateSTATLine();

                break;


            /*
             * ------------------------------------------------
             * Drawing -> HBlank
             * ------------------------------------------------
             */

            case 3:

                this.renderScanline();

                this.mode =
                    0;

                this.updateSTATLine();

                break;

        }

    }


    /*
     * ========================================================
     * COMPATIBILITY RENDER METHOD
     * ========================================================
     */

    renderScanline() {

        const line =
            this.ly;

        if (
            line < 0 ||
            line >= this.HEIGHT
        ) {

            return;

        }


        /*
         * LCD disabled.
         */

        if (
            !this.lcdEnabled()
        ) {

            return;

        }


        this.windowActiveThisLine =
            false;


        /*
         * Draw background.
         */

        this.renderBackground(
            line
        );


        /*
         * Draw window.
         */

        this.renderWindow(
            line
        );


        /*
         * Draw sprites.
         */

        this.renderSprites(
            line
        );

    }


    /*
     * ========================================================
     * BACKGROUND
     * ========================================================
     */

    renderBackground(
        line
    ) {

        const bgEnabled =
            (
                this.lcdc &
                0x01
            ) !== 0;


        /*
         * On DMG, when BG is disabled, color 0
         * is effectively used.
         */

        if (
            !bgEnabled
        ) {

            for (
                let x = 0;
                x < 160;
                x++
            ) {

                this.putShade(
                    x,
                    line,
                    0
                );

            }

            return;

        }


        const mapBase =
            (
                this.lcdc &
                0x08
            )
                ? 0x1C00
                : 0x1800;


        const tileUnsigned =
            (
                this.lcdc &
                0x10
            ) !== 0;


        const y =
            (
                line +
                this.scy
            ) & 0xFF;


        const tileRow =
            (
                y >> 3
            ) & 31;


        const pixelY =
            y & 7;


        for (
            let screenX = 0;
            screenX < 160;
            screenX++
        ) {

            const x =
                (
                    screenX +
                    this.scx
                ) & 0xFF;


            const tileColumn =
                (
                    x >> 3
                ) & 31;


            const mapAddress =
                mapBase +
                tileRow * 32 +
                tileColumn;


            const tile =
                this.vram[
                    mapAddress &
                    0x1FFF
                ];


            let tileAddress;


            if (
                tileUnsigned
            ) {

                tileAddress =
                    tile * 16;

            } else {

                /*
                 * Signed tile index:
                 *
                 * 0x80..0xFF = -128..-1
                 */

                const signed =
                    tile < 0x80
                        ? tile
                        : tile - 0x100;


                tileAddress =
                    0x1000 +
                    signed * 16;

            }


            const rowAddress =
                (
                    tileAddress +
                    pixelY * 2
                ) & 0x1FFF;


            const lo =
                this.vram[
                    rowAddress
                ];


            const hi =
                this.vram[
                    (
                        rowAddress + 1
                    ) & 0x1FFF
                ];


            const bit =
                7 -
                (
                    x & 7
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


            this.putShade(
                screenX,
                line,
                this.paletteColor(
                    this.bgp,
                    color
                )
            );

        }

    }


    /*
     * ========================================================
     * WINDOW
     * ========================================================
     */

    renderWindow(
        line
    ) {

        const windowEnabled =
            (
                this.lcdc &
                0x20
            ) !== 0;


        if (
            !windowEnabled
        ) {

            return;

        }


        if (
            line <
            this.wy
        ) {

            return;

        }


        /*
         * WX is offset by 7.
         */

        const windowX =
            this.wx - 7;


        if (
            windowX >= 160
        ) {

            return;

        }


        this.windowActiveThisLine =
            true;


        const mapBase =
            (
                this.lcdc &
                0x40
            )
                ? 0x1C00
                : 0x1800;


        const tileUnsigned =
            (
                this.lcdc &
                0x10
            ) !== 0;


        const y =
            this.windowLine;


        const tileRow =
            (
                y >> 3
            ) & 31;


        const pixelY =
            y & 7;


        for (
            let screenX =
                Math.max(
                    0,
                    windowX
                );

            screenX < 160;

            screenX++
        ) {

            const wxPixel =
                screenX -
                windowX;


            const tileColumn =
                (
                    wxPixel >> 3
                ) & 31;


            const mapAddress =
                mapBase +
                tileRow * 32 +
                tileColumn;


            const tile =
                this.vram[
                    mapAddress &
                    0x1FFF
                ];


            let tileAddress;


            if (
                tileUnsigned
            ) {

                tileAddress =
                    tile * 16;

            } else {

                const signed =
                    tile < 0x80
                        ? tile
                        : tile - 0x100;


                tileAddress =
                    0x1000 +
                    signed * 16;

            }


            const rowAddress =
                (
                    tileAddress +
                    pixelY * 2
                ) & 0x1FFF;


            const lo =
                this.vram[
                    rowAddress
                ];


            const hi =
                this.vram[
                    (
                        rowAddress + 1
                    ) & 0x1FFF
                ];


            const bit =
                7 -
                (
                    wxPixel & 7
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


            this.putShade(
                screenX,
                line,
                this.paletteColor(
                    this.bgp,
                    color
                )
            );

        }


        /*
         * The window line advances only when
         * the window actually appears.
         */

        this.windowLine++;

    }


    /*
     * ========================================================
     * SPRITES
     * ========================================================
     */

    renderSprites(
        line
    ) {

        if (
            !(
                this.lcdc &
                0x02
            )
        ) {

            return;

        }


        const large =
            (
                this.lcdc &
                0x04
            ) !== 0;


        const spriteHeight =
            large
                ? 16
                : 8;


        const sprites = [];


        /*
         * Find up to 10 sprites on this line.
         */

        for (
            let i = 0;

            i < 40 &&
            sprites.length < 10;

            i++
        ) {

            const base =
                i * 4;


            const y =
                this.oam[
                    base
                ] - 16;


            const x =
                this.oam[
                    base + 1
                ] - 8;


            if (
                line >= y &&
                line <
                y + spriteHeight
            ) {

                sprites.push({
                    index: i,
                    x: x,
                    y: y,
                    tile:
                        this.oam[
                            base + 2
                        ],
                    attr:
                        this.oam[
                            base + 3
                        ]
                });

            }

        }


        /*
         * DMG priority:
         * lower X wins; then lower OAM index.
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

                    return a.x -
                        b.x;

                }

                return a.index -
                    b.index;

            }
        );


        /*
         * Draw from lowest priority toward highest
         * so the later/high-priority sprite remains visible.
         */

        for (
            let s = sprites.length - 1;
            s >= 0;
            s--
        ) {

            const sprite =
                sprites[s];


            let tile =
                sprite.tile;


            let row =
                line -
                sprite.y;


            const attr =
                sprite.attr;


            const flipY =
                (
                    attr &
                    0x40
                ) !== 0;


            const flipX =
                (
                    attr &
                    0x20
                ) !== 0;


            const behindBG =
                (
                    attr &
                    0x80
                ) !== 0;


            const palette =
                (
                    attr &
                    0x10
                )
                    ? this.obp1
                    : this.obp0;


            if (
                flipY
            ) {

                row =
                    spriteHeight -
                    1 -
                    row;

            }


            if (
                large
            ) {

                tile &= 0xFE;

                if (
                    row >= 8
                ) {

                    tile++;

                }

            }


            const tileRow =
                row & 7;


            const address =
                (
                    tile * 16 +
                    tileRow * 2
                ) & 0x1FFF;


            const lo =
                this.vram[
                    address
                ];


            const hi =
                this.vram[
                    (
                        address + 1
                    ) & 0x1FFF
                ];


            for (
                let px = 0;
                px < 8;
                px++
            ) {

                let bit =
                    px;


                if (
                    !flipX
                ) {

                    bit =
                        7 - px;

                }


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
                 * Sprite color 0 is transparent.
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
                 * OBJ-to-BG priority.
                 *
                 * Color 0 background is not obstructive.
                 */

                if (
                    behindBG &&
                    this.getBackgroundColor(
                        screenX,
                        line
                    ) !== 0
                ) {

                    continue;

                }


                this.putShade(
                    screenX,
                    line,
                    this.paletteColor(
                        palette,
                        color
                    )
                );

            }

        }

    }


    /*
     * ========================================================
     * GET BACKGROUND COLOR
     * ========================================================
     *
     * Used for sprite priority.
     *
     * ========================================================
     */

    getBackgroundColor(
        screenX,
        line
    ) {

        const y =
            (
                line +
                this.scy
            ) & 0xFF;


        const x =
            (
                screenX +
                this.scx
            ) & 0xFF;


        const mapBase =
            (
                this.lcdc &
                0x08
            )
                ? 0x1C00
                : 0x1800;


        const tileUnsigned =
            (
                this.lcdc &
                0x10
            ) !== 0;


        const tileRow =
            (
                y >> 3
            ) & 31;


        const tileColumn =
            (
                x >> 3
            ) & 31;


        const tile =
            this.vram[
                (
                    mapBase +
                    tileRow * 32 +
                    tileColumn
                ) & 0x1FFF
            ];


        let tileAddress;


        if (
            tileUnsigned
        ) {

            tileAddress =
                tile * 16;

        } else {

            const signed =
                tile < 0x80
                    ? tile
                    : tile - 0x100;


            tileAddress =
                0x1000 +
                signed * 16;

        }


        const rowAddress =
            (
                tileAddress +
                (
                    y & 7
                ) * 2
            ) & 0x1FFF;


        const lo =
            this.vram[
                rowAddress
            ];


        const hi =
            this.vram[
                (
                    rowAddress + 1
                ) & 0x1FFF
            ];


        const bit =
            7 -
            (
                x & 7
            );


        return (
            (
                (
                    hi >> bit
                ) & 1
            ) << 1
        ) |
        (
            lo >> bit
        ) & 1;

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
     * PUT SHADE
     * ========================================================
     */

    putShade(
        x,
        y,
        shade
    ) {

        if (
            x < 0 ||
            x >= 160 ||
            y < 0 ||
            y >= 144
        ) {

            return;

        }


        /*
         * DMG grayscale.
         *
         * 0 = white
         * 1 = light gray
         * 2 = dark gray
         * 3 = black
         */

        const value =
            [
                255,
                192,
                96,
                0
            ][
                shade & 3
            ];


        const index =
            (
                y * 160 +
                x
            ) * 4;


        this.framebuffer[
            index
        ] = value;


        this.framebuffer[
            index + 1
        ] = value;


        this.framebuffer[
            index + 2
        ] = value;


        this.framebuffer[
            index + 3
        ] = 255;

    }


    /*
     * ========================================================
     * PRESENT FRAME
     * ========================================================
     */

    presentFrame() {

        if (
            !this.ctx
        ) {

            return;

        }


        try {

            if (
                this.imageData &&
                this.imageData.data &&
                this.imageData.data.length ===
                this.framebuffer.length
            ) {

                this.imageData.data.set(
                    this.framebuffer
                );

                this.ctx.putImageData(
                    this.imageData,
                    0,
                    0
                );

                return;

            }


            /*
             * Fallback.
             */

            const image =
                this.ctx.createImageData(
                    160,
                    144
                );


            image.data.set(
                this.framebuffer
            );


            this.ctx.putImageData(
                image,
                0,
                0
            );

        } catch (
            error
        ) {

            /*
             * Do not crash emulator because
             * of rendering.
             */

            this.log(
                "Błąd prezentacji klatki: " +
                error.message
            );

        }

    }


    /*
     * ========================================================
     * FRAME CONSUME
     * ========================================================
     *
     * Current emulator.js calls:
     *
     *   ppu.consumeFrame()
     *
     * Return:
     *
     *   null
     *   or framebuffer
     *
     * ========================================================
     */

    consumeFrame() {

        if (
            !this.frameReady
        ) {

            return null;

        }


        this.frameReady =
            false;


        return this.framebuffer;

    }


    /*
     * ========================================================
     * FRAME READY
     * ========================================================
     */

    hasFrame() {

        return this.frameReady;

    }


    /*
     * ========================================================
     * INTERRUPTS
     * ========================================================
     */

    requestVBlank() {

        this.vblankInterrupt =
            true;


        this.interruptFlags |=
            0x01;

    }


    requestSTAT() {

        this.statInterrupt =
            true;


        this.interruptFlags |=
            0x02;

    }


    consumeInterrupts() {

        const value =
            this.interruptFlags;


        this.interruptFlags =
            0;

        this.vblankInterrupt =
            false;

        this.statInterrupt =
            false;


        return value;

    }


    /*
     * ========================================================
     * COINCIDENCE
     * ========================================================
     */

    updateCoincidence() {

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

    }


    /*
     * ========================================================
     * STAT INTERRUPT
     * ========================================================
     */

    updateSTATLine() {

        const coincidence =
            (
                this.stat &
                0x04
            ) !== 0;


        const mode0 =
            (
                this.mode === 0
            ) &&
            (
                this.stat &
                0x08
            );


        const mode1 =
            (
                this.mode === 1
            ) &&
            (
                this.stat &
                0x10
            );


        const mode2 =
            (
                this.mode === 2
            ) &&
            (
                this.stat &
                0x20
            );


        const coincidenceIRQ =
            coincidence &&
            (
                this.stat &
                0x40
            );


        const active =
            Boolean(
                mode0 ||
                mode1 ||
                mode2 ||
                coincidenceIRQ
            );


        /*
         * STAT IRQ is edge-triggered.
         */

        if (
            active &&
            !this.statLine
        ) {

            this.requestSTAT();

        }


        this.statLine =
            active;


        this.stat =
            (
                this.stat &
                0xFC
            ) |
            (
                this.mode &
                3
            ) |
            0x80;

    }


    /*
     * ========================================================
     * DEBUG / INFO
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
                this.frameCounter,

            frameReady:
                this.frameReady,

            lcdEnabled:
                this.lcdEnabled()

        };

    }

}
