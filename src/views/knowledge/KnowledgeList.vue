<template>
  <div class="knowledge-base">
    <div
      class="kb-sidebar"
      :class="{ collapsed: sidebarCollapsed, 'is-resizing': isResizing }"
      :style="{ '--sidebar-width': sidebarWidth + 'px' }"
    >
      <div class="sidebar-inner">
        <div class="sidebar-top-area">
          <div class="sidebar-topbar" v-show="!searchMode">
            <button class="topbar-btn" @click="toggleSidebar" title="收起侧边栏">
              <SidebarIcon />
            </button>
            <div class="topbar-actions">
              <button class="topbar-btn" @click="enterSearchMode" title="搜索">
                <SearchIcon />
              </button>
            </div>
          </div>

          <div class="sidebar-search" v-show="searchMode">
            <SearchIcon :size="16" class="search-icon" />
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              class="search-input"
              type="text"
              placeholder="搜索(按ESC退出)..."
              @keydown.escape="exitSearchMode"
            />
          </div>
        </div>

        <div class="sidebar-content">
          <template v-for="category in filteredCategories" :key="category.id">
            <div class="category-group" v-if="category._matched || !searchQuery">
              <div class="category-header" @click="toggleCategory(category.id)">
                <ChevronIcon :class="{ expanded: category.expanded }" />
                <span class="category-name">{{ category.name }}</span>
                <button v-if="!searchQuery" class="add-btn" @click.stop="addKnowledgeBase(category.id)" title="添加知识库">
                  <PlusIcon :size="14" />
                </button>
              </div>
              <Transition name="slide">
                <div class="category-items" v-if="category.expanded">
                  <div
                    v-for="item in category.items"
                    :key="item.id"
                    :class="['kb-item', { active: selectedKB === item.id }]"
                    @click="selectKnowledgeBase(item.id, item.name, category.id)"
                    @contextmenu.prevent="showContextMenu($event, category.id, item)"
                  >
                    <img v-if="item.coverIndex != null && coverOptions[item.coverIndex]" class="item-icon" :src="coverOptions[item.coverIndex]" alt="" />
                    <BookIcon v-else :size="16" class="item-icon-fallback" />
                    <span class="item-name">{{ item.name }}</span>
                  </div>
                </div>
              </Transition>
            </div>
          </template>
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
      <SidebarIcon />
    </button>

    <div class="kb-main">
      <div class="main-header">
        <div class="header-left">
          <button class="nav-btn" @click="goBack" :disabled="!canGoBack">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <button class="nav-btn" @click="goForward" :disabled="!canGoForward">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
          <div class="breadcrumb" v-if="selectedKB">
            <template v-for="(segment, index) in pathSegments" :key="index">
              <span
                class="breadcrumb-item"
                :class="{ active: index === pathSegments.length - 1 }"
                @click="navigateToSegment(index)"
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
          <button class="icon-btn" title="刷新" @click="refreshCurrentDir">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="file-grid" v-if="selectedKB" @contextmenu.prevent="showFileContextMenu($event)">
        <div
          v-for="file in files"
          :key="file.path"
          class="file-card"
          @click="openFile(file)"
          @dblclick="openFile(file)"
        >
          <div class="file-preview">
            <div class="file-type-icon" :class="file.type">
              <component :is="getFileIconComponent(file.type)" />
            </div>
          </div>
          <div class="file-info">
            <h3 class="file-name">{{ file.name }}</h3>
            <div class="file-meta">
              <div class="meta-left">
                <span class="meta-type" :class="file.type">{{ getTypeLabel(file.type) }}</span>
                <span v-if="file.isDirectory && file.count" class="meta-count">{{ file.count }}</span>
              </div>
              <div class="meta-right">
                <span v-if="file.modifiedTime" class="meta-date">{{ formatDate(file.modifiedTime) }}</span>
              </div>
            </div>
          </div>
        </div>
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

    <!-- 文件区域右键菜单 -->
    <Teleport to="body">
      <div
        v-if="fileContextMenu.visible"
        class="context-menu-overlay" @mousedown="hideFileContextMenu"
      >
        <div
          class="context-menu"
          :style="{ left: fileContextMenu.x + 'px', top: fileContextMenu.y + 'px' }"
          @click.stop
        >
          <div class="context-menu-item" @mousedown="openNewFolderDialog">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              <line x1="12" y1="11" x2="12" y2="17"></line>
              <line x1="9" y1="14" x2="15" y2="14"></line>
            </svg>
            <span>新建文件夹</span>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 新建文件夹对话框 -->
    <Teleport to="body">
      <div v-if="showNewFolderDialog" class="modal-overlay" @click="closeNewFolderDialog">
        <div class="modal-content new-folder-dialog" @click.stop>
          <h2 class="modal-title">新建文件夹</h2>
          <div class="new-folder-input-row">
            <input
              ref="newFolderInputRef"
              v-model="newFolderName"
              class="new-folder-input"
              placeholder="请输入文件夹名称"
              @keydown.enter="confirmNewFolder"
              autofocus
            />
          </div>
          <div class="create-kb-footer">
            <button class="kb-btn kb-btn-cancel" @click="closeNewFolderDialog">取消</button>
            <button class="kb-btn kb-btn-confirm" :disabled="!newFolderName.trim()" @click="confirmNewFolder">确认</button>
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
import { ref, reactive, computed, nextTick, defineComponent, h, onMounted } from 'vue';

