<template>
  <div class="container">
    <AppHeader
      :active="activeToggle"
      :total="results.length"
      :results="results"
      @toggle-active="handleToggleActive"
      @clean-done="handleCleanDone"
    />

    <div v-if="isScraping" class="scraping-banner">
      <div class="scraping-spinner">⟳</div>
      <div class="scraping-text">
        <div class="scraping-title">Scraping in progress...</div>
        <div class="scraping-progress">{{ progress.done }} / {{ progress.total }}</div>
      </div>
    </div>

    <ScrapeControls
      :isScraping="isScraping"
      @bulk-scrape="handleBulkScrape"
    />

    <div class="content">
      <KeywordList
        :keyword-groups="keywordGroups"
        :selected-keyword="selectedKeyword"
        @select="handleSelectKeyword"
        @request-clear="showClearKeywordModal"
      />

      <ResultsTable
        :selected-keyword="selectedKeyword"
        :keyword-groups="keywordGroups"
      />
    </div>

    <ProgressBar
      v-if="isScraping"
      :done="progress.done"
      :total="progress.total"
      @stop="handleStopScrape"
    />


    <ResizeHandle
      :popup-size="popupSize"
      :on-save-size="handleSavePopupSize"
    />

    <ConfirmModal
      :model-value="!!pendingClear"
      :title="clearModalTitle"
      :message="clearModalMessage"
      :confirm-label="clearConfirmLabel"
      :danger="true"
      @confirm="handleConfirmClear"
      @cancel="pendingClear = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import AppHeader from './components/AppHeader.vue'
import ScrapeControls from './components/ScrapeControls.vue'
import KeywordList from './components/KeywordList.vue'
import ResultsTable from './components/ResultsTable.vue'
import ProgressBar from './components/ProgressBar.vue'
import ResizeHandle from './components/ResizeHandle.vue'
import ConfirmModal from './components/ConfirmModal.vue'
import { useChromeStorage } from './composables/useChromeStorage.js'
import { useKeywordGroups } from './composables/useKeywordGroups.js'
import { useContentMessaging } from './composables/useContentMessaging.js'

const storage = useChromeStorage()
const { results, popupSize } = storage

const selectedKeyword = ref(null)
const pendingClear = ref(null)
const activeToggle = ref(false)

const keywordGroups = useKeywordGroups(results)

const messaging = useContentMessaging(
  (entry) => {
    // Check for duplicate by Place ID before adding to avoid duplicates in UI
    if (entry) {
      const placeId = entry.placeId || `unknown-${entry.name}`
      const exists = results.value.some(r => {
        const rPlaceId = r.placeId || `unknown-${r.name}`
        return rPlaceId === placeId
      })
      if (!exists) {
        results.value.push(entry)
        console.log(`[App] ✅ Added to UI: ${entry.name} (${entry.source})`)
      }
    }
  },
  async (entry) => {
    // Persist new entry to storage immediately
    if (entry) {
      await storage.setAll([...results.value])
      console.log(`[App] 💾 Saved to storage: ${entry.name}`)
    }
  }
)

const { isScraping, progress } = messaging

const clearModalTitle = computed(() => {
  if (!pendingClear.value) return ''
  return `Clear results for "${pendingClear.value.keyword}"?`
})

const clearModalMessage = computed(() => {
  if (!pendingClear.value) return ''
  const count = keywordGroups.value[pendingClear.value.keyword]?.length || 0
  return `This will permanently delete ${count} result${count !== 1 ? 's' : ''} for this search term.`
})

const clearConfirmLabel = computed(() => {
  return 'Clear Keyword'
})

onMounted(async () => {
  await storage.load()
  const tab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
  if (tab) {
    messaging.loadCaptured()
  }
  // Auto-Capture is always on — enable passive listening by default
  activeToggle.value = true
  await messaging.activate(true)
})

function handleToggleActive(active) {
  activeToggle.value = active
  messaging.activate(active)
}

async function handleBulkScrape(options = {}) {
  await messaging.bulkScrape(options)
}

async function handleStopScrape() {
  await messaging.stopScrape()
}

function handleSelectKeyword(keyword) {
  selectedKeyword.value = keyword
}

function showClearKeywordModal(keyword) {
  pendingClear.value = { type: 'keyword', keyword }
}

async function handleConfirmClear() {
  if (!pendingClear.value) return

  await storage.clearKeyword(pendingClear.value.keyword)
  if (selectedKeyword.value === pendingClear.value.keyword) {
    selectedKeyword.value = null
  }

  pendingClear.value = null
}

async function handleSavePopupSize(size) {
  await storage.savePopupSize(size)
}

async function handleCleanDone() {
  // Reload data after cleaning
  await storage.load()
}
</script>
