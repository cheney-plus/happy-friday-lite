<template>
  <div class="drawing-page">
    <aside
      class="drawing-sidebar"
      :class="{ collapsed: sidebarCollapsed }"
      :style="{ width: `${sidebarCollapsed ? 0 : sidebarWidth}px` }"
    >
      <div v-if="!searchMode" class="drawing-sidebar-topbar">
        <button class="topbar-button" type="button" :title="t('drawing.sidebar.collapse')" @click="toggleSidebar">
          <PanelLeftClose :size="18" :stroke-width="1.8" />
        </button>
        <div class="topbar-actions">
          <div class="new-canvas-button-group">
            <button class="new-canvas-main-button" type="button" :title="t('drawing.sidebar.newCanvas')">
              <Plus :size="16" :stroke-width="2" />
            </button>
            <button class="new-canvas-dropdown-button" type="button" :title="t('drawing.sidebar.moreOptions')" @click="newCanvasMenuVisible = !newCanvasMenuVisible">
              <ChevronDown :size="13" :stroke-width="2" />
            </button>
            <div v-if="newCanvasMenuVisible" class="new-canvas-dropdown-menu">
              <button type="button" class="dropdown-item" @click="newCanvasMenuVisible = false">
                <Plus :size="14" :stroke-width="2" />
                {{ t('drawing.sidebar.newCanvas') }}
              </button>
              <button type="button" class="dropdown-item" @click="newCanvasMenuVisible = false">
                <Upload :size="14" :stroke-width="2" />
                {{ t('drawing.sidebar.importCanvas') }}
              </button>
            </div>
          </div>
          <button class="topbar-button" type="button" :title="t('drawing.sidebar.search')" @click="enterSearchMode">
            <Search :size="18" :stroke-width="2" />
          </button>
        </div>
      </div>

      <div v-else class="sidebar-search">
        <Search :size="16" :stroke-width="2" />
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          type="search"
          :placeholder="t('drawing.sidebar.searchPlaceholder')"
          @keydown.escape="exitSearchMode"
          @blur="exitSearchMode"
        />
      </div>

      <div class="directory-heading">{{ t('drawing.sidebar.allCanvases') }}</div>
      <div class="canvas-list">
        <button
          v-for="canvas in filteredCanvases"
          :key="canvas.id"
          type="button"
          class="canvas-card"
          :class="{ active: selectedCanvasId === canvas.id }"
          @click="selectedCanvasId = canvas.id"
        >
          <div class="canvas-preview" :class="`preview-${canvas.kind}`">
            <span v-if="canvas.kind === 'mindmap'" class="mindmap-preview"><i></i><i></i><i></i><b></b></span>
            <span v-else-if="canvas.kind === 'kanban'" class="kanban-preview"><i></i><i></i><i></i></span>
            <span v-else-if="canvas.kind === 'flowchart'" class="flowchart-preview"><i></i><i></i><i></i></span>
            <PencilLine v-else :size="26" :stroke-width="1.5" />
          </div>
          <span class="canvas-card-footer">
            <strong>{{ t(`drawing.canvas.${canvas.title}`) }}</strong>
            <small>{{ t(`drawing.canvas.${canvas.updated}`) }}</small>
          </span>
        </button>
      </div>
      <div class="resize-handle" @mousedown.prevent="startResizing"></div>
    </aside>

    <button v-if="sidebarCollapsed" class="sidebar-expand-button" type="button" :title="t('drawing.sidebar.expand')" @click="toggleSidebar">
      <PanelLeftOpen :size="18" :stroke-width="1.8" />
    </button>

    <main class="drawing-workspace" aria-label="Drawing workspace">
      <div class="canvas-grid"></div>
      <div class="workspace-empty-state">
        <PencilRuler :size="28" :stroke-width="1.5" />
        <span>{{ t('drawing.canvas.placeholder') }}</span>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  PencilLine,
  PencilRuler,
  Plus,
  Search,
  Upload
} from 'lucide-vue-next';

const { t } = useI18n();
const sidebarWidth = ref(296);
const sidebarCollapsed = ref(false);
const searchMode = ref(false);
const searchQuery = ref('');
const searchInputRef = ref(null);
const newCanvasMenuVisible = ref(false);
const selectedCanvasId = ref('mindmap');

const canvases = [
  { id: 'mindmap', title: 'mindMap', updated: 'updatedToday', kind: 'mindmap' },
  { id: 'kanban', title: 'kanban', updated: 'updatedToday', kind: 'kanban' },
  { id: 'flowchart', title: 'flowchart', updated: 'updatedYesterday', kind: 'flowchart' },
  { id: 'blank', title: 'blankCanvas', updated: 'updatedYesterday', kind: 'blank' }
];

const filteredCanvases = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  if (!query) return canvases;
  return canvases.filter((canvas) => t(`drawing.canvas.${canvas.title}`).toLocaleLowerCase().includes(query));
});

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value;
  newCanvasMenuVisible.value = false;
};

const enterSearchMode = () => {
  searchMode.value = true;
  newCanvasMenuVisible.value = false;
  nextTick(() => searchInputRef.value?.focus());
};

const exitSearchMode = () => {
  searchMode.value = false;
  searchQuery.value = '';
};

let initialPointerX = 0;
let initialWidth = 0;

const resizeSidebar = (event) => {
  sidebarWidth.value = Math.min(420, Math.max(220, initialWidth + event.clientX - initialPointerX));
};

const stopResizing = () => {
  window.removeEventListener('mousemove', resizeSidebar);
  window.removeEventListener('mouseup', stopResizing);
};

const startResizing = (event) => {
  initialPointerX = event.clientX;
  initialWidth = sidebarWidth.value;
  window.addEventListener('mousemove', resizeSidebar);
  window.addEventListener('mouseup', stopResizing);
};