// --- 可复用图标组件 ---
const IconWrapper = (pathData, defaultSize = 18) => defineComponent({
  props: { size: { type: Number, default: defaultSize } },
  render() {
    return h('svg', {
      width: this.size, height: this.size,
      viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', 'stroke-width': 2,
      innerHTML: pathData
    });
  }
});

const SidebarIcon = IconWrapper('<rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1.8"/><line x1="9" y1="3" x2="9" y2="21" stroke-width="1.8"/>');
const SearchIcon = IconWrapper('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>');
const ChevronIcon = IconWrapper('<polyline points="9 18 15 12 9 6"/>', 12);
const PlusIcon = IconWrapper('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', 14);
const BookIcon = IconWrapper('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>', 16);

// 文件类型图标组件
const FolderIcon = IconWrapper('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>', 36);
const MarkdownIcon = defineComponent({
  render() {
    return h('svg', { width: 36, height: 36, viewBox: '0 0 24 24', fill: 'none' }, [
      h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '3', fill: '#E8F5E9', stroke: '#4CAF50', 'stroke-width': '1.2' }),
      h('text', { x: '12', y: '16', 'text-anchor': 'middle', fill: '#388E3C', 'font-size': '7', 'font-weight': 'bold', 'font-family': 'monospace' }, 'MD')
    ]);
  }
});
const PdfIcon = defineComponent({
  render() {
    return h('svg', { width: 36, height: 36, viewBox: '0 0 24 24', fill: 'none' }, [
      h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '3', fill: '#FFEBEE', stroke: '#F44336', 'stroke-width': '1.2' }),
      h('text', { x: '12', y: '16', 'text-anchor': 'middle', fill: '#D32F2F', 'font-size': '7', 'font-weight': 'bold', 'font-family': 'sans-serif' }, 'PDF')
    ]);
  }
});
const TxtIcon = defineComponent({
  render() {
    return h('svg', { width: 36, height: 36, viewBox: '0 0 24 24', fill: 'none' }, [
      h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '3', fill: '#F5F5F5', stroke: '#9E9E9E', 'stroke-width': '1.2' }),
      h('text', { x: '12', y: '16', 'text-anchor': 'middle', fill: '#616161', 'font-size': '7', 'font-weight': 'bold', 'font-family': 'sans-serif' }, 'TXT')
    ]);
  }
});
const ExcelIcon = defineComponent({
  render() {
    return h('svg', { width: 36, height: 36, viewBox: '0 0 24 24', fill: 'none' }, [
      h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '3', fill: '#E8F5E9', stroke: '#4CAF50', 'stroke-width': '1.2' }),
      h('text', { x: '12', y: '16', 'text-anchor': 'middle', fill: '#2E7D32', 'font-size': '6', 'font-weight': 'bold', 'font-family': 'sans-serif' }, 'XLS')
    ]);
  }
});
const WordIcon = defineComponent({
  render() {
    return h('svg', { width: 36, height: 36, viewBox: '0 0 24 24', fill: 'none' }, [
      h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '3', fill: '#E3F2FD', stroke: '#2196F3', 'stroke-width': '1.2' }),
      h('text', { x: '12', y: '16', 'text-anchor': 'middle', fill: '#1565C0', 'font-size': '6', 'font-weight': 'bold', 'font-family': 'sans-serif' }, 'DOC')
    ]);
  }
});
const NoteIcon = defineComponent({
  render() {
    return h('svg', { width: 36, height: 36, viewBox: '0 0 24 24', fill: 'none' }, [
      h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '3', fill: '#FFF8E1', stroke: '#FFC107', 'stroke-width': '1.2' }),
      h('text', { x: '12', y: '16', 'text-anchor': 'middle', fill: '#F57F17', 'font-size': '6', 'font-weight': 'bold', 'font-family': 'sans-serif' }, 'NOTE')
    ]);
  }
});
const PptIcon = defineComponent({
  render() {
    return h('svg', { width: 36, height: 36, viewBox: '0 0 24 24', fill: 'none' }, [
      h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '3', fill: '#FFF3E0', stroke: '#FF9800', 'stroke-width': '1.2' }),
      h('text', { x: '12', y: '16', 'text-anchor': 'middle', fill: '#E65100', 'font-size': '6', 'font-weight': 'bold', 'font-family': 'sans-serif' }, 'PPT')
    ]);
  }
});
const UnknownFileIcon = defineComponent({
  render() {
    return h('svg', { width: 36, height: 36, viewBox: '0 0 24 24', fill: 'none' }, [
      h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '3', fill: '#ECEFF1', stroke: '#90A4AE', 'stroke-width': '1.2' }),
      h('text', { x: '12', y: '16', 'text-anchor': 'middle', fill: '#546E7A', 'font-size': '6', 'font-weight': 'bold', 'font-family': 'sans-serif' }, 'FILE')
    ]);
  }
});

