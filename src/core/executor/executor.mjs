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

import { instructions, tag_instructions } from "../assembler/assembler.mjs";
import {
    status,
    interruptManager,
    WORDSIZE,
    BYTESIZE,
    main_memory,
    stackTracker,
    newArchitecture,
    getPC,
    REGISTERS,
    PC_REG_INDEX,
    guiVariables,
} from "../core.mjs";
import { MAXNWORDS } from "../utils/architectureProcessor.mjs";
import { crex_findReg_bytag } from "../register/registerLookup.mjs";
import {
    writeRegister,
    notifyRegisterUpdate,
} from "../register/registerOperations.mjs";
import { creator_ga } from "../utils/creator_ga.mjs";
import { logger } from "../utils/creator_logger.mjs";
import { getPrimaryKey } from "../utils/utils.mjs";
import { decode } from "./decoder.mjs";
import { updateStats } from "./stats.mts";
import { ExecutionMode } from "./InterruptManager.mts";
import { handleDevices } from "./devices.mts";
import { handleTimer } from "./timers.mts";
import { compileInstruction } from "./instructionCompiler.mts";
import { coreEvents } from "../events.mts";
import { clearAllRegisterGlows } from "../register/registerGlowState.mjs";
import { architecture } from "../core.mjs";

const instructionCache = new Map();
const compiledFunctions = new Map();

export function compileArchitectureFunctions(architecture) {
    // initCAPI(architecture.config.plugin);
    instructionCache.clear();
    compiledFunctions.clear();
    for (const instr of architecture.instructions) {
        const primaryKey = getPrimaryKey(instr);
        const compiledFunction = compileInstruction(instr);
        compiledFunctions.set(primaryKey, { instr, compiledFunction });
    }
}

/**
 * Performs validation checks to determine if execution should continue. This is used to prevent the execution from continuing AFTER it has already finished, but the user tries to step again.
 * @returns {Object|null} - Returns execution result object if validation fails, or null if validation passes
 */
function performExecutionChecks() {
    if (status.execution_index < -1) {
        return {
            error: true,
            msg: "The program has finished",
        };
    }
    if (status.execution_index === -1) {
        return {
            error: true,
            msg: "The program has finished with errors",
        };
    } else if (status.run_program === 3) {
        return { error: false, msg: "" };
    }

    return null;
}

/**
 * Returns the address of the program's entrypoint.
 *
 * @returns {Number | undefined}
 */
function get_entrypoint() {
    // search main tag
    const entrypoint = instructions.find(
        i => i.Label.includes(newArchitecture.config.main_function),
    )?.Address;

    return entrypoint
        ? parseInt(entrypoint, 16)
        : newArchitecture.config.start_address;
}

/**
 * Initializes the execution, setting the PC to the desired address.
 */
export function init() {
    if (status.execution_init !== 1) {
        return;
    }

    // Clear instruction cache
    instructionCache.clear();

    // Set the PC to the entry point of the architecture. Specified in the architecture
    const pc_reg = crex_findReg_bytag("program_counter");

    const address = get_entrypoint();

    if (address === undefined || address === null) {
        throw new Error(
            "Start address not defined in architecture configuration",
        );
    }
    writeRegister(BigInt(address), pc_reg.indexComp, pc_reg.indexElem);
    status.execution_init = 0;

    // set execution index
    const entrypoint_index = instructions.findIndex(
        i => parseInt(i.Address, 16) === Number(getPC()),
    );
    status.execution_index = entrypoint_index === -1 ? 0 : entrypoint_index;
}

function handleInterrupts() {
    // check interrupt
    if (!interruptManager.isGlobalEnabled()) return;
    const interrupt = interruptManager.check();
    if (interrupt === null) return;
    if (!interruptManager.isEnabled(interrupt)) return;

    // set UI
    guiVariables.keep_highlighted = guiVariables.previous_PC;

    // handle
    interruptManager.handle(interrupt);

    if (status.execution_index < 0) {
        // error/exit
        return;
    }

    // update execution_index accordingly
    const currentIndex = instructions.findIndex(
        i => parseInt(i.Address, 16) === Number(getPC()),
    );
    status.execution_index = currentIndex === -1 ? 0 : currentIndex;
}

