/**
 * 故事模式 · 三条走向（Host 端）。
 *
 * 与 DSH 的 plan 模式同构：
 * - 注册一个会话投影 `storyChoices`，从 `command/run` / `command/done` 折叠出开关状态，
 *   因此刷新、重开、fork 之后开关状态都能从会话日志恢复；
 * - 注册 `/choices on|off` 命令（仅在故事模式的作用域内可见），由客户端开关调用；
 * - 注册一条 required 运行时上下文：开关打开时，每个请求都会带上「给出三条走向」的写作要求。
 *   required 是关键：故事模式的人格是 complete 提示，且关掉了可选运行时上下文，
 *   只有 required 上下文能穿过去。
 */

const PROJECTION_KEY = 'storyChoices'

/** 开关打开时注入给模型的写作要求。 */
const CHOICES_INSTRUCTION = [
  '【本轮叙事设置：三条走向】',
  '在完成本轮叙事之后，基于你上一轮回复（以及更早）已经发生的情节，追加恰好三条互不相同、彼此排斥的走向，供玩家选择：',
  '1. ……',
  '2. ……',
  '3. ……',
  '每条用一两句话给出行动方向，并点出它可能的代价或风险。',
  '格式：在正文之后空一行，以「**走向**」单独起头，然后三条各占一行，形如「1. ……」。',
  '不要把选择后的结果提前写出来，也不要把这三条混进正文叙事里；即使玩家本轮只是自由叙述，也要在结尾给出三条走向。',
].join('\n')

const initialChoiceState = () => ({
  active: false,
  running: null,
  view: { active: false },
})

/**
 * 会话投影：把 /choices 命令的执行结果折叠成开关状态。
 * @type {import('@deepseek-ai/dsh-session-projection').ProjectionDefinition<any, any>}
 */
const choicesProjection = {
  key: PROJECTION_KEY,
  stateVersion: 1,
  // 运行时只需要 .parse()；状态完全由本插件写入，按原样返回即可。
  stateSchema: { parse: (value) => value },
  init: () => initialChoiceState(),
  apply: (state, event) => {
    if (event.type === 'command/run' && event.data.name === 'choices') {
      const raw = typeof event.data.args === 'string' ? event.data.args.trim().toLowerCase() : ''
      const wanted = raw === 'on' ? true : raw === 'off' ? false : null
      if (wanted === null) return state
      return { ...state, running: { commandId: event.data.commandId, wanted } }
    }
    if (event.type === 'command/done' && state.running !== null && event.data.commandId === state.running.commandId) {
      const next = event.data.kind === 'success' ? state.running.wanted : state.active
      return {
        ...state,
        active: next,
        running: null,
        view: state.view.active === next ? state.view : { active: next },
      }
    }
    return state
  },
  wire: {
    viewSchema: { parse: (value) => value },
    view: (state) => state.view,
  },
}

export const name = 'story-choices'

/** 需要提示词注册表、命令注册表和会话投影注册表。 */
export const inject = ['systemPrompt', 'commands', 'sessionProjections']

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx 预设作用域上下文
 */
export function apply(ctx) {
  ctx.effect(() => ctx.sessionProjections.register(choicesProjection), 'story-choices.projection()')

  ctx.effect(
    () =>
      ctx.systemPrompt.context({
        name: 'story:choices',
        // 排在默认上下文（100–210）之后。
        order: 300,
        required: true,
        text: (context) => {
          const agent = context?.agent
          if (agent === undefined) return ''
          try {
            const state = ctx.sessionProjections.stateOf(agent.session, PROJECTION_KEY)
            return state !== undefined && state.active === true ? CHOICES_INSTRUCTION : ''
          } catch {
            return ''
          }
        },
      }),
    'story-choices.context()',
  )

  ctx.effect(
    () =>
      ctx.commands.register({
        definitionId: 'dsh-story-mode/choices',
        name: 'choices',
        description: '开启或关闭「三条走向」：每轮结尾依据上轮剧情给出三条走向选择',
        input: { hint: '[on|off]' },
        handler: ({ rawInput }) => {
          const mode = rawInput.trim().toLowerCase()
          if (mode !== 'on' && mode !== 'off') {
            return { kind: 'error', text: '用法：/choices on 开启，/choices off 关闭。' }
          }
          return {
            kind: 'success',
            text: mode === 'on' ? '已开启「三条走向」：下一轮起，AI 会在结尾给出三条走向。' : '已关闭「三条走向」。',
          }
        },
      }),
    'story-choices.command()',
  )
}
