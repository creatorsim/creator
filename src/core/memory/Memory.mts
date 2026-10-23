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

/**
 *
 * This class provides a comprehensive memory simulation that supports:
 * - Custom byte sizes (1-32 bits per byte)
 * - Custom word sizes (any number of bytes)
 * - Flexible endianness configuration
 * - Efficient bit-level storage
 * - Word-level and byte-level operations
 * - Memory layout segments (text, data, stack, etc.)
 *
 * ## Key Concepts
 *
 * ### Custom Byte Sizes
 * This class allows configuring any byte size from 1 to 32 bits.
 *
 * ### Endianness Configuration
 * Endianness determines the order of bytes within words. Rather than just
 * supporting little-endian and big-endian, this class allows completely
 * custom byte ordering within words.
 *
 * The endianness array specifies which memory position should be used for each word position:
 * - `[0, 1, 2, 3]` = big-endian (word pos 0 from mem pos 0, word pos 1 from mem pos 1, etc.)
 * - `[3, 2, 1, 0]` = little-endian (word pos 0 from mem pos 3, word pos 1 from mem pos 2, etc.)
 * - `[1, 0, 3, 2]` = mixed endianness (word pos 0 from mem pos 1, word pos 1 from mem pos 0, etc.)
 *
 * ### Memory Layout vs Logical Structure
 * - **Physical Layout**: How bytes are actually stored in memory (affected by endianness)
 * - **Logical Structure**: How the word is represented in the program (unaffected by endianness)
 *
 * Word operations (readWord/writeWord) work with logical structure, while
 * individual byte operations (read/write) work with physical layout.
 *
 * ### Memory Layout Segments
 * The memory system supports architectural memory layout with named segments:
 * - **Text Segment**: Contains executable instructions
 * - **Data Segment**: Contains initialized data
 * - **Stack Segment**: Contains runtime stack
 * - **Custom Segments**: Architecture-specific segments
 *
 * Each segment has start and end addresses, and the memory system can validate
 * and track access to different segments.
 *
 * ### Bit Packing
 * When using non-8-bit bytes, the class efficiently packs multiple custom bytes
 * into standard 8-bit storage bytes. For example, four 6-bit bytes (24 bits total)
 * are packed into three 8-bit storage bytes.
 *
 * ## Usage Examples
 *
 * @example Basic 8-bit byte memory
 * ```typescript
 * const memory = new Memory({ sizeInBytes: 1024 }); // 1024 bytes, 8 bits per byte
 * memory.write(0n, 0xFF);
 * console.log(memory.read(0n)); // 255
 * ```
 *
 * @example Custom byte size memory
 * ```typescript
 * const memory = new Memory({ sizeInBytes: 100, bitsPerByte: 12 }); // 100 12-bit "bytes", max value 4095
 * memory.write(0n, 4095);
 * console.log(memory.read(0n)); // 4095
 * ```
 *
 * @example Memory with layout segments
 * ```typescript
 * const layout = new Map([
 *   { "text", { start: 0x0000, end: 0x1000 } },
 *   { "data", { start: 0x1010, end: 0x2000 } },
 *   { "stack", { start: 0xFFFE, end: 0xFFFF } },
 * ]);
 * const memory = new Memory({ sizeInBytes: 0x10000, memoryLayout: layout });
 * console.log(memory.getSegmentForAddress(0x0500)); // "text"
 * console.log(memory.isValidAccess(0x0500, "text")); // true
 * ```
 *
 * @example Word operations with endianness
 * ```typescript
 * // 4-byte words with big-endian ordering
 * const memory = new Memory({ sizeInBytes: 100, bitsPerByte: 8, wordSize: 4, endianness: [3, 2, 1, 0] });
 * const word = [0x12, 0x34, 0x56, 0x78];
 * memory.writeWord(0n, word);
 *
 * // Memory layout: [0x78, 0x56, 0x34, 0x12] (reversed)
 * console.log(memory.read(0n)); // 0x78
 * console.log(memory.read(1n)); // 0x56
 *
 * // But readWord returns original order: [0x12, 0x34, 0x56, 0x78]
 * console.log(memory.readWord(0n)); // [0x12, 0x34, 0x56, 0x78]
 * ```
 *
 * @example Mixed operations
 * ```typescript
 * const memory = new Memory({ sizeInBytes: 100, bitsPerByte: 8, wordSize: 4 });
 *
 * // Write word, read individual bytes
 * memory.writeWord(0n, [0xAA, 0xBB, 0xCC, 0xDD]);
 * console.log(memory.read(1n)); // 0xBB
 *
 * // Write individual bytes, read as word
 * memory.write(10n, 0x11);
 * memory.write(11n, 0x22);
 * memory.write(12n, 0x33);
 * memory.write(13n, 0x44);
 * console.log(memory.readWord(10n)); // [0x11, 0x22, 0x33, 0x44]
 * ```
 *
 * ## Performance Considerations
 *
 * - 8-bit byte operations use fast path with direct array access
 * - Custom byte sizes require bit manipulation
 * - Word operations are optimized for the configured endianness
 * - Memory dumps/restores are very fast using direct buffer copying
 * - Segment lookups are optimized with caching for frequent access patterns
 */

/**
 * Interface for processed memory segment information
 */
interface MemorySegment {
    start: number; // Parsed start address
    end: number; // Parsed end address
    size: bigint;
}

/**
 * Interface for memory hints
 */
interface MemoryHint {
    address: bigint;
    tag: string[];
    type: string;
    sizeInBits?: number; // Optional size of the type in bits
    value?: number; // Optional value associated with the hint
}

// /**
//  * Configuration options for Memory constructor
//  */
// interface MemoryConfig {
//     sizeInBytes: number;
//     bitsPerByte?: number;
//     wordSize?: number;
//     endianness?: number[];
//     memoryLayout?: Map<string, MemorySegment>;
//     baseAddress?: bigint;
// }

