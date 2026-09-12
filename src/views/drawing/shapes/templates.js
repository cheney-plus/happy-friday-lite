import { uid } from './id.js'
import { createEdgeMetadata } from './edgeStyles.js'
import { mindTreeToCells } from './mindmap.js'

function node(shape, x, y, width, height, label, extra = {}) {
  return {
    id: extra.id || uid('n'),
    shape,
    x,
    y,
    width,
    height,
    label,
    zIndex: extra.zIndex ?? 1,
    data: extra.data || {},
    attrs: extra.attrs
  }
}

function edge(source, target, style, extra = {}) {
  return createEdgeMetadata(style, {
    id: extra.id || uid('e'),
    source,
    target,
    labels: extra.label ? [{ attrs: { label: { text: extra.label, fontSize: 11 } } }] : undefined
  })
}

export function createMindMapTemplate(ox = 80, oy = 80) {
  return {
    cells: mindTreeToCells(
      {
        id: uid('n'),
        type: 'topic',
        label: '中心主题',
        width: 160,
        height: 50,
        children: [
          {
            id: uid('n'),
            type: 'topic-branch',
            label: '市场洞察',
            width: 120,
            height: 40,
            children: [
              { id: uid('n'), type: 'topic-child', label: '用户研究', width: 100, height: 32 },
              { id: uid('n'), type: 'topic-child', label: '竞品分析', width: 100, height: 32 }
            ]
          },
          {
            id: uid('n'),
            type: 'topic-branch',
            label: '产品规划',
            width: 120,
            height: 40
          },
          {
            id: uid('n'),
            type: 'topic-branch',
            label: '落地执行',
            width: 120,
            height: 40,
            children: [
              {
                id: uid('n'),
                type: 'topic-child',
                label: '版本节奏',
                width: 100,
                height: 32,
                children: [
                  { id: uid('n'), type: 'topic-child', label: '灰度发布', width: 100, height: 32 },
                  { id: uid('n'), type: 'topic-child', label: '全量上线', width: 100, height: 32 }
                ]
              }
            ]
          }
        ]
      },
      ox,
      oy
    )
  }
}

export function createFlowchartTemplate(ox = 120, oy = 40) {
  const start = node('draw-terminator', ox + 80, oy, 128, 52, '开始')
  const process = node('draw-process', ox + 74, oy + 110, 140, 56, '处理请求')
  const decision = node('draw-decision', ox + 70, oy + 210, 148, 92, '是否通过?')
  const ok = node('draw-process', ox + 280, oy + 226, 140, 56, '完成任务')
  const fail = node('draw-document', ox - 90, oy + 226, 130, 86, '记录问题')
  const end = node('draw-terminator', ox + 80, oy + 360, 128, 52, '结束')
  return {
    cells: [
      start,
      process,
      decision,
      ok,
      fail,
      end,
      edge({ cell: start.id }, { cell: process.id }, 'manhattan'),
      edge({ cell: process.id }, { cell: decision.id }, 'manhattan'),
      edge({ cell: decision.id }, { cell: ok.id }, 'manhattan', { label: '是' }),
      edge({ cell: decision.id }, { cell: fail.id }, 'manhattan', { label: '否' }),
      edge({ cell: ok.id }, { cell: end.id }, 'manhattan'),
      edge({ cell: fail.id }, { cell: end.id }, 'manhattan')
    ]
  }
}

export function createKanbanTemplate(ox = 40, oy = 40) {
  const cols = [
    { title: '待办', x: ox, color: '#94a3b8' },
    { title: '进行中', x: ox + 220, color: '#2563eb' },
    { title: '已完成', x: ox + 440, color: '#059669' }
  ]
  const cells = cols.map((col) =>
    node('draw-container', col.x, oy, 200, 280, col.title, {
      zIndex: 0,
      attrs: { body: { stroke: col.color } }
    })
  )
  cells.push(
    node('draw-sticky', ox + 30, oy + 50, 140, 90, '梳理需求'),
    node('draw-sticky', ox + 250, oy + 50, 140, 90, '绘制原型'),
    node('draw-sticky', ox + 470, oy + 50, 140, 90, '完成评审')
  )
  return { cells }
}

export function createErTemplate(ox = 40, oy = 80) {
  const user = node('draw-er-entity', ox, oy + 40, 160, 88, '用户')
  const rel = node('draw-er-rel', ox + 210, oy + 40, 140, 88, '拥有')
  const order = node('draw-er-entity', ox + 400, oy + 40, 160, 88, '订单')
  const key = node('draw-er-key', ox, oy + 180, 120, 52, 'user_id')
  const attr = node('draw-er-attr', ox + 420, oy + 180, 120, 52, 'amount')
  return {
    cells: [
      user,
      rel,
      order,
      key,
      attr,
      edge({ cell: user.id }, { cell: rel.id }, 'er'),
      edge({ cell: rel.id }, { cell: order.id }, 'er'),
      edge({ cell: user.id }, { cell: key.id }, 'er'),
      edge({ cell: order.id }, { cell: attr.id }, 'er')
    ]
  }
}

