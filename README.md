# 故事模式（Story Mode）· DeepSeek Harness 预设 Bundle

把 DeepSeek Harness 的会话变成**互动小说 / 角色扮演**：AI 不再扮演编码助手，而是叙事者与主持人（GM），
由玩家用自然语言或选项推动剧情。所有能力都打包成一个可安装的 DSH bundle。

## 功能一览

| 能力 | 说明 |
| --- | --- |
| **故事模式预设** | 新建会话时选择「故事模式」，系统提示只保留叙事规则，并屏蔽全部编码/系统工具。 |
| **三条走向** | 输入框上方的开关：开启后每轮结尾依据上轮剧情给出恰好三条走向（可随时 `/choices on` / `off`）。 |
| **记忆管理** | 角色目录（≈ 酒馆角色卡）与箱庭目录（≈ 世界书），全部 `.md`，每轮自动全量读取；未配置时预填默认目录。 |
| **上下文提纯** | 上下文占用 ≥ 80%（或点 Test）时，调用模型把剧情整理成角色/箱庭状态，窗口内可改写，确认后写回记忆文件。 |
| **前后置提示词** | 整个请求被 `settings/front.txt`（系统提示词开头）与 `settings/end.txt`（最后一条消息之后）前后包裹，改文件即生效。 |
| **工作区初始化** | 一键创建 `settings/`、`记忆/角色`、`记忆/箱庭` 及起始 `.md` 模板，幂等不覆盖。 |

## 目录结构

```text
.
├─ README.md               # 本文件
├─ LICENSE                 # MIT
├─ .gitignore
├─ .gitattributes
├─ assets/
│  └─ icon-180.png         # 插件市场卡片图标（GitHub 托管位图）
└─ story-mode/             # 可安装的 DSH bundle
   ├─ package.json         # 名称、exports、dsh.bundle / dsh.client 声明
   ├─ cordis.patch.yml     # 预设与插件行
   ├─ index.js             # bundle 的 Host 入口（空 apply）
   ├─ client.js            # 浏览器端：输入框上方的全部控件
   ├─ choices.js           # 三条走向
   ├─ memory.js            # 记忆目录、每轮注入、默认目录
   ├─ purify.js            # 上下文提纯
   ├─ prompt-wrap.js       # 前后置提示词
   ├─ scaffold.js          # 工作区初始化
   ├─ story-guard.js       # 屏蔽部署级全局工具
   ├─ icon.svg             # 插件图标（DSH 插件页）
   ├─ locale/              # 插件显示名与描述（zh / en）
   └─ README.md            # 插件详细说明（实现、命令、数据流）
```

## 安装

需要 DSH 桌面版 / Web 版，以及一个可用的模型账号。

- GitHub：<https://github.com/starkingcn/dsh-story>
- npm：`dsh-story-mode`

安装方式任选其一：

```sh
# 从 npm（推荐，预构建、免构建授权）
dsh plugin add dsh-story-mode
```

```text
# 或从本仓库的本地目录安装（开发时）
plugin_manager install_bundle <本仓库绝对路径>\story-mode
```

安装后：

1. **重启 DSH**（宿主侧新增命令需要重启；仅改客户端时刷新页面即可）；
2. 新建会话，在 **Agent 预设** 里选择 **故事模式**。

> 旧会话保留创建时的插件版本，验证改动请用新会话。

## 使用

- 直接输入题材（如「悬疑，雨夜旅馆」）或 `开始`；
- 输入框上方从左到右：`文件夹+`（初始化工作区）、`Test`（手动提纯）、`齿轮`（记忆管理）、`走向开关`；
- 常用命令：`/choices on|off`、`/memory {...}`、`/purify`、`/purify-apply {...}`、`/init-workspace`。

详细实现与数据流见 [story-mode/README.md](story-mode/README.md)。

## 工作区数据

「初始化工作区」会在**当前会话的工作目录**下创建：

```text
settings/front.txt      前后置提示词
settings/end.txt
记忆/角色/*.md           角色记忆（含 状态提纯.md）
记忆/箱庭/*.md           箱庭记忆（含 状态提纯.md）
```

这些是个人创作内容，默认被 `.gitignore` 排除；想随仓库版本化时，删掉对应忽略规则即可。

## 开发

```text
plugin_manager remove_bundle dsh-story-mode
plugin_manager install_bundle <绝对路径>\story-mode
```

- 宿主侧改动（`*.js` 里的 `apply`、`cordis.patch.yml`）：重装后**重启 DSH**；
- 客户端改动（`client.js`）：重装后**刷新页面**；
- 版本号写在 `story-mode/package.json`，改动后建议同步递增。

## 发布到插件市场

1. `cd story-mode && npm publish`（包名 `dsh-story-mode`，MIT）；
2. 推 GitHub 并给仓库加 `dsh-plugin` topic（仓库需创建满 1 天）；
3. 到 <https://github.com/awesome-dsh-plugin/awesome-dsh-plugin> 新建
   `data/plugins/starkingcn__dsh-story.yml`：

```yaml
url: https://github.com/starkingcn/dsh-story
name: starkingcn/dsh-story
category: agi
description:
  en: 'Story Mode preset for DeepSeek Harness: role-play GM persona, three-way choices, .md character cards and world book, context distillation and prompt wrapping.'
  zh: '面向 DeepSeek Harness 的故事模式预设：叙事 GM 人格、三条走向、.md 角色卡与世界书记忆、上下文提纯与前后置提示词。'
icon: https://raw.githubusercontent.com/starkingcn/dsh-story/main/assets/icon-180.png
```

合并后站点与索引自动重建，`dshmarket` / 官方 Discover 都会收录。

## 已知限制

- 故事模式里没有工具调用（`story-guard` 主动屏蔽），模型只输出文本；
- 记忆文件每轮同步读取，单次上限 200 个文件 / 12 万字符；
- 提纯**不自动清理上下文**，需要重置会话请自行新建会话或使用 `/compact`；
- 内存态（如压缩服务）依赖预设内的 `compaction` 组，不要单独移除。

## 许可

[MIT](LICENSE) © 2026 starkingcn
