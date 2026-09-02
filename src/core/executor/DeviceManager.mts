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

import { creator_ga } from "../utils/creator_ga.mjs";
import { main_memory, status } from "../core.mjs";
import { keyboard_read, display_print } from "./IO.mjs";
import { float2bin, double2bin, packExecute } from "../utils/utils.mjs";
import { SYSCALL } from "../capi/syscall.mts";
import { MEM } from "../capi/memory.mts";
import { Memory, type MemoryBackup } from "../memory/Memory.mts";
import { coreEvents, CoreEventTypes } from "../events.mts";

type DeviceConfig = {
    ctrl_addr: number;
    status_addr: number;
    data: { start: number; end: number };
    enabled?: boolean;
};

/**
 * A CREATOR device.
 *
 * @field {number} ctrl_addr: Address of the control register.
 * @field {number} status_addr: Address of the status register.
 * @field {Object} data: Device data range.
 * @field {number} data.start: Address of the start of the data range.
 * @field {number} data.end: Address of the end of the data range.
 * @field {boolean} [enabled=true]: Status of the device.
 *
 * @method callback: Function defining the behaviour of the device.
 *
 */
export abstract class Device {
    readonly ctrl_addr: number;
    readonly status_addr: number;
    readonly data: { start: number; end: number };
    enabled: boolean;
    memory: Memory;
    private memoryBackup: MemoryBackup;

    constructor(config: DeviceConfig) {
        this.ctrl_addr = config.ctrl_addr;
        this.status_addr = config.status_addr;
        this.data = config.data;
        this.enabled = config.enabled ?? true;

        // TODO: check it doesn't conflict w/ main memory... or maybe not...?

        // we don't know if ctrl_addr & status_addr will be lower or higher
        // than the data segment... so we'll have to handle that
        const minAddr = Math.min(
            config.data.start,
            config.ctrl_addr,
            config.status_addr,
        );
        const maxAddr = Math.max(
            config.data.end,
            config.ctrl_addr,
            config.status_addr,
        );

        this.memory = new Memory({
            sizeInBytes: maxAddr - minAddr + 1,
            baseAddress: BigInt(minAddr),
            bitsPerByte: 8,
            wordSize: 4,
            endianness: [0, 1, 2, 3], // Big Endian
        });

        this.memoryBackup = this.memory.dump();
    }

    /**
     * Writes a value in a word.
     *
     * @param address Address.
     * @param value Value to write.
     * @param words Number of words to write.
     *
     * @throws Error if value is too big.
     *
     */
    protected writeValue(value: number, address: number, words: number = 1) {
        // transform value in bytes
        const bytes = this.memory.splitToBytes(BigInt(value));
        bytes.unshift(...new Array(4 * words - bytes.length).fill(0)); // fill the w/ 0 until we reach the word number of bytes

        for (let i = 0; i < words; i++) {
            this.memory.writeWord(BigInt(address), bytes);
        }
    }

    /**
     * Reads the specified number of `words` and returns them as a `DataView`
     * @param address Starting address.
     * @param words Number of words to read.
     * @returns View of the resulting value.
     */
    protected readValue(address: number, words: number = 1): DataView {
        let bytes: number[] = [];
        for (let i = 0; i < words; i++) {
            bytes = bytes.concat(this.memory.readWord(BigInt(address + i * 4)));
        }

        return new DataView(Uint8Array.from(bytes).buffer);
    }

    /**
     * Checks whether the specified address belongs to the device.
     *
     * @param addr - Address to check.
     *
     * @return `true` if it belongs to the device, else `false`.
     *
     */
    isDeviceAddr(addr: number): boolean {
        return (
            addr === this.ctrl_addr ||
            addr === this.status_addr ||
            (this.data.start <= addr && addr < this.data.end)
        );
    }

    /**
     * Resets the device's memory.
     *
     */
    reset(): void {
        this.memory.restore(this.memoryBackup);
    }

    /**
     * Clears the device's ctrl_addr
     */
    clear(): void {
        this.memory.writeWord(BigInt(this.ctrl_addr), [0, 0, 0, 0]);
    }

    /**
     * Called once per cycle, if the device is enabled, defines the behaviour
     * of the device.
     *
     */
    abstract handler(): void;
}

enum DataType {
    Int32 = "int",
    Float32 = "float",
    Float64 = "double",
    Char = "char",
    String = "string",
}

/**
 * A device for interacting with the CREATOR console.
 *
 */
class ConsoleDevice extends Device {
    /**
     * Performs a generic console write.
     *
     * @param value Value to write.
     * @param type Datatype to write (used for analytics).
     *
     */
    // eslint-disable-next-line class-methods-use-this
    #write(value: string, type: DataType): void {
        creator_ga(
            "execute",
            "execute.syscall",
            "execute.syscall.print_" + type,
        ); // google analytics

