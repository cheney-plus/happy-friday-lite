/**
 * 内置工具：绘图操作（list_drawing_canvases / get_drawing_canvas / create_drawing / update_drawing / layout_drawing）
 * ====================================================================================================
 * 设计参考：绘图 Agent 设计文档.md
 *
 * Agent 运行在主进程，X6 Graph 运行在渲染进程，二者不能共享 Graph 实例。
 * 因此本文件直接生成/修改合法的 graphJSON 并通过 db.saveDrawingCanvas 持久化到 SQLite，
 * 再通过 drawing-updated IPC 事件通知前端刷新（前端 drawing store 拉取最新数据并重载编辑器）。
 *
 * 标准画法（与前端 shapes/ports.js、assets/drawing_temp 模板一致）：
 *   - 每个标准图形自带 4 个固定 ID 连接点：port-top / port-right / port-bottom / port-left
 *   - 边的端点写 { cell, port } 挂到连接点上，而不是默认连到节点中心
 *   - Agent 可显式指定 sourcePort/targetPort；未指定时按节点相对几何位置自动推断
 *     （上下相邻 → bottom→top，左右相邻 → right→left）
 *   - 时序图参与者（draw-seq-actor）之间的消息挂到生命线锚点（midSide），不用连接点
 *   - create_drawing 的工具描述内嵌完整绘图 JSON 语法规范（DRAWING_SYNTAX_GUIDE），
 *     包含图形目录、连接点、边样式、布局方向与各图类型规范
 *
 * 安全约束（设计文档第 7 节）：
 *   - shape / edgeStyle 只允许来自白名单目录
 *   - 节点与边 ID 唯一，边引用的节点必须存在
 *   - 坐标、宽高必须是有限数值并限制范围
 *   - 限制单次新增的节点和边数量
 *   - 只写入白名单字段，不接受任意 X6 attrs / markup（mindmap 的 markup 除外，由工具内部生成）
 */

import { z } from 'zod'
import { registerTool } from '../registry.js'

// ========== 白名单目录（与前端 src/views/drawing/shapes 保持一致） ==========

// 各图形默认尺寸（来自前端 catalog.js / register.js）
const SHAPE_SIZES = {
  'draw-rect': [140, 56],
  'draw-rounded': [140, 56],
  'draw-circle': [88, 88],
  'draw-ellipse': [120, 64],
  'draw-diamond': [140, 88],
  'draw-triangle': [120, 88],
  'draw-parallelogram': [150, 64],
  'draw-hexagon': [140, 80],
  'draw-star': [96, 96],
  'draw-cloud': [150, 90],
  'draw-cylinder': [110, 90],
  'draw-document': [130, 86],
  'draw-sticky': [140, 110],
  'draw-note': [130, 90],
  'draw-text': [140, 36],
  'draw-image': [148, 108],
  'draw-container': [280, 180],
  'draw-terminator': [128, 52],
  'draw-process': [140, 56],
  'draw-decision': [148, 92],
  'draw-data': [150, 60],
  'draw-preparation': [150, 70],
  'draw-delay': [130, 64],
  'draw-display': [140, 70],
  'draw-manual': [140, 70],
  'draw-connector': [44, 44],
  'draw-er-entity': [160, 88],
  'draw-er-weak': [168, 96],
  'draw-er-attr': [120, 52],
  'draw-er-key': [120, 52],
  'draw-er-rel': [140, 88],
  'draw-er-ident': [148, 92],
  'draw-uml-class': [200, 148],
  'draw-uml-interface': [160, 56],
  'draw-uml-actor': [64, 108],
  'draw-uml-usecase': [150, 70],
  'draw-uml-package': [180, 110],
  'draw-uml-component': [160, 72],
  'draw-tl-axis': [520, 8],
  'draw-tl-event': [150, 64],
  'draw-tl-milestone': [28, 28],
  'draw-seq-actor': [120, 280],
  'draw-seq-activation': [16, 80],
  'draw-seq-fragment': [360, 160],
  'draw-arch-client': [140, 64],
  'draw-arch-server': [140, 64],
  'draw-arch-db': [140, 64],
  'draw-arch-cloud': [140, 64],
  'draw-arch-queue': [140, 64],
  'draw-arch-cache': [140, 64],
  'draw-arch-gateway': [140, 64],
  'draw-dfd-external': [140, 64],
  'draw-dfd-process': [92, 92],
  'draw-dfd-store': [150, 48],
  topic: [160, 50],
  'topic-child': [100, 34]
}

// 友好名称 → 标准图形，降低模型写出无效 shape 的概率
const SHAPE_ALIASES = {
  rect: 'draw-rect',
  rectangle: 'draw-rect',
  box: 'draw-rect',
  rounded: 'draw-rounded',
  circle: 'draw-circle',
  ellipse: 'draw-ellipse',
  oval: 'draw-ellipse',
  diamond: 'draw-diamond',
  triangle: 'draw-triangle',
  parallelogram: 'draw-parallelogram',
  hexagon: 'draw-hexagon',
  star: 'draw-star',
  cloud: 'draw-cloud',
  cylinder: 'draw-cylinder',
  document: 'draw-document',
  file: 'draw-document',
  sticky: 'draw-sticky',
  card: 'draw-sticky',
  note: 'draw-note',
  annotation: 'draw-note',
  text: 'draw-text',
  label: 'draw-text',
  container: 'draw-container',
  group: 'draw-container',
  frame: 'draw-container',
  start: 'draw-terminator',
  begin: 'draw-terminator',
  end: 'draw-terminator',
  stop: 'draw-terminator',
  terminator: 'draw-terminator',
  process: 'draw-process',
  step: 'draw-process',
  decision: 'draw-decision',
  condition: 'draw-decision',
  data: 'draw-data',
  input: 'draw-data',
  preparation: 'draw-preparation',
  delay: 'draw-delay',
  display: 'draw-display',
  manual: 'draw-manual',
  entity: 'draw-er-entity',
  weakentity: 'draw-er-weak',
  attribute: 'draw-er-attr',
  key: 'draw-er-key',
  primarykey: 'draw-er-key',
  relation: 'draw-er-rel',
  relationship: 'draw-er-rel',
  class: 'draw-uml-class',
  'uml-class': 'draw-uml-class',
  interface: 'draw-uml-interface',
  'uml-interface': 'draw-uml-interface',
  actor: 'draw-uml-actor',
  person: 'draw-uml-actor',
  user: 'draw-uml-actor',
  usecase: 'draw-uml-usecase',
  package: 'draw-uml-package',
  component: 'draw-uml-component',
  event: 'draw-tl-event',
  milestone: 'draw-tl-milestone',
  external: 'draw-dfd-external',
  externalsystem: 'draw-dfd-external',
  datastore: 'draw-dfd-store',
  'dfd-store': 'draw-dfd-store',
  'dfd-process': 'draw-dfd-process',
  client: 'draw-arch-client',
  server: 'draw-arch-server',
  service: 'draw-arch-server',
  api: 'draw-arch-server',
  gateway: 'draw-arch-gateway',
  queue: 'draw-arch-queue',
  'message-queue': 'draw-arch-queue',
  cache: 'draw-arch-cache',
  database: 'draw-arch-db',
  db: 'draw-arch-db'
}

const SHAPE_ALIASES_CANONICAL = new Set(Object.values(SHAPE_ALIASES))

