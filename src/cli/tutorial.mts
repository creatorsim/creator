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

import * as creator from "../core/core.mjs";
import readline from "node:readline";
import process from "node:process";
import { clearConsole, colorText } from "./display.mts";
import { processCommand } from "./interactive.mts";

// Function to wrap text at specified width
function wrapText(text: string, maxWidth: number = 80): string {
    // Split the text into paragraphs (respecting existing newlines)
    const paragraphs = text.split("\n");
    const result: string[] = [];

    for (const paragraph of paragraphs) {
        if (paragraph.trim().length === 0) {
            // Keep empty lines as is
            result.push("");
            continue;
        }

        // Split the paragraph into words
        const words = paragraph.split(" ");
        let currentLine = "";

        for (const word of words) {
            // Check if adding the next word would exceed max width
            if (currentLine.length + word.length + 1 > maxWidth) {
                // Line would be too long, start a new line
                result.push(currentLine);
                currentLine = word;
            } else if (currentLine.length === 0) {
                // This is the first word on the line
                currentLine = word;
            } else {
                // Add the word to the current line
                currentLine += " " + word;
            }
        }

        // Add the last line of this paragraph
        if (currentLine.length > 0) {
            result.push(currentLine);
        }
    }

    return result.join("\n");
}

// Helper function to draw a box around text
function boxedText(
    text: string,
    width: number = 80,
    color: string = "36",
): string {
    const lines = wrapText(text, width - 4).split("\n");
    const horizontalLine = "─".repeat(width - 2);

    let result = colorText(`┌${horizontalLine}┐`, color) + "\n";

    lines.forEach(line => {
        const padding = " ".repeat(width - line.length - 4);
        result += colorText(`│ ${line}${padding} │`, color) + "\n";
    });

    result += colorText(`└${horizontalLine}┘`, color);
    return result;
}

// Function to create a progress bar
function progressBar(
    current: number,
    total: number,
    width: number = 40,
): string {
    const percentage = Math.round((current / total) * 100);
    const filledWidth = Math.round((current / total) * width);
    const emptyWidth = width - filledWidth;

    const filled = "█".repeat(filledWidth);
    const empty = "░".repeat(emptyWidth);

    return colorText(`Progress: [${filled}${empty}] ${percentage}%`, "32");
}

// Function to create a divider line
function divider(
    width: number = 80,
    char: string = "─",
    color: string = "90",
): string {
    return colorText(char.repeat(width), color);
}

// Define interface for tutorial steps for better type safety
interface TutorialStep {
    title: string;
    text: string;
    waitForCommand: boolean;
    expectedCommand?: string;
    expectedCommandPrefix?: string;
    executeAfter?: (() => void) | null;
    tipText?: string;
}

// Tutorial state
let currentStep = 0;
let waitingForCommand = false;
let rl: readline.Interface;

// Assembly program used in the tutorial
const TUTORIAL_ASSEMBLY = `
.data
    .align 2
   myword:       .word   0x12345678
   stringz:    .string  "This is a string"
   
.text
    main:

    addi t1, zero, 0x123
            
    # print word value 
    la a0, myword
    lw a1, 0(a0)
    li a7, 1
    ecall

    # print string value
    la a0, stringz
    li a7, 4
    ecall

    #return
    jr ra

`;

