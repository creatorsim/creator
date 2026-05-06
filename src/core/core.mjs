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
import yaml from "js-yaml";
import { initCAPI } from "./capi/initCAPI.mts";
import { getHexTwosComplement } from "./utils/utils.mjs";
import { logger } from "./utils/creator_logger.mjs";
import {
    assembly_compiler,
    instructions,
    setInstructions,
} from "./assembler/assembler.mjs";
import { Memory } from "./memory/Memory.mts";

import {
    crex_findReg,
    crex_findReg_bytag,
    crex_clearRegisterCache,
} from "./register/registerLookup.mjs";
import { readRegister, writeRegister } from "./register/registerOperations.mjs";
import { StackTracker } from "./memory/StackTracker.mts";
import { creator_ga } from "./utils/creator_ga.mjs";
import { sentinel } from "./sentinel/sentinel.mts";
import { resetStats } from "./executor/stats.mts";
import { resetDecoderCache } from "./executor/decoder.mjs";
import { coreEvents } from "./events.mts";
import {
    ExecutionMode,
    InterruptHandlerType,
    InterruptManager,
} from "./executor/InterruptManager.mts";
import { init, compileArchitectureFunctions } from "./executor/executor.mjs";
import { resetDevices } from "./executor/devices.mts";
import { compileTimerFunctions } from "./executor/timers.mts";
import * as archProcessor from "./utils/architectureProcessor.mjs";
import { writeDataDumpMemory32, writeDataDumpMemory64 } from "./assembler/sailAssembler/web/CNAssambler.mjs";
import { disassemble_lib } from "@/web/components/assembly/MultifileEditor.mjs";

/** @type {import("./core.d.ts").Library | import("./core.d.ts").LegacyLibrary} */
export let loadedLibrary = {};
export let backup_stack_address;
export let backup_data_address;
export let loadedCreatino = false;

/** @type {import("./core.d.ts").Architecture} */
export let architecture = {};
export let newArchitecture;

/** @type {import("./core.d.ts").Status} */
export let status = {
    execution_init: 1,
    executedInstructions: 0,
    clkCycles: 0,
    run_program: 0, // 0: stopped, 1: running, 2: stopped-by-breakpoint, 3: stopped-by-mutex-read

    keyboard: "",
    display: "",
    execution_index: 0,
    error: false,
    execution_mode: ExecutionMode.User,
    interrupt_handler: InterruptHandlerType.CREATOR,
    pcRegisterNames: [], // TODO: move this out of here
};
/** @type {import("./core.d.ts").GUIVariables} */
export const guiVariables = {
    previous_PC: 0n, // Used in the GUI to show the last executed instruction
    keep_highlighted: -1n, // Address to keep highlighted (used to highlight interrupted instructions)
};

export var L1_cache_memory = [/*{id:0, addr: "0", binary: "0x00"}*/];
export var L1_I_cache_memory = [];
export var L1_D_cache_memory = [];
export var L2_cache_memory = [];
export var L2_I_cache_memory = [];
export var L2_D_cache_memory = [];
export var config_cache = [];
/** @type {number} */
export let WORDSIZE;
/** @type {number} */
export let BYTESIZE;
export let ENDIANNESSARR = [];
/** @type {import("./core.d.ts").RegisterFile[]} */
export let REGISTERS;
export const register_size_bits = 32; //TODO: load from architecture
/** @type {Memory} */
export let main_memory;
/** @type {StackTracker} */
export let stackTracker;
/** @type {InterruptManager} */
export let interruptManager;
/**
 * Sets `interruptManager`.
 *
 * @param {InterruptManager} value
 */
export function setInterruptManager(value) {
    interruptManager = value;
}
/** @type {MemoryBackup} */
export let main_memory_backup;
export function updateMainMemoryBackup(value) {
    main_memory_backup = value;
}
export let PC_REG_INDEX; // Index of the PC register (indexComp, indexElem). Set when loading architecture.
export let SP_REG_INDEX; // Index of the SP register (indexComp, indexElem). Set when loading architecture.