// 边样式白名单（与前端 edgeStyles.js 保持一致）
const EDGE_STYLE_DEFS = {
  straight: {
    router: { name: 'normal' },
    connector: { name: 'normal' },
    line: { stroke: '#64748b', strokeWidth: 1.6, strokeDasharray: 0, targetMarker: null, sourceMarker: null }
  },
  arrow: {
    router: { name: 'normal' },
    connector: { name: 'rounded', args: { radius: 8 } },
    line: { stroke: '#64748b', strokeWidth: 1.6, strokeDasharray: 0, targetMarker: { name: 'block', width: 10, height: 8 }, sourceMarker: null }
  },
  doubleArrow: {
    router: { name: 'normal' },
    connector: { name: 'rounded', args: { radius: 8 } },
    line: { stroke: '#64748b', strokeWidth: 1.6, strokeDasharray: 0, targetMarker: { name: 'block', width: 10, height: 8 }, sourceMarker: { name: 'block', width: 10, height: 8 } }
  },
  dashed: {
    router: { name: 'normal' },
    connector: { name: 'rounded', args: { radius: 8 } },
    line: { stroke: '#64748b', strokeWidth: 1.6, strokeDasharray: '8 5', targetMarker: { name: 'block', width: 10, height: 8 }, sourceMarker: null }
  },
  dashedStraight: {
    router: { name: 'normal' },
    connector: { name: 'normal' },
    line: { stroke: '#64748b', strokeWidth: 1.6, strokeDasharray: '8 5', targetMarker: null, sourceMarker: null }
  },
  orthogonal: {
    router: { name: 'orth' },
    connector: { name: 'rounded', args: { radius: 8 } },
    line: { stroke: '#64748b', strokeWidth: 1.6, strokeDasharray: 0, targetMarker: { name: 'block', width: 10, height: 8 }, sourceMarker: null }
  },
  manhattan: {
    router: { name: 'manhattan' },
    connector: { name: 'rounded', args: { radius: 8 } },
    line: { stroke: '#64748b', strokeWidth: 1.6, strokeDasharray: 0, targetMarker: { name: 'block', width: 10, height: 8 }, sourceMarker: null }
  },
  curve: {
    router: { name: 'normal' },
    connector: { name: 'smooth' },
    line: { stroke: '#64748b', strokeWidth: 1.6, strokeDasharray: 0, targetMarker: { name: 'classic', width: 10, height: 8 }, sourceMarker: null }
  },
  // UML 类图标准关系线（与前端 edgeStyles.js 保持一致：空心三角/菱形端点）
  inheritance: {
    router: { name: 'normal' },
    connector: { name: 'rounded', args: { radius: 8 } },
    line: { stroke: '#64748b', strokeWidth: 1.6, strokeDasharray: 0, targetMarker: { name: 'block', width: 14, height: 12, fill: 'transparent' }, sourceMarker: null }
  },
  realization: {
    router: { name: 'normal' },
    connector: { name: 'rounded', args: { radius: 8 } },
    line: { stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: '8 5', targetMarker: { name: 'block', width: 14, height: 12, fill: 'transparent' }, sourceMarker: null }
  },
  dependency: {
    router: { name: 'normal' },
    connector: { name: 'rounded', args: { radius: 8 } },
    line: { stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: '6 4', targetMarker: { name: 'block', width: 11, height: 9, open: true }, sourceMarker: null }
  },
  composition: {
    router: { name: 'normal' },
    connector: { name: 'rounded', args: { radius: 8 } },
    line: { stroke: '#64748b', strokeWidth: 1.6, strokeDasharray: 0, targetMarker: null, sourceMarker: { name: 'diamond', width: 14, height: 9 } }
  },
  aggregation: {
    router: { name: 'normal' },
    connector: { name: 'rounded', args: { radius: 8 } },
    line: { stroke: '#64748b', strokeWidth: 1.6, strokeDasharray: 0, targetMarker: null, sourceMarker: { name: 'diamond', width: 14, height: 9, fill: 'transparent' } }
  },
  er: {
    router: { name: 'er' },
    connector: { name: 'rounded', args: { radius: 6 } },
    line: { stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: 0, targetMarker: { name: 'classic', width: 10, height: 8 }, sourceMarker: null }
  },
  message: {
    router: { name: 'normal' },
    connector: { name: 'normal' },
    line: { stroke: '#2563eb', strokeWidth: 1.4, strokeDasharray: 0, targetMarker: { name: 'block', width: 10, height: 7 }, sourceMarker: null }
  },
  returnMessage: {
    router: { name: 'normal' },
    connector: { name: 'normal' },
    line: { stroke: '#64748b', strokeWidth: 1.3, strokeDasharray: '7 4', targetMarker: { name: 'classic', width: 10, height: 7 }, sourceMarker: null }
  },
  dataflow: {
    router: { name: 'orth' },
    connector: { name: 'rounded', args: { radius: 8 } },
    line: { stroke: '#0f766e', strokeWidth: 1.6, strokeDasharray: 0, targetMarker: { name: 'block', width: 10, height: 8 }, sourceMarker: null }
  }
}

const EDGE_ALIASES = {
  line: 'straight',
  solid: 'straight',
  'dashed-arrow': 'dashed',
  double: 'doubleArrow',
  'double-arrow': 'doubleArrow',
  'dashed-straight': 'dashedStraight',
  orth: 'orthogonal',
  ortho: 'orthogonal',
  smooth: 'curve',
  bezier: 'curve',
  return: 'returnMessage',
  sequence: 'message',
  flow: 'dataflow',
  // UML 关系线别名
  inherit: 'inheritance',
  inheritance: 'inheritance',
  generalization: 'inheritance',
  extends: 'inheritance',
  implement: 'realization',
  implements: 'realization',
  realization: 'realization',
  depend: 'dependency',
  dependency: 'dependency',
  uses: 'dependency',
  compose: 'composition',
  composition: 'composition',
  aggregate: 'aggregation',
  aggregation: 'aggregation'
}

// 默认连线风格：按图类型选择
const KIND_DEFAULT_EDGE = {
  er: 'er',
  dfd: 'dataflow',
  sequence: 'message',
  uml: 'arrow'
}

// 默认布局方向：按图类型选择（其余默认 TB）
const KIND_DEFAULT_DIRECTION = {
  er: 'LR'
}

const KIND_TITLE_KEY = {
  mindmap: 'mindMap',
  flowchart: 'flowchart',
  er: 'er',
  architecture: 'architecture',
  kanban: 'kanban'
}

const KINDS = ['flowchart', 'mindmap', 'er', 'architecture', 'kanban', 'uml', 'sequence', 'timeline', 'dfd', 'blank']

// 限制值（设计文档第 7 节）
const MAX_NODES = 80
const MAX_EDGES = 120
const MAX_OPS = 50
const MAX_LABEL_LEN = 120
const COORD_MIN = -2000
const COORD_MAX = 6000
const SIZE_MIN = 8
const SIZE_MAX = 1000

// 与前端 catalog.js 的 PRESERVE_STYLE_PREFIXES 保持一致：
// 这些形状自带配色/自定义 markup，不要覆盖它们的主题样式
const PRESERVE_STYLE_PREFIXES = [
  'topic',
  'topic-child',
  'draw-arch-',
  'draw-er-',
  'draw-uml-',
  'draw-dfd-',
  'draw-sticky',
  'draw-note',
  'draw-text',
  'draw-image',
  'draw-seq-activation',
  'draw-tl-milestone'
]

// 与前端 mindmap.js 的 MIND_MARKUP 保持一致
const MIND_MARKUP = [
  { tagName: 'rect', selector: 'body' },
  { tagName: 'rect', selector: 'line' },
  { tagName: 'text', selector: 'label' },
  { tagName: 'circle', selector: 'add' },
  { tagName: 'text', selector: 'addPlus' },
  { tagName: 'circle', selector: 'collapseBadge' },
  { tagName: 'text', selector: 'collapseCount' }
]

const MIND_SIZES = {
  topic: [160, 50],
  'topic-branch': [120, 40],
  'topic-child': [100, 34]
}

// ========== 基础工具函数 ==========

let idCounter = 0
function genId(prefix) {
  idCounter = (idCounter + 1) % 10000
  return `${prefix}-${Date.now().toString(36)}-${idCounter}-${Math.random().toString(36).slice(2, 6)}`
}

function clampNumber(value, min, max, fallback = null) {
  const num = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  if (typeof num !== 'number' || !Number.isFinite(num)) return fallback
  return Math.min(max, Math.max(min, Math.round(num)))
}

function cleanLabel(value, fallback = '') {
  if (typeof value !== 'string') return fallback
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_LEN)
}

// X6 边的 vertices 路径点：边按顺序经过这些画布坐标点，用于精确控制走向
const MAX_VERTICES = 10

function sanitizeVertices(value) {
  if (value == null) return undefined
  if (!Array.isArray(value)) throw new Error('vertices 必须是 [{x, y}] 数组')
  if (value.length > MAX_VERTICES) {
    throw new Error(`路径点数量超出限制：最多 ${MAX_VERTICES} 个，收到 ${value.length} 个`)
  }
  const points = value.map((point, index) => {
    if (!point || typeof point !== 'object') throw new Error(`vertices[${index}] 不是对象`)
    const x = clampNumber(point.x, COORD_MIN, COORD_MAX)
    const y = clampNumber(point.y, COORD_MIN, COORD_MAX)
    if (x == null || y == null) throw new Error(`vertices[${index}] 缺少有效的 x/y 坐标`)
    return { x, y }
  })
  return points.length ? points : undefined
}

function sanitizeLabelPosition(value) {
  if (value == null || value === '') return null
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return null
  // X6 中 distance 为 0 时按绝对像素 0 计算（标签贴在起点上），
  // 因此钳制到 (0, 1] 区间，保证数值始终按路径比例解释
  return Math.min(1, Math.max(0.02, num))
}

function sanitizeId(value, prefix, used) {
  let id = typeof value === 'string' ? value.trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40) : ''
  if (!id) id = genId(prefix)
  while (used.has(id)) id = `${id.slice(0, 34)}-${Math.random().toString(36).slice(2, 5)}`
  used.add(id)
  return id
}

function normalizeShape(value, fallback = 'draw-rect') {
  if (typeof value !== 'string' || !value.trim()) return fallback
  const key = value.trim().toLowerCase()
  if (SHAPE_SIZES[key] || key === 'draw-image') return key
  if (SHAPE_ALIASES_CANONICAL.has(key) && SHAPE_SIZES[key]) return key
  if (SHAPE_ALIASES[key]) return SHAPE_ALIASES[key]
  return fallback
}

function normalizeEdgeStyle(value, fallback = 'manhattan') {
  if (typeof value !== 'string' || !value.trim()) return fallback
  const key = value.trim()
  if (EDGE_STYLE_DEFS[key]) return key
  const alias = EDGE_ALIASES[key.toLowerCase()]
  return alias && EDGE_STYLE_DEFS[alias] ? alias : fallback
}

// ========== 连接点（ports）==========
// 与前端 shapes/ports.js 的 SIDE_PORTS 保持一致：
// 每个标准图形自带 4 个固定 ID 的连接点 port-top / port-right / port-bottom / port-left，
// 边的 source/target 通过 { cell, port } 挂到连接点上，这是标准画法的关键。

const PORT_SIDES = ['top', 'right', 'bottom', 'left']

function normalizePort(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  const key = value.trim().toLowerCase()
  if (PORT_SIDES.includes(key)) return key
  const match = key.match(/^port-(top|right|bottom|left)$/)
  return match ? match[1] : null
}

