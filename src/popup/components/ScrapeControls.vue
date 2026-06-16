<template>
  <div class="controls">
    <button
      id="bulkScrapeBtn"
      class="btn btn-primary"
      @click="$emit('bulk-scrape')"
      :disabled="isScraping"
    >
      Scroll & Collect
    </button>
    <button
      id="clearListBtn"
      class="btn btn-danger"
      @click="$emit('request-clear-all')"
    >
      Clear All Keywords
    </button>
  </div>
</template>

<script setup>
defineProps({
  isScraping: Boolean
})

defineEmits(['bulk-scrape', 'request-clear-all'])
</script>