// --- Electron API ---
const api = window.electronAPI;

// --- 状态 ---
const selectedKB = ref('');
const currentTitle = ref('知识库');
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

const showCreateDialog = ref(false);
const currentCategoryId = ref('');
const currentCategoryName = ref('');
const kbNameInputRef = ref(null);

const newKB = reactive({
  name: '',
  description: '',
  coverIndex: 0
});

const editingKBId = ref(null);

const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  categoryId: '',
  item: null
});

// 文件区域右键菜单
const fileContextMenu = reactive({
  visible: false,
  x: 0,
  y: 0
});

const showNewFolderDialog = ref(false);
const newFolderName = ref('');
const newFolderInputRef = ref(null);

const coverOptions = [
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="#B8E6D5"/><rect x="20" y="18" width="40" height="44" rx="4" fill="#fff" opacity="0.8"/><line x1="28" y1="30" x2="52" y2="30" stroke="#7BC9A8" stroke-width="3" stroke-linecap="round"/><line x1="28" y1="40" x2="48" y2="40" stroke="#7BC9A8" stroke-width="3" stroke-linecap="round"/><line x1="28" y1="50" x2="44" y2="50" stroke="#7BC9A8" stroke-width="3" stroke-linecap="round"/></svg>'),
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="#A8C8F8"/><rect x="14" y="12" width="52" height="56" rx="8" fill="#fff" opacity="0.85"/><path d="M24 48 L36 58 L60 30" stroke="#6B9FE8" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'),
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="#C5E1A5"/><rect x="22" y="10" width="24" height="60" rx="4" fill="#fff" opacity="0.75"/><rect x="26" y="16" width="16" height="20" rx="2" fill="#9CCC65" opacity="0.6"/></svg>'),
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="#E6D2B5"/><ellipse cx="40" cy="46" rx="22" ry="18" fill="#D4A574"/><path d="M25 38 Q32 34 40 38 Q48 42 55 38" stroke="#8B6914" stroke-width="2.5" fill="none" opacity="0.4"/></svg>'),
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="#E8A598"/><circle cx="40" cy="40" r="24" fill="#333" opacity="0.85"/><circle cx="40" cy="40" r="8" fill="#E8A598"/></svg>'),
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="#CE93D8"/><circle cx="32" cy="32" r="16" fill="#FFB74D" opacity="0.8"/><path d="M16 64 L40 40 L64 64 Z" fill="#F8BBD9" opacity="0.7"/></svg>')
];

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

// --- 文件系统导航状态 ---
const dataDir = ref('');
const currentPath = ref('');
const kbRootPath = ref(''); // 当前选中知识库的根目录路径
const files = ref([]);
const navigationHistory = ref([]);
const historyIndex = ref(-1);

const canGoBack = computed(() => historyIndex.value > 0);
const canGoForward = computed(() => historyIndex.value < navigationHistory.value.length - 1);

