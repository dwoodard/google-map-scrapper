<template>
  <div class="progress">
    <div class="progress-text">Scraping {{ done }} / {{ total }}...</div>
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: percent + '%' }"></div>
    </div>
    <button class="btn btn-secondary" @click="$emit('stop')">Stop</button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  done: Number,
  total: Number
})

const percent = computed(() => {
  return props.total > 0 ? (props.done / props.total) * 100 : 0
})

defineEmits(['stop'])
</script>
