import { mindmap as hierarchyMindmap } from '@antv/hierarchy'
import { Graph, Path } from '@antv/x6'
import { uid } from './id.js'
import { getCanvasTheme } from './theme.js'

const MIND_SHAPES = new Set(['topic', 'topic-child'])
const TYPE_BY_SHAPE = {
  topic: 'topic',
  'topic-child': 'topic-child'
}
const TYPE_BY_CATALOG = {
  mindRoot: 'topic',
  mindTopic: 'topic-branch',
  mindSub: 'topic-child'
}
const SHAPE_BY_TYPE = {
  topic: 'topic',
  'topic-branch': 'topic',
  'topic-child': 'topic-child'
}
const SIZE_BY_TYPE = {
  topic: { width: 160, height: 50 },
  'topic-branch': { width: 120, height: 40 },
  'topic-child': { width: 100, height: 34 }
}
const MIND_MARKUP = [
  { tagName: 'rect', selector: 'body' },
  { tagName: 'rect', selector: 'line' },
  { tagName: 'text', selector: 'label' },
  { tagName: 'circle', selector: 'add' },
  { tagName: 'text', selector: 'addPlus' },
  { tagName: 'circle', selector: 'collapseBadge' },
  { tagName: 'text', selector: 'collapseCount' }
]

let registered = false
let layoutLock = false

function isMindShape(shape) {
  return MIND_SHAPES.has(shape)
}

export function isMindNode(cell) {
  return Boolean(cell?.isNode?.() && (cell.getData()?.mind || isMindShape(cell.shape)))
}

function sideAnchor(side = 'right', offset = 10) {
  const goingLeft = side === 'left'
  return {
    refX: goingLeft ? '0%' : '100%',
    refX2: goingLeft ? -offset : offset,
    refY: '50%'
  }
}

function addControlAttrs(side = 'right', hidden = false) {
  const display = hidden ? 'none' : 'block'
  return {
    add: {
      r: 7,
      fill: '#5F95FF',
      stroke: '#ffffff',
      strokeWidth: 1,
      ...sideAnchor(side, 10),
      event: 'add:topic',
      cursor: 'pointer',
      magnet: false,
      display
    },
    addPlus: {
      text: '+',
      fontSize: 12,
      fontWeight: 700,
      fill: '#ffffff',
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      ...sideAnchor(side, 10),
      pointerEvents: 'none',
      display
    }
  }
}

function collapseHintAttrs(side = 'right', count = 0) {
  const show = count > 0
  const display = show ? 'block' : 'none'
  const label = count > 99 ? '99+' : String(count)
  const wide = count > 9
  return {
    collapseBadge: {
      r: wide ? 14 : 12,
      fill: '#2563eb',
      stroke: '#ffffff',
      strokeWidth: 1.5,
      ...sideAnchor(side, wide ? 18 : 16),
      event: 'expand:topic',
      cursor: 'pointer',
      magnet: false,
      display
    },
    collapseCount: {
      text: show ? label : '',
      fontSize: wide ? 11 : 12,
      fontWeight: 700,
      fill: '#ffffff',
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      ...sideAnchor(side, wide ? 18 : 16),
      pointerEvents: 'none',
      display
    }
  }
}

function mindMarkupAttrs() {
  return {
    body: {
      rx: 6,
      ry: 6,
      stroke: '#5F95FF',
      fill: '#EFF4FF',
      strokeWidth: 1
    },
    line: {
      refWidth: '100%',
      refY: '100%',
      height: 0,
      fill: 'transparent',
      stroke: 'none'
    },
    label: {
      fontSize: 14,
      fill: '#262626',
      textVerticalAnchor: 'middle',
      refY: '50%'
    },
    ...addControlAttrs('right'),
    ...collapseHintAttrs('right', 0)
  }
}

