<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="visible" class="dialog-overlay" @click.self="$emit('close')">
        <div class="dialog-card obsidian-sync-dialog">
          <div class="dialog-header">
            <div>
              <h3>Obsidian WebDAV</h3>
              <p>同步 Vault 到本地知识库</p>
            </div>
            <button class="icon-btn" @click="$emit('close')">×</button>
          </div>

          <div class="dialog-body">
            <aside class="source-list">
              <button class="source-item new" @click="createSource">+ 新建源</button>
              <button
                v-for="source in sources"
                :key="source.id"
                class="source-item"
                :class="{ active: form.id === source.id }"
                @click="selectSource(source)"
              >
                <span>{{ source.name }}</span>
                <small>{{ source.target?.kbName || source.name }}</small>
              </button>
            </aside>

            <section class="source-form">
              <label>
                <span>名称</span>
                <input v-model="form.name" placeholder="My Vault" />
              </label>
              <label>
                <span>WebDAV 地址</span>
                <input v-model="form.webdav.url" placeholder="https://example.com/dav" />
              </label>
              <div class="form-row">
                <label>
                  <span>用户名</span>
                  <input v-model="form.webdav.username" />
                </label>
                <label>
                  <span>密码</span>
                  <input v-model="form.webdav.password" type="password" />
                </label>
              </div>
              <div class="form-row">
                <label>
                  <span>远端 Vault 路径</span>
                  <input v-model="form.webdav.remotePath" placeholder="/vault" />
                </label>
                <label>
                  <span>知识库名称</span>
                  <input v-model="form.target.kbName" placeholder="My Vault" />
                </label>
              </div>
              <div class="form-row">
                <label>
                  <span>忽略目录</span>
                  <input v-model="ignoredDirsText" placeholder=".obsidian, .trash" />
                </label>
                <label>
                  <span>忽略规则</span>
                  <input v-model="ignoredGlobsText" placeholder="*.tmp, drafts/*" />
                </label>
              </div>
              <div class="form-row">
                <label>
                  <span>附件目录</span>
                  <input v-model="attachmentDirsText" placeholder="attachments" />
                </label>
                <label>
                  <span>图片目录</span>
                  <input v-model="imageDirsText" placeholder="images" />
                </label>
              </div>

              <div class="switch-grid">
                <label><input type="checkbox" v-model="form.enabled" /> 启用</label>
                <label><input type="checkbox" v-model="form.sync.scheduleEnabled" /> 定时同步</label>
                <label><input type="checkbox" v-model="form.sync.syncOnStartup" /> 启动时同步</label>
                <label><input type="checkbox" v-model="form.sync.deleteMissingRemoteFiles" /> 删除远端已移除文件</label>
                <label><input type="checkbox" v-model="form.obsidian.syncAttachments" /> 同步附件</label>
                <label><input type="checkbox" v-model="form.obsidian.ragIncludeAttachments" /> 附件参与 RAG</label>
                <label><input type="checkbox" v-model="form.obsidian.ragIncludeImages" /> 图片参与 RAG</label>
                <label><input type="checkbox" v-model="form.obsidian.bidirectionalWriteBack" /> 双向写回</label>
              </div>

              <label class="interval-field">
                <span>同步间隔（分钟）</span>
                <input v-model.number="form.sync.intervalMinutes" type="number" min="5" />
              </label>
              <label class="interval-field">
                <span>下载并发数（1-16）</span>
                <input v-model.number="form.sync.concurrency" type="number" min="1" max="16" />
              </label>

              <p class="status" :class="{ error: statusType === 'error', ok: statusType === 'ok' }">{{ status }}</p>
              <div v-if="progress.visible" class="sync-progress">
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: progress.percent + '%' }"></div>
                </div>
                <span>{{ progress.label }}</span>
              </div>
            </section>
          </div>

          <div class="dialog-actions">
            <button class="secondary" @click="testConnection" :disabled="busy">测试连接</button>
            <button class="secondary danger" @click="deleteCurrent" :disabled="busy || !form.id">删除</button>
            <button class="secondary" @click="saveCurrent" :disabled="busy">保存</button>
            <button class="primary" @click="syncNow" :disabled="busy">立即同步</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';

const props = defineProps({ visible: Boolean });
const emit = defineEmits(['close', 'synced']);

const sources = ref([]);
const busy = ref(false);
const status = ref('');
const statusType = ref('');
const progress = reactive({ visible: false, percent: 0, label: '' });
const form = reactive(createEmptySource());
let unsubscribeSyncStatus = null;

