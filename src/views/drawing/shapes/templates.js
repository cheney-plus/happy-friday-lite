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
  const start = node('draw-terminator', ox + 106, oy, 128, 52, '开始')
  const intake = node('draw-process', ox + 100, oy + 92, 140, 56, '接收申请')
  const review = node('draw-decision', ox + 96, oy + 190, 148, 92, '资料完整?')
  const complete = node('draw-process', ox + 330, oy + 208, 140, 56, '创建记录')
  const notify = node('draw-document', ox - 105, oy + 198, 130, 86, '补充材料')
  const end = node('draw-terminator', ox + 336, oy + 338, 128, 52, '完成')
  return {
    cells: [
      start,
      intake,
      review,
      complete,
      notify,
      end,
      edge({ cell: start.id }, { cell: intake.id }, 'manhattan'),
      edge({ cell: intake.id }, { cell: review.id }, 'manhattan'),
      edge({ cell: review.id }, { cell: complete.id }, 'manhattan', { label: '是' }),
      edge({ cell: review.id }, { cell: notify.id }, 'manhattan', { label: '否' }),
      edge({ cell: notify.id }, { cell: intake.id }, 'manhattan', { label: '补充后提交' }),
      edge({ cell: complete.id }, { cell: end.id }, 'manhattan')
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
  const customer = node('draw-er-entity', ox, oy + 116, 160, 88, '客户')
  const places = node('draw-er-rel', ox + 220, oy + 116, 140, 88, '下单')
  const order = node('draw-er-entity', ox + 440, oy + 116, 160, 88, '订单')
  const contains = node('draw-er-rel', ox + 650, oy + 116, 140, 88, '包含')
  const product = node('draw-er-entity', ox + 870, oy + 116, 160, 88, '商品')
  const customerKey = node('draw-er-key', ox + 10, oy + 270, 120, 52, 'customer_id')
  const orderKey = node('draw-er-key', ox + 450, oy + 270, 120, 52, 'order_id')
  const orderAmount = node('draw-er-attr', ox + 600, oy + 270, 120, 52, 'total')
  const productKey = node('draw-er-key', ox + 880, oy + 270, 120, 52, 'product_id')
  const quantity = node('draw-er-attr', ox + 740, oy + 10, 120, 52, 'quantity')
  return {
    cells: [
      customer,
      places,
      order,
      contains,
      product,
      customerKey,
      orderKey,
      orderAmount,
      productKey,
      quantity,
      edge({ cell: customer.id }, { cell: places.id }, 'er', { label: '1' }),
      edge({ cell: places.id }, { cell: order.id }, 'er', { label: 'N' }),
      edge({ cell: order.id }, { cell: contains.id }, 'er', { label: 'N' }),
      edge({ cell: contains.id }, { cell: product.id }, 'er', { label: '1' }),
      edge({ cell: customer.id }, { cell: customerKey.id }, 'er'),
      edge({ cell: order.id }, { cell: orderKey.id }, 'er'),
      edge({ cell: order.id }, { cell: orderAmount.id }, 'er'),
      edge({ cell: product.id }, { cell: productKey.id }, 'er'),
      edge({ cell: contains.id }, { cell: quantity.id }, 'er')
    ]
  }
}

export function createUmlTemplate(ox = 80, oy = 60) {
  const order = node('draw-uml-class', ox, oy + 120, 200, 148, 'Order', {
    data: { className: 'Order', attributes: '+ id: UUID\n+ status: OrderStatus\n+ total: Money', methods: '+ submit(): void\n+ cancel(): void' }
  })
  const item = node('draw-uml-class', ox + 330, oy + 120, 200, 148, 'OrderItem', {
    data: { className: 'OrderItem', attributes: '+ quantity: number\n+ price: Money', methods: '+ subtotal(): Money' }
  })
  const service = node('draw-uml-interface', ox + 165, oy, 160, 56, '«interface»\nOrderRepository')
  const product = node('draw-uml-class', ox + 660, oy + 120, 200, 148, 'Product', {
    data: { className: 'Product', attributes: '+ sku: string\n+ name: string', methods: '+ isAvailable(): boolean' }
  })
  return {
    cells: [
      order,
      item,
      service,
      product,
      edge({ cell: order.id }, { cell: item.id }, 'arrow', { label: '1   *' }),
      edge({ cell: item.id }, { cell: product.id }, 'arrow', { label: '*   1' }),
      edge({ cell: order.id }, { cell: service.id }, 'dashed', { label: 'uses' })
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
  uml: createUmlTemplate,
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
