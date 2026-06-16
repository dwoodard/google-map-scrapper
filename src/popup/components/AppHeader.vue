<template>
  <header>
    <div class="header-top">
      <h1>Google Maps Scraper</h1>
      <div class="header-buttons">
        <button class="btn-header" @click="openSidePanel" title="Open side panel for persistent view">📍 Side Panel</button>
        <DataManager @clean-done="$emit('clean-done')" />
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

defineEmits(['toggle-active', 'clean-done'])

async function openSidePanel() {
  try {
    const tab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
    if (tab) {
      await chrome.sidePanel.open({ tabId: tab.id })
    }
  } catch (err) {
    console.error('[Header] Error opening side panel:', err)
  }
}
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

.btn-header {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  color: #1a73e8;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-header:hover {
  background: #f0f7ff;
  border-color: #1a73e8;
  box-shadow: 0 2px 4px rgba(26, 115, 232, 0.15);
}

.btn-header:active {
  background: #e8f0ff;
}
</style>
