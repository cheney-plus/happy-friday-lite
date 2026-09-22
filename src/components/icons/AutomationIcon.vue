<script setup>
defineProps({
  size: {
    type: [Number, String],
    default: 20
  }
})
</script>

<template>
  <!-- 内容占视口 75%，与 lucide 图标的视觉大小保持一致 -->
  <svg :width="size" :height="size" viewBox="0 0 1024 1024" fill="currentColor" aria-hidden="true">
    <path
      d="M128 128h256v170.666667H128V128m512 298.666667h256v170.666666h-256v-170.666666m0 298.666666h256v170.666667h-256v-170.666667m-85.333333-170.666666H298.666667v213.333333h256v85.333333H213.333333V384h85.333334v85.333333h256v85.333334z"
    />
  </svg>
</template>
