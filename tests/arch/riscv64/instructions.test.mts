import { ARCH, execution_tests } from "../arch_utils.mts";

const long_str =
    "This is a very long string with many characters and a lot of data. :) 123\n";

execution_tests(ARCH.riscv64, "riscv64");
execution_tests(
    ARCH.riscv64,
    "examples/RISCV-64",
    new Map([
        ["example9.s", ["123\n", "456\n"]],
        ["example10.s", [long_str.length + "\n", long_str]],
    ]),
    undefined,
    undefined,
    ".",
);
execution_tests(
    ARCH.riscv64,
    "examples/RISCV-64-devices",
    new Map([["example1.s", [long_str.length + "\n", long_str]]]),
    undefined,
    undefined,
    ".",
);
execution_tests(
    ARCH.riscv64,
    "examples/RISCV-64-interrupts",
    undefined,
    undefined,
    undefined,
    ".",
);
