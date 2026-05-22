<template>
  <div class="conversation-container">
    <header class="conversation-header">
      <button class="header-btn back-btn" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5"></path>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
      </button>

      <div class="header-center">
        <span class="header-title">{{ chatTitle }}</span>
        <span class="header-time">{{ chatTime }}</span>
      </div>

      <button class="header-btn knowledge-btn" @click="handleAddToKnowledge">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          <line x1="12" y1="6" x2="12" y2="13"></line>
          <line x1="9" y1="10" x2="15" y2="10"></line>
        </svg>
      </button>
    </header>

    <main class="conversation-messages" ref="messagesContainer">
      <div class="messages-inner">
        <template v-for="(msg, index) in messages" :key="msg.id ?? index">
          <UserMessage v-if="msg.role === 'user'" :content="msg.content" />
          <AIMessage
            v-else
            :content="msg.content"
            :reasoning="msg.reasoning"
            :show-divider="true"
            :show-rollback="currentMode === 'chat'"
            @action="(type) => handleAction(type, index)"
          />
        </template>

        <template v-if="isStreaming">
          <AIMessage
            :content="streamingContent"
            :reasoning-streaming-content="streamingReasoning"
            :is-streaming="true"
            :show-divider="false"
            :show-rollback="currentMode === 'chat'"
          />
        </template>
      </div>
    </main>

    <ChatInputBox
      v-model="inputText"
      placeholder="输入消息..."
      :is-streaming="isStreaming"
      @send="handleSend"
      @stop="handleStop"
    />

    <Transition name="scroll-btn">
      <button v-if="showScrollDownBtn" class="scroll-down-btn" @click="scrollToBottomForce">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
    </Transition>

    <RollbackConfirmDialog
      :visible="rollbackDialogVisible"
      :preview-content="rollbackPreviewContent"
      @confirm="executeRollback"
      @cancel="rollbackDialogVisible = false"
    />
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted, onDeactivated } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { electronService } from '@/services/electron';
import UserMessage from '@/components/chat/UserMessage.vue';
import AIMessage from '@/components/chat/AIMessage.vue';
import ChatInputBox from '@/components/chat/ChatInputBox.vue';
import RollbackConfirmDialog from '@/components/chat/RollbackConfirmDialog.vue';

const router = useRouter();
const route = useRoute();

const inputText = ref('');
const messagesContainer = ref(null);
const isStreaming = ref(false);
const streamingContent = ref('');
const streamingReasoning = ref('');
const isRollingBack = ref(false);
const isAtBottom = ref(true);
const showScrollDownBtn = ref(false);

const chatTitle = ref('与 Friday 的对话');
const chatTime = ref(formatTime(new Date()));

const messages = ref([]);

const currentMode = ref('');
const currentSessionId = ref('');
let unlistenChunk = null;
let unlistenReasoning = null;
let unlistenDone = null;
let unlistenError = null;
let unlistenTitle = null;
let activeRequestId = '';
let isDoneReceived = false;

const rollbackDialogVisible = ref(false);
const rollbackPreviewContent = ref('');
let pendingRollbackUserMsgId = null;
let pendingRollbackUserMsgIndex = null;

