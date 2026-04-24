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

import type { RegisterFile } from "@/core/core";

import Registers from "../registers/Registers.vue";

export default defineComponent({
  props: {
    register_file: { type: Array as PropType<RegisterFile[]>, required: true },
  },
  components: {
    Registers,
  },
});
</script>

<template>
  <!-- Register File Layout -->
  <div class="register-files-container">
    <!-- For each register file -->
    <div
      v-for="(item, index) in register_file"
      :key="item.type"
      class="register-file-section"
    >
      <div class="register-file-header">
        <h5 class="register-file-title">{{ item.name }}</h5>
        <span class="register-count">{{ item.registers.length }} registers</span>
      </div>

      <div class="register-file-content">
        <Registers
          :registers="register_file[index]!.registers"
          :register_file_index="index"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@import "bootstrap/scss/bootstrap";

.register-files-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 1rem 0;
}

.register-file-section {
  background: var(--bs-body-bg);
  border: 1px solid rgba(0, 0, 0, 0.125);
  border-radius: 0.5rem;
  overflow: hidden;

  [data-bs-theme="dark"] & {
    border-color: rgba(255, 255, 255, 0.125);
  }
}

.register-file-header {
  background: rgba(0, 0, 0, 0.03);
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.125);
  display: flex;
  justify-content: space-between;
  align-items: center;

  [data-bs-theme="dark"] & {
    background: rgba(255, 255, 255, 0.03);
    border-bottom-color: rgba(255, 255, 255, 0.125);
  }
}

.register-file-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--bs-body-color);
}

.register-count {
  font-size: 0.875rem;
  color: var(--bs-secondary-color);
  background: rgba(0, 123, 255, 0.1);
  color: #007bff;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-weight: 500;

  [data-bs-theme="dark"] & {
    background: rgba(0, 123, 255, 0.2);
    color: #4dabf7;
  }
}

.register-file-content {
  padding: 1.5rem;

  @media (max-width: 768px) {
    padding: 1rem;
  }
}
</style>
