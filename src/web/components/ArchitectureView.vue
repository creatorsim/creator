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

import { architecture } from "@/core/core.mjs";
import available_arch from "../../../architecture/available_arch.json";

import EditArchitecture from "./architecture/EditArchitecture.vue";
import DownloadPopup from "./general/DownloadModal.vue";
import ArchConf from "./architecture/configuration/ArchConf.vue";
import RegisterFileArch from "./architecture/register_file/RegisterFileArch.vue";
import Instructions from "./architecture/instructions/Instructions.vue";
import Directives from "./architecture/directives/Directives.vue";
import Pseudoinstructions from "./architecture/pseudoinstructions/Pseudoinstructions.vue";
import CacheMemory from "./architecture/cache_memory/CacheMemory.vue";
import { SailTest32, SailTest64 } from "@/core/executor/sailSimRV/sailExecutor.mjs";
import { coreEvents } from "@/core/events.mts";
export default defineComponent({
  props: {
    browser: { type: String, required: true },
    os: { type: String, required: true },
    arch_available: Array as PropType<AvailableArch[]>,
    architecture_name: String,
    dark: { type: Boolean, required: true },
    arch_code: { type: String, required: true },
  },

  components: {
    EditArchitecture,
    DownloadPopup,
    ArchConf,
    RegisterFileArch,
    Instructions,
    Directives,
    Pseudoinstructions,
    CacheMemory,
  },

  data() {
    return {
      architecture,
      activeTab: "instructions",
      validate: false,
      showValidationModal: false,
      running: false,
      runned: 0,
      result_test: 0,
      result_log: ""
    };
  },
  computed: {
    architecture_guide() {
      if (!this.architecture_name) return undefined;
      return available_arch.find(
        arch =>
          arch.name === this.architecture_name ||
          arch.alias.includes(this.architecture_name!),
      )?.guide;
    },

    archCodeWSchema() {
      return `# yaml-language-server: $schema=${document.URL.replace(/\/#$/, "/")}schema/architecture.json\n${this.arch_code}`;
    },
  },
  methods:{
    runValidationTest(arch_type: Number){
      this.runned = 0;
      this.result_test = 0;
      this.running = true;
      this.result_log = "";
      if (arch_type === 32){
        SailTest32();
      } else {
        SailTest64();
      }
    },
    updateState(){
      this.result_test = document.app.$data.passed_test;
      if (this.result_test + document.app.$data.failed_test === ((architecture.config.name === 'SRV32' ? 89 : 122)) ){
        this.result_log = "Validation completed.\n Your architecture passed the " + (this.result_test / (architecture.config.name === 'SRV32' ? 89 : 122)) * 100 + "%\n of the validation tests.";
      }
        
    },
    resetValidationState(){
      this.runned = 0;
      this.result_test = 0;
      this.running = true;
      this.result_log = "";
      document.app.$data.passed_test = 0;
      document.app.$data.failed_test = 0;
      document.app.$data.testing = false;
    },
  },
  mounted(){
    coreEvents.on("update-validation", this.updateState);
  },
  beforeUnmount() {
    coreEvents.off("update-validation", this.updateState);
    
  },
});
</script>

