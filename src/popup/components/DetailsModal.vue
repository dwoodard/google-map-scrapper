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
        <button class="btn btn-danger" @click="showDeleteConfirm">🗑️ Delete</button>
        <div class="footer-spacer"></div>
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

  <ConfirmModal
    :model-value="showConfirm"
    title="Delete Item"
    :message="`Are you sure you want to delete '${entry.name}'? This cannot be undone.`"
    confirm-label="Delete"
    :danger="true"
    @confirm="handleDeleteConfirm"
    @cancel="showConfirm = false"
  />
</template>

<script setup>
import { ref, computed } from 'vue'
import ConfirmModal from './ConfirmModal.vue'

const props = defineProps({
  entry: Object
})

const emit = defineEmits(['delete'])

const isOpen = ref(false)
const isRetrying = ref(false)
const statusMessage = ref(null)
const showConfirm = ref(false)

const isValidUrl = computed(() => {
  return props.entry?.website && props.entry.website !== 'N/A' && props.entry.website.startsWith('http')
})

function open() {
  isOpen.value = true
}

function close() {
  isOpen.value = false
}

function showDeleteConfirm() {
  showConfirm.value = true
}

function handleDeleteConfirm() {
  emit('delete', props.entry)
  showConfirm.value = false
  close()
}

async function retryEnrichment() {
  isRetrying.value = true
  statusMessage.value = null
  console.log(`[Modal] Fetching data for: ${props.entry.name} (${props.entry.placeId})`);

  let enrichmentCompleted = false
  let enrichmentResult = null

  // Listen for enrichment completion message from content script
  const listener = (message, sender) => {
    console.log('[Modal] Message received:', message.type, 'from:', sender.url);
    if (message.type === 'ENRICHMENT_COMPLETE') {
      console.log('[Modal] Checking placeId match:', {
        messageId: message.entry?.placeId,
        entryId: props.entry.placeId,
        match: message.entry?.placeId === props.entry.placeId
      });
      if (message.entry?.placeId === props.entry.placeId) {
        console.log('[Modal] ✅ Enrichment message matches! Data:', message.entry);
        enrichmentCompleted = true
        enrichmentResult = message.entry
        chrome.runtime.onMessage.removeListener(listener)
      }
    }
  }
  chrome.runtime.onMessage.addListener(listener)

  try {
    // Send message to content script to enrich this specific result by Place ID
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tabs[0]) {
      throw new Error('No active tab found. Make sure you have a tab open.')
    }

    console.log(`[Modal] Sending ENRICH_SINGLE to content script...`);

    await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'ENRICH_SINGLE',
        placeId: props.entry.placeId,
        name: props.entry.name,
        mapsUrl: props.entry.mapsUrl
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[Modal] Error:', chrome.runtime.lastError);
          reject(new Error('Content script not available. Please make sure you\'re on a Google Maps page.'));
        } else {
          console.log('[Modal] Content script responded:', response);
          resolve(response);
        }
      })
    })

    // Wait for enrichment completion message (max 15 seconds)
    console.log(`[Modal] Waiting for enrichment to complete...`);
    let waitTime = 0
    while (!enrichmentCompleted && waitTime < 15000) {
      await new Promise(r => setTimeout(r, 500))
      waitTime += 500
    }

    if (enrichmentCompleted && enrichmentResult) {
      // Successfully enriched - update all fields
      console.log(`[Modal] Data updated successfully`);
      Object.assign(props.entry, enrichmentResult)
      statusMessage.value = {
        type: 'success',
        text: '✅ Data fetched successfully!'
      }
      setTimeout(() => {
        statusMessage.value = null
      }, 4000)
    } else {
      // Fallback: check storage directly
      console.log(`[Modal] Enrichment message not received, checking storage...`);
      const updated = await new Promise((resolve) => {
        chrome.storage.local.get(['results'], ({ results = [] }) => {
          const found = results.find(r => r.placeId === props.entry.placeId)
          console.log(`[Modal] Storage lookup - placeId: ${props.entry.placeId}, found:`, found)
          resolve(found)
        })
      })

      if (updated && updated.source === 'bulk') {
        console.log(`[Modal] Data updated successfully from storage`);
        Object.assign(props.entry, updated)
        statusMessage.value = {
          type: 'success',
          text: '✅ Data fetched successfully!'
        }
        setTimeout(() => {
          statusMessage.value = null
        }, 4000)
      } else if (updated) {
        // Still partial
        console.log(`[Modal] Data still partial - source: ${updated.source}`, updated);
        const filledFields = [updated.phone, updated.website, updated.address, updated.hours]
          .filter(f => f && f !== 'N/A').length
        statusMessage.value = {
          type: 'error',
          text: `⚠️ Incomplete data (${filledFields}/4 fields). Refresh the Google Maps page and try again.`
        }
      } else {
        statusMessage.value = {
          type: 'error',
          text: '❌ Could not find listing. Make sure you\'re on the correct Google Maps search page and the listing is visible.'
        }
      }
    }
  } catch (err) {
    console.error('[Modal] Error fetching enrichment:', err)
    statusMessage.value = {
      type: 'error',
      text: `❌ Error: ${err.message || 'Check console for details'}`
    }
  } finally {
    isRetrying.value = false
    chrome.runtime.onMessage.removeListener(listener)
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

.status-toast {
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 500;
  border-bottom: 1px solid #e0e0e0;
}

.status-toast.success {
  background: #d4edda;
  color: #155724;
  border-bottom-color: #c3e6cb;
}

.status-toast.error {
  background: #f8d7da;
  color: #721c24;
  border-bottom-color: #f5c6cb;
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
  justify-content: flex-start;
  align-items: center;
}

.footer-spacer {
  flex: 1;
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

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
}
</style>
