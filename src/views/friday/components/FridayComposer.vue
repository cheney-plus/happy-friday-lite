<template>
  <div class="friday-composer" :class="`is-${variant}`" @click="closeAllDropdowns">
    <ChatInputBox
      v-model="inputText"
      :placeholder="placeholder || t('friday.placeholder')"
      :is-streaming="isStreaming"
      :attachments="attachments"
      :show-reference-buttons="true"
      :show-kb-button="fridayStore.mode !== 'agent'"
      :selectable-kb-list="selectableKbList"
      :dropdown-direction="variant === 'conversation' ? 'up' : 'down'"
      @send="handleSend"
      @stop="$emit('stop')"
      @select-note="openNoteSelect"
      @select-kb-file="openKbFileSelect"
      @select-kb="handleSelectKb"
      @remove-attachment="removeAttachment"
    >
      <template #actions-left>
        <button class="action-btn dropdown-btn" type="button" @click.stop="toggleDropdown('mode', $event)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>{{ currentModeLabel }}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        <button class="action-btn dropdown-btn" type="button" @click.stop="toggleDropdown('model', $event)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
          <span>{{ currentModelName }}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </template>
    </ChatInputBox>

    <Teleport to="body">
      <div v-if="showModeDropdown" class="dropdown-overlay" :style="modeDropdownStyle" @click.stop>
        <div class="dropdown-panel mode-dropdown">
          <div
            v-for="mode in chatModes"
            :key="mode.value"
            class="dropdown-item"
            :class="{ active: fridayStore.mode === mode.value }"
            @click="selectMode(mode.value)"
          >
            {{ mode.label }}
          </div>
        </div>
      </div>

      <div v-if="showModelDropdown" class="dropdown-overlay" :style="modelDropdownStyle" @click.stop>
        <div class="dropdown-panel model-dropdown">
          <div class="model-row model-think-row">
            <span class="model-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              {{ t('friday.thinkMode') }}
            </span>
            <div class="think-tabs">
              <button class="think-tab" :class="{ active: fridayStore.thinkMode === 'fast' }" type="button" @click="fridayStore.setThinkMode('fast')">{{ t('friday.thinkFast') }}</button>
              <button class="think-tab" :class="{ active: fridayStore.thinkMode === 'deep' }" type="button" @click="fridayStore.setThinkMode('deep')">{{ t('friday.thinkDeep') }}</button>
            </div>
          </div>
          <div class="model-model-list">
            <div
              v-for="model in modelList"
              :key="model.id"
              class="model-item"
              :class="{ active: fridayStore.modelId === model.id }"
              @click="selectModel(model.id)"
            >
              <img :src="model.icon" class="model-icon" alt="" />
              <div class="model-info">
                <span class="model-name">{{ model.name }}</span>
                <span v-if="model.embeddingName" class="model-embedding-name">{{ t('friday.embedding') }}: {{ model.embeddingName }}</span>
              </div>
              <svg v-if="fridayStore.modelId === model.id" class="model-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <SelectNoteDialog
      :visible="showNoteDialog"
      @close="showNoteDialog = false"
      @confirm="handleNoteConfirm"
    />

    <KbFileDialog
      :visible="showKbFileDialog"
      :selectable-kb-list="selectableKbList"
      @close="showKbFileDialog = false"
      @select="selectKbFile"
    />
  </div>
</template>

