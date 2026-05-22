<template>
  <div class="knowledge-base">
    <div class="kb-sidebar">
      <div class="sidebar-content">
        <div class="category-group" v-for="category in categories" :key="category.id">
          <div class="category-header" @click="toggleCategory(category.id)">
            <svg class="expand-icon" :class="{ expanded: category.expanded }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
            <span class="category-name">{{ category.name }}</span>
            <button class="add-btn" @click.stop="addKnowledgeBase(category.id)">
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
            >
              <svg class="item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
              <span class="item-name">{{ item.name }}</span>
            </div>
          </div>
        </div>
        <div class="sidebar-footer">
          <p class="footer-text">去发现更多知识库</p>
        </div>
      </div>
    </div>

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
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
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
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import folderIcon from '@/assets/images/文件夹.svg';
import documentIcon from '@/assets/images/文档.svg';

const selectedKB = ref('cheney-kb');
const currentTitle = ref('Cheney的知识库');
const question = ref('');
const textareaRef = ref(null);

const categories = reactive([
  {
    id: 'personal',
    name: '个人知识库',
    expanded: true,
    items: [
      { id: 'cheney-kb', name: 'Cheney的知识库' },
      { id: '2342342', name: '2342342' }
    ]
  },
  {
    id: 'shared',
    name: '共享知识库',
    expanded: true,
    items: [
      { id: 'rag-thinking', name: 'RAG 技术的思考' }
    ]
  },
  {
    id: 'subscribed',
    name: '订阅知识库',
    expanded: false,
    items: []
  }
]);

const files = ref([
  { id: '1', name: '我的笔记', type: 'folder', count: '0项', time: '22:43创建' },
  { id: '2', name: '父亲与他的老算盘', type: 'note', count: '', time: '22:44更新' },
  { id: '3', name: '计算机网路：自顶向下方法（原书第8版）(...', type: 'pdf', date: '4/19', time: '' },
  { id: '4', name: 'ima知识库使用指南.docx', type: 'word', date: '4/4', time: '' }
]);

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
  console.log('Add knowledge base to:', categoryId);
}

function goBack() {
  console.log('Go back');
}

function goForward() {
  console.log('Go forward');
}

function openFile(file) {
  console.log('Open file:', file);
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
}

.kb-sidebar {
  width: 240px;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);

  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 0;

    .category-group {
      margin-bottom: 8px;

      .category-header {
        display: flex;
        align-items: center;
        padding: 8px 16px;
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

          &.expanded {
            transform: rotate(90deg);
          }
        }

        .category-name {
          flex: 1;
          font-size: 14px;
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

          &:hover {
            background: var(--bg-active);
            opacity: 1;
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
          padding: 8px 16px 8px 34px;
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
      padding: 16px;
      margin-top: auto;

      .footer-text {
        font-size: 12px;
        color: var(--text-tertiary);
        text-align: center;
      }
    }
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
</style>
