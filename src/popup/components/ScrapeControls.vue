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
  </div>
</template>

<script setup>
defineProps({
  isScraping: Boolean
})

defineEmits(['bulk-scrape'])
</script>
