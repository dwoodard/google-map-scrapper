<template>
  <div class="left-panel">
    <div class="panel-header">
      <h3>📋 Search Terms</h3>
    </div>
    <div v-if="keywords.length === 0" class="empty-keywords">
      <p>No searches yet</p>
    </div>
    <div v-else class="keywords-list">
      <KeywordListItem
        v-for="keyword in keywords"
        :key="keyword"
        :keyword="keyword"
        :count="keywordGroups[keyword].length"
        :isSelected="selectedKeyword === keyword"
        :isActive="activeKeyword === keyword"
        @select="$emit('select', keyword)"
        @request-clear="$emit('request-clear', keyword)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import KeywordListItem from './KeywordListItem.vue'

const props = defineProps({
  keywordGroups: Object,
  selectedKeyword: String,
  activeKeyword: String
})

const keywords = computed(() => {
  return Object.keys(props.keywordGroups)
})

defineEmits(['select', 'request-clear'])
</script>
