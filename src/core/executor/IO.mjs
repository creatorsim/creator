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

import { status, main_memory, architecture } from "../core.mjs";
import {
    readRegister,
    writeRegister,
} from "../register/registerOperations.mjs";
import process from "node:process";
import { packExecute } from "../utils/utils.mjs";
import os from "node:os";
import { show_notification } from "../utils/notifications.mts";
import { instructions } from "../assembler/assembler.mjs";
import { sailexec } from "./sailSimRV/sailExecutor.mjs";
import { coreEvents, CoreEventTypes } from "../events.mts";

import { crex_findReg } from "../register/registerLookup.mjs";
import { Memory } from "../memory/Memory.mts";

/** Keyboard data override. Intended exclusively for running interactive tests */
export const testKeyboard = {
    enable: false,
    /** @type {string[]} */
    data: [],
}

export function display_print(info) {
    if (typeof document !== "undefined" && document.app) {
        document.app.$data.display += info;
    } else {
        // Deno environment
        // Make sure that info is a string
        if (typeof info !== "string") {
            info = info.toString();
        }
        if (!testKeyboard.enable) // Don't print in tests
            process.stdout.write(info);
    }

    status.display += info;
}

export function kbd_read_char(keystroke, params) {
    const value = keystroke.charCodeAt(0);
    if (architecture.config.name.includes("SRV")) {
        sailexec._send_char_to_C(value);

        document.app.$data.execution_mode_run = document.app.$data.last_execution_mode_run;
        document.app.$data.last_execution_mode_run = -1;
    }
    writeRegister(BigInt(value), params.indexComp, params.indexElem);

    return keystroke[0] || "";
}

export function kbd_read_int(keystroke, params) {
    // eslint-disable-next-line radix
    let value = parseInt(keystroke);

    // validate input
    if (isNaN(value)) {
        if (typeof document !== "undefined" && document.app) {
            show_notification(
                `Invalid input: '${keystroke}' is not an integer`,
                "danger",
            );
        } else {
            throw new Error(
                `\nInvalid input: '${keystroke}' is not an integer`,
            );
        }
        return null;
    }

    if (architecture.config.name.includes("SRV")) {
        sailexec._send_int_to_C(value);

        document.app.$data.execution_mode_run = document.app.$data.last_execution_mode_run;
        document.app.$data.last_execution_mode_run = -1;
    }
    value = BigInt(value);

    writeRegister(value, params.indexComp, params.indexElem);

    return value;
}

export function kbd_read_float(keystroke, params) {
    const value = parseFloat(keystroke, 10);

    // validate input
    if (typeof document !== "undefined" && document.app && isNaN(value)) {
        show_notification(
            `Invalid input: '${keystroke}' is not a float`,
            "danger",
        );
        return null;
    }
    if (architecture.config.name.includes("SRV")) {
        sailexec._send_float_to_C(value);


        document.app.$data.execution_mode_run = document.app.$data.last_execution_mode_run;
        document.app.$data.last_execution_mode_run = -1;
    }

    // If the current architecture has a write float specialization, use it.
    // Otherwise, fallback to writing the bits directly
    if (CAPI.ARCH.writeFloat !== undefined) {
        const reg = architecture.register_files[params.indexComp].registers[params.indexElem]
        CAPI.ARCH.writeFloat(value, reg.name[0])
    } else  {
        const buffer = new ArrayBuffer(4);
        const view = new DataView(buffer);
        view.setFloat32(0,value, false);
        const bits = BigInt(view.getUint32(0, false));
        writeRegister(bits, params.indexComp, params.indexElem);
    }

    return value;
}

export function kbd_read_double(keystroke, params) {
    const value = parseFloat(keystroke, 10);

    // validate input
    if (typeof document !== "undefined" && document.app && isNaN(value)) {
        show_notification(
            `Invalid input: '${keystroke}' is not a double`,
            "danger",
        );
        return null;
    }

    if (architecture.config.name.includes("SRV")) {
        sailexec._send_double_to_C(value);

        document.app.$data.execution_mode_run = document.app.$data.last_execution_mode_run;
        document.app.$data.last_execution_mode_run = -1;
    }
    // If the current architecture has a write float specialization, use it.
    // Otherwise, fallback to writing the bits directly
    if (CAPI.ARCH.writeDouble !== undefined) {
        const reg = architecture.register_files[params.indexComp].registers[params.indexElem]
        CAPI.ARCH.writeDouble(value, reg.name[0])
    } else  {
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        view.setFloat64(0, value, false);
        const bits = view.getBigUint64(0, false);
        writeRegister(bits, params.indexComp, params.indexElem);
    }

    return value;
}

