<script lang="ts">
import { remove_library } from "@/core/core.mjs";
import { defineComponent } from "vue";

export default defineComponent({
  name: "ActivityBar",
  props: {
    modelValue: {
      type: String,
      required: true,
    },
    dark: {
      type: Boolean,
      required: true,
    },
    autohide: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  emits: ["update:modelValue"],
  methods: {
    selectMode(mode: string) {
      if (mode !== this.modelValue) {
        this.$emit("update:modelValue", mode);
      }
    },
    removeLibrary() {
      remove_library();
    },
  },
});
</script>

<template>
  <div class="activity-bar-container" :class="{ autohide: autohide }">
    <div class="activity-bar" :class="{ 'dark-mode': dark }">
      <div class="activity-bar-content">
        <hr />
        <div
          class="activity-item"
          :class="{ active: modelValue === 'assembly' }"
          @click="selectMode('assembly')"
          title="Editor"
        >
          <font-awesome-icon :icon="['fas', 'hashtag']" size="lg" />
        </div>

        <div
          class="activity-item"
          :class="{ active: modelValue === 'simulator' }"
          @click="selectMode('simulator')"
          title="Simulator"
        >
          <font-awesome-icon :icon="['fas', 'gears']" size="lg" />
        </div>

        <hr />

        <div v-if="modelValue === 'assembly'">
          <div
            class="activity-item"
            v-b-modal.examples_assembly
            title="Examples"
          >
            <font-awesome-icon :icon="['fas', 'file-lines']" size="lg" />
          </div>
          <hr />
          <div class="activity-item" v-b-modal.load_assembly title="Load file">
            <font-awesome-icon :icon="['fas', 'upload']" size="lg" />
          </div>
          <div class="activity-item" v-b-modal.save_assembly title="Save file">
            <font-awesome-icon :icon="['fas', 'download']" size="lg" />
          </div>
          <div class="activity-item" v-b-modal.make_uri title="Get code as URI">
            <font-awesome-icon :icon="['fas', 'link']" size="lg" />
          </div>
          <div class="activity-item" v-b-modal.load_uri title="Load from URI">
            <font-awesome-icon
              :icon="['fas', 'arrow-up-right-from-square']"
              size="lg"
            />
          </div>
          <hr />
          <div class="activity-item" v-b-modal.load_binary title="Load library">
            <font-awesome-icon :icon="['fas', 'file-arrow-up']" size="lg" />
          </div>
          <div
            class="activity-item"
            @click="removeLibrary"
            title="Remove library"
          >
            <font-awesome-icon :icon="['fas', 'trash-can']" size="lg" />
          </div>
          <hr />
          <div
            class="activity-item"
            v-b-modal.calculator_assembly
            title="IEEE754 Calculator"
          >
            <font-awesome-icon :icon="['fas', 'calculator']" size="lg" />
          </div>
          <hr />
        </div>

        <div v-if="modelValue === 'simulator'">
          <div
            class="activity-item"
            v-b-modal.examples_simulator
            title="Examples"
          >
            <font-awesome-icon :icon="['fas', 'file-lines']" size="lg" />
          </div>
          <hr />
          <div class="activity-item" v-b-modal.flash title="Flash">
            <font-awesome-icon :icon="['fab', 'usb']" size="lg" />
          </div>
          <div
            class="activity-item"
            v-b-modal.calculator_simulator
            title="IEEE754 Calculator"
          >
            <font-awesome-icon :icon="['fas', 'calculator']" size="lg" />
          </div>
          <hr />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.activity-bar-container {
  width: 50px;
  min-height: 100%;
  flex-shrink: 0;
  position: relative;
  transition: width 0.3s ease;

  hr {
    margin-top: 10px;
    margin-bottom: 10px;
  }

  &.autohide {
    width: 0;

    .activity-bar {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 50px;
      transform: translateX(-100%);
      transition: transform 0.3s ease;
    }

    &::after {
      content: "";
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 15px;
    }

    &:hover {
      .activity-bar {
        transform: translateX(0);
        box-shadow: 2px 0 5px rgba(0, 0, 0, 0.2);
      }
    }
  }
}

.activity-bar {
  width: 50px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: rgb(238, 238, 238);
  border-right: 1px solid #dee2e6;
  flex-shrink: 0;

  &.dark-mode {
    background-color: hsl(214, 9%, 12%);
    border-right: 1px solid rgba(255, 255, 255, 0.1);

    .activity-item {
      color: #adb5bd;

      &:hover {
        color: #f8f9fa;
        background-color: rgba(255, 255, 255, 0.1);
      }

      &.active {
        color: #64b5f6;
        border-left-color: #64b5f6;
      }
    }
  }

  .activity-bar-content {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .activity-item {
    width: 50px;
    height: 50px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    color: #6c757d;
    border-left: 3px solid transparent;
    transition: all 0.2s ease;

    &:hover {
      color: #212529;
      background-color: rgba(0, 0, 0, 0.1);
    }

    &.active {
      color: #2196f3;
      border-left-color: #2196f3;
    }

    &:active:not(.active) {
      transform: scale(0.95);
    }
  }
}
</style>
