<template>
  <div class="knowledge-base">
    <div
      class="kb-sidebar"
      :class="{ collapsed: sidebarCollapsed, 'is-resizing': isResizing }"
      :style="{ width: sidebarCollapsed ? '0px' : sidebarWidth + 'px' }"
    >
      <div class="sidebar-inner" v-show="!sidebarCollapsed">
        <div class="sidebar-topbar" v-if="!searchMode">
          <button class="topbar-btn" @click="toggleSidebar" title="收起侧边栏">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="3" y="3" width="18" height="18" rx="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
            </svg>
          </button>
          <div class="topbar-actions">
            <button class="topbar-btn" @click="enterSearchMode" title="搜索">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>
        </div>

        <div class="sidebar-search" v-else>
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            class="search-input"
            type="text"
            placeholder="搜索(按ESC退出)..."
            @keydown.escape="exitSearchMode"
          />
        </div>

        <div class="sidebar-content">
          <div class="category-group" v-for="category in categories" :key="category.id">
            <div class="category-header" @click="toggleCategory(category.id)">
              <svg class="expand-icon" :class="{ expanded: category.expanded }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
              <span class="category-name">{{ category.name }}</span>
              <button class="add-btn" @click.stop="addKnowledgeBase(category.id)" title="添加知识库">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            </div>
            <div class="category-items" v-show="category.expanded">
              <div
                v-for="item in category.items"
                :key="item.id"
                :class="['kb-item', { active: selectedKB === item.id }]"
                @click="selectKnowledgeBase(item.id, item.name)"
                @contextmenu.prevent="showContextMenu($event, category.id, item)"
              >
                <img v-if="item.coverIndex != null && coverOptions[item.coverIndex]" class="item-icon" :src="coverOptions[item.coverIndex]" alt="" />
                <svg v-else class="item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                <span class="item-name">{{ item.name }}</span>
              </div>
            </div>
          </div>
          <div class="sidebar-footer">
            <p class="footer-text">本地知识库中可添加多种类型文档</p>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="!sidebarCollapsed"
      class="sidebar-resize-handle"
      @mousedown="onResizeStart"
    ></div>

    <button
      v-if="sidebarCollapsed"
      class="sidebar-expand-btn"
      @click="toggleSidebar"
      title="展开侧边栏"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
        <line x1="9" y1="3" x2="9" y2="21"></line>
      </svg>
    </button>

    <div class="kb-main">
      <div class="main-header">
        <div class="header-left">
          <button class="nav-btn" @click="goBack">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <button class="nav-btn" @click="goForward">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
          <h1 class="page-title">{{ currentTitle }}</h1>
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
          <button class="icon-btn" title="刷新">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="file-grid">
        <div
          v-for="file in files"
          :key="file.id"
          class="file-card"
          @click="openFile(file)"
        >
          <div class="file-preview">
            <img :src="getFileIcon(file.type)" class="preview-icon" alt="" />
          </div>
          <div class="file-info">
            <h3 class="file-name">{{ file.name }}</h3>
            <div class="file-meta">
              <div class="meta-left">
                <span class="meta-type" :class="file.type">{{ getTypeLabel(file.type) }}</span>
                <span v-if="file.count" class="meta-count">{{ file.count }}</span>
              </div>
              <div class="meta-right">
                <span v-if="file.date" class="meta-date">{{ file.date }}</span>
                <span v-if="file.time" class="meta-time">{{ file.time }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="question-box">
        <div class="input-wrapper">
          <textarea
            v-model="question"
            class="main-input"
            placeholder="基于知识库提问"
            rows="1"
            @input="autoResize"
            ref="textareaRef"
          ></textarea>

          <div class="input-actions">
            <div class="action-left">
              <button class="action-btn dropdown-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>对话模式</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              <button class="action-btn dropdown-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10 15.3 15.3 0 0 1-4-10z"></path>
                </svg>
                <span>DS 快速</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              <button class="action-btn icon-only">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="4"></circle>
                  <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path>
                </svg>
              </button>
            </div>

            <div class="action-right">
              <button class="action-btn icon-only">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
              </button>

              <button class="action-btn icon-only">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="6" cy="6" r="3"></circle>
                  <circle cx="6" cy="18" r="3"></circle>
                  <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
                  <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
                  <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
                </svg>
              </button>

              <button
                class="send-btn"
                :class="{ active: question.trim() }"
                @click="askQuestion"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="context-menu-overlay" @mousedown="hideContextMenu"
      >
        <div
          class="context-menu"
          :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
          @click.stop
        >
          <div class="context-menu-item" @mousedown="editKnowledgeBase">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            <span>编辑</span>
          </div>
          <div class="context-menu-item danger" @mousedown="deleteKnowledgeBase">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
            <span>删除</span>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <!-- 创建知识库弹窗 -->
      <div v-if="showCreateDialog" class="create-kb-overlay" @click.self="closeCreateDialog">
        <div class="create-kb-dialog">
          <div class="create-kb-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            <span class="create-kb-title">{{ editingKBId ? '编辑' : '创建' }}{{ currentCategoryName }}</span>
            <button class="create-kb-close" @click="closeCreateDialog">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="create-kb-body">
            <div class="form-row">
              <label class="form-label">名称 <span class="required">*</span></label>
              <input
                ref="kbNameInputRef"
                v-model="newKB.name"
                type="text"
                class="form-input"
                placeholder="请输入知识库名称"
                @keydown.enter="confirmCreateKB"
              />
            </div>

            <div class="form-row">
              <label class="form-label">封面</label>
              <div class="cover-grid">
                <div
                  v-for="(cover, index) in coverOptions"
                  :key="index"
                  :class="['cover-item', { selected: newKB.coverIndex === index, 'is-upload': index === -1 }]"
                  @click="selectCover(index)"
                >
                  <template v-if="index === -1">
                    <svg class="upload-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                      <line x1="12" y1="19" x2="12" y2="5"></line>
                      <polyline points="5 12 12 5 19 12"></polyline>
                      <line x1="5" y1="19" x2="19" y2="19"></line>
                    </svg>
                    <span class="upload-text">上传</span>
                  </template>
                  <img v-else :src="cover" class="cover-img" alt="" />
                </div>
              </div>
            </div>

            <div class="form-row">
              <label class="form-label">描述</label>
              <textarea
                v-model="newKB.description"
                class="form-textarea"
                placeholder="请输入知识库描述（可选）"
                rows="2"
              ></textarea>
            </div>
          </div>

          <div class="create-kb-footer">
            <button class="kb-btn kb-btn-cancel" @click="closeCreateDialog">取消</button>
            <button class="kb-btn kb-btn-confirm" :disabled="!newKB.name.trim()" @click="confirmCreateKB">确认</button>
          </div>
        </div>
      </div>

      <!-- 功能开发中提示 -->
      <div v-if="showModal" class="modal-overlay" @click="closeModal">
        <div class="modal-content" @click.stop>
          <div class="modal-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h2 class="modal-title">功能开发中</h2>
          <p class="modal-message">该功能还未实现，正在努力开发中...</p>
          <button class="modal-btn" @click="closeModal">我知道了</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick } from 'vue';
