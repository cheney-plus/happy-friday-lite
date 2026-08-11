<template>
  <div class="automation-page" @click="closePageDropdowns">
    <header class="page-header">
      <div class="heading-group">
        <h1>{{ t('automation.title') }}</h1>
        <p>{{ t('automation.description') }}</p>
      </div>

      <div class="header-actions">
        <button class="create-button secondary" type="button" @click="openManualCreate">
          {{ t('automation.actions.manualCreate') }}
        </button>
        <button class="create-button primary" type="button" @click="openFridayHome">
          <MessageCirclePlus :size="17" :stroke-width="2" />
          {{ t('automation.actions.createInChat') }}
        </button>
      </div>
    </header>

    <nav class="tabs" :aria-label="t('automation.title')">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        :class="['tab-button', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </nav>

    <section v-if="activeTab === 'configured'" class="configured-panel">
      <div class="local-task-notice">
        <div class="notice-message">
          <Info :size="17" :stroke-width="2" />
          <span>{{ t('automation.configured.localTaskNotice') }}</span>
        </div>
        <div class="keep-awake-control">
          <span>{{ t('automation.configured.keepAwake') }}</span>
          <label class="toggle-switch">
            <input v-model="keepAwake" type="checkbox" :aria-label="t('automation.configured.keepAwake')" />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <article class="configured-task">
        <div class="task-summary">
          <Cloud :size="18" :stroke-width="1.8" class="task-cloud-icon" />
          <strong>{{ t('automation.sample.taskName') }}</strong>
          <span class="task-schedule">{{ t('automation.configured.schedule') }}</span>
        </div>
        <div class="task-actions">
          <button class="icon-button" type="button" :title="t('automation.configured.more')" @click="showComingSoon">
            <Ellipsis :size="18" :stroke-width="2" />
          </button>
          <button class="icon-button" type="button" :title="t('automation.configured.runNow')" @click="showComingSoon">
            <CirclePlay :size="18" :stroke-width="1.8" />
          </button>
          <label class="toggle-switch">
            <input v-model="taskEnabled" type="checkbox" :aria-label="t('automation.configured.enableTask')" />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </article>
    </section>

    <template v-else-if="activeTab === 'history'">
      <section class="filters" aria-label="filters">
        <div class="select-control custom-dropdown" @click.stop>
          <button class="dropdown-trigger" type="button" @click.stop="toggleStatusMenu">
            <span>{{ currentStatusLabel }}</span>
            <ChevronDown :size="16" :stroke-width="2" :class="{ expanded: showStatusMenu }" />
          </button>
          <Transition name="dropdown-menu">
            <div v-if="showStatusMenu" class="dropdown-menu more-menu history-filter-menu">
              <button
                v-for="option in statusOptions"
                :key="option.value"
                type="button"
                :class="['menu-item', { active: statusFilter === option.value }]"
                @click="selectStatus(option.value)"
              >
                <span>{{ option.label }}</span>
                <Check v-if="statusFilter === option.value" :size="13" :stroke-width="2.3" />
              </button>
            </div>
          </Transition>
        </div>

        <div class="select-control task-source custom-dropdown" @click.stop>
          <button class="dropdown-trigger" type="button" @click.stop="toggleTaskMenu">
            <span>{{ currentTaskLabel }}</span>
            <ChevronDown :size="16" :stroke-width="2" :class="{ expanded: showTaskMenu }" />
          </button>
          <Transition name="dropdown-menu">
            <div v-if="showTaskMenu" class="dropdown-menu more-menu history-filter-menu">
              <button
                v-for="option in taskOptions"
                :key="option.value"
                type="button"
                :class="['menu-item', { active: taskFilter === option.value }]"
                @click="selectTask(option.value)"
              >
                <span>{{ option.label }}</span>
                <Check v-if="taskFilter === option.value" :size="13" :stroke-width="2.3" />
              </button>
            </div>
          </Transition>
        </div>

        <div class="date-control custom-dropdown" @click.stop>
          <button class="date-range-trigger" type="button" @click.stop="toggleDateMenu">
            <span>{{ formattedDateRange }}</span>
            <CalendarDays :size="18" :stroke-width="1.8" aria-hidden="true" />
          </button>
          <Transition name="dropdown-menu">
            <div v-if="showDateMenu" class="date-range-menu">
              <label>
                <span>{{ t('automation.filters.startDate') }}</span>
                <input v-model="startDate" type="date" :max="endDate" @change="normalizeDateRange" />
              </label>
              <label>
                <span>{{ t('automation.filters.endDate') }}</span>
                <input v-model="endDate" type="date" :min="startDate" @change="normalizeDateRange" />
              </label>
            </div>
          </Transition>
        </div>
      </section>

      <section class="run-history">
        <h2>{{ t('automation.groups.today') }}</h2>
        <article
          :class="['run-item', { selected: selectedRunId === 'sample-run' }]"
          role="button"
          tabindex="0"
          :aria-pressed="selectedRunId === 'sample-run'"
          @click="selectRun('sample-run')"
          @keydown.enter.prevent="selectRun('sample-run')"
          @keydown.space.prevent="selectRun('sample-run')"
        >
          <div class="status-track" aria-hidden="true">
            <span class="success-dot"><Check :size="13" :stroke-width="3" /></span>
            <span class="track-line"></span>
          </div>
          <div class="run-content">
            <div class="run-title-row">
              <strong>{{ t('automation.sample.taskName') }}</strong>
            </div>
            <p>
              <span>{{ t('automation.sample.trigger') }}</span>
              <span>{{ t('automation.sample.time') }} - {{ t('automation.sample.duration') }}</span>
            </p>
          </div>
        </article>
      </section>
    </template>

    <section v-else class="template-grid">
      <button
        v-for="item in taskTemplates"
        :key="item.key"
        class="template-card"
        type="button"
        @click="showComingSoon"
      >
        <span :class="['template-preview', `is-${item.variant}`]" aria-hidden="true">
          <span v-if="item.variant === 'window'" class="preview-dots">
            <i></i><i></i><i></i>
          </span>
          <span class="preview-lines">
            <i></i><i></i><i></i>
          </span>
          <component :is="item.icon" :size="20" :stroke-width="1.8" class="preview-icon" />
        </span>
        <span class="template-copy">
          <strong>{{ item.title }}</strong>
          <span>{{ item.description }}</span>
        </span>
      </button>
    </section>

    <Transition name="toast">
      <div v-if="toastVisible" class="toast" role="status">
        {{ t('automation.actions.comingSoon') }}
      </div>
    </Transition>
  </div>

  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="manualCreateVisible" class="automation-modal-overlay" @mousedown.self="closeManualCreate">
        <section
          class="automation-modal"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="'automation-create-title'"
          @click="closeDropdowns"
          @keydown.esc="closeManualCreate"
        >
          <header class="modal-header">
            <h2 id="automation-create-title">{{ t('automation.createModal.title') }}</h2>
            <div class="modal-header-actions">
              <button class="template-link" type="button" @click="openTemplates">
                {{ t('automation.createModal.fromTemplate') }}
              </button>
              <button class="modal-close-button" type="button" :title="t('automation.createModal.close')" @click="closeManualCreate">
                <X :size="20" :stroke-width="1.8" />
              </button>
            </div>
          </header>

          <form class="automation-form" @submit.prevent="handleCreateTask">
            <label class="form-field">
              <span class="field-label">{{ t('automation.createModal.taskName') }}</span>
              <input
                ref="taskNameInput"
                v-model="taskName"
                type="text"
                maxlength="80"
                :placeholder="t('automation.createModal.taskNamePlaceholder')"
              />
            </label>

            <div class="trigger-section">
              <span class="field-label">{{ t('automation.createModal.triggerTime') }}</span>
              <div class="trigger-fields">
                <div class="form-select custom-dropdown" @click.stop>
                  <button class="dropdown-trigger" type="button" @click.stop="toggleTriggerMenu">
                    <span>{{ currentTriggerLabel }}</span>
                    <ChevronDown :size="16" :stroke-width="2" :class="{ expanded: showTriggerMenu }" />
                  </button>
                  <Transition name="dropdown-menu">
                    <div v-if="showTriggerMenu" class="dropdown-menu more-menu trigger-menu">
                      <button
                        v-for="option in triggerOptions"
                        :key="option.value"
                        type="button"
                        :class="['menu-item', { active: triggerType === option.value }]"
                        @click="selectTrigger(option.value)"
                      >
                        <span>{{ option.label }}</span>
                        <Check v-if="triggerType === option.value" :size="13" :stroke-width="2.3" />
                      </button>
                    </div>
                  </Transition>
                </div>
                <label class="time-field">
                  <span v-if="!triggerTime" class="time-placeholder">{{ t('automation.createModal.selectTime') }}</span>
                  <input
                    v-model="triggerTime"
                    type="time"
                    :class="{ 'has-value': triggerTime }"
                    :aria-label="t('automation.createModal.selectTime')"
                  />
                  <Clock3 :size="17" :stroke-width="1.8" />
                </label>
              </div>
            </div>

            <div class="instruction-section">
              <div class="instruction-label">
                <span class="field-label">{{ t('automation.createModal.instruction') }}</span>
                <Info :size="15" :stroke-width="1.8" :title="t('automation.createModal.instructionHint')" />
              </div>
              <div class="instruction-editor">
                <textarea
                  v-model="taskInstruction"
                  :placeholder="t('automation.createModal.instructionPlaceholder')"
                  maxlength="2000"
                ></textarea>
                <div class="editor-toolbar">
                  <div class="mode-select custom-dropdown" @click.stop>
                    <button class="dropdown-trigger" type="button" @click.stop="toggleModeMenu">
                      <span>{{ currentModeLabel }}</span>
                      <ChevronDown :size="14" :stroke-width="2" :class="{ expanded: showModeMenu }" />
                    </button>
                    <Transition name="dropdown-menu">
                      <div v-if="showModeMenu" class="dropdown-menu more-menu mode-menu">
                        <button
                          v-for="option in modeOptions"
                          :key="option.value"
                          type="button"
                          :class="['menu-item', { active: executionMode === option.value }]"
                          @click="selectMode(option.value)"
                        >
                          <span>{{ option.label }}</span>
                          <Check v-if="executionMode === option.value" :size="13" :stroke-width="2.3" />
                        </button>
                      </div>
                    </Transition>
                  </div>
                </div>
              </div>
            </div>

            <footer class="modal-footer">
              <button class="modal-button cancel" type="button" @click="closeManualCreate">
                {{ t('automation.createModal.cancel') }}
              </button>
              <button class="modal-button submit" type="submit" :disabled="!canCreateTask">
                {{ t('automation.createModal.create') }}
              </button>
            </footer>
          </form>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  CalendarDays,
  Check,
  ChevronDown,
  CirclePlay,
  Clock3,
  Cloud,
  Crosshair,
  Ellipsis,
  FilePlus2,
  Glasses,
  Info,
  LineChart,
  MessageCirclePlus,
  ScanSearch,
  Sparkles,
  TestTubeDiagonal,
  Bug,
  X
} from 'lucide-vue-next';

