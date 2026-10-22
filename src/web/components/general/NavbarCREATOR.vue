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
import {
  defineComponent,
  type PropType,
  ref,
  onMounted,
  onUnmounted,
} from "vue";
import yaml from "js-yaml";

import SimulatorControls from "../simulator/SimulatorControls.vue";
import AssemblyActions from "../assembly/AssemblyActions.vue";
import SentinelErrorsDropdown from "../simulator/SentinelErrorsDropdown.vue";
import ThemeToggle from "./ThemeToggle.vue";
import type { Instruction } from "@/core/assembler/assembler";
import type { BDropdown } from "bootstrap-vue-next";
import {
  coreEvents,
  CoreEventTypes,
  type SentinelErrorEvent,
} from "../../../core/events.mts";
import { remove_library, architecture, load_CREATino } from "@/core/core.mjs";
import { createFile } from "../assembly/MultifileEditor.mjs";

export default defineComponent({
  props: {
    version: { type: String, required: true },
    architecture_name: { type: String, required: true },
    creator_mode: { type: String, required: false, default: "" },
    browser: { type: String, required: false },
    os: { type: String, required: false },
    dark: { type: Boolean, required: false, default: false },
    darkModeSetting: { type: String, required: false, default: "system" },
    arch_available: {
      type: Array as PropType<AvailableArch[]>,
      required: false,
    },
    autoscroll: { type: Boolean, required: false, default: false },
    instructions: Array as PropType<Instruction[]>,
  },

  emits: ["mobile-view-change", "update:darkModeSetting"],

  components: {
    SimulatorControls,
    AssemblyActions,
    SentinelErrorsDropdown,
    ThemeToggle,
  },

  setup() {
    const sentinelDropdownRef = ref<InstanceType<
      typeof SentinelErrorsDropdown
    > | null>(null);

    const handleSentinelError = (event: SentinelErrorEvent) => {
      if (sentinelDropdownRef.value) {
        sentinelDropdownRef.value.checkForErrors(event);
      }
    };

    onMounted(() => {
      coreEvents.on(CoreEventTypes.SENTINEL_ERROR, handleSentinelError);
    });

    onUnmounted(() => {
      coreEvents.off(CoreEventTypes.SENTINEL_ERROR, handleSentinelError);
    });

    return {
      sentinelDropdownRef,
    };
  },

  data() {
    return {
      openDropdown: null as string | null, // Track which dropdown is currently open
      hoverSwitchEnabled: false, // Enable hover switching after clicking
      mobileView: "code" as
        | "code"
        | "instructions"
        | "data"
        | "architecture"
        | "settings", // Track current mobile view
      showAnnouncementTooltip: false, // Show tooltip only when text is truncated
      announcement: {
        text: "", // Don't modify it here! Use the announcement.yml file in /public
        link: "",
      },
      dismissedAnnouncement: false, // Track if user dismissed the announcement
    };
  },
  computed: {
    architectureGuide() {
      if (!this.architecture_name || !this.arch_available) return undefined;
      const arch = this.arch_available.find(
        (a: AvailableArch) =>
          a.name === this.architecture_name ||
          a.alias?.includes(this.architecture_name),
      );
      return arch?.guide;
    },
    showViewMenu() {
      return ["architecture", "assembly", "simulator"].includes(
        this.creator_mode,
      );
    },
    showFileMenu() {
      return this.creator_mode === "assembly";
    },
    showArchitectureMenu() {
      return this.creator_mode === "architecture";
    },
    showExecuteMenu() {
      return this.creator_mode === "simulator";
    },
    showCompileButton() {
      return this.creator_mode === "assembly";
    },
    showLibraryMenu() {
      if (this.creator_mode !== "assembly") {
        return false;
      }
      // Only show library menu if using CREATOR assembler
      const assemblers = architecture?.config?.assemblers || [];
      // If no assemblers configured, default is CREATOR
      if (assemblers.length === 0) {
        return true;
      }
      // Check if CreatorAssembler is in the list
      return assemblers.some(
        (asm: any) => asm.name === "CreatorAssembler" || asm.name === "Sail",
      );
    },

    // Hide mobile navbar when selecting architecture
    showMobileNavbar() {
      return this.creator_mode !== "select_architecture";
    },

    // Show announcement only if there's text and user hasn't dismissed it
    showAnnouncement() {
      return this.announcement.text && !this.dismissedAnnouncement;
    },
  },
  async mounted() {
    // Listen for escape key to close dropdowns
    document.addEventListener("keydown", this.handleEscapeKey);
    // Listen for clicks outside to disable hover switching
    document.addEventListener("click", this.handleDocumentClick);
    // Check if announcement text is truncated on mount and resize
    this.checkAnnouncementTruncation();
    window.addEventListener("resize", this.checkAnnouncementTruncation);

    // Load announcement from YAML file
    await this.loadAnnouncement();
  },
  beforeUnmount() {
    document.removeEventListener("keydown", this.handleEscapeKey);
    document.removeEventListener("click", this.handleDocumentClick);
    window.removeEventListener("resize", this.checkAnnouncementTruncation);
  },
  methods: {
    handleEscapeKey(event: KeyboardEvent) {
      if (event.key === "Escape" && this.openDropdown) {
        this.closeAllDropdowns();
      }
    },
    handleDocumentClick(event: MouseEvent) {
      // Check if click is outside any dropdown
      const target = event.target as HTMLElement;
      const isDropdownClick = target?.closest(
        ".dropdown, .nav-item, .dropdown-menu",
      );
      if (!isDropdownClick) {
        this.hoverSwitchEnabled = false;
        this.closeAllDropdowns();
      }
    },
    handleDropdownShow(dropdownId: string) {
      // Close any other open dropdown
      if (this.openDropdown && this.openDropdown !== dropdownId) {
        this.closeDropdown(this.openDropdown);
      }
      this.openDropdown = dropdownId;
      this.hoverSwitchEnabled = true;
    },
    handleDropdownHide(dropdownId: string) {
      if (this.openDropdown === dropdownId) {
        this.openDropdown = null;
        // Small delay before disabling hover switch
        setTimeout(() => {
          if (!this.openDropdown) {
            this.hoverSwitchEnabled = false;
          }
        }, 100);
      }
    },
    handleDropdownHover(dropdownId: string) {
      // Only switch if hover switching is enabled and a different dropdown is open
      if (
        this.hoverSwitchEnabled &&
        this.openDropdown &&
        this.openDropdown !== dropdownId
      ) {
        // Close current dropdown and open the hovered one
        this.closeDropdown(this.openDropdown);
        setTimeout(() => {
          this.openDropdownById(dropdownId);
        }, 50);
      }
    },
    closeAllDropdowns() {
      // Close all dropdowns by triggering their hide methods
      const dropdownRefs = [
        "creatorDropdown",
        "viewDropdown",
        "fileDropdown",
        "architectureDropdown",
        "libraryDropdown",
        "toolsDropdown",
        "helpDropdown",
      ];

      dropdownRefs.forEach(refName => this.closeDropdown(refName));

      this.openDropdown = null;
      this.hoverSwitchEnabled = false;
    },
    toggleDropdown(dropdownId: string, shouldOpen: boolean) {
      const dropdown = this.$refs[dropdownId] as InstanceType<typeof BDropdown>;
      if (dropdown?.$el) {
        const toggleBtn = dropdown.$el.querySelector(".dropdown-toggle");
        const isExpanded = toggleBtn?.getAttribute("aria-expanded") === "true";
        if (toggleBtn && isExpanded !== shouldOpen) {
          toggleBtn.click();
        }
      }
    },
    closeDropdown(dropdownId: string) {
      this.toggleDropdown(dropdownId, false);
    },
    openDropdownById(dropdownId: string) {
      this.toggleDropdown(dropdownId, true);
    },
    setMobileView(
      view: "code" | "instructions" | "data" | "architecture" | "settings",
    ) {
      this.mobileView = view;
      // Emit event so parent components can react to view changes
      this.$emit("mobile-view-change", view);
    },
    // Simple action methods
    changeUIMode(mode: string) {
      if ((this.$root as any).creator_mode !== mode) {
        (this.$root as any).creator_mode = mode;
      }
    },
    newAssembly() {
      if (architecture.config.name.includes("SRV")) {
        // Call modal to create new File
        (this.$root as any).assembly_code = createFile(
          (this.$root as any).assembly_code,
        );
      } else {
        (this.$root as any).assembly_code = "";
      }
    },
    removeLibrary() {
      remove_library();
    },
    loadCREATino() {
      load_CREATino();
    },
    checkAnnouncementTruncation() {
      // Use nextTick to ensure DOM is updated
      this.$nextTick(() => {
        const textElement = this.$refs.announcementText as HTMLElement;
        if (textElement) {
          // Check if text is truncated by comparing scroll width with client width
          this.showAnnouncementTooltip =
            textElement.scrollWidth > textElement.clientWidth;
        }
      });
    },
    async loadAnnouncement() {
      try {
        const response = await fetch("announcement.yml");
        if (response.ok) {
          const yamlText = await response.text();
          const data = yaml.load(yamlText) as { text?: string; link?: string };
          this.announcement = {
            text: data.text || "",
            link: data.link || "",
          };

          // Check if user previously dismissed this announcement
          const dismissedText = localStorage.getItem("dismissedAnnouncement");
          if (dismissedText === this.announcement.text) {
            this.dismissedAnnouncement = true;
          }

          // Re-check truncation after announcement loads
          this.checkAnnouncementTruncation();
        }
      } catch (error) {
        console.warn("Failed to load announcement:", error);
      }
    },
    dismissAnnouncement() {
      this.dismissedAnnouncement = true;
      // Save dismissed announcement text to localStorage
      localStorage.setItem("dismissedAnnouncement", this.announcement.text);
    },
  },
});
</script>

