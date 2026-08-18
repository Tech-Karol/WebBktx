/*
 * ============================================================
 * WebBktx — Game Boy Input
 * ============================================================
 *
 * Obsługa:
 *   - Keyboard
 *   - Gamepad API
 *
 * Game Boy:
 *   RIGHT
 *   LEFT
 *   UP
 *   DOWN
 *   A
 *   B
 *   SELECT
 *   START
 *
 * ============================================================
 */

export default class GameBoyInput {

    constructor() {

        /*
         * ----------------------------------------------------
         * Button state
         * ----------------------------------------------------
         */

        this.buttons = {

            right: false,
            left: false,
            up: false,
            down: false,

            a: false,
            b: false,

            select: false,
            start: false

        };


        /*
         * Previous state.
         * Used to detect button presses.
         */

        this.previous = {

            ...this.buttons

        };


        /*
         * Keyboard mapping.
         */

        this.keyMap = {

            ArrowRight: "right",
            ArrowLeft: "left",
            ArrowUp: "up",
            ArrowDown: "down",

            KeyX: "a",
            KeyZ: "b",

            Enter: "start",

            Shift: "select"

        };


        /*
         * Alternative keyboard controls.
         */

        this.keyMapAlternative = {

            D: "right",
            A: "left",
            W: "up",
            S: "down",

            K: "a",
            J: "b",

            Q: "select",

            E: "start"

        };


        /*
         * Gamepad configuration.
         */

        this.gamepadIndex = null;

        this.gamepadConnected = false;


        /*
         * Callbacks
         */

        this.onChange = null;


        /*
         * Bind events.
         */

        this.bindKeyboard();

        this.bindGamepad();

    }


    /*
     * ========================================================
     * KEYBOARD
     * ========================================================
     */

    bindKeyboard() {

        window.addEventListener(
            "keydown",
            event => {

                this.handleKeyDown(
                    event
                );

            }
        );


        window.addEventListener(
            "keyup",
            event => {

                this.handleKeyUp(
                    event
                );

            }
        );

    }


    /*
     * ========================================================
     * KEY DOWN
     * ========================================================
     */

    handleKeyDown(event) {

        let button =
            this.keyMap[
                event.code
            ];


        /*
         * Alternative mapping.
         */

        if (!button) {

            button =
                this.keyMapAlternative[
                    event.key.toUpperCase()
                ];

        }


        if (!button) {

            return;

        }


        /*
         * Prevent browser actions.
         */

        event.preventDefault();


        if (
            !this.buttons[button]
        ) {

            this.buttons[button] =
                true;


            this.emitChange();

        }

    }


    /*
     * ========================================================
     * KEY UP
     * ========================================================
     */

    handleKeyUp(event) {

        let button =
            this.keyMap[
                event.code
            ];


        if (!button) {

            button =
                this.keyMapAlternative[
                    event.key.toUpperCase()
                ];

        }


        if (!button) {

            return;

        }


        event.preventDefault();


        if (
            this.buttons[button]
        ) {

            this.buttons[button] =
                false;


            this.emitChange();

        }

    }


    /*
     * ========================================================
     * GAMEPAD
     * ========================================================
     */

    bindGamepad() {

        window.addEventListener(
            "gamepadconnected",
            event => {

                this.gamepadIndex =
                    event.gamepad.index;

                this.gamepadConnected =
                    true;

                console.log(
                    `[WebBktx] Gamepad connected: ${event.gamepad.id}`
                );

            }
        );


        window.addEventListener(
            "gamepaddisconnected",
            event => {

                if (
                    this.gamepadIndex ===
                    event.gamepad.index
                ) {

                    this.gamepadIndex =
                        null;

                    this.gamepadConnected =
                        false;

                }

            }
        );

    }


    /*
     * ========================================================
     * UPDATE GAMEPAD
     * ========================================================
     *
     * Call this once per emulator frame.
     * ========================================================
     */

