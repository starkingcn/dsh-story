# 开发与发布

本文件面向维护者，不进入对外 README。

## 本地开发

```text
plugin_manager remove_bundle dsh-story-mode
plugin_manager install_bundle <绝对路径>\story-mode
```

- 宿主侧改动（`*.js` 里的 `apply`、`cordis.patch.yml`）：重装后**重启 DSH**；
- 客户端改动（`client.js`）：重装后**刷新页面**；
- 版本号写在 `story-mode/package.json`，改动后建议同步递增。

## 维护注意

- 预设里的 `compaction` 组提供上下文压缩服务（`isolate` 隔离），**不要单独移除**；
- `persona` 的 `prefix` 引用了 `{{story_front}}` 变量，`prompt-wrap` 插件不能被单独移除，
  否则提示词渲染会因变量缺失报错；
- `story-guard` 必须保持在预设 `plugins` 列表的第一位，否则会误把预设自身的工具也屏蔽掉。

## 发布到插件市场

1. `cd story-mode && npm publish`（包名 `dsh-story-mode`，MIT）；
2. 给 GitHub 仓库加 `dsh-plugin` topic；
3. 到 <https://github.com/awesome-dsh-plugin/awesome-dsh-plugin> 新建
   `data/plugins/starkingcn__dsh-story--story-mode.yml`
   （插件在子目录，按 monorepo 子包形式填写）：

```yaml
url: https://github.com/starkingcn/dsh-story/tree/main/story-mode
name: starkingcn/dsh-story#story-mode
category: agi
description:
  en: 'Story Mode preset for DeepSeek Harness: role-play GM persona, three-way choices, .md character cards and world book, context distillation and prompt wrapping.'
  zh: '面向 DeepSeek Harness 的故事模式预设：叙事 GM 人格、三条走向、.md 角色卡与世界书记忆、上下文提纯与前后置提示词。'
icon: https://raw.githubusercontent.com/starkingcn/dsh-story/main/assets/icon-180.png
```

合并后站点与索引自动重建，`dshmarket` / 官方 Discover 都会收录。