// Tutorial steps - each one has a title, explanation text, and an optional command to execute
const tutorialSteps: TutorialStep[] = [
    {
        title: "Welcome to CREATOR",
        text: "This tutorial will guide you through understanding the CREATOR simulator with a simple RISC-V program.\n\nCREATOR is a simulator that allows you to run and debug multiple architectures. You'll learn how to examine registers, memory, and control program execution.",
        waitForCommand: false,
    },
    {
        title: "The RISC-V Architecture",
        text: "RISC-V is an open standard instruction set architecture (ISA) based on reduced instruction set computer (RISC) principles.\n\nKey components of RISC-V:\n- 32 general-purpose registers (x0-x31), with x0 always being 0\n- Special register names like 'ra' (return address), 'sp' (stack pointer), 'a0'-'a7' (arguments/return values)\n- Simple instruction formats with few addressing modes\n- Memory is byte-addressable with 8-bit bytes\n\nThe demo program has been loaded into the simulator. Let's examine it!",
        waitForCommand: false,
    },
    {
        title: "The Program",
        text:
            TUTORIAL_ASSEMBLY +
            "\n\nThis program demonstrates basic RISC-V assembly instructions. It loads a word from memory, prints it, and then prints a string.\n\nThe program is divided into two sections: .data (for data declarations) and .text (for code).\n\nThe program has already been loaded into the simulator. To see the instructions loaded into memory, use the 'list' command.\n\nThis will show all instructions in memory, with their addresses, labels, and the assembly code.\n\nTry it now by typing 'list':",
        waitForCommand: true,
        expectedCommand: "list",
        executeAfter() {
            console.log(
                colorText(
                    wrapText(
                        "\nThe 'list' command shows the instructions loaded to memory. The 'Address' column shows the memory address of each instruction. The label column shows any labels defined in the program. The 'Loaded Instruction' column shows the actual instructions that are loaded into memory. The 'User Instruction' column shows the instructions and pseudo-instructions entered by the user. \n\nNow, let's take a look at the registers.",
                    ),
                    "36",
                ),
            );
        },
    },
    {
        title: "Examining Registers",
        text: "Registers are small, fast storage locations in the CPU. RISC-V has 32 general-purpose registers (x0-x31).\n\nTo view the integer registers, use the 'reg' command.\n\nTry it now by typing 'reg int':",
        waitForCommand: true,
        expectedCommand: "reg int",
        executeAfter() {
            console.log(
                colorText(
                    wrapText(
                        "\nThe first column shows the register name, and the second column shows its value.\n\nThe 'zero' register (x0) is always 0. The 'ra' register (x1) is used for return addresses, and the 'sp' register (x2) is the stack pointer.\n\nLet's go ahead and execute our first instruction.",
                    ),
                    "36",
                ),
            );
        },
    },
    {
        title: "Running Your First Instruction",
        text: "To execute one instruction at a time, use the 'step' command:",
        waitForCommand: true,
        expectedCommand: "step",
        executeAfter() {
            console.log(
                colorText(
                    wrapText(
                        "\nYou just executed an instruction! The output shows the address, machine code, and decompiled machine code of the executed instruction. The instruction you executed was 'addi t1, zero, 0x123'.\n\nThis instruction adds the immediate value 0x123 to the value in register zero (which is always 0) and stores the result in register t1.\n",
                    ),
                    "36",
                ),
            );
        },
    },
    {
        title: "Instruction Details",
        text: "Let's check the registers again to see the updated value of t1. You can use the 'reg' comand followed by the register name to view a specific register.\n\nTry it now by typing 'reg t1':",
        waitForCommand: true,
        expectedCommand: "reg t1",
        executeAfter() {
            console.log(
                colorText(
                    wrapText(
                        "\nNotice that the value of t1 has been updated to 0x123",
                    ),
                    "36",
                ),
            );
        },
    },
    {
        title: "Examining Memory",
        text: "Our program works with data in memory. To view memory contents, use the 'mem' command followed by an address.\n\nLet's look at the 'myword' variable in memory. Since the variable is declared at the start of the .data section, we can find it at address 0x200000. For this architecture, address 0x200000 is the start of the .data section.\n\nTry it now by typing 'mem 0x200000':",
        waitForCommand: true,
        expectedCommandPrefix: "mem 0x200000",
        executeAfter() {
            const assembly = `\n.data\n.align 2\n\tmyword:       .word   0x12345678\n`;
            console.log(
                colorText(
                    wrapText(
                        "\nRemember that in the assembly program, we declared 'myword' as a word (4 bytes) at the start of the .data segment, which for this architecture begins at address 0x200000.\n\n",
                    ) + assembly,
                    "36",
                ),
            );
        },
    },
    {
        title: "Executing Multiple Instructions",
        text: "Instead of stepping through instructions one by one, you can run multiple instructions with the 'run' command followed by a number.\n\nLet's execute the next 5 instructions by typing 'run 5':",
        waitForCommand: true,
        expectedCommand: "run 5",
        executeAfter: null,
    },
    {
        title: "Setting Breakpoints",
        text: "Breakpoints allow you to pause execution at specific addresses. This is useful when debugging.\n\nTo set a breakpoint, use the 'break' command (or 'b' for short) followed by an address.\n\nLet's set a breakpoint just before the string is printed. To do this, type 'break 24':",
        waitForCommand: true,
        expectedCommandPrefix: "break 24",
        executeAfter: null,
    },
    {
        title: "Viewing the Breakpoint",
        text: "You can see the breakpoints you've set in the instruction listing. Try it now by typing 'list':",
        waitForCommand: true,
        expectedCommand: "list",
        executeAfter() {
            console.log(
                colorText(
                    wrapText(
                        "\nNotice that the breakpoint is marked with a '●' in the instruction listing. This indicates where the program will pause execution.\n\nNow, let's run the program until it hits our breakpoint.",
                    ),
                    "36",
                ),
            );
        },
    },
    {
        title: "Resetting the Program",
        text: "Let's reset the program to run it from the beginning.\n\nTry it now by typing 'reset':",
        waitForCommand: true,
        expectedCommand: "reset",
        executeAfter: null,
    },
    {
        title: "Running to a Breakpoint",
        text: "Use the 'run' command without arguments to execute until completion or until a breakpoint is hit.\n\nTry it now by typing 'run':",
        waitForCommand: true,
        expectedCommand: "run",
        executeAfter() {
            console.log(
                colorText(
                    wrapText(
                        "\nYou just hit a breakpoint! The program has paused execution at the address you specified. \n\nYou can now examine the registers and memory to see the program's state at this point.",
                    ),
                    "36",
                ),
            );
        },
    },
    {
        title: "Running to a Breakpoint (continued)",
        text: "To resume execution, use the 'continue'.\n\nTry it now by typing 'continue':",
        waitForCommand: true,
        expectedCommand: "continue",
    },

    {
        title: "Using the Help Command",
        text: "If you forget any commands, you can always use the 'help' command to see all available options.\n\nTry it now by typing 'help':",
        waitForCommand: true,
        expectedCommand: "help",
        executeAfter: null,
    },
    {
        title: "Congratulations!",
        text: "You've successfully completed the tutorial! \n\nYou now know how to:\n- Load and run a RISC-V assembly program\n- Examine registers and memory\n- Set breakpoints and step through instructions\n- Use the help command to find available options\n\nPress Enter to continue using the simulator normally.",
        waitForCommand: false,
        executeAfter: null,
    },
];