export function createTimelineTemplate(ox = 60, oy = 120) {
  const axis = node('draw-tl-axis', ox, oy + 80, 560, 8, '')
  const m1 = node('draw-tl-milestone', ox + 40, oy + 70, 28, 28, '')
  const m2 = node('draw-tl-milestone', ox + 250, oy + 70, 28, 28, '')
  const m3 = node('draw-tl-milestone', ox + 460, oy + 70, 28, 28, '')
  const e1 = node('draw-tl-event', ox, oy, 150, 64, '启动')
  const e2 = node('draw-tl-event', ox + 210, oy + 110, 150, 64, '开发')
  const e3 = node('draw-tl-event', ox + 420, oy, 150, 64, '发布')
  return { cells: [axis, m1, m2, m3, e1, e2, e3] }
}

export function createSequenceTemplate(ox = 80, oy = 40) {
  const a = node('draw-seq-actor', ox, oy, 120, 280, '用户')
  const b = node('draw-seq-actor', ox + 220, oy, 120, 280, '前端')
  const c = node('draw-seq-actor', ox + 440, oy, 120, 280, '服务')
  return {
    cells: [
      a,
      b,
      c,
      edge({ cell: a.id, anchor: { name: 'midSide', args: { padding: 80 } } }, { cell: b.id, anchor: { name: 'midSide', args: { padding: 80 } } }, 'message', { label: '请求' }),
      edge({ cell: b.id, anchor: { name: 'midSide', args: { padding: 140 } } }, { cell: c.id, anchor: { name: 'midSide', args: { padding: 140 } } }, 'message', { label: '调用 API' }),
      edge({ cell: c.id, anchor: { name: 'midSide', args: { padding: 190 } } }, { cell: b.id, anchor: { name: 'midSide', args: { padding: 190 } } }, 'returnMessage', { label: '响应' })
    ]
  }
}

export function createArchitectureTemplate(ox = 40, oy = 40) {
  const client = node('draw-arch-client', ox + 240, oy, 140, 64, '客户端')
  const gw = node('draw-arch-gateway', ox + 240, oy + 110, 140, 64, '网关')
  const api = node('draw-arch-server', ox + 80, oy + 220, 140, 64, '业务服务')
  const queue = node('draw-arch-queue', ox + 400, oy + 220, 140, 64, '消息队列')
  const cache = node('draw-arch-cache', ox + 80, oy + 330, 140, 64, '缓存')
  const db = node('draw-arch-db', ox + 400, oy + 330, 140, 64, '数据库')
  return {
    cells: [
      client,
      gw,
      api,
      queue,
      cache,
      db,
      edge({ cell: client.id }, { cell: gw.id }, 'manhattan'),
      edge({ cell: gw.id }, { cell: api.id }, 'manhattan'),
      edge({ cell: gw.id }, { cell: queue.id }, 'manhattan'),
      edge({ cell: api.id }, { cell: cache.id }, 'manhattan'),
      edge({ cell: api.id }, { cell: db.id }, 'manhattan')
    ]
  }
}

export function createDfdTemplate(ox = 40, oy = 80) {
  const ext = node('draw-dfd-external', ox, oy + 80, 140, 64, '用户')
  const proc = node('draw-dfd-process', ox + 220, oy + 66, 92, 92, '下单')
  const store = node('draw-dfd-store', ox + 400, oy + 88, 150, 48, '订单库')
  return {
    cells: [
      ext,
      proc,
      store,
      edge({ cell: ext.id }, { cell: proc.id }, 'dataflow', { label: '订单请求' }),
      edge({ cell: proc.id }, { cell: store.id }, 'dataflow', { label: '写入订单' })
    ]
  }
}

export const TEMPLATE_BUILDERS = {
  mindmap: createMindMapTemplate,
  flowchart: createFlowchartTemplate,
  kanban: createKanbanTemplate,
  er: createErTemplate,
  timeline: createTimelineTemplate,
  sequence: createSequenceTemplate,
  architecture: createArchitectureTemplate,
  dfd: createDfdTemplate
}

function remapTerminal(terminal, idMap) {
  if (!terminal) return terminal
  if (typeof terminal === 'string') return idMap[terminal] || terminal
  if (terminal.cell) return { ...terminal, cell: idMap[terminal.cell] || terminal.cell }
  return terminal
}

export function cloneTemplateAt(data, dx = 0, dy = 0) {
  const idMap = {}
  const cloned = (data.cells || []).map((cell) => {
    const nextId = uid(cell.source || cell.target ? 'e' : 'n')
    if (cell.id) idMap[cell.id] = nextId
    return { ...cell, id: nextId }
  })
  const mindTreeId = uid('mt')
  return {
    cells: cloned.map((cell) => {
      if (cell.source || cell.target) {
        const next = {
          ...cell,
          source: remapTerminal(cell.source, idMap),
          target: remapTerminal(cell.target, idMap)
        }
        if (cell.data?.mind) {
          next.data = {
            ...cell.data,
            mind: { ...cell.data.mind, treeId: mindTreeId }
          }
        }
        return next
      }
      const next = {
        ...cell,
        x: (cell.x || 0) + dx,
        y: (cell.y || 0) + dy
      }
      if (cell.data?.mind) {
        next.data = {
          ...cell.data,
          mind: {
            ...cell.data.mind,
            treeId: mindTreeId,
            parentId: cell.data.mind.parentId ? idMap[cell.data.mind.parentId] || null : null
          }
        }
      }
      return next
    })
  }
}
