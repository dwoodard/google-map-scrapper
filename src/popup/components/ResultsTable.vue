<template>
  <div class="right-panel">
    <div class="panel-header">
      <h3 id="selectedKeywordTitle">{{ selectedKeyword ? `🔍 "${selectedKeyword}"` : 'Select a keyword →' }}</h3>
      <a v-if="selectedKeyword" :href="googleMapsUrl" target="_blank" class="maps-link" title="Open in Google Maps">
        🗺️ Maps
      </a>
    </div>

    <div v-if="isEmpty" class="empty-state">
      <p>Select a search term from the left to view results</p>
    </div>

    <div v-else class="table-wrapper">
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="search"
          placeholder="🔍 Search by name, phone, website..."
          class="search-input"
        />
      </div>

      <div class="results-summary">
        <div class="summary-stat">
          <span class="stat-label">Results:</span>
          <span class="stat-value">{{ tableStats.total }}</span>
        </div>
        <div class="summary-stat">
          <span class="stat-label">Enriched:</span>
          <span class="stat-value">{{ tableStats.enriched }}/{{ tableData.length }}</span>
        </div>
        <div v-if="tableStats.pending > 0" class="summary-stat pending">
          <span class="stat-label">Pending:</span>
          <span class="stat-value">{{ tableStats.pending }}</span>
        </div>
        <div class="summary-bar">
          <div
            class="summary-fill"
            :style="{ width: tableStats.enrichmentPercent + '%' }"
          ></div>
        </div>
      </div>

      <table id="resultsTable">
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Website</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="tableBody" ref="tableBody">
          <ResultsTableRow
            v-for="entry in filteredTableData"
            :key="entry.placeId || entry.name"
            :entry="entry"
          />
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import ResultsTableRow from './ResultsTableRow.vue'

const tableBody = ref(null)

const props = defineProps({
  selectedKeyword: String,
  keywordGroups: Object
})

const tableData = computed(() => {
  if (!props.selectedKeyword || !props.keywordGroups[props.selectedKeyword]) {
    return []
  }
  return props.keywordGroups[props.selectedKeyword]
})

const searchQuery = ref('')
const lastUpdatedId = ref(null)

const filteredTableData = computed(() => {
  if (!searchQuery.value.trim()) {
    return tableData.value
  }

  const query = searchQuery.value.toLowerCase()
  return tableData.value.filter(entry => {
    return (
      entry.name.toLowerCase().includes(query) ||
      (entry.phone && entry.phone.toLowerCase().includes(query)) ||
      (entry.website && entry.website.toLowerCase().includes(query)) ||
      (entry.address && entry.address.toLowerCase().includes(query))
    )
  })
})

const tableStats = computed(() => {
  const data = filteredTableData.value
  const total = data.length
  const enriched = data.filter(r => r.source === 'bulk').length
  const pending = data.filter(r => r.source === 'partial').length

  return {
    total,
    enriched,
    pending,
    enrichmentPercent: total > 0 ? Math.round((enriched / total) * 100) : 0
  }
})

const isEmpty = computed(() => {
  return !props.selectedKeyword || tableData.value.length === 0
})

const googleMapsUrl = computed(() => {
  if (!props.selectedKeyword) return ''
  const encoded = encodeURIComponent(props.selectedKeyword)
  return `https://www.google.com/maps/search/${encoded}`
})

// Auto-scroll to newly enriched result
watch(filteredTableData, async (newData, oldData) => {
  await nextTick()
  if (!tableBody.value || newData.length === 0) return

  // Find the most recently enriched result (changed from partial to bulk)
  let targetEntry = null

  if (!oldData || newData.length > oldData.length) {
    // New result added - scroll to it
    targetEntry = newData[newData.length - 1]
  } else {
    // Check if any result was just enriched (source changed from partial to bulk)
    for (let i = 0; i < newData.length; i++) {
      const newEntry = newData[i]
      const oldEntry = oldData?.[i]
      if (oldEntry && oldEntry.source === 'partial' && newEntry.source === 'bulk') {
        targetEntry = newEntry
        break
      }
    }
  }

  if (targetEntry) {
    const rows = tableBody.value.querySelectorAll('tr')
    const targetRow = Array.from(rows).find(row => {
      const cells = row.querySelectorAll('td')
      return cells[0]?.textContent?.includes(targetEntry.name)
    })
    if (targetRow) {
      targetRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }
})
</script>

<style scoped>
.maps-link {
  display: inline-block;
  padding: 4px 8px;
  color: #1a73e8;
  text-decoration: none;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
  border-radius: 4px;
  flex-shrink: 0;
}

.maps-link:hover {
  color: #1557b0;
  background: rgba(26, 115, 232, 0.05);
}
</style>
