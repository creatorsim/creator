# Vue 3 tricks
Here are some tricks you'll see throughout the code...


## Component properties
A component object, typically accessed through `this` in a component, is a special object, with all its data and methods publicly available, e.g. `this.whatever()` or `this.foo`.

It also has some _special_ properties:
- `.$parent`: The parent component
- `.$root`: The root component (typically, `App`)
- `.$data`: The component's data
- `.$props`: The component's properties
- `.$refs`: Map of subcomponent references and their corresponding component objects


## Making the root component accessible from JS
To make the root component accesible from outside Vue, we'll store a reference in the `document` object, e.g. after mounting the app, in `main.js`:

```js
import { createApp } from "vue"
import App from "./App.vue"

// ...

const app = createApp(App)

// ...

document.app = app.mount("#app")
```


## Sync data between parent and child component
Here, we'll make use of [computed properties](https://vuejs.org/guide/essentials/computed.html#computed-properties) to automatically sync the values. First, we'll pass the parent's value to the child through a property. Then, we'll create a computed property so when we're reading the value (getter), we'll read the property, and when we're updating it (setter), we'll update the parent's value.

You can always access your parent's component through `this.$parent`, but if you're using other components in between, like a Bootstrap container, this doesn't work as intended, because the parent will be the container.

The alternative is using [events](https://vuejs.org/guide/components/events.html#emitting-and-listening-to-events), by emiting an event on the setter and capturing it on the parent with a [v-model](https://vuejs.org/guide/components/v-model.html#component-v-model).

```vue
<!-- Parent.vue -->

<script lang="ts">
import { defineComponent } from "vue"

import Child from "./Child.vue"

export default defineComponent({
  components: { Child },
  data() {
      return {
      message: 'hello'
    }
  }
})
</script>

<template>
  <Child v-model:movelValue="message" /> {{ message }}
</template>
```

```vue
<!-- Child.vue -->

<script lang="ts">
import { defineComponent } from "vue"

export default defineComponent({
  props: { modelValue: { type: String, required: true } },
  emits: ['update:modelValue'],
  computed: {
    value: {
      get() {
        return this.modelValue
      },
      set(value: string) {
        this.$emit('update:modelValue', value)
      }
    }
  }
})
</script>

<template>
  <input v-model="value" />
</template>
```


## Sync data between a component and the root component
This is done similarly to how we [sync between a parent and a child](#sync-data-between-parent-and-child-component), but instead of using events, we access the root component with `this.$root`:

```vue
<!-- App.vue -->

<script lang="ts">
import { defineComponent } from "vue"

import Child from "./Child.vue"

export default defineComponent({
  components: { Child },
  data() {
      return {
      message: 'hello'
    }
  }
})
</script>

<template>
  <Child :message="message" /> {{ message }}
</template>
```

```vue
<!-- Child.vue -->

<script lang="ts">
import { defineComponent } from "vue"

export default defineComponent({
  props: { message: { type: String, required: true } },
  computed: {
    value: {
      get() {
        return this.message
      },
      set(value: string) {
        (this.$root as any).message = value
      }
    }
  }
})
</script>

<template>
  <input v-model="value" />
</template>
```



## Navigating the component tree
To easily navigate the component tree, you can make use of [references](https://vuejs.org/guide/essentials/template-refs.html#template-refs). You can tag a child component with a `ref`, and it will be one of the references (`.$refs`) of the parent.

Let's see a simple example, with a simple `App.vue` root component:
```vue
<script lang="ts">
//...
</script>

<template>
  <Child ref="my_child" />
</template>
```

In that case, one can access the child component from inside the component with `this.$refs.my_child`, or from another component through `this.$root.$refs.my_child`. Or, if you are [able to access the root component from JS](#making-the-root-component-accessible-from-js), you can do `document.app.$root.$refs.$my_child`.

And, of course, this is recursive, but remember that a component can only view its direct references, not its children's references. 



## Accessing component data from JS
First, ensure you can [access the root component from JS](#making-the-root-component-accessible-from-js).

Then, it's just a case of getting the component and updating its variable, e.g. `document.app.foo = "bar"`.

But... how do you access a nested component, not just the root? You'll have to [navigate the component tree](#navigating-the-component-tree).



## Force-update a component
There is a tricky case where Vue's reactivity is not so reactive. Imagine you define a nested array or object in a JS library, and you want to show the values on a component, but the library also mutates those values. _Sometimes_, those updates are not recognized by Vue, and no amount of `:key` or `ref`s help. In this case, you must force an update.

To do this, we'll create a dummy variable and a method that will update that variable on the parent component, and pass the variable to each child component we want to refresh through the use of [the key attribute](https://vuejs.org/api/built-in-special-attributes.html#key).

```vue
<!-- App.vue -->

<script lang="ts">
import { defineComponent } from "vue"

import { bar } from "./foo.mts"

import ComponentToUpdate from "./ComponentToUpdate.vue"

export default defineComponent({
  components: { ComponentToUpdate },

  data() {
    return {
      render: 0, // dummy variable to force components with this as key to refresh
      bar: bar,
      // ...
    }
  },

  methods: {
      refresh() {
      // refreshes children components with `:key="render"`
      this.render++
    },
  }
})
</script>

<template>
  <ComponentToUpdate
    :bar="bar"
    :key="render"
  />
</template>
```

```ts
/* foo.mts */

export let bar = [ { ... } ]

export updateBar() {
    bar = ...
    document.app.$root.refresh()  // force update of component
}
```

Remember that if you want to update a nested component, not just the root one, you must [navigate the component tree](#navigating-the-component-tree).

## Event-based updates from non-Vue code

This is the alternative to the direct state mutation approach above when you have core business logic in plain JavaScript/TypeScript that needs to notify Vue components about updates. It keeps your core decoupled from Vue and works across all environments (browser, CLI, Node.js, etc.).

### Implementation with mitt (tiny event emitter so we don't reinvent the wheel)

**1. Create a central event emitter** in your core:
```js
// core/events.mjs
import mitt from "mitt"

/**
 * Event types for CREATOR core events
 */
export const CoreEventTypes = {
    REGISTER_UPDATED: "register-updated",
    REGISTERS_RESET: "registers-reset",
    STATS_UPDATED: "stats-updated",
}

/**
 * Global event emitter for core events
 * Used to notify UI layers about core state changes
 * CLI version simply doesn't subscribe to these events
 */
export const coreEvents = mitt()
```

**2. Emit events from your core logic** instead of directly updating UI:
   ```js
   // core/someModule.mjs
   import { coreEvents } from "./events.mjs"
   
   export function updateSomeData(indexComp, indexElem) {
       // ... update your data ...
       data[indexComp].registers[indexElem].value = newValue
       
       // Notify UI layers (CLI ignores, web UI listens)
       coreEvents.emit("data-updated", { indexComp, indexElem })
   }
   ```

**3. Subscribe to events in Vue components**:
```vue
<!-- Component.vue -->
<script lang="ts">
import { defineComponent } from "vue"
import { coreEvents } from "@/core/events.mjs"
import { DATA } from "@/core/someModule.mjs"

export default defineComponent({
  data() {
    return {
      data: DATA,
    }
  },

  mounted() {
    // Subscribe to events from core
    coreEvents.on("data-updated", this.onDataUpdated)
  },

  beforeUnmount() {
    // IMPORTANT: Clean up event listener to prevent memory leaks
    coreEvents.off("data-updated", this.onDataUpdated)
  },

  methods: {
    onDataUpdated(payload: any) {
      const { indexComp, indexElem } = payload
      
      // Option 1: Update specific child component
      const refs = this.$refs[`item${indexComp}_${indexElem}`] as any
      refs?.refresh?.()
      
      // Option 2: Update all components (for batch operations)
      // this.refreshAll()
    }
  }
})
</script>

<template>
  <ChildComponent
    v-for="item in data"
    :key="item.id"
    :ref="`item${item.id}`"
    :data="item"
  />
</template>
```

### Batch operations

For operations that update many items at once (like reset), emit a single batch event instead of individual events:

```js
// core/core.mjs
export function reset() {
    // Reset all data
    for (let i = 0; i < DATA.length; i++) {
        DATA[i].value = DATA_BACKUP[i].value
    }
    
    // Single event instead of hundreds
    coreEvents.emit("data-reset")
}
```

```vue
<!-- Component.vue -->
<script lang="ts">
export default defineComponent({
  mounted() {
    coreEvents.on("data-updated", this.onDataUpdated)
    coreEvents.on("data-reset", this.onDataReset)
  },
  
  methods: {
    onDataUpdated(payload: any) {
      // Handle single update
      const { indexComp, indexElem } = payload
      this.updateSingleItem(indexComp, indexElem)
    },
    
    onDataReset() {
      // Handle batch update - refresh all at once
      for (const item of this.data) {
        const refs = this.$refs[`item${item.id}`] as any
        refs?.refresh?.()
      }
    }
  }
})
</script>
```


## TypeScript tricks

### `this.$root` crap
Use `(this.$root as any)`.


### Custom prop types
```ts
import { defineComponent, type PropType } from "vue"
import type { MyType } from "myTypes.ts"

export default defineComponent({
  props: {
    stuff: { type: Object as PropType<MyType>, required: true },
  }
})
```


### Custom data types
```ts
import { defineComponent } from "vue"
import type { MyType } from "myTypes.ts"

export default defineComponent({
  data() {
    return { stuff: null as MyType | null }
  }
})
```
