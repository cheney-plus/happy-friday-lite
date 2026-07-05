<template>
  <div class="conversation-container">
    <header class="conversation-header">
      <button v-if="showBackBtn" class="header-btn back-btn" @click="goBack">
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
          <!-- Agent 模式：带时间线段的消息 → 交错渲染文本与工具调用 -->
          <div v-else-if="msg.segments && msg.segments.length > 0" class="agent-response-block">
            <div class="agent-response-header">
              <div class="avatar ai-avatar"><span class="avatar-icon">✦</span></div>
              <span class="ai-name">周五</span>
            </div>
            <div class="agent-timeline">
              <template v-for="(seg, si) in msg.segments" :key="`${msg.id}-seg-${si}`">
                <div v-if="seg.type === 'text' && seg.content" class="agent-text-body">
                  <div class="markdown-body" v-html="renderMarkdown(seg.content)"></div>
                </div>
                <ToolCallSection
                  v-else-if="seg.type === 'tool'"
                  :tool-name="seg.toolName"
                  :arguments="seg.arguments"
                  :output="seg.output"
                  :status="seg.status"
                  :default-collapsed="seg.status === 'success' && !seg.requireApproval"
                />
              </template>
            </div>
            <div class="message-divider"></div>
          </div>
          <!-- 普通模式：标准 AIMessage -->
          <AIMessage
            v-else
            :content="msg.content"
            :reasoning="msg.reasoning"
            :show-divider="true"
            :show-rollback="currentMode === 'chat'"
            @action="(type) => handleAction(type, index)"
          />
        </template>

        <!-- ========== Agent 模式流式：统一时间线 ==========
             工具调用与文本交替出现，保持事件流的原始顺序 -->
        <template v-if="currentMode === 'agent' && (isStreaming || agentSegments.length > 0)">
          <div class="agent-response-block">
            <div class="agent-response-header">
              <div class="avatar ai-avatar"><span class="avatar-icon">✦</span></div>
              <span class="ai-name">周五</span>
            </div>
            <div class="agent-timeline">
              <template v-for="seg in agentSegments" :key="seg.id">
                <div v-if="seg.type === 'text' && seg.content" class="agent-text-body">
                  <div class="markdown-body" v-html="renderMarkdown(seg.content)"></div>
                  <span v-if="seg.isStreaming" class="streaming-cursor"></span>
                </div>
                <ToolCallSection
                  v-else-if="seg.type === 'tool'"
                  :tool-name="seg.toolName"
                  :arguments="seg.arguments"
                  :output="seg.output"
                  :status="seg.status"
                  :default-collapsed="seg.status === 'success' && !seg.requireApproval"
                />
              </template>
              <!-- 尚未收到任何段但已开始流式 → 显示思考光标 -->
              <span v-if="agentSegments.length === 0 && isStreaming" class="streaming-cursor"></span>
            </div>
          </div>
        </template>

        <!-- 非 Agent 模式流式 -->
        <template v-else-if="isStreaming">
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

    <!-- ========== Agent 模式：HITL 工具调用审批弹窗 ========== -->
    <!-- 当后端工具标记 requireApproval=true 时弹出，等待用户批准或拒绝 -->
    <ToolApprovalDialog
      :visible="!!pendingApproval"
      :tool-name="pendingApproval?.toolName || ''"
      :arguments="pendingApproval?.arguments || {}"
      @approve="handleApproveTool"
      @reject="handleRejectTool"
    />

    <Transition name="toast-fade">
      <div v-if="saveToastVisible" class="save-toast">
        {{ saveToastMessage }}
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, onDeactivated } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { electronService } from '@/services/electron';
import { useNoteStore } from '@/store/modules/note';
import { marked } from 'marked';
import UserMessage from '@/components/chat/UserMessage.vue';
import AIMessage from '@/components/chat/AIMessage.vue';
import ChatInputBox from '@/components/chat/ChatInputBox.vue';
import RollbackConfirmDialog from '@/components/chat/RollbackConfirmDialog.vue';
import ToolApprovalDialog from '@/components/chat/ToolApprovalDialog.vue';
import ToolCallSection from '@/components/chat/ToolCallSection.vue';

const router = useRouter();
const route = useRoute();
const noteStore = useNoteStore();

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
// Agent 模式专有事件监听器
let unlistenAgentToolCall = null;
let unlistenAgentToolResult = null;
let unlistenAgentApproval = null;
let activeRequestId = '';
let isDoneReceived = false;

// ========== Agent 模式状态 ==========
// 当前流式响应的 Agent 时间线段（仅 Agent 模式使用）
// 段类型:
//   { type: 'text', id, content, isStreaming }
//   { type: 'tool', id, toolCallId, toolName, arguments, status, output, requireApproval }
//     status: 'running' | 'success' | 'rejected' | 'pending_approval'
const agentSegments = ref([]);
// 待审批的工具调用（HITL 弹窗）
const pendingApproval = ref(null);

