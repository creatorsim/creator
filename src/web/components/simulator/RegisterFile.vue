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
import { REGISTERS } from "@/core/core.mjs";
import { coreEvents } from "../../../core/events.mts";
import { clearAllRegisterGlows } from "@/core/register/registerGlowState.mjs";

import Register from "./Register.vue";
import RegisterSpaceView from "./RegisterSpaceView.vue";
import { useToggle } from "bootstrap-vue-next";
import { defineComponent } from "vue";

export default defineComponent({
  props: {
    data_mode: { type: String, required: true },
    reg_name_representation: { type: String, required: true },
    dark: { type: Boolean, required: true },
  },

  components: {
    Register,
    RegisterSpaceView,
  },

  setup() {
    const { show } = useToggle("registerSpaceView");
    return { showSpaceView: show };
  },

  data() {
    return {
      register_file: REGISTERS,

      // space modal
      spaceItem: null as RegisterDetailsItem | null,
      spaceView: false,

      // collapsible state for each register bank
      collapsedBanks: {} as Record<string, boolean>,

      // per-bank visualization preferences
      bankVisualizations: {} as Record<string, string>,

      // dropdown state
      openDropdown: null as string | null,

      // visualization options
      reg_representation_int_options: [
        { text: "Signed", value: "signed" },
        { text: "Unsigned", value: "unsigned" },
        { text: "Hex", value: "hex" },
      ],
      reg_representation_float_options: [
        { text: "IEEE 754 (32b)", value: "ieee32" },
        { text: "IEEE 754 (64b)", value: "ieee64" },
        { text: "Hex", value: "hex" },
      ],
    };
  },

  mounted() {
    // Initialize all banks as expanded and set default visualizations
    this.register_file.forEach((bank: any) => {
      this.collapsedBanks[bank.name] = false;
    });

    // Subscribe to register update events from core
    coreEvents.on("register-updated", this.onRegisterUpdated);
    coreEvents.on("registers-reset", this.onRegistersReset);
    coreEvents.on("step-about-to-execute", this.clearAllGlows);

    // Close dropdown when clicking outside
    document.addEventListener("click", this.handleClickOutside);
  },

  beforeUnmount() {
    // Clean up event listeners
    coreEvents.off("register-updated", this.onRegisterUpdated);
    coreEvents.off("registers-reset", this.onRegistersReset);
    coreEvents.off("step-about-to-execute", this.clearAllGlows);
    document.removeEventListener("click", this.handleClickOutside);
  },

  methods: {
    onRegisterUpdated(payload: any) {
      const { indexComp, indexElem } = payload;
      const register = REGISTERS[indexComp]?.registers[indexElem];

      if (!register) return;

      // Update the specific register component
      const refs = this.$refs[`reg${register.name[0]}`] as any;
      refs?.at?.(0)?.refresh();

      // If the space view modal is showing this register, refresh it
      if (
        this.spaceItem &&
        this.spaceItem.indexComp === indexComp &&
        this.spaceItem.indexElem === indexElem
      ) {
        refs?.at?.(0)?.showDetails();
      }
    },

    onRegistersReset() {
      // Refresh all register components when registers are reset
      for (const bank of REGISTERS) {
        for (const reg of bank.registers) {
          const refs = this.$refs[`reg${reg.name[0]}`] as any;
          refs?.at?.(0)?.refresh();
        }
      }
    },

    clearAllGlows() {
      // Clear glow effect from all registers (called before executing next instruction)
      // Clear from persistent store
      clearAllRegisterGlows();

      // Clear from all currently mounted register components
      for (const bank of REGISTERS) {
        for (const reg of bank.registers) {
          const refs = this.$refs[`reg${reg.name[0]}`] as any;
          refs?.at?.(0)?.clearGlow();
        }
      }
    },

    toggleBank(bankName: string) {
      this.collapsedBanks[bankName] = !this.collapsedBanks[bankName];
    },

    isBankCollapsed(bankName: string): boolean {
      return this.collapsedBanks[bankName] || false;
    },

    setBankVisualization(bankName: string, value: string) {
      this.bankVisualizations[bankName] = value;
      this.openDropdown = null;
    },

    getBankVisualization(bank: any): string {
      // Return bank-specific visualization if set, otherwise use hex as default
      return this.bankVisualizations[bank.name] || "hex";
    },

    getBankVisualizationOptions(bank: any) {
      // Return appropriate options based on bank type
      return bank.type.includes("float") || bank.type.includes("fp")
        ? this.reg_representation_float_options
        : this.reg_representation_int_options;
    },

    isBankFloatingPoint(bank: any): boolean {
      return bank.type.includes("float") || bank.type.includes("fp");
    },

    toggleVisualizationDropdown(bankName: string) {
      if (this.openDropdown === bankName) {
        this.openDropdown = null;
      } else {
        this.openDropdown = bankName;
      }
    },

    handleClickOutside(event: Event) {
      const target = event.target as HTMLElement;
      if (!target.closest(".bank-viz-dropdown")) {
        this.openDropdown = null;
      }
    },
  },
});
</script>

