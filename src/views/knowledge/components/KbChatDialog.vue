<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="visible" class="kb-chat-dialog-overlay" @click.self="handleOverlayClick">
        <Transition name="dialog-scale">
          <div v-if="visible" class="kb-chat-dialog" :style="dialogStyle">
            <!-- 头部 -->
            <header class="dialog-header">
              <div class="header-left">
                <div class="header-icon" :class="isFolder ? 'icon-folder' : 'icon-kb'">
                  <svg v-if="isFolder" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                  </svg>
                </div>
                <div class="header-titles">
                  <span class="header-title">{{ contextLabel }}</span>
                  <span class="header-subtitle">{{ isFolder ? '基于文件夹提问' : '基于知识库提问' }} · RAG 检索 Top {{ topK }}</span>
                </div>
              </div>
              <div class="header-right">
                <button class="header-btn" @click="handleStop" v-if="isStreaming" title="停止生成">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="6" y="6" width="12" height="12" rx="2"></rect>
                  </svg>
                </button>
                <button class="header-btn" @click="handleClose" title="关闭">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </header>

            <!-- 消息区域 -->
            <main class="dialog-messages" ref="messagesContainer">
              <div class="messages-inner">
                <template v-for="(msg, index) in messages" :key="msg.id ?? index">
                  <UserMessage v-if="msg.role === 'user'" :content="msg.content" />
                  <AIMessage
                    v-else
                    :content="msg.content"
                    :reasoning="msg.reasoning"
                    :show-divider="true"
                    :show-rollback="false"
                  />
                  <div v-if="msg.error" class="msg-error-tip">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span>{{ msg.error }}</span>
                  </div>
                </template>

                <template v-if="isStreaming">
                  <AIMessage
                    :content="streamingContent"
                    :reasoning-streaming-content="streamingReasoning"
                    :is-streaming="true"
                    :show-divider="false"
                    :show-rollback="false"
                  />
                </template>

                <div v-if="messages.length === 0 && !isStreaming" class="empty-chat">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <p>开始基于{{ isFolder ? '文件夹' : '知识库' }}的对话</p>
                </div>
              </div>
            </main>

            <!-- 输入区 -->
            <footer class="dialog-input">
              <div class="input-wrapper" :class="{ focused: inputFocused }">
                <textarea
                  v-model="inputText"
                  class="input-field"
                  placeholder="继续提问..."
                  rows="1"
                  ref="textareaRef"
                  @input="autoResize"
                  @keydown.enter.exact="handleSendKeydown"
                  @focus="inputFocused = true"
                  @blur="inputFocused = false"
                ></textarea>
                <button
                  class="send-btn"
                  :class="{ active: inputText.trim() && !isStreaming }"
                  @click="handleSend"
                  :disabled="isStreaming"
                >
                  <svg v-if="!isStreaming" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                  <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="6" y="6" width="12" height="12" rx="2"></rect>
                  </svg>
                </button>
              </div>
            </footer>

            <!-- 滚动到底部按钮 -->
            <Transition name="scroll-btn">
              <button v-if="showScrollDownBtn" class="scroll-down-btn" @click="scrollToBottomForce">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
            </Transition>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { electronService } from '@/services/electron';
import UserMessage from '@/components/chat/UserMessage.vue';
import AIMessage from '@/components/chat/AIMessage.vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  isFolder: { type: Boolean, default: false },
  contextLabel: { type: String, default: '' },
  kbName: { type: String, default: '' },
  kbCategoryId: { type: String, default: '' },
  folderPath: { type: String, default: '' },
  topK: { type: Number, default: 10 },
  initialQuestion: { type: String, default: '' },
  mode: { type: String, default: 'chat' },
  model: { type: Object, default: null },
  thinkMode: { type: String, default: 'fast' }
});

const emit = defineEmits(['close']);

const messages = ref([]);
const inputText = ref('');
const textareaRef = ref(null);
const messagesContainer = ref(null);
const isStreaming = ref(false);
const streamingContent = ref('');
const streamingReasoning = ref('');
const isAtBottom = ref(true);
const showScrollDownBtn = ref(false);
const inputFocused = ref(false);
const dialogStyle = ref({});

