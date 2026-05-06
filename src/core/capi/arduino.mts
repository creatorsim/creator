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

import * as hooks from "./arduino_functions.mts";
import { loadedCreatino } from "../core.mjs";

/*
 *  CREATOR instruction description API:
 *  CREATino executor module
 */

// -------Create hookmap from custom library file
const hookMap = new Map<number, () => void>();
export const ARDUINO = {
    check_arduino: (funcName: number, pc_state: number): boolean => {
        return check_arduino(funcName, pc_state);
    },
};

export function createHookMap() {
    const hookOrder = hooks.hookOrder as string[]; // 👈 asegurar tipo

    for (let i = 0, addr = 0x0; i < hookOrder.length; i++, addr += 4) {
        const funcName = hookOrder[i];

        const func = hooks[funcName as keyof typeof hooks] as (() => void) | undefined;

        hookMap.set(
            addr,
            func ?? (() => console.log(`Function ${funcName} not found`))
        );
    }

    
}
// AUX
function getAddressOfHook(func: () => void): number | undefined {
    for (const [addr, f] of hookMap.entries()) {
        if (f === func) return addr;
    }
    return undefined;
}


// ------- Identify arduino functions-----
export function check_arduino(funcName: number, pc_state: number): boolean {
    const key = Math.abs(Number(pc_state) + Number(funcName));
    if (hookMap.size === 0) {
        //await createHookMap(); ERROR
        createHookMap();        
    }
    if (loadedCreatino == false) {
        return false;
    }

    const func = hookMap.get(key);
    if (func) {
        func();
        return true;
    }

    return false;
}
