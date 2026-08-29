<template>
  <div class="epub-viewer">
    <EBookReaderVue
      v-if="file"
      :file="file"
      :default-dark-mode="isDark"
      @ready="onReady"
      @progress="onProgress"
      @toc="onToc"
      @error="onError"
    />
    <div v-if="loading" class="epub-loading">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>
    <div v-else-if="error" class="epub-error">
      <span>{{ error }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { EBookReaderVue } from '@somecat/epub-reader/vue';
import '@somecat/epub-reader/style.css';
import { useAppStore } from '@/store';

const props = defineProps({
  filePath: { type: String, required: true }
});
const emit = defineEmits(['page-info']);

const appStore = useAppStore();
const isDark = computed(() => appStore.theme === 'dark');

const file = ref(null);
const loading = ref(true);
const error = ref('');
let readerHandle = null;

async function loadEpub() {
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
    const blob = new Blob([result.data], { type: 'application/epub+zip' });
    const fileName = props.filePath.split('/').pop() || 'book.epub';
    file.value = new File([blob], fileName, { type: 'application/epub+zip' });
  } catch (e) {
    console.error('EPUB load error:', e);
    error.value = '加载 EPUB 失败: ' + (e.message || e);
    loading.value = false;
  }
}

function onReady(handle) {
  readerHandle = handle;
  loading.value = false;
  emitToc();
}

function emitToc() {
  const items = readerHandle?.getToc?.() || [];
  const flatten = (entries = [], level = 1) => entries.flatMap(item => [
    { id: item.href || `toc-${level}-${item.label}`, title: item.label || '未命名章节', level, href: item.href },
    ...flatten(item.subitems || item.children || [], level + 1)
  ]);
  const toc = flatten(items);
  if (toc.length) emit('toc-ready', toc);
}

function onProgress(info) {
  emitToc();
  if (info && info.fraction !== undefined) {
    const percent = Math.round((info.fraction || 0) * 100);
    emit('page-info', { current: percent, total: 100 });
    if (info.tocItem?.href) emit('active-section', info.tocItem.href);
  }
}

function onToc(items) {
  const flatten = (entries = [], level = 1) => entries.flatMap(item => [
    { id: item.href || `toc-${level}-${item.label}`, title: item.label || '未命名章节', level, href: item.href },
    ...flatten(item.subitems || item.children || [], level + 1)
  ]);
  emit('toc-ready', flatten(items));
}

function onError(err) {
  console.error('EPUB reader error:', err);
  error.value = 'EPUB 阅读器错误: ' + (err?.message || err);
  loading.value = false;
}

function nextPage() {
  if (readerHandle) readerHandle.nextPage();
}

function prevPage() {
  if (readerHandle) readerHandle.prevPage();
}

function scrollToSection(item) { if (readerHandle && item?.href) readerHandle.goTo(item.href); }

defineExpose({ nextPage, prevPage, scrollToSection });

onMounted(() => {
  loadEpub();
});

onBeforeUnmount(() => {
  if (readerHandle) readerHandle.destroy();
});
</script>

<style scoped lang="scss">
.epub-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--bg-primary);
  overflow: hidden;
}

.epub-loading,
.epub-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 14px;
  background: var(--bg-primary);
  z-index: 10;
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