        display_print(value);
    }

    /**
     * Performs actions to prepare a console read.
     *
     * @param type - Datatype to read.
     *
     */
    // eslint-disable-next-line class-methods-use-this
    #prepareRead(type: DataType): void {
        creator_ga(
            "execute",
            "execute.syscall",
            "execute.syscall.read_" + type,
        ); // google analytics

        // stop program to wait for read
        status.run_program = 3;

        // Emit event to disable buttons in UI
        if (typeof document !== "undefined") {
            coreEvents.emit(CoreEventTypes.EXECUTOR_BUTTONS_UPDATE, {
                instruction_disable: true,
                run_disable: true,
            });
        }
    }

    override handler(): void {
        switch (this.readValue(this.ctrl_addr).getUint32(0)) {
            case 1: // print int
                this.#write(
                    this.readValue(this.data.start).getInt32(0).toString(),
                    DataType.Int32,
                );
                break;

            case 2: // print float
                this.#write(
                    this.readValue(this.data.start).getFloat32(0).toString(),
                    DataType.Float32,
                );
                break;

            case 3: // print double
                this.#write(
                    this.readValue(this.data.start, 2).getFloat64(0).toString(),
                    DataType.Float64,
                );
                break;

            case 4: // print string
                const addr = this.readValue(this.data.start).getInt32(0);

                // read byte by byte until a null terminator is found
                const mainMemory = main_memory as Memory;
                const bytes = [];
                for (let i = 0; i < mainMemory.getSize(); i++) {
                    const byte = mainMemory.read(BigInt(addr + i));
                    if (byte === 0) break; // null terminator
                    bytes.push(byte);
                }

                // Decode the UTF-8 data to a string
                const buffer = new Uint8Array(bytes);
                const msg = new TextDecoder().decode(buffer);
                this.#write(msg, DataType.String);

                break;

            case 5: // read int
                this.#prepareRead(DataType.Int32);

                // it's a bit ugly, I know, but the alternative is rewriting the
                // whole function
                keyboard_read((keystroke: string, _params: unknown) =>
                    this.writeValue(parseInt(keystroke, 10), this.data.start),
                );

                break;

            case 6: // read float
                this.#prepareRead(DataType.Float32);

                keyboard_read((keystroke: string, _params: unknown) =>
                    this.writeValue(
                        parseInt(float2bin(parseFloat(keystroke)), 2),
                        this.data.start,
                    ),
                );

                break;

            case 7: // read double
                this.#prepareRead(DataType.Float64);

                keyboard_read((keystroke: string, _params: unknown) =>
                    this.writeValue(
                        parseInt(double2bin(parseFloat(keystroke)), 2),
                        this.data.start,
                        2,
                    ),
                );

                break;

            case 8: {
                // read string
                this.#prepareRead(DataType.String);

                // get string addr & max length
                const addr = this.readValue(this.data.start).getUint32(0);
                const length = this.readValue(this.data.start + 4).getUint32(0);

                // read & store in specified addr
                const mainMemory = main_memory as Memory;
                keyboard_read((keystroke: string, _params: unknown) => {
                    const bytes = new TextEncoder().encode(keystroke);

                    // Write the string to memory byte by byte
                    for (let i = 0; i < bytes.length && i < length; i++) {
                        mainMemory.write(BigInt(addr + i), bytes[i]!);
                    }
                });

                break;
            }

            case 11: // print char
                this.#write(
                    String.fromCharCode(
                        this.readValue(this.data.start).getUint32(0),
                    ),
                    DataType.Char,
                );
                break;

            case 12: // read char
                this.#prepareRead(DataType.Char);

                keyboard_read((keystroke: string, _params: unknown) =>
                    this.writeValue(keystroke.charCodeAt(0), this.data.start),
                );

                break;

            default:
                return;
        }

        this.clear();
    }
}

class OSDriver extends Device {
    override handler() {
        switch (this.readValue(this.ctrl_addr).getUint32(0)) {
            case 9: {
                // sbrk
                creator_ga(
                    "execute",
                    "execute.syscall",
                    "execute.syscall.sbrk",
                ); // google analytics

                // get size
                const size = this.readValue(this.data.start).getUint32(0);
                if (size < 0) {
                    throw packExecute(
                        true,
                        "capi_syscall: negative size",
                        "danger",
                        null,
                    );
                }

                // malloc
                const addr = MEM.alloc(size);

                // save addr
                this.writeValue(this.data.start, Number(addr));

                break;
            }

            case 10: // exit
                SYSCALL.exit();

                break;

            default:
                return;
        }

        this.clear();
    }
}

// list of available devices
const AvailableDevices: Record<string, new (cfg: DeviceConfig) => Device> = {
    ConsoleDevice,
    OSDriver,
};


export type DeviceList = ({ id: string; cls: string } & DeviceConfig)[];

export class DeviceManager {
    constructor(devices: DeviceList) {
        for (const { id, cls, ...cfg } of devices) {
            // get device type
            const DeviceClass = AvailableDevices[cls];
            if (!DeviceClass) {
                throw new Error(`Invalid device class '${cls}'`);
            }

            this.devices.set(id, new DeviceClass(cfg));
        }
    }

    public devices = new Map<string, Device>();

    /* Memory */

    /**
     * Checks if an address is a device address.
     *
     * @param addr Address to check.
     *
     * @return ID of the device that the address belongs to, else `null`.
     */
    public checkDeviceAddr(addr: number): string | null {
        for (const [id, device] of this.devices) {
            if (!device.enabled) continue;

            if (device.isDeviceAddr(addr)) return id;
        }

        return null;
    }

    /* Handlers */

    /**
     * Calls all the devices' handlers.
     */
    public handleDevices(): void {
        for (const [_id, device] of this.devices) {
            if (device.enabled) device.handler();
        }
    }

    /**
     * Resets all the devices.
     */
    public resetDevices(): void {
        for (const [_id, device] of this.devices) {
            device.reset();
        }
    }

    /**
     * Enables the specified device
     *
     * @param id ID of the device to enable
     */
    public enableDevice(id: string) {
        const dev = this.devices.get(id);
        if (!dev) {
            throw new Error(`Invalid device ID '${id}'`);
        }

        dev.enabled = true;
    }

    /**
     * Disables the specified device
     *
     * @param id ID of the device to disable
     */
    public disableDevice(id: string) {
        const dev = this.devices.get(id);
        if (!dev) {
            throw new Error(`Invalid device ID '${id}'`);
        }

        dev.enabled = false;
    }
}