export let execution_mode = 0; // 0: instruction by instruction, 1: run program
export function set_execution_mode(value) {
    execution_mode = value;
} // it's the only way
export const instructions_packed = 100;

export { initCAPI }; // Instead of calling it here, which causes circular dependencies, we re-export it so it can be called by the main application.
let creator_debug = false;
let creator_kernel = true;

BigInt.prototype.toJSON = function () {
    return JSON.rawJSON(this.toString());
};

export function set_debug(enable_debug) {
    creator_debug = enable_debug;
    if (creator_debug) {
        logger.enable();
        logger.setLevel("DEBUG");
    } else {
        logger.disable();
    }
}

export function set_kernel(enable_kernel) {
    creator_kernel = enable_kernel;
}

/**
 * Load architecture from YAML string and prepare for use
 * @param {string} architectureYaml - YAML string containing architecture definition
 * @param {Array} isa - Array of instruction set names to load
 * @returns {{errorcode: string, token: string, type: string, update: string, status: string}} - Result object with load status
 */
export function loadArchitecture(architectureYaml, isa = []) {
    // Process the architecture YAML through all validation and preparation steps
    const result = archProcessor.processArchitectureFromYaml(
        architectureYaml,
        isa,
    );

    // If processing failed, return the error
    if (result.status !== "ok") {
        return result;
    }

    // Store the processed architecture
    const archObject = result.architecture;
    newArchitecture = archObject;
    architecture = archObject;

    // Initialize core configuration from architecture
    WORDSIZE = newArchitecture.config.word_size;
    BYTESIZE = newArchitecture.config.byte_size;
    const endianness = newArchitecture.config.endianness;

    const bytesPerWord = WORDSIZE / BYTESIZE;

    if (endianness === "big_endian") {
        ENDIANNESSARR = Array.from({ length: bytesPerWord }, (_, i) => i);
    } else if (endianness === "little_endian") {
        ENDIANNESSARR = Array.from(
            { length: bytesPerWord },
            (_, i) => bytesPerWord - 1 - i,
        );
    } else if (Array.isArray(endianness)) {
        ENDIANNESSARR = endianness;
    }

    REGISTERS = architecture.register_files;
    status.pcRegisterNames = REGISTERS.flatMap(bank => bank.registers).find(
        reg => reg.properties.includes("program_counter"),
    ).name;
    crex_clearRegisterCache();

    backup_stack_address = architecture.memory_layout.stack.start;
    backup_data_address = architecture.memory_layout.data.end;

    // Initialize main memory with architecture layout support

    // Calculate the total size of the memory
    // Get the smallest memory address in the memory layout
    const minMemoryAddress = Math.min(
        ...Object.values(architecture.memory_layout).map(({ start }) => start),
    );
    // Get the largest memory address in the memory layout
    const maxMemoryAddress = Math.max(
        ...Object.values(architecture.memory_layout).map(({ end }) => end),
    );
    // Calculate the total size
    const totalMemorySize = maxMemoryAddress - minMemoryAddress + 1;

    // Create memory with layout support
    main_memory = new Memory({
        sizeInBytes: totalMemorySize,
        bitsPerByte: BYTESIZE,
        wordSize: WORDSIZE / BYTESIZE,
        memoryLayout: Object.entries(architecture.memory_layout),
        baseAddress: BigInt(minMemoryAddress),
        endianness: ENDIANNESSARR,
    });

    // Initialize stack tracker and other related components
    // This must happen before creating the register backup
    stackTracker = new StackTracker();
    interruptManager = new InterruptManager(status.interrupt_handler);

    PC_REG_INDEX = crex_findReg_bytag("program_counter");
    SP_REG_INDEX = crex_findReg_bytag("stack_pointer");

    compileTimerFunctions();

    compileArchitectureFunctions(architecture);

    return {
        errorcode: "",
        token: "The selected architecture has been loaded correctly",
        type: "success",
        update: "",
        status: "ok",
    };
}

