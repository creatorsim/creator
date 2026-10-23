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

import {
    main_memory,
    status,
    loadedLibrary,
    architecture,
    backup_stack_address,
    backup_data_address,
    newArchitecture,
    ENDIANNESSARR,
    WORDSIZE,
    BYTESIZE,
} from "../../core.mjs";
import { creator_ga } from "../../utils/creator_ga.mjs";
import {
    set_tag_instructions,
    writeMultiByteValueAsWords,
    setAddress,
    setInstructions,
    setLibraryInstructions,
    getCleanErrorMessage,
    parseErrorForLinter,
} from "../assembler.mjs";
import { logger } from "../../utils/creator_logger.mjs";

// NOTE: the types are the same in the web and deno versions, so we can use
// either. However, tests download only the deno binaries, so it's better to use
// that

/**
 * Assembler's WASM modules
 * @typedef {import("./deno/wasm/creator_assembler.d.ts")} WasmModules
 */

/**
 * @typedef {import("./deno/wasm/creator_assembler.d.ts").ArchitectureJS} ArchitectureJS
 */

/**
 * @typedef {import("./deno/wasm/creator_assembler.d.ts").DataJS} DataJS
 */

let libraryInstructions = [];

/**
 * Handle compilation error
 * @param {String} error - Error message returned by the assembler
 * @param {boolean} ansi_color - Whether errors are formatted with ANSI or HTML colors
 * @returns {Object} Structured error data
 */
function handleError(error, ansi_color) {
    const cleanErrorText = getCleanErrorMessage(error, ansi_color);
    const linterInfo = parseErrorForLinter(cleanErrorText);
    return {
        errorcode: "101",
        type: "error",
        bgcolor: "danger",
        status: "error",
        msg: error,
        linter: linterInfo,
    };
}

/**
 * Initialize architecture and prepare for compilation
 * @param {WasmModules} wasmModules - Assembler's WASM modules
 * @returns {ArchitectureJS} Architecture instance. If an error occurs, an exception is raised
 */
function initializeArchitecture(wasmModules) {
    const { ArchitectureJS } = wasmModules;

    try {
        return ArchitectureJS.from_json(JSON.stringify(architecture));
    } catch (error) {
        logger.error("Error loading architecture:", error);
        const cleanErrorText = getCleanErrorMessage(error);
        const linterInfo = parseErrorForLinter(cleanErrorText);
        throw {
            type: "warning",
            token: error,
            bgcolor: "danger",
            status: "error",
            linter: linterInfo,
        };
    }
}

/**
 * Reset memory and execution state
 */
function resetMemoryAndState() {
    main_memory.zeroOut();
    main_memory.clearHints();
    status.execution_init = 1;
    architecture.memory_layout.stack.start = backup_stack_address;
    architecture.memory_layout.data.end = backup_data_address;
}

/**
 * Load library instructions and labels when compiling a normal program
 * @param {Array} instructions - Array to populate with instructions
 * @returns {Object} Information about loaded library
 */
function loadLibraryIfPresent(instructions) {
    let library_offset = 0;
    let library_instructions = 0;
    const library_labels = {};

    if (!loadedLibrary || Object.keys(loadedLibrary).length === 0) {
        return { library_offset, library_instructions, library_labels };
    }

    // Validate library format
    if (
        !loadedLibrary.version ||
        !loadedLibrary.binary ||
        !loadedLibrary.symbols
    ) {
        throw new Error(
            "Invalid library format: missing required fields (version, binary, symbols)",
        );
    }

    // Convert hex string to binary string
    let binaryString = "";
    for (let i = 0; i < loadedLibrary.binary.length; i += 2) {
        const hexByte = loadedLibrary.binary.slice(i, i + 2);
        const byte = parseInt(hexByte, 16);
        binaryString += byte.toString(2).padStart(8, "0");
    }

    // Build a map of addresses to symbols
    const symbolsByAddr = new Map();
    for (const [name, symbolData] of Object.entries(loadedLibrary.symbols)) {
        symbolsByAddr.set(symbolData.addr, name);
        library_labels[name] = symbolData.addr;
    }

    // Calculate instruction size in bits
    const instructionSizeBits = WORDSIZE;
    const instructionSizeBytes = instructionSizeBits / 8;

    // Process each instruction
    let currentAddr = 0;
    for (let i = 0; i < binaryString.length; i += instructionSizeBits) {
        const instructionBinary = binaryString.slice(
            i,
            i + instructionSizeBits,
        );
        const symbolName = symbolsByAddr.get(currentAddr);
        const hasSymbol = symbolName !== undefined;

        const instruction = {
            Break: null,
            Address: `0x${currentAddr.toString(16)}`,
            Label: hasSymbol ? [symbolName] : [],
            loaded: instructionBinary,
            user: null,
            _rowVariant: "",
            visible: false,
            globl: hasSymbol,
            hide: !(library_instructions === 0 || hasSymbol),
        };

        instructions.push(instruction);
        library_instructions++;
        library_offset = currentAddr + instructionSizeBytes;
        currentAddr += instructionSizeBytes;
    }

    return { library_offset, library_instructions, library_labels };
}

