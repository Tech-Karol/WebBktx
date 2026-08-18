/*
 * ============================================================
 * WebBktx — Game Boy DMG Audio / APU
 * ============================================================
 *
 * 4 kanały:
 *
 *   CH1 - Square + Sweep
 *   CH2 - Square
 *   CH3 - Wave
 *   CH4 - Noise
 *
 * Web Audio API
 *
 * ============================================================
 */

export default class GameBoyAudio {

    constructor(memory) {

        this.memory = memory;

        this.audioContext = null;

        this.masterGain = null;

        this.enabled = false;

        this.started = false;

        /*
         * Aktualny stan kanałów.
         */

        this.channels = {

            square1: {
                enabled: false,
                frequency: 440,
                volume: 0
            },

            square2: {
                enabled: false,
                frequency: 440,
                volume: 0
            },

            wave: {
                enabled: false,
                frequency: 440,
                volume: 0
            },

            noise: {
                enabled: false,
                volume: 0
            }

        };

        /*
         * Web Audio nodes.
         */

        this.nodes = {

            square1: null,
            square2: null,
            wave: null,
            noise: null

        };

        /*
         * Master volume.
         */

        this.volume = 0.15;

    }


    /*
     * ========================================================
     * START AUDIO
     * ========================================================
     *
     * Musi być wywołane po interakcji użytkownika
     * z przeglądarką.
     * ========================================================
     */

    start() {

        if (this.started) {

            return;

        }

        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContext) {

            console.warn(
                "[WebBktx] Web Audio API unavailable."
            );

            return;

        }

        this.audioContext =
            new AudioContext();


        this.masterGain =
            this.audioContext.createGain();


        this.masterGain.gain.value =
            this.volume;


        this.masterGain.connect(
            this.audioContext.destination
        );


        this.started = true;

        this.enabled = true;


        /*
         * Uruchomienie kanałów.
         */

        this.createSquare1();

        this.createSquare2();

        this.createWave();

        this.createNoise();


