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
  <svg :width="size" :height="size" viewBox="-171 -171 1365 1365" fill="currentColor" aria-hidden="true">
    <path d="M704 0v96h224v832H0V1024H1024V0h-320z" />
    <path d="M470.144 256.576l65.664-65.6 180.096 180.096-65.6 65.6zM582.4 504.32L402.56 324.48 128 601.6l-54.4 192a32 32 0 0 0 39.68 39.04l192-54.4z" />
  </svg>
</template>
