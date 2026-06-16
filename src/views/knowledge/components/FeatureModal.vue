<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click="$emit('close')">
      <div class="modal-content" @click.stop>
        <div class="modal-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h2 class="modal-title">功能开发中</h2>
        <p class="modal-message">该功能还未实现，正在努力开发中...</p>
        <button class="modal-btn" @click="$emit('close')">我知道了</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  visible: Boolean
});

defineEmits(['close']);
</script>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease-out;
}

.modal-content {
  background: var(--bg-primary);
  border-radius: 16px;
  padding: 40px 48px;
  text-align: center;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease-out;
}

.modal-icon { color: #faad14; margin-bottom: 20px; }

.modal-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px 0;
}

.modal-message {
  font-size: 15px;
  color: var(--text-secondary);
  margin: 0 0 28px 0;
  line-height: 1.5;
}

.modal-btn {
  padding: 10px 32px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--accent-hover, var(--accent-color));
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
