<template>
  <Teleport to="body">
    <Transition name="assistant-panel">
      <div v-if="visible" class="assistant-overlay" @click.self="close">
        <!-- AI 对话气泡（在卡片上方弹出） -->
        <Transition name="bubble">
          <div
            v-if="bubbleVisible"
            class="response-bubble"
          >
            <div v-if="isStreaming && !bubbleContent" class="bubble-loading">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
            <template v-else>
              <div class="bubble-text" v-html="renderContent(bubbleContent)"></div>
              <div class="bubble-footer">
                <span class="bubble-timer">{{ isStreaming ? '生成中...' : 'Friday 助理' }}</span>
                <button v-if="!isStreaming" class="bubble-copy" @click="copyContent" title="复制">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              </div>
            </template>
            <!-- 气泡指向下方的尖角 -->
            <div class="bubble-arrow"></div>
          </div>
        </Transition>

        <!-- 助理卡片 -->
        <div class="assistant-panel" ref="panelRef">
          <!-- Header -->
          <div class="panel-header">
            <div class="header-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z"/>
              </svg>
              <span>Friday 日程助理</span>
            </div>
            <button class="close-btn" @click="close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <!-- 单行输入框 -->
          <div class="input-area">
            <input
              ref="inputRef"
              v-model="inputText"
              class="assistant-input"
              type="text"
              :placeholder="isStreaming ? 'Friday 正在思考...' : '问我关于日程的任何问题...'"
              :disabled="isStreaming"
              @keydown.enter.exact.prevent="handleSend"
            />
            <button
              class="send-btn"
              :class="{ active: inputText.trim() && !isStreaming }"
              :disabled="!inputText.trim() || isStreaming"
              @click="handleSend"
            >
              <svg v-if="!isStreaming" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
              <svg v-else class="loading-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
              </svg>
            </button>
          </div>

          <!-- 猜你想问（两个，单行） -->
          <div v-if="!isStreaming && !bubbleVisible" class="quick-suggestions">
            <button
              v-for="s in suggestions"
              :key="s"
              class="suggestion-chip"
              @click="useSuggestion(s)"
            >{{ s }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { marked } from 'marked';
import { electronService } from '@/services/electron';
import { useScheduleStore } from '@/store/modules/schedule';

marked.setOptions({ breaks: true, gfm: true });

const props = defineProps({
  visible: { type: Boolean, default: false }
});
const emit = defineEmits(['update:visible']);

const scheduleStore = useScheduleStore();

const inputRef = ref(null);
const inputText = ref('');
const isStreaming = ref(false);
const bubbleVisible = ref(false);
const bubbleContent = ref('');

let activeRequestId = null;
let sessionId = localStorage.getItem('schedule-assistant-session-id') || '';
let unlistenChunk = null;
let unlistenDone = null;
let unlistenError = null;
let unlistenApproval = null;
let unlistenToolResult = null;

// 需要刷新日历的日程写操作工具
const SCHEDULE_WRITE_TOOLS = ['create_event', 'update_event', 'delete_event'];

const suggestions = [
  '本周未完成的日程',
  '帮我创建明天下午三点的会议',
];

function renderContent(text) {
  if (!text) return '';
  try {
    return marked.parse(text);
  } catch {
    return text;
  }
}

function close() {
  emit('update:visible', false);
}

function useSuggestion(text) {
  inputText.value = text;
  nextTick(() => {
    inputRef.value?.focus();
  });
}

function loadModelConfig() {
  try {
    const stored = localStorage.getItem('happy-friday-custom-models');
    if (stored) {
      const models = JSON.parse(stored);
      const selectedId = localStorage.getItem('happy-friday-selected-model');
      let model = selectedId ? models.find(m => m.id === selectedId) : null;
      if (!model && models.length > 0) model = models[0];
      return model || null;
    }
  } catch (e) {
    console.error('[ScheduleAssistant] Failed to load model config:', e);
  }
  return null;
}

async function handleSend() {
  const text = inputText.value.trim();
  if (!text || isStreaming.value) return;

  const model = loadModelConfig();
  if (!model) {
    showBubble('请先在 Friday 对话页面中配置 AI 模型。');
    return;
  }

  // 构造日程管理专用指令
  const scheduleMessage = `[你是日程管理专用助手，仅处理日程相关事务（查询/创建/修改/删除日程），请使用 list_events / create_event / update_event / delete_event 工具完成。

行为准则：
1. 当用户未明确指定具体时间时，默认创建为全天事件（不传 startTime / endTime，allDay 设为 true），不要追问用户。
2. 尽量根据上下文合理推断用户意图，直接执行操作，不要频繁向用户确认或追问。
3. 仅在信息严重缺失导致无法执行时才询问用户，且一次问清所有需要的信息。]\n\n${text}`;

  inputText.value = '';

  isStreaming.value = true;
  bubbleVisible.value = true;
  bubbleContent.value = '';

  activeRequestId = `schedule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    await electronService.invoke('agent-invoke', {
      requestId: activeRequestId,
      sessionId: sessionId,
      model: model,
      message: scheduleMessage,
      attachments: [],
      enableThinking: false,
    });
  } catch (err) {
    console.error('[ScheduleAssistant] Agent invoke error:', err);
    isStreaming.value = false;
    showBubble('调用失败，请稍后重试。');
  }
}

async function handleStop() {
  if (!isStreaming.value || !activeRequestId) return;
  try {
    await electronService.invoke('agent-stop', { requestId: activeRequestId });
  } catch (err) {
    console.error('[ScheduleAssistant] Stop error:', err);
  }
}

function showBubble(content) {
  bubbleVisible.value = true;
  bubbleContent.value = content;
  isStreaming.value = false;
}

function copyContent() {
  if (bubbleContent.value) {
    navigator.clipboard.writeText(bubbleContent.value).catch(() => {});
  }
}

// ========== 事件监听 ==========
onMounted(() => {
  unlistenChunk = electronService.listen('chat-chunk', (event) => {
    const data = event.payload;
    if (data.requestId !== activeRequestId) return;
    bubbleContent.value += data.content;
  });

  unlistenDone = electronService.listen('chat-done', (event) => {
    const data = event.payload;
    if (data.requestId !== activeRequestId) return;
    isStreaming.value = false;
    if (data.fullContent) {
      bubbleContent.value = data.fullContent;
    }
    if (data.sessionId) {
      sessionId = data.sessionId;
      localStorage.setItem('schedule-assistant-session-id', sessionId);
    }
    if (!bubbleContent.value) {
      bubbleVisible.value = false;
    }
  });

  unlistenError = electronService.listen('chat-error', (event) => {
    const data = event.payload;
    if (data.requestId !== activeRequestId) return;
    isStreaming.value = false;
    bubbleContent.value = `出错了：${data.error || '未知错误'}`;
  });

  // 所有工具调用默认自动批准，无需用户审批
  unlistenApproval = electronService.listen('agent-tool-approval', (event) => {
    const data = event.payload;
    if (data.requestId !== activeRequestId) return;
    electronService.invoke('agent-tool-approval-resume', {
      requestId: data.requestId,
      decision: { type: 'approve' },
    });
  });

  unlistenToolResult = electronService.listen('agent-tool-result', (event) => {
    const data = event.payload;
    if (data.requestId !== activeRequestId) return;
    // 日程写操作完成后刷新日历
    if (SCHEDULE_WRITE_TOOLS.includes(data.toolName)) {
      scheduleStore.loadEvents();
    }
  });
});

onUnmounted(() => {
  if (unlistenChunk) unlistenChunk();
  if (unlistenDone) unlistenDone();
  if (unlistenError) unlistenError();
  if (unlistenApproval) unlistenApproval();
  if (unlistenToolResult) unlistenToolResult();
});

// 面板打开时聚焦输入框
watch(() => props.visible, (val) => {
  if (val) {
    nextTick(() => {
      inputRef.value?.focus();
    });
  } else {
    if (isStreaming.value) {
      handleStop();
    }
    bubbleVisible.value = false;
  }
});
</script>

<style scoped>
.assistant-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-end;
  pointer-events: auto;
  background: transparent;
}

/* ========== AI 对话气泡（卡片上方） ========== */
.response-bubble {
  pointer-events: auto;
  margin: 0 24px 10px 0;
  width: 400px;
  max-width: calc(100vw - 48px);
  padding: 14px 16px;
  background: linear-gradient(135deg, #f0f4ff 0%, #f5f0ff 100%);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 16px;
  position: relative;
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.15), 0 2px 8px rgba(0, 0, 0, 0.06);
}

[data-theme='dark'] .response-bubble {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);
  border-color: rgba(102, 126, 234, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

/* 气泡底部尖角指向卡片 */
.bubble-arrow {
  position: absolute;
  bottom: -7px;
  right: 32px;
  width: 14px;
  height: 14px;
  background: linear-gradient(135deg, #f5f0ff 0%, #f5f0ff 100%);
  border-right: 1px solid rgba(102, 126, 234, 0.2);
  border-bottom: 1px solid rgba(102, 126, 234, 0.2);
  transform: rotate(45deg);
}

[data-theme='dark'] .bubble-arrow {
  background: rgba(118, 75, 162, 0.15);
  border-color: rgba(102, 126, 234, 0.3);
}

.bubble-loading {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 0;
}

.bubble-loading .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #667eea;
  animation: bounce 1.2s infinite ease-in-out;
}

.bubble-loading .dot:nth-child(2) { animation-delay: 0.15s; }
.bubble-loading .dot:nth-child(3) { animation-delay: 0.3s; }

@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
  30% { transform: translateY(-6px); opacity: 1; }
}

.bubble-text {
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--text-primary, #333);
  max-height: 200px;
  overflow-y: auto;
  word-break: break-word;
}

.bubble-text :deep(p) {
  margin: 0 0 6px;
}

.bubble-text :deep(p:last-child) {
  margin-bottom: 0;
}

.bubble-text :deep(ul),
.bubble-text :deep(ol) {
  margin: 4px 0 6px;
  padding-left: 18px;
}

.bubble-text :deep(li) {
  margin: 2px 0;
}

.bubble-text :deep(strong) {
  font-weight: 600;
  color: var(--text-primary, #333);
}

.bubble-text :deep(h1),
.bubble-text :deep(h2),
.bubble-text :deep(h3),
.bubble-text :deep(h4) {
  font-size: 14px;
  font-weight: 600;
  margin: 8px 0 4px;
}

.bubble-text :deep(h1:first-child),
.bubble-text :deep(h2:first-child),
.bubble-text :deep(h3:first-child) {
  margin-top: 0;
}

.bubble-text :deep(code) {
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
  padding: 1px 5px;
  border-radius: 4px;
}

.bubble-text :deep(pre) {
  margin: 6px 0;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  overflow-x: auto;
}

[data-theme='dark'] .bubble-text :deep(pre) {
  background: rgba(255, 255, 255, 0.06);
}

.bubble-text :deep(pre code) {
  background: none;
  color: var(--text-primary, #333);
  padding: 0;
}

.bubble-text :deep(blockquote) {
  margin: 4px 0;
  padding: 4px 12px;
  border-left: 3px solid rgba(102, 126, 234, 0.4);
  color: var(--text-secondary, #666);
}

.bubble-text :deep(table) {
  border-collapse: collapse;
  margin: 6px 0;
  font-size: 12.5px;
}

.bubble-text :deep(th),
.bubble-text :deep(td) {
  border: 1px solid rgba(102, 126, 234, 0.2);
  padding: 4px 8px;
  text-align: left;
}

.bubble-text :deep(th) {
  background: rgba(102, 126, 234, 0.08);
  font-weight: 600;
}

.bubble-text::-webkit-scrollbar {
  width: 4px;
}

.bubble-text::-webkit-scrollbar-thumb {
  background: rgba(102, 126, 234, 0.3);
  border-radius: 2px;
}

.bubble-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid rgba(102, 126, 234, 0.12);
}

.bubble-timer {
  font-size: 11px;
  color: var(--text-tertiary, #aaa);
}

.bubble-copy {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-tertiary, #aaa);
  cursor: pointer;
  border-radius: 5px;
  transition: all 0.15s;
}

.bubble-copy:hover {
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
}

/* ========== 助理卡片 ========== */
.assistant-panel {
  pointer-events: auto;
  margin: 0 24px 24px 0;
  width: 400px;
  max-width: calc(100vw - 48px);
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-color, #e8e8e8);
  border-radius: 16px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.18), 0 2px 12px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

[data-theme='dark'] .assistant-panel {
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.06);
}

/* Header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  flex-shrink: 0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Input area */
.input-area {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px 6px;
}

.assistant-input {
  flex: 1;
  height: 40px;
  border: 1.5px solid var(--border-color, #e8e8e8);
  border-radius: 20px;
  padding: 0 16px;
  font-size: 14px;
  color: var(--text-primary);
  background: transparent;
  outline: none;
  font-family: inherit;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.assistant-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.assistant-input::placeholder {
  color: var(--text-tertiary, #aaa);
}

.assistant-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: var(--text-tertiary, #ccc);
  color: #fff;
  cursor: pointer;
  border-radius: 50%;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.send-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.send-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.send-btn:not(:disabled):hover {
  transform: scale(1.05);
}

.loading-icon {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Quick suggestions - 紧凑单行 */
.quick-suggestions {
  display: flex;
  gap: 6px;
  padding: 0 14px 10px;
}

.suggestion-chip {
  padding: 3px 10px;
  border: none;
  background: rgba(102, 126, 234, 0.08);
  color: #667eea;
  font-size: 11.5px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.suggestion-chip:hover {
  background: rgba(102, 126, 234, 0.16);
  color: #5568d3;
}

/* Transitions */
.assistant-panel-enter-active {
  animation: panelIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.assistant-panel-leave-active {
  animation: panelIn 0.18s ease-in reverse;
}

@keyframes panelIn {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.bubble-enter-active {
  animation: bubbleIn 0.25s ease-out;
}

.bubble-leave-active {
  animation: bubbleIn 0.2s ease-in reverse;
}

@keyframes bubbleIn {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
