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
import { creator_ga } from "@/core/utils/creator_ga.mjs";
import {
  interruptManager,
  set_debug,
  setInterruptManager,
  status,
} from "@/core/core.mjs";
import { Vim } from "@replit/codemirror-vim";

import VimKeybindsModal from "./VimKeybindsModal.vue";
import { defineComponent, type PropType } from "vue";
import { InterruptHandlerType } from "@/core/executor/InterruptManager.mts";

export default defineComponent({
  props: {
    id: { type: String, required: true },
    arch_available: Array as PropType<AvailableArch[]>,
    architecture_name: { type: String, required: true },
    default_architecture: { type: String, required: true },
    autoscroll: { type: Boolean, required: true },
    backup: { type: Boolean, required: true },
    notification_time: { type: Number, required: true },
    dark_mode_setting: { type: String, required: true },
    c_debug: { type: Boolean, required: true },
    vim_custom_keybinds: {
      type: Array as PropType<VimKeybind[]>,
      required: true,
    },
    vim_mode: { type: Boolean, required: true },
    reg_name_representation: { type: String, required: true },
    interrupt_handler: {
      type: String as PropType<InterruptHandlerType>,
      required: true,
    },
    sidebar_mode: { type: String, required: true },
  },

  components: { VimKeybindsModal },

  data() {
    return {
      // vim config
      vim_expanded: false,
      selected_vim_keybind: null as number | null,
      newVimKeybind: {
        mode: "normal",
        lhs: "",
        rhs: "",
      },

      // register representation options
      reg_name_representation_options: [
        { text: "Name", value: "logical" },
        { text: "Alias", value: "alias" },
        { text: "All", value: "all" },
      ],

      interrupt_handler_options: [
        { text: "CREATOR", value: InterruptHandlerType.CREATOR },
        { text: "Custom (architecture)", value: InterruptHandlerType.Custom },
      ],
      sidebar_mode_options: [
        { text: "Disable", value: "disable" },
        { text: "Automatic hide", value: "autohide" },
        { text: "Show", value: "show" },
      ],
    };
  },

  emits: [
    // parent variables that will be updated
    "update:default_architecture",
    "update:autoscroll",
    "update:notification_time",
    "update:dark_mode_setting",
    "update:c_debug",
    "update:vim_custom_keybinds",
    "update:vim_mode",
    "update:backup",
    "update:reg_name_representation",
    "update:interrupt_handler",
    "update:sidebar_mode",
  ],

  computed: {
    // placeholder for editing a vim keybind
    // we create a copy bc we don't want to sync the value automatically, we
    // want to wait for confirmation from the user to execute
    // modifySelectedVimKeybind
    modifiedVimKeybind(): VimKeybind {
      // copy selected keybind
      return { ...this.vim_custom_keybinds_value[this.selected_vim_keybind!]! };
    },

    // modifying these variables will update the corresponding parent's variables
    // see https://vuejs.org/guide/components/v-model
    default_architecture_value: {
      get() {
        return this.default_architecture;
      },
      set(value: string) {
        this.$emit("update:default_architecture", value);

        localStorage.setItem("conf_default_architecture", value);

        //Google Analytics
        creator_ga(
          "configuration",
          "configuration.default_architecture",
          "configuration.default_architecture." + value,
        );
      },
    },
    autoscroll_value: {
      get() {
        return this.autoscroll;
      },
      set(value: string) {
        this.$emit("update:autoscroll", value);

        localStorage.setItem("conf_autoscroll", value);

        //Google Analytics
        creator_ga(
          "configuration",
          "configuration.autoscroll",
          "configuration.autoscroll." + value,
        );
      },
    },
    backup_value: {
      get() {
        return this.backup;
      },
      set(value: string) {
        this.$emit("update:backup", value);

        localStorage.setItem("conf_backup", value);

        //Google Analytics
        creator_ga(
          "configuration",
          "configuration.backup",
          "configuration.backup." + value,
        );
      },
    },
    notification_time_value: {
      get() {
        return this.notification_time;
      },
      set(value: string) {
        let val = parseInt(value, 10);

        // enforce limit
        if (val < 1000) {
          val = 1000;
        } else if (val > 5000) {
          val = 5000;
        }

        this.$emit("update:notification_time", val);

        localStorage.setItem("conf_notification_time", val.toString());

        //Google Analytics
        creator_ga(
          "configuration",
          "configuration.notification_time",
          "configuration.notification_time.time_" + val.toString(),
        );
      },
    },
    dark_mode_setting_value: {
      get() {
        return this.dark_mode_setting;
      },
      set(value: string) {
        this.$emit("update:dark_mode_setting", value);

        //Google Analytics
        creator_ga(
          "configuration",
          "configuration.dark_mode_setting",
          "configuration.dark_mode_setting." + value,
        );
      },
    },
    c_debug_value: {
      get() {
        return this.c_debug;
      },
      set(value: boolean) {
        set_debug(value);

        this.$emit("update:c_debug", value.toString());

        //Google Analytics
        creator_ga(
          "configuration",
          "configuration.debug_mode",
          "configuration.debug_mode." + value,
        );
      },
    },
    vim_custom_keybinds_value: {
      get() {
        return this.vim_custom_keybinds;
      },
      set(value: VimKeybind[]) {
        this.$emit("update:vim_custom_keybinds", value);
      },
    },
    vim_mode_value: {
      get() {
        return this.vim_mode;
      },
      set(value: boolean) {
        this.$emit("update:vim_mode", value);
        localStorage.setItem("conf_vim_mode", value.toString());

        // Google Analytics
        creator_ga(
          "configuration",
          "configuration.vim_mode",
          "configuration.vim_mode." + value,
        );
      },
    },
    reg_name_representation_value: {
      get() {
        return this.reg_name_representation;
      },
      set(value: string) {
        this.$emit("update:reg_name_representation", value);
        localStorage.setItem("conf_reg_name_representation", value);

        // Google Analytics
        creator_ga(
          "configuration",
          "configuration.reg_name_representation",
          "configuration.reg_name_representation." + value,
        );
      },
    },
    interrupt_handler_value: {
      get() {
        return this.interrupt_handler;
      },
      set(value: InterruptHandlerType) {
        this.$emit("update:interrupt_handler", value);
        status.interrupt_handler = value;

        // if arch loaded, switch interruptManager
        if (this.architecture_name !== "") {
          setInterruptManager(interruptManager.switchHandler(value));
        }

        // Google Analytics
        creator_ga(
          "configuration",
          "configuration.interrupt_handler",
          "configuration.interrupt_handler." + value,
        );
      },
    },
    sidebar_mode_value: {
      get() {
        return this.sidebar_mode;
      },
      set(value: string) {
        this.$emit("update:sidebar_mode", value);
        localStorage.setItem("conf_sidebar_mode", value);
      },
    },
  },
  methods: {
    removeVimKeybind(index: number) {
      const { lhs, mode } = this.vim_custom_keybinds_value[index]!;

      Vim.unmap(lhs, mode);
      this.vim_custom_keybinds_value.splice(index, 1);
    },
    resetToDefaults() {
      // Clear all configuration from localStorage
      localStorage.removeItem("conf_notification_time");
      localStorage.removeItem("conf_autoscroll");
      localStorage.removeItem("conf_backup");
      localStorage.removeItem("conf_dark_mode_setting");
      localStorage.removeItem("conf_vim_mode");
      localStorage.removeItem("conf_vim_custom_keybinds");
      localStorage.removeItem("conf_reg_name_representation");
      localStorage.removeItem("conf_default_architecture");

      // Clear custom vim keybinds
      while (this.vim_custom_keybinds_value.length > 0) {
        this.removeVimKeybind(0);
      }

      // Reset to default values (will use defaults from data() on next load)
      this.notification_time_value = "2000";
      this.autoscroll_value = "true";
      this.backup_value = "true";
      this.dark_mode_setting_value = "system";
      this.c_debug_value = false;
      this.vim_mode_value = false;
      this.reg_representation_int_value = "hex";
      this.reg_representation_float_value = "ieee32";
      this.reg_name_representation_value = "alias";
      this.interrupt_handler_value = InterruptHandlerType.CREATOR;

      // Google Analytics
      creator_ga(
        "configuration",
        "configuration.reset_defaults",
        "configuration.reset_defaults.triggered",
      );
    },
  },
  watch: {
    // as we're not replacing this property, but mutating it, it will not
    // trigger the computed property setter, so we must do this
    vim_custom_keybinds_value: {
      handler(value: VimKeybind[], _old: VimKeybind[]) {
        localStorage.setItem(
          "conf_vim_custom_keybinds",
          // if you store an object in localstorage, it saves it as the *string*
          // '[object Object]', so we'll have to serialize it manually
          JSON.stringify(value),
        );

        // // Google Analytics
        // creator_ga(
        //   "configuration",
        //   "configuration.vim_custom_keybinds",
        //   "configuration.vim_custom_keybinds." + value,
        // )
      },
      deep: true,
    },
  },
});
</script>

