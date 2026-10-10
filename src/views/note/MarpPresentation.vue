<template>
  <div ref="rootRef" class="marp-presentation" :class="[`deck-theme-${deckTheme}`]">
    <div ref="stageRef" class="marp-stage">
      <div class="slide-frame" :style="frameStyle">
        <div class="slide-scaler" :style="scalerStyle">
          <Transition name="marp-slide-fade" mode="out-in">
            <iframe
              v-if="iframeSrcdoc"
              :key="iframeSrcdoc"
              ref="iframeRef"
              class="marp-iframe"
              title="Marp presentation"
              :srcdoc="iframeSrcdoc"
              @load="onIframeLoad"
            ></iframe>
          </Transition>
        </div>
      </div>

      <div class="marp-controls">
        <button class="marp-nav-btn" :disabled="current <= 0" @click="prev" :title="t('note.presentation.prev')">
          <ChevronLeft :size="18" :stroke-width="2" />
        </button>
        <span class="marp-counter">{{ slideCount ? current + 1 : 0 }} / {{ slideCount }}</span>
        <button class="marp-nav-btn" :disabled="current >= slideCount - 1" @click="next" :title="t('note.presentation.next')">
          <ChevronRight :size="18" :stroke-width="2" />
        </button>
        <div class="marp-controls-divider"></div>
        <button class="marp-nav-btn" @click="toggleFullscreen" :title="isFullscreen ? t('note.presentation.exitFullscreen') : t('note.presentation.fullscreen')">
          <Minimize v-if="isFullscreen" :size="16" :stroke-width="2" />
          <Maximize v-else :size="16" :stroke-width="2" />
        </button>
        <button class="marp-nav-btn" :disabled="generating" :title="t('note.presentation.regenerate')" @click="emit('regenerate')">
          <RefreshCw :size="16" :stroke-width="2" :class="{ 'marp-spin-icon': generating }" />
        </button>
        <button class="marp-nav-btn marp-exit-btn" :title="t('note.presentation.exit')" @click="emit('close')">
          <X :size="16" :stroke-width="2" />
        </button>
      </div>

      <div v-if="loading" class="marp-loading">
        <Loader2 :size="28" :stroke-width="2" class="marp-loading-icon" />
        <span>{{ t('note.presentation.loading') }}</span>
      </div>
      <div v-else-if="generating" class="marp-loading">
        <Loader2 :size="28" :stroke-width="2" class="marp-loading-icon" />
        <span>{{ t('note.presentation.generating') }}</span>
      </div>
      <div v-else-if="renderError" class="marp-error">
        <CircleAlert :size="28" :stroke-width="2" />
        <span>{{ renderError }}</span>
      </div>
      <div v-else-if="!slideCount" class="marp-empty">
        <Presentation :size="52" :stroke-width="1.5" />
        <span>{{ t('note.presentation.empty') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import katex from 'katex';
import katexCss from 'katex/dist/katex.min.css?raw';
import hljsCss from 'highlight.js/styles/github.css?raw';
import marpDefaultTheme from '@/assets/marp-themes/default.css?raw';
import marpGaiaTheme from '@/assets/marp-themes/gaia.css?raw';
import marpUncoverTheme from '@/assets/marp-themes/uncover.css?raw';
import { ChevronLeft, ChevronRight, CircleAlert, Loader2, Maximize, Minimize, Presentation, RefreshCw, X } from 'lucide-vue-next';

const SLIDE_W = 1280;
const SLIDE_H = 720;
const STAGE_PADDING = 0;

const { t } = useI18n();

const props = defineProps({
  // 演示内容：format 为 'html' 时是编辑器 HTML（内部转 Markdown），'markdown' 时直接是 Marp Markdown 源
  source: { type: String, default: '' },
  format: { type: String, default: 'html' },
  // Agent 正在重新生成演示内容
  generating: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'regenerate']);

const stageRef = ref(null);
const iframeRef = ref(null);

const iframeSrcdoc = ref('');
const slideCount = ref(0);
const deckTheme = ref('default');
const current = ref(0);
const loading = ref(true);
const renderError = ref('');
const stageScale = ref(1);

const frameStyle = computed(() => ({
  width: `${SLIDE_W * stageScale.value}px`,
  height: `${SLIDE_H * stageScale.value}px`,
}));

const scalerStyle = computed(() => ({
  transform: `scale(${stageScale.value})`,
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

// 解析 front matter（仅在文档以 `---` YAML 块开头时），用于识别主题
const extractFrontMatter = (markdown) => {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { markdown, theme: 'default', hasFrontMatter: false };
  const fm = match[1];
  // 只有当块内容像 YAML（key: value）时才视为 front matter，否则当作分页线
  if (!/^[A-Za-z_][\w-]*\s*:/m.test(fm)) return { markdown, theme: 'default', hasFrontMatter: false };
  const themeMatch = fm.match(/^theme\s*:\s*(\S+)\s*$/m);
  return {
    markdown: markdown.slice(match[0].length),
    theme: themeMatch ? themeMatch[1] : 'default',
    hasFrontMatter: true,
  };
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

/* ---------------- 官方 Marp 引擎渲染 ---------------- */

// 懒加载 @marp-team/marpit（Marp 官方规范引擎）+ highlight.js + emoji 插件，
// 相比 marp-core 体积更小（去除 MathJax，数学公式复用项目内 KaTeX）
let marpitInstance = null;
const getMarpit = async () => {
  if (marpitInstance) return marpitInstance;
  const [{ Marpit }, hljsModule, emojiModule] = await Promise.all([
    import('@marp-team/marpit'),
    import('highlight.js/lib/common'),
    import('markdown-it-emoji'),
  ]);
  const hljs = hljsModule.default;
  const escapeHtml = (code) => code.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  marpitInstance = new Marpit({
    html: true,
    inlineSVG: true,
    markdown: {
      highlight: (code, lang) => {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch (_e) {
            /* 高亮失败回退转义 */
          }
        }
        return escapeHtml(code);
      },
    },
  });
  marpitInstance.markdown.use(emojiModule.full);
  // 注册 Marp 官方内置主题（marpit 本体不包含，缺失会导致界面回退为极简默认样式）
  marpitInstance.themeSet.add(marpDefaultTheme);
  marpitInstance.themeSet.add(marpGaiaTheme);
  marpitInstance.themeSet.add(marpUncoverTheme);
  return marpitInstance;
};

// 数学公式：渲染前替换为占位符（避免 markdown 引擎破坏 LaTeX），渲染后用 KaTeX 还原
const extractMathSegments = (markdown) => {
  const mathSegments = [];
  let md = markdown.replace(/\$\$([\s\S]+?)\$\$/g, (_m, latex) => {
    mathSegments.push({ latex: latex.trim(), display: true });
    return `MATHSEG${mathSegments.length - 1}END`;
  });
  md = md.replace(/\$([^$\n]+?)\$/g, (_m, latex) => {
    mathSegments.push({ latex: latex.trim(), display: false });
    return `MATHSEG${mathSegments.length - 1}END`;
  });
  return { md, mathSegments };
};

const renderMathInHtml = (html, mathSegments) =>
  html.replace(/MATHSEG(\d+)END/g, (_m, index) => {
    const seg = mathSegments[Number(index)];
    if (!seg) return '';
    try {
      return katex.renderToString(seg.latex, { displayMode: seg.display, throwOnError: false });
    } catch {
      return seg.latex;
    }
  });

const buildSrcdoc = (html, css) =>
  `<!DOCTYPE html><html><head><meta charset="utf-8">` +
  `<style>html,body{margin:0;padding:0;overflow:hidden}svg[data-marpit-svg]{display:block;vertical-align:top}` +
  `.marp-slides-wrap{transition:transform .32s ease;will-change:transform}` +
  `.marp-slides-wrap .marpit{display:flex}` +
  `.marp-slides-wrap svg[data-marpit-svg]{flex:0 0 ${SLIDE_W}px;width:${SLIDE_W}px;height:${SLIDE_H}px}</style>` +
  `<style>${css}</style><style>${hljsCss}</style><style>${katexCss}</style></head>` +
  `<body><div class="marp-slides-wrap">${html}</div></body></html>`;

const buildSlides = async () => {
  loading.value = true;
  renderError.value = '';
  iframeSrcdoc.value = '';
  slideCount.value = 0;
  current.value = 0;
  try {
    const markdown = props.format === 'markdown'
      ? (props.source || '')
      : await htmlToMarkdown(props.source);
    if (!markdown.trim()) {
      return;
    }

    // front matter 仅用于识别主题（画布外配色）；无显式分页的普通笔记按标题切分补分页线
    const { markdown: body, theme, hasFrontMatter } = extractFrontMatter(markdown);
    deckTheme.value = theme;
    let blocks = splitBySlideBreaks(body);
    if (!hasFrontMatter && blocks.length === 1) blocks = splitByHeadings(body);
    const md = hasFrontMatter ? markdown : blocks.length > 1 ? blocks.join('\n\n---\n\n') : markdown;

    const { md: mathMd, mathSegments } = extractMathSegments(md);
    const marpit = await getMarpit();
    const { html: rawHtml, css } = marpit.render(mathMd);
    const html = renderMathInHtml(rawHtml, mathSegments);

    const doc = new DOMParser().parseFromString(html, 'text/html');
    slideCount.value = doc.querySelectorAll('section').length || 1;
    iframeSrcdoc.value = buildSrcdoc(html, css);
  } catch (error) {
    console.error('Marp 渲染失败:', error);
    renderError.value = t('note.presentation.renderError');
  } finally {
    loading.value = false;
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

let resizeObserver = null;

/* ---------------- 翻页 ---------------- */

const next = () => {
  if (current.value < slideCount.value - 1) current.value += 1;
};
const prev = () => {
  if (current.value > 0) current.value -= 1;
};

// 通过平移幻灯片容器切换页面（iframe 内无滚动条）
const applySlideOffset = (animate = true) => {
  const wrap = iframeRef.value?.contentDocument?.querySelector('.marp-slides-wrap');
  if (!wrap) return;
  if (!animate) wrap.style.transition = 'none';
  wrap.style.transform = `translateX(-${current.value * SLIDE_W}px)`;
  if (!animate) {
    // 强制 reflow 后恢复过渡动画
    void wrap.offsetHeight;
    wrap.style.transition = '';
  }
};

const onIframeLoad = () => applySlideOffset(false);

watch(current, () => applySlideOffset());

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
    current.value = Math.max(slideCount.value - 1, 0);
  } else if (event.key === 'f' || event.key === 'F') {
    event.preventDefault();
    toggleFullscreen();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    // 全屏时 Esc 仅退出全屏（由浏览器处理），不关闭演示
    if (!isFullscreen.value) emit('close');
  }
};

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

.marp-iframe {
  display: block;
  width: 1280px;
  height: 720px;
  border: 0;
  background: #fdfdfd;
  /* 键盘与点击由外层接管，避免 iframe 抢焦点 */
  pointer-events: none;
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

.marp-exit-btn:hover:not(:disabled) {
  background: rgba(220, 60, 60, 0.85);
}

.marp-loading,
.marp-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  color: #24292e;
  font-size: 15px;
  user-select: none;

  svg {
    opacity: 0.45;
  }
}

.marp-loading-icon {
  animation: marp-spin 1.2s linear infinite;
}

.marp-spin-icon {
  animation: marp-spin 1.2s linear infinite;
}

@keyframes marp-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.marp-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #c0392b;
  font-size: 15px;
  user-select: none;

  svg {
    opacity: 0.7;
  }
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
