/**
 * 内置工具：数学计算（calculator）
 * ============================================
 * 设计参考：Agent智能体设计.md 2.9 内置工具清单
 *
 * 包装 LangChain 社区版 Calculator 工具，统一接入项目的注册中心，
 * 以便获得日志、审计、IPC 通知能力。
 *
 * 来源：@langchain/community/tools/calculator
 * 别名："llm-math"（对应 Python 版 load_tools("llm-math")）
 *
 * 能力：数学表达式求值、单位换算、公式求解。
 */

import { z } from 'zod'
import { registerTool } from '../registry.js'

// 单例 Calculator 实例（避免每次调用都创建）
let calculatorInstance = null

async function getCalculator() {
  if (!calculatorInstance) {
    const { Calculator } = await import('@langchain/community/tools/calculator')
    calculatorInstance = new Calculator()
  }
  return calculatorInstance
}

const schema = z.object({
  expression: z
    .string()
    .describe('要计算的数学表达式，例如 "99 + 99"、"sin(0.5) + 2^3"、"12 * (3 + 4)"')
})

async function handler(args, ctx) {
  const { expression } = args
  ctx.logger.info(`[calculator] expr="${expression}"`)

  try {
    const calc = await getCalculator()
    const result = await calc.invoke(expression)
    ctx.logger.info(`[calculator] result=${result}`)
    return `表达式：${expression}\n结果：${result}`
  } catch (e) {
    ctx.logger.warn(`[calculator] 失败: ${e.message}`)
    return `计算失败: ${e.message}`
  }
}

registerTool({
  name: 'calculator',
  description:
    '数学表达式计算器。可计算加减乘除、三角函数、指数对数、单位换算等数学表达式。' +
    '输入应为可被简单计算器执行的合法数学表达式，如 "99 + 99"、"sin(0.5) + 2^3"。',
  schema,
  handler,
  meta: { requireApproval: false }
})
