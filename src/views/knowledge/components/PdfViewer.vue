<template>
  <div class="pdf-viewer" ref="containerRef">
    <div class="pdf-pages" ref="pagesRef" @scroll="onScroll">
      <canvas
        v-for="page in totalPages"
        :key="page"
        :ref="el => setCanvasRef(el, page)"
        class="pdf-canvas"
      ></canvas>
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
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
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

const canvasRefs = {};
const renderTasks = {};
let loadingTask = null;
let pdfDoc = null;
let scrollTimer = null;

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
    loading.value = false;
    await nextTick();
    for (let i = 1; i <= totalPages.value; i++) {
      renderPage(i);
    }
    emit('page-info', { current: 1, total: totalPages.value });
  } catch (e) {
    error.value = '加载 PDF 失败: ' + (e.message || e);
    loading.value = false;
  }
}

async function renderPage(pageNum) {
  const canvas = canvasRefs[pageNum];
  if (!canvas || !pdfDoc) return;
  const ctx = canvas.getContext('2d');
  const page = await pdfDoc.getPage(pageNum);
  const containerWidth = containerRef.value.clientWidth - 48;
  const viewport = page.getViewport({ scale: 1 });
  const scale = Math.min(containerWidth / viewport.width, 1.5);
  const scaledViewport = page.getViewport({ scale });
  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;
  canvas.style.width = scaledViewport.width + 'px';
  canvas.style.height = scaledViewport.height + 'px';
  if (renderTasks[pageNum]) renderTasks[pageNum].cancel();
  renderTasks[pageNum] = page.render({ canvasContext: ctx, viewport: scaledViewport });
  try {
    await renderTasks[pageNum].promise;
  } catch (e) {
    if (e && e.name !== 'RenderingCancelledException') {
      console.error('Render error:', e);
    }
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
  const pageHeight = container.scrollHeight / totalPages.value;
  container.scrollTo({ top: (page - 1) * pageHeight, behavior: 'smooth' });
  currentPage.value = page;
  emit('page-info', { current: page, total: totalPages.value });
}

defineExpose({ scrollToPage });

onMounted(() => {
  loadPdf();
});

onBeforeUnmount(() => {
  for (const pageNum in renderTasks) {
    renderTasks[pageNum].cancel();
  }
  if (pdfDoc) pdfDoc.cleanup();
  if (loadingTask) loadingTask.destroy();
  if (scrollTimer) clearTimeout(scrollTimer);
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

.pdf-canvas {
  max-width: 100%;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  background: #fff;
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
