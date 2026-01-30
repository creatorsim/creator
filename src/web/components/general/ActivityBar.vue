<script lang="ts">
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
    }
  },
  emits: ["update:modelValue"],
  methods: {
    selectMode(mode: string) {
      if (mode !== this.modelValue) {
        this.$emit("update:modelValue", mode);
      }
    },
  },
});
</script>

<template>
  <div class="activity-bar-container" :class="{ 'autohide': autohide }">
    <div class="activity-bar" :class="{ 'dark-mode': dark }">
    <div class="activity-bar-content">
      <div
        class="activity-item"
        :class="{ active: modelValue === 'assembly' }"
        @click="selectMode('assembly')"
        title="Editor"
      >
        <font-awesome-icon :icon="['fas', 'file-code']" size="lg" />
      </div>

      <div
        class="activity-item"
        :class="{ active: modelValue === 'simulator' }"
        @click="selectMode('simulator')"
        title="Simulator"
      >
        <font-awesome-icon :icon="['fas', 'gears']" size="lg" />
      </div>

      <div
        class="activity-item"
        :class="{ active: modelValue === 'architecture' }"
        @click="selectMode('architecture')"
        title="Architecture"
      >
        <font-awesome-icon :icon="['fas', 'screwdriver-wrench']" size="lg" />
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
  z-index: 1000;

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
      z-index: 1001;
    }
    
    &::after {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 15px; 
      z-index: 1000;
    }

    &:hover {
      .activity-bar {
        transform: translateX(0);
        box-shadow: 2px 0 5px rgba(0,0,0,0.2);
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
  z-index: 1000;

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