function nodeCenter(node) {
  return {
    x: (node.x || 0) + (node.width || 140) / 2,
    y: (node.y || 0) + (node.height || 56) / 2
  }
}

// 按两节点的相对几何位置推断连接点方位：
// 垂直关系（|dy| >= |dx|）用 bottom/top，水平关系用 right/left
function inferPortSide(node, otherNode) {
  if (!node || !otherNode) return null
  const nc = nodeCenter(node)
  const oc = nodeCenter(otherNode)
  const dx = oc.x - nc.x
  const dy = oc.y - nc.y
  if (Math.abs(dy) >= Math.abs(dx)) return dy >= 0 ? 'bottom' : 'top'
  return dx >= 0 ? 'right' : 'left'
}

// 时序图两个参与者（draw-seq-actor 自带生命线）之间的消息
// 按前端时序图模板的做法挂到生命线上（midSide 锚点），而不是连接点
function isSeqActorPair(a, b) {
  return a?.shape === 'draw-seq-actor' && b?.shape === 'draw-seq-actor'
}

function countSeqMessages(cells) {
  return cells.filter(
    (cell) =>
      isEdgeCell(cell) &&
      isSeqActorPair(findNodeCell(cells, cell.source?.cell), findNodeCell(cells, cell.target?.cell))
  ).length
}

// 构造边的端点：优先显式 port，其次几何推断，最后退回纯 cell（中心连接）
function buildTerminal(cellId, port, node, otherNode, seqPadding) {
  if (node && otherNode && isSeqActorPair(node, otherNode)) {
    return {
      cell: cellId,
      anchor: { name: 'midSide', args: { padding: seqPadding != null ? seqPadding : 80 } }
    }
  }
  const side = normalizePort(port) || inferPortSide(node, otherNode)
  return side ? { cell: cellId, port: `port-${side}` } : { cell: cellId }
}

function shouldPreserveStyle(shape) {
  return PRESERVE_STYLE_PREFIXES.some((prefix) => shape.startsWith(prefix) || shape === prefix)
}

function isEdgeCell(cell) {
  return cell && (cell.source || cell.target)
}

function isMindCell(cell) {
  return !isEdgeCell(cell) && Boolean(cell?.data?.mind)
}

// ========== graphJSON 构造 ==========

// 浅色主题颜色（与前端 createNodeMetadata 的浅色主题一致）
const THEME = { fill: '#ffffff', stroke: '#94a3b8', text: '#1c1917' }

function buildNodeCell({ id, shape, x, y, width, height, label, data = {}, zIndex = 1 }) {
  const [defaultW, defaultH] = SHAPE_SIZES[shape] || [140, 56]
  const cell = {
    id,
    shape,
    x: clampNumber(x, COORD_MIN, COORD_MAX, 80),
    y: clampNumber(y, COORD_MIN, COORD_MAX, 80),
    width: clampNumber(width, SIZE_MIN, SIZE_MAX, defaultW),
    height: clampNumber(height, SIZE_MIN, SIZE_MAX, defaultH),
    label,
    zIndex,
    data: { ...data }
  }
  if (!shouldPreserveStyle(shape)) {
    cell.attrs = {
      body: { fill: THEME.fill, stroke: THEME.stroke },
      label: { fill: THEME.text, text: label }
    }
  }
  return cell
}

function buildEdgeCell({
  id,
  source,
  target,
  style,
  label,
  labelPosition,
  vertices,
  sourcePort,
  targetPort,
  sourceNode,
  targetNode,
  seqPadding
}) {
  const styleId = normalizeEdgeStyle(style)
  const def = EDGE_STYLE_DEFS[styleId]
  const cell = {
    id,
    shape: 'edge',
    source: buildTerminal(source, sourcePort, sourceNode, targetNode, seqPadding),
    target: buildTerminal(target, targetPort, targetNode, sourceNode, seqPadding),
    router: def.router,
    connector: def.connector,
    attrs: { line: { ...def.line } },
    data: { edgeStyle: styleId },
    zIndex: 0
  }
  // X6 vertices：边按顺序经过的画布坐标点，用于精确控制走向（如回退边绕行）
  const points = sanitizeVertices(vertices)
  if (points) cell.vertices = points
  if (label) {
    // X6 标签位置：数值作为 distance，0.5 即边中点（默认居中）
    const position = sanitizeLabelPosition(labelPosition) ?? 0.5
    cell.labels = [
      {
        position,
        attrs: { label: { text: label, fontSize: 11 } }
      }
    ]
  }
  return cell
}

function buildMindEdgeCell({ id, source, target, treeId, side = 'right' }) {
  const goingRight = side !== 'left'
  return {
    id,
    shape: 'mindmap-edge',
    router: { name: 'normal' },
    connector: { name: 'mindmap' },
    source: {
      cell: source,
      anchor: { name: 'center', args: { dx: goingRight ? '30%' : '-30%' } }
    },
    target: {
      cell: target,
      anchor: { name: 'center', args: { dx: goingRight ? '-30%' : '30%' } }
    },
    attrs: {
      line: { stroke: '#A2B1C3', strokeWidth: 2, targetMarker: '', sourceMarker: '' }
    },
    data: { mind: { treeId } },
    zIndex: 0
  }
}

// ========== 自动布局（主进程侧，纯几何计算） ==========

// 分层布局：direction 'TB'（默认）按层自上而下排列（流程图/架构图标准方向），
// 'LR' 按层自左向右排列（ER 图标准方向）
// UML 泛化/实现边语义上指向"上层"（父类/接口），
// 分层布局时按相反方向计算层级，保证父类/接口位于子类/实现类上方
const UML_REVERSED_EDGE_STYLES = new Set(['inheritance', 'realization'])

function layoutLayered(cells, direction = 'TB') {
  const nodes = cells.filter((cell) => !isEdgeCell(cell) && !isMindCell(cell))
  if (!nodes.length) return
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const preds = new Map(nodes.map((node) => [node.id, []]))
  const succs = new Map(nodes.map((node) => [node.id, []]))
  cells.forEach((cell) => {
    if (!isEdgeCell(cell)) return
    let src = cell.source?.cell
    let tgt = cell.target?.cell
    if (UML_REVERSED_EDGE_STYLES.has(cell.data?.edgeStyle)) {
      [src, tgt] = [tgt, src]
    }
    if (!nodeById.has(src) || !nodeById.has(tgt) || src === tgt) return
    succs.get(src).push(tgt)
    preds.get(tgt).push(src)
  })

  // 最长路径分层；通过迭代上限容忍环
  const layers = new Map(nodes.map((node) => [node.id, 0]))
  for (let iter = 0; iter < nodes.length; iter++) {
    let changed = false
    nodes.forEach((node) => {
      const next = Math.max(...preds.get(node.id).map((p) => layers.get(p) + 1), 0)
      if (next !== layers.get(node.id) && next < nodes.length) {
        layers.set(node.id, next)
        changed = true
      }
    })
    if (!changed) break
  }

  const byLayer = new Map()
  nodes.forEach((node) => {
    const layer = layers.get(node.id) || 0
    if (!byLayer.has(layer)) byLayer.set(layer, [])
    byLayer.get(layer).push(node)
  })

  const sortedLayers = [...byLayer.keys()].sort((a, b) => a - b)

  if (direction === 'LR') {
    const columnWidth = new Map(
      sortedLayers.map((layer) => [
        layer,
        Math.max(...byLayer.get(layer).map((node) => node.width || 140), 100)
      ])
    )
    const columnX = new Map()
    let x = 60
    sortedLayers.forEach((layer) => {
      columnX.set(layer, x)
      x += columnWidth.get(layer) + 80
    })

    const layerHeights = sortedLayers.map((layer) =>
      byLayer.get(layer).reduce((sum, node) => sum + (node.height || 56) + 40, 0)
    )
    const totalHeight = Math.max(...layerHeights, 0)
    sortedLayers.forEach((layer, index) => {
      let y = Math.max(60, (totalHeight - layerHeights[index]) / 2)
      byLayer.get(layer).forEach((node) => {
        node.x = Math.round(columnX.get(layer) + (columnWidth.get(layer) - (node.width || 140)) / 2)
        node.y = Math.round(y)
        y += (node.height || 56) + 40
      })
    })
    return
  }

  // TB：层作为行，自上而下；行内节点水平铺开并整体居中对齐
  const rowHeight = new Map(
    sortedLayers.map((layer) => [
      layer,
      Math.max(...byLayer.get(layer).map((node) => node.height || 56), 40)
    ])
  )
  const rowY = new Map()
  let y = 60
  sortedLayers.forEach((layer) => {
    rowY.set(layer, y)
    y += rowHeight.get(layer) + 84
  })

  const GAP_X = 70
  const rowWidths = sortedLayers.map((layer) =>
    byLayer.get(layer).reduce((sum, node) => sum + (node.width || 140) + GAP_X, -GAP_X)
  )
  const maxRowWidth = Math.max(...rowWidths, 0)
  sortedLayers.forEach((layer, index) => {
    let x = 60 + Math.max(0, (maxRowWidth - rowWidths[index]) / 2)
    byLayer.get(layer).forEach((node) => {
      node.x = Math.round(x)
      node.y = Math.round(rowY.get(layer) + (rowHeight.get(layer) - (node.height || 56)) / 2)
      x += (node.width || 140) + GAP_X
    })
  })
}