export function registerMindmap() {
  if (registered) return
  registered = true

  Graph.registerConnector(
    'mindmap',
    (sourcePoint, targetPoint, _routerPoints, options) => {
      const goingRight = targetPoint.x >= sourcePoint.x
      const midX = sourcePoint.x + (goingRight ? 12 : -12)
      const midY = sourcePoint.y
      const ctrX = (targetPoint.x - midX) / 5 + midX
      const ctrY = targetPoint.y
      const pathData = `M ${sourcePoint.x} ${sourcePoint.y} L ${midX} ${midY} Q ${ctrX} ${ctrY} ${targetPoint.x} ${targetPoint.y}`
      return options.raw && Path.parse ? Path.parse(pathData) : pathData
    },
    true
  )

  Graph.registerEdge(
    'mindmap-edge',
    {
      inherit: 'edge',
      router: { name: 'normal' },
      connector: { name: 'mindmap' },
      attrs: {
        line: {
          stroke: '#A2B1C3',
          strokeWidth: 2,
          targetMarker: '',
          sourceMarker: ''
        }
      },
      zIndex: 0
    },
    true
  )

  const shared = {
    inherit: 'rect',
    markup: MIND_MARKUP,
    attrs: mindMarkupAttrs()
  }

  Graph.registerNode('topic', { ...shared, width: 160, height: 50 }, true)
  Graph.registerNode('topic-child', { ...shared, width: 100, height: 34 }, true)
}

function mindLayout(tree) {
  return hierarchyMindmap(tree, {
    direction: 'H',
    getId: (d) => d.id,
    getHeight: (d) => d.height || 40,
    getWidth: (d) => d.width || 100,
    getHGap: () => 56,
    getVGap: () => 16,
    getSide: (child) => child.data?.side || child.side || 'right'
  })
}

function collectTreeNodes(graph, treeId) {
  return graph.getNodes().filter((node) => node.getData()?.mind?.treeId === treeId)
}

function parentIndex(nodes) {
  const byParent = new Map()
  nodes.forEach((node) => {
    const parentId = node.getData()?.mind?.parentId || null
    if (!byParent.has(parentId)) byParent.set(parentId, [])
    byParent.get(parentId).push(node)
  })
  return byParent
}

function collectChildren(graph, treeId, parentId, nodes) {
  return (nodes || collectTreeNodes(graph, treeId)).filter(
    (node) => node.getData()?.mind?.parentId === parentId
  )
}

function siblingOrder(node) {
  return node.getData()?.mind?.order ?? 0
}

function sortSiblings(nodes) {
  return [...nodes].sort((a, b) => siblingOrder(a) - siblingOrder(b) || a.id.localeCompare(b.id))
}

function collectDescendantIds(graph, node, byParent) {
  const treeId = node.getData()?.mind?.treeId
  const index = byParent || (treeId ? parentIndex(collectTreeNodes(graph, treeId)) : new Map())
  const ids = new Set([node.id])
  const stack = [...(index.get(node.id) || [])]
  while (stack.length) {
    const current = stack.pop()
    if (!current || ids.has(current.id)) continue
    ids.add(current.id)
    const kids = index.get(current.id)
    if (kids) stack.push(...kids)
  }
  return ids
}

function isMindDescendant(graph, ancestor, maybeChild) {
  return collectDescendantIds(graph, ancestor).has(maybeChild.id)
}

function catalogIdForType(type) {
  if (type === 'topic') return 'mindRoot'
  if (type === 'topic-branch') return 'mindTopic'
  return 'mindSub'
}

function typeFromNode(node) {
  const mind = node.getData()?.mind
  if (mind?.type) return mind.type
  const catalogId = node.getData()?.catalogId
  if (TYPE_BY_CATALOG[catalogId]) return TYPE_BY_CATALOG[catalogId]
  if (mind?.parentId) {
    return node.shape === 'topic-child' ? 'topic-child' : 'topic-branch'
  }
  return TYPE_BY_SHAPE[node.shape] || 'topic'
}

function isMindRoot(node) {
  return !node.getData()?.mind?.parentId
}

function typeForParent(parent, child) {
  if (isMindRoot(parent)) return 'topic-branch'
  if (child) return typeFromNode(child)
  return 'topic-child'
}

function defaultChildType(graph, parent) {
  const mind = parent.getData()?.mind || {}
  if (mind.treeId) {
    const hasBranch = collectChildren(graph, mind.treeId, parent.id).some(
      (node) => typeFromNode(node) === 'topic-branch'
    )
    if (hasBranch) return 'topic-branch'
  }
  if (isMindRoot(parent)) return 'topic-branch'
  return 'topic-child'
}

