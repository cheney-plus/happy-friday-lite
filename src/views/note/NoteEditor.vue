<template>
  <div class="editor-page">
    <div class="editor-wrapper" :style="{ flex: '1 1 auto', minWidth: 0 }">
      <div class="editor-toolbar" v-if="editor">
      <div class="toolbar-left-group">
      <!-- 第一组：撤销/重做、清除格式 -->
      <div class="tooltip-wrapper">
        <button class="toolbar-btn" @click="editor.chain().focus().undo().run()" :disabled="!editor.can().undo()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 7v6h6"></path>
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
          </svg>
        </button>
        <span class="tooltip">撤销</span>
      </div>

      <div class="tooltip-wrapper">
        <button class="toolbar-btn" @click="editor.chain().focus().redo().run()" :disabled="!editor.can().redo()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 7v6h-6"></path>
            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"></path>
          </svg>
        </button>
        <span class="tooltip">重做</span>
      </div>

      <div class="tooltip-wrapper">
        <button class="toolbar-btn" @click="editor.chain().focus().clearNodes().unsetAllMarks().run()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"></path><path d="M22 21H7"></path><path d="m5 11 9 9"></path></svg>
        </button>
        <span class="tooltip">清除格式</span>
      </div>

      <div class="tooltip-wrapper">
        <button class="toolbar-btn" :class="{ active: editor.isActive('link') }" @click="addLink" :disabled="!hasSelection">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
        </button>
        <span class="tooltip">链接</span>
      </div>

      <div class="toolbar-divider"></div>

      <!-- 第二组：插入下拉菜单 -->
      <div class="dropdown-wrapper">
        <button class="toolbar-btn dropdown-toggle" @click="toggleInsertMenu" :class="{ active: showInsertMenu }">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
          插入
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        <div v-if="showInsertMenu" class="dropdown-menu insert-menu">
          <div class="menu-item has-submenu" @mouseenter="openTablePicker" @mouseleave="delayHideTableSubmenu">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>
            表格
            <svg class="submenu-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            <div v-if="showTableSubmenu" class="submenu table-submenu table-picker" @mouseenter="cancelTableSubmenuDelay" @mouseleave="delayHideTableSubmenu">
              <div class="table-picker-info">{{ tableRows }} × {{ tableCols }}</div>
              <div class="table-picker-grid">
                <div v-for="row in 10" :key="'row-' + row" class="table-picker-row">
                  <div v-for="col in 10" :key="'cell-' + row + '-' + col"
                       class="table-picker-cell"
                       :class="{ active: col <= tableCols && row <= tableRows }"
                       @mouseenter="selectTableCell(row, col)"
                       @click="insertTable(tableRows, tableCols)"></div>
                </div>
              </div>
            </div>
          </div>
          <div class="menu-item" @click="addImage">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            图片
          </div>
          <div class="menu-item" @click="editor.chain().focus().toggleCodeBlock().run()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
            代码块
          </div>
          <div class="menu-item" @click="editor.chain().focus().setHorizontalRule().run()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line></svg>
            分割线
          </div>
          <div class="menu-item" @click="editor.chain().focus().toggleBlockquote().run()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 1 1 1 1z"></path></svg>
            引用
          </div>
        </div>
      </div>

      <div class="toolbar-divider"></div>

      <!-- 第三组：文本格式 -->
      <div class="tooltip-wrapper">
        <button class="toolbar-btn" :class="{ active: editor.isActive('bold') }" @click="editor.chain().focus().toggleBold().run()">
          <span style="font-weight: 700; font-size: 14px;">B</span>
        </button>
        <span class="tooltip">粗体</span>
      </div>
      <div class="tooltip-wrapper">
        <button class="toolbar-btn" :class="{ active: editor.isActive('italic') }" @click="editor.chain().focus().toggleItalic().run()">
          <span style="font-style: italic; font-size: 14px;">I</span>
        </button>
        <span class="tooltip">斜体</span>
      </div>
      <div class="tooltip-wrapper">
        <button class="toolbar-btn" :class="{ active: editor.isActive('underline') }" @click="editor.chain().focus().toggleUnderline().run()">
          <span style="text-decoration: underline; font-size: 14px;">U</span>
        </button>
        <span class="tooltip">下划线</span>
      </div>
      <div class="tooltip-wrapper">
        <button class="toolbar-btn" :class="{ active: editor.isActive('strike') }" @click="editor.chain().focus().toggleStrike().run()">
          <span style="text-decoration: line-through; font-size: 14px;">S</span>
        </button>
        <span class="tooltip">删除线</span>
      </div>

      <div class="dropdown-wrapper">
        <button class="toolbar-btn dropdown-toggle" :class="{ active: editor.isActive('highlight') }" @click="toggleHighlightMenu">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        <div v-if="showHighlightMenu" class="dropdown-menu highlight-menu">
          <div class="text-color-header">背景颜色</div>
          <button class="default-color-btn" @click="setHighlight('transparent')">无背景</button>
          <div class="color-picker-grid highlight-grid">
            <div class="color-option" v-for="color in highlightColorPalette" :key="color"
                 :style="{ backgroundColor: color, border: color === '#ffffff' ? '1px solid #e5e7eb' : 'none' }"
                 @click="setHighlight(color)"
                 :title="color === 'transparent' ? '取消高亮' : color"></div>
          </div>
        </div>
      </div>

      <div class="dropdown-wrapper">
        <button class="toolbar-btn dropdown-toggle" @click="toggleTextColorMenu">
          <span style="font-size: 14px; text-decoration: underline;">A</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        <div v-if="showTextColorMenu" class="dropdown-menu text-color-menu">
          <div class="text-color-header">文字颜色</div>
          <button class="default-color-btn" @click="setTextColor('inherit')">默认颜色</button>
          <div class="color-picker-grid text-color-grid">
            <div class="color-option" v-for="color in textColorPalette" :key="color"
                 :style="{ backgroundColor: color, border: color === '#ffffff' ? '1px solid #e5e7eb' : 'none' }"
                 @click="setTextColor(color)"
                 :title="color"></div>
          </div>
        </div>
      </div>

      <div class="toolbar-divider"></div>

      <!-- 第四组：标题下拉菜单 -->
      <div class="dropdown-wrapper">
        <button class="toolbar-btn dropdown-toggle heading-toggle" @click="toggleHeadingMenu" :class="{ active: showHeadingMenu || isHeadingActive }">
          {{ currentHeadingLabel }}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        <div v-if="showHeadingMenu" class="dropdown-menu heading-menu">
          <div class="menu-item" :class="{ active: !isHeadingActive }" @click="setHeading(0)">正文</div>
          <div class="menu-item heading-preview" :class="{ active: editor.isActive('heading', { level: 1 }) }" @click="setHeading(1)">
            <span style="font-size: 20px; font-weight: 600;">标题 1</span>
          </div>
          <div class="menu-item heading-preview" :class="{ active: editor.isActive('heading', { level: 2 }) }" @click="setHeading(2)">
            <span style="font-size: 17px; font-weight: 600;">标题 2</span>
          </div>
          <div class="menu-item heading-preview" :class="{ active: editor.isActive('heading', { level: 3 }) }" @click="setHeading(3)">
            <span style="font-size: 15px; font-weight: 600;">标题 3</span>
          </div>
        </div>
      </div>

      <div class="toolbar-divider"></div>

      <!-- 第五组：列表 -->
      <div class="tooltip-wrapper">
        <button class="toolbar-btn" :class="{ active: editor.isActive('bulletList') }" @click="editor.chain().focus().toggleBulletList().run()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
        </button>
        <span class="tooltip">无序列表</span>
      </div>
      <div class="tooltip-wrapper">
        <button class="toolbar-btn" :class="{ active: editor.isActive('orderedList') }" @click="editor.chain().focus().toggleOrderedList().run()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="21" y2="6"></line><line x1="10" y1="12" x2="21" y2="12"></line><line x1="10" y1="18" x2="21" y2="18"></line><path d="M4 6h1v4"></path><path d="M4 10h2"></path><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path></svg>
        </button>
        <span class="tooltip">有序列表</span>
      </div>
      <div class="tooltip-wrapper">
        <button class="toolbar-btn" :class="{ active: editor.isActive('taskList') }" @click="editor.chain().focus().toggleTaskList().run()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
        </button>
        <span class="tooltip">任务列表</span>
      </div>

      <div class="toolbar-divider"></div>

      <!-- 第六组：对齐方式 -->
      <div class="tooltip-wrapper">
        <button class="toolbar-btn" :class="{ active: editor.isActive({ textAlign: 'left' }) }" @click="editor.chain().focus().setTextAlign('left').run()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="15" y1="12" x2="3" y2="12"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>
        </button>
        <span class="tooltip">左对齐</span>
      </div>
      <div class="tooltip-wrapper">
        <button class="toolbar-btn" :class="{ active: editor.isActive({ textAlign: 'center' }) }" @click="editor.chain().focus().setTextAlign('center').run()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="17" y1="12" x2="7" y2="12"></line><line x1="19" y1="18" x2="5" y2="18"></line></svg>
        </button>
        <span class="tooltip">居中对齐</span>
      </div>
      <div class="tooltip-wrapper">
        <button class="toolbar-btn" :class="{ active: editor.isActive({ textAlign: 'right' }) }" @click="editor.chain().focus().setTextAlign('right').run()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="12" x2="9" y2="12"></line><line x1="21" y1="18" x2="7" y2="18"></line></svg>
        </button>
        <span class="tooltip">右对齐</span>
      </div>
      </div>

      <!-- 右侧功能按钮组 -->
      <div class="toolbar-right-group">
        <div class="tooltip-wrapper">
          <button class="toolbar-btn" @click="handleAddContent">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
          </button>
          <span class="tooltip">添加</span>
        </div>

        <div class="dropdown-wrapper more-menu-wrapper" tabindex="-1" @blur="closeMoreMenu">
          <button class="toolbar-btn dropdown-toggle" @click="toggleMoreMenu" :class="{ active: showMoreMenu }">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
          </button>
          <div v-if="showMoreMenu" class="dropdown-menu more-menu">
            <div class="menu-item has-submenu" @mouseenter="showShareSubmenu = true; cancelShareSubmenuDelay(); checkShareSubmenuPosition($event)" @mouseleave="delayHideShareSubmenu">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
              分享
              <svg class="submenu-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
              <div v-if="showShareSubmenu" class="submenu share-submenu" :class="{ 'align-left': shareSubmenuAlignLeft }" @mouseenter="cancelShareSubmenuDelay" @mouseleave="delayHideShareSubmenu">
                <div class="menu-item" @click="shareLink">复制链接</div>
                <div class="menu-item" @click="shareToWeChat">分享到微信</div>
                <div class="menu-item" @click="shareToQQ">分享到 QQ</div>
              </div>
            </div>
            <div class="menu-item" :class="{ disabled: isExportingPdf }" @click="exportPDF">
              <svg v-if="!isExportingPdf" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span v-else class="export-spinner"></span>
              {{ isExportingPdf ? '导出中...' : '导出 PDF' }}
            </div>
            <div class="menu-item" @click="exportMarkdown">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              导出 Markdown
            </div>
            <div class="menu-item" @click="viewHistory">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              版本历史记录
            </div>
            <div class="menu-item" @click="addShortcut">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
              添加快捷访问
            </div>
          </div>
        </div>

        <button v-if="showAIWriteBtn" class="toolbar-btn ai-write-btn" @click="openAIWrite">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
          Friday 助理
        </button>
      </div>
    </div>

    <NoteBubbleMenu v-if="editor" :editor="editor" :isDark="appStore.theme === 'dark'" :noteContent="editor.getText()" @aiWrite="handleBubbleAIWrite" @interpret="handleBubbleInterpret" @refine="handleBubbleRefine" @polish="handleBubblePolish" @expand="handleBubbleExpand" @openInChat="handleOpenInChat" />

    <div class="toc-btn" :class="{ active: tocVisible }" @click="emit('toggle-toc')">
      <span class="toc-char">目</span>
      <span class="toc-char">录</span>
    </div>

    <EditorContent :editor="editor" class="editor-content" />

    <div
      v-if="fimCompletionVisible && fimCompletionText"
      class="fim-completion-bubble"
      :style="{ left: fimCompletionPos.left + 'px', top: fimCompletionPos.top + 'px' }"
    >
      <span class="fim-completion-text">{{ fimCompletionText }}</span>
      <span class="fim-completion-hint">Tab</span>
    </div>

    <!-- 链接对话框 -->
    <div v-if="showLinkDialog" class="dialog-overlay" @click.self="closeLinkDialog">
      <div class="dialog">
        <div class="dialog-header">
          <h3>{{ isEditingLink ? '编辑链接' : '插入链接' }}</h3>
          <button class="dialog-close" @click="closeLinkDialog">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>链接地址</label>
            <input
              ref="linkUrlInput"
              v-model="linkUrl"
              type="url"
              placeholder="https://example.com"
              @keyup.enter="confirmLink"
              class="form-input"
            />
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn btn-secondary" @click="closeLinkDialog">取消</button>
          <button v-if="isEditingLink && editor?.isActive('link')" class="btn btn-danger" @click="removeLink">删除链接</button>
          <button class="btn btn-primary" @click="confirmLink" :disabled="!linkUrl">{{ isEditingLink ? '更新' : '插入' }}</button>
        </div>
      </div>
    </div>

    <!-- 图片对话框 -->
    <div v-if="showImageDialog" class="dialog-overlay" @click.self="closeImageDialog">
      <div class="dialog">
        <div class="dialog-header">
          <h3>插入图片</h3>
          <button class="dialog-close" @click="closeImageDialog">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>图片地址</label>
            <input
              ref="imageUrlInput"
              v-model="imageUrl"
              type="url"
              placeholder="https://example.com/image.jpg"
              @keyup.enter="confirmImage"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label>替代文本（可选）</label>
            <input
              v-model="imageAlt"
              type="text"
              placeholder="图片描述"
              @keyup.enter="confirmImage"
              class="form-input"
            />
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn btn-secondary" @click="closeImageDialog">取消</button>
          <button class="btn btn-primary" @click="confirmImage" :disabled="!imageUrl">插入</button>
        </div>
      </div>
    </div>
    </div>

    <Transition name="sidebar-slide">
      <div v-if="showAISidebar" class="ai-chat-sidebar" :style="{ width: sidebarWidth + 'px' }">
        <div class="sidebar-resize-handle" @mousedown="startResize"></div>
        <div class="sidebar-header">
          <div class="sidebar-title-group">
            <div class="sidebar-avatar">
              <span class="sidebar-avatar-icon">✦</span>
            </div>
            <span class="sidebar-title">Friday 助理</span>
          </div>
          <button class="sidebar-close-btn" @click="closeAISidebar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="sidebar-messages" ref="sidebarMessagesRef">
          <div class="sidebar-messages-inner">
            <div v-if="chatMessages.length === 0 && !isStreaming" class="sidebar-empty">
              <div class="sidebar-empty-icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                  <path d="M2 17l10 5 10-5"></path>
                  <path d="M2 12l10 5 10-5"></path>
                </svg>
              </div>
              <span class="sidebar-empty-text">向 Friday 提问，可获取写作帮助</span>
              <span class="sidebar-empty-hint">主人，我可以使用写作Agent帮您修改这篇笔记</span>
            </div>

            <template v-for="(msg, index) in chatMessages" :key="index">
              <UserMessage v-if="msg.role === 'user'" :content="msg.content" />
              <AIMessage
                v-else
                :content="msg.content"
                :reasoning="msg.reasoning"
                :show-divider="false"
                :show-rollback="false"
                @action="(type) => handleChatAction(type, index)"
              />
            </template>

            <template v-if="isStreaming">
              <AIMessage
                :content="streamingContent"
                :reasoning-streaming-content="streamingReasoning"
                :is-streaming="true"
                :show-divider="false"
                :show-rollback="false"
              />
            </template>
          </div>
        </div>

        <ChatInputBox
          ref="chatInputBoxRef"
          v-model="chatInputText"
          placeholder="输入消息..."
          :is-streaming="isStreaming"
          :note-references="noteReferences"
          @send="handleChatSend"
          @stop="handleChatStop"
          @remove-reference="removeNoteReference"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount, onMounted, nextTick } from 'vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import UserMessage from '@/components/chat/UserMessage.vue';