<template>
  <!-- Top navbar (hidden on mobile, shown on tablet+) -->
  <b-navbar toggleable="md" class="header py-3 top-navbar">
    <!-- Creator Dropdown Menu -->
    <b-navbar-nav class="creator-brand">
      <b-navbar-brand>
        <img
          src="/public/img/logos/creator_small.webp"
          alt="Creator Simulator Logo"
          class="w-auto transition-transform hover:scale-105"
          style="height: 3vh"
        />
      </b-navbar-brand>

      <b-nav-item-dropdown
        class="navMenu creator-menu"
        no-caret
        no-animation
        ref="creatorDropdown"
        @show="handleDropdownShow('creatorDropdown')"
        @hide="handleDropdownHide('creatorDropdown')"
        @mouseenter="handleDropdownHover('creatorDropdown')"
      >
        <template #button-content>
          <span class="headerText text-uppercase"> Creator </span>
        </template>
        <b-dropdown-item v-if="architecture_name" disabled>
          <font-awesome-icon :icon="['fas', 'microchip']" class="me-2" />
          <strong>{{ architecture_name }}</strong>
        </b-dropdown-item>
        <b-dropdown-divider v-if="architecture_name" />
        <b-dropdown-item href=".">
          <font-awesome-icon :icon="['fas', 'home']" class="me-2" /> Home
        </b-dropdown-item>
        <b-dropdown-item href="https://creatorsim.github.io/" target="_blank">
          <font-awesome-icon :icon="['fas', 'globe']" class="me-2" /> Project
          Website
        </b-dropdown-item>
        <b-dropdown-item
          href="https://github.com/creatorsim/creator"
          target="_blank"
        >
          <font-awesome-icon :icon="['fab', 'github']" class="me-2" /> GitHub
        </b-dropdown-item>
        <b-dropdown-divider />
        <b-dropdown-item
          href="https://docs.google.com/forms/d/e/1FAIpQLSdFbdy5istZbq2CErZs0cTV85Ur8aXiIlxvseLMhPgs0vHnlQ/viewform?usp=header"
          target="_blank"
        >
          <font-awesome-icon :icon="['fas', 'star']" class="me-2" /> Feedback
        </b-dropdown-item>
        <b-dropdown-item
          href="https://docs.google.com/forms/d/e/1FAIpQLSfSclv1rKqBt5aIIP3jfTGbdu8m_vIgEAaiqpI2dGDcQFSg8g/viewform?usp=header"
          target="_blank"
        >
          <font-awesome-icon :icon="['fas', 'lightbulb']" class="me-2" />
          Suggestions
        </b-dropdown-item>
        <b-dropdown-item v-b-modal.institutions>
          <font-awesome-icon :icon="['fas', 'building-columns']" class="me-2" />
          Community
        </b-dropdown-item>
        <b-dropdown-item v-b-modal.statistics>
          <font-awesome-icon :icon="['fas', 'chart-line']" class="me-2" />
          Usage Statistics
        </b-dropdown-item>
        <b-dropdown-item v-b-modal.about>
          <font-awesome-icon :icon="['fas', 'address-card']" class="me-2" />
          About CREATOR
        </b-dropdown-item>
      </b-nav-item-dropdown>
    </b-navbar-nav>

    <!-- Main menu (left side) -->
    <b-navbar-nav class="me-auto">
      <!-- View Menu -->
      <b-nav-item-dropdown
        v-if="showViewMenu"
        text="View"
        class="navMenu"
        no-caret
        no-animation
        ref="viewDropdown"
        @show="handleDropdownShow('viewDropdown')"
        @hide="handleDropdownHide('viewDropdown')"
        @mouseenter="handleDropdownHover('viewDropdown')"
      >
        <b-dropdown-item
          @click="changeUIMode('assembly')"
          :disabled="creator_mode === 'assembly'"
        >
          <font-awesome-icon :icon="['fas', 'hashtag']" class="me-2" /> Editor
        </b-dropdown-item>
        <b-dropdown-item
          @click="changeUIMode('simulator')"
          :disabled="creator_mode === 'simulator'"
        >
          <font-awesome-icon :icon="['fas', 'gears']" class="me-2" /> Simulator
        </b-dropdown-item>
        <b-dropdown-item
          @click="changeUIMode('architecture')"
          :disabled="creator_mode === 'architecture'"
        >
          <font-awesome-icon
            :icon="['fas', 'screwdriver-wrench']"
            class="me-2"
          />
          Architecture
        </b-dropdown-item>
      </b-nav-item-dropdown>

      <!-- File Menu (Assembly View) -->
      <b-nav-item-dropdown
        v-if="showFileMenu"
        text="File"
        class="navMenu"
        no-caret
        no-animation
        ref="fileDropdown"
        @show="handleDropdownShow('fileDropdown')"
        @hide="handleDropdownHide('fileDropdown')"
        @mouseenter="handleDropdownHover('fileDropdown')"
      >
        <b-dropdown-item @click="newAssembly">
          <font-awesome-icon :icon="['far', 'file']" class="me-2" /> New
          Assembly File
        </b-dropdown-item>
        <b-dropdown-item v-b-modal.load_assembly>
          <font-awesome-icon :icon="['fas', 'upload']" class="me-2" /> Open
          File...
        </b-dropdown-item>
        <b-dropdown-item v-b-modal.save_assembly>
          <font-awesome-icon :icon="['fas', 'download']" class="me-2" /> Save
          As...
        </b-dropdown-item>
        <b-dropdown-item v-b-modal.make_uri>
          <font-awesome-icon :icon="['fas', 'link']" class="me-2" /> Get code as
          URI...
        </b-dropdown-item>
        <b-dropdown-item v-b-modal.load_uri>
          <font-awesome-icon
            :icon="['fas', 'arrow-up-right-from-square']"
            class="me-2"
          />
          Load from URI...
        </b-dropdown-item>
      </b-nav-item-dropdown>

      <!-- Architecture Menu (Architecture View)-->
      <b-nav-item-dropdown
        v-if="showArchitectureMenu"
        text="Architecture"
        class="navMenu"
        no-caret
        no-animation
        ref="architectureDropdown"
        @show="handleDropdownShow('architectureDropdown')"
        @hide="handleDropdownHide('architectureDropdown')"
        @mouseenter="handleDropdownHover('architectureDropdown')"
      >
        <b-dropdown-item v-b-modal.edit_architecture>
          <font-awesome-icon :icon="['fas', 'pen-to-square']" class="me-2" />
          Edit Architecture
        </b-dropdown-item>
        <b-dropdown-item v-b-modal.save_architecture>
          <font-awesome-icon :icon="['fas', 'download']" class="me-2" /> Save
          Architecture
        </b-dropdown-item>
      </b-nav-item-dropdown>

      <!-- Library Menu (Assembly View) -->
      <b-nav-item-dropdown
        v-if="showLibraryMenu"
        text="Library"
        class="navMenu"
        no-caret
        no-animation
        ref="libraryDropdown"
        @show="handleDropdownShow('libraryDropdown')"
        @hide="handleDropdownHide('libraryDropdown')"
        @mouseenter="handleDropdownHover('libraryDropdown')"
      >
        <b-dropdown-item v-b-modal.load_binary>
          <font-awesome-icon :icon="['fas', 'upload']" class="me-2" /> Load
          Library...
        </b-dropdown-item>
        <b-dropdown-item v-b-modal.save_binary>
          <font-awesome-icon :icon="['fas', 'floppy-disk']" class="me-2" /> Save
          as Library...
        </b-dropdown-item>
        <b-dropdown-item
          v-if="architecture_name.includes('RV32')"
          @click="loadCREATino"
        >
          <font-awesome-icon :icon="['fas', 'infinity']" class="me-2" /> Add
          Arduino Library
        </b-dropdown-item>
        <b-dropdown-divider />
        <b-dropdown-item @click="removeLibrary">
          <font-awesome-icon :icon="['fas', 'trash-can']" class="me-2" /> Remove
          Library...
        </b-dropdown-item>
      </b-nav-item-dropdown>

      <!-- Tools Menu (Simulator View) -->
      <b-nav-item-dropdown
        v-if="showExecuteMenu"
        text="Tools"
        class="navMenu"
        no-caret
        no-animation
        ref="toolsDropdown"
        @show="handleDropdownShow('toolsDropdown')"
        @hide="handleDropdownHide('toolsDropdown')"
        @mouseenter="handleDropdownHover('toolsDropdown')"
      >
        <b-dropdown-item v-b-modal.flash>
          <font-awesome-icon :icon="['fab', 'usb']" class="me-2" /> Flash
        </b-dropdown-item>
        <b-dropdown-item v-b-modal.calculator_simulator>
          <font-awesome-icon :icon="['fas', 'calculator']" class="me-2" />
          IEEE754 Calculator
        </b-dropdown-item>
      </b-nav-item-dropdown>

      <!-- Help Menu -->
      <b-nav-item-dropdown
        text="Help"
        class="navMenu"
        no-caret
        no-animation
        ref="helpDropdown"
        @show="handleDropdownShow('helpDropdown')"
        @hide="handleDropdownHide('helpDropdown')"
        @mouseenter="handleDropdownHover('helpDropdown')"
      >
        <b-dropdown-item
          v-if="creator_mode === 'assembly'"
          v-b-modal.examples_assembly
        >
          <font-awesome-icon :icon="['fas', 'file-lines']" class="me-2" />
          Examples...
        </b-dropdown-item>
        <b-dropdown-item
          v-if="creator_mode === 'simulator'"
          v-b-modal.examples_simulator
        >
          <font-awesome-icon :icon="['fas', 'file-lines']" class="me-2" />
          Examples...
        </b-dropdown-item>
        <b-dropdown-divider
          v-if="creator_mode === 'assembly' || creator_mode === 'simulator'"
        />
        <b-dropdown-item
          href="https://creatorsim.github.io/creator-wiki"
          target="_blank"
        >
          <font-awesome-icon :icon="['fas', 'circle-question']" class="me-2" />
          CREATOR Help
        </b-dropdown-item>
        <b-dropdown-item
          v-if="architectureGuide"
          :href="architectureGuide"
          target="_blank"
        >
          <font-awesome-icon :icon="['fas', 'file-pdf']" class="me-2" />
          {{ architecture_name }} Guide
        </b-dropdown-item>
      </b-nav-item-dropdown>

      <!-- Separator for buttons -->
      <div
        v-if="showExecuteMenu || showCompileButton"
        class="button-separator"
      ></div>

      <!-- Compile Buttons (Assembly View) -->
      <b-nav-item v-if="showCompileButton" class="compile-item">
        <AssemblyActions
          :dark="dark"
          mode="toolbar-split"
          @change-mode="changeUIMode"
        />
      </b-nav-item>

      <!-- Execute Controls (Simulator View) -->
      <b-nav-item v-if="showExecuteMenu" class="execute-controls">
        <SimulatorControls
          ref="simulatorControls"
          :instructions="instructions || []"
          :autoscroll="autoscroll"
          :os="os || ''"
          :browser="browser || ''"
          :dark="dark"
          mode="toolbar"
        />
      </b-nav-item>

      <!-- Separator before Sentinel button -->
      <div v-if="showExecuteMenu" class="button-separator"></div>

      <!-- Sentinel Errors Dropdown (Simulator View Only) -->
      <SentinelErrorsDropdown
        v-if="showExecuteMenu"
        ref="sentinelDropdownRef"
        :dark="dark"
        class="ms-auto"
      />
    </b-navbar-nav>

    <!-- Announcement Section (shown when viewport > 1000px and text is present) -->
    <div v-if="showAnnouncement" class="announcement-section">
      <a
        v-if="announcement.link"
        :href="announcement.link"
        target="_blank"
        rel="noopener noreferrer"
        class="announcement-content announcement-link"
        v-b-tooltip.hover.bottom="
          showAnnouncementTooltip ? announcement.text : ''
        "
      >
        <font-awesome-icon
          :icon="['fas', 'bullhorn']"
          class="announcement-icon"
        />
        <span class="announcement-text" ref="announcementText">{{
          announcement.text
        }}</span>
        <button
          class="announcement-close"
          @click.prevent="dismissAnnouncement"
          aria-label="Dismiss announcement"
        >
          <font-awesome-icon :icon="['fas', 'xmark']" />
        </button>
      </a>
      <div
        v-else
        class="announcement-content"
        v-b-tooltip.hover.bottom="
          showAnnouncementTooltip ? announcement.text : ''
        "
      >
        <font-awesome-icon
          :icon="['fas', 'bullhorn']"
          class="announcement-icon"
        />
        <span class="announcement-text" ref="announcementText">{{
          announcement.text
        }}</span>
        <button
          class="announcement-close"
          @click="dismissAnnouncement"
          aria-label="Dismiss announcement"
        >
          <font-awesome-icon :icon="['fas', 'xmark']" />
        </button>
      </div>
    </div>

    <!-- Right side actions -->
    <b-navbar-nav class="ms-auto">
      <!-- Theme Toggle -->
      <ThemeToggle
        :dark-mode-setting="darkModeSetting"
        @update:dark-mode-setting="$emit('update:darkModeSetting', $event)"
      />

      <!-- Notifications Button -->
      <b-nav-item
        v-b-modal.notifications
        class="icon-button"
        aria-label="Notifications"
      >
        <font-awesome-icon :icon="['fas', 'bell']" />
      </b-nav-item>

      <!-- Settings Button -->
      <b-nav-item
        v-b-modal.configuration
        class="icon-button"
        aria-label="Settings"
      >
        <font-awesome-icon :icon="['fas', 'cog']" />
      </b-nav-item>
    </b-navbar-nav>
  </b-navbar>

  <!-- Mobile bottom navbar (shown only on mobile) -->
  <nav v-if="showMobileNavbar" class="mobile-bottom-navbar">
    <div class="bottom-nav-container">
      <!-- Code Tab -->
      <button
        class="bottom-nav-item"
        :class="{ active: mobileView === 'code' }"
        @click="setMobileView('code')"
        aria-label="Code"
      >
        <font-awesome-icon :icon="['fas', 'code']" />
        <span class="bottom-nav-label">Code</span>
      </button>

      <!-- Instructions Tab -->
      <button
        class="bottom-nav-item"
        :class="{ active: mobileView === 'instructions' }"
        @click="setMobileView('instructions')"
        aria-label="Instructions"
      >
        <font-awesome-icon :icon="['fas', 'book']" />
        <span class="bottom-nav-label">Instructions</span>
      </button>

      <!-- Data Tab -->
      <button
        class="bottom-nav-item"
        :class="{ active: mobileView === 'data' }"
        @click="setMobileView('data')"
        aria-label="Data"
      >
        <font-awesome-icon :icon="['fas', 'database']" />
        <span class="bottom-nav-label">State</span>
      </button>

      <!-- Architecture Tab -->
      <button
        class="bottom-nav-item"
        :class="{ active: mobileView === 'architecture' }"
        @click="setMobileView('architecture')"
        aria-label="Architecture"
      >
        <font-awesome-icon :icon="['fas', 'microchip']" />
        <span class="bottom-nav-label">Architecture</span>
      </button>

      <!-- Settings Tab -->
      <button
        class="bottom-nav-item"
        :class="{ active: mobileView === 'settings' }"
        @click="setMobileView('settings')"
        aria-label="Settings"
      >
        <font-awesome-icon :icon="['fas', 'cog']" />
        <span class="bottom-nav-label">Settings</span>
      </button>
    </div>
  </nav>
