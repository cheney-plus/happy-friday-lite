<template>
  <Teleport to="body">
    <div v-if="shareModal.visible" class="modal-overlay" @click.self="close">
      <div class="modal-box share-modal">
        <div class="modal-title">{{ t('history.shareTitle') }}</div>
        <div class="modal-desc">{{ t('history.shareDesc', { title: shareModal.sessionTitle }) }}</div>
        <div v-if="shareModal.loading" class="share-loading">
          <span class="share-spinner"></span>
          <span>{{ t('history.shareLoading') }}</span>
        </div>
        <template v-else-if="shareModal.url">
          <div class="share-link-box">
            <input
              class="share-link-input"
              :value="shareModal.url"
              readonly
              ref="shareLinkInputRef"
              @click="selectShareLink"
            />
            <button class="share-copy-btn" :class="{ copied: shareModal.copied }" type="button" @click="copyShareLink">
              <span v-if="shareModal.copied">{{ t('history.shareCopied') }}</span>
              <span v-else>{{ t('history.shareCopy') }}</span>
            </button>
          </div>
          <div class="share-tip">{{ t('history.shareTip') }}</div>
        </template>
        <div v-else class="share-error">{{ shareModal.error || t('history.shareError') }}</div>
        <div class="modal-actions">
          <button v-if="shareModal.url" class="btn btn-confirm" type="button" @click="openShareLink">{{ t('history.shareOpen') }}</button>
          <button class="btn btn-cancel" type="button" @click="close">{{ t('history.close') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { electronService } from '@/services/electron';

const { t } = useI18n();
const shareLinkInputRef = ref(null);
const shareModal = ref({
  visible: false,
  loading: false,
  url: '',
  copied: false,
  sessionTitle: '',
  error: '',
  session: null
});

async function open(session) {
  if (!session?.id) return;
  shareModal.value = {
    visible: true,
    loading: true,
    url: '',
    copied: false,
    sessionTitle: session.title || t('history.newConversation'),
    error: '',
    session
  };
  try {
    const result = await electronService.invoke('get-share-link', { sessionId: session.id });
    if (result && result.success && result.url) {
      shareModal.value.loading = false;
      shareModal.value.url = result.url;
    } else {
      shareModal.value.loading = false;
      shareModal.value.error = (result && result.error) || t('history.shareError');
    }
  } catch (err) {
    console.error('Failed to get share link:', err);
    shareModal.value.loading = false;
    shareModal.value.error = t('history.shareError');
  }
}

function close() {
  shareModal.value.visible = false;
  shareModal.value.url = '';
  shareModal.value.copied = false;
  shareModal.value.error = '';
  shareModal.value.session = null;
}

function selectShareLink() {
  shareLinkInputRef.value?.select();
}

async function copyShareLink() {
  const url = shareModal.value.url;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    shareModal.value.copied = true;
    setTimeout(() => {
      if (shareModal.value.visible) shareModal.value.copied = false;
    }, 2000);
  } catch {
    selectShareLink();
  }
}

function openShareLink() {
  const url = shareModal.value.url;
  if (!url) return;
  electronService.invoke('open-external', url);
}

defineExpose({ open, close });
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 10002;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(4px);
}

.modal-box {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.share-modal {
  min-width: 420px;
  max-width: 480px;
}

.modal-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.modal-desc {
  font-size: 13.5px;
  color: var(--text-secondary);
  line-height: 1.55;
  margin-bottom: 20px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.btn {
  padding: 8px 18px;
  border: none;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
}

.btn-cancel {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.btn-cancel:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-confirm {
  background: var(--accent-color);
  color: #fff;
}

.btn-confirm:hover {
  opacity: 0.9;
}

.share-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 0;
  color: var(--text-tertiary);
  font-size: 13.5px;
}

.share-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: share-spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes share-spin {
  to { transform: rotate(360deg); }
}

.share-link-box {
  display: flex;
  gap: 8px;
  margin: 4px 0 0;
}

.share-link-input {
  flex: 1;
  min-width: 0;
  padding: 9px 12px;
  border: 1.5px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 12.5px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  outline: none;
  cursor: text;
}

.share-link-input:focus {
  border-color: var(--accent-color);
  background: var(--bg-primary);
}

.share-copy-btn {
  flex-shrink: 0;
  padding: 0 16px;
  border: none;
  border-radius: 8px;
  background: var(--accent-color);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
}

.share-copy-btn:hover {
  opacity: 0.9;
}

.share-copy-btn.copied {
  background: #16a34a;
}

.share-tip {
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.5;
}

.share-error {
  padding: 14px;
  margin-top: 4px;
  border-radius: 8px;
  background: rgba(220, 38, 38, 0.08);
  color: #dc2626;
  font-size: 13px;
}

@media (max-width: 520px) {
  .share-modal {
    min-width: min(420px, calc(100vw - 32px));
  }
}
</style>
