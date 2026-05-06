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
import { defineComponent } from "vue";

import { creator_ga } from "@/core/utils/creator_ga.mjs";
import { loadedCreatino } from "@/core/core.mjs";

export default defineComponent({
  props: {
    data_mode: { type: String, required: true },
    register_file_num: { type: Number, required: true },
    dark: { type: Boolean, required: true },
    enter: { type: [Boolean, null] as any, required: true },
    architecture_name: { type: String, required: true },
  },

  computed: {
    current_reg_type: {
      // sync with App's data_mode
      get() {
        return this.data_mode;
      },
      set(value: string) {
        (this.$root as any).data_mode = value;

        /* Google Analytics */
        creator_ga("send", "event", "data.view." + value);
      },
    },
    current_reg_name() {
      switch (this.current_reg_type) {
        case "int":
          return "INT/Ctrl Registers";
        case "float":
          return "FP Registers";
        case "v_registers":
          return "Vector Registers";
        case "csr_registers":
          return "Control state Registers";

        default:
          return "";
      }
    },
    isWaitingForInput() {
      return this.enter === false;
    },
    isCreatinoUp() {
      return loadedCreatino;
    },
  },

  data() {
    return {
      reg_representation_options: [
        { text: "INT/Ctrl Registers", value: "int" },
        { text: "FP Registers", value: "float" },
        { text: "Vector Registers", value: "v_registers" },
        { text: "Control state Registers", value: "csr_registers" },
      ],
      dropdownOpen: false,
    };
  },

  mounted() {
    // Close dropdown when clicking outside
    document.addEventListener("click", this.handleClickOutside);
  },

  beforeUnmount() {
    document.removeEventListener("click", this.handleClickOutside);
  },

  methods: {
    change_data_view(e: string) {
      this.current_reg_type = e;
      this.dropdownOpen = false;
    },

    toggleDropdown(event: Event) {
      event.stopPropagation();
      this.dropdownOpen = !this.dropdownOpen;
    },

    handleClickOutside(event: Event) {
      const target = event.target as HTMLElement;
      if (!target.closest(".tab-dropdown")) {
        this.dropdownOpen = false;
      }
    },

    getVariant(): "secondary" | "outline-secondary" {
      if (
        this.current_reg_type === "int" ||
        this.current_reg_type === "float" || 
        this.current_reg_type === "v_registers" || 
        this.current_reg_type === "csr_registers"
      ) {
        return "secondary";
      }

      return "outline-secondary";
    },

    isSelected(button: string): boolean {
      return button === this.current_reg_type;
    },
  },
});
</script>

<template>
  <div class="data-view-selector">
    <div class="tabs-container">
      <!-- Registers Tab -->
      <button
        v-if="register_file_num <= 5"
        :class="['tab', { active: current_reg_type === 'int' }]"
        @click="change_data_view('int')"
      >
        <font-awesome-icon :icon="['fas', 'microchip']" />
        <span>Registers</span>
      </button>

      <!-- Dropdown for multiple register banks -->
      <div v-if="register_file_num > 5" class="tab-dropdown">
        <button
          :class="[
            'tab',
            {
              active:
                current_reg_type === 'int' ||
                current_reg_type === 'float' ||
                current_reg_type === 'v_registers' ||
                current_reg_type === 'csr_registers',
            },
          ]"
          @click="toggleDropdown"
        >
          <font-awesome-icon :icon="['fas', 'microchip']" />
          <span>{{ current_reg_name }}</span>
          <font-awesome-icon
            :icon="['fas', 'chevron-down']"
            class="dropdown-icon"
          />
        </button>
        <div v-if="dropdownOpen" class="dropdown-menu">
          <button
            class="dropdown-item"
            @click="change_data_view('int')"
          >
            CPU-INT/Ctrl Registers
          </button>
          <button
            class="dropdown-item"
            @click="change_data_view('foat')"
          >
            CPU-FP Registers
          </button>
          <button
            class="dropdown-item"
            @click="change_data_view('v_registers')"
          >
            CPU-V Registers
          </button>
          <button
            class="dropdown-item"
            @click="change_data_view('csr_registers')"
          >
            CPU-CSR Registers
          </button>
        </div>
      </div>

      <!-- Memory Tab -->
      <button
        :class="['tab', { active: current_reg_type === 'memory' }]"
        @click="change_data_view('memory')"
      >
        <font-awesome-icon :icon="['fas', 'memory']" /> <span>Memory</span>
      </button>

      <!-- Terminal Tab -->
      <button
        :class="[
          'tab',
          {
            active: current_reg_type === 'terminal',
            'flash-attention': isWaitingForInput,
          },
        ]"
        @click="change_data_view('terminal')"
      >
        <font-awesome-icon :icon="['fas', 'terminal']" /> <span>Terminal</span>
      </button>

      <!-- Statistics Tab -->
      <button
        :class="['tab', { active: current_reg_type === 'stats' }]"
        @click="change_data_view('stats')"
      >
        <font-awesome-icon :icon="['fas', 'chart-line']" />
        <span>Statistics</span>
      </button>

      <!-- Arduino Tab -->
      <button
        v-if="architecture_name.includes('RV32') && isCreatinoUp"
        :class="['tab', { active: current_reg_type === 'arduino', border: dark }]"
        @click="change_data_view('arduino')"
      >
        <font-awesome-icon :icon="['fas', 'infinity']" />
        <span>Arduino</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.data-view-selector {
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

/* Flash animation for terminal button when waiting for input */
@keyframes flash-pulse {
  0%,
  100% {
    background-color: color-mix(in srgb, #58a6ff 20%, transparent);
    box-shadow: 0 0 0 0 rgba(88, 166, 255, 0);
  }
  50% {
    background-color: color-mix(in srgb, #58a6ff 35%, transparent);
    box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.2);
  }
}

.flash-attention {
  animation: flash-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  color: #58a6ff;
}

.flash-attention .svg-inline--fa {
  color: #58a6ff;
}

/* Dark theme support */
[data-bs-theme="dark"] {
  .tabs-container {
    border-bottom-color: rgba(255, 255, 255, 0.12);
  }

  .tab-separator {
    color: rgba(255, 255, 255, 0.15);
  }

  .dropdown-menu {
    background: #2d2d2d;
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(255, 255, 255, 0.1);
  }

  .dropdown-item {
    color: rgba(255, 255, 255, 0.9);
  }
}
</style>
