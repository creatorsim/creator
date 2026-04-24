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

import { main_memory, stackTracker, BYTESIZE, REGISTERS } from "../core.mjs";
import { exit } from "../executor/executor.mjs";
import { raise } from "./validation.mts";
import { crex_findReg } from "../register/registerLookup.mjs";
import { sentinel } from "../sentinel/sentinel.mts";
import { checkDeviceAddr, devices } from "../executor/devices.mts";
import type { Memory } from "../memory/Memory.mts";
import { toHex } from "../utils/utils.mjs";

/*
 *  CREATOR instruction description API:
 *  Memory access
 */

/**
 * Writes a value to memory respecting endianness configuration
 * @param address Memory address to write to
 * @param value Value to write
 * @param bytes Number of bytes to write
 * @returns Array of bytes written
 */
function writeValueToMemory(
    address: bigint,
    value: bigint,
    bytes: number,
): number[] {
    if (value < 0n) {
        throw "The value to write must be a positive integer";
    }

    // get memory
    const deviceID = checkDeviceAddr(Number(address));
    const memory =
        deviceID === null
            ? (main_memory as Memory)
            : devices.get(deviceID)!.memory;

    const wordSize = memory.getWordSize();

    if (bytes === 1) {
        // Single byte write
        const byteValue = Number(value & 0xffn);
        memory.write(address, byteValue);
        return [byteValue];
    } else if (bytes <= wordSize) {
        // Multi-byte value that fits within a word
        const byteArray = memory.splitToBytes(value);

        // Pad from the left (most significant bytes) to match requested size
        const paddedByteArray = new Array(bytes).fill(0);
        const startIndex = Math.max(0, bytes - byteArray.length);
        for (let i = 0; i < byteArray.length && i < bytes; i++) {
            paddedByteArray[startIndex + i] = byteArray[i];
        }

        if (bytes === wordSize) {
            // Write as a full word
            memory.writeWord(address, paddedByteArray);
        } else {
            // Write individual bytes for partial word
            for (let i = 0; i < paddedByteArray.length; i++) {
                memory.write(address + BigInt(i), paddedByteArray[i]);
            }
        }
        return paddedByteArray;
    } else {
        // Value spans multiple words
        const byteArray = memory.splitToBytes(value);

        // Pad from the left to match requested size
        const paddedByteArray = new Array(bytes).fill(0);
        const startIndex = Math.max(0, bytes - byteArray.length);
        for (let i = 0; i < byteArray.length && i < bytes; i++) {
            paddedByteArray[startIndex + i] = byteArray[i];
        }

        // Write as multiple words
        let currentAddr = address;
        for (let i = 0; i < paddedByteArray.length; i += wordSize) {
            const wordBytes = paddedByteArray.slice(i, i + wordSize);
            // Pad the word if necessary
            while (wordBytes.length < wordSize) {
                wordBytes.push(0);
            }
            memory.writeWord(currentAddr, wordBytes);
            currentAddr += BigInt(wordSize);
        }
        return paddedByteArray;
    }
}

/**
 * Reads a value from memory respecting endianness configuration
 * @param address Memory address to read from
 * @param bytes Number of bytes to read
 * @returns The value read from memory
 */
function readValueFromMemory(address: bigint, bytes: number): bigint {
    // get memory
    const deviceID = checkDeviceAddr(Number(address));
    const memory =
        deviceID === null
            ? (main_memory as Memory)
            : devices.get(deviceID)!.memory;

    const wordSize = memory.getWordSize();
    if (bytes === 1) {
        // Single byte - read directly
        return BigInt(memory.read(address));
    } else if (bytes <= wordSize) {
        // Multi-byte value that fits within a word - use readWord to respect endianness
        const wordAddr = address - (address % BigInt(wordSize));
        const word = memory.readWord(wordAddr);
        const byteOffset = address % BigInt(wordSize);

        // Extract the relevant bytes from the word
        let val = 0n;
        for (let i = 0; i < bytes; i++) {
            const byteIndex = Number(byteOffset) + i;
            if (byteIndex < wordSize) {
                val =
                    (val << BigInt(memory.getBitsPerByte())) |
                    BigInt(word[byteIndex]!);
            }
        }
        return val;
    } else {
        // Value spans multiple words - read as individual words
        let val = 0n;
        let currentAddr = address;
        let remainingBytes = bytes;

        while (remainingBytes > 0) {
            const bytesThisWord = Math.min(wordSize, remainingBytes);
            const word = memory.readWord(currentAddr);

            // Extract bytes from this word (from the end for big-endian result)
            const startIdx = wordSize - bytesThisWord;
            for (let i = startIdx; i < wordSize; i++) {
                val =
                    (val << BigInt(memory.getBitsPerByte())) | BigInt(word[i]!);
            }

            currentAddr += BigInt(wordSize);
            remainingBytes -= bytesThisWord;
        }
        return val;
    }
}