export interface MemoryBackup {
    addresses: number[];
    values: number[];
    bitsPerByte: number;
    size: number;
    hints: {
        address: string;
        tag: string[];
        type: string;
        sizeInBits?: number;
        value?: number;
    }[];
}

export class Memory {
    /** Total number of addressable units (bytes) in memory */
    private size!: number;

    /** Number of bits per addressable unit (byte). Range: 1-32 bits */
    private bitsPerByte!: number;

    /** Maximum value that can be stored in a single byte */
    private maxByteValue!: number;

    /** Underlying storage buffer using standard 8-bit bytes */
    private buffer!: ArrayBuffer;

    /** Typed array view for efficient access to the buffer */
    private uint8View!: Uint8Array;

    /** Number of bytes that constitute a word */
    private wordSize!: number;

    /**
     * Endianness configuration array.
     * endianness[i] specifies which memory position should be used for word position i.
     *
     * Examples:
     * - [0, 1, 2, 3] = big-endian
     * - [3, 2, 1, 0] = little-endian (default)
     * - [1, 0, 3, 2] = mixed/custom endianness
     */
    private endianness!: number[];

    /** Base address offset for memory addressing */
    private baseAddress!: bigint;

    /** Memory segments */
    private memoryLayout!: Map<string, MemorySegment>;

    /** Cache for segment lookups to improve performance */
    private segmentCache!: Map<bigint, string>;

    /** Map of memory hints: address -> hint information */
    private hints!: Map<bigint, MemoryHint>;

    /** Set of addresses that have been written to (for sparse memory serialization) */
    private writtenAddresses!: Set<number>;

    /**
     * Creates a new Memory instance with configurable byte size, word size, endianness, and memory layout.
     *
     * The memory uses efficient bit-packing when bitsPerByte != 8, storing multiple
     * custom bytes within standard 8-bit storage bytes.
     *
     * @param config - Configuration object containing memory parameters
     * @param config.sizeInBytes - Total number of addressable units (bytes) in memory
     * @param config.bitsPerByte - Number of bits per addressable unit (1-32). Default: 8
     * @param config.wordSize - Number of bytes that constitute a word. Default: 4
     * @param config.endianness - Optional array specifying memory position for each word position.
     *                           endianness[i] = memory position for word position i.
     *                           Must contain all indices 0 to wordSize-1 exactly once.
     *                           Default: little-endian [3, 2, 1, 0] for 4-byte words
     * @param config.memoryLayout - Optional array of memory layout segments from architecture
     * @param config.baseAddress - Optional base address offset for memory addressing. Default: 0
     *
     * @throws Error if bitsPerByte is not in range 1-32
     * @throws Error if wordSize is less than 1
     * @throws Error if endianness array length doesn't match wordSize
     * @throws Error if endianness array doesn't contain valid indices
     * @throws Error if memory layout segments are invalid
     *
     * @example Standard 8-bit memory
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 1024 }); // 1KB memory
     * ```
     *
     * @example 12-bit bytes with big-endian words
     * ```typescript
     * const memory = new Memory({
     *   sizeInBytes: 256,
     *   bitsPerByte: 12,
     *   wordSize: 4,
     *   endianness: [0, 1, 2, 3]
     * });
     * ```
     *
     * @example Memory with layout segments
     * ```typescript
     * const layout = new Map([
     *   [ "text",  { start: 0x0000, end: 0x1000 } ],
     *   [ "data",  { start: 0x1010, end: 0x2000 } ],
     *   [ "stack", { start: 0xFFFF, end: 0xFFFF } ],
     * ]);
     * const memory = new Memory({
     *   sizeInBytes: 0x10000,
     *   memoryLayout: layout,
     *   baseAddress: 0n
     * });
     * ```
     */
    constructor({
        sizeInBytes,
        bitsPerByte = 8,
        wordSize = 4,
        endianness,
        memoryLayout = new Map(),
        baseAddress = 0n,
    }: {
        sizeInBytes: number;
        bitsPerByte?: number;
        wordSize?: number;
        endianness: number[];
        memoryLayout?: Map<string, MemorySegment>;
        baseAddress?: bigint;
    }) {
        // Apply defaults to config

        // Initialize basic properties
        if (!Number.isSafeInteger(sizeInBytes) || sizeInBytes <= 0) {
            throw new Error(
                "sizeInBytes must be a positive safe integer (<= Number.MAX_SAFE_INTEGER)",
            );
        }
        if (bitsPerByte < 1 || bitsPerByte > 32) {
            throw new Error("bitsPerByte must be between 1 and 32");
        }

        if (wordSize < 1) {
            throw new Error("wordSize must be at least 1");
        }

        this.size = sizeInBytes;
        this.bitsPerByte = bitsPerByte;
        this.maxByteValue =
            bitsPerByte === 32 ? 0xffffffff : (1 << bitsPerByte) - 1;
        this.wordSize = wordSize;
        this.baseAddress = baseAddress;

        // Initialize endianness
        if (endianness) {
            if (endianness.length !== wordSize) {
                throw new Error(
                    `Endianness array length (${endianness.length}) must match word size (${wordSize})`,
                );
            }

            // Validate endianness array contains valid byte indices
            const sortedEndianness = [...endianness].sort();
            for (let i = 0; i < wordSize; i++) {
                if (sortedEndianness[i] !== i) {
                    throw new Error(
                        `Endianness array must contain all indices 0 to ${wordSize - 1} exactly once`,
                    );
                }
            }

            this.endianness = [...endianness];
        } else {
            // Default little-endian (LSB at lowest address)
            this.endianness = Array.from(
                { length: wordSize },
                (_, i) => wordSize - 1 - i,
            );
        }

        // Initialize memory layout and segments
        this.memoryLayout = new Map(memoryLayout);
        this.segmentCache = new Map();

        // Initialize hints system
        this.hints = new Map();

        // Initialize written addresses tracking for sparse memory
        this.writtenAddresses = new Set();

        // Initialize storage buffer
        // Calculate storage needed: we need enough 8-bit bytes to store all the custom bytes
        const bitsNeeded = sizeInBytes * bitsPerByte;
        const storageBytes = Math.ceil(bitsNeeded / 8);

        this.buffer = new ArrayBuffer(storageBytes);
        this.uint8View = new Uint8Array(this.buffer);

        this.uint8View.fill(0);
    }