function layoutGrid(cells) {
  const nodes = cells.filter((cell) => !isEdgeCell(cell) && !isMindCell(cell))
  if (!nodes.length) return
  const cols = Math.ceil(Math.sqrt(nodes.length))
  const rowHeights = []
  for (let i = 0; i < nodes.length; i += cols) {
    rowHeights.push(Math.max(...nodes.slice(i, i + cols).map((node) => node.height || 56)))
  }
  nodes.forEach((node, index) => {
    const row = Math.floor(index / cols)
    const col = index % cols
    node.x = Math.round(80 + col * 260)
    node.y = Math.round(
      80 + rowHeights.slice(0, row).reduce((sum, h) => sum + h + 48, 0)
    )
  })
}

// ========== 数据库与事件 ==========

async function getDb() {
  return import('../../../db.js')
}

function notifyCanvasUpdated(ctx, canvas) {
  try {
    ctx.emit('drawing-updated', {
      requestId: ctx.requestId,
      canvasId: canvas.id,
      title: canvas.title,
      kind: canvas.kind,
      updatedAt: canvas.updatedAt,
      source: 'agent'
    })
  } catch (e) {
    ctx.logger.warn(`[drawingOps] 发送 drawing-updated 事件失败: ${e.message}`)
  }
}

// ========== mindmap graphJSON 构造（nodes + edges → mind 树） ==========

function buildMindmapCells(nodes, edges, usedIds) {
  // 父子关系：优先取节点上的 parentId，其次按 parent->child 边推导（多父取第一条）
  const parentOf = new Map()
  nodes.forEach((node) => {
    if (node.parentId) parentOf.set(node.id, node.parentId)
  })
  edges.forEach((edge) => {
    if (!parentOf.has(edge.target)) {
      parentOf.set(edge.target, edge.source)
    }
  })

  // 计算深度与同层序号
  const depth = new Map()
  const order = new Map()
  function computeDepth(id, seen) {
    if (depth.has(id)) return depth.get(id)
    if (seen.has(id)) return 0
    seen.add(id)
    const parent = parentOf.get(id)
    const result = parent ? computeDepth(parent, seen) + 1 : 0
    seen.delete(id)
    depth.set(id, result)
    return result
  }
  const siblingCounter = new Map()
  nodes.forEach((node) => {
    computeDepth(node.id, new Set())
    const parent = parentOf.get(node.id)
    if (parent) {
      const next = (siblingCounter.get(parent) || 0) + 1
      siblingCounter.set(parent, next)
      order.set(node.id, next - 1)
    }
  })

  const treeId = genId('mt')
  const cells = []
  const idByNode = new Map(nodes.map((node) => [node.id, node.id]))

  nodes.forEach((node) => {
    const d = depth.get(node.id) || 0
    const type = d === 0 ? 'topic' : d === 1 ? 'topic-branch' : 'topic-child'
    const [width, height] = MIND_SIZES[type]
    const parent = parentOf.get(node.id)
    cells.push({
      id: node.id,
      shape: type === 'topic-child' ? 'topic-child' : 'topic',
      x: 0,
      y: 0,
      width,
      height,
      label: node.label,
      markup: MIND_MARKUP,
      zIndex: 1,
      data: {
        catalogId: type === 'topic' ? 'mindRoot' : type === 'topic-branch' ? 'mindTopic' : 'mindSub',
        mind: {
          treeId,
          parentId: parent ? idByNode.get(parent) || null : null,
          type,
          side: 'right',
          order: order.get(node.id) ?? 0
        }
      }
    })
  })

  // 每个有父节点的节点画一条 mind 连线；edges 中的父子关系不重复画，其余作为附加连线
  const drawnPairs = new Set()
  nodes.forEach((node) => {
    const parent = parentOf.get(node.id)
    if (!parent) return
    drawnPairs.add(`${parent}->${node.id}`)
    cells.push(buildMindEdgeCell({
      id: sanitizeId(null, 'e', usedIds),
      source: parent,
      target: node.id,
      treeId,
      side: node.side || 'right'
    }))
  })
  edges.forEach((edge) => {
    const pair = `${edge.source}->${edge.target}`
    if (drawnPairs.has(pair)) return
    drawnPairs.add(pair)
    cells.push(buildMindEdgeCell({
      id: sanitizeId(edge.id, 'e', usedIds),
      source: edge.source,
      target: edge.target,
      treeId
    }))
  })

  return cells
}

// ========== 校验：节点与边 ==========

function validateNodesInput(nodes, kind, usedIds) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error('nodes 不能为空，至少需要 1 个节点')
  }
  if (nodes.length > MAX_NODES) {
    throw new Error(`节点数量超出限制：最多 ${MAX_NODES} 个，收到 ${nodes.length} 个`)
  }
  return nodes.map((node, index) => {
    if (!node || typeof node !== 'object') throw new Error(`nodes[${index}] 不是对象`)
    const shape = normalizeShape(node.shape, kind === 'mindmap' ? 'topic-child' : 'draw-rect')
    const label = cleanLabel(node.label)
    const id = sanitizeId(node.id, 'n', usedIds)
    return {
      id,
      shape,
      label,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      zIndex: clampNumber(node.zIndex, 0, 10, 1),
      parentId: typeof node.parentId === 'string' ? node.parentId.trim() : null,
      className: cleanLabel(node.className, ''),
      attributes: typeof node.attributes === 'string' ? node.attributes.slice(0, 1000) : null,
      methods: typeof node.methods === 'string' ? node.methods.slice(0, 1000) : null,
      rawData: node
    }
  })
}

function validateEdgesInput(edges, nodeIds, defaultStyle, usedIds) {
  if (edges == null) return []
  if (!Array.isArray(edges)) throw new Error('edges 必须是数组')
  if (edges.length > MAX_EDGES) {
    throw new Error(`连线数量超出限制：最多 ${MAX_EDGES} 条，收到 ${edges.length} 条`)
  }
  return edges.map((edge, index) => {
    if (!edge || typeof edge !== 'object') throw new Error(`edges[${index}] 不是对象`)
    const source = typeof edge.source === 'string' ? edge.source.trim() : ''
    const target = typeof edge.target === 'string' ? edge.target.trim() : ''
    if (!source || !target) throw new Error(`edges[${index}] 缺少 source 或 target`)
    if (!nodeIds.has(source)) throw new Error(`edges[${index}] 的 source "${source}" 不存在于 nodes 中`)
    if (!nodeIds.has(target)) throw new Error(`edges[${index}] 的 target "${target}" 不存在于 nodes 中`)
    if (source === target) throw new Error(`edges[${index}] 不允许自环（source 与 target 相同）`)
    return {
      id: sanitizeId(edge.id, 'e', usedIds),
      source,
      target,
      style: normalizeEdgeStyle(edge.style, defaultStyle),
      label: cleanLabel(edge.label),
      labelPosition: sanitizeLabelPosition(edge.labelPosition),
      vertices: edge.vertices,
      sourcePort: edge.sourcePort || null,
      targetPort: edge.targetPort || null
    }
  })
}

function applyLayout(cells, layout, kind, direction) {
  if (kind === 'mindmap') return // 前端加载时会自动对 mind 树布局
  if (layout === 'grid') layoutGrid(cells)
  else if (layout === 'layered') layoutLayered(cells, direction)
  // layout === 'none'：尊重模型提供的坐标
}

function buildGraphJSON(nodes, edges, kind, layout, direction, usedIds) {
  if (kind === 'mindmap') {
    return { cells: buildMindmapCells(nodes, edges, usedIds) }
  }

  const nodeCells = nodes.map((node) => {
    const data = {}
    if (node.shape === 'draw-uml-class') {
      data.className = node.className || node.label
      if (node.attributes) data.attributes = node.attributes
      if (node.methods) data.methods = node.methods
    }
    return buildNodeCell({ ...node, data })
  })
  // 分层布局需要读取边来推导层级：用轻量边桩（含 source/target/edgeStyle）参与布局计算
  const layoutEdges = edges.map((edge) => ({
    source: { cell: edge.source },
    target: { cell: edge.target },
    data: { edgeStyle: edge.style }
  }))
  // 先布局得到节点最终坐标，再生成边，
  // 这样边的连接点能按节点相对位置正确推断（如上下相邻 → bottom→top）
  applyLayout([...nodeCells, ...layoutEdges], layout, kind, direction)

  const nodeById = new Map(nodeCells.map((cell) => [cell.id, cell]))
  let seqMessages = 0
  const edgeCells = edges.map((edge) => {
    const sourceNode = nodeById.get(edge.source)
    const targetNode = nodeById.get(edge.target)
    let seqPadding
    if (isSeqActorPair(sourceNode, targetNode)) {
      seqPadding = 80 + seqMessages * 55
      seqMessages++
    }
    return buildEdgeCell({ ...edge, sourceNode, targetNode, seqPadding })
  })
  return { cells: [...nodeCells, ...edgeCells] }
}

// ========== 工具：list_drawing_canvases ==========

const listDrawingCanvasesSchema = z.object({})

async function listDrawingCanvasesHandler(args, ctx) {
  const { getDrawingState } = await getDb()
  const state = getDrawingState()
  ctx.logger.info(`[list_drawing_canvases] 共 ${state.canvases.length} 个画布`)
  if (!state.canvases.length) {
    return '当前没有任何绘图画布。'
  }
  return state.canvases
    .map((canvas) => {
      const nodeCount = (canvas.graphJSON?.cells || []).filter((cell) => !isEdgeCell(cell)).length
      const title = canvas.title || canvas.titleKey || canvas.id
      return `- [${canvas.id}] ${title}（类型: ${canvas.kind}，节点数: ${nodeCount}，更新于: ${new Date(canvas.updatedAt).toLocaleString()}）`
    })
    .join('\n')
}

