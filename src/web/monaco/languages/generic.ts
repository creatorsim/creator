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

import * as monaco from "monaco-editor";
import {
    generateDefinitionProvider,
    generateReferenceProvider,
    generateDocumentSymbolProvider,
} from "../providers/definitionProvider";

// Type for completion items before range is added
type CompletionItemBase = Omit<monaco.languages.CompletionItem, "range">;

// Type for architecture (from core)
// Using a minimal type to avoid tight coupling
// Supports both YAML format (instructions organized by extension) and loaded format (flat array)
export interface ArchitectureConfig {
    config?: {
        name?: string;
        comment_prefix?: string;
        syntax?: string;
        sensitive_register_name?: boolean;
    };
    register_files?: Array<{
        name?: string;
        registers?: Array<{
            name: string | string[];
            nbits?: number;
            encoding?: number;
        }>;
    }>;
    // Instructions can be either:
    // - A flat array (after processing/loading)
    // - Organized by extension (from YAML)
    instructions?:
        | Array<{
              name?: string;
              type?: string;
              help?: string;
              definition?: string;
              signature_pretty?: string;
              fields?: Array<{
                  name?: string;
                  type?: string;
                  order?: number;
                  prefix?: string;
                  suffix?: string;
                  space?: boolean;
              }>;
          }>
        | Record<
              string,
              Array<{
                  name?: string;
                  type?: string;
                  help?: string;
                  definition?: string;
                  signature_pretty?: string;
                  fields?: Array<{
                      name?: string;
                      type?: string;
                      order?: number;
                      prefix?: string;
                      suffix?: string;
                      space?: boolean;
                  }>;
              }>
          >;
    // Pseudoinstructions have the same structure as instructions
    pseudoinstructions?:
        | Array<{
              name?: string;
              type?: string;
              help?: string;
              definition?: string;
              signature_pretty?: string;
              fields?: Array<{
                  name?: string;
                  type?: string;
                  order?: number;
                  prefix?: string;
                  suffix?: string;
                  space?: boolean;
              }>;
          }>
        | Record<
              string,
              Array<{
                  name?: string;
                  type?: string;
                  help?: string;
                  definition?: string;
                  signature_pretty?: string;
                  fields?: Array<{
                      name?: string;
                      type?: string;
                      order?: number;
                      prefix?: string;
                      suffix?: string;
                      space?: boolean;
                  }>;
              }>
          >;
    directives?: Array<{
        name?: string;
        action?: string;
        size?: number;
    }>;
}

/**
 * Generate Monaco language configuration from architecture
 */
export function generateLanguageConfig(
    architecture: ArchitectureConfig,
): monaco.languages.LanguageConfiguration {
    const commentPrefix = architecture?.config?.comment_prefix || "#";

    return {
        comments: {
            lineComment: commentPrefix,
            blockComment: ["/*", "*/"],
        },
        brackets: [
            ["(", ")"],
            ["[", "]"],
        ],
        autoClosingPairs: [
            { open: "(", close: ")" },
            { open: "[", close: "]" },
            { open: '"', close: '"' },
            { open: "'", close: "'" },
        ],
        surroundingPairs: [
            { open: "(", close: ")" },
            { open: "[", close: "]" },
            { open: '"', close: '"' },
            { open: "'", close: "'" },
        ],
    };
}

/**
 * Extract all register names from architecture register files
 */
function extractRegisterNames(architecture: ArchitectureConfig): string[] {
    const registers: string[] = [];

    if (!architecture?.register_files) {
        return registers;
    }

    for (const file of architecture.register_files) {
        if (!file.registers) continue;

        for (const element of file.registers) {
            // Handle both array and single name formats
            const names = Array.isArray(element.name)
                ? element.name
                : [element.name];
            registers.push(...names);
        }
    }

    return registers;
}

/**
 * Extract all instruction names from architecture (including pseudoinstructions)
 */
function extractInstructionNames(architecture: ArchitectureConfig): string[] {
    const instructions: string[] = [];

    // Helper function to extract from array or record format
    const extractFromInstructionSet = (
        instSet: ArchitectureConfig["instructions"],
    ) => {
        if (!instSet) return;

        if (Array.isArray(instSet)) {
            // Flat array format (loaded/processed architecture)
            for (const inst of instSet) {
                if (inst.name) {
                    instructions.push(inst.name);
                }
            }
        } else {
            // Organized by extension (YAML format)
            for (const key in instSet) {
                if (!Object.hasOwn(instSet, key)) {
                    continue;
                }
                const instList = instSet[key];
                if (Array.isArray(instList)) {
                    for (const inst of instList) {
                        if (inst.name) {
                            instructions.push(inst.name);
                        }
                    }
                }
            }
        }
    };

    // Extract regular instructions
    extractFromInstructionSet(architecture.instructions);

    // Extract pseudoinstructions
    extractFromInstructionSet(architecture.pseudoinstructions);

    return instructions;
}

