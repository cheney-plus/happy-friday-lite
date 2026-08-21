<template>
  <div class="mcp-connection">
    <!-- Header (fixed, no scroll) -->
    <div class="panel-header">
      <h2 class="section-title">{{ t('drawer.mcp.title') }}</h2>
      <div class="header-actions">
        <button class="add-mcp-btn" @click="openAddModal">
          <Plus :size="14" :stroke-width="2" />
          {{ t('drawer.mcp.addMcp') }}
        </button>
        <button class="close-btn" @click="emit('close')">
          <X :size="16" :stroke-width="2" />
        </button>
      </div>
    </div>

    <!-- Scrollable body -->
    <div class="panel-body">
      <!-- ============ 本机 MCP 服务 ============ -->
      <div class="mcp-section">
        <h3 class="subsection-title">{{ t('drawer.mcp.localService') }}</h3>
        <div class="local-card">
          <div class="local-head">
            <div class="local-title-row">
              <span class="local-name">Happy Friday</span>
              <span class="status-badge" :class="localStatus.running ? 'on' : 'off'">
                <span class="status-dot"></span>
                {{ localStatus.running ? t('drawer.mcp.statusOn') : t('drawer.mcp.statusOff') }}
              </span>
            </div>
            <button
              class="toggle-btn"
              :disabled="localToggling"
              @click="toggleLocal"
            >
              <span v-if="localToggling">{{ t('drawer.mcp.starting') }}</span>
              <span v-else-if="localStatus.running">{{ t('drawer.mcp.stop') }}</span>
              <span v-else>{{ t('drawer.mcp.start') }}</span>
            </button>
          </div>

          <div class="local-desc">{{ t('drawer.mcp.localDesc') }}</div>

          <div class="local-meta">
            <span class="meta-item">
              <Wrench :size="12" :stroke-width="2" />
              {{ localStatus.toolCount }} {{ t('drawer.mcp.tools') }}
            </span>
            <span v-if="localStatus.port" class="meta-item mono">
              <LinkIcon :size="12" :stroke-width="2" />
              127.0.0.1:{{ localStatus.port }}
            </span>
          </div>

          <div class="config-block">
            <div class="config-head">
              <span class="config-label">{{ t('drawer.mcp.copyHint') }}</span>
              <button class="copy-btn" @click="copyLocalJson">
                <template v-if="copied">
                  <Check :size="12" :stroke-width="2" />
                  {{ t('drawer.mcp.copied') }}
                </template>
                <template v-else>
                  <Copy :size="12" :stroke-width="2" />
                  {{ t('drawer.mcp.copyJson') }}
                </template>
              </button>
            </div>
            <pre class="config-json">{{ localConfig.json }}</pre>
          </div>

          <div class="security-hint">
            <ShieldAlert :size="12" :stroke-width="2" />
            <span>{{ t('drawer.mcp.securityHint') }}</span>
          </div>
        </div>
      </div>

      <!-- ============ 已添加的 MCP 服务器 ============ -->
      <div class="mcp-section">
        <h3 class="subsection-title">
          {{ t('drawer.mcp.added') }}
          <span v-if="servers.length" class="count-badge">{{ servers.length }}</span>
        </h3>

        <div v-if="loading" class="empty-hint">{{ t('drawer.mcp.loading') }}</div>

        <template v-else-if="servers.length">
          <div v-for="srv in servers" :key="srv.name" class="server-card">
            <div class="server-head">
              <div class="server-title">
                <span
                  class="type-badge"
                  :class="srv.type === 'stdio' ? 'stdio' : 'remote'"
                >
                  {{ srv.type === 'stdio' ? t('drawer.mcp.typeStdio') : t('drawer.mcp.typeRemote') }}
                </span>
                <span class="server-name" :title="srv.name">{{ srv.name }}</span>
              </div>
              <div class="server-actions">
                <span class="status-tag" :class="srv.status">
                  <span class="status-dot"></span>
                  {{ statusText(srv.status) }}
                </span>
                <button
                  class="icon-btn"
                  :title="t('drawer.mcp.refresh')"
                  :disabled="srv.status === 'loading' || refreshingName === srv.name"
                  @click="handleRefresh(srv)"
                >
                  <RefreshCw
                    :size="13"
                    :stroke-width="2"
                    :class="{ spinning: srv.status === 'loading' || refreshingName === srv.name }"
                  />
                </button>
                <button
                  class="icon-btn danger"
                  :title="t('drawer.mcp.delete')"
                  @click="handleDelete(srv)"
                >
                  <Trash2 :size="13" :stroke-width="2" />
                </button>
              </div>
            </div>

            <div v-if="srv.error" class="server-error" :title="srv.error">
              <AlertCircle :size="12" :stroke-width="2" />
              <span>{{ srv.error }}</span>
            </div>

            <div v-else-if="srv.tools && srv.tools.length" class="server-tools">
              <div class="tools-summary">
                {{ srv.tools.length }} {{ t('drawer.mcp.tools') }}
              </div>
              <div class="tools-list">
                <div
                  v-for="tool in srv.tools"
                  :key="tool.name"
                  class="tool-chip"
                  @mouseenter="showDescTooltip($event, tool.description)"
                  @mouseleave="hideDescTooltip"
                >
                  <span class="tool-name">{{ tool.name }}</span>
                </div>
              </div>
            </div>

            <div v-else-if="srv.status === 'loading'" class="server-empty">
              {{ t('drawer.mcp.connecting') }}
            </div>
            <div v-else class="server-empty">{{ t('drawer.mcp.noTools') }}</div>
          </div>
        </template>

        <div v-else class="empty-hint">{{ t('drawer.mcp.emptyAdded') }}</div>
      </div>
    </div>

    <!-- Transient notice -->
    <Transition name="menu-fade">
      <div v-if="notice" class="notice" :class="notice.type">{{ notice.text }}</div>
    </Transition>

    <!-- Full-description hover tooltip (fixed → escapes scroll/overflow) -->
    <div v-if="tooltip.visible" class="desc-tooltip" :style="tooltip.style">
      {{ tooltip.text }}
    </div>

    <!-- Add MCP Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showAddModal" class="mcp-modal-overlay" @click.self="closeAddModal">
          <div class="mcp-modal">
            <div class="modal-header">
              <h3 class="modal-title">{{ t('drawer.mcp.addTitle') }}</h3>
              <button class="modal-close" @click="closeAddModal">
                <X :size="16" :stroke-width="2" />
              </button>
            </div>

            <div class="modal-body">
              <p class="modal-hint">{{ t('drawer.mcp.addHint') }}</p>
              <textarea
                v-model="jsonInput"
                class="json-textarea"
                :placeholder="examplePlaceholder"
                spellcheck="false"
                rows="10"
                @keydown.ctrl.enter="confirmAdd"
              ></textarea>

              <div class="example-toggle">
                <button class="example-btn" @click="showExample = !showExample">
                  <ChevronRight
                    v-if="!showExample"
                    :size="12"
                    :stroke-width="2"
                  />
                  <ChevronDown v-else :size="12" :stroke-width="2" />
                  {{ t('drawer.mcp.examples') }}
                </button>
              </div>
              <Transition name="expand">
                <pre v-if="showExample" class="example-block">{{ exampleText }}</pre>
              </Transition>

              <div v-if="addError" class="add-error">
                <AlertCircle :size="12" :stroke-width="2" />
                <span>{{ addError }}</span>
              </div>
            </div>

            <div class="modal-footer">
              <button class="modal-btn cancel" @click="closeAddModal">
                {{ t('drawer.mcp.addCancel') }}
              </button>
              <button
                class="modal-btn confirm"
                :disabled="adding || !jsonInput.trim()"
                @click="confirmAdd"
              >
                {{ adding ? t('drawer.mcp.loading') : t('drawer.mcp.addConfirm') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Plus, X, Copy, Check, Trash2, RefreshCw, AlertCircle,
  ChevronDown, ChevronRight, Wrench, Link as LinkIcon, ShieldAlert
} from 'lucide-vue-next';

const { t } = useI18n();

const emit = defineEmits(['close']);

// ---- 服务器列表 ----
const servers = ref([]);
const loading = ref(false);
const refreshingName = ref('');

// ---- 本机 MCP 服务 ----
const localStatus = ref({ running: false, port: null, url: null, toolCount: 0 });
const localConfig = ref({ json: '', url: '', port: null, toolCount: 0, running: false });
const localToggling = ref(false);
const copied = ref(false);
let copyTimer = null;

// ---- 添加模态 ----
const showAddModal = ref(false);
const jsonInput = ref('');
const adding = ref(false);
const addError = ref('');
const showExample = ref(false);

// ---- 通知 ----
const notice = ref(null);
let noticeTimer = null;

// ---- 描述悬浮 tooltip ----
const tooltip = ref({ visible: false, text: '', style: {} });

const exampleText = `{
  "mcpServers": {
    "fetch": {
      "type": "streamable_http",
      "url": "https://mcp.api-inference.modelscope.net/f8f2e19128c64e/mcp"
    }
  }
}

或

{
  "mcpServers": {
    "fetch": {
      "command": "uvx",
      "args": ["mcp-server-fetch"]
    }
  }
}`;

const examplePlaceholder = `{
  "mcpServers": {
    "fetch": {
      "type": "streamable_http",
      "url": "https://..."
    }
  }
}`;

const showNotice = (text, type = 'info') => {
  notice.value = { text, type };
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice.value = null;
  }, 2800);
};

