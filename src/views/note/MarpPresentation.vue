<template>
  <div ref="rootRef" class="marp-presentation" :class="[`deck-theme-${deckTheme}`]">
    <div ref="stageRef" class="marp-stage">
      <div class="slide-frame" :style="frameStyle">
        <div class="slide-scaler" :style="scalerStyle">
          <Transition name="marp-slide-fade" mode="out-in">
            <div v-if="currentSlide" :key="current" class="marp-slide" :class="currentSlide.className" ref="slideRef">
              <div ref="slideContentRef" class="slide-content" :style="contentStyle" v-html="currentSlide.html"></div>
            </div>
          </Transition>
        </div>
      </div>

      <div class="marp-controls">
        <button class="marp-nav-btn" :disabled="current <= 0" @click="prev" :title="t('note.presentation.prev')">
          <ChevronLeft :size="18" :stroke-width="2" />
        </button>
        <span class="marp-counter">{{ slides.length ? current + 1 : 0 }} / {{ slides.length }}</span>
        <button class="marp-nav-btn" :disabled="current >= slides.length - 1" @click="next" :title="t('note.presentation.next')">
          <ChevronRight :size="18" :stroke-width="2" />
        </button>
        <div class="marp-controls-divider"></div>
        <button class="marp-nav-btn" @click="toggleFullscreen" :title="isFullscreen ? t('note.presentation.exitFullscreen') : t('note.presentation.fullscreen')">
          <Minimize v-if="isFullscreen" :size="16" :stroke-width="2" />
          <Maximize v-else :size="16" :stroke-width="2" />
        </button>
      </div>

      <button class="marp-exit-btn" :title="t('note.presentation.exit')" @click="emit('close')">
        <X :size="16" :stroke-width="2" />
      </button>

      <div v-if="loading" class="marp-loading">{{ t('note.presentation.loading') }}</div>
      <div v-else-if="renderError" class="marp-error">{{ renderError }}</div>
      <div v-else-if="!slides.length" class="marp-empty">{{ t('note.presentation.empty') }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { marked } from 'marked';
import katex from 'katex';
import { ChevronLeft, ChevronRight, Maximize, Minimize, X } from 'lucide-vue-next';

const SLIDE_W = 1280;
const SLIDE_H = 720;
const STAGE_PADDING = 0;

const { t } = useI18n();

const props = defineProps({
  // 编辑器的 HTML 内容（NoteEditor 的 getHTML() 结果）
  source: { type: String, default: '' },
});

const emit = defineEmits(['close']);

const stageRef = ref(null);
const slideRef = ref(null);
const slideContentRef = ref(null);

const slides = ref([]);
const deckTheme = ref('default');
const current = ref(0);
const loading = ref(true);
const renderError = ref('');
const stageScale = ref(1);
const fitScale = ref(1);

const currentSlide = computed(() => slides.value[current.value] || null);

const frameStyle = computed(() => ({
  width: `${SLIDE_W * stageScale.value}px`,
  height: `${SLIDE_H * stageScale.value}px`,
}));

const scalerStyle = computed(() => ({
  transform: `scale(${stageScale.value})`,
}));

const contentStyle = computed(() => ({
  transform: `scale(${fitScale.value})`,
}));

/* ---------------- Markdown 转换 ---------------- */

const htmlToMarkdown = async (html) => {
  if (!html || !html.trim()) return '';
  const { default: TurndownService } = await import('turndown');
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });
  turndown.addRule('taskListItems', {
    filter: (node) => node.nodeName === 'LI' && node.getAttribute('data-type') === 'taskItem',
    replacement: (content, node) => {
      const checkbox = node.querySelector('input[type="checkbox"]');
      const checked = checkbox?.hasAttribute('checked') ? 'x' : ' ';
      return `- [${checked}] ${content.trim()}\n`;
    },
  });
  turndown.addRule('inlineMath', {
    filter: (node) => node.nodeName === 'SPAN' && node.getAttribute('data-type') === 'inline-math',
    replacement: (_content, node) => `$${node.getAttribute('data-latex') || ''}$`,
  });
  turndown.addRule('blockMath', {
    filter: (node) => node.nodeName === 'DIV' && node.getAttribute('data-type') === 'block-math',
    replacement: (_content, node) => `\n\n$$\n${node.getAttribute('data-latex') || ''}\n$$\n\n`,
  });
  turndown.addRule('tables', {
    filter: (node) => node.nodeName === 'TABLE',
    replacement: (_content, node) => {
      const rows = Array.from(node.querySelectorAll('tr'));
      if (!rows.length) return '';
      const tableData = rows.map((tr) =>
        Array.from(tr.children).map((cell) => (cell.textContent || '').trim().replace(/\|/g, '\\|'))
      );
      const colCount = Math.max(...tableData.map((r) => r.length));
      const lines = [];
      tableData.forEach((row, i) => {
        const cells = Array.from({ length: colCount }, (_, c) => row[c] ?? '');
        lines.push(`| ${cells.join(' | ')} |`);
        if (i === 0) lines.push(`| ${Array.from({ length: colCount }, () => '---').join(' | ')} |`);
      });
      return `\n\n${lines.join('\n')}\n\n`;
    },
  });
  return turndown.turndown(html);
};