    updateGamepad() {

        const gamepads =
            navigator.getGamepads
                ? navigator.getGamepads()
                : [];


        let gamepad = null;


        /*
         * Prefer connected gamepad.
         */

        if (
            this.gamepadIndex !== null
        ) {

            gamepad =
                gamepads[
                    this.gamepadIndex
                ];

        }


        /*
         * Find first connected gamepad.
         */

        if (!gamepad) {

            for (
                const pad of gamepads
            ) {

                if (pad) {

                    gamepad =
                        pad;

                    break;

                }

            }

        }


        if (!gamepad) {

            return;

        }


        /*
         * Save previous state.
         */

        this.previous = {

            ...this.buttons

        };


        /*
         * Standard Gamepad mapping.
         *
         * 0 = A
         * 1 = B
         * 8 = Select
         * 9 = Start
         * 12 = Up
         * 13 = Down
         * 14 = Left
         * 15 = Right
         */

        this.buttons.a =
            this.isPressed(
                gamepad,
                0
            );


        this.buttons.b =
            this.isPressed(
                gamepad,
                1
            );


        this.buttons.select =
            this.isPressed(
                gamepad,
                8
            );


        this.buttons.start =
            this.isPressed(
                gamepad,
                9
            );


        this.buttons.up =
            this.isPressed(
                gamepad,
                12
            );


        this.buttons.down =
            this.isPressed(
                gamepad,
                13
            );


        this.buttons.left =
            this.isPressed(
                gamepad,
                14
            );


        this.buttons.right =
            this.isPressed(
                gamepad,
                15
            );


        /*
         * Analog stick support.
         */

        const axisX =
            gamepad.axes[0] || 0;

        const axisY =
            gamepad.axes[1] || 0;


        const deadZone =
            0.35;


        if (
            Math.abs(axisX) >
            deadZone
        ) {

            if (axisX > 0) {

                this.buttons.right =
                    true;

            }

            if (axisX < 0) {

                this.buttons.left =
                    true;

            }

        }


        if (
            Math.abs(axisY) >
            deadZone
        ) {

            if (axisY > 0) {

                this.buttons.down =
                    true;

            }

            if (axisY < 0) {

                this.buttons.up =
                    true;

            }

        }


        this.emitChange();

    }


    /*
     * ========================================================
     * BUTTON TEST
     * ========================================================
     */

    isPressed(
        gamepad,
        index
    ) {

        return Boolean(
            gamepad.buttons[index] &&
            gamepad.buttons[index].pressed
        );

    }


    /*
     * ========================================================
     * STATE
     * ========================================================
     */

    isDown(button) {

        return Boolean(
            this.buttons[button]
        );

    }


    /*
     * ========================================================
     * JUST PRESSED
     * ========================================================
     */

    justPressed(button) {

        return (
            this.buttons[button] &&
            !this.previous[button]
        );

    }


    /*
     * ========================================================
     * JUST RELEASED
     * ========================================================
     */

    justReleased(button) {

        return (
            !this.buttons[button] &&
            this.previous[button]
        );

    }


    /*
     * ========================================================
     * GET STATE
     * ========================================================
     */

    getState() {

        return {

            ...this.buttons

        };

    }


    /*
     * ========================================================
     * RESET
     * ========================================================
     */

    reset() {

        for (
            const button in this.buttons
        ) {

            this.buttons[button] =
                false;

        }

        this.previous = {

            ...this.buttons

        };

        this.emitChange();

    }


    /*
     * ========================================================
     * CALLBACK
     * ========================================================
     */

    emitChange() {

        if (
            typeof this.onChange ===
            "function"
        ) {

            this.onChange(
                this.getState()
            );

        }

    }


    /*
     * ========================================================
     * DESTROY
     * ========================================================
     */

    destroy() {

        /*
         * Keyboard listeners are normally
         * kept for the emulator lifetime.
         *
         * This method is reserved for
         * future event cleanup.
         */

        this.reset();

    }

}