export function kbd_read_string(keystroke, params) {
    const addr = readRegister(params.indexComp, params.indexElem);

    const bytes = new TextEncoder().encode(keystroke);
    // Write the string to memory byte by byte
    for (let i = 0n; i < bytes.length && i < params.size; i++) {
        main_memory.write(addr + i, bytes[i]);
    }

    if (architecture.config.name.includes("SRV")) {
        var lengthBytes = sailexec.lengthBytesUTF8(keystroke) + 1;

        var buffer = sailexec._malloc(lengthBytes);

        sailexec.stringToUTF8(keystroke, buffer, lengthBytes);

        if (architecture.config.name === "SRV32"){
            sailexec._send_string_to_C(buffer);
            sailexec._free(buffer);
        }
        else{
            sailexec._send_string_to_C(BigInt(buffer));
            sailexec._free(BigInt(buffer));
        }

        document.app.$data.execution_mode_run = document.app.$data.last_execution_mode_run;
        document.app.$data.last_execution_mode_run = -1;
    }
    return keystroke;
}

function checkEnter(buf) {
    if (os.type() === "Darwin") {
        // MacOS
        return buf[0] === 13;
    } else if (os.type() === "Windows_NT") {
        // Windows
        return buf[0] === 13 || buf[0] === 10;
    } else {
        return buf[0] === 10;
    }
}

/**
 * Custom prompt function for Deno
 * @returns {string} - The user input without extra space or newline
 */
function rawPrompt() {
    if (testKeyboard.enable) {
        const data = testKeyboard.data.shift() || ""
        return data
    }
    // Build input character by character until we hit Enter
    const chunks = [];
    const decoder = new TextDecoder();
    const buf = new Uint8Array(1);
    Deno.stdin.setRaw(true, { cbreak: true });
    while (true) {
        const bytesRead = Deno.stdin.readSync(buf);
        if (bytesRead === null || bytesRead === 0) break;

        if (checkEnter(buf)) {
            // Enter key pressed
            chunks.push("\n");
            break;
        } else if (buf[0] === 8 || buf[0] === 127) {
            // Backspace or Delete key pressed
            if (chunks.length > 0) {
                chunks.pop(); // Remove the last character
                process.stdout.write("\b \b"); // Move cursor back, erase character, move cursor back again
            }
        } else {
            const char = decoder.decode(buf);
            process.stdout.write(char); // Echo the character
            chunks.push(char);
        }
    }

    return chunks.join("");
}



