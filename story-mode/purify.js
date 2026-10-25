/**
 * 故事模式 · 上下文提纯（Host 端）。
 *
 * - `/purify`：读取当前记忆文件 + 整段对话，调用模型把角色状态与箱庭状态整理成两节 Markdown，
 *   结果作为命令返回值交给客户端（不写入会话，不进聊天记录）。
 * - `/purify-apply {"text":"…"}`：把用户确认（可能改写过）的文本按两节拆开，写入
 *   `<角色目录>/状态提纯.md` 与 `<箱庭目录>/状态提纯.md`。
 *   上下文不在这里清理，由用户自行重置会话。
 *
 * 触发时机由客户端决定：上下文占用 ≥ 80% 时自动弹窗，或点 Test 随时触发。
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { collectMarkdown, isDirectory, resolveMemoryRoot } from './memory.js'

const PURIFY_COMMAND = 'purify'
const APPLY_COMMAND = 'purify-apply'
const MEMORY_PROJECTION = 'storyMemory'

/** 提示词里最多放入的对话字符数（保留最近的）。 */
const MAX_TRANSCRIPT_CHARS = 60000
/** 提示词里最多放入的旧记忆字符数。 */
const MAX_MEMORY_CHARS = 30000
/** 写回文件的状态文件名。 */
const STATE_FILE = '状态提纯.md'

const SYSTEM_PROMPT = [
  '你是「故事模式」的记忆整理器：把一段互动叙事压缩、合并成长期可复用的记忆档案。',
  '只输出 Markdown，不要解释、不要寒暄、不要输出代码块围栏。',
  '严格使用两个二级标题：「## 角色状态」和「## 箱庭状态」。',
].join('\n')

