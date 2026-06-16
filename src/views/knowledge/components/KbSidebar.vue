<template>
  <div class="kb-sidebar" :class="{ collapsed, 'is-resizing': isResizing }" :style="{ '--sidebar-width': sidebarWidth + 'px' }">
    <div class="sidebar-inner">
      <div class="sidebar-top-area">
        <div class="sidebar-topbar" v-show="!searchMode">
          <button class="topbar-btn" @click="$emit('toggle-sidebar')" title="收起侧边栏">
            <SidebarIcon />
          </button>
          <div class="topbar-actions">
            <button class="topbar-btn" @click="$emit('enter-search')" title="搜索">
              <SearchIcon />
            </button>
          </div>
        </div>

        <div class="sidebar-search" v-show="searchMode">
          <SearchIcon :size="16" class="search-icon" />
          <input
            ref="searchInputRef"
            :value="searchQuery"
            class="search-input"
            type="text"
            placeholder="搜索(按ESC退出)..."
            @input="$emit('update:searchQuery', $event.target.value)"
            @keydown.escape="$emit('exit-search')"
          />
        </div>
      </div>

      <div class="sidebar-content">
        <template v-for="category in filteredCategories" :key="category.id">
          <div class="category-group" v-if="category._matched || !searchQuery">
            <div class="category-header" @click="$emit('toggle-category', category.id)">
              <ChevronIcon :class="{ expanded: category.expanded }" />
              <span class="category-name">{{ category.name }}</span>
              <button v-if="!searchQuery" class="add-btn" @click.stop="$emit('add-kb', category.id)" title="添加知识库">
                <PlusIcon :size="14" />
              </button>
            </div>
            <Transition name="slide">
              <div class="category-items" v-if="category.expanded">
                <div
                  v-for="item in category.items"
                  :key="item.id"
                  :class="['kb-item', { active: selectedKB === item.id }]"
                  @click="$emit('select-kb', item.id, item.name, category.id)"
                  @contextmenu.prevent="$emit('show-context-menu', $event, category.id, item)"
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
</template>

<script setup>
import { SidebarIcon, SearchIcon, ChevronIcon, PlusIcon, BookIcon } from './icons';
import { coverOptions } from '../constants';

defineProps({
  collapsed: Boolean,
  isResizing: Boolean,
  sidebarWidth: Number,
  searchMode: Boolean,
  searchQuery: String,
  filteredCategories: Array,
  selectedKB: String,
  searchInputRef: Object
});

defineEmits([
  'toggle-sidebar',
  'enter-search',
  'exit-search',
  'update:searchQuery',
  'toggle-category',
  'add-kb',
  'select-kb',
  'show-context-menu'
]);
</script>

<style scoped lang="scss">
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