export function keyboard_parseInt(fn_post_read, fn_post_params) {
    const draw = {
        space: [],
        info: [],
        success: [],
        warning: [],
        danger: [],
        flash: [],
    };

    //-------LOOKAHEAD (optional):  mode used to look ahead in the stream for an integer
    const ret1 = crex_findReg(fn_post_params);
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register " + fn_post_params + " not found",
            "danger",
            null,
        );
    }

    const addr = readRegister(ret1.indexComp, ret1.indexElem);
    // Get the memory instance
    const memory = main_memory;

    // Validate address is within memory bounds
    if (addr >= BigInt(memory.getSize())) {
        throw packExecute(
            true,
            "capi_arduino: invalid string address",
            "danger",
            null,
        );
    }

    // Read the lookahead from memory
    let target = "";
    let memoryAddr = addr;
    while (memoryAddr < BigInt(memory.getSize())) {
        const byte = memory.read(memoryAddr);
        if (byte === 0) break; // Null terminator
        target += String.fromCharCode(byte);
        memoryAddr++;
    }
    //LOOKAHEAD values
    if (target === "" || target =="SKIP_ALL") {
        var regex = new RegExp("\\s*(-?\\d+)", "g"); //Search the first number (negative or not)
    }
    else if (target === "SKIP_NONE") {
        var regex = new RegExp("^(-?\\d+)");
    }
    else { // SKIP_WHITESPACE
        var regex = new RegExp("^\\s*(-?\\d+)");

    }



    // Deno / CLI mode
    if (typeof Deno !== "undefined") {
        let keystroke = rawPrompt();
        var match = regex.exec(keystroke);
        if (match) {
            keystroke = match[1]; //Extracted number as string
            writeRegister(BigInt(keystroke), ret1.indexComp, ret1.indexElem);
        } else {
            keystroke = ""; //No number found
            writeRegister(0n, ret1.indexComp, ret1.indexElem);
        }

        status.run_program = 0;
        return packExecute(
            false,
            "The result has been written to the register",
            "info",
            null,
        );
    }

    // Web/UI mode
    document.app.$data.enter = false; // wait for input

    if (status.run_program === 3) {
        setTimeout(keyboard_parseInt, 1000, fn_post_read, fn_post_params);
        return draw;
    }

    let keystroke = document.app.$data.keyboard;

    if (!keystroke || keystroke.length === 0) {
        status.run_program = 3;
        return keyboard_parseInt(fn_post_read, fn_post_params);
    }
    var match = regex.exec(keystroke);
    if (match) {
        keystroke = match[1]; //Extracted number as string
        if (keystroke.includes("-")) {
            writeRegister(BigInt.asIntN(keystroke), ret1.indexComp, ret1.indexElem);
        }
        writeRegister(BigInt(keystroke), ret1.indexComp, ret1.indexElem);
    } else {
        keystroke = ""; //No number found
        writeRegister(0n, ret1.indexComp, ret1.indexElem);
    }
    // if (keystroke.includes(target) && keystroke.length <= (length || keystroke.length) && !keystroke.includes(until)) {
    //     writeRegister(1n, ret1.indexComp, ret1.indexElem);
    // } else {
    //     writeRegister(0n, ret1.indexComp, ret1.indexElem);
    // }


    document.app.$data.keyboard = "";
    document.app.$data.enter = null;

    draw.info.push("The result has been written to the register");

    if (status.execution_index >= instructions.length) {
        for (let i = 0; i < instructions.length; i++) {
            draw.space.push(i);
        }
        status.execution_index = -2;
        return packExecute(
            true,
            "The execution of the program has finished",
            "success",
            null,
        );
    }
    // If program was running before waiting for input, continue execution automatically
    if (status.run_program === 1) {
        const playButton = document.getElementById("playExecution");
        if (playButton) {
            playButton.click();
        }
    }

    // Re-enable buttons
    if (typeof document !== "undefined" && document.app) {
        coreEvents.emit(CoreEventTypes.EXECUTOR_BUTTONS_UPDATE, {
            instruction_disable: false,
            run_disable: false,
        });
    }

    return draw;
}


export function keyboard_read(fn_post_read, fn_post_params) {
    const draw = {
        space: [],
        info: [],
        success: [],
        warning: [],
        danger: [],
        flash: [],
    };

    // Check for Deno environment
    if (typeof Deno !== "undefined") {
        const keystroke = rawPrompt();
        const value = fn_post_read(keystroke, fn_post_params);
        status.keyboard += " " + value;
        status.run_program = 0; // Reset run_program status

        return null;
    }

    // Web/UI mode
    document.app.$data.enter = false; // signal UI to wait for keyboard read

    if (status.run_program === 3) {
        setTimeout(keyboard_read, 1000, fn_post_read, fn_post_params);
        return draw;
    }

    const val = fn_post_read(document.app.$data.keyboard, fn_post_params);

    document.app.$data.keyboard = ""; // clear input

    if (val === null) {
        // error parsing input, retry
        status.run_program = 3;
        return keyboard_read(fn_post_read, fn_post_params);
    }

    document.app.$data.enter = null; // reset keyboard

    if (status.execution_index >= instructions.length) {
        for (let i = 0; i < instructions.length; i++) {
            draw.space.push(i);
        }

        status.execution_index = -2;
        return packExecute(
            true,
            "The execution of the program has finished",
            "success",
            null,
        );
    }
    if (architecture.config.name.includes("SRV"))
        return draw;
    // If program was running before waiting for input, continue execution automatically
    if (status.run_program === 1) {
        // Trigger the play button to continue execution
        const playButton = document.getElementById("playExecution");
        if (playButton) {
            playButton.click();
        }
    }

    // Re-enable buttons using event emitter for proper reactivity
    if (typeof document !== "undefined" && document.app) {
        coreEvents.emit(CoreEventTypes.EXECUTOR_BUTTONS_UPDATE, {
            instruction_disable: false,
            run_disable: false,
        });
    }

    return draw;
}

