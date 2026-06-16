<template>
  <!-- resize handle is rendered in the template but the actual handle is in the HTML via #resizeHandle -->
</template>

<script setup>
import { onMounted } from 'vue'

const props = defineProps({
  popupSize: Object,
  onSaveSize: Function
})

onMounted(() => {
  const resizeHandle = document.getElementById('resizeHandle')
  if (!resizeHandle) return

  let isResizing = false
  let startX = 0
  let startY = 0
  let startWidth = 500
  let startHeight = 600

  const htmlElement = document.documentElement

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true
    startX = e.clientX
    startY = e.clientY
    startWidth = htmlElement.offsetWidth
    startHeight = htmlElement.offsetHeight
    document.body.classList.add('resizing')
  })

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return

    const deltaX = e.clientX - startX
    const deltaY = e.clientY - startY

    const newWidth = Math.max(500, Math.min(1400, startWidth + deltaX))
    const newHeight = Math.max(300, Math.min(1000, startHeight + deltaY))

    htmlElement.style.width = newWidth + 'px'
    htmlElement.style.height = newHeight + 'px'

    console.log(`[Resize] deltaY: ${deltaY}, newHeight: ${newHeight}px`)

    if (props.onSaveSize) {
      props.onSaveSize({ width: newWidth, height: newHeight })
    }
  })

  document.addEventListener('mouseup', () => {
    isResizing = false
    document.body.classList.remove('resizing')
  })

  // Load saved size on mount
  if (props.popupSize) {
    htmlElement.style.width = props.popupSize.width + 'px'
    htmlElement.style.height = props.popupSize.height + 'px'
  }
})
</script>
