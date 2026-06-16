<template>
  <header>
    <h1>Google Maps Scraper</h1>
    <div class="toggle-section">
      <label>
        <input
          type="checkbox"
          :checked="active"
          @change="$emit('toggle-active', $event.target.checked)"
        />
        <span :class="['indicator', active ? 'active' : 'inactive']"></span>
        <span id="statusText">{{ active ? 'Active' : 'Inactive' }}</span>
      </label>
      <span class="count">{{ total }} total</span>
    </div>
  </header>
</template>

<script setup>
defineProps({
  active: Boolean,
  total: Number
})

defineEmits(['toggle-active'])
</script>