import AIMessage from '@/components/chat/AIMessage.vue';
import ChatInputBox from '@/components/chat/ChatInputBox.vue';
import { electronService } from '@/services/electron';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import Typography from '@tiptap/extension-typography';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { all, createLowlight } from 'lowlight';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import CodeBlockComponent from './CodeBlockComponent.vue';
import NoteBubbleMenu from './NoteBubbleMenu.vue';
import { useAppStore } from '@/store';

const appStore = useAppStore();

const lowlight = createLowlight(all);

const props = defineProps({
  placeholder: { type: String, default: '开始写作...' },
  modelValue: { type: String, default: '' },
  tocVisible: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue', 'change', 'toggle-toc']);

const showInsertMenu = ref(false);
const showHighlightMenu = ref(false);
const showTextColorMenu = ref(false);
const showHeadingMenu = ref(false);
const showTableSubmenu = ref(false);
const showMoreMenu = ref(false);
const showShareSubmenu = ref(false);
const shareSubmenuAlignLeft = ref(false);
const tableRows = ref(0);
const tableCols = ref(0);

const selectTableCell = (row, col) => {
  tableRows.value = row;
  tableCols.value = col;
};

const openTablePicker = () => {
  showTableSubmenu.value = true;
  tableRows.value = 0;
  tableCols.value = 0;
};

let tableSubmenuTimer = null;

const delayHideTableSubmenu = () => {
  tableSubmenuTimer = setTimeout(() => {
    showTableSubmenu.value = false;
  }, 150);
};

const cancelTableSubmenuDelay = () => {
  if (tableSubmenuTimer) {
    clearTimeout(tableSubmenuTimer);
    tableSubmenuTimer = null;
  }
};

// 链接对话框相关
const showLinkDialog = ref(false);
const isEditingLink = ref(false);
const linkUrl = ref('');
const linkUrlInput = ref(null);

const hasSelection = computed(() => {
  if (!editor.value) return false;
  const { from, to } = editor.value.state.selection;
  return from !== to;
});

const addLink = () => {
  if (!hasSelection.value) return;

  isEditingLink.value = editor.value?.isActive('link') || false;

  if (isEditingLink.value && editor.value) {
    const { href } = editor.value.getAttributes('link');
    linkUrl.value = href || '';
  } else {
    linkUrl.value = '';
  }

  showLinkDialog.value = true;
  setTimeout(() => {
    if (linkUrlInput.value) {
      linkUrlInput.value.focus();
      linkUrlInput.value.select();
    }
  }, 100);
};

const closeLinkDialog = () => {
  showLinkDialog.value = false;
  isEditingLink.value = false;
  linkUrl.value = '';
};

const confirmLink = () => {
  if (!linkUrl.value.trim() || !editor.value) return;

  if (isEditingLink.value) {
    editor.value.chain().focus().extendMarkRange('link').setLink({ href: linkUrl.value }).run();
  } else {
    editor.value.chain().focus().setLink({ href: linkUrl.value }).run();
  }

  closeLinkDialog();
};

const removeLink = () => {
  editor.value?.chain().focus().unsetLink().run();
  closeLinkDialog();
};

// 图片对话框相关
const showImageDialog = ref(false);
const imageUrl = ref('');
const imageAlt = ref('');
const imageUrlInput = ref(null);

const addImage = () => {
  showInsertMenu.value = false;
  imageUrl.value = '';
  imageAlt.value = '';
  showImageDialog.value = true;
  setTimeout(() => {
    if (imageUrlInput.value) {
      imageUrlInput.value.focus();
    }
  }, 100);
};

const closeImageDialog = () => {
  showImageDialog.value = false;
  imageUrl.value = '';
  imageAlt.value = '';
};

const confirmImage = () => {
  if (!imageUrl.value.trim()) return;

  editor.value
    ?.chain()
    .focus()
    .setImage({ src: imageUrl.value, alt: imageAlt.value })
    .run();

  closeImageDialog();
};

let shareSubmenuTimer = null;

const delayHideShareSubmenu = () => {
  shareSubmenuTimer = setTimeout(() => {
    showShareSubmenu.value = false;
  }, 150);
};

const cancelShareSubmenuDelay = () => {
  if (shareSubmenuTimer) {
    clearTimeout(shareSubmenuTimer);
    shareSubmenuTimer = null;
  }
};

const checkShareSubmenuPosition = (event) => {
  const target = event.currentTarget;
  const rect = target.getBoundingClientRect();
  const windowWidth = window.innerWidth;
  const submenuWidth = 140;
  
  if (rect.right + submenuWidth + 12 > windowWidth) {
    shareSubmenuAlignLeft.value = true;
  } else {
    shareSubmenuAlignLeft.value = false;
  }
};

// 更多菜单相关
const toggleMoreMenu = (event) => {
  showMoreMenu.value = !showMoreMenu.value;
  if (!showMoreMenu.value) {
    showShareSubmenu.value = false;
  } else {
    const target = event.currentTarget;
    const parent = target.parentElement;
    parent.focus();
  }
};

const closeMoreMenu = () => {
  showMoreMenu.value = false;
  showShareSubmenu.value = false;
};

const handleAddContent = () => {
  editor.value?.chain().focus().run();
};

const shareLink = () => {
  showMoreMenu.value = false;
  showShareSubmenu.value = false;
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    alert('链接已复制到剪贴板');
  });
};

