<template>
  <div class="tool-call-section" :class="`status-${status}`">
    <!-- 紧凑标题栏：点击切换展开/收缩 -->
    <span class="tool-call-toggle" @click="toggleCollapsed">
      <!-- 状态圆点（小） -->
      <span class="status-dot" :class="`status-${status}`">
        <span v-if="status === 'running'" class="dot-pulse"></span>
      </span>

      <!-- 工具图标：扳手（统一风格） -->
      <svg class="tool-glyph" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
      </svg>

      <!-- 标题文案 -->
      <span class="toggle-label">{{ titleText }}</span>

      <!-- 折叠指示符：展开时 ∨，收缩时 › -->
      <svg v-if="!collapsed" class="toggle-arrow" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
      <svg v-else class="toggle-arrow" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 6 15 12 9 18"></polyline>
      </svg>
    </span>

    <!-- 展开内容：左侧细线 + 参数 + 输出 -->
    <div v-show="!collapsed" class="tool-call-body">
      <!-- 参数区 -->
      <div v-if="argEntries.length > 0" class="tool-call-block">
        <div class="block-label">参数</div>
        <div class="arg-list">
          <div v-for="entry in argEntries" :key="entry.key" class="arg-row">
            <div class="arg-key">{{ entry.key }}</div>
            <div class="arg-value" :class="{ 'arg-value-block': entry.isLong }">{{ entry.value }}</div>
          </div>
        </div>
      </div>

      <!-- 输出区 -->
      <div v-if="hasOutput" class="tool-call-block">
        <div class="block-label">结果</div>
        <div v-if="isShortOutput" class="output-inline">{{ formattedOutput }}</div>
        <div v-else class="output-block markdown-body" v-html="renderedOutput"></div>
      </div>

      <span v-if="status === 'running'" class="streaming-cursor"></span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { marked } from 'marked'

const props = defineProps({
  toolName: { type: String, required: true },
  arguments: { type: [Object, String], default: () => ({}) },
  output: { type: [String, Object], default: '' },
  status: { type: String, default: 'running' },
  defaultCollapsed: { type: Boolean, default: false }
})

const collapsed = ref(props.defaultCollapsed)

function toggleCollapsed() {
  collapsed.value = !collapsed.value
}

// ========== 友好文案映射 ==========
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

const STATUS_PREFIX = {
  running: '',
  pending_approval: '等待批准 · ',
  success: '已',
  rejected: '已拒绝 · '
}

const titleText = computed(() => {
  const action = ACTION_LABELS[props.toolName] || `调用 ${props.toolName}`
  const prefix = STATUS_PREFIX[props.status] || ''
  return prefix + action
})

// ========== 参数处理 ==========
const ARG_LABELS = {
  query: '查询',
  keywords: '关键词',
  noteId: '笔记ID',
  note_id: '笔记ID',
  title: '标题',
  content: '内容',
  category: '分类',
  tags: '标签',
  path: '路径',
  dir_path: '目录路径',
  dirPath: '目录路径',
  file_path: '文件路径',
  filePath: '文件路径',
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
  overwrite: '覆盖',
  knowledgeBaseId: '知识库ID',
  notebookId: '笔记本ID'
}

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

// ========== 输出处理 ==========
// 历史会话从数据库加载时，部分老记录的 output 可能是 JSON.stringify(ToolMessage) 的结果
// 形如 {"content":"...","name":"...","tool_call_id":"...","additional_kwargs":{},...}
// 这里尝试解析并提取 content 字段，恢复 handler 原始返回的可读文本
function unwrapToolMessage(str) {
  if (typeof str !== 'string' || str.length === 0) return str
  // 仅对疑似 JSON 对象字符串处理（避免误伤普通文本）
  const trimmed = str.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return str
  // 必须同时含 content / tool_call_id / name 等字段才认定为 ToolMessage JSON
  if (!/content/.test(trimmed) || !/tool_call_id/.test(trimmed)) return str
  try {
    const parsed = JSON.parse(trimmed)
    // ToolMessage 对象：提取 content 字段
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const c = parsed.content
      if (typeof c === 'string') return c
      if (Array.isArray(c)) {
        const text = c
          .map(item => typeof item === 'string' ? item : (item?.text || item?.content || ''))
          .join('')
        if (text) return text
      }
    }
  } catch (_e) {
    // 解析失败：原样返回
  }
  return str
}

const formattedOutput = computed(() => {
  const out = props.output
  if (!out) return ''
  // 先尝试剥离 ToolMessage JSON 包装（兼容老的历史记录）
  const unwrapped = typeof out === 'string' ? unwrapToolMessage(out) : out
  const str = typeof unwrapped === 'string' ? unwrapped : JSON.stringify(unwrapped)
  return str.length > 2000 ? str.slice(0, 2000) + '\n...' : str
})

