/**
 * 故事模式守卫（story-guard）。
 *
 * 故事模式是一个纯叙事会话：只和玩家讲故事，不应出现部署级别挂载的
 * 编码 / 搜索 / 终端工具。该预设子插件在挂载时把当前可见的全局工具
 * 全部屏蔽掉（预设自身的工具注册不受影响，限制只作用于继承来的全局工具）。
 */
export const name = 'story-guard'

/** 需要工具注册表存在。 */
export const inject = ['tools']

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx 预设作用域的上下文
 */
export function apply(ctx) {
  ctx.effect(() => {
    let names = []
    try {
      names = ctx.tools
        .schemas()
        .map((schema) => schema?.name)
        .filter((toolName) => typeof toolName === 'string' && toolName.length > 0)
    } catch (error) {
      console.warn('[story-mode] 读取工具列表失败，保留默认工具可见性:', error?.message ?? error)
      return () => {}
    }
    if (names.length === 0) return () => {}
    try {
      return ctx.tools.restrict({ deny: names })
    } catch (error) {
      console.warn('[story-mode] 屏蔽全局工具失败:', error?.message ?? error)
      return () => {}
    }
  }, 'story.tools.restrict()')
}
