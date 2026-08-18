/*
 * ============================================================
 * WebBktx — Game Boy DMG PPU
 * ppu.js
 * ============================================================
 *
 * Kompatybilny z:
 *
 *   GameBoyMemory.readByte()
 *   GameBoyMemory.writeByte()
 *   memory.connectPPU(ppu)
 *
 * Display:
 *   160 x 144
 *
 * VRAM:
 *   8000-9FFF
 *
 * OAM:
 *   FE00-FE9F
 *
 * ============================================================
 */

export default class PPU {

    constructor(memory = null) {

        this.memory = memory;
        this.cpu = null;

        this.canvas = null;
        this.context = null;

        this.WIDTH = 160;
        this.HEIGHT = 144;

        this.DOTS_PER_LINE = 456;

        /*
         * Mode 2 = 80
         * Mode 3 = 172
         * Mode 0 = 204
         *
         * Razem 456.
         */

        this.MODE2_CYCLES = 80;
        this.MODE3_CYCLES = 172;
        this.MODE0_CYCLES = 204;

        this.mode = 2;
        this.lineCycles = 0;
        this.ly = 0;

        this.frameCount = 0;
        this.frameReady = false;

        /*
         * Game Boy color:
         *
         * 0 = light
         * 3 = dark
         */

        this.frameBuffer =
            new Uint8Array(
                this.WIDTH * this.HEIGHT
            );

        /*
         * Surowy kolor BG przed BGP.
         *
         * Potrzebny do priorytetu sprite'ów.
         */

        this.bgColorBuffer =
            new Uint8Array(
                this.WIDTH * this.HEIGHT
            );

        /*
         * RGBA dla Canvas.
         */

        this.rgbaBuffer =
            new Uint8ClampedArray(
                this.WIDTH *
                this.HEIGHT *
                4
            );

        /*
         * Klasyczna paleta DMG.
         */

        this.palette = [
            [224, 248, 208],
            [136, 192, 112],
            [52, 104, 86],
            [8, 24, 32]
        ];

        this.debug = false;

        this.reset();
    }


    /*
     * ========================================================
     * CONNECT
     * ========================================================
     */

    connect(components = {}) {

        if (components.memory) {
            this.memory = components.memory;
        }

        if (components.cpu) {
            this.cpu = components.cpu;
        }

    }


    /*
     * ========================================================
     * INTERRUPT CALLBACK
     * ========================================================
     */

    setInterruptCallback(callback) {

        this.interruptCallback =
            typeof callback === "function"
                ? callback
                : null;

    }


    /*
     * ========================================================
     * CANVAS
     * ========================================================
     */

