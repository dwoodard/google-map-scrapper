<template>
  <div class="export-dropdown" @click.stop>
    <button class="export-btn" @click="toggleDropdown" title="Export results">
      ⬇️ Export
    </button>
    <div v-if="isOpen" class="dropdown-menu">
      <button class="dropdown-item" @click="onDownloadJSON">
        📄 JSON
      </button>
      <button class="dropdown-item" @click="onDownloadCSV">
        📊 CSV
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { downloadJSON, downloadCSV } from '../utils/download.js'

const isOpen = ref(false)

const props = defineProps({
  results: Array
})

function toggleDropdown() {
  isOpen.value = !isOpen.value
}

function closeDropdown() {
  isOpen.value = false
}

function onDownloadJSON() {
  downloadJSON(props.results)
  closeDropdown()
}

function onDownloadCSV() {
  downloadCSV(props.results)
  closeDropdown()
}

// Close dropdown when clicking outside
function handleClickOutside(e) {
  const dropdown = document.querySelector('.export-dropdown')
  if (dropdown && !dropdown.contains(e.target)) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.export-dropdown {
  position: relative;
}

.export-btn {
  background: #1a73e8;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.export-btn:hover {
  background: #1557b0;
  box-shadow: 0 2px 6px rgba(26, 115, 232, 0.3);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  margin-top: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  min-width: 120px;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 12px;
  text-align: left;
  transition: all 0.2s;
  color: #333;
}

.dropdown-item:hover {
  background: #f5f5f5;
  color: #1a73e8;
}

.dropdown-item:first-child {
  border-radius: 4px 4px 0 0;
}

.dropdown-item:last-child {
  border-radius: 0 0 4px 4px;
}
</style>
