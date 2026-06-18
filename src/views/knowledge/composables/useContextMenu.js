import { reactive } from 'vue';

export function useContextMenu() {
  const contextMenu = reactive({
    visible: false,
    x: 0,
    y: 0,
    categoryId: '',
    item: null
  });

  const fileContextMenu = reactive({
    visible: false,
    x: 0,
    y: 0
  });

  // 文件/文件夹右键菜单
  const fileItemContextMenu = reactive({
    visible: false,
    x: 0,
    y: 0,
    item: null
  });

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

  function showFileContextMenu(event) {
    fileContextMenu.visible = true;
    fileContextMenu.x = event.clientX;
    fileContextMenu.y = event.clientY;
  }

  function hideFileContextMenu() {
    fileContextMenu.visible = false;
  }

  function showFileItemContextMenu(event, item) {
    fileItemContextMenu.visible = true;
    fileItemContextMenu.x = event.clientX;
    fileItemContextMenu.y = event.clientY;
    fileItemContextMenu.item = item;
  }

  function hideFileItemContextMenu() {
    fileItemContextMenu.visible = false;
    fileItemContextMenu.item = null;
  }

  return {
    contextMenu,
    fileContextMenu,
    fileItemContextMenu,
    showContextMenu,
    hideContextMenu,
    showFileContextMenu,
    hideFileContextMenu,
    showFileItemContextMenu,
    hideFileItemContextMenu
  };
}