import folderIcon from '@/assets/images/文件夹.svg';
import documentIcon from '@/assets/images/文档.svg';

const selectedKB = ref('cheney-kb');
const currentTitle = ref('Cheney的知识库');
const question = ref('');
const textareaRef = ref(null);
const showModal = ref(false);
const sidebarCollapsed = ref(false);
const sidebarWidth = ref(240);
const isResizing = ref(false);
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 280;
const searchMode = ref(false);
const searchQuery = ref('');
const searchInputRef = ref(null);

// 创建知识库弹窗
const showCreateDialog = ref(false);
const currentCategoryId = ref('');
const currentCategoryName = ref('');
const kbNameInputRef = ref(null);

const newKB = reactive({
  name: '',
  description: '',
  coverIndex: 0
});

// 编辑模式：记录正在编辑的知识库 ID，null 表示新建
const editingKBId = ref(null);

// 右键菜单状态
const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  categoryId: '',
  item: null
});

// 封面选项（使用内联 SVG data URI 模拟设计图中的图标）
const coverOptions = [
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="#B8E6D5"/><rect x="20" y="18" width="40" height="44" rx="4" fill="#fff" opacity="0.8"/><line x1="28" y1="30" x2="52" y2="30" stroke="#7BC9A8" stroke-width="3" stroke-linecap="round"/><line x1="28" y1="40" x2="48" y2="40" stroke="#7BC9A8" stroke-width="3" stroke-linecap="round"/><line x1="28" y1="50" x2="44" y2="50" stroke="#7BC9A8" stroke-width="3" stroke-linecap="round"/></svg>'),
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="#A8C8F8"/><rect x="14" y="12" width="52" height="56" rx="8" fill="#fff" opacity="0.85"/><path d="M24 48 L36 58 L60 30" stroke="#6B9FE8" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'),
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="#C5E1A5"/><rect x="22" y="10" width="24" height="60" rx="4" fill="#fff" opacity="0.75"/><rect x="26" y="16" width="16" height="20" rx="2" fill="#9CCC65" opacity="0.6"/></svg>'),
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="#E6D2B5"/><ellipse cx="40" cy="46" rx="22" ry="18" fill="#D4A574"/><path d="M25 38 Q32 34 40 38 Q48 42 55 38" stroke="#8B6914" stroke-width="2.5" fill="none" opacity="0.4"/></svg>'),
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="#E8A598"/><circle cx="40" cy="40" r="24" fill="#333" opacity="0.85"/><circle cx="40" cy="40" r="8" fill="#E8A598"/></svg>'),
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="#CE93D8"/><circle cx="32" cy="32" r="16" fill="#FFB74D" opacity="0.8"/><path d="M16 64 L40 40 L64 64 Z" fill="#F8BBD9" opacity="0.7"/></svg>')
]; // index -1 表示上传

