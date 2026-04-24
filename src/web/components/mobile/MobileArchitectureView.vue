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
import available_arch from "../../../../architecture/available_arch.json";

import EditArchitecture from "../architecture/EditArchitecture.vue";
import DownloadPopup from "../general/DownloadModal.vue";
import ArchConf from "../architecture/configuration/ArchConf.vue";
import RegisterFileArch from "../architecture/register_file/RegisterFileArch.vue";
import Instructions from "../architecture/instructions/Instructions.vue";
import Directives from "../architecture/directives/Directives.vue";
import Pseudoinstructions from "../architecture/pseudoinstructions/Pseudoinstructions.vue";

export default defineComponent({
  props: {
    browser: { type: String, required: true },
    os: { type: String, required: true },
    arch_available: Array as PropType<AvailableArch[]>,
    architecture_name: String,
    dark: { type: Boolean, required: true },
    arch_code: { type: String, required: true },
    mobile_architecture_view: {
      type: String as PropType<
        | "arch-info"
        | "register-file"
        | "instructions"
        | "pseudoinstructions"
        | "directives"
      >,
      required: true,
    },
  },
  emits: ["update:mobile_architecture_view"],
  components: {
    EditArchitecture,
    DownloadPopup,
    ArchConf,
    RegisterFileArch,
    Instructions,
    Directives,
    Pseudoinstructions,
  },
  data() {
    return {
      architecture,
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

    currentView: {
      get() {
        return this.mobile_architecture_view;
      },
      set(value: string) {
        this.$emit("update:mobile_architecture_view", value);
      },
    },

    availableViews() {
      const views = [
        {
          key: "arch-info",
          label: "Architecture Info",
          icon: ["fas", "info-circle"],
        },
        {
          key: "register-file",
          label: "Register File",
          icon: ["fas", "database"],
        },
        { key: "instructions", label: "Instructions", icon: ["fas", "code"] },
        { key: "directives", label: "Directives", icon: ["fas", "cogs"] },
      ];

      // Only include pseudoinstructions if they exist
      if (
        architecture.pseudoinstructions &&
        architecture.pseudoinstructions.length > 0
      ) {
        views.splice(3, 0, {
          key: "pseudoinstructions",
          label: "Pseudoinstructions",
          icon: ["fas", "magic"],
        });
      }

      return views;
    },
  },
  methods: {
    switchView(view: string) {
      this.currentView = view as
        | "arch-info"
        | "register-file"
        | "instructions"
        | "pseudoinstructions"
        | "directives";
    },

    getCurrentViewInfo() {
      return this.availableViews.find(view => view.key === this.currentView);
    },
  },
});
</script>

<template>
  <div class="mobile-architecture-view">
    <div class="mobile-architecture-header">
      <h3 class="architecture-title">
        <font-awesome-icon
          :icon="getCurrentViewInfo()?.icon || ['fas', 'database']"
        />
        {{ getCurrentViewInfo()?.label || "Architecture View" }}
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
        <b-dropdown-item
          v-for="view in availableViews"
          :key="view.key"
          @click="switchView(view.key)"
        >
          <font-awesome-icon :icon="view.icon" /> {{ view.label }}
        </b-dropdown-item>
      </b-dropdown>
    </div>

    <div class="mobile-architecture-content">
      <!-- Architecture content area -->

      <!-- Architecture Info view -->
      <div v-if="currentView === 'arch-info'" class="architecture-section">
        <!-- Architecture Guide Link -->
        <a
          v-if="architecture_guide"
          :href="architecture_guide"
          target="_blank"
          class="mobile-guide-link"
        >
          <font-awesome-icon :icon="['fas', 'file-pdf']" />
          <span>{{ architecture_name }} Guide</span>
          <font-awesome-icon
            :icon="['fas', 'external-link-alt']"
            class="external-icon"
          />
        </a>
        <ArchConf :conf="architecture.config" />
      </div>

      <!-- Register File view -->
      <div v-if="currentView === 'register-file'" class="architecture-section">
        <RegisterFileArch :register_file="architecture.register_files" />
      </div>

      <!-- Instructions view -->
      <div v-if="currentView === 'instructions'" class="architecture-section">
        <Instructions :instructions="architecture.instructions" />
      </div>

      <!-- Pseudoinstructions view -->
      <div
        v-if="currentView === 'pseudoinstructions'"
        class="architecture-section"
      >
        <Pseudoinstructions
          :pseudoinstructions="architecture.pseudoinstructions"
        />
      </div>

      <!-- Directives view -->
      <div v-if="currentView === 'directives'" class="architecture-section">
        <Directives :directives="architecture.directives" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.mobile-architecture-view {
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

.mobile-architecture-header {
  padding: 0.5rem;
  border-bottom: 1px solid var(--bs-border-color);
  background-color: var(--bs-body-bg);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;

  .architecture-title {
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

.mobile-architecture-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 0;
}

.architecture-section {
  height: 100%;
  padding: 0;
}

.mobile-guide-link {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 1rem auto;
  padding: 10px 16px;
  background: var(--bs-primary);
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  max-width: fit-content;

  &:hover {
    background: color-mix(in srgb, var(--bs-primary) 90%, black);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  &:active {
    transform: translateY(0);
  }

  .external-icon {
    font-size: 0.75rem;
    opacity: 0.9;
  }

  svg:first-child {
    font-size: 1rem;
  }
}

// Mobile optimizations
@media (max-width: 480px) {
  .mobile-architecture-header {
    padding: 0.5rem;

    .architecture-title {
      font-size: 1.1rem;
    }
  }

  .mobile-architecture-content {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }
}

// Touch-friendly interactions
@media (hover: none) and (pointer: coarse) {
  // Dropdown button should be touch-friendly
  .mobile-architecture-header {
    :deep(.dropdown-toggle) {
      min-height: 44px; // Minimum touch target
      min-width: 44px;
    }
  }
}
</style>