let activeRequestId = '';
let isDoneReceived = false;
let currentSessionId = '';
let unlistenChunk = null;
let unlistenReasoning = null;
let unlistenDone = null;
let unlistenError = null;

watch(() => props.visible, (val) => {
  if (val) {
    resetState();
    // 先设置监听器，再发送消息，确保不会丢失任何流式事件
    setupListeners();
    nextTick(() => {
      if (props.initialQuestion) {
        sendChatMessage(props.initialQuestion);
      } else {
        textareaRef.value?.focus();
      }
    });
  } else {
    cleanupListeners();
    if (isStreaming.value && activeRequestId) {
      try {
        electronService.invoke('stop_chat', { requestId: activeRequestId });
      } catch (e) {
        console.error('Stop chat on close failed:', e);
      }
    }
  }
});

function resetState() {
  messages.value = [];
  inputText.value = '';
  isStreaming.value = false;
  streamingContent.value = '';
  streamingReasoning.value = '';
  activeRequestId = '';
  currentSessionId = '';
  isAtBottom.value = true;
  showScrollDownBtn.value = false;
}

function setupListeners() {
  cleanupListeners();
  console.log('[KbChat] setupListeners 注册监听器, activeRequestId=', activeRequestId);
  unlistenChunk = electronService.listen('chat-chunk', (event) => {
    const data = event.payload;
    console.log('[KbChat] chat-chunk 收到, requestId=', data.requestId, 'active=', activeRequestId, 'content长度=', (data.content || '').length);
    if (data.requestId !== activeRequestId) return;
    streamingContent.value += data.content;
    scrollToBottom();
  });

  unlistenReasoning = electronService.listen('chat-reasoning-chunk', (event) => {
    const data = event.payload;
    if (data.requestId !== activeRequestId) return;
    streamingReasoning.value += data.content;
    scrollToBottom();
  });

  unlistenDone = electronService.listen('chat-done', (event) => {
    const data = event.payload;
    console.log('[KbChat] chat-done 收到, requestId=', data.requestId, 'active=', activeRequestId, 'fullContent长度=', (data.fullContent || '').length);
    if (data.requestId !== activeRequestId) return;
    if (isDoneReceived) return;
    isDoneReceived = true;

    isStreaming.value = false;

    if (data.userMessageId) {
      for (let i = messages.value.length - 1; i >= 0; i--) {
        if (messages.value[i].role === 'user' && !messages.value[i].id) {
          messages.value[i].id = data.userMessageId;
          break;
        }
      }
    }

    const hasContent = streamingContent.value || data.fullContent;
    const hasReasoning = streamingReasoning.value || data.reasoningContent;

    if (hasContent || hasReasoning) {
      messages.value.push({
        role: 'assistant',
        content: data.fullContent || streamingContent.value,
        reasoning: data.reasoningContent || streamingReasoning.value || undefined,
        id: data.messageId
      });
    } else {
      // LLM 返回空内容（如模型不支持 Function Calling 或 Agent 循环未产出答案），给出可见提示
      messages.value.push({
        role: 'assistant',
        content: '',
        reasoning: undefined,
        id: data.messageId,
        error: '模型未返回内容，可能不支持工具调用或检索循环未得出答案'
      });
    }

    if (data.sessionId && !currentSessionId) {
      currentSessionId = data.sessionId;
    }

    streamingContent.value = '';
    streamingReasoning.value = '';
    showScrollDownBtn.value = false;
    scrollToBottom(true);
    nextTick(() => {
      textareaRef.value?.focus();
    });
  });

  unlistenError = electronService.listen('chat-error', (event) => {
    const data = event.payload;
    console.log('[KbChat] chat-error 收到, requestId=', data.requestId, 'active=', activeRequestId, 'error=', data.error);
    if (data.requestId !== activeRequestId) return;
    isStreaming.value = false;
    const partialContent = streamingContent.value;
    streamingContent.value = '';
    streamingReasoning.value = '';
    showScrollDownBtn.value = false;
    console.error('Stream error:', data.error);
    // 如果已有部分内容，先保存部分内容
    if (partialContent) {
      messages.value.push({
        role: 'assistant',
        content: partialContent,
        reasoning: undefined,
        id: null,
        error: data.error || '生成失败'
      });
    } else {
      messages.value.push({
        role: 'assistant',
        content: '',
        reasoning: undefined,
        id: null,
        error: data.error || '生成失败'
      });
    }
    scrollToBottom(true);
    nextTick(() => {
      textareaRef.value?.focus();
    });
  });
}