const categories = reactive([
  {
    id: 'personal',
    name: '个人知识库',
    expanded: true,
    items: [
      { id: 'cheney-kb', name: 'Cheney的知识库' },
      { id: '2342342', name: '工作知识库' }
    ]
  },
  {
    id: 'agent',
    name: 'Agent知识库',
    expanded: true,
    items: [
      { id: 'rag-thinking', name: 'SKILL' }
    ]
  },
  {
    id: 'local',
    name: '本地知识库',
    expanded: false,
    items: []
  }
]);

const files = ref([
  { id: '1', name: '我的笔记', type: 'folder', count: '0项', time: '22:43创建' },
  { id: '2', name: '我的叔叔于勒', type: 'note', count: '', time: '22:44更新' },
  { id: '3', name: '计算机网路：自顶向下方法（原书第8版）(...', type: 'pdf', date: '4/19', time: '' },
  { id: '4', name: 'Fraday知识库使用指南.docx', type: 'word', date: '4/4', time: '' }
]);

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
}

function onResizeStart(e) {
  e.preventDefault();
  isResizing.value = true;
  const startX = e.clientX;
  const startWidth = sidebarWidth.value;

  const onResizeMove = (moveEvent) => {
    const delta = moveEvent.clientX - startX;
    const newWidth = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, startWidth + delta));
    sidebarWidth.value = newWidth;
  };

  const onResizeEnd = () => {
    isResizing.value = false;
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeEnd);
}

function enterSearchMode() {
  searchMode.value = true;
  nextTick(() => {
    searchInputRef.value?.focus();
  });
}

function exitSearchMode() {
  searchMode.value = false;
  searchQuery.value = '';
}

