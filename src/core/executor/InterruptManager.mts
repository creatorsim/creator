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

import type { ArchitectureInterrupts } from "../core.d.ts";
import { architecture, guiVariables } from "../core.mjs";
import { injectedFunction } from "./instructionCompiler.mts";

export enum InterruptType {
    // we use string values so it's easier to work with
    // `Object.values(InterruptType)`
    Software = "software",
    Timer = "timer",
    External = "external",
    EnvironmentCall = "ecall",
    Maskable = "maskable",
    NonMaskable = "nonmaskable",
}

export enum ExecutionMode {
    User = "user",
    Kernel = "kernel",
}

export enum InterruptHandlerType {
    CREATOR = "default",
    Custom = "custom",
}

interface InterruptStatus {
    globalEnabled: boolean;
    enabled: Map<InterruptType, boolean>;
    pendingInterrupts: Map<InterruptType, boolean>;
}

abstract class InterruptHandler {
    protected config?: ArchitectureInterrupts;

    /** Enables an interrupt type */
    public abstract enable(status: InterruptStatus, type: InterruptType): void;

    /** Globally enables interrupts */
    public abstract globalEnable(status: InterruptStatus): void;

    /** Disables an interrupt type */
    public abstract disable(status: InterruptStatus, type: InterruptType): void;

    /** Globally disables interrupts */
    public abstract globalDisable(status: InterruptStatus): void;

    /** Creates an interrupt of the specified type */
    public abstract create(status: InterruptStatus, type: InterruptType): void;

    /** Clears all interrupts */
    public abstract globalClear(status: InterruptStatus): void;

    /**
     * Checks for pending interrupts
     *
     * @returns Type of pending interrupt, else `null`
     */
    public abstract check(status: InterruptStatus): InterruptType | null;

    /** Checks if a type of interrupt is enabled */
    public abstract isEnabled(
        status: InterruptStatus,
        type: InterruptType,
    ): boolean;

    /** Checks if a type of interrupt is globally enabled */
    public abstract isGlobalEnabled(status: InterruptStatus): boolean;

    /** Clears a specific interrupt type */
    public abstract clear(status: InterruptStatus, type: InterruptType): void;

    /** Routine to execute in order to treat an interrupt */
    public abstract handle(status: InterruptStatus, type: InterruptType): void;

    constructor(config?: ArchitectureInterrupts) {
        this.config = config;
    }
}

/* eslint-disable class-methods-use-this */
class CREATORInterruptHandler extends InterruptHandler {
    /** Syscall handler for the CREATOR handler */
    #syscallHandler: () => void | never = this.config?.handlers.creator_syscall
        ? injectedFunction(this.config.handlers.creator_syscall)
        : () => {
              throw new Error("No CREATOR syscall handler defined");
          };

    public enable(_status: InterruptStatus, _type: InterruptType) {}
    public disable(_status: InterruptStatus, _type: InterruptType) {}
    public globalDisable(_status: InterruptStatus) {}
    public globalEnable(_status: InterruptStatus) {}
    public create(_status: InterruptStatus, _type: InterruptType) {}
    public globalClear(_status: InterruptStatus) {}

    public isGlobalEnabled(status: InterruptStatus): boolean {
        return status.globalEnabled;
    }
    public isEnabled(status: InterruptStatus, type: InterruptType): boolean {
        return status.enabled.get(type)!;
    }

    public check(status: InterruptStatus) {
        return (
            [...status.pendingInterrupts]
                .filter(([_type, val]) => val)
                .map(([type, _val]) => type)
                .at(0) ?? null
        ); // we only return the first one
    }

    public clear(status: InterruptStatus, type: InterruptType): void {
        status.pendingInterrupts.set(type, false);
    }

    public handle(status: InterruptStatus, type: InterruptType): void {
        switch (type) {
            case InterruptType.EnvironmentCall:
                this.#syscallHandler();
                break;
            default:
                throw new Error(`Unknown interrupt type '${type}'`);
        }
        this.clear(status, type);
    }
}

class ArchitectureInterruptHandler extends InterruptHandler {
    #config = this.config!;

    //**
    /* This is high wizardry to make the functions ignore the `status` parameter,
    /* while creating an `injectedFunction`. It has the same interface as
    /* `Function`.
     */

    #makeInjectedFunction(...args: string[]) {
        const f = injectedFunction(...args);
        return (_status: InterruptStatus, ...sargs: unknown[]) => f(...sargs);
    }

    public enable = this.#makeInjectedFunction(
        "type",
        this.#config.enable ?? this.#config.global_enable,
    );

    public disable = this.#makeInjectedFunction(
        "type",
        this.#config.disable ?? this.#config.global_disable,
    );

    public globalDisable = this.#makeInjectedFunction(
        this.#config.global_disable,
    );

    public globalEnable = this.#makeInjectedFunction(
        this.#config.global_enable,
    );

    public create = this.#makeInjectedFunction("type", this.#config.create);

    public globalClear = this.#makeInjectedFunction(this.#config.global_clear);

    public isGlobalEnabled =
        // eslint-disable-next-line eqeqeq
        this.#config.is_global_enabled == null // covers for undefined
            ? (..._args: unknown[]) => {
                  return true;
              }
            : this.#makeInjectedFunction(this.#config.is_global_enabled);

    public isEnabled =
        // eslint-disable-next-line eqeqeq
        this.#config.is_enabled == null  // covers for undefined
            ? this.isGlobalEnabled
            : this.#makeInjectedFunction("type", this.#config.is_enabled);

    public check = this.#makeInjectedFunction(this.#config.check);

    public clear = this.#makeInjectedFunction(
        "type",
        this.#config.clear ?? this.#config.global_clear,
    );

    public handle = this.#makeInjectedFunction(
        "type",
        this.#config.handlers.custom!,
    );

    constructor(config: ArchitectureInterrupts) {
        super(config);
        if (config.handlers.custom === undefined) {
            throw new Error("You must define the architecture handler.");
        }
    }
}

