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

import { REGISTERS } from "../core.mjs";

/*
 *  Register cache
 */
const registerCache = new Map();
const registerTagCache = new Map();

/**
 * Clear the register caches
 * Should be called when REGISTERS array is modified
 */
export function crex_clearRegisterCache() {
    registerCache.clear();
    registerTagCache.clear();
}

/*
 *  Register operations
 */
export function crex_findReg(value1) {
    const ret = {};

    ret.match = 0;
    ret.indexComp = null;
    ret.indexElem = null;

    if (value1 === "") {
        return ret;
    }

    // Check cache first
    if (registerCache.has(value1)) {
        return registerCache.get(value1);
    }

    for (let i = 0; i < REGISTERS.length; i++) {
        for (let j = 0; j < REGISTERS[i].registers.length; j++) {
            if (REGISTERS[i].registers[j].name.includes(value1) !== false) {
                ret.match = 1;
                ret.indexComp = i;
                ret.indexElem = j;
                break;
            }
        }
    }

    // Cache the result
    registerCache.set(value1, ret);

    return ret;
}
export function crex_findReg_bytag(value1) {
    const ret = {};

    ret.match = 0;
    ret.indexComp = null;
    ret.indexElem = null;

    if (value1 === "") {
        return ret;
    }

    // Check cache first
    if (registerTagCache.has(value1)) {
        return registerTagCache.get(value1);
    }

    for (let i = 0; i < REGISTERS.length; i++) {
        for (let j = 0; j < REGISTERS[i].registers.length; j++) {
            if (
                REGISTERS[i].registers[j].properties.includes(value1) !== false
            ) {
                ret.match = 1;
                ret.indexComp = i;
                ret.indexElem = j;
                break;
            }
        }
    }

    // Cache the result
    registerTagCache.set(value1, ret);

    return ret;
}
