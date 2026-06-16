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

  return {
    results,
    popupSize,
    load,
    setAll,
    clearKeyword,
    clearAll,
    savePopupSize
  }
}
