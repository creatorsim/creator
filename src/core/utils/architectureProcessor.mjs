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

import yaml from "js-yaml";
import { validateArchSchema } from "./schema.mts";

export const ARCHITECTURE_VERSION = "2.0";
export let MAXNWORDS;

/**
 * Find the template matching an instruction type
 * @param {Object} architectureObj - The architecture object
 * @param {Object} instruction - The instruction definition
 * @returns {Object|null} - The matching template or null if not found
 */
function findTemplateForInstruction(architectureObj, instruction) {
    const templateType = instruction.template;
    return architectureObj.templates.find(t => t.name === templateType);
}

/**
 * Update an existing field with instruction-specific properties
 * @param {Object} existingField - The template field to update
 * @param {Object} instructionField - The instruction field with override values
 */
function updateExistingField(existingField, instructionField) {
    // Override all properties from instructionField except 'field'
    Object.keys(instructionField).forEach(key => {
        if (key !== "field") {
            existingField[key] = instructionField[key];
        }
    });
}

/**
 * Create a new field from instruction field definition
 * @param {Object} instructionField - The instruction field definition
 * @returns {Object} - The new field object
 */
function createNewField(instructionField) {
    const newField = {
        ...instructionField,
        name: instructionField.field,
    };

    delete newField.field; // Remove the field property after converting
    return newField;
}

/**
 * Merge template fields with instruction-specific fields
 * @param {Object} template - The template object
 * @param {Object} instruction - The instruction definition
 * @returns {Array} - Merged fields array
 */
function mergeTemplateAndInstructionFields(template, instruction) {
    // Start with deep copy of template fields
    const mergedFields = [...template.fields].map(field => ({ ...field })); // All this is to create a deep copy

    // Process instruction fields if they exist
    if (instruction.fields && Array.isArray(instruction.fields)) {
        for (const instructionField of instruction.fields) {
            // Skip null fields
            if (instructionField === null) continue;

            const fieldName = instructionField.field;

            const existingFieldIndex = mergedFields.findIndex(
                field => field.name === fieldName,
            );

            if (existingFieldIndex !== -1) {
                // Update existing field
                updateExistingField(
                    mergedFields[existingFieldIndex],
                    instructionField,
                );
            } else {
                // Add new field
                mergedFields.push(createNewField(instructionField));
            }
            // Remove any null attributes from the merged field (they take precedence over the template)
            for (const key in instructionField) {
                if (instructionField[key] === null) {
                    delete mergedFields[existingFieldIndex][key];
                }
            }
        }
    }

    return mergedFields;
}

/**
 * Build a complete instruction object
 * @param {Object} instruction - The instruction definition
 * @param {Object} template - The template object
 * @param {Array} mergedFields - The merged fields array
 * @returns {Object} - The complete instruction object
 */

function buildCompleteInstruction(instruction, template, mergedFields) {
    // Start with template properties as base
    const result = { ...template };

    // Override with instruction properties (instruction takes precedence)
    Object.assign(result, instruction);

    // Set the specific properties that should always be used
    result.name = instruction.name;
    result.fields = mergedFields;
    result.definition = instruction.definition;
    result.type = instruction.type || "Other";
    result.help = instruction.help ?? "";

    // Collect fields that have an order property
    const orderedFields = mergedFields
        .map((field, i) => ({ index: i, ...field })) // Pair each field with its index and inherit properties
        .filter(field => typeof field.order !== "undefined") // Keep only fields with an 'order' property
        .sort((a, b) => a.order - b.order); // Sort by 'order' property

    // Compute signature_definition - format example: "F0 F4, F3 F2"
    // Each Fx represents the index of the field in the fields array
    const signatureDefParts = orderedFields.map(field => {
        const part = `${field.prefix || ""}F${field.index}${field.suffix || ""}`;
        return field.space === false ? part : part + " ";
    });

    let signatureDefinition = signatureDefParts.join("").trimEnd();
    // If the last character is a comma, remove it
    if (signatureDefinition.endsWith(",")) {
        signatureDefinition = signatureDefinition.slice(0, -1);
    }
    result.signature_definition = signatureDefinition;

    // Compute signature_pretty for instruction - format example: "rd rs2, rs1 imm"
    const signaturePrettyParts = orderedFields.map(field => {
        let fieldName = field.name;
        if (fieldName === "opcode") {
            fieldName = instruction.name;
        } else if (fieldName === "instructionFormatting") {
            fieldName = field.value;
        }
        const part = `${field.prefix || ""}${fieldName}${field.suffix || ""}`;
        return field.space === false ? part : part + " ";
    });

    let signaturePretty = signaturePrettyParts.join("").trimEnd();
    // If the last character is a comma, remove it
    if (signaturePretty.endsWith(",")) {
        signaturePretty = signaturePretty.slice(0, -1);
    }
    result.signature_pretty = signaturePretty;

    // Special case: replace "opcode" field name with instruction name
    const opcodeField = orderedFields.find(field => field.name === "opcode");
    if (opcodeField) {
        result.co = opcodeField.value;
    }

    return result;
}

