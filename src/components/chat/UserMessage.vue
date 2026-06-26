<template>
  <div class="user-message-row">
    <div class="message-content-wrap">
      <div class="message-bubble user">
        {{ content }}
      </div>
      <div v-if="references && references.length > 0" class="message-references">
        <NoteReferenceTag
          v-for="ref in references"
          :key="ref.id"
          :from="ref.from"
          :to="ref.to"
          :text="ref.text"
          :readonly="true"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import NoteReferenceTag from './NoteReferenceTag.vue';

defineProps({
  content: String,
  references: { type: Array, default: () => [] }
});
</script>

<style scoped>
.user-message-row {
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
}

.message-content-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  max-width: 70%;
}

.message-references {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
  margin-top: 4px;
}

.message-bubble {
  padding: 10px 18px;
  border-radius: 16px;
  font-size: 14.5px;
  line-height: 1.6;
  word-break: break-word;
}

.message-bubble.user {
  background: var(--text-primary);
  color: var(--bg-primary);
  border-bottom-right-radius: 4px;
  white-space: pre-wrap;
  -webkit-user-select: text;
  user-select: text;
}
</style>
