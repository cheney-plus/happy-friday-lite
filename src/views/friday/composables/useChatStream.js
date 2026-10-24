import { computed, nextTick, onUnmounted, reactive, shallowRef } from 'vue';
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

  // 每个会话拥有独立的流式状态：切换会话时旧会话仍在后台继续接收事件，
  // 新会话使用自己的状态，互不覆盖。
  const states = new Map();
  let newSeq = 0;
  let viewCount = 0;
  let disposed = false;

  function createState(mapKey, sessionId) {
    const state = reactive({
      key: mapKey,
      sessionId: sessionId || '',
      mode: fridayStore.mode || 'chat',
      messages: [],
      isStreaming: false,
      streamingContent: '',
      streamingReasoning: '',
      isReasoningStreaming: false,
      streamingSources: [],
      agentSegments: [],
      pendingApproval: null,
      autoApproveAll: false,
      sessionTitle: '',
      activeRequestId: '',
      isDoneReceived: false,
      pendingContent: '',
      pendingReasoning: '',
      chunkFrame: null
    });
    states.set(mapKey, state);
    return state;
  }

  const initialKey = `__new__${++newSeq}`;
  const activeState = shallowRef(createState(initialKey, ''));

  function selectConversation(sessionId) {
    const target = sessionId || '';
    if (activeState.value.sessionId === target) return activeState.value;
    let state = states.get(target);
    if (!state) state = createState(target, target);
    activeState.value = state;
    return state;
  }

  // 新建对话使用全新的状态；若当前就是空的新会话则复用，避免重复创建
  function startNewConversation() {
    const current = activeState.value;
    if (!current.sessionId && !current.isStreaming && current.messages.length === 0) {
      return current;
    }
    const state = createState(`__new__${++newSeq}`, '');
    activeState.value = state;
    return state;
  }

  // 新会话完成时由主进程返回真实 sessionId，把临时状态迁移到正式 id 下
  function migrateStateKey(state, sessionId) {
    if (!sessionId || state.sessionId === sessionId) return;
    const existing = states.get(sessionId);
    if (existing && existing !== state) {
      // 极端竞态：侧边栏已被点击并按真实 id 建了状态，此时以正在输出的状态为准
      if (existing.isStreaming) return;
      states.delete(existing.key);
      if (activeState.value === existing) activeState.value = state;
    }
    states.delete(state.key);
    state.key = sessionId;
    state.sessionId = sessionId;
    states.set(sessionId, state);
  }

  function findStateByRequest(requestId) {
    if (!requestId) return null;
    for (const state of states.values()) {
      if (state.activeRequestId === requestId) return state;
    }
    return null;
  }

  function anyStreaming() {
    for (const state of states.values()) {
      if (state.isStreaming) return true;
    }
    return false;
  }

  function syncTabStreaming() {
    fridayStore.setTabStreaming(key === '_default' ? '' : key, anyStreaming());
  }

  function clearPendingChunks(state) {
    if (state.chunkFrame !== null) {
      window.cancelAnimationFrame(state.chunkFrame);
      state.chunkFrame = null;
    }
    state.pendingContent = '';
    state.pendingReasoning = '';
  }

  function flushPendingChunks(state) {
    state.chunkFrame = null;
    const content = state.pendingContent;
    const reasoning = state.pendingReasoning;
    state.pendingContent = '';
    state.pendingReasoning = '';

    if (content) {
      state.streamingContent += content;
      appendAgentText(state, content);
    }
    if (reasoning) state.streamingReasoning += reasoning;
  }

  function flushPendingChunksImmediately(state) {
    if (state.chunkFrame !== null) {
      window.cancelAnimationFrame(state.chunkFrame);
    }
    flushPendingChunks(state);
  }

  function queueChunk(state, content, reasoning = '') {
    state.pendingContent += content || '';
    state.pendingReasoning += reasoning || '';
    if (reasoning) state.isReasoningStreaming = true;
    if (content) state.isReasoningStreaming = false;
    if (state.chunkFrame === null) {
      state.chunkFrame = window.requestAnimationFrame(() => flushPendingChunks(state));
    }
  }

  function appendAgentText(state, content) {
    if (!content || state.mode !== 'agent') return;
    const segs = state.agentSegments;
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

  const messages = computed({
    get: () => activeState.value.messages,
    set: (value) => { activeState.value.messages = value; }
  });
  const currentMode = computed({
    get: () => activeState.value.mode,
    set: (value) => { activeState.value.mode = value; }
  });
  const sessionTitle = computed({
    get: () => activeState.value.sessionTitle,
    set: (value) => { activeState.value.sessionTitle = value; }
  });
  // 写入新会话 id 时表示切换到新对话；写入真实 id 时按会话选择已有状态
  const currentSessionId = computed({
    get: () => activeState.value.sessionId,
    set: (value) => {
      const target = value || '';
      if (isNewSessionId(target)) {
        const current = activeState.value;
        // 已经在新会话状态中：保留其内容与正在进行的输出
        if (!current.sessionId) return;
        // 无待发送消息时（如浏览器前进/后退）回到最近仍在输出的新会话，而不是新建
        let latest = null;
        for (const state of states.values()) {
          if (!state.sessionId && (state.isStreaming || state.messages.length > 0)) latest = state;
        }
        if (latest) {
          activeState.value = latest;
          return;
        }
        startNewConversation();
        return;
      }
      selectConversation(target);
    }
  });
  const isStreaming = computed(() => activeState.value.isStreaming);
  const streamingContent = computed(() => activeState.value.streamingContent);
  const streamingReasoning = computed(() => activeState.value.streamingReasoning);
  const isReasoningStreaming = computed(() => activeState.value.isReasoningStreaming);
  const streamingSources = computed(() => activeState.value.streamingSources);
  const agentSegments = computed(() => activeState.value.agentSegments);
  const pendingApproval = computed(() => activeState.value.pendingApproval);

  const isThinking = computed(() => {
    const state = activeState.value;
    if (!state.isStreaming || state.mode !== 'agent') return false;
    const segs = state.agentSegments;
    if (segs.length === 0) return true;
    const last = segs[segs.length - 1];
    if (last.type === 'text' && last.isStreaming) return false;
    return true;
  });

  function setStreaming(state, streaming) {
    state.isStreaming = streaming;
    if (!streaming) {
      state.autoApproveAll = false;
      state.isReasoningStreaming = false;
    }
    syncTabStreaming();
  }

  function resetStateStream(state) {
    clearPendingChunks(state);
    setStreaming(state, false);
    state.streamingContent = '';
    state.streamingReasoning = '';
    state.isReasoningStreaming = false;
    state.streamingSources = [];
    state.agentSegments = [];
    state.pendingApproval = null;
    state.autoApproveAll = false;
    state.sessionTitle = '';
    state.activeRequestId = '';
    state.isDoneReceived = false;
  }

  function resetStreamState() {
    resetStateStream(activeState.value);
  }

  function startStreaming() {
    const state = activeState.value;
    clearPendingChunks(state);
    setStreaming(state, true);
    state.streamingContent = '';
    state.streamingReasoning = '';
    state.isReasoningStreaming = false;
    state.streamingSources = [];
    state.agentSegments = [];
    state.pendingApproval = null;
    state.activeRequestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    state.isDoneReceived = false;
    return state;
  }

  function attachRequest(requestId, { output = '', segments = [] } = {}) {
    const state = activeState.value;
    clearPendingChunks(state);
    state.activeRequestId = requestId;
    state.isDoneReceived = false;
    setStreaming(state, true);
    state.isReasoningStreaming = false;
    state.streamingContent = output || '';
    state.streamingSources = [];
    state.agentSegments = segments.map(segment => ({
      ...segment,
      id: segment.id || segment.toolCallId || `segment-${Math.random().toString(36).slice(2, 8)}`,
      isStreaming: segment.type === 'text'
    }));
  }

  function pushErrorMessage(state, errorContent) {
    if (!state) return;
    flushPendingChunksImmediately(state);
    if (state.streamingContent || state.streamingReasoning) {
      state.messages.push({
        role: 'assistant',
        content: `${state.streamingContent}\n\n${errorContent}`.trim(),
        reasoning: state.streamingReasoning || undefined,
        sources: state.streamingSources.length ? [...state.streamingSources] : undefined
      });
    } else {
      state.messages.push({ role: 'assistant', content: errorContent });
    }
    state.streamingContent = '';
    state.streamingReasoning = '';
    state.streamingSources = [];
    state.agentSegments = [];
    setStreaming(state, false);
  }

  function toIpcPayload(value) {
    if (value == null) return value;
    // Pinia/Vue Proxy cannot be structured-cloned by Electron IPC.
    return JSON.parse(JSON.stringify(value));
  }

  function mergeSources(existing, incoming) {
    const merged = [];
    const seen = new Set();
    for (const source of [...(existing || []), ...(incoming || [])]) {
      if (!source) continue;
      const key = source.metadata?.noteId || source.filePath || source.source || source.snippet;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(source);
    }
    return merged;
  }

  async function invokeChat(state, { mode, model, userMessage, attachments, thinkMode, kbName, kbCategoryId }) {
    const enableThinking = thinkMode === 'deep';
    const args = toIpcPayload({
      requestId: state.activeRequestId,
      sessionId: state.sessionId || '',
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
    const state = activeState.value;
    const data = toIpcPayload(payload) || {};
    const text = (data.userMessage || data.text || '').trim();
    if (!text) return false;
    if (state.isStreaming && !skipStart) return false;

    const mode = data.mode || state.mode || fridayStore.mode || 'chat';
    const modelId = data.modelId || fridayStore.modelId;
    const model = loadModelConfig(modelId);
    if (!model) {
      window.alert(hooks.t('friday.modelRequired'));
      router.push('/settings/model');
      return false;
    }

    state.mode = mode;
    fridayStore.setMode(mode);
    if (data.thinkMode) fridayStore.setThinkMode(data.thinkMode);
    if (modelId) fridayStore.setModelId(modelId);

    const userMessage = data.userMessage || data.text;
    if (!skipUserPush) state.messages.push({ role: 'user', content: userMessage });
    if (!skipStart) startStreaming();

    await nextTick();

    invokeChat(state, {
      mode,
      model,
      userMessage,
      attachments: data.attachments || [],
      thinkMode: data.thinkMode || fridayStore.thinkMode,
      kbName: data.kbName || '',
      kbCategoryId: data.kbCategoryId || ''
    }).catch((err) => {
      console.error('Chat invoke error:', err);
      pushErrorMessage(state, `${hooks.t('friday.requestFailed')}${err?.message || hooks.t('friday.retryLater')}`);
    });
    return true;
  }

  async function stopState(state) {
    if (!state || !state.isStreaming || !state.activeRequestId) return;
    try {
      const mode = state.mode || 'chat';
      const channel = mode === 'agent' ? 'agent-stop' : 'stop_chat';
      await electronService.invoke(channel, { requestId: state.activeRequestId });
    } catch (err) {
      console.error('Stop chat error:', err);
    }
  }

  async function handleStop() {
    return stopState(activeState.value);
  }

  // 关闭 Tab 时终止该 Tab 下所有会话仍在进行的请求
  async function stopAllStreams() {
    await Promise.all([...states.values()].map(state => stopState(state)));
  }

  async function handleApproveTool() {
    const state = activeState.value;
    if (!state.pendingApproval) return;
    const { requestId } = state.pendingApproval;
    state.pendingApproval = null;
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
    const state = activeState.value;
    if (!state.pendingApproval) return;
    const { requestId } = state.pendingApproval;
    state.autoApproveAll = true;
    state.pendingApproval = null;
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
    const state = activeState.value;
    if (!state.pendingApproval) return;
    const { requestId, toolCallId } = state.pendingApproval;
    const seg = state.agentSegments.find(s => s.type === 'tool' && s.toolCallId === toolCallId);
    if (seg) {
      seg.status = 'rejected';
      seg.output = decision.reason || hooks.t('friday.userRejected');
    }
    state.pendingApproval = null;
    try {
      await electronService.invoke('agent-tool-approval-resume', {
        requestId,
        decision: { type: 'reject', reason: decision.reason || hooks.t('friday.userRejected') }
      });
    } catch (err) {
      console.error('[Agent] approval resume failed:', err);
    }
  }

  let unlistenChunk = null;
  let unlistenReasoning = null;
  let unlistenSessionCreated = null;
  let unlistenDone = null;
  let unlistenRagSources = null;
  let unlistenError = null;
  let unlistenTitle = null;
  let unlistenAgentToolCall = null;
  let unlistenAgentToolResult = null;
  let unlistenAgentApproval = null;

  function bindListeners() {
    unlistenChunk = electronService.listen('chat-chunk', (event) => {
      const data = event.payload;
      const state = findStateByRequest(data.requestId);
      if (!state) return;
      queueChunk(state, data.content);
    });

    unlistenReasoning = electronService.listen('chat-reasoning-chunk', (event) => {
      const data = event.payload;
      const state = findStateByRequest(data.requestId);
      if (!state) return;
      queueChunk(state, '', data.content);
    });

    // 新会话创建后立即绑定真实 sessionId，这样侧边栏中的该会话仍对应正在输出的状态
    unlistenSessionCreated = electronService.listen('chat-session-created', (event) => {
      const data = event.payload;
      const state = findStateByRequest(data.requestId);
      if (!state) return;
      migrateStateKey(state, data.sessionId);
    });

    unlistenRagSources = electronService.listen('chat-rag-sources', (event) => {
      const data = event.payload;
      const state = findStateByRequest(data.requestId);
      if (!state) return;
      state.streamingSources = mergeSources(state.streamingSources, Array.isArray(data.sources) ? data.sources : []);
    });

    unlistenDone = electronService.listen('chat-done', (event) => {
      const data = event.payload;
      const state = findStateByRequest(data.requestId);
      if (!state || state.isDoneReceived) return;
      state.isDoneReceived = true;
      flushPendingChunksImmediately(state);
      setStreaming(state, false);

      if (data.userMessageId) {
        for (let i = state.messages.length - 1; i >= 0; i--) {
          if (state.messages[i].role === 'user' && !state.messages[i].id) {
            state.messages[i].id = data.userMessageId;
            break;
          }
        }
      }

      const hasContent = state.streamingContent || data.fullContent;
      const hasReasoning = state.streamingReasoning || data.reasoningContent;
      const finalSources = mergeSources(state.streamingSources, Array.isArray(data.sources) ? data.sources : []);
      if (hasContent || hasReasoning) {
        const newMsg = {
          role: 'assistant',
          content: data.fullContent || state.streamingContent,
          reasoning: data.reasoningContent || state.streamingReasoning || undefined,
          sources: finalSources.length ? finalSources : undefined,
          id: data.messageId
        };
        if (state.mode === 'agent' && state.agentSegments.length > 0) {
          const segs = state.agentSegments;
          const lastSeg = segs.length > 0 ? segs[segs.length - 1] : null;
          if (lastSeg && lastSeg.type === 'text') lastSeg.isStreaming = false;
          newMsg.segments = JSON.parse(JSON.stringify(segs));
        }
        state.messages.push(newMsg);
      }

      if (data.sessionId) migrateStateKey(state, data.sessionId);

      hooks.onHistoryRefresh?.();
      state.streamingContent = '';
      state.streamingReasoning = '';
      state.streamingSources = [];
      state.agentSegments = [];
      maybeDispose();
    });

    unlistenError = electronService.listen('chat-error', (event) => {
      const data = event.payload;
      const state = findStateByRequest(data.requestId);
      if (!state || state.isDoneReceived) return;
      state.isDoneReceived = true;
      // 兜底：错误事件也带 sessionId，确保失败的新会话能按真实 id 对应到已有状态
      if (data.sessionId) migrateStateKey(state, data.sessionId);
      pushErrorMessage(state, `${hooks.t('friday.requestFailed')}${data.error || hooks.t('friday.modelUnavailable')}`);
      console.error('Stream error:', data.error);
      maybeDispose();
    });

    unlistenTitle = electronService.listen('session-title-updated', (event) => {
      const data = event.payload;
      let matched = false;
      for (const state of states.values()) {
        if (state.sessionId === data.sessionId) {
          state.sessionTitle = data.title;
          matched = true;
        }
      }
      if (matched) fridayStore.patchHistorySession(data.sessionId, { title: data.title });
    });

    unlistenAgentToolCall = electronService.listen('agent-tool-call', (event) => {
      const data = event.payload;
      const state = findStateByRequest(data.requestId);
      if (!state) return;
      state.isReasoningStreaming = false;
      flushPendingChunksImmediately(state);
      const segs = state.agentSegments;
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
      const state = findStateByRequest(data.requestId);
      if (!state) return;
      flushPendingChunksImmediately(state);
      const seg = state.agentSegments.find(s => s.type === 'tool' && s.toolCallId === data.toolCallId);
      if (seg && seg.status !== 'rejected') {
        seg.status = data.status || 'success';
        seg.output = data.output || '';
      }
    });

    unlistenAgentApproval = electronService.listen('agent-tool-approval', (event) => {
      const data = event.payload;
      const state = findStateByRequest(data.requestId);
      if (!state) return;
      state.isReasoningStreaming = false;
      flushPendingChunksImmediately(state);
      const approvalArguments = data.arguments && typeof data.arguments === 'object'
        ? data.arguments
        : {};
      if (state.autoApproveAll) {
        electronService.invoke('agent-tool-approval-resume', {
          requestId: data.requestId,
          decision: { type: 'approve' }
        });
        return;
      }

      const existingSeg = state.agentSegments.find(s =>
        s.type === 'tool' && s.toolName === data.toolName && s.status === 'running'
      );
      if (existingSeg) {
        existingSeg.status = 'pending_approval';
        existingSeg.requireApproval = true;
        existingSeg.arguments = approvalArguments;
        state.pendingApproval = {
          requestId: data.requestId,
          toolName: data.toolName,
          toolCallId: existingSeg.toolCallId,
          arguments: approvalArguments,
          riskAssessment: data.riskAssessment
        };
        return;
      }

      state.pendingApproval = {
        requestId: data.requestId,
        toolName: data.toolName,
        toolCallId: data.toolCallId,
        arguments: approvalArguments,
        riskAssessment: data.riskAssessment
      };
      const segs = state.agentSegments;
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
    if (unlistenSessionCreated) unlistenSessionCreated();
    if (unlistenDone) unlistenDone();
    if (unlistenRagSources) unlistenRagSources();
    if (unlistenError) unlistenError();
    if (unlistenTitle) unlistenTitle();
    if (unlistenAgentToolCall) unlistenAgentToolCall();
    if (unlistenAgentToolResult) unlistenAgentToolResult();
    if (unlistenAgentApproval) unlistenAgentApproval();
    unlistenChunk = null;
    unlistenReasoning = null;
    unlistenSessionCreated = null;
    unlistenDone = null;
    unlistenRagSources = null;
    unlistenError = null;
    unlistenTitle = null;
    unlistenAgentToolCall = null;
    unlistenAgentToolResult = null;
    unlistenAgentApproval = null;
    for (const state of states.values()) clearPendingChunks(state);
  }

  function maybeDispose() {
    if (disposed) return;
    if (viewCount > 0 || anyStreaming()) return;
    dispose();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    unbindListeners();
    for (const state of states.values()) setStreaming(state, false);
    states.clear();
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
    get hasActiveStreams() {
      return anyStreaming();
    },
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
    sessionTitle,
    isThinking,
    resetStreamState,
    startStreaming,
    startNewConversation,
    attachRequest,
    sendChatMessage,
    handleStop,
    stopAllStreams,
    handleApproveTool,
    handleApproveAll,
    handleRejectTool,
    dispose
  };
}

export function useChatStream({ onHistoryRefresh, t, tabKey } = {}) {
  const route = useRoute();
  const router = useRouter();
  const fridayStore = useFridayStore();
  const tabStore = useTabStore();
  // 分享页固定使用 share 运行时；普通对话使用所在 Tab 的稳定 id，保证多 Tab 流式互不干扰
  const key = route?.meta?.share ? getStreamKey(route, tabStore) : (tabKey || getStreamKey(route, tabStore));

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
    if (runtime.viewCount <= 0 && !runtime.hasActiveStreams) {
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
    isReasoningStreaming: runtime.isReasoningStreaming,
    agentSegments: runtime.agentSegments,
    pendingApproval: runtime.pendingApproval,
    sessionTitle: runtime.sessionTitle,
    isThinking: runtime.isThinking,
    resetStreamState: runtime.resetStreamState,
    startStreaming: runtime.startStreaming,
    startNewConversation: runtime.startNewConversation,
    attachRequest: runtime.attachRequest,
    sendChatMessage: runtime.sendChatMessage,
    handleStop: runtime.handleStop,
    stopAllStreams: runtime.stopAllStreams,
    handleApproveTool: runtime.handleApproveTool,
    handleApproveAll: runtime.handleApproveAll,
    handleRejectTool: runtime.handleRejectTool
  };
}
