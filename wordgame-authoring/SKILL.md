---
name: wordgame-authoring
description: 为这个 WordGame 仓库创建、扩写、修复或重构 JSON 文字游戏。用于需要新增游戏、注册到 `data/games.json`、编写或修改场景树、创作 `contentBlocks`、设计 `actions`、补充 `phases`、`systemRules`、`collectibles`，或按本仓库 schema 与校验流程整理游戏内容时。
---

# WordGame 游戏创作

按这个仓库当前运行时与校验脚本的真实规则创建或修改游戏。

## 执行流程

1. 先读 [references/project-workflow.md](references/project-workflow.md)。
2. 判断是新增游戏还是修改已有游戏。
3. 新游戏要创建 `data/games/<id>.json`，并同步更新 `data/games.json`。
4. 修改旧游戏时，除非用户明确要求重构，否则不要破坏已有入口场景、可达路径、状态键与结局流向。
5. 场景正文统一使用 `contentBlocks`，选项与规则统一使用 `actions`，不要继续写 `content`、`effects`、`timeCost`。
6. 需要复杂推进时，优先利用 `phases`、`systemRules`、`collectibles` 和 `choices.tags`，不要用重复场景硬堆分支。
7. 内容改完后运行 `npm.cmd run validate:content`；改动较大时再运行 `npm.cmd run format:check`。

## 仓库约定

- 游戏 id 只使用小写字母、数字、`_`、`-`。
- 默认入口场景使用 `intro`，除非该游戏确实需要别的入口。
- 所有会变化的状态写进 `initialState`。
- 所有需要展示给玩家看的状态条写进 `status`。
- `tags`、`items`、`clues` 会由运行时补齐，但只要逻辑依赖它们，仍建议在 `initialState` 中显式写出。
- `conditions` 表示显示但禁用，`visibility` 表示直接隐藏。
- 需要让玩家明确承担后果时，使用 `confirmText` 或 `irreversible`。
- 优先写少量但有意义的分支，不要堆无效岔路。

## 内容编写规则

- 场景文本必须完整，不要留下 `TODO`、占位符、空 block 或断头分支。
- `contentBlocks` 中每个 block 必须有 `type`，并提供 `text` 或 `html` 之一。
- 只有在提升阅读体验时才使用可选字段：`speaker`、`eyebrow`、`emphasis`、`aside`。
- 这些可选字符串一旦出现就必须非空，否则校验会失败。
- 每个 `choice` 至少要有 `text`；通常还应有 `next`，除非它只承担确认、重置或规则触发作用。
- 所有 `choice.next` 与规则里的 `goto` 都必须指向真实场景，或明确使用 `__lobby__`。
- 所有条件表达式引用的状态键必须已经声明。
- 对 `items`、`clues` 的收集和消耗，优先通过 `collectibles` 声明实体，再在 `actions` 与条件里引用。

## 推荐字段

- `phases`：用条件驱动阶段变化。
- `systemRules.beforeRender` / `systemRules.afterChoice`：做全局自动规则、补状态或自动跳场景。
- `systemRules.choiceRules`：按 `tags`、`sceneTags`、`next` 或 `sceneId` 批量隐藏/禁用选项。
- `choices.tags`：给选项打规则匹配标签。
- `scene.tags`：给场景打规则匹配标签。

## 可读资料

- [references/project-workflow.md](references/project-workflow.md)：项目结构、数据规则、动作与条件语义、校验命令、交付检查项。
- [references/prompt-template.md](references/prompt-template.md)：让另一个 AI 按本仓库格式直接生成游戏 JSON 的中文提示词模板。

## 交付要求

完成后说明：

- 改了哪个游戏文件，或者新建了哪个文件
- 是否更新了 `data/games.json`
- 跑了哪些校验命令
- 是否引入了 `phases`、`systemRules`、`collectibles` 等高级结构
- 还剩下哪些有意保留的内容债务或后续分支工作
