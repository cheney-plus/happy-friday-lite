<template>
  <div class="usage-panel">
    <!-- Header (fixed, no scroll) -->
    <div class="panel-header">
      <h2 class="section-title">{{ t('drawer.usage.title') }}</h2>
      <div class="header-actions">
        <button
          class="icon-btn"
          :title="t('drawer.usage.refresh')"
          :disabled="loading"
          @click="loadStats"
        >
          <RefreshCw :size="14" :stroke-width="2" :class="{ spinning: loading }" />
        </button>
        <button class="close-btn" @click="emit('close')">
          <X :size="16" :stroke-width="2" />
        </button>
      </div>
    </div>

    <!-- Body -->
    <div class="panel-body">
      <!-- Range selector -->
      <div class="range-bar">
        <span class="range-label">{{ t('drawer.usage.range') }}</span>
        <div class="range-tabs">
          <button
            v-for="opt in rangeOptions"
            :key="opt.value"
            class="range-tab"
            :class="{ active: range === opt.value }"
            @click="switchRange(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
        <button
          class="clear-btn"
          :disabled="loading || !hasData"
          @click="onClear"
        >
          <Trash2 :size="12" :stroke-width="2" />
          {{ t('drawer.usage.clear') }}
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading && !stats" class="state-block">
        <Loader2 :size="22" :stroke-width="2" class="spinning" />
        <span class="state-text">{{ t('drawer.usage.loading') }}</span>
      </div>

      <!-- Error -->
      <div v-else-if="loadError" class="state-block error">
        <AlertCircle :size="22" :stroke-width="1.8" />
        <span class="state-text">{{ loadError }}</span>
        <button class="retry-btn" @click="loadStats">{{ t('drawer.usage.refresh') }}</button>
      </div>

      <!-- Empty -->
      <div v-else-if="!hasData" class="state-block">
        <div class="empty-icon">
          <BarChart3 :size="40" :stroke-width="1.2" />
        </div>
        <span class="state-text">{{ t('drawer.usage.empty') }}</span>
      </div>

      <!-- Stats content -->
      <template v-else>
        <!-- Summary cards -->
        <div class="summary-grid">
          <div class="summary-card primary">
            <div class="summary-label">{{ t('drawer.usage.totalTokens') }}</div>
            <div class="summary-value">{{ formatNumber(stats.summary.totalTokens) }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">{{ t('drawer.usage.promptTokens') }}</div>
            <div class="summary-value">{{ formatNumber(stats.summary.totalPrompt) }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">{{ t('drawer.usage.completionTokens') }}</div>
            <div class="summary-value">{{ formatNumber(stats.summary.totalCompletion) }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">{{ t('drawer.usage.reasoningTokens') }}</div>
            <div class="summary-value">{{ formatNumber(stats.summary.totalReasoning) }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">{{ t('drawer.usage.requests') }}</div>
            <div class="summary-value">{{ formatNumber(stats.summary.totalRequests) }}</div>
          </div>
        </div>

        <!-- Daily trend -->
        <section v-if="trendHasData" class="section">
          <div class="section-head">
            <h3 class="section-h">{{ t('drawer.usage.dailyTrend') }}</h3>
            <span class="section-sub">{{ t('drawer.usage.last7Days') }}</span>
          </div>
          <div class="trend-chart">
            <div
              v-for="day in trendBars"
              :key="day.date"
              class="trend-col"
              :title="`${day.label}: ${formatNumber(day.tokens)}`"
            >
              <div class="trend-bar-wrap">
                <div
                  class="trend-bar"
                  :style="{ height: day.heightPct + '%' }"
                ></div>
              </div>
              <span class="trend-label">{{ day.shortLabel }}</span>
              <span class="trend-value">{{ formatShort(day.tokens) }}</span>
            </div>
          </div>
        </section>

        <!-- By model -->
        <section v-if="stats.byModel.length" class="section">
          <h3 class="section-h">{{ t('drawer.usage.byModel') }}</h3>
          <div class="list">
            <div
              v-for="(item, idx) in stats.byModel"
              :key="'m-' + idx"
              class="list-row"
            >
              <div class="list-name" :title="item.modelName || item.provider || '-'">
                <span class="dot" :style="{ background: modelColor(idx) }"></span>
                {{ item.modelName || item.provider || '-' }}
              </div>
              <div class="list-stats">
                <span class="list-tokens">{{ formatNumber(item.totalTokens) }}</span>
                <span class="list-req">{{ formatNumber(item.requests) }} {{ t('drawer.usage.requests') }}</span>
              </div>
              <div class="list-bar">
                <div
                  class="list-bar-fill"
                  :style="{ width: barPct(item.totalTokens, stats.byModel[0].totalTokens) + '%', background: modelColor(idx) }"
                ></div>
              </div>
            </div>
          </div>
        </section>

        <!-- By source -->
        <section v-if="stats.bySource.length" class="section">
          <h3 class="section-h">{{ t('drawer.usage.bySource') }}</h3>
          <div class="list">
            <div
              v-for="(item, idx) in stats.bySource"
              :key="'s-' + idx"
              class="list-row"
            >
              <div class="list-name">
                <span class="dot" :style="{ background: sourceColor(item.source) }"></span>
                {{ sourceLabel(item.source) }}
              </div>
              <div class="list-stats">
                <span class="list-tokens">{{ formatNumber(item.totalTokens) }}</span>
                <span class="list-req">{{ formatNumber(item.requests) }} {{ t('drawer.usage.requests') }}</span>
              </div>
              <div class="list-bar">
                <div
                  class="list-bar-fill"
                  :style="{ width: barPct(item.totalTokens, stats.bySource[0].totalTokens) + '%', background: sourceColor(item.source) }"
                ></div>
              </div>
            </div>
          </div>
        </section>

        <p class="cost-hint">{{ t('drawer.usage.costHint') }}</p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { BarChart3, X, RefreshCw, Trash2, Loader2, AlertCircle } from 'lucide-vue-next'

const { t, locale } = useI18n()

const emit = defineEmits(['close'])

const range = ref('all')
const loading = ref(false)
const loadError = ref('')
const stats = ref(null)

const rangeOptions = computed(() => [
  { value: 'today', label: t('drawer.usage.rangeToday') },
  { value: '7d', label: t('drawer.usage.range7d') },
  { value: '30d', label: t('drawer.usage.range30d') },
  { value: 'all', label: t('drawer.usage.rangeAll') }
])

const hasData = computed(() => {
  const s = stats.value
  return !!(s && s.summary && s.summary.totalRequests > 0)
})

const trendHasData = computed(() => {
  return !!(stats.value && stats.value.byDay && stats.value.byDay.some(d => d.totalTokens > 0))
})

// 7-day trend bars (newest last). usage.js byDay already returns YYYY-MM-DD date strings.
const trendBars = computed(() => {
  const s = stats.value
  if (!s || !s.byDay || !s.byDay.length) return []
  const arr = s.byDay.slice(-7)
  const max = Math.max(1, ...arr.map(d => Number(d.totalTokens) || 0))
  return arr.map(d => {
    const date = typeof d.date === 'string' ? d.date : new Date(d.ts || Date.now()).toISOString().slice(0, 10)
    const tokens = Number(d.totalTokens) || 0
    return {
      date,
      label: date,
      shortLabel: shortDateLabel(date),
      tokens,
      heightPct: Math.max(2, Math.round((tokens / max) * 100))
    }
  })
})

function shortDateLabel(iso) {
  // iso: YYYY-MM-DD
  if (!iso || iso.length < 10) return ''
  const [, m, d] = iso.split('-')
  return `${m}/${d}`
}

function switchRange(r) {
  if (range.value === r) return
  range.value = r
  loadStats()
}

async function loadStats() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await window.electronAPI?.invoke('usage-get-stats', { range: range.value })
    if (!res || res.success === false) {
      loadError.value = (res && res.error) || t('drawer.usage.loadFailed')
      stats.value = null
    } else {
      stats.value = res.data
    }
  } catch (e) {
    loadError.value = e?.message || t('drawer.usage.loadFailed')
    stats.value = null
  } finally {
    loading.value = false
  }
}

async function onClear() {
  if (!window.confirm(t('drawer.usage.clearConfirm'))) return
  try {
    const res = await window.electronAPI?.invoke('usage-clear')
    if (res && res.success !== false) {
      stats.value = null
      await loadStats()
    } else {
      window.alert((res && res.error) || t('drawer.usage.clearFailed'))
    }
  } catch (e) {
    window.alert(e?.message || t('drawer.usage.clearFailed'))
  }
}

// ---------- formatting & colors ----------
function formatNumber(n) {
  const v = Number(n) || 0
  return v.toLocaleString(locale.value === 'zh-CN' ? 'zh-CN' : 'en-US')
}

function formatShort(n) {
  const v = Number(n) || 0
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'k'
  return String(v)
}

function barPct(value, max) {
  const v = Number(value) || 0
  const m = Number(max) || 0
  if (m <= 0) return 0
  return Math.max(2, Math.round((v / m) * 100))
}

const MODEL_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'
]

function modelColor(idx) {
  return MODEL_COLORS[idx % MODEL_COLORS.length]
}

const SOURCE_COLORS = {
  chat: '#6366f1',
  agent: '#ec4899',
  rag: '#f59e0b',
  title: '#10b981',
  fim: '#3b82f6',
  note_ai: '#8b5cf6',
  unknown: '#9ca3af'
}

function sourceColor(src) {
  return SOURCE_COLORS[src] || SOURCE_COLORS.unknown
}

function sourceLabel(src) {
  const map = {
    chat: 'sourceChat',
    agent: 'sourceAgent',
    rag: 'sourceRag',
    title: 'sourceTitle',
    fim: 'sourceFim',
    note_ai: 'sourceNoteAi',
    unknown: 'sourceUnknown'
  }
  const key = map[src] || 'sourceUnknown'
  return t('drawer.usage.' + key)
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.usage-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

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

.icon-btn {
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
}

.icon-btn:hover:not(:disabled) {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.icon-btn:disabled {
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

.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) transparent;
  padding: 0 10px 16px;
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

/* range bar */
.range-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0 12px;
  flex-wrap: wrap;
}

.range-label {
  font-size: 12px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.range-tabs {
  display: flex;
  background: var(--bg-secondary);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}

.range-tab {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.range-tab:hover {
  color: var(--text-primary);
}

.range-tab.active {
  background: var(--bg-active);
  color: var(--text-primary);
  font-weight: 500;
}

.clear-btn {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.clear-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--danger-color, #ef4444);
}

.clear-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* state block */
.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 60px 20px;
  color: var(--text-tertiary);
}

.state-block.error {
  color: var(--danger-color, #ef4444);
}

.empty-icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: 16px;
  color: var(--text-tertiary);
}

.state-text {
  font-size: 13px;
  color: var(--text-tertiary);
  text-align: center;
}

.retry-btn {
  margin-top: 4px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 5px;
  cursor: pointer;
}

.retry-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* summary cards */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.summary-card {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 10px 12px;
}

.summary-card.primary {
  grid-column: span 2;
  background: linear-gradient(135deg, var(--primary-gradient-from, #6366f1), var(--primary-gradient-to, #8b5cf6));
  color: #fff;
}

.summary-label {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-bottom: 4px;
}

.summary-card.primary .summary-label {
  color: rgba(255, 255, 255, 0.85);
}

.summary-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.summary-card.primary .summary-value {
  font-size: 22px;
  color: #fff;
}

/* section */
.section {
  margin-bottom: 16px;
}

.section-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}

.section-h {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.section-sub {
  font-size: 11px;
  color: var(--text-tertiary);
}

/* trend chart */
.trend-chart {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 110px;
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 10px 8px 6px;
}

.trend-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  height: 100%;
  min-width: 0;
}

.trend-bar-wrap {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-height: 0;
}

.trend-bar {
  width: 70%;
  max-width: 22px;
  min-height: 2px;
  background: linear-gradient(180deg, var(--primary-gradient-from, #6366f1), var(--primary-gradient-to, #8b5cf6));
  border-radius: 3px 3px 0 0;
  transition: height 0.3s ease;
}

.trend-label {
  font-size: 10px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.trend-value {
  font-size: 10px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

/* list */
.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.list-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: auto auto;
  gap: 4px 8px;
  padding: 8px 10px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.list-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.list-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.list-tokens {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.list-req {
  font-size: 10px;
  color: var(--text-tertiary);
}

.list-bar {
  grid-column: 1 / -1;
  height: 4px;
  background: var(--bg-hover, rgba(0,0,0,0.06));
  border-radius: 2px;
  overflow: hidden;
}

.list-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.cost-hint {
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 12px 0 0;
  text-align: center;
}

/* spinning animation */
.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