function toggleCategory(id) {
  const category = categories.find(c => c.id === id);
  if (category) {
    category.expanded = !category.expanded;
  }
}

function selectKnowledgeBase(id, name) {
  selectedKB.value = id;
  currentTitle.value = name;
}

function addKnowledgeBase(categoryId) {
  const category = categories.find(c => c.id === categoryId);
  if (category) {
    currentCategoryId.value = categoryId;
    currentCategoryName.value = category.name;
    newKB.name = '';
    newKB.description = '';
    newKB.coverIndex = 0;
    showCreateDialog.value = true;
    nextTick(() => {
      kbNameInputRef.value?.focus();
    });
  }
}

function selectCover(index) {
  newKB.coverIndex = index;
}

function closeCreateDialog() {
  showCreateDialog.value = false;
  editingKBId.value = null;
}

function confirmCreateKB() {
  if (!newKB.name.trim()) return;

  const category = categories.find(c => c.id === currentCategoryId.value);
  if (!category) return;

  if (editingKBId.value) {
    // 编辑模式：更新已有知识库
    const item = category.items.find(i => i.id === editingKBId.value);
    if (item) {
      item.name = newKB.name.trim();
      item.description = newKB.description.trim();
      item.coverIndex = newKB.coverIndex;
      if (selectedKB.value === item.id) {
        currentTitle.value = item.name;
      }
    }
  } else {
    // 新建模式
    const newId = `kb-${Date.now()}`;
    category.items.push({
      id: newId,
      name: newKB.name.trim(),
      description: newKB.description.trim(),
      coverIndex: newKB.coverIndex
    });
    selectedKB.value = newId;
    currentTitle.value = newKB.name.trim();
  }
  closeCreateDialog();
}

// 右键菜单
function showContextMenu(event, categoryId, item) {
  contextMenu.visible = true;
  contextMenu.x = event.clientX;
  contextMenu.y = event.clientY;
  contextMenu.categoryId = categoryId;
  contextMenu.item = item;
}

function hideContextMenu() {
  contextMenu.visible = false;
  contextMenu.item = null;
}

function editKnowledgeBase() {
  if (!contextMenu.item) return;
  const itemId = contextMenu.item.id;
  const categoryId = contextMenu.categoryId;
  const itemName = contextMenu.item.name || '';
  const itemDesc = contextMenu.item.description || '';
  const itemCoverIndex = contextMenu.item.coverIndex ?? 0;

  hideContextMenu();

  editingKBId.value = itemId;
  currentCategoryId.value = categoryId;
  const cat = categories.find(c => c.id === categoryId);
  currentCategoryName.value = cat ? cat.name : '';

  newKB.name = itemName;
  newKB.description = itemDesc;
  newKB.coverIndex = itemCoverIndex;

  showCreateDialog.value = true;
  nextTick(() => {
    kbNameInputRef.value?.focus();
  });
}

function deleteKnowledgeBase() {
  if (!contextMenu.item) return;
  const categoryId = contextMenu.categoryId;
  const itemId = contextMenu.item.id;
  hideContextMenu();

  const category = categories.find(c => c.id === categoryId);
  if (!category) return;

  const index = category.items.findIndex(i => i.id === itemId);
  if (index !== -1) {
    category.items.splice(index, 1);
    if (selectedKB.value === itemId) {
      selectedKB.value = '';
      currentTitle.value = '知识库';
    }
  }
}

function goBack() {
  console.log('Go back');
}

function goForward() {
  console.log('Go forward');
}

function openFile(file) {
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
}

function askQuestion() {
  if (question.value.trim()) {
    console.log('Ask question:', question.value);
  }
}

function autoResize() {
  const textarea = textareaRef.value;
  if (textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  }
}

function getFileIcon(type) {
  const icons = {
    folder: folderIcon,
    note: documentIcon,
    pdf: documentIcon,
    word: documentIcon
  };
  return icons[type] || folderIcon;
}

