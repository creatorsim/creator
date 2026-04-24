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

import { architecture, REGISTERS } from "../core.mjs";
import { console_log } from "../utils/creator_logger.mjs";
import type { SentinelErrorEvent, SentinelErrorData } from "../events.mts";

/**
 * Event types that can occur during function execution
 */
const EventType = {
    WRITE_MEMORY: "write_memory",
    READ_MEMORY: "read_memory",
    WRITE_REGISTER: "write_register",
    READ_REGISTER: "read_register",
};

/**
 * Represents a single event in the register lifecycle
 */
class RegisterEvent {
    type: string;
    regIndex: number;
    elemIndex: number;
    address: bigint | null;
    size: number | null;
    timestamp: number;

    constructor(
      type: string,
      regIndex: number,
      elemIndex: number,
      address: bigint|null = null,
      size: number|null = null
    ) {
        this.type = type;
        this.regIndex = regIndex;
        this.elemIndex = elemIndex;
        this.address = address;
        this.size = size;
        this.timestamp = Date.now();
    }

    get registerName() {
        return (
            REGISTERS[this.regIndex]!.registers[this.elemIndex]!.name
        );
    }

    toString() {
        const addr =
            this.address !== null ? ` @0x${this.address.toString(16)}` : "";
        const size = this.size !== null ? ` (${this.size} bytes)` : "";
        return `${this.type}: ${this.registerName}${addr}${size}`;
    }
}

/**
 * Represents a function call frame with register state tracking
 */
class CallFrame {
    functionName: string;
    enterStackPointer: number;
    events: RegisterEvent[];
    initialRegisterValues: bigint[][];

    constructor(functionName: string, stackPointer: number) {
        this.functionName = functionName;
        this.enterStackPointer = stackPointer;
        this.events = [];
        this.initialRegisterValues = CallFrame._captureRegisterValues();
    }

    static _captureRegisterValues() {
        const values: bigint[][] = [];
        for (const file of REGISTERS) {
            const curr = [];
            for (const reg of file.registers) {
                curr.push(reg.value);
            }
            values.push(curr);
        }
        return values;
    }

    addEvent(event: RegisterEvent) {
        this.events.push(event);
        console_log(
            `[EVENT] ${this.functionName}: ${event.toString()}`,
            "INFO",
        );
    }

    /**
     * Get all events for a specific register
     */
    getRegisterEvents(regIndex: number, elemIndex: number) {
        return this.events.filter(
            e => e.regIndex === regIndex && e.elemIndex === elemIndex,
        );
    }

    /**
     * Find the first save event for a register
     */
    getFirstSave(regIndex: number, elemIndex: number) {
        return this.events.find(
            e =>
                e.regIndex === regIndex &&
                e.elemIndex === elemIndex &&
                e.type === EventType.WRITE_MEMORY,
        );
    }

    /**
     * Find the last restore event for a register
     */
    getLastRestore(regIndex: number, elemIndex: number) {
        const restores = this.events.filter(
            e =>
                e.regIndex === regIndex &&
                e.elemIndex === elemIndex &&
                e.type === EventType.READ_MEMORY,
        );
        return restores[restores.length - 1];
    }
}

/**
 * Validation rules for calling convention
 */