const { t } = useI18n();
const router = useRouter();

const activeTab = ref('history');
const statusFilter = ref('success');
const taskFilter = ref('all');
const startDate = ref('2026-08-05');
const endDate = ref('2026-08-11');
const keepAwake = ref(false);
const taskEnabled = ref(false);
const toastVisible = ref(false);
const manualCreateVisible = ref(false);
const taskNameInput = ref(null);
const taskName = ref('');
const triggerType = ref('daily');
const triggerTime = ref('');
const taskInstruction = ref('');
const executionMode = ref('auto');
const showTriggerMenu = ref(false);
const showModeMenu = ref(false);
const showStatusMenu = ref(false);
const showTaskMenu = ref(false);
const showDateMenu = ref(false);
const selectedRunId = ref('sample-run');
let toastTimer = null;

const tabs = computed(() => [
  { key: 'configured', label: t('automation.tabs.configured') },
  { key: 'history', label: t('automation.tabs.history') },
  { key: 'templates', label: t('automation.tabs.templates') }
]);

const taskTemplates = computed(() => [
  { key: 'aiNews', icon: Sparkles, variant: 'window', title: t('automation.templates.aiNews.title'), description: t('automation.templates.aiNews.description') },
  { key: 'brandSentiment', icon: Glasses, variant: 'window', title: t('automation.templates.brandSentiment.title'), description: t('automation.templates.brandSentiment.description') },
  { key: 'competitorTracking', icon: Crosshair, variant: 'window', title: t('automation.templates.competitorTracking.title'), description: t('automation.templates.competitorTracking.description') },
  { key: 'stockAlerts', icon: LineChart, variant: 'window', title: t('automation.templates.stockAlerts.title'), description: t('automation.templates.stockAlerts.description') },
  { key: 'securityScan', icon: ScanSearch, variant: 'code', title: t('automation.templates.securityScan.title'), description: t('automation.templates.securityScan.description') },
  { key: 'commitBugs', icon: Bug, variant: 'code', title: t('automation.templates.commitBugs.title'), description: t('automation.templates.commitBugs.description') },
  { key: 'testCoverage', icon: TestTubeDiagonal, variant: 'code', title: t('automation.templates.testCoverage.title'), description: t('automation.templates.testCoverage.description') },
  { key: 'dailyChanges', icon: FilePlus2, variant: 'code', title: t('automation.templates.dailyChanges.title'), description: t('automation.templates.dailyChanges.description') }
]);

