<template>
  <header>
    <div class="header-top">
      <h1>Google Maps Scraper</h1>
      <div class="header-buttons">
        <DataManager :results="results" :on-clean="$emit('clean-duplicates')" />
        <ExportDropdown :results="results" />
      </div>
    </div>
    <div class="toggle-section">
      <label title="Enable to auto-capture listings as you click them on Google Maps">
        <input
          type="checkbox"
          :checked="active"
          @change="$emit('toggle-active', $event.target.checked)"
        />
        <span :class="['indicator', active ? 'active' : 'inactive']"></span>
        <span id="statusText">{{ active ? 'Auto-Capture On' : 'Auto-Capture Off' }}</span>
      </label>
      <span class="count">{{ total }} total</span>
    </div>
  </header>
</template>

<script setup>
import ExportDropdown from './ExportDropdown.vue'
import DataManager from './DataManager.vue'

defineProps({
  active: Boolean,
  total: Number,
  results: Array
})

defineEmits(['toggle-active', 'clean-duplicates'])
</script>

<style scoped>
.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

h1 {
  margin-bottom: 0;
}

.header-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
