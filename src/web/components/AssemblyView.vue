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

import TextareaAssembly from "./assembly/TextareaAssembly.vue";
import AssemblyError from "./assembly/AssemblyError.vue";
import Examples from "./assembly/Examples.vue";
import LoadAssembly from "./assembly/LoadAssembly.vue";
import DownloadPopup from "./general/DownloadModal.vue";
import MakeURI from "./assembly/MakeURI.vue";
import LoadURI from "./assembly/LoadURI.vue";
import LoadLibrary from "./assembly/LoadLibrary.vue";
import SaveLibrary from "./assembly/SaveLibrary.vue";
import LibraryTags from "./assembly/LibraryTags.vue";
import Calculator from "./simulator/Calculator.vue";

export default defineComponent({
  props: {
    browser: { type: String, required: true },
    os: { type: String, required: true },
    arch_available: {
      type: Array as PropType<AvailableArch[]>,
      required: true,
    },
    architecture_name: { type: String, required: true },
    assembly_code: { type: String, required: true },
    assembly_error: { type: String, required: true },
    vim_mode: { type: Boolean, required: true },
    vim_custom_keybinds: {
      type: Array as PropType<VimKeybind[]>,
      required: true,
    },
    dark: { type: Boolean, required: true },
  },

  components: {
    TextareaAssembly,
    AssemblyError,
    Examples,
    LoadAssembly,
    DownloadPopup,
    MakeURI,
    LoadURI,
    LoadLibrary,
    SaveLibrary,
    LibraryTags,
    Calculator,
  },
});
</script>

<template>
  <b-container fluid align-h="center" id="assembly" class="p-0">
    <!-- Navbar -->
    <!-- Assembly navbar modals -->
    <!-- Load assembly form -->
    <LoadAssembly id="load_assembly" />

    <!-- Save assembly form -->
    <DownloadPopup
      id="save_assembly"
      type="assembly"
      title="Save Assembly"
      default-filename="assembly"
      extension=".s"
      :fileData="assembly_code"
    />

    <!-- Examples modal -->
    <Examples
      id="examples_assembly"
      :architecture_name="architecture_name"
      :compile="false"
    />

    <!-- Get uri -->
    <MakeURI
      id="make_uri"
      :architecture_name="architecture_name"
      :assembly_code="assembly_code"
    />

    <!-- Load uri -->
    <LoadURI id="load_uri" />

    <!-- Load binary form -->
    <LoadLibrary id="load_binary" />

    <!-- Save binary form -->
    <SaveLibrary id="save_binary" />

    <!-- Library tags modal -->
    <LibraryTags id="library_tags" />

    <!-- Calculator -->
    <Calculator id="calculator_assembly" />

    <!-- Assembly textarea-->
    <TextareaAssembly
      :os="os"
      :assembly_code="assembly_code"
      :vim_mode="vim_mode"
      :vim_custom_keybinds="vim_custom_keybinds"
      height="calc(100vh - 40px)"
      :dark="dark"
    />

    <!-- Compile error modal -->
    <AssemblyError
      id="modalAssemblyError"
      reff="errorAssembly"
      :assembly_error="assembly_error"
    />
  </b-container>
</template>

<style scoped></style>