const triggerOptions = computed(() => [
  { value: 'monthly', label: t('automation.createModal.triggers.monthly') },
  { value: 'weekly', label: t('automation.createModal.triggers.weekly') },
  { value: 'daily', label: t('automation.createModal.triggers.daily') },
  { value: 'interval', label: t('automation.createModal.triggers.interval') },
  { value: 'once', label: t('automation.createModal.triggers.once') }
]);

const statusOptions = computed(() => [
  { value: 'success', label: t('automation.filters.success') },
  { value: 'failed', label: t('automation.filters.failed') },
  { value: 'running', label: t('automation.filters.running') }
]);

const taskOptions = computed(() => [
  { value: 'all', label: t('automation.filters.allExecutionTasks') },
  { value: 'sendEmail', label: t('automation.sample.taskName') }
]);

const modeOptions = computed(() => [
  { value: 'auto', label: t('automation.createModal.autoMode') },
  { value: 'focused', label: t('automation.createModal.focusedMode') }
]);

const currentTriggerLabel = computed(() => (
  triggerOptions.value.find(option => option.value === triggerType.value)?.label || ''
));

const currentModeLabel = computed(() => (
  modeOptions.value.find(option => option.value === executionMode.value)?.label || ''
));

const currentStatusLabel = computed(() => (
  statusOptions.value.find(option => option.value === statusFilter.value)?.label || ''
));

