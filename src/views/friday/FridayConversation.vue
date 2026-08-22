<template>
  <div class="conversation-container">
    <header class="conversation-header">
      <button v-if="!isShareMode && showBackBtn" class="header-btn back-btn" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5"></path>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
      </button>

      <div class="header-center">
        <span class="header-title">{{ chatTitle }}</span>
        <span class="header-time">{{ chatTime }}</span>
      </div>

      <button v-if="!isShareMode" class="header-btn knowledge-btn" @click="handleAddToKnowledge">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          <line x1="12" y1="6" x2="12" y2="13"></line>
          <line x1="9" y1="10" x2="15" y2="10"></line>
        </svg>
        <span class="btn-tooltip hover-tooltip">保存为笔记</span>
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
            <div v-if="!isShareMode" class="agent-footer">
              <div class="footer-left">
                <button class="action-icon-btn" @click="handleAction('add', index)">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="16"></line>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                  </svg>
                  <span class="tooltip">保存</span>
                </button>
                <button class="action-icon-btn" @click="handleAction('copy', index)">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  <span class="tooltip">复制</span>
                </button>
              </div>
              <div class="footer-right">
                <button class="action-icon-btn" @click="handleAction('rollback', index)">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 14 4 9 9 4"></polyline>
                    <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
                  </svg>
                  <span class="tooltip">回退</span>
                </button>
              </div>
            </div>
            <div class="message-divider"></div>
          </div>
          <!-- 普通模式：标准 AIMessage -->
          <AIMessage
            v-else
            :content="msg.content"
            :reasoning="msg.reasoning"
            :show-divider="true"
            :show-actions="!isShareMode"
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
              <!-- 思考中指示器：尚未收到内容 或 工具调用间等待 LLM 下一轮思考 -->
              <div v-if="isThinking" class="thinking-indicator">
                <span class="thinking-text">思考中</span>
                <span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
              </div>
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
      v-if="!isShareMode"
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
      @approve-all="handleApproveAll"
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
import { ref, computed, nextTick, watch, onMounted, onUnmounted, onDeactivated } from 'vue';
import { useRouter, useRoute, onBeforeRouteLeave } from 'vue-router';
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
// "全部批准"模式：本次 AI 执行内后续所有工具调用自动批准，新对话仍需审批
const autoApproveAll = ref(false);

// 总结功能临时事件监听器（用于 onUnmounted 清理）
let unlistenSummaryChunk = null;
let unlistenSummaryDone = null;
let unlistenSummaryError = null;

// 流式结束时重置"全部批准"标记（下一次对话仍需审批）
watch(isStreaming, (streaming) => {
  if (!streaming) autoApproveAll.value = false;
});

const rollbackDialogVisible = ref(false);
const rollbackPreviewContent = ref('');
let pendingRollbackUserMsgId = null;
let pendingRollbackUserMsgIndex = null;

