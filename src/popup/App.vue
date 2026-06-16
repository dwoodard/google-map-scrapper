<template>
  <div class="container">
    <AppHeader
      :active="activeToggle"
      :total="results.length"
      :results="results"
      @toggle-active="handleToggleActive"
    />

    <ScrapeControls
      :isScraping="isScraping"
      @bulk-scrape="handleBulkScrape"
      @request-clear-all="showClearAllModal"
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
      }
    }
  },
  async (entry) => {
    // Persist new entry to storage immediately
    if (entry) {
      await storage.setAll([...results.value])
    }
  }
)

const { isScraping, progress } = messaging

const clearModalTitle = computed(() => {
  if (!pendingClear.value) return ''
  if (pendingClear.value.type === 'keyword') {
    return `Clear results for "${pendingClear.value.keyword}"?`
  }
  return 'Clear All Keywords?'
})

const clearModalMessage = computed(() => {
  if (!pendingClear.value) return ''
  if (pendingClear.value.type === 'keyword') {
    const count = keywordGroups.value[pendingClear.value.keyword]?.length || 0
    return `This will permanently delete ${count} result${count !== 1 ? 's' : ''} for this search term.`
  }
  const total = results.value.length
  const keywords = Object.keys(keywordGroups.value).length
  return `This will permanently delete ${total} result${total !== 1 ? 's' : ''} across ${keywords} search term${keywords !== 1 ? 's' : ''}.`
})

const clearConfirmLabel = computed(() => {
  if (!pendingClear.value) return 'Confirm'
  return pendingClear.value.type === 'keyword' ? 'Clear Keyword' : 'Clear All'
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

async function handleBulkScrape() {
  await messaging.bulkScrape()
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

function showClearAllModal() {
  pendingClear.value = { type: 'all' }
}

async function handleConfirmClear() {
  if (!pendingClear.value) return

  if (pendingClear.value.type === 'keyword') {
    await storage.clearKeyword(pendingClear.value.keyword)
    if (selectedKeyword.value === pendingClear.value.keyword) {
      selectedKeyword.value = null
    }
  } else {
    await storage.clearAll()
    selectedKeyword.value = null
  }

  pendingClear.value = null
}

async function handleSavePopupSize(size) {
  await storage.savePopupSize(size)
}
</script>
