<template>
  <div class="data-manager">
    <button class="data-btn" @click="isOpen = !isOpen" title="Manage your data">
      ⚙️ Data
    </button>
    <div v-if="isOpen" class="dropdown-menu" @click.stop>
      <button class="dropdown-item" @click="cleanDuplicates">
        🧹 Clean Duplicates
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['clean-done'])

const isOpen = ref(false)

async function cleanDuplicates() {
  try {
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['results'], ({ results = [] }) => {
        const seen = new Map()

        // Find unique Place IDs, keeping most recent for each
        results.forEach(entry => {
          const placeId = entry.placeId || `unknown-${entry.name}`

          if (!seen.has(placeId)) {
            seen.set(placeId, entry)
          } else {
            const existing = seen.get(placeId)
            // Keep the more recent one
            if (new Date(entry.capturedAt) > new Date(existing.capturedAt)) {
              seen.set(placeId, entry)
            }
          }
        })

        const cleaned = Array.from(seen.values())
        const removed = results.length - cleaned.length

        if (removed > 0) {
          chrome.storage.local.set({ results: cleaned }, () => {
            resolve(removed)
          })
        } else {
          resolve(0)
        }
      })
    })

    isOpen.value = false

    if (result > 0) {
      alert(`✓ Cleaned ${result} duplicate${result !== 1 ? 's' : ''}!\n\nYour data is now deduplicated.`)
      emit('clean-done')
    } else {
      alert('✓ No duplicates found! Your data is clean.')
    }
  } catch (err) {
    console.error('Error cleaning duplicates:', err)
    alert('Error cleaning duplicates. Check console.')
  }
}
</script>

<style scoped>
.data-manager {
  position: relative;
}

.data-btn {
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

.data-btn:hover {
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
  min-width: 140px;
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
