<template>
  <Teleport to="body">
    <div v-if="visible" class="create-kb-overlay" @click.self="$emit('close')">
      <div class="create-kb-dialog">
        <div class="create-kb-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <span class="create-kb-title">{{ isEditing ? '编辑' : '创建' }}{{ categoryName }}</span>
          <button class="create-kb-close" @click="$emit('close')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="create-kb-body">
          <div class="form-row">
            <label class="form-label">名称 <span class="required">*</span></label>
            <input
              ref="nameInputRef"
              :value="form.name"
              @input="$emit('update:form', { ...form, name: $event.target.value })"
              type="text"
              class="form-input"
              placeholder="请输入知识库名称"
              @keydown.enter="$emit('confirm')"
            />
          </div>

          <div class="form-row">
            <label class="form-label">封面</label>
            <div class="cover-grid">
              <div
                v-for="(cover, index) in coverOptions"
                :key="index"
                :class="['cover-item', { selected: form.coverIndex === index, 'is-upload': index === -1 }]"
                @click="$emit('select-cover', index)"
              >
                <template v-if="index === -1">
                  <svg class="upload-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <line x1="12" y1="19" x2="12" y2="5"></line>
                    <polyline points="5 12 12 5 19 12"></polyline>
                    <line x1="5" y1="19" x2="19" y2="19"></line>
                  </svg>
                  <span class="upload-text">上传</span>
                </template>
                <img v-else :src="cover" class="cover-img" alt="" />
              </div>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label">描述</label>
            <textarea
              :value="form.description"
              @input="$emit('update:form', { ...form, description: $event.target.value })"
              class="form-textarea"
              placeholder="请输入知识库描述（可选）"
              rows="2"
            ></textarea>
          </div>
        </div>

        <div class="create-kb-footer">
          <button class="kb-btn kb-btn-cancel" @click="$emit('close')">取消</button>
          <button class="kb-btn kb-btn-confirm" :disabled="!form.name.trim()" @click="$emit('confirm')">确认</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { coverOptions } from '../constants';

defineProps({
  visible: Boolean,
  isEditing: Boolean,
  categoryName: String,
  form: { type: Object, required: true },
  nameInputRef: Object
});

defineEmits(['close', 'confirm', 'update:form', 'select-cover']);
</script>

<style scoped lang="scss">
.create-kb-overlay {
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

.create-kb-dialog {
  background: var(--bg-primary);
  border-radius: 16px;
  width: 400px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.25s ease-out;
}

.create-kb-header {
  display: flex;
  align-items: center;
  padding: 14px 18px 10px;
  gap: 8px;

  .create-kb-title {
    flex: 1;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .create-kb-close {
    padding: 4px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 4px;
    color: var(--text-secondary);
    transition: all 0.2s;

    &:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
  }
}

.create-kb-body {
  padding: 0 18px 12px;

  .form-row {
    margin-bottom: 12px;

    &:last-child { margin-bottom: 0; }

    .form-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: 5px;

      .required {
        color: #e74c3c;
        margin-left: 2px;
      }
    }

    .form-input {
      width: 100%;
      padding: 7px 10px;
      border: 1.5px solid var(--border-color);
      border-radius: 8px;
      outline: none;
      font-size: 14px;
      color: var(--text-primary);
      background: var(--bg-primary);
      transition: border-color 0.2s;
      box-sizing: border-box;

      &::placeholder { color: var(--text-tertiary); }
      &:focus { border-color: var(--text-tertiary); }
    }

    .form-textarea {
      width: 100%;
      padding: 7px 10px;
      border: 1.5px solid var(--border-color);
      border-radius: 8px;
      outline: none;
      font-size: 13px;
      color: var(--text-primary);
      background: var(--bg-primary);
      transition: border-color 0.2s;
      resize: vertical;
      min-height: 48px;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;

      &::placeholder { color: var(--text-tertiary); }
      &:focus { border-color: var(--text-tertiary); }
    }

    .cover-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;

      .cover-item {
        width: 52px;
        height: 52px;
        border-radius: 8px;
        cursor: pointer;
        overflow: hidden;
        border: 2px solid transparent;
        transition: all 0.2s;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: var(--bg-secondary);

        &.is-upload {
          border-style: dashed;
          border-color: var(--border-color);

          &:hover {
            border-color: var(--text-tertiary);
            background: var(--bg-hover);
          }

          .upload-icon { color: var(--text-tertiary); width: 16px; height: 16px; }
          .upload-text { font-size: 10px; color: var(--text-tertiary); }
        }

        &:not(.is-upload) {
          padding: 4px;

          .cover-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 6px;
          }
        }

        &.selected {
          border-color: var(--accent-color);
          box-shadow: 0 0 0 2px rgba(var(--accent-rgb, 64, 158, 255), 0.15);
        }

        &:hover:not(.selected) { border-color: var(--text-tertiary); }
      }
    }
  }
}

.create-kb-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 10px 18px 14px;

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