/**
 * Loads a library.
 *
 * @param {string} lib_str
 *
 * @throws {SyntaxError} If the library is invalid
 */
export function load_library(lib_str) {
    // Parse YAML library format
    try {
        loadedLibrary = yaml.load(lib_str);
        coreEvents.emit("library-loaded");
    } catch (error) {
        throw new SyntaxError(`Invalid library format: ${error.message}`);
    };
}
/**
 * Loads a library to Sail simulator.
 *
 * @param {string} lib_str
 *
 */

export async function load_library_sail(lib, lib_name) {
    loadedLibrary = {name: lib_name, library_file: lib};
    await disassemble_lib(loadedLibrary);
    coreEvents.emit("library-loaded");
}

/**
 * Removes a library.
 */
export function remove_library() {
    loadedLibrary = {};
    loadedCreatino = false;
    coreEvents.emit("library-removed");
}
export async function load_CREATino() {
  //show_loading();
  try {
    const baseUrl = import.meta.env.BASE_URL
    const filePath = `${baseUrl}libraries/creatino.yml`

    const response = await fetch(filePath);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const fileContent = await response.text();
    load_library(fileContent);

    //hide_loading();
    loadedCreatino = true;
    coreEvents.emit("library-loaded");
  } catch (error) {
    throw new SyntaxError(`Invalid library format: ${error.message}`);
  }
}

// compilation

/**
 * Compiles an assembly code with the chosen compiler
 * @param {string} code
 * @param {import("./assembler/assembler.d.ts").CompilerFn} compiler
 * @param {boolean} ansi_color - Whether to format errors with ANSI escape sequences
 * (`true`) or HTML tags (`false`)
 **/
export async function assembly_compile(code, compiler, ansi_color = false) {
    var ret;

    if (architecture.config.name.includes("SRV")){
        if (Object.keys(loadedLibrary).length === 0)
            ret = await assembly_compiler(code, false, compiler, ansi_color);
        else 
            ret = await assembly_compiler(code, true, compiler, ansi_color);
    }
    else{
        ret = await assembly_compiler(code, false, compiler, ansi_color);
    }

    switch (ret.status) {
        case "error":
            break;

        case "warning":
            ret.msg = "warning: " + ret.token;
            break;

        case "ok":
            ret.msg = "Compilation completed successfully";
            main_memory_backup = main_memory.dump();
            break;

        default:
            ret.msg = "Unknown assembly compiler code :-/";
            break;
    }

    // Initialize execution environment
    init();

    return ret;
}

// execution

export function reset() {
    // Google Analytics
    creator_ga("execute", "execute.reset");

    status.execution_index = 0;
    status.execution_init = 1;
    status.run_program = 0;

    guiVariables.previous_PC = -1n;
    guiVariables.keep_highlighted = -1n;

    // Reset stats
    resetStats();

    // Reset decoder cache
    resetDecoderCache();

    status.executedInstructions = 0;
    status.clkCycles = 0;

    // Reset console
    status.keyboard = "";
    status.display = "";

    // reset registers
    // Restore register default values
    for (const file of REGISTERS) {
        for (const register of file.registers) {
            register.value = register.default_value
        }
    }
    crex_clearRegisterCache();

    // Notify UI layers that all registers have been reset
    coreEvents.emit("registers-reset");
    coreEvents.emit("step-about-to-execute");

    architecture.memory_layout.stack.start = backup_stack_address;
    delete architecture.memory_layout.stack.size;
    architecture.memory_layout.data.end = backup_data_address;

    // reset memory and restore initial hints from backup (if it exists)
    if (typeof main_memory_backup !== "undefined") {
        main_memory.restore(main_memory_backup);
    }

    if (architecture.config.name.includes("SRV")){
        for (const instruction of instructions ?? []){
            const auxAddr = parseInt(instruction.Address,16);
            for (let j = 0; j < instruction.hex.length; j += 32) {
                const wordBinary = instruction.hex.slice(j, j+32);
                const wordBytes = [];

                // Split word into bytes
                for (let k = 0; k < wordBinary.length; k += 8) {
                    const byte = parseInt(wordBinary.slice(k, k+8), 2);
                    wordBytes.push(byte);
                }

                main_memory.writeWord(BigInt(auxAddr + j / 8), wordBytes);
            }
        }
        instructions.forEach(insn => {
            insn.L1 = 0;
            insn.L1_I = 0;
            insn.L1_D = 0;
            insn.L2 = 0;
            insn.L2_I = 0;
            insn.L2_D = 0;
        });
        if (architecture.config.name === "SRV32")
            writeDataDumpMemory32();
        else
            writeDataDumpMemory64();

    }
    // Stack Reset
    stackTracker.reset();
    sentinel.reset();

    // clear all read timeouts
    let id = setTimeout(() => {}, 0); // dummy timeout to get max ID
    while (id--) {
        clearTimeout(id); // will do nothing if no timeout with id is present
    }

    // reset interrupts
    interruptManager.reset();

    // reset devices
    resetDevices();

    // Initialize execution environment
    init();

    return true;
}

