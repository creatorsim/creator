/**
 * Copyright 2018-2026 CREATOR Team.
 *
 * This file is part of CREATOR.
 *
 * CREATOR is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * CREATOR is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with CREATOR.  If not, see <http://www.gnu.org/licenses/>.
 */

import { crex_findReg } from "../register/registerLookup.mjs";
import { packExecute } from "../utils/utils.mjs";
import {
    readRegister,
    writeRegister,
} from "../register/registerOperations.mjs";
import { main_memory, status } from "../core.mjs";
import {
    display_print,
    keyboard_read_find,
    kbd_read_string,
    keyboard_parseInt,
    keyboard_read,
    kbd_read_char,
    keyboard_read_until,
} from "../executor/IO.mjs";
// import { getPinState,setPinState } from "../../web/arduino/pinstates.mts";
import { Memory } from "../memory/Memory.mts";
import { coreEvents } from "@/core/events.mts";

/*
 *  CREATOR instruction description API:
 *  CREATino functions module
 */
//Variables
let serial_begin = 0; // TODO: Which baud rate can we accept?
let initArduino = 0; // Flag to check if initArduino has been called
let _seed = 1;
// let traces = new ArduinoTerminal();

//Functions
export function cr_initArduino() {
    if (initArduino === 0) {
        initArduino = 1;
    }
    coreEvents.emit("arduino-terminal-write", { text: "initArduino()" });
}
export function cr_digitalRead() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a0 not found",
            "danger",
            null,
        );
    }
    var pin = BigInt.asIntN(32, readRegister(ret1.indexComp, ret1.indexElem));
    //Read from simulator
    const pinName = `GPIO${pin}`;
    let rawValue = 0;
        coreEvents.emit("arduino-pin-read", {
        pin: pinName,
        callback: (val: number) => {
            rawValue = val;
        }
    });
    const value = rawValue !== 0 ? 1 : 0;
    writeRegister(BigInt(value), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", {
        text: `digitalRead(${pin}) = ${value}`,
    });
}
export function cr_pinMode() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a0 not found",
            "danger",
            null,
        );
    }
    var pin = BigInt.asIntN(32, readRegister(ret1.indexComp, ret1.indexElem));
    var ret2 = crex_findReg("a1");
    if (ret2.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a1 not found",
            "danger",
            null,
        );
    }
    var mode = BigInt.asIntN(32, readRegister(ret2.indexComp, ret2.indexElem));
    coreEvents.emit("arduino-terminal-write", {
        text: `pinMode(${pin},${mode})`,
    });
    coreEvents.emit("arduino-pin-mode", {
        pin: Number(pin),
        mode: Number(mode),
    });
}
export function cr_digitalWrite() {
    // Indicate in terminal
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a0 not found",
            "danger",
            null,
        );
    }
    var pin = BigInt.asIntN(32, readRegister(ret1.indexComp, ret1.indexElem));

    var ret2 = crex_findReg("a1");
    if (ret2.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a1 not found",
            "danger",
            null,
        );
    }
    var rawValue = BigInt.asIntN(
        32,
        readRegister(ret2.indexComp, ret2.indexElem),
    );
    var value = rawValue !== 0n ? 1 : 0;
    coreEvents.emit("arduino-terminal-write", {
        text: `digitalWrite(${pin}, ${value})`,
    });
    coreEvents.emit("arduino-pin-write", {
        pin: Number(pin),
        value: Number(value),
    });
}
export function cr_analogRead() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a0 not found",
            "danger",
            null,
        );
    }
    var pin = BigInt.asIntN(32, readRegister(ret1.indexComp, ret1.indexElem));
    //Read from simulator
    const pinName = `GPIO${pin}`;
    // const value = pinStates.value[pinName] ?? 0;
    let value = 0;
    coreEvents.emit("arduino-pin-read", {
        pin: pinName,
        callback: (val: number) => {
            value = val;
        }
    });
    console.log(`Reading from pin ${pinName}: ${value}`);
    writeRegister(BigInt(value), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", {
        text: `analogRead(${pin}) = ${value}`,
    });
}
export function cr_analogReadResolution() {
    // TODO
}
export function cr_analogWrite() {
    // Indicate in terminal
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a0 not found",
            "danger",
            null,
        );
    }
    var pin = BigInt.asIntN(32, readRegister(ret1.indexComp, ret1.indexElem));

    var ret2 = crex_findReg("a1");
    if (ret2.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a1 not found",
            "danger",
            null,
        );
    }
    var value = BigInt.asIntN(32, readRegister(ret2.indexComp, ret2.indexElem));
    coreEvents.emit("arduino-terminal-write", {
        text: `analogWrite(${pin}, ${value})`,
    });
    coreEvents.emit("arduino-pin-write", {
        pin: Number(pin),
        value: Number(value),
    });
}
export function cr_map() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a0 not found",
            "danger",
            null,
        );
    }
    var value = BigInt.asIntN(32, readRegister(ret1.indexComp, ret1.indexElem));
    //fromLow the lower bound of the value’s current range.
    var ret2 = crex_findReg("a1");
    if (ret2.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a1 not found",
            "danger",
            null,
        );
    }
    var fromLow = BigInt.asIntN(
        32,
        readRegister(ret2.indexComp, ret2.indexElem),
    );
    //fromHigh the upper bound of the value’s current range.
    var ret3 = crex_findReg("a2");
    if (ret3.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a2 not found",
            "danger",
            null,
        );
    }
    var fromHigh = BigInt.asIntN(
        32,
        readRegister(ret3.indexComp, ret3.indexElem),
    );
    //toLow the lower bound of the value’s target range.
    var ret4 = crex_findReg("a3");
    if (ret4.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a3 not found",
            "danger",
            null,
        );
    }
    var toLow = BigInt.asIntN(32, readRegister(ret4.indexComp, ret4.indexElem));
    //toHigh the upper bound of the value’s target range.
    var ret5 = crex_findReg("a4");
    if (ret5.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a4 not found",
            "danger",
            null,
        );
    }
    var toHigh = BigInt.asIntN(
        32,
        readRegister(ret5.indexComp, ret5.indexElem),
    );
    const mappedValue =
        ((value - fromLow) * (toHigh - toLow)) / (fromHigh - fromLow) + toLow;
    writeRegister(mappedValue, ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", {
        text: `map(${value}, ${fromLow}, ${fromHigh}, ${toLow}, ${toHigh})`,
    });
}
export function cr_constrain() {
    // Value to constrain
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a0 not found",
            "danger",
            null,
        );
    }
    var value = BigInt.asIntN(32, readRegister(ret1.indexComp, ret1.indexElem));
    //lower end
    var ret2 = crex_findReg("a1");
    if (ret2.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a1 not found",
            "danger",
            null,
        );
    }
    var lower = BigInt.asIntN(32, readRegister(ret2.indexComp, ret2.indexElem));
    //upper end
    var ret3 = crex_findReg("a2");
    if (ret3.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a2 not found",
            "danger",
            null,
        );
    }
    var upper = BigInt.asIntN(32, readRegister(ret3.indexComp, ret3.indexElem));

    // Always a int cause we use a0
    var constrained = Math.max(
        Number(lower),
        Math.min(Number(value), Number(upper)),
    );
    writeRegister(BigInt(constrained), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", {
        text: `constrain(${value}, ${lower}, ${upper})`,
    });
}
export function cr_abs() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value = BigInt.asIntN(32, readRegister(ret1.indexComp, ret1.indexElem));
    // Calculate the absolute value
    value = value > 0 ? value : -value;
    writeRegister(BigInt(value), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", { text: `abs(${value})` });
}
export function cr_max() {
    //Var 1: Expected always an int32
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asIntN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );
    // Var2: Expected always an int32
    var ret2 = crex_findReg("a1");
    if (ret2.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value2 = BigInt.asIntN(
        32,
        readRegister(ret2.indexComp, ret2.indexElem),
    );
    // Find the maximum value
    const max = value1 > value2 ? value1 : value2;
    writeRegister(BigInt(max), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", {
        text: `max(${value1}, ${value2})`,
    });
}
export function cr_min() {
    //Var 1: Expected always an int32
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asIntN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );
    //Var 2: Expected always an int32
    var ret2 = crex_findReg("a1");
    if (ret2.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value2 = BigInt.asIntN(
        32,
        readRegister(ret2.indexComp, ret2.indexElem),
    );
    // Find the minimun value
    const min = value1 < value2 ? value1 : value2;
    writeRegister(BigInt(min), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", {
        text: `min(${value1}, ${value2})`,
    });
}
export function cr_pow() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asIntN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );
    //Var 2: Expected always an int32
    var ret2 = crex_findReg("a1");
    if (ret2.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value2 = BigInt.asIntN(
        32,
        readRegister(ret2.indexComp, ret2.indexElem),
    );
    const pow = Math.pow(Number(value1), Number(value2));
    writeRegister(BigInt(pow), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", {
        text: `pow(${value1}, ${value2})`,
    });
}
export function cr_bit() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asUintN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    ); //bit functions in arduino work with uint8_t numbers
    var res = 0n;
    if (value1 < 0n || value1 > 31n) {
        res = 0n; // Invalid bit position
    } else {
        res = 1n << value1; // Calculate the bit value
    }
    writeRegister(BigInt(res), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", { text: `bit(${value1})` });
}
export function cr_bitClear() {
    //Numeric variable whose bit to clear
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asUintN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    ); //bit functions in arduino work with uint8_t numbers
    var res = 0n;
    //Bit to clear, starting 0 for least-significant
    var ret2 = crex_findReg("a1");
    if (ret2.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value2 = BigInt.asUintN(
        32,
        readRegister(ret2.indexComp, ret2.indexElem),
    );
    if (value2 < 0n || value2 > 31n) {
        res = value1; // Invalid bit position, return original value
    } else {
        res = value1 & ~(1n << value2); // Clear the specified bit
    }
    writeRegister(BigInt(res), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", {
        text: `bitClear(${value1}, ${value2})`,
    });
}
export function cr_bitRead() {
    //Numeric variable whose bit to read
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asUintN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    ); //bit functions in arduino work with uint8_t numbers
    var res = 0n;
    //Bit to read, starting 0 for least-significant
    var ret2 = crex_findReg("a1");
    if (ret2.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value2 = BigInt.asUintN(
        32,
        readRegister(ret2.indexComp, ret2.indexElem),
    );
    if (value2 < 0n || value2 > 31n) {
        res = 0n; // Invalid bit position, return 0
    } else {
        res = (value1 & (1n << value2)) !== 0n ? 1n : 0n; // Read the specified bit
    }
    writeRegister(BigInt(res), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", {
        text: `bitRead(${value1}, ${value2})`,
    });
}
export function cr_bitSet() {
    //Numeric variable whose bit to set
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asUintN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    ); //bit functions in arduino work with uint8_t numbers
    var res = 0n;
    //Bit to set, starting 0 for least-significant
    var ret2 = crex_findReg("a1");
    if (ret2.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value2 = BigInt.asUintN(
        32,
        readRegister(ret2.indexComp, ret2.indexElem),
    );
    if (value2 < 0n || value2 > 31n) {
        res = 0n; // Invalid bit position, return 0
    } else {
        res = value1 | (1n << value2); // Set the specified bit
    }
    writeRegister(BigInt(res), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", {
        text: `bitSet(${value1}, ${value2})`,
    });
}
export function cr_bitWrite() {
    //Numeric variable whose bit to write
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asUintN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    ); //bit functions in arduino work with uint8_t numbers
    var res = 0n;
    //Bit to write, starting 0 for least-significant
    var ret2 = crex_findReg("a1");
    if (ret2.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value2 = BigInt.asUintN(
        32,
        readRegister(ret2.indexComp, ret2.indexElem),
    );
    // Value to write
    var ret3 = crex_findReg("a2");
    if (ret3.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value3 = BigInt.asUintN(
        32,
        readRegister(ret3.indexComp, ret3.indexElem),
    );

    if (value2 < 0n || value2 > 31n) {
        res = value1; // Invalid bit position, return original value
    } else {
        if (value3 == 0n) {
            res = value1 & ~(1n << value2); // Clear the specified bit
        } else if (value3 == 1n) {
            res = value1 | (1n << value2); // Set the specified bit
        } else {
            throw packExecute(
                true,
                "capi_syscall: invalid value for bitWrite",
                "danger",
                null,
            );
        }
    }
    writeRegister(BigInt(res), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", {
        text: `bitWrite(${value1}, ${value2}, ${value3})`,
    });
}
export function cr_highByte() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asUintN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    ); //bit functions in arduino work with uint8_t numbers
    var res = 0n;
    res = (value1 >> 8n) & 0xffn; // Get the high byte
    writeRegister(BigInt(res), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", { text: `highByte(${value1})` });
}
export function cr_lowByte() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asUintN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    ); //bit functions in arduino work with uint8_t numbers
    let res = value1 & 0xffn; // Get the low byte
    writeRegister(BigInt(res), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", { text: `lowByte(${value1})` });
}
export function cr_attachInterrupt() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var interr_pos = BigInt.asIntN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );
    var ret2 = crex_findReg("a1");
    if (ret2.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a1 not found",
            "danger",
            null,
        );
    }
    var interr_isr = BigInt.asIntN(
        32,
        readRegister(ret2.indexComp, ret2.indexElem),
    );
    // esp32vect.value[Number(interr_pos)]![1] = interr_isr;
    //TODO: Modes
    var ret3 = crex_findReg("a2");
    if (ret3.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a2 not found",
            "danger",
            null,
        );
    }
    var mode =  BigInt.asIntN(
        32,
        readRegister(ret3.indexComp, ret3.indexElem),
    );
    // esp32vect.value[Number(interr_pos)]![2] = mode;
    //TODO: Graphic retroalimentation
    // const gpiopin = "GPIO" + esp32vect.value[Number(interr_pos)]![0];
    let gpiopin = "GPIO?"; // Valor por defecto

    coreEvents.emit("arduino-get-pin-from-slot", {
        position: Number(interr_pos),
        callback: (pin: string) => {
            gpiopin = "GPIO" + pin; // El suscriptor nos devuelve el pin real
        }
    });
    coreEvents.emit("arduino-terminal-write", {
        text: `attachInterrupt(${interr_pos}, 0x${interr_isr.toString(16)}, ${mode}) `,
    });
    coreEvents.emit("arduino-pin-interrupt", { pin: gpiopin, mode: mode, isr: interr_isr, position: interr_pos });
}
export function cr_detachInterrupt() {
    //TODO: Revise
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var interr_pos = BigInt.asIntN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );
    // esp32vect.value[Number(interr_pos)] = [esp32vect.value[Number(interr_pos)]![0], 0n, 0n];
    // const gpiopin = "GPIO" + esp32vect.value[Number(interr_pos)]![0];
    const gpiopin = "GPIO" + "6";
    coreEvents.emit("arduino-terminal-write", {
        text: `detachInterrupt(${interr_pos})`,
    });
    coreEvents.emit("arduino-pin-detach-interrupt", { pin: gpiopin });
}
export function cr_digitalPinToInterrupt() {
    // Returns the first interrupt place free
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var pin = BigInt.asUintN(32, readRegister(ret1.indexComp, ret1.indexElem));
    //Find clean slot in the interrupt vector table
    let pos = -1;
    // const pos = esp32vect.value.findIndex(
    //     (slot: bigint[]) => slot[1] === 0n && slot[2] === 0n,
    // );
    coreEvents.emit("arduino-find-vector-slot", {
        callback: (index: number) => {
            pos = index; 
        }
    });

    // Si no encuentra ninguna posición libre, findIndex devuelve -1
    if (pos === -1) {
        throw packExecute(
            true,
            "ESP32 Interrupt Table Full: No free slots available",
            "warning",
            null,
        );
    }
    // esp32vect.value[pos] = [BigInt(pin), 0n, 0n]; // Mark the slot as used with the position
    coreEvents.emit("arduino-pin-interrupt", {
        position: BigInt(pos),
        pin: pin.toString(),
        mode: 0n,
        isr: 0n,
    });
    writeRegister(BigInt(pos), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", {
        text: `digitalPinToInterrupt(${pin})`,
    });
}
export function cr_interrupts() {
    coreEvents.emit("arduino-interrupts-enabled", true);
}
export function cr_nointerrupts() {
    coreEvents.emit("arduino-interrupts-enabled", false);
}
export function cr_isDigit() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asUintN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );
    let res = value1 >= 48n && value1 <= 57n ? 1n : 0n;
    writeRegister(BigInt(res), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", { text: `isDigit(${value1})` });
}
export function cr_isAlpha() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asUintN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );
    let res =
        (value1 >= 65n && value1 <= 90n) || (value1 >= 97n && value1 <= 122n)
            ? 1n
            : 0n;
    writeRegister(BigInt(res), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", { text: `isAlpha(${value1})` });
}
export function cr_isAlphaNumeric() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asUintN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );
    let res =
        (value1 >= 65n && value1 <= 90n) || (value1 >= 97n && value1 <= 122n)
            ? 1n
            : 0n;
    writeRegister(BigInt(res), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", {
        text: `isAlphaNumeric(${value1})`,
    });
}
export function cr_isAscii() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asUintN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );
    let res = value1 >= 0n && value1 <= 127n ? 1n : 0n;
    writeRegister(BigInt(res), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", { text: `isAscii(${value1})` });
}
export function cr_isControl() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asUintN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );
    let res = (value1 >= 0n && value1 <= 31n) || value1 === 127n ? 1n : 0n;
    writeRegister(BigInt(res), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", { text: `isControl(${value1})` });
}
export function cr_isPunct() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asUintN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );
    let res =
        (value1 >= 33n && value1 <= 47n) ||
        (value1 >= 58n && value1 <= 64n) ||
        (value1 >= 91n && value1 <= 96n) ||
        (value1 >= 123n && value1 <= 126n)
            ? 1n
            : 0n;
    writeRegister(BigInt(res), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", { text: `isPunct(${value1})` });
}
export function cr_isHexadecimalDigit() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asUintN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );
    let res =
        (value1 >= 48n && value1 <= 57n) ||
        (value1 >= 65n && value1 <= 70n) ||
        (value1 >= 97n && value1 <= 102n)
            ? 1n
            : 0n;
    writeRegister(BigInt(res), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", {
        text: `isHexadecimalDigit(${value1})`,
    });
}
export function cr_isUpperCase() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asUintN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );
    let res = value1 >= 65n && value1 <= 90n ? 1n : 0n;
    writeRegister(BigInt(res), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", {
        text: `isUpperCase(${value1})`,
    });
}
export function cr_isLowerCase() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asUintN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );
    let res = value1 >= 97n && value1 <= 122n ? 1n : 0n;
    writeRegister(BigInt(res), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", {
        text: `isLowerCase(${value1})`,
    });
}
export function cr_isPrintable() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asUintN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );
    let res = value1 >= 32n && value1 <= 126n ? 1n : 0n;
    writeRegister(BigInt(res), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", {
        text: `isPrintable(${value1})`,
    });
}
export function cr_isGraph() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asUintN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );
    let res = value1 >= 33n && value1 <= 126n ? 1n : 0n;
    writeRegister(BigInt(res), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", { text: `isGraph(${value1})` });
}
export function cr_isSpace() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asUintN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );
    let res =
        value1 === 32n ||
        value1 === 9n ||
        value1 === 10n ||
        value1 === 13n ||
        value1 === 11n ||
        value1 === 12n
            ? 1n
            : 0n;
    writeRegister(BigInt(res), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", { text: `isSpace(${value1})` });
}
export function cr_isWhiteSpace() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asUintN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );
    let res =
        value1 === 32n ||
        value1 === 9n ||
        value1 === 10n ||
        value1 === 13n ||
        value1 === 11n ||
        value1 === 12n
            ? 1n
            : 0n;
    writeRegister(BigInt(res), ret1.indexComp, ret1.indexElem);
    coreEvents.emit("arduino-terminal-write", {
        text: `isWhiteSpace(${value1})`,
    });
}
export function cr_delay() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asUintN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );
    coreEvents.emit("arduino-terminal-write", { text: `delay(${value1})` });
    // Simulate delay by busy-waiting
    const start = Date.now();
    while (Date.now() - start < Number(value1)) {
        // Busy wait
    }
}
export function cr_delayMicroseconds() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asUintN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );
    // Simulate microsecond delay by busy-waiting
    coreEvents.emit("arduino-terminal-write", {
        text: `delayMicroseconds(${value1})`,
    });
    const start = performance.now();
    while (performance.now() - start < Number(value1) / 1000) {
        // Busy wait
    }
}
export function cr_randomSeed() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asUintN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );
    coreEvents.emit("arduino-terminal-write", {
        text: `randomSeed(${value1})`,
    });
    _seed = Number(value1) >>> 0;
}
export function cr_random() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    var value1 = BigInt.asIntN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );
    var ret2 = crex_findReg("a1");
    if (ret2.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a1 not found",
            "danger",
            null,
        );
    }
    var value2 = BigInt.asIntN(
        32,
        readRegister(ret2.indexComp, ret2.indexElem),
    );
    // Linear Congruential Generator (LCG)
    // Constants from Numerical Recipes
    _seed = (_seed * 1664525 + 1013904223) >>> 0;
    var rand = _seed / 0xffffffff;
    if (value2 === 0n) {
        // Return a random number between 0 and value1-1
        var randomValue = Math.floor(rand * Number(value1));
        coreEvents.emit("arduino-terminal-write", {
            text: `random(${value1})`,
        });
        writeRegister(BigInt(randomValue), ret1.indexComp, ret1.indexElem);
    } else {
        // Random between value1 and value2
        if (value1 > value2) {
            var temp = value1;
            value1 = value2;
            value2 = temp;
        }
        var randomValue =
            Math.floor(rand * Number(value2 - value1)) + Number(value1);
        coreEvents.emit("arduino-terminal-write", {
            text: `random(${value1}, ${value2})`,
        });
        writeRegister(BigInt(randomValue), ret1.indexComp, ret1.indexElem);
    }
}
export function cr_serial_available() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a0 not found",
            "danger",
            null,
        );
    }
    if (serial_begin != 0 && initArduino != 0) {
        // Check how many bytes are available in the keyboard input buffer
        var available = BigInt(
            typeof status.keyboard === "string" ? status.keyboard.length : 0,
        );
        coreEvents.emit("arduino-terminal-write", {
            text: `serial_available()`,
        });
        writeRegister(available, ret1.indexComp, ret1.indexElem);
    } else {
        //ERROR
        coreEvents.emit("arduino-terminal-write", {
            text: `serial_available() = -1`,
        });
        writeRegister(BigInt.asIntN(32, -1n), ret1.indexComp, ret1.indexElem);
    }
}
export function cr_serial_availableForWrite() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register a0 not found",
            "danger",
            null,
        );
    }
    if (serial_begin != 0 && initArduino != 0) {
        // Ready but with nothing being sended TODO: simulate complex scenaries
        writeRegister(64n, ret1.indexComp, ret1.indexElem); //simulates 64k buffer
        coreEvents.emit("arduino-terminal-write", {
            text: `serial_availableForWrite()`,
        });
        //in real hw it will only show data if its receiving data
    } else {
        //ERROR
        coreEvents.emit("arduino-terminal-write", {
            text: `serial_availableForWrite()`,
        });
        writeRegister(-1n, ret1.indexComp, ret1.indexElem);
    }
}
export function cr_serial_begin() {
    if (initArduino != 0) {
        if (serial_begin === 0) {
            var ret1 = crex_findReg("a0");
            if (ret1.match === 0) {
                throw packExecute(
                    true,
                    "capi_syscall: register " + "a0" + " not found",
                    "danger",
                    null,
                );
            }

            /* Print integer */
            var value = readRegister(ret1.indexComp, ret1.indexElem);
            //TODO: put frequences accepted values check
            var val_int = parseInt(value.toString()) >> 0;
            coreEvents.emit("arduino-terminal-write", {
                text: `serial_begin(${val_int})`,
            });
            serial_begin = val_int;
        }
    }
}
export function cr_serial_end() {
    if (serial_begin != 0 && initArduino != 0) {
        coreEvents.emit("arduino-terminal-write", { text: `serial_end()` });
        serial_begin = 0; // Reset serial_begin
    }
}
export function cr_serial_find() {
    coreEvents.emit("arduino-terminal-write", {
        text: `serial_find(a0, a1)`,
    });
    if (serial_begin != 0 && initArduino != 0) {
        keyboard_read_find(kbd_read_string, "a0", "a1");
    }
}
export function cr_serial_findUntil() {
    coreEvents.emit("arduino-terminal-write", {
        text: `serial_findUntil(a0, x0,a1)`,
    });
    if (serial_begin != 0 && initArduino != 0) {
        keyboard_read_find(kbd_read_string, "a0", "x0", "a1");
    }
}
export function cr_serial_flush() {
    //Cleans the serial buffer. Not exaclty what the board does, imitates Arduino 1.0
    coreEvents.emit("arduino-terminal-write", {
        text: `serial_flush()`,
    });
    if (serial_begin != 0 && initArduino != 0) {
        status.keyboard = "";
        const root = (document as any).app;
        if (root) {
            root.keyboard = "";
            root.enter = null;
        }
    }
}
export function cr_serial_parseInt() {
    
    coreEvents.emit("arduino-terminal-write", {
        text: `serial_parseInt(a0)`,
    });
    if (serial_begin != 0 && initArduino != 0) {
        keyboard_parseInt(kbd_read_string, "a0");
    }
}
export function cr_serial_read() {
    coreEvents.emit("arduino-terminal-write", {
        text: `serial_read(a0)`,
    });
    if (serial_begin != 0 && initArduino != 0) {
        keyboard_read(kbd_read_char, "a0");
    }
}
export function cr_serial_readBytes() {
    if (serial_begin != 0 && initArduino != 0) {
        var register = crex_findReg("a0");
        if (register.match === 0) {
            throw packExecute(
                true,
                "capi_syscall: register " + "a0" + " not found",
                "danger",
                null,
            );
        }
        // Length
        const auxreg = crex_findReg("a1");
        if (auxreg.match === 0) {
            throw new Error("capi_syscall: register  a1 not found");
        }
        const size = readRegister(auxreg.indexComp, auxreg.indexElem);

        const funct_params = {
            indexComp: register.indexComp,
            indexElem: register.indexElem,
            size,
        };
            coreEvents.emit("arduino-terminal-write", {
        text: `serial_readBytes(a0, a1)`,
    });
        status.run_program = 3;
        return keyboard_read(kbd_read_string, funct_params);
    }
}
export function cr_serial_readBytesUntil() {
    if (serial_begin != 0 && initArduino != 0) {
        // Value 1 is the searched char
        var ret1 = crex_findReg("a0");
        if (ret1.match === 0) {
            throw packExecute(
                true,
                "capi_syscall: register " + "a0" + " not found",
                "danger",
                null,
            );
        }
        // Check if value1 is a number and is a valid ASCII character
        var value1 = readRegister(ret1.indexComp, ret1.indexElem);
        if (typeof value1 !== "bigint" || value1 < 0 || value1 > 255) {
            throw packExecute(
                true,
                "capi_syscall: invalid value for searched character",
                "danger",
                null,
            );
        }

        // Value 2 is the buffer
        var ret2 = crex_findReg("a1");
        if (ret2.match === 0) {
            throw packExecute(
                true,
                "capi_syscall: register " + "a1" + " not found",
                "danger",
                null,
            );
        }

        // Value 3 is the length or end character
        var ret3 = crex_findReg("a2");
        if (ret3.match === 0) {
            throw packExecute(
                true,
                "capi_syscall: register " + "a2" + " not found",
                "danger",
                null,
            );
        }
        // Check if value3 is a number and greater than 0
        var value3_check = readRegister(ret3.indexComp, ret3.indexElem);
        if (typeof value3_check !== "bigint" || value3_check <= 0) {
            throw packExecute(
                true,
                "capi_syscall: invalid value for length/end char",
                "danger",
                null,
            );
        }
            coreEvents.emit("arduino-terminal-write", {
        text: `serial_readBytesUntil(a0, a1, a2)`,
    });
        status.run_program = 3;
        return keyboard_read_until(kbd_read_string, ret2, value1);
    }
}
export function cr_serial_write() {
    const valReg = crex_findReg("a0");
    if (valReg.match === 0) {
        throw packExecute(true, "capi_arduino: register a0 not found", "danger", null);
    }
    //This version only transforms bytes to char, function overloading contradicts how it works
    const fullValue = readRegister(valReg.indexComp, valReg.indexElem);

    // 3. Extraemos solo los 8 bits inferiores (máscara 0xFF)
    const byte = Number(BigInt.asUintN(8, fullValue));

    const char = String.fromCharCode(byte);
    
    coreEvents.emit("arduino-terminal-write", {
        text: "serial_write(" + char + ")",
    });
    display_print(char);
}
export function cr_serial_printf() {
    // Get the address from register a0
    const valueReg = crex_findReg("a0");
    if (valueReg.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a0 not found",
            "danger",
            null,
        );
    }
    // Read the address stored in the register (already BigInt)
    let stringAddress = readRegister(
        valueReg.indexComp,
        valueReg.indexElem,
    ) as bigint;

    // Normalize address to positive range
    stringAddress = BigInt.asUintN(32, stringAddress);

    // Get the memory instance
    const memory = main_memory as Memory;

    // Validate address is within memory bounds
    if (stringAddress >= BigInt(memory.getSize())) {
        throw packExecute(
            true,
            "capi_arduino: invalid string address",
            "danger",
            null,
        );
    }

    // Read the format string from memory
    let formatString = "";
    let memoryAddr = stringAddress;
    while (memoryAddr < BigInt(memory.getSize())) {
        const byte = memory.read(memoryAddr);
        if (byte === 0) break; // Null terminator
        formatString += String.fromCharCode(byte);
        memoryAddr++;
    }

    // Process format specifiers
    let result = formatString;
    const argRegisters = ["a1", "a2", "a3", "a4", "a5", "a6", "a7"];

    for (const reg of argRegisters) {
        const argReg = crex_findReg(reg);
        if (argReg.match === 0) break;

        const argValue = readRegister(argReg.indexComp, argReg.indexElem);

        // Replacements
        result = result.replace("%d", String(BigInt.asIntN(32, argValue)));
        result = result.replace("%u", String(BigInt.asUintN(32, argValue)));
        result = result.replace(
            "%x",
            BigInt.asUintN(32, argValue).toString(16),
        );
        result = result.replace(
            "%c",
            String.fromCharCode(Number(BigInt.asUintN(8, argValue))),
        );
        if (result.includes("%s")) {
            let str = "";
            let addr = argValue;

            while (addr < BigInt(memory.getSize())) {
                const byte = memory.read(addr);
                if (byte === 0) break; // Null terminator
                str += String.fromCharCode(byte);
                addr++;
            }
            result = result.replace("%s", str);
        }
    }

    // Print the formatted string directly
                coreEvents.emit("arduino-terminal-write", {
        text: `serial_printf(a0, a1)`,
    });
    display_print(result);
}
export function cr_tone() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a0 not found",
            "danger",
            null,
        );
    }
    var pin = BigInt.asIntN(32, readRegister(ret1.indexComp, ret1.indexElem));

    var ret2 = crex_findReg("a1");
    if (ret2.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a1 not found",
            "danger",
            null,
        );
    }
    var value = BigInt.asIntN(32, readRegister(ret2.indexComp, ret2.indexElem));

    var ret3 = crex_findReg("a2");
    if (ret3.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a2 not found",
            "danger",
            null,
        );
    }
    var duration = BigInt.asIntN(
        32,
        readRegister(ret3.indexComp, ret3.indexElem),
    );
    coreEvents.emit("arduino-terminal-write", {
        text: `tone(${pin}, ${value}, ${duration})`,
    });
    coreEvents.emit("arduino-pin-write", {
        pin: Number(pin),
        value: Number(value),
    });
}
export function cr_noTone() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a0 not found",
            "danger",
            null,
        );
    }
    var pin = BigInt.asIntN(32, readRegister(ret1.indexComp, ret1.indexElem));
    coreEvents.emit("arduino-terminal-write", { text: `noTone(${pin})` });
    coreEvents.emit("arduino-pin-write", { pin: Number(pin), value: 0 });
}
export function cr_pulseIn() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a0 not found",
            "danger",
            null,
        );
    }
    var pin = BigInt.asIntN(32, readRegister(ret1.indexComp, ret1.indexElem));

    var ret2 = crex_findReg("a1");
    if (ret2.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a1 not found",
            "danger",
            null,
        );
    }
    var value = BigInt.asIntN(32, readRegister(ret2.indexComp, ret2.indexElem));

    var ret3 = crex_findReg("a2");
    if (ret3.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a2 not found",
            "danger",
            null,
        );
    }
    var duration = BigInt.asIntN(
        32,
        readRegister(ret3.indexComp, ret3.indexElem),
    );
    coreEvents.emit("arduino-terminal-write", {
        text: `pulseIn(${pin}, ${value}, ${duration})`,
    });
    coreEvents.emit("arduino-pin-write", {
        pin: Number(pin),
        value: Number(value),
    });
}
export function cr_pulseInLong() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a0 not found",
            "danger",
            null,
        );
    }
    var pin = BigInt.asIntN(32, readRegister(ret1.indexComp, ret1.indexElem));

    var ret2 = crex_findReg("a1");
    if (ret2.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a1 not found",
            "danger",
            null,
        );
    }
    var value = BigInt.asIntN(32, readRegister(ret2.indexComp, ret2.indexElem));

    var ret3 = crex_findReg("a2");
    if (ret3.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a2 not found",
            "danger",
            null,
        );
    }
    var duration = BigInt.asIntN(
        32,
        readRegister(ret3.indexComp, ret3.indexElem),
    );
    coreEvents.emit("arduino-terminal-write", {
        text: `pulseInLong(${pin}, ${value}, ${duration})`,
    });
    coreEvents.emit("arduino-pin-write", {
        pin: Number(pin),
        value: Number(value),
    });
}
export function cr_shiftIn() {
    let value = 0;
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a0 not found",
            "danger",
            null,
        );
    }
    var dataPin = BigInt.asIntN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );

    var ret2 = crex_findReg("a1");
    if (ret2.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a1 not found",
            "danger",
            null,
        );
    }
    var clockPin = BigInt.asIntN(
        32,
        readRegister(ret2.indexComp, ret2.indexElem),
    );

    var ret3 = crex_findReg("a2");
    if (ret3.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a2 not found",
            "danger",
            null,
        );
    }
    var bitOrder = BigInt.asIntN(
        32,
        readRegister(ret3.indexComp, ret3.indexElem),
    );
    coreEvents.emit("arduino-terminal-write", {
        text: `shiftIn(${dataPin}, ${clockPin}, ${bitOrder})`,
    });
    let bit = 0;
    for (let i = 0; i < 8; i++) {
        // let bit = pinStates.value[`GPIO${dataPin}`] !== 0 ? 1 : 0;
        coreEvents.emit("arduino-pin-read", {
            pin: `GPIO${dataPin}`,
            callback: (val: number) => {
                bit = val;
            }
    });
        if (bitOrder === 1n) {
            // MSBFIRST
            value |= bit << (7 - i);
        } else {
            // LSBFIRST
            value |= bit << i;
        }
    }
    writeRegister(BigInt(value), ret1.indexComp, ret1.indexElem);
}
export function cr_shiftOut() {
    var ret1 = crex_findReg("a0");
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a0 not found",
            "danger",
            null,
        );
    }
    var dataPin = BigInt.asIntN(
        32,
        readRegister(ret1.indexComp, ret1.indexElem),
    );

    var ret2 = crex_findReg("a1");
    if (ret2.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a1 not found",
            "danger",
            null,
        );
    }
    var clockPin = BigInt.asIntN(
        32,
        readRegister(ret2.indexComp, ret2.indexElem),
    );

    var ret3 = crex_findReg("a2");
    if (ret3.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a2 not found",
            "danger",
            null,
        );
    }
    var bitOrder = BigInt.asIntN(
        32,
        readRegister(ret3.indexComp, ret3.indexElem),
    );
    var ret4 = crex_findReg("a3");
    if (ret4.match === 0) {
        throw packExecute(
            true,
            "capi_arduino: register a3 not found",
            "danger",
            null,
        );
    }
    var value = BigInt.asIntN(
        32,
        readRegister(ret4.indexComp, ret4.indexElem),
    );
    coreEvents.emit("arduino-terminal-write", {
        text: `shiftOut(${dataPin}, ${clockPin}, ${bitOrder}, ${value})`,
    });
