<template>
  <div class="kb-main">
    <div class="main-header">
      <div class="header-left">
        <button class="nav-btn" @click="$emit('go-back')" :disabled="!canGoBack">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <button class="nav-btn" @click="$emit('go-forward')" :disabled="!canGoForward">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
        <div class="breadcrumb" v-if="selectedKB">
          <template v-for="(segment, index) in pathSegments" :key="index">
            <span
              class="breadcrumb-item"
              :class="{ active: index === pathSegments.length - 1 }"
              @click="$emit('navigate-to-segment', index)"
            >{{ segment.name }}</span>
            <svg v-if="index < pathSegments.length - 1" class="breadcrumb-sep" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </template>
        </div>
        <h1 v-else class="page-title">{{ currentTitle }}</h1>
      </div>
      <div class="header-right">
        <button class="icon-btn" title="搜索">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>
        <button class="icon-btn" title="列表视图">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
        </button>
        <button class="icon-btn" title="更多选项">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="19" cy="12" r="1"></circle>
            <circle cx="5" cy="12" r="1"></circle>
          </svg>
        </button>
        <button class="icon-btn" title="刷新" @click="$emit('refresh')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
        </button>
      </div>
    </div>

    <div class="file-grid" v-if="selectedKB" @contextmenu.prevent="$emit('show-file-context-menu', $event)">
      <FileCard
        v-for="file in files"
        :key="file.path"
        :file="file"
        @open="$emit('open-file', $event)"
      />
      <div v-if="files.length === 0" class="empty-folder">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <p>此文件夹为空</p>
      </div>
    </div>
    <div class="empty-state" v-else>
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
      </svg>
      <h2>选择一个知识库</h2>
      <p>从左侧选择或创建一个知识库开始</p>
    </div>

    <KbQuestionBox />
  </div>
</template>

<script setup>
import FileCard from './FileCard.vue';
import KbQuestionBox from './KbQuestionBox.vue';

defineProps({
  selectedKB: String,
  currentTitle: String,
  canGoBack: Boolean,
  canGoForward: Boolean,
  pathSegments: Array,
  files: Array
});

defineEmits([
  'go-back',
  'go-forward',
  'navigate-to-segment',
  'refresh',
  'show-file-context-menu',
  'open-file'
]);
</script>

<style scoped lang="scss">
.kb-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;

  .main-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
    background: var(--bg-primary);

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;

      .nav-btn {
        padding: 6px;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: 4px;
        color: var(--text-secondary);
        transition: all 0.2s;

        &:hover:not(:disabled) {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        &:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
      }

      .page-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
      }

      .breadcrumb {
        display: flex;
        align-items: center;
        gap: 2px;
        font-size: 14px;
        min-width: 0;
        overflow: hidden;

        .breadcrumb-item {
          color: var(--text-secondary);
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 4px;
          white-space: nowrap;
          transition: all 0.15s;

          &:hover {
            background: var(--bg-hover);
            color: var(--text-primary);
          }

          &.active {
            color: var(--text-primary);
            font-weight: 600;
            cursor: default;

            &:hover {
              background: transparent;
            }
          }
        }

        .breadcrumb-sep {
          color: var(--text-tertiary);
          flex-shrink: 0;
        }
      }
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 4px;

      .icon-btn {
        padding: 8px;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: 4px;
        color: var(--text-secondary);
        transition: all 0.2s;

        &:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
      }
    }
  }

  .file-grid {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    padding: 20px 40px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 16px 24px;
    align-content: start;

    .empty-folder {
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: var(--text-tertiary);

      svg {
        margin-bottom: 12px;
        opacity: 0.4;
      }

      p {
        font-size: 14px;
        margin: 0;
      }
    }
  }

  .empty-state {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    color: var(--text-tertiary);

    svg {
      margin-bottom: 16px;
      opacity: 0.3;
    }

    h2 {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-secondary);
      margin: 0 0 8px;
    }

    p {
      font-size: 14px;
      margin: 0;
    }
  }
}
</style>
