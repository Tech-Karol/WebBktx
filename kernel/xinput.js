/*
 * ============================================================
 * WebBktx XInput
 *
 * Version: 1.0
 *
 * Xbox-compatible input abstraction
 *
 * Sources:
 *   - Physical Gamepad
 *   - Keyboard
 *   - Mouse
 *   - Touchscreen
 *
 * Features:
 *   - Xbox controller state
 *   - Automatic gamepad detection
 *   - Keyboard mapping
 *   - Mouse mapping
 *   - Touch detection
 *   - Virtual Xbox controller
 *   - Automatic virtual controller visibility
 *   - Button/axis state
 *   - Multiple input sources
 *   - Event callbacks
 *
 * No PWA.
 * No online services.
 * No cache.
 *
 * ============================================================
 */

"use strict";


/* ============================================================
   CONSTANTS
============================================================ */

const WEBBKTX_XINPUT_VERSION = "1.0";


const XINPUT_BUTTONS = {

    A:        "A",
    B:        "B",
    X:        "X",
    Y:        "Y",

    LB:       "LB",
    RB:       "RB",

    BACK:     "BACK",
    START:    "START",

    LS:       "LS",
    RS:       "RS",

    DPAD_UP:    "DPAD_UP",
    DPAD_DOWN:  "DPAD_DOWN",
    DPAD_LEFT:  "DPAD_LEFT",
    DPAD_RIGHT: "DPAD_RIGHT",

    GUIDE: "GUIDE"

};


/* ============================================================
   DEFAULT KEYBOARD MAP
============================================================ */

const DEFAULT_KEYBOARD_MAP = {

    /*
     * Movement
     */

    KeyW: "LS_UP",
    KeyS: "LS_DOWN",
    KeyA: "LS_LEFT",
    KeyD: "LS_RIGHT",

    /*
     * Right stick
     */

    ArrowUp:    "RS_UP",
    ArrowDown:  "RS_DOWN",
    ArrowLeft:  "RS_LEFT",
    ArrowRight: "RS_RIGHT",

    /*
     * Buttons
     */

    Space: "A",
    KeyE:  "B",
    KeyQ:  "X",
    KeyR:  "Y",

    /*
     * Shoulders
     */

    ShiftLeft:  "LB",
    ShiftRight: "RB",

    /*
     * Triggers
     */

    ControlLeft:  "LT",
    ControlRight: "RT",

    /*
     * System
     */

    Enter: "START",
    Backspace: "BACK",

    /*
     * D-Pad
     */

    Digit8: "DPAD_UP",
    Digit2: "DPAD_DOWN",
    Digit4: "DPAD_LEFT",
    Digit6: "DPAD_RIGHT"

};


/* ============================================================
   XINPUT STATE
============================================================ */

class WebBktxXInputState {

    constructor() {

        this.buttons = {};

        for (
            const button
            of Object.values(XINPUT_BUTTONS)
        ) {

            this.buttons[button] = false;

        }


        this.axes = {

            leftX:  0,
            leftY:  0,

            rightX: 0,
            rightY: 0,

            leftTrigger:  0,
            rightTrigger: 0

        };


        this.connected = false;

        this.source = "none";

        this.gamepadIndex = null;

        this.timestamp = 0;

    }


    clone() {

        const state =
            new WebBktxXInputState();


        state.buttons = {
            ...this.buttons
        };


        state.axes = {
            ...this.axes
        };


        state.connected =
            this.connected;


        state.source =
            this.source;


        state.gamepadIndex =
            this.gamepadIndex;


        state.timestamp =
            this.timestamp;


        return state;

    }

}


/* ============================================================
   XINPUT
============================================================ */

class WebBktxXInput {

