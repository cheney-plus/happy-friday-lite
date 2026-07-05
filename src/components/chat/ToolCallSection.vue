<template>
  <div class="tool-call-section" :class="`status-${status}`">
    <!-- 可点击的标题栏：点击切换展开/收缩 -->
    <span class="tool-call-toggle" @click="toggleCollapsed">
      <!-- 状态图标 -->
      <span class="status-indicator" :class="`status-${status}`">
        <svg v-if="status === 'running'" class="spin-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
        </svg>
        <svg v-else-if="status === 'pending_approval'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <svg v-else-if="status === 'success'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <svg v-else-if="status === 'rejected'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </span>

      <!-- 标题文案：根据工具类别与状态智能映射 -->
      <span class="toggle-label">{{ titleText }}</span>

      <!-- 收缩箭头 -->
      <svg
        class="toggle-arrow"
        :class="{ collapsed: collapsed }"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </span>

    <!-- 展开内容：工具参数 + 输出 -->
    <div v-show="!collapsed" class="tool-call-body">
      <div v-if="argEntries.length > 0" class="tool-call-block">
        <div class="block-label">参数</div>
        <div class="arg-list">
          <div v-for="entry in argEntries" :key="entry.key" class="arg-row">
            <span class="arg-key">{{ entry.key }}</span>
            <span class="arg-sep">:</span>
            <span class="arg-value" :class="{ 'arg-value-long': entry.isLong }">{{ entry.value }}</span>
          </div>
        </div>
      </div>
      <div v-if="hasOutput" class="tool-call-block">
        <div class="block-label">结果</div>
        <pre class="block-content">{{ formattedOutput }}</pre>
      </div>
      <span v-if="status === 'running'" class="streaming-cursor"></span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  toolName: { type: String, required: true },
  arguments: { type: [Object, String], default: () => ({}) },
  output: { type: [String, Object], default: '' },
  status: { type: String, default: 'running' },
  //   running | pending_approval | success | rejected
  defaultCollapsed: { type: Boolean, default: false }
})

const collapsed = ref(props.defaultCollapsed)

function toggleCollapsed() {
  collapsed.value = !collapsed.value
}

// 工具名 → 友好动作文案映射
// 不同工具显示不同动词，让用户更直观地理解 Agent 在做什么
const ACTION_LABELS = {
  retrieve_knowledge: '检索知识库',
  search_notes: '搜索笔记',
  get_note: '查看笔记',
  create_note: '创建笔记',
  list_events: '查询日程',
  create_event: '创建日程',
  update_event: '更新日程',
  delete_event: '删除日程',
  list_agent_files: '浏览文件',
  read_agent_file: '读取文件',
  write_agent_file: '写入文件',
  execute_command: '执行命令',
  get_current_time: '获取当前时间'
}

// 状态 → 前缀文案
// running/pending_approval/success/rejected 四种状态对应不同前缀
const STATUS_PREFIX = {
  running: '',
  pending_approval: '等待批准 · ',
  success: '已',
  rejected: '已拒绝 · '
}

// 标题文案：状态前缀 + 工具友好名
// 例：
//   running + search_notes       → "搜索笔记"
//   success  + create_note       → "已创建笔记"
//   pending_approval + write_file → "等待批准 · 写入文件"
//   rejected + create_event      → "已拒绝 · 创建日程"
const titleText = computed(() => {
  const action = ACTION_LABELS[props.toolName] || `调用 ${props.toolName}`
  const prefix = STATUS_PREFIX[props.status] || ''
  // success 时直接拼「已 + 动作」（如「已搜索笔记」）
  if (props.status === 'success') {
    return prefix + action
  }
  return prefix + action
})

// 参数键名 → 友好中文显示名映射
const ARG_LABELS = {
  query: '查询',
  keywords: '关键词',
  note_id: '笔记ID',
  title: '标题',
  content: '内容',
  category: '分类',
  tags: '标签',
  path: '路径',
  dir_path: '目录路径',
  file_path: '文件路径',
  command: '命令',
  description: '描述',
  start_date: '开始日期',
  end_date: '结束日期',
  event_id: '日程ID',
  summary: '摘要',
  location: '地点',
  kb_name: '知识库',
  category_id: '分类ID',
  limit: '数量限制',
  offset: '偏移量',
  recursive: '递归',
  encoding: '编码',
  overwrite: '覆盖'
}