/**
 * Process instructions and add them to the architecture
 * @param {Object} architectureObj - The architecture object
 * @param {Array} instructions - Array of instruction definitions
 */
// eslint-disable-next-line max-lines-per-function
function processInstructions(architectureObj) {
    architectureObj.instructionsProcessed = [];
    for (const instruction of architectureObj.instructions) {
        const template = findTemplateForInstruction(
            architectureObj,
            instruction,
        );
        if (!template) {
            throw new Error(
                `Template '${instruction.template}' not found for instruction '${instruction.name}'`,
            );
        }
        const mergedFields = mergeTemplateAndInstructionFields(
            template,
            instruction,
        );

        // merge template type and instruction type
        instruction.type = instruction.type || template.type;

        if (instruction.preoperation) {
            instruction.definition =
                "// PREOPERATION\n" +
                instruction.preoperation +
                "\n// DEFINITION\n" +
                instruction.definition;
            delete instruction.preoperation;
        }
        if (instruction.postoperation) {
            instruction.definition =
                instruction.definition +
                "\n// POSTOPERATION\n" +
                instruction.postoperation;
            delete instruction.postoperation;
        }
        // Check to convert (if needed) the "value" property from hex to binary
        for (const field of mergedFields) {
            if (field.value !== undefined) {
                // If the value is a string, it might be in hex format
                if (typeof field.value === "string") {
                    // If it starts with "0x", convert it to binary
                    if (field.value.startsWith("0x")) {
                        const hexValue = field.value.slice(2);
                        const binaryValue = parseInt(hexValue, 16).toString(2);
                        // Pad to maintain the same bit width as the original hex
                        const expectedBitWidth = hexValue.length * 4;
                        field.value = binaryValue.padStart(
                            expectedBitWidth,
                            "0",
                        );
                    }
                }
            }
        }
        // We need to find if any field is optional, because if it is, we need to
        // construct two different instructions, one with the field and one without it

        // This works for 1 optional field, but not for 2 or more. Supporting more
        // than 1 optional field is not in the roadmap.
        const mergedFieldsOriginal = JSON.parse(JSON.stringify(mergedFields));
        const optionalFields = mergedFields.filter(
            field => field.optional === true,
        );
        if (optionalFields.length === 1) {
            // We need to create two instructions, one with the field and one without it
            // Let's first check whether the optional field is of type "enum"

            const optionalField = optionalFields[0];
            if (optionalField.type === "enum") {
                // get the enum_name
                const enumName = optionalField.enum_name;
                // get the enum values from the architecture
                const enumValues = architectureObj.enums[enumName];

                const defaultEnum = enumValues.DEFAULT;
                // if its not undefined...
                if (defaultEnum === undefined) {
                    throw new Error(
                        `Enum '${enumName}' does not have a DEFAULT value. Cannot process instruction '${instruction.name}' with optional field '${optionalField.name}'.`,
                    );
                }
                // Then DEFAULT has the name of the value which contains the default value
                optionalField.value = enumValues[defaultEnum];
                // and convert it to a string, in binary
                optionalField.value = optionalField.value.toString(2);

                delete optionalField.order;
                optionalField.type = "imm-unsigned";
                // remove the optional property
                delete optionalField.optional;

                // Now we can build the instruction with the field
                const instructionWithDefault = buildCompleteInstruction(
                    instruction,
                    template,
                    mergedFields,
                );
                architectureObj.instructionsProcessed.push(
                    instructionWithDefault,
                );
                // And the original instruction for the non default case
                const instructionWithFields = buildCompleteInstruction(
                    instruction,
                    template,
                    mergedFieldsOriginal,
                );
                architectureObj.instructionsProcessed.push(
                    instructionWithFields,
                );
            } else {
                // If the optional field is not an enum, we can just filter out the optional field
                const instructionWithFields = buildCompleteInstruction(
                    instruction,
                    template,
                    mergedFieldsOriginal,
                );
                architectureObj.instructionsProcessed.push(
                    instructionWithFields,
                );
                const instructionWithoutFields = buildCompleteInstruction(
                    instruction,
                    template,
                    mergedFieldsOriginal.filter(
                        field => field.optional !== true,
                    ),
                );
                architectureObj.instructionsProcessed.push(
                    instructionWithoutFields,
                );
            }
        } // If no optional fields, just add the instruction
        else if (optionalFields.length === 0) {
            const fullInstruction = buildCompleteInstruction(
                instruction,
                template,
                mergedFields,
            );
            architectureObj.instructionsProcessed.push(fullInstruction);
        } else {
            throw new Error(
                `Instruction '${instruction.name}' has more than one optional field. This is not supported.`,
            );
        }
    }
    architectureObj.instructions = architectureObj.instructionsProcessed;
    delete architectureObj.instructionsProcessed;
    // If enums exist, for each enum, find whether there's a "DEFAULT" value.
    // If there is, DELETE it
    if (architectureObj.enums) {
        Object.keys(architectureObj.enums).forEach(enumName => {
            const enumValues = architectureObj.enums[enumName];
            if (enumValues.DEFAULT !== undefined) {
                delete enumValues.DEFAULT;
            }
        });
    }
}

