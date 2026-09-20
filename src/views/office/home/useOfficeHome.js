import { ref, computed } from 'vue';

/**
 * Office 首页数据与动作（最近文件 / 收藏 / 类型过滤）。
 * 文件打开类动作由父级（OfficeWorkspace）执行，这里只管理列表数据。
 */
export function useOfficeHome() {
  const api = window.electronAPI;
  const recents = ref([]);
  const filter = ref('all');

  async function loadRecents() {
    if (!api) return;
    try {
      recents.value = (await api.invoke('office-get-recents')) || [];
    } catch {
      recents.value = [];
    }
  }

  const filteredEntries = computed(() => {
    if (filter.value === 'all') return recents.value;
    return recents.value.filter(e => e.type === filter.value);
  });

  async function toggleStar(entry) {
    if (!api) return;
    const next = !entry.starred;
    entry.starred = next;
    try {
      await api.invoke('office-toggle-starred', entry.path);
    } catch {
      entry.starred = !next;
    }
  }

  async function removeRecent(entry) {
    if (!api) return;
    try {
      await api.invoke('office-remove-recents', [entry.path]);
      recents.value = recents.value.filter(e => e.path !== entry.path);
    } catch { /* ignore */ }
  }

  function reveal(entry) {
    if (api) api.invoke('office-reveal-path', entry.path).catch(() => {});
  }

  return {
    recents,
    filter,
    filteredEntries,
    loadRecents,
    toggleStar,
    removeRecent,
    reveal,
  };
}
