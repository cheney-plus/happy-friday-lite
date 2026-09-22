<script setup>
defineProps({
  size: {
    type: [Number, String],
    default: 20
  }
})
</script>

<template>
  <!-- 内容占视口 75%，与 lucide 图标的视觉大小一致（原图内容占满 1024 视口的 91.6%，偏大） -->
  <svg :width="size" :height="size" viewBox="-114 -114 1252 1252" fill="currentColor" aria-hidden="true">
    <path
      d="M853.333333 128h128v853.333333H42.666667V128h128V42.666667h85.333333v85.333333h512V42.666667h85.333333v85.333333z m42.666667 170.666667H128v597.333333h768V298.666667z"
    />
    <path d="M213.333333 384h170.666667v170.666667H213.333333z" />
  </svg>
</template>