export function snapshot(extraData) {
    // Dump architecture object to file
    const architectureJson = JSON.stringify(architecture);
    const instructionsJson = JSON.stringify(instructions);

    // Use sparse memory dump for efficiency
    const memoryDump = main_memory.dump();
    const memoryJson = JSON.stringify(memoryDump);

    // And the status
    const statusJson = JSON.stringify(status);

    // And the registers
    const registersJson = JSON.stringify(REGISTERS);

    // And the stack
    const stackData = stackTracker.dump();

    // Combine all JSON strings into a single snapshot string
    const combinedState = JSON.stringify({
        architecture: architectureJson,
        instructions: instructionsJson,
        memory: memoryJson,
        status: statusJson,
        registers: registersJson,
        stack: stackData,
        extraData,
    });

    // Return the snapshot string
    return combinedState;
}

export function restore(snapshot) {
    // Parse the snapshot string back into an object
    const parsedSnapshot = JSON.parse(snapshot);
    const architectureJson = parsedSnapshot.architecture;
    const memoryJson = parsedSnapshot.memory;
    const instructionsJson = parsedSnapshot.instructions;
    const statusJson = parsedSnapshot.status;
    const registersJson = parsedSnapshot.registers;
    const architectureObj = JSON.parse(architectureJson);
    const memoryObj = JSON.parse(memoryJson);
    const instructionsObj = JSON.parse(instructionsJson);
    const statusObj = JSON.parse(statusJson);
    const registersObj = registersJson ? JSON.parse(registersJson) : null;
    const stackData = parsedSnapshot.stack;

    main_memory.restore(memoryObj);

    // Restore the instructions
    setInstructions(instructionsObj);
    // Restore the architecture object
    architecture = architectureObj;
    // Restore the registers
    if (registersObj) {
        REGISTERS = registersObj;
        crex_clearRegisterCache();
    }
    // Restore the stack
    stackTracker.load({
        frames: stackData.frames,
        hints: new Map(Object.entries(stackData.hints)),
    });
    stackTracker.load({
        frames: stackData.frames,
        hints: new Map(Object.entries(stackData.hints)),
    });

    // Restore the status
    status = statusObj;
}
export function dumpMemory(startAddr, numBytes, bytesPerRow = 16) {
    startAddr = BigInt(startAddr);
    numBytes = BigInt(numBytes);
    bytesPerRow = BigInt(bytesPerRow);

    let output = "";
    let currentAddr = startAddr;
    const endAddr = startAddr + numBytes;

    // Create header
    output += "       ";
    for (let i = 0n; i < bytesPerRow; i++) {
        output += " " + i.toString(16).padStart(2, "0");
    }
    output += "  | ASCII\n";
    output +=
        "-------" +
        "-".repeat(Number(bytesPerRow) * 3) +
        "---" +
        "-".repeat(Number(bytesPerRow)) +
        "\n";

    // Create rows
    while (currentAddr < endAddr) {
        // Address column
        output += "0x" + currentAddr.toString(16).padStart(4, "0") + ": ";

        let hexValues = "";
        let asciiValues = "";

        // Process bytes for this row
        for (let i = 0n; i < bytesPerRow; i++) {
            if (currentAddr + i < endAddr) {
                const byte = main_memory.read(currentAddr + i);
                const byteValue = byte.toString(16).padStart(2, "0");
                hexValues += byteValue + " ";

                // Try to convert to ASCII, use dot for non-printable chars
                const charCode = parseInt(byteValue, 16);
                if (charCode >= 32 && charCode <= 126) {
                    // Printable ASCII range
                    asciiValues += String.fromCharCode(charCode);
                } else {
                    asciiValues += ".";
                }
            } else {
                // Padding for incomplete row
                hexValues += "   ";
                asciiValues += " ";
            }
        }

        output += hexValues + "| " + asciiValues + "\n";
        currentAddr += bytesPerRow;
    }

    return output;
}

