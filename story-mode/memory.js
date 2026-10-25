/**
 * 故事模式 · 记忆管理（Host 端）。
 *
 * - `/memory {"character":"D:\\角色","world":"D:\\箱庭"}` 保存两个记忆目录；
 * - `storyMemory` 会话投影从命令事件里折叠出配置，刷新 / 重开 / fork 后自动恢复；
 * - 一条 required 运行时上下文：每次组装请求时**同步读取两个目录下的全部 .md**，
 *   把内容注入提示词，实现「配置后模型每轮必须先读取全部记忆」。
 *
 * 角色记忆 ≈ 酒馆角色卡；箱庭记忆 ≈ 沙盒化酒馆世界书。所有记忆均为 .md 文件，
 * 目录内的子目录会被递归读取。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'

const PROJECTION_KEY = 'storyMemory'
const COMMAND_NAME = 'memory'

/** 单次最多读取的文件数，超出部分忽略并在注入文本里提示。 */
const MAX_FILES = 200
/** 单次注入的总字符上限，避免一次吃光上下文。 */
const MAX_CHARS = 120000

/** 从命令参数里解析 `{"character": "...", "world": "..."}`。 */
function parsePayload(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return undefined
  let value
  try {
    value = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const character = value.character
  const world = value.world
  if (typeof character !== 'string' || typeof world !== 'string') return undefined
  return { character: character.trim(), world: world.trim() }
}

export function isDirectory(path) {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/** 会话的工作目录；服务不可用时退回进程目录。 */
export function workspaceRootOf(ctx, session) {
  try {
    const workingDirectory = ctx.get('workingDirectory')
    const cwd = workingDirectory?.get(session)
    if (typeof cwd === 'string' && cwd !== '') return cwd
  } catch {
    /* 工作目录服务不可用时退回进程目录 */
  }
  return process.cwd()
}

/** 相对路径按会话工作目录解析；绝对路径原样使用。 */
export function resolveMemoryRoot(ctx, session, raw) {
  if (raw === '') return ''
  const base = workspaceRootOf(ctx, session)
  return isAbsolute(raw) ? raw : resolve(base, raw)
}

/** 递归收集目录下的 .md 文件（按路径排序，结果稳定）。 */
export function collectMarkdown(root) {
  const files = []
  let truncated = false
  const walk = (dir) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    for (const entry of entries) {
      if (files.length >= MAX_FILES) {
        truncated = true
        return
      }
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) files.push(full)
    }
  }
  walk(root)
  return { files, truncated }
}

const initialMemoryState = () => ({
  character: '',
  world: '',
  running: null,
  view: { character: '', world: '' },
})

const memoryProjection = {
  key: PROJECTION_KEY,
  stateVersion: 1,
  // 运行时只需要 .parse()；状态完全由本插件写入。
  stateSchema: { parse: (value) => value },
  init: () => initialMemoryState(),
  apply: (state, event) => {
    if (event.type === 'command/run' && event.data.name === COMMAND_NAME) {
      const payload = parsePayload(event.data.args)
      if (payload === undefined) return state
      return { ...state, running: { commandId: event.data.commandId, payload } }
    }
    if (event.type === 'command/done' && state.running !== null && event.data.commandId === state.running.commandId) {
      if (event.data.kind !== 'success') return { ...state, running: null }
      const payload = state.running.payload
      return {
        ...state,
        character: payload.character,
        world: payload.world,
        running: null,
        view:
          state.view.character === payload.character && state.view.world === payload.world
            ? state.view
            : { character: payload.character, world: payload.world },
      }
    }
    return state
  },
  wire: {
    viewSchema: { parse: (value) => value },
    view: (state) => state.view,
  },
}

export const name = 'story-memory'

export const inject = ['systemPrompt', 'commands', 'sessionProjections']

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx 预设作用域上下文
 */
