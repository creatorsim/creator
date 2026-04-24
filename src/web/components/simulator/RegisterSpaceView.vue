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
import { REGISTERS } from "@/core/core";

import { writeRegister } from "@/core/register/registerOperations.mjs";
import { crex_findReg } from "@/core/register/registerLookup.mjs";
import { creator_ga } from "@/core/utils/creator_ga.mjs";
import { show_notification } from "@/web/utils.mjs";
import { float2bin, double2bin, hex2float, hex2double } from "@/core/utils/utils.mjs";
import { defineComponent, type PropType } from "vue";
import { architecture } from "@/core/core.mjs";

export default defineComponent({
  props: {
    id: { type: String, required: true },
    item: {
      type: [Object, null] as PropType<RegisterDetailsItem | null>,
      required: true,
    },
  },

  // emits: ["update:show"],

  data() {
    return {
      newValue: "",
      precision: "single",
      Sail_arch: (architecture.config.name.includes("SRV")) ? true : false,
      is_vtype: this.$props.item?.type === "v_registers",
    };
  },

  computed: {
    doublePrecision(): boolean {
      // TODO
      return false;
    },
    modalSize() {
      return (this.item?.type === "v_registers") ? 'modal-xl' : ''
    },
    vectorMaxLength(){
      return (512 / document.app.$data.v_length) - 1;
    }
  },

  methods: {
    updateRegister(name: string, type: string, doublePrecision: boolean) {
      const reg = crex_findReg(name);
      const regSize =
        REGISTERS[reg.indexComp!]!.registers[reg.indexElem!]!.nbits;

      // compute value to store
      let value;
      if (["int", "ctrl"].includes(type)) {
        // eslint-disable-next-line radix
        const newValue = parseInt(this.newValue);
        if (isNaN(newValue)) {
          show_notification(
            `Invalid input: ${this.newValue} is not a number`,
            "danger",
          );
          return;
        }

        value = BigInt.asUintN(regSize, BigInt(newValue));
        // TODO: for RISC-V, use CAPI.RISCV.toBigInt
      } else if (type === "float") {
        const newValue = parseFloat(this.newValue);
        if (isNaN(newValue)) {
          show_notification(
            `Invalid input: ${this.newValue} is not a number`,
            "danger",
          );
          return;
        }

        if (doublePrecision) {
          value = BigInt.asUintN(
            regSize,
            BigInt(parseInt(double2bin(newValue), 2)),
          );
        } else {
          value = BigInt.asUintN(
            regSize,
            BigInt(parseInt(float2bin(newValue), 2)),
          );
        }
      }
      // write and reset
      writeRegister(value!, reg.indexComp!, reg.indexElem!);
      this.newValue = "";
      // this.showValue = false // close popup

      // Google Analytics
      creator_ga("data", "data.change", "data.change.register_value");
      creator_ga("data", "data.change", "data.change.register_value_" + name);
    },

    // function to split in vector register file
    showValues(reg_type, data) {

      let size_elem = document.app.$data.v_length;
      var elems = [];
      switch (reg_type) {
        case "Hex":
          for (let i = 0; i < data.length; i+= (size_elem / 4)) {
            if (data.startsWith("0x")) {
              elems.push("0x" + data.slice((i + 2), (i + 2) + (size_elem / 4)));
            } else 
              elems.push("0x" + data.slice(i, i + (size_elem / 4)));
          }
          break;
        case "Signed": 
          for (let i = 0; i < data.length; i+= (size_elem / 4)) {
              const singBit = 1n << BigInt(size_elem - 1);
              const mask = 1n << BigInt(size_elem);  
              if (data.startsWith("0x")) {
                const value = BigInt("0x" + data.slice((i + 2), (i + 2) + (size_elem / 4))); 
                elems.push((value & singBit) ? value - mask : value);
              } else {
                const value = BigInt("0x" + data.slice(i, i + (size_elem / 4)));
                elems.push((value & singBit) ? value - mask : value);
              }
              
          }
          break;
        case "Unsigned":
          for (let i = 0; i < data.length; i+= (size_elem / 4)) {
            // if (size_elem <= 32) {
            if (data.startsWith("0x")) {
              elems.push(BigInt("0x" + data.slice((i + 2), (i + 2) + (size_elem / 4))));
            } else 
              elems.push(BigInt("0x" + data.slice(i, i + (size_elem / 4))));  
          }
          break;
        case "Binary":
          for (let i = 0; i < data.length; i+= (size_elem / 4)) {
            if (data.startsWith("0x")) {
              elems.push(data.slice((i + 2), (i + 2) + (size_elem / 4)).split('').map(h => parseInt(h, 16).toString(2).padStart(4, '0')).join(''));
            } else {
              elems.push(data.slice(i, i + (size_elem / 4)).split('').map(h => parseInt(h, 16).toString(2).padStart(4, '0')).join(''));
            }
          }
          break;
        case "Char":
          if (data.startsWith("0x"))
            data = data.slice(2, data.length);
          for (let i = 0; i < data.length; i+= (size_elem / 4)) {
            var elem = data.slice((i + 2), (i + 2) + (size_elem / 4));
            elems.push(String.fromCharCode(parseInt(elem.slice(-2), 16)));
          }
          
          break;
        case "IEEE 754 32":
          if (data.startsWith("0x"))
            data = data.slice(2);
          for (let i = 0; i < data.length; i+= (size_elem / 4)) {
            var elem = data.slice(i, i + (size_elem / 4));
            elems.push(hex2float(elem));
          }
          break;
        case "IEEE 754 64":
          if (data.startsWith("0x"))
            data = data.slice(2, data.length);
          for (let i = 0; i < data.length; i+= (size_elem / 4)) {
            var elem = data.slice(i, i + (size_elem / 4));
            elems.push(hex2double(elem));
          }
          break;
      }
      return elems;
    }
  },
});
</script>

