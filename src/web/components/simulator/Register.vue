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

import type { Register } from "@/core/core";
import { creator_ga } from "@/core/utils/creator_ga.mjs";
import { bi_BigIntTofloat, bi_BigIntTodouble } from "@/core/utils/bigint.mjs";
import {
  hex2float,
  hex2double,
  float2bin,
  float2int_v2,
  double2int_v2,
  double2bin,
} from "@/core/utils/utils.mjs";
import {
  isRegisterGlowing,
  setRegisterGlow,
  clearRegisterGlow,
} from "@/core/register/registerGlowState.mjs";

export default defineComponent({
  props: {
    type: { type: String, required: true },
    register: { type: Object as PropType<Register>, required: true },
    double_precision: { type: Boolean, required: true },
    name_representation: { type: String, required: true },
    value_representation: { type: String, required: true },
    indexComp: { type: Number, required: true },
    indexElem: { type: Number, required: true },
  },

  emits: ["register-details"],

  data() {
    return {
      render: false, // toggle this to trigger reactive recalculation
      glow: false, // whether the button is glowing or not (persistent until next step)
    };
  },

  mounted() {
    // Restore glow state from persistent store
    this.glow = isRegisterGlowing(this.indexComp, this.indexElem);
  },

  computed: {
    popoverId() {
      return "popoverValueContent" + this.register.name[0];
    },

    // Format register names horizontally separated by |
    formattedRegNames() {
      let names: string[];

      switch (this.name_representation) {
        case "logical":
          names = [this.register.name[0] ?? ""];
          break;
        case "alias":
          if (typeof this.register.name[1] === "undefined") {
            names = [this.register.name[0] ?? ""];
          } else {
            names = this.register.name.slice(1, this.register.name.length);
          }
          break;
        case "all":
          names = this.register.name;
          break;
        default:
          names = [];
      }

      return names.join(" | ");
    },

    // Now a computed property! The render variable acts as a dependency
    // When refresh() increments render, this recomputes automatically
    reg_value(): string {
      // Access render to create a reactive dependency
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      this.render;
      if (this.type === "v_registers"){
        // Only show the first elem of the vector
        let elem_size = document.app.$data.v_length / 4; // hex format
        return this.show_value(this.value_representation).toString().slice(-elem_size);
      } else
        return this.show_value(this.value_representation).toString();
    },
  },

  methods: {
    creator_ga,

    refresh() {
      // toggle to trigger computed property recalculation
      this.render = !this.render;
      // make it glow (persisted in global store)
      this.glow = true;
      setRegisterGlow(this.indexComp, this.indexElem);
    },

    clearGlow() {
      // clear the glow effect (from both component and global store)
      this.glow = false;
      clearRegisterGlow(this.indexComp, this.indexElem);
    },

    showDetails() {
      this.$emit("register-details", {
        name: this.register.name,
        type: this.type,
        hex: this.show_value("hex"),
        bin: this.show_value("bin"),
        signed: this.show_value("signed"),
        unsigned: this.show_value("unsigned"),
        char: this.show_value("char"),
        ieee32: this.show_value("ieee32"),
        ieee64: this.show_value("ieee64"),
        indexComp: this.indexComp,
        indexElem: this.indexElem,
      });
      creator_ga("data", "data.view", "data.view.registers_details");
    },

    // TODO: move to utils
    is_positive(value: number | bigint, nbits: number) {
      return value.toString(2).padStart(nbits, "0").charAt(0) === "0";
    },

    show_value(representation: string): number | string {
      let ret;

      switch (representation) {
        case "signed":
          if (this.type === "ctrl" || this.type === "int") {
            if (this.is_positive(this.register.value, this.register.nbits)) {
              ret = this.register.value.toString(10);
            } else {
              ret = (
                this.register.value -
                2n ** BigInt(this.register.nbits)
              ).toString(10);
            }
          } else if (!this.double_precision) {
            ret = float2int_v2(bi_BigIntTofloat(this.register.value));
          } else {
            ret = double2int_v2(bi_BigIntTodouble(this.register.value));
          }
          break;

        case "unsigned":
          if (this.type === "ctrl" || this.type === "int") {
            ret = parseInt(this.register.value.toString(10), 10) >>> 0;
          } else if (!this.double_precision) {
            ret = float2int_v2(bi_BigIntTofloat(this.register.value)) >>> 0;
          } else {
            ret = double2int_v2(bi_BigIntTodouble(this.register.value)) >>> 0;
          }
          break;

        case "ieee32":
          if (this.type === "ctrl" || this.type === "int") {
            ret = hex2float(
              "0x" + this.register.value.toString(16).padStart(8, "0"),
            );
          } else {
            ret = bi_BigIntTofloat(this.register.value);
          }
          break;

        case "ieee64":
          // FIXME: this is wrong...
          if (this.type === "ctrl" || this.type === "int") {
            ret = hex2double(
              "0x" + this.register.value.toString(16).padStart(16, "0"),
            );
          } else {
            ret = bi_BigIntTodouble(this.register.value);
          }
          break;

        case "hex":
          ret = this.register.value
            .toString(16)
            .padStart(this.register.nbits / 4, "0")
            .toUpperCase();

          break;

        case "bin":
          if (this.type === "ctrl" || this.type === "int") {
            ret = this.register.value
              .toString(2)
              .padStart(this.register.nbits, "0");
          } else if (this.double_precision !== null) {
            ret = float2bin(bi_BigIntTofloat(this.register.value));
          } else {
            ret = double2bin(bi_BigIntTodouble(this.register.value));
          }
          break;

        case "char":
          ret = String.fromCharCode(Number(this.register.value));

          break;

        default:
          return "N/A";
      }

      return ret;
    },
  },
});
</script>