    /**
     * Clears all memory by setting every byte to zero.
     * This operation preserves the memory configuration (size, word size, endianness).
     */
    zeroOut(): void {
        this.uint8View.fill(0);
    }

    /**
     * Gets the index of the address within the memory
     *
     * @param address - Memory address to use
     * @returns Index of the address within the memory
     * @throws Error if the address is outside of the range of the memory
     */
    getIndex(address: bigint): number {
        if (address < this.baseAddress) {
            throw new Error(
                `Address ${address} is below base address ${this.baseAddress}`,
            );
        }

        const addrIndex = Number(address - this.baseAddress);
        if (addrIndex >= this.size) {
            throw new Error(
                `Address ${addrIndex} exceeds memory size ${this.size} (+${this.baseAddress})`,
            );
        }

        return addrIndex;
    }

    /**
     * Reads a single byte from memory at the specified address.
     *
     * For custom byte sizes (bitsPerByte != 8), this method handles bit-level
     * extraction from the underlying 8-bit storage, including cases where
     * the custom byte spans multiple storage bytes.
     *
     * @param address - Memory address to read from (0-based)
     * @returns The byte value (0 to maxByteValue)
     *
     * @throws Error if address exceeds memory size
     *
     * @example Reading from 8-bit memory
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 100 });
     * memory.write(5n, 255);
     * console.log(memory.read(5n)); // 255
     * ```
     *
     * @example Reading from 12-bit memory
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 100, bitsPerByte: 12 });
     * memory.write(3n, 4095); // Max 12-bit value
     * console.log(memory.read(3n)); // 4095
     * ```
     */
    read(address: bigint): number {
        const addrIndex = this.getIndex(address);

        if (this.bitsPerByte === 8) {
            return this.uint8View[addrIndex]!;
        }

        const bitOffset = addrIndex * this.bitsPerByte;
        const byteIndex = Math.floor(bitOffset / 8);
        const bitIndex = bitOffset % 8;

        if (this.bitsPerByte <= 8 - bitIndex) {
            // Value fits within a single storage byte
            const mask = this.maxByteValue << (8 - bitIndex - this.bitsPerByte);
            return (
                (this.uint8View[byteIndex]! & mask) >>>
                (8 - bitIndex - this.bitsPerByte)
            );
        } else {
            // Value spans multiple storage bytes
            let value = 0;
            let remainingBits = this.bitsPerByte;
            let currentByteIndex = byteIndex;
            let currentBitIndex = bitIndex;

            while (remainingBits > 0) {
                const bitsFromThisByte = Math.min(
                    remainingBits,
                    8 - currentBitIndex,
                );
                const mask =
                    ((1 << bitsFromThisByte) - 1) <<
                    (8 - currentBitIndex - bitsFromThisByte);
                const bits =
                    (this.uint8View[currentByteIndex]! & mask) >>>
                    (8 - currentBitIndex - bitsFromThisByte);

                value = (value << bitsFromThisByte) | bits;
                remainingBits -= bitsFromThisByte;
                currentByteIndex++;
                currentBitIndex = 0;
            }

            return value;
        }
    }

    /**
     * Writes a single byte to memory at the specified address.
     *
     * For custom byte sizes (bitsPerByte != 8), this method handles bit-level
     * packing into the underlying 8-bit storage, including cases where
     * the custom byte spans multiple storage bytes.
     *
     * @param address - Memory address to write to (0-based)
     * @param value - Byte value to write (0 to maxByteValue)
     *
     * @throws Error if address exceeds memory size
     * @throws Error if value exceeds maxByteValue or is negative
     *
     * @example Writing to 8-bit memory
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 100 });
     * memory.write(10n, 128);
     * ```
     *
     * @example Writing to 4-bit memory
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 100, bitsPerByte: 4 });
     * memory.write(0n, 15); // Max 4-bit value
     * // memory.write(0n, 16); // Would throw error
     * ```
     */
    write(address: bigint, value: number): void {
        const addrIndex = this.getIndex(address);

        if (value > this.maxByteValue || value < 0) {
            throw new Error(
                `Value ${value} exceeds byte size (max: ${this.maxByteValue})`,
            );
        }

        // Track this address as written
        this.writtenAddresses.add(Number(address));

        if (this.bitsPerByte === 8) {
            this.uint8View[addrIndex] = value;
            return;
        }

        const bitOffset = addrIndex * this.bitsPerByte;
        const byteIndex = Math.floor(bitOffset / 8);
        const bitIndex = bitOffset % 8;

        if (this.bitsPerByte <= 8 - bitIndex) {
            // Value fits within a single storage byte
            const mask = this.maxByteValue << (8 - bitIndex - this.bitsPerByte);
            this.uint8View[byteIndex] =
                (this.uint8View[byteIndex]! & ~mask) |
                (value << (8 - bitIndex - this.bitsPerByte));
        } else {
            // Value spans multiple storage bytes
            let remainingBits = this.bitsPerByte;
            let currentByteIndex = byteIndex;
            let currentBitIndex = bitIndex;
            let remainingValue = value;

            while (remainingBits > 0) {
                const bitsForThisByte = Math.min(
                    remainingBits,
                    8 - currentBitIndex,
                );
                const shift = remainingBits - bitsForThisByte;
                const bits =
                    (remainingValue >>> shift) & ((1 << bitsForThisByte) - 1);
                const mask =
                    ((1 << bitsForThisByte) - 1) <<
                    (8 - currentBitIndex - bitsForThisByte);

                this.uint8View[currentByteIndex] =
                    (this.uint8View[currentByteIndex]! & ~mask) |
                    (bits << (8 - currentBitIndex - bitsForThisByte));

                remainingValue &= (1 << shift) - 1;
                remainingBits -= bitsForThisByte;
                currentByteIndex++;
                currentBitIndex = 0;
            }
        }
    }

