<template>
  <BubbleMenu
    v-if="editor"
    :editor="editor"
    :tippy-options="tippyOptions"
    class="note-bubble-menu"
  >
    <div v-if="showAIOutput" class="ai-output-wrapper" :class="{ 'is-dark': isDark, 'position-top': outputPanelPosition === 'top', 'position-bottom': outputPanelPosition === 'bottom' }" :style="outputPanelStyle" @mousedown="handleWrapperMouseDown">
      <div class="ai-output-backdrop" @mousedown="handleBackdropMouseDown"></div>
      <div class="ai-output-panel" :class="{ 'is-dark': isDark }" @mousedown.stop.prevent>
      <div class="ai-output-header">
        <span class="ai-output-title">{{ getActionTitle() }}</span>
        <button class="ai-output-close" @click="closeAIOutput" title="关闭">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="ai-output-content">
        <div class="markdown-body" v-html="renderedOutput"></div>
        <span v-if="isStreaming" class="streaming-cursor"></span>

        <div v-if="!isStreaming && aiOutputContent" class="thinking-hint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <span>{{ getActionHint() }}</span>
        </div>

        <div v-if="!isStreaming && currentAction === 'polish' && aiOutputContent" class="polish-suggestions">
          <div class="suggestion-item">
            <strong>补足语法成分：</strong>补上介词「将」，符合现代汉语语法规范，语句更通顺。
          </div>
          <div class="suggestion-item">
            <strong>统一用词习惯：</strong>把「结束」替换为「完成」，更契合技术文档的专业表达习惯。
          </div>
        </div>
      </div>

      <div class="ai-output-footer">
        <div class="footer-left">
          <span class="ai-badge">
            内容由 AI 生成
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              <polyline points="9 12 11 14 15 10"></polyline>
            </svg>
          </span>
          <span class="char-count">已生成{{ getCharCount() }}字</span>
        </div>

        <div class="footer-right">
          <button class="footer-action-btn" @click="handleLike" title="点赞">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
            </svg>
          </button>
          <button class="footer-action-btn" @click="handleDislike" title="点踩">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path>
            </svg>
          </button>
          <button class="footer-action-btn more-btn" title="更多">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="19" cy="12" r="1"></circle>
              <circle cx="5" cy="12" r="1"></circle>
            </svg>
          </button>
        </div>
      </div>

      <div v-if="currentAction === 'interpret'" class="ai-output-actions single-action">
        <button class="action-btn primary" @click="handleReInterpret" :disabled="isStreaming || !aiOutputContent">
          重新解读
        </button>
      </div>

      <div v-else class="ai-output-actions multi-actions">
        <button class="action-btn secondary" @click="handleRewrite" :disabled="isStreaming">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          重写
        </button>
        <button class="action-btn danger" @click="handleDiscard" :disabled="isStreaming">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          弃用
        </button>
        <button class="action-btn primary" @click="handleReplace" :disabled="isStreaming || !aiOutputContent">
          替换
        </button>
        <button class="action-btn primary-outline" @click="handleInsert" :disabled="isStreaming || !aiOutputContent">
          插入
        </button>
      </div>
    </div>
    </div>

    <div v-else-if="showAIPanel" class="ai-input-wrapper" :class="{ 'is-dark': isDark }">
      <textarea
        ref="inputRef"
        v-model="inputText"
        class="ai-textarea"
        :placeholder="selectedText ? `基于选中文本：${selectedText.slice(0, 50)}${selectedText.length > 50 ? '...' : ''}` : '输入问题，或从下方场景提问'"
        rows="1"
        @input="autoResize"
        @keydown.enter.exact.prevent="handleSend"
      ></textarea>

      <div class="input-actions">
        <div class="action-left">
          <div class="command-dropdown">
            <button class="command-btn" @click.stop="toggleCommandMenu" :class="{ active: showCommandMenu }">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              <span>AI 指令</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            <Transition name="dropdown">
              <div v-if="showCommandMenu" class="command-menu" :class="{ 'menu-up': commandMenuDirection === 'up', 'menu-down': commandMenuDirection === 'down' }">
                <div class="command-item" @click="selectCommand('翻译')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m5 8 6 6"></path>
                    <path d="m4 14 6-6 2-3"></path>
                    <path d="M2 5h12"></path>
                    <path d="M7 2h1"></path>
                    <path d="m22 22-5-10-5 10"></path>
                    <path d="M14 18h6"></path>
                  </svg>
                  <span>翻译</span>
                </div>

                <div class="command-item" @click="selectCommand('总结')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                  </svg>
                  <span>总结</span>
                </div>

                <div class="command-item" @click="selectCommand('续写')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg>
                  <span>续写</span>
                </div>

                <div class="command-item" @click="selectCommand('语法修正')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="4 17 10 11 4 5"></polyline>
                    <line x1="12" y1="19" x2="20" y2="19"></line>
                  </svg>
                  <span>语法修正</span>
                </div>

                <div class="command-item" @click="selectCommand('生成任务计划')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  <span>生成任务计划</span>
                </div>

                <div class="command-item" @click="selectCommand('生成表格')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="3" y1="9" x2="21" y2="9"></line>
                    <line x1="3" y1="15" x2="21" y2="15"></line>
                    <line x1="9" y1="3" x2="9" y2="21"></line>
                    <line x1="15" y1="3" x2="15" y2="21"></line>
                  </svg>
                  <span>生成表格</span>
                </div>
              </div>
            </Transition>
          </div>
        </div>

        <div class="action-right">
          <Transition name="btn-switch" mode="out-in">
            <button
              key="send"
              class="send-btn"
              :class="{ active: inputText.trim() }"
              @click="handleSend"
              :disabled="!inputText.trim()"
              title="发送"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </Transition>
        </div>
      </div>
    </div>

    <div v-else class="bubble-menu-container">
      <button class="bubble-btn ai-write-btn" @click="openAIPanel" title="Friday 帮写">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
          <path d="M2 17l10 5 10-5"></path>
          <path d="M2 12l10 5 10-5"></path>
        </svg>
        <span>帮写</span>
      </button>

      <div class="bubble-divider"></div>

      <button class="bubble-btn" @click="handleInterpret" title="解读">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <span>解读</span>
      </button>

      <button class="bubble-btn" @click="handleRefine" title="精炼">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
        <span>精炼</span>
      </button>

      <button class="bubble-btn" @click="handlePolish" title="润色">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
        </svg>
        <span>润色</span>
      </button>

      <button class="bubble-btn" @click="handleExpand" title="扩写">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"></polyline>
          <polyline points="9 21 3 21 3 15"></polyline>
          <line x1="21" y1="3" x2="14" y2="10"></line>
          <line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
        <span>扩写</span>
      </button>

      <div class="bubble-divider"></div>

      <button class="bubble-btn chat-open-btn" @click="handleOpenInChat" title="对话中打开">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>对话中打开</span>
      </button>
    </div>
  </BubbleMenu>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { BubbleMenu } from '@tiptap/vue-3/menus';
