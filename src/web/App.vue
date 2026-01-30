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
import { BOrchestrator, useToast } from "bootstrap-vue-next";

// import package_json from "#/package.json" // package info
import package_json from "../../package.json"; // package info
// import arch_available from "#/architecture/available_arch.json"
import arch_available from "../../architecture/available_arch.json";

import {
  notifications,
  show_notification,
  loadDefaultArchitecture,
  loadExample,
} from "./utils.mjs";
import { set_debug, status, reset } from "@/core/core.mjs";
import { stats } from "@/core/executor/stats.mts";
import { instructions } from "@/core/assembler/assembler.mjs";
import type { StackFrame } from "@/core/memory/StackTracker.mjs";
import { creator_ga } from "@/core/utils/creator_ga.mjs";
import { InterruptHandlerType } from "@/core/executor/InterruptManager.mjs";

import SpinnerLoading from "./components/general/SpinnerLoading.vue";
import SupportedBrowsers from "./components/general/SupportedBrowsers.vue";
import SettingsModal from "./components/general/SettingsModal.vue";
import UIeltoNotifications from "./components/general/UIeltoNotifications.vue";
import NavbarCREATOR from "./components/general/NavbarCREATOR.vue";
import UIeltoInstitutions from "./components/general/UIeltoInstitutions.vue";
import UIeltoStatistics from "./components/general/UIeltoStatistics.vue";
import UIeltoAbout from "./components/general/AboutModal.vue";
import UIeltoBackup from "./components/select_architecture/UIeltoBackup.vue";
import MobileSettings from "./components/mobile/MobileSettings.vue";
import MobileCodeView from "./components/mobile/MobileCodeView.vue";
import MobileArchitectureSelect from "./components/mobile/MobileArchitectureSelect.vue";
import MobileInstructionsView from "./components/mobile/MobileInstructionsView.vue";
import MobileDataView from "./components/mobile/MobileDataView.vue";
import MobileArchitectureView from "./components/mobile/MobileArchitectureView.vue";

import ActivityBar from "./components/general/ActivityBar.vue";

import SelectArchitecture from "./components/SelectArchitecture.vue";
import ArchitectureView from "./components/ArchitectureView.vue";
import SimulatorView from "./components/SimulatorView.vue";
import AssemblyView from "./components/AssemblyView.vue";

const creatorASCII = `
 ██████╗██████╗ ███████╗ █████╗ ████████╗ ██████╗ ██████╗
██╔════╝██╔══██╗██╔════╝██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗
██║     ██████╔╝█████╗  ███████║   ██║   ██║   ██║██████╔╝
██║     ██╔══██╗██╔══╝  ██╔══██║   ██║   ██║   ██║██╔══██╗
╚██████╗██║  ██║███████╗██║  ██║   ██║   ╚██████╔╝██║  ██║
 ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝
    didaCtic and geneRic assEmbly progrAmming simulaTOR

${("v." + package_json.version).padStart(58)}
`;