    /**
     * Extends a memory segment by N bytes from the end
     *
     * @param bytes - Amount of bytes to extend the segment by
     * @param segmentName - Name of the segment to extend
     * @returns Starting address of the allocation
     *
     * @throws Error if the segment name doesn't exist on the layout
     */
    alloc(bytes: number, segmentName: string): bigint {
        const segment = this.memoryLayout.get(segmentName);
        if (!segment) throw new Error(`Segment "${segmentName}" doesn't exist`);
        const addr = BigInt(segment.end) + 1n;
        const end = BigInt(segment.end) + BigInt(bytes);
        const idx = Number(end - this.baseAddress);
        if (idx >= this.size) {
            // Address is outside of the memory, we need to grow the buffer
            this.size = idx + 1;
            this.buffer = this.buffer.transfer(this.size);
            this.uint8View = new Uint8Array(this.buffer);
        }
        // Update the segment data
        segment.end = Number(end);
        return addr;
    }

    /**
     * Loads ROM data into memory starting at the specified offset.
     * This method only works with 8-bit byte memories for direct compatibility
     * with standard binary data.
     *
     * @param romData - Binary data to load
     * @param offset - Starting address offset. Default: 0
     *
     * @throws Error if memory doesn't use 8-bit bytes
     *
     * @example Loading ROM data
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 1024 });
     * const rom = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
     * memory.loadROM(rom, 0x100n);
     * ```
     */
    loadROM(romData: Uint8Array, offset: bigint = 0n): void {
        if (this.bitsPerByte !== 8) {
            throw new Error(
                "loadROM only supports 8-bit bytes. Use loadCustomROM for other byte sizes.",
            );
        }
        this.uint8View.set(romData, Number(offset));

        // Track all addresses that were written to
        const startAddr = Number(offset);
        for (let i = 0; i < romData.length; i++) {
            this.writtenAddresses.add(startAddr + i);
        }
    }

    /**
     * Loads custom ROM data into memory for non-8-bit byte configurations.
     * Each number in the array represents one memory byte using the configured byte size.
     *
     * @param romData - Array of byte values (each 0 to maxByteValue)
     * @param offset - Starting address offset. Default: 0
     *
     * @example Loading 12-bit ROM data
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 100, bitsPerByte: 12 });
     * const rom = [4095, 2048, 1024, 512]; // 12-bit values
     * memory.loadCustomROM(rom, 10n);
     * ```
     */
    loadCustomROM(romData: number[], offset: bigint = 0n): void {
        for (let i = 0; i < romData.length; i++) {
            this.write(offset + BigInt(i), romData[i]!);
        }
    }

    /**
     * Reads multiple consecutive bytes from memory starting at the specified address.
     *
     * @param address - Starting memory address
     * @param count - Number of bytes to read
     * @returns Array of byte values
     *
     * @example Reading a sequence of bytes
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 100 });
     * memory.write(10n, 0xAA);
     * memory.write(11n, 0xBB);
     * memory.write(12n, 0xCC);
     *
     * const bytes = memory.readBytes(10n, 3);
     * console.log(bytes); // [0xAA, 0xBB, 0xCC]
     * ```
     */
    readBytes(address: bigint, count: number): number[] {
        const result: number[] = [];
        for (let i = 0; i < count; i++) {
            result.push(this.read(address + BigInt(i)));
        }
        return result;
    }

    /**
     * Returns an array of all addresses that have been written to.
     *
     * @returns Array of written addresses (number), sorted in ascending order.
     *
     * @example
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 100 });
     * memory.write(5n, 123);
     * memory.write(10n, 255);
     * const written = memory.getWrittenAddresses(); // [5, 10]
     * ```
     */
    getWrittenAddresses(): number[] {
        // Sort addresses to ensure consistent output
        return Array.from(this.writtenAddresses).sort((a, b) => a - b);
    }

    /**
     * Returns the addresses that have been written to, along with their value
     */
    getWritten(): Array<{ addr: number; value: number }> {
        return this.getWrittenAddresses().map(addr => ({
            addr,
            value: this.read(BigInt(addr)),
        }));
    }

    /**
     * Creates a memory dump containing only written addresses and their values.
     * Also includes memory hints for data type information.
     * This is much more efficient for large, sparse memory spaces.
     *
     * @returns Memory dump with written addresses, values, and hints
     *
     * @example Creating and using dump
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 1000000 });
     * memory.write(100n, 123);
     * memory.write(50000n, 456);
     * memory.addHint(100n, [], "int32", 32, 45);
     *
     * const snapshot = memory.dump(); // Only contains 2 entries, not 1M, plus hints
     * memory.restore(snapshot);
     * ```
     */
    dump(): MemoryBackup {
        const addresses: number[] = [];
        const values: number[] = [];

        // Sort addresses to ensure consistent output
        const sortedAddresses = this.getWrittenAddresses();

        for (const addr of sortedAddresses) {
            addresses.push(addr);
            values.push(this.read(BigInt(addr)));
        }

        // Include hints in the dump
        const hints: {
            address: string;
            tag: string[];
            type: string;
            sizeInBits?: number;
            value?: number;
        }[] = [];
        for (const hint of this.hints.values()) {
            hints.push({
                address: hint.address.toString(),
                tag: hint.tag,
                type: hint.type,
                sizeInBits: hint.sizeInBits,
                value: hint.value,
            });
        }

        return {
            addresses,
            values,
            bitsPerByte: this.bitsPerByte,
            size: this.size,
            hints,
        };
    }