const currentTaskLabel = computed(() => (
  taskOptions.value.find(option => option.value === taskFilter.value)?.label || ''
));

const formattedDateRange = computed(() => (
  `${startDate.value.replaceAll('-', '/')} - ${endDate.value.replaceAll('-', '/')}`
));

const canCreateTask = computed(() => (
  taskName.value.trim().length > 0
  && triggerTime.value.length > 0
  && taskInstruction.value.trim().length > 0
));

const openManualCreate = () => {
  manualCreateVisible.value = true;
  nextTick(() => taskNameInput.value?.focus());
};

const closeManualCreate = () => {
  manualCreateVisible.value = false;
  showTriggerMenu.value = false;
  showModeMenu.value = false;
};

const closeDropdowns = () => {
  showTriggerMenu.value = false;
  showModeMenu.value = false;
};

const toggleTriggerMenu = () => {
  showTriggerMenu.value = !showTriggerMenu.value;
  showModeMenu.value = false;
};

const toggleModeMenu = () => {
  showModeMenu.value = !showModeMenu.value;
  showTriggerMenu.value = false;
};

const selectTrigger = (value) => {
  triggerType.value = value;
  showTriggerMenu.value = false;
};

const selectMode = (value) => {
  executionMode.value = value;
  showModeMenu.value = false;
};

