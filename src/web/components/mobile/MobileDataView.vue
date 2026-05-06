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
import { architecture } from "@/core/core.mjs";
import { main_memory } from "@/core/core";
import { type Device, devices } from "@/core/executor/devices.mts";

import RegisterFile from "../simulator/RegisterFile.vue";
import HexViewer from "../simulator/HexViewer.vue";
import Stats from "../simulator/Stats.vue";
import Terminal from "../simulator/Terminal.vue";

export default defineComponent({
  props: {
    data_mode: { type: String, required: true },
    reg_name_representation: { type: String, required: true },
    stat_representation: { type: String, required: true },
    stat_type: { type: String, required: true },
    memory_segment: { type: String, required: true },
    display: { type: String, required: true },
    keyboard: { type: String, required: true },
    enter: { type: [Boolean, null], required: true },
    dark: { type: Boolean, required: true },
    caller_frame: Object as PropType<StackFrame>,
    callee_frame: Object as PropType<StackFrame>,
    mobile_data_view: {
      type: String as PropType<"registers" | "memory" | "stats" | "console">,
      required: true,
    },
  },

  emits: ["update:mobile_data_view"],

  components: {
    RegisterFile,
    HexViewer,
    Stats,
    Terminal,
  },

  data() {
    return {
      architecture,
      main_memory: main_memory as any,
      devices: devices as Map<string, any>,
    };
  },

  computed: {
    currentView: {
      get() {
        return this.mobile_data_view;
      },
      set(value: string) {
        this.$emit("update:mobile_data_view", value);
      },
    },
  },

  methods: {
    switchView(view: "registers" | "memory" | "stats" | "console") {
      this.currentView = view;
    },

    getViewIcon(view: string) {
      switch (view) {
        case "registers":
          return ["fas", "microchip"];
        case "memory":
          return ["fas", "memory"];
        case "stats":
          return ["fas", "chart-line"];
        case "console":
          return ["fas", "terminal"];
        default:
          return ["fas", "database"];
      }
    },

    getViewLabel(view: string) {
      switch (view) {
        case "registers":
          return "Registers";
        case "memory":
          return "Memory";
        case "stats":
          return "Statistics";
        case "console":
          return "Console";
        default:
          return "Data View";
      }
    },
  },
});
</script>

<template>
  <div class="mobile-data-view">
    <div class="mobile-data-header">
      <h3 class="data-title">
        <font-awesome-icon :icon="getViewIcon(currentView)" />
        {{ getViewLabel(currentView) }}
      </h3>

      <b-dropdown
        variant="outline-secondary"
        size="sm"
        title="Switch View"
        no-caret
      >
        <template #button-content>
          <font-awesome-icon :icon="['fas', 'bars']" />
        </template>
        <b-dropdown-item @click="switchView('registers')">
          <font-awesome-icon :icon="['fas', 'microchip']" /> Registers
        </b-dropdown-item>
        <b-dropdown-item @click="switchView('memory')">
          <font-awesome-icon :icon="['fas', 'memory']" /> Memory
        </b-dropdown-item>
        <b-dropdown-item @click="switchView('stats')">
          <font-awesome-icon :icon="['fas', 'chart-line']" /> Statistics
        </b-dropdown-item>
        <b-dropdown-item @click="switchView('console')">
          <font-awesome-icon :icon="['fas', 'terminal']" /> Console
        </b-dropdown-item>
      </b-dropdown>
    </div>

    <div
      class="mobile-data-content"
      :class="{ 'terminal-view': currentView === 'console' }"
    >
      <!-- Data Content Area -->
      <!-- Registers view -->
      <div v-if="currentView === 'registers'" class="data-section">
        <RegisterFile
          ref="registerFile"
          :data_mode="'int'"
          :reg_name_representation="reg_name_representation"
          :dark="dark"
        />
      </div>

      <!-- Memory view-->
      <div v-if="currentView === 'memory'" class="data-section">
        <HexViewer
          :main_memory="main_memory"
          :devices="devices"
          :segment="memory_segment"
        />
      </div>

      <!-- Stats view-->
      <div v-if="currentView === 'stats'" class="data-section">
        <Stats
          :dark="dark"
          :representation="stat_representation"
          :type="stat_type"
        />
      </div>

      <!-- Console view-->
      <div v-if="currentView === 'console'" class="data-section">
        <Terminal :display="display" :keyboard="keyboard" :enter="enter" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.mobile-data-view {
  position: fixed;
  top: env(safe-area-inset-top);
  left: 0;
  right: 0;
  bottom: calc(
    56px + env(safe-area-inset-bottom)
  ); // Above mobile navbar + safe area

  // Reduce bottom spacing on very small screens to match navbar height
  @media (max-width: 320px) {
    bottom: calc(48px + env(safe-area-inset-bottom));
  }
  background-color: var(--bs-body-bg);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none; // Prevent text selection on mobile

  // Dark mode support
  [data-bs-theme="dark"] & {
    background-color: hsl(214, 9%, 12%);
  }
}

.mobile-data-header {
  padding: 0.5rem;
  border-bottom: 1px solid var(--bs-border-color);
  background-color: var(--bs-body-bg);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;

  .data-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--bs-body-color);
    display: flex;
    align-items: center;
    gap: 0.5rem;

    svg {
      color: var(--bs-primary);
    }
  }
}

.mobile-data-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 0;
}

.data-section {
  height: 100%;
  padding: 0;
}

// Mobile optimizations
@media (max-width: 480px) {
  .mobile-data-header {
    padding: 0.5rem;

    .data-title {
      font-size: 1.1rem;
    }
  }

  .mobile-data-content {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }

  .terminal-view {
    padding-left: 0;
    padding-right: 0;
  }
}

// Touch-friendly interactions
@media (hover: none) and (pointer: coarse) {
  // Dropdown button should be touch-friendly
  .mobile-data-header {
    :deep(.dropdown-toggle) {
      min-height: 44px; // Minimum touch target
      min-width: 44px;
    }
  }
}
</style>