// 面包屑路径段（从知识库名开始显示）
const pathSegments = computed(() => {
  if (!currentPath.value || !kbRootPath.value) return [];
  // 以 kbRootPath 的父目录为基准，让知识库名作为第一段
  const basePath = kbRootPath.value.substring(0, kbRootPath.value.lastIndexOf('/'));
  const relativePath = currentPath.value.slice(basePath.length).replace(/^\//, '');
  const segments = relativePath.split('/').filter(Boolean);
  let accumulated = basePath;
  return segments.map(name => {
    accumulated = accumulated + '/' + name;
    return { name, path: accumulated };
  });
});

// --- 搜索过滤 ---
const filteredCategories = computed(() => {
  if (!searchQuery.value) return categories;
  const q = searchQuery.value.toLowerCase();
  return categories.map(cat => ({
    ...cat,
    _matched: cat.items.some(item => item.name.toLowerCase().includes(q)) || cat.name.toLowerCase().includes(q),
    items: cat.items.filter(item => item.name.toLowerCase().includes(q)),
    expanded: true
  }));
});

// --- 文件类型检测 ---
function getFileType(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const typeMap = {
    folder: [],
    markdown: ['md', 'markdown', 'mdx'],
    pdf: ['pdf'],
    txt: ['txt', 'text', 'log'],
    excel: ['xls', 'xlsx', 'csv'],
    word: ['doc', 'docx'],
    note: ['note'],
    ppt: ['ppt', 'pptx']
  };
  for (const [type, exts] of Object.entries(typeMap)) {
    if (exts.includes(ext)) return type;
  }
  return 'unknown';
}

function getFileIconComponent(type) {
  const iconMap = {
    folder: FolderIcon,
    markdown: MarkdownIcon,
    pdf: PdfIcon,
    txt: TxtIcon,
    excel: ExcelIcon,
    word: WordIcon,
    note: NoteIcon,
    ppt: PptIcon,
    unknown: UnknownFileIcon
  };
  return iconMap[type] || UnknownFileIcon;
}

function getTypeLabel(type) {
  const labels = {
    folder: '文件夹',
    markdown: 'Markdown',
    pdf: 'PDF',
    txt: 'TXT',
    excel: 'Excel',
    word: 'Word',
    note: '笔记',
    ppt: 'PPT',
    unknown: '文件'
  };
  return labels[type] || '文件';
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  }
  return (d.getMonth() + 1) + '/' + d.getDate();
}

// --- 文件系统操作 ---
async function loadDataDir() {
  if (!api) return;
  try {
    dataDir.value = await api.invoke('kb-get-data-dir');
  } catch (e) {
    console.error('Failed to get data dir:', e);
  }
}

async function readDirectory(dirPath) {
  if (!api) return;
  try {
    const entries = await api.invoke('kb-read-dir', { dirPath });
    files.value = entries.map(entry => ({
      name: entry.name,
      path: entry.path,
      isDirectory: entry.isDirectory,
      type: entry.isDirectory ? 'folder' : getFileType(entry.name),
      size: entry.size,
      modifiedTime: entry.modifiedTime,
      count: entry.isDirectory ? '' : ''
    }));
    // 为文件夹计算子项数量
    for (const file of files.value) {
      if (file.isDirectory) {
        try {
          const subEntries = await api.invoke('kb-read-dir', { dirPath: file.path });
          file.count = subEntries.length + '项';
        } catch {
          file.count = '0项';
        }
      }
    }
  } catch (e) {
    console.error('Failed to read directory:', e);
    files.value = [];
  }
}

async function navigateTo(dirPath, addToHistory = true) {
  currentPath.value = dirPath;
  await readDirectory(dirPath);
  if (addToHistory) {
    // 如果当前不在历史末尾，截断后面的记录
    if (historyIndex.value < navigationHistory.value.length - 1) {
      navigationHistory.value = navigationHistory.value.slice(0, historyIndex.value + 1);
    }
    navigationHistory.value.push(dirPath);
    historyIndex.value = navigationHistory.value.length - 1;
  }
}

async function selectKnowledgeBase(id, name, categoryId) {
  selectedKB.value = id;
  currentTitle.value = name;
  if (!api || !dataDir.value) return;

  // 在分类子目录下创建知识库目录
  const kbDir = dataDir.value + '/knowledge/' + categoryId + '/' + name;
  kbRootPath.value = kbDir;
  try {
    await api.invoke('kb-create-dir', { dirPath: kbDir });
  } catch (e) {
    console.error('Failed to create kb dir:', e);
  }
  await navigateTo(kbDir);
}