registerTool({
  name: 'list_drawing_canvases',
  description: '列出用户的所有绘图画布（ID、标题、类型、节点数量、更新时间）。在创建或修改画布前先调用它了解现有画布。',
  schema: listDrawingCanvasesSchema,
  handler: listDrawingCanvasesHandler,
  meta: { requireApproval: false, exposedViaMcp: true }
})

// ========== 工具：get_drawing_canvas ==========

const getDrawingCanvasSchema = z.object({
  canvasId: z.string().describe('画布 ID，可从 list_drawing_canvases 获取')
})

async function getDrawingCanvasHandler(args, ctx) {
  const { canvasId } = args
  const { getDrawingCanvas } = await getDb()
  const canvas = getDrawingCanvas(canvasId)
  if (!canvas) {
    return `未找到画布: ${canvasId}`
  }
  ctx.logger.info(`[get_drawing_canvas] canvasId=${canvasId}`)

  const cells = canvas.graphJSON?.cells || []
  const nodes = cells.filter((cell) => !isEdgeCell(cell))
  const edges = cells.filter(isEdgeCell)

  const lines = [
    `画布：${canvas.title || canvas.titleKey || canvas.id}（类型: ${canvas.kind}，ID: ${canvas.id}）`,
    `节点（${nodes.length} 个）：`,
    ...nodes.map((node) => {
      const mind = node.data?.mind
      const parentInfo = mind?.parentId ? `，父节点: ${mind.parentId}` : ''
      return `- ${node.id} [${node.shape}] ${node.label || '(无标签)'}${parentInfo}`
    }),
    `连线（${edges.length} 条）：`,
    ...edges.map((edge) => {
      const style = edge.data?.edgeStyle || 'manhattan'
      const label = edge.labels?.[0]?.attrs?.label?.text || ''
      const srcPort = edge.source?.port?.replace('port-', '')
      const tgtPort = edge.target?.port?.replace('port-', '')
      const src = `${edge.source?.cell}${srcPort ? `(${srcPort})` : ''}`
      const tgt = `${edge.target?.cell}${tgtPort ? `(${tgtPort})` : ''}`
      return `- ${edge.id}: ${src} -> ${tgt}（样式: ${style}${label ? `，标签: ${label}` : ''}）`
    })
  ]
  return lines.join('\n')
}

registerTool({
  name: 'get_drawing_canvas',
  description: '获取指定画布的语义化摘要：所有节点（ID、形状、标签）和连线（ID、起点、终点、样式、标签）。用于修改画布前了解当前内容。',
  schema: getDrawingCanvasSchema,
  handler: getDrawingCanvasHandler,
  meta: { requireApproval: false, exposedViaMcp: true }
})

// ========== 工具：create_drawing ==========

// 绘图 JSON 语法规范：作为工具描述喂给模型，确保画出标准、规范的图。
// 内容依据 AntV X6 官方文档（https://x6.antv.antgroup.com/tutorial/about）与本项目的图形注册表整理。
// 关键点是连接点（ports）语法——这是图形是否标准的核心。
const DRAWING_SYNTAX_GUIDE = `绘图 JSON 语法规范（基于 AntV X6 图形引擎，必须严格遵循，否则画出的图不标准）：

【一、坐标系与画布】
- x/y 是节点"左上角"坐标（不是中心点），单位 px；y 轴向下为正
- 画布没有固定大小，会自动缩放适配内容；网格间距 16px，坐标取 8 的倍数最整齐
- 通用节点默认尺寸约 140x56（图形默认尺寸见下方目录），文本超宽会自动换行并增高

【二、节点 nodes】每个节点对象：
- id: 语义化唯一 ID（如 "start"、"review"），edges 通过 id 引用该节点
- shape: 图形名（见目录，支持别名，如 process/decision/database）
- label: 节点显示文本（建议 12 字以内，过长自动换行导致节点变高）
- x/y: 左上角坐标（可选）；仅 layout="none" 时坐标生效
- width/height: 可选，省略用图形默认尺寸；文字多时适当加宽（每汉字约 14px）
- zIndex: 可选层级；普通节点默认 1，容器/分组框（container）设为 0 垫底，成员节点放在其坐标范围内
- UML 类节点额外字段: className（类名）、attributes（属性区文本，每行一个属性）、methods（方法区文本，每行一个方法）。
  成员行格式为 "可见性 名称: 类型"（属性）/ "可见性 名称(参数: 类型): 返回类型"（方法），
  可见性符号必须使用 UML 标准记号：+ 公有(public) / - 私有(private) / # 保护(protected) / ~ 包内(package)，例如 "- id: string"、"+ save(): void"
- 思维导图(kind=mindmap)不用 shape，用 parentId 表达父子层级（根主题省略 parentId）

【三、连接点 ports（画标准图的关键！）】
X6 中边与节点的连接方式：边端点写 { cell, port } 挂到"连接桩"上。每个图形自带 4 个固定连接桩，位于上/右/下/左边缘的中点。
如果不指定 port，边的锚点默认取节点"中心"，线条会指向节点中心、穿过节点边框，图形非常不标准——所以主流程边务必指定端口。
通过 sourcePort / targetPort 指定方位，取值只能是 top / right / bottom / left。未指定时按两节点相对位置自动推断。选择惯例：
- 自上而下主流程（默认 direction="TB"）：sourcePort="bottom"、targetPort="top"
- 自左向右流程（direction="LR"）：sourcePort="right"、targetPort="left"
- 判断分支（decision）向两侧分出：sourcePort="bottom" 或 "left"/"right"
- 回退/异常分支回到上方节点：sourcePort="left"、targetPort="left" 或 "top"，并用 vertices 让边绕行避开中间节点
例外：时序图（draw-seq-actor 参与者之间的消息）自动挂到生命线锚点，无需也不应指定 ports。

【四、边 edges】每条边对象：
- source / target: 起点/终点节点 ID（必填，不得自环）
- sourcePort / targetPort: 连接点方位 top/right/bottom/left（可选，推荐显式指定主流程方向）
- style: 连线样式（见目录，省略按图类型自动选择）
- label: 连线标签（建议 8 字以内），如判断分支的 "是"/"否"、ER 图基数 "1"/"N"
- labelPosition: 标签在边上的位置比例，默认 0.5（边中点居中），一般无需指定。仅当标签与交叉边/节点重叠时微调（建议 0.3~0.7），不要设为 0 或 1（会贴到节点上）
- vertices: 路径点数组 [{x, y}]（画布绝对坐标，边按顺序经过，最多 10 个）。用于精确控制走向：如回退边绕行、让长边避开中间节点。注意 router 会在此基础上加工（manhattan 自动拐直角并避开障碍节点），一般无需指定

【五、shape 图形目录（按图类型选用）】
- 通用: rect 矩形, rounded 圆角矩形, circle 圆, ellipse 椭圆, diamond 菱形, triangle 三角形, parallelogram 平行四边形, hexagon 六边形, star 星形, cloud 云, cylinder 圆柱(数据库), document 文档, sticky 便签, text 纯文本, container 容器/分组框
- 流程图: terminator 开始/结束(圆角胶囊), process 处理步骤, decision 判断(菱形), data 输入/输出数据, preparation 准备, delay 延迟, display 显示, manual 手工输入, connector 页面连接点
- ER 图: entity 实体, weakentity 弱实体, attribute 属性(椭圆), key 主键(下划线), relation 联系(菱形)
- UML: class 类, interface 接口, actor 角色, usecase 用例, package 包, component 组件
- 架构图: client 客户端, server 服务(service/api), gateway 网关, queue 消息队列, cache 缓存, database 数据库(db), cloud 云
- 数据流图: external 外部实体, dfd-process 加工, datastore 数据存储
- 时序图: actor 参与者（自带生命线，横向排列）
- 时间线: event 事件, milestone 里程碑

【六、边样式 style 目录】（每种样式已封装 X6 的 router 路由 + connector 连接器 + 箭头）
- manhattan: 直角折线+箭头，智能路由自动避开路径上的节点（默认，流程图/架构图首选）
- orthogonal: 直角折线+箭头（不自动避障，走向更规整）
- arrow: 直线+箭头（UML 关联）/ doubleArrow: 直线双向箭头 / dashed: 虚线+箭头（通用虚线，UML 请改用下行的专用关系线）
- curve: 平滑曲线（贝塞尔）/ straight: 无箭头直线 / er: Z 字折线（ER 图专用）
- UML 类图关系线（按 UML 规范封装端点符号）: inheritance 实线+空心三角（继承）/ realization 虚线+空心三角（实现）/ dependency 虚线+开放箭头（依赖）/ composition 实线+实心菱形（组合，菱形在 source 端）/ aggregation 实线+空心菱形（聚合，菱形在 source 端）
- message: 时序消息（实线）/ returnMessage: 时序返回（虚线）/ dataflow: 数据流（直角折线）

【七、布局参数】
- layout: "layered" 自动分层（默认，按边的先后层级排列）/ "grid" 网格（适合无边的并列节点）/ "none" 使用节点 x/y 坐标
- direction: "TB" 自上而下（默认，流程图/架构图标准方向）/ "LR" 自左向右（ER 图标准方向）。仅 layered 布局有效
- layout="none" 时的间距建议：上下层行距 ≥ 140（同列节点垂直间隔 ≥ 100），左右列距 ≥ 200，保证折线有拐弯空间

【八、各图类型规范】
- 流程图: 开始/结束用 terminator，步骤用 process，判断用 decision 且两条出边分别加 label "是"/"否"；每个判断的两个分支节点左右错开
- ER 图: 实体-relation 菱形-实体交替横向排列，边 style="er" 且两端加基数标签（"1"/"N"）；属性节点放在所挂实体的上方或下方
- UML 类图（必须严格按标准符号画，勿用通用 arrow/dashed 代替专用关系线）:
  * 节点: 类用 shape="class"，className 填类名；attributes/methods 每行一个成员，必须带 UML 可见性记号（+/-/#/~），如 "- id: string"、"+ save(): void"；接口用 shape="interface"（className 写 "«interface» 名称"）
  * 泛化/继承（"is-a" 关系）: style="inheritance"（实线+空心三角），子类作 source、父类作 target，空心三角自动指向父类
  * 实现（类实现接口）: style="realization"（虚线+空心三角），实现类作 source、接口作 target
  * 组合（强拥有，整体销毁则部分随之销毁，如 房间↔墙）: style="composition"（实线+实心菱形），整体作 source、部分作 target，实心菱形自动落在整体端
  * 聚合（弱拥有，部分可独立存在，如 部门↔员工）: style="aggregation"（实线+空心菱形），整体作 source、部分作 target
  * 依赖（临时使用关系，如方法参数引用）: style="dependency"（虚线+开放箭头），使用方作 source、被使用方作 target
  * 关联（长期持有引用）: style="arrow"（带导航箭头）或 "straight"；如需多重性用 edge label 写 "1"/"0..1"/"*"/"1..*"，并用 labelPosition 移到对应一端（0.12 靠 source、0.88 靠 target；每条边仅支持一个标签）
  * 布局: 父类/接口在上、子类/实现类在下呈扇形展开；成员行数多时用 height 加大类框（默认 148，每多一行约 +20px）
- 时序图: 参与者横向排列，消息按时间从上到下依次排列，调用 style="message"、返回 style="returnMessage"
- 架构图: 自上而下分层（客户端→网关→服务→数据/缓存），用对应架构图形而非通用矩形；同层服务用 container 分组

【九、最佳实践】
- id 用语义化英文名（如 start/review/notify），便于 update_drawing 增量修改时引用
- 标签文本精炼（节点 ≤ 12 字、边标签 ≤ 8 字），标签过长会互相遮挡
- 复杂图（>15 节点）拆成主流程+子流程（用 connector 节点引用），不要一图塞满
- 画完自检：主流程是否 TB/LR 方向一致、边是否都从边缘连接点进出、判断分支是否左右错开`

