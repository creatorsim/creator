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

import { architecture, REGISTERS, WORDSIZE } from "../core.mjs";
import { logger } from "../utils/creator_logger.mjs";
const BINARY_BASE = 2;
const DECIMAL_BASE = 10;
let instructionLookupCache = null;

/**
 * Resets the instruction lookup cache
 *
 * @function resetCache
 * @returns {void}
 */
export function resetDecoderCache() {
    instructionLookupCache = null;
}

/**
 * Returns the register name given its binary representation and type
 *
 * @param {string} type - The register type (e.g., "int", "float", "ctrl")
 * @param {string} binaryValue - The binary representation of the register
 * @returns {string|null} - The register name or null if not found
 */
function decodeRegister(type, binaryValue) {
    const binaryValueInt = parseInt(binaryValue, BINARY_BASE);
    // Find the component that matches the requested register type
    for (const component of REGISTERS) {
        if (component.type !== type) {
            continue;
        }

        for (const register of component.registers) {
            if (register.encoding === binaryValueInt) {
                return register.name[0]; // Return the first name (canonical)
            }
        }
    }

    return null;
}

/**
 * Finds the position of the operation code field within the instruction fields
 *
 * @param {Array<Object>} fields - Array of instruction fields
 * @returns {Object|null} - An object with startbit, stopbit, and value properties, or null if not found
 */
function extractOpcode(fields) {
    for (const field of fields) {
        if (field.type === "co") {
            return {
                startbit: field.startbit,
                stopbit: field.stopbit,
                value: field.value,
            };
        }
    }
    return null;
}

/**
 * Converts a binary string to a signed integer value using two's complement
 *
 * @param {string} binaryValue - The binary string to convert
 * @returns {number} The signed integer value
 */
function convertToSignedValue(binaryValue) {
    let value = parseInt(binaryValue, BINARY_BASE);
    if (binaryValue.charAt(0) === "1") {
        value -= BINARY_BASE ** binaryValue.length;
    }
    return value;
}

/**
 * Computes the bits_order array from startbit and stopbit arrays
 *
 * @param {Array<number>} startbit - Array of starting bit positions
 * @param {Array<number>} stopbit - Array of stopping bit positions
 * @returns {Array<number>} - Array of bit positions in order
 */
function computeBitsOrder(startbit, stopbit) {
    const bitsOrder = [];

    for (let i = 0; i < startbit.length; i++) {
        // For each range [stopbit[i], startbit[i]], add all bits in the range
        // Note: In the architecture spec, startbit >= stopbit
        for (let bit = startbit[i]; bit >= stopbit[i]; bit--) {
            bitsOrder.push(bit);
        }
    }

    return bitsOrder;
}

/**
 * Processes a single instruction field and extracts its value from the binary instruction
 *
 * @param {Object} field - The instruction field definition object
 * @param {string} encodedInstruction - String containing the binary instruction and possibly part of the next one. In that case, only the first nwords*WORDSIZE bits are considered.
 * @returns {string|number|null} The extracted field value or null if not applicable
 */