const shareToWeChat = () => {
  alert('分享到微信功能开发中...');
  showMoreMenu.value = false;
  showShareSubmenu.value = false;
};

const shareToQQ = () => {
  alert('分享到 QQ 功能开发中...');
  showMoreMenu.value = false;
  showShareSubmenu.value = false;
};

const isExportingPdf = ref(false);

const extractTitleFromContent = (html) => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const firstHeading = tempDiv.querySelector('h1, h2, h3');
  if (firstHeading?.textContent?.trim()) {
    return firstHeading.textContent.trim().substring(0, 50);
  }
  const firstParagraph = tempDiv.querySelector('p');
  if (firstParagraph?.textContent?.trim()) {
    return firstParagraph.textContent.trim().substring(0, 50);
  }
  return '未命名笔记';
};

const exportPDF = async () => {
  showMoreMenu.value = false;
  if (!editor.value || isExportingPdf.value) return;

  const html = editor.value.getHTML();
  const title = extractTitleFromContent(html);

const filePath = await electronService.saveFile({
    defaultPath: `${title}.pdf`,
    filters: [{
      name: 'PDF',
      extensions: ['pdf']
    }]
  });

  if (!filePath) return;

  isExportingPdf.value = true;
  try {
    await electronService.invoke('export_html_to_pdf', { html, savePath: filePath });
  } catch (error) {
    console.error('导出 PDF 失败:', error);
    alert(`导出 PDF 失败: ${error}`);
  } finally {
    isExportingPdf.value = false;
  }
};

