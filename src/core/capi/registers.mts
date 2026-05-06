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

import { architecture } from "../core.mjs";
import { crex_findReg } from "../register/registerLookup.mjs";
import {
    readRegister,
    writeRegister,
} from "../register/registerOperations.mjs";

export const REG = {
    read(name: string): bigint {
        const reg = crex_findReg(name);

        if (reg.match) {
            return readRegister(reg.indexComp, reg.indexElem);
        }

        throw new Error(`Register '${name}' not found.`);
    },

    write(value: bigint, name: string) {
        const reg = crex_findReg(name);
        if (reg.match) {
            const nbits =
                architecture.register_files[reg.indexComp!]!.registers[
                    reg.indexElem!
                ]!.nbits;
            writeRegister(
                BigInt.asUintN(nbits, value),
                reg.indexComp!,
                reg.indexElem!,
            );
            return;
        }

        throw new Error(`Register '${name}' not found.`);
    },
};