    constructor(options = {}) {

        this.version =
            WEBBKTX_XINPUT_VERSION;


        this.enabled =
            options.enabled !== false;


        this.keyboardEnabled =
            options.keyboard !== false;


        this.mouseEnabled =
            options.mouse !== false;


        this.touchEnabled =
            options.touch !== false;


        this.gamepadEnabled =
            options.gamepad !== false;


        this.virtualController =
            options.virtualController !== false;


        this.virtualControllerElement =
            null;


        this.state =
            new WebBktxXInputState();


        this.previousState =
            this.state.clone();


        this.keyboardMap = {

            ...DEFAULT_KEYBOARD_MAP,

            ...(options.keyboardMap || {})

        };


        this.keys =
            new Set();


        this.mouse = {

            x: 0,
            y: 0,

            buttons: new Set(),

            locked: false

        };


        this.touch = {

            active: false,

            touches: new Map()

        };


        this.gamepads =
            new Map();


        this.selectedGamepadIndex =
            null;


        this.listeners = {

            input: [],

            button: [],

            axis: [],

            connect: [],

            disconnect: [],

            touch: []

        };


        this.initialized =
            false;


        this.animationFrame =
            null;


        this._bound = {};

    }


    /* ========================================================
       INITIALIZE
    ======================================================== */

    initialize() {

        if (this.initialized) {

            return true;

        }


        if (!this.enabled) {

            return false;

        }


        this._bindKeyboard();

        this._bindMouse();

        this._bindTouch();

        this._bindGamepad();


        this.initialized =
            true;


        this._scanGamepads();


        this._startUpdateLoop();


        this._updateVirtualControllerVisibility();


        return true;

    }


    /* ========================================================
       EVENT SYSTEM
    ======================================================== */

    on(type, callback) {

        if (
            !this.listeners[type] ||
            typeof callback !== "function"
        ) {

            return () => {};

        }


        this.listeners[type].push(
            callback
        );


        return () => {

            const list =
                this.listeners[type];


            const index =
                list.indexOf(callback);


            if (index !== -1) {

                list.splice(
                    index,
                    1
                );

            }

        };

    }


    _emit(type, data) {

        const list =
            this.listeners[type];


        if (!list) {

            return;

        }


        for (
            const callback
            of [...list]
        ) {

            try {

                callback(data);

            } catch (error) {

                console.error(
                    "[WebBktx XInput] Listener error:",
                    error
                );

            }

        }

    }


    /* ========================================================
       KEYBOARD
    ======================================================== */

    _bindKeyboard() {

        if (
            !this.keyboardEnabled ||
            typeof window === "undefined"
        ) {

            return;

        }


        this._bound.keydown =
            event => {

                this.keys.add(
                    event.code
                );


                /*
                 * Prevent browser shortcuts
                 * for mapped game controls.
                 */

                if (
                    this.keyboardMap[event.code]
                ) {

                    event.preventDefault();

                }

            };


        this._bound.keyup =
            event => {

                this.keys.delete(
                    event.code
                );

            };


        window.addEventListener(
            "keydown",
            this._bound.keydown,
            {
                passive: false
            }
        );


        window.addEventListener(
            "keyup",
            this._bound.keyup,
            {
                passive: false
            }
        );


        window.addEventListener(
            "blur",
            () => {

                this.keys.clear();

            }
        );

    }


    _isKeyPressed(code) {

        return this.keys.has(code);

    }


    _applyKeyboard(state) {

        if (!this.keyboardEnabled) {

            return;

        }


        for (
            const [key, action]
            of Object.entries(
                this.keyboardMap
            )
        ) {

            if (
                !this._isKeyPressed(key)
            ) {

                continue;

            }


            if (
                action.startsWith("LS_")
            ) {

                if (
                    action === "LS_LEFT"
                ) {

                    state.axes.leftX = -1;

                } else if (
                    action === "LS_RIGHT"
                ) {

                    state.axes.leftX = 1;

                } else if (
                    action === "LS_UP"
                ) {

                    state.axes.leftY = -1;

                } else if (
                    action === "LS_DOWN"
                ) {

                    state.axes.leftY = 1;

                }

                continue;

            }


            if (
                action.startsWith("RS_")
            ) {

                if (
                    action === "RS_LEFT"
                ) {

                    state.axes.rightX = -1;

                } else if (
                    action === "RS_RIGHT"
                ) {

                    state.axes.rightX = 1;

                } else if (
                    action === "RS_UP"
                ) {

                    state.axes.rightY = -1;

                } else if (
                    action === "RS_DOWN"
                ) {

                    state.axes.rightY = 1;

                }

                continue;

            }


            if (
                action === "LT"
            ) {

                state.axes.leftTrigger = 1;

                continue;

            }


            if (
                action === "RT"
            ) {

                state.axes.rightTrigger = 1;

                continue;

            }


            if (
                state.buttons[action] !==
                undefined
            ) {

                state.buttons[action] =
                    true;

            }

        }

    }


