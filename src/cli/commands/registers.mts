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

import * as creator from "../../core/core.mjs";
import { cliState } from "../state.mts";
import { colorText } from "../display.mts";

/**
 * Display all available register types
 */
function displayRegisterTypes(): void {
    const types = creator.getRegisterTypes();

    console.log("Register types:");
    types.forEach((type: string) => {
        console.log(`  ${type}`);
    });

    console.log("\nUse 'reg <type>' to show registers of a specific type");
}

/**
 * Display registers in a specific bank
 */
function displayRegistersByBank(regType: string, format: string = "raw"): void {
    const registerBank = creator.getRegistersByBank(regType);

    if (!registerBank) {
        console.log(`Register type "${regType}" not found.`);
        return;
    }

    console.log(`${registerBank.name}:`);

    const rowCount = Math.ceil(registerBank.registers.length / 4);

    // Calculate max width for each column
    const maxWidths = [0, 0, 0, 0];
    for (let row = 0; row < rowCount; row++) {
        for (let col = 0; col < 4; col++) {
            const index = row * 4 + col;
            if (index < registerBank.registers.length) {
                const reg = registerBank.registers[index];
                const primaryName = reg!.name[0];
                const altNames = reg!.name.slice(1).join(",");
                const displayName = altNames
                    ? `${primaryName}(${altNames})`
                    : primaryName;
                maxWidths[col] = Math.max(maxWidths[col]!, displayName!.length);
            }
        }
    }

    for (let row = 0; row < rowCount; row++) {
        let line = "";
        for (let col = 0; col < 4; col++) {
            const index = row * 4 + col;
            if (index < registerBank.registers.length) {
                const reg = registerBank.registers[index];
                const primaryName = reg!.name[0];
                const altNames = reg!.name.slice(1).join(",");

                const nbits = reg!.nbits;
                const hexDigits = Math.ceil(nbits / 4);
                let value;

                const rawValue = creator.dumpRegister(
                    primaryName,
                    reg!.type === "float" ? "raw" : "twoscomplement",
                );
                const floatValue = creator.dumpRegister(primaryName, "decimal");

                if (format === "raw") {
                    value = `0x${rawValue.padStart(hexDigits, "0")}`;
                } else if (format === "decimal" || format === "dec") {
                    value = `${floatValue.toString(10)}`;
                } else {
                    console.log(`Unknown format "${format}"`);
                    return;
                }
                const displayName = altNames
                    ? `${primaryName}(${altNames})`
                    : primaryName;

                const coloredName = colorText(
                    displayName!.padEnd(maxWidths[col]!),
                    "36",
                );
                line += `${col > 0 ? "  " : ""}${coloredName}: ${`${value}`}`;
            }
        }
        console.log(line);
    }
}

/**
 * Handle reg command - display registers
 */
export function handleRegCommand(args: string[]): void {
    if (args.length < 2) {
        console.log("Usage: reg <type> | reg list | reg <register> [format]");
        console.log("Use 'reg list' to see available register types");
        console.log("Format options: raw (default), number");
        return;
    }

    const cmd = args[1]!.toLowerCase();
    const format = args[2] || "raw";

    if (cmd === "list") {
        displayRegisterTypes();
    } else {
        const regType = args[1]!.toLowerCase();
        const regTypes = creator.getRegisterTypes();
        if (regTypes.includes(regType)) {
            displayRegistersByBank(cmd, format);
        } else {
            const regName = args[1];
            const regInfo = creator.getRegisterInfo(regName);
            if (!regInfo) {
                console.log(`Register "${regName}" not found.`);
                return;
            }

            const rawValue = creator.dumpRegister(
                regName,
                regInfo.type === "float" ? "raw" : "twoscomplement",
            );
            const floatValue = creator.dumpRegister(regName, "decimal");
            console.log(`${regName}: 0x${rawValue} | ${floatValue}`);
        }
    }
}