/** 从一段消息里取出纯文本。 */
function messageText(message) {
  if (message === null || typeof message !== 'object') return ''
  const content = message.content
  if (!Array.isArray(content)) return ''
  return content
    .filter((block) => block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

/** 把会话日志渲染成「玩家 / 叙事」交替的对话记录。 */
function transcriptOf(session, limit) {
  let events = []
  try {
    if (Array.isArray(session?.log)) events = session.log
    else if (typeof session?.snapshotEvents === 'function') events = session.snapshotEvents()
  } catch {
    events = []
  }
  const parts = []
  for (const event of events) {
    if (event === null || typeof event !== 'object') continue
    if (event.type === 'user/message') {
      const source = event.data?.source
      if (source !== undefined && source !== null && source.kind !== 'user') continue
      const text = messageText(event.data)
      if (text !== '') parts.push(`【玩家】${text}`)
      continue
    }
    if (event.type === 'assistant/message') {
      const text = messageText(event.data?.message)
      if (text !== '') parts.push(`【叙事】${text}`)
    }
  }
  let joined = parts.join('\n\n')
  if (joined.length > limit) joined = `……（更早的内容已省略）\n\n${joined.slice(-limit)}`
  return joined
}

/** 读取配置目录下的全部记忆，拼成提示词里的「当前记忆」。 */
function currentMemoryText(ctx, session, state) {
  const sections = []
  let budget = MAX_MEMORY_CHARS
  for (const [key, label] of [
    ['character', '角色记忆'],
    ['world', '箱庭记忆'],
  ]) {
    const raw = typeof state?.[key] === 'string' ? state[key] : ''
    if (raw === '') continue
    const root = resolveMemoryRoot(ctx, session, raw)
    if (!isDirectory(root)) {
      sections.push(`### ${label}\n（目录不可访问：${raw}）`)
      continue
    }
    const { files } = collectMarkdown(root)
    const parts = []
    for (const file of files) {
      let text = ''
      try {
        text = readFileSync(file, 'utf8')
      } catch {
        continue
      }
      if (budget <= 0) break
      if (text.length > budget) text = `${text.slice(0, budget)}\n（已截断）`
      budget -= text.length
      parts.push(`#### ${relative(root, file)}\n${text.trim()}`)
    }
    sections.push(parts.length === 0 ? `### ${label}\n（目录内暂无 .md 文件）` : `### ${label}\n${parts.join('\n\n')}`)
  }
  return sections.join('\n\n')
}

function userPrompt(memoryText, transcript) {
  return [
    '## 当前记忆（可能为空）',
    memoryText === '' ? '（尚未建立任何记忆）' : memoryText,
    '',
    '## 对话记录',
    transcript === '' ? '（暂无对话）' : transcript,
    '',
    '## 任务',
    '阅读对话记录，把角色状态与箱庭（世界）状态整理成更新后的版本：',
    '',
    '## 角色状态',
    '（主角与重要角色：身份、外貌、性格、关系、当前处境、掌握的信息、持有的物品、状态变化。只保留仍然有效的要点。）',
    '',
    '## 箱庭状态',
    '（世界的规则、地点、势力、时间线、已发生的关键事件、未解决的悬念与伏笔。）',
    '',
    '要求：合并旧记忆与新进展，去掉重复、过时或已被推翻的信息；不要编造未发生的事；',
    '除这两个小节外不要输出任何内容。',
  ].join('\n')
}

/** 解析 `{"text": "..."}`。 */
function parseApplyPayload(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return undefined
  let value
  try {
    value = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (value === null || typeof value !== 'object' || typeof value.text !== 'string') return undefined
  return { text: value.text }
}

/** 按「## 角色状态」「## 箱庭状态」拆成两节。 */
function splitSections(text) {
  const out = { character: [], world: [] }
  let current = null
  for (const line of text.split(/\r?\n/)) {
    const match = /^#{1,3}\s*(角色状态|箱庭状态)\s*$/.exec(line.trim())
    if (match !== null) {
      current = match[1] === '角色状态' ? 'character' : 'world'
      continue
    }
    if (current !== null) out[current].push(line)
  }
  return {
    character: out.character.join('\n').trim(),
    world: out.world.join('\n').trim(),
  }
}

export const name = 'story-purify'

export const inject = ['commands', 'sessionProjections']

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx 预设作用域上下文
 */
export function apply(ctx) {
  const memoryStateOf = (session) => {
    try {
      return ctx.sessionProjections.stateOf(session, MEMORY_PROJECTION)
    } catch {
      return undefined
    }
  }

  /** 当前会话使用的模型路由；先看会话选择，再退回全局默认。 */
  const selectionOf = (session) => {
    try {
      const state = ctx.sessionProjections.stateOf(session, 'modelSelection')
      const last = state?.lastUsed
      if (last && typeof last.provider === 'string' && typeof last.model === 'string') return last
    } catch {
      /* 投影不可用时退回默认选择 */
    }
    try {
      const selection = ctx.get('agentDefaultModel')?.currentSelection?.()
      if (selection && typeof selection.provider === 'string' && typeof selection.model === 'string') return selection
    } catch {
      /* 没有默认模型 */
    }
    return undefined
  }

  ctx.effect(
    () =>
      ctx.commands.register({
        definitionId: 'dsh-story-mode/purify',
        name: PURIFY_COMMAND,
        description: '提纯上下文：把对话整理成角色状态与箱庭状态（返回结果供编辑确认）',
        handler: async ({ agent, signal }) => {
          const state = memoryStateOf(agent.session)
          if (state === undefined || (state.character === '' && state.world === '')) {
            return { kind: 'error', text: '还没有配置记忆目录：请点输入框上方的齿轮 → 记忆管理 → 填两个目录后点「确认并刷新」。' }
          }
          const llm = ctx.get('llm')
          if (llm === undefined || llm === null || typeof llm.stream !== 'function') {
            return { kind: 'error', text: '当前宿主没有可用的 LLM 服务，无法提纯。' }
          }
          const selection = selectionOf(agent.session)
          if (selection === undefined) return { kind: 'error', text: '找不到可用的模型路由，无法提纯。' }

          const memoryText = currentMemoryText(ctx, agent.session, state)
          const transcript = transcriptOf(agent.session, MAX_TRANSCRIPT_CHARS)
          const messages = [{ role: 'user', content: [{ type: 'text', text: userPrompt(memoryText, transcript) }] }]

          let text = ''
          try {
            for await (const chunk of llm.stream({
              provider: selection.provider,
              model: selection.model,
              system: SYSTEM_PROMPT,
              messages,
              maxTokens: 4096,
              signal,
            })) {
              if (chunk?.type === 'text-delta' && typeof chunk.text === 'string') text += chunk.text
              if (chunk?.type === 'finish' && chunk.reason?.kind === 'error') {
                return { kind: 'error', text: `提纯失败：${chunk.reason.failure?.message ?? '模型返回错误'}` }
              }
            }
          } catch (error) {
            if (signal?.aborted === true) return { kind: 'error', text: '提纯已取消。' }
            return { kind: 'error', text: `提纯失败：${error instanceof Error ? error.message : String(error)}` }
          }

          const draft = text.trim()
          if (draft === '') return { kind: 'error', text: '模型没有返回内容，请重试。' }
          return { kind: 'success', text: draft.slice(0, 20000) }
        },
      }),
    'story-purify.command()',
  )

  ctx.effect(
    () =>
      ctx.commands.register({
        definitionId: 'dsh-story-mode/purify-apply',
        name: APPLY_COMMAND,
        description: '把确认后的提纯文本写入记忆目录',
        input: { hint: '{"text":"…"}' },
        handler: async ({ agent, rawInput }) => {
          const payload = parseApplyPayload(rawInput)
          if (payload === undefined) return { kind: 'error', text: '参数格式错误：需要 {"text":"…"}。' }
          const state = memoryStateOf(agent.session)
          if (state === undefined) return { kind: 'error', text: '还没有配置记忆目录。' }

          const sections = splitSections(payload.text)
          const written = []
          const skipped = []
          for (const [key, label, section] of [
            ['character', '角色记忆', sections.character],
            ['world', '箱庭记忆', sections.world],
          ]) {
            const raw = typeof state[key] === 'string' ? state[key] : ''
            if (raw === '') {
              skipped.push(`${label}未配置`)
              continue
            }
            if (section === '') {
              skipped.push(`${label}缺少「${label === '角色记忆' ? '## 角色状态' : '## 箱庭状态'}」小节`)
              continue
            }
            const root = resolveMemoryRoot(ctx, agent.session, raw)
            if (!isDirectory(root)) return { kind: 'error', text: `${label}目录不可访问：${raw}` }
            try {
              writeFileSync(join(root, STATE_FILE), `# ${label === '角色记忆' ? '角色状态' : '箱庭状态'}（提纯）\n\n${section}\n`, 'utf8')
            } catch (error) {
              return { kind: 'error', text: `写入 ${label} 失败：${error instanceof Error ? error.message : String(error)}` }
            }
            written.push(`${label} → ${STATE_FILE}`)
          }

          if (written.length === 0) {
            return { kind: 'error', text: `没有可写入的内容：${skipped.join('；')}。` }
          }

          // 上下文清理交给用户自己（新建会话 / 手动重置），这里不再调用压缩服务。
          const tail = skipped.length === 0 ? '' : `（跳过：${skipped.join('；')}）`
          return { kind: 'success', text: `已写入：${written.join('；')}${tail}。上下文未清理，请自行重置会话。` }
        },
      }),
    'story-purify.apply()',
  )
}
