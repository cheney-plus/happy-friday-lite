<template>
  <div class="drawing-page" @click="closeMenus">
    <aside
      class="drawing-sidebar"
      :class="{ collapsed: sidebarCollapsed, 'is-resizing': isResizing }"
      :style="{ width: `${sidebarCollapsed ? 0 : sidebarWidth}px` }"
    >
      <div v-if="!searchMode" class="drawing-sidebar-topbar">
        <button class="topbar-button" type="button" :title="t('drawing.sidebar.collapse')" @click="toggleSidebar">
          <PanelLeftClose :size="18" :stroke-width="1.8" />
        </button>
        <div class="topbar-actions">
          <div class="new-canvas-button-group">
            <button class="new-canvas-main-button" type="button" :title="t('drawing.sidebar.newCanvas')" @click="createCanvas('blank')">
              <Plus :size="16" :stroke-width="2" />
            </button>
            <button class="new-canvas-dropdown-button" type="button" :title="t('drawing.sidebar.moreOptions')" @click.stop="newCanvasMenuVisible = !newCanvasMenuVisible">
              <ChevronDown :size="13" :stroke-width="2" />
            </button>
            <div v-if="newCanvasMenuVisible" class="new-canvas-dropdown-menu" @click.stop>
              <button type="button" class="dropdown-item" @click="createCanvas('blank')">
                <Plus :size="14" :stroke-width="2" />
                {{ t('drawing.sidebar.newCanvas') }}
              </button>
              <button type="button" class="dropdown-item" @click="triggerImport">
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

      <div class="directory-heading" ref="categoryTriggerRef">
        <button type="button" class="category-trigger" @click.stop="toggleCategoryMenu">
          <Folder :size="14" :stroke-width="1.8" />
          <span>{{ currentCategoryName }}</span>
          <ChevronDown :size="13" :stroke-width="2" />
        </button>
        <Teleport to="body">
          <div v-if="categoryMenuVisible" class="category-dropdown" :style="categoryMenuStyle" @click.stop>
            <button
              v-for="category in categories"
              :key="category.id"
              type="button"
              class="category-item"
              :class="{ active: currentCategoryId === category.id }"
              @click="selectCategory(category.id)"
            >
              <Folder :size="14" :stroke-width="1.8" />
              <span class="category-item-info">
                <span class="category-item-name">{{ category.name }}</span>
                <small>{{ t('drawing.sidebar.canvasesCount', { count: category.count }) }}</small>
              </span>
              <span
                v-if="category.id !== 'all'"
                role="button"
                tabindex="0"
                class="category-action"
                :title="t('drawing.sidebar.categoryActions')"
                @click.stop="openCategoryActions($event, category)"
                @keydown.enter.stop="openCategoryActions($event, category)"
              >
                <MoreVertical :size="14" :stroke-width="2" />
              </span>
            </button>
          </div>
          <div v-if="categoryActionMenu.visible" class="category-action-menu" :style="categoryActionMenuStyle" @click.stop>
            <button type="button" @click="renameCategory">{{ t('drawing.sidebar.renameCategory') }}</button>
            <button type="button" class="danger" @click="deleteCategory">{{ t('drawing.sidebar.deleteCategory') }}</button>
          </div>
        </Teleport>
      </div>
      <div class="canvas-list">
        <button
          v-for="canvas in filteredCanvases"
          :key="canvas.id"
          type="button"
          class="canvas-card"
          :class="{ active: drawingStore.selectedCanvasId === canvas.id }"
          @click="drawingStore.selectCanvas(canvas.id)"
          @contextmenu.prevent="openCardMenu($event, canvas)"
        >
          <div class="canvas-preview" :class="`preview-${canvas.kind}`">
            <CanvasThumbnail :graph-json="canvas.graphJSON" />
          </div>
          <span class="canvas-card-footer">
            <input
              v-if="renamingId === canvas.id"
              :value="canvasTitle(canvas)"
              class="rename-input"
              @click.stop
              @keydown.enter.prevent="commitRename($event, canvas)"
              @keydown.escape="renamingId = null"
              @blur="commitRename($event, canvas)"
            />
            <strong v-else>{{ canvasTitle(canvas) }}</strong>
            <small class="canvas-card-meta">
              <span>{{ formatUpdated(canvas.updatedAt) }}</span>
              <span>{{ canvasCategoryName(canvas) }}</span>
            </small>
          </span>
        </button>
      </div>
      <div class="resize-handle" @mousedown.prevent="startResizing"></div>
    </aside>

    <button v-if="sidebarCollapsed" class="sidebar-expand-button" type="button" :title="t('drawing.sidebar.expand')" @click="toggleSidebar">
      <PanelLeftOpen :size="18" :stroke-width="1.8" />
    </button>

    <main class="drawing-workspace" aria-label="Drawing workspace">
      <DrawingEditor
        v-if="drawingStore.currentCanvas"
        :key="drawingStore.currentCanvas.id"
        :canvas="drawingStore.currentCanvas"
        @change="onGraphChange"
        @library-change="onLibraryChange"
      />
    </main>

    <div v-if="cardMenu.visible" class="card-menu" :style="{ left: `${cardMenu.x}px`, top: `${cardMenu.y}px` }" @click.stop>
      <button type="button" @click="duplicateCanvas(cardMenu.canvas)">{{ t('drawing.sidebar.duplicateCanvas') }}</button>
      <button type="button" @click="startRename(cardMenu.canvas)">{{ t('drawing.sidebar.rename') }}</button>
      <div class="card-menu-divider"></div>
      <div ref="moveCategoryItemRef" class="card-menu-item has-submenu" @mouseenter="showMoveCategorySubmenu" @mouseleave="hideMoveCategorySubmenuWithDelay">
        <Folder :size="13" :stroke-width="1.8" />
        <span>{{ t('drawing.sidebar.moveToCategory') }}</span>
        <ChevronRight class="card-menu-arrow" :size="14" :stroke-width="1.8" />
      </div>
      <button type="button" class="danger" @click="removeCanvas(cardMenu.canvas)">{{ t('drawing.sidebar.deleteCanvas') }}</button>
    </div>
    <Teleport to="body">
      <div v-if="moveCategorySubmenuVisible" ref="moveCategorySubmenuRef" class="move-category-submenu" :style="moveCategorySubmenuStyle" @mouseenter="cancelHideMoveCategorySubmenu" @mouseleave="hideMoveCategorySubmenu">
        <button type="button" class="submenu-item" @click="createCategoryForCanvas">
          <FolderPlus :size="14" :stroke-width="1.8" />
          {{ t('drawing.sidebar.newCategory') }}
        </button>
        <div class="card-menu-divider"></div>
        <button v-for="category in categories" :key="`move-${category.id}`" type="button" class="submenu-item" :class="{ active: (cardMenu.canvas?.categoryId || 'all') === category.id }" @click="moveCanvasToCategory(category.id)">
          <Folder :size="13" :stroke-width="1.8" />
          {{ category.name }}
        </button>
      </div>
    </Teleport>
    <input ref="importInputRef" class="hidden-input" type="file" accept="application/json,.json" @change="onImportFile" />
    <Teleport to="body">
      <div v-if="categoryInput.visible" class="category-input-overlay" @click.self="cancelCategoryInput">
        <div class="category-input-card" @click.stop>
          <strong>{{ categoryInput.mode === 'create' ? t('drawing.sidebar.newCategory') : t('drawing.sidebar.renameCategory') }}</strong>
          <input
            ref="categoryInputRef"
            v-model="categoryInput.value"
            type="text"
            maxlength="30"
            :placeholder="categoryInput.mode === 'create' ? t('drawing.sidebar.newCategoryPrompt') : t('drawing.sidebar.renameCategoryPrompt')"
            @keydown.enter.prevent="confirmCategoryInput"
            @keydown.escape="cancelCategoryInput"
          />
          <div class="category-input-actions">
            <button type="button" @click="cancelCategoryInput">{{ t('drawing.sidebar.cancel') }}</button>
            <button type="button" class="primary" @click="confirmCategoryInput">{{ t('drawing.sidebar.confirm') }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onDeactivated, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderPlus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  MoreVertical,
  Search,
  Upload
} from 'lucide-vue-next'
import { useDrawingStore } from '@/store'
import DrawingEditor from './components/DrawingEditor.vue'
import CanvasThumbnail from './components/CanvasThumbnail.vue'