function getTypeLabel(type) {
  const labels = {
    folder: '',
    note: '笔记',
    pdf: 'PDF',
    word: 'WORD'
  };
  return labels[type] || '';
}
</script>

<style scoped lang="scss">
.knowledge-base {
  display: flex;
  height: 100vh;
  background: var(--bg-primary);
  position: relative;
}

.kb-sidebar {
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border-right: 1px solid var(--border-color);
  overflow: hidden;
  transition: width 0.2s ease;

  &.is-resizing {
    transition: none;
  }

  &.collapsed {
    width: 0 !important;
  }

  .sidebar-inner {
    min-width: 200px;
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .sidebar-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 12px 8px;
    height: 56px;
    box-sizing: border-box;
    flex-shrink: 0;

    .topbar-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: none;
      background-color: transparent;
      color: var(--text-primary);
      cursor: pointer;

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }
    }

    .topbar-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }

  .sidebar-search {
    display: flex;
    align-items: center;
    padding: 10px 12px 8px;
    gap: 6px;
    flex-shrink: 0;

    .search-icon {
      color: var(--text-tertiary);
      flex-shrink: 0;
    }

    .search-input {
      flex: 1;
      border: none;
      outline: none;
      background: transparent;
      font-size: 13px;
      color: var(--text-primary);
      padding: 4px 0;

      &::placeholder {
        color: var(--text-tertiary);
      }
    }
  }

  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding: 2px 0 16px;
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 0, 0, 0.15) transparent;

    &::-webkit-scrollbar {
      width: 5px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background-color: rgba(0, 0, 0, 0.15);
      border-radius: 10px;
    }

    &::-webkit-scrollbar-thumb:hover {
      background-color: rgba(0, 0, 0, 0.25);
    }

    .category-group {
      margin-bottom: 4px;

      .category-header {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        cursor: pointer;
        user-select: none;
        transition: background 0.2s;

        &:hover {
          background: var(--bg-hover);
        }

        .expand-icon {
          margin-right: 6px;
          transition: transform 0.2s;
          color: var(--text-secondary);
          flex-shrink: 0;

          &.expanded {
            transform: rotate(90deg);
          }
        }

        .category-name {
          flex: 1;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
        }

        .add-btn {
          padding: 4px;
          border: none;
          background: transparent;
          cursor: pointer;
          border-radius: 4px;
          opacity: 0;
          transition: all 0.2s;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;

          &:hover {
            background: var(--bg-active);
            color: var(--text-primary);
          }
        }

        &:hover .add-btn {
          opacity: 1;
        }
      }

      .category-items {
        .kb-item {
          display: flex;
          align-items: center;
          padding: 7px 12px 7px 30px;
          cursor: pointer;
          transition: background 0.2s;

          &:hover {
            background: var(--bg-hover);
          }

          &.active {
            background: var(--accent-light);
            color: var(--accent-color);

            .item-icon {
              color: var(--accent-color);
            }
          }

          .item-icon {
            margin-right: 8px;
            color: var(--text-tertiary);
            flex-shrink: 0;
            width: 16px;
            height: 16px;
            border-radius: 3px;
            object-fit: cover;
          }

          .item-name {
            font-size: 13px;
            color: var(--text-primary);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      }
    }

    .sidebar-footer {
      padding: 16px 12px;
      margin-top: auto;

      .footer-text {
        font-size: 12px;
        color: var(--text-tertiary);
        text-align: center;
      }
    }
  }
}

.sidebar-expand-btn {
  position: absolute;
  left: 8px;
  top: 12px;
  z-index: 10;
  padding: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  color: var(--text-secondary);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
}

.sidebar-resize-handle {
  width: 2px;
  cursor: col-resize;
  flex-shrink: 0;
  transition: background-color 0.15s;

  &:hover {
    background-color: var(--bg-hover);
  }
}

