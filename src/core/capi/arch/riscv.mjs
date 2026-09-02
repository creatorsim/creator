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

import { bi_BigIntTofloat, bi_BigIntTodouble } from "@/core/utils/bigint.mjs";

function isInt(val, bits) {
    return val === BigInt.asIntN(bits, val);
}

function countTrailingZeros(value) {
    if (value === 0n) return 64;

    let count = 0;
    while ((value & 1n) === 0n) {
        count++;
        value >>= 1n;
    }
    return count;
}

function generateInstructionsImpl(value, instructions, destReg) {
    // Handle 32-bit values with LUI+ADDI sequence
    if (isInt(value, 32)) {
        const hi20 = Number(((value + 0x800n) >> 12n) & 0xfffffn);
        const lo12 = Number(BigInt.asIntN(12, value));

        if (hi20) {
            instructions.push(`lui ${destReg}, 0x${hi20.toString(16)}`);
        }

        if (lo12 || hi20 === 0) {
            const op = hi20 ? "addiw" : "addi";
            const src = hi20 ? destReg : "x0";
            instructions.push(`${op} ${destReg}, ${src}, ${lo12}`);
        }
        return;
    }

    // Handle larger values (RV64)
    const lo12 = BigInt.asIntN(12, value);
    let remainingValue = value - lo12;

    // Check if shifting can simplify the representation
    let shift = 0;
    if (!isInt(remainingValue, 32)) {
        shift = countTrailingZeros(remainingValue);

        // Handle case where shift would be 64 or greater (invalid for RISC-V slli)
        if (shift >= 64) {
            // If shift is 64+, remainingValue shifted right by 64+ bits is 0 in 64-bit arithmetic
            // So we only need to handle the lo12 part directly
            if (lo12) {
                instructions.push(`addi ${destReg}, x0, ${lo12}`);
            } else {
                instructions.push(`addi ${destReg}, x0, 0`); // Zero out register
            }
            return; // Exit early as we've handled the value directly
        }

        remainingValue >>= BigInt(shift);
    }

    // Process the remaining value recursively
    generateInstructionsImpl(remainingValue, instructions, destReg);

    // Apply shift if needed
    if (shift) {
        instructions.push(`slli ${destReg}, ${destReg}, ${shift}`);
    }

    // Add lower 12 bits if needed
    if (lo12) {
        instructions.push(`addi ${destReg}, ${destReg}, ${lo12}`);
    }
}

export const ARCH = {
    generateLoadImmediate(val, destReg) {
        const instructions = [];
        generateInstructionsImpl(BigInt.asIntN(64, val), instructions, destReg);
        return instructions.join(";");
    },
    toJSNumberD(bigIntValue) {
        //  Used when the D extension is enabled
        //  These are the possible cases:
        //  1. The value is a float64 NaN
        //      1.1 The value is a NaN-boxed float32 (upper 32
        //          bits are all 1's, lower 32 bits contain
        //          float32 representation).
        //      1.2 The value is the canonical NaN (0x7ff8000000000000n)
        //  2. The value is a valid float64 representation

        //  See RISC-V Spec, section 21.2

        bigIntValue = BigInt(bigIntValue);
        const bitString = bigIntValue.toString(2);
        const is64Bit = bitString.length <= 64;
        const lowerBits = bigIntValue & 0xffffffffn;
        const canonicalNaN64 = 0x7ff8000000000000n;
        const isCanonicalNaN64 = bigIntValue === canonicalNaN64;
        const upperBits = bigIntValue >> 32n;
        const isNaNBoxed32 = upperBits === 0xffffffffn;
        // Special check for 0
        if (bigIntValue === 0n) {
            return [0, "float32"];
        }
        if (!is64Bit) {
            throw new Error(
                "Called toJSNumberD with a value greater than 64 bits",
            );
        }
        if (isCanonicalNaN64) {
            return [NaN, "NaN64"];
        } else if (isNaNBoxed32) {
            return [bi_BigIntTofloat(lowerBits), "NaNBfloat32_64"];
        } else {
            return [bi_BigIntTodouble(bigIntValue), "float64"];
        }
    },
    toJSNumberS(bigIntValue) {
        //  Used when ONLY the S extension is enabled
        bigIntValue = BigInt(bigIntValue);
        const bitString = bigIntValue.toString(2);
        const is32Bit = bitString.length <= 32;
        const canonicalNaN32 = 0x7fc00000n;
        const isCanonicalNaN32 = bigIntValue === canonicalNaN32;
        if (isCanonicalNaN32) {
            return [NaN, "NaN32"];
        }
        // Special check for 0
        if (bigIntValue === 0n) {
            return [0, "float32"];
        }
        if (!is32Bit) {
            throw new Error(
                "Called toJSNumberS with a value greater than 32 bits",
            );
        }
        return [bi_BigIntTofloat(bigIntValue), "float32"];
    },
    toBigInt(number, type) {
        number = Number(number);

        switch (type) {
            case "float32": {
                // Convert to float32 representation
                const buffer = new ArrayBuffer(4);
                const float32Arr = new Float32Array(buffer);
                const uint32Array = new Uint32Array(buffer);

                float32Arr[0] = number;
                return BigInt(uint32Array[0]);
            }
            case "float64": {
                // Convert to float64 representation
                const buffer = new ArrayBuffer(8);
                const float64Arr = new Float64Array(buffer);
                const uint32Array = new Uint32Array(buffer);

                float64Arr[0] = number;

                // Combine the two 32-bit parts into a 64-bit BigInt
                const lowerBits = BigInt(uint32Array[0]);
                const upperBits = BigInt(uint32Array[1]);
                return (upperBits << 32n) | lowerBits;
            }
            case "NaNBfloat32_64": {
                // Convert to NaN-boxed float32
                const buffer = new ArrayBuffer(4);
                const float32Arr = new Float32Array(buffer);
                const uint32Array = new Uint32Array(buffer);

                float32Arr[0] = number;
                const integerValue = uint32Array[0];

                // Create NaN-boxed representation: upper 32 bits all 1's
                const upperBits = 0xffffffffn;
                const lowerBits = BigInt(integerValue);

                return (upperBits << 32n) | lowerBits;
            }
            case "NaN64":
                return 0x7ff8000000000000n;
            case "NaN32":
                return 0x7fc00000n;
            default:
                throw new Error("Unknown type for toBigInt: " + type);
        }
    },
    NaNBox(bigIntValue) {
        //  Used when the D extension is enabled
        //  Simply NaN-boxes the value
        //  See RISC-V Spec, section 21.2
        bigIntValue = BigInt(bigIntValue);
        const bitString = bigIntValue.toString(16).padStart(8, "0");
        let NaNBoxed = "0xFFFFFFFF" + bitString;
        if (NaNBoxed.length > 18) {
            throw new Error("NaNBoxed value exceeds 64 bits: " + NaNBoxed);
        }
        // Back to bigint
        NaNBoxed = BigInt(NaNBoxed);
        return NaNBoxed;
    },
    /**
     * Writes a float32 to a register, using NaN boxing with float64
     * @param {number} value - The JavaScript number to write
     * @param {string} regName - The base register name (must be even, e.g., "f0")
     **/
    writeFloat(value, regName) {
        const bits = this.toBigInt(value, "NaNBfloat32_64")
        CAPI.REG.write(bits, regName)
    }
};
