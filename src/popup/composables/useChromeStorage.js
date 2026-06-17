import { ref } from 'vue'

export function useChromeStorage() {
  const results = ref([])
  const popupSize = ref({ width: 500, height: 600 })
  const panelWidth = ref(30)

  async function load() {
    return new Promise(resolve => {
      chrome.storage.local.get(['results', 'popupSize', 'panelWidth'], ({ results: stored = [], popupSize: size, panelWidth: width }) => {
        results.value = stored
        if (size) {
          popupSize.value = size
        }
        if (width) {
          panelWidth.value = width
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

  function savePopupSize(size) {
    return new Promise(resolve => {
      popupSize.value = size
      chrome.storage.local.set({ popupSize: size }, resolve)
    })
  }

  function savePanelWidth(width) {
    return new Promise(resolve => {
      panelWidth.value = width
      chrome.storage.local.set({ panelWidth: width }, resolve)
    })
  }

  return {
    results,
    popupSize,
    panelWidth,
    load,
    setAll,
    clearKeyword,
    savePopupSize,
    savePanelWidth
  }
}
