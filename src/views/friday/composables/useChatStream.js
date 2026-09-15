import { computed, nextTick, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { electronService } from '@/services/electron';
import { useFridayStore, useTabStore } from '@/store';
import { getFridayTabId, isNewSessionId } from '@/utils/fridayNavigation';
import { loadModelConfig } from '@/views/friday/composables/useModelCatalog';

const streamRuntimes = new Map();

function getStreamKey(route, tabStore) {
  if (route?.meta?.share) return `share:${route.params.sessionId || ''}`;
  return getFridayTabId(route, tabStore) || '_default';
}

function createChatStreamRuntime({ key, router, fridayStore, t }) {
  const hooks = { onHistoryRefresh: null, t };

  const messages = ref([]);
  const currentSessionId = ref('');
  const currentMode = ref(fridayStore.mode || 'chat');
  const isStreaming = ref(false);
  const streamingContent = ref('');
  const streamingReasoning = ref('');
  const agentSegments = ref([]);
  const pendingApproval = ref(null);
  const autoApproveAll = ref(false);
  const sessionTitle = ref('');

  let unlistenChunk = null;
  let unlistenReasoning = null;
  let unlistenDone = null;
  let unlistenError = null;
  let unlistenTitle = null;
  let unlistenAgentToolCall = null;
  let unlistenAgentToolResult = null;
  let unlistenAgentApproval = null;
  let activeRequestId = '';
  let isDoneReceived = false;
  let pendingContent = '';
  let pendingReasoning = '';
  let chunkFlushFrame = null;
  let viewCount = 0;
  let disposed = false;

  const isThinking = computed(() => {
    if (!isStreaming.value || currentMode.value !== 'agent') return false;
    const segs = agentSegments.value;
    if (segs.length === 0) return true;
    const last = segs[segs.length - 1];
    if (last.type === 'text' && last.isStreaming) return false;
    return true;
  });

  function setStreaming(streaming) {
    isStreaming.value = streaming;
    fridayStore.setTabStreaming(key === '_default' ? '' : key, streaming);
    if (!streaming) autoApproveAll.value = false;
  }

  function resetStreamState() {
    clearPendingChunks();
    setStreaming(false);
    streamingContent.value = '';
    streamingReasoning.value = '';
    agentSegments.value = [];
    pendingApproval.value = null;
    autoApproveAll.value = false;
    sessionTitle.value = '';
    activeRequestId = '';
    isDoneReceived = false;
  }

  function startStreaming() {
    clearPendingChunks();
    setStreaming(true);
    streamingContent.value = '';
    streamingReasoning.value = '';
    agentSegments.value = [];
    pendingApproval.value = null;
    activeRequestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    isDoneReceived = false;
  }

  function attachRequest(requestId, { output = '', segments = [] } = {}) {
    clearPendingChunks();
    activeRequestId = requestId;
    isDoneReceived = false;
    setStreaming(true);
    streamingContent.value = output || '';
    agentSegments.value = segments.map(segment => ({
      ...segment,
      id: segment.id || segment.toolCallId || `segment-${Math.random().toString(36).slice(2, 8)}`,
      isStreaming: segment.type === 'text'
    }));
  }

  function pushErrorMessage(errorContent) {
    flushPendingChunksImmediately();
    if (streamingContent.value || streamingReasoning.value) {
      messages.value.push({
        role: 'assistant',
        content: `${streamingContent.value}\n\n${errorContent}`.trim(),
        reasoning: streamingReasoning.value || undefined
      });
    } else {
      messages.value.push({ role: 'assistant', content: errorContent });
    }
    streamingContent.value = '';
    streamingReasoning.value = '';
    agentSegments.value = [];
    setStreaming(false);
  }

  function clearPendingChunks() {
    if (chunkFlushFrame !== null) {
      window.cancelAnimationFrame(chunkFlushFrame);
      chunkFlushFrame = null;
    }
    pendingContent = '';
    pendingReasoning = '';
  }

  function appendAgentText(content) {
    if (!content || currentMode.value !== 'agent') return;
    const segs = agentSegments.value;
    const last = segs.length > 0 ? segs[segs.length - 1] : null;
    if (last && last.type === 'text') {
      last.content += content;
      return;
    }
    segs.push({
      type: 'text',
      id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      content,
      isStreaming: true
    });
  }

  function flushPendingChunks() {
    chunkFlushFrame = null;
    const content = pendingContent;
    const reasoning = pendingReasoning;
    pendingContent = '';
    pendingReasoning = '';

    if (content) {
      streamingContent.value += content;
      appendAgentText(content);
    }
    if (reasoning) streamingReasoning.value += reasoning;
  }

  function flushPendingChunksImmediately() {
    if (chunkFlushFrame !== null) {
      window.cancelAnimationFrame(chunkFlushFrame);
    }
    flushPendingChunks();
  }

  function queueChunk(content, reasoning = '') {
    pendingContent += content || '';
    pendingReasoning += reasoning || '';
    if (chunkFlushFrame === null) {
      chunkFlushFrame = window.requestAnimationFrame(flushPendingChunks);
    }
  }

  function toIpcPayload(value) {
    if (value == null) return value;
    // Pinia/Vue Proxy cannot be structured-cloned by Electron IPC.
    return JSON.parse(JSON.stringify(value));
  }

  async function invokeChat({ mode, model, userMessage, attachments, thinkMode, kbName, kbCategoryId }) {
    const enableThinking = thinkMode === 'deep';
    const sessionId = currentSessionId.value || '';
    const args = toIpcPayload({
      requestId: activeRequestId,
      sessionId,
      model,
      message: userMessage,
      attachments: attachments || [],
      enableThinking,
      kbName: kbName || '',
      kbCategoryId: kbCategoryId || ''
    });
    if (mode === 'agent') {
      return electronService.invoke('agent-invoke', args);
    }
    if (mode === 'chat') {
      return electronService.invoke('chat_with_memory', args);
    }
    return electronService.invoke('chat_without_memory', args);
  }

  async function sendChatMessage(payload, { skipUserPush = false, skipStart = false } = {}) {
    const data = toIpcPayload(payload) || {};
    const text = (data.userMessage || data.text || '').trim();
    if (!text) return false;
    if (isStreaming.value && !skipStart) return false;

    const mode = data.mode || currentMode.value || fridayStore.mode || 'chat';
    const modelId = data.modelId || fridayStore.modelId;
    const model = loadModelConfig(modelId);
    if (!model) {
      window.alert(hooks.t('friday.modelRequired'));
      router.push('/settings/model');
      return false;
    }

    currentMode.value = mode;
    fridayStore.setMode(mode);
    if (data.thinkMode) fridayStore.setThinkMode(data.thinkMode);
    if (modelId) fridayStore.setModelId(modelId);

    const userMessage = data.userMessage || data.text;
    if (!skipUserPush) messages.value.push({ role: 'user', content: userMessage });
    if (!skipStart) startStreaming();

    await nextTick();

    invokeChat({
      mode,
      model,
      userMessage,
      attachments: data.attachments || [],
      thinkMode: data.thinkMode || fridayStore.thinkMode,
      kbName: data.kbName || '',
      kbCategoryId: data.kbCategoryId || ''
    }).catch((err) => {
      console.error('Chat invoke error:', err);
      pushErrorMessage(`${hooks.t('friday.requestFailed')}${err?.message || hooks.t('friday.retryLater')}`);
    });
    return true;
  }

  async function handleStop() {
    if (!isStreaming.value || !activeRequestId) return;
    try {
      const mode = currentMode.value || 'chat';
      const channel = mode === 'agent' ? 'agent-stop' : 'stop_chat';
      await electronService.invoke(channel, { requestId: activeRequestId });
    } catch (err) {
      console.error('Stop chat error:', err);
    }
  }

  async function handleApproveTool() {
    if (!pendingApproval.value) return;
    const { requestId } = pendingApproval.value;
    pendingApproval.value = null;
    try {
      await electronService.invoke('agent-tool-approval-resume', {
        requestId,
        decision: { type: 'approve' }
      });
    } catch (err) {
      console.error('[Agent] approval resume failed:', err);
    }
  }

  async function handleApproveAll() {
    if (!pendingApproval.value) return;
    const { requestId } = pendingApproval.value;
    autoApproveAll.value = true;
    pendingApproval.value = null;
    try {
      await electronService.invoke('agent-tool-approval-resume', {
        requestId,
        decision: { type: 'approve' }
      });
    } catch (err) {
      console.error('[Agent] approval resume failed:', err);
    }
  }

  async function handleRejectTool(decision) {
    if (!pendingApproval.value) return;
    const { requestId, toolCallId } = pendingApproval.value;
    const seg = agentSegments.value.find(s => s.type === 'tool' && s.toolCallId === toolCallId);
    if (seg) {
      seg.status = 'rejected';
      seg.output = decision.reason || hooks.t('friday.userRejected');
    }
    pendingApproval.value = null;
    try {
      await electronService.invoke('agent-tool-approval-resume', {
        requestId,
        decision: { type: 'reject', reason: decision.reason || hooks.t('friday.userRejected') }
      });
    } catch (err) {
      console.error('[Agent] approval resume failed:', err);
    }
  }

  function bindListeners() {
    unlistenChunk = electronService.listen('chat-chunk', (event) => {
      const data = event.payload;
      if (data.requestId !== activeRequestId) return;
      queueChunk(data.content);
    });

    unlistenReasoning = electronService.listen('chat-reasoning-chunk', (event) => {
      const data = event.payload;
      if (data.requestId !== activeRequestId) return;
      queueChunk('', data.content);
    });

    unlistenDone = electronService.listen('chat-done', (event) => {
      const data = event.payload;
      if (data.requestId !== activeRequestId) return;
      if (isDoneReceived) return;
      isDoneReceived = true;
      flushPendingChunksImmediately();
      setStreaming(false);

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
        if (currentMode.value === 'agent' && agentSegments.value.length > 0) {
          const segs = agentSegments.value;
          const lastSeg = segs.length > 0 ? segs[segs.length - 1] : null;
          if (lastSeg && lastSeg.type === 'text') lastSeg.isStreaming = false;
          newMsg.segments = JSON.parse(JSON.stringify(segs));
        }
        messages.value.push(newMsg);
      }

      if (data.sessionId && isNewSessionId(currentSessionId.value)) {
        currentSessionId.value = data.sessionId;
      }

      hooks.onHistoryRefresh?.();
      streamingContent.value = '';
      streamingReasoning.value = '';
      agentSegments.value = [];
    });

    unlistenError = electronService.listen('chat-error', (event) => {
      const data = event.payload;
      if (data.requestId !== activeRequestId) return;
      if (isDoneReceived) return;
      isDoneReceived = true;
      pushErrorMessage(`${hooks.t('friday.requestFailed')}${data.error || hooks.t('friday.modelUnavailable')}`);
      console.error('Stream error:', data.error);
    });

    unlistenTitle = electronService.listen('session-title-updated', (event) => {
      const data = event.payload;
      if (data.sessionId === currentSessionId.value) {
        sessionTitle.value = data.title;
        fridayStore.patchHistorySession(data.sessionId, { title: data.title });
      }
    });

    unlistenAgentToolCall = electronService.listen('agent-tool-call', (event) => {
      const data = event.payload;
      if (data.requestId !== activeRequestId) return;
      flushPendingChunksImmediately();
      const segs = agentSegments.value;
      const last = segs.length > 0 ? segs[segs.length - 1] : null;
      if (last && last.type === 'text') last.isStreaming = false;
      const existing = segs.find(s =>
        s.type === 'tool' && s.toolName === data.toolName && s.status === 'pending_approval'
      );
      if (existing) {
        existing.toolCallId = data.toolCallId;
        existing.id = data.toolCallId;
        existing.arguments = data.arguments;
        existing.status = 'running';
        existing.requireApproval = !!data.requireApproval;
      } else {
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
      }
    });

    unlistenAgentToolResult = electronService.listen('agent-tool-result', (event) => {
      const data = event.payload;
      if (data.requestId !== activeRequestId) return;
      flushPendingChunksImmediately();
      const seg = agentSegments.value.find(s => s.type === 'tool' && s.toolCallId === data.toolCallId);
      if (seg && seg.status !== 'rejected') {
        seg.status = data.status || 'success';
        seg.output = data.output || '';
      }
    });

    unlistenAgentApproval = electronService.listen('agent-tool-approval', (event) => {
      const data = event.payload;
      if (data.requestId !== activeRequestId) return;
      flushPendingChunksImmediately();
      const approvalArguments = data.arguments && typeof data.arguments === 'object'
        ? data.arguments
        : {};
      if (autoApproveAll.value) {
        electronService.invoke('agent-tool-approval-resume', {
          requestId: data.requestId,
          decision: { type: 'approve' }
        });
        return;
      }

      const existingSeg = agentSegments.value.find(s =>
        s.type === 'tool' && s.toolName === data.toolName && s.status === 'running'
      );
      if (existingSeg) {
        existingSeg.status = 'pending_approval';
        existingSeg.requireApproval = true;
        existingSeg.arguments = approvalArguments;
        pendingApproval.value = {
          requestId: data.requestId,
          toolName: data.toolName,
          toolCallId: existingSeg.toolCallId,
          arguments: approvalArguments,
          riskAssessment: data.riskAssessment
        };
        return;
      }

      pendingApproval.value = {
        requestId: data.requestId,
        toolName: data.toolName,
        toolCallId: data.toolCallId,
        arguments: approvalArguments,
        riskAssessment: data.riskAssessment
      };
      const segs = agentSegments.value;
      const last = segs.length > 0 ? segs[segs.length - 1] : null;
      if (last && last.type === 'text') last.isStreaming = false;
      segs.push({
        type: 'tool',
        id: data.toolCallId,
        toolCallId: data.toolCallId,
        toolName: data.toolName,
        arguments: approvalArguments,
        status: 'pending_approval',
        output: '',
        requireApproval: true
      });
    });
  }

  function unbindListeners() {
    if (unlistenChunk) unlistenChunk();
    if (unlistenReasoning) unlistenReasoning();
    if (unlistenDone) unlistenDone();
    if (unlistenError) unlistenError();
    if (unlistenTitle) unlistenTitle();
    if (unlistenAgentToolCall) unlistenAgentToolCall();
    if (unlistenAgentToolResult) unlistenAgentToolResult();
    if (unlistenAgentApproval) unlistenAgentApproval();
    unlistenChunk = null;
    unlistenReasoning = null;
    unlistenDone = null;
    unlistenError = null;
    unlistenTitle = null;
    unlistenAgentToolCall = null;
    unlistenAgentToolResult = null;
    unlistenAgentApproval = null;
    clearPendingChunks();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    unbindListeners();
    setStreaming(false);
    streamRuntimes.delete(key);
  }

  bindListeners();

  return {
    key,
    hooks,
    get viewCount() {
      return viewCount;
    },
    set viewCount(value) {
      viewCount = value;
    },
    messages,
    currentSessionId,
    currentMode,
    isStreaming,
    streamingContent,
    streamingReasoning,
    agentSegments,
    pendingApproval,
    sessionTitle,
    isThinking,
    resetStreamState,
    startStreaming,
    attachRequest,
    sendChatMessage,
    handleStop,
    handleApproveTool,
    handleApproveAll,
    handleRejectTool,
    dispose
  };
}

