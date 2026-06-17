<template>
  <div
    class="keyword-item"
    :class="{ active: isSelected, scraping: isActive }"
    @click="$emit('select', keyword)"
  >
    <div class="keyword-info">
      <span v-if="isActive" class="scraping-indicator">⟳</span>
      <span class="keyword-name">{{ keyword }}</span>
      <span class="keyword-count">{{ count }} result{{ count !== 1 ? 's' : '' }}</span>
    </div>
    <button
      class="keyword-clear-btn"
      @click.stop="$emit('request-clear', keyword)"
      title="Clear this keyword's results"
    >
      ✕
    </button>
  </div>
</template>

<script setup>
const props = defineProps({
  keyword: String,
  count: Number,
  isSelected: Boolean,
  isActive: Boolean
})

defineEmits(['select', 'request-clear'])
</script>
