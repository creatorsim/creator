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

import { register_size_bits } from "../core.mjs";
import {
    checkTypeIEEE,
    float2bin,
    float32_to_uint,
    float64_to_uint,
    uint_to_float32,
    uint_to_float64,
} from "../utils/utils.mjs";

export function capi_uint2int(
    value: number | bigint,
    bits = register_size_bits,
) {
    // This function is exported to be used in validation.mts
    return BigInt.asIntN(bits, BigInt(value));
}

export const FP = {
    split_double(reg: bigint, index: 0 | 1): string {
        const value = reg.toString(16).padStart(16, "0");
        if (index === 0) {
            return value.substring(0, 8);
        } else {
            return value.substring(8, 16);
        }
    },

    uint2float32(value: number): number {
        return uint_to_float32(value);
    },

    float322uint(value: number): bigint {
        return BigInt(float32_to_uint(value));
    },

    int2uint(
        value: number | bigint,
        bits: number = register_size_bits,
    ): bigint {
        return BigInt.asUintN(bits, BigInt(value));
    },

    uint2int(
        value: number | bigint,
        bits: number = register_size_bits,
    ): bigint {
        return capi_uint2int(value, bits);
    },

    uint2float64(value0: number | bigint, value1?: number): number {
        return uint_to_float64(value0, value1);
    },

    float642uint(value: number): [number, number] {
        return float64_to_uint(value);
    },

    check_ieee(sign: string, exponent: string, mantissa: string): number {
        return checkTypeIEEE(sign, exponent, mantissa);
    },

    /**
     * Checks whether a `size` bits value fits in `target` bits
     */
    check_int_size(x: bigint | null, size: number, target: number): boolean {
        return (
            x !== null && BigInt.asIntN(size, x) === BigInt.asIntN(target, x)
        );
    },

    float2bin(f: number): string {
        return float2bin(f);
    },

    /**
     * Checks if a value is NaN, supporting both JS numbers and BigInt representations
     * of IEEE 754 floating-point NaN values.
     * 
     * For BigInts, checks if the bit pattern represents a NaN according to IEEE 754:
     * - Float32 NaN: exponent bits are all 1s (0xFF) and mantissa is non-zero
     * - Float64 NaN: exponent bits are all 1s (0x7FF) and mantissa is non-zero
     */
    isNaN(value: number | bigint): boolean {
        if (typeof value === "bigint") {
            // Check for 32-bit float NaN pattern
            const exp32Mask = 0x7F800000n;
            const mantissa32Mask = 0x007FFFFFn;
            const isNaN32 = (value & exp32Mask) === exp32Mask && (value & mantissa32Mask) !== 0n;
            
            // Check for 64-bit float NaN pattern
            const exp64Mask = 0x7FF0000000000000n;
            const mantissa64Mask = 0x000FFFFFFFFFFFFFn;
            const isNaN64 = (value & exp64Mask) === exp64Mask && (value & mantissa64Mask) !== 0n;
            
            return isNaN32 || isNaN64;
        }
        return Number.isNaN(value);
    },
};