<template>
  <div class="architecture-view" id="architecture_menu">
    <!-- Edit architecture modal -->
    <EditArchitecture
      id="edit_architecture"
      :arch_code="arch_code"
      :dark="dark"
      :os="os"
    />

    <!-- Download architecture modal -->
    <DownloadPopup
      id="save_architecture"
      type="architecture"
      title="Download Architecture"
      extension=".yml"
      :fileData="archCodeWSchema"
      default-filename="architecture"
    />

    <!-- Architecture information with side-by-side layout -->
    <div class="architecture-layout">
      <!-- Left Sidebar: Overview -->
      <div class="sidebar-left">
        <!-- Architecture Guide Link -->
        <div v-if="architecture_guide" class="architecture-guide-link">
          <a :href="architecture_guide" target="_blank" class="guide-link">
            <font-awesome-icon :icon="['fas', 'file-pdf']" />
            <span>{{ architecture_name }} Guide</span>
            <font-awesome-icon
              :icon="['fas', 'external-link-alt']"
              class="external-icon"
            />
          </a>
        </div>
        <b-card no-body class="overview-card mb-3">
          <b-card-body class="p-3">
            <ArchConf :conf="architecture.config" />
          </b-card-body>
        </b-card>
      </div>

      <!-- Main Content Area: Instructions & ISA -->
      <div class="main-content">
        <!-- View selector as buttons -->
        <div class="architecture-view-selector">
          <div class="tabs-container">
            <!-- Instructions Tab -->
            <button
              :class="['tab', { active: activeTab === 'instructions' }]"
              @click="activeTab = 'instructions'"
            >
              <font-awesome-icon :icon="['fas', 'code']" />
              <span>Instructions</span>
            </button>
            <!-- Pseudoinstruction Tab -->
            <button
              v-if="
                architecture.pseudoinstructions &&
                architecture.pseudoinstructions.length > 0
              "
              :class="['tab', { active: activeTab === 'pseudoinstructions' }]"
              @click="activeTab = 'pseudoinstructions'"
            >
              <font-awesome-icon :icon="['fas', 'layer-group']" />
              <span>Pseudoinstructions</span>
            </button>
            <!-- Directives Tab -->
            <button
              v-if="
                architecture.directives && architecture.directives.length > 0
              "
              :class="['tab', { active: activeTab === 'directives' }]"
              @click="activeTab = 'directives'"
            >
              <font-awesome-icon :icon="['fas', 'cogs']" />
              <span>Assembler Directives</span>
            </button>
            <!-- Registers Tab -->
            <button
              :class="['tab', { active: activeTab === 'registers' }]"
              @click="activeTab = 'registers'"
            >
              <font-awesome-icon :icon="['fas', 'database']" />
              <span>Registers</span>
            </button>


            <!-- Pseudoinstruction Tab -->
            <button
              v-if="
                architecture.config.name === 'SRV32' || architecture.config.name === 'SRV64'
              "
              :class="['tab', { active: activeTab === 'cache' }]"
              @click="activeTab = 'cache'"
            >
              <font-awesome-icon :icon="['fas', 'memory']" />
              <!-- <font-awesome-icon :icon="['fas', 'layer-group']" /> -->
              <span>Cache Memory</span>
            </button>

            <!-- Validation Architecture Tab -->
            <button
              v-if="
                architecture.config.name === 'SRV32' || architecture.config.name === 'SRV64'
              "
              :class="['tab', { active: validate === true }]"
              v-b-modal.showValidationModal
            >
              <font-awesome-icon :icon="['fas', 'check']" />
              <!-- <font-awesome-icon :icon="['fas', 'layer-group']" /> -->
              <span>Validation</span>
            </button>
          </div>
        </div>

        <div class="isa-content">
          <!-- Instruction definition -->
          <div v-if="activeTab === 'instructions'">
            <Instructions :instructions="architecture.instructions" />
          </div>
          <!-- Pseudoinstruction definition -->
          <div v-if="activeTab === 'pseudoinstructions'">
            <Pseudoinstructions
              :pseudoinstructions="architecture.pseudoinstructions"
            />
          </div>
          <!-- Directives definition -->
          <div v-if="activeTab === 'directives'">
            <Directives :directives="architecture.directives" />
          </div>
          <!-- Registers -->
          <div v-if="activeTab === 'registers'">
            <RegisterFileArch :register_file="architecture.register_files" />
          </div>
          <!-- Cache Memory Configuration -->
          <div v-if="activeTab === 'cache'">
            <CacheMemory
                :cachetype="$root.$data.cache_type"
                :L1_I_num_lines="$root.$data.L1_I_num_lines"
                :L1_I_size_block="$root.$data.L1_I_size_block"
                :L1_I_size="$root.$data.L1_I_size"
                :L1_D_num_lines="$root.$data.L1_D_num_lines"
                :L1_D_size_block="$root.$data.L1_D_size_block"
                :L1_D_size="$root.$data.L1_D_size"
                :L1_num_lines="$root.$data.L1_num_lines"
                :L1_size_block="$root.$data.L1_size_block"
                :L1_size="$root.$data.L1_size"
                :L2_I_num_lines="$root.$data.L2_I_num_lines"
                :L2_I_size_block="$root.$data.L2_I_size_block"
                :L2_I_size="$root.$data.L2_I_size"
                :L2_D_num_lines="$root.$data.L2_D_num_lines"
                :L2_D_size_block="$root.$data.L2_D_size_block"
                :L2_D_size="$root.$data.L2_D_size"
                :L2_num_lines="$root.$data.L2_num_lines"
                :L2_size_block="$root.$data.L2_size_block"
                :L2_size="$root.$data.L2_size"
                :cache_location="$root.$data.cache_location"
                :cache_policy="$root.$data.cache_policy"
            ></CacheMemory>
          </div>
          <b-modal
            id="showValidationModal"
            :title="'Validation test for ' + (architecture.config.name === 'SRV32' ? 32 : 64) + ' bits architecture'"
            @ok="resetValidationState">
            This validation test runs {{(architecture.config.name === 'SRV32' ? 89 : 122)}} RISC-V programs. <br>
            These programs are taken from the official RISC-V test repository (<a href="https://github.com/riscv-software-src/riscv-tests" target="_blank" rel="noopener noreferrer">riscv-tests</a>), where the correct operation <br> 
            of the full instruction set of the RISC-V specification is verified.
            <br><br>
            <b-container>
              <b-row>
                <b-col cols="4">
                  <b-button variant="outline-primary"
                  v-on:click="runValidationTest(architecture.config.name === 'SRV32' ? 32 : 64)"
                  >Run tests</b-button>
                </b-col>
                <b-col cols="8">
                  <b-progress animated
                  v-if="running"
                  :value="result_test"
                  :max="architecture.config.name === 'SRV32' ? 89 : 122"
                  >
                  </b-progress><br>
                  <div v-if="result_log !== ''" style="white-space: pre-line;">{{ result_log }}</div>
                </b-col>
              </b-row>

            </b-container>
        
        </b-modal>
          
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.architecture-view {
  height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.architecture-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 0;
  height: 100%;
  overflow: hidden;
}

