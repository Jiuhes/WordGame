# WordGame

一个基于 JSON 数据驱动的文字游戏项目。

项目当前提供：

- 游戏大厅与多游戏入口
- JSON 场景运行时
- 条件分支、隐藏选项、一次性选项
- 存档、统计、作者调试面板
- 纯本地 Tailwind 样式构建

## 启动方式

这是一个静态前端项目，直接用本地静态服务器打开 [game.html](d:/Code/Game/WordGame/game.html) 即可。

如果只需要样式构建与内容校验，可直接使用下面的命令：

```powershell
npm.cmd run build:css
node scripts/validate-content.mjs
```

## 常用命令

```powershell
npm.cmd run build:css
npm.cmd run watch:css
npm.cmd run format:check
node scripts/validate-content.mjs
node scripts/content-lint.mjs
node scripts/find-placeholder-scenes.mjs
node scripts/find-duplicate-copy.mjs
node scripts/find-undeclared-status-keys.mjs
```

## 项目结构

```text
assets/
  css/                  Tailwind 样式源码与构建产物
  js/                   运行时、大厅、工具面板与核心逻辑
data/
  games.json            游戏索引
  games/*.json          游戏内容
  templates/            新游戏模板
schemas/
  *.json                内容 schema
scripts/
  *.mjs                 校验、分析、迁移、脚手架脚本
wordgame-authoring/
  SKILL.md              教 AI 按本仓库规范创建游戏的技能
```

## 游戏数据约定

每个游戏通常包含：

- `title`
- `subtitle`
- `entryScene`
- `status`
- `initialState`
- `scenes`

每个场景统一使用 `contentBlocks`，不要再使用旧的 `content`。

`contentBlocks` 支持：

- 必填：`type`，以及 `text` 或 `html` 之一
- 可选：`speaker`、`eyebrow`、`emphasis`、`aside`

选项 `choices` 支持：

- `next`
- `effects`
- `visibility`
- `conditions`
- `disabledReason`
- `once`
- `reset`

## 新增游戏

可以手动创建 `data/games/<id>.json`，并同步更新 `data/games.json`。

也可以尝试项目里的脚手架：

```powershell
npm.cmd run new:game -- <id> <name> [icon] [category] [desc]
```

新增或修改游戏后，至少运行一次：

```powershell
node scripts/validate-content.mjs
```

## AI 技能

根目录包含一个项目专用技能目录 [wordgame-authoring](d:/Code/Game/WordGame/wordgame-authoring)，用于指导 AI 按本仓库规范创建或扩写游戏。

关键文件：

- [SKILL.md](d:/Code/Game/WordGame/wordgame-authoring/SKILL.md)
- [project-workflow.md](d:/Code/Game/WordGame/wordgame-authoring/references/project-workflow.md)
- [prompt-template.md](d:/Code/Game/WordGame/wordgame-authoring/references/prompt-template.md)