</template>

<style lang="scss" scoped>
@import "bootstrap/scss/bootstrap";

// Top navbar (desktop and tablet)
.top-navbar {
  width: 100%;
  align-items: center;
  min-height: 40px !important;
  max-height: 40px !important;
  background-color: rgb(238, 238, 238);

  :deep(.navbar-nav) {
    align-items: center;
  }

  // Hide on mobile, show on tablet+
  @media (max-width: 767px) {
    display: none;
  }
}

// Mobile bottom navbar
.mobile-bottom-navbar {
  display: none; // Hidden on desktop

  // Show only on mobile
  @media (max-width: 767px) {
    display: block;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1030;
    background-color: rgb(238, 238, 238);
    border-top: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
    // Safe area insets for home indicator and rounded corners
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }
}

.bottom-nav-container {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 8px 0;
  max-width: 100%;
  height: 56px;

  // Reduce height on very small screens
  @media (max-width: 320px) {
    height: 48px;
    padding: 6px 0;
  }
}

.bottom-nav-dropdown {
  flex: 1;

  :deep(.dropdown-toggle) {
    border: none;
    width: 100%;
    padding: 0;

    &::after {
      display: none; // Hide dropdown arrow
    }
  }
}

.bottom-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 12px;
  color: #6c757d;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
  position: relative;

  svg {
    font-size: 20px;
    transition: transform 0.2s ease;
  }

  // Reduce padding and icon size on very small screens (320px and below)
  @media (max-width: 320px) {
    padding: 6px 8px;
    gap: 2px;

    svg {
      font-size: 18px;
    }
  }

  // Active state (selected tab)
  &.active {
    color: #2196f3;

    svg {
      transform: scale(1.1);
    }

    // Active indicator bar
    &::after {
      content: "";
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 32px;
      height: 3px;
      background-color: #2196f3;
      border-radius: 0 0 3px 3px;

      // Smaller width on very small screens
      @media (max-width: 320px) {
        width: 24px;
      }
    }
  }

  // Tap feedback
  &:active:not(.active) {
    color: #2196f3;
    background-color: rgba(33, 150, 243, 0.08);

    svg {
      transform: scale(0.95);
    }
  }
}