<template>
  <b-modal
    :id="id"
    responsive
    no-footer
    centered
    :class="modalSize"
    :title="`Space view for ${item?.name.join(' | ')}`"
  >
    <b-table-simple v-if="item" small responsive bordered>
      <b-tbody>
        <b-tr>
          <b-td  v-if="Sail_arch && item.type === 'v_registers'" >Hexadecimal <br>(v[{{ vectorMaxLength }}] - v[0])</b-td>
          <b-td  v-if="!Sail_arch || (Sail_arch && item.type !== 'v_registers') ">Hexadecimal</b-td>
          <b-td v-if="Sail_arch && item.type === 'v_registers'">
            <b-badge v-for="value in showValues('Hex', item.hex)" class="registerPopover" style="margin: 0.5%;"> {{ value }}</b-badge>
          </b-td>
          <b-td v-if="!Sail_arch || (Sail_arch && item.type !== 'v_registers')">
            <b-badge class="registerPopover"> {{ item.hex }} </b-badge>
          </b-td>
        </b-tr>
        <b-tr>
          <b-td  v-if="Sail_arch && item.type === 'v_registers'" >Binary <br> (v[{{ vectorMaxLength }}] - v[0])</b-td>
          <b-td  v-if="!Sail_arch || (Sail_arch && item.type !== 'v_registers') ">Binary</b-td>
          <!-- <b-td>Binary</b-td> -->
          <b-td v-if="Sail_arch && item.type === 'v_registers'">
            <b-badge v-for="value in showValues('Binary', item.hex)" class="registerPopover" style="margin: 0.5%;"> {{ value }}</b-badge>
          </b-td>
          <b-td v-if="!Sail_arch || (Sail_arch && item.type !== 'v_registers')">
            <b-badge class="registerPopover"> {{ item.bin }} </b-badge>
          </b-td>
        </b-tr>
        <b-tr v-if="item.type !== 'float'">
          <b-td  v-if="Sail_arch && item.type === 'v_registers'" >Signed <br> (v[{{ vectorMaxLength }}] - v[0])</b-td>
          <b-td  v-if="!Sail_arch || (Sail_arch && item.type !== 'v_registers') ">Signed</b-td>
          <!-- <b-td>Signed</b-td> -->

          <b-td v-if="Sail_arch && item.type === 'v_registers'">
            <b-badge v-for="value in showValues('Signed', item.hex)" class="registerPopover" style="margin: 0.3%;"> {{ value }}</b-badge>
          </b-td>
          <b-td v-if="!Sail_arch || (Sail_arch && item.type !== 'v_registers')">
            <b-badge class="registerPopover"> {{ item.signed }} </b-badge>
          </b-td>
        </b-tr>
        <b-tr v-if="item.type !== 'float'">
          <b-td  v-if="Sail_arch && item.type === 'v_registers'" >Unsigned <br> (v[{{ vectorMaxLength }}] - v[0])</b-td>
          <b-td  v-if="!Sail_arch || (Sail_arch && item.type !== 'v_registers') ">Unsigned</b-td>
          <!-- <b-td>Unsigned</b-td> -->

          <b-td v-if="Sail_arch && item.type === 'v_registers'">
            <b-badge v-for="value in showValues('Unsigned', item.hex)" class="registerPopover" style="margin: 0.3%;"> {{ value }}</b-badge>
          </b-td>
          <b-td v-if="!Sail_arch || (Sail_arch && item.type !== 'v_registers')">
            <b-badge class="registerPopover"> {{ item.unsigned }} </b-badge>
          </b-td>
        </b-tr>
        <b-tr v-if="item.type !== 'float'">
          <!-- <b-td>Char</b-td> -->
          <b-td  v-if="Sail_arch && item.type === 'v_registers'" >Char <br> (v[{{ vectorMaxLength }}] - v[0])</b-td>
          <b-td  v-if="!Sail_arch || (Sail_arch && item.type !== 'v_registers') ">Char</b-td>

          <b-td v-if="Sail_arch && item.type === 'v_registers'">
            <b-badge v-for="value in showValues('Char', item.hex)" class="registerPopover" style="margin: 0.3%;"> {{ value }}</b-badge>
          </b-td>
          <b-td v-if="!Sail_arch|| (Sail_arch && item.type !== 'v_registers')">
            <b-badge class="registerPopover"> {{ item.char }} </b-badge>
          </b-td>
        </b-tr>
        <b-tr>
          <!-- <b-td>IEEE 754 (32 bits)</b-td> -->
          <b-td style="width: 13% ;" v-if="Sail_arch && item.type === 'v_registers'" >IEEE 754 (32 bits) <br> (v[{{ vectorMaxLength }}] - v[0])</b-td>
          <b-td  v-if="!Sail_arch || (Sail_arch && item.type !== 'v_registers') ">IEEE 754 (32 bits)</b-td>

          <b-td v-if="Sail_arch && item.type === 'v_registers'">
            <b-badge v-for="value in showValues('IEEE 754 32', item.hex)" class="registerPopover" style="margin: 0.3%;"> {{ value }}</b-badge>
          </b-td>
          <b-td v-if="!Sail_arch|| (Sail_arch && item.type !== 'v_registers')">
            <b-badge class="registerPopover"> {{ item.ieee32 }} </b-badge>
          </b-td>
        </b-tr>
        <b-tr>
          <!-- <b-td>IEEE 754 (64 bits)</b-td> -->
          <b-td  v-if="Sail_arch && item.type === 'v_registers'" >IEEE 754 (64 bits) <br> (v[{{ vectorMaxLength }}] - v[0])</b-td>
          <b-td  v-if="!Sail_arch || (Sail_arch && item.type !== 'v_registers') ">IEEE 754 (64 bits)</b-td>

          <b-td v-if="Sail_arch && item.type === 'v_registers'">
            <b-badge v-for="value in showValues('IEEE 754 64', item.hex)" class="registerPopover" style="margin: 0.3%;"> {{ value }}</b-badge>
          </b-td>
          <b-td v-if="!Sail_arch || (Sail_arch && item.type !== 'v_registers')">
            <b-badge class="registerPopover"> {{ item.ieee64 }} </b-badge>
          </b-td>
        </b-tr>
      </b-tbody>
    </b-table-simple>

    <!-- Edit value -->
    <b-container v-if="item" fluid align-h="center" class="mx-0">
      <b-row align-h="center" :cols="doublePrecision ? 3 : 2">
        <b-col>
          <b-form-input
            v-model="newValue"
            type="text"
            size="sm"
            title="New Register Value"
            placeholder="Enter new value"
          />
        </b-col>
        <b-col v-if="doublePrecision">
          <b-form-select v-model="precision" size="sm" block>
            <b-form-select-option value="simple">
              Simple Precision
            </b-form-select-option>
            <b-form-select-option value="double" active>
              Double Precision
            </b-form-select-option>
          </b-form-select>
        </b-col>
        <b-col>
          <b-button
            class="w-100"
            variant="primary"
            size="sm"
            @click="
              updateRegister(
                item.name.at(0)!,
                item.type,
                precision === 'double',
              )
            "
          >
            Update
          </b-button>
        </b-col>
      </b-row>
    </b-container>
  </b-modal>
</template>