.kb-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;

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
    padding: 20px 40px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 16px 24px;
    align-content: start;

    .file-card {
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 12px;
      cursor: pointer;
      transition: all 0.25s ease;
      background: var(--bg-primary);
      display: flex;
      flex-direction: column;

      &:hover {
        border-color: var(--text-tertiary);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        transform: translateY(-3px);
      }

      .file-preview {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 80px;
        margin-bottom: 8px;

        .preview-icon {
          width: 56px;
          height: 56px;
          object-fit: contain;
          opacity: 0.9;
          transition: all 0.25s ease;
        }
      }

      &:hover .preview-icon {
        transform: scale(1.05);
        opacity: 1;
      }

      .file-info {
        flex: 1;
        display: flex;
        flex-direction: column;

        .file-name {
          font-size: 12.5px;
          font-weight: 500;
          color: var(--text-primary);
          margin: 0 0 auto 6px;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          line-height: 1.4;
          text-align: center;
        }

        .file-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          gap: 6px;
          font-size: 11px;
          color: var(--text-tertiary);

          .meta-left {
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .meta-right {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-shrink: 0;
          }

          .meta-date {
            color: var(--text-tertiary);
          }

          .meta-type {
            &.note {
              color: #52c41a;
            }

            &.pdf {
              color: #fa8c16;
            }

            &.word {
              color: #1890ff;
            }
          }
        }
      }
    }
  }

  .question-box {
    flex-shrink: 0;
    padding: 12px 24px 20px;
  }

  .input-wrapper {
    max-width: 680px;
    margin: 0 auto;
    background: var(--bg-primary);
    border: 1.5px solid var(--border-color);
    border-radius: 22px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    overflow: hidden;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .input-wrapper:focus-within {
    border-color: var(--text-tertiary);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  }

  .main-input {
    width: 100%;
    padding: 14px 20px 4px;
    border: none;
    outline: none;
    resize: none;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-primary);
    background: transparent;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    min-height: 40px;
    max-height: 160px;
    overflow-y: auto;
  }

  .main-input::-webkit-scrollbar {
    width: 4px;
  }

  .main-input::-webkit-scrollbar-track {
    background: transparent;
  }

  .main-input::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 10px;
  }

  .main-input::-webkit-scrollbar-thumb:hover {
    background: var(--text-tertiary);
  }

  .main-input::placeholder {
    color: var(--text-tertiary);
  }

  .input-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 16px 10px;
  }

  .action-left,
  .action-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 11px;
    border: none;
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
    border-radius: 16px;
    font-size: 12.5px;
    font-weight: 500;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .action-btn:hover {
    background: var(--bg-secondary);
  }

  .dropdown-btn span {
    font-size: 12.5px;
  }

  .dropdown-btn {
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
  }

  .dropdown-btn:hover {
    background: var(--bg-secondary);
    border-color: var(--text-tertiary);
  }

  .icon-only {
    padding: 6px 8px;
  }

  .icon-only:not(.send-btn) {
    border: 1px solid var(--border-color);
    border-radius: 50%;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .send-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: var(--text-tertiary);
    color: #ffffff;
    cursor: pointer;
    border-radius: 50%;
    transition: all 0.2s ease;
    margin-left: 2px;
  }

  .send-btn.active {
    background: var(--text-secondary);
    color: #ffffff;
  }

  .send-btn:hover {
    transform: scale(1.06);
  }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease-out;
}

.modal-content {
  background: var(--bg-primary);
  border-radius: 16px;
  padding: 40px 48px;
  text-align: center;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease-out;
}

.modal-icon {
  color: #faad14;
  margin-bottom: 20px;
}

.modal-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px 0;
}

.modal-message {
  font-size: 15px;
  color: var(--text-secondary);
  margin: 0 0 28px 0;
  line-height: 1.5;
}

