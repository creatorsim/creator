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

import { ref, type Ref } from "vue";
import { coreEvents, type ArduinoPinRead } from "@/core/events.mts";
// --- Tipado ---
export interface PinStateMap {
    [key: string]: number;
}

export interface BoardConfig {
    name: string;
    svg: string;
    pinLabels: string[][]; // Estructura de columnas [izquierda, derecha]
    initialStates: PinStateMap;
}
const env = (import.meta as any).env || {};
const baseUrl = env.BASE_URL || '/';
// Board definition
const BOARDS: Record<string, BoardConfig> = {
    esp32c3devkit2: {
        name: "ESP32-C3 DevKitC-02",
        svg: baseUrl + "maker/boards/esp32c3devkit2.svg",
        pinLabels: [
            ["GPIO4", "GPIO5", "GPIO6", "GPIO7", "GPIO8", "GPIO9", "GPIO30"],
            [
                "GPIO0",
                "GPIO1",
                "GPIO2",
                "GPIO3",
                "GPIO20",
                "GPIO21",
                "GPIO18",
                "GPIO19",
            ],
        ],
        initialStates: {
            GPIO0: 0,
            GPIO1: 0,
            GPIO2: 0,
            GPIO3: 0,
            GPIO4: 0,
            GPIO5: 0,
            GPIO6: 0,
            GPIO7: 0,
            GPIO8: 0,
            GPIO9: 0,
            GPIO10: 0,
            GPIO18: 0,
            GPIO19: 0,
            GPIO20: 0,
            GPIO21: 0,
            GPIO30: 0,
        },
    },
    esp32c6devkit1: {
        name: "ESP32-C6 DevKit",
        svg: baseUrl + "maker/boards/esp32c6devkit1.svg",
        pinLabels: [
            [
                "GPIO4",
                "GPIO5",
                "GPIO6",
                "GPIO7",
                "GPIO0",
                "GPIO1",
                "GPIO8",
                "GPIO10",
                "GPIO11",
                "GPIO2",
                "GPIO3",
            ],
            [
                "GPIO15",
                "GPIO23",
                "GPIO22",
                "GPIO21",
                "GPIO20",
                "GPIO19",
                "GPIO18",
                "GPIO9",
                "GPIO17",
                "GPIO9",
                "GPIO13",
                "GPIO12",
            ],
        ],
        initialStates: {
            GPIO0: 0,
            GPIO1: 0,
            GPIO2: 0,
            GPIO3: 0,
            GPIO4: 0,
            GPIO5: 0,
            GPIO6: 0,
            GPIO7: 0,
            GPIO8: 0,
            GPIO9: 0,
            GPIO10: 0,
            GPIO11: 0,
            GPIO12: 0,
            GPIO13: 0,
            GPIO15: 0,
            GPIO17: 0,
            GPIO18: 0,
            GPIO19: 0,
            GPIO20: 0,
            GPIO21: 0,
            GPIO22: 0,
            GPIO23: 0,
        },
    },
};

// interrupt
// Vector table for ESP32 (for demonstration, not fully implemented): [pin,ISR,MODE]
let esp32vectRef = ref<[bigint, bigint, bigint][]>(
    Array.from({ length: 32 }, () => [0n, 0n, 0n]),
);
const entry = esp32vectRef.value[0];
if (entry) {
    entry[0] = 0xffffn; // pin
    entry[1] = 0xffffn; // isr
    entry[2] = 0n; // mode
}

// States

// Por defecto empezamos con la ESP32
const currentBoardKey = "esp32c3devkit2";

export const activeBoard = ref(BOARDS[currentBoardKey]);
export const pinStates: Ref<PinStateMap> = ref({
    ...BOARDS[currentBoardKey]?.initialStates,
});
export const pinLabels = ref(BOARDS[currentBoardKey]?.pinLabels);
export const esp32vect = esp32vectRef; // Exportamos el vector de interrupciones

// Change boards
export function switchBoard(boardKey: string) {
    if (BOARDS[boardKey]) {
        activeBoard.value = BOARDS[boardKey];
        pinStates.value = { ...BOARDS[boardKey].initialStates };
        pinLabels.value = BOARDS[boardKey].pinLabels;
    }
}

// Functions
coreEvents.on("arduino-pin-read", (event: ArduinoPinRead) => {
    const value = pinStates.value[event.pin] ?? 0;
    event.callback(value);
});
coreEvents.on("arduino-find-vector-slot", (event) => {
    const indexEncontrado = esp32vect.value.findIndex(
        (slot: bigint[]) => slot[1] === 0n && slot[2] === 0n
    );
    event.callback(indexEncontrado);
});

coreEvents.on("arduino-get-pin-from-slot", (event) => {
    const pinGuardado = esp32vect.value[event.position]?.[0];
    event.callback(pinGuardado?.toString() ?? "unknown");
});