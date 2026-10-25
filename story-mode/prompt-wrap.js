/**
 * 故事模式 · 前后置提示词（Host 端）。
 *
 * 包裹位置从「输入消息」移到了「整个请求的最外层」：
 *
 * - `settings/front.txt` → 系统提示词的最前面（人格段落开头的 `{{story_front}}` 变量，
 *   每次组装请求时读取，改完立即生效）；
 * - `settings/end.txt` → 请求的最末尾（order 最大的 required 运行时上下文，
 *   追加在最后一条消息之后，也就是所有输出之外）。
 *
 * 这样整段对话被 front / end 夹在中间，而不是只包住最新一条输入。
 * 注意：人格配置里引用了变量 `story_front`，因此 `prompt-wrap` 不能被单独移除。
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { workspaceRootOf } from './memory.js'

/** 工作区下存放前后置提示词的目录与文件名。 */
const SETTINGS_DIR = 'settings'
const FRONT_FILE = 'front.txt'
const END_FILE = 'end.txt'

/** 人格模板里引用的变量名。 */
const FRONT_VARIABLE = 'story_front'
/** 末尾上下文的名称与排序（排在所有上下文之后）。 */
const END_CONTEXT = 'story:prompt-end'
const END_ORDER = 999999999
/** 单个文件最多读取的字符数，避免误放大文件。 */
const MAX_CHARS = 65536

/** 读取工作区 settings 下的文本文件；不存在或读取失败返回空串。 */
function readTextFile(root, file) {
  try {
    const text = readFileSync(join(root, SETTINGS_DIR, file), 'utf8')
    const normalized = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
    return normalized.length > MAX_CHARS ? normalized.slice(0, MAX_CHARS) : normalized
  } catch {
    return ''
  }
}

export const name = 'story-prompt-wrap'

export const inject = ['systemPrompt']

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx 预设作用域上下文
 */
export function apply(ctx) {
  // 前置：人格段落的 {{story_front}}，位于系统提示词最前面。
  ctx.effect(
    () =>
      ctx.systemPrompt.variable(FRONT_VARIABLE, (context) => {
        const agent = context?.agent
        if (agent === undefined) return ''
        return readTextFile(workspaceRootOf(ctx, agent.session), FRONT_FILE)
      }),
    'story-prompt-wrap.front()',
  )

  // 后置：required 运行时上下文，order 最大，渲染在最后一条消息之后。
  ctx.effect(
    () =>
      ctx.systemPrompt.context({
        name: END_CONTEXT,
        order: END_ORDER,
        required: true,
        text: (context) => {
          const agent = context?.agent
          if (agent === undefined) return ''
          return readTextFile(workspaceRootOf(ctx, agent.session), END_FILE)
        },
      }),
    'story-prompt-wrap.end()',
  )
}