export class InterruptManager {
    /** Interrupt handler to use, either CREATOR's or a custom one.  */
    private handler: InterruptHandler;

    /** Status of the interrupt manager, used to sync between handlers */
    private status: InterruptStatus = {
        globalEnabled: true,
        enabled: new Map(
            Object.values(InterruptType).map(type => [
                type as InterruptType,
                true,
            ]),
        ),
        pendingInterrupts: new Map(
            Object.values(InterruptType).map(type => [
                type as InterruptType,
                false,
            ]),
        ),
    };

    private customHandlerAllowed: boolean;

    /** Enables an interrupt type */
    public enable(type: InterruptType) {
        this.handler.enable(this.status, type);
        this.status.enabled.set(type, true);
    }

    /** Globally enables interrupts */
    public globalEnable() {
        this.handler.globalEnable(this.status);
        this.status.globalEnabled = true;
    }

    /** Disables an interrupt type */
    public disable(type: InterruptType) {
        this.handler.disable(this.status, type);
        this.status.enabled.set(type, false);
    }

    /** Globally disables interrupts */
    public globalDisable() {
        this.handler.globalDisable(this.status);
        this.status.globalEnabled = false;
    }

    /** Creates an interrupt of the specified type */
    public create(type: InterruptType) {
        this.handler.create(this.status, type);
        this.status.pendingInterrupts.set(type, true);
    }

    /** Clears all interrupts */
    public globalClear() {
        this.handler.globalClear(this.status);
        [...this.status.pendingInterrupts.keys()].forEach(key => {
            this.status.pendingInterrupts.set(key, false);
        });

        // update UI
        guiVariables.keep_highlighted = -1n;
    }

    /**
     * Checks for pending interrupts
     *
     * @returns Type of pending interrupt, else `null`
     */
    public check(): InterruptType | null {
        return this.handler.check(this.status);
    }

    /** Checks if a type of interrupt is enabled */
    public isEnabled(type: InterruptType): boolean {
        return this.handler.isEnabled(this.status, type);
    }

    /** Checks if a type of interrupt is globally enabled */
    public isGlobalEnabled(): boolean {
        this.handler.isGlobalEnabled(this.status);
        return this.status.globalEnabled;
    }

    /** Clears a specific interrupt type */
    public clear(type: InterruptType): void {
        this.handler.clear(this.status, type);

        // update UI
        guiVariables.keep_highlighted = -1n;
    }

    /**
     * Executes the interrupt enable handler methods to syncronize with the
     * interrupt enabled status.
     */
    #syncEnabledInterrupts() {
        // global
        if (this.status.globalEnabled) {
            this.handler.globalEnable(this.status);
        } else {
            this.handler.globalDisable(this.status);
        }

        // per-type
        [...this.status.enabled.entries()].forEach(([type, enabled]) =>
            enabled
                ? this.handler.enable(this.status, type)
                : this.handler.disable(this.status, type),
        );
    }

    /**
     * Creates a new InterruptHandler. All interrupts are enabled by default.
     *
     * @param [handler=InterruptHandler.CREATOR] Interrupt handler
     * @param status Status to initialize the handler with. By default, a
     * "clean" status
     */
    constructor(
        handler = InterruptHandlerType.CREATOR,
        status?: InterruptStatus,
    ) {
        this.customHandlerAllowed = architecture.interrupts !== undefined;
        if (
            handler === InterruptHandlerType.Custom &&
            !this.customHandlerAllowed
        ) {
            throw new Error(
                "You must define interrupts in the architecture in order to use a custom handler",
            );
        }

        if (status) {
            this.status = status;
        }

        switch (handler) {
            case InterruptHandlerType.CREATOR:
                this.handler = new CREATORInterruptHandler(
                    architecture.interrupts,
                );
                break;

            case InterruptHandlerType.Custom:
                if (!this.customHandlerAllowed) {
                    throw new Error(
                        "You must define interrupts in the architecture in order to use a custom handler",
                    );
                }
                this.handler = new ArchitectureInterruptHandler(
                    architecture.interrupts!,
                );
                break;

            default:
                throw new Error(`Unknown handler '${handler}'`);
        }

        this.#syncEnabledInterrupts();
    }

    /**
     * Returns a new interrupt manager with the changed handler.
     */
    public switchHandler(handler: InterruptHandlerType) {
        return new InterruptManager(handler, this.status);
    }

    /**
     * Clears and enables all interrupts.
     */
    public reset() {
        // enable all interrupts
        [...this.status.enabled.keys()].forEach(key => {
            this.status.enabled.set(key, true);
        });
        this.status.globalEnabled = true

        this.#syncEnabledInterrupts();

        // clear all interrupts
        this.globalClear();
    }

    /**
     * Handles a pending interrupt
     */
    public handle(type: InterruptType) {
        // update UI
        guiVariables.keep_highlighted = guiVariables.previous_PC;

        this.handler.handle(this.status, type);
    }
}