export default {
  name: "app",
  components: {
    BOrchestrator,
    SpinnerLoading,
    SupportedBrowsers,
    SettingsModal,
    UIeltoNotifications,
    NavbarCREATOR,
    UIeltoInstitutions,
    UIeltoStatistics,
    UIeltoAbout,
    UIeltoBackup,
    MobileSettings,
    MobileCodeView,
    MobileArchitectureSelect,
    MobileInstructionsView,
    MobileDataView,
    MobileArchitectureView,

    SelectArchitecture,
    ArchitectureView,
    SimulatorView,
    AssemblyView,
    ActivityBar,
  },

  /************
   * Vue Data *
   ************/

  setup() {
    // BV Composeables, such as these, should only be used inside setup
    const createToast = useToast().create; // shows a toast notification

    return { createToast };
  },

  data() {
    return {
      /********************/
      /* Global Variables */
      /********************/

      //
      // General information
      //

      // Version Number
      version: package_json.version,
      simulatorViewKey: 0, // Add a key for SimulatorView to force re-render

      // Force recomputation of arch_available when architectures change
      customArchitecturesKey: 0,

      // Track assembly completion to force instructions table refresh
      assemblyCompletedKey: 0,

      // Architecture name and guide
      architecture_name: "",
      architecture_guide: "",

      // Accesskey
      os: "" as string | undefined,
      browser: "" as string | undefined,

      // Displayed notifications
      notifications,

      // window size
      windowHeight: window.innerHeight,
      windowWidth: window.innerWidth,

      // Mobile view
      mobileView: "code" as
        | "code"
        | "instructions"
        | "data"
        | "architecture"
        | "settings",

      // Mobile data view state
      mobileDataView: "registers" as
        | "registers"
        | "memory"
        | "stats"
        | "console",

      // Mobile architecture view state
      mobileArchitectureView: "arch-info" as
        | "arch-info"
        | "register-file"
        | "instructions"
        | "pseudoinstructions"
        | "directives",

      //
      // Current view
      //

      creator_mode: "select_architecture",

      //
      // Configuration
      //

      // interrupt handler
      interrupt_handler: InterruptHandlerType.CREATOR,

      // Default architecture
      default_architecture:
        localStorage.getItem("conf_default_architecture") || "none",

      // Notification speed
      notification_time:
        parseInt(localStorage.getItem("conf_notification_time")!, 10) || 1500,

      // Instruction help size
      instruction_help_size:
        parseInt(localStorage.getItem("conf_instruction_help_size")!, 10) || 33,

      // Auto Scroll
      autoscroll: (a => {
        return a === null ? true : a === "true";
      })(localStorage.getItem("conf_autoscroll")), // if null, set to true, else respect the value

      // Backup
      backup: (a => {
        return a === null ? true : a === "true";
      })(localStorage.getItem("conf_backup")), // if null, set to true, else respect the value

      // Font size
      font_size: 15,

      // Debug
      c_debug: false,

      // Dark Mode
      dark: false, // the actual dark mode state
      dark_mode_setting:
        localStorage.getItem("conf_dark_mode_setting") || "system", // "system", "dark", or "light"

      mediaQuery: null as MediaQueryList | null,

      vim_mode: localStorage.getItem("conf_vim_mode") === "true",

      vim_custom_keybinds:
        JSON.parse(localStorage.getItem("conf_vim_custom_keybinds")!) || [],

      sidebar_mode: (a => {
        return a === null ? "show" : a;
      })(localStorage.getItem("conf_sidebar_mode")) as "show" | "autohide" | "disable",

      /*************************/
      /* Architecture Selector */
      /*************************/

      //
      // Available architectures
      //

      /****************/
      /* Architecture */
      /****************/

      // Architecture edit code
      arch_code: "",

      /************/
      /* Assembly */
      /************/

      //
      // Code error modal
      //

      assemblyError: "",

      //
      // Assembly code
      //

      assembly_code: "",

      /*************/
      /* Simulator */
      /*************/

      //
      // Execution
      //

      // Instructions
      instructions,

      //
      // Data view
      //

      // we must store this data in the root, bc it resets when re-mounting a
      // component (in this case, RegisterFile)
      data_mode: "int_registers",
      reg_name_representation: "all",
      memory_segment: "data",

      // Stack
      callee_frame: undefined as StackFrame | undefined,
      caller_frame: undefined as StackFrame | undefined,
      stack_pointer: 0,

      //
      // Stats
      //

      stats,
      stat_representation: "graphic",
      stat_type: "instructions",

      //
      // Display and keyboard
      //

      display: "",
      keyboard: "",
      enter: null, // defines the state of the keyboard: no keyboard read pending (null), keyboard pending (false), or keyboard success (true)

      //
      // Flash
      //

      target_ports: {
        Win: "rfc2217://host.docker.internal:4000?ign_set_control",
        Mac: "/dev/cu.usbserial-10",
        Linux: "/dev/ttyUSB0",
      } as { [key: string]: string },

      lab_url: "",
      result_email: "",
      target_board: "",
      target_port: "",
      target_location: "~/creator",
      flash_url: "http://localhost:8080",
    };
  },

  computed: {
    arch_available(): AvailableArch[] {
      // Use customArchitecturesKey to force recomputation when it changes
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      this.customArchitecturesKey;

      const architectures = arch_available.map(a => ({ ...a, default: true }));
      const customArchs = JSON.parse(
        localStorage.getItem("customArchitectures") || "[]",
      );

      if (customArchs && customArchs.length > 0) {
        architectures.push(...customArchs);
      }

      return architectures;
    },

    /**
     * @returns {boolean} True if the current viewport is mobile-sized
     */
    isMobile() {
      return this.windowWidth <= 767;
    },

    showActivityBar(): boolean {
      return ["architecture", "assembly", "simulator"].includes(this.creator_mode);
    },
  },

  /************************
   * Created vue instance *
   ************************/
  created() {
    this.os = this.detect_os();
    this.browser = this.detect_browser();
    this.target_port = this.get_target_port();
  },

  /************************
   * Mounted vue instance *
   ************************/
  mounted() {
    // Preload following URL params
    this.loadFromURI();

    // set config
    this.set_dark_mode();

    // Listen for changes in system dark mode preference if setting is system
    if (this.dark_mode_setting === "system") {
      this.mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      this.mediaQuery.addEventListener("change", this.handleDarkModeChange);
    }

    set_debug(this.c_debug);

    // listener for window size changes
    window.addEventListener("resize", this.resizeHandler);

    console.log(creatorASCII);
  },

  unmounted() {
    if (this.mediaQuery) {
      this.mediaQuery.removeEventListener("change", this.handleDarkModeChange);
    }
    window.removeEventListener("resize", this.resizeHandler);
  },

  /***************
   * Vue watchers *
   ***************/

  watch: {
    dark_mode_setting(newSetting: string) {
      this.handleDarkModeSettingChange(newSetting);
    },
  },

  /***************
   * Vue methods *
   ***************/

  methods: {
    /*******************
     * General methods *
     *******************/

    /**
     * Handle architecture deletion event
     * Forces re-computation of arch_available computed property
     */
    handleArchitectureDeleted(_archName: string) {
      this.customArchitecturesKey++;
    },

    /**
     * Detects the operating system being used
     *
     * @return `"Win"`, `"Mac"`, or `"Linux"`, `undefined` if not sure
     */
    detect_os(): string | undefined {
      if (navigator.userAgent.includes("Win")) {
        return "Win";
      }
      if (navigator.userAgent.includes("Mac")) {
        return "Mac";
      }
      if (
        navigator.userAgent.includes("X11") ||
        navigator.userAgent.includes("Linux")
      ) {
        return "Linux";
      }
      return undefined;
    },

    /**
     * Detects the browser being used
     *
     * @returns `"Chrome"`, `"Firefox"`, or `"Safari", ``undefined` if not sure
     */
    detect_browser(): string | undefined {
      if (navigator.userAgent.includes("Chrome")) {
        return "Chrome";
      }
      if (navigator.userAgent.includes("Firefox")) {
        return "Firefox";
      }
      if (navigator.userAgent.includes("Safari")) {
        return "Safari";
      }
      return undefined;
    },

    // Set dark mode based on setting
    set_dark_mode() {
      if (this.dark_mode_setting === "system") {
        this.dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      } else {
        this.dark = this.dark_mode_setting === "dark";
      }

      // set dark mode (w/ bootstrap color themes)
      document.documentElement.setAttribute(
        "data-bs-theme",
        this.dark ? "dark" : "light",
      );
    },

    /**
     * Loads the application from a custom URI (generated by MakeURI)
     */
    loadFromURI() {
      // get parameters
      const params = new URL(window.location.toString()).searchParams;

      const architecture_name = params.get("architecture");
      const asm = params.get("asm");
      const desired_set = params.get("example_set");
      const desired_example = params.get("example");

      if (architecture_name === null) {
        // no URI or incomplete URI
        return;
      }

      // load architecture
      const arch = arch_available.find(
        arch =>
          arch.name === decodeURI(architecture_name) ||
          arch.alias.includes(decodeURI(architecture_name)),
      );
      if (arch === undefined) {
        show_notification(
          `'${architecture_name}' architecture not found`,
          "danger",
          this,
        );
        return;
      }

      this.architecture_name = arch.name;

      // I'm going to do what's called a "pro gamer move"
      // In the underlaying function, as it belongs to a JS module, we can't
      // access Vue components. We solve this by storing the root component
      // (App) in `document.app` once its mounted. But in this point of the
      // code, App is still not mounted, so `document.app` is undefined.
      // The hack is to pass the component to the function so it can use it.
      loadDefaultArchitecture(arch, this);

      // load assembly code
      if (asm !== null) {
        this.assembly_code = decodeURI(asm);

        // TODO: compile. It doesn't update the table execution, so...
        // this.$root.$refs.selectArchitectureView.$refs.toolbar.$refs.btngroup1
        //   .at(0)
        //   .assembly_compiler()

        // go directly to assembly view
        // FIXME: as we can't compile (see above), we go to the assembly view,
        // when we should go to simulator view
        this.creator_mode = "assembly";
      }

      // load example code
      if (desired_set !== null && desired_example !== null) {
        loadExample(
          arch.name,
          decodeURI(desired_set),
          decodeURI(desired_example),
          this,
        );
      }
    },

    /*************/
    /* Simulator */
    /*************/

    //Exception Notification
    exception(error: string) {
      //TODO: Move?
      show_notification(
        "There has been an exception. Error description: '" + error,
        "danger",
      );

      if (status.execution_index !== -1) {
        instructions[status.execution_index]!._rowVariant = "danger";
      }

      /* Google Analytics */
      creator_ga("execute", "execute.exception", "execute.exception." + error);
    },

    //Get target por by SO
    get_target_port() {
      return this.target_ports[this.os!]! ?? "";
    },

    resizeHandler(_e: any) {
      this.windowHeight = window.innerHeight;
      this.windowWidth = window.innerWidth;
    },

    // Handle changes in system dark mode preference
    handleDarkModeChange(e: MediaQueryListEvent) {
      if (this.dark_mode_setting === "system") {
        this.dark = e.matches;
        document.documentElement.setAttribute(
          "data-bs-theme",
          this.dark ? "dark" : "light",
        );
      }
    },

    // Handle dark mode setting change
    handleDarkModeSettingChange(newSetting: string) {
      this.dark_mode_setting = newSetting;
      localStorage.setItem("conf_dark_mode_setting", newSetting);

      if (newSetting === "system") {
        // Add listener if not already
        if (!this.mediaQuery) {
          this.mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
          this.mediaQuery.addEventListener("change", this.handleDarkModeChange);
        }
        this.dark = this.mediaQuery.matches;
      } else {
        // Remove listener
        if (this.mediaQuery) {
          this.mediaQuery.removeEventListener(
            "change",
            this.handleDarkModeChange,
          );
          this.mediaQuery = null;
        }
        this.dark = newSetting === "dark";
      }

      document.documentElement.setAttribute(
        "data-bs-theme",
        this.dark ? "dark" : "light",
      );
    },

    // Handle mobile view changes from navbar
    handleMobileViewChange(
      view: "code" | "instructions" | "data" | "architecture" | "settings",
    ) {
      this.mobileView = view;
    },

    // Reset simulator state for mobile code view
    resetSimulator() {
      this.keyboard = "";
      this.display = "";
      this.enter = null;
      reset();
    },

    // Show toast notification for mobile code view
    showToast(toastData: { message: string; title: string; variant: string }) {
      this.createToast({
        title: toastData.title,
        body: toastData.message,
        variant: toastData.variant as "success" | "danger" | "warning" | "info",
        solid: true,
      });
    },
  },
};
</script>