const ignoredDirsText = computed({
  get: () => (form.obsidian.ignoredDirs || []).join(', '),
  set: value => { form.obsidian.ignoredDirs = splitList(value); }
});
const ignoredGlobsText = computed({
  get: () => (form.obsidian.ignoredGlobs || []).join(', '),
  set: value => { form.obsidian.ignoredGlobs = splitList(value); }
});
const attachmentDirsText = computed({
  get: () => (form.obsidian.attachmentDirs || []).join(', '),
  set: value => { form.obsidian.attachmentDirs = splitList(value); }
});
const imageDirsText = computed({
  get: () => (form.obsidian.imageDirs || []).join(', '),
  set: value => { form.obsidian.imageDirs = splitList(value); }
});

watch(() => props.visible, visible => {
  if (visible) loadSources();
});

onMounted(() => {
  if (window.electronAPI) {
    unsubscribeSyncStatus = window.electronAPI.on('obsidian-sync-status', handleSyncStatus);
  }
});

onBeforeUnmount(() => {
  unsubscribeSyncStatus?.();
});

async function loadSources() {
  const result = await window.electronAPI?.invoke('obsidian-list-sources');
  sources.value = result?.sources || [];
  if (sources.value.length) selectSource(sources.value[0]);
  else createSource();
}

async function createSource() {
  const result = await window.electronAPI?.invoke('obsidian-new-source-template');
  assignForm(result?.source || createEmptySource());
  status.value = '';
  statusType.value = '';
}

function selectSource(source) {
  assignForm(source);
  status.value = source.status?.lastError || source.status?.lastSyncAt || '';
  statusType.value = source.status?.lastError ? 'error' : '';
}

async function saveCurrent() {
  await runBusy('保存成功', async () => {
    const result = await window.electronAPI.invoke('obsidian-save-source', { source: toPlainSource() });
    if (!result.success) throw new Error(result.error || '保存失败');
    assignForm(result.source);
    await refreshSources();
  });
}

async function testConnection() {
  await runBusy('连接正常', async () => {
    const result = await window.electronAPI.invoke('obsidian-test-connection', { source: toPlainSource() });
    if (!result.success) throw new Error(result.error || '连接失败');
  });
}

async function syncNow() {
  await runBusy('同步完成', async () => {
    progress.visible = true;
    progress.percent = 0;
    progress.label = '准备同步';
    const saved = await window.electronAPI.invoke('obsidian-save-source', { source: toPlainSource() });
    if (!saved.success) throw new Error(saved.error || '保存失败');
    assignForm(saved.source);
    const result = await window.electronAPI.invoke('obsidian-sync-now', { id: form.id });
    if (!result.success) throw new Error(result.error || '同步失败');
    status.value = `同步完成：下载 ${result.downloaded}，跳过 ${result.skipped}`;
    progress.percent = 100;
    progress.label = `完成：下载 ${result.downloaded}，跳过 ${result.skipped}`;
    statusType.value = 'ok';
    await refreshSources();
    emit('synced');
  });
}

function handleSyncStatus(payload) {
  if (!payload || payload.sourceId !== form.id) return;
  if (payload.progress) applyProgress(payload.progress);
  if (payload.result) {
    progress.visible = true;
    progress.percent = 100;
    progress.label = `完成：下载 ${payload.result.downloaded}，跳过 ${payload.result.skipped}`;
  }
  if (payload.lastError) {
    status.value = payload.lastError;
    statusType.value = 'error';
  }
}

function applyProgress(item) {
  progress.visible = true;
  if (item.phase === 'listing') {
    progress.percent = 5;
    progress.label = `扫描目录：${item.currentDir || '/'}，已发现 ${item.filesFound || 0} 个文件`;
    status.value = '正在扫描远端目录...';
    return;
  }
  if (item.phase === 'downloading') {
    const total = Number(item.total) || 0;
    const current = Number(item.current) || 0;
    progress.percent = total ? Math.max(6, Math.round((current / total) * 100)) : 10;
    progress.label = `下载 ${current}/${total}：${item.path || ''}`;
    status.value = `已下载 ${item.downloaded || 0}，跳过 ${item.skipped || 0}`;
    return;
  }
  if (item.phase === 'done') {
    progress.percent = 100;
    progress.label = `完成：下载 ${item.downloaded || 0}，跳过 ${item.skipped || 0}`;
  }
}