        console.log(
            "[WebBktx] Game Boy audio started."
        );

    }


    /*
     * ========================================================
     * RESUME
     * ========================================================
     */

    async resume() {

        if (!this.audioContext) {

            this.start();

        }

        if (
            this.audioContext &&
            this.audioContext.state ===
            "suspended"
        ) {

            await this.audioContext.resume();

        }

    }


    /*
     * ========================================================
     * STOP
     * ========================================================
     */

    stop() {

        if (!this.audioContext) {

            return;

        }

        this.stopChannel(
            "square1"
        );

        this.stopChannel(
            "square2"
        );

        this.stopChannel(
            "wave"
        );

        this.stopChannel(
            "noise"
        );


        this.enabled = false;

    }


    /*
     * ========================================================
     * RESET
     * ========================================================
     */

    reset() {

        this.stop();

        this.channels.square1.enabled =
            false;

        this.channels.square2.enabled =
            false;

        this.channels.wave.enabled =
            false;

        this.channels.noise.enabled =
            false;

    }


    /*
     * ========================================================
     * CHANNEL 1
     * ========================================================
     *
     * NR10 - Sweep
     * NR11 - Duty/Length
     * NR12 - Volume/Envelope
     * NR13 - Frequency low
     * NR14 - Frequency high
     * ========================================================
     */

    createSquare1() {

        if (!this.audioContext) {

            return;

        }

        const oscillator =
            this.audioContext
                .createOscillator();


        const gain =
            this.audioContext
                .createGain();


        oscillator.type =
            "square";


        gain.gain.value =
            0;


        oscillator.connect(
            gain
        );


        gain.connect(
            this.masterGain
        );


        oscillator.start();


        this.nodes.square1 = {

            oscillator,
            gain

        };

    }


    /*
     * ========================================================
     * CHANNEL 2
     * ========================================================
     */

    createSquare2() {

        if (!this.audioContext) {

            return;

        }

        const oscillator =
            this.audioContext
                .createOscillator();


        const gain =
            this.audioContext
                .createGain();


        oscillator.type =
            "square";


        gain.gain.value =
            0;


        oscillator.connect(
            gain
        );


        gain.connect(
            this.masterGain
        );


        oscillator.start();


        this.nodes.square2 = {

            oscillator,
            gain

        };

    }


    /*
     * ========================================================
     * CHANNEL 3
     * ========================================================
     */

    createWave() {

        if (!this.audioContext) {

            return;

        }

        const oscillator =
            this.audioContext
                .createOscillator();


        const gain =
            this.audioContext
                .createGain();


        oscillator.type =
            "sine";


        gain.gain.value =
            0;


        oscillator.connect(
            gain
        );


        gain.connect(
            this.masterGain
        );


        oscillator.start();


        this.nodes.wave = {

            oscillator,
            gain

        };

    }


    /*
     * ========================================================
     * CHANNEL 4
     * ========================================================
     *
     * Noise generator.
     * ========================================================
     */

    createNoise() {

        if (!this.audioContext) {

            return;

        }

        const bufferSize =
            this.audioContext.sampleRate;


        const buffer =
            this.audioContext
                .createBuffer(
                    1,
                    bufferSize,
                    this.audioContext.sampleRate
                );


        const data =
            buffer.getChannelData(0);


        /*
         * White noise.
         */

        for (
            let i = 0;
            i < bufferSize;
            i++
        ) {

            data[i] =
                Math.random() * 2 - 1;

        }


        const source =
            this.audioContext
                .createBufferSource();


        const gain =
            this.audioContext
                .createGain();


        source.buffer =
            buffer;


        source.loop =
            true;


        gain.gain.value =
            0;


        source.connect(
            gain
        );


        gain.connect(
            this.masterGain
        );


        source.start();


        this.nodes.noise = {

            source,
            gain

        };

    }


    /*
     * ========================================================
     * UPDATE
     * ========================================================
     *
     * Wywoływane przez emulator.
     * ========================================================
     */

    update() {

        if (!this.started) {

            return;

        }


        this.updateSquare1();

        this.updateSquare2();

        this.updateWave();

        this.updateNoise();

    }


    /*
     * ========================================================
     * SQUARE 1
     * ========================================================
     */

    updateSquare1() {

        const nr12 =
            this.memory.read(
                0xFF12
            );


        const nr13 =
            this.memory.read(
                0xFF13
            );


        const nr14 =
            this.memory.read(
                0xFF14
            );


        const volume =
            (nr12 >> 4) & 0x0F;


        const frequency =
            (
                ((nr14 & 0x07) << 8) |
                nr13
            );


        /*
         * Game Boy frequency:
         *
         * 131072 / (2048 - frequency)
         */

        const hz =
            131072 /
            Math.max(
                1,
                2048 - frequency
            );


        this.channels.square1.frequency =
            hz;


        this.channels.square1.volume =
            volume / 15;


        this.channels.square1.enabled =
            Boolean(
                nr14 & 0x80
            );


        this.applySquare(
            "square1"
        );

    }


    /*
     * ========================================================
     * SQUARE 2
     * ========================================================
     */

    updateSquare2() {

        const nr22 =
            this.memory.read(
                0xFF17
            );


        const nr23 =
            this.memory.read(
                0xFF18
            );


        const nr24 =
            this.memory.read(
                0xFF19
            );


        const volume =
            (nr22 >> 4) & 0x0F;


        const frequency =
            (
                ((nr24 & 0x07) << 8) |
                nr23
            );


        const hz =
            131072 /
            Math.max(
                1,
                2048 - frequency
            );


        this.channels.square2.frequency =
            hz;


        this.channels.square2.volume =
            volume / 15;


        this.channels.square2.enabled =
            Boolean(
                nr24 & 0x80
            );


        this.applySquare(
            "square2"
        );

    }


    /*
     * ========================================================
     * WAVE
     * ========================================================
     */

    updateWave() {

        const nr30 =
            this.memory.read(
                0xFF1A
            );


        const nr33 =
            this.memory.read(
                0xFF1D
            );


        const nr34 =
            this.memory.read(
                0xFF1E
            );


        const nr32 =
            this.memory.read(
                0xFF1C
            );


        const frequency =
            (
                ((nr34 & 0x07) << 8) |
                nr33
            );


        const hz =
            65536 /
            Math.max(
                1,
                2048 - frequency
            );


        const volumeCode =
            (nr32 >> 5) & 0x03;


        let volume =
            0;


        switch (
            volumeCode
        ) {

            case 1:
                volume = 1;
                break;

            case 2:
                volume = 0.5;
                break;

            case 3:
                volume = 0.25;
                break;

        }


        this.channels.wave.frequency =
            hz;


        this.channels.wave.volume =
            volume;


        this.channels.wave.enabled =
            Boolean(
                nr30 & 0x80
            );


        this.applyWave();

    }


    /*
     * ========================================================
     * NOISE
     * ========================================================
     */

    updateNoise() {

        const nr42 =
            this.memory.read(
                0xFF21
            );


        const volume =
            (nr42 >> 4) & 0x0F;


        this.channels.noise.volume =
            volume / 15;


        this.channels.noise.enabled =
            volume > 0;


        this.applyNoise();

    }


    /*
     * ========================================================
     * APPLY SQUARE
     * ========================================================
     */

    applySquare(channelName) {

        const channel =
            this.channels[
                channelName
            ];


        const node =
            this.nodes[
                channelName
            ];


        if (!node) {

            return;

        }


        const now =
            this.audioContext.currentTime;


        node.oscillator.frequency
            .setTargetAtTime(
                channel.frequency,
                now,
                0.001
            );


        node.gain.gain
            .setTargetAtTime(
                channel.enabled
                    ? channel.volume
                    : 0,
                now,
                0.002
            );

    }


    /*
     * ========================================================
     * APPLY WAVE
     * ========================================================
     */

    applyWave() {

        const channel =
            this.channels.wave;


        const node =
            this.nodes.wave;


        if (!node) {

            return;

        }


        const now =
            this.audioContext.currentTime;


        node.oscillator.frequency
            .setTargetAtTime(
                channel.frequency,
                now,
                0.001
            );


        node.gain.gain
            .setTargetAtTime(
                channel.enabled
                    ? channel.volume
                    : 0,
                now,
                0.002
            );

    }


    /*
     * ========================================================
     * APPLY NOISE
     * ========================================================
     */

    applyNoise() {

        const channel =
            this.channels.noise;


        const node =
            this.nodes.noise;


        if (!node) {

            return;

        }


        const now =
            this.audioContext.currentTime;


        node.gain.gain
            .setTargetAtTime(
                channel.enabled
                    ? channel.volume
                    : 0,
                now,
                0.002
            );

    }


    /*
     * ========================================================
     * STOP CHANNEL
     * ========================================================
     */

    stopChannel(name) {

        const node =
            this.nodes[name];


        if (!node) {

            return;

        }


        try {

            if (
                node.oscillator
            ) {

                node.oscillator.stop();

            }


            if (
                node.source
            ) {

                node.source.stop();

            }

        } catch {

            /*
             * Node already stopped.
             */

        }


        this.nodes[name] =
            null;

    }


    /*
     * ========================================================
     * VOLUME
     * ========================================================
     */

    setVolume(value) {

        this.volume =
            Math.max(
                0,
                Math.min(
                    1,
                    value
                )
            );


        if (
            this.masterGain
        ) {

            this.masterGain.gain.value =
                this.volume;

        }

    }


    /*
     * ========================================================
     * ENABLE
     * ========================================================
     */

    setEnabled(enabled) {

        this.enabled =
            Boolean(enabled);


        if (
            !this.enabled
        ) {

            this.mute();

        }

    }


    /*
     * ========================================================
     * MUTE
     * ========================================================
     */

    mute() {

        if (
            this.masterGain
        ) {

            this.masterGain.gain.value =
                0;

        }

    }


    /*
     * ========================================================
     * UNMUTE
     * ========================================================
     */

    unmute() {

        if (
            this.masterGain &&
            this.enabled
        ) {

            this.masterGain.gain.value =
                this.volume;

        }

    }


    /*
     * ========================================================
     * STATE
     * ========================================================
     */

    getState() {

        return {

            enabled:
                this.enabled,

            started:
                this.started,

            context:
                this.audioContext
                    ? this.audioContext.state
                    : "uninitialized",

            channels: {

                square1:
                    {
                        ...this.channels.square1
                    },

                square2:
                    {
                        ...this.channels.square2
                    },

                wave:
                    {
                        ...this.channels.wave
                    },

                noise:
                    {
                        ...this.channels.noise
                    }

            }

        };

    }

}
