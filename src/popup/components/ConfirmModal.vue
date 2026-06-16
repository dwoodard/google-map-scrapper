<template>
  <Teleport to="body" v-if="modelValue">
    <div class="modal-overlay" @click.self="$emit('cancel')">
      <div class="modal-content">
        <div class="modal-title">{{ title }}</div>
        <div class="modal-message">{{ message }}</div>
        <div class="modal-buttons">
          <button class="modal-button cancel" @click="$emit('cancel')">
            Cancel
          </button>
          <button
            class="modal-button confirm"
            :class="{ danger }"
            @click="$emit('confirm')"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  modelValue: Boolean,
  title: String,
  message: String,
  confirmLabel: { type: String, default: 'Confirm' },
  danger: { type: Boolean, default: false }
})

defineEmits(['confirm', 'cancel'])
</script>
