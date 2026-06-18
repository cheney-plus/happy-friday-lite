<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click="$emit('close')">
      <div class="modal-content new-folder-dialog" @click.stop>
        <h2 class="modal-title">{{ title }}</h2>
        <div class="new-folder-input-row">
          <input
            ref="inputRef"
            :value="folderName"
            class="new-folder-input"
            :placeholder="placeholder"
            @input="$emit('update:folderName', $event.target.value)"
            @keydown.enter="$emit('confirm')"
            autofocus
          />
        </div>
        <div class="create-kb-footer">
          <button class="kb-btn kb-btn-cancel" @click="$emit('close')">取消</button>
          <button class="kb-btn kb-btn-confirm" :disabled="!folderName.trim()" @click="$emit('confirm')">确认</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  visible: Boolean,
  folderName: { type: String, default: '' },
  inputRef: Object,
  title: { type: String, default: '新建文件夹' },
  placeholder: { type: String, default: '请输入文件夹名称' }
});

defineEmits(['close', 'confirm', 'update:folderName']);
</script>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease-out;
}

.modal-content {
  background: var(--bg-primary);
  border-radius: 16px;
  padding: 40px 48px;
  text-align: center;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease-out;
}

.new-folder-dialog {
  width: 380px;
  padding: 24px;
  text-align: left;

  .modal-title {
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
  }

  .new-folder-input-row { margin-bottom: 20px; }

  .new-folder-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 8px;
    font-size: 14px;
    background: var(--bg-primary, #fff);
    color: var(--text-primary);
    outline: none;
    transition: border-color 0.2s;
    box-sizing: border-box;

    &:focus {
      border-color: var(--accent-color, #1560F7);
      box-shadow: 0 0 0 2px rgba(21, 96, 247, 0.15);
    }

    &::placeholder { color: var(--text-tertiary, #bbb); }
  }
}

.create-kb-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;

  .kb-btn {
    padding: 7px 22px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .kb-btn-cancel {
    background: var(--bg-secondary);
    color: var(--text-primary);
    &:hover { background: var(--bg-hover); }
  }

  .kb-btn-confirm {
    background: var(--accent-color);
    color: white;
    &:hover:not(:disabled) { filter: brightness(1.05); }
    &:disabled { opacity: 0.45; cursor: not-allowed; }
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