// Helper function to display a tutorial step
function displayTutorialStep(step: TutorialStep): void {
    clearConsole();

    // Display progress bar at the top
    console.log(progressBar(currentStep, tutorialSteps.length - 1));
    console.log(divider());

    // Display the title in a box
    console.log(boxedText(step.title, 80, "33"));
    console.log("");

    // Display the content with better formatting
    console.log(colorText(wrapText(step.text), "36"));
    console.log("");

    // Display tip if available
    if (step.tipText) {
        console.log(colorText("💡 " + step.tipText, "33"));
        console.log("");
    }

    console.log(divider());

    if (step.waitForCommand) {
        waitingForCommand = true;
        rl.setPrompt("\nCREATOR> ");
        rl.prompt();
    } else {
        console.log(colorText("\nPress Enter to continue...", "32"));
    }
}

// Helper function to advance to the next step
function advanceToNextStep(): void {
    currentStep++;
    if (currentStep < tutorialSteps.length) {
        displayTutorialStep(tutorialSteps[currentStep]);
    } else {
        // Instead of closing, transition to normal mode
        clearConsole();
        console.log(
            boxedText(
                "Tutorial completed! Now in normal simulator mode.",
                60,
                "32",
            ),
        );
        console.log("");
        console.log(
            colorText("You can now use all simulator commands freely.", "36"),
        );
        console.log(
            colorText(
                "Type 'help' to see available commands or 'quit' to exit when done.",
                "36",
            ),
        );
        console.log("");

        // Set tutorial state variables to indicate we're done with the tutorial
        waitingForCommand = false;

        // Set the prompt and display it
        rl.setPrompt("\nCREATOR> ");
        rl.prompt();
    }
}

// Process user input during tutorial

