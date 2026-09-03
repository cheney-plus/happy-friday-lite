<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="visible" class="approval-overlay" @click.self="handleReject">
        <Transition name="dialog-scale">
          <div v-if="visible" class="approval-dialog" role="dialog" aria-modal="true">
            <!-- 顶部警示条 -->
            <div class="dialog-accent-bar"></div>

            <div class="dialog-header">
              <div class="header-title">
                <div class="header-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                </div>
                <div class="header-text">
                  <span class="title-main">工具调用审批</span>
                  <span class="title-sub">Agent 请求执行操作，需要你的确认</span>
                </div>
              </div>
              <button class="dialog-close" @click="handleReject" aria-label="关闭">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div class="dialog-body">
              <div class="tool-info-card">
                <div class="tool-info-row tool-info-inline">
                  <span class="info-label">工具</span>
                  <span class="info-divider"></span>
                  <span class="info-value tool-name">
                    <svg class="tool-name-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                    </svg>
                    {{ toolName }}
                  </span>
                </div>
                <div class="tool-info-row">
                  <div class="args-head">
                    <span class="info-label">参数</span>
                    <span class="args-count" v-if="argsCount > 0">{{ argsCount }} 项</span>
                  </div>
                  <pre class="info-value args-block"><code>{{ formattedArgs }}</code></pre>
                </div>
                <div class="risk-card" :class="`risk-${riskLevel}`">
                  <div class="risk-icon" aria-hidden="true">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 3 3.5 19a1.5 1.5 0 0 0 1.3 2.2h14.4a1.5 1.5 0 0 0 1.3-2.2L12 3Z"></path>
                      <path d="M12 9v4"></path><path d="M12 17h.01"></path>
                    </svg>
                  </div>
                  <div class="risk-copy">
                    <div class="risk-title">执行风险评估 <span class="risk-level">{{ riskLabel }}</span></div>
                    <div class="risk-description">{{ riskDescription }}</div>
                  </div>
                </div>
              </div>

              <div class="reason-section">
                <label class="reason-label">
                  拒绝原因
                  <span class="reason-optional">可选</span>
                </label>
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
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                拒绝
              </button>
              <div class="footer-spacer"></div>
              <button class="btn btn-approve-all" @click="handleApproveAll" title="批准本次工具调用及本次 AI 执行后续所有工具调用（新对话仍需审批）">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 11 12 14 22 4"></polyline>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
                全部批准
              </button>
              <button class="btn btn-approve" @click="handleApprove">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
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
  arguments: { type: [Object, String], default: () => ({}) },
  riskAssessment: { type: Object, default: null }
})

const emit = defineEmits(['approve', 'approve-all', 'reject'])

const rejectReason = ref('')

// 解析后的参数对象（用于计数）
const parsedArgs = computed(() => {
  let args = props.arguments
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args)
    } catch (_e) {
      return null
    }
  }
  return args
})

// 格式化参数展示
const formattedArgs = computed(() => {
  const args = parsedArgs.value
  if (args === null) return String(props.arguments)
  if (typeof args !== 'object' || args === null) return String(args)
  try {
    const { riskAssessment: _riskAssessment, ...displayArgs } = args
    return JSON.stringify(displayArgs, null, 2)
  } catch (_e) {
    return String(args)
  }
})

const argsCount = computed(() => {
  const args = parsedArgs.value
  if (args && typeof args === 'object') return Object.keys(args).filter(key => key !== 'riskAssessment').length
  return 0
})

const risk = computed(() => {
  const supplied = props.riskAssessment || parsedArgs.value?.riskAssessment
  if (supplied && typeof supplied === 'object') {
    const normalizedLevel = { high: 'high', medium: 'medium', low: 'low', 高: 'high', 中: 'medium', 低: 'low' }[String(supplied.level).toLowerCase()]
    if (normalizedLevel && String(supplied.evaluation || '').trim()) {
      return { level: normalizedLevel, label: { high: '高风险', medium: '中风险', low: '低风险' }[normalizedLevel], description: String(supplied.evaluation).trim() }
    }
  }
  return { level: 'unknown', label: '未提供', description: '模型未返回本次操作的风险评估，请核对参数后再决定是否批准。' }
})
const riskLevel = computed(() => risk.value.level)
const riskLabel = computed(() => risk.value.label)
const riskDescription = computed(() => risk.value.description)

// 弹窗打开时重置拒绝原因
watch(() => props.visible, (v) => {
  if (v) rejectReason.value = ''
})