const rollbackDialogVisible = ref(false);
const rollbackPreviewContent = ref('');
let pendingRollbackUserMsgId = null;
let pendingRollbackUserMsgIndex = null;

function formatTime(date) {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

// Agent 模式文本段 Markdown 渲染
marked.setOptions({ breaks: true, gfm: true });
function renderMarkdown(content) {
  return marked.parse(content);
}

const showBackBtn = computed(() => route.query.hideBack !== 'true');

function goBack() {
  router.push('/friday');
}

function handleAddToKnowledge() {
  console.log('Add to knowledge feature is not yet implemented');
}

function handleAction(action, index) {
  if (action === 'rollback') {
    handleRollback(index);
  } else if (action === 'share') {
    console.log('Share message feature is not yet implemented');
  } else if (action === 'add') {
    saveMessageToNote(index);
  }
}

const saveToastVisible = ref(false);
const saveToastMessage = ref('');

function showSaveToast(message) {
  saveToastMessage.value = message;
  saveToastVisible.value = true;
  setTimeout(() => {
    saveToastVisible.value = false;
  }, 2500);
}

async function saveMessageToNote(index) {
  const msg = messages.value[index];
  if (!msg || msg.role !== 'assistant') return;

  const content = msg.content || '';
  if (!content.trim()) {
    showSaveToast('消息内容为空，无法保存');
    return;
  }

  const dateStr = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '-');

  const title = `${chatTitle.value} ${dateStr}`;

  try {
    const htmlContent = marked.parse(content);
    const plainText = content.replace(/<[^>]*>/g, '').replace(/[#*`>\[\]()!_~|-]/g, '').trim();
    const note = await noteStore.importNote(null, null, title, htmlContent, plainText);
    if (note) {
      showSaveToast('已保存为笔记');
    } else {
      showSaveToast('保存失败');
    }
  } catch (err) {
    console.error('Failed to save message to note:', err);
    showSaveToast('保存失败');
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

  // 知识库选择信息：交由后端 RAG Agent 通过 Function Calling 自主决定是否检索
  const kbName = route.query.kbName || '';
  const kbCategoryId = route.query.kbCategoryId || '';

  messages.value.push({
    role: 'user',
    content: text
  });

  inputText.value = '';
  isStreaming.value = true;
  streamingContent.value = '';
  streamingReasoning.value = '';
  // Agent 模式：清空上一轮的时间线段
  agentSegments.value = [];
  showScrollDownBtn.value = false;
  isAtBottom.value = true;
  scrollToBottom(true);

  activeRequestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  isDoneReceived = false;

  try {
    if (mode === 'agent') {
      // Agent 模式：调用 agent-invoke，后端走 Agent Loop（多工具 + HITL）
      // Agent 自主通过 retrieve_knowledge 工具检索，无需前端传 kbName
      console.log('[Agent] 发起 Agent 调用, requestId=', activeRequestId);
      await electronService.invoke('agent-invoke', {
        requestId: activeRequestId,
        sessionId: currentSessionId.value || '',
        model: model,
        message: text,
        enableThinking: route.query.thinkMode === 'deep'
      });
    } else if (mode === 'chat') {
      await electronService.invoke('chat_with_memory', {
        requestId: activeRequestId,
        sessionId: currentSessionId.value || '',
        model: model,
        message: text,
        enableThinking: route.query.thinkMode === 'deep',
        kbName,
        kbCategoryId
      });
    } else {
      await electronService.invoke('chat_without_memory', {
        requestId: activeRequestId,
        model: model,
        message: text,
        enableThinking: route.query.thinkMode === 'deep',
        kbName,
        kbCategoryId
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
    // Agent 模式使用 agent-stop，普通对话使用 stop_chat
    const mode = route.query.mode || 'chat';
    const channel = mode === 'agent' ? 'agent-stop' : 'stop_chat';
    await electronService.invoke(channel, { requestId: activeRequestId });
  } catch (err) {
    console.error('Stop chat error:', err);
  }
}

async function loadSessionHistory(sessionId) {
  try {
    const history = await electronService.invoke('get_session_messages', { sessionId });
    messages.value = history.map(m => {
      const msg = {
        role: m.role,
        content: m.content,
        id: m.id
      };
      // 从 metadata 恢复 Agent 模式的时间线段
      if (m.metadata && m.metadata.segments && Array.isArray(m.metadata.segments)) {
        msg.segments = m.metadata.segments;
      }
      return msg;
    });
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
  activeToolCalls.value = [];
  showScrollDownBtn.value = false;
  isAtBottom.value = true;
  scrollToBottom(true);

  activeRequestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  isDoneReceived = false;

  try {
    if (mode === 'agent') {
      // Agent 模式：已有会话历史时继续 Agent 对话（message 传空，由后端读取历史）
      await electronService.invoke('agent-invoke', {
        requestId: activeRequestId,
        sessionId: currentSessionId.value || '',
        model: model,
        message: '',
        enableThinking: route.query.thinkMode === 'deep'
      });
    } else if (mode === 'chat') {
      await electronService.invoke('chat_with_memory', {
        requestId: activeRequestId,
        sessionId: currentSessionId.value || '',
        model: model,
        message: '',
        enableThinking: route.query.thinkMode === 'deep',
        kbName: route.query.kbName || '',
        kbCategoryId: route.query.kbCategoryId || ''
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
    // Agent 模式：维护时间线段，文本追加到最后一个 text 段或新建
    if (currentMode.value === 'agent') {
      const segs = agentSegments.value;
      const last = segs.length > 0 ? segs[segs.length - 1] : null;
      if (last && last.type === 'text') {
        last.content += data.content;
      } else {
        segs.push({
          type: 'text',
          id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          content: data.content,
          isStreaming: true
        });
      }
    }
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
      const newMsg = {
        role: 'assistant',
        content: data.fullContent || streamingContent.value,
        reasoning: data.reasoningContent || streamingReasoning.value || undefined,
        id: data.messageId
      };
      // Agent 模式：将时间线段深拷贝到消息对象，用于历史渲染
      if (currentMode.value === 'agent' && agentSegments.value.length > 0) {
        // 标记最后一个 text 段为非流式
        const segs = agentSegments.value;
        const lastSeg = segs.length > 0 ? segs[segs.length - 1] : null;
        if (lastSeg && lastSeg.type === 'text') {
          lastSeg.isStreaming = false;
        }
        newMsg.segments = JSON.parse(JSON.stringify(segs));
      }
      messages.value.push(newMsg);
    }

    if (data.sessionId && !currentSessionId.value) {
      currentSessionId.value = data.sessionId;
    }

    streamingContent.value = '';
    streamingReasoning.value = '';
    // Agent 模式：清空时间线段（已保存到消息对象中）
    agentSegments.value = [];
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

  // ========== Agent 模式专有事件 ==========
  // 工具调用开始：推送工具段时间线
  unlistenAgentToolCall = electronService.listen('agent-tool-call', (event) => {
    const data = event.payload;
    if (data.requestId !== activeRequestId) return;
    console.log('[Agent] 工具调用:', data.toolName, data.arguments);
    // 标记前一个 text 段为非流式（AI 已切换到工具调用）
    const segs = agentSegments.value;
    const last = segs.length > 0 ? segs[segs.length - 1] : null;
    if (last && last.type === 'text') {
      last.isStreaming = false;
    }
    segs.push({
      type: 'tool',
      id: data.toolCallId,
      toolCallId: data.toolCallId,
      toolName: data.toolName,
      arguments: data.arguments,
      status: data.requireApproval ? 'pending_approval' : 'running',
      output: '',
      requireApproval: !!data.requireApproval
    });
    scrollToBottom();
  });

  // 工具调用结果：更新工具段状态
  unlistenAgentToolResult = electronService.listen('agent-tool-result', (event) => {
    const data = event.payload;
    if (data.requestId !== activeRequestId) return;
    console.log('[Agent] 工具结果:', data.toolName, data.status);
    const seg = agentSegments.value.find((s) => s.type === 'tool' && s.toolCallId === data.toolCallId);
    if (seg) {
      seg.status = data.status || 'success';
      seg.output = data.output || '';
    }
    scrollToBottom();
  });

  // 触发人机交互审批：弹出审批对话框
  unlistenAgentApproval = electronService.listen('agent-tool-approval', (event) => {
    const data = event.payload;
    if (data.requestId !== activeRequestId) return;
    console.log('[Agent] 请求审批:', data.toolName);
    pendingApproval.value = {
      requestId: data.requestId,
      toolName: data.toolName,
      toolCallId: data.toolCallId,
      arguments: data.arguments
    };
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
  if (unlistenAgentToolCall) unlistenAgentToolCall();
  if (unlistenAgentToolResult) unlistenAgentToolResult();
  if (unlistenAgentApproval) unlistenAgentApproval();
  if (messagesContainer.value) {
    messagesContainer.value.removeEventListener('scroll', checkScrollPosition);
  }
});

onDeactivated(() => {
  rollbackDialogVisible.value = false;
  pendingApproval.value = null;
});

// ========== Agent 审批处理 ==========
// 用户批准工具调用
async function handleApproveTool() {
  if (!pendingApproval.value) return;
  const { requestId } = pendingApproval.value;
  console.log('[Agent] 用户批准工具调用');
  pendingApproval.value = null;
  try {
    await electronService.invoke('agent-tool-approval-resume', {
      requestId,
      decision: { type: 'approve' }
    });
  } catch (err) {
    console.error('[Agent] 审批回传失败:', err);
  }
}

// 用户拒绝工具调用
async function handleRejectTool(decision) {
  if (!pendingApproval.value) return;
  const { requestId, toolCallId } = pendingApproval.value;
  console.log('[Agent] 用户拒绝工具调用:', decision.reason);
  // 更新工具段状态为已拒绝
  const seg = agentSegments.value.find((s) => s.type === 'tool' && s.toolCallId === toolCallId);
  if (seg) {
    seg.status = 'rejected';
    seg.output = decision.reason || '用户拒绝';
  }
  pendingApproval.value = null;
  try {
    await electronService.invoke('agent-tool-approval-resume', {
      requestId,
      decision: { type: 'reject', reason: decision.reason || '用户拒绝执行' }
    });
  } catch (err) {
    console.error('[Agent] 审批回传失败:', err);
  }
}
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

.save-toast {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 24px;
  background: var(--text-primary);
  color: var(--bg-primary);
  font-size: 14px;
  font-weight: 500;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  pointer-events: none;
}

.toast-fade-enter-active {
  transition: all 0.25s ease-out;
}

.toast-fade-leave-active {
  transition: all 0.2s ease-in;
}

.toast-fade-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}

.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-4px);
}

/* ========== Agent 模式：响应块与时间线 ==========
   整个 Agent 回复作为一个响应块，头部含头像/名称，
   时间线内文本段与工具调用段交替排列 */

.agent-response-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.agent-response-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.agent-response-header .avatar {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.agent-response-header .ai-avatar {
  background: linear-gradient(135deg, #6ee7b7 0%, #34d399 50%, #10b981 100%);
}

.agent-response-header .avatar-icon {
  font-size: 16px;
  color: #ffffff;
  font-weight: 700;
}

.agent-response-header .ai-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.agent-timeline {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-left: 44px; /* 与头像对齐 */
}

.agent-text-body {
  font-size: 14.5px;
  line-height: 1.7;
  color: var(--text-primary);
}

.agent-text-body .markdown-body {
  white-space: normal;
  -webkit-user-select: text;
  user-select: text;
}

.agent-text-body .markdown-body :deep(*) {
  -webkit-user-select: text;
  user-select: text;
}

.agent-text-body .markdown-body :deep(p) {
  margin: 0 0 8px;
}

.agent-text-body .markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.agent-text-body .markdown-body :deep(h1),
.agent-text-body .markdown-body :deep(h2),
.agent-text-body .markdown-body :deep(h3) {
  margin: 16px 0 8px;
  font-weight: 600;
  color: var(--text-primary);
}

.agent-text-body .markdown-body :deep(h1) { font-size: 1.3em; }
.agent-text-body .markdown-body :deep(h2) { font-size: 1.15em; }
.agent-text-body .markdown-body :deep(h3) { font-size: 1.05em; }

.agent-text-body .markdown-body :deep(ul),
.agent-text-body .markdown-body :deep(ol) {
  margin: 8px 0;
  padding-left: 20px;
}

.agent-text-body .markdown-body :deep(li) {
  margin: 4px 0;
}

.agent-text-body .markdown-body :deep(code) {
  background: rgba(0, 0, 0, 0.06);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

[data-theme='dark'] .agent-text-body .markdown-body :deep(code) {
  background: rgba(255, 255, 255, 0.1);
}

.agent-text-body .markdown-body :deep(pre) {
  margin: 10px 0;
  padding: 14px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 10px;
  overflow-x: auto;
}

[data-theme='dark'] .agent-text-body .markdown-body :deep(pre) {
  background: rgba(255, 255, 255, 0.06);
}

.agent-text-body .markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
  font-size: 0.85em;
}

.agent-text-body .markdown-body :deep(blockquote) {
  margin: 10px 0;
  padding: 8px 14px;
  border-left: 3px solid #10b981;
  background: rgba(16, 185, 129, 0.06);
  border-radius: 0 8px 8px 0;
  color: var(--text-secondary);
}

.agent-text-body .markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
  font-size: 0.9em;
}

.agent-text-body .markdown-body :deep(th),
.agent-text-body .markdown-body :deep(td) {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  text-align: left;
}

.agent-text-body .markdown-body :deep(th) {
  background: var(--bg-hover);
  font-weight: 600;
}

/* Agent 响应块内的分隔线 */
.agent-response-block .message-divider {
  width: 100%;
  height: 1px;
  background: var(--border-color);
  margin-top: 8px;
}

/* Agent 时间线内的流式光标 */
.agent-timeline .streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 16px;
  background: #10b981;
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: blink 0.8s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
</style>
