<template>
  <div class="conversation-page">
    <header class="conversation-header" :class="{ 'is-history-collapsed': !isShareMode && historyCollapsed }">
      <div class="header-center">
        <span class="header-title">{{ chatTitle }}</span>
        <span class="header-time">{{ chatTime }}</span>
      </div>

      <button v-if="!isShareMode" class="header-btn knowledge-btn" type="button" @click="handleAddToKnowledge(isStreaming)">
        <SaveNoteIcon :size="18" />
        <span class="btn-tooltip hover-tooltip">{{ t('friday.saveAsNote') }}</span>
      </button>
    </header>

    <main ref="messagesContainer" class="conversation-messages">
      <div class="messages-inner">
        <template v-for="(msg, index) in messages" :key="msg.id ?? index">
          <UserMessage v-if="msg.role === 'user'" :content="msg.content" />
          <AgentMessageBlock
            v-else-if="msg.segments && msg.segments.length > 0"
            :segments="msg.segments"
            :reasoning="msg.reasoning"
            :show-actions="!isShareMode"
            :show-divider="true"
            @action="(type) => handleAction(type, index)"
          />
          <AIMessage
            v-else
            :content="msg.content"
            :reasoning="msg.reasoning"
            :sources="msg.sources"
            :display-name="t('friday.assistantName')"
            :show-divider="true"
            :show-actions="!isShareMode"
            :show-rollback="currentMode === 'chat'"
            @action="(type) => handleAction(type, index)"
          />
        </template>

        <StreamingAssistantMessage
          :state="streamingState"
          :mode="currentMode"
          :display-name="t('friday.assistantName')"
          :show-rollback="currentMode === 'chat'"
        />
      </div>
    </main>

    <FridayComposer
      v-if="!isShareMode"
      :model-binding="composerBinding"
      variant="conversation"
      :is-streaming="isStreaming"
      :placeholder="t('friday.inputPlaceholder')"
      @send="handleComposerSend"
      @stop="handleStop"
    />

    <Transition name="scroll-btn">
      <button v-if="showScrollDownBtn" class="scroll-down-btn" type="button" @click="scrollToBottomForce">
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

    <ToolApprovalDialog
      :visible="!!pendingApproval && isConversationVisible"
      :tool-name="pendingApproval?.toolName || ''"
      :arguments="pendingApproval?.arguments || {}"
      :risk-assessment="pendingApproval?.riskAssessment"
      @approve="handleApproveTool"
      @approve-all="handleApproveAll"
      @reject="handleRejectTool"
    />

    <Transition name="toast-fade">
      <div v-if="toastVisible" class="save-toast">{{ toastMessage }}</div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import SaveNoteIcon from '@/components/icons/SaveNoteIcon.vue';
import { electronService } from '@/services/electron';
import { useFridayStore, useTabStore } from '@/store';
import { useNoteStore } from '@/store/modules/note';
import { handleCodeCopyClick, renderMarkdown, stripMarkdown } from '@/utils/markdown';
import { fridayChatLocation, getFridayTabId, isNewSessionId } from '@/utils/fridayNavigation';
import UserMessage from '@/components/chat/UserMessage.vue';
import AIMessage from '@/components/chat/AIMessage.vue';
import RollbackConfirmDialog from '@/components/chat/RollbackConfirmDialog.vue';
import ToolApprovalDialog from '@/components/chat/ToolApprovalDialog.vue';
import AgentMessageBlock from '@/views/friday/components/AgentMessageBlock.vue';
import StreamingAssistantMessage from '@/components/chat/StreamingAssistantMessage.vue';
import FridayComposer from '@/views/friday/components/FridayComposer.vue';
import { useChatStream } from '@/views/friday/composables/useChatStream';
import { refreshHistorySessions } from '@/views/friday/composables/useConversationHistory';
import { useConversationSummary } from '@/views/friday/composables/useConversationSummary';
import { useToast } from '@/views/friday/composables/useToast';
import { findTurnStartUserIndex, formatClock, getAssistantContent, mapHistoryMessage } from '@/views/friday/utils/messages';

