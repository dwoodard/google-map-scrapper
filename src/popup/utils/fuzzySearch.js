export function fuzzyMatch(text, query) {
  if (!query) return true

  text = text.toLowerCase()
  query = query.toLowerCase()

  let textIdx = 0
  let queryIdx = 0
  let score = 0
  let consecutiveMatches = 0

  while (queryIdx < query.length && textIdx < text.length) {
    if (text[textIdx] === query[queryIdx]) {
      score += 1 + consecutiveMatches * 0.5
      consecutiveMatches++
      queryIdx++
    } else {
      consecutiveMatches = 0
    }
    textIdx++
  }

  return queryIdx === query.length ? score : -1
}

export function fuzzyFilter(items, query, fields) {
  if (!query.trim()) return items

  return items
    .map(item => {
      const scores = fields.map(field => {
        const value = item[field]
        return value ? fuzzyMatch(String(value), query) : -1
      })
      const maxScore = Math.max(...scores)
      return { item, score: maxScore }
    })
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
}
