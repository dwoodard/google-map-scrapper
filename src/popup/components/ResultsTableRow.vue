<template>
  <tr @click="handleRowClick($event)" style="cursor: pointer;" :class="isCurrentKeyword ? 'listing-on-page' : 'listing-off-page'">
    <td :title="entry.name">{{ truncate(entry.name, 20) }}</td>
    <td :title="phoneDisplay">{{ truncate(phoneDisplay, 15) }}</td>
    <td :title="entry.website">
      <a
        v-if="isValidUrl"
        :href="entry.website"
        target="_blank"
        @click.stop
        style="color: #1a73e8; text-decoration: none; font-size: 11px;"
      >
        {{ website }}
      </a>
      <span v-else>-</span>
    </td>
    <td v-html="statusBadge"></td>
  </tr>

  <DetailsModal ref="modal" :entry="entry" @delete="handleDelete" />
</template>

<script setup>
import { computed, ref } from 'vue'
import DetailsModal from './DetailsModal.vue'

const modal = ref(null)

const props = defineProps({
  entry: Object,
  selectedKeyword: String
})

const emit = defineEmits(['delete', 'scroll-to-listing'])

const isCurrentKeyword = computed(() => {
  return props.entry?.keyword === props.selectedKeyword
})

const phoneDisplay = computed(() => {
  return (props.entry.phone && props.entry.phone !== 'N/A') ? props.entry.phone : '-'
})

const isValidUrl = computed(() => {
  return props.entry.website && props.entry.website !== 'N/A' && props.entry.website.startsWith('http')
})

const website = computed(() => {
  if (!isValidUrl.value) return '-'
  try {
    return new URL(props.entry.website).hostname
  } catch {
    return '-'
  }
})

const statusBadge = computed(() => {
  // Show phase-based status: did it go through Phase 2 (clicked)?
  const isEnriched = props.entry.source === 'bulk'

  if (isEnriched) {
    return `<span class="status-badge status-full">✓ Complete</span>`
  } else {
    return `<span class="status-badge status-partial">◐ Partial ⌛</span>`
  }
})

function truncate(str, len) {
  return str.length > len ? str.slice(0, len) + '...' : str
}

function openModal() {
  modal.value?.open()
}

function handleRowClick(event) {
  // Cmd/Ctrl click: just scroll, don't open modal
  if (event.metaKey || event.ctrlKey) {
    emit('scroll-to-listing', props.entry)
    return
  }

  // Normal click: scroll and open modal
  emit('scroll-to-listing', props.entry)
  openModal()
}

function handleDelete(entry) {
  emit('delete', entry)
}
</script>