function formatTime(date) {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

// Agent 模式文本段 Markdown 渲染（含代码块语言标签 + 复制按钮）
const agentMarkedRenderer = new marked.Renderer();
agentMarkedRenderer.code = function ({ text, lang }) {
  const language = lang || '';
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<div class="code-block-wrapper"><div class="code-block-header"><span class="code-block-lang">${language}</span><button class="code-copy-btn" data-code="${encodeURIComponent(text)}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button></div><pre><code class="language-${language}">${escapedText}</code></pre></div>`;
};
marked.setOptions({ breaks: true, gfm: true, renderer: agentMarkedRenderer });
function renderMarkdown(content) {
  return marked.parse(content);
}

const showBackBtn = computed(() => route.query.hideBack !== 'true');

// 分享模式：通过分享链接在浏览器中打开（复用对话界面，隐藏输入框与操作按钮）
// 触发条件：路由 meta.share 标记 或 运行在非 Electron 环境（浏览器）
const isShareMode = computed(() => route.meta?.share === true || !electronService.isElectron);
// Agent 模式"思考中"指示器：流式执行中且未在输出文本时显示
// 触发场景：1) 尚未收到任何段；2) 上一段是工具调用（工具结束后等待 LLM 下一轮思考）
const isThinking = computed(() => {
  if (!isStreaming.value || currentMode.value !== 'agent') return false;
  const segs = agentSegments.value;
  if (segs.length === 0) return true;
  const last = segs[segs.length - 1];
  // 最后一段是文本且正在流式输出 → 显示文本光标，不显示"思考中"
  if (last.type === 'text' && last.isStreaming) return false;
  // 最后一段是工具（running/pending_approval/success/rejected）→ LLM 正在思考下一步
  return true;
});

function goBack() {
  if (route.query.from === 'automation') {
    router.back();
    return;
  }
  router.push('/friday');
}

// keep-alive 组件在切换 Tab 时只会触发路由离开，不一定卸载组件。
// 由守卫统一确认并停止流式请求，后端收到 stop 后会把已收到的内容落库。
let leavingAfterStop = false;
onBeforeRouteLeave(async () => {
  if (!isStreaming.value || leavingAfterStop || isShareMode.value) return true;
  const shouldLeave = window.confirm('AI 正在回答，离开将中断对话。已生成的内容会被保存，确认离开吗？');
  if (!shouldLeave) return false;
  leavingAfterStop = true;
  try {
    await handleStop();
    // 给主进程一小段时间完成 CHAT_DONE 和数据库写入，再切换视图。
    await new Promise(resolve => setTimeout(resolve, 120));
  } finally {
    leavingAfterStop = false;
  }
  return true;
});

function handleTabCloseRequest(event) {
  const tabId = event.detail?.tabId;
  const currentTabId = route.query.__tab;
  if (!isStreaming.value || !currentTabId || tabId !== currentTabId) return;
  if (!window.confirm('AI 正在回答，关闭将中断对话。已生成的内容会被保存，确认关闭吗？')) {
    event.preventDefault();
    return;
  }
  event.preventDefault();
  leavingAfterStop = true;
  event.detail.promise = handleStop().finally(() => {
    leavingAfterStop = false;
  });
}

function handleAddToKnowledge() {
  if (isStreaming.value) return;
  if (!messages.value.length) {
    showSaveToast('暂无对话内容');
    return;
  }

  const model = loadModelConfig();
  if (!model) {
    showSaveToast('未配置大模型');
    return;
  }

  // 立即反馈：先显示提示，再异步处理
  showSaveToast('正在整理笔记，请稍后在笔记中查看');

  // 异步执行总结，不阻塞 UI
  setTimeout(() => {
    doSummarize(model);
  }, 50);
}

async function doSummarize(model) {
  const summaryRequestId = `summary_${Date.now()}`;
  let summaryContent = '';
  let summaryDone = false;

  // Build conversation transcript
  const transcript = messages.value
    .map(msg => {
      if (msg.role === 'user') {
        return `【用户】${msg.content}`;
      } else if (msg.role === 'assistant') {
        if (msg.content) {
          return `【周五】${msg.content}`;
        }
        if (msg.segments && msg.segments.length) {
          const textParts = msg.segments
            .filter(s => s.type === 'text' && s.content)
            .map(s => s.content);
          return textParts.length ? `【周五】${textParts.join('\n')}` : '';
        }
        return '';
      }
      return '';
    })
    .filter(Boolean)
    .join('\n\n');

  const prompt = `请将以下对话内容总结为一份结构化笔记，要求：
1. 第一行使用 # 标题格式，为这份笔记取一个简洁且有意义的标题，标签最后不要带笔记二字（不超过20字）
2. 主题概述（一句话概括）
3. 关键要点（3-5个要点）
4. 详细内容（按主题分类整理）
5. 结论与建议

对话内容：

${transcript}

请使用 Markdown 格式输出。`;

  unlistenSummaryChunk = electronService.listen('chat-chunk', (event) => {
    const data = event.payload;
    if (data.requestId !== summaryRequestId) return;
    summaryContent += data.content;
  });

  unlistenSummaryDone = electronService.listen('chat-done', async (event) => {
    const data = event.payload;
    if (data.requestId !== summaryRequestId) return;
    if (summaryDone) return;
    summaryDone = true;

    if (unlistenSummaryChunk) { unlistenSummaryChunk(); unlistenSummaryChunk = null; }
    if (unlistenSummaryDone) { unlistenSummaryDone(); unlistenSummaryDone = null; }
    if (unlistenSummaryError) { unlistenSummaryError(); unlistenSummaryError = null; }

    const finalContent = summaryContent || data.fullContent || '';

    if (!finalContent.trim()) {
      showSaveToast('总结内容为空，请重试');
      return;
    }

    try {
      // 从 LLM 响应中提取标题（第一行 H1）
      const lines = finalContent.split('\n');
      let title = '对话总结';
      for (const line of lines) {
        const match = line.match(/^#\s+(.+)/);
        if (match) {
          title = match[1].trim();
          break;
        }
      }
      // 如果没有 H1，取第一行非空内容作为标题
      if (title === '对话总结') {
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            title = trimmed.slice(0, 30);
            break;
          }
        }
      }

      const htmlContent = marked.parse(finalContent);
      const plainText = stripMarkdown(finalContent);
      const note = await noteStore.importNote(null, null, title, htmlContent, plainText);
      if (note) {
        showSaveToast('已保存为笔记');
      } else {
        showSaveToast('保存失败');
      }
    } catch (err) {
      console.error('Failed to save summary note:', err);
      showSaveToast('保存失败');
    }
  });

  unlistenSummaryError = electronService.listen('chat-error', (event) => {
    const data = event.payload;
    if (data.requestId !== summaryRequestId) return;
    if (summaryDone) return;
    summaryDone = true;

    if (unlistenSummaryChunk) { unlistenSummaryChunk(); unlistenSummaryChunk = null; }
    if (unlistenSummaryDone) { unlistenSummaryDone(); unlistenSummaryDone = null; }
    if (unlistenSummaryError) { unlistenSummaryError(); unlistenSummaryError = null; }

    console.error('Summary error:', data.error);
    showSaveToast('总结失败，请重试');
  });

  electronService
    .invoke('chat_without_memory', {
      requestId: summaryRequestId,
      model: model,
      message: prompt,
      enableThinking: false
    })
    .catch((err) => {
      console.error('Summary invoke error:', err);
      showSaveToast('总结失败，请重试');
      if (unlistenSummaryChunk) { unlistenSummaryChunk(); unlistenSummaryChunk = null; }
      if (unlistenSummaryDone) { unlistenSummaryDone(); unlistenSummaryDone = null; }
      if (unlistenSummaryError) { unlistenSummaryError(); unlistenSummaryError = null; }
    });
}