const injectedRoute = inject('fridayRoute', null);
const injectedNavigate = inject('fridayNavigate', null);
const route = injectedRoute || useRoute();
const router = useRouter();
const navigate = injectedNavigate || ((location, { replace = false } = {}) => (
  replace ? router.replace(location) : router.push(location)
));
const { t } = useI18n();
const fridayStore = useFridayStore();
const tabStore = useTabStore();
const noteStore = useNoteStore();
const injectedHistoryCollapsed = inject('fridayHistoryCollapsed', ref(false));
// 本 Tab 的稳定标识（路由为 Tab 级快照，不会读到其它 Tab 的 __tab）
const ownTabKey = getFridayTabId(route, tabStore);

const isShareMode = computed(() => route.meta?.share === true || !electronService.isElectron);
const historyCollapsed = computed(() => !!injectedHistoryCollapsed.value);
const inputText = ref('');
// 输入文本通过稳定对象交给输入框组件承载，模板不读取其值，避免逐字符触发整页重渲染
const composerBinding = { ref: inputText };
const messagesContainer = ref(null);
const isAtBottom = ref(true);
const showScrollDownBtn = ref(false);
const chatTime = ref(formatClock());
const isRollingBack = ref(false);
const rollbackDialogVisible = ref(false);
const rollbackPreviewContent = ref('');
let pendingRollbackUserMsgId = null;
let pendingRollbackUserMsgIndex = null;
let loadedRouteKey = '';
let initSeq = 0;
let scrollFrame = null;
let forceScrollPending = false;

const { toastVisible, toastMessage, showToast } = useToast();
const {
  tabKey,
  messages,
  currentSessionId,
  currentMode,
  isStreaming,
  streamingContent,
  streamingReasoning,
  isReasoningStreaming,
  streamingSources,
  agentSegments,
  pendingApproval,
  isThinking,
  sessionTitle,
  startNewConversation,
  attachRequest,
  sendChatMessage,
  handleStop,
  stopAllStreams,
  handleApproveTool,
  handleApproveAll,
  handleRejectTool
} = useChatStream({
  onHistoryRefresh: () => {
    if (!isShareMode.value) refreshHistorySessions();
  },
  t,
  tabKey: ownTabKey
});
const { handleAddToKnowledge } = useConversationSummary({ messages, showToast, t });

// 流式状态用稳定对象整体下传，本组件模板不再直接读取流式文本，避免每个 token 重渲染整页
const streamingState = {
  streaming: isStreaming,
  content: streamingContent,
  reasoning: streamingReasoning,
  reasoningStreaming: isReasoningStreaming,
  sources: streamingSources,
  segments: agentSegments,
  thinking: isThinking
};
const isConversationVisible = computed(() => {
  if (isShareMode.value) return true;
  return tabStore.activeTabId === tabKey && (route.name === 'friday-chat' || route.name === 'share');
});

const chatTitle = computed(() => {
  if (sessionTitle.value) return sessionTitle.value;
  const session = fridayStore.historySessions.find(item => item.id === currentSessionId.value);
  return session?.title || route.query.title || t('friday.defaultTitle');
});

function routeSessionKey() {
  return `${route.params.sessionId || ''}::${route.query.automationRun || ''}`;
}

function scrollToBottom(force = false) {
  forceScrollPending = forceScrollPending || force;
  if (scrollFrame !== null) return;
  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = null;
    const shouldScroll = forceScrollPending || isAtBottom.value;
    forceScrollPending = false;
    if (!shouldScroll) return;
    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      }
    });
  });
}

function checkScrollPosition() {
  const el = messagesContainer.value;
  if (!el) return;
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
  isAtBottom.value = distanceFromBottom < 80;
  showScrollDownBtn.value = !isAtBottom.value && messages.value.length > 0;
}

function scrollToBottomForce() {
  if (!messagesContainer.value) return;
  if (scrollFrame !== null) {
    window.cancelAnimationFrame(scrollFrame);
    scrollFrame = null;
  }
  forceScrollPending = false;
  messagesContainer.value.scrollTo({ top: messagesContainer.value.scrollHeight, behavior: 'smooth' });
  showScrollDownBtn.value = false;
  isAtBottom.value = true;
}

