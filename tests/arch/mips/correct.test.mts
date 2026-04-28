import { ARCH, execution_tests } from "../arch_utils.mts";

const long_str =
    "This is a very long string with many characters and a lot of data. :) 123\n";

execution_tests(
    ARCH.mips,
    "mips/correct/examples",
    new Map([
        ["test_mips_example_009.s", ["123\n", "456\n"]],
        ["test_mips_example_010.s", [long_str.length + "\n", long_str]],
        ["test_mips_example_017.s", ["String in UTF-8: ∀ ∫ ∇ ∈ 🠬\n"]],
    ]),
);
execution_tests(
    ARCH.mips,
    "mips/correct/libraries",
    undefined,
    undefined,
    true,
);
execution_tests(
    ARCH.mips,
    "mips/correct/syscalls",
    new Map([
        ["test_mips_syscall_005.s", ["1234567\n"]],
        ["test_mips_syscall_006.s", ["1.234567\n"]],
        ["test_mips_syscall_007.s", ["1.234567890123456\n"]],
        ["test_mips_syscall_008.s", ["This is a long string\n"]],
        ["test_mips_syscall_012.s", ["a\n"]],
    ]),
);
execution_tests(
    ARCH.mips,
    "examples/MIPS-32",
    new Map([
        ["example9.s", ["123\n", "456\n"]],
        ["example10.s", [long_str.length + "\n", long_str]],
    ]),
    undefined,
    undefined,
    ".",
);