/**
 * Load data elements from compilation into memory
 * @param {DataJS[]} data_mem - Array of data elements from compiler
 * @param {WasmModules} wasmModules - Assembler's WASM modules
 */
// eslint-disable-next-line max-lines-per-function
function loadDataIntoMemory(data_mem, wasmModules) {
    const { DataCategoryJS } = wasmModules;
    const wordSizeBytes =
        newArchitecture.config.word_size / newArchitecture.config.byte_size;
    for (let i = 0; i < data_mem.length; i++) {
        const data = data_mem[i];
        const addr = data.address();
        const size = data.size();
        const labels = data.labels();
        const category = data.data_category();

        switch (category) {
            case DataCategoryJS.Number:
                switch (data.type()) {
                    case "float": {
                        const floatValue = data.value(true);
                        const buffer = new ArrayBuffer(4);
                        const view = new DataView(buffer);
                        view.setFloat32(0, floatValue, false);

                        const floatBytes = new Uint8Array(4);
                        for (let i = 0; i < 4; i++) {
                            floatBytes[i] = view.getUint8(i);
                        }

                        writeMultiByteValueAsWords(
                            addr,
                            floatBytes,
                            wordSizeBytes,
                        );

                        const floatType = "float32";
                        main_memory.addHint(
                            addr,
                            labels,
                            floatType,
                            32,
                            data.value(true),
                        );
                        break;
                    }
                    case "double": {
                        const doubleValue = data.value(true);
                        const buffer = new ArrayBuffer(8);
                        const view = new DataView(buffer);
                        view.setFloat64(0, doubleValue, false);

                        const doubleBytes = new Uint8Array(8);
                        for (let i = 0; i < 8; i++) {
                            doubleBytes[i] = view.getUint8(i);
                        }

                        writeMultiByteValueAsWords(
                            addr,
                            doubleBytes,
                            wordSizeBytes,
                        );

                        const doubleType = "float64";
                        main_memory.addHint(
                            addr,
                            labels,
                            doubleType,
                            64,
                            data.value(true),
                        );
                        break;
                    }
                    case "byte": {
                        const byteValue = Number("0x" + data.value(false));
                        main_memory.write(addr, byteValue);

                        const byteType = "byte";
                        main_memory.addHint(
                            addr,
                            labels,
                            byteType,
                            8,
                            data.value(true),
                        );
                        break;
                    }
                    case "word":
                        {
                            const wordValue = BigInt("0x" + data.value(false));
                            const wordBytes = new Uint8Array(wordSizeBytes);

                            for (let i = 0; i < wordSizeBytes; i++) {
                                const shiftAmount = BigInt(
                                    (wordSizeBytes - 1 - i) *
                                        newArchitecture.config.byte_size,
                                );
                                wordBytes[i] = Number(
                                    (wordValue >> shiftAmount) &
                                        BigInt(
                                            (1 <<
                                                newArchitecture.config
                                                    .byte_size) -
                                                1,
                                        ),
                                );
                            }

                            main_memory.writeWord(addr, wordBytes);

                            const wordType = "word";
                            main_memory.addHint(
                                addr,
                                labels,
                                wordType,
                                newArchitecture.config.word_size,
                                data.value(true),
                            );
                        }
                        break;

                    case "double_word": {
                        const dwordValue = BigInt("0x" + data.value(false));

                        const highWord =
                            dwordValue >>
                            BigInt(newArchitecture.config.word_size);
                        const lowWord =
                            dwordValue &
                            BigInt(
                                (1n <<
                                    BigInt(newArchitecture.config.word_size)) -
                                    1n,
                            );

                        const highWordBytes = new Uint8Array(wordSizeBytes);
                        const lowWordBytes = new Uint8Array(wordSizeBytes);

                        for (let i = 0; i < wordSizeBytes; i++) {
                            const shiftAmount = BigInt(
                                (wordSizeBytes - 1 - i) *
                                    newArchitecture.config.byte_size,
                            );
                            highWordBytes[i] = Number(
                                (highWord >> shiftAmount) &
                                    BigInt(
                                        (1 <<
                                            newArchitecture.config.byte_size) -
                                            1,
                                    ),
                            );
                            lowWordBytes[i] = Number(
                                (lowWord >> shiftAmount) &
                                    BigInt(
                                        (1 <<
                                            newArchitecture.config.byte_size) -
                                            1,
                                    ),
                            );
                        }

                        main_memory.writeWord(addr, highWordBytes);
                        main_memory.writeWord(
                            addr + BigInt(wordSizeBytes),
                            lowWordBytes,
                        );

                        const dwordType = "dword";
                        main_memory.addHint(
                            addr,
                            labels,
                            dwordType,
                            64,
                            data.value(true),
                        );
                        break;
                    }

                    case "half": {
                        const halfValue = BigInt("0x" + data.value(false));
                        const halfBytes = new Uint8Array(2);
                        halfBytes[0] = Number((halfValue >> 8n) & 0xffn);
                        halfBytes[1] = Number(halfValue & 0xffn);

                        const orderedBytes = new Uint8Array(2);
                        const byte0Pos = ENDIANNESSARR.indexOf(0);
                        const byte1Pos = ENDIANNESSARR.indexOf(1);

                        if (byte0Pos < byte1Pos) {
                            orderedBytes[0] = halfBytes[0];
                            orderedBytes[1] = halfBytes[1];
                        } else {
                            orderedBytes[0] = halfBytes[1];
                            orderedBytes[1] = halfBytes[0];
                        }

                        main_memory.write(addr, orderedBytes[0]);
                        main_memory.write(addr + 1n, orderedBytes[1]);

                        const halfType = "half";
                        main_memory.addHint(
                            addr,
                            labels,
                            halfType,
                            16,
                            data.value(true),
                        );
                        break;
                    }
                    default: {
                        throw new Error(
                            `Unsupported number type: ${data.type()}`,
                        );
                    }
                }
                break;

            case DataCategoryJS.String: {
                const bytes = new TextEncoder().encode(data.value(false));
                for (let i = 0n; i < bytes.length; i++) {
                    main_memory.write(addr + i, bytes[i]);
                }

                const stringLength = Number(size);
                const stringType = "string";
                main_memory.addHint(addr, labels, stringType, stringLength * 8);
                break;
            }

            case DataCategoryJS.Padding:
            case DataCategoryJS.Space: {
                for (let j = 0n; j < size; j++) {
                    main_memory.write(addr + j, 0);
                }

                const spaceType =
                    category === DataCategoryJS.Padding ? "padding" : "space";
                main_memory.addHint(addr, labels, spaceType, Number(size) * 8);
                break;
            }

            default:
                throw new Error(`Unknown data category: ${category}`);
        }
    }
}

