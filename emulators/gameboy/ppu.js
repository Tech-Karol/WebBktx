/*
 * ============================================================
 * WebBktx — Game Boy DMG PPU
 * ppu.js
 * ============================================================
 *
 * Nintendo Game Boy DMG PPU / LCD
 *
 * 160 x 144
 * 4 shades
 *
 * Timing:
 *
 * Mode 2 = 80 cycles
 * Mode 3 = 172 cycles
 * Mode 0 = 204 cycles
 *
 * 456 cycles / scanline
 * 154 scanlines / frame
 *
 * ============================================================
 */

export default class PPU {

    constructor(memory = null) {

        this.memory = memory;
        this.cpu = null;

        this.canvas = null;
        this.context = null;

        /*
         * Display
         */
        this.WIDTH = 160;
        this.HEIGHT = 144;

        /*
         * Timing
         */
        this.DOTS_PER_LINE = 456;
        this.VISIBLE_LINES = 144;
        this.TOTAL_LINES = 154;

        /*
         * PPU timing state
         */
        this.mode = 2;
        this.lineCycles = 0;
        this.ly = 0;

        /*
         * Frame state
         */
        this.frameReady = false;
        this.frameCount = 0;

        /*
         * Shared memory.
         *
         * memory.connectPPU() replaces these
         * with the actual Memory Bus buffers.
         */
        this.vram = new Uint8Array(0x2000);
        this.oam = new Uint8Array(0xA0);

        /*
         * PPU registers.
         *
         * IMPORTANT:
         *
         * These are stored locally.
         * We NEVER call memory.writeByte()
         * from writeRegister().
         *
         * This prevents:
         *
         * PPU -> Memory -> PPU -> Memory
         */
        this.lcdc = 0x91;
        this.stat = 0x85;

        this.scy = 0x00;
        this.scx = 0x00;

        this.lyc = 0x00;

        this.bgp = 0xFC;
        this.obp0 = 0xFF;
        this.obp1 = 0xFF;

        this.wy = 0x00;
        this.wx = 0x00;

        /*
         * Window line counter.
         */
        this.windowLine = 0;
        this.windowStarted = false;

        /*
         * Framebuffer.
         *
         * 0..3 = Game Boy shade.
         */
        this.frameBuffer =
            new Uint8Array(
                this.WIDTH * this.HEIGHT
            );

        /*
         * RGBA buffer.
         */
        this.rgbaBuffer =
            new Uint8ClampedArray(
                this.WIDTH *
                this.HEIGHT *
                4
            );

        /*
         * DMG palette.
         */
        this.palette = [

            [224, 248, 208],

            [136, 192, 112],

            [52, 104, 86],

            [8, 24, 32]

        ];

        /*
         * Debug.
         */
        this.debug = false;

        /*
         * Interrupt callback.
         */
        this.interruptCallback = null;

        /*
         * Last STAT condition.
         */
        this.lastStatSignal = false;

        /*
         * Reset.
         */
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


    requestInterrupt(bit) {

        /*
         * Prefer Memory Bus interrupt system.
         */
        if (
            this.memory &&
            typeof this.memory.requestInterrupt === "function"
        ) {

            this.memory.requestInterrupt(bit);
            return;

        }

        /*
         * Fallback callback.
         */
        if (this.interruptCallback) {

            this.interruptCallback(bit);

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

            this.context = null;
            return;

        }

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

            this.context.imageSmoothingEnabled = false;

        }

        this.render();

    }


    /*
     * Alias used by some emulator versions.
     */
    connectCanvas(canvas) {

        this.attachCanvas(canvas);

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

        this.frameReady = false;
        this.frameCount = 0;

        this.windowLine = 0;
        this.windowStarted = false;

        this.lastStatSignal = false;

        this.lcdc = 0x91;
        this.stat = 0x85;

        this.scy = 0x00;
        this.scx = 0x00;

        this.lyc = 0x00;

        this.bgp = 0xFC;
        this.obp0 = 0xFF;
        this.obp1 = 0xFF;

        this.wy = 0x00;
        this.wx = 0x00;

        this.frameBuffer.fill(0);
        this.rgbaBuffer.fill(0);

        this.updateSTAT();

        this.clearFrame();

    }


    /*
     * ========================================================
     * REGISTER READ
     * ========================================================
     *
     * IMPORTANT:
     *
     * PPU registers are read locally.
     * This avoids Memory -> PPU -> Memory recursion.
     *
     * ========================================================
     */

