<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <div class="modal-header">
        <h2>{{ entry.name }}</h2>
        <button class="close-btn" @click="close">✕</button>
      </div>

      <div v-if="statusMessage" :class="['status-toast', statusMessage.type]">
        {{ statusMessage.text }}
      </div>

      <div class="modal-body">
        <div class="status-line">
          {{ entry.source === 'bulk' ? '✅ Enriched' : '⌛ Pending enrichment' }}
        </div>

        <div class="details-grid">
          <div class="detail-item">
            <span class="label">Category:</span>
            <span class="value">{{ entry.category || 'N/A' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Rating:</span>
            <span class="value">{{ entry.rating || 'N/A' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Reviews:</span>
            <span class="value">{{ entry.reviews || 'N/A' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Address:</span>
            <span class="value">{{ entry.address || 'N/A' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Phone:</span>
            <span class="value">{{ entry.phone || 'N/A' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Website:</span>
            <span class="value">
              <a v-if="isValidUrl" :href="entry.website" target="_blank">
                {{ entry.website }}
              </a>
              <span v-else>{{ entry.website || 'N/A' }}</span>
            </span>
          </div>
          <div class="detail-item">
            <span class="label">Plus Code:</span>
            <span class="value">{{ entry.plusCode || 'N/A' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Hours:</span>
            <span class="value">{{ entry.hours || 'N/A' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Status:</span>
            <span class="value">{{ entry.status || 'N/A' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Price:</span>
            <span class="value">{{ entry.priceRange || 'N/A' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Coordinates:</span>
            <span class="value">{{ entry.latitude }}, {{ entry.longitude }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Place ID:</span>
            <span class="value monospace">{{ entry.placeId || 'N/A' }}</span>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button
          v-if="entry.source !== 'bulk'"
          class="btn btn-primary"
          @click="retryEnrichment"
          :disabled="isRetrying"
        >
          {{ isRetrying ? 'Fetching...' : '📥 Fetch Data' }}
        </button>
        <button class="btn btn-secondary" @click="close">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  entry: Object
})

const isOpen = ref(false)
const isRetrying = ref(false)

const isValidUrl = computed(() => {
  return props.entry?.website && props.entry.website !== 'N/A' && props.entry.website.startsWith('http')
})

function open() {
  isOpen.value = true
}

function close() {
  isOpen.value = false
}

async function retryEnrichment() {
  isRetrying.value = true
  try {
    // Send message to content script to enrich this specific result by Place ID
    await chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'ENRICH_SINGLE',
          placeId: props.entry.placeId,
          name: props.entry.name
        }, () => {
          // ignore errors
        })
      }
    })

    // Wait a moment for enrichment to complete
    await new Promise(r => setTimeout(r, 8000))

    // Refresh the entry from storage
    const updated = await new Promise((resolve) => {
      chrome.storage.local.get(['results'], ({ results = [] }) => {
        const found = results.find(r => r.placeId === props.entry.placeId)
        resolve(found)
      })
    })

    if (updated) {
      Object.assign(props.entry, updated)
      alert('✅ Enrichment complete! Details have been updated.')
    } else {
      alert('❌ Could not enrich. Make sure you\'re on the Google Maps search page.')
    }
  } catch (err) {
    console.error('Error retrying enrichment:', err)
    alert('❌ Error during enrichment. Check console.')
  } finally {
    isRetrying.value = false
  }
}

defineExpose({ open, close })
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}

.status-line {
  font-size: 12px;
  font-weight: 500;
  color: #666;
  margin-bottom: 12px;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
}

.details-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  font-size: 11px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.detail-item:last-child {
  border-bottom: none;
}

.label {
  font-weight: 500;
  color: #555;
  min-width: 90px;
}

.value {
  color: #333;
  word-break: break-word;
  text-align: right;
  flex: 1;
  margin-left: 8px;
}

.value.monospace {
  font-family: monospace;
  font-size: 10px;
}

.value a {
  color: #1a73e8;
  text-decoration: none;
}

.value a:hover {
  text-decoration: underline;
}

.modal-footer {
  padding: 12px 16px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
}

.btn-secondary:hover {
  background: #e0e0e0;
}
</style>
