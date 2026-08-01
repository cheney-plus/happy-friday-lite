<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="visible" class="kb-chat-dialog-overlay" @click.self="handleOverlayClick">
        <Transition name="dialog-scale">
          <div v-if="visible" class="kb-chat-dialog">
            <!-- 头部 -->
            <header class="dialog-header">
              <div class="header-left">
                <div class="header-icon icon-agent">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                </div>
                <div class="header-titles">
                  <span class="header-title">{{ contextLabel }}</span>
                  <span class="header-subtitle">
                    <span class="mode-badge">Agent 模式</span>
                    <span v-if="currentFolderName" class="folder-hint">· {{ currentFolderName }}</span>
                  </span>
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
                  <!-- Agent 模式：带时间线段的消息 -->
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
                  <!-- 兜底：无 segments 的助手消息 -->
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

                <!-- 流式 Agent 响应 -->
                <template v-if="isStreaming && agentSegments.length > 0">
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
                      <div v-if="isThinking" class="thinking-indicator">
                        <span class="thinking-text">思考中</span>
                        <span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
                      </div>
                    </div>
                  </div>
                </template>

                <!-- 流式但尚未收到任何段 -->
                <template v-else-if="isStreaming && agentSegments.length === 0 && !streamingContent">
                  <div class="agent-response-block">
                    <div class="agent-response-header">
                      <div class="avatar ai-avatar"><span class="avatar-icon">✦</span></div>
                      <span class="ai-name">周五</span>
                    </div>
                    <div class="agent-timeline">
                      <div class="thinking-indicator">
                        <span class="thinking-text">思考中</span>
                        <span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
                      </div>
                    </div>
                  </div>
                </template>

                <div v-if="messages.length === 0 && !isStreaming" class="empty-chat">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                  <p>在当前目录执行 Agent 工作流</p>
                </div>
              </div>
            </main>

            <!-- 输入区 -->
            <footer class="dialog-input">
              <!-- @ 附件标签 -->
              <div class="attachment-area" v-if="attachments.length > 0">
                <div v-for="(att, idx) in attachments" :key="att.id" class="attachment-tag" :class="att.isDirectory ? 'tag-folder' : 'tag-file'">
                  <span class="tag-icon-wrap">
                    <svg v-if="att.isDirectory" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                  </span>
                  <span class="tag-name">{{ att.name }}</span>
                  <span class="tag-type-badge">{{ att.isDirectory ? '文件夹' : '文件' }}</span>
                  <button class="tag-remove" @click="removeAttachment(idx)" title="移除">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>

              <div class="input-wrapper" :class="{ focused: inputFocused }">
                <textarea
                  v-model="inputText"
                  class="input-field"
                  placeholder="描述你需要 Agent 执行的操作..."
                  rows="1"
                  ref="textareaRef"
                  @input="autoResize"
                  @keydown.enter.exact="handleSendKeydown"
                  @focus="inputFocused = true"
                  @blur="inputFocused = false"
                ></textarea>
                <div class="input-actions">
                  <button class="action-btn icon-btn" @click="openFileSelect" title="指定文件或文件夹">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                    </svg>
                  </button>
                  <button
                    class="send-btn"
                    :class="{ active: inputText.trim() && !isStreaming }"
                    @click="handleSend"
                    :disabled="!isStreaming && !inputText.trim()"
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

    <!-- @ 文件选择对话框 -->
    <AgentFileSelectDialog
      :visible="showFileSelectDialog"
      :root-dir="agentRootDir"
      :initial-path="folderPath"
      @close="showFileSelectDialog = false"
      @select="handleFileSelect"
    />

    <!-- HITL 工具调用审批弹窗 -->
    <ToolApprovalDialog
      :visible="!!pendingApproval"
      :tool-name="pendingApproval?.toolName || ''"
      :arguments="pendingApproval?.arguments || {}"
      @approve="handleApproveTool"
      @approve-all="handleApproveAll"
      @reject="handleRejectTool"
    />
  </Teleport>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { marked } from 'marked';
