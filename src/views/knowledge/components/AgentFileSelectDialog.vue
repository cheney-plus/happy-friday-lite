<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="visible" class="agent-file-overlay" @click.self="$emit('close')">
        <Transition name="dialog-scale">
          <div v-if="visible" class="agent-file-dialog">
            <!-- 头部 -->
            <div class="dialog-header">
              <div class="header-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>选择文件或文件夹</span>
              </div>
              <button class="dialog-close" @click="$emit('close')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <!-- 面包屑 -->
            <div class="file-breadcrumb" v-if="breadcrumb.length > 0">
              <span
                v-for="(seg, idx) in breadcrumb"
                :key="idx"
                class="breadcrumb-item"
                @click="navigateTo(seg.path, idx)"
              >
                {{ seg.name }}
                <svg v-if="idx < breadcrumb.length - 1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </span>
            </div>

            <!-- 文件列表 -->
            <div class="file-body">
              <div class="file-content" v-if="fileList.length > 0">
                <div
                  v-for="file in fileList"
                  :key="file.path"
                  class="file-row"
                  :class="{ folder: file.isDirectory }"
                  @click="handleItemClick(file)"
                >
                  <svg v-if="file.isDirectory" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                  <span class="file-name">{{ file.name }}</span>
                  <button
                    v-if="!file.isDirectory"
                    class="select-btn"
                    @click.stop="selectFile(file)"
                  >选择</button>
                </div>
              </div>
              <div v-else class="file-empty">
                <p>此目录为空</p>
              </div>
            </div>

            <!-- 底部操作 -->
            <div class="dialog-footer">
              <span class="footer-hint">点击文件夹进入，点击"选择"选取文件，或</span>
              <button class="btn-select-folder" @click="selectCurrentFolder">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                选择当前文件夹
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  rootDir: { type: String, default: '' },
  initialPath: { type: String, default: '' }
});

const emit = defineEmits(['close', 'select']);

const fileList = ref([]);
const breadcrumb = ref([]);
const currentPath = ref('');

async function readDir(dirPath) {
  const api = window.electronAPI;
  if (!api) return;
  try {
    const entries = await api.invoke('kb-read-dir', { dirPath });
    fileList.value = entries
      .filter(entry => entry.isDirectory || entry.name.includes('.'))
      .map(entry => ({ ...entry, isDirectory: entry.isDirectory }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  } catch (e) {
    console.error('[AgentFileSelect] Failed to read dir:', e);
    fileList.value = [];
  }
}

function navigateTo(path, idx) {
  if (idx != null && idx < breadcrumb.value.length - 1) {
    breadcrumb.value = breadcrumb.value.slice(0, idx + 1);
  }
  currentPath.value = path;
  readDir(path);
}

function handleItemClick(file) {
  if (file.isDirectory) {
    breadcrumb.value.push({ name: file.name, path: file.path });
    currentPath.value = file.path;
    readDir(file.path);
  }
}

function selectFile(file) {
  const virtualPath = computeVirtualPath(file.path);
  emit('select', {
    name: file.name,
    path: file.path,
    virtualPath,
    isDirectory: false
  });
}

function selectCurrentFolder() {
  if (!currentPath.value) return;
  const folderName = breadcrumb.value.length > 0
    ? breadcrumb.value[breadcrumb.value.length - 1].name
    : 'Agent 根目录';
  const virtualPath = computeVirtualPath(currentPath.value);
  emit('select', {
    name: folderName,
    path: currentPath.value,
    virtualPath,
    isDirectory: true
  });
}

function computeVirtualPath(absPath) {
  if (!props.rootDir || !absPath) return absPath || '';
  if (absPath === props.rootDir) return '/';
  if (absPath.startsWith(props.rootDir)) {
    const rel = absPath.slice(props.rootDir.length).replace(/^[/\\]+/, '');
    return rel || '/';
  }
  return absPath;
}

watch(() => props.visible, (val) => {
  if (val) {
    const startPath = props.initialPath || props.rootDir;
    currentPath.value = startPath;
    if (startPath === props.rootDir) {
      breadcrumb.value = [{ name: 'Agent 工作区', path: startPath }];
    } else if (startPath && props.rootDir && startPath.startsWith(props.rootDir)) {
      const rel = startPath.slice(props.rootDir.length).replace(/^[/\\]+/, '');
      const segs = rel.split(/[/\\]+/).filter(Boolean);
      breadcrumb.value = [{ name: 'Agent 工作区', path: props.rootDir }];
      let acc = props.rootDir;
      for (const seg of segs) {
        acc = acc + '/' + seg;
        breadcrumb.value.push({ name: seg, path: acc });
      }
    } else {
      breadcrumb.value = [{ name: 'Agent 工作区', path: startPath }];
    }
    readDir(startPath);
  } else {
    fileList.value = [];
    breadcrumb.value = [];
  }
});
</script>

<style scoped lang="scss">
.agent-file-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.agent-file-dialog {
  background: var(--bg-primary, #fff);
  border-radius: 14px;
  width: 560px;
  max-width: 92vw;
  height: 480px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.25), 0 0 0 1px var(--border-color, rgba(0, 0, 0, 0.06));
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color, #ececec);
  flex-shrink: 0;

  .header-title {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary, #1a1a1a);
  }

  .dialog-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: none;
    background: transparent;
    color: var(--text-tertiary, #999);
    cursor: pointer;
    border-radius: 7px;
    transition: all 0.15s;

    &:hover {
      background: var(--bg-hover, #f0f0f0);
      color: var(--text-primary, #333);
    }
  }
}

.file-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 18px;
  font-size: 12.5px;
  color: var(--text-tertiary, #999);
  flex-shrink: 0;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--border-color, #f0f0f0);

  .breadcrumb-item {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    transition: color 0.12s;

    &:hover {
      color: var(--accent-color, #1560F7);
    }

    &:last-child {
      color: var(--text-primary, #333);
      font-weight: 500;
    }
  }
}

.file-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  min-height: 0;
}

.file-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s;
  color: var(--text-primary, #333);

  &:hover {
    background: var(--bg-hover, #f5f5f5);
  }

  &.folder {
    color: var(--text-secondary, #555);
  }

  svg {
    color: var(--text-tertiary, #999);
    flex-shrink: 0;
  }

  &.folder svg {
    color: #f59e0b;
  }

  .file-name {
    flex: 1;
    font-size: 13.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .select-btn {
    padding: 4px 12px;
    border: 1px solid var(--border-color, #ddd);
    background: var(--bg-primary, #fff);
    color: var(--text-secondary, #555);
    font-size: 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;

    &:hover {
      background: var(--accent-color, #1560F7);
      color: #fff;
      border-color: var(--accent-color, #1560F7);
    }
  }
}

.file-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-tertiary, #c0c0c0);
  font-size: 13px;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-top: 1px solid var(--border-color, #ececec);
  flex-shrink: 0;
  gap: 12px;

  .footer-hint {
    font-size: 12px;
    color: var(--text-tertiary, #999);
  }

  .btn-select-folder {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 7px 14px;
    border: none;
    background: var(--accent-color, #1560F7);
    color: #fff;
    font-size: 13px;
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity 0.15s;
    flex-shrink: 0;

    &:hover {
      opacity: 0.9;
    }
  }
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}
.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-scale-enter-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.dialog-scale-leave-active {
  transition: all 0.15s ease;
}
.dialog-scale-enter-from {
  opacity: 0;
  transform: scale(0.94) translateY(10px);
}
.dialog-scale-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>