function cleanupListeners() {
  if (unlistenChunk) { unlistenChunk(); unlistenChunk = null; }
  if (unlistenReasoning) { unlistenReasoning(); unlistenReasoning = null; }
  if (unlistenDone) { unlistenDone(); unlistenDone = null; }
  if (unlistenError) { unlistenError(); unlistenError = null; }
}

async function sendChatMessage(text) {
  if (isStreaming.value || !text || !text.trim()) return;
  if (!props.model) {
    console.error('No model configured');
    return;
  }

  const enableThinking = props.thinkMode === 'deep';
  const mode = props.mode === 'memoryless' ? 'memoryless' : 'chat';

  messages.value.push({
    role: 'user',
    content: text
  });

  inputText.value = '';
  isStreaming.value = true;
  streamingContent.value = '';
  streamingReasoning.value = '';
  showScrollDownBtn.value = false;
  isAtBottom.value = true;
  scrollToBottom(true);

  activeRequestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  isDoneReceived = false;
  console.log('[KbChat] sendChatMessage 开始, requestId=', activeRequestId, 'mode=', mode, 'model=', props.model?.modelName, 'kbName=', props.kbName, 'folderPath=', props.folderPath);

  // props.model 是 Vue 响应式 Proxy，无法被 Electron IPC structured clone，必须深拷贝成普通对象
  const plainModel = JSON.parse(JSON.stringify(props.model));

  const baseArgs = {
    requestId: activeRequestId,
    model: plainModel,
    message: text,
    enableThinking,
    kbName: props.kbName || '',
    kbCategoryId: props.kbCategoryId || '',
    folderPath: props.folderPath || '',
    topK: props.topK
  };

  try {
    let result;
    if (mode === 'chat') {
      result = await electronService.invoke('chat_with_memory', {
        ...baseArgs,
        sessionId: currentSessionId || ''
      });
    } else {
      result = await electronService.invoke('chat_without_memory', baseArgs);
    }
    console.log('[KbChat] invoke 返回, result=', result, 'isStreaming=', isStreaming.value, 'isDoneReceived=', isDoneReceived);
    // electronService.invoke 捕获异常后返回 null，需要手动处理
    if (result === null) {
      console.error('Chat invoke returned null - backend error');
      // 如果 done/error 事件都没收到，需要手动恢复状态并提示
      if (isStreaming.value && !isDoneReceived) {
        isStreaming.value = false;
        streamingContent.value = '';
        streamingReasoning.value = '';
        showScrollDownBtn.value = false;
        messages.value.push({
          role: 'assistant',
          content: '',
          reasoning: undefined,
          id: null,
          error: '后端调用失败（invoke 返回 null），请查看主进程日志'
        });
        scrollToBottom(true);
      }
    }
  } catch (err) {
    console.error('[KbChat] Chat invoke error:', err, err?.stack);
    isStreaming.value = false;
    streamingContent.value = '';
    streamingReasoning.value = '';
    showScrollDownBtn.value = false;
    if (!isDoneReceived) {
      messages.value.push({
        role: 'assistant',
        content: '',
        reasoning: undefined,
        id: null,
        error: `调用失败: ${err?.message || String(err)}`
      });
      scrollToBottom(true);
    }
  }
}

function handleSend() {
  if (isStreaming.value) {
    handleStop();
    return;
  }
  const text = inputText.value.trim();
  if (!text) return;
  sendChatMessage(text);
}

function handleSendKeydown(e) {
  if (e.isComposing) return;
  e.preventDefault();
  handleSend();
}

async function handleStop() {
  if (!isStreaming.value || !activeRequestId) return;
  try {
    await electronService.invoke('stop_chat', { requestId: activeRequestId });
  } catch (err) {
    console.error('Stop chat error:', err);
  }
}

function handleClose() {
  emit('close');
}

function handleOverlayClick() {
  if (!isStreaming.value) {
    handleClose();
  }
}

function autoResize() {
  const textarea = textareaRef.value;
  if (textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }
}

