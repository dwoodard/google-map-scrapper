<template>
  <div class="right-panel">
    <div class="panel-header">
      <h3 id="selectedKeywordTitle">{{ selectedKeyword ? `🔍 "${selectedKeyword}"` : 'Select a keyword →' }}</h3>
    </div>

    <div v-if="isEmpty" class="empty-state">
      <p>Select a search term from the left to view results</p>
    </div>

    <div v-else class="table-wrapper">
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
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
        <tbody id="tableBody">
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
import { computed } from 'vue'
import ResultsTableRow from './ResultsTableRow.vue'

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

import { ref } from 'vue'

const searchQuery = ref('')

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
</script>