/* ---------------- Marp 解析 ---------------- */

// 解析 front matter（仅在文档以 `---` YAML 块开头时）
const extractFrontMatter = (markdown) => {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { markdown, theme: 'default' };
  const fm = match[1];
  // 只有当块内容像 YAML（key: value）时才视为 front matter，否则当作分页线
  if (!/^[A-Za-z_][\w-]*\s*:/m.test(fm)) return { markdown, theme: 'default' };
  const themeMatch = fm.match(/^theme\s*:\s*(\S+)\s*$/m);
  return { markdown: markdown.slice(match[0].length), theme: themeMatch ? themeMatch[1] : 'default' };
};

// 按分页线切分（忽略代码块内的 `---`）
const splitBySlideBreaks = (markdown) => {
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let current = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (!inFence && /^-{3,}\s*$/.test(line)) {
      blocks.push(current.join('\n'));
      current = [];
      continue;
    }
    current.push(line);
  }
  blocks.push(current.join('\n'));
  let result = blocks.map((b) => b.trim());
  if (result.length > 1) result = result.filter((b) => b !== '');
  return result;
};

// 笔记没有显式 `---` 分页时，按 1-2 级标题自动分页
const splitByHeadings = (markdown) => {
  const lines = markdown.split(/\r?\n/);
  const headingIndexes = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) inFence = !inFence;
    if (!inFence && /^#{1,2}\s+/.test(lines[i])) headingIndexes.push(i);
  }
  if (headingIndexes.length <= 1) return [markdown.trim()];
  const chunks = [];
  const prefix = lines.slice(0, headingIndexes[0]).join('\n').trim();
  for (let h = 0; h < headingIndexes.length; h++) {
    const start = headingIndexes[h];
    const end = h + 1 < headingIndexes.length ? headingIndexes[h + 1] : lines.length;
    chunks.push(lines.slice(start, end).join('\n').trim());
  }
  if (prefix && chunks.length) chunks[0] = `${prefix}\n\n${chunks[0]}`;
  return chunks.filter((c) => c);
};

// 提取 slide 级 Marp 指令（class / theme）
const extractDirectives = (markdown) => {
  let className = '';
  let theme = '';
  const cleaned = markdown.replace(/<!--\s*(_?class|theme)\s*:\s*([^>]*?)\s*-->/g, (_m, key, value) => {
    const v = value.trim();
    if (key === 'theme') theme = v;
    else className = v;
    return '';
  });
  return { cleaned: cleaned.trim(), className, theme };
};

/* ---------------- 渲染 ---------------- */

const renderSlideHtml = (markdown) => {
  // 先抽取数学公式，避免 marked 转义破坏 LaTeX
  const mathSegments = [];
  let md = markdown.replace(/\$\$([\s\S]+?)\$\$/g, (_m, latex) => {
    mathSegments.push({ latex: latex.trim(), display: true });
    return `MATHSEG${mathSegments.length - 1}END`;
  });
  md = md.replace(/\$([^$\n]+?)\$/g, (_m, latex) => {
    mathSegments.push({ latex: latex.trim(), display: false });
    return `MATHSEG${mathSegments.length - 1}END`;
  });

  let html = marked.parse(md, { gfm: true, breaks: false });

  html = html.replace(/MATHSEG(\d+)END/g, (_m, index) => {
    const seg = mathSegments[Number(index)];
    if (!seg) return '';
    try {
      return katex.renderToString(seg.latex, {
        displayMode: seg.display,
        throwOnError: false,
      });
    } catch {
      return seg.latex;
    }
  });
  return html;
};

const buildSlides = async () => {
  loading.value = true;
  renderError.value = '';
  slides.value = [];
  current.value = 0;
  try {
    const markdown = await htmlToMarkdown(props.source);
    if (!markdown.trim()) {
      slides.value = [];
      return;
    }
    const { markdown: body, theme } = extractFrontMatter(markdown);
    deckTheme.value = theme;

    let blocks = splitBySlideBreaks(body);
    if (blocks.length === 1) blocks = splitByHeadings(blocks[0]);

    slides.value = blocks.map((block) => {
      const { cleaned, className, theme: slideTheme } = extractDirectives(block);
      const classes = [];
      if (className) classes.push(...className.split(/\s+/).filter(Boolean));
      if (slideTheme) classes.push(`theme-${slideTheme}`);
      return { html: cleaned ? renderSlideHtml(cleaned) : '', className: classes.join(' ') };
    });
  } catch (error) {
    console.error('Marp 渲染失败:', error);
    renderError.value = t('note.presentation.renderError');
  } finally {
    loading.value = false;
    nextTick(computeFitScale);
  }
};

