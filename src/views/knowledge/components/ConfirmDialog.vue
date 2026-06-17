<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="visible" class="dialog-overlay" @click.self="handleCancel">
        <Transition name="dialog-scale">
          <div v-if="visible" class="dialog-card">
            <div class="dialog-icon-wrap danger">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </div>

            <h3 class="dialog-title">确认删除</h3>

            <p class="dialog-desc">{{ message }}</p>

            <div class="dialog-actions">
              <button class="dialog-btn cancel-btn" @click="handleCancel">取消</button>
              <button class="dialog-btn confirm-btn" @click="handleConfirm">确认删除</button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
defineProps({
  visible: Boolean,
  message: { type: String, default: '此操作不可撤销，是否确认？' }
});

const emit = defineEmits(['confirm', 'cancel']);

function handleConfirm() {
  emit('confirm');
}

function handleCancel() {
  emit('cancel');
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.dialog-card {
  background: var(--bg-primary);
  border-radius: 16px;
  padding: 28px 32px 24px;
  width: 380px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px var(--border-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.dialog-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &.danger {
    background: rgba(229, 57, 53, 0.1);
    color: #e53935;
  }
}

[data-theme='dark'] .dialog-icon-wrap.danger {
  background: rgba(229, 57, 53, 0.15);
}

.dialog-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  letter-spacing: -0.01em;
}

.dialog-desc {
  font-size: 13.5px;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.6;
  margin: 0;
}

.dialog-actions {
  display: flex;
  gap: 10px;
  width: 100%;
  margin-top: 4px;
}

.dialog-btn {
  flex: 1;
  padding: 10px 0;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.cancel-btn {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.cancel-btn:hover {
  background: var(--bg-active);
}

.confirm-btn {
  background: #e53935;
  color: #ffffff;
}

.confirm-btn:hover {
  background: #d32f2f;
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-scale-enter-active {
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dialog-scale-leave-active {
  transition: all 0.15s ease;
}

.dialog-scale-enter-from {
  opacity: 0;
  transform: scale(0.92);
}

.dialog-scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
