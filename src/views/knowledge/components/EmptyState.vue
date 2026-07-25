<template>
  <div class="empty-folder">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
      <template v-if="variant === 'search'">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </template>
      <template v-else>
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
      </template>
    </svg>
    <p>{{ message }}</p>
  </div>
</template>

<script setup>
defineProps({
  /**
   * 空状态类型：
   * - 'search' 搜索无结果（放大镜图标）
   * - 'empty'  文件夹为空（文件夹图标）
   */
  variant: {
    type: String,
    default: 'empty',
    validator: v => ['search', 'empty'].includes(v)
  },
  message: {
    type: String,
    default: '此文件夹为空'
  }
});
</script>

<style scoped lang="scss">
.empty-folder {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-tertiary);
  user-select: none;

  svg {
    margin-bottom: 12px;
    opacity: 0.4;
  }

  p {
    margin: 0;
    font-size: 14px;
  }
}
</style>