function goBack() {
  if (!canGoBack.value) return;
  historyIndex.value--;
  const targetPath = navigationHistory.value[historyIndex.value];
  currentPath.value = targetPath;
  readDirectory(targetPath);
}

function goForward() {
  if (!canGoForward.value) return;
  historyIndex.value++;
  const targetPath = navigationHistory.value[historyIndex.value];
  currentPath.value = targetPath;
  readDirectory(targetPath);
}

async function navigateToSegment(index) {
  const segment = pathSegments.value[index];
  if (segment && segment.path !== currentPath.value) {
    await navigateTo(segment.path);
  }
}

async function openFile(file) {
  if (file.isDirectory) {
    await navigateTo(file.path);
  }
  // 文件类型暂不处理
}

async function refreshCurrentDir() {
  if (currentPath.value) {
    await readDirectory(currentPath.value);
  }
}

// --- 文件区域右键菜单 ---
function showFileContextMenu(event) {
  fileContextMenu.visible = true;
  fileContextMenu.x = event.clientX;
  fileContextMenu.y = event.clientY;
}

function hideFileContextMenu() {
  fileContextMenu.visible = false;
}

function openNewFolderDialog() {
  hideFileContextMenu();
  newFolderName.value = '';
  showNewFolderDialog.value = true;
  nextTick(() => {
    newFolderInputRef.value?.focus();
  });
}

function closeNewFolderDialog() {
  showNewFolderDialog.value = false;
  newFolderName.value = '';
}

async function confirmNewFolder() {
  const folderName = newFolderName.value.trim();
  if (!folderName || !currentPath.value || !api) return;

  try {
    const result = await api.invoke('kb-mkdir', {
      parentPath: currentPath.value,
      dirName: folderName
    });
    if (result.success) {
      closeNewFolderDialog();
      await refreshCurrentDir();
    } else {
      console.error('Failed to create folder:', result.error);
    }
  } catch (e) {
    console.error('Failed to create folder:', e);
  }
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
}