const exportMarkdown = async () => {
  showMoreMenu.value = false;
  if (!editor.value) return;

  const html = editor.value.getHTML();
  const title = extractTitleFromContent(html);

  const filePath = await electronService.saveFile({
    defaultPath: `${title}.md`,
    filters: [{
      name: 'Markdown',
      extensions: ['md']
    }]
  });

  if (!filePath) return;

  try {
    const TurndownService = (await import('turndown')).default;
    const turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
    });
    turndown.addRule('taskListItems', {
      filter: (node) => {
        return node.nodeName === 'LI' && node.getAttribute('data-type') === 'taskItem';
      },
      replacement: (content, node) => {
        const checkbox = node.querySelector('input[type="checkbox"]');
        const checked = checkbox?.hasAttribute('checked') ? 'x' : ' ';
        return `- [${checked}] ${content.trim()}\n`;
      }
    });
    const markdown = turndown.turndown(html);
    await electronService.invoke('export_markdown', { markdown, savePath: filePath });
  } catch (error) {
    console.error('导出 Markdown 失败:', error);
    alert(`导出 Markdown 失败: ${error}`);
  }
};

const viewHistory = () => {
  alert('版本历史记录功能开发中...');
  showMoreMenu.value = false;
};

const addShortcut = () => {
  alert('添加快捷访问功能开发中...');
  showMoreMenu.value = false;
};

const openAIWrite = () => {
  if (showAISidebar.value) {
    closeAISidebar();
  } else {
    showAIWriteBtn.value = false;
    showAISidebar.value = true;
  }
};

const closeAISidebar = () => {
  showAISidebar.value = false;
  showAIWriteBtn.value = false;
  setTimeout(() => {
    showAIWriteBtn.value = true;
  }, 250);
};

const handleBubbleAIWrite = (text, command) => {
  console.log('BubbleMenu - AI 帮写 is not yet implemented:', text, '指令:', command);
  openAIWrite();
};

const handleBubbleInterpret = (text) => {
  console.log('BubbleMenu - 解读 is not yet implemented:', text);
};

const handleBubbleRefine = (text) => {
  console.log('BubbleMenu - 精炼 is not yet implemented:', text);
};

const handleBubblePolish = (text) => {
  console.log('BubbleMenu - 润色 is not yet implemented:', text);
};

const handleBubbleExpand = (text) => {
  console.log('BubbleMenu - 扩写 is not yet implemented:', text);
};

