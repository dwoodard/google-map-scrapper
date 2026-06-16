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

      <div class="filter-bar">
        <button
          :class="['filter-btn', { active: statusFilter === 'all' }]"
          @click="statusFilter = 'all'"
        >
          All
        </button>
        <button
          :class="['filter-btn', { active: statusFilter === 'enriched' }]"
          @click="statusFilter = 'enriched'"
        >
          ✅ Enriched
        </button>
        <button
          :class="['filter-btn', { active: statusFilter === 'pending' }]"
          @click="statusFilter = 'pending'"
        >
          ⌛ Pending
        </button>
      </div>

      <div class="results-summary">
        <div class="summary-stat">
          <span class="stat-label">{{ statusFilter !== 'all' ? 'Showing' : 'Results' }}:</span>
          <span class="stat-value">
            {{ tableStats.displayed }}<span v-if="statusFilter !== 'all'" class="filter-note"> / {{ tableStats.total }}</span>
          </span>
        </div>
        <div class="summary-stat">
          <span class="stat-label">Enriched:</span>
          <span class="stat-value">{{ tableStats.enriched }}/{{ tableStats.total }}</span>
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
            <th class="sortable" @click="toggleSort('name')">
              Name <span v-if="sortColumn === 'name'" class="sort-icon">{{ sortDirection === 'asc' ? '▲' : '▼' }}</span>
            </th>
            <th class="sortable" @click="toggleSort('phone')">
              Phone <span v-if="sortColumn === 'phone'" class="sort-icon">{{ sortDirection === 'asc' ? '▲' : '▼' }}</span>
            </th>
            <th class="sortable" @click="toggleSort('website')">
              Website <span v-if="sortColumn === 'website'" class="sort-icon">{{ sortDirection === 'asc' ? '▲' : '▼' }}</span>
            </th>
            <th class="sortable" @click="toggleSort('status')">
              Status <span v-if="sortColumn === 'status'" class="sort-icon">{{ sortDirection === 'asc' ? '▲' : '▼' }}</span>
            </th>
          </tr>
        </thead>
        <tbody id="tableBody" ref="tableBody">
          <ResultsTableRow
            v-for="entry in filteredTableData"
            :key="entry.placeId || entry.name"
            :entry="entry"
            @delete="handleDelete"
          />
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick, onMounted } from 'vue'
import ResultsTableRow from './ResultsTableRow.vue'
import { fuzzyFilter } from '../utils/fuzzySearch.js'

const tableBody = ref(null)

const props = defineProps({
  selectedKeyword: String,
  keywordGroups: Object
})

const emit = defineEmits(['delete'])

const tableData = computed(() => {
  if (!props.selectedKeyword || !props.keywordGroups[props.selectedKeyword]) {
    return []
  }
  return props.keywordGroups[props.selectedKeyword]
})

const searchQuery = ref('')
const lastUpdatedId = ref(null)
const sortColumn = ref('name')
const sortDirection = ref('asc')
const statusFilter = ref('all')

const filteredTableData = computed(() => {
  let filtered = fuzzyFilter(tableData.value, searchQuery.value, [
    'name',
    'phone',
    'website',
    'address',
    'source',
    'reviews'
  ])

  // Apply status filter
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(item => {
      if (statusFilter.value === 'enriched') {
        return item.source === 'bulk'
      } else if (statusFilter.value === 'pending') {
        return item.source === 'partial'
      }
      return true
    })
  }

  return [...filtered].sort((a, b) => {
    const aVal = String(a[sortColumn.value] || '').toLowerCase()
    const bVal = String(b[sortColumn.value] || '').toLowerCase()

    let comparison = 0
    if (aVal < bVal) comparison = -1
    else if (aVal > bVal) comparison = 1

    return sortDirection.value === 'asc' ? comparison : -comparison
  })
})

const tableStats = computed(() => {
  const allData = tableData.value
  const total = allData.length
  const enriched = allData.filter(r => r.source === 'bulk').length
  const pending = allData.filter(r => r.source === 'partial').length
  const displayed = filteredTableData.value.length

  return {
    total,
    enriched,
    pending,
    displayed,
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

function toggleSort(column) {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortColumn.value = column
    sortDirection.value = 'asc'
  }
}

function handleDelete(entry) {
  emit('delete', entry)
}

function getFilteredData() {
  return filteredTableData.value
}

// Load filter preferences on mount
onMounted(() => {
  chrome.storage.local.get(['tableFilters'], (result) => {
    const filters = result.tableFilters || {}
    if (filters.statusFilter) statusFilter.value = filters.statusFilter
    if (filters.sortColumn) sortColumn.value = filters.sortColumn
    if (filters.sortDirection) sortDirection.value = filters.sortDirection
  })
})

// Save filter preferences when they change
watch([statusFilter, sortColumn, sortDirection], () => {
  chrome.storage.local.set({
    tableFilters: {
      statusFilter: statusFilter.value,
      sortColumn: sortColumn.value,
      sortDirection: sortDirection.value
    }
  })
}, { deep: true })

defineExpose({ getFilteredData, statusFilter })
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

thead th.sortable {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

thead th.sortable:hover {
  background-color: #f5f5f5;
}

.sort-icon {
  display: inline-block;
  margin-left: 4px;
  font-size: 10px;
  color: #1a73e8;
}

.filter-bar {
  display: flex;
  gap: 6px;
  margin: 8px 0;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 4px 10px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  color: #666;
}

.filter-btn:hover {
  border-color: #1a73e8;
  color: #1a73e8;
}

.filter-btn.active {
  background: #1a73e8;
  color: white;
  border-color: #1a73e8;
}

.filter-note {
  font-size: 10px;
  color: #999;
  font-weight: normal;
}
</style>
