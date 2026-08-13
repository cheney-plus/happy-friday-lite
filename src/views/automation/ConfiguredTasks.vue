<template>
  <section class="configured-panel">
    <div class="local-task-notice">
      <div class="notice-message"><Info :size="17" :stroke-width="2" /><span>{{ t('automation.configured.localTaskNotice') }}</span></div>
      <div class="keep-awake-control"><span>{{ t('automation.configured.keepAwake') }}</span><label class="toggle-switch"><input v-model="keepAwake" type="checkbox" :aria-label="t('automation.configured.keepAwake')" /><span class="toggle-slider"></span></label></div>
    </div>
    <article v-for="task in tasks" :key="task.id" class="configured-task" role="button" tabindex="0" @click="emit('edit', task.id)" @keydown.enter.prevent="emit('edit', task.id)" @keydown.space.prevent="emit('edit', task.id)">
      <div class="task-summary"><Cloud :size="18" :stroke-width="1.8" class="task-cloud-icon" /><strong>{{ task.name }}</strong><span class="task-schedule">{{ formatSchedule(task) }}</span></div>
      <div class="task-actions" @click.stop @keydown.stop>
        <button class="icon-button has-tooltip" type="button" :title="t('automation.configured.delete')" :data-tooltip="t('automation.configured.delete')" @click="emit('delete', task.id)"><X :size="16" :stroke-width="2" /></button>
        <button class="icon-button has-tooltip" type="button" :title="t('automation.configured.runNow')" :data-tooltip="t('automation.configured.runNow')" @click="emit('run', task.id)"><CirclePlay :size="16" :stroke-width="1.8" /></button>
        <label class="toggle-switch has-tooltip" :title="t('automation.configured.enableTask')" :data-tooltip="t('automation.configured.enableTask')"><input :checked="task.enabled" type="checkbox" :aria-label="t('automation.configured.enableTask')" @change="emit('set-enabled', task, $event.target.checked)" /><span class="toggle-slider"></span></label>
      </div>
    </article>
    <p v-if="tasks.length === 0" class="empty-state">{{ t('automation.empty.configured') }}</p>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { CirclePlay, Cloud, X } from 'lucide-vue-next';

const props = defineProps({ tasks: { type: Array, required: true } });
const keepAwake = defineModel('keepAwake', { type: Boolean, default: false });
const emit = defineEmits(['edit', 'delete', 'run', 'set-enabled']);
const { t } = useI18n();
const intervalUnits = computed(() => [
  { value: 'minutes', label: t('automation.createModal.intervalUnits.minutes') },
  { value: 'hours', label: t('automation.createModal.intervalUnits.hours') },
  { value: 'days', label: t('automation.createModal.intervalUnits.days') }
]);
const formatSchedule = (task) => {
  const config = task.triggerConfig || {};
  if (task.triggerType === 'daily') return t('automation.schedule.daily', { time: config.time });
  if (task.triggerType === 'weekly') return t('automation.schedule.weekly', { time: config.time });
  if (task.triggerType === 'monthly') return t('automation.schedule.monthly', { day: config.day, time: config.time });
  if (task.triggerType === 'interval') return t('automation.schedule.interval', { value: config.value, unit: intervalUnits.value.find(item => item.value === config.unit)?.label || config.unit });
  return t('automation.schedule.once', { time: config.dateTime?.replace('T', ' ') || '-' });
};
</script>