/**
 * Extract all directive names from architecture
 */
function extractDirectiveNames(architecture: ArchitectureConfig): string[] {
    const directives: string[] = [];

    if (!architecture?.directives) {
        return directives;
    }

    for (const directive of architecture.directives) {
        if (directive.name) {
            directives.push(directive.name);
        }
    }

    return directives;
}

/**
 * Generate Monaco tokens provider (syntax highlighting) from architecture
 */
export function generateTokensProvider(
    architecture: ArchitectureConfig,
): monaco.languages.IMonarchLanguage {
    const registers = extractRegisterNames(architecture);
    const instructions = extractInstructionNames(architecture);
    const directives = extractDirectiveNames(architecture);
    const commentPrefix = architecture?.config?.comment_prefix || "#";

    // Escape special regex characters in comment prefix
    const escapedCommentPrefix = commentPrefix.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
    );

    return {
        defaultToken: "",
        tokenPostfix: `.${architecture?.config?.syntax || "asm"}`,
        ignoreCase: !architecture?.config?.sensitive_register_name,

        registers,
        instructions,
        directives,

        tokenizer: {
            root: [
                // Comments
                [new RegExp(escapedCommentPrefix + ".*$"), "comment"],
                [/\/\*/, "comment", "@comment"],

                // Labels (anything followed by a colon)
                [/^\s*[a-zA-Z_][a-zA-Z0-9_]*:/, "type.identifier"],

                // Directives (start with .)
                [
                    /\.[a-zA-Z_][a-zA-Z0-9_]*/,
                    {
                        cases: {
                            "@directives": "keyword.directive",
                            "@default": "keyword",
                        },
                    },
                ],

                // Register patterns (numeric like x0-x31, f0-f31, r0-r31, etc.)
                [/[a-zA-Z][0-9]{1,2}\b/, "variable.predefined"],

                // Instructions and named registers
                [
                    /[a-zA-Z_][a-zA-Z0-9_.']*/,
                    {
                        cases: {
                            "@instructions": "keyword",
                            "@registers": "variable.predefined",
                            "@default": "identifier",
                        },
                    },
                ],

                // Numbers (hex, binary, decimal)
                [/0[xX][0-9a-fA-F]+/, "number.hex"],
                [/0[bB][01]+/, "number.binary"],
                [/-?\d+/, "number"],

                // Strings
                [/"([^"\\]|\\.)*$/, "string.invalid"], // non-terminated string
                [/'([^'\\]|\\.)*$/, "string.invalid"], // non-terminated string
                [/"/, "string", "@string_double"],
                [/'/, "string", "@string_single"],

                // Delimiters and operators
                [/[()[\]]/, "@brackets"],
                [/[,:]/, "delimiter"],
                [/[+\-*/]/, "operator"],

                // Whitespace
                [/[ \t\r\n]+/, ""],
            ],

            comment: [
                [/[^/*]+/, "comment"],
                [/\*\//, "comment", "@pop"],
                [/[/*]/, "comment"],
            ],

            string_double: [
                [/[^\\"]+/, "string"],
                [/\\./, "string.escape"],
                [/"/, "string", "@pop"],
            ],

            string_single: [
                [/[^\\']+/, "string"],
                [/\\./, "string.escape"],
                [/'/, "string", "@pop"],
            ],
        },
    };
}

/**
 * Generate register completions from architecture register files
 */
function generateRegisterCompletions(
    architecture: ArchitectureConfig,
): CompletionItemBase[] {
    const completions: CompletionItemBase[] = [];

    if (!architecture?.register_files) {
        return completions;
    }

    for (const file of architecture.register_files) {
        if (!file.registers) continue;

        const fileName = file.name || "Register";

        for (const element of file.registers) {
            const names = Array.isArray(element.name)
                ? element.name
                : [element.name];
            const aliases = names.slice(1);

            // Create a detail string with register type and aliases
            let detail = `${fileName}`;
            if (element.encoding !== undefined) {
                detail += ` (${element.encoding})`;
            }
            if (aliases.length > 0) {
                detail += ` - aliases: ${aliases.join(", ")}`;
            }

            // Add completion for each name
            for (const name of names) {
                completions.push({
                    label: name,
                    kind: monaco.languages.CompletionItemKind.Variable,
                    insertText: name,
                    detail,
                    documentation: `${element.nbits}-bit register`,
                });
            }
        }
    }

    return completions;
}

/**
 * Generate parameter format string from instruction fields
 * Builds a human-readable parameter list showing what comes after the instruction
 * Example: fields with order [opcode, rd, rs1, imm] -> "rd, rs1, imm"
 */
function generateParameterFormat(
    fields?: Array<{
        name?: string;
        type?: string;
        order?: number;
        prefix?: string;
        suffix?: string;
        space?: boolean;
    }>,
): string {
    if (!fields || fields.length === 0) {
        return "";
    }

    // Filter and sort fields by order (same as architectureProcessor.mjs)
    const orderedFields = fields
        .filter(field => typeof field.order !== "undefined")
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (orderedFields.length === 0) {
        return "";
    }

    const paramParts: string[] = [];

    for (const field of orderedFields) {
        const fieldName = field.name || "";

        // Skip opcode field - we only want parameters
        if (
            fieldName === "opcode" ||
            field.type === "co" ||
            field.type === "cop"
        ) {
            continue;
        }

        const prefix = field.prefix || "";
        const suffix = field.suffix || "";

        // Build the parameter representation
        const part = `${prefix}${fieldName}${suffix}`;

        // Add space if needed (field.space !== false)
        const partWithSpace = field.space !== false ? part + " " : part;

        paramParts.push(partWithSpace);
    }

    let params = paramParts.join("").trimEnd();

    // If the last character is a comma, remove it (same as architectureProcessor.mjs)
    if (params.endsWith(",")) {
        params = params.slice(0, -1);
    }

    return params;
}

/**
 * Generate instruction completions from architecture instructions (including pseudoinstructions)
 */
function generateInstructionCompletions(
    architecture: ArchitectureConfig,
): CompletionItemBase[] {
    const completions: CompletionItemBase[] = [];

    // Helper function to process instruction set (works for both instructions and pseudoinstructions)
    const processInstructionSet = (
        instSet: ArchitectureConfig["instructions"],
        isPseudo: boolean = false,
    ) => {
        if (!instSet) return;

        const kindSuffix = isPseudo ? " (pseudo)" : "";

        if (Array.isArray(instSet)) {
            // Flat array format (loaded/processed architecture)
            for (const inst of instSet) {
                if (!inst.name) continue;

                // Generate parameter format string
                const paramFormat = generateParameterFormat(inst.fields);
                const labelWithParams = paramFormat
                    ? `${inst.name} ${paramFormat}`
                    : inst.name;

                const detail = (inst.type || "Instruction") + kindSuffix;
                const documentation = inst.help || inst.definition || "";

                completions.push({
                    label: labelWithParams,
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: inst.name,
                    detail,
                    documentation,
                });
            }
        } else {
            // Organized by extension (YAML format)
            for (const extensionKey in instSet) {
                if (!Object.hasOwn(instSet, extensionKey)) {
                    continue;
                }
                const instList = instSet[extensionKey];
                if (!Array.isArray(instList)) continue;

                for (const inst of instList) {
                    if (!inst.name) continue;

                    // Generate parameter format string
                    const paramFormat = generateParameterFormat(inst.fields);
                    const labelWithParams = paramFormat
                        ? `${inst.name} ${paramFormat}`
                        : inst.name;

                    const detail = (inst.type || "Instruction") + kindSuffix;
                    const documentation = inst.help || inst.definition || "";

                    completions.push({
                        label: labelWithParams,
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: inst.name,
                        detail,
                        documentation,
                    });
                }
            }
        }
    };

    // Process regular instructions
    processInstructionSet(architecture.instructions, false);

    // Process pseudoinstructions
    processInstructionSet(architecture.pseudoinstructions, true);

    return completions;
}

/**
 * Generate directive completions from architecture directives
 */
function generateDirectiveCompletions(
    architecture: ArchitectureConfig,
): CompletionItemBase[] {
    const completions: CompletionItemBase[] = [];

    if (!architecture?.directives) {
        return completions;
    }

    for (const directive of architecture.directives) {
        if (!directive.name) continue;

        const detail = directive.action || "Directive";
        const sizeInfo = directive.size
            ? ` (${directive.size} byte${directive.size !== 1 ? "s" : ""})`
            : "";

        completions.push({
            label: directive.name,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: directive.name,
            detail: detail + sizeInfo,
        });
    }

    return completions;
}

/**
 * Generate completion provider from architecture
 */
export function generateCompletionProvider(
    architecture: ArchitectureConfig,
): monaco.languages.CompletionItemProvider {
    const registerCompletions = generateRegisterCompletions(architecture);
    const instructionCompletions = generateInstructionCompletions(architecture);
    const directiveCompletions = generateDirectiveCompletions(architecture);

    return {
        provideCompletionItems: (model, position) => {
            const textUntilPosition = model.getValueInRange({
                startLineNumber: position.lineNumber,
                startColumn: 1,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
            });

            // Get the word being typed
            const word = model.getWordUntilPosition(position);

            // If the character before the word is a dot, include it in the range
            // to prevent double dots when autocompleting directives
            let startColumn = word.startColumn;
            if (
                startColumn > 1 &&
                model.getLineContent(position.lineNumber)[startColumn - 2] ===
                    "."
            ) {
                startColumn--;
            }

            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: startColumn,
                endColumn: word.endColumn,
            };

            // Determine what kind of completion to provide based on context
            const trimmed = textUntilPosition.trim();

            // If line starts with a dot or period, suggest directives
            if (trimmed.startsWith(".")) {
                return {
                    suggestions: directiveCompletions.map(item => ({
                        ...item,
                        range,
                    })),
                };
            }

            // If we're at the start of a line or after a label, suggest instructions
            if (trimmed === "" || trimmed.endsWith(":")) {
                return {
                    suggestions: instructionCompletions.map(item => ({
                        ...item,
                        range,
                    })),
                };
            }

            // Otherwise, provide all completions
            return {
                suggestions: [
                    ...instructionCompletions,
                    ...directiveCompletions,
                    ...registerCompletions,
                ].map(item => ({ ...item, range })),
            };
        },
    };
}

/**
 * Generate hover provider from architecture
 * Shows detailed information when hovering over instructions
 */
export function generateHoverProvider(
    architecture: ArchitectureConfig,
): monaco.languages.HoverProvider {
    // Build a lookup map for fast instruction lookup
    const instructionMap = new Map<
        string,
        {
            name: string;
            type?: string;
            help?: string;
            definition?: string;
            fields?: Array<{
                name?: string;
                type?: string;
                order?: number;
                prefix?: string;
                suffix?: string;
                space?: boolean;
            }>;
            isPseudo: boolean;
        }
    >();

    // Helper to add instructions to the map
    const addInstructionsToMap = (
        instSet: ArchitectureConfig["instructions"],
        isPseudo: boolean = false,
    ) => {
        if (!instSet) return;

        if (Array.isArray(instSet)) {
            // Flat array format
            for (const inst of instSet) {
                if (inst.name) {
                    instructionMap.set(inst.name.toLowerCase(), {
                        name: inst.name,
                        type: inst.type,
                        help: inst.help,
                        definition: inst.definition,
                        fields: inst.fields,
                        isPseudo,
                    });
                }
            }
        } else {
            // Organized by extension
            for (const extensionKey in instSet) {
                if (!Object.hasOwn(instSet, extensionKey)) continue;
                const instList = instSet[extensionKey];
                if (!Array.isArray(instList)) continue;

                for (const inst of instList) {
                    if (inst.name) {
                        instructionMap.set(inst.name.toLowerCase(), {
                            name: inst.name,
                            type: inst.type,
                            help: inst.help,
                            definition: inst.definition,
                            fields: inst.fields,
                            isPseudo,
                        });
                    }
                }
            }
        }
    };

    // Build the instruction map
    addInstructionsToMap(architecture.instructions, false);
    addInstructionsToMap(architecture.pseudoinstructions, true);

    return {
        provideHover: (model, position) => {
            // Get the word at the current position
            const word = model.getWordAtPosition(position);
            if (!word) return null;

            const wordText = word.word.toLowerCase();
            const instruction = instructionMap.get(wordText);

            if (!instruction) return null;

            // Build the hover content
            const contents: monaco.IMarkdownString[] = [];

            // Title with instruction name and type
            const pseudoTag = instruction.isPseudo
                ? " *(pseudoinstruction)*"
                : "";
            const typeInfo = instruction.type ? ` - ${instruction.type}` : "";
            contents.push({
                value: `**${instruction.name}**${typeInfo}${pseudoTag}`,
            });

            // Syntax (parameter format)
            const paramFormat = generateParameterFormat(instruction.fields);
            if (paramFormat) {
                contents.push({
                    value: `**Syntax:** \`${instruction.name} ${paramFormat}\``,
                });
            }

            // Help text
            if (instruction.help) {
                contents.push({
                    value: instruction.help,
                });
            }

            return {
                contents,
                range: new monaco.Range(
                    position.lineNumber,
                    word.startColumn,
                    position.lineNumber,
                    word.endColumn,
                ),
            };
        },
    };
}

/**
 * Generate complete language definition from architecture
 */
export function generateLanguageDefinition(architecture: ArchitectureConfig) {
    return {
        config: generateLanguageConfig(architecture),
        tokensProvider: generateTokensProvider(architecture),
        completionProvider: generateCompletionProvider(architecture),
        hoverProvider: generateHoverProvider(architecture),
        definitionProvider: generateDefinitionProvider(),
        referenceProvider: generateReferenceProvider(),
        documentSymbolProvider: generateDocumentSymbolProvider(),
    };
}