const showDescTooltip = (e, text) => {
  if (!text) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const maxW = 320;
  let x = rect.left;
  if (x + maxW > window.innerWidth - 8) {
    x = Math.max(8, window.innerWidth - 8 - maxW);
  }
  const spaceBelow = window.innerHeight - rect.bottom - 6;
  const spaceAbove = rect.top - 6;
  let style;
  if (spaceBelow >= spaceAbove) {
    style = { left: x + 'px', top: Math.max(8, rect.bottom + 6) + 'px' };
  } else {
    style = { left: x + 'px', bottom: Math.max(8, window.innerHeight - rect.top + 6) + 'px' };
  }
  tooltip.value = { visible: true, text, style };
};

const hideDescTooltip = () => {
  tooltip.value = { ...tooltip.value, visible: false };
};

const statusText = (status) => {
  if (status === 'loading') return t('drawer.mcp.connecting');
  if (status === 'connected') return t('drawer.mcp.connected');
  if (status === 'error') return t('drawer.mcp.error');
  return status;
};

// ============ 数据加载 ============

const loadServers = async () => {
  loading.value = true;
  try {
    const list = await window.electronAPI?.invoke('mcp-list-servers');
    servers.value = Array.isArray(list) ? list : [];
  } catch (e) {
    console.error('load mcp servers failed', e);
    servers.value = [];
  } finally {
    loading.value = false;
  }
};