function handleApprove() {
  emit('approve', { type: 'approve' })
}

function handleApproveAll() {
  emit('approve-all', { type: 'approve-all' })
}

function handleReject() {
  emit('reject', { type: 'reject', reason: rejectReason.value || '用户拒绝执行' })
}
</script>

<style scoped>
.approval-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(6px) saturate(120%);
  -webkit-backdrop-filter: blur(6px) saturate(120%);
}

.approval-dialog {
  position: relative;
  background: var(--bg-primary, #fff);
  border-radius: 16px;
  width: 540px;
  max-width: 92vw;
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.28),
    0 8px 24px rgba(0, 0, 0, 0.12),
    0 0 0 1px var(--border-color, rgba(0, 0, 0, 0.06));
  overflow: hidden;
}

/* 顶部警示条 */
.dialog-accent-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #f59e0b 0%, #f97316 50%, #ef4444 100%);
  z-index: 1;
}

.dialog-header {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 22px 16px;
  flex-shrink: 0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #d97706;
  flex-shrink: 0;
  box-shadow:
    0 4px 10px rgba(245, 158, 11, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.title-main {
  font-size: 15.5px;
  font-weight: 600;
  color: var(--text-primary, #1c1917);
  letter-spacing: -0.2px;
  line-height: 1.3;
}

.title-sub {
  font-size: 12.5px;
  color: var(--text-secondary, #78716c);
  line-height: 1.3;
}

.dialog-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: var(--text-tertiary, #a8a29e);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.18s ease;
  flex-shrink: 0;
}

.dialog-close:hover {
  background: var(--bg-hover, #f5f5f5);
  color: var(--text-primary, #1c1917);
}

.dialog-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 22px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.tool-info-card {
  position: relative;
  background: var(--bg-secondary, #f5f5f5);
  border: 1px solid var(--border-color, #e7e5e4);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

/* 卡片左侧装饰色条 */
.tool-info-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, #2563eb 0%, #60a5fa 100%);
  opacity: 0.7;
}

.tool-info-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 工具名行：标签与工具名同一行 */
.tool-info-inline {
  flex-direction: row;
  align-items: center;
  gap: 10px;
}

.info-label {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--text-tertiary, #a8a29e);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  flex-shrink: 0;
}

.info-divider {
  width: 1px;
  height: 12px;
  background: var(--border-color, #e7e5e4);
  flex-shrink: 0;
}

.info-value {
  font-size: 13.5px;
  color: var(--text-primary, #1c1917);
}

.tool-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'SF Mono', 'JetBrains Mono', Monaco, Menlo, monospace;
  font-weight: 600;
  font-size: 13.5px;
  color: var(--accent-color, #2563eb);
  white-space: nowrap;
}

.tool-name-icon {
  opacity: 0.8;
  flex-shrink: 0;
}

.args-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.args-count {
  font-size: 11px;
  color: var(--text-tertiary, #a8a29e);
  background: var(--bg-primary, #fff);
  padding: 1px 7px;
  border-radius: 8px;
  border: 1px solid var(--border-color, #e7e5e4);
  font-weight: 500;
}

.args-block {
  margin: 0;
  padding: 10px 12px;
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-color, #e7e5e4);
  border-radius: 8px;
  font-family: 'SF Mono', 'JetBrains Mono', Monaco, Menlo, monospace;
  font-size: 12.5px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 128px;
  overflow-y: auto;
  color: var(--text-primary, #1c1917);
}

.risk-card {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 10px 11px;
  border: 1px solid;
  border-radius: 9px;
}
.risk-icon { display: flex; padding-top: 1px; flex-shrink: 0; }
.risk-copy { min-width: 0; }
.risk-title { font-size: 12.5px; font-weight: 650; line-height: 1.4; }
.risk-level { margin-left: 5px; font-size: 11px; font-weight: 700; }
.risk-description { margin-top: 2px; font-size: 11.5px; line-height: 1.45; opacity: .86; }
.risk-low { color: #15803d; background: rgba(34, 197, 94, .08); border-color: rgba(34, 197, 94, .25); }
.risk-medium { color: #b45309; background: rgba(245, 158, 11, .1); border-color: rgba(245, 158, 11, .3); }
.risk-high { color: #b91c1c; background: rgba(239, 68, 68, .1); border-color: rgba(239, 68, 68, .3); }
.risk-unknown { color: var(--text-secondary, #64748b); background: var(--bg-primary, #fff); border-color: var(--border-color, #cbd5e1); }
[data-theme='dark'] .risk-low { color: #86efac; }
[data-theme='dark'] .risk-medium { color: #fcd34d; }
[data-theme='dark'] .risk-high { color: #fca5a5; }

.args-block code {
  font-family: inherit;
  color: inherit;
}

.reason-section {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.reason-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #78716c);
}

.reason-optional {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-tertiary, #a8a29e);
  background: var(--bg-secondary, #f5f5f5);
  padding: 1px 6px;
  border-radius: 6px;
  border: 1px solid var(--border-color, #e7e5e4);
  text-transform: none;
  letter-spacing: 0;
}

.reason-input {
  padding: 9px 11px;
  border: 1px solid var(--border-color, #e7e5e4);
  border-radius: 9px;
  font-size: 13px;
  font-family: inherit;
  color: var(--text-primary, #1c1917);
  background: var(--bg-primary, #fff);
  resize: vertical;
  outline: none;
  transition: all 0.18s ease;
  line-height: 1.5;
}

.reason-input::placeholder {
  color: var(--text-tertiary, #a8a29e);
}

.reason-input:focus {
  border-color: var(--accent-color, #2563eb);
  box-shadow: 0 0 0 3px var(--accent-light, rgba(37, 99, 235, 0.1));
}

.dialog-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 22px 18px;
  border-top: 1px solid var(--border-color, #e7e5e4);
  flex-shrink: 0;
  background: var(--bg-secondary, #fafafa);
}

.footer-spacer {
  flex: 1;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border: none;
  border-radius: 9px;
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s ease;
  font-family: inherit;
  white-space: nowrap;
  position: relative;
  overflow: hidden;
}

.btn svg {
  flex-shrink: 0;
}

.btn-reject {
  background: transparent;
  color: var(--text-secondary, #78716c);
  border: 1px solid var(--border-color, #e7e5e4);
}

.btn-reject:hover {
  background: #fee2e2;
  color: #dc2626;
  border-color: #fecaca;
}

[data-theme='dark'] .btn-reject:hover {
  background: rgba(220, 38, 38, 0.15);
  border-color: rgba(220, 38, 38, 0.4);
}

.btn-approve {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #fff;
  box-shadow:
    0 4px 12px rgba(16, 185, 129, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
}

.btn-approve:hover {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  box-shadow:
    0 6px 16px rgba(16, 185, 129, 0.36),
    inset 0 1px 0 rgba(255, 255, 255, 0.22);
  transform: translateY(-1px);
}

.btn-approve:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.24);
}

.btn-approve-all {
  background: var(--bg-primary, #fff);
  color: var(--accent-color, #2563eb);
  border: 1px solid var(--accent-color, #2563eb);
}

.btn-approve-all:hover {
  background: var(--accent-light, rgba(37, 99, 235, 0.1));
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.18);
}

.btn-approve-all:active {
  transform: translateY(0);
}

/* 暗色模式下：全部批准按钮反转配色 */
[data-theme='dark'] .btn-approve-all {
  background: rgba(96, 165, 250, 0.12);
  border-color: rgba(96, 165, 250, 0.6);
}

[data-theme='dark'] .btn-approve-all:hover {
  background: rgba(96, 165, 250, 0.2);
}

[data-theme='dark'] .header-icon {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.25) 100%);
  color: #fbbf24;
  box-shadow:
    0 4px 10px rgba(245, 158, 11, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

[data-theme='dark'] .dialog-footer {
  background: rgba(0, 0, 0, 0.15);
}

/* 动画 */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.22s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-scale-enter-active {
  transition: all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dialog-scale-leave-active {
  transition: all 0.16s ease;
}

.dialog-scale-enter-from {
  opacity: 0;
  transform: scale(0.94) translateY(12px);
}

.dialog-scale-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

/* 滚动条样式 */
.args-block::-webkit-scrollbar,
.dialog-body::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.args-block::-webkit-scrollbar-thumb,
.dialog-body::-webkit-scrollbar-thumb {
  background: var(--border-color, #e7e5e4);
  border-radius: 3px;
}

.args-block::-webkit-scrollbar-thumb:hover,
.dialog-body::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary, #a8a29e);
}

.args-block::-webkit-scrollbar-track,
.dialog-body::-webkit-scrollbar-track {
  background: transparent;
}
</style>