function processPseudoInstructions(architectureObj) {
    architectureObj.pseudoinstructionsProcessed = [];
    architectureObj.pseudoinstructions.forEach(pseudoinstruction => {
        let fields = [];

        // Convert new field format to legacy format
        if (
            pseudoinstruction.fields &&
            Array.isArray(pseudoinstruction.fields)
        ) {
            fields = pseudoinstruction.fields.map(field => ({
                name: field.field,
                type: field.type,
                ...(field.prefix && { prefix: field.prefix }),
                ...(field.suffix && { suffix: field.suffix }),
                ...(field.prefix && { prefix: field.prefix }),
                ...(field.suffix && { suffix: field.suffix }),
            }));
        }

        // Create signature_definition: "name F0 F1 F2..."
        const signatureDefParts = [pseudoinstruction.name];
        for (let i = 0; i < fields.length; i++) {
            let part = `F${i}`;
            if (fields[i].prefix) part = fields[i].prefix + part;
            if (fields[i].suffix) part += fields[i].suffix;
            signatureDefParts.push(part);
        }

        // Create signature_pretty: "name field0 field1 field2..."
        const signaturePrettyParts = fields.map(field => {
            const fieldName = field.name;
            const part = `${field.prefix || ""}${fieldName}${field.suffix || ""}`;
            return field.space === false ? part : part + " ";
        });

        let signaturePretty =
            pseudoinstruction.name +
            " " +
            signaturePrettyParts.join("").trimEnd();
        // If the last character is a comma, remove it
        if (signaturePretty.endsWith(",")) {
            signaturePretty = signaturePretty.slice(0, -1);
        }

        // Create the full legacy pseudoinstruction object
        const legacyPseudoinstruction = {
            name: pseudoinstruction.name,
            signature_definition: signatureDefParts.join(" "),
            signature_pretty: signaturePretty,
            properties: [],
            nwords: 1,
            fields,
            definition: pseudoinstruction.definition,
        };

        // Add to architecture
        architectureObj.pseudoinstructionsProcessed.push(
            legacyPseudoinstruction,
        );
    });
    architectureObj.pseudoinstructions =
        architectureObj.pseudoinstructionsProcessed;
    delete architectureObj.pseudoinstructionsProcessed;
}