for (let i = 0; i < 8; i++) {
        let bit;
        // Importante: Usamos 1n para operaciones con BigInt
        if (bitOrder === 1n) { 
            // MSBFIRST: del bit 7 al 0
            bit = (value & (1n << BigInt(7 - i))) ? 1n : 0n;
        } else {
            // LSBFIRST: del bit 0 al 7
            bit = (value & (1n << BigInt(i))) ? 1n : 0n;
        }
        // pinStates.value[`GPIO${dataPin}`] = Number(bit);
            coreEvents.emit("arduino-pin-write", {
        pin: Number(dataPin),
        value: Number(value),
    });
    }
    

}

//Order
export const hookOrder = [
    "cr_initArduino",
    "cr_digitalRead",
    "cr_pinMode",
    "cr_digitalWrite",
    "cr_rgbLedWrite",
    "cr_analogRead",
    "cr_analogReadResolution",
    "cr_analogWrite",
    "cr_map",
    "cr_constrain",
    "cr_abs",
    "cr_max",
    "cr_min",
    "cr_pow",
    "cr_bit",
    "cr_bitClear",
    "cr_bitRead",
    "cr_bitSet",
    "cr_bitWrite",
    "cr_highByte",
    "cr_lowByte",
    "cr_attachInterrupt",
    "cr_detachInterrupt",
    "cr_digitalPinToInterrupt",
    "cr_pulseIn",
    "cr_pulseInLong",
    "cr_shiftIn",
    "cr_shiftOut",
    "cr_tone",
    "cr_noTone",
    "cr_interrupts",
    "cr_nointerrupts",
    "cr_isDigit",
    "cr_isAlpha",
    "cr_isAlphaNumeric",
    "cr_isAscii",
    "cr_isControl",
    "cr_isPunct",
    "cr_isHexadecimalDigit",
    "cr_isUpperCase",
    "cr_isLowerCase",
    "cr_isPrintable",
    "cr_isGraph",
    "cr_isSpace",
    "cr_isWhiteSpace",
    "cr_delay",
    "cr_delayMicroseconds",
    "cr_randomSeed",
    "cr_random",
    "cr_serial_available",
    "cr_serial_availableForWrite",
    "cr_serial_begin",
    "cr_serial_end",
    "cr_serial_find",
    "cr_serial_findUntil",
    "cr_serial_flush",
    "cr_serial_parseInt",
    "cr_serial_read",
    "cr_serial_readBytes",
    "cr_serial_readBytesUntil",
    "cr_serial_write",
    "cr_serial_printf",
];