class ConventionRules {
    /**
     * Check if a saved register follows proper save/restore pattern
     */
    static validateSavedRegister(
      frame: CallFrame,
      regIndex: number,
      elemIndex: number
    ): SentinelErrorData[] {
        const violations = [];
        const register = REGISTERS[regIndex]!.registers[elemIndex]!;
        const events = frame.getRegisterEvents(regIndex, elemIndex);

        // Rule 1: Saved registers must be saved before modification
        const firstSave = frame.getFirstSave(regIndex, elemIndex);
        const modifications = events.filter(
            e =>
                e.type === EventType.WRITE_REGISTER ||
                e.type === EventType.READ_REGISTER,
        );

        if (modifications.length > 0 && !firstSave) {
            violations.push({
                rule: "SAVE_BEFORE_USE",
                register: register.name,
                message: `Register ${register.name} was used but never saved to memory`,
            });
        }

        const firstMod = modifications[0];
        if (firstSave && firstMod) {
            if (firstMod.timestamp < firstSave.timestamp) {
                violations.push({
                    rule: "SAVE_BEFORE_USE",
                    register: register.name,
                    message: `Register ${register.name} was modified before being saved`,
                });
            }
        }

        // Rule 2: Saved registers must be restored from the same address
        const lastRestore = frame.getLastRestore(regIndex, elemIndex);
        if (firstSave && !lastRestore) {
            violations.push({
                rule: "RESTORE_REQUIRED",
                register: register.name,
                message: `Register ${register.name} was saved but never restored`,
            });
        }

        if (firstSave && lastRestore) {
            if (firstSave.address !== lastRestore.address) {
                const saveAddr = firstSave.address;
                const restoreAddr = lastRestore.address;
                const saveStr =
                    saveAddr !== null
                        ? `0x${saveAddr.toString(16)}`
                        : String(firstSave.address);
                const restoreStr =
                    restoreAddr !== null
                        ? `0x${restoreAddr.toString(16)}`
                        : String(lastRestore.address);
                violations.push({
                    rule: "RESTORE_ADDRESS_MISMATCH",
                    register: register.name,
                    message: `Register ${register.name} saved at ${saveStr} but restored from ${restoreStr}`,
                });
            }
        }

        // Rule 3: Save and restore sizes must match
        if (firstSave && lastRestore) {
            const s1 = firstSave.size;
            const s2 = lastRestore.size;
            if (s1 !== s2) {
                violations.push({
                    rule: "SIZE_MISMATCH",
                    register: register.name,
                    message: `Register ${register.name} saved with ${s1} bytes but restored with ${s2} bytes`,
                });
            }
        }

        // Rule 4: Value must be restored (if the register was modified)
        const currentValue = register.value;
        const initialValue = frame.initialRegisterValues[regIndex]![elemIndex]!;

        if (currentValue !== initialValue && modifications.length > 0) {
            violations.push({
                rule: "VALUE_NOT_RESTORED",
                register: register.name,
                message: `Register ${register.name} value changed but not properly restored`,
            });
        }

        return violations;
    }

    /**
     * Check stack pointer restoration
     */
    static validateStackPointer(
      frame: CallFrame,
      currentStackPointer: number
    ): SentinelErrorData[] {
        const spEnter = frame.enterStackPointer;
        const spNow = currentStackPointer;
        if (spEnter !== spNow) {
            const enterStr = `0x${spEnter.toString(16)}`;
            const nowStr = `0x${spNow.toString(16)}`;
            return [
                {
                    rule: "STACK_NOT_RESTORED",
                    message: `Stack pointer not restored: entered at ${enterStr}, exited at ${nowStr}`,
                },
            ];
        }
        return [];
    }
}

/**
 * Main validator class for calling conventions
 */
class CallingConventionValidator {
    private callStack: CallFrame[];

    constructor() {
        this.callStack = [];
    }

    /**
     * Enter a new function
     */
    enter(functionName: string) {
        const stackPointer = architecture.memory_layout.stack.start;
        const frame = new CallFrame(functionName, stackPointer);
        this.callStack.push(frame);
        console_log(`[SENTINEL] Entering function: ${functionName}`, "INFO");
    }

    /**
     * Leave current function and validate
     */
    leave(): SentinelErrorEvent {
        // Pop the frame
        const frame = this.callStack.pop();

        if (frame === undefined) {
            return {
                ok: false,
                functionName: "unknown",
                errors: [
                    {
                        rule: "EMPTY_CALLSTACK",
                        message: "Cannot leave function: call stack is empty",
                    },
                ],
            };
        }

        console_log(
            `[SENTINEL] Leaving function: ${frame.functionName}`,
            "INFO",
        );

        const errors: SentinelErrorData[] = [];

        // Validate stack pointer
        const spViolations = ConventionRules.validateStackPointer(
            frame,
            architecture.memory_layout.stack.start,
        );
        errors.push(...spViolations);

        // Validate each saved register
        for (const [i, file] of REGISTERS.entries()) {
            for (const [j, register] of file.registers.entries()) {
                // Only check registers that should be saved
                if (register.properties.includes("saved")) {
                    const regViolations = ConventionRules.validateSavedRegister(
                        frame,
                        i,
                        j,
                    );
                    errors.push(...regViolations);
                }
            }
        }

        return {
            ok: errors.length === 0,
            functionName: frame.functionName,
            errors,
        };
    }

