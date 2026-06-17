import { ref, onMounted, onUnmounted } from 'vue'

export function useContentMessaging(onProgressCallback, onEntryCapture) {
  const isScraping = ref(false)
  const progress = ref({ done: 0, total: 0 })
  const activeKeyword = ref(null)
  const pageListings = ref(new Set()) // placeIds currently on the page

  function sendToContentScript(message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, message, () => {
            // ignore error if content script not present
            resolve()
          })
        } else {
          reject(new Error('No active tab'))
        }
      })
    })
  }

  function activate(active) {
    return sendToContentScript({ type: 'ACTIVATE', active })
  }

  function bulkScrape(options = {}) {
    return sendToContentScript({
      type: 'BULK_SCRAPE',
      scrollToBottom: options.scrollToBottom !== false,  // default true
      statusFilter: options.statusFilter || 'all'  // 'all', 'enriched', 'pending'
    })
  }

  function stopScrape() {
    return sendToContentScript({ type: 'STOP_SCRAPE' })
  }

  function loadCaptured() {
    return sendToContentScript({ type: 'LOAD_CAPTURED' })
  }

  function scrollToListing(placeId, name) {
    return sendToContentScript({ type: 'SCROLL_TO_LISTING', placeId, name })
  }

  function setupListener() {
    const listener = (message, sender, sendResponse) => {
      if (message.type === 'PROGRESS') {
        isScraping.value = true
        const { done, total, entry } = message
        progress.value = { done, total }
        console.log(`[Popup] 📥 Received: ${done}/${total} - ${entry?.name || 'N/A'}`)

        if (entry) {
          if (onProgressCallback) {
            onProgressCallback(entry)
          }
          if (onEntryCapture) {
            onEntryCapture(entry)
          }
        }
      } else if (message.type === 'SCRAPE_DONE') {
        isScraping.value = false
        progress.value = { done: 0, total: 0 }
        activeKeyword.value = null
        pageListings.value.clear()
        console.log(`[Popup] ✅ Scrape completed`)
      } else if (message.type === 'KEYWORD_ACTIVE') {
        activeKeyword.value = message.keyword
        console.log(`[Popup] 🔍 Active keyword: ${message.keyword}`)
      } else if (message.type === 'PAGE_LISTINGS') {
        pageListings.value = new Set(message.placeIds)
        console.log(`[Popup] 📍 Page listings: ${message.placeIds.length} items`, message.placeIds.slice(0, 3))
      }
    }

    chrome.runtime.onMessage.addListener(listener)

    return () => {
      chrome.runtime.onMessage.removeListener(listener)
    }
  }

  onMounted(() => {
    setupListener()
  })

  return {
    isScraping,
    progress,
    activeKeyword,
    pageListings,
    activate,
    bulkScrape,
    stopScrape,
    loadCaptured,
    scrollToListing,
    sendToContentScript
  }
}
