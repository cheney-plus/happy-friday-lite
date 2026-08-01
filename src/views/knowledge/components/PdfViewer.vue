<template>
  <div class="pdf-viewer" ref="containerRef">
    <div class="pdf-pages" ref="pagesRef" @scroll="onScroll">
      <div
        v-for="page in totalPages"
        :key="page"
        class="pdf-page-wrapper"
        :data-page="page"
        :style="{ height: getPageHeight(page) + 'px' }"
      >
        <canvas
          :ref="el => setCanvasRef(el, page)"
          class="pdf-canvas"
          v-show="renderedPages.has(page)"
        ></canvas>
        <div v-show="!renderedPages.has(page)" class="pdf-page-placeholder">
          <div class="placeholder-spinner"></div>
          <span>{{ page }} / {{ totalPages }}</span>
        </div>
      </div>
    </div>
    <div v-if="loading" class="pdf-loading">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>
    <div v-else-if="error" class="pdf-error">
      <span>{{ error }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const props = defineProps({
  filePath: { type: String, required: true }
});
const emit = defineEmits(['page-info']);

const containerRef = ref(null);
const pagesRef = ref(null);
const loading = ref(true);
const error = ref('');
const totalPages = ref(0);
const currentPage = ref(1);

// 已渲染页面集合（响应式，驱动 v-show 切换 canvas/placeholder）
const renderedPages = reactive(new Set());
// 每页显示高度（响应式，驱动 wrapper 高度，保证滚动条准确）
const pageHeights = reactive({});

// 非响应式内部状态
const canvasRefs = {};
const renderTasks = {};
const renderingPages = new Set();
let loadingTask = null;
let pdfDoc = null;
let scrollTimer = null;
let intersectionObserver = null;
let resizeObserver = null;
let resizeTimer = null;
let defaultPageHeight = 1100;

// 距当前页超过此值的已渲染页面会被清理，以控制内存
const CLEAR_DISTANCE = 8;

function getPageHeight(page) {
  return pageHeights[page] || defaultPageHeight;
}

function setCanvasRef(el, page) {
  if (el) canvasRefs[page] = el;
  else delete canvasRefs[page];
}

async function loadPdf() {
  loading.value = true;
  error.value = '';
  const api = window.electronAPI;
  if (!api) {
    error.value = 'Electron API 不可用';
    loading.value = false;
    return;
  }
  try {
    const result = await api.invoke('kb-read-file-buffer', { filePath: props.filePath });
    if (!result.success) {
      error.value = result.error || '读取文件失败';
      loading.value = false;
      return;
    }
    const data = new Uint8Array(result.data);
    loadingTask = pdfjsLib.getDocument({ data });
    pdfDoc = await loadingTask.promise;
    totalPages.value = pdfDoc.numPages;
    // 用首页尺寸估算默认高度，让滚动条初始就较准确
    await estimatePageHeight();
    loading.value = false;
    await nextTick();
    setupIntersectionObserver();
    setupResizeObserver();
    emit('page-info', { current: 1, total: totalPages.value });
  } catch (e) {
    error.value = '加载 PDF 失败: ' + (e.message || e);
    loading.value = false;
  }
}

async function estimatePageHeight() {
  if (!pdfDoc || !containerRef.value) return;
  try {
    const page = await pdfDoc.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const containerWidth = containerRef.value.clientWidth - 48;
    const displayScale = Math.min(containerWidth / baseViewport.width, 1.5);
    defaultPageHeight = Math.floor(displayScale * baseViewport.height);
  } catch (_e) {
    // 估算失败则保持默认值
  }
}

function setupIntersectionObserver() {
  if (intersectionObserver) intersectionObserver.disconnect();
  intersectionObserver = new IntersectionObserver(
    handleIntersection,
    {
      root: pagesRef.value,
      // 在可视区域上下各扩展 600px，提前渲染即将进入视口的页面
      rootMargin: '600px 0px',
    }
  );
  const wrappers = pagesRef.value.querySelectorAll('.pdf-page-wrapper');
  wrappers.forEach((wrapper) => {
    intersectionObserver.observe(wrapper);
  });
}

function setupResizeObserver() {
  if (resizeObserver) resizeObserver.disconnect();
  resizeObserver = new ResizeObserver(() => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // 容器尺寸变化后需按新宽度重渲染：清空已渲染页面与缓存高度
      clearAllPages();
      estimatePageHeight();
      // 重建 observer 会立即对当前可视页面触发回调
      setupIntersectionObserver();
    }, 300);
  });
  if (containerRef.value) resizeObserver.observe(containerRef.value);
}