/**
 * Write binary to memory
 * @param {string} binary - Binary string to write
 */
function writeBinaryToMemory(binary, baseAddr) {
    // Split into words, reverse order, and concatenate
    const words = [];
    for (let j = 0; j < binary.length; j += WORDSIZE) {
        words.push(binary.slice(j, j + WORDSIZE));
    }
    const reversedBinary = words.reverse().join("");

    for (let j = 0; j < reversedBinary.length; j += WORDSIZE) {
        const wordBinary = reversedBinary.slice(j, j + WORDSIZE);
        const wordBytes = [];

        for (let k = 0; k < wordBinary.length; k += BYTESIZE) {
            const byte = parseInt(wordBinary.slice(k, k + BYTESIZE), 2);
            wordBytes.push(byte);
        }

        main_memory.writeWord(BigInt(baseAddr + j / BYTESIZE), wordBytes);
    }
}

/**
 * Write library binary instructions to memory
 */
function writeLibraryToMemory() {
    if (!loadedLibrary || Object.keys(loadedLibrary).length === 0) {
        return;
    }

    let binaryString = "";
    for (let i = 0; i < loadedLibrary.binary.length; i += 2) {
        const hexByte = loadedLibrary.binary.slice(i, i + 2);
        const byte = parseInt(hexByte, 16);
        binaryString += byte.toString(2).padStart(8, "0");
    }

    let currentAddr = 0;
    const instructionSizeBits = WORDSIZE;
    const instructionSizeBytes = instructionSizeBits / 8;

    for (let i = 0; i < binaryString.length; i += instructionSizeBits) {
        const instructionBinary = binaryString.slice(
            i,
            i + instructionSizeBits,
        );
        writeBinaryToMemory(instructionBinary, currentAddr);
        currentAddr += instructionSizeBytes;
    }
}

/**
 * Write compiled instructions to memory
 * @param {Array} instructions - Array of instructions
 * @param {number} library_instructions - Number of library instructions to skip
 */
function writeInstructionsToMemory(instructions, library_instructions) {
    for (let i = library_instructions; i < instructions.length; i++) {
        const instruction = instructions[i];
        const addr = parseInt(instruction.Address, 16);
        writeBinaryToMemory(instruction.binary, addr);
    }
}

/**
 * Compile assembly code as a library
 * @param {string} code - Assembly code to compile
 * @param {WasmModules} wasmModules - Assembler's WASM modules
 * @param {boolean} ansi_color - Whether to use ANSI or HTML colors (default: HTML)
 * @returns {Object} Compilation result
 */