import { electronService } from '@/services/electron';
import UserMessage from '@/components/chat/UserMessage.vue';
import AIMessage from '@/components/chat/AIMessage.vue';
import ToolCallSection from '@/components/chat/ToolCallSection.vue';
import ToolApprovalDialog from '@/components/chat/ToolApprovalDialog.vue';
import AgentFileSelectDialog from './AgentFileSelectDialog.vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  contextLabel: { type: String, default: '' },
  kbName: { type: String, default: '' },
  kbCategoryId: { type: String, default: 'agent' },
  folderPath: { type: String, default: '' },
  initialQuestion: { type: String, default: '' },
  initialAttachments: { type: Array, default: () => [] },
  model: { type: Object, default: null },
  thinkMode: { type: String, default: 'fast' }
});

const emit = defineEmits(['close']);

marked.setOptions({ breaks: true, gfm: true });
function renderMarkdown(content) {
  return marked.parse(content);
}

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

// Agent 状态
const agentSegments = ref([]);
const pendingApproval = ref(null);
const autoApproveAll = ref(false);

// @ 附件
let attachmentIdCounter = 0;
const attachments = ref([]);

// 文件选择对话框
const showFileSelectDialog = ref(false);

// Agent 根目录（用于计算虚拟路径）
const agentRootDir = ref('');

let activeRequestId = '';
let isDoneReceived = false;
let currentSessionId = '';
let unlistenChunk = null;
let unlistenReasoning = null;
let unlistenDone = null;
let unlistenError = null;
let unlistenAgentToolCall = null;
let unlistenAgentToolResult = null;
let unlistenAgentApproval = null;

const currentFolderName = computed(() => {
  if (!props.folderPath) return '';
  const parts = props.folderPath.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
});

// 流式结束时重置"全部批准"标记
watch(isStreaming, (streaming) => {
  if (!streaming) autoApproveAll.value = false;
});

// Agent "思考中"指示器
const isThinking = computed(() => {
  if (!isStreaming.value) return false;
  const segs = agentSegments.value;
  if (segs.length === 0) return true;
  const last = segs[segs.length - 1];
  if (last.type === 'text' && last.isStreaming) return false;
  return true;
});

watch(() => props.visible, async (val) => {
  if (val) {
    resetState();
    await ensureAgentRootDir();
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
        electronService.invoke('agent-stop', { requestId: activeRequestId });
      } catch (e) {
        console.error('Stop agent on close failed:', e);
      }
    }
  }
});

async function ensureAgentRootDir() {
  if (agentRootDir.value) return;
  try {
    const dataDir = await electronService.invoke('kb-get-data-dir');
    if (dataDir) {
      agentRootDir.value = dataDir.replace(/\/$/, '') + '/knowledge/agent';
    }
  } catch (e) {
    console.error('Failed to get data dir:', e);
  }
}

function computeVirtualPath(absPath) {
  if (!agentRootDir.value || !absPath) return absPath || '';
  if (absPath === agentRootDir.value) return '/';
  if (absPath.startsWith(agentRootDir.value)) {
    return absPath.slice(agentRootDir.value.length).replace(/^[/\\]+/, '') || '/';
  }
  return absPath;
}

function resetState() {
  messages.value = [];
  inputText.value = '';
  isStreaming.value = false;
  streamingContent.value = '';
  streamingReasoning.value = '';
  agentSegments.value = [];
  pendingApproval.value = null;
  autoApproveAll.value = false;
  // 从 KbQuestionBox 带入的 @ 附件初始化
  attachments.value = (props.initialAttachments || []).map(a => ({
    id: ++attachmentIdCounter,
    name: a.name,
    path: a.path,
    virtualPath: a.virtualPath,
    isDirectory: a.isDirectory
  }));
  activeRequestId = '';
  currentSessionId = '';
  isAtBottom.value = true;
  showScrollDownBtn.value = false;
}