import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

const props = defineProps({
  editor: Object,
  isDark: Boolean
});

const emit = defineEmits(['aiWrite', 'interpret', 'refine', 'polish', 'expand', 'openInChat', 'replaceText', 'insertText']);

const showAIPanel = ref(false);
const showCommandMenu = ref(false);
const inputText = ref('');
const selectedText = ref('');
const inputRef = ref(null);
const currentCommand = ref('');
const commandMenuDirection = ref('down');
const isJustOpened = ref(false);

const showAIOutput = ref(false);
const aiOutputContent = ref('');
const currentAction = ref('');
const isStreaming = ref(false);
const streamingTimer = ref(null);
const outputPanelPosition = ref('bottom');
const outputPanelStyle = ref({});

const tippyOptions = computed(() => ({
  duration: 150,
  placement: outputPanelPosition.value,
  hideOnClick: false,
  interactive: true,
  maxWidth: 'none',
  appendTo: () => document.body,
}));

const handleWrapperMouseDown = (event) => {
  if (event.target === event.currentTarget) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }
};

const handleBackdropMouseDown = (event) => {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
};

const handleBackdropClick = (event) => {
  event.preventDefault();
  event.stopPropagation();
};

const renderedOutput = computed(() => {
  if (!aiOutputContent.value) return '';
  return marked.parse(aiOutputContent.value);
});