// eslint-disable-next-line max-lines-per-function
function processInstructionField(field, encodedInstruction) {
    let value = null;
    switch (field.type) {
        case "co":
        case "cop":
            break;
        case "INT-Reg":
        case "SFP-Reg":
        case "DFP-Reg":
        case "Ctrl-Reg": {
            const bin = encodedInstruction.substring(
                encodedInstruction.length - field.startbit - 1,
                encodedInstruction.length - field.stopbit,
            );

            let convertedType;
            // The register type in the instruction is different from the one in the architecture
            switch (field.type) {
                case "INT-Reg":
                    convertedType = "int";
                    break;
                case "SFP-Reg":
                case "DFP-Reg":
                    convertedType = "float";
                    break;
                case "Ctrl-Reg":
                    convertedType = "ctrl";
                    break;
                default:
                    throw new Error("Unknown register type: " + field.type);
            }

            value = decodeRegister(convertedType, bin);
            break;
        }
        case "enum": {
            const binaryValue = encodedInstruction.substring(
                encodedInstruction.length - field.startbit - 1,
                encodedInstruction.length - field.stopbit,
            );

            // Convert to unsigned decimal
            const decimalValue = parseInt(binaryValue, BINARY_BASE);

            // Get the enum definition from architecture
            if (architecture.enums && architecture.enums[field.enum_name]) {
                const enumDef = architecture.enums[field.enum_name];

                // Find the enum name that corresponds to this value
                for (const [enumName, enumValue] of Object.entries(enumDef)) {
                    if (enumValue === decimalValue) {
                        value = enumName;
                        // TODO: This is hardcoded and specific to RISC-V. Remove this.
                        // For "dyn" (7), which is the default rounding mode, return null
                        // so it can be omitted in the output
                        if (enumName === "dyn") {
                            value = null;
                        }
                        break;
                    }
                }
            } else {
                logger.error(
                    `Enum ${field.enum_name} not found in architecture`,
                );
            }
            break;
        }
        case "imm-signed":
        case "imm-unsigned":
        case "address":
        case "offset_bytes":
        case "offset_words": {
            // Check if field has non-contiguous bits
            if (Array.isArray(field.startbit)) {
                let binaryValue = "";
                /*
                 *  startbit and stopbit map the bits in the immediate to the bits in the instruction, in order
                 *  RISC-V example (B-type instruction):
                 *
                 *  31     30-25    24-20   19-15   14-12   11-8    7      6-0
                 *  ┌────┬──────────┬───────┬───────┬───────┬──────┬────┬─────────┐
                 *  │ imm│  imm     │  rs2  │  rs1  │ func3 │ imm  │imm │ opcode  │
                 *  │[12]│  [10:5]  │       │       │       │[4:1] │[11]│         │
                 *  └──┬─┴────┬─────┴───┬───┴───┬───┴───┬───┴──┬───┴────┴────┬────┘
                 *     │      │         │       │       │      │             │
                 *     1      6         5       5       3      4       1     7    bits = 32 bits = word size
                 *
                 *  Notice how the immediate is all over the place, and not contiguous.
                 *
                 *  In this case, the mapping would be:
                 *  imm[12] -> 31
                 *  imm[11] -> 7
                 *  imm[10:5] -> 30-25
                 *  imm[4:1] -> 11-8
                 *
                 *  So startbit and stopbit would be:
                 *  startbit = [31, 7, 30, 11]
                 *  stopbit = [31, 7, 25, 8]
                 *
                 *  The calculated bitsOrder would be: [31, 7, 30, 29, 28, 27, 26, 25, 11, 10, 9, 8]
                 *  And padding would be 1, since the LSB is always 0
                 *  (see RISC-V spec, section 2.3 and
                 *  https://stackoverflow.com/questions/58414772/why-are-risc-v-s-b-and-u-j-instruction-types-encoded-in-this-way
                 *  for more information)
                 *
                 *  The above example is for RISC-V's B-type instructions, but the same
                 *  logic applies to J-type instructions, even though the immediate is contiguous.
                 */
                const bitsOrder = computeBitsOrder(
                    field.startbit,
                    field.stopbit,
                );

                for (const bitPos of bitsOrder) {
                    binaryValue += encodedInstruction.charAt(
                        encodedInstruction.length - bitPos - 1,
                    );
                }
                // Now, check field.padding to see if we need to add padding
                const padding = parseInt(field.padding, DECIMAL_BASE);
                if (padding > 0) {
                    binaryValue += "0".repeat(padding);
                }

                value = parseInt(binaryValue, BINARY_BASE);
                // Signed immediates need to be sign-extended
                if (
                    field.type === "imm-signed" ||
                    field.type === "offset_words" ||
                    field.type === "offset_bytes"
                ) {
                    value = convertToSignedValue(binaryValue);
                }
            } else {
                // Handle normal case where the immediate is contiguous and ordered
                const binaryValue = encodedInstruction.substring(
                    encodedInstruction.length - field.startbit - 1,
                    encodedInstruction.length - field.stopbit,
                );

                value = parseInt(binaryValue, BINARY_BASE);
                if (
                    field.type === "imm-signed" ||
                    field.type === "offset_words" ||
                    field.type === "offset_bytes"
                ) {
                    value = convertToSignedValue(binaryValue);
                }
            }

            break;
        }
        case "skip":
            value = field.value;
            break;

        default:
            logger.error("Unknown field type: " + field.type);
    }
    return value;
}