export function useChatStream({ onHistoryRefresh, t }) {
  const route = useRoute();
  const router = useRouter();
  const fridayStore = useFridayStore();
  const tabStore = useTabStore();
  const key = getStreamKey(route, tabStore);

  let runtime = streamRuntimes.get(key);
  if (!runtime) {
    runtime = createChatStreamRuntime({ key, router, fridayStore, t });
    streamRuntimes.set(key, runtime);
  }

  runtime.hooks.onHistoryRefresh = onHistoryRefresh;
  runtime.hooks.t = t;
  runtime.viewCount += 1;

  onUnmounted(() => {
    runtime.viewCount -= 1;
    if (runtime.viewCount <= 0 && !runtime.isStreaming.value) {
      runtime.dispose();
    }
  });

  return {
    tabKey: runtime.key,
    messages: runtime.messages,
    currentSessionId: runtime.currentSessionId,
    currentMode: runtime.currentMode,
    isStreaming: runtime.isStreaming,
    streamingContent: runtime.streamingContent,
    streamingReasoning: runtime.streamingReasoning,
    agentSegments: runtime.agentSegments,
    pendingApproval: runtime.pendingApproval,
    sessionTitle: runtime.sessionTitle,
    isThinking: runtime.isThinking,
    resetStreamState: runtime.resetStreamState,
    startStreaming: runtime.startStreaming,
    attachRequest: runtime.attachRequest,
    sendChatMessage: runtime.sendChatMessage,
    handleStop: runtime.handleStop,
    handleApproveTool: runtime.handleApproveTool,
    handleApproveAll: runtime.handleApproveAll,
    handleRejectTool: runtime.handleRejectTool
  };
}
