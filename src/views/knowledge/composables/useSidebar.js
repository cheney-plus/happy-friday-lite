import { ref, nextTick } from 'vue';
import { SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } from '../constants';

export function useSidebar() {
  const sidebarCollapsed = ref(false);
  const sidebarWidth = ref(240);
  const isResizing = ref(false);
  const searchMode = ref(false);
  const searchQuery = ref('');
  const searchInputRef = ref(null);

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

  return {
    sidebarCollapsed,
    sidebarWidth,
    isResizing,
    searchMode,
    searchQuery,
    searchInputRef,
    toggleSidebar,
    onResizeStart,
    enterSearchMode,
    exitSearchMode
  };
}