.bottom-nav-label {
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  transition: color 0.2s ease;

  // Smaller font on very small screens
  @media (max-width: 320px) {
    font-size: 10px;
  }
}
.creator-brand {
  // On mobile, don't collapse the Creator menu
  @media (max-width: 767px) {
    flex-shrink: 0;
  }
}

.headerText {
  color: #2196f3;
  font-weight: 700;
  font-size: 1rem;

  // Slightly smaller on mobile
  @media (max-width: 767px) {
    font-size: 0.9rem;
  }
}

// Button separator (visual divider between menus and buttons)
.button-separator {
  width: 1px;
  height: 30px;
  background-color: #dee2e6;
  margin: 0 0.75rem;
}

// Icon buttons (notifications, settings)
.icon-button {
  :deep(.nav-link) {
    color: #6c757d;
    transition: all 0.2s ease;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      color: #2196f3;
      background-color: rgba(33, 150, 243, 0.08);
    }

    &:active {
      transform: scale(0.95);
    }
  }
}

// Announcement section (only visible > 1000px)
.announcement-section {
  display: none; // Hidden by default
  align-items: center;
  padding: 0 12px;
  flex: 1;
  min-width: 0; // Allow flex shrinking
  max-width: 500px;

  // Show when viewport is greater than 1000px
  @media (min-width: 1001px) {
    display: flex;
  }

  // Hide on smaller screens to prevent clipping
  @media (max-width: 1200px) {
    max-width: 300px;
  }

  @media (max-width: 1100px) {
    max-width: 200px;
  }
}

