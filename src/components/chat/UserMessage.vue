<template>
  <div class="user-message-row">
    <div class="message-content-wrap">
      <div class="message-bubble user">
        {{ content }}
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  content: String
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
}
</style>