/* ---------------- 缩放 ---------------- */

const updateStageScale = () => {
  const el = stageRef.value;
  if (!el) return;
  const availableW = Math.max(el.clientWidth - STAGE_PADDING * 2, 0);
  const availableH = Math.max(el.clientHeight - STAGE_PADDING * 2, 0);
  if (!availableW || !availableH) return;
  stageScale.value = Math.min(availableW / SLIDE_W, availableH / SLIDE_H);
};

// 内容超出画布时自动缩小
const computeFitScale = () => {
  const contentEl = slideContentRef.value;
  const slideEl = slideRef.value;
  if (!contentEl || !slideEl) {
    fitScale.value = 1;
    return;
  }
  contentEl.style.transform = 'none';
  const slideStyle = getComputedStyle(slideEl);
  const availH = slideEl.clientHeight - parseFloat(slideStyle.paddingTop) - parseFloat(slideStyle.paddingBottom);
  const availW = slideEl.clientWidth - parseFloat(slideStyle.paddingLeft) - parseFloat(slideStyle.paddingRight);
  const h = contentEl.scrollHeight;
  const w = contentEl.scrollWidth;
  if (!availH || !availW || !h || !w) {
    fitScale.value = 1;
    return;
  }
  fitScale.value = Math.min(1, availH / h, availW / w);
};

let resizeObserver = null;

/* ---------------- 翻页 ---------------- */

const next = () => {
  if (current.value < slides.value.length - 1) current.value += 1;
};
const prev = () => {
  if (current.value > 0) current.value -= 1;
};

/* ---------------- 全屏 ---------------- */

const rootRef = ref(null);
const isFullscreen = ref(false);

const toggleFullscreen = async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if (rootRef.value) {
      await rootRef.value.requestFullscreen();
    }
  } catch (error) {
    console.error('切换全屏失败:', error);
  }
};

const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement;
};

const handleKeydown = (event) => {
  if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) {
    event.preventDefault();
    next();
  } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) {
    event.preventDefault();
    prev();
  } else if (event.key === 'Home') {
    current.value = 0;
  } else if (event.key === 'End') {
    current.value = Math.max(slides.value.length - 1, 0);
  } else if (event.key === 'f' || event.key === 'F') {
    event.preventDefault();
    toggleFullscreen();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    // 全屏时 Esc 仅退出全屏（由浏览器处理），不关闭演示
    if (!isFullscreen.value) emit('close');
  }
};

watch(current, () => {
  fitScale.value = 1;
  nextTick(computeFitScale);
});

watch(() => props.source, buildSlides, { immediate: true });

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  if (stageRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateStageScale);
    resizeObserver.observe(stageRef.value);
  }
  updateStageScale();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});
</script>

