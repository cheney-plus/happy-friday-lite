import { computed, onMounted, onUnmounted, ref } from 'vue';
import { electronService } from '@/services/electron';
import { useFridayStore } from '@/store';

export async function refreshHistorySessions() {
  const fridayStore = useFridayStore();
  try {
    const sessions = await electronService.invoke('get_sessions');
    fridayStore.setHistorySessions((sessions || []).slice(0, 50));
  } catch (err) {
    console.error('Failed to load conversation history:', err);
  }
}

export function useConversationHistory({ isShareMode } = {}) {
  const fridayStore = useFridayStore();
  const historyLoading = ref(false);
  let unlistenTitle = null;

  async function loadHistorySessions() {
    if (isShareMode?.value) return;
    historyLoading.value = true;
    try {
      await refreshHistorySessions();
    } finally {
      historyLoading.value = false;
    }
  }

  onMounted(() => {
    loadHistorySessions();
    unlistenTitle = electronService.listen('session-title-updated', (event) => {
      const data = event.payload;
      if (data?.sessionId && data.title) {
        fridayStore.patchHistorySession(data.sessionId, { title: data.title });
      }
    });
  });

  onUnmounted(() => {
    if (unlistenTitle) unlistenTitle();
  });

  return {
    historySessions: computed(() => fridayStore.historySessions),
    historyLoading,
    loadHistorySessions
  };
}