function nextChildOrder(graph, treeId, parentId) {
  const kids = collectChildren(graph, treeId, parentId)
  if (!kids.length) return 0
  return Math.max(...kids.map(siblingOrder)) + 1
}

function patchMind(node, patch, extra = {}) {
  const data = node.getData() || {}
  const mind = { ...(data.mind || {}), ...patch }
  node.setData({
    ...data,
    ...extra,
    catalogId: extra.catalogId || catalogIdForType(mind.type),
    mind
  })
}

function ensureMindMarkup(node) {
  const markup = node.getMarkup?.()
  const list = Array.isArray(markup) ? markup : []
  const needed = ['add', 'addPlus', 'collapseBadge', 'collapseCount']
  if (!needed.every((selector) => list.some((item) => item.selector === selector))) {
    node.setMarkup(MIND_MARKUP)
  }
}

function descendantCount(graph, node) {
  return Math.max(0, collectDescendantIds(graph, node).size - 1)
}

function applyMindSide(node, side, graph, collapsedCount) {
  ensureMindMarkup(node)
  const collapsed = Boolean(node.getData()?.mind?.collapsed)
  const count = collapsed
    ? collapsedCount ?? (graph ? descendantCount(graph, node) : 0)
    : 0
  node.attr({
    ...addControlAttrs(side, count > 0),
    ...collapseHintAttrs(side, count)
  })
}

function applyMindTypeStyle(node, type) {
  ensureMindMarkup(node)
  const isLeaf = type === 'topic-child'
  const isRoot = type === 'topic'
  const size = SIZE_BY_TYPE[type] || SIZE_BY_TYPE['topic-child']
  node.resize(size.width, size.height)
  node.attr({
    body: isLeaf
      ? { fill: 'transparent', stroke: 'none', rx: 6, ry: 6 }
      : {
          fill: isRoot ? '#EFF4FF' : '#F8FBFF',
          stroke: '#5F95FF',
          strokeWidth: 1,
          rx: isRoot ? 8 : 6,
          ry: isRoot ? 8 : 6
        },
    line: {
      refWidth: '100%',
      refY: '100%',
      height: isLeaf ? 2 : 0,
      fill: isLeaf ? '#5F95FF' : 'transparent',
      stroke: 'none'
    },
    label: isLeaf
      ? { textVerticalAnchor: 'bottom', refY: '100%', refY2: -6, fontSize: 13 }
      : { textVerticalAnchor: 'middle', refY: '50%', refY2: 0, fontSize: isRoot ? 14 : 13 }
  })
}

function applySideToSubtree(graph, node, side) {
  const treeId = node.getData()?.mind?.treeId
  const nodes = treeId ? collectTreeNodes(graph, treeId) : []
  const byParent = parentIndex(nodes)
  collectDescendantIds(graph, node, byParent).forEach((id) => {
    const item = graph.getCellById(id)
    if (!item?.isNode?.()) return
    patchMind(item, { side })
    applyMindSide(item, side, graph)
  })
}

function buildHierarchyTree(nodes, root, byParent = parentIndex(nodes)) {
  const convert = (node) => {
    const size = node.getSize()
    const mind = node.getData()?.mind || {}
    return {
      id: node.id,
      type: typeFromNode(node),
      label: node.attr('label/text') || '',
      width: size.width,
      height: size.height,
      side: mind.side || 'right',
      children: mind.collapsed ? [] : sortSiblings(byParent.get(node.id) || []).map(convert)
    }
  }

  return convert(root)
}

function visitLayout(item, parent, onNode, index = 0) {
  const data = item.data || item
  if (data.order == null) data.order = index
  onNode(item, data, parent)
  ;(item.children || []).forEach((child, childIndex) => visitLayout(child, item, onNode, childIndex))
}

function edgeStroke() {
  return getCanvasTheme().dark ? '#64748b' : '#A2B1C3'
}

function hiddenMindIds(graph, nodes, byParent) {
  const hidden = new Set()
  nodes.forEach((node) => {
    if (!node.getData()?.mind?.collapsed) return
    collectDescendantIds(graph, node, byParent).forEach((id) => {
      if (id !== node.id) hidden.add(id)
    })
  })
  return hidden
}

