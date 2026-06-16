<template>
  <tr @click="showDetails">
    <td :title="entry.name">{{ truncate(entry.name, 20) }}</td>
    <td :title="phoneDisplay">{{ truncate(phoneDisplay, 15) }}</td>
    <td :title="entry.website">
      <a
        v-if="isValidUrl"
        :href="entry.website"
        target="_blank"
        style="color: #1a73e8; text-decoration: none; font-size: 11px;"
      >
        {{ website }}
      </a>
      <span v-else>-</span>
    </td>
    <td v-html="statusBadge"></td>
  </tr>
</template>

<script setup>
import { computed } from 'vue'

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

  let statusClass, statusText
  if (completeFields >= 4) {
    statusClass = 'status-full'
    statusText = '✓ Complete'
  } else if (completeFields >= 2) {
    statusClass = 'status-basic'
    statusText = '◐ Partial'
  } else {
    statusClass = 'status-basic'
    statusText = '⏳ Basic'
  }

  return `<span class="status-badge ${statusClass}">${statusText}</span>`
})

function truncate(str, len) {
  return str.length > len ? str.slice(0, len) + '...' : str
}

function showDetails() {
  const details = `${props.entry.name}

📍 Category: ${props.entry.category}
⭐ Rating: ${props.entry.rating}
📊 Reviews: ${props.entry.reviews}
🏠 Address: ${props.entry.address}
☎️ Phone: ${props.entry.phone}
🌐 Website: ${props.entry.website}
📍 Plus Code: ${props.entry.plusCode}
🕒 Hours: ${props.entry.hours}
🚪 Status: ${props.entry.status}
💵 Price: ${props.entry.priceRange}
📌 Coordinates: ${props.entry.latitude}, ${props.entry.longitude}
🆔 Place ID: ${props.entry.placeId}`
  alert(details)
}
</script>
