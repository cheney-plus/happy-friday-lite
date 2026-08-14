export const name = 'happy-friday-tool-approval-policy'
export const inject = ['tools']

export function apply(ctx, config = {}) {
  const approvalTools = new Set(
    Array.isArray(config.approvalTools) ? config.approvalTools : []
  )

  ctx.on('tools/pre-execute', async (execution, next) => {
    if (!approvalTools.has(execution.name)) return next()
    return {
      kind: 'ask',
      reason: `Happy Friday tool "${execution.name}" changes application data.`
    }
  })
}