/**
 * Builds a lookup table for fast instruction matching
 * Groups instructions by opcode and creates bit masks for function fields
 *
 * @returns {Map<string, Array<Object>>} A map where keys are opcode identifiers and values are arrays of instruction candidates
 */
function buildInstructionLookupTable() {
    if (instructionLookupCache) {
        return instructionLookupCache;
    }

    const lookupTable = new Map();

    for (const instruction of architecture.instructions) {
        const opcodeField = extractOpcode(instruction.fields);
        if (!opcodeField) continue;

        const key = `${opcodeField.value}_${opcodeField.startbit}_${opcodeField.stopbit}`;

        if (!lookupTable.has(key)) {
            lookupTable.set(key, []);
        }

        // Pre-compute function field masks for this instruction
        const functionMasks = [];
        for (const field of instruction.fields) {
            if (field.type === "cop") {
                functionMasks.push({
                    startbit: field.startbit,
                    stopbit: field.stopbit,
                    expectedValue: field.value,
                    word: field.word,
                });
            }
        }

        lookupTable.get(key).push({
            instruction,
            functionMasks,
            opcodeInfo: opcodeField,
        });
    }

    instructionLookupCache = lookupTable;
    return lookupTable;
}

/**
 * Checks if two instructions only differ by one having an enum field
 * Returns the instruction with the enum field if applicable, null otherwise
 *
 * @param {Object} inst1 - First instruction object to compare
 * @param {Object} inst2 - Second instruction object to compare
 * @returns {Object|null} The instruction with enum field preference or null if no preference can be determined
 */
function checkEnumFieldPreference(inst1, inst2) {
    // Get fields that have an order (excluding co and cop fields)
    const fields1 = inst1.fields.filter(
        f => f.type !== "co" && f.type !== "cop",
    );
    const fields2 = inst2.fields.filter(
        f => f.type !== "co" && f.type !== "cop",
    );

    // If different number of fields, can't match
    if (fields1.length !== fields2.length) {
        return null;
    }

    // Sort fields by position for comparison
    const sortedFields1 = fields1.sort((a, b) => a.startbit - b.startbit);
    const sortedFields2 = fields2.sort((a, b) => a.startbit - b.startbit);

    let enumDifferences = 0;
    let enumInstruction = null;

    // Compare fields at each position
    for (let i = 0; i < sortedFields1.length; i++) {
        const field1 = sortedFields1[i];
        const field2 = sortedFields2[i];

        // Check if fields are at the same position
        if (
            field1.startbit !== field2.startbit ||
            field1.stopbit !== field2.stopbit
        ) {
            // Fields don't match by position, can't determine preference
            return null;
        }

        // Check if types differ and one is enum
        if (field1.type !== field2.type) {
            if (field1.type === "enum" && field2.type !== "enum") {
                enumDifferences++;
                enumInstruction = inst1;
            } else if (field2.type === "enum" && field1.type !== "enum") {
                enumDifferences++;
                enumInstruction = inst2;
            } else {
                // Types differ but neither is enum, or both are enum
                return null;
            }
        }
    }

    // Return the instruction with enum field only if there's exactly one difference
    return enumDifferences === 1 ? enumInstruction : null;
}

/**
 * Checks if a candidate instruction matches the given binary instruction
 *
 * @param {Object} candidate - The candidate instruction object
 * @param {string} instruction - The binary instruction to match against
 * @returns {boolean} True if the candidate matches, false otherwise
 */