<template>
  <!-- for showing bootstrap stuff from JS -->
  <BOrchestrator />

  <!------------------------>
  <!-- General components -->
  <!------------------------>

  <!-- Loading spinner -->
  <SpinnerLoading id="loading" style="display: none" />

  <!-- Browser not supported modal -->
  <SupportedBrowsers :browser="browser" />

  <div class="app-wrapper">
    <header>
    <!-- Navbar  -->
    <NavbarCREATOR
      :version="version"
      :architecture_name="architecture_name"
      :creator_mode="creator_mode"
      :browser="browser"
      :os="os"
      :dark="dark"
      :dark-mode-setting="dark_mode_setting"
      :arch_available="arch_available"
      :instructions="instructions"
      @mobile-view-change="handleMobileViewChange"
      @update:dark-mode-setting="handleDarkModeSettingChange"
      ref="navbar"
    />

    <!-- Configuration modal -->
    <SettingsModal
      id="configuration"
      :architecture_name="architecture_name"
      v-model:arch_available="arch_available"
      v-model:default_architecture="default_architecture"
      v-model:autoscroll="autoscroll"
      v-model:backup="backup"
      v-model:notification_time="notification_time"
      v-model:dark_mode_setting="dark_mode_setting"
      v-model:c_debug="c_debug"
      v-model:vim_custom_keybinds="vim_custom_keybinds"
      v-model:vim_mode="vim_mode"
      v-model:reg_name_representation="reg_name_representation"
      v-model:interrupt_handler="interrupt_handler"
      v-model:sidebar_mode="sidebar_mode"
    />

    <!-- Information modals -->

    <!-- Notification modal -->
    <UIeltoNotifications id="notifications" :notifications="notifications" />

    <!-- Institutions modal -->
    <UIeltoInstitutions id="institutions" />

    <!-- Statistics modal -->
    <UIeltoStatistics id="statistics" />

    <!-- About modal -->
    <UIeltoAbout id="about" :dark="dark!" />

    <!-- Backup modal -->
    <UIeltoBackup id="copy" @load-architecture="creator_mode = 'assembly'" />
  </header>
  <div class="app-body">
    <ActivityBar
      v-if="!isMobile && showActivityBar && sidebar_mode !== 'disable'"
      v-model="creator_mode"
      :dark="dark"
      :autohide="sidebar_mode === 'autohide'"
    />
  <main class="main-view">

  <!-------------------->
  <!-- Mobile Architecture Select -->
  <!-------------------->

  <MobileArchitectureSelect
    v-if="isMobile"
    :arch_available="arch_available"
    :dark="dark"
    @select-architecture="
      arch_name => {
        architecture_name = arch_name;
        creator_mode = 'simulator';
        mobileView = 'code';
      }
    "
    @architecture-deleted="handleArchitectureDeleted"
  />

  <!----------------------->
  <!-- Select architecture -->
  <!----------------------->

  <SelectArchitecture
    v-if="!isMobile && creator_mode === 'select_architecture'"
    :arch_available="arch_available"
    :browser="browser!"
    :os="os!"
    :dark="dark!"
    :window-height="windowHeight"
    ref="selectArchitectureView"
    @select-architecture="
      arch_name => {
        architecture_name = arch_name;
        creator_mode = 'simulator';
      }
    "
    @architecture-deleted="handleArchitectureDeleted"
  />

  <!------------------>
  <!-- Architecture -->
  <!------------------>

  <ArchitectureView
    v-if="!isMobile && creator_mode === 'architecture'"
    :architecture_name="architecture_name"
    :arch_available="arch_available"
    :arch_code="arch_code"
    :browser="browser!"
    :os="os!"
    :dark="dark!"
  />

  <!------------------->
  <!-- Assembly view -->
  <!------------------->

  <AssemblyView
    v-if="!isMobile && creator_mode === 'assembly'"
    :architecture_name="architecture_name"
    :arch_available="arch_available"
    :browser="browser!"
    :os="os!"
    :assembly_code="assembly_code"
    :assembly_error="assemblyError"
    :vim_mode="vim_mode"
    :vim_custom_keybinds="vim_custom_keybinds"
    :dark="dark!"
    ref="assemblyView"
  />

  <!-------------------->
  <!-- Simulator view -->
  <!-------------------->

  <SimulatorView
    v-if="!isMobile && creator_mode === 'simulator'"
    ref="simulatorView"
    :data_mode="data_mode"
    :reg_name_representation="reg_name_representation"
    :stat_representation="stat_representation"
    :stat_type="stat_type"
    :memory_segment="memory_segment"
    :architecture_name="architecture_name"
    :arch_available="arch_available"
    :instructions="instructions"
    :enter="enter"
    :browser="browser!"
    :os="os!"
    :window-height="windowHeight"
    :window-width="windowWidth"
    :display="display"
    :keyboard="keyboard"
    :dark="dark!"
    :autoscroll="autoscroll"
    :key="simulatorViewKey + '-' + assemblyCompletedKey"
    :callee_frame="callee_frame!"
    :caller_frame="caller_frame!"
    :assembly_code="assembly_code"
    :lab_url="lab_url"
    :result_email="result_email"
    :target_board="target_board"
    :target_port="target_port"
    :target_location="target_location"
    :flash_url="flash_url"
  />
    </main>
    </div>
  </div>

  <!-------------------->
  <!-- Mobile Settings -->
  <!-------------------->

  <MobileSettings
    v-if="
      isMobile &&
      mobileView === 'settings' &&
      creator_mode !== 'select_architecture'
    "
    :architecture_name="architecture_name"
    v-model:autoscroll="autoscroll"
    v-model:backup="backup"
    v-model:notification_time="notification_time"
    v-model:dark_mode_setting="dark_mode_setting"
    v-model:vim_mode="vim_mode"
    v-model:vim_custom_keybinds="vim_custom_keybinds"
    v-model:reg_name_representation="reg_name_representation"
    v-model:interrupt_handler="interrupt_handler"
  />

  <!-------------------->
  <!-- Mobile Code View -->
  <!-------------------->

  <MobileCodeView
    v-if="
      isMobile &&
      mobileView === 'code' &&
      creator_mode !== 'select_architecture'
    "
    :architecture_name="architecture_name"
    v-model:assembly_code="assembly_code"
    :dark="dark"
    @assembly-error="assemblyError = $event"
    @switch-to-simulator="creator_mode = 'simulator'"
    @reset-simulator="resetSimulator"
    @show-toast="showToast"
  />

  <!-------------------->
  <!-- Mobile Instructions View -->
  <!-------------------->

  <MobileInstructionsView
    v-if="
      isMobile &&
      mobileView === 'instructions' &&
      creator_mode !== 'select_architecture'
    "
    :instructions="instructions"
    :enter="enter"
    :browser="browser!"
    :os="os!"
    :dark="dark!"
    @reset-simulator="resetSimulator"
    @show-toast="showToast"
  />

  <!-------------------->
  <!-- Mobile Data View -->
  <!-------------------->

  <MobileDataView
    ref="mobileDataView"
    v-if="
      isMobile &&
      mobileView === 'data' &&
      creator_mode !== 'select_architecture'
    "
    :data_mode="data_mode"
    :reg_name_representation="reg_name_representation"
    :stat_representation="stat_representation"
    :stat_type="stat_type"
    :memory_segment="memory_segment"
    :display="display"
    :keyboard="keyboard"
    :enter="enter"
    :dark="dark!"
    :caller_frame="caller_frame!"
    :callee_frame="callee_frame!"
    :mobile_data_view="mobileDataView"
    @update:mobile_data_view="mobileDataView = $event"
  />

  <!-------------------->
  <!-- Mobile Architecture View -->
  <!-------------------->

  <MobileArchitectureView
    v-if="
      isMobile &&
      mobileView === 'architecture' &&
      creator_mode !== 'select_architecture'
    "
    :browser="browser!"
    :os="os!"
    :arch_available="arch_available"
    :architecture_name="architecture_name"
    :dark="dark!"
    :arch_code="arch_code"
    :mobile_architecture_view="mobileArchitectureView"
    @update:mobile_architecture_view="mobileArchitectureView = $event"
  />
