export const ANIMATION_TYPES = ['none', 'pulse', 'breathe', 'bounce', 'flow']

function stopCellAnimations(cell) {
  const animations = cell.getAnimations?.() || []
  animations.forEach((animation) => animation.cancel())
  cell.attr('body/style/animation', '')
  cell.attr('line/style/animation', '')
  if (cell.isNode()) {
    cell.attr('body/opacity', 1)
  }
}

export function applyCellAnimation(cell, type) {
  stopCellAnimations(cell)
  const data = { ...(cell.getData() || {}), animation: type || 'none' }
  cell.setData(data)

  if (!type || type === 'none') return

  if (cell.isEdge()) {
    if (type === 'flow' || type === 'pulse') {
      const dash = cell.attr('line/strokeDasharray') || 0
      if (!dash || dash === 0 || dash === '0') {
        cell.attr('line/strokeDasharray', 8)
      }
      cell.attr('line/style/animation', 'draw-edge-flow 1s linear infinite')
    }
    return
  }

  if (type === 'pulse') {
    cell.animate(
      { 'attrs/body/opacity': [1, 0.42] },
      { duration: 900, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }
    )
    return
  }

  if (type === 'breathe') {
    cell.attr('body/style/animation', 'draw-node-breathe 1.6s ease-in-out infinite')
    return
  }

  if (type === 'bounce') {
    const y = cell.position().y
    cell.animate(
      { 'position/y': [y, y - 10] },
      { duration: 700, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }
    )
  }
}

export function restoreGraphAnimations(graph) {
  graph.getCells().forEach((cell) => {
    const type = cell.getData()?.animation
    if (type && type !== 'none') applyCellAnimation(cell, type)
  })
}