const closePageDropdowns = () => {
  showStatusMenu.value = false;
  showTaskMenu.value = false;
  showDateMenu.value = false;
};

const toggleStatusMenu = () => {
  showStatusMenu.value = !showStatusMenu.value;
  showTaskMenu.value = false;
  showDateMenu.value = false;
};

const toggleTaskMenu = () => {
  showTaskMenu.value = !showTaskMenu.value;
  showStatusMenu.value = false;
  showDateMenu.value = false;
};

const toggleDateMenu = () => {
  showDateMenu.value = !showDateMenu.value;
  showStatusMenu.value = false;
  showTaskMenu.value = false;
};

const normalizeDateRange = () => {
  if (startDate.value > endDate.value) {
    endDate.value = startDate.value;
  }
};

const selectStatus = (value) => {
  statusFilter.value = value;
  showStatusMenu.value = false;
};

const selectTask = (value) => {
  taskFilter.value = value;
  showTaskMenu.value = false;
};

const selectRun = (runId) => {
  selectedRunId.value = runId;
};

const openTemplates = () => {
  closeManualCreate();
  activeTab.value = 'templates';
};

const openFridayHome = () => {
  router.push('/friday');
};

const handleCreateTask = () => {
  if (!canCreateTask.value) return;
  showComingSoon();
};

const showComingSoon = () => {
  toastVisible.value = true;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastVisible.value = false;
  }, 2200);
};

onBeforeUnmount(() => window.clearTimeout(toastTimer));
</script>

<style scoped>
.automation-page {
  position: relative;
  min-height: 100%;
  padding: 28px 24px 40px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.page-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: flex-start;
  gap: 14px;
}

.heading-group {
  min-width: 0;
}

.heading-group h1 {
  font-size: 22px;
  line-height: 1.35;
  font-weight: 650;
  letter-spacing: 0;
  white-space: nowrap;
}

.heading-group p {
  margin-top: 5px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.header-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  flex-shrink: 0;
}

.create-button {
  height: 34px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s ease, transform 0.15s ease;
}

.create-button:active {
  transform: translateY(1px);
}

.create-button.secondary {
  background: var(--bg-secondary);
}

.create-button.secondary:hover {
  background: var(--bg-active);
}

.create-button.primary {
  background: var(--text-primary);
  color: var(--bg-primary);
}

.create-button.primary:hover {
  opacity: 0.88;
}

.tabs {
  display: flex;
  gap: 24px;
  margin-top: 24px;
}

.tab-button {
  position: relative;
  height: 34px;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 14px;
  font-weight: 550;
  cursor: pointer;
}

.tab-button:hover,
.tab-button.active {
  color: var(--text-primary);
}

.tab-button.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  border-radius: 3px;
  background: var(--text-primary);
}

.configured-panel {
  margin-top: 18px;
}

.local-task-notice {
  min-height: 48px;
  padding: 9px 12px;
  border: 1px solid color-mix(in srgb, var(--accent-color) 24%, transparent);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  background: var(--accent-light);
  font-size: 13px;
}

.notice-message,
.keep-awake-control {
  display: flex;
  align-items: center;
}

.notice-message {
  gap: 9px;
}

.notice-message svg {
  flex-shrink: 0;
  color: var(--accent-color);
}

.keep-awake-control {
  gap: 10px;
  flex-shrink: 0;
  color: var(--text-secondary);
}