function updateExecutionStatus() {
    // Check for program termination due to error
    if (status.execution_index === -1) {
        status.error = true;
        return { error: false, msg: "" };
    } else if (status.execution_index === -2) {
        // Normal program termination
        return { error: false, msg: "" };
    }

    // If no error occurred and we haven't reached the end of instructions
    if (status.error !== 1 && status.execution_index < instructions.length) {
        // Find which instruction corresponds to the current PC value
        const pc_address = getPC();
        let found = false;

        for (let i = 0; i < instructions.length; i++) {
            const address = BigInt(instructions[i].Address);

            if (address === pc_address) {
                // PC matches this instruction - update execution index
                status.execution_index = i;
                found = true;
                break;
            }
        }

        // Handle case when PC doesn't match any instruction address
        if (!found) {
            // Set execution index past the end to indicate completion
            if (status.run_program === 3) {
                // For run_program=3 (specific execution mode)
                status.execution_index = instructions.length + 1;
            } else {
                // For standard execution modes
                status.execution_index = instructions.length + 1;
            }
        }
    }

    // Return null to continue execution
    return null;
}

/**
 *  Increments the program counter (PC) by the specified number of words.
 *
 *  Depending on the architecture, the PC can point to different
 *  addresses. For example, in MIPS/RISC-V, the PC points to the
 *  CURRENT instruction, but in ARM, the PC points to the
 *  NEXT instruction + 4, so we need to adapt the value of the
 *  PC that will be seen by the instruction.
 *
 *  We solve this by using a "virtual" PC that is used by the
 *  instruction and the real PC that is used by the
 *  architecture.
 * @param {number} nwords - Number of words to increment
 */
function incrementProgramCounter(nwords) {
    const increment = BigInt((nwords * WORDSIZE) / BYTESIZE);
    // Direct access to PC register value
    const pc_element =
        REGISTERS[PC_REG_INDEX.indexComp].registers[PC_REG_INDEX.indexElem];
    const new_pc = BigInt(pc_element.value) + increment;

    guiVariables.previous_PC = BigInt(pc_element.value);
    // Direct write
    pc_element.value = new_pc;

    // Notify UI layers about PC update
    notifyRegisterUpdate(PC_REG_INDEX.indexComp, PC_REG_INDEX.indexElem);

    return null;
}

/**
 * Processes the current instruction (fetch, decode, execute)
 * @param {boolean} enableCache - A flag to enable or disable the instruction cache.
 * @returns {Object|null} - Returns execution result object if execution should stop, or null to continue
 */
function processCurrentInstruction(enableCache = true) {
    // 1. Fetch
    // When fetching, we could have an instruction that spans multiple words,
    // so to make sure we always get the full instruction, we read however many
    // words the longest instruction needs (MAXNWORDS).

    const pc_address = getPC();
    let instruction;
    let asm;
    let machineCode;
    let compiledFunction;
    let parameters = [];

    // Check for instruction in cache only if caching is enabled
    if (enableCache && instructionCache.has(pc_address)) {
        // If instruction is already cached, retrieve it
        ({ instruction, asm, machineCode, compiledFunction, parameters } =
            instructionCache.get(pc_address));
        // Increment PC based on instruction size
        incrementProgramCounter(instruction.nwords);
    } else {
        // This block executes if cache is disabled OR if it's a cache miss.
        const allBytes = [];
        const word_size_in_bytes = BigInt(WORDSIZE / BYTESIZE);

        for (let i = 0; i < MAXNWORDS; i++) {
            // Calculate the target address based on the original pc_address and the loop index
            const target_address = pc_address + BigInt(i) * word_size_in_bytes;
            // Read the word at the calculated address
            const wordBytes = main_memory.readWord(target_address);

            // Collect bytes directly instead of creating hex strings
            allBytes.push(...new Uint8Array(wordBytes));
        }

        const instructionBytes = new Uint8Array(allBytes);
        const returnValue = decode(instructionBytes);
        if (returnValue.status === "error") {
            // If decoding fails, return an error
            status.execution_index = -1; // Set execution index to -1 to indicate error
            return {
                error: true,
                msg: "Error decoding instruction: " + returnValue.reason,
            };
        }
        const instructionArray = returnValue.decodedFields;
        instruction = returnValue.instruction;
        const opcode = getPrimaryKey(instruction);

        asm = returnValue.assembly;

        const instructionSizeInBytes =
            instruction.nwords * (WORDSIZE / BYTESIZE);
        machineCode = Array.from(
            instructionBytes.slice(0, instructionSizeInBytes),
        )
            .map(byte => byte.toString(16).padStart(2, "0"))
            .join("");

        compiledFunction = compiledFunctions.get(opcode).compiledFunction;

        // Now we need to fetch the parameters to pass to the compiled function
        for (const field of instructionArray) {
            if (
                [
                    "INT-Reg",
                    "Ctrl-Reg",
                    "SFP-Reg",
                    "DFP-Reg",
                    "imm-signed",
                    "imm-unsigned",
                    "offset_bytes",
                ].includes(field.type)
            ) {
                parameters.push(field.value);
            }
        }

        // check privileged instructions
        if (
            status.execution_mode === ExecutionMode.User &&
            instruction.properties?.includes("privileged")
        ) {
            throw new Error(
                "💀 Can't execute privileged instruction '" +
                    instruction.name +
                    "' in User mode.",
            );
        }

        // Store the newly fetched and decoded instruction in the cache if enabled
        if (enableCache) {
            instructionCache.set(pc_address, {
                instruction,
                asm,
                machineCode,
                compiledFunction,
                parameters,
            });
        }
        // 4. Increment PC based on instruction size
        incrementProgramCounter(instruction.nwords);
    }

    // 5. Execute instruction
    compiledFunction(...parameters);

    // 6. Update execution statistics
    updateStats(instruction.type, instruction.clk_cycles);

    // Return instruction data for CLI display
    return {
        asm,
        machineCode,
        clockCycles: instruction.clk_cycles,
        success: true,
    };
}

