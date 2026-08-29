import { onUnmounted } from 'vue';
import { electronService } from '@/services/electron';
import { useNoteStore } from '@/store/modules/note';
import { buildConversationSummaryPrompt } from '@/config/prompts';
import { renderMarkdown, stripMarkdown } from '@/utils/markdown';
import { getAssistantContent } from '@/views/friday/utils/messages';
import { loadModelConfig } from '@/views/friday/composables/useModelCatalog';

export function useConversationSummary({ messages, showToast, t }) {
  const noteStore = useNoteStore();
  let unlistenSummaryChunk = null;
  let unlistenSummaryDone = null;
  let unlistenSummaryError = null;

  function cleanupSummaryListeners() {
    if (unlistenSummaryChunk) { unlistenSummaryChunk(); unlistenSummaryChunk = null; }
    if (unlistenSummaryDone) { unlistenSummaryDone(); unlistenSummaryDone = null; }
    if (unlistenSummaryError) { unlistenSummaryError(); unlistenSummaryError = null; }
  }

  function buildTranscript() {
    return messages.value
      .map(msg => {
        if (msg.role === 'user') return `${t('friday.transcriptUser')}${msg.content}`;
        if (msg.role === 'assistant') {
          const content = getAssistantContent(msg);
          return content ? `${t('friday.transcriptAssistant')}${content}` : '';
        }
        return '';
      })
      .filter(Boolean)
      .join('\n\n');
  }

  function extractTitle(finalContent) {
    const lines = finalContent.split('\n');
    for (const line of lines) {
      const match = line.match(/^#\s+(.+)/);
      if (match) return match[1].trim();
    }
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) return trimmed.slice(0, 30);
    }
    return t('friday.summaryFallbackTitle');
  }

  async function doSummarize(model) {
    const summaryRequestId = `summary_${Date.now()}`;
    let summaryContent = '';
    let summaryDone = false;
    const transcript = buildTranscript();
    const prompt = buildConversationSummaryPrompt(transcript);

    cleanupSummaryListeners();

    unlistenSummaryChunk = electronService.listen('chat-chunk', (event) => {
      const data = event.payload;
      if (data.requestId !== summaryRequestId) return;
      summaryContent += data.content;
    });

    unlistenSummaryDone = electronService.listen('chat-done', async (event) => {
      const data = event.payload;
      if (data.requestId !== summaryRequestId) return;
      if (summaryDone) return;
      summaryDone = true;
      cleanupSummaryListeners();

      const finalContent = summaryContent || data.fullContent || '';
      if (!finalContent.trim()) {
        showToast(t('history.summaryEmpty'));
        return;
      }

      try {
        const title = extractTitle(finalContent);
        const htmlContent = renderMarkdown(finalContent);
        const plainText = stripMarkdown(finalContent);
        const note = await noteStore.importNote(null, null, title, htmlContent, plainText);
        showToast(note ? t('history.saveAsNoteSuccess') : t('history.saveAsNoteFailed'));
      } catch (err) {
        console.error('Failed to save summary note:', err);
        showToast(t('history.saveAsNoteFailed'));
      }
    });

    unlistenSummaryError = electronService.listen('chat-error', (event) => {
      const data = event.payload;
      if (data.requestId !== summaryRequestId) return;
      if (summaryDone) return;
      summaryDone = true;
      cleanupSummaryListeners();
      console.error('Summary error:', data.error);
      showToast(t('history.summaryFailed'));
    });

    electronService
      .invoke('chat_without_memory', {
        requestId: summaryRequestId,
        model,
        message: prompt,
        enableThinking: false
      })
      .then((result) => {
        if (result != null) return;
        if (summaryDone) return;
        summaryDone = true;
        cleanupSummaryListeners();
        showToast(t('history.summaryFailed'));
      })
      .catch((err) => {
        console.error('Summary invoke error:', err);
        summaryDone = true;
        cleanupSummaryListeners();
        showToast(t('history.summaryFailed'));
      });
  }

  function handleAddToKnowledge(isStreaming) {
    if (isStreaming) return;
    if (!messages.value.length) {
      showToast(t('history.noSessionContent'));
      return;
    }
    const model = loadModelConfig();
    if (!model) {
      showToast(t('history.noModelConfig'));
      return;
    }
    showToast(t('history.saveAsNoteToast'));
    doSummarize(model);
  }

  onUnmounted(cleanupSummaryListeners);

  return {
    handleAddToKnowledge,
    cleanupSummaryListeners
  };
}