const loadLocal = async () => {
  try {
    // getLocalMcpConfig 内部已包含 running / port / toolCount 等状态字段
    const cfg = await window.electronAPI?.invoke('mcp-get-local-config');
    if (cfg) {
      localConfig.value = cfg;
      localStatus.value = {
        running: !!cfg.running,
        port: cfg.port,
        url: cfg.url,
        toolCount: cfg.toolCount ?? 0
      };
    }
  } catch (e) {
    console.error('load local mcp failed', e);
  }
};

// ============ 本机服务：启停 / 复制 ============

const toggleLocal = async () => {
  if (localToggling.value) return;
  localToggling.value = true;
  try {
    const target = !localStatus.value.running;
    const res = await window.electronAPI?.invoke('mcp-local-toggle', { enabled: target });
    if (res) {
      localStatus.value = {
        running: !!res.running,
        port: res.port,
        url: res.url,
        toolCount: res.toolCount ?? localStatus.value.toolCount
      };
      // 刷新可复制 JSON（启停后端口可能变化）
      await loadLocal();
      if (res.keptAlive) {
        const consumers = Array.isArray(res.consumers) ? res.consumers : [];
        const messageKey = consumers.includes('deepseek-harness')
          ? 'drawer.mcp.harnessUsing'
          : 'drawer.mcp.internalUsing';
        // 服务被 DeepSeek Harness 等内部消费者持有时，不能静默保活。
        // 使用原生对话框确保用户明确知道停止操作未生效的原因。
        window.alert(t(messageKey));
      }
    } else {
      showNotice(t('drawer.mcp.toggleFailed'), 'error');
    }
  } catch (e) {
    showNotice(`${e?.message || e}`, 'error');
  } finally {
    localToggling.value = false;
  }
};