function checkCandidateOpcode(candidate, instruction) {
    if (candidate.functionMasks.length === 0) {
        // No function fields to check
        return true;
    }

    // Check all function fields
    for (const mask of candidate.functionMasks) {
        // Extract field value from concatenated instruction using global bit positions
        const fieldValue = instruction.substring(
            instruction.length - mask.startbit - 1,
            instruction.length - mask.stopbit,
        );
        if (fieldValue !== mask.expectedValue) {
            return false;
        }
    }

    return true;
}

/**
 * Fast instruction matching using pre-computed lookup table
 *
 * @param {string} binaryInstruction - The binary instruction string to match
 * @returns {Object|null} The matching instruction object or null if no match found
 */
function findMatchingInstruction(binaryInstruction) {
    const lookupTable = buildInstructionLookupTable();
    if (binaryInstruction.length % WORDSIZE !== 0) {
        throw new Error(
            "Binary instruction length is not a multiple of WORDSIZE",
        );
    }

    const matchingCandidates = [];

    for (const [key, candidates] of lookupTable) {
        const [opcodeValue, startBitStr, stopBitStr] = key.split("_");
        const startBit = parseInt(startBitStr, 10);
        const stopBit = parseInt(stopBitStr, 10);

        // Extract opcode from instruction at the expected position
        // Use the actual startbit and stopbit positions to extract the opcode
        const extractedOpcode = binaryInstruction.slice(
            binaryInstruction.length - startBit - 1,
            binaryInstruction.length - stopBit,
        );

        if (extractedOpcode !== opcodeValue) continue;

        // Calculate opcode bits matched for this candidate
        const opcodeBits = startBit - stopBit + 1;

        // If the opcode matches, check function fields
        for (const candidate of candidates) {
            if (checkCandidateOpcode(candidate, binaryInstruction)) {
                // Calculate total matched bits (opcode + function fields)
                const functionBits = candidate.functionMasks.reduce(
                    (sum, mask) => sum + (mask.startbit - mask.stopbit + 1),
                    0,
                );
                candidate.totalMatchedBits = opcodeBits + functionBits;
                matchingCandidates.push(candidate);
            }
        }
    }

    // If we found matches for this word count, process them
    if (matchingCandidates.length > 0) {
        // If more than one match, handle ambiguity
        if (matchingCandidates.length > 1) {
            // Sort by total matched bits descending (prefer the most specific match)
            matchingCandidates.sort(
                (a, b) => b.totalMatchedBits - a.totalMatchedBits,
            );

            // If the first candidate matches more bits than the second, prefer it
            if (
                matchingCandidates[0].totalMatchedBits >
                matchingCandidates[1].totalMatchedBits
            ) {
                return matchingCandidates[0].instruction;
            }

            // If tied in matched bits, try to decide between enums for exactly 2 candidates
            if (matchingCandidates.length === 2) {
                //              ----- MEGA HACK ALERT -----
                // This is a workaround due to the assembler not supporting
                // optional fields in the signature definition.
                // The way we fix this is by duplicating the instruction
                // in the architecture file. However, this breaks the
                // instruction matching logic since it introduces ambiguity
                // so we need to handle it here.
                const inst1 = matchingCandidates[0].instruction;
                const inst2 = matchingCandidates[1].instruction;

                // Compare fields to see if they only differ in one field having enum type
                const enumPreference = checkEnumFieldPreference(inst1, inst2);
                if (enumPreference !== null) {
                    return enumPreference;
                }
            }

            logger.error(
                `Ambiguous instruction match for opcode (found ${matchingCandidates.length} matches)`,
            );
            return null;
        }

        // Return the single match found
        return matchingCandidates[0].instruction;
    }

    return null;
}

/**
 * Processes all instruction fields and returns an array indexed by field.order.
 * Undefined indices are left as holes (later filtered by the caller).
 * This removes the need to build an intermediate Map and then re-materialize
 * an ordered array.
 *
 * @param {Object} instruction - The instruction definition object
 * @param {string} binaryInstruction - The binary instruction string
 * @returns {Array<string|number|Object>} Array where index == field.order
 */