function applyMindVisibility(graph, nodes, byParent) {
  const hidden = hiddenMindIds(graph, nodes, byParent)
  nodes.forEach((node) => {
    if (hidden.has(node.id)) {
      if (node.isVisible()) node.hide()
    } else if (!node.isVisible()) {
      node.show()
    }
  })
  const selected = (graph.getSelectedCells() || []).filter((cell) => hidden.has(cell.id))
  if (selected.length) graph.unselect(selected)
}

export function isMindCollapsed(node) {
  return Boolean(node.getData()?.mind?.collapsed)
}

export function canCollapseMindNode(graph, node) {
  if (!node || !isMindNode(node)) return false
  const mind = node.getData()?.mind
  if (!mind?.treeId) return false
  return collectChildren(graph, mind.treeId, node.id).length > 0
}

export function setMindCollapsed(graph, node, collapsed) {
  if (!canCollapseMindNode(graph, node)) return false
  const mind = node.getData()?.mind
  patchMind(node, { collapsed: Boolean(collapsed) })
  layoutMindTree(graph, mind.treeId)
  graph.cleanSelection()
  graph.select(node)
  return true
}

function createMindEdge(parentId, childId, side = 'right') {
  const goingRight = side !== 'left'
  return {
    shape: 'mindmap-edge',
    router: { name: 'normal' },
    connector: { name: 'mindmap' },
    source: {
      cell: parentId,
      anchor: { name: 'center', args: { dx: goingRight ? '30%' : '-30%' } }
    },
    target: {
      cell: childId,
      anchor: { name: 'center', args: { dx: goingRight ? '-30%' : '30%' } }
    },
    attrs: {
      line: {
        stroke: edgeStroke(),
        strokeWidth: 2,
        targetMarker: '',
        sourceMarker: ''
      }
    }
  }
}

export function layoutMindTree(graph, treeId) {
  if (!graph || !treeId || layoutLock) return
  const nodes = collectTreeNodes(graph, treeId)
  if (!nodes.length) return
  const byParent = parentIndex(nodes)
  const root = nodes.find((node) => !node.getData()?.mind?.parentId) || nodes[0]
  const origin = root.position()
  const result = mindLayout(buildHierarchyTree(nodes, root, byParent))
  const dx = origin.x - result.x
  const dy = origin.y - result.y
  const collapsedCounts = new Map()
  nodes.forEach((node) => {
    if (!node.getData()?.mind?.collapsed) return
    collapsedCounts.set(node.id, Math.max(0, collectDescendantIds(graph, node, byParent).size - 1))
  })

  layoutLock = true
  try {
    graph.batchUpdate(() => {
      graph.getEdges().forEach((edge) => {
        if (edge.shape !== 'mindmap-edge' && !edge.getData()?.mind) return
        const source = edge.getSourceCell()
        const target = edge.getTargetCell()
        if (source?.getData()?.mind?.treeId === treeId || target?.getData()?.mind?.treeId === treeId) {
          edge.remove()
        }
      })
      visitLayout(result, null, (item, data, parent) => {
        const node = graph.getCellById(data.id || item.id)
        if (node?.isNode()) {
          node.setPosition((item.x || 0) + dx, (item.y || 0) + dy)
          const side = data.side || item.side || 'right'
          applyMindSide(node, side, graph, collapsedCounts.get(node.id) || 0)
        }
        if (parent && node) {
          const side = data.side || item.side || 'right'
          graph.addEdge({
            id: uid('e'),
            ...createMindEdge(parent.data?.id || parent.id, node.id, side),
            data: { mind: { treeId } }
          })
        }
      })
      applyMindVisibility(graph, nodes, byParent)
    })
  } finally {
    layoutLock = false
  }
}

export function layoutAllMindTrees(graph) {
  if (!graph) return
  const treeIds = new Set()
  graph.getNodes().forEach((node) => {
    const treeId = node.getData()?.mind?.treeId
    if (treeId) treeIds.add(treeId)
  })
  treeIds.forEach((treeId) => layoutMindTree(graph, treeId))
}