    /* ========================================================
       MOUSE
    ======================================================== */

    _bindMouse() {

        if (
            !this.mouseEnabled ||
            typeof window === "undefined"
        ) {

            return;

        }


        this._bound.mousemove =
            event => {

                this.mouse.x =
                    event.movementX || 0;


                this.mouse.y =
                    event.movementY || 0;

            };


        this._bound.mousedown =
            event => {

                this.mouse.buttons.add(
                    event.button
                );

            };


        this._bound.mouseup =
            event => {

                this.mouse.buttons.delete(
                    event.button
                );

            };


        window.addEventListener(
            "mousemove",
            this._bound.mousemove,
            {
                passive: true
            }
        );


        window.addEventListener(
            "mousedown",
            this._bound.mousedown
        );


        window.addEventListener(
            "mouseup",
            this._bound.mouseup
        );


        window.addEventListener(
            "blur",
            () => {

                this.mouse.buttons.clear();

                this.mouse.x = 0;
                this.mouse.y = 0;

            }
        );

    }


    _applyMouse(state) {

        if (!this.mouseEnabled) {

            return;

        }


        /*
         * Mouse buttons.
         *
         * Left  -> A
         * Right -> B
         * Middle -> X
         */

        if (
            this.mouse.buttons.has(0)
        ) {

            state.buttons.A = true;

        }


        if (
            this.mouse.buttons.has(2)
        ) {

            state.buttons.B = true;

        }


        if (
            this.mouse.buttons.has(1)
        ) {

            state.buttons.X = true;

        }


        /*
         * Mouse movement controls
         * right stick.
         */

        const sensitivity =
            0.035;


        state.axes.rightX =
            Math.max(
                -1,
                Math.min(
                    1,
                    this.mouse.x *
                    sensitivity
                )
            );


        state.axes.rightY =
            Math.max(
                -1,
                Math.min(
                    1,
                    this.mouse.y *
                    sensitivity
                )
            );


        /*
         * Movement is consumed each frame.
         */

        this.mouse.x = 0;
        this.mouse.y = 0;

    }


    /* ========================================================
       TOUCH
    ======================================================== */

    _bindTouch() {

        if (
            !this.touchEnabled ||
            typeof window === "undefined"
        ) {

            return;

        }


        const updateTouch =
            event => {

                this.touch.active =
                    event.touches.length > 0;


                this.touch.touches.clear();


                for (
                    const touch
                    of event.touches
                ) {

                    this.touch.touches.set(
                        touch.identifier,
                        {

                            x: touch.clientX,
                            y: touch.clientY

                        }
                    );

                }


                this._updateVirtualControllerVisibility();


                this._emit(
                    "touch",
                    {

                        active:
                            this.touch.active,

                        touches:
                            this.touch.touches

                    }
                );

            };


        window.addEventListener(
            "touchstart",
            updateTouch,
            {
                passive: true
            }
        );


        window.addEventListener(
            "touchmove",
            updateTouch,
            {
                passive: true
            }
        );


        window.addEventListener(
            "touchend",
            updateTouch,
            {
                passive: true
            }
        );


        window.addEventListener(
            "touchcancel",
            updateTouch,
            {
                passive: true
            }
        );

    }


    _applyTouch(state) {

        if (
            !this.touchEnabled
        ) {

            return;

        }


        /*
         * The virtual controller itself
         * handles touch zones.
         *
         * This fallback detects generic
         * screen touches.
         *
         * A touch on the left side behaves
         * like A.
         */

        for (
            const touch
            of this.touch.touches.values()
        ) {

            const width =
                typeof window !== "undefined"
                    ? window.innerWidth
                    : 1;


            if (
                touch.x <
                width * 0.25
            ) {

                state.buttons.A = true;

            }

        }

    }