</template>

<style lang="scss" scoped>
:deep() {
  // applies to all sub-components
  html,
  body {
    background-color: #ffffff;
    overflow: hidden; // Disable all scrolling
    font-size: 15px;
    height: 100vh;
    width: 100vw;
    position: fixed; // Prevent any scrolling on all devices

    // Add padding for mobile safe areas
    @media (max-width: 767px) {
      padding-top: env(safe-area-inset-top);
    }
  }

  #app {
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    position: fixed;
    top: 0;
    left: 0;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .flexbox {
    display: flex;
  }

  .flexbox .stretch {
    flex: 1;
  }

  .flexbox .normal {
    flex: 0;
    margin: 0 0 0 1rem;
  }

  .flexbox div input {
    padding: 0.5em 1em;
    width: 100%;
  }

  .flexbox div button {
    padding: 0.5em 1em;
    white-space: nowrap;
  }

  .contenedor {
    display: -webkit-flex;
    display: flex;
    width: 100%;
    margin: 0px;
  }

  hr {
    height: 1px;
    background-color: #9e9e9e;
  }

  h1 {
    display: block;
    font-size: 1em;
  }

  h2 {
    display: block;
    font-size: 1.5em;
  }

  .h5 {
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
    font-weight: 500;
    line-height: 1.2;
    display: inline-block;
  }

  .h6 {
    font-size: 1rem;
    margin-bottom: 0.5rem;
    font-weight: 500;
    line-height: 1.2;
    display: inline-block;
  }

  .h6Sm {
    font-size: 0.85rem;
    margin-bottom: 0.5rem;
    font-weight: 500;
    line-height: 1.2;
    display: inline-block;
  }

  .noBorder {
    border-top: 0px;
    border-bottom: 0px;
    border-right: 0px;
  }

  .table td {
    vertical-align: middle;
  }

  .justify {
    text-align: justify;
  }

  .center {
    text-align: center;
  }

  .left {
    text-align: left;
  }

  .popover {
    max-width: 100%;
  }

  .menu {
    width: 100%;
    align-items: center;
    margin: 5px;
    margin-bottom: 10px;
  }

  .buttonBackground {
    background-color: #fafafa;
    color: #6c757d;
  }

  #chart {
    margin: 35px auto;
    padding: 0;
  }

  .fields {
    padding: 1%;
  }
  .app-wrapper {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }

  .app-body {
    display: flex;
    flex-direction: row;
    flex-grow: 1;
    overflow: hidden;
    height: 100%;
  }

  .main-view {
    flex-grow: 1;
    overflow: auto;
    position: relative;
    display: flex;
    flex-direction: column;
  }
}
</style>
