import { computed } from 'vue'

export function useKeywordGroups(results) {
  return computed(() => {
    const groups = {}

    results.value.forEach(result => {
      const keyword = result.keyword || 'unknown'
      if (!groups[keyword]) {
        groups[keyword] = []
      }
      groups[keyword].push(result)
    })

    // Sort keywords alphabetically
    const sorted = {}
    Object.keys(groups)
      .sort()
      .forEach(key => {
        sorted[key] = groups[key]
      })

    return sorted
  })
}