const copyLocalJson = async () => {
  try {
    const text = localConfig.value?.json || '';
    if (!text) return;
    await navigator.clipboard.writeText(text);
    copied.value = true;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copied.value = false;
    }, 1800);
  } catch (e) {
    showNotice(`${t('drawer.mcp.copyJson')}: ${e?.message || e}`, 'error');
  }
};

// ============ 添加 / 删除 / 刷新 ============

const openAddModal = () => {
  addError.value = '';
  jsonInput.value = '';
  showAddModal.value = true;
};

const closeAddModal = () => {
  if (adding.value) return;
  showAddModal.value = false;
  addError.value = '';
};

const friendlyAddError = (code) => {
  if (code === 'invalidJson') return t('drawer.mcp.invalidJson');
  if (code === 'noServers') return t('drawer.mcp.noServers');
  if (code === 'duplicate') return t('drawer.mcp.duplicate');
  return code || t('drawer.mcp.addFailed');
};

const confirmAdd = async () => {
  if (adding.value || !jsonInput.value.trim()) return;
  adding.value = true;
  addError.value = '';
  try {
    const res = await window.electronAPI?.invoke('mcp-add-servers', { json: jsonInput.value });
    if (!res) return;
    if (res.success) {
      showAddModal.value = false;
      jsonInput.value = '';
      await loadServers();
      const addedCount = res.added?.length || 0;
      if (addedCount > 0) {
        showNotice(`+${addedCount}`, 'info');
      }
    } else {
      addError.value = friendlyAddError(res.error);
    }
    // 部分成功：errors 里有重复/无效
    if (res.errors && res.errors.length) {
      const msg = res.errors
        .map((e) => `${e.name}: ${friendlyAddError(e.error)}`)
        .join('; ');
      if (res.success) {
        showNotice(msg, 'info');
      } else {
        addError.value = msg;
      }
    }
  } catch (e) {
    addError.value = `${t('drawer.mcp.addFailed')}: ${e?.message || e}`;
  } finally {
    adding.value = false;
  }
};

const handleDelete = async (srv) => {
  if (!confirm(t('drawer.mcp.deleteConfirm'))) return;
  try {
    const res = await window.electronAPI?.invoke('mcp-delete-server', { name: srv.name });
    if (res?.success) {
      await loadServers();
    } else {
      showNotice(`${t('drawer.mcp.deleteFailed')}: ${res?.error || ''}`, 'error');
    }
  } catch (e) {
    showNotice(`${t('drawer.mcp.deleteFailed')}: ${e?.message || e}`, 'error');
  }
};