    /* ========================================================
       GAMEPAD
    ======================================================== */

    _bindGamepad() {

        if (
            !this.gamepadEnabled ||
            typeof window === "undefined"
        ) {

            return;

        }


        this._bound.gamepadconnected =
            event => {

                const gamepad =
                    event.gamepad;


                this.gamepads.set(
                    gamepad.index,
                    gamepad
                );


                if (
                    this.selectedGamepadIndex ===
                    null
                ) {

                    this.selectedGamepadIndex =
                        gamepad.index;

                }


                this._emit(
                    "connect",
                    gamepad
                );

            };


        this._bound.gamepaddisconnected =
            event => {

                const index =
                    event.gamepad.index;


                this.gamepads.delete(
                    index
                );


                if (
                    this.selectedGamepadIndex ===
                    index
                ) {

                    this.selectedGamepadIndex =
                        null;

                }


                this._emit(
                    "disconnect",
                    event.gamepad
                );

            };


        window.addEventListener(
            "gamepadconnected",
            this._bound.gamepadconnected
        );


        window.addEventListener(
            "gamepaddisconnected",
            this._bound.gamepaddisconnected
        );

    }


    _scanGamepads() {

        if (
            !this.gamepadEnabled ||
            typeof navigator === "undefined" ||
            typeof navigator.getGamepads !==
            "function"
        ) {

            return;

        }


        const pads =
            navigator.getGamepads();


        for (
            const pad
            of pads
        ) {

            if (!pad) {

                continue;

            }


            this.gamepads.set(
                pad.index,
                pad
            );

        }


        if (
            this.selectedGamepadIndex ===
            null
        ) {

            for (
                const pad
                of this.gamepads.values()
            ) {

                if (pad.connected) {

                    this.selectedGamepadIndex =
                        pad.index;

                    break;

                }

            }

        }

    }


    _applyGamepad(state) {

        if (
            !this.gamepadEnabled
        ) {

            return;

        }


        this._scanGamepads();


        if (
            this.selectedGamepadIndex ===
            null
        ) {

            return;

        }


        const pad =
            this.gamepads.get(
                this.selectedGamepadIndex
            );


        if (
            !pad ||
            !pad.connected
        ) {

            return;

        }


        state.connected = true;

        state.source = "gamepad";

        state.gamepadIndex =
            pad.index;


        /*
         * Standard Gamepad mapping.
         */

        const button =
            index =>
                !!(
                    pad.buttons[index] &&
                    pad.buttons[index].pressed
                );


        state.buttons.A =
            state.buttons.A ||
            button(0);


        state.buttons.B =
            state.buttons.B ||
            button(1);


        state.buttons.X =
            state.buttons.X ||
            button(2);


        state.buttons.Y =
            state.buttons.Y ||
            button(3);


        state.buttons.LB =
            state.buttons.LB ||
            button(4);


        state.buttons.RB =
            state.buttons.RB ||
            button(5);


        state.buttons.BACK =
            state.buttons.BACK ||
            button(8);


        state.buttons.START =
            state.buttons.START ||
            button(9);


        state.buttons.LS =
            state.buttons.LS ||
            button(10);


        state.buttons.RS =
            state.buttons.RS ||
            button(11);


        state.buttons.DPAD_UP =
            state.buttons.DPAD_UP ||
            button(12);


        state.buttons.DPAD_DOWN =
            state.buttons.DPAD_DOWN ||
            button(13);


        state.buttons.DPAD_LEFT =
            state.buttons.DPAD_LEFT ||
            button(14);


        state.buttons.DPAD_RIGHT =
            state.buttons.DPAD_RIGHT ||
            button(15);


        /*
         * Standard axes.
         */

        state.axes.leftX =
            pad.axes[0] || 0;


        state.axes.leftY =
            pad.axes[1] || 0;


        state.axes.rightX =
            pad.axes[2] || 0;


        state.axes.rightY =
            pad.axes[3] || 0;


        /*
         * Triggers.
         *
         * Standard mapping:
         *
         * LT = button 6
         * RT = button 7
         */

        if (
            pad.buttons[6]
        ) {

            state.axes.leftTrigger =
                pad.buttons[6].value;

        }


        if (
            pad.buttons[7]
        ) {

            state.axes.rightTrigger =
                pad.buttons[7].value;

        }

    }