const { t } = useI18n()
const drawingStore = useDrawingStore()

onMounted(() => {
  drawingStore.initialize()
  // 切换应用/浏览器 Tab 时窗口失焦，关闭所有弹出菜单
  window.addEventListener('blur', closeMenus)
})

// keep-alive 切走时组件只是失活，Teleport 到 body 的下拉框仍悬浮在其他 Tab 上，需主动关闭
onDeactivated(() => {
  closeMenus()
})

const SIDEBAR_MIN_WIDTH = 220
const SIDEBAR_MAX_WIDTH = 340
const SIDEBAR_DEFAULT_WIDTH = 272
const sidebarWidth = ref(SIDEBAR_DEFAULT_WIDTH)
const sidebarCollapsed = ref(false)
const isResizing = ref(false)
const searchMode = ref(false)
const searchQuery = ref('')
const searchInputRef = ref(null)
const importInputRef = ref(null)
const newCanvasMenuVisible = ref(false)
const renamingId = ref(null)
const cardMenu = reactive({ visible: false, x: 0, y: 0, canvas: null })
const currentCategoryId = ref('all')
const categoryMenuVisible = ref(false)
const categoryTriggerRef = ref(null)
const categoryMenuStyle = reactive({ left: '0px', top: '0px' })
const categoryActionMenu = reactive({ visible: false, x: 0, y: 0, category: null })
const categoryActionMenuStyle = computed(() => ({ left: `${categoryActionMenu.x}px`, top: `${categoryActionMenu.y}px` }))
const moveCategoryItemRef = ref(null)
const moveCategorySubmenuRef = ref(null)
const moveCategorySubmenuVisible = ref(false)
const moveCategorySubmenuStyle = reactive({ left: '0px', top: '0px' })
let moveCategorySubmenuHideTimer = null

