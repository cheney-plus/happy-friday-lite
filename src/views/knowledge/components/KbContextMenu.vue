<template>
  <Teleport to="body">
    <div v-if="visible" class="context-menu-overlay" @mousedown="$emit('close')">
      <div class="context-menu" :style="{ left: x + 'px', top: y + 'px' }" @click.stop>
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  visible: Boolean,
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 }
});

defineEmits(['close']);
</script>

<style scoped lang="scss">
.context-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 1001;
}

.context-menu {
  position: fixed;
  z-index: 1002;
  min-width: 130px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}
</style>