function processAllFields(instruction, binaryInstruction) {
    // Find the maximum order to size the array minimally once.
    let maxOrder = -1;
    for (const field of instruction.fields) {
        if (
            (field.order || field.type === "co") &&
            (field.order ?? 0) > maxOrder
        ) {
            maxOrder = field.order ?? 0;
        }
    }
    const ordered = new Array(maxOrder + 1);

    for (const field of instruction.fields) {
        // Skip fields without an order unless they are opcode (co)
        if (!field.order && field.type !== "co") continue;

        const value = processInstructionField(
            field,
            binaryInstruction,
            instruction.nwords,
        );

        const targetIndex = field.order || 0;

        if (field.type === "co") {
            ordered[targetIndex] = {
                name: "opcode",
                type: field.type,
                value: instruction.name,
                prettyValue: instruction.name + " ",
            };
        } else if (value !== null) {
            let prettyValue = value;
            let finalValue = value;
            if (typeof value === "number") {
                finalValue = BigInt(value);
            }
            if (field.prefix) prettyValue = field.prefix + prettyValue;
            if (field.suffix) prettyValue += field.suffix;
            prettyValue += field.space === false ? "" : " ";
            ordered[targetIndex] = {
                name: field.name,
                type: field.type,
                value: finalValue,
                prettyValue,
            };
        }
    }
    // before returning, ensure the array is compact (no holes)
    return ordered.filter(item => item !== undefined);
}

/**
 * Decodes a binary instruction from a Uint8Array.
 *
 * @param {string|Uint8Array} toDecode - The instruction to decode  (Uint8Array)
 * @returns {string|Object} Decoded instruction in the requested format
 * @throws {Error} When instruction cannot be decoded or is unknown
 */
export function decode(toDecode) {
    let binaryInstruction;
    if (toDecode instanceof Uint8Array) {
        const bytesPerWord = WORDSIZE / 8;
        const words = [];
        for (let i = 0; i < toDecode.length; i += bytesPerWord) {
            words.push(toDecode.slice(i, i + bytesPerWord));
        }
        words.reverse();
        const reversedBytes = new Uint8Array(words.length * bytesPerWord);
        let index = 0;
        for (const word of words) {
            reversedBytes.set(word, index);
            index += bytesPerWord;
        }
        binaryInstruction = Array.from(reversedBytes)
            .map(byte => byte.toString(2).padStart(8, "0"))
            .join("");
    } else {
        throw new Error("toDecode must be a Uint8Array");
    }

    // Use fast instruction matching
    const matchedInstruction = findMatchingInstruction(binaryInstruction);

    if (!matchedInstruction) {
        const errorValue = `0x${Array.from(toDecode)
            .map(b => b.toString(16).padStart(2, "0"))
            .join("")
            .toUpperCase()}`;
        return {
            status: "error",
            reason: `Illegal Instruction: ${errorValue}`,
        };
    }

    // Get only the relevant bits for this instruction
    const instructionSizeBits = matchedInstruction.nwords * WORDSIZE;
    binaryInstruction = binaryInstruction.slice(
        binaryInstruction.length - instructionSizeBits,
    );

    const instructionArray = processAllFields(
        matchedInstruction,
        binaryInstruction,
    );

    let instructionAssembly = instructionArray
        .filter(x => x !== undefined)
        .map(x => x.prettyValue)
        .join("")
        .trim();

    // If the last character is a comma, remove it.
    // Honestly a hack, but any proper fix would require
    // updating the z80 architecture file (>8k lines)
    if (instructionAssembly.endsWith(",")) {
        instructionAssembly = instructionAssembly.slice(0, -1);
    }

    return {
        status: "ok",
        instruction: matchedInstruction,
        decodedFields: instructionArray,
        assembly: instructionAssembly,
    };
}