export function assembleCreatorLibrary(code, wasmModules, ansi_color) {
    /* Google Analytics */
    creator_ga("compile", "compile.library");

    const { Color } = wasmModules;

    let arch;
    try {
        arch = initializeArchitecture(wasmModules);
    } catch (error) {
        return error;
    }

    resetMemoryAndState();

    // Compile code
    let label_table;
    try {
        const compiled = arch.compile(
            code,
            0, // library_offset (not used for library compilation)
            "{}", // no library labels
            true, // library flag
            ansi_color ? Color.Ansi : Color.Html,
        );

        // Library compilation: only binary instructions
        libraryInstructions = compiled.instructions.map(x => ({
            Address: x.address,
            Label: x.labels,
            Break: null,
            loaded:
                "0x" +
                parseInt(x.binary, 2)
                    .toString(16)
                    .padStart(WORDSIZE / 4, "0"),
            visible: false,
            user: null,
        }));

        // Extract label table for library
        label_table = compiled.label_table.reduce((tbl, x) => {
            tbl[x.name] = { address: x.address, global: x.global };
            return tbl;
        }, {});

        // Extract data elements and load them on memory
        const data_mem = compiled.data;
        loadDataIntoMemory(data_mem, wasmModules);
    } catch (error) {
        return handleError(error, ansi_color);
    }

    // Mark global labels on library instructions
    for (const instruction of libraryInstructions) {
        instruction.Label = instruction.Label.filter(
            label => label_table[label].global,
        );
        if (instruction.Label.length > 0) {
            instruction.globl = true;
        }
    }

    // Set the libraryInstructions array for library export
    setLibraryInstructions(libraryInstructions);

    return {
        errorcode: "",
        token: "",
        type: "",
        update: "",
        status: "ok",
    };
}

/**
 * Compile assembly code as a normal program
 * @param {string} code - Assembly code to compile
 * @param {WasmModules} wasmModules - Assembler's WASM modules
 * @param {boolean} ansi_color - Whether to use ANSI or HTML colors (default: HTML)
 * @returns {Object} Compilation result
 */
export function assembleCreatorProgram(code, wasmModules, ansi_color) {
    /* Google Analytics */
    creator_ga("compile", "compile.assembly");

    const { Color } = wasmModules;

    let arch;
    try {
        arch = initializeArchitecture(wasmModules);
    } catch (error) {
        return error;
    }

    const instructions = [];
    resetMemoryAndState();

    // Load library if present
    const { library_offset, library_instructions, library_labels } =
        loadLibraryIfPresent(instructions);
    const labels_json = JSON.stringify(library_labels);

    // Compile code
    let label_table;
    try {
        const compiled = arch.compile(
            code,
            library_offset,
            labels_json,
            false, // not a library
            ansi_color ? Color.Ansi : Color.Html,
        );

        // Normal compilation: populate instructions for execution/display
        instructions.push(
            ...compiled.instructions.map(x => ({
                Address: x.address,
                Label: x.labels,
                loaded: x.loaded,
                binary: x.binary,
                user: x.user,
                Break: null,
                hide: false,
                visible: true,
            })),
        );

        // Extract label table
        label_table = compiled.label_table.reduce((tbl, x) => {
            tbl[x.name] = { address: x.address, global: x.global };
            return tbl;
        }, {});

        // Extract data elements and load them on memory
        const data_mem = compiled.data;
        loadDataIntoMemory(data_mem, wasmModules);
    } catch (error) {
        return handleError(error, ansi_color);
    }

    // Write library binary to memory if present
    writeLibraryToMemory();

    // Write assembled instructions to memory
    writeInstructionsToMemory(instructions, library_instructions);

    const tag_instructions = {};
    for (const [name, info] of Object.entries(label_table)) {
        tag_instructions[info.address] = {
            tag: name,
            global: info.global,
        };
    }

    setAddress(architecture.memory_layout.text.start);
    setInstructions(instructions);
    set_tag_instructions(tag_instructions);

    return {
        errorcode: "",
        token: "",
        type: "",
        update: "",
        status: "ok",
    };
}

/**
 * Common assembly compiler implementation shared between web and deno versions
 * @param {string} code - Assembly code to compile
 * @param {boolean} library - Whether this is a library compilation
 * @param {WasmModules} wasmModules - Assembler's WASM modules
 * @param {boolean} ansi_color - Whether to use ANSI or HTML colors (default: HTML)
 * @returns {Object} Compilation result
 */
export function assembleCreatorBase(
    code,
    library,
    wasmModules,
    ansi_color = false,
) {
    if (library) {
        return assembleCreatorLibrary(code, wasmModules, ansi_color);
    } else {
        return assembleCreatorProgram(code, wasmModules, ansi_color);
    }
}