export function keyboard_read_until(fn_post_read, fn_post_params, fn_post_until) {
    const draw = {
        space: [],
        info: [],
        success: [],
        warning: [],
        danger: [],
        flash: [],
    };
    // if (typeof fn_post_until !== "string" || fn_post_until.length === 0) {
    //     throw packExecute(
    //         true,
    //         "capi_syscall: invalid 'until' parameter for keyboard_read_until",
    //         "danger",
    //         null,
    //     );
    // }
    const until = String.fromCharCode(Number(fn_post_until));
    console.log(
        "keyboard_read_until: waiting until",
        `"${until}"`,
        "type:",
        typeof until,
        "length:",
        until?.length
    );


    // Check for Deno environment
    if (typeof Deno !== "undefined") {
        let keystroke = rawPrompt();
        // Extract input until the 'until' character
        if (typeof until === "string" && until.length > 0) {
            const idx = keystroke.indexOf(until);
            if (idx !== -1) {
                keystroke = keystroke.slice(0, idx);
            }

        }
        // console.log("Extracted keystroke until 'until':", `"${keystroke}"`);
        const value = fn_post_read(keystroke, fn_post_params);
        status.keyboard = status.keyboard + " " + value;
        status.run_program = 0; // Reset run_program status

        return null;
    }

    // Web/UI mode
    document.app.$data.enter = false; // signal UI to wait for keyboard read

    if (status.run_program === 3) {
        setTimeout(keyboard_read_until, 1000, fn_post_read, fn_post_params, fn_post_until);
        return draw;
    }

    // Extract input until the 'until' character
    let keystroke = document.app.$data.keyboard;
    if (until.length > 0) {
        const idx = keystroke.indexOf(until);
        if (idx !== -1) {
            keystroke = keystroke.slice(0, idx);
        }
    }

    const funct_params = {
            indexComp: fn_post_params.indexComp,
            indexElem: fn_post_params.indexElem,
            size: keystroke.length,
    };

    const val = fn_post_read(keystroke, funct_params);
    writeRegister(BigInt(val.length), fn_post_params.indexComp, fn_post_params.indexElem);

    document.app.$data.keyboard = ""; // clear input

    if (val === null) {
        // error parsing input, retry
        status.run_program = 3;
        return keyboard_read_until(fn_post_read, fn_post_params,fn_post_until);
    }

    document.app.$data.enter = null; // reset keyboard

    if (status.execution_index >= instructions.length) {
        for (let i = 0; i < instructions.length; i++) {
            draw.space.push(i);
        }

        status.execution_index = -2;
        return packExecute(
            true,
            "The execution of the program has finished",
            "success",
            null,
        );
    }

    // If program was running before waiting for input, continue execution automatically
    if (status.run_program === 1) {
        // Trigger the play button to continue execution
        const playButton = document.getElementById("playExecution");
        if (playButton) {
            playButton.click();
        }
    }

    // Re-enable buttons using event emitter for proper reactivity
    if (typeof document !== "undefined" && document.app) {
        coreEvents.emit(CoreEventTypes.EXECUTOR_BUTTONS_UPDATE, {
            instruction_disable: false,
            run_disable: false,
        });
    }

    return draw;
}