    readRegister(address) {

        address &= 0xFFFF;

        switch (address) {

            case 0xFF40:
                return this.lcdc;

            case 0xFF41:

                return (
                    0x80 |
                    (this.stat & 0x78) |
                    (this.mode & 0x03)
                );

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
     *
     * NEVER writes back into MemoryBus.
     *
     * ========================================================
     */

    writeRegister(address, value) {

        address &= 0xFFFF;
        value &= 0xFF;

        switch (address) {

            case 0xFF40:

                this.writeLCDC(value);

                break;

            case 0xFF41:

                /*
                 * CPU can write STAT bits 3-6.
                 * Mode and coincidence are PPU controlled.
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

                this.stat |= 0x80;

                this.updateSTAT();

                break;

            case 0xFF42:

                this.scy = value;

                break;

            case 0xFF43:

                this.scx = value;

                break;

            case 0xFF44:

                /*
                 * LY is effectively read-only for CPU.
                 *
                 * Do nothing.
                 */
                break;

            case 0xFF45:

                this.lyc = value;

                this.updateLYC();

                break;

            case 0xFF47:

                this.bgp = value;

                break;

            case 0xFF48:

                this.obp0 = value;

                break;

            case 0xFF49:

                this.obp1 = value;

                break;

            case 0xFF4A:

                this.wy = value;

                break;

            case 0xFF4B:

                this.wx = value;

                break;

        }

    }


    /*
     * ========================================================
     * LCDC
     * ========================================================
     */

    writeLCDC(value) {

        const oldEnabled =
            (this.lcdc & 0x80) !== 0;

        const newEnabled =
            (value & 0x80) !== 0;

        this.lcdc = value;

        /*
         * LCD disabled.
         */
        if (!newEnabled) {

            this.mode = 0;
            this.lineCycles = 0;
            this.ly = 0;

            this.windowLine = 0;
            this.windowStarted = false;

            this.updateSTAT();

            this.clearFrame();

            return;

        }

        /*
         * LCD was just enabled.
         */
        if (!oldEnabled && newEnabled) {

            this.mode = 2;
            this.lineCycles = 0;
            this.ly = 0;

            this.windowLine = 0;
            this.windowStarted = false;

            this.updateSTAT();

        }

    }


    /*
     * ========================================================
     * SIMPLE MEMORY ACCESS
     * ========================================================
     *
     * Used for VRAM/OAM and registers.
     *
     * Avoids MemoryBus recursion.
     * ========================================================
     */

    read8(address) {

        address &= 0xFFFF;

        /*
         * VRAM
         */
        if (
            address >= 0x8000 &&
            address <= 0x9FFF
        ) {

            return this.vram[
                address - 0x8000
            ] & 0xFF;

        }

        /*
         * OAM
         */
        if (
            address >= 0xFE00 &&
            address <= 0xFE9F
        ) {

            return this.oam[
                address - 0xFE00
            ] & 0xFF;

        }

        /*
         * PPU registers.
         */
        if (
            address >= 0xFF40 &&
            address <= 0xFF4B
        ) {

            return this.readRegister(address);

        }

        /*
         * Other memory.
         */
        if (
            this.memory &&
            typeof this.memory.readByte === "function"
        ) {

            return this.memory.readByte(address) & 0xFF;

        }

        /*
         * Compatibility with alternate Memory API.
         */
        if (
            this.memory &&
            typeof this.memory.read8 === "function"
        ) {

            return this.memory.read8(address) & 0xFF;

        }

        return 0xFF;

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
         * LCD disabled.
         */
        if (!this.lcdEnabled()) {

            this.mode = 0;
            this.lineCycles = 0;
            this.ly = 0;

            this.updateSTAT();

            return;

        }

        let remainingCycles =
            Math.floor(cycles);

        while (remainingCycles > 0) {

            const untilEnd =
                this.cyclesUntilModeEnd();

            const amount =
                Math.min(
                    remainingCycles,
                    untilEnd
                );

            this.lineCycles += amount;
            remainingCycles -= amount;

            this.processMode();

        }

    }


    /*
     * ========================================================
     * CYCLES UNTIL MODE END
     * ========================================================
     */

    cyclesUntilModeEnd() {

        switch (this.mode) {

            case 2:

                return Math.max(
                    1,
                    80 - this.lineCycles
                );

            case 3:

                return Math.max(
                    1,
                    252 - this.lineCycles
                );

            case 0:
            case 1:

                return Math.max(
                    1,
                    456 - this.lineCycles
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
         * MODE 3
         */
        if (
            this.mode === 3 &&
            this.lineCycles >= 252
        ) {

            if (this.ly < 144) {

                this.renderScanline(
                    this.ly
                );

            }

            this.mode = 0;

            this.updateSTAT();

            return;

        }

        /*
         * MODE 0
         */
        if (
            this.mode === 0 &&
            this.lineCycles >= 456
        ) {

            this.lineCycles -= 456;

            this.ly++;

            if (this.ly >= 144) {

                this.mode = 1;

                this.frameReady = true;
                this.frameCount++;

                /*
                 * VBlank interrupt.
                 */
                this.requestInterrupt(0);

                /*
                 * Present frame.
                 */
                this.render();

            } else {

                this.mode = 2;

            }

            this.setLYInternal(
                this.ly
            );

            this.updateSTAT();

            return;

        }

        /*
         * MODE 1
         */
        if (
            this.mode === 1 &&
            this.lineCycles >= 456
        ) {

            this.lineCycles -= 456;

            this.ly++;

            if (this.ly >= 154) {

                this.ly = 0;

                this.mode = 2;

                this.windowLine = 0;
                this.windowStarted = false;

            }

            this.setLYInternal(
                this.ly
            );

            this.updateSTAT();

        }

    }


    /*
     * ========================================================
     * LY INTERNAL
     * ========================================================
     */

    setLYInternal(value) {

        this.ly =
            value & 0xFF;

        this.updateLYC();

    }


    /*
     * ========================================================
     * LCD ENABLED
     * ========================================================
     */

    lcdEnabled() {

        return (
            (this.lcdc & 0x80) !== 0
        );

    }


    /*
     * ========================================================
     * STAT
     * ========================================================
     */

    updateSTAT() {

        let stat =
            this.stat & 0x78;

        /*
         * Coincidence.
         */
        if (this.ly === this.lyc) {

            stat |= 0x04;

        }

        /*
         * Mode.
         */
        stat |=
            this.mode & 0x03;

        /*
         * Bit 7.
         */
        stat |= 0x80;

        this.stat = stat;

        /*
         * STAT interrupt condition.
         */
        const signal =
            (
                (
                    this.mode === 0 &&
                    (stat & 0x08)
                ) ||
                (
                    this.mode === 1 &&
                    (stat & 0x10)
                ) ||
                (
                    this.mode === 2 &&
                    (stat & 0x20)
                ) ||
                (
                    (stat & 0x04) &&
                    (stat & 0x40)
                )
            );

        /*
         * Edge-triggered behavior.
         */
        if (
            signal &&
            !this.lastStatSignal
        ) {

            this.requestInterrupt(1);

        }

        this.lastStatSignal =
            Boolean(signal);

    }


    /*
     * ========================================================
     * LYC
     * ========================================================
     */

    updateLYC() {

        if (this.ly === this.lyc) {

            this.stat |= 0x04;

        } else {

            this.stat &= ~0x04;

        }

        this.updateSTAT();

    }


    /*
     * ========================================================
     * RENDER SCANLINE
     * ========================================================
     */

    renderScanline(line) {

        /*
         * Start with BG.
         */
        if (this.lcdc & 0x01) {

            this.renderBackground(line);

        } else {

            this.fillLine(line, 0);

        }

        /*
         * Window.
         */
        if (
            (this.lcdc & 0x20) &&
            this.ly >= this.wy
        ) {

            this.renderWindow(line);

        }

        /*
         * Sprites.
         */
        if (this.lcdc & 0x02) {

            this.renderSprites(line);

        }

    }


    /*
     * ========================================================
     * TILE ADDRESS
     * ========================================================
     */

    getTileAddress(tileNumber) {

        /*
         * 8000 unsigned addressing.
         */
        if (this.lcdc & 0x10) {

            return (
                0x8000 +
                (
                    tileNumber *
                    16
                )
            );

        }

        /*
         * 8800 signed addressing.
         *
         * Tile 0 = 9000.
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

        const scx = this.scx;
        const scy = this.scy;

        /*
         * BG tile map.
         *
         * Bit 3:
         * 0 = 9800
         * 1 = 9C00
         */
        const mapBase =
            (this.lcdc & 0x08)
                ? 0x9C00
                : 0x9800;

        const y =
            (
                scy +
                line
            ) & 0xFF;

        const tileY =
            (y >> 3) & 31;

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
                (bgX >> 3) & 31;

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
                    tileNumber
                );

            const row =
                tileAddress +
                pixelY * 2;

            const low =
                this.read8(row);

            const high =
                this.read8(
                    row + 1
                );

            const bit =
                7 -
                (bgX & 7);

            const color =
                (
                    (low >> bit) & 1
                ) |
                (
                    ((high >> bit) & 1) << 1
                );

            const shade =
                this.mapPalette(
                    color,
                    this.bgp
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

    renderWindow(line) {

        const wx = this.wx;
        const wy = this.wy;

        if (line < wy) {

            return;

        }

        /*
         * WX is screen X + 7.
         */
        const startX =
            wx - 7;

        if (startX >= this.WIDTH) {

            return;

        }

        /*
         * Window starts.
         */
        if (!this.windowStarted) {

            this.windowStarted = true;
            this.windowLine = 0;

        }

        const mapBase =
            (this.lcdc & 0x40)
                ? 0x9C00
                : 0x9800;

        const tileY =
            (this.windowLine >> 3) & 31;

        const pixelY =
            this.windowLine & 7;

        for (
            let screenX =
                Math.max(0, startX);

            screenX < this.WIDTH;

            screenX++
        ) {

            const windowX =
                screenX -
                startX;

            const tileX =
                (windowX >> 3) & 31;

            const pixelX =
                windowX & 7;

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
                    tileNumber
                );

            const row =
                tileAddress +
                pixelY * 2;

            const low =
                this.read8(row);

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
                    ((high >> bit) & 1) << 1
                );

            const shade =
                this.mapPalette(
                    color,
                    this.bgp
                );

            this.setPixel(
                screenX,
                line,
                shade
            );

        }

        this.windowLine++;

    }


    /*
     * ========================================================
     * SPRITES
     * ========================================================
     */

    renderSprites(line) {

        const tall =
            (this.lcdc & 0x04) !== 0;

        const height =
            tall ? 16 : 8;

        const sprites = [];

        /*
         * Find up to 10 sprites on this line.
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
                this.read8(address) -
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

            if (sprites.length >= 10) {

                break;

            }

        }

        /*
         * DMG priority:
         *
         * smaller X first,
         * then smaller OAM index.
         *
         * Draw lower priority first.
         */
        sprites.sort(
            (a, b) => {

                if (a.x !== b.x) {

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
                ? this.obp1
                : this.obp0;

        let tile =
            sprite.tile;

        /*
         * 8x16:
         * bit 0 ignored.
         */
        if (height === 16) {

            tile &= 0xFE;

        }

        let row =
            line -
            sprite.y;

        if (flipY) {

            row =
                height -
                1 -
                row;

        }

        /*
         * Second tile in 8x16.
         */
        if (
            height === 16 &&
            row >= 8
        ) {

            tile++;
            row -= 8;

        }

        const tileAddress =
            0x8000 +
            tile * 16;

        const address =
            tileAddress +
            row * 2;

        const low =
            this.read8(address);

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
                screenX >= this.WIDTH
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
                    ((high >> bit) & 1) << 1
                );

            /*
             * Color 0 transparent.
             */
            if (color === 0) {

                continue;

            }

            /*
             * OBJ behind BG.
             *
             * Our framebuffer stores the final
             * shade, so shade 0 represents BG
             * color 0 in this DMG implementation.
             */
            if (behindBG) {

                if (
                    this.getPixel(
                        screenX,
                        line
                    ) !== 0
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
     * PALETTE
     * ========================================================
     */

    mapPalette(
        color,
        palette
    ) {

        return (
            palette >>
            (color * 2)
        ) & 3;

    }


    /*
     * ========================================================
     * FRAMEBUFFER
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
            y * this.WIDTH + x
        ] =
            value & 3;

    }


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
            y * this.WIDTH + x
        ] & 3;

    }


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
            y * this.WIDTH;

        this.frameBuffer.fill(
            value & 3,
            start,
            start + this.WIDTH
        );

    }


    /*
     * ========================================================
     * CLEAR FRAME
     * ========================================================
     */

    clearFrame() {

        this.frameBuffer.fill(0);

        if (!this.context) {

            return;

        }

        this.context.fillStyle =
            "rgb(224,248,208)";

        this.context.fillRect(
            0,
            0,
            this.WIDTH,
            this.HEIGHT
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
     * CANVAS RENDER
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
     * FRAMEBUFFER ACCESS
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

        const ready =
            this.frameReady;

        this.frameReady = false;

        return ready;

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
                this.lcdc,

            stat:
                this.stat,

            scx:
                this.scx,

            scy:
                this.scy,

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
                this.wy

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

        this.vram = null;
        this.oam = null;

        this.interruptCallback = null;

    }

}