<template>
  <b-container
    fluid
    align-h="center"
    class="mx-0 px-0 my-0 register-file-container"
  >
    <b-row align-h="center" cols="1" class="register-file-content">
      <b-col v-for="bank in register_file" :key="bank.name">
        <b-container fluid>
          <!-- Register bank name with collapse button -->
          <b-row class="align-items-center">
            <b-col>
              <div class="bank-header-container">
                <button
                  class="bank-header"
                  @click="toggleBank(bank.name)"
                  :aria-expanded="!isBankCollapsed(bank.name)"
                >
                  <font-awesome-icon
                    :icon="[
                      'fas',
                      isBankCollapsed(bank.name)
                        ? 'chevron-right'
                        : 'chevron-down',
                    ]"
                    class="collapse-icon"
                  />
                  <h5 class="mb-0 bank-title">{{ bank.name }}</h5>
                </button>

                <!-- Visualization dropdown -->
                <div class="bank-viz-dropdown" @click.stop>
                  <button
                    class="viz-dropdown-toggle"
                    :class="{ 'is-open': openDropdown === bank.name }"
                    @click="toggleVisualizationDropdown(bank.name)"
                  >
                    {{
                      getBankVisualizationOptions(bank).find(
                        opt => opt.value === getBankVisualization(bank),
                      )?.text || "Format"
                    }}
                    <font-awesome-icon
                      :icon="['fas', 'chevron-down']"
                      class="dropdown-chevron"
                    />
                  </button>
                  <div
                    v-if="openDropdown === bank.name"
                    class="viz-dropdown-menu"
                  >
                    <button
                      v-for="option in getBankVisualizationOptions(bank)"
                      :key="option.value"
                      class="viz-dropdown-item"
                      :class="{
                        'is-active':
                          getBankVisualization(bank) === option.value,
                      }"
                      @click="setBankVisualization(bank.name, option.value)"
                    >
                      {{ option.text }}
                    </button>
                  </div>
                </div>
              </div>
            </b-col>
          </b-row>

          <!-- Collapsible register content -->
          <b-collapse :visible="!isBankCollapsed(bank.name)">
            <b-row
              align-h="start"
              cols="2"
              cols-sm="3"
              cols-md="3"
              cols-lg="4"
              cols-xl="5"
            >
              <b-col
                class="p-1 mx-0"
                v-for="(register, regIndex) in bank.registers"
                :key="register.name[0]"
              >
                <Register
                  :type="bank.type"
                  :double_precision="bank.double_precision"
                  :register="register"
                  :name_representation="reg_name_representation"
                  :value_representation="getBankVisualization(bank)"
                  :indexComp="register_file.indexOf(bank)"
                  :indexElem="regIndex"
                  :ref="`reg${register.name[0]}`"
                  @register-details="
                    (item: RegisterDetailsItem) => {
                      spaceItem = item;
                      showSpaceView();
                    }
                  "
                />
              </b-col>
            </b-row>
          </b-collapse>
        </b-container>
      </b-col>
    </b-row>
  </b-container>

  <!-- Space view -->
  <!--
  I'd like to have this information as a popover in the register, like in
  CREATOR 5, but unfortunately this creates so many components Vue craps its
  pants, so we'll have to use a modal.
  If you'd like to check how it was before, go to Register.vue on commit
  8fddb81c.
  -->
  <RegisterSpaceView id="registerSpaceView" :item="spaceItem" />
</template>

<style scoped>
.register-file-container {
  height: 100%;
  max-height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgba(139, 148, 158, 0.3) transparent;
  padding: 0;
  margin: 0;
}