const createNodeSchema = z.object({
  id: z.string().optional().describe('节点 ID（可选，省略则自动生成；后续连线时用它引用）'),
  shape: z.string().optional().describe('图形名称，如 process/decision/terminator/database/entity/class/actor 等，省略默认为 rect'),
  label: z.string().optional().describe('节点显示文本（建议 12 字以内，过长会自动换行）'),
  x: z.number().optional().describe('横坐标，即节点左上角 x（可选，自动布局时省略）'),
  y: z.number().optional().describe('纵坐标，即节点左上角 y（可选，自动布局时省略）'),
  width: z.number().optional().describe('宽度（可选，使用默认尺寸则省略）'),
  height: z.number().optional().describe('高度（可选，使用默认尺寸则省略）'),
  zIndex: z.number().int().min(0).max(10).optional().describe('层级（可选）：普通节点默认 1，容器/分组框设为 0 放在成员节点下方'),
  parentId: z.string().optional().describe('仅 mindmap 类型：父节点 ID，根主题省略此字段'),
  className: z.string().optional().describe('仅 UML 类图节点：类名'),
  attributes: z.string().optional().describe('仅 UML 类图节点：属性列表，每行一个，格式 "可见性 名称: 类型"（+ 公有 / - 私有 / # 保护），如 "- id: string"'),
  methods: z.string().optional().describe('仅 UML 类图节点：方法列表，每行一个，格式 "可见性 名称(参数): 返回类型"，如 "+ save(): void"')
})

const createEdgeSchema = z.object({
  source: z.string().describe('起点节点 ID'),
  target: z.string().describe('终点节点 ID'),
  sourcePort: z.enum(['top', 'right', 'bottom', 'left']).optional().describe('起点连接点方位（图形四边中点各有一个连接点；自上而下主流程用 bottom，水平流程用 right；省略则自动按节点相对位置推断）'),
  targetPort: z.enum(['top', 'right', 'bottom', 'left']).optional().describe('终点连接点方位（自上而下主流程用 top，水平流程用 left；省略则自动推断）'),
  style: z.string().optional().describe('连线样式：UML 类图关系线用 inheritance 继承/realization 实现/dependency 依赖/composition 组合/aggregation 聚合；通用样式有 manhattan/arrow/dashed/curve/straight/er/message/returnMessage/dataflow，省略按图类型自动选择'),
  label: z.string().optional().describe('连线标签（建议 8 字以内），如判断分支 "是"/"否"、ER 基数 "1"/"N"'),
  labelPosition: z.number().min(0).max(1).optional().describe('标签在边上的位置比例：默认 0.5 即边中点，一般无需指定；仅当标签与其他元素重叠时微调（建议 0.3~0.7）'),
  vertices: z.array(z.object({ x: z.number(), y: z.number() })).max(10).optional().describe('路径点（画布绝对坐标，边按顺序经过）：用于精确控制边走向，如回退边绕行避开中间节点；manhattan 路由会自动避障，一般无需指定')
})

const createDrawingSchema = z.object({
  title: z.string().trim().min(1).max(60).describe('画布标题'),
  kind: z.enum(KINDS).optional().describe('图类型：flowchart 流程图 / mindmap 思维导图 / er ER图 / architecture 架构图 / uml 类图 / sequence 时序图 / timeline 时间线 / dfd 数据流图 / kanban 看板 / blank 通用，默认 blank'),
  nodes: z.array(createNodeSchema).describe('节点列表'),
  edges: z.array(createEdgeSchema).optional().describe('连线列表（可选）'),
  layout: z.enum(['layered', 'grid', 'none']).optional().describe('自动布局：layered 分层布局（默认）/ grid 网格布局 / none 使用给定坐标。mindmap 类型自动树布局，无需指定'),
  direction: z.enum(['TB', 'LR']).optional().describe('布局方向：TB 自上而下（默认，流程图/架构图标准）/ LR 自左向右（ER 图标准）。仅 layered 布局有效')
})

async function createDrawingHandler(args, ctx) {
  const { title, kind = 'blank', nodes: rawNodes, edges: rawEdges, layout = 'layered', direction } = args
  ctx.logger.info(`[create_drawing] title="${title}", kind=${kind}`)

  const finalDirection = direction || KIND_DEFAULT_DIRECTION[kind] || 'TB'
  const defaultEdgeStyle = KIND_DEFAULT_EDGE[kind] || 'manhattan'
  const usedIds = new Set()
  const nodes = validateNodesInput(rawNodes, kind, usedIds)
  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges = validateEdgesInput(rawEdges, nodeIds, defaultEdgeStyle, usedIds)

  // mindmap 的 parentId 引用校验
  if (kind === 'mindmap') {
    nodes.forEach((node) => {
      if (node.parentId && !nodeIds.has(node.parentId)) {
        throw new Error(`节点 "${node.id}" 的 parentId "${node.parentId}" 不存在于 nodes 中`)
      }
    })
  }

  const graphJSON = buildGraphJSON(nodes, edges, kind, layout, finalDirection, usedIds)
  const now = new Date().toISOString()

  const { saveDrawingCanvas } = await getDb()
  const canvas = saveDrawingCanvas({
    id: genId('canvas'),
    title,
    titleKey: '',
    kind,
    categoryId: null,
    graphJSON,
    createdAt: now,
    updatedAt: now
  })

  notifyCanvasUpdated(ctx, canvas)
  const edgeCount = graphJSON.cells.filter((cell) => isEdgeCell(cell)).length
  return `已创建画布: id=${canvas.id}, title="${title}", 类型=${kind}, 节点=${nodes.length} 个, 连线=${edgeCount} 条。该画布已自动在绘图界面打开。`
}

registerTool({
  name: 'create_drawing',
  description: `创建一个新的绘图画布（流程图/思维导图/ER图/架构图/UML类图/时序图等）。只需提供节点和连线的语义结构（形状、标签、连接关系、连接点），坐标可省略并由自动布局计算。mindmap 类型通过 parentId 或 edges 表达父子层级。

${DRAWING_SYNTAX_GUIDE}`,
  schema: createDrawingSchema,
  handler: createDrawingHandler,
  meta: { requireApproval: true, exposedViaMcp: false } // 写操作需审批
})

// ========== 工具：update_drawing ==========