const canvasTitle = (canvas) => canvas.title || t(`drawing.canvas.${canvas.titleKey || 'untitled'}`)

const canvasCategoryName = (canvas) => {
  if (!canvas?.categoryId) return t('drawing.sidebar.uncategorized')
  return drawingStore.categories.find((category) => category.id === canvas.categoryId)?.name
    || t('drawing.sidebar.uncategorized')
}

const formatUpdated = (ts) => {
  const date = new Date(ts)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) return t('drawing.canvas.updatedToday')
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return t('drawing.canvas.updatedYesterday')
  return date.toLocaleDateString()
}

const categories = computed(() => [
  { id: 'all', name: t('drawing.sidebar.allCanvases'), count: drawingStore.canvases.length },
  { id: 'uncategorized', name: t('drawing.sidebar.uncategorized'), count: drawingStore.canvases.filter((canvas) => !canvas.categoryId).length },
  ...drawingStore.categories.map((category) => ({
    ...category,
    count: drawingStore.canvases.filter((canvas) => canvas.categoryId === category.id).length
  }))
])

const currentCategoryName = computed(() => categories.value.find((category) => category.id === currentCategoryId.value)?.name || t('drawing.sidebar.allCanvases'))

const filteredCanvases = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  const categoryFiltered = currentCategoryId.value === 'all'
    ? drawingStore.canvases
    : drawingStore.canvases.filter((canvas) => currentCategoryId.value === 'uncategorized'
      ? !canvas.categoryId
      : canvas.categoryId === currentCategoryId.value)
  if (!query) return categoryFiltered
  return categoryFiltered.filter((canvas) => canvasTitle(canvas).toLocaleLowerCase().includes(query))
})

const closeMenus = () => {
  newCanvasMenuVisible.value = false
  cardMenu.visible = false
  moveCategorySubmenuVisible.value = false
  categoryMenuVisible.value = false
  categoryActionMenu.visible = false
  categoryInput.visible = false
  cancelHideMoveCategorySubmenu()
}

