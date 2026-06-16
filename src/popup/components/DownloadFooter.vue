<template>
  <footer>
    <button class="btn btn-footer" @click="onDownloadJSON">
      📥 JSON
    </button>
    <button class="btn btn-footer" @click="onDownloadCSV">
      📥 CSV
    </button>
  </footer>
</template>

<script setup>
import { downloadJSON, downloadCSV } from '../utils/download.js'

const props = defineProps({
  results: Array
})

function onDownloadJSON() {
  downloadJSON(props.results)
}

function onDownloadCSV() {
  downloadCSV(props.results)
}
</script>
