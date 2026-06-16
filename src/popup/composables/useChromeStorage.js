import { ref } from 'vue'

export function useChromeStorage() {
  const results = ref([])
  const popupSize = ref({ width: 500, height: 600 })

  async function load() {
    return new Promise(resolve => {
      chrome.storage.local.get(['results', 'popupSize'], ({ results: stored = [], popupSize: size }) => {
        results.value = stored
        if (size) {
          popupSize.value = size
        }
        resolve()
      })
    })
  }

  function setAll(newResults) {
    return new Promise(resolve => {
      chrome.storage.local.set({ results: newResults }, () => {
        results.value = newResults
        resolve()
      })
    })
  }

  function clearKeyword(keyword) {
    const filtered = results.value.filter(r => (r.keyword || 'unknown') !== keyword)
    return setAll(filtered)
  }

  function clearAll() {
    return setAll([])
  }

  function savePopupSize(size) {
    return new Promise(resolve => {
      popupSize.value = size
      chrome.storage.local.set({ popupSize: size }, resolve)
    })
  }

  function cleanDuplicates() {
    return new Promise(resolve => {
      const seen = new Map()

      results.value.forEach(entry => {
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
      return setAll(cleaned).then(() => resolve(results.value.length - cleaned.length))
    })
  }

  return {
    results,
    popupSize,
    load,
    setAll,
    clearKeyword,
    clearAll,
    savePopupSize,
    cleanDuplicates
  }
}