.register-file-container::-webkit-scrollbar {
  width: 8px;
}

.register-file-container::-webkit-scrollbar-track {
  background: transparent;
}

.register-file-container::-webkit-scrollbar-thumb {
  background-color: rgba(139, 148, 158, 0.3);
  border-radius: 4px;
}

.register-file-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(139, 148, 158, 0.5);
}

.register-file-content {
  min-height: min-content;
}

/* Bank header container with dropdown */
.bank-header-container {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.bank-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  padding: 4px 8px;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  border-radius: 6px;
  transition: all 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
  text-align: left;
}

.bank-header:hover {
  background-color: color-mix(in srgb, currentColor 10%, transparent);
}

.bank-header:active {
  background-color: color-mix(in srgb, currentColor 15%, transparent);
}

.bank-header:focus-visible {
  outline: 2px solid color-mix(in srgb, currentColor 50%, transparent);
  outline-offset: 2px;
}

.collapse-icon {
  font-size: 12px;
  opacity: 0.7;
  transition: transform 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.bank-title {
  flex: 1;
  font-weight: 600;
  user-select: none;
}

/* Visualization dropdown styling */
.bank-viz-dropdown {
  position: relative;
  flex-shrink: 0;
}

.viz-dropdown-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  padding: 4px 8px;
  border-radius: 6px;
  border: none;
  font-weight: 600;
  font-size: 0.75rem;
  font-family: inherit;
  color: rgba(0, 0, 0, 0.8);
  background-color: rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
  user-select: none;
}

.viz-dropdown-toggle:hover {
  background-color: rgba(0, 0, 0, 0.15);
}

.viz-dropdown-toggle:active,
.viz-dropdown-toggle.is-open {
  background-color: rgba(0, 0, 0, 0.2);
}

.viz-dropdown-toggle:focus-visible {
  outline: 2px solid rgba(0, 0, 0, 0.5);
  outline-offset: 2px;
}

.dropdown-chevron {
  font-size: 10px;
  opacity: 0.7;
  transition: transform 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.viz-dropdown-toggle.is-open .dropdown-chevron {
  transform: rotate(180deg);
}

.viz-dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 140px;
  background: white;
  border-radius: 8px;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.12),
    0 4px 16px rgba(0, 0, 0, 0.08);
  padding: 6px;
  z-index: 1000;
  overflow: hidden;
}

.viz-dropdown-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: rgba(0, 0, 0, 0.8);
  font-family: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: none;
  font-weight: 400;
  border-radius: 4px;
  margin-bottom: 2px;
}

.viz-dropdown-item:last-child {
  margin-bottom: 0;
}

.viz-dropdown-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.viz-dropdown-item:active {
  background-color: rgba(0, 0, 0, 0.1);
}

.viz-dropdown-item.is-active {
  background-color: rgba(0, 123, 255, 0.1);
  color: #0056b3;
  font-weight: 600;
}

/* Dark theme support */
[data-bs-theme="dark"] {
  .bank-header:hover {
    background-color: color-mix(in srgb, currentColor 15%, transparent);
  }

  .bank-header:active {
    background-color: color-mix(in srgb, currentColor 20%, transparent);
  }

  .viz-dropdown-toggle {
    color: rgba(255, 255, 255, 0.9);
    background-color: rgba(255, 255, 255, 0.1);
  }

  .viz-dropdown-toggle:hover {
    background-color: rgba(255, 255, 255, 0.15);
  }

  .viz-dropdown-toggle:active,
  .viz-dropdown-toggle.is-open {
    background-color: rgba(255, 255, 255, 0.2);
  }

  .viz-dropdown-toggle:focus-visible {
    outline-color: rgba(255, 255, 255, 0.5);
  }

  .viz-dropdown-menu {
    background: #2d2d2d;
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(255, 255, 255, 0.1);
  }

  .viz-dropdown-item {
    color: rgba(255, 255, 255, 0.9);
  }

  .viz-dropdown-item:hover {
    background-color: rgba(255, 255, 255, 0.08);
  }

  .viz-dropdown-item:active {
    background-color: rgba(255, 255, 255, 0.12);
  }

  .viz-dropdown-item.is-active {
    background-color: rgba(99, 179, 237, 0.2);
    color: #63b3ed;
  }
}
</style>