export function dumpAddress(startAddr, numBytes) {
    startAddr = BigInt(startAddr);
    numBytes = BigInt(numBytes);

    const result = [];
    let currentAddr = startAddr;
    const endAddr = startAddr + numBytes;

    while (currentAddr < endAddr) {
        const byteValue = main_memory.read(currentAddr);
        result.push(byteValue);
        currentAddr += 1n;
    }
    // Convert the result to a string representation
    const resultString = result
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");

    return resultString;
}

export function dumpRegister(register, format = "hex") {
    if (typeof register === "undefined") {
        return ret;
    }

    const result = crex_findReg(register);
    const registerSize =
        REGISTERS[result.indexComp].registers[result.indexElem].nbits;

    if (result.match === 1) {
        if (format === "hex") {
            const value = readRegister(
                result.indexComp,
                result.indexElem,
            ).toString(16);
            return value;
        } else if (format === "twoscomplement") {
            const value = readRegister(result.indexComp, result.indexElem);
            const twosComplement = getHexTwosComplement(value, registerSize);
            return twosComplement;
        } else if (format === "raw") {
            const value =
                REGISTERS[result.indexComp].registers[
                    result.indexElem
                ].value.toString(16);
            return value;
        } else if (format === "decimal") {
            const value = readRegister(result.indexComp, result.indexElem);
            return value;
        }
    }
    return null;
}

export function getRegisterTypes() {
    // Extract unique register types from architecture register files
    const registerTypes = REGISTERS.map(file => file.type);

    return registerTypes;
}

export function getRegistersByBank(regType) {
    // Find the register file with the specified register type
    const file = REGISTERS.find(comp => comp.type === regType);
    return file? file : null;
}

export function getRegisterInfo(regName) {
    // Find the register in all register files
    for (const file of REGISTERS) {
        for (const element of file.registers) {
            // Check if this register matches by any of its names
            if (element.name.includes(regName)) {
                return {
                    ...element,
                    type: file.type,
                    nbits: element.nbits,
                };
            }
        }
    }

    return null;
}

export function getPC() {
    return readRegister(
        PC_REG_INDEX.indexComp,
        PC_REG_INDEX.indexElem,
    );
}

export function getSP() {
    if (!SP_REG_INDEX || SP_REG_INDEX.match === 0) {
        return null;
    }
    const sp_address = readRegister(
        SP_REG_INDEX.indexComp,
        SP_REG_INDEX.indexElem,
    );
    return BigInt(sp_address);
}

export function setPC(value) {
    writeRegister(value, PC_REG_INDEX.indexComp, PC_REG_INDEX.indexElem);

    return null;
}