export function mindTreeToCells(tree, originX = 80, originY = 120) {
  const treeId = uid('mt')
  const result = mindLayout(tree)
  const cells = []
  visitLayout(result, null, (item, data, parent) => {
    const type = data.type || 'topic-child'
    const size = SIZE_BY_TYPE[type] || SIZE_BY_TYPE['topic-child']
    const width = data.width || size.width
    const height = data.height || size.height
    const id = data.id || item.id || uid('n')
    data.id = id
    const shape = SHAPE_BY_TYPE[type] || 'topic-child'
    const side = data.side || 'right'
    cells.push({
      id,
      shape,
      x: (item.x || 0) + originX,
      y: (item.y || 0) + originY,
      width,
      height,
      label: data.label || '',
      markup: MIND_MARKUP,
      zIndex: 1,
      data: {
        catalogId: catalogIdForType(type),
        mind: {
          treeId,
          parentId: parent ? parent.data?.id || parent.id : null,
          type,
          side,
          order: data.order ?? 0
        }
      }
    })
    if (parent) {
      cells.push({
        id: uid('e'),
        ...createMindEdge(parent.data?.id || parent.id, id, side),
        data: { mind: { treeId } },
        zIndex: 0
      })
    }
  })
  return cells
}

function selectedMindNode(graph) {
  return (graph.getSelectedCells() || []).find((cell) => isMindNode(cell)) || null
}

function defaultChildLabel(type) {
  return type === 'topic-child' ? '子主题' : '分支主题'
}

export function addMindChild(graph, parent, extra = {}) {
  if (!parent || !isMindNode(parent)) return null
  const mind = parent.getData()?.mind || {}
  if (!mind.treeId) return null
  if (mind.collapsed) patchMind(parent, { collapsed: false })
  const type = extra.type || defaultChildType(graph, parent)
  const size = extra.size || SIZE_BY_TYPE[type]
  const shape = extra.shape || SHAPE_BY_TYPE[type]
  const side = extra.side || mind.side || 'right'
  const order = extra.order ?? nextChildOrder(graph, mind.treeId, parent.id)
  const node = graph.addNode({
    shape,
    markup: MIND_MARKUP,
    x: parent.position().x + 180,
    y: parent.position().y,
    width: extra.width || size.width,
    height: extra.height || size.height,
    label: extra.label || defaultChildLabel(type),
    data: {
      catalogId: extra.catalogId || catalogIdForType(type),
      mind: {
        treeId: mind.treeId,
        parentId: parent.id,
        type,
        side,
        order
      }
    }
  })
  layoutLock = true
  applyMindTypeStyle(node, type)
  applyMindSide(node, side, graph)
  layoutLock = false
  reindexSiblings(graph, mind.treeId, parent.id)
  layoutMindTree(graph, mind.treeId)
  graph.cleanSelection()
  graph.select(node)
  return node
}

export function addMindSibling(graph, node) {
  if (!node || !isMindNode(node)) return null
  const mind = node.getData()?.mind || {}
  if (!mind.parentId) return addMindChild(graph, node)
  const parent = graph.getCellById(mind.parentId)
  if (!parent?.isNode?.()) return null
  return addMindChild(graph, parent, {
    type: typeFromNode(node),
    side: mind.side || 'right',
    order: siblingOrder(node) + 0.5
  })
}

export function reparentMindNode(graph, node, newParent, extra = {}) {
  if (!node || !newParent || node.id === newParent.id) return false
  if (!isMindNode(node) || !isMindNode(newParent)) return false
  const mind = node.getData()?.mind
  const parentMind = newParent.getData()?.mind
  if (!mind?.treeId || parentMind?.treeId !== mind.treeId) return false
  if (isMindDescendant(graph, node, newParent)) return false

  const type = extra.type || typeForParent(newParent, node)
  const parentIsRoot = isMindRoot(newParent)
  const side = parentIsRoot
    ? extra.side || inferSide(newParent, node)
    : parentMind.side || mind.side || 'right'
  const siblings = collectChildren(graph, mind.treeId, newParent.id).filter((item) => item.id !== node.id)
  let order = extra.order
  if (order == null && extra.afterId) {
    const after = siblings.find((item) => item.id === extra.afterId)
    order = siblingOrder(after || node) + 0.5
  }
  if (order == null) order = nextChildOrder(graph, mind.treeId, newParent.id)

  const prevType = typeFromNode(node)
  patchMind(node, { parentId: newParent.id, type, side, order })
  if (prevType !== type) applyMindTypeStyle(node, type)
  applySideToSubtree(graph, node, side)
  reindexSiblings(graph, mind.treeId, newParent.id)
  layoutMindTree(graph, mind.treeId)
  graph.cleanSelection()
  graph.select(node)
  return true
}

