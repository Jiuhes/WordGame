# WordGame

一个基于 JSON 数据驱动的文字游戏项目。

项目当前提供：

- 游戏大厅与多游戏入口
- 本地 JSON、链接地址、粘贴 JSON 的快速导入试玩
- JSON 场景运行时
- 条件分支、隐藏选项、一次性选项
- 阶段切换、系统规则、选项级规则
- 物品与线索收集、自动存档、结局统计、本地设置
- 纯本地 Tailwind 样式构建

## 启动方式

这是一个静态前端项目，使用任意本地静态服务器打开 [game.html](d:/Code/Game/WordGame/game.html) 即可。

如果只需要样式构建与内容校验，可直接运行：

```powershell
npm.cmd run build:css
npm.cmd run validate:content
```

## 常用命令

```powershell
npm.cmd run build:css
npm.cmd run watch:css
npm.cmd run validate:content
npm.cmd run lint:content
npm.cmd run find:placeholders
npm.cmd run find:duplicate-copy
npm.cmd run find:undeclared-keys
npm.cmd run format:check
npm.cmd run new:game -- <id> <name> [icon] [category] [desc]
```

## 项目结构

```text
assets/
  css/                  Tailwind 样式源码与构建产物
  js/                   运行时、大厅、导入试玩入口与核心逻辑
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

每个游戏至少包含：

- `title`
- `entryScene`
- `scenes`

常见可选顶层字段：

- `subtitle`
- `status`
- `initialState`
- `phases`
- `systemRules`
- `collectibles`

### `scenes`

每个场景通常包含：

- `title`
- `contentBlocks`
- `choices`
- 可选 `conditions`
- 可选 `disabledReason`
- 可选 `tags`

新内容统一使用 `contentBlocks`，不要再使用旧的 `content`。

### `contentBlocks`

每个 block 必须包含：

- `type`
- `text` 或 `html` 之一

可选字段：

- `speaker`
- `eyebrow`
- `emphasis`
- `aside`

内置 `type` 见 [game.schema.json](d:/Code/Game/WordGame/schemas/game.schema.json)，常用值包括 `narrator`、`dialogue`、`danger`、`safe`、`clue`、`item`、`ghost` 和 `raw-html`。

### `choices`

每个选项必须包含：

- `text`

常见字段：

- `next`
- `actions`
- `conditions`
- `visibility`
- `disabledReason`
- `confirmText`
- `irreversible`
- `once`
- `reset`
- `tags`

推荐使用显式 `actions`，例如：

- `advanceTime`
- `adjust`
- `set`
- `addTag` / `removeTag`
- `gainItem` / `loseItem`
- `gainClue` / `loseClue`
- `pushUnique` / `removeValue`

### 状态、物品与线索

所有会变化的状态都应先声明在 `initialState` 中；所有需要展示给玩家的状态条都应写进 `status`。

运行时会自动补齐 3 个常用集合状态：

- `tags: []`
- `items: []`
- `clues: []`

`collectibles.items` 与 `collectibles.clues` 可用于声明可收集实体，配合 `gainItem`、`gainClue`、`loseItem`、`loseClue` 与 `includes`、`notIncludes` 条件使用。

### 高级规则

- `phases` 用条件表达式驱动阶段切换
- `systemRules.beforeRender` / `systemRules.afterChoice` 可做全局规则与自动跳转
- `systemRules.choiceRules` 可按标签、场景或目标场景统一隐藏/禁用某类选项

## 废弃写法

当前内容应避免继续使用以下旧字段：

- 场景 `content`
- 选项或规则里的 `effects`
- 选项里的 `timeCost`

校验脚本会直接提示这些字段需要迁移到 `contentBlocks`、`actions` 和 `actions.advanceTime`。

## 新增或修改游戏

可以手动创建 `data/games/<id>.json`，并同步更新 `data/games.json`。

也可以使用项目脚手架：

```powershell
npm.cmd run new:game -- <id> <name> [icon] [category] [desc]
```

新增或修改游戏后，至少运行一次：

```powershell
npm.cmd run validate:content
```

改动较大时建议再跑：

```powershell
npm.cmd run format:check
```

## AI 技能

根目录包含一个项目专用技能目录 [wordgame-authoring](d:/Code/Game/WordGame/wordgame-authoring)，用于指导 AI 按本仓库规范创建、扩写或修复游戏内容。

关键文件：

- [SKILL.md](d:/Code/Game/WordGame/wordgame-authoring/SKILL.md)
- [project-workflow.md](d:/Code/Game/WordGame/wordgame-authoring/references/project-workflow.md)
- [prompt-template.md](d:/Code/Game/WordGame/wordgame-authoring/references/prompt-template.md)