const collapsedByLibrary = ref(false)

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
  collapsedByLibrary.value = false
  closeMenus()
}

const onLibraryChange = (open) => {
  if (open) {
    if (!sidebarCollapsed.value) {
      sidebarCollapsed.value = true
      collapsedByLibrary.value = true
    }
    return
  }
  if (collapsedByLibrary.value) {
    sidebarCollapsed.value = false
    collapsedByLibrary.value = false
  }
}

const enterSearchMode = () => {
  searchMode.value = true
  currentCategoryId.value = 'all'
  closeMenus()
  nextTick(() => searchInputRef.value?.focus())
}

const exitSearchMode = () => {
  searchMode.value = false
  searchQuery.value = ''
}

const createCanvas = (kind) => {
  const categoryId = ['all', 'uncategorized'].includes(currentCategoryId.value) ? null : currentCategoryId.value
  drawingStore.createCanvas(kind, '', categoryId)
  closeMenus()
}

const triggerImport = () => {
  closeMenus()
  importInputRef.value?.click()
}

const onImportFile = async (event) => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  try {
    const payload = JSON.parse(await file.text())
    drawingStore.importCanvas({
      title: payload.title || file.name.replace(/\.json$/i, ''),
      graphJSON: payload.graphJSON || payload,
      categoryId: ['all', 'uncategorized'].includes(currentCategoryId.value) ? null : currentCategoryId.value
    })
  } catch {
    // ignore invalid json
  }
}

const openCardMenu = (event, canvas) => {
  categoryMenuVisible.value = false
  categoryActionMenu.visible = false
  cardMenu.visible = true
  moveCategorySubmenuVisible.value = false
  cardMenu.x = event.clientX
  cardMenu.y = event.clientY
  cardMenu.canvas = canvas
}

const positionMoveCategorySubmenu = () => {
  const itemRect = moveCategoryItemRef.value?.getBoundingClientRect()
  const submenuRect = moveCategorySubmenuRef.value?.getBoundingClientRect()
  if (!itemRect || !submenuRect) return
  const gap = 6
  const left = itemRect.right + gap + submenuRect.width <= window.innerWidth - 8
    ? itemRect.right + gap
    : Math.max(8, itemRect.left - submenuRect.width - gap)
  const top = itemRect.top + submenuRect.height <= window.innerHeight - 8
    ? itemRect.top
    : Math.max(8, itemRect.bottom - submenuRect.height)
  moveCategorySubmenuStyle.left = `${left}px`
  moveCategorySubmenuStyle.top = `${top}px`
}

const showMoveCategorySubmenu = async () => {
  cancelHideMoveCategorySubmenu()
  moveCategorySubmenuVisible.value = true
  await nextTick()
  positionMoveCategorySubmenu()
}

const hideMoveCategorySubmenuWithDelay = () => {
  moveCategorySubmenuHideTimer = setTimeout(() => {
    moveCategorySubmenuVisible.value = false
    moveCategorySubmenuHideTimer = null
  }, 180)
}

const cancelHideMoveCategorySubmenu = () => {
  if (moveCategorySubmenuHideTimer) {
    clearTimeout(moveCategorySubmenuHideTimer)
    moveCategorySubmenuHideTimer = null
  }
}

const hideMoveCategorySubmenu = () => {
  cancelHideMoveCategorySubmenu()
  moveCategorySubmenuVisible.value = false
}

const toggleCategoryMenu = async () => {
  if (categoryMenuVisible.value) {
    categoryMenuVisible.value = false
    categoryActionMenu.visible = false
    return
  }
  newCanvasMenuVisible.value = false
  cardMenu.visible = false
  await nextTick()
  const rect = categoryTriggerRef.value?.getBoundingClientRect()
  if (rect) {
    categoryMenuStyle.left = `${rect.left}px`
    categoryMenuStyle.top = `${rect.bottom + 4}px`
  }
  categoryMenuVisible.value = true
}