const handleOpenInChat = (text, from, to) => {
  console.log('BubbleMenu - 对话中打开:', text, from, to);
  
  if (!showAISidebar.value) {
    currentSessionId.value = '';
    chatMessages.value = [];
    noteReferences.value = [];
  }

  showAISidebar.value = true;
  showAIWriteBtn.value = false;
  
  const isDuplicate = noteReferences.value.some(
    ref => ref.from === from && ref.to === to
  );
  
  if (!isDuplicate) {
    const refId = `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    noteReferences.value.push({
      id: refId,
      from,
      to,
      text: text || ''
    });
  }
};

const removeNoteReference = (refId) => {
  const index = noteReferences.value.findIndex(ref => ref.id === refId);
  if (index > -1) {
    noteReferences.value.splice(index, 1);
  }
};

const showAISidebar = ref(false);
const showAIWriteBtn = ref(true);

const fimCompletionText = ref('');
const fimCompletionVisible = ref(false);
const fimCompletionPos = ref({ left: 0, top: 0 });
let fimDebounceTimer = null;
let fimRequestId = '';
let fimUnlistenResult = null;

function clearFimDebounce() {
  if (fimDebounceTimer) {
    clearTimeout(fimDebounceTimer);
    fimDebounceTimer = null;
  }
}

function dismissFimCompletion() {
  fimCompletionVisible.value = false;
  fimCompletionText.value = '';
}

async function cancelFimRequest() {
  if (fimRequestId) {
    try {
      await electronService.invoke('stop_note_fim_completion', { requestId: fimRequestId });
    } catch (_e) {}
    fimRequestId = '';
  }
}

function triggerFimCompletion() {
  if (!editor.value) return;
  if (!appStore.noteFimCompletion) return;

  const pos = editor.value.state.selection.from;
  const docSize = editor.value.state.doc.content.size;

  if (pos < 1 || pos >= docSize) return;

  const prefixEnd = Math.min(pos, 800);
  const suffixStart = pos;
  const suffixEnd = Math.min(docSize, pos + 400);

  let prefix = '';
  try {
    prefix = editor.value.state.doc.textBetween(Math.max(0, pos - prefixEnd), pos, '\n');
  } catch (_e) {
    prefix = '';
  }

  let suffix = '';
  try {
    suffix = editor.value.state.doc.textBetween(suffixStart, suffixEnd, '\n');
  } catch (_e) {
    suffix = '';
  }

  if (!prefix.trim() && !suffix.trim()) return;

  const lastLine = prefix.split('\n').pop() || '';
  if (lastLine.trim().length < 2) return;

  const model = loadModelConfig();
  if (!model) return;

  cancelFimRequest();
  dismissFimCompletion();

  fimRequestId = `fim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  let coords, wrapperRect;
  try {
    coords = editor.value.view.coordsAtPos(pos);
    const wrapperEl = editor.value.view.dom.closest('.editor-wrapper');
    wrapperRect = wrapperEl ? wrapperEl.getBoundingClientRect() : { left: 0, top: 0 };
  } catch (_e) {
    return;
  }

  fimCompletionPos.value = {
    left: coords.left - wrapperRect.left,
    top: coords.bottom - wrapperRect.top
  };

  electronService.invoke('note_fim_completion', {
    requestId: fimRequestId,
    model,
    prefix: prefix.slice(-800),
    suffix: suffix.slice(0, 400)
  }).catch((_e) => {
    fimRequestId = '';
  });
}

function handleFimResult(data) {
  if (data.requestId !== fimRequestId) return;
  fimRequestId = '';

  const completion = data.completion?.trim();
  if (!completion) return;

  fimCompletionText.value = completion;
  fimCompletionVisible.value = true;
}

function acceptFimCompletion() {
  if (!fimCompletionText.value || !editor.value) return;

  const text = fimCompletionText.value;
  dismissFimCompletion();

  editor.value.chain().focus().insertContent(text).run();
}

function setupFimListener() {
  fimUnlistenResult = electronService.listen('note-fim-result', (event) => {
    handleFimResult(event.payload);
  });

  try {
    const editorDom = editor.value?.view?.dom;
    if (editorDom) {
      editorDom.addEventListener('scroll', dismissFimCompletion);
    }
  } catch (_e) {}
}

function cleanupFim() {
  clearFimDebounce();
  cancelFimRequest();
  dismissFimCompletion();
  fimUnlistenResult?.();
  fimUnlistenResult = null;

  try {
    const editorDom = editor.value?.view?.dom;
    if (editorDom) {
      editorDom.removeEventListener('scroll', dismissFimCompletion);
    }
  } catch (_e) {}
}
const sidebarWidth = ref(380);
const isResizing = ref(false);
const sidebarMessagesRef = ref(null);

const chatInputText = ref('');
const noteReferences = ref([]);
const isStreaming = ref(false);
const streamingContent = ref('');
const streamingReasoning = ref('');

const chatMessages = ref([]);
const currentSessionId = ref('');
const chatInputBoxRef = ref(null);

let activeRequestId = '';
let isDoneReceived = false;
let unlistenChunk = null;
let unlistenReasoning = null;
let unlistenDone = null;
let unlistenError = null;

function loadModelConfig(modelId) {
  try {
    const raw = localStorage.getItem('happy-friday-custom-models');
    if (raw) {
      const models = JSON.parse(raw);
      let model = models.find(m => m.id === modelId);
      if (!model && models.length > 0) {
        const selectedId = localStorage.getItem('happy-friday-selected-model');
        model = selectedId ? models.find(m => m.id === selectedId) : models[0];
      }
      return model || null;
    }
  } catch (e) {
    console.error('Failed to load model config:', e);
  }
  return null;
}

async function sendChatMessage(text) {
  if (isStreaming.value || !text.trim()) return;

  const model = loadModelConfig();
  if (!model) {
    console.error('No model config found');
    return;
  }

  let fullMessage = text;

  if (noteReferences.value.length > 0 && editor.value) {
    const docSize = editor.value.state.doc.content.size;
    const refTexts = noteReferences.value.map(ref => {
      const from = Math.min(ref.from, docSize);
      const to = Math.min(ref.to, docSize);
      if (from < to) {
        return editor.value.state.doc.textBetween(from, to, ' ');
      }
      return ref.text || '';
    }).filter(t => t.trim());

    if (refTexts.length > 0) {
      fullMessage += '\n\n---\n引用笔记内容：\n' + refTexts.map((t, i) => `【引用${i + 1}】\n${t}`).join('\n\n');
    }
  }

  chatMessages.value.push({
    role: 'user',
    content: text
  });

  chatInputText.value = '';
  noteReferences.value = [];
  isStreaming.value = true;
  streamingContent.value = '';
  streamingReasoning.value = '';
  scrollSidebarToBottom();

  activeRequestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  isDoneReceived = false;

  const noteContent = editor.value ? editor.value.getText() : '';
  const systemPrompt = `你是 Friday，一个定制化个人知识智能服务助手。你友好、专业，善于帮助用户解答问题和完成任务。

当前用户正在编辑一篇笔记，以下是笔记的完整内容：

${noteContent}

请基于笔记内容来回答用户的问题。用户可能会引用笔记中的部分内容进行提问，请重点关注引用的内容，同时结合笔记全文上下文来给出准确、有价值的回答。`;

  try {
    await electronService.invoke('chat_with_memory', {
      requestId: activeRequestId,
      sessionId: currentSessionId.value || '',
      model: model,
      message: fullMessage,
      enableThinking: false,
      systemPrompt
    });
  } catch (err) {
    console.error('Chat invoke error:', err);
    isStreaming.value = false;
    streamingContent.value = '';
  }

  nextTick(() => {
    chatInputBoxRef.value?.focus();
  });
}

function handleChatSend() {
  sendChatMessage(chatInputText.value);
}

async function handleChatStop() {
  if (!isStreaming.value || !activeRequestId) return;
  try {
    await electronService.invoke('stop_chat', { requestId: activeRequestId });
  } catch (err) {
    console.error('Stop chat error:', err);
  }
}

function handleChatAction(type, index) {
  if (type === 'copy') return;
  console.log('Chat action:', type, index);
}

function scrollSidebarToBottom() {
  nextTick(() => {
    const container = sidebarMessagesRef.value;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  });
}

function startResize(e) {
  e.preventDefault();
  isResizing.value = true;
  const startX = e.clientX;
  const startWidth = sidebarWidth.value;

  function onMouseMove(ev) {
    const delta = startX - ev.clientX;
    const newWidth = Math.min(Math.max(startWidth + delta, 300), 600);
    sidebarWidth.value = newWidth;
  }

  function onMouseUp() {
    isResizing.value = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

async function setupChatListeners() {
  unlistenChunk = electronService.listen(
    'chat-chunk',
    (event) => {
      if (event.payload.requestId !== activeRequestId) return;
      streamingContent.value += event.payload.content;
      scrollSidebarToBottom();
    }
  );

  unlistenReasoning = electronService.listen(
    'chat-reasoning-chunk',
    (event) => {
      if (event.payload.requestId !== activeRequestId) return;
      streamingReasoning.value += event.payload.content;
      scrollSidebarToBottom();
    }
  );

  unlistenDone = electronService.listen(
    'chat-done',
    (event) => {
      if (event.payload.requestId !== activeRequestId) return;
      if (isDoneReceived) return;
      isDoneReceived = true;

      if (event.payload.sessionId && !currentSessionId.value) {
        currentSessionId.value = event.payload.sessionId;
      }

      chatMessages.value.push({
        role: 'assistant',
        content: event.payload.fullContent,
        reasoning: event.payload.reasoningContent || ''
      });

      isStreaming.value = false;
      streamingContent.value = '';
      streamingReasoning.value = '';
      scrollSidebarToBottom();

      nextTick(() => {
        chatInputBoxRef.value?.focus();
      });
    }
  );

  unlistenError = electronService.listen(
    'chat-error',
    (event) => {
      if (event.payload.requestId !== activeRequestId) return;
      isStreaming.value = false;
      streamingContent.value = '';
      streamingReasoning.value = '';
      console.error('Chat error:', event.payload.error);
    }
  );
}

function cleanupChatListeners() {
  unlistenChunk?.();
  unlistenReasoning?.();
  unlistenDone?.();
  unlistenError?.();
}

const highlightColorPalette = [
  '#ffffff', '#fef3c7', '#fef9c3', '#ecfccb', '#d1fae5', '#ccfbf1', '#cffafe', '#dbeafe', '#ede9fe', '#fce7f3',
  '#f3f4f6', '#fde68a', '#fef08a', '#bef264', '#86efac', '#5eead4', '#67e8f9', '#93c5fd', '#c4b5fd', '#fbcfe8',
  '#f9fafb', '#fcd34d', '#facc15', '#a3e635', '#4ade80', '#2dd4bf', '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6',
  '#f3f4f6', '#fbbf24', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#e5e7eb', '#f59e0b', '#d97706', '#65a30d', '#16a34a', '#0d9488', '#0891b2', '#2563eb', '#7c3aed', '#db2777'
];

const textColorPalette = [
  '#ffffff', '#000000', '#3b82f6', '#22d3ee', '#22c55e', '#ef4444', '#eab308', '#a855f7', '#dc2626',
  '#f3f4f6', '#9ca3af', '#93c5fd', '#a7f3d0', '#bbf7d0', '#fecaca', '#fef08a', '#ddd6fe', '#fce7f3',
  '#f9fafb', '#6b7280', '#bfdbfe', '#99f6e4', '#86efac', '#fca5a5', '#fde047', '#c4b5fd', '#fbcfe8',
  '#f3f4f6', '#4b5563', '#60a5fa', '#5eead4', '#4ade80', '#f87171', '#facc15', '#a78bfa', '#f472b6',
  '#e5e7eb', '#374151', '#2563eb', '#2dd4bf', '#16a34a', '#dc2626', '#eab308', '#8b5cf6', '#ec4899',
  '#1f2937', '#111827', '#1d4ed8', '#0891b2', '#15803d', '#b91c1c', '#ca8a04', '#7c3aed', '#db2777'
];

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
      codeBlock: false,
    }),
    Underline,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Highlight.configure({
      multicolor: true,
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-link',
      },
    }),
    Image.configure({
      HTMLAttributes: {
        class: 'editor-image',
      },
    }),
    Placeholder.configure({
      placeholder: props.placeholder,
    }),
    Superscript,
    Subscript,
    Typography,
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableCell,
    TableHeader,
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    TextStyle,
    Color,
    CodeBlockLowlight.extend({
      addNodeView() {
        return VueNodeViewRenderer(CodeBlockComponent);
      },
    }).configure({ lowlight }),
  ],
  content: props.modelValue,
  editorProps: {
    attributes: {
      class: 'prose-editor',
    },
    handleKeyDown: (_view, event) => {
      if (event.key === 'Tab' && fimCompletionVisible.value && fimCompletionText.value) {
        event.preventDefault();
        acceptFimCompletion();
        return true;
      }

      if (fimCompletionVisible.value && event.key !== 'Tab') {
        dismissFimCompletion();
      }

      return false;
    },
  },
  onUpdate: ({ editor }) => {
    const html = editor.getHTML();
    emit('update:modelValue', html);
    emit('change', html);

    clearFimDebounce();
    cancelFimRequest();
    dismissFimCompletion();

    fimDebounceTimer = setTimeout(() => {
      triggerFimCompletion();
    }, 2000);
  },
  onSelectionUpdate: () => {
    if (fimCompletionVisible.value) {
      dismissFimCompletion();
    }
  },
});