<template>
  <div
    class="register-row"
    :class="{ 'register-row-glow': glow }"
    :id="popoverId"
    :key="+render"
    @click="showDetails"
  >
    <div class="register">
      <div class="register-name register-name-horizontal">
        {{ formattedRegNames }}
      </div>

      <div class="register-value">{{ reg_value }}</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.register-row {
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  &:hover {
    background-color: rgba(var(--bs-primary-rgb), 0.08);
  }

  &.register-row-glow {
    background-color: rgba(var(--bs-primary-rgb), 0.25);
    border-radius: 6px;
  }
}

.register {
  padding: 0;
  min-width: 7.5rem;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.15);
  width: 100%;
}

.register-name {
  font-weight: 600;
  font-size: 0.875rem;
  white-space: nowrap;
  color: rgba(var(--bs-body-color-rgb), 1);
  letter-spacing: 0.01em;
  text-align: center;
  padding: 0;
  font-weight: 800;
  background-color: rgba(var(--bs-secondary-rgb), 0.15);
}

.register-value {
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  font-family:
    ui-monospace, "SF Mono", "Cascadia Code", "Source Code Pro", Menlo,
    Consolas, "DejaVu Sans Mono", monospace;
  color: rgba(var(--bs-body-color-rgb), 0.95);
  font-weight: 500;
  text-align: center;
  padding: 0rem 0.25rem;
  background-color: rgba(var(--bs-light-rgb), 0.4);
}

// Responsive sizing for 64-bit registers on smaller screens
@media (max-width: 1345px) and (min-width: 768px) {
  .register-value {
    font-size: 0.75rem;
  }
}

// Mobile view - keep normal size
@media (max-width: 767px) {
  .register-value {
    font-size: 0.875rem;
  }
}

// Dark mode adjustments
[data-bs-theme="dark"] {
  .register-row {
    &:hover {
      background-color: rgba(var(--bs-primary-rgb), 0.12);
    }
  }

  .register {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .register-name {
    color: rgba(255, 255, 255, 1);
    background-color: rgba(255, 255, 255, 0.05);
  }

  .register-value {
    color: rgba(255, 255, 255, 0.95);
    background-color: rgba(0, 0, 0, 0.3);
  }
}
</style>
