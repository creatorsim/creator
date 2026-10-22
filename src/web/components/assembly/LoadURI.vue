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

import { show_loading, hide_loading, show_notification } from "@/web/utils.mjs";
import { creator_ga } from "@/core/utils/creator_ga.mjs";

export default defineComponent({
  props: {
    id: { type: String, required: true },
  },

  data() {
    return { uri: "" };
  },

  methods: {
    //Load new assembly code into the URI
    loadURI() {
      show_loading();

      const params = new URL(this.uri).searchParams;
      const asm = params.get("asm");

      (this.$root as any).assembly_code = asm;

      hide_loading();

      /* Google Analytics */
      creator_ga("assembly", "assembly.load_uri", "assembly.load_uri");
    },
  },
});
</script>

<template>
  <b-modal
    :id="id"
    title="Load via URI"
    ok-title="Load from this URI"
    @ok="loadURI"
  >
    <p>Load from the following URI:</p>
    <b-form-textarea
      v-model="uri"
      :state="uri !== ''"
      placeholder="Enter URI..."
      id="assembly_uri"
      rows="6"
    />
  </b-modal>
</template>
