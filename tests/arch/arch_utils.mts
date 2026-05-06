import { assertSnapshot } from "jsr:@std/testing/snapshot";
import { assertEquals } from "https://deno.land/std/assert/mod.ts";
import * as path from "jsr:@std/path";
import fs from "node:fs";
import {
    executeStep,
    loadArchitecture,
    compileAssembly,
    CompileResult,
} from "../unit/arch/simulator-test-utils.mts";
import { testKeyboard } from "../../src/core/executor/IO.mjs";
import * as creator from "../../src/core/core.mjs";
import { coreEvents, CoreEventTypes } from "../../src/core/events.mts";
import { logger } from "../../src/core/utils/creator_logger.mjs";
import { assembleCreator } from "../../src/core/assembler/creatorAssembler/deno/creatorAssembler.mjs";
import { getCleanErrorMessage } from "../../src/core/assembler/assembler.mjs";

export const ARCH = {
    riscv: "RISCV/RV32IMFD.yml",
    riscv64: "RISCV/RV64IMFD.yml",
    mips: "MIPS32.yml",
    simple8: "simple8.yml",
};

const SNAP_PREFIX = path.fromFileUrl(import.meta.url + "/../../../");

/**
 * Callback to run within a test
 * @param t - Deno context of the test
 * @param file - Name of the assembly file
 * @param testAssembly - Contents of the assembly file
 * @param snapPath - Path in which the snapshot files should be stored
 */
type TestFN = (
    t: Deno.TestContext,
    file: string,
    testAssembly: string,
    snapPath: string,
) => void | Promise<void>;

/**
 * Executes a group of snapshot tests
 * @param archPath - Path to the YAML architecture configuration file, from the architectures folder
 * @param dir - Path to the directory with the assembly files
 * @param prefix - Base prefix of `dir`
 * @param fn - Callback to run within the test
 */
function run_tests(archPath: string, dir: string, prefix: string, fn: TestFN): void {
    logger.disable();
    const ARCH_PATH = "architecture/" + archPath;
    loadArchitecture(ARCH_PATH);
    const DIR = `${prefix}/${dir}`;
    for (const file of fs.globSync("*.s", { cwd: DIR })) {
        Deno.test(`${dir}/${file}`, async t => {
            const testAssembly = fs.readFileSync(`${DIR}/${file}`, "utf8");
            const path = `${SNAP_PREFIX}/tests/arch/__snapshots__/${dir}/${file}.snap`;
            await fn(t, file, testAssembly, path);
        });
    }
}

/**
 * Executes a group of execution snapshot tests
 * @param archPath - Path to the YAML architecture configuration file, from the architectures folder
 * @param dir - Path to the directory with the assembly files
 * @param keyboard - Map of test file name to its corresponding keyboard input. Unspecified files
 * use an empty input
 * @param expect_error - Set of test file names that are expected to throw errors during execution
 * @param library - Whether tests should be executed with a library
 */
export function execution_tests(
    archPath: string,
    dir: string,
    keyboard: Map<string, string[]> = new Map(),
    expect_error: Set<string> = new Set(),
    library: boolean = false,
    prefix: string = "./tests/arch",
): void {
    testKeyboard.enable = true;
    run_tests(archPath, dir, prefix, async (t, file, testAssembly, snapPath) => {
        const errors = expect_error.has(file);
        if (library) {
            const libPath = `${prefix}/${dir}/${file.slice(0, -2)}.yml`;
            const testLib = fs.readFileSync(libPath, "utf8");
            creator.load_library(testLib);
        }

        // Record passing convention errors
        const sentinel_errors: object[] = [];
        coreEvents.on(CoreEventTypes.SENTINEL_ERROR, e =>
            sentinel_errors.push({
                function: e.functionName,
                errors: e.errors.map(e => {
                    return {
                        rule: e.rule,
                        register: e.register?.join(","),
                        message: e.message,
                    };
                }),
            }),
        );

        // Compile code
        await compileAssembly(testAssembly);

        // Setup keyboard input if specified
        testKeyboard.data = keyboard.get(file) || [];

        // Execute code
        let result = { output: "", error: false };
        const instruction_errors: { i: number; error: string }[] = [];
        for (let i = 0; i < 1000; i++) {
            try {
                result = executeStep();
                if (result.error || creator.status.execution_index === -2)
                    break;
            } catch (e) {
                if (errors)
                    instruction_errors.push({
                        i,
                        error: (e as Error).message,
                    });
                else throw e;
            }
        }

        // Save state
        const memory = creator.main_memory
            .getWritten()
            .map(d => [d.addr, d.value])
            .filter(x => x[1] !== 0);

        const registers = creator.REGISTERS.flatMap(r => r.registers)
            .filter(r => r.value !== r.default_value)
            .map(r => [r.name.join(","), "0x" + r.value.toString(16)]);

        const state = {
            error: result.error === false ? false : result.output,
            memory: Object.fromEntries(memory),
            registers: Object.fromEntries(registers),
            display: creator.status.display,
            keyboard: creator.status.keyboard,
            sentinel_errors,
            ...(errors ? { instruction_errors } : {}),
        };

        await assertSnapshot(t, state, { path: snapPath });
        creator.remove_library();
    });
}

/**
 * Executes a group of compiler error snapshot tests
 * @param archPath - Path to the YAML architecture configuration file, from the architectures folder
 * @param dir - Path to the directory with the assembly files
 */
export function compile_error_tests(archPath: string, dir: string): void {
    run_tests(archPath, dir, "./tests/arch", async (t, _, testAssembly, snapPath) => {
        // Compile code
        const res_ansi = (await creator.assembly_compile(
            testAssembly,
            assembleCreator,
            true,
        )) as CompileResult;
        const res_html = (await creator.assembly_compile(
            testAssembly,
            assembleCreator,
            false,
        )) as CompileResult;

        const cleanMsg = getCleanErrorMessage(res_html.msg, false);
        assertEquals(getCleanErrorMessage(res_ansi.msg, true), cleanMsg);
        assertEquals(res_ansi.linter, res_html.linter);
        await assertSnapshot(t, res_html.linter, { path: snapPath });
        await assertSnapshot(t, cleanMsg, { path: snapPath });
        await assertSnapshot(t, res_html.msg, { path: snapPath });
        await assertSnapshot(t, res_ansi.msg, { path: snapPath });
    });
}
