/*
 * WebBktx Core
 * CPU x86 — wersja eksperymentalna
 *
 * Na tym etapie obsługujemy tylko kilka instrukcji
 * potrzebnych do przetestowania rdzenia.
 */

class X86CPU {

    constructor() {

        // Rejestry 32-bitowe
        this.registers = {
            EAX: 0,
            EBX: 0,
            ECX: 0,
            EDX: 0,
            ESI: 0,
            EDI: 0,
            EBP: 0,
            ESP: 0
        };

        // Licznik instrukcji
        this.EIP = 0;

        // Flagi procesora
        this.EFLAGS = 0;

        // Prosta pamięć RAM
        this.memory = new Uint8Array(1024 * 1024); // 1 MB

        this.running = false;
    }


    reset() {

        for (const register of Object.keys(this.registers)) {
            this.registers[register] = 0;
        }

        this.EIP = 0;
        this.EFLAGS = 0;

        this.memory.fill(0);

        this.running = false;
    }


    /*
     * MOV EAX, wartość
     *
     * W naszym uproszczonym formacie:
     *
     * 01 [4 bajty wartości]
     */

    executeInstruction(instruction) {

        switch (instruction.opcode) {

            case 0x01:

                this.registers.EAX =
                    instruction.value >>> 0;

                break;


            /*
             * ADD EAX, wartość
             *
             * 02 [4 bajty wartości]
             */

            case 0x02:

                this.registers.EAX =
                    (this.registers.EAX +
                     instruction.value) >>> 0;

                break;


            /*
             * SUB EAX, wartość
             *
             * 03 [4 bajty wartości]
             */

            case 0x03:

                this.registers.EAX =
                    (this.registers.EAX -
                     instruction.value) >>> 0;

                break;


            default:

                throw new Error(
                    "Nieznana instrukcja: 0x" +
                    instruction.opcode.toString(16)
                );
        }


        this.EIP++;
    }


    run(program) {

        this.reset();

        this.running = true;

        for (const instruction of program) {

            if (!this.running) {
                break;
            }

            this.executeInstruction(instruction);
        }

        this.running = false;

        return this.registers;
    }
}


/*
 * Eksport rdzenia
 */

window.WebBktxCore = {
    X86CPU
};a