onUnmounted(stopResizing);
</script>

<style scoped>
.drawing-page { position: relative; display: flex; height: 100%; min-height: 520px; color: var(--text-primary); background: var(--bg-primary); overflow: hidden; }
.drawing-sidebar { position: relative; display: flex; flex: 0 0 auto; flex-direction: column; min-width: 0; overflow: hidden; border-right: 1px solid var(--border-color); background: var(--bg-primary); transition: width .2s ease; }
.drawing-sidebar.collapsed { border-right-color: transparent; }
.drawing-sidebar-topbar { display: flex; align-items: center; justify-content: space-between; height: 56px; padding: 0 12px; box-sizing: border-box; }
.topbar-button { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 8px; color: var(--text-primary); background: transparent; cursor: pointer; }
.topbar-button:hover { background: var(--bg-hover); }
.topbar-actions, .new-canvas-button-group { display: flex; align-items: center; }
.topbar-actions { gap: 4px; }
.new-canvas-button-group { position: relative; }
.new-canvas-main-button, .new-canvas-dropdown-button { display: inline-flex; align-items: center; justify-content: center; height: 32px; padding: 0; border: 0; color: var(--text-primary); background: transparent; cursor: pointer; }
.new-canvas-main-button { width: 32px; border-radius: 8px 0 0 8px; }
.new-canvas-dropdown-button { width: 20px; border-radius: 0 8px 8px 0; }
.new-canvas-main-button:hover, .new-canvas-dropdown-button:hover { background: var(--bg-hover); }
.new-canvas-dropdown-menu { position: absolute; z-index: 40; top: 36px; right: 0; min-width: 140px; padding: 4px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-primary); box-shadow: 0 4px 16px rgba(0, 0, 0, .12); }
.dropdown-item { display: flex; align-items: center; width: 100%; gap: 8px; padding: 7px 8px; border: 0; border-radius: 5px; color: var(--text-primary); background: transparent; font-size: 12px; text-align: left; cursor: pointer; }
.dropdown-item:hover { background: var(--bg-hover); }
.sidebar-search { display: flex; align-items: center; gap: 6px; height: 56px; padding: 12px; box-sizing: border-box; color: var(--text-tertiary); }
.sidebar-search input { flex: 1; min-width: 0; height: 32px; padding: 0; border: 0; outline: 0; color: var(--text-primary); background: transparent; font-size: 14px; }
.directory-heading { padding: 0 16px 10px; color: var(--text-secondary); font-size: 12px; font-weight: 600; }
.canvas-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; padding: 0 14px 16px; overflow-y: auto; }
.canvas-card { min-width: 0; padding: 0; overflow: hidden; border: 1px solid var(--border-color); border-radius: 6px; color: inherit; background: var(--bg-primary); text-align: left; cursor: pointer; }
.canvas-card:hover { border-color: #a8a29e; }
.canvas-card.active, .canvas-card.active:hover { border-color: #1c1917; box-shadow: none; }
.canvas-preview { position: relative; display: flex; align-items: center; justify-content: center; height: 92px; overflow: hidden; color: var(--text-tertiary); border-bottom: 1px solid var(--border-color); background-color: color-mix(in srgb, var(--bg-secondary) 72%, transparent); }
.canvas-card-footer { display: flex; flex-direction: column; gap: 3px; padding: 9px; }
.canvas-card-footer strong { overflow: hidden; font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.canvas-card-footer small { color: var(--text-tertiary); font-size: 10px; }
.mindmap-preview { position: relative; width: 76px; height: 48px; }
.mindmap-preview b, .mindmap-preview i { position: absolute; display: block; border: 1px solid var(--text-tertiary); border-radius: 2px; opacity: .65; }
.mindmap-preview b { top: 17px; left: 27px; width: 21px; height: 13px; }
.mindmap-preview i:nth-child(1) { top: 1px; right: 0; width: 18px; height: 11px; }
.mindmap-preview i:nth-child(2) { top: 19px; right: 0; width: 18px; height: 11px; }
.mindmap-preview i:nth-child(3) { bottom: 1px; right: 0; width: 18px; height: 11px; }
.kanban-preview { display: flex; gap: 5px; align-items: flex-start; width: 74px; height: 52px; padding: 5px; border: 1px dashed var(--border-color); }
.kanban-preview i { flex: 1; height: 40px; border-radius: 2px; background: var(--border-color); opacity: .65; }
.flowchart-preview { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.flowchart-preview i { display: block; width: 29px; height: 10px; border: 1px solid var(--text-tertiary); border-radius: 2px; opacity: .65; }
.resize-handle { position: absolute; z-index: 3; top: 0; right: -3px; bottom: 0; width: 6px; cursor: col-resize; }
.resize-handle:hover { background: var(--accent-color); opacity: .45; }
.sidebar-expand-button { position: absolute; z-index: 30; top: 12px; left: 12px; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 8px; color: var(--text-primary); background: transparent; cursor: pointer; }
.sidebar-expand-button:hover { background: var(--bg-hover); }
.drawing-workspace { position: relative; flex: 1; min-width: 0; overflow: hidden; background: var(--bg-primary); }
.canvas-grid { position: absolute; inset: 0; opacity: .7; background-image: radial-gradient(var(--text-tertiary) .75px, transparent .75px); background-size: 20px 20px; background-position: -1px -1px; }
.workspace-empty-state { position: absolute; top: 50%; left: 50%; display: flex; align-items: center; gap: 10px; transform: translate(-50%, -50%); color: var(--text-tertiary); font-size: 13px; white-space: nowrap; pointer-events: none; }
@media (max-width: 760px) { .drawing-sidebar { width: min(296px, 72vw) !important; } .canvas-list { grid-template-columns: 1fr; } }
</style>
