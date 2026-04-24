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

/**
 * Deno doesn't fully support "sloppy imports"
 * (https://docs.deno.com/runtime/reference/cli/unstable_flags/#--unstable-sloppy-imports),
 * which would make our lives easier by just writing in a `foo.ts` file:
 * ```ts
 * import { architecture, status } from "@/core/core";
 * ```
 *
 * Therefore, this file is currently used to annotate using JSDoc (using @type
 * {import("./core.d.ts").Stuff})
 *  */

// TODO: extract this data from the assembler

type RegisterFile = {
    name: string;
    type: string;
    double_precision: boolean;
    registers: Register[];
};

type Register = {
    name: string[];
    nbits: number;
    value: bigint;
    default_value: bigint;
    properties: string[];
    type: string;
};

type InstructionField = {
    name: string;
    value: string;
    type: string;
    startbit: number;
    stopbit: number;
    order: number;
    word: number[];
    enum_name?: string;
};

type PseudoInstructionField = {
    name: string;
    type: string;
    enum_name?: string;
};

type Instruction = {
    name: string;
    co: string;
    template: string;
    description: string;
    type: string;
    signature_definition: string;
    signature_pretty: string;
    nwords: number;
    clk_cycles: number;
    fields: InstructionField[];
    definition: string;
    properties?: string[];
    help?: string;
};

type PseudoInstruction = {
    name: string;
    description: string;
    signature_definition: string;
    signature_pretty: string;
    fields: PseudoInstructionField[];
    definition: string;
    properties?: string[];
    help?: string;
};

type MemoryLayout = {
    ktext?: { start: number; end: number };
    kdata?: { start: number; end: number };
    text: { start: number; end: number };
    data: { start: number; end: number };
    stack: { start: number; end: number };
};

type Directive = { name: string; action: string };

export declare const REGISTERS: RegisterFile[];

type ArchitectureInterrupts = {
    handlers: {
        creator_syscall?: string;
        custom?: string;
    };
    enable?: string;
    global_enable: string;
    disable?: string;
    global_disable: string;
    check: string;
    is_enabled?: string;
    is_global_enabled: string;
    clear?: string;
    global_clear: string;
    create: string;
};

type Architecture = {
    config: {
        name: string;
        word_size: number;
        description: string;
        endianness: string;
        memory_alignment: string;
        main_function: string;
        passing_convention: boolean;
        comment_prefix: string;
        start_address: number;
        pc_offset: number;
        byte_size: number;
        plugin: string;
        assemblers: {
            name: string;
            description: string;
        }[];
    };
    memory_layout: MemoryLayout;
    register_files: RegisterFile[];
    instructions: Instruction[];
    pseudoinstructions: PseudoInstruction[];
    directives: Directive[];
    interrupts?: ArchitectureInterrupts;
    timer: {
        tick_cycles: number;
        advance: string;
        handler: string;
        is_enabled: string;
        enable: string;
        disable: string;
    };
};
export declare const architecture: Architecture;

import type {
    ExecutionMode,
    InterruptHandlerType,
} from "./executor/InterruptManager.mts";

type Status = {
    execution_init: number;
    executedInstructions: number;
    clkCycles: number;
    run_program: number;

    keyboard: string;
    display: string;
    execution_index: number;
    error: boolean;
    execution_mode: ExecutionMode;
    interrupt_handler: InterruptHandlerType;
    pcRegisterNames: string[];
};
export declare const status: Status;

type GUIVariables = {
    previous_PC: bigint;
    keep_highlighted: bigint;
};

export declare const guiVariables: GUIVariables;

import type { Memory } from "./memory/Memory.mts";
export declare const main_memory: Memory;
export declare const main_memory_backup: Memory;

export declare const PC_REG_INDEX:
    | { indexComp: number; indexElem: number }
    | undefined;
export declare const SP_REG_INDEX:
    | { indexComp: number; indexElem: number }
    | undefined;

import type { StackTracker } from "./memory/StackTracker.mts";
export declare const stackTracker: StackTracker;

export declare function getPC(): bigint;
export declare function getSP(): bigint | null;

export declare const BYTESIZE: number;
export declare const WORDSIZE: number;

// Library format (YAML)
type LibrarySymbolHelp = {
    parameters?: Record<string, string>;
    returns?: Record<string, string>;
    description?: string;
};

type Library = {
    version: string;
    binary: string;
    symbols: Record<string, { addr: number; help?: LibrarySymbolHelp }>;
};

export declare const update_binary: Library;