    /* ========================================================
       STATE UPDATE
    ======================================================== */

    update() {

        if (!this.initialized) {

            this.initialize();

        }


        const next =
            new WebBktxXInputState();


        /*
         * Keyboard
         */

        this._applyKeyboard(
            next
        );


        /*
         * Mouse
         */

        this._applyMouse(
            next
        );


        /*
         * Touch
         */

        this._applyTouch(
            next
        );


        /*
         * Gamepad
         */

        this._applyGamepad(
            next
        );


        /*
         * Determine whether any
         * input is active.
         */

        next.connected =
            next.connected ||
            this._hasKeyboardInput() ||
            this.mouse.buttons.size > 0 ||
            this.touch.active;


        next.timestamp =
            performance.now();


        this._emitChanges(
            this.previousState,
            next
        );


        this.previousState =
            next.clone();


        this.state =
            next;


        return this.state;

    }


    _hasKeyboardInput() {

        return (
            this.keys.size > 0
        );

    }


    _emitChanges(
        oldState,
        newState
    ) {

        for (
            const name
            of Object.values(XINPUT_BUTTONS)
        ) {

            if (
                oldState.buttons[name] !==
                newState.buttons[name]
            ) {

                this._emit(
                    "button",
                    {

                        button: name,

                        pressed:
                            newState.buttons[name]

                    }
                );

            }

        }


        for (
            const axis
            of Object.keys(
                newState.axes
            )
        ) {

            if (
                oldState.axes[axis] !==
                newState.axes[axis]
            ) {

                this._emit(
                    "axis",
                    {

                        axis,

                        value:
                            newState.axes[axis]

                    }
                );

            }

        }


        this._emit(
            "input",
            newState
        );

    }


    /* ========================================================
       UPDATE LOOP
    ======================================================== */

    _startUpdateLoop() {

        if (
            typeof requestAnimationFrame !==
            "function"
        ) {

            return;

        }


        const loop =
            () => {

                if (!this.enabled) {

                    return;

                }


                this.update();


                this.animationFrame =
                    requestAnimationFrame(
                        loop
                    );

            };


        this.animationFrame =
            requestAnimationFrame(
                loop
            );

    }


    /* ========================================================
       VIRTUAL CONTROLLER
    ======================================================== */

    createVirtualController() {

        if (
            typeof document ===
            "undefined"
        ) {

            return null;

        }


        if (
            this.virtualControllerElement
        ) {

            return this.virtualControllerElement;

        }


        const root =
            document.createElement(
                "div"
            );


        root.id =
            "webbktx-virtual-xinput";


        root.setAttribute(
            "aria-label",
            "WebBktx Virtual Xbox Controller"
        );


        /*
         * Root layout.
         */

        Object.assign(
            root.style,
            {

                position: "fixed",

                left: "0",
                right: "0",

                bottom: "0",

                height: "42vh",

                minHeight: "220px",

                zIndex: "99999",

                pointerEvents: "none",

                userSelect: "none",

                touchAction: "none",

                display: "none"

            }
        );


        /*
         * Create controls.
         */

        this._createVirtualDPad(
            root
        );


        this._createVirtualButtons(
            root
        );


        this._createVirtualShoulders(
            root
        );


        document.body.appendChild(
            root
        );


        this.virtualControllerElement =
            root;


        this._updateVirtualControllerVisibility();


        return root;

    }