function inferSide(parent, node) {
  const parentBox = parent.getBBox()
  const nodeBox = node.getBBox()
  return nodeBox.x + nodeBox.width / 2 < parentBox.x + parentBox.width / 2 ? 'left' : 'right'
}

function reindexSiblings(graph, treeId, parentId) {
  sortSiblings(collectChildren(graph, treeId, parentId)).forEach((node, index) => {
    patchMind(node, { order: index })
  })
}

function reorderSiblingsByPosition(graph, node) {
  const mind = node.getData()?.mind
  if (!mind?.treeId || !mind.parentId) return
  const siblings = collectChildren(graph, mind.treeId, mind.parentId)
  siblings.sort((a, b) => a.position().y - b.position().y)
  siblings.forEach((item, index) => patchMind(item, { order: index }))
}

export function canIndentMindNode(graph, node) {
  if (!node || !isMindNode(node)) return false
  const mind = node.getData()?.mind
  if (!mind?.parentId) return false
  const siblings = sortSiblings(collectChildren(graph, mind.treeId, mind.parentId))
  return siblings.findIndex((item) => item.id === node.id) > 0
}

export function canOutdentMindNode(graph, node) {
  if (!node || !isMindNode(node)) return false
  const mind = node.getData()?.mind
  if (!mind?.parentId) return false
  const parent = graph.getCellById(mind.parentId)
  return Boolean(parent?.getData()?.mind?.parentId)
}

export function indentMindNode(graph, node) {
  if (!canIndentMindNode(graph, node)) return false
  const mind = node.getData()?.mind
  const siblings = sortSiblings(collectChildren(graph, mind.treeId, mind.parentId))
  const index = siblings.findIndex((item) => item.id === node.id)
  const newParent = siblings[index - 1]
  return reparentMindNode(graph, node, newParent)
}

export function outdentMindNode(graph, node) {
  if (!canOutdentMindNode(graph, node)) return false
  const mind = node.getData()?.mind
  const parent = graph.getCellById(mind.parentId)
  const parentMind = parent.getData()?.mind
  const grandparent = graph.getCellById(parentMind.parentId)
  return reparentMindNode(graph, node, grandparent, {
    afterId: parent.id,
    side: parentMind.side || mind.side
  })
}

export function moveMindSibling(graph, node, delta) {
  if (!node || !isMindNode(node) || !delta) return false
  const mind = node.getData()?.mind
  if (!mind?.parentId) return false
  const siblings = sortSiblings(collectChildren(graph, mind.treeId, mind.parentId))
  const index = siblings.findIndex((item) => item.id === node.id)
  const next = index + delta
  if (index < 0 || next < 0 || next >= siblings.length) return false
  const currentOrder = siblingOrder(node)
  const swap = siblings[next]
  patchMind(node, { order: siblingOrder(swap) })
  patchMind(swap, { order: currentOrder })
  reindexSiblings(graph, mind.treeId, mind.parentId)
  layoutMindTree(graph, mind.treeId)
  graph.cleanSelection()
  graph.select(node)
  return true
}

export function attachDroppedMindNode(graph, node) {
  if (!isMindShape(node.shape) || node.getData()?.mind?.treeId) return

  const selected = selectedMindNode(graph)
  if (selected && selected.id !== node.id && selected.getData()?.mind?.treeId) {
    const mind = selected.getData().mind
    const droppedType = typeFromNode(node)
    const childType = droppedType === 'topic' ? defaultChildType(graph, selected) : droppedType
    const side = mind.side || 'right'
    patchMind(node, {
      treeId: mind.treeId,
      parentId: selected.id,
      type: childType,
      side,
      order: nextChildOrder(graph, mind.treeId, selected.id)
    })
    applyMindTypeStyle(node, childType)
    applyMindSide(node, side, graph)
    layoutMindTree(graph, mind.treeId)
    return
  }

  patchMind(node, { treeId: uid('mt'), parentId: null, type: 'topic', side: 'right', order: 0 })
  applyMindTypeStyle(node, 'topic')
  applyMindSide(node, 'right', graph)
}