export function updateCacheMem(index, type, addr, value) {
    
    // Identificamps primero a que cache afecta
    // Despues comprobamos si ese bloque de cache ya existe
    // Si existe se reemplaza, sino se hace un push de una nueva línea
    switch(type) {
        case "L1_I":
        let L1_I_index = L1_I_cache_memory.findIndex(block => block.id === index);
        if (L1_I_index === -1) {
            let set_id = (document.app.$data.cache_location === "Associative_per_sets") ? Math.floor(index / document.app.$data.L1_I_num_lines) :  -1;
            L1_I_cache_memory.push({set_id: set_id, id: index, addr: addr, size: /*value.slice(2).length * 4*/ value/*value.slice(2)*/});
        } else {
            
            L1_I_cache_memory[L1_I_index].size = /*value.slice(2).length * 4*/ value; // Length in bits
            L1_I_cache_memory[L1_I_index].addr = addr;
        }
        document.app.L1_I_cache_memory = L1_I_cache_memory;
        break;
        case "L1_D":
        let L1_D_index = L1_D_cache_memory.findIndex(block => block.id === index);
        if (L1_D_index === -1) {
            let set_id = (document.app.$data.cache_location === "Associative_per_sets") ? Math.floor(index / document.app.$data.L1_D_num_lines) :  -1;
            L1_D_cache_memory.push({set_id: set_id, id: index, addr: addr, size: /*value.slice(2).length * 4*/ value/*value.slice(2)*/});
        } else {
            
            L1_D_cache_memory[L1_D_index].size = /*value.slice(2).length * 4*/ value; // Length in bits
            L1_D_cache_memory[L1_D_index].addr = addr;
        }
        break;
        case "L1":
        let L1_index = L1_cache_memory.findIndex(block => block.id === index);
        if (L1_index === -1) {
            let set_id = (document.app.$data.cache_location === "Associative_per_sets") ? Math.floor(index / document.app.$data.L1_num_lines) :  -1;
            L1_cache_memory.push({set_id: set_id, id: index, addr: addr, size: /*value.slice(2).length * 4*/ value/*value.slice(2)*/});
        } else {
            
            L1_cache_memory[L1_index].size = /*value.slice(2).length * 4*/ value; // Length in bits
            L1_cache_memory[L1_index].addr = addr;
        }
        break;
        case "L2":
        let L2_index = L2_cache_memory.findIndex(block => block.id === index);
        if (L2_index === -1) {
            let set_id = (document.app.$data.cache_location === "Associative_per_sets") ? Math.floor(index / document.app.$data.L2_num_lines) :  -1;
            L2_cache_memory.push({set_id: set_id, id: index, addr: addr, size: /*value.slice(2).length * 4*/ value/*value.slice(2)*/});
        } else {
            
            L2_cache_memory[L2_index].size = /*value.slice(2).length * 4*/ value; // Length in bits
            L2_cache_memory[L2_index].addr = addr;
        }
        break;
        case "L2_I":
        let L2_I_index = L2_I_cache_memory.findIndex(block => block.id === index);
        if (L2_I_index === -1) {
            let set_id = (document.app.$data.cache_location === "Associative_per_sets") ? Math.floor(index / document.app.$data.L2_I_num_lines) :  -1;
            L2_I_cache_memory.push({set_id: set_id, id: index, addr: addr, size: /*value.slice(2).length * 4*/ value/*value.slice(2)*/});
        } else {
            
            L2_I_cache_memory[L2_I_index].size = /*value.slice(2).length * 4*/ value; // Length in bits
            L2_I_cache_memory[L2_I_index].addr = addr;
        }
        document.app.L2_I_cache_memory = L2_I_cache_memory;
        break;
        case "L2_D":
        let L2_D_index = L2_D_cache_memory.findIndex(block => block.id === index);
        if (L2_D_index === -1) {
            let set_id = (document.app.$data.cache_location === "Associative_per_sets") ? Math.floor(index / document.app.$data.L2_D_num_lines) :  -1;
            L2_D_cache_memory.push({set_id: set_id, id: index, addr: addr, size: /*value.slice(2).length * 4*/ value/*value.slice(2)*/});
        } else {
            
            L2_D_cache_memory[L2_D_index].size = /*value.slice(2).length * 4*/ value; // Length in bits
            L2_D_cache_memory[L2_D_index].addr = addr;
        }
        break;
    }
}