<template>
  <b-modal :id="id" scrollable title="Configuration">
    <b-list-group class="compact-config">
      <!--
      <b-list-group-item class="justify-content-between align-items-center config-item">
        <label for="range-5">Default Architecture:</label>

        <b-form-select
          v-model="default_architecture_value"
          size="sm"
          title="Default Architecture"
        >
          <BFormSelectOption value="'none'">None</BFormSelectOption>
          <BFormSelectOption value="'RISC-V (RV32IMFD)'">
            RISC-V (RV32IMFD)
          </BFormSelectOption>
          <BFormSelectOption value="'MIPS-32'">MIPS-32</BFormSelectOption>
        </b-form-select>
      </b-list-group-item>
      -->
      <b-list-group-item
        class="justify-content-between align-items-center config-item"
      >
        <label for="range-3">Notification Time (ms):</label>
        <b-form-input
          id="range-3"
          v-model.number="notification_time_value"
          type="number"
          min="1000"
          max="5000"
          step="10"
          title="Notification Time"
          class="number-input"
        />
      </b-list-group-item>
      <b-list-group-item
        class="justify-content-between align-items-center config-item"
      >
        <label>Interrupt handler:</label>
        <b-form-select
          v-model="interrupt_handler_value"
          :options="interrupt_handler_options"
          size="sm"
          class="representation-select"
        />
      </b-list-group-item>

      <b-list-group-item
        class="justify-content-between align-items-center config-item"
      >
        <label for="range-2">Execution Autoscroll:</label>
        <b-form-checkbox
          id="range-2"
          v-model="autoscroll_value"
          name="check-button"
          switch
          size="lg"
        />
      </b-list-group-item>
      <b-list-group-item
        class="justify-content-between align-items-center config-item"
      >
        <label for="range-2">Automatic backup:</label>
        <b-form-checkbox
          id="range-2"
          v-model="backup_value"
          name="check-button"
          switch
          size="lg"
        />
      </b-list-group-item>

      <!--
        <b-list-group-item class="justify-content-between align-items-center config-item">
        <label for="range-4">Font Size:</label>
        <b-input-group>
          <b-button variant="outline-secondary" @click="font_size_value -= 1">-</b-button>
          <b-form-input id="range-4" v-model="fontSize" type="range" min="8" max="48" step="1" title="Font Size" />
          <b-button variant="outline-secondary" @click="font_size_value += 1">+</b-button>
        </b-input-group>
      </b-list-group-item>
      -->

      <b-list-group-item
        class="justify-content-between align-items-center config-item"
      >
        <label for="range-5">Theme:</label>
        <b-form-select
          id="range-5"
          v-model="dark_mode_setting_value"
          size="sm"
          title="Dark Mode Setting"
          class="representation-select"
        >
          <b-form-select-option value="system">System</b-form-select-option>
          <b-form-select-option value="dark">Dark</b-form-select-option>
          <b-form-select-option value="light">Light</b-form-select-option>
        </b-form-select>
      </b-list-group-item>
      <b-list-group-item
        class="justify-content-between align-items-center config-item"
      >
        <label for="range-6">Debug:</label>
        <b-form-checkbox
          id="range-6"
          v-model="c_debug_value"
          name="check-button"
          switch
          size="lg"
        />
      </b-list-group-item>

      <b-list-group-item
        class="justify-content-between align-items-center config-item"
      >
        <label for="range-sidebar">Sidebar Mode:</label>
        <b-form-select
          id="range-sidebar"
          v-model="sidebar_mode_value"
          :options="sidebar_mode_options"
          size="sm"
          class="representation-select"
        />
      </b-list-group-item>

      <!-- Vim config -->

      <b-list-group-item
        class="justify-content-between align-items-center config-item"
      >
        <label for="range-2">Vim mode:</label>
        <b-form-checkbox
          v-model="vim_mode_value"
          name="check-button"
          switch
          size="lg"
        />
      </b-list-group-item>
      <b-list-group-item class="config-item vim-keybinds-section">
        <div class="vim-keybinds-header">
          <label for="range-7">Vim Custom Keybinds:</label>
          <!-- toggle button -->
          <b-button
            @click="vim_expanded = !vim_expanded"
            :variant="vim_expanded ? 'secondary' : 'primary'"
            size="sm"
          >
            <font-awesome-icon
              v-if="vim_expanded"
              icon="fa-solid fa-caret-up"
            />
            <font-awesome-icon v-else icon="fa-solid fa-caret-down" />
          </b-button>
        </div>
        <b-collapse v-model="vim_expanded" class="vim-keybinds-content">
          <b-table
            small
            hover
            sticky-header="25vh"
            :items="vim_custom_keybinds_value"
            :fields="[
              { key: 'mode', sortable: true, class: 'text-center' },
              { key: 'lhs', label: 'LHS', class: 'text-center font-monospace' },
              { key: 'rhs', label: 'RHS', class: 'text-center font-monospace' },
              { key: 'buttons', label: '', class: 'text-center' },
            ]"
          >
            <!-- mode in uppercase -->
            <template #cell(mode)="keybind">
              {{ (keybind.value as string).toUpperCase() }}
            </template>

            <!-- edit buttons -->
            <template #cell(buttons)="keybind">
              <b-button-group size="sm">
                <b-button
                  variant="primary"
                  v-b-toggle.modal-vim-edit
                  @click="selected_vim_keybind = keybind.index"
                >
                  <font-awesome-icon :icon="['fas', 'pen-to-square']" />
                </b-button>
                <b-button
                  variant="danger"
                  @click="removeVimKeybind(keybind.index)"
                >
                  <font-awesome-icon :icon="['fas', 'trash']" />
                </b-button>
              </b-button-group>
            </template>
          </b-table>

          <b-container fluid>
            <b-row align-h="end">
              <b-button v-b-toggle.modal-vim-new variant="primary" size="sm">
                <font-awesome-icon :icon="['fas', 'plus']" />
              </b-button>
            </b-row>
          </b-container>
        </b-collapse>
      </b-list-group-item>

      <!-- Register Representation Settings -->

      <b-list-group-item
        class="justify-content-between align-items-center config-item"
      >
        <label>Register Name Representation:</label>
        <b-form-select
          v-model="reg_name_representation_value"
          :options="reg_name_representation_options"
          size="sm"
          class="representation-select"
        />
      </b-list-group-item>
    </b-list-group>

    <template #footer="{ hide }">
      <div class="w-100 d-flex justify-content-between align-items-center">
        <b-button variant="outline-danger" size="sm" @click="resetToDefaults">
          <font-awesome-icon :icon="['fas', 'rotate-left']" class="me-2" />
          Reset to Defaults
        </b-button>
        <b-button variant="primary" @click="hide"> Close </b-button>
      </div>
    </template>
  </b-modal>

  <VimKeybindsModal
    id="modal-vim-edit"
    title="Edit Vim keybind"
    type="edit"
    :selected_vim_keybind="selected_vim_keybind"
    v-model:vim_custom_keybinds="vim_custom_keybinds_value"
  />

  <VimKeybindsModal
    id="modal-vim-new"
    title="New Vim keybind"
    type="new"
    :selected_vim_keybind="selected_vim_keybind"
    v-model:vim_custom_keybinds="vim_custom_keybinds_value"
  />
</template>

<style lang="scss" scoped>
.compact-config {
  .config-item {
    padding: 0.35rem 0.75rem;
    margin: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    position: relative;

    label {
      margin: 0;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .form-check,
    .input-group,
    .form-select {
      margin: 0;
      flex-shrink: 0;
    }

    .input-group {
      max-width: 200px;
    }

    .number-input {
      max-width: 100px;
      text-align: right;
    }

    .representation-select {
      max-width: 200px;
      flex-shrink: 0;
    }

    // Fix dropdown overflow
    .dropdown {
      position: static;
    }

    .dropdown-menu {
      position: absolute;
      max-height: 200px;
      overflow-y: auto;
      z-index: 1050;
    }
  }

  .vim-keybinds-section {
    flex-direction: column;
    align-items: stretch;
    padding: 0.35rem 0.75rem;

    .vim-keybinds-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;

      label {
        margin: 0;
        white-space: nowrap;
      }

      button {
        flex-shrink: 0;
      }
    }

    .vim-keybinds-content {
      width: 100%;
      margin-top: 0.5rem;
    }
  }
}
</style>