.configured-task {
  min-height: 56px;
  margin-top: 14px;
  padding: 10px 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  background: var(--bg-primary);
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.configured-task:hover {
  border-color: var(--text-tertiary);
  background: color-mix(in srgb, var(--bg-secondary) 38%, var(--bg-primary));
}

.task-summary,
.task-actions {
  display: flex;
  align-items: center;
}

.task-summary {
  min-width: 0;
  gap: 10px;
}

.task-summary strong {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.task-cloud-icon {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.task-schedule {
  color: var(--text-secondary);
  font-size: 13px;
  white-space: nowrap;
}

.task-actions {
  gap: 6px;
  flex-shrink: 0;
}

.icon-button {
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.icon-button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.toggle-switch {
  position: relative;
  width: 36px;
  height: 20px;
  display: inline-block;
  flex-shrink: 0;
}

.toggle-switch input {
  width: 0;
  height: 0;
  opacity: 0;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  border-radius: 20px;
  background: var(--border-color);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  top: 2px;
  left: 2px;
  border-radius: 50%;
  background: var(--bg-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
  transition: transform 0.2s ease;
}

.toggle-switch input:checked + .toggle-slider {
  background: #10b981;
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(16px);
}

.toggle-switch input:focus-visible + .toggle-slider {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(250px, 100%), 1fr));
  gap: 10px;
  margin-top: 18px;
}

.template-card {
  min-width: 0;
  min-height: 138px;
  padding: 14px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  background: var(--bg-primary);
  color: var(--text-primary);
  font: inherit;
  cursor: pointer;
  transition: border-color 0.16s ease, background-color 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease;
}

.template-card:hover {
  border-color: var(--text-tertiary);
  background: color-mix(in srgb, var(--bg-secondary) 38%, var(--bg-primary));
  transform: translateY(-1px);
  box-shadow: 0 5px 16px rgba(0, 0, 0, 0.06);
}

.template-card:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.template-preview {
  position: relative;
  width: 52px;
  height: 46px;
  border: 1px solid var(--border-color);
  border-radius: 7px;
  display: block;
  background: var(--bg-primary);
  box-shadow: 0 7px 15px rgba(0, 0, 0, 0.09);
}

.preview-dots {
  position: absolute;
  top: 6px;
  left: 7px;
  display: flex;
  gap: 4px;
}

.preview-dots i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #d86d60;
}

.preview-dots i:nth-child(2) {
  background: #dca943;
}

.preview-dots i:nth-child(3) {
  background: #66a85c;
}

.preview-lines {
  position: absolute;
  left: 7px;
  bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-lines i {
  width: 21px;
  height: 3px;
  border-radius: 2px;
  background: var(--border-color);
}

.preview-lines i:nth-child(2) {
  width: 15px;
}

.preview-lines i:nth-child(3) {
  width: 11px;
}

.template-preview.is-code .preview-lines {
  top: 9px;
  bottom: auto;
}

.template-preview.is-code .preview-lines i:first-child {
  width: 31px;
  background: color-mix(in srgb, var(--accent-color) 30%, var(--border-color));
}

.template-preview.is-code .preview-lines i:nth-child(2) {
  width: 26px;
  background: color-mix(in srgb, #10b981 35%, var(--border-color));
}

.preview-icon {
  position: absolute;
  right: 6px;
  bottom: 6px;
  color: var(--text-secondary);
}

.template-copy {
  min-width: 0;
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.template-copy strong {
  font-size: 14px;
  line-height: 1.35;
  font-weight: 600;
}

.template-copy > span {
  display: -webkit-box;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 12.5px;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

.select-control,
.date-control {
  position: relative;
  width: 156px;
  height: 34px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  display: flex;
  align-items: center;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.select-control:focus-within,
.date-control:focus-within {
  border-color: var(--text-tertiary);
  box-shadow: 0 0 0 3px var(--bg-hover);
}

.select-control.task-source {
  width: 210px;
}

.date-control {
  width: 230px;
}

.date-range-trigger {
  width: 100%;
  height: 100%;
  padding: 0 10px 0 12px;
  border: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.date-range-trigger svg {
  flex: 0 0 auto;
  color: var(--text-secondary);
}

.date-range-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  width: 246px;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  display: grid;
  gap: 10px;
  background: var(--bg-primary);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
}

.date-range-menu label {
  display: grid;
  gap: 5px;
  color: var(--text-secondary);
  font-size: 12px;
}

.date-range-menu input {
  height: 32px;
  min-width: 0;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
}

.run-history {
  margin-top: 26px;
}

.run-history h2 {
  font-size: 14px;
  line-height: 1.5;
  font-weight: 650;
}

.run-item {
  display: flex;
  margin-top: 18px;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.run-item:hover {
  background: var(--bg-secondary);
}

.run-item:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.status-track {
  width: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}

.success-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #64a67e;
  color: #fff;
}

.track-line {
  width: 1px;
  height: 44px;
  margin-top: 8px;
  background: var(--border-color);
}

.run-content {
  padding-left: 8px;
}

.run-title-row {
  min-height: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.run-title-row strong {
  font-size: 14px;
  font-weight: 600;
}

.run-content p {
  display: flex;
  gap: 12px;
  margin-top: 12px;
  color: var(--text-secondary);
  font-size: 13px;
}

.empty-state {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-tertiary);
  font-size: 14px;
}

.automation-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 15, 16, 0.48);
  backdrop-filter: blur(2px);
}

.automation-modal {
  width: min(720px, 100%);
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-primary);
  color: var(--text-primary);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.22);
}

.modal-header {
  min-height: 56px;
  padding: 16px 22px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.modal-header h2 {
  font-size: 18px;
  line-height: 1.3;
  font-weight: 650;
  letter-spacing: 0;
}

.modal-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.template-link,
.modal-close-button {
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  cursor: pointer;
}

.template-link {
  padding: 4px 0;
  border-bottom: 1px solid var(--text-tertiary);
  font-size: 13px;
  line-height: 1.2;
}

.template-link:hover {
  color: var(--text-primary);
  border-bottom-color: var(--text-primary);
}

.modal-close-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.modal-close-button {
  width: 30px;
  height: 30px;
}

.modal-close-button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.automation-form {
  padding: 20px 22px 22px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-field,
.trigger-section,
.instruction-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  color: var(--text-primary);
  font-size: 13.5px;
  line-height: 1.5;
  font-weight: 600;
}

.form-field > input,
.form-select,
.time-field {
  height: 40px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.form-field > input {
  width: 100%;
  padding: 0 12px;
  outline: 0;
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
}

.form-field > input::placeholder,
.instruction-editor textarea::placeholder {
  color: var(--text-tertiary);
}

.form-field > input:focus,
.form-select:focus-within,
.time-field:focus-within,
.instruction-editor:focus-within {
  border-color: var(--text-tertiary);
  box-shadow: 0 0 0 3px var(--bg-hover);
}

.trigger-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
}

.form-select,
.time-field,
.mode-select {
  position: relative;
  display: flex;
  align-items: center;
}

.time-field input {
  width: 100%;
  height: 100%;
  border: 0;
  outline: 0;
  appearance: none;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
}

.time-field input {
  padding: 0 38px 0 12px;
}

.time-field > svg {
  position: absolute;
  right: 12px;
  color: var(--text-secondary);
  pointer-events: none;
}

.time-field input::-webkit-calendar-picker-indicator {
  opacity: 0;
  cursor: pointer;
}

.time-field input {
  position: relative;
  z-index: 1;
  color: transparent;
  cursor: pointer;
}

.time-field input.has-value {
  color: var(--text-primary);
}

.time-placeholder {
  position: absolute;
  left: 12px;
  color: var(--text-tertiary);
  font-size: 13px;
  pointer-events: none;
}

.custom-dropdown {
  overflow: visible;
}

.dropdown-trigger {
  width: 100%;
  height: 100%;
  padding: 0 11px 0 12px;
  border: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.dropdown-trigger svg {
  flex-shrink: 0;
  color: var(--text-secondary);
  transition: transform 0.18s ease;
}

.dropdown-trigger svg.expanded {
  transform: rotate(180deg);
}

.dropdown-menu.more-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 1010;
  min-width: 100%;
  padding: 4px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.05);
}

.dropdown-menu.more-menu .menu-item {
  width: 100%;
  min-height: 32px;
  padding: 7px 10px;
  border: 0;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 400;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease;
}

.dropdown-menu.more-menu .menu-item:hover,
.dropdown-menu.more-menu .menu-item.active {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.dropdown-menu.more-menu .menu-item svg {
  flex-shrink: 0;
  color: var(--text-primary);
}

.mode-menu {
  top: auto !important;
  right: 0;
  bottom: calc(100% + 6px);
  left: auto !important;
  min-width: 138px !important;
}

.dropdown-menu-enter-active,
.dropdown-menu-leave-active {
  transition: opacity 0.15s cubic-bezier(0.16, 1, 0.3, 1), transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: top;
}

.dropdown-menu-enter-from,
.dropdown-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.96);
}

.mode-select .dropdown-menu-enter-active,
.mode-select .dropdown-menu-leave-active {
  transform-origin: bottom;
}

.mode-select .dropdown-menu-enter-from,
.mode-select .dropdown-menu-leave-to {
  transform: translateY(4px) scale(0.96);
}

.instruction-label {
  display: flex;
  align-items: center;
  gap: 7px;
}

.instruction-label svg {
  color: var(--text-secondary);
}

.instruction-editor {
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.instruction-editor textarea {
  width: 100%;
  min-height: 142px;
  max-height: 260px;
  padding: 12px 14px;
  border: 0;
  outline: 0;
  display: block;
  resize: vertical;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
  line-height: 1.55;
}

.editor-toolbar {
  height: 42px;
  padding: 5px 8px;
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.mode-select {
  width: 112px;
  height: 30px;
  border-radius: 6px;
}

.mode-select:hover {
  background: var(--bg-hover);
}

.mode-select .dropdown-trigger {
  padding: 0 8px 0 9px;
  font-size: 12.5px;
}

.modal-footer {
  padding-top: 2px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.modal-button {
  height: 34px;
  padding: 0 15px;
  border: 0;
  border-radius: 8px;
  font: inherit;
  font-size: 13px;
  font-weight: 550;
  cursor: pointer;
}

.modal-button.cancel {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.modal-button.cancel:hover {
  background: var(--bg-hover);
}

.modal-button.submit {
  background: var(--text-primary);
  color: var(--bg-primary);
}

.modal-button.submit:hover:not(:disabled) {
  opacity: 0.88;
}

.modal-button.submit:disabled {
  background: var(--border-color);
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.18s ease;
}

.modal-fade-enter-active .automation-modal,
.modal-fade-leave-active .automation-modal {
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to,
.modal-fade-enter-from .automation-modal,
.modal-fade-leave-to .automation-modal {
  opacity: 0;
}

.modal-fade-enter-from .automation-modal,
.modal-fade-leave-to .automation-modal {
  transform: translateY(8px) scale(0.99);
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 30px;
  z-index: 1100;
  transform: translateX(-50%);
  padding: 10px 16px;
  border-radius: 7px;
  background: var(--text-primary);
  color: var(--bg-primary);
  font-size: 13px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 6px);
}

@media (max-width: 860px) {
  .automation-page {
    padding: 24px 20px 36px;
  }

  .tabs {
    margin-top: 22px;
  }

  .configured-task {
    align-items: flex-start;
  }
}

@media (max-width: 560px) {
  .automation-page {
    padding: 20px 16px 32px;
  }

  .heading-group h1 {
    font-size: 21px;
  }

  .filters {
    flex-direction: column;
  }

  .local-task-notice,
  .configured-task {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }

  .keep-awake-control,
  .task-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .task-summary {
    flex-wrap: wrap;
  }

  .select-control,
  .select-control.task-source,
  .date-control {
    width: 100%;
  }

  .header-actions {
    gap: 6px;
  }

  .create-button {
    height: 32px;
    padding: 0 10px;
  }

  .tabs {
    gap: 20px;
    overflow-x: auto;
  }

  .run-item {
    margin-left: 0;
  }

  .automation-modal-overlay {
    padding: 10px;
  }

  .automation-modal {
    max-height: calc(100vh - 20px);
  }

  .modal-header,
  .automation-form {
    padding-left: 16px;
    padding-right: 16px;
  }

  .trigger-fields {
    grid-template-columns: 1fr;
  }
}
</style>