    /**
     * Restores memory state from a previously created dump.
     * The dump must be compatible with the current memory configuration.
     * Also restores memory hints if they are present in the dump.
     *
     * @param dump - Memory dump from dump() method
     *
     * @throws Error if dump metadata doesn't match current configuration
     *
     * @example Restoring memory state
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 100000, bitsPerByte: 8 });
     * memory.addHint(0x100n, [], "int32", 32, 45);
     * const snapshot = memory.dump();
     * // ... modify memory ...
     * memory.restore(snapshot); // Back to original state with hints
     * ```
     */
    restore(dump: MemoryBackup): void {
        if (dump.bitsPerByte !== this.bitsPerByte || dump.size > this.size) {
            throw new Error(
                "Dump metadata does not match current memory configuration",
            );
        }

        // Clear current memory state
        this.uint8View.fill(0);
        this.writtenAddresses.clear();

        // Restore sparse data
        for (let i = 0; i < dump.addresses.length; i++) {
            const addr = dump.addresses[i]!;
            const value = dump.values[i]!;

            // Use direct uint8View access to avoid re-tracking
            if (this.bitsPerByte === 8) {
                this.uint8View[addr] = value;
                this.writtenAddresses.add(addr);
            } else {
                // For non-8-bit bytes, use the write method which handles bit packing
                this.write(BigInt(addr), value);
            }
        }

        // Restore hints
        this.hints.clear();
        for (const hint of dump.hints) {
            this.hints.set(BigInt(hint.address), {
                address: BigInt(hint.address),
                tag: hint.tag,
                type: hint.type,
                sizeInBits: hint.sizeInBits,
                value: hint.value,
            });
        }
    }

    /**
     * Returns the number of bits per byte in this memory configuration.
     *
     * @returns Number of bits per byte (1-32)
     */
    getBitsPerByte(): number {
        return this.bitsPerByte;
    }

    /**
     * Returns the maximum value that can be stored in a single byte.
     * This is calculated as (2^bitsPerByte - 1).
     *
     * @returns Maximum byte value (e.g., 255 for 8-bit, 15 for 4-bit)
     */
    getMaxByteValue(): number {
        return this.maxByteValue;
    }

    /**
     * Returns the number of bytes that constitute a word in this memory configuration.
     *
     * @returns Word size in bytes
     */
    getWordSize(): number {
        return this.wordSize;
    }

    /**
     * Returns the total number of addressable units (bytes) in this memory configuration.
     *
     * @returns Addressable bytes
     */
    getSize(): number {
        return this.size;
    }

    /**
     * Returns a copy of the endianness configuration array.
     * The returned array is a copy to prevent external modification.
     *
     * @returns Copy of endianness array
     *
     * @example Checking endianness configuration
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 100, bitsPerByte: 8, wordSize: 4, endianness: [0, 1, 2, 3] });
     * console.log(memory.getEndianness()); // [0, 1, 2, 3] (big-endian)
     * ```
     */
    getEndianness(): number[] {
        return [...this.endianness];
    }

    /**
     * Returns an array of all memory addresses that contain non-zero values,
     * sorted from highest to lowest address.
     *
     * This method scans through all memory locations and identifies addresses
     * that have been written to (contain non-zero values). The returned addresses
     * are sorted in descending order for easy inspection of memory usage patterns.
     *
     * @returns Array of bigint addresses containing non-zero values, sorted highest to lowest
     *
     * @example Finding used memory addresses
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 100 });
     * memory.write(5n, 123);
     * memory.write(10n, 255);
     * memory.write(7n, 0);    // Zero value - won't be included
     * memory.write(50n, 42);
     *
     * const usedAddresses = memory.getUsedAddresses();
     * console.log(usedAddresses); // [50n, 10n, 5n]
     * ```
     *
     * @example With custom byte sizes
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 50, bitsPerByte: 12 }); // 12-bit bytes
     * memory.write(0n, 1000);
     * memory.write(25n, 4095); // Max 12-bit value
     * memory.write(15n, 0);    // Zero - won't be included
     *
     * console.log(memory.getUsedAddresses()); // [25n, 0n]
     * ```
     */
    getUsedAddresses(): bigint[] {
        const usedAddresses: bigint[] = [];

        if (this.bitsPerByte === 8) {
            // Fast path for 8-bit bytes: directly scan the storage buffer
            for (let addr = 0; addr < this.size; addr++) {
                if (this.uint8View[addr] !== 0) {
                    usedAddresses.push(BigInt(addr));
                }
            }
        } else {
            // For custom byte sizes, we need to decode values
            // But we can optimize by checking storage bytes first
            const usedStorageBytes = new Set<number>();

            // First pass: find which storage bytes are non-zero
            for (let i = 0; i < this.uint8View.length; i++) {
                if (this.uint8View[i] !== 0) {
                    usedStorageBytes.add(i);
                }
            }

            // If no storage bytes are used, return empty array
            if (usedStorageBytes.size === 0) {
                return [];
            }

            // Second pass: only check addresses that could be affected by non-zero storage bytes
            for (let addr = 0; addr < this.size; addr++) {
                const bitOffset = addr * this.bitsPerByte;
                const startByteIndex = Math.floor(bitOffset / 8);
                const endByteIndex = Math.floor(
                    (bitOffset + this.bitsPerByte - 1) / 8,
                );

                // Check if any storage byte that this address spans is non-zero
                let couldBeNonZero = false;
                for (
                    let byteIdx = startByteIndex;
                    byteIdx <= endByteIndex;
                    byteIdx++
                ) {
                    if (usedStorageBytes.has(byteIdx)) {
                        couldBeNonZero = true;
                        break;
                    }
                }

                // Only do expensive read if the address could possibly be non-zero
                if (couldBeNonZero) {
                    const value = this.read(BigInt(addr));
                    if (value !== 0) {
                        usedAddresses.push(BigInt(addr));
                    }
                }
            }
        }

        // Sort addresses from highest to lowest
        usedAddresses.sort((a, b) => Number(b - a));
        return usedAddresses;
    }