const getSelectedText = () => {
  const { from, to } = props.editor.state.selection;
  return props.editor.state.doc.textBetween(from, to, ' ');
};

const getActionTitle = () => {
  const titleMap = {
    'interpret': '快速解读',
    'refine': '精炼内容',
    'polish': '快速润色',
    'expand': '智能扩写'
  };
  return titleMap[currentAction.value] || 'AI 处理';
};

const getActionHint = () => {
  const hintMap = {
    'interpret': '解读思路',
    'refine': '精炼思路',
    'polish': '润色思路',
    'expand': '扩写思路'
  };
  return hintMap[currentAction.value] || '处理思路';
};

const getCharCount = () => {
  return aiOutputContent.value.replace(/\s/g, '').length;
};

const mockResponses = {
  interpret: `◆ **收敛完成后**，将推荐版本清单写入《技术选型白名单》，作为 Code Review 和架构评审的**强制检查项**。

**核心要点：**
- 建立技术选型的标准化流程
- 确保代码质量和架构一致性
- 提供明确的审查标准`,

  refine: `将推荐版本清单写入《技术选型白名单》：

- 作为 Code Review 强制检查项
- 纳入架构评审流程
- 定期更新和维护`,

  polish: `◆ 收敛完成后，将推荐版本清单写入《技术选型白名单》，作为 Code Review 和架构评审的强制检查项。`,

  expand: `◆ **收敛完成后**，团队需要将经过充分验证的推荐版本清单正式写入《技术选型白名单》文档中。这一文档将成为后续所有 Code Review 和架构评审过程中的**强制性检查依据**。

**具体实施步骤：**

1. **版本验证阶段**
   - 对候选版本进行全面的功能测试
   - 评估性能指标和兼容性
   - 记录测试结果和发现的问题

2. **文档更新流程**
   - 将验证通过的版本信息录入白名单
   - 标注每个版本的适用场景和限制条件
   - 设定版本的有效期和复审时间

3. **执行监督机制**
   - 在 Code Review 中强制检查版本合规性
   - 架构评审时核对技术选型是否符合规范
   - 定期审计和更新白名单内容

通过这一机制，可以确保技术选型的一致性和可控性。`
};

const startStreaming = (action) => {
  if (streamingTimer.value) {
    clearTimeout(streamingTimer.value);
    streamingTimer.value = null;
  }
  
  closeAIPanel();
  
  const { from, to } = props.editor.state.selection;
  try {
    const startCoords = props.editor.view.coordsAtPos(from);
    const endCoords = props.editor.view.coordsAtPos(to);
    
    const viewportHeight = window.innerHeight;
    const panelHeight = 400;
    const gap = 20;
    
    const spaceBelow = viewportHeight - endCoords.bottom - gap;
    const spaceAbove = startCoords.top - gap;
    
    if (spaceBelow >= panelHeight) {
      outputPanelPosition.value = 'bottom';
      outputPanelStyle.value = {
        paddingTop: `${endCoords.bottom + gap}px`
      };
    } else if (spaceAbove >= panelHeight) {
      outputPanelPosition.value = 'top';
      outputPanelStyle.value = {
        paddingBottom: `${viewportHeight - startCoords.top + gap}px`
      };
    } else {
      outputPanelPosition.value = 'bottom';
      outputPanelStyle.value = {
        paddingTop: `${startCoords.top + gap}px`
      };
    }
  } catch (error) {
    outputPanelPosition.value = 'bottom';
    outputPanelStyle.value = { paddingTop: '80px' };
  }
  
  showAIOutput.value = true;
  currentAction.value = action;
  isStreaming.value = true;
  aiOutputContent.value = '';

  const fullText = mockResponses[action] || '';
  let currentIndex = 0;

  const stream = () => {
    if (currentIndex < fullText.length) {
      const chunkSize = Math.floor(Math.random() * 3) + 1;
      aiOutputContent.value += fullText.slice(currentIndex, currentIndex + chunkSize);
      currentIndex += chunkSize;
      streamingTimer.value = window.setTimeout(stream, 20 + Math.random() * 30);
    } else {
      isStreaming.value = false;
      streamingTimer.value = null;
    }
  };

  setTimeout(stream, 300);
};

