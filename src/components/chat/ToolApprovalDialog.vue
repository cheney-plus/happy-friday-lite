<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="visible" class="approval-overlay" @click.self="handleReject">
        <Transition name="dialog-scale">
          <div v-if="visible" class="approval-dialog">
            <div class="dialog-header">
              <div class="header-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <span>工具调用审批</span>
              </div>
              <button class="dialog-close" @click="handleReject">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div class="dialog-body">
              <p class="dialog-tip">Agent 请求执行以下操作，需要你的确认：</p>

              <div class="tool-info-card">
                <div class="tool-info-row">
                  <span class="info-label">工具</span>
                  <span class="info-value tool-name">{{ toolName }}</span>
                </div>
                <div class="tool-info-row">
                  <span class="info-label">参数</span>
                  <pre class="info-value args-block">{{ formattedArgs }}</pre>
                </div>
              </div>

              <div class="reason-section">
                <label class="reason-label">拒绝原因（可选）</label>
                <textarea
                  v-model="rejectReason"
                  class="reason-input"
                  placeholder="如选择拒绝，可填写原因..."
                  rows="2"
                ></textarea>
              </div>
            </div>

            <div class="dialog-footer">
              <button class="btn btn-reject" @click="handleReject">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                拒绝
              </button>
              <button class="btn btn-approve" @click="handleApprove">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                批准执行
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  toolName: { type: String, default: '' },
  arguments: { type: [Object, String], default: () => ({}) }
})

const emit = defineEmits(['approve', 'reject'])

const rejectReason = ref('')

// 格式化参数展示
const formattedArgs = computed(() => {
  let args = props.arguments
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args)
    } catch (_e) {
      return args
    }
  }
  try {
    return JSON.stringify(args, null, 2)
  } catch (_e) {
    return String(args)
  }
})

// 弹窗打开时重置拒绝原因
watch(() => props.visible, (v) => {
  if (v) rejectReason.value = ''
})

function handleApprove() {
  emit('approve', { type: 'approve' })
}

function handleReject() {
  emit('reject', { type: 'reject', reason: rejectReason.value || '用户拒绝执行' })
}
</script>

<style scoped>
.approval-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.approval-dialog {
  background: var(--bg-primary, #fff);
  border-radius: 14px;
  width: 520px;
  max-width: 92vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.25), 0 0 0 1px var(--border-color, rgba(0, 0, 0, 0.06));
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #ececec);
  flex-shrink: 0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #f59e0b;
}

.dialog-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: var(--text-tertiary, #999);
  cursor: pointer;
  border-radius: 7px;
  transition: all 0.15s;
}

.dialog-close:hover {
  background: var(--bg-hover, #f0f0f0);
  color: var(--text-primary, #333);
}

.dialog-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dialog-tip {
  margin: 0;
  font-size: 13.5px;
  color: var(--text-secondary, #666);
}

.tool-info-card {
  background: var(--bg-secondary, #fafafa);
  border: 1px solid var(--border-color, #eee);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tool-info-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary, #999);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 13.5px;
  color: var(--text-primary, #333);
}

.tool-name {
  font-family: 'SF Mono', Monaco, monospace;
  font-weight: 600;
  color: #1560F7;
}

.args-block {
  margin: 0;
  padding: 8px 10px;
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-color, #eee);
  border-radius: 6px;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12.5px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}

.reason-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.reason-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary, #999);
}

.reason-input {
  padding: 8px 10px;
  border: 1px solid var(--border-color, #eee);
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  color: var(--text-primary, #333);
  background: var(--bg-primary, #fff);
  resize: vertical;
  outline: none;
  transition: border-color 0.15s;
}

.reason-input:focus {
  border-color: var(--text-tertiary, #aaa);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--border-color, #ececec);
  flex-shrink: 0;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-reject {
  background: var(--bg-secondary, #f5f5f5);
  color: var(--text-secondary, #666);
}

.btn-reject:hover {
  background: #fee2e2;
  color: #dc2626;
}

.btn-approve {
  background: #10b981;
  color: #fff;
}

.btn-approve:hover {
  background: #059669;
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
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dialog-scale-leave-active {
  transition: all 0.15s ease;
}

.dialog-scale-enter-from {
  opacity: 0;
  transform: scale(0.94) translateY(10px);
}

.dialog-scale-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>
