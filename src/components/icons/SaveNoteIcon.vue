<script setup>
defineProps({
  size: {
    type: [Number, String],
    default: 20
  },
  strokeWidth: {
    type: [Number, String],
    default: 2
  }
})
</script>

<template>
  <!-- 线性圆圈对勾，与 lucide 图标同规格（24 网格描边风格） -->
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16.5v-9" />
    <path d="M8 11l4-3.5 4 3.5" />
  </svg>
</template>