export function apply(ctx) {
  const resolveRoot = (session, raw) => resolveMemoryRoot(ctx, session, raw)

  const renderMemory = (session, state) => {
    const sections = []
    let total = 0
    let dropped = 0

    for (const [key, label] of [
      ['character', '角色记忆'],
      ['world', '箱庭记忆'],
    ]) {
      const raw = state[key]
      if (raw === '') continue
      const root = resolveRoot(session, raw)
      if (!isDirectory(root)) {
        sections.push(`## ${label}（${raw}）\n（目录不可访问）`)
        continue
      }
      const { files, truncated } = collectMarkdown(root)
      const body = []
      for (const file of files) {
        let text = ''
        try {
          text = readFileSync(file, 'utf8')
        } catch {
          continue
        }
        if (text.trim() === '') continue
        if (total + text.length > MAX_CHARS) {
          dropped += 1
          continue
        }
        total += text.length
        body.push(`### ${relative(root, file)}\n${text.trim()}`)
      }
      const notes = []
      if (truncated) notes.push(`文件数超过 ${MAX_FILES} 个，只读取了前 ${MAX_FILES} 个`)
      if (dropped > 0) notes.push(`另有 ${dropped} 个文件超过总字数上限未读取`)
      const note = notes.length === 0 ? '' : `\n（${notes.join('；')}）`
      const head = `## ${label}（${raw}）`
      sections.push(body.length === 0 ? `${head}${note}\n（目录内没有可读取的 .md 文件）` : `${head}${note}\n\n${body.join('\n\n')}`)
    }

    if (sections.length === 0) return ''
    return [
      '【记忆档案 · 每轮必读】',
      '以下是玩家为这段故事配置的记忆文件。回复前必须完整阅读并严格遵守：人物设定、世界设定与既有事实以它们为准，不要与记忆冲突。不要把记忆原文复述给玩家，只在叙事中自然地保持一致性。',
      '',
      sections.join('\n\n'),
    ].join('\n')
  }

  ctx.effect(() => ctx.sessionProjections.register(memoryProjection), 'story-memory.projection()')

  ctx.effect(
    () =>
      ctx.systemPrompt.context({
        name: 'story:memory',
        order: 310,
        required: true,
        text: (context) => {
          const agent = context?.agent
          if (agent === undefined) return ''
          try {
            const state = ctx.sessionProjections.stateOf(agent.session, PROJECTION_KEY)
            if (state === undefined) return ''
            if (state.character === '' && state.world === '') return ''
            return renderMemory(agent.session, state)
          } catch {
            return ''
          }
        },
      }),
    'story-memory.context()',
  )

  ctx.effect(
    () =>
      ctx.commands.register({
        definitionId: 'dsh-story-mode/memory',
        name: COMMAND_NAME,
        description: '设置角色记忆与箱庭记忆目录（.md），并立即刷新',
        input: { hint: '{"character":"目录","world":"目录"}' },
        handler: ({ agent, rawInput }) => {
          const payload = parsePayload(rawInput)
          if (payload === undefined) {
            return { kind: 'error', text: '参数格式错误：请从记忆管理面板点击「确认并刷新」，或传入 {"character":"目录","world":"目录"}。' }
          }
          const problems = []
          const summaries = []
          for (const [key, label] of [
            ['character', '角色记忆'],
            ['world', '箱庭记忆'],
          ]) {
            const raw = payload[key]
            if (raw === '') {
              summaries.push(`${label}：未设置`)
              continue
            }
            const root = resolveRoot(agent.session, raw)
            if (!isDirectory(root)) {
              problems.push(`${label}目录不存在或不是文件夹：${raw}`)
              continue
            }
            const { files, truncated } = collectMarkdown(root)
            summaries.push(`${label}：${files.length} 个 .md${truncated ? `（超过 ${MAX_FILES} 个，只读取前 ${MAX_FILES} 个）` : ''}`)
          }
          if (problems.length > 0) return { kind: 'error', text: problems.join('；') }
          return { kind: 'success', text: `记忆位置已保存，下一轮起每轮读取。${summaries.join('；')}` }
        },
      }),
    'story-memory.command()',
  )

  // 默认记忆目录：工作区下的 记忆/角色 与 记忆/箱庭（与 /init-workspace 一致）。
  // 面板打开且尚未配置时用它预填输入框。
  ctx.effect(
    () =>
      ctx.commands.register({
        definitionId: 'dsh-story-mode/memory-defaults',
        name: 'memory-defaults',
        description: '返回默认记忆目录（工作区下的 记忆/角色 与 记忆/箱庭）',
        handler: ({ agent }) => {
          const root = workspaceRootOf(ctx, agent?.session)
          return {
            kind: 'success',
            text: JSON.stringify({ character: join(root, '记忆', '角色'), world: join(root, '记忆', '箱庭') }),
          }
        },
      }),
    'story-memory.defaults()',
  )
}
