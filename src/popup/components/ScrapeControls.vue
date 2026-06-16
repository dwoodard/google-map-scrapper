<template>
  <div class="controls">
    <button
      id="bulkScrapeBtn"
      class="btn btn-primary"
      @click="$emit('bulk-scrape', { scrollToBottom: scrollToBottom })"
      :disabled="isScraping"
    >
      Scroll & Collect
    </button>
    <label class="scroll-toggle">
      <input
        type="checkbox"
        v-model="scrollToBottom"
        :disabled="isScraping"
      />
      Scroll to Bottom
    </label>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  isScraping: Boolean
})

defineEmits(['bulk-scrape'])

const scrollToBottom = ref(true)
</script>

<style scoped>
.scroll-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #333;
  cursor: pointer;
  margin-left: 8px;
}

.scroll-toggle input {
  cursor: pointer;
}

.scroll-toggle input:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
