<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="visible" class="dialog-overlay" @click.self="handleCancel">
        <Transition name="dialog-scale">
          <div v-if="visible" class="dialog-card">
            <div class="dialog-icon-wrap danger">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"></path>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </div>

            <h3 class="dialog-title">确认删除</h3>

            <p class="dialog-desc">{{ message }}</p>

            <div class="dialog-actions">
              <button class="dialog-btn cancel-btn" @click="handleCancel">取消</button>
              <button class="dialog-btn confirm-btn" @click="handleConfirm">
                <span>确认删除</span>
              </button>
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
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.dialog-card {
  background: var(--bg-primary);
  border-radius: 18px;
  padding: 32px 32px 24px;
  width: 400px;
  max-width: 90vw;
  box-shadow:
    0 24px 80px rgba(0, 0, 0, 0.12),
    0 8px 24px rgba(0, 0, 0, 0.08),
    0 0 0 1px var(--border-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.dialog-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-bottom: 4px;

  &.danger {
    background: linear-gradient(135deg, rgba(229, 57, 53, 0.12), rgba(229, 57, 53, 0.06));
    color: #e53935;
    box-shadow: 0 4px 12px rgba(229, 57, 53, 0.1);
  }
}

[data-theme='dark'] .dialog-icon-wrap.danger {
  background: linear-gradient(135deg, rgba(229, 57, 53, 0.18), rgba(229, 57, 53, 0.1));
}

.dialog-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  letter-spacing: -0.01em;
}

.dialog-desc {
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.65;
  margin: 0;
  padding: 0 8px;
}

.dialog-actions {
  display: flex;
  gap: 10px;
  width: 100%;
  margin-top: 8px;
}

.dialog-btn {
  flex: 1;
  padding: 11px 0;
  border: none;
  border-radius: 11px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: inherit;
  position: relative;
  overflow: hidden;
}

.cancel-btn {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.cancel-btn:hover {
  background: var(--bg-active);
}

.cancel-btn:active {
  transform: scale(0.97);
}

.confirm-btn {
  background: linear-gradient(135deg, #ef5350, #e53935);
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(229, 57, 53, 0.25);
}

.confirm-btn:hover {
  background: linear-gradient(135deg, #e53935, #d32f2f);
  box-shadow: 0 6px 20px rgba(229, 57, 53, 0.35);
  transform: translateY(-1px);
}

.confirm-btn:active {
  transform: scale(0.97);
  box-shadow: 0 2px 8px rgba(229, 57, 53, 0.2);
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.25s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-scale-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dialog-scale-leave-active {
  transition: all 0.18s ease;
}

.dialog-scale-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(8px);
}

.dialog-scale-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(4px);
}
</style>
