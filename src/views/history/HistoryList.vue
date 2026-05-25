<template>
  <div class="coming-soon">
    <div class="coming-soon-content">
      <svg class="icon" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      <h1 class="title">历史记录</h1>
      <p class="description">该模块还未实现</p>
      <p class="sub-description">我们正在努力开发中，敬请期待</p>
    </div>
  </div>
</template>

<script setup>
</script>

<style scoped lang="scss">
.coming-soon {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: var(--bg-primary);
}

.coming-soon-content {
  text-align: center;
  padding: 40px;

  .icon {
    color: var(--text-tertiary);
    margin-bottom: 24px;
    opacity: 0.6;
  }

  .title {
    font-size: 28px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 16px 0;
  }

  .description {
    font-size: 18px;
    color: var(--text-secondary);
    margin: 0 0 8px 0;
  }

  .sub-description {
    font-size: 14px;
    color: var(--text-tertiary);
    margin: 0;
  }
}
</style>