const currentHeadingLabel = computed(() => {
  if (!editor.value) return '标题';
  if (editor.value.isActive('heading', { level: 1 })) return '标题 1';
  if (editor.value.isActive('heading', { level: 2 })) return '标题 2';
  if (editor.value.isActive('heading', { level: 3 })) return '标题 3';
  return '标题';
});

const isHeadingActive = computed(() => {
  if (!editor.value) return false;
  return editor.value.isActive('heading');
});

const toggleInsertMenu = () => {
  showInsertMenu.value = !showInsertMenu.value;
  showHighlightMenu.value = false;
  showTextColorMenu.value = false;
  showHeadingMenu.value = false;
};

const toggleHighlightMenu = () => {
  showHighlightMenu.value = !showHighlightMenu.value;
  showInsertMenu.value = false;
  showTextColorMenu.value = false;
  showHeadingMenu.value = false;
};

const toggleTextColorMenu = () => {
  showTextColorMenu.value = !showTextColorMenu.value;
  showInsertMenu.value = false;
  showHighlightMenu.value = false;
  showHeadingMenu.value = false;
};

const toggleHeadingMenu = () => {
  showHeadingMenu.value = !showHeadingMenu.value;
  showInsertMenu.value = false;
  showHighlightMenu.value = false;
  showTextColorMenu.value = false;
};

const closeAllMenus = () => {
  showInsertMenu.value = false;
  showHighlightMenu.value = false;
  showTextColorMenu.value = false;
  showHeadingMenu.value = false;
  showTableSubmenu.value = false;
};

const setHighlight = (color) => {
  if (color === 'transparent') {
    editor.value?.chain().focus().unsetHighlight().run();
  } else {
    editor.value?.chain().focus().toggleHighlight({ color }).run();
  }
  showHighlightMenu.value = false;
};

const setTextColor = (color) => {
  editor.value?.chain().focus().setColor(color).run();
  showTextColorMenu.value = false;
};

const setHeading = (level) => {
  if (level === 0) {
    editor.value?.chain().focus().setParagraph().run();
  } else {
    editor.value?.chain().focus().toggleHeading({ level }).run();
  }
  showHeadingMenu.value = false;
};

const insertTable = (rows, cols) => {
  editor.value
    ?.chain()
    .focus()
    .insertTable({ rows, cols, withHeaderRow: true })
    .run();
  showInsertMenu.value = false;
  showTableSubmenu.value = false;
};

watch(() => props.modelValue, (newValue) => {
  if (editor.value && newValue !== editor.value.getHTML()) {
    editor.value.commands.setContent(newValue);
  }
});

watch(() => appStore.noteFimCompletion, (enabled) => {
  if (!enabled) {
    clearFimDebounce();
    cancelFimRequest();
    dismissFimCompletion();
  }
});

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  setupChatListeners();
  setupFimListener();
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
  cleanupChatListeners();
  cleanupFim();
  if (editor.value) {
    editor.value.destroy();
  }
  chatMessages.value = [];
  currentSessionId.value = '';
  noteReferences.value = [];
});

const handleClickOutside = (event) => {
  const target = event.target;
  if (!target.closest('.dropdown-wrapper')) {
    closeAllMenus();
  }
};
</script>

<style>
@import 'highlight.js/styles/atom-one-dark.css';
</style>

<style scoped>
.editor-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0 48px;
  position: relative;
}

.fim-completion-bubble {
  position: absolute;
  z-index: 50;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 6px;
  background-color: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  max-width: 400px;
  pointer-events: none;
  animation: fim-fade-in 0.15s ease-out;
  white-space: nowrap;
}

