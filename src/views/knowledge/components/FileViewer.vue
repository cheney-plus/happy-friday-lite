<template>
  <div class="file-viewer-overlay">
    <div class="viewer-header">
      <div class="header-left">
        <div class="file-title">
          <component :is="getFileIconComponent(file.type)" class="title-icon" />
          <span class="title-name">{{ file.name }}</span>
        </div>
      </div>
      <div class="header-right">
        <div v-if="showPageNav" class="page-nav">
          <button class="page-btn" :disabled="currentPage <= 1" @click="prevPage" title="上一页">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
          <button class="page-btn" :disabled="currentPage >= totalPages" @click="nextPage" title="下一页">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
        <div v-if="showPageNav && totalPages > 0" class="page-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <span class="progress-text">{{ progressPercent }}%</span>
        </div>
      </div>
    </div>
    <div class="viewer-body">
      <PdfViewer
        v-if="file.type === 'pdf'"
        ref="pdfViewerRef"
        :file-path="file.path"
        @page-info="onPageInfo"
      />
      <EpubViewer
        v-else-if="file.type === 'epub'"
        ref="epubViewerRef"
        :file-path="file.path"
        @page-info="onPageInfo"
      />
      <MarkdownViewer
        v-else-if="file.type === 'markdown'"
        :file-path="file.path"
      />
      <NoteViewer
        v-else-if="file.type === 'note'"
        :file-path="file.path"
      />
      <HtmlViewer
        v-else-if="file.type === 'html'"
        :file-path="file.path"
      />
      <TextViewer
        v-else
        :file-path="file.path"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import PdfViewer from './PdfViewer.vue';
import EpubViewer from './EpubViewer.vue';
import MarkdownViewer from './MarkdownViewer.vue';
import NoteViewer from './NoteViewer.vue';
import HtmlViewer from './HtmlViewer.vue';
import TextViewer from './TextViewer.vue';
import { getFileIconComponent } from '../utils';

const props = defineProps({
  file: { type: Object, required: true }
});

const currentPage = ref(1);
const totalPages = ref(0);

const pdfViewerRef = ref(null);
const epubViewerRef = ref(null);

const showPageNav = computed(() => ['pdf', 'epub'].includes(props.file.type));

const progressPercent = computed(() => {
  if (totalPages.value <= 0) return 0;
  return Math.round((currentPage.value / totalPages.value) * 100);
});

function onPageInfo(info) {
  currentPage.value = info.current;
  totalPages.value = info.total;
}

function prevPage() {
  if (props.file.type === 'pdf') {
    if (pdfViewerRef.value) {
      pdfViewerRef.value.scrollToPage(currentPage.value - 1);
    }
  } else if (props.file.type === 'epub') {
    if (epubViewerRef.value) {
      epubViewerRef.value.prevPage();
    }
  }
}

function nextPage() {
  if (props.file.type === 'pdf') {
    if (pdfViewerRef.value) {
      pdfViewerRef.value.scrollToPage(currentPage.value + 1);
    }
  } else if (props.file.type === 'epub') {
    if (epubViewerRef.value) {
      epubViewerRef.value.nextPage();
    }
  }
}
</script>

<style scoped lang="scss">
.file-viewer-overlay {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.viewer-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  gap: 16px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    flex: 1;
  }

  .file-title {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;

    .title-icon {
      flex-shrink: 0;
      color: var(--text-secondary);
      width: 20px;
      height: 20px;

      :deep(svg) {
        width: 20px !important;
        height: 20px !important;
      }
    }

    .title-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
  }

  .page-nav {
    display: flex;
    align-items: center;
    gap: 8px;

    .page-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: 1px solid var(--border-color);
      background: var(--bg-primary);
      cursor: pointer;
      border-radius: 6px;
      color: var(--text-secondary);
      transition: all 0.15s;

      &:hover:not(:disabled) {
        background: var(--bg-hover);
        color: var(--text-primary);
        border-color: var(--text-tertiary);
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    }

    .page-info {
      font-size: 13px;
      color: var(--text-secondary);
      min-width: 60px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
  }

  .page-progress {
    display: flex;
    align-items: center;
    gap: 8px;

    .progress-bar {
      width: 100px;
      height: 4px;
      background: var(--bg-secondary);
      border-radius: 2px;
      overflow: hidden;

      .progress-fill {
        height: 100%;
        background: var(--accent-color);
        border-radius: 2px;
        transition: width 0.3s ease;
      }
    }

    .progress-text {
      font-size: 12px;
      color: var(--text-tertiary);
      min-width: 36px;
      font-variant-numeric: tabular-nums;
    }
  }
}

.viewer-body {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}
</style>
