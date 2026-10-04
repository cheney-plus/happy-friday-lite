<template>
  <teleport to="body">
    <div v-if="type" class="ndn-mask" @click.self="$emit('cancel')">
      <div class="ndn-dialog" role="dialog" :aria-label="title">
        <h3 class="ndn-title">{{ title }}</h3>
        <label class="ndn-label">{{ t('office.nameInputLabel') }}</label>
        <div class="ndn-input-row">
          <input
            ref="inputRef"
            v-model="name"
            class="ndn-input"
            :placeholder="t('office.namePlaceholder')"
            maxlength="80"
            @keydown.enter.prevent="confirm"
            @keydown.esc.prevent="$emit('cancel')"
          />
          <span class="ndn-ext">{{ ext }}</span>
        </div>
        <div class="ndn-actions">
          <button class="ndn-btn" @click="$emit('cancel')">{{ t('office.cancel') }}</button>
          <button class="ndn-btn primary" @click="confirm">{{ t('office.create') }}</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  // null/undefined 隐藏弹窗；'docs' | 'sheets' | 'slides' | 'pdf' 弹出对应命名框
  type: { type: String, default: null },
});
const emit = defineEmits(['confirm', 'cancel']);

const { t } = useI18n();
const name = ref('');
const inputRef = ref(null);

const TYPE_META = {
  docs: { ext: '.docx', titleKey: 'office.newDoc', defaultKey: 'office.newDoc' },
  sheets: { ext: '.xlsx', titleKey: 'office.newSheet', defaultKey: 'office.newSheet' },
  slides: { ext: '.pptx', titleKey: 'office.newSlides', defaultKey: 'office.newSlides' },
  pdf: { ext: '.pdf', titleKey: 'office.newPdf', defaultKey: 'office.newPdf' },
};

const meta = computed(() => TYPE_META[props.type] || null);
const title = computed(() => (meta.value ? t(meta.value.titleKey) : ''));
const ext = computed(() => meta.value?.ext || '');

watch(
  () => props.type,
  async (type) => {
    if (!type || !TYPE_META[type]) return;
    // 默认名称 = 新建文档默认名；全选便于直接输入覆盖
    name.value = t(TYPE_META[type].defaultKey);
    await nextTick();
    inputRef.value?.focus();
    inputRef.value?.select();
  },
);

function confirm() {
  if (!props.type) return;
  // 空输入回退默认名（去掉扩展名后缀展示，由主进程统一拼接）
  emit('confirm', { type: props.type, name: name.value.trim() || t(TYPE_META[props.type].defaultKey) });
}
</script>

<style scoped lang="scss">
.ndn-mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 32%);
}

.ndn-dialog {
  width: 380px;
  padding: 20px 22px 18px;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 14px;
  background: var(--bg-primary, #ffffff);
  box-shadow: 0 16px 48px rgb(0 0 0 / 18%);
}

.ndn-title {
  margin: 0 0 14px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
}

.ndn-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--text-secondary, #6b7280);
}

.ndn-input-row {
  position: relative;
  display: flex;
  align-items: center;
}

.ndn-input {
  width: 100%;
  padding: 8px 44px 8px 10px;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 8px;
  outline: none;
  font: inherit;
  font-size: 14px;
  color: var(--text-primary, #1f2937);
  background: var(--bg-primary, #ffffff);
  transition: border-color 0.12s;

  &:focus {
    border-color: #0f7fff;
  }
}

.ndn-ext {
  position: absolute;
  right: 10px;
  font-size: 12px;
  color: var(--text-secondary, #9ca3af);
  pointer-events: none;
}

.ndn-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}

.ndn-btn {
  padding: 7px 16px;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 8px;
  background: none;
  font: inherit;
  font-size: 13px;
  color: var(--text-primary, #1f2937);
  cursor: pointer;

  &:hover {
    background: var(--bg-tertiary, #f3f4f6);
  }

  &.primary {
    border-color: #0f7fff;
    background: #0f7fff;
    color: #ffffff;

    &:hover {
      background: #0d6fe0;
    }
  }
}
</style>