[data-theme='dark'] .fim-completion-bubble {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.fim-completion-text {
  font-size: 14px;
  color: var(--text-secondary, #6b7280);
  overflow: hidden;
  text-overflow: ellipsis;
}

.fim-completion-hint {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary, #9ca3af);
  background-color: var(--bg-hover, #f3f4f6);
  padding: 1px 5px;
  border-radius: 3px;
  flex-shrink: 0;
}

@keyframes fim-fade-in {
  from { opacity: 0; transform: translateY(-2px); }
  to { opacity: 1; transform: translateY(0); }
}

.editor-toolbar {
  display: flex;
  align-items: flex-start;
  gap: 2px;
  padding: 6px 0;
  max-width: 9000px;
  margin: 0 auto;
  width: 100%;
}

.toc-btn {
  position: absolute;
  left: 0;
  top: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px 4px;
  border-radius: 0 6px 6px 0;
  background-color: #f3f4f6;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
  z-index: 20;
  border: 1px solid #e5e7eb;
  border-left: none;
}

.toc-btn:hover {
  background-color: #e5e7eb;
  padding-right: 6px;
}

.toc-btn.active {
  background-color: #d1d5db;
}

.toc-char {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  line-height: 1.4;
}

[data-theme='dark'] .toc-btn {
  background-color: #374151;
  border-color: #4b5563;
}

[data-theme='dark'] .toc-btn:hover {
  background-color: #4b5563;
}

[data-theme='dark'] .toc-btn.active {
  background-color: #6b7280;
}

[data-theme='dark'] .toc-char {
  color: #d1d5db;
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 30px;
  height: 30px;
  padding: 0 7px;
  border: none;
  border-radius: 5px;
  background-color: transparent;
  color: #333;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
}

.toolbar-btn:hover:not(:disabled):not(.disabled) {
  background-color: rgba(0, 0, 0, 0.05);
  color: #000;
}

.toolbar-btn.active {
  background-color: rgba(59, 130, 246, 0.1);
  color: #2563eb;
}

.toolbar-btn:disabled,
.toolbar-btn.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.toolbar-divider {
  width: 1px;
  height: 18px;
  background-color: #ddd;
  margin: 0 5px;
}

.tooltip-wrapper {
  position: relative;
  display: inline-flex;
}

.tooltip-wrapper .tooltip {
  position: absolute;
  bottom: -32px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: #fff;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease-in-out;
  z-index: 1000;
}

.tooltip-wrapper:hover .tooltip {
  opacity: 1;
}

.dropdown-wrapper {
  position: relative;
}

.dropdown-toggle::after {
  content: '';
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  background-color: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.12),
    0 2px 8px rgba(0, 0, 0, 0.06);
  padding: 6px 0;
  min-width: 180px;
  z-index: 1000;
  animation: menuFadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes menuFadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.insert-menu {
  min-width: 140px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 16px;
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
  letter-spacing: 0.01em;
}

.menu-item:hover:not(.disabled) {
  background-color: rgba(59, 130, 246, 0.06);
  color: #2563eb;
}

.menu-item:hover:not(.disabled) svg {
  color: #2563eb;
}

.menu-item.active {
  background-color: rgba(59, 130, 246, 0.1);
  color: #1d4ed8;
}

.menu-item.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.export-spinner {
  display: inline-block;
  width: 15px;
  height: 15px;
  border: 2px solid #9ca3af;
  border-top-color: #374151;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.menu-item svg {
  flex-shrink: 0;
  color: #374151;
  transition: color 0.15s ease;
}

.menu-item.has-submenu {
  padding-right: 36px;
}

.submenu-arrow {
  position: absolute;
  right: 12px;
  color: #9ca3af;
  transition: transform 0.15s ease;
}

.menu-item.has-submenu:hover .submenu-arrow {
  color: #2563eb;
  transform: translateX(2px);
}

.submenu {
  position: absolute;
  left: calc(100% + 6px);
  top: -6px;
  background-color: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.12),
    0 2px 8px rgba(0, 0, 0, 0.06);
  padding: 6px 0;
  width: max-content;
  z-index: 1001;
}

.submenu.align-left {
  left: auto;
  right: calc(100% + 6px);
}

.table-picker {
  padding: 10px !important;
  min-width: auto !important;
}

.table-picker-info {
  text-align: center;
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.table-picker-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.table-picker-row {
  display: flex;
  gap: 2px;
}

.table-picker-cell {
  width: 18px;
  height: 18px;
  border: 1px solid #d1d5db;
  background-color: #fff;
  cursor: pointer;
  transition: all 0.08s ease;
}

.table-picker-cell:hover,
.table-picker-cell.active {
  background-color: #bfdbfe;
  border-color: #93c5fd;
}

.color-picker-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 3px;
  padding: 10px;
}

.color-option {
  width: 24px;
  height: 24px;
  border-radius: 3px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.12s;
}

.color-option:hover {
  transform: scale(1.15);
  border-color: #999;
}

.heading-toggle {
  min-width: 68px;
  font-weight: 500;
}

.heading-preview {
  padding: 7px 14px;
}

.highlight-menu,
.text-color-menu {
  min-width: 280px;
  padding: 12px;
}

.text-color-header {
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
  font-weight: 500;
}

.default-color-btn {
  width: 100%;
  padding: 8px 16px;
  margin-bottom: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background-color: #fff;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  transition: all 0.15s;
}

.default-color-btn:hover {
  background-color: #f9fafb;
  border-color: #d1d5db;
}

.text-color-grid {
  grid-template-columns: repeat(9, 1fr);
}

.highlight-grid {
  grid-template-columns: repeat(10, 1fr);
}

.editor-content {
  flex: 1;
  overflow-y: auto;
  margin-top: 4px;
  padding-bottom: 40px;
}

.editor-content::-webkit-scrollbar {
  width: 6px;
}

.editor-content::-webkit-scrollbar-track {
  background: transparent;
}

.editor-content::-webkit-scrollbar-thumb {
  background-color: #d1d5db;
  border-radius: 3px;
  transition: background-color 0.2s;
}

.editor-content::-webkit-scrollbar-thumb:hover {
  background-color: #9ca3af;
}

:deep(.prose-editor) {
  outline: none;
  min-height: 100%;
  color: var(--text-primary);
  font-size: 16px;
  line-height: 1.6;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  padding-top: 4px;
  padding-bottom: 40px;
  max-width: 900px;
  margin: 0 auto;
}

:deep(.prose-editor p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: var(--text-tertiary);
  pointer-events: none;
  height: 0;
}

:deep(.prose-editor h1),
:deep(.prose-editor h2),
:deep(.prose-editor h3) {
  font-weight: 600;
  margin: 0.8em 0 0.4em;
  line-height: 1.3;
}

:deep(.prose-editor h1) {
  font-size: 28px;
}

:deep(.prose-editor h2) {
  font-size: 22px;
}

:deep(.prose-editor h3) {
  font-size: 18px;
}

:deep(.prose-editor p) {
  margin: 0.4em 0;
}

:deep(.prose-editor ul),
:deep(.prose-editor ol) {
  padding-left: 1.5em;
  margin: 0.4em 0;
}

:deep(.prose-editor ul) {
  list-style-type: disc;
}

:deep(.prose-editor ol) {
  list-style-type: decimal;
}

:deep(.prose-editor li) {
  margin: 0.2em 0;
}

:deep(.prose-editor blockquote) {
  border-left: 3px solid var(--border-color);
  padding-left: 1em;
  margin: 0.8em 0;
  color: var(--text-secondary);
  font-style: italic;
}

:deep(.prose-editor code) {
  background-color: var(--bg-hover);
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace;
  font-size: 0.9em;
}

:deep(.pre-editor pre) {
  background-color: var(--bg-hover);
  padding: 1em;
  border-radius: 6px;
  overflow-x: auto;
  margin: 0.8em 0;
}

:deep(.pre-editor pre code) {
  background: none;
  padding: 0;
  font-size: 0.9em;
}

:deep(.prose-editor a.text-link) {
  color: #3b82f6;
  text-decoration: underline;
  cursor: pointer;
}

:deep(.prose-editor a.text-link:hover) {
  color: #2563eb;
}

:deep(.prose-editor img.editor-image) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 0.8em 0;
}

:deep(.prose-editor mark) {
  padding: 0.1em 0.2em;
  border-radius: 2px;
}

:deep(.prose-editor hr) {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 1.5em 0;
}

:deep(.prose-editor table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.8em 0;
  overflow: auto;
}

:deep(.prose-editor td),
:deep(.prose-editor th) {
  border: 1px solid var(--border-color);
  padding: 8px 12px;
  text-align: left;
  min-width: 100px;
}

:deep(.prose-editor th) {
  background-color: var(--bg-hover);
  font-weight: 600;
}

:deep(.prose-editor ul[data-type="taskList"]) {
  list-style: none;
  padding-left: 0;
}

:deep(.prose-editor ul[data-type="taskList"] li) {
  display: flex;
  align-items: center;
}

:deep(.prose-editor ul[data-type="taskList"] li > label) {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 1.5em;
}

:deep(.prose-editor ul[data-type="taskList"] li > label input[type="checkbox"]) {
  margin-top: 0;
  cursor: pointer;
  flex-shrink: 0;
}

:deep(.prose-editor span[data-color]) {
  color: attr(data-color);
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.dialog {
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 480px;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.dialog-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.dialog-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #9ca3af;
  cursor: pointer;
  padding: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.15s;
}

.dialog-close:hover {
  background-color: #f3f4f6;
  color: #374151;
}

.dialog-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input::placeholder {
  color: #9ca3af;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  background-color: #f9fafb;
  border-top: 1px solid #e5e7eb;
}

.btn {
  padding: 8px 18px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
}

.btn-primary {
  background-color: #3b82f6;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #fff;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background-color: #f9fafb;
  border-color: #9ca3af;
}

.btn-danger {
  background-color: #ef4444;
  color: #fff;
}

.btn-danger:hover {
  background-color: #dc2626;
}

.toolbar-spacer {
  flex: 1;
}

.toolbar-left-group {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  align-items: center;
}

.toolbar-right-group {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-left: 10px;
}

.more-menu {
  right: 0;
  left: auto;
  min-width: 160px;
}

.share-submenu {
  left: calc(100% + 6px);
  right: auto;
}

.ai-write-btn {
  background-color: #1f2937;
  color: #fff !important;
  gap: 4px;
  padding: 0 10px;
  border-radius: 6px;
  font-weight: 500;
  font-size: 12px;
}

.ai-write-btn:hover:not(:disabled):not(.disabled) {
  background-color: #4f5d74;
}

[data-theme='dark'] .toolbar-btn {
  color: #d1d5db;
}

[data-theme='dark'] .toolbar-btn:hover:not(:disabled):not(.disabled) {
  background-color: rgba(255, 255, 255, 0.08);
  color: #f3f4f6;
}

[data-theme='dark'] .toolbar-btn.active {
  background-color: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

[data-theme='dark'] .toolbar-divider {
  background-color: #4b5563;
}

[data-theme='dark'] .dropdown-menu,
[data-theme='dark'] .submenu {
  background-color: #1f2937;
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3);
}

[data-theme='dark'] .menu-item {
  color: #e5e7eb;
}

[data-theme='dark'] .menu-item svg {
  color: #9ca3af;
}

[data-theme='dark'] .menu-item:hover:not(.disabled) {
  background-color: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

[data-theme='dark'] .menu-item:hover:not(.disabled) svg {
  color: #60a5fa;
}

[data-theme='dark'] .menu-item.active {
  background-color: rgba(59, 130, 246, 0.25);
  color: #93c5fd;
}

[data-theme='dark'] .submenu-arrow {
  color: #6b7280;
}

[data-theme='dark'] .table-picker-info {
  color: #9ca3af;
}

[data-theme='dark'] .table-picker-cell {
  border-color: #4b5563;
  background-color: #374151;
}

[data-theme='dark'] .table-picker-cell:hover,
[data-theme='dark'] .table-picker-cell.active {
  background-color: #1e40af;
  border-color: #3b82f6;
}

[data-theme='dark'] .text-color-header {
  color: #9ca3af;
}

[data-theme='dark'] .default-color-btn {
  background-color: #374151;
  border-color: #4b5563;
  color: #e5e7eb;
}

[data-theme='dark'] .default-color-btn:hover {
  background-color: #4b5563;
  border-color: #6b7280;
}

[data-theme='dark'] .dialog {
  background-color: #1f2937;
}

[data-theme='dark'] .dialog-header {
  border-bottom-color: #374151;
}

[data-theme='dark'] .dialog-header h3 {
  color: #f3f4f6;
}

[data-theme='dark'] .dialog-close {
  color: #6b7280;
}

[data-theme='dark'] .dialog-close:hover {
  background-color: #374151;
  color: #d1d5db;
}

[data-theme='dark'] .form-group label {
  color: #d1d5db;
}

[data-theme='dark'] .form-input {
  background-color: #374151;
  border-color: #4b5563;
  color: #f3f4f6;
}

[data-theme='dark'] .form-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

[data-theme='dark'] .form-input::placeholder {
  color: #6b7280;
}

[data-theme='dark'] .dialog-footer {
  background-color: #111827;
  border-top-color: #374151;
}

[data-theme='dark'] .btn-secondary {
  background-color: #374151;
  color: #d1d5db;
  border-color: #4b5563;
}

[data-theme='dark'] .btn-secondary:hover {
  background-color: #4b5563;
  border-color: #6b7280;
}

[data-theme='dark'] .editor-content::-webkit-scrollbar-thumb {
  background-color: #4b5563;
}

[data-theme='dark'] .editor-content::-webkit-scrollbar-thumb:hover {
  background-color: #6b7280;
}

.editor-page {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.ai-chat-sidebar {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border-color);
  background: var(--bg-primary);
  position: relative;
  overflow: hidden;
}

.sidebar-resize-handle {
  position: absolute;
  left: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 10;
  transition: background-color 0.15s ease;
}

.sidebar-resize-handle:hover,
.sidebar-resize-handle:active {
  background: rgba(59, 130, 246, 0.2);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  flex-shrink: 0;
}

.sidebar-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sidebar-avatar {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: linear-gradient(135deg, #6ee7b7 0%, #34d399 50%, #10b981 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.sidebar-avatar-icon {
  font-size: 14px;
  color: #ffffff;
  font-weight: 700;
}

.sidebar-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.sidebar-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.15s ease;
}

.sidebar-close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.sidebar-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 0;
}

.sidebar-messages::-webkit-scrollbar {
  width: 4px;
}

.sidebar-messages::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-messages::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 10px;
}

.sidebar-messages-inner {
  max-width: 100%;
  padding: 0 18px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 100%;
}

.sidebar-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 60px 24px;
  gap: 10px;
}

.sidebar-empty-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: var(--bg-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  margin-bottom: 8px;
}

.sidebar-empty-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.sidebar-empty-hint {
  font-size: 12.5px;
  color: var(--text-tertiary);
  display: block;
  text-align: center;
}

.sidebar-slide-enter-active {
  animation: sidebarSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.sidebar-slide-leave-active {
  animation: sidebarSlideOut 0.2s ease-in;
}

@keyframes sidebarSlideIn {
  from {
    opacity: 0;
    transform: translateX(40px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes sidebarSlideOut {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(40px);
  }
}

[data-theme='dark'] .ai-chat-sidebar {
  border-left-color: #374151;
}

[data-theme='dark'] .sidebar-empty-icon {
  background: rgba(255, 255, 255, 0.06);
}
</style>