const updateOpSchema = z.object({
  op: z.enum(['add_node', 'update_node', 'delete_node', 'connect', 'update_edge', 'delete_edge', 'move_node', 'resize_node']).describe('操作类型'),
  id: z.string().optional().describe('节点/连线 ID。update_node/delete_node/update_edge/delete_edge/move_node/resize_node 必填；add_node 可选，指定后可在同一批 connect 中引用'),
  shape: z.string().optional().describe('add_node：图形名称'),
  label: z.string().optional().describe('节点或连线的显示文本'),
  source: z.string().optional().describe('connect：起点节点 ID'),
  target: z.string().optional().describe('connect：终点节点 ID'),
  sourcePort: z.enum(['top', 'right', 'bottom', 'left']).optional().describe('connect：起点连接点方位（图形四边中点各一个连接点；自上而下流程用 bottom，水平流程用 right；省略则按节点相对位置自动推断）'),
  targetPort: z.enum(['top', 'right', 'bottom', 'left']).optional().describe('connect：终点连接点方位（自上而下流程用 top，水平流程用 left；省略则自动推断）'),
  style: z.string().optional().describe('connect/update_edge：连线样式'),
  labelPosition: z.number().min(0).max(1).optional().describe('connect/update_edge：标签在边上的位置比例（默认 0.5 边中点，一般无需指定；仅重叠时微调 0.3~0.7）'),
  vertices: z.array(z.object({ x: z.number(), y: z.number() })).max(10).optional().describe('connect/update_edge：路径点（画布绝对坐标，边按顺序经过），用于精确控制边走向如回退边绕行'),
  x: z.number().optional().describe('move_node/add_node：横坐标'),
  y: z.number().optional().describe('move_node/add_node：纵坐标'),
  width: z.number().optional().describe('resize_node/add_node：宽度'),
  height: z.number().optional().describe('resize_node/add_node：高度'),
  zIndex: z.number().int().min(0).max(10).optional().describe('add_node：层级，普通节点默认 1，容器/分组框设为 0'),
  parentId: z.string().optional().describe('add_node（mindmap 画布）：父节点 ID'),
  className: z.string().optional().describe('add_node/update_node（UML 类节点）：类名，省略时用 label'),
  attributes: z.string().max(1000).optional().describe('add_node/update_node（UML 类节点）：属性列表文本，每行一个，须带可见性记号，如 "- id: string"'),
  methods: z.string().max(1000).optional().describe('add_node/update_node（UML 类节点）：方法列表文本，每行一个，须带可见性记号，如 "+ save(): void"')
})

const updateDrawingSchema = z.object({
  canvasId: z.string().describe('要修改的画布 ID'),
  title: z.string().trim().min(1).max(60).optional().describe('重命名画布标题（可选）'),
  operations: z.array(updateOpSchema).min(1).max(MAX_OPS).describe(`操作列表，最多 ${MAX_OPS} 个，所有操作校验通过后一次性提交`)
})

function findEdgeCell(cells, edgeId) {
  return cells.find((cell) => isEdgeCell(cell) && cell.id === edgeId)
}

function findNodeCell(cells, nodeId) {
  return cells.find((cell) => !isEdgeCell(cell) && cell.id === nodeId)
}

function setEdgeLabel(cell, label, labelPosition) {
  const text = label !== undefined ? cleanLabel(label) : (cell.labels?.[0]?.attrs?.label?.text || '')
  if (!text) {
    delete cell.labels
    return
  }
  const current = cell.labels?.[0] || {}
  const position = sanitizeLabelPosition(labelPosition) ?? current.position ?? 0.5
  cell.labels = [{
    ...current,
    position,
    attrs: {
      ...current.attrs,
      label: { ...current.attrs?.label, text, fontSize: current.attrs?.label?.fontSize || 11 }
    }
  }]
}

function setEdgeVertices(cell, vertices) {
  const points = sanitizeVertices(vertices)
  if (points) cell.vertices = points
  else delete cell.vertices
}

function setEdgeStyle(cell, style) {
  const styleId = normalizeEdgeStyle(style, cell.data?.edgeStyle || 'manhattan')
  const def = EDGE_STYLE_DEFS[styleId]
  cell.router = def.router
  cell.connector = def.connector
  cell.attrs = { ...cell.attrs, line: { ...def.line } }
  cell.data = { ...(cell.data || {}), edgeStyle: styleId }
}

async function updateDrawingHandler(args, ctx) {
  const { canvasId, title, operations } = args
  ctx.logger.info(`[update_drawing] canvasId=${canvasId}, ops=${operations.length}`)

  const { getDrawingCanvas, saveDrawingCanvas } = await getDb()
  const canvas = getDrawingCanvas(canvasId)
  if (!canvas) {
    return `未找到画布: ${canvasId}`
  }

  // 深拷贝，校验失败时不写入任何结果（整体提交）
  const cells = JSON.parse(JSON.stringify(canvas.graphJSON?.cells || []))
  const isMindCanvas = canvas.kind === 'mindmap'
  const defaultEdgeStyle = KIND_DEFAULT_EDGE[canvas.kind] || 'manhattan'
  const summary = { add_node: 0, update_node: 0, delete_node: 0, connect: 0, update_edge: 0, delete_edge: 0, move_node: 0, resize_node: 0 }

  // ---------- 第一步：校验所有操作 ----------
  const usedIds = new Set(cells.map((cell) => cell.id))
  const addedNodeIds = new Set() // 同批 add_node 的新增节点，后续操作可以引用
  const nodeExists = (id) => Boolean(findNodeCell(cells, id)) || addedNodeIds.has(id)
  const prepared = operations.map((op, index) => {
    const fail = (msg) => { throw new Error(`operations[${index}] (${op.op}): ${msg}`) }
    switch (op.op) {
      case 'add_node': {
        const shape = normalizeShape(op.shape, isMindCanvas ? 'topic-child' : 'draw-rect')
        if (op.parentId && !nodeExists(op.parentId)) {
          fail(`parentId "${op.parentId}" 不存在`)
        }
        let id = null
        if (typeof op.id === 'string' && op.id.trim()) {
          id = op.id.trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40)
          if (usedIds.has(id)) fail(`节点 ID "${id}" 已存在`)
          usedIds.add(id)
        }
        const finalId = id || genId('n')
        usedIds.add(finalId)
        addedNodeIds.add(finalId)
        return { ...op, _shape: shape, _label: cleanLabel(op.label), _id: finalId }
      }
      case 'update_node': {
        const cell = findNodeCell(cells, op.id)
        if (!cell) fail(`节点 "${op.id}" 不存在`)
        return { ...op, _cell: cell, _label: op.label !== undefined ? cleanLabel(op.label) : undefined }
      }
      case 'delete_node': {
        const cell = findNodeCell(cells, op.id)
        if (!cell) fail(`节点 "${op.id}" 不存在`)
        return { ...op, _cell: cell }
      }
      case 'connect': {
        const source = typeof op.source === 'string' ? op.source.trim() : ''
        const target = typeof op.target === 'string' ? op.target.trim() : ''
        if (!nodeExists(source)) fail(`source 节点 "${source}" 不存在`)
        if (!nodeExists(target)) fail(`target 节点 "${target}" 不存在`)
        if (source === target) fail('不允许自环')
        return { ...op, _source: source, _target: target }
      }
      case 'update_edge': {
        const cell = findEdgeCell(cells, op.id)
        if (!cell) fail(`连线 "${op.id}" 不存在`)
        return { ...op, _cell: cell }
      }
      case 'delete_edge': {
        const cell = findEdgeCell(cells, op.id)
        if (!cell) fail(`连线 "${op.id}" 不存在`)
        return { ...op, _cell: cell }
      }
      case 'move_node': {
        const cell = findNodeCell(cells, op.id)
        if (!cell) fail(`节点 "${op.id}" 不存在`)
        if (op.x === undefined && op.y === undefined) fail('x 和 y 至少提供一个')
        return { ...op, _cell: cell }
      }
      case 'resize_node': {
        const cell = findNodeCell(cells, op.id)
        if (!cell) fail(`节点 "${op.id}" 不存在`)
        if (op.width === undefined && op.height === undefined) fail('width 和 height 至少提供一个')
        return { ...op, _cell: cell }
      }
      default:
        fail('不支持的操作类型')
        return null
    }
  })

  // ---------- 第二步：应用所有操作 ----------
  const createdNodes = []
  prepared.forEach((op) => {
    switch (op.op) {
      case 'add_node': {
        const id = op._id || genId('n')
        let cell
        if (isMindCanvas) {
          const parentCell = op.parentId ? findNodeCell(cells, op.parentId) : null
          const parentMind = parentCell?.data?.mind
          const type = !parentCell
            ? (cells.some((c) => !isEdgeCell(c)) ? 'topic-branch' : 'topic')
            : isMindCell(parentCell) && !parentMind?.parentId ? 'topic-branch' : 'topic-child'
          const treeId = parentMind?.treeId || genId('mt')
          const [width, height] = MIND_SIZES[type]
          cell = {
            id,
            shape: type === 'topic-child' ? 'topic-child' : 'topic',
            x: 0,
            y: 0,
            width,
            height,
            label: op._label,
            markup: MIND_MARKUP,
            zIndex: 1,
            data: {
              catalogId: type === 'topic' ? 'mindRoot' : type === 'topic-branch' ? 'mindTopic' : 'mindSub',
              mind: {
                treeId,
                parentId: parentCell ? parentCell.id : null,
                type,
                side: 'right',
                order: 0
              }
            }
          }
          if (parentCell) {
            cells.push(buildMindEdgeCell({ id: genId('e'), source: parentCell.id, target: id, treeId }))
          }
        } else {
          const data = {}
          if (op._shape === 'draw-uml-class') {
            data.className = op.className || op._label || 'Class'
            if (typeof op.attributes === 'string' && op.attributes.trim()) data.attributes = op.attributes.slice(0, 1000)
            if (typeof op.methods === 'string' && op.methods.trim()) data.methods = op.methods.slice(0, 1000)
          }
          cell = buildNodeCell({ id, shape: op._shape, x: op.x, y: op.y, width: op.width, height: op.height, label: op._label, data, zIndex: op.zIndex })
        }
        cells.push(cell)
        createdNodes.push(`${op._label || id}(${id})`)
        summary.add_node++
        break
      }
      case 'update_node': {
        const cell = op._cell
        if (op._label !== undefined) {
          cell.label = op._label
          if (cell.attrs?.label) cell.attrs.label.text = op._label
        }
        if (cell.shape === 'draw-uml-class') {
          const nextData = { ...(cell.data || {}) }
          if (op._label !== undefined) nextData.className = op._label
          if (op.className !== undefined) nextData.className = op.className
          if (op.attributes !== undefined) {
            const attrs = op.attributes.slice(0, 1000)
            if (attrs.trim()) nextData.attributes = attrs
            else delete nextData.attributes
          }
          if (op.methods !== undefined) {
            const methods = op.methods.slice(0, 1000)
            if (methods.trim()) nextData.methods = methods
            else delete nextData.methods
          }
          cell.data = nextData
        }
        if (isMindCell(cell) && op.parentId !== undefined) {
          cell.data.mind.parentId = op.parentId
        }
        const width = clampNumber(op.width, SIZE_MIN, SIZE_MAX)
        const height = clampNumber(op.height, SIZE_MIN, SIZE_MAX)
        if (width != null) cell.width = width
        if (height != null) cell.height = height
        summary.update_node++
        break
      }
      case 'delete_node': {
        // 同步删除关联连线
        for (let i = cells.length - 1; i >= 0; i--) {
          const cell = cells[i]
          if (isEdgeCell(cell) && (cell.source?.cell === op.id || cell.target?.cell === op.id)) {
            cells.splice(i, 1)
            summary.delete_edge++
          }
        }
        const index = cells.indexOf(op._cell)
        if (index >= 0) cells.splice(index, 1)
        summary.delete_node++
        break
      }
      case 'connect': {
        if (isMindCanvas) {
          const targetCell = findNodeCell(cells, op._target)
          const treeId = targetCell?.data?.mind?.treeId || findNodeCell(cells, op._source)?.data?.mind?.treeId || genId('mt')
          cells.push(buildMindEdgeCell({
            id: genId('e'),
            source: op._source,
            target: op._target,
            treeId,
            side: targetCell?.data?.mind?.side || 'right'
          }))
          if (targetCell && isMindCell(targetCell) && !targetCell.data.mind.parentId) {
            targetCell.data.mind.parentId = op._source
          }
        } else {
          const sourceNode = findNodeCell(cells, op._source)
          const targetNode = findNodeCell(cells, op._target)
          let seqPadding
          if (isSeqActorPair(sourceNode, targetNode)) {
            seqPadding = 80 + countSeqMessages(cells) * 55
          }
          cells.push(buildEdgeCell({
            id: genId('e'),
            source: op._source,
            target: op._target,
            style: op.style || defaultEdgeStyle,
            label: op.label,
            labelPosition: op.labelPosition,
            vertices: op.vertices,
            sourcePort: op.sourcePort,
            targetPort: op.targetPort,
            sourceNode,
            targetNode,
            seqPadding
          }))
        }
        summary.connect++
        break
      }
      case 'update_edge': {
        if (op.style !== undefined) setEdgeStyle(op._cell, op.style)
        if (op.label !== undefined || op.labelPosition !== undefined) {
          setEdgeLabel(op._cell, op.label, op.labelPosition)
        }
        if (op.vertices !== undefined) setEdgeVertices(op._cell, op.vertices)
        summary.update_edge++
        break
      }
      case 'delete_edge': {
        const index = cells.indexOf(op._cell)
        if (index >= 0) cells.splice(index, 1)
        summary.delete_edge++
        break
      }
      case 'move_node': {
        const x = clampNumber(op.x, COORD_MIN, COORD_MAX)
        const y = clampNumber(op.y, COORD_MIN, COORD_MAX)
        if (x != null) op._cell.x = x
        if (y != null) op._cell.y = y
        summary.move_node++
        break
      }
      case 'resize_node': {
        const width = clampNumber(op.width, SIZE_MIN, SIZE_MAX)
        const height = clampNumber(op.height, SIZE_MIN, SIZE_MAX)
        if (width != null) op._cell.width = width
        if (height != null) op._cell.height = height
        summary.resize_node++
        break
      }
      default:
        break
    }
  })

  const now = new Date().toISOString()
  const updated = saveDrawingCanvas({
    id: canvas.id,
    title: title !== undefined ? title : canvas.title,
    titleKey: title !== undefined ? '' : canvas.titleKey,
    kind: canvas.kind,
    categoryId: canvas.categoryId,
    graphJSON: { cells },
    createdAt: canvas.createdAt,
    updatedAt: now
  })

  notifyCanvasUpdated(ctx, updated)
  const parts = Object.entries(summary).filter(([, count]) => count > 0).map(([key, count]) => `${key}=${count}`)
  const createdInfo = createdNodes.length ? `\n新增节点: ${createdNodes.join(', ')}` : ''
  return `已修改画布 "${canvas.title || canvas.id}"（id=${canvas.id}）：${parts.join(', ')}${createdInfo}`
}

