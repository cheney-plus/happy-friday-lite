import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { electronService } from '@/services/electron';
import { useFridayStore, useTabStore } from '@/store';
import { getFridayTabId, isNewSessionId } from '@/utils/fridayNavigation';
import { loadModelConfig } from '@/views/friday/composables/useModelCatalog';

export function useChatStream({ messages, currentSessionId, currentMode, onHistoryRefresh, t }) {
  const route = useRoute();
  const router = useRouter();
  const fridayStore = useFridayStore();
  const tabStore = useTabStore();

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

  const isThinking = computed(() => {
    if (!isStreaming.value || currentMode.value !== 'agent') return false;
    const segs = agentSegments.value;
    if (segs.length === 0) return true;
    const last = segs[segs.length - 1];
    if (last.type === 'text' && last.isStreaming) return false;
    return true;
  });

  watch(isStreaming, (streaming) => {
    fridayStore.setTabStreaming(getFridayTabId(route, tabStore), streaming);
    if (!streaming) autoApproveAll.value = false;
  });

  function resetStreamState() {
    isStreaming.value = false;
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
    isStreaming.value = true;
    streamingContent.value = '';
    streamingReasoning.value = '';
    agentSegments.value = [];
    pendingApproval.value = null;
    activeRequestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    isDoneReceived = false;
  }

  function attachRequest(requestId, { output = '', segments = [] } = {}) {
    activeRequestId = requestId;
    isDoneReceived = false;
    isStreaming.value = true;
    streamingContent.value = output || '';
    agentSegments.value = segments.map(segment => ({
      ...segment,
      id: segment.id || segment.toolCallId || `segment-${Math.random().toString(36).slice(2, 8)}`,
      isStreaming: segment.type === 'text'
    }));
  }

  function pushErrorMessage(errorContent) {
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
    isStreaming.value = false;
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

  async function sendChatMessage(payload) {
    const data = toIpcPayload(payload) || {};
    const text = (data.userMessage || data.text || '').trim();
    if (isStreaming.value || !text) return false;

    const mode = data.mode || currentMode.value || fridayStore.mode || 'chat';
    const modelId = data.modelId || fridayStore.modelId;
    const model = loadModelConfig(modelId);
    if (!model) {
      window.alert(t('friday.modelRequired'));
      router.push('/settings/model');
      return false;
    }

    currentMode.value = mode;
    fridayStore.setMode(mode);
    if (data.thinkMode) fridayStore.setThinkMode(data.thinkMode);
    if (modelId) fridayStore.setModelId(modelId);

    const userMessage = data.userMessage || data.text;
    messages.value.push({ role: 'user', content: userMessage });
    startStreaming();

    try {
      await invokeChat({
        mode,
        model,
        userMessage,
        attachments: data.attachments || [],
        thinkMode: data.thinkMode || fridayStore.thinkMode,
        kbName: data.kbName || '',
        kbCategoryId: data.kbCategoryId || ''
      });
    } catch (err) {
      console.error('Chat invoke error:', err);
      pushErrorMessage(`${t('friday.requestFailed')}${err?.message || t('friday.retryLater')}`);
      return false;
    }
    return true;
  }

  async function handleStop() {
    if (!isStreaming.value || !activeRequestId) return;
    try {
      const mode = currentMode.value || route.query.mode || 'chat';
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
      seg.output = decision.reason || t('friday.userRejected');
    }
    pendingApproval.value = null;
    try {
      await electronService.invoke('agent-tool-approval-resume', {
        requestId,
        decision: { type: 'reject', reason: decision.reason || t('friday.userRejected') }
      });
    } catch (err) {
      console.error('[Agent] approval resume failed:', err);
    }
  }

  function bindListeners() {
    unlistenChunk = electronService.listen('chat-chunk', (event) => {
      const data = event.payload;
      if (data.requestId !== activeRequestId) return;
      streamingContent.value += data.content;
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
    });

    unlistenReasoning = electronService.listen('chat-reasoning-chunk', (event) => {
      const data = event.payload;
      if (data.requestId !== activeRequestId) return;
      streamingReasoning.value += data.content;
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

      onHistoryRefresh?.();
      streamingContent.value = '';
      streamingReasoning.value = '';
      agentSegments.value = [];
    });

    unlistenError = electronService.listen('chat-error', (event) => {
      const data = event.payload;
      if (data.requestId !== activeRequestId) return;
      if (isDoneReceived) return;
      isDoneReceived = true;
      pushErrorMessage(`${t('friday.requestFailed')}${data.error || t('friday.modelUnavailable')}`);
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
      const seg = agentSegments.value.find(s => s.type === 'tool' && s.toolCallId === data.toolCallId);
      if (seg && seg.status !== 'rejected') {
        seg.status = data.status || 'success';
        seg.output = data.output || '';
      }
    });

    unlistenAgentApproval = electronService.listen('agent-tool-approval', (event) => {
      const data = event.payload;
      if (data.requestId !== activeRequestId) return;
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
        existingSeg.arguments = data.arguments;
        pendingApproval.value = {
          requestId: data.requestId,
          toolName: data.toolName,
          toolCallId: existingSeg.toolCallId,
          arguments: data.arguments
        };
        return;
      }

      pendingApproval.value = {
        requestId: data.requestId,
        toolName: data.toolName,
        toolCallId: data.toolCallId,
        arguments: data.arguments
      };
      const segs = agentSegments.value;
      const last = segs.length > 0 ? segs[segs.length - 1] : null;
      if (last && last.type === 'text') last.isStreaming = false;
      segs.push({
        type: 'tool',
        id: data.toolCallId,
        toolCallId: data.toolCallId,
        toolName: data.toolName,
        arguments: data.arguments,
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
    fridayStore.setTabStreaming(getFridayTabId(route, tabStore), false);
  }

  onMounted(bindListeners);
  onUnmounted(unbindListeners);

  return {
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
    handleRejectTool
  };
}