.announcement-content {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px;
  background-color: rgba(33, 150, 243, 0.08);
  border-radius: 6px;
  border-left: 3px solid #2196f3;
  transition: all 0.2s ease;
  width: 100%;
  min-width: 0; // Allow flex shrinking

  &:hover {
    background-color: rgba(33, 150, 243, 0.12);
  }
}

.announcement-link {
  text-decoration: none;
  cursor: pointer;

  &:hover {
    background-color: rgba(33, 150, 243, 0.15);
  }

  &:active {
    transform: translateY(0);
  }
}

.announcement-icon {
  color: #2196f3;
  font-size: 14px;
  flex-shrink: 0;
}

.announcement-text {
  font-size: 13px;
  color: #495057;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0; // Allow text to shrink properly
}

.announcement-close {
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  padding: 4px 6px;
  margin-left: 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
  font-size: 14px;

  &:hover {
    color: #2196f3;
    background-color: rgba(33, 150, 243, 0.1);
  }

  &:active {
    transform: scale(0.9);
  }
}

// Dropdown menu styling
:deep(.dropdown-menu) {
  border-radius: 8px;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.12),
    0 4px 16px rgba(0, 0, 0, 0.08);
  padding: 6px;
  margin-top: 4px;
  min-width: 0;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

:deep(.dropdown-item) {
  border-radius: 4px;
  margin-bottom: 2px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 400;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: none;
  min-width: 0;

  &:last-child {
    margin-bottom: 0;
  }

  // Icon styling
  .fa-icon,
  svg {
    min-height: 16px;
    min-width: 16px;
    opacity: 0.85;
  }

  &:hover .fa-icon,
  &:hover svg {
    opacity: 1;
  }
}