registerTool({
  name: 'update_drawing',
  description: '对已有画布执行增量修改操作（添加/更新/删除节点，连线，修改/删除连线，移动/调整节点）。操作列表会整体校验后一次性提交。先用 get_drawing_canvas 获取节点和连线的 ID。connect 连线时可用 sourcePort/targetPort 指定连接点方位（每个图形有 top/right/bottom/left 四个连接点；自上而下流程 bottom→top，水平流程 right→left；省略则按节点相对位置自动推断）。',
  schema: updateDrawingSchema,
  handler: updateDrawingHandler,
  meta: { requireApproval: true, exposedViaMcp: false } // 写操作需审批
})

// ========== 工具：layout_drawing ==========

const layoutDrawingSchema = z.object({
  canvasId: z.string().describe('画布 ID'),
  algorithm: z.enum(['layered', 'grid']).optional().describe('布局算法：layered 分层布局（适合流程图/架构图/ER图，默认）/ grid 网格布局'),
  direction: z.enum(['TB', 'LR']).optional().describe('分层布局方向：TB 自上而下（默认，流程图/架构图标准）/ LR 自左向右（ER 图标准）')
})

async function layoutDrawingHandler(args, ctx) {
  const { canvasId, algorithm = 'layered', direction = 'TB' } = args
  ctx.logger.info(`[layout_drawing] canvasId=${canvasId}, algorithm=${algorithm}, direction=${direction}`)

  const { getDrawingCanvas, saveDrawingCanvas } = await getDb()
  const canvas = getDrawingCanvas(canvasId)
  if (!canvas) {
    return `未找到画布: ${canvasId}`
  }
  if (canvas.kind === 'mindmap') {
    return `画布 "${canvas.title || canvas.id}" 是思维导图，打开时会自动进行树布局，无需手动布局。`
  }

  const cells = JSON.parse(JSON.stringify(canvas.graphJSON?.cells || []))
  const nodeCount = cells.filter((cell) => !isEdgeCell(cell) && !isMindCell(cell)).length
  if (!nodeCount) {
    return '画布中没有可布局的节点。'
  }

  if (algorithm === 'grid') layoutGrid(cells)
  else layoutLayered(cells, direction)

  // 重新布局后，按节点新的相对位置刷新边的连接点（保持图形标准）
  const nodeById = new Map(cells.filter((cell) => !isEdgeCell(cell)).map((cell) => [cell.id, cell]))
  cells.filter(isEdgeCell).forEach((edge) => {
    if (edge.shape === 'mindmap-edge') return
    const sourceNode = nodeById.get(edge.source?.cell)
    const targetNode = nodeById.get(edge.target?.cell)
    if (sourceNode?.shape === 'draw-seq-actor' && targetNode?.shape === 'draw-seq-actor') return
    if (sourceNode && targetNode) {
      edge.source = { cell: sourceNode.id, port: `port-${inferPortSide(sourceNode, targetNode)}` }
      edge.target = { cell: targetNode.id, port: `port-${inferPortSide(targetNode, sourceNode)}` }
    }
  })

  const updated = saveDrawingCanvas({
    id: canvas.id,
    title: canvas.title,
    titleKey: canvas.titleKey,
    kind: canvas.kind,
    categoryId: canvas.categoryId,
    graphJSON: { cells },
    createdAt: canvas.createdAt,
    updatedAt: new Date().toISOString()
  })

  notifyCanvasUpdated(ctx, updated)
  return `已对画布 "${canvas.title || canvas.id}"（id=${canvas.id}）重新布局：${algorithm}，共 ${nodeCount} 个节点。`
}

registerTool({
  name: 'layout_drawing',
  description: '对画布节点重新自动布局（并按新位置自动刷新边的连接点）。layered 为分层布局（按连线方向分层排列，适合流程图/架构图/ER图），grid 为网格布局；direction 指定分层方向 TB 自上而下（默认）/ LR 自左向右。思维导图无需调用（自动树布局）。',
  schema: layoutDrawingSchema,
  handler: layoutDrawingHandler,
  meta: { requireApproval: true, exposedViaMcp: false } // 修改画布需审批
})