const handleRefresh = async (srv) => {
  if (refreshingName.value) return;
  refreshingName.value = srv.name;
  // 乐观更新：立即显示 loading
  srv.status = 'loading';
  try {
    const res = await window.electronAPI?.invoke('mcp-refresh-server', { name: srv.name });
    if (res?.server) {
      // 替换列表中的对应项
      const idx = servers.value.findIndex((s) => s.name === srv.name);
      if (idx >= 0) {
        servers.value[idx] = res.server;
      }
    } else {
      showNotice(`${t('drawer.mcp.refreshFailed')}: ${res?.error || ''}`, 'error');
      await loadServers();
    }
  } catch (e) {
    showNotice(`${t('drawer.mcp.refreshFailed')}: ${e?.message || e}`, 'error');
    await loadServers();
  } finally {
    refreshingName.value = '';
  }
};

onMounted(() => {
  loadServers();
  loadLocal();
});

onUnmounted(() => {
  clearTimeout(noticeTimer);
  clearTimeout(copyTimer);
});
</script>

<style scoped>
.mcp-connection {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  position: relative;
}

/* ============ Header ============ */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 10px 7px;
  flex-shrink: 0;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.add-mcp-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 5px;
  font-size: 11px;
  color: var(--text-primary);
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.15s, border-color 0.15s;
}

.add-mcp-btn:hover:not(:disabled) {
  background-color: var(--bg-hover);
  border-color: var(--text-tertiary);
}

.add-mcp-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.close-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 5px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
  flex-shrink: 0;
}

.close-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

/* ============ Body ============ */
.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) transparent;
}

.panel-body::-webkit-scrollbar {
  width: 6px;
}

.panel-body::-webkit-scrollbar-track {
  background: transparent;
}

.panel-body::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.panel-body::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

.mcp-section {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.subsection-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--bg-hover);
  color: var(--text-tertiary);
  font-size: 10px;
  font-weight: 600;
}

/* ============ 本机服务卡 ============ */
.local-card {
  background-color: var(--bg-secondary);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.local-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.local-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.local-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  border-radius: 9px;
  font-size: 10px;
  font-weight: 500;
}

.status-badge .status-dot,
.status-tag .status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-badge.on {
  background: rgba(34, 197, 94, 0.12);
  color: #16a34a;
}

.status-badge.on .status-dot {
  background: #22c55e;
}

.status-badge.off {
  background: var(--bg-hover);
  color: var(--text-tertiary);
}

.status-badge.off .status-dot {
  background: var(--text-tertiary);
}

.toggle-btn {
  padding: 3px 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 5px;
  font-size: 11px;
  color: var(--text-primary);
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.15s, border-color 0.15s;
  flex-shrink: 0;
}

.toggle-btn:hover:not(:disabled) {
  background-color: var(--bg-hover);
  border-color: var(--text-tertiary);
}

.toggle-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.local-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.local-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-tertiary);
}

.meta-item.mono {
  font-family: 'SF Mono', Menlo, Consolas, monospace;
}

.config-block {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.config-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.config-label {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.4;
  flex: 1;
  min-width: 0;
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 5px;
  font-size: 11px;
  color: var(--text-primary);
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.15s, border-color 0.15s;
  flex-shrink: 0;
}

.copy-btn:hover {
  background-color: var(--bg-hover);
  border-color: var(--text-tertiary);
}

.config-json {
  margin: 0;
  padding: 8px 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 120px;
  overflow-y: auto;
  user-select: all;
}

.security-hint {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.5;
}

.security-hint svg {
  flex-shrink: 0;
  margin-top: 1px;
}

/* ============ 服务器卡片 ============ */
.server-card {
  background-color: var(--bg-secondary);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.server-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.server-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.type-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  flex-shrink: 0;
}

.type-badge.remote {
  background: rgba(59, 130, 246, 0.12);
  color: #2563eb;
}

.type-badge.stdio {
  background: rgba(168, 85, 247, 0.12);
  color: #9333ea;
}

.server-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.server-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
}

.status-tag.connected {
  color: #16a34a;
}

.status-tag.connected .status-dot {
  background: #22c55e;
}

.status-tag.loading {
  color: var(--text-tertiary);
}

.status-tag.loading .status-dot {
  background: var(--text-tertiary);
}

.status-tag.error {
  color: #ef4444;
}