/*
 * Name:        mp_write - Write value into a memory address
 * Sypnosis:    mp_write (destination_address, value2store, byte_or_half_or_word)
 * Description: similar to memmove/memcpy, store a value into an address
 */
// Memory operations
export const MEM = {
    write(
        address: bigint,
        bytes: number,
        value: bigint,
        reg_name?: string,
        hint?: string,
        noSegFault: boolean = true,
    ): void {
        // get memory
        const deviceID = checkDeviceAddr(Number(address));
        const memory =
            deviceID === null
                ? (main_memory as Memory)
                : devices.get(deviceID)!.memory;

        // Check if the address is in a writable segment using memory functions
        const segment = memory.getSegmentForAddress(address);
        if (!noSegFault) {
            if (segment === "text") {
                raise(
                    "Segmentation fault. You tried to write in the text segment",
                );
                exit(true);
            }

            // Validate that write access is allowed for this address
            if (!memory.isValidAccess(address, "write")) {
                raise(
                    "Segmentation fault. Write access denied for address '0x" +
                        address.toString(16) +
                        "'",
                );
                exit(true);
            }
        }

        let byteArray = [];
        try {
            byteArray = writeValueToMemory(address, value, bytes);
        } catch (_e) {
            raise(
                "Invalid memory access to address '0x" +
                    address.toString(16) +
                    "'",
            );
            exit(true);
        }

        // Add hint if provided
        if (hint) {
            try {
                const sizeInBits = bytes * BYTESIZE;
                memory.addHint(BigInt(address), [], hint, sizeInBits);
            } catch (e) {
                raise(
                    "Failed to add hint for address '0x" +
                        address.toString(16) +
                        "': " +
                        e,
                );
            }
        }

        const ret = crex_findReg(reg_name);
        if (ret.match === 0) {
            return;
        }

        const i = ret.indexComp;
        const j = ret.indexElem;

        // Add stack hint if we're writing to the stack segment
        if (segment === "stack") {
            const reg = REGISTERS[i]!.registers[j]!;
            stackTracker.addHint(address, reg.name.join(","));
        }

        sentinel.recordMemoryWrite(i, j, address, byteArray.length);
    },

    read(
        address: bigint,
        bytes: number,
        reg_name?: string,
        noSegFault: boolean = true,
    ): bigint {
        // get memory
        const deviceID = checkDeviceAddr(Number(address));
        const memory =
            deviceID === null
                ? (main_memory as Memory)
                : devices.get(deviceID)!.memory;

        // Implementation of capi_mem_read
        let val = 0n;

        if (!noSegFault) {
            // Check if the address is in a readable segment using memory functions
            const segment = memory.getSegmentForAddress(address);
            if (segment === "text") {
                raise(
                    `Segmentation fault. You tried to read in the text segment (${toHex(address, 4)})`,
                );
                exit(true);
            }

            // Validate that read access is allowed for this address
            if (!memory.isValidAccess(address, "read")) {
                raise(
                    "Segmentation fault. Read access denied for address '0x" +
                        address.toString(16) +
                        "'",
                );
                exit(true);
            }
        }
        try {
            val = readValueFromMemory(address, bytes);
        } catch (_e) {
            raise(
                "Invalid memory access to address '0x" +
                    address.toString(16) +
                    "'",
            );
            exit(true);
        }

        // Remove the call to undefined function
        const ret = val;

        // write info about register
        if (reg_name) {
            const find_ret = crex_findReg(reg_name);
            if (find_ret.match === 0) {
                return ret;
            }

            const i = find_ret.indexComp;
            const j = find_ret.indexElem;

            sentinel.recordMemoryRead(i, j, address, bytes);
        }

        return ret;
    },

    /**
     * Allocates N bytes of memory
     *
     * @param bytes - Amount of bytes to allocate
     * @returns Starting address of the allocation
     */
    alloc(bytes: number): bigint {
        return main_memory.alloc(bytes, "data");
    },

    /**
     * Adds a hint for a memory address. If a hint already exists at the specified address, it replaces it.
     * @param address Memory address to add hint for
     * @param hint Description of the data type or purpose (e.g., `"double"`, `"int32"`, `"string"`)
     * @param sizeInBits Optional size of the type in bits (e.g., `64` for double, `32` for int32)
     * @returns `true` if the hint was successfully added, else `false`
     */
    addHint(address: bigint, hint: string, sizeInBits?: number): boolean {
        // get memory
        const deviceID = checkDeviceAddr(Number(address));
        const memory =
            deviceID === null
                ? (main_memory as Memory)
                : devices.get(deviceID)!.memory;

        try {
            memory.addHint(address, [], hint, sizeInBits);
            return true;
        } catch (e) {
            raise(
                "Failed to add hint for address '0x" +
                    address.toString(16) +
                    "': " +
                    e,
            );
            return false;
        }
    },
};