// 将参数对象解析为键值对列表，用于可读性更强的列表渲染
const argEntries = computed(() => {
  let args = props.arguments
  if (!args) return []
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args)
    } catch (_e) {
      return [{ key: '参数', value: args, isLong: args.length > 60 }]
    }
  }
  if (typeof args !== 'object' || args === null) {
    return [{ key: '参数', value: String(args), isLong: String(args).length > 60 }]
  }
  return Object.entries(args).map(([key, val]) => {
    let value
    if (val === null) value = 'null'
    else if (val === undefined) value = 'undefined'
    else if (typeof val === 'boolean') value = val ? '是' : '否'
    else if (typeof val === 'number') value = String(val)
    else if (typeof val === 'object') {
      const str = JSON.stringify(val, null, 2)
      value = str.length > 300 ? str.slice(0, 300) + '...' : str
    } else {
      value = String(val)
    }
    return {
      key: ARG_LABELS[key] || key,
      value,
      isLong: value.length > 60 || typeof val === 'object'
    }
  })
})

// 格式化输出
const formattedOutput = computed(() => {
  const out = props.output
  if (!out) return ''
  const str = typeof out === 'string' ? out : JSON.stringify(out)
  return str.length > 1000 ? str.slice(0, 1000) + '\n...' : str
})

const hasArgs = computed(() => argEntries.value.length > 0)

const hasOutput = computed(() => {
  if (!props.output) return false
  return !!String(props.output).trim()
})
</script>

<style scoped>
.tool-call-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tool-call-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-tertiary);
  cursor: pointer;
  user-select: none;
  line-height: 1;
  padding: 2px 0;
  width: fit-content;
}

.tool-call-toggle:hover {
  color: var(--text-secondary);
}

/* 状态指示器（小圆点/图标） */
.status-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.status-indicator.status-running {
  color: #1560F7;
}

.status-indicator.status-pending_approval {
  color: #f59e0b;
}

.status-indicator.status-success {
  color: #10b981;
}

.status-indicator.status-rejected {
  color: #ef4444;
}

/* 运行中的图标旋转动画 */
.spin-icon {
  animation: spin 1.2s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.toggle-label {
  font-size: 13px;
}

/* 状态色：running 显示蓝色标签，其他状态用灰色 + 状态色图标 */
.status-running .toggle-label {
  color: #1560F7;
}

.status-pending_approval .toggle-label {
  color: #f59e0b;
}

.status-success .toggle-label,
.status-rejected .toggle-label {
  color: var(--text-tertiary);
}

.toggle-arrow {
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.toggle-arrow.collapsed {
  transform: rotate(180deg);
}

/* 展开内容：左侧带细线，模仿"思考过程"的视觉风格 */
.tool-call-body {
  margin-top: 6px;
  padding-left: 10px;
  border-left: 2px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-call-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.block-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.block-content {
  margin: 0;
  padding: 8px 10px;
  background: var(--bg-secondary, #fafafa);
  border: 1px solid var(--border-color, #eee);
  border-radius: 6px;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary, #555);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 220px;
  overflow-y: auto;
}

/* 参数键值对列表 */
.arg-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  background: var(--bg-secondary, #fafafa);
  border: 1px solid var(--border-color, #eee);
  border-radius: 6px;
}

.arg-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12.5px;
  line-height: 1.6;
}

.arg-key {
  flex-shrink: 0;
  font-weight: 600;
  color: var(--text-secondary, #555);
  white-space: nowrap;
}

.arg-sep {
  flex-shrink: 0;
  color: var(--text-tertiary, #999);
}

.arg-value {
  color: var(--text-primary, #333);
  word-break: break-word;
  white-space: pre-wrap;
}

.arg-value-long {
  display: block;
  margin-top: 4px;
  padding: 6px 8px;
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-color, #eee);
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
  max-height: 160px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

/* 流式光标：running 状态下显示，与 AIMessage 中的样式一致 */
.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 14px;
  background: #1560F7;
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: blink 0.8s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
</style>