// Dropdown divider
:deep(.dropdown-divider) {
  margin: 6px 0;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  opacity: 1;
}

[data-bs-theme="dark"] {
  .top-navbar {
    background-color: hsl(214, 9%, 12%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .headerText {
    color: #64b5f6;
  }

  .button-separator {
    background-color: rgba(255, 255, 255, 0.12);
  }

  // Icon buttons in dark mode
  .icon-button {
    :deep(.nav-link) {
      color: #adb5bd;

      &:hover {
        color: #64b5f6;
        background-color: rgba(100, 181, 246, 0.12);
      }
    }
  }

  // Announcement section in dark mode
  .announcement-content {
    background-color: rgba(100, 181, 246, 0.12);
    border-left-color: #64b5f6;

    &:hover {
      background-color: rgba(100, 181, 246, 0.18);
    }
  }

  .announcement-icon {
    color: #64b5f6;
  }

  .announcement-text {
    color: #e9ecef;
  }

  .announcement-close {
    color: #adb5bd;

    &:hover {
      color: #64b5f6;
      background-color: rgba(100, 181, 246, 0.15);
    }
  }

  :deep(.navbar-toggler) {
    border-color: rgba(255, 255, 255, 0.1);

    .navbar-toggler-icon {
      filter: invert(1);
    }
  }

  // Mobile bottom navbar in dark mode
  .mobile-bottom-navbar {
    background-color: hsl(214, 9%, 12%);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.3);
  }

  .bottom-nav-item {
    color: #adb5bd;

    // Active state in dark mode
    &.active {
      color: #64b5f6;

      &::after {
        background-color: #64b5f6;
      }
    }

    // Tap feedback in dark mode
    &:active:not(.active) {
      color: #64b5f6;
      background-color: rgba(100, 181, 246, 0.12);
    }
  }
}
</style>
