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

// Runner for Z80 architecture ROMs
// usage: deno -A --unstable-node-globals ./src/cli/runner.mts -a ./architecture/Z80.yml --bin ./sinclair.bin

import fs from "node:fs";
import process from "node:process";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import * as creator from "../core/core.mjs";
import { step } from "../core/executor/executor.mjs";
import { logger } from "../core/utils/creator_logger.mjs";
import { keyboardBuffer } from "../core/capi/arch/z80.mjs";
import yaml from "js-yaml";

interface ArchitectureConfig {
    config: {
        plugin: string;
    };
}

/**
 * Parses command-line arguments using yargs.
 */
function parseArguments() {
    return yargs(hideBin(process.argv))
        .usage("Usage: $0 --architecture <arch_file> --bin <binary_file>")
        .option("architecture", {
            alias: "a",
            type: "string",
            description: "Path to the architecture YAML file",
            demandOption: true, // This makes the argument required
        })
        .option("bin", {
            alias: "b",
            type: "string",
            description: "Path to a binary file to load into memory",
            demandOption: true, // Require a binary file
        })
        .help().argv;
}

let pluginName: string | undefined = undefined;

/**
 * The main function to set up and run the emulator.
 */
// eslint-disable-next-line max-lines-per-function
async function main() {
    const argv = await parseArguments();

    logger.disable();

    // --- Setup Host Input Listener (stdin) ---
    // The callback will be executed by the Deno
    // event loop whenever a key is pressed.
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding("utf8");

        process.stdin.on("data", function (key) {
            // On Ctrl+C, restore terminal state and exit.
            if (key === "\u0003") {
                process.stdin.setRawMode(false);
                process.stdin.pause();
                process.exit();
            }

            // Push the character code into the shared buffer.
            let charCode = key.charCodeAt(0);
            // Z80 program only has to deal with one standard code.
            if (charCode === 127) {
                charCode = 8; // Convert DEL (0x7f) to BS (0x08)
            }
            keyboardBuffer.push(BigInt(charCode)); // Store as BigInt for the CAPI
        });
    }

    // --- 1. Load the Architecture ---
    try {
        const architectureFile = fs.readFileSync(argv.architecture, "utf8");
        const architectureObj = yaml.load(
            architectureFile,
        ) as ArchitectureConfig;
        pluginName = architectureObj.config.plugin;
        const ret = creator.loadArchitecture(architectureFile);
        if (ret.status !== "ok") {
            console.error(`Error loading architecture: ${ret.token}.`);
            process.exit(1);
        }
        console.log(`Architecture loaded from: ${argv.architecture}`);
    } catch (err) {
        console.error(
            `Failed to read architecture file at: ${argv.architecture}`,
        );
        console.error(err);
        process.exit(1);
    }

    creator.initCAPI(pluginName);

    // --- 2. Prepare the Emulator State ---
    CAPI.INTERRUPTS.setCustomHandler();
    creator.reset();

    // Load the user-provided program into memory.
    try {
        const programBytes = fs.readFileSync(argv.bin);
        creator.main_memory.loadROM(new Uint8Array(programBytes), 0n);
        console.log(`Program loaded from binary file: ${argv.bin}`);
    } catch (err) {
        console.error(`Failed to read binary file at: ${argv.bin}`);
        console.error(err);
        process.exit(1);
    }

    // --- 3. Run the Emulation Loop ---
    const INSTRUCTIONS_PER_CHUNK = 100; // Run 1k instructions before yielding to the event loop.
    let totalInstructions = 0;
    function runEmulationCycle() {
        if (creator.status.execution_index === -2) {
            console.log("\nProgram execution halted.");
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(false);
                process.stdin.pause();
            }
            process.exit(0);
        }

        try {
            for (let i = 0; i < INSTRUCTIONS_PER_CHUNK; i++) {
                let pc_value = creator.getRegisterInfo("PC")!.value;
                // const breakpoint = 0x0E4D;
                // if (creator.getRegisterInfo("PC").value === BigInt(breakpoint)) {
                //     console.log(
                //         `Breakpoint hit at PC = 0x${breakpoint.toString(16).padStart(4, "0").toUpperCase()}`,
                //     );
                //     // for each element in in creator.getRegistersByBank("int").registers, print:
                //     // name[0], value
                //     creator
                //         .getRegistersByBank("int")
                //         .registers.forEach(reg => {
                //             console.log(
                //                 `${reg.name[0]}: 0x${reg.value.toString(16)}`,
                //             );
                //         });
                //     process.exit(0);
                // }

                if (totalInstructions === 780000) {
                    process.exit(0);
                }
                if (totalInstructions === 0) {
                    creator
                        .getRegistersByBank("int")!
                        .registers.forEach(reg => {
                            console.log(
                                `    ${reg.name[0]}: 0x${reg.value.toString(16)}`,
                            );
                        });
                }
                const ret = step();
                // if (totalInstructions > 0) {
                //     creator
                //         .getRegistersByBank("int")
                //         .registers.forEach(reg => {
                //             console.log(
                //                 `    ${reg.name[0]}: 0x${reg.value.toString(16)}`,
                //             );
                //         });
                // }
                if (ret.error) {
                    console.error(ret.msg);
                    process.exit(1);
                }
                totalInstructions++;
                console.log(
                    totalInstructions,
                    pc_value.toString(16).padStart(4, "0").toUpperCase(),
                    ret.instructionData.asm,
                    "|",
                    ret.instructionData.machineCode,
                );
                // Dump registers after each cycle on one line
                const regBank = creator.getRegistersByBank("int");
                if (regBank) {
                    const registers = regBank.registers.map(
                        reg => `${reg.name[0]}:0x${reg.value.toString(16)}`,
                    );
                    console.log(registers.join(" "));
                }
                if (creator.status.execution_index === -2) {
                    break;
                }
            }
        } catch (error) {
            console.error(
                "\nAn error occurred during emulation:",
                error instanceof Error ? error.message : String(error),
            );
            process.exit(1);
        }

        // Yield to the Deno event loop to allow I/O events to be processed.
        setTimeout(runEmulationCycle, 0);
    }

    // Start the asynchronous emulation loop.
    runEmulationCycle();
}

// Start the main function.
main();
