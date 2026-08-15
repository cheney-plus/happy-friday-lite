<script setup>
import { computed } from 'vue'
import deepSeekIcon from '@/assets/images/deepseek.png'

const props = defineProps({
  size: {
    type: [Number, String],
    default: 20
  }
})

const iconStyle = computed(() => {
  const size = Math.round((Number(props.size) || 20) * 1.2)
  return {
    width: `${size}px`,
    height: `${size}px`,
    '--deepseek-icon': `url("${deepSeekIcon}")`
  }
})
</script>

<template>
  <span :style="iconStyle" class="deepseek-icon" aria-hidden="true"></span>
</template>

<style scoped>
.deepseek-icon {
  display: block;
  flex: 0 0 auto;
  background-color: currentColor;
  -webkit-mask: var(--deepseek-icon) center / contain no-repeat;
  mask: var(--deepseek-icon) center / contain no-repeat;
}
</style>
