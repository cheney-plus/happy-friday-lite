<template>
  <AgentMessageBlock
    v-if="mode === 'agent' && (state.streaming.value || state.segments.value.length > 0)"
    :segments="state.segments.value"
    :reasoning-streaming-content="state.reasoning ? state.reasoning.value : ''"
    :is-reasoning-streaming="state.reasoningStreaming ? state.reasoningStreaming.value : false"
    :is-streaming="state.streaming.value"
    :thinking="state.thinking ? state.thinking.value : false"
  />
  <AIMessage
    v-else-if="state.streaming.value"
    :content="state.content.value"
    :reasoning-streaming-content="state.reasoning ? state.reasoning.value : ''"
    :sources="state.sources ? state.sources.value : undefined"
    :display-name="displayName"
    :is-streaming="true"
    :show-divider="false"
    :show-actions="showActions"
    :show-rollback="showRollback"
  />
</template>

<script setup>
import AIMessage from './AIMessage.vue';
import AgentMessageBlock from '@/views/friday/components/AgentMessageBlock.vue';

// 流式消息独立成组件：父组件只传入由 ref 组成的稳定 state 对象，
// 不在自己的模板里读取流式文本，从而避免每个 token 触发整个会话/弹窗重渲染。
defineProps({
  // 稳定对象，字段均为 ref：streaming / content / reasoning / sources / segments / reasoningStreaming / thinking
  state: { type: Object, required: true },
  mode: { type: String, default: 'chat' },
  displayName: { type: String, default: '周五' },
  showActions: { type: Boolean, default: true },
  showRollback: { type: Boolean, default: false }
});
</script>
