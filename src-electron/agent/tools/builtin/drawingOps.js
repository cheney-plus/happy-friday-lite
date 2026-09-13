/**
 * 内置工具：绘图操作（list_drawing_canvases / get_drawing_canvas / create_drawing / update_drawing / layout_drawing）
 * ====================================================================================================
 * 设计参考：绘图 Agent 设计文档.md
 *
 * Agent 运行在主进程，X6 Graph 运行在渲染进程，二者不能共享 Graph 实例。
 * 因此本文件直接生成/修改合法的 graphJSON 并通过 db.saveDrawingCanvas 持久化到 SQLite，
 * 再通过 drawing-updated IPC 事件通知前端刷新（前端 drawing store 拉取最新数据并重载编辑器）。
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
  flow: 'dataflow'
}

// 默认连线风格：按图类型选择
const KIND_DEFAULT_EDGE = {
  er: 'er',
  dfd: 'dataflow',
  sequence: 'message',
  uml: 'arrow'
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

function buildEdgeCell({ id, source, target, style, label }) {
  const styleId = normalizeEdgeStyle(style)
  const def = EDGE_STYLE_DEFS[styleId]
  const cell = {
    id,
    shape: 'edge',
    source: { cell: source },
    target: { cell: target },
    router: def.router,
    connector: def.connector,
    attrs: { line: { ...def.line } },
    data: { edgeStyle: styleId },
    zIndex: 0
  }
  if (label) {
    cell.labels = [{ attrs: { label: { text: label, fontSize: 11 } } }]
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

function layoutLayered(cells) {
  const nodes = cells.filter((cell) => !isEdgeCell(cell) && !isMindCell(cell))
  if (!nodes.length) return
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const preds = new Map(nodes.map((node) => [node.id, []]))
  const succs = new Map(nodes.map((node) => [node.id, []]))
  cells.forEach((cell) => {
    if (!isEdgeCell(cell)) return
    const src = cell.source?.cell
    const tgt = cell.target?.cell
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
      label: cleanLabel(edge.label)
    }
  })
}

function applyLayout(cells, layout, kind) {
  if (kind === 'mindmap') return // 前端加载时会自动对 mind 树布局
  if (layout === 'grid') layoutGrid(cells)
  else if (layout === 'layered') layoutLayered(cells)
  // layout === 'none'：尊重模型提供的坐标
}

function buildGraphJSON(nodes, edges, kind, layout, usedIds) {
  let cells
  if (kind === 'mindmap') {
    cells = buildMindmapCells(nodes, edges, usedIds)
  } else {
    cells = [
      ...nodes.map((node) => {
        const data = {}
        if (node.shape === 'draw-uml-class') {
          data.className = node.className || node.label
          if (node.attributes) data.attributes = node.attributes
          if (node.methods) data.methods = node.methods
        }
        return buildNodeCell({ ...node, data })
      }),
      ...edges.map((edge) => buildEdgeCell(edge))
    ]
    applyLayout(cells, layout, kind)
  }
  return { cells }
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
      return `- ${edge.id}: ${edge.source?.cell} -> ${edge.target?.cell}（样式: ${style}${label ? `，标签: ${label}` : ''}）`
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

const createNodeSchema = z.object({
  id: z.string().optional().describe('节点 ID（可选，省略则自动生成；后续连线时用它引用）'),
  shape: z.string().optional().describe('图形名称，如 process/decision/terminator/database/entity/class/actor 等，省略默认为 rect'),
  label: z.string().optional().describe('节点显示文本'),
  x: z.number().optional().describe('横坐标（可选，自动布局时省略）'),
  y: z.number().optional().describe('纵坐标（可选，自动布局时省略）'),
  width: z.number().optional().describe('宽度（可选，使用默认尺寸则省略）'),
  height: z.number().optional().describe('高度（可选，使用默认尺寸则省略）'),
  parentId: z.string().optional().describe('仅 mindmap 类型：父节点 ID，根主题省略此字段'),
  className: z.string().optional().describe('仅 UML 类图节点：类名'),
  attributes: z.string().optional().describe('仅 UML 类图节点：属性列表，每行一个，如 "+ id: string"'),
  methods: z.string().optional().describe('仅 UML 类图节点：方法列表，每行一个，如 "+ save(): void"')
})

const createEdgeSchema = z.object({
  source: z.string().describe('起点节点 ID'),
  target: z.string().describe('终点节点 ID'),
  style: z.string().optional().describe('连线样式：manhattan/arrow/dashed/curve/straight/er/dataflow/message 等，省略按图类型自动选择'),
  label: z.string().optional().describe('连线标签')
})

const createDrawingSchema = z.object({
  title: z.string().trim().min(1).max(60).describe('画布标题'),
  kind: z.enum(KINDS).optional().describe('图类型：flowchart 流程图 / mindmap 思维导图 / er ER图 / architecture 架构图 / uml 类图 / sequence 时序图 / timeline 时间线 / dfd 数据流图 / kanban 看板 / blank 通用，默认 blank'),
  nodes: z.array(createNodeSchema).describe('节点列表'),
  edges: z.array(createEdgeSchema).optional().describe('连线列表（可选）'),
  layout: z.enum(['layered', 'grid', 'none']).optional().describe('自动布局：layered 分层布局（默认）/ grid 网格布局 / none 使用给定坐标。mindmap 类型自动树布局，无需指定')
})

async function createDrawingHandler(args, ctx) {
  const { title, kind = 'blank', nodes: rawNodes, edges: rawEdges, layout = 'layered' } = args
  ctx.logger.info(`[create_drawing] title="${title}", kind=${kind}`)

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

  const graphJSON = buildGraphJSON(nodes, edges, kind, layout, usedIds)
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
  description: '创建一个新的绘图画布（流程图/思维导图/ER图/架构图/UML类图/时序图等）。只需提供节点和连线的语义结构（形状、标签、连接关系），坐标可省略并由自动布局计算。mindmap 类型通过 parentId 或 edges 表达父子层级。',
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
  style: z.string().optional().describe('connect/update_edge：连线样式'),
  x: z.number().optional().describe('move_node/add_node：横坐标'),
  y: z.number().optional().describe('move_node/add_node：纵坐标'),
  width: z.number().optional().describe('resize_node/add_node：宽度'),
  height: z.number().optional().describe('resize_node/add_node：高度'),
  parentId: z.string().optional().describe('add_node（mindmap 画布）：父节点 ID')
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

function setEdgeLabel(cell, label) {
  const text = cleanLabel(label)
  if (!text) {
    delete cell.labels
    return
  }
  const current = cell.labels?.[0] || {}
  cell.labels = [{
    ...current,
    position: current.position ?? 0.5,
    attrs: {
      ...current.attrs,
      label: { ...current.attrs?.label, text, fontSize: current.attrs?.label?.fontSize || 11 }
    }
  }]
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
            data.className = op._label || 'Class'
          }
          cell = buildNodeCell({ id, shape: op._shape, x: op.x, y: op.y, width: op.width, height: op.height, label: op._label, data })
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
          if (cell.shape === 'draw-uml-class') {
            cell.data = { ...(cell.data || {}), className: op._label }
          }
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
          cells.push(buildEdgeCell({
            id: genId('e'),
            source: op._source,
            target: op._target,
            style: op.style || defaultEdgeStyle,
            label: op.label
          }))
        }
        summary.connect++
        break
      }
      case 'update_edge': {
        if (op.style !== undefined) setEdgeStyle(op._cell, op.style)
        if (op.label !== undefined) setEdgeLabel(op._cell, op.label)
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
  description: '对已有画布执行增量修改操作（添加/更新/删除节点，连线，修改/删除连线，移动/调整节点）。操作列表会整体校验后一次性提交。先用 get_drawing_canvas 获取节点和连线的 ID。',
  schema: updateDrawingSchema,
  handler: updateDrawingHandler,
  meta: { requireApproval: true, exposedViaMcp: false } // 写操作需审批
})

// ========== 工具：layout_drawing ==========

const layoutDrawingSchema = z.object({
  canvasId: z.string().describe('画布 ID'),
  algorithm: z.enum(['layered', 'grid']).optional().describe('布局算法：layered 分层布局（适合流程图/架构图/ER图，默认）/ grid 网格布局')
})

async function layoutDrawingHandler(args, ctx) {
  const { canvasId, algorithm = 'layered' } = args
  ctx.logger.info(`[layout_drawing] canvasId=${canvasId}, algorithm=${algorithm}`)

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
  else layoutLayered(cells)

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
  description: '对画布节点重新自动布局。layered 为分层布局（按连线方向分层排列，适合流程图/架构图/ER图），grid 为网格布局。思维导图无需调用（自动树布局）。',
  schema: layoutDrawingSchema,
  handler: layoutDrawingHandler,
  meta: { requireApproval: true, exposedViaMcp: false } // 修改画布需审批
})
