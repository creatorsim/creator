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

/**
 * Represents a stack frame, with a begin and end address
 */
export type StackFrame = {
    name: string;
    begin: number;
    end: number;
};

export class StackTracker {
    private frames: Array<StackFrame>;
    private hints: Map<number, string>;

    /* Generic stuff */

    constructor() {
        this.frames = [];
        this.hints = new Map();
    }

    /**
     * Dumps the stack tracker's data.
     */
    public dump() {
        return {
            frames: this.frames,
            hints: Object.fromEntries(this.hints),
        };
    }

    /**
     * Loads stack tracker's data.
     */
    public load({
        frames,
        hints,
    }: {
        frames: Array<StackFrame>;
        hints: { [address: number]: string };
    }) {
        this.frames = frames;
        this.hints = new Map(
            Object.entries(hints).map(([key, value]) => [Number(key), value]), // ts magic
        );
    }

    /**
     * Resets the stack tracker.
     */
    public reset() {
        this.frames.length = 0;
        this.hints.clear();
        this.newFrame(architecture.config.main_function);
    }

    /**
     * Returns the number of frames.
     */
    public length() {
        return this.frames.length;
    }

    /**
     * Returns the address of the stack pointer.
     */
    private static getCurrentStackPointer(): number {
        // find stack pointer register
        const sp = REGISTERS.flatMap(bank =>
            bank.registers.filter(register =>
                // check it has the stack pointer property
                register.properties.includes("stack_pointer"),
            ),
        ).at(0);

        if (sp === undefined) {
            throw new Error("Found no stack pointer register");
        }

        return Number(sp.value);
    }

    private updateUI() {
        if (document === undefined || Object.hasOwn(document, "app") === false)
            return;
        // @ts-ignore app is injected by Vue
        document.app.$data.callee_frame = this.frames.at(-1);
        // @ts-ignore app is injected by Vue
        document.app.$data.caller_frame = this.frames.at(-2);
    }

    /* Frames */

    /**
     * Creates a new stack frame.
     *
     * @param name Name of the frame, typically the tag of the subroutine, or an
     * address, e.g. (0xFFFFFFFC).
     */
    public newFrame(name: string) {
        const stackTop = StackTracker.getCurrentStackPointer();
        const frame = {
            name,
            begin: stackTop,
            end: stackTop,
        };

        this.frames.push(frame);

        // update UI
        if (typeof document !== "undefined") {
            this.updateUI();
        }
    }

    /**
     * Removes the last frame.
     *
     * @returns Frame, if it exists, else `undefined`.
     */
    public popFrame() {
        const frame = this.frames.pop();

        // update UI
        if (typeof document !== "undefined") {
            this.updateUI();
        }

        return frame;
    }

    public getCurrentFrame() {
        return this.frames.at(-1);
    }

    /**
     * Updates the end address of the current frame.
     *
     * By default, it sets it to the current stack pointer value.
     *
     */
    public updateCurrentFrame(
        address: number | bigint = StackTracker.getCurrentStackPointer(),
    ): void {
        const currentFrame = this.getCurrentFrame();
        if (currentFrame === undefined) return;

        currentFrame.end = Number(address);
    }

    /**
     * Returns the stack frames.
     */
    public getAllFrames() {
        return this.frames;
    }

    /**
     * Return the frame names.
     */
    public getFrameNames() {
        return this.frames.map(f => f.name);
    }

    /* Hints */

    /**
     * Adds a stack hint for a memory address.
     */
    public addHint(address: number | bigint, name: string) {
        this.hints.set(Number(address), name);
    }

    /**
     * Returns the stack hints.
     */
    public getAllHints() {
        return this.hints;
    }

    /**
     * Returns the stack hint at the specified address.
     */
    public getHint(address: number) {
        return this.hints.get(address);
    }
}
