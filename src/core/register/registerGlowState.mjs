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
 * Persistent store for register glow state
 * This exists outside component lifecycles to maintain state across component unmount/remount
 * (e.g., on mobile when switching between tabs)
 */

// Set of register keys that should be glowing
// Key format: "bankIndex:registerIndex" (e.g., "0:5" for REGISTERS[0].registers[5])
const glowingRegisters = new Set();

/**
 * Marks a register as glowing (recently modified)
 * @param {number} indexComp - Index of the register bank
 * @param {number} indexElem - Index of the register element
 */
export function setRegisterGlow(indexComp, indexElem) {
    const key = `${indexComp}:${indexElem}`;
    glowingRegisters.add(key);
}

/**
 * Removes glow state from a specific register
 * @param {number} indexComp - Index of the register bank
 * @param {number} indexElem - Index of the register element
 */
export function clearRegisterGlow(indexComp, indexElem) {
    const key = `${indexComp}:${indexElem}`;
    glowingRegisters.delete(key);
}

/**
 * Clears glow state from all registers
 */
export function clearAllRegisterGlows() {
    glowingRegisters.clear();
}

/**
 * Checks if a register should be glowing
 * @param {number} indexComp - Index of the register bank
 * @param {number} indexElem - Index of the register element
 * @returns {boolean} True if the register should glow
 */
export function isRegisterGlowing(indexComp, indexElem) {
    const key = `${indexComp}:${indexElem}`;
    return glowingRegisters.has(key);
}

/**
 * Gets all glowing registers
 * @returns {Set<string>} Set of register keys that are glowing
 */
export function getGlowingRegisters() {
    return new Set(glowingRegisters);
}