export function keyboard_read_find(fn_post_read, fn_post_params,fn_post_length,fn_post_until) {
    const draw = {
        space: [],
        info: [],
        success: [],
        warning: [],
        danger: [],
        flash: [],
    };

    // Resolve the target string from register
    const ret1 = crex_findReg(fn_post_params);
    if (ret1.match === 0) {
        throw packExecute(
            true,
            "capi_syscall: register " + fn_post_params + " not found",
            "danger",
            null,
        );
    }

    const addr = readRegister(ret1.indexComp, ret1.indexElem);
    // Get the memory instance
    const memory = main_memory;

    // Validate address is within memory bounds
    if (addr >= BigInt(memory.getSize())) {
        throw packExecute(
            true,
            "capi_arduino: invalid string address",
            "danger",
            null,
        );
    }

    // Read the target from memory
    let target = "";
    let memoryAddr = addr;
    while (memoryAddr < BigInt(memory.getSize())) {
        const byte = memory.read(memoryAddr);
        if (byte === 0) break; // Null terminator
        target += String.fromCharCode(byte);
        memoryAddr++;
    }
    //Read length if provided
    let length = null;
    if (fn_post_length && fn_post_length.length > 0) {
        const ret2 = crex_findReg(fn_post_length);
        if (ret2.match === 0) {
            throw packExecute(
                true,
                "capi_syscall: register " + fn_post_length + " not found",
                "danger",
                null,
            );
        }
        length = readRegister(ret2.indexComp, ret2.indexElem);
        if (length <= 0) {
            length = Infinity; // No length limit
        }
    }


    // Resolve the until string from register if provided (serial_findUntil)
    let until = "";
    if (fn_post_until && fn_post_until.length > 0) {
        const ret2 = crex_findReg(fn_post_until);
        if (ret2.match === 0) {
            throw packExecute(
                true,
                "capi_syscall: register " + fn_post_until + " not found",
                "danger",
                null,
            );
        }
        const addr_until = readRegister(ret2.indexComp, ret2.indexElem);
        // until = readMemory(parseInt(addr_until), "string");
            // Validate address is within memory bounds
        if (addr_until >= BigInt(memory.getSize())) {
            throw packExecute(
                true,
                "capi_arduino: invalid string address",
                "danger",
                null,
            );
        }

        // Read the target from memory
        memoryAddr = addr_until;
            while (memoryAddr < BigInt(memory.getSize())) {
                const byte = memory.read(memoryAddr);
                if (byte === 0) break; // Null terminator
                until += String.fromCharCode(byte);
                memoryAddr++;
            }

        // console.log("Until string: ", until);
        }

    // Deno / CLI mode
    if (typeof Deno !== "undefined") {
        let keystroke = rawPrompt();

        if (until && typeof until === "string" && until !== "" ) {
            const idx = keystroke.indexOf(until);
            if (idx !== -1) {
                keystroke = keystroke.substring(0, idx);
            }
        }
        if (keystroke.includes(target) && keystroke.length <= length) {
            writeRegister(1n, ret1.indexComp, ret1.indexElem);
        } else {
            writeRegister(0n, ret1.indexComp, ret1.indexElem);
        }



        status.run_program = 0;
        return packExecute(
            false,
            "The result has been written to the register",
            "info",
            null,
        );
    }

    // Web/UI mode
    document.app.$data.enter = false; // wait for input

    if (status.run_program === 3) {
        setTimeout(keyboard_read_find, 1000, fn_post_read, fn_post_params, fn_post_length,fn_post_until);
        return draw;
    }

    let keystroke = document.app.$data.keyboard;

    if (!keystroke || keystroke.length === 0) {
        status.run_program = 3;
        return keyboard_read_find(fn_post_read, fn_post_params, fn_post_length,fn_post_until);
    }

    // Find logic
    // console.log("keystroke:", `"${keystroke}"`, keystroke.length);
    // console.log("until:", `"${until}"`, until.length);
    if (until && typeof until === "string" && until !== "" ) {
        const idx = keystroke.indexOf(until);
        if (idx !== -1) {
            keystroke = keystroke.substring(0, idx);
        }
    }
    if (keystroke.includes(target) && keystroke.length <= length) {
        writeRegister(1n, ret1.indexComp, ret1.indexElem);
    } else {
        writeRegister(0n, ret1.indexComp, ret1.indexElem);
    }

    document.app.$data.keyboard = "";
    document.app.$data.enter = null;

    draw.info.push("The result has been written to the register");

    if (status.execution_index >= instructions.length) {
        for (let i = 0; i < instructions.length; i++) {
            draw.space.push(i);
        }
        status.execution_index = -2;
        return packExecute(
            true,
            "The execution of the program has finished",
            "success",
            null,
        );
    }
    // If program was running before waiting for input, continue execution automatically
    if (status.run_program === 1) {
        const playButton = document.getElementById("playExecution");
        if (playButton) {
            playButton.click();
        }
    }

    // Re-enable buttons
    if (typeof document !== "undefined" && document.app) {
        coreEvents.emit(CoreEventTypes.EXECUTOR_BUTTONS_UPDATE, {
            instruction_disable: false,
            run_disable: false,
        });
    }

    return draw;
}