async function loadSessionHistory(sessionId) {
  try {
    const history = await electronService.invoke('get_session_messages', { sessionId });
    return (history || []).map(mapHistoryMessage);
  } catch (err) {
    console.error('Failed to load session history:', err);
    return [];
  }
}

async function loadShareData(sessionId) {
  try {
    const res = await fetch(`/api/share/${encodeURIComponent(sessionId)}`);
    const data = await res.json();
    if (data?.success && data.session) return data;
  } catch (err) {
    console.error('Failed to load share data:', err);
  }
  return null;
}

function isActiveConversationRoute() {
  return route.name === 'friday-chat' || route.name === 'share';
}

function syncSessionRoute() {
  const param = route.params.sessionId;
  if (
    currentSessionId.value &&
    !isNewSessionId(currentSessionId.value) &&
    isNewSessionId(param) &&
    route.name === 'friday-chat'
  ) {
    // Tab 级导航：激活 Tab 更新全局路由，后台 Tab 只更新自身路径，避免抢占其它 Tab
    navigate(fridayChatLocation(route, { sessionId: currentSessionId.value }, tabStore), { replace: true });
  }
}

async function initConversation() {
  if (!isActiveConversationRoute()) return;
  const seq = ++initSeq;
  const launch = isShareMode.value ? null : fridayStore.takePendingLaunch(ownTabKey);
  const key = routeSessionKey();
  if (loadedRouteKey === key && !launch) return;
  loadedRouteKey = key;

  const sessionParam = route.params.sessionId || '';
  const launchText = (launch?.userMessage || launch?.text || '').trim();

  if (launchText) {
    // 新对话使用独立状态，不打断其它会话仍在进行的输出
    startNewConversation();
    inputText.value = '';
    chatTime.value = formatClock();
    isAtBottom.value = true;
    showScrollDownBtn.value = false;
    if (launch.mode) {
      currentMode.value = launch.mode;
      fridayStore.setMode(launch.mode);
    }
    messages.value.push({ role: 'user', content: launch.userMessage || launch.text });
    await sendChatMessage(launch, { skipUserPush: true });
    if (seq !== initSeq) return;
    scrollToBottom(true);
    return;
  }

  // 选择目标会话：每个会话各自保存消息与流式状态，切换不会影响其它会话
  currentSessionId.value = isNewSessionId(sessionParam) ? '' : sessionParam;

  // 目标会话已有内容或仍在后台输出：直接展示，不重新加载也不终止
  if (messages.value.length || isStreaming.value) {
    scrollToBottom(true);
    return;
  }

  chatTime.value = formatClock();
  currentMode.value = fridayStore.mode || 'chat';
  isAtBottom.value = true;
  showScrollDownBtn.value = false;

  if (isShareMode.value) {
    if (sessionParam) {
      const data = await loadShareData(sessionParam);
      if (seq !== initSeq) return;
      if (data?.success && data.session) {
        sessionTitle.value = data.session.title || t('friday.defaultTitle');
        currentMode.value = data.session.mode || 'chat';
        messages.value = (data.messages || []).map(mapHistoryMessage);
      }
    }
    scrollToBottom(true);
    return;
  }

  refreshHistorySessions();

  if (!isNewSessionId(sessionParam)) {
    const queryTitle = route.query.title;
    if (queryTitle) sessionTitle.value = queryTitle;
    const loadedMessages = await loadSessionHistory(sessionParam);
    if (seq !== initSeq) return;
    messages.value = loadedMessages;
    try {
      const sessionInfo = await electronService.invoke('get_session', { sessionId: sessionParam });
      if (seq !== initSeq) return;
      if (sessionInfo) {
        if (sessionInfo.title) sessionTitle.value = sessionInfo.title;
        if (sessionInfo.mode) {
          currentMode.value = sessionInfo.mode;
          fridayStore.setMode(sessionInfo.mode);
        }
      }
    } catch {}
  }

  const automationRunId = route.query.automationRun;
  if (automationRunId) {
    currentMode.value = 'agent';
    const requestId = `automation_${automationRunId}`;
    const activeRun = await electronService.invoke('automation-get-active-run', { runId: automationRunId });
    if (seq !== initSeq) return;
    if (activeRun?.requestId === requestId) {
      attachRequest(requestId, {
        output: activeRun.output || '',
        segments: activeRun.segments || []
      });
    } else if (currentSessionId.value) {
      const loadedMessages = await loadSessionHistory(currentSessionId.value);
      if (seq !== initSeq) return;
      messages.value = loadedMessages;
    }
  }

  scrollToBottom(true);
}