.modal-btn {
  padding: 10px 32px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.modal-btn:hover {
  background: var(--accent-hover, var(--accent-color));
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 创建知识库弹窗
.create-kb-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease-out;
}

.create-kb-dialog {
  background: var(--bg-primary);
  border-radius: 16px;
  width: 400px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.25s ease-out;
}

.create-kb-header {
  display: flex;
  align-items: center;
  padding: 14px 18px 10px;
  gap: 8px;

  .create-kb-title {
    flex: 1;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .create-kb-close {
    padding: 4px;
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

.create-kb-body {
  padding: 0 18px 12px;

  .form-row {
    margin-bottom: 12px;

    &:last-child {
      margin-bottom: 0;
    }

    .form-label {
        display: block;
        font-size: 13px;
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 5px;

      .required {
        color: #e74c3c;
        margin-left: 2px;
      }
    }

    .form-input {
        width: 100%;
        padding: 7px 10px;
        border: 1.5px solid var(--border-color);
        border-radius: 8px;
      outline: none;
      font-size: 14px;
      color: var(--text-primary);
      background: var(--bg-primary);
      transition: border-color 0.2s;
      box-sizing: border-box;

      &::placeholder {
        color: var(--text-tertiary);
      }

      &:focus {
        border-color: var(--text-tertiary);
      }
    }

    .form-textarea {
        width: 100%;
        padding: 7px 10px;
        border: 1.5px solid var(--border-color);
        border-radius: 8px;
        outline: none;
        font-size: 13px;
        color: var(--text-primary);
        background: var(--bg-primary);
        transition: border-color 0.2s;
        resize: vertical;
        min-height: 48px;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;

      &::placeholder {
        color: var(--text-tertiary);
      }

      &:focus {
        border-color: var(--text-tertiary);
      }
    }

    .cover-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;

      .cover-item {
        width: 52px;
        height: 52px;
        border-radius: 8px;
        cursor: pointer;
        overflow: hidden;
        border: 2px solid transparent;
        transition: all 0.2s;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: var(--bg-secondary);

        &.is-upload {
          border-style: dashed;
          border-color: var(--border-color);

          &:hover {
            border-color: var(--text-tertiary);
            background: var(--bg-hover);
          }

          .upload-icon {
            color: var(--text-tertiary);
            width: 16px;
            height: 16px;
          }

          .upload-text {
            font-size: 10px;
            color: var(--text-tertiary);
          }
        }

        &:not(.is-upload) {
          padding: 4px;

          .cover-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 6px;
          }
        }

        &.selected {
          border-color: var(--accent-color);
          box-shadow: 0 0 0 2px rgba(var(--accent-rgb, 64, 158, 255), 0.15);
        }

        &:hover:not(.selected) {
          border-color: var(--text-tertiary);
        }
      }
    }
  }
}

.create-kb-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 10px 18px 14px;

  .kb-btn {
    padding: 7px 22px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .kb-btn-cancel {
    background: var(--bg-secondary);
    color: var(--text-primary);

    &:hover {
      background: var(--bg-hover);
    }
  }

  .kb-btn-confirm {
    background: var(--accent-color);
    color: white;

    &:hover:not(:disabled) {
      filter: brightness(1.05);
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }
}

// 右键菜单
.context-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 1001;
}

.context-menu {
  position: fixed;
  z-index: 1002;
  min-width: 130px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);

  .context-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    font-size: 13px;
    color: var(--text-primary);
    cursor: pointer;
    border-radius: 5px;
    transition: background 0.15s;

    &:hover {
      background: var(--bg-hover);
    }

    &.danger {
      color: #e53935;

      &:hover {
        background: rgba(229, 57, 53, 0.08);
      }
    }
  }
}

// 暗色主题滚动条
[data-theme='dark'] .kb-sidebar .sidebar-content {
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}

[data-theme='dark'] .kb-sidebar .sidebar-content::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
}

[data-theme='dark'] .kb-sidebar .sidebar-content::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.25);
}
</style>