function handleIntersection(entries) {
  for (const entry of entries) {
    const page = parseInt(entry.target.dataset.page, 10);
    if (entry.isIntersecting) {
      renderPage(page);
    } else {
      maybeClearPage(page);
    }
  }
}

function maybeClearPage(page) {
  const dist = Math.abs(page - currentPage.value);
  if (dist > CLEAR_DISTANCE && renderedPages.has(page)) {
    clearPage(page);
  }
}

function clearPage(page) {
  const canvas = canvasRefs[page];
  if (canvas) {
    // 重置 width 会清空 canvas 并释放显存
    canvas.width = 0;
    canvas.height = 0;
  }
  if (renderTasks[page]) {
    renderTasks[page].cancel();
    delete renderTasks[page];
  }
  renderedPages.delete(page);
}

function clearAllPages() {
  for (const page of [...renderedPages]) {
    clearPage(page);
  }
  Object.keys(pageHeights).forEach((key) => {
    delete pageHeights[key];
  });
}

async function renderPage(pageNum) {
  if (renderedPages.has(pageNum) || renderingPages.has(pageNum)) return;
  const canvas = canvasRefs[pageNum];
  if (!canvas || !pdfDoc) return;

  renderingPages.add(pageNum);
  try {
    const ctx = canvas.getContext('2d');
    const page = await pdfDoc.getPage(pageNum);
    if (!containerRef.value) return; // 组件已卸载
    const containerWidth = containerRef.value.clientWidth - 48;
    const baseViewport = page.getViewport({ scale: 1 });
    const displayScale = Math.min(containerWidth / baseViewport.width, 1.5);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const renderScale = displayScale * dpr;
    const renderViewport = page.getViewport({ scale: renderScale });
    canvas.width = Math.floor(renderViewport.width);
    canvas.height = Math.floor(renderViewport.height);
    canvas.style.width = Math.floor(displayScale * baseViewport.width) + 'px';
    canvas.style.height = Math.floor(displayScale * baseViewport.height) + 'px';

    // 用真实高度更新 wrapper，保证滚动条准确
    pageHeights[pageNum] = Math.floor(displayScale * baseViewport.height);

    if (renderTasks[pageNum]) renderTasks[pageNum].cancel();
    renderTasks[pageNum] = page.render({
      canvasContext: ctx,
      viewport: renderViewport
    });
    try {
      await renderTasks[pageNum].promise;
      renderedPages.add(pageNum);
    } catch (e) {
      if (e && e.name !== 'RenderingCancelledException') {
        console.error('Render error:', e);
      }
    }
  } finally {
    renderingPages.delete(pageNum);
  }
}

function onScroll() {
  if (scrollTimer) clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    const container = pagesRef.value;
    if (!container) return;
    const scrollTop = container.scrollTop;
    const pageHeight = container.scrollHeight / totalPages.value;
    const page = Math.min(Math.floor(scrollTop / pageHeight) + 1, totalPages.value);
    if (page !== currentPage.value) {
      currentPage.value = page;
      emit('page-info', { current: page, total: totalPages.value });
    }
  }, 100);
}

function scrollToPage(page) {
  const container = pagesRef.value;
  if (!container || page < 1 || page > totalPages.value) return;
  const wrapper = container.querySelector(`.pdf-page-wrapper[data-page="${page}"]`);
  if (wrapper) {
    container.scrollTo({ top: wrapper.offsetTop, behavior: 'smooth' });
    currentPage.value = page;
    emit('page-info', { current: page, total: totalPages.value });
    // 跳转目标页可能尚未渲染，主动触发一次
    renderPage(page);
  }
}

defineExpose({ scrollToPage });

onMounted(() => {
  loadPdf();
});

onBeforeUnmount(() => {
  if (intersectionObserver) intersectionObserver.disconnect();
  if (resizeObserver) resizeObserver.disconnect();
  for (const pageNum in renderTasks) {
    renderTasks[pageNum].cancel();
  }
  if (pdfDoc) pdfDoc.cleanup();
  if (loadingTask) loadingTask.destroy();
  if (scrollTimer) clearTimeout(scrollTimer);
  if (resizeTimer) clearTimeout(resizeTimer);
});
</script>

<style scoped lang="scss">
.pdf-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--bg-secondary);
  overflow: hidden;
}

.pdf-pages {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.pdf-page-wrapper {
  width: 100%;
  display: flex;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
}

.pdf-canvas {
  max-width: 100%;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  background: #fff;
}

.pdf-page-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--bg-primary);
  border-radius: 4px;
  color: var(--text-tertiary);
  font-size: 13px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.placeholder-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.pdf-loading,
.pdf-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 14px;
  background: var(--bg-secondary);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