async function handleComposerSend(payload) {
  if (isRollingBack.value) return;
  const sent = await sendChatMessage(payload);
  if (sent) {
    inputText.value = '';
    isAtBottom.value = true;
    showScrollDownBtn.value = false;
    scrollToBottom(true);
  }
}

function handleAction(action, index) {
  if (action === 'rollback') handleRollback(index);
  else if (action === 'add') saveMessageToNote(index);
  else if (action === 'copy') handleCopyMessage(index);
}

async function handleCopyMessage(index) {
  const content = getAssistantContent(messages.value[index]);
  if (!content.trim()) return;
  try {
    const clipboardItem = new ClipboardItem({
      'text/html': new Blob([renderMarkdown(content)], { type: 'text/html' }),
      'text/plain': new Blob([stripMarkdown(content)], { type: 'text/plain' })
    });
    await navigator.clipboard.write([clipboardItem]);
    showToast(t('friday.copySuccess'));
  } catch (err) {
    console.error('Failed to copy message:', err);
    showToast(t('friday.copyFailed'));
  }
}

async function saveMessageToNote(index) {
  const content = getAssistantContent(messages.value[index]);
  if (!content.trim()) {
    showToast(t('friday.messageEmpty'));
    return;
  }
  const dateStr = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '-');
  const title = `${chatTitle.value} ${dateStr}`;
  try {
    const htmlContent = renderMarkdown(content);
    const plainText = stripMarkdown(content);
    const note = await noteStore.importNote(null, null, title, htmlContent, plainText);
    showToast(note ? t('history.saveAsNoteSuccess') : t('history.saveAsNoteFailed'));
  } catch (err) {
    console.error('Failed to save message to note:', err);
    showToast(t('history.saveAsNoteFailed'));
  }
}

function handleRollback(aiMsgIndex) {
  if (isStreaming.value || isRollingBack.value) return;
  const userMsgIndex = findTurnStartUserIndex(messages.value, aiMsgIndex);
  if (userMsgIndex < 0) return;
  const userMsg = messages.value[userMsgIndex];
  if (!userMsg.id) return;
  pendingRollbackUserMsgId = userMsg.id;
  pendingRollbackUserMsgIndex = userMsgIndex;
  rollbackPreviewContent.value = userMsg.content;
  rollbackDialogVisible.value = true;
}

async function executeRollback() {
  rollbackDialogVisible.value = false;
  if (pendingRollbackUserMsgId === null || pendingRollbackUserMsgIndex === null || !currentSessionId.value) return;
  isRollingBack.value = true;
  try {
    await electronService.invoke('rollback_session', {
      sessionId: currentSessionId.value,
      messageId: pendingRollbackUserMsgId
    });
    const userMsgContent = messages.value[pendingRollbackUserMsgIndex].content;
    messages.value = messages.value.slice(0, pendingRollbackUserMsgIndex);
    inputText.value = userMsgContent;
    scrollToBottom();
  } catch (err) {
    console.error('Rollback failed:', err);
  } finally {
    isRollingBack.value = false;
    pendingRollbackUserMsgId = null;
    pendingRollbackUserMsgIndex = null;
  }
}

function handleTabCloseRequest(event) {
  const tabId = event.detail?.tabId;
  if (!tabKey || tabId !== tabKey || !fridayStore.isTabStreaming(tabKey)) return;
  if (!window.confirm(t('friday.closeStreamingConfirm'))) {
    event.preventDefault();
    return;
  }
  event.preventDefault();
  event.detail.promise = stopAllStreams();
}

watch(currentSessionId, () => {
  syncSessionRoute();
});