async function deleteCurrent() {
  if (!form.id) return;
  await runBusy('已删除', async () => {
    await window.electronAPI.invoke('obsidian-delete-source', { id: form.id });
    await refreshSources();
    if (sources.value.length) selectSource(sources.value[0]);
    else createSource();
  });
}

async function refreshSources() {
  const result = await window.electronAPI.invoke('obsidian-list-sources');
  sources.value = result?.sources || [];
}

async function runBusy(successMessage, task) {
  busy.value = true;
  status.value = '处理中...';
  statusType.value = '';
  try {
    await task();
    if (!status.value || status.value === '处理中...') status.value = successMessage;
    statusType.value = 'ok';
  } catch (e) {
    status.value = e.message || String(e);
    statusType.value = 'error';
    progress.visible = false;
  } finally {
    busy.value = false;
  }
}

function assignForm(source) {
  Object.assign(form, createEmptySource(), JSON.parse(JSON.stringify(source || {})));
  form.webdav ||= {};
  form.target ||= {};
  form.sync ||= {};
  form.obsidian ||= {};
}

function toPlainSource() {
  return JSON.parse(JSON.stringify(form));
}

function createEmptySource() {
  return {
    id: '',
    name: 'Obsidian Vault',
    enabled: true,
    webdav: { url: '', username: '', password: '', remotePath: '/' },
    target: { categoryId: 'local', kbName: 'Obsidian Vault' },
    sync: { scheduleEnabled: false, syncOnStartup: false, intervalMinutes: 60, concurrency: 4, deleteMissingRemoteFiles: false },
    obsidian: {
      ignoredDirs: ['.obsidian', '.trash'],
      ignoredGlobs: [],
      attachmentDirs: ['attachments'],
      imageDirs: ['images'],
      syncAttachments: true,
      ragIncludeAttachments: false,
      ragIncludeImages: false,
      bidirectionalWriteBack: false
    },
    status: {}
  };
}

function splitList(value) {
  return String(value || '').split(/[\n,]+/).map(item => item.trim()).filter(Boolean);
}
</script>

<style scoped lang="scss">
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.42);
}

.obsidian-sync-dialog {
  width: min(920px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.22);
  display: flex;
  flex-direction: column;
}

.dialog-header,
.dialog-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border-color);
}

.dialog-header h3 {
  margin: 0;
  font-size: 17px;
  color: var(--text-primary);
}

.dialog-header p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-tertiary);
}

.icon-btn {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 22px;
}

.icon-btn:hover {
  background: var(--bg-hover);
}

.dialog-body {
  display: grid;
  grid-template-columns: 210px 1fr;
  min-height: 0;
  overflow: hidden;
}

.source-list {
  border-right: 1px solid var(--border-color);
  padding: 10px;
  overflow-y: auto;
}

.source-item {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  border-radius: 6px;
  padding: 9px 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.source-item:hover,
.source-item.active {
  background: var(--bg-hover);
}

.source-item small {
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.source-item.new {
  color: var(--accent-color);
  margin-bottom: 8px;
}

.source-form {
  padding: 16px 18px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-radius: 6px;
  padding: 8px 10px;
  outline: none;
}

.switch-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}

.switch-grid label {
  flex-direction: row;
  align-items: center;
}

.switch-grid input {
  width: auto;
}

.interval-field {
  max-width: 220px;
}

.status {
  min-height: 20px;
  margin: 0;
  font-size: 13px;
  color: var(--text-tertiary);
}

.status.ok {
  color: #15803d;
}

.status.error {
  color: #dc2626;
}

.sync-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.progress-bar {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--bg-secondary);
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--accent-color);
  transition: width 0.2s ease;
}

.dialog-actions {
  justify-content: flex-end;
  gap: 10px;
  border-bottom: none;
  border-top: 1px solid var(--border-color);
}

.dialog-actions button {
  border: none;
  border-radius: 6px;
  padding: 8px 14px;
  cursor: pointer;
}

.dialog-actions button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.secondary.danger {
  color: #dc2626;
}

.primary {
  background: var(--accent-color);
  color: #fff;
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.16s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

@media (max-width: 760px) {
  .dialog-body {
    grid-template-columns: 1fr;
  }

  .source-list {
    border-right: none;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    gap: 6px;
    overflow-x: auto;
  }

  .source-item {
    min-width: 150px;
  }

  .form-row,
  .switch-grid {
    grid-template-columns: 1fr;
  }
}
</style>