.status-tag.error .status-dot {
  background: #ef4444;
}

.icon-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 0;
  transition: background-color 0.15s, color 0.15s;
}

.icon-btn:hover:not(:disabled) {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.icon-btn.danger:hover:not(:disabled) {
  background-color: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.spinning {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.server-error {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  font-size: 11px;
  color: #ef4444;
  line-height: 1.5;
}

.server-error svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.server-error span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.server-tools {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.tools-summary {
  font-size: 11px;
  color: var(--text-tertiary);
}

.tools-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tool-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 10.5px;
  color: var(--text-secondary);
  cursor: help;
  transition: border-color 0.15s, color 0.15s;
  max-width: 100%;
}

.tool-chip:hover {
  border-color: var(--text-tertiary);
  color: var(--text-primary);
}

.tool-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.server-empty {
  font-size: 11px;
  color: var(--text-tertiary);
}

.empty-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  padding: 10px 0;
}

/* ============ Notice ============ */
.notice {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  max-width: calc(100% - 32px);
  padding: 7px 12px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.4;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  color: var(--text-primary);
  z-index: 20;
}

.notice.error {
  border-color: rgba(239, 68, 68, 0.5);
  color: #ef4444;
}

.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 0.15s ease;
}

.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
}

/* ============ Tooltip ============ */
.desc-tooltip {
  position: fixed;
  max-width: 320px;
  padding: 8px 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-primary);
  white-space: normal;
  word-break: break-word;
  pointer-events: none;
  z-index: 99999;
}

/* ============ Modal ============ */
.mcp-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
  padding: 20px;
}

.mcp-modal {
  width: 480px;
  max-width: 100%;
  max-height: 90vh;
  background: var(--bg-primary);
  border-radius: 10px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.modal-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.modal-close {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 5px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.modal-close:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.modal-body {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.modal-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.json-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  transition: border-color 0.15s;
}

.json-textarea:focus {
  border-color: var(--text-tertiary);
}

.json-textarea::placeholder {
  color: var(--text-tertiary);
}

.example-toggle {
  display: flex;
}

.example-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
  padding: 2px 0;
  transition: color 0.15s;
}

.example-btn:hover {
  color: var(--text-primary);
}

.example-block {
  margin: 0;
  padding: 8px 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 180px;
  overflow-y: auto;
}

.add-error {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  padding: 6px 8px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 5px;
  font-size: 11px;
  color: #ef4444;
  line-height: 1.5;
}

.add-error svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.modal-btn {
  padding: 5px 14px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 5px;
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.15s, border-color 0.15s;
}

.modal-btn.cancel:hover {
  background-color: var(--bg-hover);
  border-color: var(--text-tertiary);
}

.modal-btn.confirm {
  background: var(--accent-color, #3b82f6);
  border-color: var(--accent-color, #3b82f6);
  color: #fff;
}

.modal-btn.confirm:hover:not(:disabled) {
  opacity: 0.9;
}

.modal-btn.confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.18s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

/* ============ Dark mode ============ */
[data-theme='dark'] .notice,
[data-theme='dark'] .desc-tooltip,
[data-theme='dark'] .mcp-modal {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
}

[data-theme='dark'] .mcp-modal {
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
}

[data-theme='dark'] .status-badge.on,
[data-theme='dark'] .status-tag.connected {
  color: #4ade80;
}

[data-theme='dark'] .type-badge.remote {
  color: #60a5fa;
}

[data-theme='dark'] .type-badge.stdio {
  color: #c084fc;
}

[data-theme='dark'] .status-badge.on .status-dot,
[data-theme='dark'] .status-tag.connected .status-dot {
  background: #4ade80;
}

[data-theme='dark'] .status-tag.error,
[data-theme='dark'] .add-error,
[data-theme='dark'] .server-error {
  color: #f87171;
}

[data-theme='dark'] .status-tag.error .status-dot {
  background: #f87171;
}
</style>