function scrollToBottom(force = false) {
  nextTick(() => {
    if (messagesContainer.value) {
      if (force || isAtBottom.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      }
    }
  });
}

function scrollToBottomForce() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTo({
      top: messagesContainer.value.scrollHeight,
      behavior: 'smooth'
    });
    showScrollDownBtn.value = false;
    isAtBottom.value = true;
  }
}

function checkScrollPosition() {
  const el = messagesContainer.value;
  if (!el) return;
  const threshold = 80;
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
  isAtBottom.value = distanceFromBottom < threshold;
  showScrollDownBtn.value = !isAtBottom.value && messages.value.length > 0;
}

onMounted(() => {
  if (messagesContainer.value) {
    messagesContainer.value.addEventListener('scroll', checkScrollPosition);
  }
});

onUnmounted(() => {
  cleanupListeners();
  if (messagesContainer.value) {
    messagesContainer.value.removeEventListener('scroll', checkScrollPosition);
  }
});
</script>

<style scoped lang="scss">
.kb-chat-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.kb-chat-dialog {
  position: relative;
  width: 760px;
  max-width: 92vw;
  height: 80vh;
  max-height: 800px;
  background: var(--bg-primary, #ffffff);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25), 0 8px 24px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 头部 */
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-color, #eee);
  flex-shrink: 0;
  background: var(--bg-primary, #ffffff);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  flex-shrink: 0;

  &.icon-kb {
    background: rgba(16, 185, 129, 0.12);
    color: #10b981;
  }

  &.icon-folder {
    background: rgba(245, 158, 11, 0.12);
    color: #f59e0b;
  }
}

.header-titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.header-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 480px;
}

.header-subtitle {
  font-size: 12px;
  color: var(--text-tertiary, #999);
  white-space: nowrap;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #666);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.15s ease;
}

.header-btn:hover {
  background: var(--bg-hover, #f5f5f5);
  color: var(--text-primary, #1a1a1a);
}

/* 消息区 */
.dialog-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 0;
  scroll-behavior: smooth;
}

.messages-inner {
  max-width: 720px;
  margin: 0 auto;
  padding: 0 24px;
}

.empty-chat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-tertiary, #999);
  gap: 12px;

  p {
    font-size: 14px;
    margin: 0;
  }
}

.msg-error-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 880px;
  margin: 4px auto 12px;
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  color: #ef4444;
  font-size: 12.5px;
  line-height: 1.4;

  svg {
    flex-shrink: 0;
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

/* 输入区 */
.dialog-input {
  flex-shrink: 0;
  padding: 12px 24px 18px;
  border-top: 1px solid var(--border-color, #eee);
  background: var(--bg-primary, #ffffff);
}

.input-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: var(--bg-secondary, #f7f7f7);
  border: 1.5px solid transparent;
  border-radius: 16px;
  padding: 8px 8px 8px 16px;
  transition: all 0.2s ease;
}

.input-wrapper.focused {
  border-color: var(--text-tertiary, #999);
  background: var(--bg-primary, #ffffff);
}

.input-field {
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary, #1a1a1a);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  min-height: 24px;
  max-height: 120px;
  padding: 4px 0;
}

.input-field::placeholder {
  color: var(--text-tertiary, #999);
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: var(--text-tertiary, #ccc);
  color: #ffffff;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.send-btn.active {
  background: var(--text-primary, #1a1a1a);
}

.send-btn:hover:not(:disabled) {
  transform: scale(1.06);
}

.send-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* 滚动按钮 */
.scroll-down-btn {
  position: absolute;
  bottom: 90px;
  left: 50%;
  transform: translateX(-50%);
  width: 32px;
  height: 32px;
  border: none;
  background: var(--bg-primary, #ffffff);
  color: var(--text-secondary, #666);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.scroll-down-btn:hover {
  background: var(--bg-hover, #f5f5f5);
  color: var(--text-primary, #1a1a1a);
}

/* 过渡动画 */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-scale-enter-active,
.dialog-scale-leave-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dialog-scale-enter-from,
.dialog-scale-leave-to {
  opacity: 0;
  transform: scale(0.92) translateY(20px);
}

.scroll-btn-enter-active,
.scroll-btn-leave-active {
  transition: all 0.2s ease;
}

.scroll-btn-enter-from,
.scroll-btn-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
