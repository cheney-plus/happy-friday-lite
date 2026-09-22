<script setup>
defineProps({
  size: {
    type: [Number, String],
    default: 20
  }
})
</script>

<template>
  <!-- 实心图标，内容占视口 75%，与其他侧边栏图标视觉大小一致 -->
  <svg :width="size" :height="size" viewBox="-2.5 -2 28 28" fill="currentColor" aria-hidden="true">
    <path
      d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 1 1 7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"
    />
  </svg>
</template>