const closeAIOutput = () => {
  if (streamingTimer.value) {
    clearTimeout(streamingTimer.value);
    streamingTimer.value = null;
  }
  showAIOutput.value = false;
  aiOutputContent.value = '';
  currentAction.value = '';
  isStreaming.value = false;
};

const resetAIPanel = () => {
  if (showAIPanel.value) {
    showAIPanel.value = false;
    showCommandMenu.value = false;
    inputText.value = '';
    currentCommand.value = '';
    selectedText.value = '';
  }
  
  if (showAIOutput.value) {
    if (streamingTimer.value) {
      clearTimeout(streamingTimer.value);
      streamingTimer.value = null;
    }
    showAIOutput.value = false;
    aiOutputContent.value = '';
    currentAction.value = '';
    isStreaming.value = false;
  }
};

const closeAIPanel = () => {
  showAIPanel.value = false;
  showCommandMenu.value = false;
  inputText.value = '';
  currentCommand.value = '';
  selectedText.value = '';
};

const openAIPanel = async () => {
  selectedText.value = getSelectedText();
  showAIPanel.value = true;
  await nextTick();
  inputRef.value?.focus();
  if (selectedText.value) {
    inputText.value = '';
  }
  
  await nextTick();
  const commandBtn = document.querySelector('.command-btn');
  if (commandBtn) {
    const rect = commandBtn.getBoundingClientRect();
    const menuHeight = 260;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      commandMenuDirection.value = 'up';
    } else {
      commandMenuDirection.value = 'down';
    }
  }
  
  showCommandMenu.value = true;
  isJustOpened.value = true;
  setTimeout(() => {
    isJustOpened.value = false;
  }, 100);
};

const toggleCommandMenu = async (e) => {
  e.stopPropagation();
  
  if (!showCommandMenu.value) {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const menuHeight = 260; 
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      commandMenuDirection.value = 'up';
    } else {
      commandMenuDirection.value = 'down';
    }
  }
  
  showCommandMenu.value = !showCommandMenu.value;
};

const selectCommand = (command) => {
  currentCommand.value = command;
  showCommandMenu.value = false;
  const prefixMap = {
    '翻译': '请翻译以下内容：',
    '总结': '请总结以下内容：',
    '续写': '请续写以下内容：',
    '语法修正': '请修正以下内容的语法错误：',
    '生成任务计划': '请根据以下内容生成任务计划：',
    '生成表格': '请根据以下内容生成表格：'
  };
  
  if (selectedText.value) {
    inputText.value = prefixMap[command] + '\n' + selectedText.value;
  } else {
    inputText.value = prefixMap[command] + '\n';
  }
  
  autoResize();
  nextTick(() => {
    inputRef.value?.focus();
  });
};

const autoResize = () => {
  const textarea = inputRef.value;
  if (!textarea) return;

  textarea.style.height = 'auto';
  const lineHeight = 24;
  const maxHeight = lineHeight * 6;
  const newHeight = Math.min(textarea.scrollHeight, maxHeight);
  
  textarea.style.height = newHeight + 'px';
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
};

const handleSend = () => {
  if (!inputText.value.trim()) return;
  
  emit('aiWrite', inputText.value, currentCommand.value || undefined);
  closeAIPanel();
};

const handleInterpret = () => {
  const text = getSelectedText();
  emit('interpret', text);
  startStreaming('interpret');
};

const handleRefine = () => {
  const text = getSelectedText();
  emit('refine', text);
  startStreaming('refine');
};

const handlePolish = () => {
  const text = getSelectedText();
  emit('polish', text);
  startStreaming('polish');
};

const handleExpand = () => {
  const text = getSelectedText();
  emit('expand', text);
  startStreaming('expand');
};

const handleLike = () => {
  console.log('点赞');
};

const handleDislike = () => {
  console.log('点踩');
};

const handleReInterpret = () => {
  if (isStreaming.value || !aiOutputContent.value) return;
  aiOutputContent.value = '';
  startStreaming('interpret');
};

const handleInsert = () => {
  if (!aiOutputContent.value || isStreaming.value) return;
  emit('insertText', aiOutputContent.value);
  closeAIOutput();
};

const handleRewrite = () => {
  if (isStreaming.value) return;
  aiOutputContent.value = '';
  startStreaming(currentAction.value);
};