    attachCanvas(canvas) {

        this.canvas = canvas;

        if (!canvas) {

            this.context = null;
            return;

        }

        /*
         * Internal resolution.
         *
         * CSS może później skalować canvas.
         */

        canvas.width = this.WIDTH;
        canvas.height = this.HEIGHT;

        this.context =
            canvas.getContext(
                "2d",
                {
                    alpha: false
                }
            );

        if (this.context) {

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

        this.mode = 2;
        this.lineCycles = 0;
        this.ly = 0;

        this.frameCount = 0;
        this.frameReady = false;

        this.frameBuffer.fill(0);
        this.bgColorBuffer.fill(0);
        this.rgbaBuffer.fill(0);

        /*
         * Nie wywołujemy tutaj memory.writeByte()
         * dla FF40-FF4B, ponieważ memory kieruje te
         * adresy ponownie do PPU.
         *
         * Aktualizujemy rejestry bezpośrednio.
         */

        this.directWriteIO(
            0xFF40,
            0x91
        );

        this.directWriteIO(
            0xFF41,
            0x80 | 0x02
        );

        this.directWriteIO(
            0xFF42,
            0x00
        );

        this.directWriteIO(
            0xFF43,
            0x00
        );

        this.directWriteIO(
            0xFF44,
            0x00
        );

        this.directWriteIO(
            0xFF45,
            0x00
        );

        this.directWriteIO(
            0xFF47,
            0xFC
        );

        this.directWriteIO(
            0xFF48,
            0xFF
        );

        this.directWriteIO(
            0xFF49,
            0xFF
        );

        this.directWriteIO(
            0xFF4A,
            0x00
        );

        this.directWriteIO(
            0xFF4B,
            0x00
        );

        this.clearFrame();
    }


    /*
     * ========================================================
     * DIRECT IO
     * ========================================================
     *
     * Nie korzysta z memory.writeByte(), aby nie powodować
     * pętli:
     *
     * Memory -> PPU -> Memory -> PPU...
     *
     * ========================================================
     */

    directReadIO(address) {

        if (
            this.memory &&
            this.memory.io
        ) {

            return (
                this.memory.io[
                    address - 0xFF00
                ] ?? 0xFF
            ) & 0xFF;

        }

        return 0xFF;
    }


    directWriteIO(address, value) {

        if (
            this.memory &&
            this.memory.io
        ) {

            this.memory.io[
                address - 0xFF00
            ] =
                value & 0xFF;

            return;
        }

        /*
         * Fallback dla innej implementacji pamięci.
         */

        if (
            this.memory &&
            typeof this.memory.writeByte ===
            "function" &&
            !(
                address >= 0xFF40 &&
                address <= 0xFF4B
            )
        ) {

            this.memory.writeByte(
                address,
                value & 0xFF
            );

        }
    }


    /*
     * ========================================================
     * MEMORY READ
     * ========================================================
     */

    read8(address) {

        address &= 0xFFFF;

        /*
         * Twój memory.js ma readByte().
         */

        if (
            this.memory &&
            typeof this.memory.readByte ===
            "function"
        ) {

            /*
             * Dla VRAM/OAM normalnie czytamy z Memory.
             *
             * Dla rejestrów PPU korzystamy bezpośrednio,
             * żeby uniknąć zależności zwrotnej.
             */

            if (
                address >= 0xFF40 &&
                address <= 0xFF4B
            ) {

                return this.directReadIO(
                    address
                );

            }

            return (
                this.memory.readByte(
                    address
                ) & 0xFF
            );
        }

        /*
         * Stary interfejs read8.
         */

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
     * VRAM READ
     * ========================================================
     */

    readVRAM(address) {

        address &= 0x1FFF;

        if (
            this.memory &&
            this.memory.vram
        ) {

            return (
                this.memory.vram[address] &
                0xFF
            );

        }

        return this.read8(
            0x8000 + address
        );
    }


    /*
     * ========================================================
     * OAM READ
     * ========================================================
     */

    readOAM(index) {

        index &= 0x9F;

        if (
            this.memory &&
            this.memory.oam
        ) {

            return (
                this.memory.oam[index] &
                0xFF
            );

        }

        return this.read8(
            0xFE00 + index
        );
    }


    /*
     * ========================================================
     * REGISTER READ
     * ========================================================
     *
     * memory.js wywołuje tę funkcję przy FF40-FF4B.
     *
     * ========================================================
     */

    readRegister(address) {

        return this.directReadIO(
            address
        );
    }


    /*
     * ========================================================
     * REGISTER WRITE
     * ========================================================
     *
     * memory.js wywołuje tę funkcję przy FF40-FF4B.
     *
     * NIE piszemy tutaj memory.writeByte().
     *
     * ========================================================
     */

    writeRegister(address, value) {

        address &= 0xFFFF;
        value &= 0xFF;

        switch (address) {

            case 0xFF40:
                /*
                 * LCDC
                 */
                this.directWriteIO(
                    address,
                    value
                );

                /*
                 * LCD wyłączony.
                 */

                if (!(value & 0x80)) {

                    this.mode = 0;
                    this.ly = 0;
                    this.lineCycles = 0;

                    this.directWriteIO(
                        0xFF44,
                        0
                    );

                } else {

                    /*
                     * LCD włączony.
                     */

                    if (
                        this.mode === 0 &&
                        this.ly === 0
                    ) {

                        this.mode = 2;
                    }
                }

                this.updateSTAT();
                return;


            case 0xFF41:
                /*
                 * STAT:
                 *
                 * bity 6-3 można zapisywać,
                 * bity 2-0 są kontrolowane przez PPU.
                 */

                {

                    const old =
                        this.directReadIO(
                            address
                        );

                    const preservedMode =
                        old & 0x07;

                    const newValue =
                        (
                            value &
                            0xF8
                        ) |
                        preservedMode |
                        0x80;

                    this.directWriteIO(
                        address,
                        newValue
                    );
                }

                return;


            case 0xFF44:
                /*
                 * LY jest read-only.
                 */

                return;


            case 0xFF45:

                this.directWriteIO(
                    address,
                    value
                );

                this.updateLYC();

                return;


            case 0xFF42:
            case 0xFF43:
            case 0xFF47:
            case 0xFF48:
            case 0xFF49:
            case 0xFF4A:
            case 0xFF4B:

                this.directWriteIO(
                    address,
                    value
                );

                return;


            default:

                this.directWriteIO(
                    address,
                    value
                );

        }
    }


    /*
     * ========================================================
     * LCDC
     * ========================================================
     */

    getLCDC() {

        return this.read8(
            0xFF40
        );
    }


    getSTAT() {

        return this.read8(
            0xFF41
        );
    }


    getSCY() {

        return this.read8(
            0xFF42
        );
    }


    getSCX() {

        return this.read8(
            0xFF43
        );
    }


    getLY() {

        return this.ly & 0xFF;
    }


    getLYC() {

        return this.read8(
            0xFF45
        );
    }


    getBGP() {

        return this.read8(
            0xFF47
        );
    }


    getOBP0() {

        return this.read8(
            0xFF48
        );
    }


    getOBP1() {

        return this.read8(
            0xFF49
        );
    }


    lcdEnabled() {

        return (
            (this.getLCDC() & 0x80) !== 0
        );
    }


    /*
     * ========================================================
     * STEP
     * ========================================================
     */

    step(cycles) {

        if (
            !Number.isFinite(cycles) ||
            cycles <= 0
        ) {

            return;
        }

        /*
         * LCD OFF.
         */

        if (!this.lcdEnabled()) {

            this.mode = 0;
            this.ly = 0;
            this.lineCycles = 0;

            this.directWriteIO(
                0xFF44,
                0
            );

            this.updateSTAT();

            return;
        }


        while (cycles > 0) {

            let remaining;

            switch (this.mode) {

                case 2:

                    remaining =
                        this.MODE2_CYCLES -
                        this.lineCycles;

                    break;

                case 3:

                    remaining =
                        this.MODE3_CYCLES -
                        this.lineCycles;

                    break;

                case 0:

                    remaining =
                        this.MODE0_CYCLES -
                        (
                            this.lineCycles -
                            252
                        );

                    break;

                case 1:

                    remaining =
                        456 -
                        this.lineCycles;

                    break;

                default:

                    this.mode = 2;
                    this.lineCycles = 0;
                    remaining = 80;
            }

            remaining =
                Math.max(
                    1,
                    remaining
                );

            const amount =
                Math.min(
                    cycles,
                    remaining
                );

            this.lineCycles += amount;
            cycles -= amount;

            this.processMode();
        }
    }


    /*
     * ========================================================
     * TICK
     * ========================================================
     *
     * Alias dla emulatorów używających tick().
     * ========================================================
     */

    tick(cycles) {

        this.step(cycles);
    }


    /*
     * ========================================================
     * PROCESS MODE
     * ========================================================
     */

    processMode() {

        /*
         * ----------------------------------------------------
         * MODE 2
         * ----------------------------------------------------
         */

        if (
            this.mode === 2 &&
            this.lineCycles >= 80
        ) {

            this.mode = 3;

            this.updateSTAT();

            return;
        }


        /*
         * ----------------------------------------------------
         * MODE 3
         * ----------------------------------------------------
         */

        if (
            this.mode === 3 &&
            this.lineCycles >=
            80 + 172
        ) {

            if (
                this.ly < 144
            ) {

                this.renderScanline(
                    this.ly
                );
            }

            this.mode = 0;

            this.updateSTAT();

            return;
        }


        /*
         * ----------------------------------------------------
         * MODE 0
         * ----------------------------------------------------
         */

        if (
            this.mode === 0 &&
            this.lineCycles >= 456
        ) {

            this.lineCycles -= 456;

            this.ly++;

            if (
                this.ly >= 144
            ) {

                /*
                 * VBlank.
                 */

                this.mode = 1;

                this.frameReady = true;
                this.frameCount++;

                this.requestInterrupt(0);

                /*
                 * Aktualizujemy Canvas dopiero po
                 * pełnym wyrenderowaniu 144 linii.
                 */

                this.render();

            } else {

                this.mode = 2;
            }

            this.directWriteIO(
                0xFF44,
                this.ly
            );

            this.updateSTAT();

            return;
        }


        /*
         * ----------------------------------------------------
         * MODE 1
         * ----------------------------------------------------
         */

        if (
            this.mode === 1 &&
            this.lineCycles >= 456
        ) {

            this.lineCycles -= 456;

            this.ly++;

            if (
                this.ly >= 154
            ) {

                this.ly = 0;
                this.mode = 2;

                this.frameReady = false;

            }

            this.directWriteIO(
                0xFF44,
                this.ly
            );

            this.updateSTAT();

            return;
        }
    }


    /*
     * ========================================================
     * UPDATE STAT
     * ========================================================
     */

    updateSTAT() {

        let stat =
            this.directReadIO(
                0xFF41
            );

        /*
         * Bity 3-6 = enable flags.
         * Bity 0-1 = mode.
         * Bit 2 = coincidence.
         */

        stat =
            stat & 0xF8;

        stat |=
            this.mode & 3;

        if (
            this.ly ===
            this.getLYC()
        ) {

            stat |= 0x04;

        }

        /*
         * Bit 7.
         */

        stat |= 0x80;

        this.directWriteIO(
            0xFF41,
            stat
        );
    }


    /*
     * ========================================================
     * UPDATE LYC
     * ========================================================
     */

    updateLYC() {

        this.updateSTAT();
    }


    /*
     * ========================================================
     * INTERRUPT
     * ========================================================
     */

    requestInterrupt(bit) {

        if (
            this.interruptCallback
        ) {

            this.interruptCallback(
                bit
            );

            return;
        }

        /*
         * Fallback bez callbacka.
         */

        if (
            this.memory &&
            typeof this.memory.requestInterrupt ===
            "function"
        ) {

            this.memory.requestInterrupt(
                bit
            );
        }
    }


    /*
     * ========================================================
     * RENDER SCANLINE
     * ========================================================
     */

    renderScanline(line) {

        if (
            line < 0 ||
            line >= 144
        ) {

            return;
        }

        const lcdc =
            this.getLCDC();

        /*
         * Najpierw BG.
         */

        if (lcdc & 0x01) {

            this.renderBackground(
                line
            );

        } else {

            this.fillLine(
                line,
                0
            );

            this.fillBGColorLine(
                line,
                0
            );
        }


        /*
         * Window.
         */

        if (
            (lcdc & 0x20) &&
            (lcdc & 0x01)
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
     * TILE ADDRESS
     * ========================================================
     */

    getTileAddress(
        tileNumber,
        unsignedTiles
    ) {

        if (unsignedTiles) {

            return (
                0x8000 +
                tileNumber * 16
            );
        }

        /*
         * Signed addressing:
         *
         * tile 0 = 9000
         * tile 127 = 97F0
         * tile 128 = 8800
         */

        const signed =
            tileNumber < 128
                ? tileNumber
                : tileNumber - 256;

        return (
            0x9000 +
            signed * 16
        );
    }


    /*
     * ========================================================
     * RENDER BACKGROUND
     * ========================================================
     */

    renderBackground(line) {

        const lcdc =
            this.getLCDC();

        const scx =
            this.getSCX();

        const scy =
            this.getSCY();

        const mapBase =
            lcdc & 0x08
                ? 0x9C00
                : 0x9800;

        const unsignedTiles =
            (lcdc & 0x10) !== 0;

        const y =
            (
                line +
                scy
            ) & 0xFF;

        const tileY =
            (y >> 3) & 31;

        const pixelY =
            y & 7;


        for (
            let x = 0;
            x < 160;
            x++
        ) {

            const worldX =
                (
                    x +
                    scx
                ) & 0xFF;

            const tileX =
                (worldX >> 3) & 31;

            const mapAddress =
                mapBase +
                tileY * 32 +
                tileX;

            const tileNumber =
                this.read8(
                    mapAddress
                );

            const tileAddress =
                this.getTileAddress(
                    tileNumber,
                    unsignedTiles
                );

            const rowAddress =
                tileAddress +
                pixelY * 2;

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
                (worldX & 7);

            const color =
                (
                    (low >> bit) & 1
                ) |
                (
                    (
                        (high >> bit) & 1
                    ) << 1
                );

            const shade =
                this.mapPalette(
                    color,
                    this.getBGP()
                );

            this.setBGPixel(
                x,
                line,
                color
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
     * WINDOW
     * ========================================================
     */

    renderWindow(line) {

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

        if (
            line < wy
        ) {

            return;
        }

        /*
         * WX = screen X + 7.
         */

        const windowX =
            wx - 7;

        if (
            windowX >= 160
        ) {

            return;
        }

        const mapBase =
            lcdc & 0x40
                ? 0x9C00
                : 0x9800;

        const unsignedTiles =
            (lcdc & 0x10) !== 0;

        const windowLine =
            line - wy;

        const tileY =
            (windowLine >> 3) & 31;

        const pixelY =
            windowLine & 7;

        const startX =
            Math.max(
                0,
                windowX
            );


        for (
            let screenX = startX;
            screenX < 160;
            screenX++
        ) {

            const windowXPixel =
                screenX -
                windowX;

            const tileX =
                (windowXPixel >> 3) & 31;

            const pixelX =
                windowXPixel & 7;

            const mapAddress =
                mapBase +
                tileY * 32 +
                tileX;

            const tileNumber =
                this.read8(
                    mapAddress
                );

            const tileAddress =
                this.getTileAddress(
                    tileNumber,
                    unsignedTiles
                );

            const row =
                tileAddress +
                pixelY * 2;

            const low =
                this.read8(
                    row
                );

            const high =
                this.read8(
                    row + 1
                );

            const bit =
                7 - pixelX;

            const color =
                (
                    (low >> bit) & 1
                ) |
                (
                    (
                        (high >> bit) & 1
                    ) << 1
                );

            const shade =
                this.mapPalette(
                    color,
                    this.getBGP()
                );

            this.setBGPixel(
                screenX,
                line,
                color
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
     * SPRITES
     * ========================================================
     */

    renderSprites(line) {

        const lcdc =
            this.getLCDC();

        const tall =
            (lcdc & 0x04) !== 0;

        const height =
            tall
                ? 16
                : 8;

        const sprites = [];


        /*
         * Najpierw zbieramy maksymalnie 10 sprite'ów.
         */

        for (
            let i = 0;
            i < 40;
            i++
        ) {

            const base =
                i * 4;

            const y =
                this.readOAM(
                    base
                ) - 16;

            const x =
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
                line >= y &&
                line < y + height
            ) {

                sprites.push({
                    index: i,
                    x,
                    y,
                    tile,
                    flags
                });
            }

            if (
                sprites.length >= 10
            ) {

                break;
            }
        }


        /*
         * DMG priority:
         *
         * mniejsze X wygrywa.
         * Przy równym X mniejszy OAM index wygrywa.
         *
         * Rysujemy od najniższego priorytetu do najwyższego.
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
                line,
                height
            );
        }
    }


    /*
     * ========================================================
     * SINGLE SPRITE
     * ========================================================
     */

    renderSprite(
        sprite,
        line,
        height
    ) {

        const flags =
            sprite.flags;

        const flipX =
            (flags & 0x20) !== 0;

        const flipY =
            (flags & 0x40) !== 0;

        const behindBG =
            (flags & 0x80) !== 0;

        const palette =
            (flags & 0x10)
                ? this.getOBP1()
                : this.getOBP0();

        let tile =
            sprite.tile;


        /*
         * 8x16:
         * bit 0 ignorowany.
         */

        if (
            height === 16
        ) {

            tile &= 0xFE;
        }


        let row =
            line -
            sprite.y;

        if (
            flipY
        ) {

            row =
                height -
                1 -
                row;
        }


        if (
            height === 16 &&
            row >= 8
        ) {

            tile++;
            row -= 8;
        }


        const address =
            0x8000 +
            tile * 16 +
            row * 2;

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
                screenX >= 160
            ) {

                continue;
            }

            const bit =
                flipX
                    ? pixel
                    : 7 - pixel;

            const color =
                (
                    (low >> bit) & 1
                ) |
                (
                    (
                        (high >> bit) & 1
                    ) << 1
                );


            /*
             * OBJ color 0 = transparent.
             */

            if (
                color === 0
            ) {

                continue;
            }


            /*
             * Sprite behind BG.
             *
             * Ważne:
             * sprawdzamy RAW BG color,
             * a nie shade po BGP.
             */

            if (
                behindBG &&
                this.getBGPixel(
                    screenX,
                    line
                ) !== 0
            ) {

                continue;
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
     * PALETTE
     * ========================================================
     */

    mapPalette(
        color,
        palette
    ) {

        return (
            (
                palette >>
                (
                    color * 2
                )
            ) & 3
        );
    }


    /*
     * ========================================================
     * PIXEL
     * ========================================================
     */

    setPixel(
        x,
        y,
        value
    ) {

        if (
            x < 0 ||
            x >= 160 ||
            y < 0 ||
            y >= 144
        ) {

            return;
        }

        this.frameBuffer[
            y * 160 + x
        ] =
            value & 3;
    }


    /*
     * ========================================================
     * BG PIXEL
     * ========================================================
     */

    setBGPixel(
        x,
        y,
        value
    ) {

        if (
            x < 0 ||
            x >= 160 ||
            y < 0 ||
            y >= 144
        ) {

            return;
        }

        this.bgColorBuffer[
            y * 160 + x
        ] =
            value & 3;
    }


    getPixel(
        x,
        y
    ) {

        if (
            x < 0 ||
            x >= 160 ||
            y < 0 ||
            y >= 144
        ) {

            return 0;
        }

        return this.frameBuffer[
            y * 160 + x
        ];
    }


    getBGPixel(
        x,
        y
    ) {

        if (
            x < 0 ||
            x >= 160 ||
            y < 0 ||
            y >= 144
        ) {

            return 0;
        }

        return this.bgColorBuffer[
            y * 160 + x
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
            y >= 144
        ) {

            return;
        }

        const start =
            y * 160;

        this.frameBuffer.fill(
            value & 3,
            start,
            start + 160
        );
    }


    fillBGColorLine(
        y,
        value
    ) {

        if (
            y < 0 ||
            y >= 144
        ) {

            return;
        }

        const start =
            y * 160;

        this.bgColorBuffer.fill(
            value & 3,
            start,
            start + 160
        );
    }


    /*
     * ========================================================
     * CLEAR FRAME
     * ========================================================
     */

    clearFrame() {

        this.frameBuffer.fill(0);
        this.bgColorBuffer.fill(0);

        if (
            !this.context
        ) {

            return;
        }

        this.context.fillStyle =
            "rgb(224,248,208)";

        this.context.fillRect(
            0,
            0,
            160,
            144
        );
    }


    /*
     * ========================================================
     * RGBA
     * ========================================================
     */

    updateRGBA() {

        for (
            let i = 0;
            i < this.frameBuffer.length;
            i++
        ) {

            const shade =
                this.frameBuffer[i] & 3;

            const color =
                this.palette[shade];

            const offset =
                i * 4;

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

    render(context = null) {

        if (context) {
            this.context = context;
        }

        if (!this.context) {
            return;
        }

        this.updateRGBA();

        const image =
            new ImageData(
                this.rgbaBuffer,
                160,
                144
            );

        this.context.putImageData(
            image,
            0,
            0
        );
    }


    /*
     * ========================================================
     * FRAMEBUFFER
     * ========================================================
     */

    getFrameBuffer() {

        return this.frameBuffer;
    }


    getRGBABuffer() {

        this.updateRGBA();

        return this.rgbaBuffer;
    }


    /*
     * ========================================================
     * FRAME READY
     * ========================================================
     */

    isFrameReady() {

        return this.frameReady;
    }


    consumeFrame() {

        const result =
            this.frameReady;

        this.frameReady = false;

        return result;
    }


    /*
     * ========================================================
     * STATE
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

    setDebug(enabled) {

        this.debug =
            Boolean(enabled);
    }


    /*
     * ========================================================
     * DESTROY
     * ========================================================
     */

    destroy() {

        this.canvas = null;
        this.context = null;
        this.memory = null;
        this.cpu = null;
    }

}