/**
 * Executes a single instruction cycle (fetch-decode-execute)
 * @returns {Object|null} - Returns execution result object if execution should stop, or null to continue
 */
function executeInstructionCycle() {
    // Log debug information
    logger.debug("Execution Index:" + status.execution_index);
    logger.debug("PC Register: " + getPC());

    // Check for conditions that would stop execution
    const inLoopCheckResult = performExecutionChecks();
    if (inLoopCheckResult !== null) {
        return inLoopCheckResult;
    }

    // Process the current instruction
    const processingResult = processCurrentInstruction();
    if (processingResult !== null && !processingResult.success) {
        return processingResult;
    }

    // Handle any pending interrupts
    handleInterrupts();

    // handle timer
    handleTimer();

    // Handle Devices
    handleDevices();

    // Update execution status and determine next instruction
    const statusResult = updateExecutionStatus();

    // Return the processing result with instruction data, or combine with status result if there's an error
    if (statusResult === null) {
        return processingResult;
    } else {
        return {
            ...statusResult,
            instructionData: processingResult,
        };
    }
}

export function step() {
    status.error = false;

    if (typeof document !== "undefined" && document?.app) {
        // Clear register highlighting from persistent store and notify UI
        clearAllRegisterGlows();
        coreEvents.emit("step-about-to-execute");
    }

    // Execute a single instruction cycle
    const cycleResult = executeInstructionCycle();

    // Check if error occurred during execution
    if (status.execution_index === -1) {
        status.error = true;
    }

    // Capture instruction data from the executed cycle before checking PC validity
    let instructionData = null;
    if (cycleResult && cycleResult.instructionData) {
        instructionData = cycleResult.instructionData;
    } else if (cycleResult && cycleResult.asm) {
        // If cycleResult is the instruction data itself
        instructionData = cycleResult;
    }
    // Return execution result with instruction data
    const result = {
        error: status.error,
        msg: cycleResult?.msg || "",
    };

    if (instructionData) {
        result.instructionData = instructionData;
    }

    return result;
}

//Exit syscall

export function exit(error) {
    // Google Analytics
    creator_ga("execute", "execute.exit");

    if (error) {
        status.execution_index = -1;
    } else {
        status.execution_index = -2; // Set to -2 to indicate normal exit
    }
}
/**
 * Modifies the stack limit
 *
 * @param {bigint} stackLimit
 */
export function writeStackLimit(stackLimit) {
    if (stackLimit === null) {
        return;
    }

    // Convert to BigInt if not already
    const stackLimitBigInt = BigInt(stackLimit);

    // Get memory segments from the Memory object
    const segments = main_memory.getMemorySegments();

    // Get current stack pointer from memory segments
    const stackSegment = segments.get("stack");
    // Check if stack pointer would be above stack end
    if (stackSegment && stackLimitBigInt > stackSegment.end) {
        throw new Error("Stack pointer cannot be outside the stack segment");
    }

    // Check if stack pointer would be placed in text/data segments
    for (const [name, value] of segments) {
        if (name === "stack") continue;
        if (value.start <= stackLimitBigInt && stackLimitBigInt <= value.end)
            throw new Error(`Stack pointer cannot be placed in the ${name} segment`);
    }

    stackTracker.updateCurrentFrame(stackLimit);

    // Update the stack segment in the memory layout if it exists
    if (stackSegment) {
        // Update the memory segment's start address to reflect the new stack pointer
        if (architecture.config.name.includes("SRV64"))
            stackSegment.start = stackLimitBigInt;
        else
            stackSegment.start = Number(stackLimitBigInt);
        // And update the size of the stack segment
        stackSegment.size = stackSegment.end - stackSegment.start;
    }
}
