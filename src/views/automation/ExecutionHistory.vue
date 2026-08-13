<template>
  <section class="filters" aria-label="filters">
    <div class="select-control custom-dropdown" @click.stop>
      <button class="dropdown-trigger" type="button" @click="toggle('status')"><span>{{ currentStatusLabel }}</span><ChevronDown :size="16" :stroke-width="2" :class="{ expanded: openMenu === 'status' }" /></button>
      <Transition name="dropdown-menu"><div v-if="openMenu === 'status'" class="dropdown-menu more-menu history-filter-menu"><button v-for="option in statusOptions" :key="option.value" type="button" :class="['menu-item', { active: statusFilter === option.value }]" @click="selectStatus(option.value)"><span>{{ option.label }}</span><Check v-if="statusFilter === option.value" :size="13" :stroke-width="2.3" /></button></div></Transition>
    </div>
    <div class="select-control task-source custom-dropdown" @click.stop>
      <button class="dropdown-trigger" type="button" @click="toggle('task')"><span>{{ currentTaskLabel }}</span><ChevronDown :size="16" :stroke-width="2" :class="{ expanded: openMenu === 'task' }" /></button>
      <Transition name="dropdown-menu"><div v-if="openMenu === 'task'" class="dropdown-menu more-menu history-filter-menu"><button v-for="option in taskOptions" :key="option.value" type="button" :class="['menu-item', { active: taskFilter === option.value }]" @click="selectTask(option.value)"><span>{{ option.label }}</span><Check v-if="taskFilter === option.value" :size="13" :stroke-width="2.3" /></button></div></Transition>
    </div>
    <div class="date-control custom-dropdown" @click.stop>
      <button class="date-range-trigger" type="button" @click="toggle('date')"><span>{{ formattedDateRange }}</span><CalendarDays :size="18" :stroke-width="1.8" aria-hidden="true" /></button>
      <Transition name="dropdown-menu"><div v-if="openMenu === 'date'" class="date-range-menu"><label><span>{{ t('automation.filters.startDate') }}</span><input v-model="startDate" type="date" :max="endDate" @change="applyDateRange" /></label><label><span>{{ t('automation.filters.endDate') }}</span><input v-model="endDate" type="date" :min="startDate" @change="applyDateRange" /></label></div></Transition>
    </div>
  </section>
  <section class="run-history">
    <h2>{{ t('automation.groups.today') }}</h2>
    <article v-for="run in runs" :key="run.id" :class="['run-item', `is-${run.status}`, { selected: selectedRunId === run.id }]" role="button" tabindex="0" :aria-pressed="selectedRunId === run.id" @click="openRun(run)" @keydown.enter.prevent="openRun(run)" @keydown.space.prevent="openRun(run)">
      <div class="status-track" aria-hidden="true"><span :class="['success-dot', `is-${run.status}`]"><Check v-if="run.status === 'success'" :size="12" :stroke-width="3" /><span v-else></span></span><span class="track-line"></span></div>
      <div class="run-content">
        <div class="run-title-row">
          <strong>{{ run.taskName || t('automation.empty.deletedTask') }}</strong>
          <div class="run-more-actions" @click.stop @keydown.stop><button class="run-more-button" type="button" :title="t('automation.configured.more')" :aria-label="t('automation.configured.more')" @click.stop="openRunMenuId = openRunMenuId === run.id ? '' : run.id"><Ellipsis :size="17" :stroke-width="2" /></button><div v-if="openRunMenuId === run.id" class="run-more-menu" @mousedown.stop @click.stop><button type="button" @click.stop.prevent="deleteRun(run)">{{ t('automation.history.deleteRun') }}</button></div></div>
        </div>
        <p><span>{{ formatTrigger(run.trigger) }}</span><i aria-hidden="true"></i><span>{{ formatDateTime(run.startedAt) }}</span><span class="run-duration">{{ formatDuration(run.durationMs) }}</span><span :class="['run-status', `is-${run.status}`]">{{ formatStatus(run.status) }}</span></p>
      </div>
    </article>
    <p v-if="runs.length === 0" class="empty-state">{{ t('automation.empty.history') }}</p>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { CalendarDays, Check, ChevronDown, Ellipsis } from 'lucide-vue-next';

const props = defineProps({ tasks: { type: Array, required: true }, runs: { type: Array, required: true } });
const emit = defineEmits(['open', 'delete', 'load-runs']);
const { t } = useI18n();
const statusFilter = ref('all');
const taskFilter = ref('all');
const startDate = ref('');
const endDate = ref('');
const openMenu = ref('');
const selectedRunId = ref('');
const openRunMenuId = ref('');
const statusOptions = computed(() => [{ value: 'all', label: t('automation.filters.all') }, { value: 'success', label: t('automation.filters.success') }, { value: 'failed', label: t('automation.filters.failed') }, { value: 'running', label: t('automation.filters.running') }]);
const taskOptions = computed(() => [{ value: 'all', label: t('automation.filters.allExecutionTasks') }, ...props.tasks.map(task => ({ value: task.id, label: task.name }))]);
const currentStatusLabel = computed(() => statusOptions.value.find(option => option.value === statusFilter.value)?.label || '');
const currentTaskLabel = computed(() => taskOptions.value.find(option => option.value === taskFilter.value)?.label || '');
const formattedDateRange = computed(() => startDate.value && endDate.value ? `${startDate.value.replaceAll('-', '/')} - ${endDate.value.replaceAll('-', '/')}` : t('automation.filters.selectDate'));
const loadRuns = () => emit('load-runs', { status: statusFilter.value, taskId: taskFilter.value, startDate: startDate.value, endDate: endDate.value });
const toggle = (menu) => { openMenu.value = openMenu.value === menu ? '' : menu; };
const selectStatus = (value) => { statusFilter.value = value; openMenu.value = ''; loadRuns(); };
const selectTask = (value) => { taskFilter.value = value; openMenu.value = ''; loadRuns(); };
const applyDateRange = () => { if (startDate.value > endDate.value) endDate.value = startDate.value; loadRuns(); };
const openRun = (run) => { selectedRunId.value = run.id; emit('open', run); };
const deleteRun = (run) => { openRunMenuId.value = ''; if (selectedRunId.value === run.id) selectedRunId.value = ''; emit('delete', run); };
const formatDateTime = (value) => value ? new Intl.DateTimeFormat(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '-';
const formatDuration = (durationMs) => durationMs == null ? t('automation.filters.running') : durationMs >= 1000 ? `${(durationMs / 1000).toFixed(durationMs >= 10_000 ? 0 : 1)}s` : `${durationMs}ms`;
const formatTrigger = (trigger) => trigger === 'manual' ? t('automation.history.manual') : t('automation.history.scheduled');
const formatStatus = (status) => t(`automation.filters.${status}`);
const closeMenus = () => { openMenu.value = ''; openRunMenuId.value = ''; };

onMounted(() => window.addEventListener('click', closeMenus));
onBeforeUnmount(() => window.removeEventListener('click', closeMenus));
</script>