const handleDiscard = () => {
  closeAIOutput();
};

const handleReplace = () => {
  if (!aiOutputContent.value || isStreaming.value) return;
  emit('replaceText', aiOutputContent.value);
  closeAIOutput();
};

const handleOpenInChat = () => {
  const { from, to } = props.editor.state.selection;
  const text = getSelectedText();
  emit('openInChat', text, from, to);
};

const handleClickOutside = (event) => {
  if (isJustOpened.value) return;
  
  const target = event.target;
  if (showCommandMenu.value && !target.closest('.command-dropdown')) {
    showCommandMenu.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  props.editor.on('selectionUpdate', resetAIPanel);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
  props.editor.off('selectionUpdate', resetAIPanel);
});
</script>

<style scoped>
.note-bubble-menu {
  z-index: 1000;
}

.bubble-menu-container {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background-color: var(--bg-primary, #ffffff);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--border-color, #e5e7eb);
  animation: bubble-in 0.15s ease-out;
}

[data-theme='dark'] .bubble-menu-container {
  background-color: #1f2937;
  border-color: #374151;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 1px rgba(0, 0, 0, 0.2);
}

@keyframes bubble-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.bubble-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: none;
  border-radius: 6px;
  background-color: transparent;
  color: var(--text-primary, #374151);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  user-select: none;
}

.bubble-btn:hover {
  background-color: var(--bg-hover, #f3f4f6);
  color: var(--text-primary, #111827);
}

[data-theme='dark'] .bubble-btn:hover {
  background-color: #374151;
  color: #f9fafb;
}

.bubble-btn:active {
  transform: scale(0.97);
}

.bubble-btn svg {
  flex-shrink: 0;
  opacity: 0.8;
}

.bubble-btn:hover svg {
  opacity: 1;
}

.ai-write-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff !important;
  font-weight: 600;
  padding: 4px 12px;
}

.ai-write-btn svg {
  opacity: 1;
  color: #ffffff;
}

.ai-write-btn:hover {
  background: linear-gradient(135deg, #5568d3 0%, #653d91 100%);
  color: #ffffff !important;
  transform: scale(1.02);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
}

.ai-write-btn:active {
  transform: scale(0.98);
}

.bubble-divider {
  width: 1px;
  height: 20px;
  background-color: var(--border-color, #e5e7eb);
  margin: 0 2px;
}

[data-theme='dark'] .bubble-divider {
  background-color: #4b5563;
}

.ai-input-wrapper {
  position: relative;
  width: 380px;
  max-width: 480px;
  background: var(--bg-primary, #ffffff);
  border: 1.5px solid var(--border-color, #e5e7eb);
  border-radius: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06), 0 0 1px rgba(0, 0, 0, 0.04);
  animation: panel-in 0.18s ease-out;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.ai-input-wrapper:focus-within {
  border-color: var(--text-tertiary, #9ca3af);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1), 0 0 1px rgba(0, 0, 0, 0.04);
}

.ai-input-wrapper.is-dark {
  background: #1f2937;
  border-color: #374151;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25), 0 0 1px rgba(0, 0, 0, 0.1);
}

.ai-input-wrapper.is-dark:focus-within {
  border-color: #6b7280;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35), 0 0 1px rgba(0, 0, 0, 0.1);
}

@keyframes panel-in {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.ai-textarea {
  width: 100%;
  padding: 12px 16px 4px;
  border: none;
  outline: none;
  resize: none;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary, #111827);
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  min-height: 38px;
  max-height: 144px;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
  border-radius: 20px 20px 0 0;
}

.ai-textarea::-webkit-scrollbar {
  width: 5px;
}

.ai-textarea::-webkit-scrollbar-track {
  background: transparent;
}

.ai-textarea::-webkit-scrollbar-thumb {
  background: var(--border-color, #e5e7eb);
  border-radius: 10px;
}

.ai-textarea::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary, #9ca3af);
}

.ai-textarea::placeholder {
  color: var(--text-tertiary, #9ca3af);
}

.is-dark .ai-textarea {
  color: #f9fafb;
}

.is-dark .ai-textarea::placeholder {
  color: #6b7280;
}

.input-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px 8px;
}

.action-left,
.action-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.command-dropdown {
  position: relative;
  display: inline-block;
}

.command-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 16px;
  background: transparent;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.command-btn:hover {
  background: var(--bg-secondary, #f9fafb);
  border-color: var(--border-color, #d1d5db);
  color: var(--text-primary, #374151);
}

.command-btn.active {
  background: var(--bg-secondary, #f9fafb);
  border-color: #667eea;
  color: #667eea;
}

.is-dark .command-btn {
  border-color: #4b5563;
  color: #9ca3af;
}

.is-dark .command-btn:hover {
  background: #374151;
  border-color: #6b7280;
  color: #d1d5db;
}

.is-dark .command-btn.active {
  background: #374151;
  border-color: #667eea;
  color: #a78bfa;
}

.command-btn svg:last-child {
  transition: transform 0.2s ease;
}

.command-btn.active svg:last-child {
  transform: rotate(180deg);
}

.command-menu {
  position: absolute;
  left: 0;
  min-width: 180px;
  background: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px;
  padding: 4px;
  z-index: 1001;
  animation: menu-in 0.12s ease-out;
}

.command-menu.menu-down {
  top: calc(100% + 8px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.06);
}

.command-menu.menu-up {
  bottom: calc(100% + 8px);
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.06);
}

.is-dark .command-menu {
  background: #374151;
  border-color: #4b5563;
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.35), 0 0 1px rgba(0, 0, 0, 0.15);
}

@keyframes menu-in {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.command-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary, #374151);
  cursor: pointer;
  transition: all 0.1s ease;
  user-select: none;
}

.command-item:hover {
  background: var(--bg-hover, #f3f4f6);
  color: var(--text-primary, #111827);
}

.is-dark .command-item {
  color: #d1d5db;
}

.is-dark .command-item:hover {
  background: #4b5563;
  color: #f9fafb;
}

.command-item svg {
  flex-shrink: 0;
  color: var(--text-tertiary, #9ca3af);
}

.command-item:hover svg {
  color: #667eea;
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0.5;
}

.send-btn.active {
  opacity: 1;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
}

.send-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
}

.send-btn:disabled {
  cursor: not-allowed;
}

.ai-output-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.ai-output-wrapper.position-top {
  justify-content: flex-end;
}

.ai-output-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.1);
  z-index: -1;
}

.ai-output-panel {
  position: relative;
  width: 480px;
  max-width: 520px;
  max-height: 400px;
  background: var(--bg-primary, #ffffff);
  border: 1.5px solid var(--border-color, #e5e7eb);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.06);
  animation: panel-in 0.18s ease-out;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.ai-output-panel.is-dark {
  background: #1f2937;
  border-color: #374151;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 1px rgba(0, 0, 0, 0.15);
}

.ai-output-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--border-color, #f3f4f6);
}

.is-dark .ai-output-header {
  border-bottom-color: #374151;
}

.ai-output-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #111827);
  letter-spacing: -0.01em;
}

.is-dark .ai-output-title {
  color: #f9fafb;
}

.ai-output-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-tertiary, #9ca3af);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.ai-output-close:hover {
  background: var(--bg-hover, #f3f4f6);
  color: var(--text-primary, #111827);
}

.is-dark .ai-output-close:hover {
  background: #374151;
  color: #f9fafb;
}

.ai-output-content {
  padding: 16px;
  max-height: 280px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-primary, #111827);
}

.is-dark .ai-output-content {
  color: #e5e7eb;
}

.ai-output-content::-webkit-scrollbar {
  width: 6px;
}

.ai-output-content::-webkit-scrollbar-track {
  background: transparent;
}

.ai-output-content::-webkit-scrollbar-thumb {
  background: var(--border-color, #e5e7eb);
  border-radius: 10px;
}

.ai-output-content::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary, #9ca3af);
}

.ai-output-content .markdown-body :deep(p) {
  margin: 0 0 10px;
}

.ai-output-content .markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.ai-output-content .markdown-body :deep(strong) {
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.is-dark .ai-output-content .markdown-body :deep(strong) {
  color: #f9fafb;
}

.ai-output-content .markdown-body :deep(ul),
.ai-output-content .markdown-body :deep(ol) {
  margin: 8px 0;
  padding-left: 20px;
}

.ai-output-content .markdown-body :deep(li) {
  margin: 4px 0;
}

.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 16px;
  background: #667eea;
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: blink 0.8s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.thinking-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 16px;
  padding-top: 12px;
  font-size: 13px;
  color: var(--text-secondary, #6b7280);
}

.thinking-hint svg {
  flex-shrink: 0;
  color: var(--text-tertiary, #9ca3af);
}

.polish-suggestions {
  margin-top: 12px;
  padding: 12px 14px;
  background: var(--bg-hover, #f9fafb);
  border-radius: 10px;
  border-left: 3px solid #667eea;
}

.is-dark .polish-suggestions {
  background: #374151;
}

.suggestion-item {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary, #4b5563);
  margin-bottom: 8px;
}

.suggestion-item:last-child {
  margin-bottom: 0;
}

.suggestion-item strong {
  color: var(--text-primary, #111827);
  font-weight: 600;
}

.is-dark .suggestion-item {
  color: #d1d5db;
}

.is-dark .suggestion-item strong {
  color: #f9fafb;
}

.ai-output-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0px 16px;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ai-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-tertiary, #9ca3af);
}

.ai-badge svg {
  color: #10b981;
}

.char-count {
  font-size: 12px;
  color: var(--text-tertiary, #9ca3af);
}

.footer-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.footer-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: var(--text-tertiary, #9ca3af);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.footer-action-btn:hover {
  background: var(--bg-hover, #f3f4f6);
  color: var(--text-secondary, #6b7280);
}

.is-dark .footer-action-btn:hover {
  background: #374151;
  color: #d1d5db;
}

.more-btn {
  margin-left: 4px;
}

.ai-output-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px 10px;
  flex-wrap: wrap;
}

.ai-output-actions.single-action {
  justify-content: center;
}

.ai-output-actions.multi-actions {
  justify-content: flex-end;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  background: var(--bg-primary, #ffffff);
  color: var(--text-secondary, #6b7280);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.action-btn:hover:not(:disabled) {
  background: var(--bg-hover, #f9fafb);
  border-color: var(--text-tertiary, #9ca3af);
  color: var(--text-primary, #111827);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.secondary {
  border-color: var(--border-color, #e5e7eb);
}

.action-btn.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  border-color: transparent;
  font-weight: 600;
  padding: 6px 16px;
  margin-left: auto;
}

.action-btn.primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #5568d3 0%, #653d91 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.35);
}

.action-btn.danger {
  color: #ef4444;
  border-color: #fecaca;
}

.action-btn.danger:hover:not(:disabled) {
  background: #fef2f2;
  border-color: #fca5a5;
  color: #dc2626;
}

.is-dark .action-btn {
  background: #374151;
  border-color: #4b5563;
  color: #d1d5db;
}

.is-dark .action-btn:hover:not(:disabled) {
  background: #4b5563;
  border-color: #6b7280;
  color: #f9fafb;
}

.is-dark .action-btn.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: transparent;
}

.is-dark .action-btn.primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #5568d3 0%, #653d91 100%);
}

.is-dark .action-btn.danger {
  color: #f87171;
  border-color: #7f1d1d;
}

.is-dark .action-btn.danger:hover:not(:disabled) {
  background: #7f1d1d;
  border-color: #991b1b;
  color: #fecaca;
}

.action-btn.primary-outline {
  background: transparent;
  color: #667eea;
  border-color: #667eea;
  font-weight: 600;
}

.action-btn.primary-outline:hover:not(:disabled) {
  background: rgba(102, 126, 234, 0.08);
  border-color: #5568d3;
  color: #5568d3;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
}

.is-dark .action-btn.primary-outline {
  color: #a78bfa;
  border-color: #a78bfa;
}

.is-dark .action-btn.primary-outline:hover:not(:disabled) {
  background: rgba(167, 139, 250, 0.12);
  border-color: #8b5cf6;
  color: #8b5cf6;
}

.btn-switch-enter-active {
  transition: all 0.2s ease;
}

.btn-switch-leave-active {
  transition: all 0.15s ease;
}

.btn-switch-enter-from {
  opacity: 0;
  transform: scale(0.7);
}

.btn-switch-leave-to {
  opacity: 0;
  transform: scale(0.7);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.96);
}
</style>