export function collectMindRemoval(graph, cells) {
  const bag = new Set(cells)
  const indexes = new Map()
  cells.forEach((cell) => {
    if (!cell?.isNode?.() || !isMindNode(cell)) return
    const treeId = cell.getData()?.mind?.treeId
    if (!treeId) return
    if (!indexes.has(treeId)) indexes.set(treeId, parentIndex(collectTreeNodes(graph, treeId)))
    collectDescendantIds(graph, cell, indexes.get(treeId)).forEach((id) => {
      const node = graph.getCellById(id)
      if (node) bag.add(node)
    })
  })
  graph.getEdges().forEach((edge) => {
    const source = edge.getSourceCell()
    const target = edge.getTargetCell()
    if ((source && bag.has(source)) || (target && bag.has(target))) bag.add(edge)
  })
  return [...bag]
}

export function prepareMindClipboard(graph, cells) {
  const bundle = collectMindRemoval(graph, cells)
  bundle.forEach((cell) => {
    if (!cell?.isNode?.() || !isMindNode(cell)) return
    const data = cell.getData() || {}
    const mind = data.mind || {}
    cell.setData({ ...data, mind: { ...mind, copyId: cell.id } }, { silent: true })
  })
  return bundle
}

export function restoreMindClipboardSource(cells) {
  cells.forEach((cell) => {
    if (!cell?.isNode?.() || !isMindNode(cell)) return
    const data = cell.getData() || {}
    if (!data.mind || data.mind.copyId == null) return
    const mind = { ...data.mind }
    delete mind.copyId
    cell.setData({ ...data, mind }, { silent: true, overwrite: true })
  })
}

export function remapPastedMindCells(graph, cells) {
  const nodes = (cells || []).filter((cell) => cell?.isNode?.() && isMindNode(cell))
  if (!nodes.length) return
  const idMap = {}
  const byId = new Map(nodes.map((node) => [node.id, node]))
  nodes.forEach((node) => {
    const copyId = node.getData()?.mind?.copyId
    if (copyId) idMap[copyId] = node.id
  })

  const rootOf = (node) => {
    const seen = new Set()
    let current = node
    while (current) {
      const parentCopy = current.getData()?.mind?.parentId
      const mapped = parentCopy ? idMap[parentCopy] : null
      if (!mapped || seen.has(mapped)) return current
      seen.add(mapped)
      current = byId.get(mapped)
    }
    return node
  }

  const treeByRoot = new Map()
  nodes.forEach((node) => {
    const root = rootOf(node)
    if (!treeByRoot.has(root.id)) treeByRoot.set(root.id, uid('mt'))
    const data = node.getData() || {}
    const mind = { ...(data.mind || {}) }
    const mappedParent = mind.parentId ? idMap[mind.parentId] : null
    mind.treeId = treeByRoot.get(root.id)
    mind.parentId = mappedParent || null
    delete mind.copyId
    node.setData({ ...data, catalogId: data.catalogId || catalogIdForType(mind.type), mind }, { overwrite: true })
  })
  treeByRoot.forEach((treeId) => layoutMindTree(graph, treeId))
}

function findMindDropTarget(graph, node, x, y) {
  const treeId = node.getData()?.mind?.treeId
  const blocked = collectDescendantIds(graph, node)
  const views = graph.findViewsFromPoint?.(x, y) || []
  for (let i = views.length - 1; i >= 0; i -= 1) {
    const cell = views[i]?.cell
    if (!cell?.isNode?.() || !isMindNode(cell)) continue
    if (blocked.has(cell.id)) continue
    if (cell.getData()?.mind?.treeId !== treeId) continue
    return cell
  }
  return null
}

