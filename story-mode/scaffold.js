/**
 * 故事模式 · 工作区初始化（Host 端）。
 *
 * `/init-workspace` 按当前会话的工作目录创建其它插件需要的目录与初始文件：
 *
 * - `settings/front.txt`、`settings/end.txt`：前后置提示词（空文件，等你填内容）；
 * - `记忆/角色/角色.md`、`记忆/箱庭/箱庭.md`：记忆目录与起始模板，供「记忆管理」填入。
 *
 * 全部幂等：已存在的目录/文件一律跳过，绝不覆盖。
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { workspaceRootOf } from './memory.js'

const COMMAND_NAME = 'init-workspace'

const CHARACTER_TEMPLATE = [
  '# 角色',
  '',
  '- 名字：',
  '- 身份：',
  '- 外貌：',
  '- 性格：',
  '- 与主角的关系：',
  '- 当前处境：',
  '',
].join('\n')

const WORLD_TEMPLATE = [
  '# 箱庭（世界）',
  '',
  '- 时代与地点：',
  '- 世界规则：',
  '- 势力与人物：',
  '- 关键事件：',
  '- 未解悬念：',
  '',
].join('\n')

/** 要创建的目录（相对工作区）。 */
const DIRECTORIES = ['settings', '记忆', '记忆/角色', '记忆/箱庭']

/** 要创建的初始文件（相对工作区）与内容。 */
const FILES = [
  { path: 'settings/front.txt', content: '' },
  { path: 'settings/end.txt', content: '' },
  { path: '记忆/角色/角色.md', content: CHARACTER_TEMPLATE },
  { path: '记忆/箱庭/箱庭.md', content: WORLD_TEMPLATE },
]

export const name = 'story-scaffold'

export const inject = ['commands']

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx 预设作用域上下文
 */
export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.commands.register({
        definitionId: 'dsh-story-mode/scaffold',
        name: COMMAND_NAME,
        description: '初始化工作区：创建 settings/ 与记忆目录及初始 .md 文件（已存在则跳过）',
        handler: ({ agent }) => {
          const root = workspaceRootOf(ctx, agent?.session)
          const created = []
          const skipped = []

          for (const relative of DIRECTORIES) {
            const absolute = join(root, ...relative.split('/'))
            if (existsSync(absolute)) {
              skipped.push(`${relative}/`)
              continue
            }
            try {
              mkdirSync(absolute, { recursive: true })
              created.push(`${relative}/`)
            } catch (error) {
              return { kind: 'error', text: `创建目录 ${relative} 失败：${error instanceof Error ? error.message : String(error)}` }
            }
          }

          for (const file of FILES) {
            const absolute = join(root, ...file.path.split('/'))
            if (existsSync(absolute)) {
              skipped.push(file.path)
              continue
            }
            try {
              mkdirSync(dirname(absolute), { recursive: true })
              writeFileSync(absolute, file.content, 'utf8')
              created.push(file.path)
            } catch (error) {
              return { kind: 'error', text: `创建文件 ${file.path} 失败：${error instanceof Error ? error.message : String(error)}` }
            }
          }

          const characterDir = join(root, '记忆', '角色')
          const worldDir = join(root, '记忆', '箱庭')
          const summary =
            created.length === 0
              ? `工作区已初始化过（跳过 ${skipped.length} 项）。`
              : `已初始化：新建 ${created.length} 项${skipped.length === 0 ? '' : `，跳过 ${skipped.length} 项已存在`}。`
          return {
            kind: 'success',
            text: `${summary} 记忆目录：${characterDir} | ${worldDir}`,
          }
        },
      }),
    'story-scaffold.command()',
  )
}