function handleAction(action, index) {
  if (action === 'rollback') {
    handleRollback(index);
  } else if (action === 'add') {
    saveMessageToNote(index);
  } else if (action === 'copy') {
    handleCopyMessage(index);
  }
}

async function handleCodeBlockCopy(event) {
  const btn = event.target.closest('.code-copy-btn');
  if (!btn) return;

  const code = decodeURIComponent(btn.dataset.code);
  try {
    await navigator.clipboard.writeText(code);
    btn.classList.add('copied');
    const originalSvg = btn.innerHTML;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = originalSvg;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy code:', err);
  }
}

function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```.*\n?/g, ''))
    .replace(/`[^`]+`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function handleCopyMessage(index) {
  const msg = messages.value[index];
  if (!msg || msg.role !== 'assistant') return;

  const content = msg.content || '';
  if (!content.trim()) return;

  try {
    const htmlContent = renderMarkdown(content);
    const textContent = stripMarkdown(content);

    const clipboardItem = new ClipboardItem({
      'text/html': new Blob([htmlContent], { type: 'text/html' }),
      'text/plain': new Blob([textContent], { type: 'text/plain' })
    });

    await navigator.clipboard.write([clipboardItem]);
    showSaveToast('已复制到剪贴板');
  } catch (err) {
    console.error('Failed to copy message:', err);
    showSaveToast('复制失败');
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
    if (!stored) return null;
    const models = JSON.parse(stored);
    const findById = (id) => id ? models.find(m => m.id === id) : null;
    // 优先 modelId，其次 localStorage 记录的 selectedId，最后回退到首个模型
    return findById(modelId) || findById(localStorage.getItem('happy-friday-selected-model')) || models[0] || null;
  } catch (e) {
    console.error('Failed to load model config:', e);
    return null;
  }
}

// 流式响应公共初始化：重置流式状态、生成新 requestId、滚动到底部
function startStreaming() {
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
}

async function sendChatMessage(text) {
  if (isStreaming.value || isRollingBack.value || !text.trim()) return;

  const mode = route.query.mode || 'chat';
  const modelId = route.query.modelId || '';
  const model = loadModelConfig(modelId);

  if (!model) {
    alert('未配置大模型，请先在设置中添加自己的模型');
    router.push('/settings/model');
    return;
  }

  // 知识库选择信息：交由后端 RAG Agent 通过 Function Calling 自主决定是否检索
  const kbName = route.query.kbName || '';
  const kbCategoryId = route.query.kbCategoryId || '';

  // 读取 @ 引用附件数据（由 FridayChat.vue 通过 sessionStorage 传递）
  // - userMessage: 简洁引用格式（用户气泡展示 + 数据库存储）
  // - attachments: 附件元数据（供后端构造 LLM 消息）
  let userMessage = text;
  let attachments = [];
  if (route.query.hasAtt === 'true') {
    try {
      const attDataRaw = sessionStorage.getItem('friday-att-data') || '';
      sessionStorage.removeItem('friday-att-data');
      if (attDataRaw) {
        const attData = JSON.parse(attDataRaw);
        if (attData.userMessage) {
          userMessage = attData.userMessage;
        }
        if (Array.isArray(attData.attachments)) {
          attachments = attData.attachments;
        }
      }
    } catch (e) {
      console.error('[Friday] Failed to parse attachment data:', e);
    }
  }

  // 推送用户气泡：简洁引用格式（与数据库存储一致）
  messages.value.push({
    role: 'user',
    content: userMessage
  });

  inputText.value = '';
  startStreaming();

  try {
    if (mode === 'agent') {
      // Agent 模式：调用 agent-invoke，后端走 Agent Loop（多工具 + HITL）
      // Agent 自主通过 retrieve_knowledge 工具检索，无需前端传 kbName
      // 附件由后端根据 attachments 元数据构造 LLM 提示（Agent 模式只列名称，由工具读取内容）
      await electronService.invoke('agent-invoke', {
        requestId: activeRequestId,
        sessionId: currentSessionId.value || '',
        model: model,
        message: userMessage,
        attachments,
        enableThinking: route.query.thinkMode === 'deep'
      });
    } else if (mode === 'chat') {
      await electronService.invoke('chat_with_memory', {
        requestId: activeRequestId,
        sessionId: currentSessionId.value || '',
        model: model,
        message: userMessage,
        attachments,
        enableThinking: route.query.thinkMode === 'deep',
        kbName,
        kbCategoryId
      });
    } else {
      await electronService.invoke('chat_without_memory', {
        requestId: activeRequestId,
        model: model,
        message: userMessage,
        attachments,
        enableThinking: route.query.thinkMode === 'deep',
        kbName,
        kbCategoryId
      });
    }
  } catch (err) {
    console.error('Chat invoke error:', err);
    isStreaming.value = false;
    const errorContent = `请求失败：${err?.message || '无法连接大模型，请稍后重试。'}`;
    if (streamingContent.value || streamingReasoning.value) {
      streamingContent.value = `${streamingContent.value}\n\n${errorContent}`.trim();
    } else {
      messages.value.push({ role: 'assistant', content: errorContent });
    }
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

// 分享模式：通过 HTTP 接口加载会话与消息（浏览器环境下无 IPC，走 fetch）
async function loadShareData(sessionId) {
  try {
    const res = await fetch(`/api/share/${encodeURIComponent(sessionId)}`);
    const data = await res.json();
    if (data && data.success && data.session) {
      chatTitle.value = data.session.title || '与 Friday 的对话';
      currentMode.value = data.session.mode || 'chat';
      messages.value = (data.messages || []).map(m => {
        const msg = { role: m.role, content: m.content, id: m.id };
        if (m.metadata && m.metadata.segments && Array.isArray(m.metadata.segments)) {
          msg.segments = m.metadata.segments;
        }
        return msg;
      });
    }
  } catch (err) {
    console.error('Failed to load share data:', err);
  }
}

async function triggerAiResponse() {
  if (isStreaming.value || isRollingBack.value) return;

  const mode = route.query.mode || 'chat';
  const modelId = route.query.modelId || '';
  const model = loadModelConfig(modelId);

  if (!model) return;

  startStreaming();

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
    } else {
      // memoryless 模式：重开会话时按无记忆方式重新生成回复
      await electronService.invoke('chat_without_memory', {
        requestId: activeRequestId,
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
    messages.value.push({ role: 'assistant', content: `请求失败：${err?.message || '无法连接大模型，请稍后重试。'}` });
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

  // 分享模式：仅加载并展示对话内容，不触发 AI 响应、不走 IPC
  if (isShareMode.value) {
    if (currentSessionId.value) {
      await loadShareData(currentSessionId.value);
    }
    nextTick(() => scrollToBottom(true));
    return;
  }

  if (currentSessionId.value) {
    const queryTitle = route.query.title;
    if (queryTitle) {
      chatTitle.value = queryTitle;
    }
    await loadSessionHistory(currentSessionId.value);
    try {
      const sessionInfo = await electronService.invoke('get_session', { sessionId: currentSessionId.value });
      if (sessionInfo) {
        chatTitle.value = sessionInfo.title;
        // 从后端恢复 mode，确保历史记录打开 Agent 会话时使用正确模式
        if (sessionInfo.mode) {
          currentMode.value = sessionInfo.mode;
        }
      }
    } catch {}
  }

  const automationRunId = route.query.automationRun;
  if (automationRunId) {
    activeRequestId = `automation_${automationRunId}`;
    const activeRun = await electronService.invoke('automation-get-active-run', { runId: automationRunId });
    if (activeRun?.requestId === activeRequestId) {
      isStreaming.value = true;
      streamingContent.value = activeRun.output || '';
      agentSegments.value = (activeRun.segments || []).map(segment => ({
        ...segment,
        id: segment.id || segment.toolCallId || `automation-segment-${Math.random().toString(36).slice(2, 8)}`,
        isStreaming: segment.type === 'text'
      }));
    } else if (currentSessionId.value) {
      // The run may finish between loading history and asking for its live state.
      await loadSessionHistory(currentSessionId.value);
    }
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
  document.addEventListener('click', handleCodeBlockCopy);
  window.addEventListener('friday-before-tab-close', handleTabCloseRequest);

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
    if (isDoneReceived) return;
    isDoneReceived = true;
    isStreaming.value = false;
    const errorContent = `请求失败：${data.error || '大模型暂时不可用，请稍后重试。'}`;
    // 错误也作为助手消息展示，避免 404、超时、限速等异常表现为空白。
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
    const segs = agentSegments.value;
    // 标记前一个 text 段为非流式（AI 已切换到工具调用）
    const last = segs.length > 0 ? segs[segs.length - 1] : null;
    if (last && last.type === 'text') {
      last.isStreaming = false;
    }
    // 审批工具：on_tool_start 在 interrupt 之后才触发（用户批准后工具才实际执行）
    // 此时 agentSegments 已有 pending_approval 段（由 agent-tool-approval 事件推送）
    // 复用而非新建，避免出现两个重复段
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

  // 工具调用结果：更新工具段状态
  unlistenAgentToolResult = electronService.listen('agent-tool-result', (event) => {
    const data = event.payload;
    if (data.requestId !== activeRequestId) return;
    const seg = agentSegments.value.find((s) => s.type === 'tool' && s.toolCallId === data.toolCallId);
    if (seg) {
      // execute_command 等非 interruptOn 工具在 handler 内部触发审批，
      // 用户拒绝后 on_tool_end 仍会触发，此时不应覆盖 rejected 状态
      if (seg.status !== 'rejected') {
        seg.status = data.status || 'success';
        seg.output = data.output || '';
      }
    }
    scrollToBottom();
  });

  // 触发人机交互审批：弹出审批对话框
  // 关键：同时往 agentSegments 推送一个 pending_approval 段
  // 否则用户拒绝时 handleRejectTool 找不到段更新，时间线上看不到被拒绝的工具调用
  unlistenAgentApproval = electronService.listen('agent-tool-approval', (event) => {
    const data = event.payload;
    if (data.requestId !== activeRequestId) return;

    // 若用户已点击"全部批准"，自动批准后续所有工具调用，不弹窗
    if (autoApproveAll.value) {
      electronService.invoke('agent-tool-approval-resume', {
        requestId: data.requestId,
        decision: { type: 'approve' }
      });
      return;
    }

    // execute_command 等非 interruptOn 工具：agent-tool-call 已先推送 running 段
    // 这里复用已有段，更新为 pending_approval，避免时间线出现重复工具段
    const existingSeg = agentSegments.value.find(s =>
      s.type === 'tool' &&
      s.toolName === data.toolName &&
      s.status === 'running'
    );

    if (existingSeg) {
      // 复用已有段：更新为待审批状态，保留原 toolCallId 以匹配后续 agent-tool-result
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
      // interruptOn 工具（如 write_agent_file/python_repl）：on_tool_start 尚未触发，
      // 这里新建 pending_approval 段（on_tool_start 后会复用）
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

  await initConversation();

  if (messagesContainer.value) {
    messagesContainer.value.addEventListener('scroll', checkScrollPosition);
  }
});

onUnmounted(() => {
  document.removeEventListener('click', handleCodeBlockCopy);
  window.removeEventListener('friday-before-tab-close', handleTabCloseRequest);

  // 清理总结功能临时事件监听器
  if (unlistenSummaryChunk) { unlistenSummaryChunk(); unlistenSummaryChunk = null; }
  if (unlistenSummaryDone) { unlistenSummaryDone(); unlistenSummaryDone = null; }
  if (unlistenSummaryError) { unlistenSummaryError(); unlistenSummaryError = null; }

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

// 用户点击"全部批准"：批准当前工具 + 后续本次执行的所有工具调用自动批准
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
    console.error('[Agent] 审批回传失败:', err);
  }
}

// 用户拒绝工具调用
async function handleRejectTool(decision) {
  if (!pendingApproval.value) return;
  const { requestId, toolCallId } = pendingApproval.value;
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
  overflow: visible;
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
  position: relative;
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
  pointer-events: none;
  z-index: 10;
}

.header-btn .btn-tooltip::after {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-bottom-color: rgba(0, 0, 0, 0.8);
}

.header-btn .hover-tooltip {
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s ease;
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

/* Agent "思考中"指示器：流式执行但未在输出文本时显示 */
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

.thinking-dots span:nth-child(1) {
  animation-delay: 0s;
}

.thinking-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.thinking-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes thinking-dot {
  0%, 60%, 100% { opacity: 0; }
  30% { opacity: 1; }
}

/* ========== Agent 模式：操作按钮 ========== */
.agent-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2px;
  padding-left: 44px; /* 与时间线内容对齐 */
}

.agent-footer .footer-left,
.agent-footer .footer-right {
  display: flex;
  align-items: center;
  gap: 2px;
}

.agent-footer .action-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.15s ease;
  position: relative;
}

.agent-footer .action-icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.agent-footer .action-icon-btn.copied {
  color: #10b981;
}

.agent-footer .action-icon-btn.copied:hover {
  background: rgba(16, 185, 129, 0.1);
}

.agent-footer .tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
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
  transition: all 0.2s ease;
  pointer-events: none;
  z-index: 10;
}

.agent-footer .tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.8);
}

.agent-footer .action-icon-btn:hover .tooltip {
  opacity: 1;
  visibility: visible;
}

/* ========== Agent 模式：代码块样式 ========== */
.agent-text-body .markdown-body :deep(.code-block-wrapper) {
  margin: 10px 0;
  border-radius: 10px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.04);
}

[data-theme='dark'] .agent-text-body .markdown-body :deep(.code-block-wrapper) {
  background: rgba(255, 255, 255, 0.06);
}

.agent-text-body .markdown-body :deep(.code-block-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
}

.agent-text-body .markdown-body :deep(.code-block-lang) {
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: 'SF Mono', 'Fira Code', monospace;
  text-transform: lowercase;
}

.agent-text-body .markdown-body :deep(.code-copy-btn) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s ease;
  padding: 0;
}

.agent-text-body .markdown-body :deep(.code-copy-btn:hover) {
  background: rgba(0, 0, 0, 0.06);
  color: var(--text-secondary);
}

[data-theme='dark'] .agent-text-body .markdown-body :deep(.code-copy-btn:hover) {
  background: rgba(255, 255, 255, 0.1);
}

.agent-text-body .markdown-body :deep(.code-copy-btn.copied) {
  color: #10b981;
}

.agent-text-body .markdown-body :deep(.code-block-wrapper pre) {
  margin: 0;
  padding: 14px;
  background: transparent;
  border-radius: 0;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
}

[data-theme='dark'] .agent-text-body .markdown-body :deep(.code-block-wrapper pre) {
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}

.agent-text-body .markdown-body :deep(.code-block-wrapper pre::-webkit-scrollbar) {
  height: 4px;
}

.agent-text-body .markdown-body :deep(.code-block-wrapper pre::-webkit-scrollbar-track) {
  background: transparent;
}

.agent-text-body .markdown-body :deep(.code-block-wrapper pre::-webkit-scrollbar-thumb) {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 10px;
}

[data-theme='dark'] .agent-text-body .markdown-body :deep(.code-block-wrapper pre::-webkit-scrollbar-thumb) {
  background: rgba(255, 255, 255, 0.15);
}

.agent-text-body .markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 12px 0;
}

.agent-text-body .markdown-body :deep(a) {
  color: #10b981;
  text-decoration: none;
}

.agent-text-body .markdown-body :deep(a:hover) {
  text-decoration: underline;
}
</style>
