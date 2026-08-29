import { onUnmounted, ref } from 'vue';

export function useToast(duration = 2500) {
  const visible = ref(false);
  const message = ref('');
  let timer = null;

  function showToast(text) {
    message.value = text;
    visible.value = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      visible.value = false;
      timer = null;
    }, duration);
  }

  onUnmounted(() => {
    if (timer) clearTimeout(timer);
  });

  return {
    toastVisible: visible,
    toastMessage: message,
    showToast
  };
}