const isShortOutput = computed(() => {
  const str = formattedOutput.value
  return str.length <= 120 && !str.includes('\n')
})

const renderedOutput = computed(() => {
  if (!formattedOutput.value) return ''
  try {
    marked.setOptions({ breaks: true, gfm: true })
    return marked.parse(formattedOutput.value)
  } catch (_e) {
    return formattedOutput.value
  }
})

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

/* ========== 紧凑标题栏（行内） ========== */
.tool-call-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
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

/* 状态圆点（小，6px） */
.status-dot {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.status-running { background: #1560F7; }
.status-dot.status-pending_approval { background: #f59e0b; }
.status-dot.status-success { background: #10b981; }
.status-dot.status-rejected { background: #ef4444; }

/* 运行中圆点脉冲 */
.dot-pulse {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #1560F7;
  animation: dot-pulse 1.4s ease-in-out infinite;
}

@keyframes dot-pulse {
  0% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(2); opacity: 0; }
  100% { transform: scale(1); opacity: 0; }
}

/* 工具图标（小，与文字同色） */
.tool-glyph {
  flex-shrink: 0;
  opacity: 0.7;
}

.toggle-label {
  font-size: 13px;
}

/* 状态色：running/pending_approval 显示状态色，其他用灰色 */
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
  flex-shrink: 0;
  opacity: 0.6;
}

/* ========== 展开内容：左侧细线 ========== */
.tool-call-body {
  margin-top: 6px;
  padding-left: 12px;
  border-left: 2px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
  /* 全局 main.css 设置了 * { user-select: none }，这里强制覆盖 */
  -webkit-user-select: text !important;
  user-select: text !important;
}

.tool-call-body * {
  -webkit-user-select: text !important;
  user-select: text !important;
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

/* ========== 参数列表（key 独占一行） ========== */
.arg-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  background: var(--bg-secondary, #fafafa);
  border: 1px solid var(--border-color, #eee);
  border-radius: 4px;
}

.arg-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.arg-key {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-tertiary, #888);
  line-height: 1.4;
}

.arg-value {
  font-size: 12.5px;
  color: var(--text-primary, #333);
  word-break: break-word;
  white-space: pre-wrap;
  line-height: 1.5;
}

/* 长参数值：与外层背景一致，不额外加白色背景 */
.arg-value-block {
  padding: 4px 0;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 11.5px;
  max-height: 140px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

/* ========== 输出区 ========== */
.output-inline {
  padding: 5px 8px;
  background: var(--bg-secondary, #fafafa);
  border: 1px solid var(--border-color, #eee);
  border-radius: 4px;
  font-size: 12.5px;
  color: var(--text-primary, #333);
  font-family: 'SF Mono', Monaco, monospace;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}

.output-block {
  padding: 8px 10px;
  background: var(--bg-secondary, #fafafa);
  border: 1px solid var(--border-color, #eee);
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-primary, #333);
  max-height: 240px;
  overflow-y: auto;
  line-height: 1.6;
}

/* Markdown 渲染样式（紧凑版） */
.output-block :deep(p) {
  margin: 0 0 6px 0;
}

.output-block :deep(p:last-child) {
  margin-bottom: 0;
}

.output-block :deep(h1),
.output-block :deep(h2),
.output-block :deep(h3),
.output-block :deep(h4) {
  margin: 8px 0 4px 0;
  font-weight: 600;
  line-height: 1.3;
}

.output-block :deep(h1) { font-size: 16px; }
.output-block :deep(h2) { font-size: 15px; }
.output-block :deep(h3) { font-size: 14px; }
.output-block :deep(h4) { font-size: 13px; }

.output-block :deep(ul),
.output-block :deep(ol) {
  margin: 4px 0;
  padding-left: 20px;
}

.output-block :deep(li) {
  margin: 2px 0;
}

.output-block :deep(code) {
  padding: 1px 4px;
  background: transparent;
  border-radius: 3px;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
}

.output-block :deep(pre) {
  margin: 6px 0;
  padding: 8px 10px;
  background: transparent;
  border-radius: 4px;
  overflow-x: auto;
}

.output-block :deep(pre code) {
  padding: 0;
  background: transparent;
  font-size: 12px;
}

.output-block :deep(blockquote) {
  margin: 6px 0;
  padding: 4px 12px;
  border-left: 3px solid var(--border-color, #ddd);
  color: var(--text-secondary, #777);
}

.output-block :deep(hr) {
  border: none;
  border-top: 1px solid var(--border-color, #eee);
  margin: 8px 0;
}

.output-block :deep(strong) {
  font-weight: 600;
}

.output-block :deep(a) {
  color: #1560F7;
  text-decoration: none;
}

/* ========== 流式光标 ========== */
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
