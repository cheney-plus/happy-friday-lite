<script setup>
defineProps({
  size: {
    type: [Number, String],
    default: 20
  }
})
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 1024 1024" fill="currentColor" aria-hidden="true">
    <path
      d="M170.666667 742.4l160.64-48V320l281.088-76.8v556.8L190.72 752 612.394667 896 853.333333 848V185.6L610.389333 128 170.666667 272V742.4z"
    />
  </svg>
</template>