/**
 * Convert component element values to BigInts
 * @param {Object} architectureObj - The architecture object
 * @returns {Object} - The architecture object with converted values
 */
function convertElementValuesToBigInt(architectureObj) {
    if (!architectureObj.register_files) {
        return architectureObj;
    }

    for (const file of architectureObj.register_files) {
        if (!file.registers) {
            continue;
        }

        for (const element of file.registers) {
            // Convert function using two's complement
            const convert = (x) => BigInt.asUintN(element.nbits, BigInt(x));
            // Convert value to BigInt if it exists and is not already a BigInt
            if (typeof element.value !== "bigint") {
                element.value = convert(element.value);
            }

            // Convert default_value to BigInt if it exists and is not already a BigInt
            if (typeof element.default_value !== "bigint") {
                element.default_value = convert(element.default_value);
            }
        }
    }

    return architectureObj;
}

/**
 * Find any requested ISAs that don't exist in the available sets
 * @param {Array} requestedISAs - The ISAs requested by the user
 * @param {Array} availableInstructionSets - All available instruction sets
 * @returns {Array} - Invalid ISAs that don't exist
 */
function findInvalidISAs(requestedISAs, availableInstructionSets) {
    return requestedISAs.filter(isa => !availableInstructionSets.includes(isa));
}

/**
 * Recursively gather all dependencies of an ISA
 * @param {string} isa - The ISA to gather dependencies for
 * @param {Object} extensions - The extensions object with dependency info
 * @param {Set} requiredISAs - Set to collect all required ISAs
 * @param {Set} visited - Set to track visited ISAs
 */
function gatherDependencies(isa, extensions, requiredISAs, visited) {
    if (visited.has(isa)) return; // Prevent circular dependencies

    visited.add(isa);
    requiredISAs.add(isa);

    // Get dependencies from extension
    const extension = extensions[isa];
    if (extension && extension.implies && Array.isArray(extension.implies)) {
        for (const dependentISA of extension.implies) {
            requiredISAs.add(dependentISA);
            gatherDependencies(dependentISA, extensions, requiredISAs, visited);
        }
    }
}

/**
 * Calculate all required ISAs including dependencies
 * @param {Array} requestedISAs - The ISAs explicitly requested by the user
 * @param {Object} extensions - The extensions object with dependencies
 * @param {string} baseISA - The base ISA
 * @param {Array} availableInstructionSets - All available instruction sets
 * @returns {Object} - Object containing required ISAs and missing dependencies
 */
function calculateRequiredISAs(
    requestedISAs,
    extensions,
    baseISA,
    availableInstructionSets,
) {
    const explicitlyRequestedISAs = new Set(requestedISAs);
    const requiredISAs = new Set(requestedISAs);

    // Always ensure base ISA is included
    requiredISAs.add(baseISA);

    // Gather all dependencies
    const visited = new Set();
    for (const isa of [...requiredISAs]) {
        gatherDependencies(isa, extensions, requiredISAs, visited);
    }

    // Find dependencies that weren't explicitly requested
    const missingDependencies = [...requiredISAs].filter(
        isa => !explicitlyRequestedISAs.has(isa),
    );

    // Check if any required ISAs don't exist in the architecture
    const nonExistentISAs = [...requiredISAs].filter(
        isa => !availableInstructionSets.includes(isa),
    );

    if (nonExistentISAs.length > 0) {
        const message = `There are nonexistent dependencies in the architecture: ${nonExistentISAs.join(
            ", ",
        )}`;
        logger.error(message);
        return {
            requiredISAs: [],
            missingDependencies: [],
            status: "ko",
            message,
        };
    }

    return {
        requiredISAs,
        missingDependencies,
    };
}