<style lang="scss" scoped>
.marp-presentation {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  /* 画布外区域与幻灯片主题同色，消除黑边 */
  background: #fdfdfd;

  &.deck-theme-gaia {
    background: linear-gradient(150deg, #23557c 0%, #123049 100%);
  }
}

.marp-stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.slide-frame {
  position: relative;
  flex-shrink: 0;
}

.slide-scaler {
  position: absolute;
  top: 0;
  left: 0;
  width: 1280px;
  height: 720px;
  transform-origin: top left;
}

.marp-slide {
  width: 1280px;
  height: 720px;
  box-sizing: border-box;
  padding: 64px 80px;
  overflow: hidden;
  background: #fdfdfd;
  color: #24292e;
  font-family: 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-size: 30px;
  line-height: 1.55;
  text-align: left;

  /* gaia 主题时画布外区域同色 */
  .deck-theme-gaia & {
    background: transparent;
  }

  :deep(*) {
    user-select: text;
  }

  :deep(h1),
  :deep(h2),
  :deep(h3) {
    font-weight: 700;
    line-height: 1.25;
    margin: 0 0 0.5em;
  }

  :deep(h1) {
    font-size: 1.6em;
    padding-bottom: 0.3em;
    border-bottom: 3px solid currentColor;
    opacity: 0.92;
  }

  :deep(h2) {
    font-size: 1.25em;
    color: #1f6fb2;
  }

  :deep(h3) {
    font-size: 1.1em;
    color: #1f6fb2;
  }

  :deep(p) {
    margin: 0.4em 0;
  }

  :deep(ul),
  :deep(ol) {
    margin: 0.4em 0;
    padding-left: 1.4em;
  }

  :deep(li) {
    margin: 0.25em 0;
  }

  :deep(blockquote) {
    margin: 0.5em 0;
    padding: 0.2em 1em;
    border-left: 6px solid #1f6fb2;
    background: rgba(31, 111, 178, 0.08);
    color: #4a5560;
  }

  :deep(code) {
    font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
    font-size: 0.85em;
    background: rgba(110, 118, 129, 0.15);
    border-radius: 4px;
    padding: 0.15em 0.35em;
  }

  :deep(pre) {
    background: #f6f8fa;
    border: 1px solid #d0d7de;
    border-radius: 8px;
    padding: 0.8em 1em;
    overflow: hidden;

    code {
      background: transparent;
      padding: 0;
      font-size: 0.7em;
      line-height: 1.45;
    }
  }

  :deep(table) {
    border-collapse: collapse;
    margin: 0.5em 0;
    font-size: 0.8em;

    th,
    td {
      border: 1px solid #c6cbd1;
      padding: 0.35em 0.8em;
    }

    th {
      background: #f2f4f6;
      font-weight: 700;
    }
  }

  :deep(img) {
    max-width: 100%;
    max-height: 480px;
    object-fit: contain;
  }

  :deep(a) {
    color: #1f6fb2;
    text-decoration: none;
  }

  :deep(hr) {
    border: none;
    border-top: 2px solid #d8dce0;
    margin: 0.8em 0;
  }

  :deep(.katex) {
    font-size: 1.05em;
  }

  :deep(.katex-display) {
    margin: 0.4em 0;
  }

  /* lead 风格：标题页居中 */
  &.lead {
    display: flex;
    flex-direction: column;
    justify-content: center;

    h1 {
      font-size: 2.1em;
      border-bottom: none;
      text-align: center;
    }

    p {
      text-align: center;
      opacity: 0.75;
    }
  }

  /* gaia 主题（近似） */
  &.theme-gaia {
    background: linear-gradient(150deg, #23557c 0%, #123049 100%);
    color: #f0f5f9;

    h2,
    h3 {
      color: #8ecdf5;
    }

    :deep(h2),
    :deep(h3) {
      color: #8ecdf5;
    }

    :deep(blockquote) {
      border-left-color: #8ecdf5;
      background: rgba(142, 205, 245, 0.12);
      color: #c8d8e4;
    }

    :deep(pre) {
      background: rgba(0, 0, 0, 0.3);
      border-color: rgba(255, 255, 255, 0.15);
    }

    :deep(code) {
      background: rgba(0, 0, 0, 0.3);
    }

    :deep(a) {
      color: #8ecdf5;
    }

    :deep(table) {
      th,
      td {
        border-color: rgba(255, 255, 255, 0.25);
      }

      th {
        background: rgba(255, 255, 255, 0.12);
      }
    }

    &.lead {
      align-items: center;
    }
  }

  /* uncover 主题（近似） */
  &.theme-uncover {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;

    :deep(h1),
    :deep(h2),
    :deep(h3) {
      text-align: center;
    }

    :deep(h1) {
      border-bottom: none;
    }

    :deep(ul),
    :deep(ol) {
      text-align: left;
    }
  }
}

.slide-content {
  width: 100%;
  transform-origin: top center;
  transition: transform 0.15s ease-out;
}

.marp-controls {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  background: rgba(20, 26, 34, 0.78);
  backdrop-filter: blur(6px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  z-index: 5;
}

.marp-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #dfe6ee;
  cursor: pointer;
  transition: background 0.15s;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
  }

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
}

.marp-counter {
  min-width: 72px;
  text-align: center;
  color: #dfe6ee;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  user-select: none;
}

.marp-controls-divider {
  width: 1px;
  height: 16px;
  margin: 0 2px;
  background: rgba(255, 255, 255, 0.25);
}

.marp-exit-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  background: rgba(20, 26, 34, 0.78);
  color: #dfe6ee;
  cursor: pointer;
  transition: background 0.15s;
  z-index: 5;

  &:hover {
    background: rgba(220, 60, 60, 0.85);
  }
}

.marp-loading,
.marp-error,
.marp-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: rgba(223, 230, 238, 0.6);
  font-size: 14px;
  user-select: none;
}

.marp-error {
  color: #ff9c9c;
}

.marp-slide-fade-enter-active,
.marp-slide-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.marp-slide-fade-enter-from {
  opacity: 0;
  transform: translateX(24px);
}

.marp-slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}
</style>