    _createVirtualDPad(root) {

        const pad =
            document.createElement(
                "div"
            );


        Object.assign(
            pad.style,
            {

                position: "absolute",

                left: "7%",

                top: "25%",

                width: "120px",

                height: "120px",

                pointerEvents: "auto"

            }
        );


        const create =
            (name, text, left, top) => {

                const button =
                    document.createElement(
                        "button"
                    );


                button.textContent =
                    text;


                button.dataset.xinput =
                    name;


                Object.assign(
                    button.style,
                    {

                        position: "absolute",

                        left,
                        top,

                        width: "40px",
                        height: "40px",

                        fontSize: "18px",

                        opacity: "0.75",

                        touchAction: "none"

                    }
                );


                this._bindVirtualButton(
                    button,
                    name
                );


                pad.appendChild(
                    button
                );

            };


        create(
            "DPAD_UP",
            "▲",
            "40px",
            "0"
        );


        create(
            "DPAD_DOWN",
            "▼",
            "40px",
            "80px"
        );


        create(
            "DPAD_LEFT",
            "◀",
            "0",
            "40px"
        );


        create(
            "DPAD_RIGHT",
            "▶",
            "80px",
            "40px"
        );


        root.appendChild(
            pad
        );

    }


    _createVirtualButtons(root) {

        const container =
            document.createElement(
                "div"
            );


        Object.assign(
            container.style,
            {

                position: "absolute",

                right: "7%",

                top: "18%",

                width: "150px",

                height: "150px",

                pointerEvents: "none"

            }
        );


        const definitions = [

            ["Y", "Y", "55px", "0"],
            ["X", "X", "0", "55px"],
            ["B", "B", "110px", "55px"],
            ["A", "A", "55px", "110px"]

        ];


        for (
            const [
                name,
                text,
                left,
                top
            ]
            of definitions
        ) {

            const button =
                document.createElement(
                    "button"
                );


            button.textContent =
                text;


            button.dataset.xinput =
                name;


            Object.assign(
                button.style,
                {

                    position: "absolute",

                    left,
                    top,

                    width: "40px",
                    height: "40px",

                    fontWeight: "bold",

                    opacity: "0.75",

                    pointerEvents: "auto",

                    touchAction: "none"

                }
            );


            this._bindVirtualButton(
                button,
                name
            );


            container.appendChild(
                button
            );

        }


        root.appendChild(
            container
        );

    }


    _createVirtualShoulders(root) {

        const definitions = [

            ["LB", "LB", "12%"],
            ["RB", "RB", "78%"]

        ];


        for (
            const [
                name,
                text,
                left
            ]
            of definitions
        ) {

            const button =
                document.createElement(
                    "button"
                );


            button.textContent =
                text;


            button.dataset.xinput =
                name;


            Object.assign(
                button.style,
                {

                    position: "absolute",

                    left,

                    top: "5%",

                    width: "70px",

                    height: "38px",

                    opacity: "0.75",

                    pointerEvents: "auto",

                    touchAction: "none"

                }
            );


            this._bindVirtualButton(
                button,
                name
            );


            root.appendChild(
                button
            );

        }

    }


    _bindVirtualButton(
        element,
        button
    ) {

        const press =
            event => {

                event.preventDefault();

                element.setPointerCapture?.(
                    event.pointerId
                );


                this._virtualButtons =
                    this._virtualButtons ||
                    new Set();


                this._virtualButtons.add(
                    button
                );

            };


        const release =
            event => {

                event.preventDefault();


                if (
                    this._virtualButtons
                ) {

                    this._virtualButtons.delete(
                        button
                    );

                }

            };


        element.addEventListener(
            "pointerdown",
            press,
            {
                passive: false
            }
        );


        element.addEventListener(
            "pointerup",
            release,
            {
                passive: false
            }
        );


        element.addEventListener(
            "pointercancel",
            release,
            {
                passive: false
            }
        );


        element.addEventListener(
            "pointerleave",
            release,
            {
                passive: false
            }
        );

    }


    _applyVirtualButtons(state) {

        if (
            !this._virtualButtons
        ) {

            return;

        }


        for (
            const button
            of this._virtualButtons
        ) {

            if (
                state.buttons[button] !==
                undefined
            ) {

                state.buttons[button] =
                    true;

            }

        }

    }


    _updateVirtualControllerVisibility() {

        if (
            !this.virtualController
        ) {

            return;

        }


        if (
            !this.virtualControllerElement
        ) {

            this.createVirtualController();

        }


        if (
            !this.virtualControllerElement
        ) {

            return;

        }


        const touchDevice =
            (
                this.touchEnabled &&
                (
                    this.touch.active ||
                    (
                        typeof navigator !==
                        "undefined" &&
                        navigator.maxTouchPoints > 0
                    )
                )
            );


        /*
         * Only display the virtual pad
         * on touch-capable devices.
         *
         * A physical gamepad does not
         * require the virtual UI.
         */

        this.virtualControllerElement.style.display =
            touchDevice
                ? "block"
                : "none";

    }