    /**
     * Record a memory write event
     */
    recordMemoryWrite(regIndex: number, elemIndex: number, address: bigint, size: number) {
        const frame = this.callStack[this.callStack.length - 1];
        if (frame === undefined) {
            console_log(
                "[SENTINEL] Warning: Memory write outside function context",
                "WARN",
            );
            return;
        }

        const event = new RegisterEvent(
            EventType.WRITE_MEMORY,
            regIndex,
            elemIndex,
            address,
            size,
        );
        frame.addEvent(event);
    }

    /**
     * Record a memory read event
     */
    recordMemoryRead(regIndex: number, elemIndex: number, address: bigint, size: number) {
        const frame = this.callStack[this.callStack.length - 1];
        if (frame === undefined) {
            console_log(
                "[SENTINEL] Warning: Memory read outside function context",
                "WARN",
            );
            return;
        }

        const event = new RegisterEvent(
            EventType.READ_MEMORY,
            regIndex,
            elemIndex,
            address,
            size,
        );
        frame.addEvent(event);
    }

    /**
     * Record a register write event
     */
    recordRegisterWrite(regIndex: number, elemIndex: number) {
        const frame = this.callStack[this.callStack.length - 1];
        if (frame === undefined) {
            return;
        }

        const event = new RegisterEvent(
            EventType.WRITE_REGISTER,
            regIndex,
            elemIndex,
        );
        frame.addEvent(event);
    }

    /**
     * Record a register read event
     */
    recordRegisterRead(regIndex: number, elemIndex: number) {
        const frame = this.callStack[this.callStack.length - 1];
        if (frame === undefined) {
            return;
        }

        const event = new RegisterEvent(
            EventType.READ_REGISTER,
            regIndex,
            elemIndex,
        );
        frame.addEvent(event);
    }

    /**
     * Reset the validator
     */
    reset() {
        this.callStack = [];
        this.enter(architecture.config.main_function);
    }

    /**
     * Get current call depth
     */
    getCallDepth() {
        return this.callStack.length;
    }

    /**
     * Get current function name
     */
    getCurrentFunction() {
        return this.callStack[this.callStack.length - 1]?.functionName;
    }
}

// Global instance
const validator = new CallingConventionValidator();

// Public API - Direct validator interface
// yes, it HAS to be with arrow functions
export const sentinel = {
    enter: (functionName: string) => validator.enter(functionName),
    leave: () => validator.leave(),
    recordMemoryWrite: (regIndex: number, elemIndex: number, address: bigint, size: number) =>
        validator.recordMemoryWrite(regIndex, elemIndex, address, size),
    recordMemoryRead: (regIndex: number, elemIndex: number, address: bigint, size: number) =>
        validator.recordMemoryRead(regIndex, elemIndex, address, size),
    recordRegisterWrite: (regIndex: number, elemIndex: number) =>
        validator.recordRegisterWrite(regIndex, elemIndex),
    recordRegisterRead: (regIndex: number, elemIndex: number) =>
        validator.recordRegisterRead(regIndex, elemIndex),
    reset: () => validator.reset(),
    getCallDepth: () => validator.getCallDepth(),
    getCurrentFunction: () => validator.getCurrentFunction(),
    formatErrors: (frameResult: SentinelErrorEvent) => {
        const messages = frameResult.errors
            .map(v => `  - ${v.message}`)
            .join("\n");
        return `Calling convention violations in ${frameResult.functionName}:\n${messages}`;
    },
};
