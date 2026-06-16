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

  return {
    contextMenu,
    fileContextMenu,
    showContextMenu,
    hideContextMenu,
    showFileContextMenu,
    hideFileContextMenu
  };
}