    /**
     * Splits a large value into bytes according to the memory's byte size configuration.
     * The result is in big-endian order (most significant byte first).
     *
     * This method is useful for converting multi-byte values into individual bytes
     * that can be stored in memory using write() operations.
     *
     * @param value - Value to split (must be non-negative)
     * @returns Array of byte values in big-endian order
     *
     * @throws Error if value is negative
     *
     * @example Splitting values with 8-bit bytes
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 100, bitsPerByte: 8 });
     * console.log(memory.splitToBytes(0x1234n)); // [0x12, 0x34]
     * console.log(memory.splitToBytes(0x123456n)); // [0x12, 0x34, 0x56]
     * ```
     *
     * @example Splitting values with 4-bit bytes
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 100, bitsPerByte: 4 });
     * console.log(memory.splitToBytes(0xABn)); // [10, 11] (0xA=10, 0xB=11)
     * console.log(memory.splitToBytes(0x123n)); // [1, 2, 3]
     * ```
     */
    splitToBytes(value: bigint): number[] {
        if (value < 0n) {
            throw new Error(`Value ${value} cannot be negative`);
        }
        if (typeof value !== "bigint") {
            throw new Error(`Value must be a bigint, got ${typeof value}`);
        }

        const bytes: number[] = [];
        let remainingValue = value;
        const maxByteValueBigInt = BigInt(this.maxByteValue);
        const bitsPerByteBigInt = BigInt(this.bitsPerByte);

        while (remainingValue > 0n) {
            const byteValue = Number(remainingValue & maxByteValueBigInt);
            bytes.unshift(byteValue);
            remainingValue >>= bitsPerByteBigInt;
        }

        return bytes.length === 0 ? [0] : bytes;
    }

    /**
     * Reads a complete word from memory starting at the specified address.
     *
     * The method reads wordSize consecutive bytes from memory and reorders them
     * according to the endianness configuration to reconstruct the original word.
     * The returned array represents the word in logical order (as it was written).
     *
     * @param address - Starting memory address for the word
     * @returns Array of bytes representing the word in logical order
     *
     * @throws Error if word would exceed memory boundaries
     *
     * @example Reading words with different endianness
     * ```typescript
     * // Little-endian (default)
     * const memoryLE = new Memory({ sizeInBytes: 100, bitsPerByte: 8, wordSize: 4 });
     * memoryLE.writeWord(0n, [0x12, 0x34, 0x56, 0x78]);
     * console.log(memoryLE.readWord(0n)); // [0x12, 0x34, 0x56, 0x78]
     *
     * // Big-endian
     * const memoryBE = new Memory({ sizeInBytes: 100, bitsPerByte: 8, wordSize: 4, endianness: [0, 1, 2, 3] });
     * memoryBE.writeWord(0n, [0x12, 0x34, 0x56, 0x78]);
     * console.log(memoryBE.readWord(0n)); // [0x12, 0x34, 0x56, 0x78] (same logical result)
     *
     * // But physical memory layout differs:
     * console.log(memoryLE.read(0n)); // 0x78 (LE: LSB stored first)
     * console.log(memoryBE.read(0n)); // 0x12 (BE: MSB stored first)
     * ```
     */
    readWord(address: bigint): number[] {
        // check address
        this.getIndex(address);

        const bytes: number[] = [];
        for (let i = 0n; i < this.wordSize; i++) {
            bytes.push(this.read(address + i));
        }

        // Reorder bytes according to endianness
        // endianness[i] tells us which memory position should be read for word position i
        const reorderedBytes: number[] = new Array(this.wordSize);
        for (let i = 0; i < this.wordSize; i++) {
            reorderedBytes[i] = bytes[this.endianness[i]!]!;
        }

        return reorderedBytes;
    }

