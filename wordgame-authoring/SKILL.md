---
name: wordgame-authoring
description: 为这个 WordGame 仓库创建、扩写、修复或重构 JSON 文字游戏。用于需要新增游戏、注册到 `data/games.json`、编写或修改场景树、创作 `contentBlocks`、加入条件分支，或按本仓库的 schema 与校验流程整理游戏内容时。
---

# WordGame 游戏创作

按这个仓库现有的 JSON 运行时规范创建或修改游戏。

## 执行流程

1. 先读 [references/project-workflow.md](references/project-workflow.md)。
2. 如果是新游戏，创建 `data/games/<id>.json`，并在 `data/games.json` 里注册。
3. 如果是修改旧游戏，除非用户明确要求重构，否则保持已有可达场景、状态键和入口场景不被破坏。
4. 场景正文统一使用 `contentBlocks`，不要再写旧的 `content`。
5. 保证所有 `choice.next` 都能指向真实场景，或者明确使用 `__lobby__`。
6. 内容改完后运行 `node scripts/validate-content.mjs`。
7. JSON 改动较大时，顺手运行 `npm.cmd run format:check`。

## 仓库约定

- 游戏 id 只能使用小写字母、数字、`_`、`-`。
- 默认入口场景用 `intro`，除非该游戏确实需要别的入口。
- 所有会变化的状态写进 `initialState`。
- 所有需要展示给玩家看的状态条写进 `status`。
- `effects` 只能修改已经声明过的状态键。
- `visibility` 表示隐藏选项，`conditions` 表示显示但禁用，`once` 表示只能成功执行一次。
- 需要让玩家看到“为什么现在不能选”时，补上 `disabledReason`。
- 优先写少量但有意义的分支，不要堆无效岔路。

## 内容编写规则

- 场景文本必须完整，不要留下 `TODO`、占位符或断头分支。
- 用 `contentBlocks` 控制叙事节奏，按需要组合 `narrator`、`danger`、`safe`、`clue`、`item`、`ghost`、`dialogue` 等类型。
- 只有在能提升阅读体验时才使用这些可选字段：
  - `eyebrow`
  - `speaker`
  - `emphasis`
  - `aside`
- 这些可选字符串一旦出现就必须非空，否则校验会失败。

## 可读资料

- [references/project-workflow.md](references/project-workflow.md)：项目结构、数据规则、校验命令、交付检查项。
- [references/prompt-template.md](references/prompt-template.md)：让另一个 AI 按本仓库格式直接生成游戏 JSON 的中文提示词模板。

## 交付要求

完成后说明：

- 改了哪个游戏文件，或者新建了哪个文件
- 是否更新了 `data/games.json`
- 跑了哪些校验命令
- 还剩下哪些有意保留的内容债务或后续分支工作