function followMindDrag(graph, node, dx, dy) {
  const mind = node.getData()?.mind
  if (!mind?.treeId || (!dx && !dy)) return
  const selected = new Set((graph.getSelectedCells() || []).map((cell) => cell.id))
  const nodes = collectTreeNodes(graph, mind.treeId)
  const byParent = parentIndex(nodes)
  const followers = mind.parentId
    ? [...collectDescendantIds(graph, node, byParent)]
        .filter((id) => id !== node.id)
        .map((id) => graph.getCellById(id))
        .filter((item) => item?.isNode?.())
    : nodes.filter((item) => item.id !== node.id)

  layoutLock = true
  try {
    followers.forEach((child) => {
      if (selected.has(child.id)) return
      const pos = child.position()
      child.setPosition(pos.x + dx, pos.y + dy)
    })
  } finally {
    layoutLock = false
  }
}

function finishMindDrag(graph, node) {
  const mind = node.getData()?.mind
  if (!mind?.treeId || !mind.parentId) return
  const mindSelected = (graph.getSelectedCells() || []).filter((cell) => isMindNode(cell))
  if (mindSelected.length > 1) {
    layoutMindTree(graph, mind.treeId)
    return
  }
  const box = node.getBBox()
  const target = findMindDropTarget(graph, node, box.x + box.width / 2, box.y + box.height / 2)
  if (target && target.id !== mind.parentId) {
    const side = target.getData()?.mind?.parentId ? undefined : inferSide(target, node)
    reparentMindNode(graph, node, target, { side })
    return
  }
  if (target && !target.getData()?.mind?.parentId) {
    const side = inferSide(target, node)
    if (side !== mind.side) {
      applySideToSubtree(graph, node, side)
    }
  }
  reorderSiblingsByPosition(graph, node)
  layoutMindTree(graph, mind.treeId)
}

export function bindMindmapBehavior(graph) {
  graph.on('node:added', ({ node }) => {
    if (layoutLock) return
    attachDroppedMindNode(graph, node)
  })

  graph.on('add:topic', ({ e, node }) => {
    e?.stopPropagation?.()
    e?.preventDefault?.()
    addMindChild(graph, node)
  })

  graph.on('expand:topic', ({ e, node }) => {
    e?.stopPropagation?.()
    e?.preventDefault?.()
    setMindCollapsed(graph, node, false)
  })

  graph.on('node:change:position', ({ node, current, previous }) => {
    if (layoutLock || !isMindNode(node) || !current || !previous) return
    followMindDrag(graph, node, current.x - previous.x, current.y - previous.y)
  })

  graph.on('node:moved', ({ node }) => {
    if (layoutLock || !isMindNode(node)) return
    finishMindDrag(graph, node)
  })

  graph.on('node:resized', ({ node }) => {
    if (layoutLock || !isMindNode(node)) return
    const treeId = node.getData()?.mind?.treeId
    if (treeId) layoutMindTree(graph, treeId)
  })

  graph.on('edge:connected', ({ isNew, edge }) => {
    if (!isNew || layoutLock) return
    if (edge.shape === 'mindmap-edge' || edge.getData()?.mind) return
    const source = edge.getSourceCell()
    const target = edge.getTargetCell()
    if (!isMindNode(source) || !isMindNode(target)) return
    graph.removeCells([edge])
    reparentMindNode(graph, target, source)
  })

  graph.bindKey('tab', () => {
    const parent = selectedMindNode(graph)
    if (!parent || parent.hasTool?.('node-editor')) return true
    addMindChild(graph, parent)
    return false
  })

  graph.bindKey('shift+tab', () => {
    const node = selectedMindNode(graph)
    if (!node || node.hasTool?.('node-editor')) return true
    outdentMindNode(graph, node)
    return false
  })

  graph.bindKey(['ctrl+]', 'meta+]'], () => {
    const node = selectedMindNode(graph)
    if (!node) return true
    indentMindNode(graph, node)
    return false
  })

  graph.bindKey(['ctrl+[', 'meta+['], () => {
    const node = selectedMindNode(graph)
    if (!node) return true
    outdentMindNode(graph, node)
    return false
  })

  graph.bindKey('enter', () => {
    const node = selectedMindNode(graph)
    if (!node || node.hasTool?.('node-editor')) return true
    addMindSibling(graph, node)
    return false
  })

  graph.bindKey(['alt+up', 'alt+down'], (_e, combo) => {
    const node = selectedMindNode(graph)
    if (!node) return true
    moveMindSibling(graph, node, combo === 'alt+up' ? -1 : 1)
    return false
  })
}