function formatTime(date) {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function goBack() {
  router.push('/friday');
}

function handleAddToKnowledge() {}

function handleAction(action, index) {
  if (action === 'rollback') {
    handleRollback(index);
  }
}

function handleRollback(aiMsgIndex) {
  if (isStreaming.value || isRollingBack.value) return;

  if (aiMsgIndex <= 0 || messages.value[aiMsgIndex].role !== 'assistant') return;

  let userMsgIndex = aiMsgIndex - 1;
  while (userMsgIndex >= 0 && messages.value[userMsgIndex].role !== 'assistant') {
    userMsgIndex--;
  }
  userMsgIndex++;

  if (userMsgIndex < 0 || messages.value[userMsgIndex].role !== 'user') return;

  const userMsg = messages.value[userMsgIndex];
  if (!userMsg.id) {
    console.error('User message has no ID, cannot rollback');
    return;
  }

  pendingRollbackUserMsgId = userMsg.id;
  pendingRollbackUserMsgIndex = userMsgIndex;
  rollbackPreviewContent.value = userMsg.content;
  rollbackDialogVisible.value = true;
}

async function executeRollback() {
  rollbackDialogVisible.value = false;

  if (pendingRollbackUserMsgId === null || pendingRollbackUserMsgIndex === null) return;
  if (!currentSessionId.value) return;

  isRollingBack.value = true;

  try {
    await electronService.invoke('rollback_session', {
      sessionId: currentSessionId.value,
      messageId: pendingRollbackUserMsgId
    });

    const userMsgContent = messages.value[pendingRollbackUserMsgIndex].content;
    messages.value = messages.value.slice(0, pendingRollbackUserMsgIndex);

    inputText.value = userMsgContent;

    await nextTick();
    scrollToBottom();
  } catch (err) {
    console.error('Rollback failed:', err);
  } finally {
    isRollingBack.value = false;
    pendingRollbackUserMsgId = null;
    pendingRollbackUserMsgIndex = null;
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

function checkScrollPosition() {
  const el = messagesContainer.value;
  if (!el) return;
  const threshold = 80;
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
  isAtBottom.value = distanceFromBottom < threshold;
  showScrollDownBtn.value = !isAtBottom.value && messages.value.length > 0;
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

function loadModelConfig(modelId) {
  try {
    const stored = localStorage.getItem('happy-friday-custom-models');
    if (stored) {
      const models = JSON.parse(stored);
      let model = models.find(m => m.id === modelId);
      if (!model && models.length > 0) {
        const selectedId = localStorage.getItem('happy-friday-selected-model');
        model = selectedId ? models.find(m => m.id === selectedId) : models[0];
      }
      return model || null;
    }
  } catch (e) {
    console.error('Failed to load model config:', e);
  }
  return null;
}

async function sendChatMessage(text) {
  if (isStreaming.value || isRollingBack.value || !text.trim()) return;

  const mode = route.query.mode || 'chat';
  const modelId = route.query.modelId || '';
  const model = loadModelConfig(modelId);

  if (!model) {
    console.error('No model config found');
    return;
  }

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

  try {
    if (mode === 'chat') {
      await electronService.invoke('chat_with_memory', {
        requestId: activeRequestId,
        sessionId: currentSessionId.value || '',
        model: model,
        message: text,
        enableThinking: route.query.thinkMode === 'deep'
      });
    } else {
      await electronService.invoke('chat_without_memory', {
        requestId: activeRequestId,
        model: model,
        message: text,
        enableThinking: route.query.thinkMode === 'deep'
      });
    }
  } catch (err) {
    console.error('Chat invoke error:', err);
    isStreaming.value = false;
    streamingContent.value = '';
  }
}

function handleSend(e) {
  if (e instanceof KeyboardEvent && e.isComposing) return;
  sendChatMessage(inputText.value);
}

async function handleStop() {
  if (!isStreaming.value || !activeRequestId) return;

  try {
    await electronService.invoke('stop_chat', { requestId: activeRequestId });
  } catch (err) {
    console.error('Stop chat error:', err);
  }
}

async function loadSessionHistory(sessionId) {
  try {
    const history = await electronService.invoke('get_session_messages', { sessionId });
    messages.value = history.map(m => ({
      role: m.role,
      content: m.content,
      id: m.id
    }));
  } catch (err) {
    console.error('Failed to load session history:', err);
  }
}

async function triggerAiResponse() {
  if (isStreaming.value || isRollingBack.value) return;

  const mode = route.query.mode || 'chat';
  const modelId = route.query.modelId || '';
  const model = loadModelConfig(modelId);

  if (!model) return;

  isStreaming.value = true;
  streamingContent.value = '';
  streamingReasoning.value = '';
  showScrollDownBtn.value = false;
  isAtBottom.value = true;
  scrollToBottom(true);

  activeRequestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  isDoneReceived = false;

  try {
    if (mode === 'chat') {
      await electronService.invoke('chat_with_memory', {
        requestId: activeRequestId,
        sessionId: currentSessionId.value || '',
        model: model,
        message: '',
        enableThinking: route.query.thinkMode === 'deep'
      });
    }
  } catch (err) {
    console.error('Chat invoke error:', err);
    isStreaming.value = false;
    streamingContent.value = '';
  }
}

async function initConversation() {
  isStreaming.value = false;
  streamingContent.value = '';
  streamingReasoning.value = '';
  messages.value = [];
  activeRequestId = '';
  isDoneReceived = false;
  chatTitle.value = '与 Friday 的对话';
  chatTime.value = formatTime(new Date());

  currentMode.value = route.query.mode || 'chat';
  currentSessionId.value = route.params.sessionId || '';
  if (currentSessionId.value.startsWith('new-')) {
    currentSessionId.value = '';
  }

  if (currentMode.value === 'chat' && currentSessionId.value) {
    const queryTitle = route.query.title;
    if (queryTitle) {
      chatTitle.value = queryTitle;
    }
    await loadSessionHistory(currentSessionId.value);
    try {
      const sessionInfo = await electronService.invoke('get_session', { sessionId: currentSessionId.value });
      if (sessionInfo) {
        chatTitle.value = sessionInfo.title;
      }
    } catch {}
  }

  const query = route.query.q;
  if (query) {
    const alreadyHasMessage = messages.value.length > 0
      && messages.value[messages.value.length - 1].role === 'user'
      && messages.value[messages.value.length - 1].content === query;

    if (alreadyHasMessage) {
      await triggerAiResponse();
    } else {
      sendChatMessage(query);
    }
  }
}

onMounted(async () => {
  unlistenChunk = electronService.listen('chat-chunk', (event) => {
    const data = event.payload;
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
    }

    if (data.sessionId && !currentSessionId.value) {
      currentSessionId.value = data.sessionId;
    }

    streamingContent.value = '';
    streamingReasoning.value = '';
    showScrollDownBtn.value = false;
    scrollToBottom(true);
  });

  unlistenError = electronService.listen('chat-error', (event) => {
    const data = event.payload;
    if (data.requestId !== activeRequestId) return;
    isStreaming.value = false;
    streamingContent.value = '';
    streamingReasoning.value = '';
    showScrollDownBtn.value = false;
    console.error('Stream error:', data.error);
  });

  unlistenTitle = electronService.listen('session-title-updated', (event) => {
    const data = event.payload;
    if (data.sessionId === currentSessionId.value) {
      chatTitle.value = data.title;
    }
  });

  await initConversation();

  if (messagesContainer.value) {
    messagesContainer.value.addEventListener('scroll', checkScrollPosition);
  }
});

onUnmounted(() => {
  if (unlistenChunk) unlistenChunk();
  if (unlistenReasoning) unlistenReasoning();
  if (unlistenDone) unlistenDone();
  if (unlistenError) unlistenError();
  if (unlistenTitle) unlistenTitle();
  if (messagesContainer.value) {
    messagesContainer.value.removeEventListener('scroll', checkScrollPosition);
  }
});

onDeactivated(() => {
  rollbackDialogVisible.value = false;
});
</script>

<style scoped>
.conversation-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: var(--bg-primary);
  overflow: hidden;
  position: relative;
}

.conversation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  flex-shrink: 0;
  -webkit-app-region: drag;
  app-region: drag;
}

.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 10px;
  transition: all 0.15s ease;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.header-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.header-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.header-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.header-time {
  font-size: 12px;
  color: var(--text-tertiary);
}

.conversation-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 0;
  scroll-behavior: smooth;
}

.conversation-messages::-webkit-scrollbar {
  width: 5px;
}

.conversation-messages::-webkit-scrollbar-track {
  background: transparent;
}

.conversation-messages::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 10px;
}

.messages-inner {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.scroll-down-btn {
  position: absolute;
  bottom: 120px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 50%;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.06);
  z-index: 10;
  transition: all 0.2s ease;
}

.scroll-down-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  transform: translateX(-50%) scale(1.08);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16), 0 2px 6px rgba(0, 0, 0, 0.08);
}

.scroll-down-btn:active {
  transform: translateX(-50%) scale(0.95);
}

.scroll-btn-enter-active {
  transition: all 0.25s ease-out;
}

.scroll-btn-leave-active {
  transition: all 0.2s ease-in;
}

.scroll-btn-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.scroll-btn-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.9);
}
</style>
