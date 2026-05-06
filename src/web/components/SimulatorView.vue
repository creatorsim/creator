<!--
Copyright 2018-2026 CREATOR Team.

This file is part of CREATOR.

CREATOR is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

CREATOR is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with CREATOR.  If not, see <http://www.gnu.org/licenses/>.
-->
<script lang="ts">
import { defineComponent, type PropType } from "vue";

import type { StackFrame } from "@/core/memory/StackTracker.mjs";
import { architecture, loadedCreatino } from "@/core/core.mjs";
import { main_memory } from "@/core/core";
import { type Device, devices } from "@/core/executor/devices.mts";

import TableExecution from "./simulator/TableExecution.vue";
import DataViewSelector from "./simulator/DataViewSelector.vue";
import RegisterFile from "./simulator/RegisterFile.vue";
import Examples from "./assembly/Examples.vue";
import HexViewer from "./simulator/HexViewer.vue";
import Calculator from "./simulator/Calculator.vue";
import Terminal from "./simulator/Terminal.vue";
import Stats from "./simulator/Stats.vue";
import Flash from "./simulator/Flash.vue";
import ArduinoTerminal from "./simulator/ArduinoTerminal.vue";

export default defineComponent({
  props: {
    instructions: { type: Array, required: true },
    browser: { type: String, required: true },
    os: { type: String, required: true },
    dark: { type: Boolean, required: true },
    windowHeight: { type: Number, required: true },
    windowWidth: { type: Number, required: true },
    arch_available: Array,
    architecture_name: { type: String, required: true },
    data_mode: { type: String, required: true },
    reg_name_representation: { type: String, required: true },
    stat_representation: { type: String, required: true },
    stat_type: { type: String, required: true },
    memory_segment: { type: String, required: true },
    assembly_code: { type: String, required: true },
    enter: { type: [Boolean, null], required: true },
    display: { type: String, required: true },
    keyboard: { type: String, required: true },
    autoscroll: { type: Boolean, default: false },
    caller_frame: Object as PropType<StackFrame>,
    callee_frame: Object as PropType<StackFrame>,

    lab_url: { type: String, required: true },
    result_email: { type: String, required: true },
    target_board: { type: String, required: true },
    target_port: { type: String, required: true },
    target_location: { type: String, required: true },
    flash_url: { type: String, required: true },
  },

  components: {
    TableExecution,
    DataViewSelector,
    RegisterFile,
    Examples,
    HexViewer,
    Calculator,
    Stats,
    Flash,
    Terminal,
    ArduinoTerminal
    // App
  },

  data() {
    return {
      architecture,
      main_memory: main_memory as any,
      devices: devices as Map<string, any>,
    };
  },
});
</script>

<template>
  <b-container fluid align-h="center" id="simulator">
    <b-row>
      <b-col>
        <!-- Navbar -->
        <!-- Simulator navbar modals -->

        <!-- Flash -->
        <Flash
          id="flash"
          :os="os"
          :assembly_code="assembly_code"
          :lab_url="lab_url"
          :result_email="result_email"
          :target_board="target_board"
          :target_port="target_port"
          :target_location="target_location"
          :flash_url="flash_url"
        />

        <!-- Examples modal -->
        <Examples
          id="examples_simulator"
          :architecture_name="architecture_name"
          :compile="true"
        />

        <!-- Calculator -->
        <Calculator id="calculator_simulator" />
        
        <b-row align-h="center" class="simulator-main-row">
          <!-- Column 1: Execution instruction -->
          <b-col
            cols="12"
            sm="12"
            md="5"
            lg="5"
            class="execution-instruction-col"
          >
            <TableExecution
              :instructions="instructions"
              :enter="enter"
              :autoscroll="autoscroll"
              ref="tableExecution"
            />
          </b-col>

          <!-- Column 2: Execution data (split into top: data, bottom: terminal) -->

          <b-col cols="12" sm="12" md="7" lg="7" class="execution-data-col">
            <!-- Top row: current execution data -->
            <div class="execution-data-container">
              <div class="execution-data-header">
                <!-- View selector as tabs -->
                <DataViewSelector
                  :data_mode="data_mode"
                  :register_file_num="architecture.register_files.length"
                  :dark="dark"
                  :enter="enter"
                  :architecture_name="architecture_name"
                />
              </div>

              <div class="execution-data-content">
                <!-- Registers view -->
                <RegisterFile
                  v-if="
                    data_mode == 'int' || data_mode == 'float' || data_mode == 'v_registers' || data_mode == 'csr_registers'
                  "
                  :data_mode="data_mode"
                  :reg_name_representation="reg_name_representation"
                  :dark="dark"
                  ref="registerFile"
                />

                <!-- Memory view-->
                <HexViewer
                  v-if="data_mode === 'memory'"
                  ref="memory"
                  :main_memory="main_memory"
                  :devices="devices"
                  :segment="memory_segment"
                />

                <!-- Stats view--->
                <Stats
                  v-if="data_mode === 'stats'"
                  ref="stats"
                  :dark="dark"
                  :representation="stat_representation"
                  :type="stat_type"
                />

                <!-- Terminal view -->
                <Terminal
                  v-if="data_mode === 'terminal'"
                  :display="display"
                  :keyboard="keyboard"
                  :enter="enter"
                  ref="terminal"
                />
                  <ArduinoTerminal
                  v-if="data_mode === 'arduino'"
                  :display="display"
                  :keyboard="keyboard"
                  :enter="enter"
                  ref="arduinoTerminal"
                />
              </div>
            </div>
          </b-col>
        </b-row>
      </b-col>
    </b-row>
  </b-container>
</template>

<style lang="scss" scoped>
#simulator {
  padding-top: 10px;
  height: calc(95vh);
  overflow: hidden;
}

#simulator > .row {
  height: 100%;
  max-height: 100%;
}

#simulator > .row > .col {
  height: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
}

.simulator-main-row {
  flex: 1;
  min-height: 0;
}

.execution-instruction-col {
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: 100%;
  height: 100%;
  border-radius: 8px;
}

.execution-data-col {
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: 100%;
  height: 100%;
  gap: 12px;
}

.execution-data-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
}

.execution-data-header {
  flex: 0 0 auto;
  padding: 0;
}

.execution-data-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Make child components fill the content area properly */
.execution-data-content :deep(.register-file-container),
.execution-data-content :deep(.memory-container),
.execution-data-content :deep(.stats-container),
.execution-data-content :deep(.terminal-container) {
  height: 100%;
  max-height: 100%;
  padding: 8px;
}

.execution-data-top {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.execution-data-top > .col {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.execution-data-bottom {
  flex: 0 0 240px; /* Fixed height for terminal */
  min-height: 240px;
  max-height: 240px;
  overflow: hidden;
}

.terminal-col {
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep() {
  .consoleIcon {
    opacity: 0.6;
  }

  .groupLabelling {
    float: top;
    position: relative;
    top: -0.6vw;
  }
}

:deep(.registerPopover) {
  background-color: #ceecf5;
  font-family: monospace;
  font-weight: normal;
  font-size: 0.7em;
}
</style>