function processTutorialCommand(line: string): void {
    const cleanedInput = line.trim().toLowerCase();

    // If tutorial is completed, process commands normally without tutorial guidance
    if (currentStep >= tutorialSteps.length) {
        if (
            cleanedInput === "quit" ||
            cleanedInput === "exit" ||
            cleanedInput === "q"
        ) {
            console.log(colorText("Exiting simulator...", "33"));
            rl.close();
            return;
        }

        if (cleanedInput !== "") {
            const args = cleanedInput.split(/\s+/);
            const cmd = args[0].toLowerCase();
            processCommand(cmd, args);
        }

        rl.prompt();
        return;
    }

    // Allow proceeding with Enter if not waiting for a specific command
    if (!waitingForCommand && cleanedInput === "") {
        advanceToNextStep();
        return;
    }

    // If we're waiting for a specific command
    if (waitingForCommand) {
        // Check for exact match or prefix match if configured
        const step = tutorialSteps[currentStep];
        let commandMatches;

        if (step.expectedCommandPrefix) {
            commandMatches = cleanedInput.startsWith(
                step.expectedCommandPrefix,
            );
        } else {
            commandMatches = cleanedInput === step.expectedCommand;
        }

        // Handle quitting anytime
        if (
            cleanedInput === "quit" ||
            cleanedInput === "exit" ||
            cleanedInput === "q"
        ) {
            console.log(colorText("Exiting tutorial...", "33"));
            rl.close();
            return;
        }

        // Process any valid command the user enters
        if (cleanedInput !== "") {
            const args = cleanedInput.split(/\s+/);
            const cmd = args[0].toLowerCase();

            // Execute the command regardless of whether it's the expected one
            processCommand(cmd, args);

            // If it's the expected command, advance the tutorial
            if (commandMatches) {
                waitingForCommand = false;

                // Execute any additional code specified for this step
                if (step.executeAfter) {
                    step.executeAfter();
                }

                console.log(colorText("\nPress Enter to continue...", "32"));
            } else {
                // Remind the user of the expected command for this step
                console.log(
                    colorText(
                        boxedText(
                            `For this tutorial step, try using: ${step.expectedCommand || step.expectedCommandPrefix}`,
                            60,
                            "33",
                        ),
                        "36",
                    ),
                );
                rl.setPrompt("\nCREATOR> ");
                rl.prompt();
            }
        } else {
            rl.prompt();
        }
    } else if (cleanedInput === "") {
        // User pressed Enter to continue
        advanceToNextStep();
    } else if (
        cleanedInput === "quit" ||
        cleanedInput === "exit" ||
        cleanedInput === "q"
    ) {
        // Allow quitting anytime
        console.log(colorText("Exiting tutorial...", "33"));
        rl.close();
    } else {
        console.log(
            colorText("Press Enter to continue to the next step.", "32"),
        );
    }
}

// Main tutorial function
export function startTutorial(): void {
    const welcomeArt = `
    ██████╗██████╗ ███████╗ █████╗ ████████╗ ██████╗ ██████╗ 
   ██╔════╝██╔══██╗██╔════╝██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗
   ██║     ██████╔╝█████╗  ███████║   ██║   ██║   ██║██████╔╝
   ██║     ██╔══██╗██╔══╝  ██╔══██║   ██║   ██║   ██║██╔══██╗
   ╚██████╗██║  ██║███████╗██║  ██║   ██║   ╚██████╔╝██║  ██║
    ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝
    `;

    // Display welcome message
    clearConsole();
    console.log(colorText(welcomeArt, "32"));
    console.log(
        colorText(
            boxedText(
                "Welcome to the CREATOR Tutorial! Loading program...",
                60,
                "36",
            ),
            "36",
        ),
    );

    // Brief pause to show the welcome message
    setTimeout(() => {
        // Load the tutorial program
        creator.assembly_compile(TUTORIAL_ASSEMBLY);

        // Reset the simulator to ensure clean state
        creator.reset();

        // Create an interface for reading user input
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: "\nCREATOR> ",
            historySize: 50,
        });

        // Display the first tutorial step
        displayTutorialStep(tutorialSteps[currentStep]);

        // Process user input
        rl.on("line", line => {
            processTutorialCommand(line);
        });

        rl.on("close", () => {
            clearConsole();
            console.log(colorText(welcomeArt, "32"));
            console.log(
                colorText(
                    boxedText(
                        "Tutorial ended. You can now launch the simulator without the -T flag.",
                        60,
                        "32",
                    ),
                    "32",
                ),
            );
            process.exit(0);
        });
    }, 1000);
}
