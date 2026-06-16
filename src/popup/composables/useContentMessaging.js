import { ref, onMounted, onUnmounted } from 'vue'

export function useContentMessaging(onProgressCallback, onEntryCapture) {
  const isScraping = ref(false)
  const progress = ref({ done: 0, total: 0 })

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
      scrollToBottom: options.scrollToBottom !== false  // default true
    })
  }

  function stopScrape() {
    return sendToContentScript({ type: 'STOP_SCRAPE' })
  }

  function loadCaptured() {
    return sendToContentScript({ type: 'LOAD_CAPTURED' })
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
        console.log(`[Popup] ✅ Scrape completed`)
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
    activate,
    bulkScrape,
    stopScrape,
    loadCaptured,
    sendToContentScript
  }
}