/**
 * Find the base ISA from the extensions
 * @param {Object} extensions - The extensions object
 * @returns {string} - The base ISA
 */
function findBaseISA(extensions) {
    let baseISA;

    // Try to find it from the extensions definition
    for (const [name, value] of Object.entries(extensions)) {
        if (value && value.type === "base") {
            baseISA = name;
            break;
        }
    }
    // If not found, raise an error
    if (!baseISA) {
        logger.error("Base ISA not found in the architecture definition.");
        return null;
    }
    return baseISA;
}

/**
 * Determine which instruction sets to load based on user selections
 * @param {Object} architectureObj - The architecture object
 * @param {Array} requestedISAs - User-requested instruction sets to load
 * @returns {Object} - Object with selected ISAs and status
 */

export function determineInstructionSetsToLoad(
    architectureObj,
    requestedISAs = [],
) {
    // Get all available instruction sets in the architecture
    const availableInstructionSets = [
        ...new Set([
            ...Object.keys(architectureObj.instructions || {}),
            ...Object.keys(architectureObj.pseudoinstructions || {}),
        ]),
    ];

    // If no ISAs specified, use all available ones
    if (!requestedISAs || requestedISAs.length === 0) {
        return {
            instructionSets: [...availableInstructionSets],
            status: "ok",
        };
    }

    // Get extensions and find base ISA
    const extensions = architectureObj.extensions || {};

    const baseISA = findBaseISA(extensions);
    if (!baseISA) {
        return {
            instructionSets: [],
            status: "error",
            message: "Base ISA not found in the architecture definition.",
        };
    }

    // Validate all requested ISAs exist
    const invalidISAs = findInvalidISAs(
        requestedISAs,
        availableInstructionSets,
    );
    if (invalidISAs.length > 0) {
        const message = `The following requested ISAs do not exist: ${invalidISAs.join(
            ", ",
        )}`;
        logger.error(message);
        return {
            instructionSets: [],
            status: "error",
            message,
        };
    }

    // Calculate all required ISAs including dependencies
    const { requiredISAs, missingDependencies, status, message } =
        calculateRequiredISAs(
            requestedISAs,
            extensions,
            baseISA,
            availableInstructionSets,
        );
    if (status === "ko") {
        return {
            instructionSets: [],
            status: "error",
            message,
        };
    }

    // Check if any dependencies are missing from the user request
    if (missingDependencies.length > 0) {
        const message = `Missing required dependencies. To use the requested ISA(s), you must also include: ${missingDependencies.join(
            ", ",
        )}`;
        logger.error(message);

        return {
            instructionSets: [],
            status: "error",
            message,
        };
    }

    // Log which ISAs were selected
    logger.info(`Loading ISAs: ${[...requiredISAs].join(", ")}`);

    return {
        instructionSets: [...requiredISAs],
        status: "ok",
    };
}
/**
 * Collect instructions and pseudoinstructions from selected instruction sets
 * @param {Object} architectureObj - The architecture object
 * @param {Array} instructionSetsToLoad - Array of instruction set names to load
 * @returns {Object} - Updated architecture object with collected instructions
 */