.sidebar-left {
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: 1px solid rgba(0, 0, 0, 0.07);
  background-color: var(--bs-body-bg);

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;

    &:hover {
      background: rgba(0, 0, 0, 0.3);
    }
  }

  .card {
    border-radius: 0;
    border: none;
    border-bottom: 1px solid rgba(0, 0, 0, 0.07);

    .card-header {
      background-color: transparent;
      border-bottom: 1px solid rgba(0, 0, 0, 0.07);
      padding: 8px 12px;
      font-weight: 600;
      font-size: 0.8125rem;

      h5,
      h6 {
        color: rgba(0, 0, 0, 0.8);
        font-size: 0.8125rem;
        font-weight: 600;
      }

      i {
        margin-right: 6px;
        font-size: 0.875rem;
      }
    }

    .card-body {
      max-height: none;
      overflow-y: auto;
      padding: 12px;
    }
  }
}

.architecture-guide-link {
  padding: 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);

  .guide-link {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: var(--bs-primary);
    color: white;
    text-decoration: none;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    transition: all 0.2s ease;

    &:hover {
      background: color-mix(in srgb, var(--bs-primary) 90%, black);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }

    .external-icon {
      margin-left: auto;
      font-size: 0.75rem;
      opacity: 0.8;
    }

    svg:first-child {
      font-size: 1rem;
    }
  }
}

.main-content {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bs-body-bg);
}

.architecture-view-selector {
  width: 100%;
  user-select: none;
}

.tabs-container {
  display: flex;
  gap: 0.25rem;
  padding: 6px;
  background: transparent;
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);
  overflow: hidden;
}

.isa-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  > div {
    height: 100%;
    overflow: auto;

    &::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 5px;

      &:hover {
        background: rgba(0, 0, 0, 0.3);
      }
    }
  }
}

[data-bs-theme="dark"] {
  .sidebar-left {
    border-right-color: rgba(255, 255, 255, 0.12);

    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);

      &:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    }

    .card {
      border-bottom-color: rgba(255, 255, 255, 0.12);

      .card-header {
        border-bottom-color: rgba(255, 255, 255, 0.12);

        h5,
        h6 {
          color: rgba(255, 255, 255, 0.9);
        }
      }
    }
  }

  .architecture-guide-link {
    border-bottom-color: rgba(255, 255, 255, 0.12);
  }

  .tabs-container {
    border-bottom-color: rgba(255, 255, 255, 0.12);
  }

  .isa-content > div {
    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);

      &:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    }
  }
}

// Responsive breakpoints
@media (max-width: 1400px) {
  .architecture-layout {
    grid-template-columns: 280px 1fr;
  }
}

@media (max-width: 1200px) {
  .architecture-layout {
    grid-template-columns: 240px 1fr;
  }
}
</style>