function setupListeners() {
  cleanupListeners();

  unlistenChunk = electronService.listen('chat-chunk', (event) => {
    const data = event.payload;
    if (data.requestId !== activeRequestId) return;
    streamingContent.value += data.content;
    // 维护 Agent 时间线段
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

    if (hasContent || hasReasoning || agentSegments.value.length > 0) {
      const newMsg = {
        role: 'assistant',
        content: data.fullContent || streamingContent.value,
        reasoning: data.reasoningContent || streamingReasoning.value || undefined,
        id: data.messageId
      };
      // 将时间线段保存到消息对象
      if (agentSegments.value.length > 0) {
        const segs = agentSegments.value;
        const lastSeg = segs.length > 0 ? segs[segs.length - 1] : null;
        if (lastSeg && lastSeg.type === 'text') {
          lastSeg.isStreaming = false;
        }
        newMsg.segments = JSON.parse(JSON.stringify(segs));
      }
      messages.value.push(newMsg);
    } else {
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
    agentSegments.value = [];
    showScrollDownBtn.value = false;
    scrollToBottom(true);
    nextTick(() => {
      textareaRef.value?.focus();
    });
  });

  unlistenError = electronService.listen('chat-error', (event) => {
    const data = event.payload;
    if (data.requestId !== activeRequestId) return;
    isStreaming.value = false;
    const partialContent = streamingContent.value;
    streamingContent.value = '';
    streamingReasoning.value = '';
    agentSegments.value = [];
    showScrollDownBtn.value = false;
    console.error('Stream error:', data.error);
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

  // ========== Agent 专有事件 ==========
  unlistenAgentToolCall = electronService.listen('agent-tool-call', (event) => {
    const data = event.payload;
    if (data.requestId !== activeRequestId) return;
    const segs = agentSegments.value;
    const last = segs.length > 0 ? segs[segs.length - 1] : null;
    if (last && last.type === 'text') {
      last.isStreaming = false;
    }
    const existing = segs.find(s =>
      s.type === 'tool' &&
      s.toolName === data.toolName &&
      s.status === 'pending_approval'
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
    scrollToBottom();
  });

  unlistenAgentToolResult = electronService.listen('agent-tool-result', (event) => {
    const data = event.payload;
    if (data.requestId !== activeRequestId) return;
    const seg = agentSegments.value.find((s) => s.type === 'tool' && s.toolCallId === data.toolCallId);
    if (seg) {
      if (seg.status !== 'rejected') {
        seg.status = data.status || 'success';
        seg.output = data.output || '';
      }
    }
    scrollToBottom();
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
      s.type === 'tool' &&
      s.toolName === data.toolName &&
      s.status === 'running'
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
    } else {
      pendingApproval.value = {
        requestId: data.requestId,
        toolName: data.toolName,
        toolCallId: data.toolCallId,
        arguments: data.arguments
      };
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
        status: 'pending_approval',
        output: '',
        requireApproval: true
      });
    }
    scrollToBottom();
  });
}

function cleanupListeners() {
  if (unlistenChunk) { unlistenChunk(); unlistenChunk = null; }
  if (unlistenReasoning) { unlistenReasoning(); unlistenReasoning = null; }
  if (unlistenDone) { unlistenDone(); unlistenDone = null; }
  if (unlistenError) { unlistenError(); unlistenError = null; }
  if (unlistenAgentToolCall) { unlistenAgentToolCall(); unlistenAgentToolCall = null; }
  if (unlistenAgentToolResult) { unlistenAgentToolResult(); unlistenAgentToolResult = null; }
  if (unlistenAgentApproval) { unlistenAgentApproval(); unlistenAgentApproval = null; }
}

async function sendChatMessage(text) {
  if (isStreaming.value || !text || !text.trim()) return;
  if (!props.model) {
    console.error('No model configured');
    return;
  }

  const enableThinking = props.thinkMode === 'deep';

  // 构造用户消息（含 @ 引用信息）
  let userMessage = text;
  if (attachments.value.length > 0) {
    const refLines = [];
    for (const att of attachments.value) {
      const icon = att.isDirectory ? '📁 文件夹' : '📄 文件';
      refLines.push(`【${icon}】${att.name}（路径：${att.virtualPath}）`);
    }
    userMessage = `${text}\n\n---\n用户指定以下文件/文件夹（Agent 工作区路径）：\n${refLines.join('\n')}`;
  }

  messages.value.push({
    role: 'user',
    content: userMessage
  });

  inputText.value = '';
  isStreaming.value = true;
  streamingContent.value = '';
  streamingReasoning.value = '';
  agentSegments.value = [];
  showScrollDownBtn.value = false;
  isAtBottom.value = true;
  scrollToBottom(true);

  activeRequestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  isDoneReceived = false;

  const plainModel = JSON.parse(JSON.stringify(props.model));

  // 计算虚拟路径（相对于 Agent 根目录）
  const virtualFolderPath = computeVirtualPath(props.folderPath);

  try {
    await electronService.invoke('agent-invoke', {
      requestId: activeRequestId,
      sessionId: currentSessionId || '',
      model: plainModel,
      message: userMessage,
      enableThinking,
      attachments: [],
      folderPath: virtualFolderPath
    });
  } catch (err) {
    console.error('[KbAgentChat] Agent invoke error:', err);
    if (isStreaming.value && !isDoneReceived) {
      isStreaming.value = false;
      streamingContent.value = '';
      streamingReasoning.value = '';
      agentSegments.value = [];
      showScrollDownBtn.value = false;
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
    await electronService.invoke('agent-stop', { requestId: activeRequestId });
  } catch (err) {
    console.error('Stop agent error:', err);
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

// ========== @ 文件选择 ==========
function openFileSelect() {
  showFileSelectDialog.value = true;
}

function handleFileSelect(item) {
  attachments.value.push({
    id: ++attachmentIdCounter,
    name: item.name,
    path: item.path,
    virtualPath: item.virtualPath,
    isDirectory: item.isDirectory
  });
  showFileSelectDialog.value = false;
  nextTick(() => {
    textareaRef.value?.focus();
    autoResize();
  });
}

function removeAttachment(idx) {
  attachments.value.splice(idx, 1);
}

// ========== HITL 审批 ==========
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
    console.error('[KbAgentChat] 审批回传失败:', err);
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
    console.error('[KbAgentChat] 审批回传失败:', err);
  }
}

async function handleRejectTool(decision) {
  if (!pendingApproval.value) return;
  const { requestId, toolCallId } = pendingApproval.value;
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
    console.error('[KbAgentChat] 审批回传失败:', err);
  }
}

// ========== 工具函数 ==========
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
  width: 820px;
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

  &.icon-agent {
    background: rgba(16, 185, 129, 0.12);
    color: #10b981;
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
  max-width: 560px;
}

.header-subtitle {
  font-size: 12px;
  color: var(--text-tertiary, #999);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
}

.mode-badge {
  color: #059669;
  font-weight: 500;
}

.folder-hint {
  color: var(--text-tertiary, #999);
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
  max-width: 760px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
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

.attachment-area {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;

  .attachment-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 4px 3px 3px;
    background: var(--bg-secondary, #f7f7f7);
    border: 1px solid var(--border-color, #eee);
    border-radius: 8px;
    font-size: 12.5px;
    color: var(--text-primary);
    max-width: 260px;
    transition: all 0.15s ease;
    line-height: 1;

    &:hover {
      background: var(--bg-hover, #f0f0f0);
      .tag-remove { opacity: 1; }
    }

    &.tag-file { --tag-accent: #f59e0b; }
    &.tag-folder { --tag-accent: #1560F7; }

    .tag-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 6px;
      background: color-mix(in srgb, var(--tag-accent, #10b981) 12%, transparent);
      color: var(--tag-accent, #10b981);
      flex-shrink: 0;
    }

    .tag-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 140px;
      font-weight: 500;
    }

    .tag-type-badge {
      font-size: 10px;
      font-weight: 500;
      color: var(--tag-accent, #10b981);
      background: color-mix(in srgb, var(--tag-accent, #10b981) 10%, transparent);
      padding: 1px 5px;
      border-radius: 4px;
      flex-shrink: 0;
      line-height: 1.4;
    }

    .tag-remove {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border: none;
      background: transparent;
      color: var(--text-tertiary, #aaa);
      cursor: pointer;
      border-radius: 5px;
      opacity: 0;
      transition: all 0.12s;
      flex-shrink: 0;

      &:hover {
        background: rgba(0, 0, 0, 0.08);
        color: var(--text-primary);
      }
    }
  }
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

.input-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #666);
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.15s ease;
}

.action-btn.icon-btn:hover {
  background: var(--bg-hover, #f0f0f0);
  color: var(--text-primary, #1a1a1a);
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

/* ========== Agent 时间线 ========== */
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
  padding-left: 44px;
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

.agent-response-block .message-divider {
  width: 100%;
  height: 1px;
  background: var(--border-color);
  margin-top: 8px;
}

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

.thinking-indicator {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 4px 0;
  font-size: 14px;
  color: var(--text-tertiary, #999);
}

.thinking-text {
  font-weight: 500;
}

.thinking-dots span {
  display: inline-block;
  opacity: 0;
  animation: thinking-dot 1.4s infinite;
}

.thinking-dots span:nth-child(1) { animation-delay: 0s; }
.thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
.thinking-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes thinking-dot {
  0%, 60%, 100% { opacity: 0; }
  30% { opacity: 1; }
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