export function collectInstructionsFromSets(
    architectureObj,
    instructionSetsToLoad,
) {
    let selectedInstructions = [];
    let selectedPseudoInstructions = [];

    // Process each instruction set
    for (const requestedISA of instructionSetsToLoad) {
        // Add instructions if available for this ISA
        const isaInstructions = architectureObj.instructions[requestedISA];
        if (isaInstructions) {
            selectedInstructions = [
                ...selectedInstructions,
                ...isaInstructions,
            ];
        }
        // Add pseudoinstructions if available for this ISA
        const ISAPseudoInstructions =
            architectureObj.pseudoinstructions?.[requestedISA];
        if (ISAPseudoInstructions) {
            selectedPseudoInstructions = [
                ...selectedPseudoInstructions,
                ...ISAPseudoInstructions,
            ];
        }
    }

    // Create a new architecture object with the updated instructions
    const updatedArchObj = { ...architectureObj };
    updatedArchObj.instructions = selectedInstructions;
    updatedArchObj.pseudoinstructions = selectedPseudoInstructions;

    return updatedArchObj;
}

/**
 * Prepare architecture for use by processing instructions and initializing WASM
 * @param {Object} architectureObj - The architecture object
 * @param {boolean} skipCompiler - Whether to skip initializing the WASM compiler
 * @param {boolean} dump - Whether to dump architecture to file for debugging
 * @returns {Object} - The processed architecture object
 */
export function prepareArchitecture(architectureObj) {
    // Process the selected instructions and pseudoinstructions
    processInstructions(architectureObj);
    processPseudoInstructions(architectureObj);

    // Calculate MAXNWORDS from all processed instructions
    MAXNWORDS = architectureObj.instructions.reduce((max, instruction) => {
        return Math.max(max, instruction.nwords || 1);
    }, 1);

    return architectureObj;
}

/**
 * Check if the architecture version is supported
 * @param {Object} architectureObj - The architecture object
 * @returns {boolean} - True if supported, false otherwise
 */
export function isVersionSupported(architectureObj) {
    const architectureVersion = architectureObj.version;
    const architerctureVersionParts = architectureVersion.split(".");
    const architectureMajor = parseInt(architerctureVersionParts[0], 10);
    const supportedVersionParts = ARCHITECTURE_VERSION.split(".");
    const supportedMajor = parseInt(supportedVersionParts[0], 10);
    if (architectureMajor !== supportedMajor) {
        return false;
    }
    return true;
}

/**
 * Process architecture YAML through all validation and preparation steps
 * @param {string} architectureYaml - YAML string containing architecture definition
 * @param {Array} isa - Array of instruction set names to load
 * @returns {Object} - Result object with processed architecture or error
 */
export function processArchitectureFromYaml(architectureYaml, isa = []) {
    // Parse YAML to object
    let architectureObj;
    try {
        architectureObj = yaml.load(architectureYaml);
        // Convert element values and default_values to BigInts
    } catch (error) {
        logger.error(`Failed to parse architecture YAML: ${error.message}`);
        throw new Error(`Failed to parse architecture YAML: ${error.message}`);
    }

    // validate schema
    if (!validateArchSchema(architectureObj)) {
        return {
            errorcode: "invalid_schema",
            token: "Invalid Schema",
            type: "error",
            update: "",
            status: "ko",
        };
    }

    architectureObj = convertElementValuesToBigInt(architectureObj);

    // Check the version
    if (!isVersionSupported(architectureObj)) {
        return {
            errorcode: "unsupported_version",
            token: "Unsupported architecture version",
            type: "error",
            update: "",
            status: "ko",
        };
    }

    // Determine which instruction sets to load
    const isaResult = determineInstructionSetsToLoad(architectureObj, isa);
    if (isaResult.status === "error") {
        return {
            errorcode: "invalid_isa",
            token: isaResult.message,
            type: "error",
            update: "",
            status: "ko",
        };
    }

    // Collect instructions from selected sets
    const updatedArchObj = collectInstructionsFromSets(
        architectureObj,
        isaResult.instructionSets,
    );

    // Prepare architecture (process instructions, initialize WASM)
    const preparedArchObj = prepareArchitecture(updatedArchObj);

    // Return success with the prepared architecture
    return {
        errorcode: "",
        token: "",
        type: "",
        update: "",
        status: "ok",
        architecture: preparedArchObj,
    };
}