    /* ========================================================
       PUBLIC STATE
    ======================================================== */

    getState() {

        const state =
            this.state.clone();


        /*
         * Virtual buttons are applied
         * at read time too.
         */

        this._applyVirtualButtons(
            state
        );


        return state;

    }


    isPressed(button) {

        const state =
            this.getState();


        return !!state.buttons[
            button
        ];

    }


    getAxis(axis) {

        const state =
            this.getState();


        return state.axes[
            axis
        ] ?? 0;

    }


    /* ========================================================
       GAMEPAD SELECTION
    ======================================================== */

    getGamepads() {

        return Array.from(
            this.gamepads.values()
        );

    }


    selectGamepad(index) {

        if (
            !this.gamepads.has(index)
        ) {

            return false;

        }


        this.selectedGamepadIndex =
            index;


        return true;

    }


    /* ========================================================
       RESET
    ======================================================== */

    reset() {

        this.keys.clear();

        this.mouse.buttons.clear();

        this.touch.touches.clear();

        this.touch.active =
            false;


        this.state =
            new WebBktxXInputState();


        this.previousState =
            this.state.clone();

    }


    /* ========================================================
       DESTROY
    ======================================================== */

    destroy() {

        if (
            this.animationFrame !==
            null &&
            typeof cancelAnimationFrame ===
            "function"
        ) {

            cancelAnimationFrame(
                this.animationFrame
            );

        }


        if (
            typeof window !== "undefined"
        ) {

            if (
                this._bound.keydown
            ) {

                window.removeEventListener(
                    "keydown",
                    this._bound.keydown
                );

            }


            if (
                this._bound.keyup
            ) {

                window.removeEventListener(
                    "keyup",
                    this._bound.keyup
                );

            }


            if (
                this._bound.mousemove
            ) {

                window.removeEventListener(
                    "mousemove",
                    this._bound.mousemove
                );

            }


            if (
                this._bound.mousedown
            ) {

                window.removeEventListener(
                    "mousedown",
                    this._bound.mousedown
                );

            }


            if (
                this._bound.mouseup
            ) {

                window.removeEventListener(
                    "mouseup",
                    this._bound.mouseup
                );

            }


            if (
                this._bound.gamepadconnected
            ) {

                window.removeEventListener(
                    "gamepadconnected",
                    this._bound.gamepadconnected
                );

            }


            if (
                this._bound.gamepaddisconnected
            ) {

                window.removeEventListener(
                    "gamepaddisconnected",
                    this._bound.gamepaddisconnected
                );

            }

        }


        if (
            this.virtualControllerElement
        ) {

            this.virtualControllerElement.remove();

        }


        this.virtualControllerElement =
            null;


        this.initialized =
            false;

    }


    /* ========================================================
       STATUS
    ======================================================== */

    getStatus() {

        return {

            version:
                this.version,

            initialized:
                this.initialized,

            keyboard:
                this.keyboardEnabled,

            mouse:
                this.mouseEnabled,

            touch:
                this.touchEnabled,

            gamepad:
                this.gamepadEnabled,

            virtualController:
                this.virtualController,

            connected:
                this.state.connected,

            source:
                this.state.source,

            gamepads:
                this.getGamepads().length,

            selectedGamepad:
                this.selectedGamepadIndex

        };

    }

}


/* ============================================================
   GLOBAL API
============================================================ */

window.WebBktxXInput =
    WebBktxXInput;


window.WebBktxXInputState =
    WebBktxXInputState;


window.WebBktxXInputButtons =
    XINPUT_BUTTONS;


window.WebBktxXInputKeyboardMap =
    DEFAULT_KEYBOARD_MAP;


/* ============================================================
   READY
============================================================ */

console.log(
    `WebBktx XInput ${WEBBKTX_XINPUT_VERSION} loaded.`
);
