<template>
  <tr @click="openModal" style="cursor: pointer;">
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

  <DetailsModal ref="modal" :entry="entry" />
</template>

<script setup>
import { computed, ref } from 'vue'
import DetailsModal from './DetailsModal.vue'

const modal = ref(null)

const props = defineProps({
  entry: Object
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
  const hasPhone = props.entry.phone && props.entry.phone !== 'N/A'
  const hasWebsite = props.entry.website && props.entry.website !== 'N/A'
  const hasAddress = props.entry.address && props.entry.address !== 'N/A'
  const hasHours = props.entry.hours && props.entry.hours !== 'N/A'
  const hasReviews = props.entry.reviews && props.entry.reviews !== 'N/A'

  const completeFields = [hasPhone, hasWebsite, hasAddress, hasHours, hasReviews].filter(Boolean).length

  // Enrichment status: has it been clicked (Phase 2)?
  const isEnriched = props.entry.source === 'bulk'

  // Data completeness: how many fields are filled?
  let dataStatus, statusClass
  if (completeFields >= 4) {
    dataStatus = '✓ Complete'
    statusClass = 'status-full'
  } else if (completeFields >= 2) {
    dataStatus = '◐ Partial'
    statusClass = 'status-partial'
  } else {
    dataStatus = '⏳ Basic'
    statusClass = 'status-basic'
  }

  // Show enrichment status if not yet enriched
  const enrichmentBadge = isEnriched ? '' : ' ⌛'
  const statusText = `${dataStatus}${enrichmentBadge}`

  return `<span class="status-badge ${statusClass}">${statusText}</span>`
})

function truncate(str, len) {
  return str.length > len ? str.slice(0, len) + '...' : str
}

function openModal() {
  modal.value?.open()
}
</script>