    /**
     * Writes a complete word to memory starting at the specified address.
     *
     * The method takes a word as an array of bytes in logical order and stores
     * them in memory according to the endianness configuration. The endianness
     * determines the physical layout in memory while preserving the logical
     * word structure for readWord operations.
     *
     * @param address - Starting memory address for the word
     * @param word - Array of bytes representing the word in logical order
     *
     * @throws Error if word would exceed memory boundaries
     * @throws Error if word array length doesn't match configured word size
     * @throws Error if any byte value exceeds maxByteValue or is negative
     *
     * @example Writing words with different configurations
     * ```typescript
     * // Standard 4-byte word
     * const memory = new Memory({ sizeInBytes: 100, bitsPerByte: 8, wordSize: 4 });
     * memory.writeWord(0n, [0x12, 0x34, 0x56, 0x78]);
     *
     * // 2-byte word with big-endian
     * const memory16 = new Memory({ sizeInBytes: 100, bitsPerByte: 8, wordSize: 2, endianness: [0, 1] });
     * memory16.writeWord(10n, [0xAB, 0xCD]);
     * // Physical layout: [0xAB, 0xCD] but with little-endian default would be [0xCD, 0xAB]
     *
     * // Custom byte size with mixed endianness
     * const custom = new Memory({ sizeInBytes: 50, bitsPerByte: 6, wordSize: 3, endianness: [2, 0, 1] });
     * custom.writeWord(5n, [32, 21, 63]); // All values ≤ 63 for 6-bit bytes
     * ```
     *
     * @example Error cases
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 100, bitsPerByte: 4, wordSize: 4 }); // 4-bit bytes, max value 15
     *
     * // These will throw errors:
     * // memory.writeWord(0n, [1, 2, 3]);        // Wrong length (3 vs 4)
     * // memory.writeWord(0n, [1, 2, 3, 16]);    // Value 16 > max 15
     * // memory.writeWord(98n, [1, 2, 3, 4]);    // Exceeds memory boundary
     * ```
     */
    writeWord(address: bigint, word: number[]): void {
        // check address
        this.getIndex(address);

        if (word.length !== this.wordSize) {
            throw new Error(
                `Word array length (${word.length}) must match word size (${this.wordSize})`,
            );
        }

        // Validate all bytes in the word
        for (let i = 0; i < word.length; i++) {
            if (word[i]! > this.maxByteValue || word[i]! < 0) {
                throw new Error(
                    `Word byte ${i} value ${word[i]} exceeds byte size (max: ${this.maxByteValue})`,
                );
            }
        }

        // Reorder bytes according to endianness and write to memory
        // endianness[i] tells us which memory position should store word position i
        const bytesToWrite: number[] = new Array(this.wordSize);
        for (let i = 0; i < this.wordSize; i++) {
            bytesToWrite[this.endianness[i]!] = word[i]!;
        }

        for (let i = 0n; i < this.wordSize; i++) {
            this.write(address + i, bytesToWrite[Number(i)]!);
        }
    }

    /**
     * Gets the memory segment that contains the specified address.
     *
     * @param address - Address to look up
     * @returns Name of the segment containing the address, or undefined if not in any segment
     *
     * @example Getting segment for address
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 0x10000, bitsPerByte: 8, wordSize: 4, memoryLayout: layout });
     * console.log(memory.getSegmentForAddress(0x0500n)); // "text"
     * console.log(memory.getSegmentForAddress(0x1500n)); // "data"
     * ```
     */
    getSegmentForAddress(address: bigint): string | undefined {
        // Check cache first
        if (this.segmentCache.has(address)) {
            return this.segmentCache.get(address);
        }

        // Convert relative address to absolute if needed
        const absoluteAddress = address + this.baseAddress;

        // Find segment containing this address
        for (const [segmentName, segment] of this.memoryLayout) {
            if (
                absoluteAddress >= segment.start &&
                absoluteAddress <= segment.end
            ) {
                this.segmentCache.set(address, segmentName);
                return segmentName;
            }
        }

        return undefined;
    }

    /**
     * Validates whether an access to the specified address is allowed for the given operation type.
     *
     * @param address - Address to validate
     * @param operation - Type of operation ("read", "write", "execute")
     * @param expectedSegment - Optional expected segment name for validation
     * @returns True if access is valid, false otherwise
     *
     * @example Validating memory access
     * ```typescript
     * // Check if we can execute code at this address
     * if (memory.isValidAccess(0x0500n, "execute", "text")) {
     *     console.log("Valid instruction address");
     * }
     *
     * // Check if we can write data at this address
     * if (memory.isValidAccess(0x1500n, "write", "data")) {
     *     console.log("Valid data write");
     * }
     * ```
     */
    isValidAccess(
        address: bigint,
        operation: string,
        expectedSegment?: string,
    ): boolean {
        // generic address check
        if (
            address < this.baseAddress ||
            address - this.baseAddress >= this.size
        ) {
            return false;
        }

        // segment check
        const segment = this.getSegmentForAddress(address);

        if (!segment) {
            return true;
        }

        if (expectedSegment && segment !== expectedSegment) {
            return false; // Address not in expected segment
        }

        // Basic segment-based access control
        switch (operation) {
            case "execute":
                return segment === "text" || segment === "ktext";
            case "read":
                return true; // Generally allow reads from any segment
            case "write":
                return segment !== "text" && segment !== "ktext"; // Don't allow writes to text segments
            default:
                return true;
        }
    }

    /**
     * Gets information about all memory segments defined in the layout.
     *
     * @returns Map of memory segment information
     *
     * @example Getting all segments
     * ```typescript
     * const segments = memory.getMemorySegments();
     * for (const [name, segment] of segments) {
     *     console.log(`${name}: ${segment.start} - ${segment.end}`);
     * }
     * ```
     */
    getMemorySegments(): Map<string, MemorySegment> {
        return new Map(this.memoryLayout); // Return copy to prevent external modification
    }

    /**
     * Gets the base address offset used for memory addressing.
     *
     * @returns Base address offset
     */
    getBaseAddress(): bigint {
        return this.baseAddress;
    }

    /**
     * Converts a physical memory address to a logical address by subtracting the base address.
     *
     * @param physicalAddress - Physical address to convert
     * @returns Logical address
     */
    physicalToLogical(physicalAddress: bigint): bigint {
        return physicalAddress - this.baseAddress;
    }

    /**
     * Converts a logical memory address to a physical address by adding the base address.
     *
     * @param logicalAddress - Logical address to convert
     * @returns Physical address
     */
    logicalToPhysical(logicalAddress: bigint): bigint {
        return logicalAddress + this.baseAddress;
    }

    /**
     * Clears the segment lookup cache. Useful when memory layout changes at runtime.
     */
    clearSegmentCache(): void {
        this.segmentCache.clear();
    }

