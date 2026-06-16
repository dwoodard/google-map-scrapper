<template>
  <div class="right-panel">
    <div class="panel-header">
      <h3 id="selectedKeywordTitle">{{ selectedKeyword ? `🔍 "${selectedKeyword}"` : 'Select a keyword →' }}</h3>
    </div>

    <div v-if="isEmpty" class="empty-state">
      <p>Select a search term from the left to view results</p>
    </div>

    <div v-else class="table-wrapper">
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
            v-for="(entry, idx) in tableData"
            :key="idx"
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

const isEmpty = computed(() => {
  return !props.selectedKeyword || tableData.value.length === 0
})
</script>