watch(() => routeSessionKey(), (next, prev) => {
  if (!isActiveConversationRoute() || next === prev) return;
  if (!isConversationVisible.value) return;
  const nextSessionId = String(next).split('::')[0];
  if (nextSessionId && nextSessionId === currentSessionId.value) return;
  // 会话历史切换不再被流式状态阻塞：initConversation 会先终止旧请求再加载新会话
  initConversation();
});

watch(isConversationVisible, (visible) => {
  if (!visible) return;
  syncSessionRoute();
  nextTick(() => scrollToBottom(true));
});

watch(
  [isStreaming, streamingContent, streamingReasoning, () => agentSegments.value.length, () => messages.value.length],
  () => { scrollToBottom(); }
);

onMounted(async () => {
  document.addEventListener('click', handleCodeCopyClick);
  window.addEventListener('friday-before-tab-close', handleTabCloseRequest);
  await initConversation();
  messagesContainer.value?.addEventListener('scroll', checkScrollPosition);
});

onActivated(() => {
  syncSessionRoute();
  // 待发送的新消息优先，即使当前会话仍在后台输出也必须先切到新会话
  if (fridayStore.pendingLaunches[ownTabKey] || fridayStore.pendingLaunches._default) {
    initConversation();
    scrollToBottom(true);
    return;
  }
  if (isStreaming.value) {
    scrollToBottom(true);
    return;
  }
  if (loadedRouteKey !== routeSessionKey()) {
    initConversation();
  }
  scrollToBottom(true);
});

onDeactivated(() => {
  rollbackDialogVisible.value = false;
});

onUnmounted(() => {
  if (scrollFrame !== null) window.cancelAnimationFrame(scrollFrame);
  document.removeEventListener('click', handleCodeCopyClick);
  window.removeEventListener('friday-before-tab-close', handleTabCloseRequest);
  messagesContainer.value?.removeEventListener('scroll', checkScrollPosition);
});
</script>

<style scoped>
.conversation-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: var(--bg-primary);
  overflow: hidden;
  position: relative;
}

.conversation-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 16px;
  flex-shrink: 0;
  position: relative;
  -webkit-app-region: drag;
  app-region: drag;
}

.conversation-header.is-history-collapsed {
  padding-left: 56px;
}

.conversation-header.is-history-collapsed::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 56px;
  height: 100%;
  -webkit-app-region: no-drag;
  app-region: no-drag;
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
  -webkit-app-region: no-drag;
  app-region: no-drag;
  position: relative;
}

.header-btn.knowledge-btn {
  position: absolute;
  top: 12px;
  right: 16px;
  /* 图标使用主文字色（黑色），避免跟随次要色显得发灰 */
  color: var(--text-primary);
}

/* Reserve the far-right slot for the history expander while the panel is collapsed. */
.conversation-header.is-history-collapsed .header-btn.knowledge-btn {
  right: 60px;
}

.header-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.header-btn .hover-tooltip {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 5px 10px;
  background: rgba(0, 0, 0, 0.8);
  color: #ffffff;
  font-size: 12px;
  border-radius: 6px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  z-index: 10;
}

.header-btn:hover .hover-tooltip {
  opacity: 1;
  visibility: visible;
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
}

.header-time {
  font-size: 12px;
  color: var(--text-tertiary);
}

.conversation-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px 0;
  /* The app-wide reset disables selection; conversation text must remain copyable. */
  -webkit-user-select: text;
  user-select: text;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.conversation-messages .messages-inner,
.conversation-messages .messages-inner :deep(*) {
  -webkit-user-select: text;
  user-select: text;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.conversation-messages::-webkit-scrollbar {
  width: 5px;
}

.conversation-messages::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 10px;
}

.messages-inner {
  width: calc(100% - 100px);
  max-width: 900px;
  margin: 0 auto;
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
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
  z-index: 10;
}

.scroll-down-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.scroll-btn-enter-active,
.scroll-btn-leave-active {
  transition: all 0.2s ease;
}

.scroll-btn-enter-from,
.scroll-btn-leave-to {
  opacity: 0;
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
  z-index: 9999;
  pointer-events: none;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.2s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
}
</style>