<script setup>
import { computed, onActivated, onDeactivated, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import ChatInputBox from '@/components/chat/ChatInputBox.vue';
import SelectNoteDialog from '@/views/knowledge/components/SelectNoteDialog.vue';
import KbFileDialog from '@/views/knowledge/components/KbFileDialog.vue';
import { useFridayStore } from '@/store';
import { useKnowledgeBaseList } from '@/views/friday/composables/useKnowledgeBaseList';
import { useModelCatalog } from '@/views/friday/composables/useModelCatalog';

const props = defineProps({
  modelValue: { type: String, default: '' },
  isStreaming: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  variant: { type: String, default: 'conversation' }
});

const emit = defineEmits(['update:modelValue', 'send', 'stop']);

const { t } = useI18n();
const fridayStore = useFridayStore();
const { selectableKbList, loadKbListFromDisk } = useKnowledgeBaseList();
const { customModels, modelList, loadCustomModels } = useModelCatalog();

const inputText = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const attachments = ref([]);
let attachmentIdCounter = 0;
const showNoteDialog = ref(false);
const showKbFileDialog = ref(false);
const showModeDropdown = ref(false);
const showModelDropdown = ref(false);
const modeDropdownStyle = ref({});
const modelDropdownStyle = ref({});

const chatModes = computed(() => [
  { value: 'chat', label: t('friday.modeChat') },
  { value: 'memoryless', label: t('friday.modeMemoryless') },
  { value: 'agent', label: t('friday.modeAgent') }
]);

const currentModeLabel = computed(() => {
  return chatModes.value.find(mode => mode.value === fridayStore.mode)?.label || t('friday.modeChat');
});

const currentModelName = computed(() => {
  const model = customModels.value.find(item => item.id === fridayStore.modelId);
  if (!model) return t('friday.selectModel');
  const thinkLabel = fridayStore.thinkMode === 'deep' ? `· ${t('friday.thinkDeep')}` : `· ${t('friday.thinkFast')}`;
  return `${model.modelName} ${thinkLabel}`;
});

function closeAllDropdowns() {
  showModeDropdown.value = false;
  showModelDropdown.value = false;
}

function toggleDropdown(name, event) {
  const isMode = name === 'mode';
  const showRef = isMode ? showModeDropdown : showModelDropdown;
  const styleRef = isMode ? modeDropdownStyle : modelDropdownStyle;
  const wasOpen = showRef.value;
  closeAllDropdowns();
  if (wasOpen) return;
  const rect = event.currentTarget.getBoundingClientRect();
  showRef.value = true;
  if (props.variant === 'conversation') {
    styleRef.value = {
      position: 'fixed',
      bottom: `${window.innerHeight - rect.top + 8}px`,
      left: `${rect.left}px`,
      zIndex: '9999'
    };
  } else {
    styleRef.value = {
      position: 'fixed',
      top: `${rect.bottom + 8}px`,
      left: `${rect.left}px`,
      zIndex: '9999'
    };
  }
}

function selectMode(mode) {
  fridayStore.setMode(mode);
  showModeDropdown.value = false;
}

function selectModel(modelId) {
  fridayStore.setModelId(modelId);
  showModelDropdown.value = false;
}

function openNoteSelect() {
  showNoteDialog.value = true;
}

function openKbFileSelect() {
  showKbFileDialog.value = true;
}

function handleSelectKb({ name, categoryId }) {
  attachments.value.push({
    id: ++attachmentIdCounter,
    type: 'kb',
    typeLabel: t('friday.tagKb'),
    name,
    categoryId
  });
}

function handleNoteConfirm(selectedNotes) {
  if (!selectedNotes?.length) return;
  for (const note of selectedNotes) {
    attachments.value.push({
      id: ++attachmentIdCounter,
      type: 'note',
      typeLabel: t('friday.tagNote'),
      name: note.title || t('friday.untitledNote'),
      noteId: note.id,
      content: note.contentText || ''
    });
  }
  showNoteDialog.value = false;
}

function selectKbFile(file) {
  attachments.value.push({
    id: ++attachmentIdCounter,
    type: 'kb-file',
    typeLabel: t('friday.tagFile'),
    name: file.name,
    path: file.path
  });
  showKbFileDialog.value = false;
}

function removeAttachment(idx) {
  attachments.value.splice(idx, 1);
}

function buildAttachmentData(text) {
  const noteAttachments = attachments.value.filter(item => item.type === 'note');
  const kbFileAttachments = attachments.value.filter(item => item.type === 'kb-file');
  if (!noteAttachments.length && !kbFileAttachments.length) return null;

  const refLines = [
    ...noteAttachments.map(note => `${t('friday.refNote')}${note.name}`),
    ...kbFileAttachments.map(file => `${t('friday.refDoc')}${file.name}`)
  ];

  return {
    userMessage: `${text}\n\n---\n${refLines.join('\n')}`,
    attachments: [
      ...noteAttachments.map(note => ({ kind: 'note', name: note.name, noteId: note.noteId })),
      ...kbFileAttachments.map(file => ({ kind: 'file', name: file.name, path: file.path }))
    ]
  };
}

function handleSend() {
  const text = inputText.value.trim();
  if (!text || props.isStreaming) return;
  const attData = buildAttachmentData(text);
  const kbAttachment = attachments.value.find(item => item.type === 'kb');
  emit('send', {
    text,
    userMessage: attData?.userMessage || text,
    attachments: attData?.attachments || [],
    kbName: kbAttachment?.name || '',
    kbCategoryId: kbAttachment?.categoryId || '',
    mode: fridayStore.mode,
    modelId: fridayStore.modelId,
    thinkMode: fridayStore.thinkMode
  });
  attachments.value = [];
}

watch(() => fridayStore.mode, (mode) => {
  if (mode === 'agent') {
    attachments.value = attachments.value.filter(item => item.type !== 'kb');
  }
});

onMounted(() => {
  loadCustomModels();
  loadKbListFromDisk();
});

onActivated(() => {
  loadCustomModels();
});

onDeactivated(closeAllDropdowns);
</script>

<style scoped>
.friday-composer.is-home :deep(.chat-input-box) {
  padding: 0;
}

.friday-composer.is-home :deep(.input-wrapper) {
  max-width: 750px;
  border-radius: 28px;
}

/* Conversation input follows the same fluid content width as the message list. */
.friday-composer.is-conversation :deep(.input-wrapper) {
  width: 100%;
  max-width: 900px;
}

.friday-composer.is-home :deep(.main-input) {
  padding: 18px 28px 6px;
  font-size: 16px;
  min-height: 52px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  border-radius: 20px;
  font-size: 13.5px;
  font-weight: 500;
  white-space: nowrap;
}

.dropdown-btn {
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.dropdown-btn span {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-btn:hover {
  background: var(--bg-secondary);
}

.dropdown-overlay {
  animation: dropdownIn 0.15s ease-out;
}

@keyframes dropdownIn {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

.dropdown-panel {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
}

.mode-dropdown {
  min-width: 140px;
  padding: 6px;
}

.dropdown-item {
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13.5px;
  color: var(--text-primary);
  cursor: pointer;
}

.dropdown-item:hover {
  background: var(--bg-hover);
}

.dropdown-item.active {
  background: #ecfdf5;
  color: #059669;
  font-weight: 600;
}

.model-dropdown {
  min-width: 280px;
  padding: 10px;
}

.model-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.model-think-row {
  padding-bottom: 9px;
  border-bottom: 1px solid var(--border-color);
}

.model-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-primary);
}

.think-tabs {
  display: flex;
  gap: 2px;
  background: var(--bg-secondary);
  border-radius: 7px;
  padding: 2px;
}

.think-tab {
  padding: 4px 10px;
  border: none;
  background: transparent;
  border-radius: 5px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
}

.think-tab.active {
  background: var(--bg-primary);
  color: var(--text-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.model-model-list {
  margin-top: 8px;
  max-height: 168px;
  overflow-y: auto;
}

.model-item {
  display: flex;
  align-items: center;
  min-height: 42px;
  padding: 7px 8px;
  border-radius: 8px;
  cursor: pointer;
  gap: 8px;
}

.model-item:hover {
  background: var(--bg-secondary);
}

.model-item.active {
  background: #ecfdf5;
}

.model-icon {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  object-fit: contain;
}

.model-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.model-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
}

.model-embedding-name {
  font-size: 10px;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-item.active .model-name {
  color: #059669;
}

.model-check {
  flex-shrink: 0;
}
</style>