    /**
     * Gets statistics about memory segment usage.
     *
     * @returns Object containing usage statistics for each segment
     *
     * @example Getting segment usage
     * ```typescript
     * const stats = memory.getSegmentUsage();
     * console.log(`Text segment: ${stats.text?.usedBytes} / ${stats.text?.totalBytes} bytes used`);
     * ```
     */
    getSegmentUsage(): Record<
        string,
        { usedBytes: bigint; totalBytes: bigint; utilization: number }
    > {
        const usage: Record<
            string,
            { usedBytes: bigint; totalBytes: bigint; utilization: number }
        > = {};
        const usedAddresses = this.getUsedAddresses();

        // Initialize segment usage counters
        for (const [segmentName, segment] of this.memoryLayout) {
            usage[segmentName] = {
                usedBytes: 0n,
                totalBytes: segment.size,
                utilization: 0,
            };
        }

        // Count used addresses in each segment
        for (const address of usedAddresses) {
            const segmentName = this.getSegmentForAddress(address);
            if (segmentName && usage[segmentName]) {
                usage[segmentName].usedBytes++;
            }
        }

        // Calculate utilization percentages
        for (const [segmentName] of this.memoryLayout) {
            const stats = usage[segmentName];
            if (stats && stats.totalBytes > 0n) {
                stats.utilization = Number(
                    (stats.usedBytes * 100n) / stats.totalBytes,
                );
            }
        }

        return usage;
    }

    /**
     * Adds a hint for a memory address.
     *
     * @param address - Memory address to add hint for
     * @param tag - Tag for the hint (e.g., "variableName", "functionName")
     * @param type - Description of the data type or purpose (e.g., "double", "int32", "string")
     * @param sizeInBits - Optional size of the type in bits (e.g., 64 for double, 32 for int32)
     * @param value - Optional value of the data value (e.g., 45)
     *
     * @example Adding hints
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 1024 });
     * memory.addHint(0x100n, [], "double", 64); // No tag, just type
     * memory.addHint(0x200n, ["myVar"], "int32", 32, 45);
     * memory.addHint(0x300n, ["myString"], "string"); // No size specified
     * memory.addHint(0x400n, ["foo", "bar"], "int32", 32); // Multiple tags
     * ```
     */
    addHint(
        address: bigint,
        tag: string | string[],
        type: string,
        sizeInBits?: number,
        value?: number,
    ): void {
        // If no tag is provided and a hint exists, preserve the existing tag
        let finalTag;
        if (typeof tag === "string") finalTag = tag === "" ? [] : [tag];
        else finalTag = tag;
        const existing = this.hints.get(address);
        if (tag.length === 0 && existing) {
            finalTag = existing.tag;
        }
        this.hints.set(address, {
            address,
            tag: finalTag,
            type,
            sizeInBits,
            value,
        });
    }

    /**
     * Removes a hint for a memory address.
     *
     * @param address - Memory address to remove hint for
     * @returns True if hint was removed, false if no hint existed
     *
     * @example Removing hints
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 1024 });
     * memory.addHint(0x100n, [], "double", 64, 45);
     * const removed = memory.removeHint(0x100n); // true
     * const notFound = memory.removeHint(0x200n); // false
     * ```
     */
    removeHint(address: bigint): boolean {
        return this.hints.delete(address);
    }

    /**
     * Gets the hint for a memory address.
     *
     * @param address - Memory address to get hint for
     * @returns Hint information if it exists, undefined otherwise
     *
     * @example Getting hints
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 1024 });
     * memory.addHint(0x100n, [], "double", 64, 45);
     *
     * const hint = memory.getHint(0x100n);
     * if (hint) {
     *     console.log(`Address ${hint.address.toString(16)}: ${hint.hint}`);
     *     if (hint.sizeInBits) {
     *         console.log(`Size: ${hint.sizeInBits} bits`);
     *     }
     * }
     * ```
     */
    getHint(address: bigint): MemoryHint | undefined {
        return this.hints.get(address);
    }

    /**
     * Gets all hints in memory.
     *
     * @returns Array of all hint information, sorted by address
     *
     * @example Getting all hints
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 1024 });
     * memory.addHint(0x200n, [], "int32", 32, 45);
     * memory.addHint(0x100n, [], "double", 64, 45);
     *
     * const hints = memory.getAllHints();
     * for (const hint of hints) {
     *     console.log(`0x${hint.address.toString(16)}: ${hint.hint}`);
     * }
     * // Output:
     * // 0x100: double
     * // 0x200: int32
     * ```
     */
    getAllHints(): MemoryHint[] {
        const hints = Array.from(this.hints.values());
        hints.sort((a, b) => Number(a.address - b.address));
        return hints;
    }

    /**
     * Clears all hints from memory.
     *
     * @example Clearing hints
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 1024 });
     * memory.addHint(0x100n, [], "double", 64, 45);
     * memory.addHint(0x200n, [], "int32", 32, 45);
     *
     * console.log(memory.getAllHints().length); // 2
     * memory.clearHints();
     * console.log(memory.getAllHints().length); // 0
     * ```
     */
    clearHints(): void {
        this.hints.clear();
    }

    /**
     * Gets hints within a specified address range.
     *
     * @param startAddress - Start of address range (inclusive)
     * @param endAddress - End of address range (inclusive)
     * @returns Array of hints within the range, sorted by address
     *
     * @example Getting hints in range
     * ```typescript
     * const memory = new Memory({ sizeInBytes: 1024 });
     * memory.addHint(0x100n, [], "double", 64, 45);
     * memory.addHint(0x200n, [], "int32", 32);
     * memory.addHint(0x300n, [], "string");
     *
     * const hintsInRange = memory.getHintsInRange(0x150n, 0x250n);
     * console.log(hintsInRange.length); // 1 (only the int32 at 0x200)
     * ```
     */
    getHintsInRange(startAddress: bigint, endAddress: bigint): MemoryHint[] {
        const hintsInRange: MemoryHint[] = [];
        for (const hint of this.hints.values()) {
            if (hint.address >= startAddress && hint.address <= endAddress) {
                hintsInRange.push(hint);
            }
        }
        hintsInRange.sort((a, b) => Number(a.address - b.address));
        return hintsInRange;
    }
}