function onResizeStart(e) {
  e.preventDefault();
  isResizing.value = true;
  const startX = e.clientX;
  const startWidth = sidebarWidth.value;
  let rafId = null;

  const onResizeMove = (moveEvent) => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      const delta = moveEvent.clientX - startX;
      sidebarWidth.value = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, startWidth + delta));
      rafId = null;
    });
  };

  const onResizeEnd = () => {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    isResizing.value = false;
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', onResizeMove, { passive: true });
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

async function confirmCreateKB() {
  if (!newKB.name.trim()) return;

  const category = categories.find(c => c.id === currentCategoryId.value);
  if (!category) return;

  if (editingKBId.value) {
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
    const newId = `kb-${Date.now()}`;
    const newItem = {
      id: newId,
      name: newKB.name.trim(),
      description: newKB.description.trim(),
      coverIndex: newKB.coverIndex
    };
    category.items.push(newItem);
    selectedKB.value = newId;
    currentTitle.value = newKB.name.trim();

    // 创建知识库目录
    if (api && dataDir.value) {
      const kbDir = dataDir.value + '/knowledge/' + currentCategoryId.value + '/' + newItem.name;
      kbRootPath.value = kbDir;
      try {
        await api.invoke('kb-create-dir', { dirPath: kbDir });
      } catch (e) {
        console.error('Failed to create kb dir:', e);
      }
      await navigateTo(kbDir);
    }
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
      files.value = [];
      currentPath.value = '';
      kbRootPath.value = '';
      navigationHistory.value = [];
      historyIndex.value = -1;
    }
  }
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

// 初始化
onMounted(async () => {
  await loadDataDir();
});
</script>

<style scoped lang="scss">
.knowledge-base {
  display: flex;
  height: 100vh;
  background: var(--bg-primary);
  position: relative;
}

.kb-sidebar {
  width: var(--sidebar-width, 240px);
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border-right: 1px solid var(--border-color);
  overflow: hidden;
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease;
  will-change: width;

  &.is-resizing {
    transition: none;
  }

  &.collapsed {
    width: 0 !important;
    border-right: none;
    opacity: 0;
  }

  .sidebar-inner {
    min-width: 200px;
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .sidebar-top-area {
    height: 56px;
    flex-shrink: 0;
    position: relative;
  }

  .sidebar-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 12px 8px;
    height: 100%;
    box-sizing: border-box;

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
      transition: background 0.15s, color 0.15s;

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }

      &:active {
        transform: scale(0.92);
      }
    }

    .topbar-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }

  .sidebar-topbar,
  .sidebar-search {
    position: absolute;
    inset: 0;
  }

  .sidebar-search {
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 6px;

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
    scrollbar-color: rgba(0, 0, 0, 0.12) transparent;

    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background-color: rgba(0, 0, 0, 0.12);
      border-radius: 10px;
    }

    &::-webkit-scrollbar-thumb:hover {
      background-color: rgba(0, 0, 0, 0.22);
    }

    .category-group {
      margin-bottom: 2px;

      .category-header {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        cursor: pointer;
        user-select: none;
        border-radius: 6px;
        margin: 0 6px;
        transition: background 0.15s;

        &:hover {
          background: var(--bg-hover);
        }

        .expand-icon {
          margin-right: 6px;
          transition: transform 0.2s ease;
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
          transition: opacity 0.15s, background 0.15s;
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
          padding: 6px 12px 6px 30px;
          margin: 0 6px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s;

          &:hover {
            background: var(--bg-hover);
          }

          &.active {
            background: var(--accent-light);
            color: var(--accent-color);

            .item-icon,
            .item-icon-fallback {
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

          .item-icon-fallback {
            margin-right: 8px;
            color: var(--text-tertiary);
            flex-shrink: 0;
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

// 展开/折叠过渡动画
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
}

.slide-enter-to,
.slide-leave-from {
  opacity: 1;
  max-height: 500px;
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
  border-radius: 6px;
  color: var(--text-secondary);
  transition: background 0.15s, color 0.15s, transform 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  &:active {
    transform: scale(0.92);
  }
}

.sidebar-resize-handle {
  width: 3px;
  cursor: col-resize;
  flex-shrink: 0;
  transition: background-color 0.15s;
  border-radius: 2px;

  &:hover {
    background-color: var(--accent-color);
    opacity: 0.4;
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

        .file-type-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          border-radius: 12px;
          transition: all 0.25s ease;

          &.folder {
            color: #1560F7;
          }

          &.markdown {
            background: #E8F5E9;
            color: #4CAF50;
          }

          &.pdf {
            background: #FFEBEE;
            color: #F44336;
          }

          &.txt {
            background: #F5F5F5;
            color: #9E9E9E;
          }

          &.excel {
            background: #E8F5E9;
            color: #4CAF50;
          }

          &.word {
            background: #E3F2FD;
            color: #2196F3;
          }

          &.note {
            background: #FFF8E1;
            color: #FFC107;
          }

          &.ppt {
            background: #FFF3E0;
            color: #FF9800;
          }

          &.unknown {
            background: #ECEFF1;
            color: #90A4AE;
          }
        }
      }

      &:hover .file-type-icon {
        transform: scale(1.08);
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
          line-clamp: 2;
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
            &.folder {
              color: #1560F7;
            }

            &.markdown {
              color: #4CAF50;
            }

            &.pdf {
              color: #F44336;
            }

            &.txt {
              color: #9E9E9E;
            }

            &.excel {
              color: #4CAF50;
            }

            &.word {
              color: #2196F3;
            }

            &.note {
              color: #FFC107;
            }

            &.ppt {
              color: #FF9800;
            }

            &.unknown {
              color: #90A4AE;
            }
          }
        }
      }
    }

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

.new-folder-dialog {
  width: 380px;
  padding: 24px;
  text-align: left;

  .modal-title {
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
  }

  .new-folder-input-row {
    margin-bottom: 20px;
  }

  .new-folder-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 8px;
    font-size: 14px;
    background: var(--bg-primary, #fff);
    color: var(--text-primary);
    outline: none;
    transition: border-color 0.2s;
    box-sizing: border-box;

    &:focus {
      border-color: var(--accent-color, #1560F7);
      box-shadow: 0 0 0 2px rgba(21, 96, 247, 0.15);
    }

    &::placeholder {
      color: var(--text-tertiary, #bbb);
    }
  }
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
  scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
}

[data-theme='dark'] .kb-sidebar .sidebar-content::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.12);
}

[data-theme='dark'] .kb-sidebar .sidebar-content::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.22);
}
</style>