const selectCategory = (id) => {
  currentCategoryId.value = id
  categoryMenuVisible.value = false
  categoryActionMenu.visible = false
  const firstCanvas = filteredCanvases.value[0]
  if (firstCanvas) drawingStore.selectCanvas(firstCanvas.id)
}

// Electron 不支持 window.prompt，用应用内弹窗输入分类名称
const categoryInput = reactive({ visible: false, mode: 'create', value: '', category: null })
const categoryInputRef = ref(null)

const openCategoryInput = (mode, category = null) => {
  categoryInput.mode = mode
  categoryInput.category = category
  categoryInput.value = mode === 'rename' ? (category?.name || '') : ''
  categoryInput.visible = true
  nextTick(() => {
    categoryInputRef.value?.focus()
    categoryInputRef.value?.select()
  })
}

const cancelCategoryInput = () => {
  categoryInput.visible = false
  categoryInput.value = ''
  categoryInput.category = null
}

const confirmCategoryInput = () => {
  const name = categoryInput.value.trim()
  if (!name) return
  if (categoryInput.mode === 'create') {
    const category = drawingStore.createCategory(name)
    if (category && cardMenu.canvas) drawingStore.moveCanvas(cardMenu.canvas.id, category.id)
    cardMenu.visible = false
    hideMoveCategorySubmenu()
  } else if (categoryInput.category) {
    drawingStore.renameCategory(categoryInput.category.id, name)
    categoryActionMenu.visible = false
  }
  cancelCategoryInput()
}

const createCategoryForCanvas = () => {
  openCategoryInput('create')
}

const openCategoryActions = (event, category) => {
  const rect = event.currentTarget?.getBoundingClientRect()
  if (!rect) return
  categoryActionMenu.category = category
  categoryActionMenu.x = rect.right + 4
  categoryActionMenu.y = rect.top
  categoryActionMenu.visible = true
}

const renameCategory = () => {
  const category = categoryActionMenu.category
  if (!category) return
  openCategoryInput('rename', category)
}

const deleteCategory = () => {
  const category = categoryActionMenu.category
  if (!category) return
  if (!window.confirm(t('drawing.sidebar.deleteCategoryConfirm', { name: category.name }))) return
  drawingStore.deleteCategory(category.id)
  if (currentCategoryId.value === category.id) currentCategoryId.value = 'all'
  categoryActionMenu.visible = false
}

const moveCanvasToCategory = (categoryId) => {
  if (!cardMenu.canvas) return
  drawingStore.moveCanvas(cardMenu.canvas.id, ['all', 'uncategorized'].includes(categoryId) ? null : categoryId)
  cardMenu.visible = false
  hideMoveCategorySubmenu()
}

const duplicateCanvas = (canvas) => {
  if (!canvas) return
  const base = canvas.title || t(`drawing.canvas.${canvas.titleKey || 'untitled'}`)
  drawingStore.duplicateCanvas(canvas.id, `${base} ${t('drawing.sidebar.copySuffix')}`)
  cardMenu.visible = false
}

const startRename = (canvas) => {
  renamingId.value = canvas.id
  cardMenu.visible = false
  nextTick(() => {
    const input = document.querySelector('.rename-input')
    if (input) {
      input.focus()
      input.select()
    }
  })
}

const commitRename = (event, canvas) => {
  const title = event.target.value.trim()
  if (title) drawingStore.renameCanvas(canvas.id, title)
  renamingId.value = null
}

const removeCanvas = (canvas) => {
  drawingStore.deleteCanvas(canvas.id)
  cardMenu.visible = false
}

const onGraphChange = ({ id, graphJSON }) => {
  if (id && graphJSON) drawingStore.saveGraph(id, graphJSON)
}

let initialPointerX = 0
let initialWidth = 0

const resizeSidebar = (event) => {
  sidebarWidth.value = Math.min(
    SIDEBAR_MAX_WIDTH,
    Math.max(SIDEBAR_MIN_WIDTH, initialWidth + event.clientX - initialPointerX)
  )
}

const stopResizing = () => {
  isResizing.value = false
  window.removeEventListener('mousemove', resizeSidebar)
  window.removeEventListener('mouseup', stopResizing)
}

const startResizing = (event) => {
  isResizing.value = true
  initialPointerX = event.clientX
  initialWidth = sidebarWidth.value
  window.addEventListener('mousemove', resizeSidebar)
  window.addEventListener('mouseup', stopResizing)
}

onUnmounted(() => {
  stopResizing()
  cancelHideMoveCategorySubmenu()
  window.removeEventListener('blur', closeMenus)
})
</script>

<style scoped>
.drawing-page { position: relative; display: flex; height: 100%; min-height: 0; color: var(--text-primary); background: var(--bg-primary); overflow: hidden; }
.drawing-sidebar { position: relative; display: flex; flex: 0 0 auto; flex-direction: column; min-width: 0; overflow: hidden; border-right: 1px solid var(--border-color); background: var(--bg-primary); transition: width .2s ease; }
.drawing-sidebar.is-resizing { transition: none; }
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
.new-canvas-dropdown-menu { position: absolute; z-index: 40; top: 36px; right: 0; display: flex; flex-direction: column; gap: 2px; min-width: 112px; padding: 4px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-primary); box-shadow: 0 4px 16px rgba(0, 0, 0, .12); }
.dropdown-item { display: flex; align-items: center; width: 100%; gap: 8px; padding: 5px 8px; border: 0; border-radius: 5px; color: var(--text-primary); background: transparent; font-size: 12px; text-align: left; cursor: pointer; }
.dropdown-item:hover { background: var(--bg-hover); }
.sidebar-search { display: flex; align-items: center; gap: 6px; height: 56px; padding: 12px; box-sizing: border-box; color: var(--text-tertiary); }
.sidebar-search input { flex: 1; min-width: 0; height: 32px; padding: 0; border: 0; outline: 0; color: var(--text-primary); background: transparent; font-size: 14px; }
.directory-heading { padding: 0 12px 10px; color: var(--text-secondary); font-size: 12px; font-weight: 600; }
.category-trigger { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; padding: 6px 8px; border: 0; border-radius: 8px; color: var(--text-primary); background: transparent; font-size: 12px; font-weight: 600; cursor: pointer; }
.category-trigger:hover { background: var(--bg-hover); }
.category-trigger span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.category-dropdown, .category-action-menu { position: fixed; z-index: 100; padding: 4px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-primary); box-shadow: 0 8px 20px rgba(0, 0, 0, .14); }
.category-dropdown { display: flex; flex-direction: column; gap: 4px; min-width: 156px; max-height: min(420px, calc(100vh - 120px)); overflow-y: auto; }
.category-item { display: flex; align-items: center; flex: 0 0 auto; width: 100%; gap: 8px; padding: 5px 8px; border: 0; border-radius: 6px; color: var(--text-primary); background: transparent; font-size: 12px; text-align: left; cursor: pointer; }
.category-item:hover { background: var(--bg-hover); }
.category-item.active { background: var(--bg-active); }
.category-item-info { display: flex; flex: 1; flex-direction: column; min-width: 0; gap: 1px; }
.category-item-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.category-item-info small { color: var(--text-tertiary); font-size: 10px; font-weight: 400; }
.category-action { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 4px; color: var(--text-tertiary); background: transparent; cursor: pointer; }
.category-action:hover { color: var(--text-primary); background: var(--bg-hover); }
.category-divider, .card-menu-divider { height: 1px; margin: 4px 2px; background: var(--border-color); }
.category-action-menu { min-width: 120px; padding: 3px; }
.category-action-menu button { display: block; width: 100%; padding: 7px 8px; border: 0; border-radius: 5px; color: var(--text-primary); background: transparent; font-size: 12px; text-align: left; cursor: pointer; }
.category-action-menu button:hover { background: var(--bg-hover); }
.category-action-menu .danger { color: #e11d48; }
.canvas-list { display: grid; flex: 1 1 auto; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: max-content; align-content: start; gap: 10px; min-height: 0; justify-content: start; padding: 0 14px 16px; overflow-y: auto; }
.canvas-card { display: flex; flex: 0 0 auto; flex-direction: column; min-width: 0; padding: 0; overflow: hidden; border: 1px solid var(--border-color); border-radius: 6px; color: inherit; background: var(--bg-primary); text-align: left; cursor: pointer; }
.canvas-card:hover { border-color: #a8a29e; }
.canvas-card.active, .canvas-card.active:hover { border-color: #1c1917; box-shadow: none; }
.canvas-preview { position: relative; display: flex; width: 100%; aspect-ratio: 3 / 2; align-items: center; justify-content: center; overflow: hidden; color: var(--text-tertiary); border-bottom: 1px solid var(--border-color); background-color: color-mix(in srgb, var(--bg-secondary) 72%, transparent); }
.canvas-card-footer { display: flex; flex-direction: column; gap: 2px; padding: 5px 6px; flex-shrink: 0; }
.canvas-card-footer strong { height: 16px; overflow: hidden; font-size: 12px; line-height: 16px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.canvas-card-footer small { color: var(--text-tertiary); font-size: 10px; line-height: 1.2; }
.canvas-card-meta { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.canvas-card-meta span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rename-input { width: 100%; height: 16px; box-sizing: border-box; padding: 0; border: 0; outline: 0; color: var(--text-primary); background: transparent; font-size: 12px; line-height: 16px; font-weight: 600; }
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
.card-menu {
  position: fixed;
  z-index: 50;
  min-width: 120px;
  max-height: calc(100vh - 16px);
  padding: 4px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  overflow-y: auto;
  box-shadow: 0 8px 20px rgba(0, 0, 0, .12);
}
.card-menu button {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 7px 8px;
  border: 0;
  border-radius: 5px;
  color: var(--text-primary);
  background: transparent;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.card-menu-label { padding: 4px 8px 2px; color: var(--text-tertiary); font-size: 10px; }
.card-menu button.active { background: var(--bg-active); }
.card-menu button:hover { background: var(--bg-hover); }
.card-menu .danger { color: #e11d48; }
.card-menu-item, .submenu-item { display: flex; align-items: center; gap: 6px; width: 100%; padding: 7px 8px; border: 0; border-radius: 5px; color: var(--text-primary); background: transparent; font-size: 12px; text-align: left; cursor: pointer; }
.card-menu-item:hover, .submenu-item:hover { background: var(--bg-hover); }
.card-menu-item.has-submenu { cursor: default; }
.card-menu-arrow { margin-left: auto; color: var(--text-tertiary); }
.move-category-submenu { position: fixed; z-index: 60; min-width: 160px; max-height: calc(100vh - 16px); padding: 4px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-primary); overflow-y: auto; box-shadow: 0 8px 20px rgba(0, 0, 0, .12); }
.move-category-submenu .submenu-item { width: 100%; }
.hidden-input { display: none; }
.category-input-overlay { position: fixed; inset: 0; z-index: 200; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, .25); }
.category-input-card { display: flex; flex-direction: column; gap: 12px; width: 300px; max-width: 90vw; padding: 18px; border: 1px solid var(--border-color); border-radius: 12px; background: var(--bg-primary); box-shadow: 0 8px 28px rgba(0, 0, 0, .18); }
.category-input-card strong { font-size: 14px; }
.category-input-card input { height: 32px; padding: 0 10px; border: 1px solid var(--border-color); border-radius: 8px; outline: 0; color: var(--text-primary); background: var(--bg-secondary); font-size: 13px; }
.category-input-card input:focus { border-color: var(--accent-color); }
.category-input-actions { display: flex; justify-content: flex-end; gap: 8px; }
.category-input-actions button { padding: 6px 14px; border: 0; border-radius: 7px; color: var(--text-primary); background: var(--bg-hover); font-size: 12px; cursor: pointer; }
.category-input-actions button:hover { background: var(--bg-active); }
.category-input-actions button.primary { color: #fff; background: var(--accent-color); }
@media (max-width: 760px) { .drawing-sidebar { width: min(272px, 72vw) !important; } .canvas-list { grid-template-columns: 1fr; } }
</style>
