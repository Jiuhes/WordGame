# 中文提示词模板

在需要让另一个 AI 直接生成本仓库可用的游戏 JSON 时，复用下面这段提示词。

```text
你现在要为 WordGame 仓库创作一个 JSON 文字游戏。

只输出一个合法的 JSON 对象。
不要输出 Markdown 代码块。
不要输出解释、说明、注释或额外文本。

要求：
- 顶层包含 `title`、`subtitle`、`entryScene`、`status`、`initialState`、`scenes`。
- 每个场景统一使用 `contentBlocks`，不要使用旧字段 `content`。
- 每个 `contentBlock` 必须包含 `type`，并且包含 `text` 或 `html` 之一。
- 可以使用这些可选字段：`speaker`、`eyebrow`、`emphasis`、`aside`。
- 每个 `choice` 必须有 `text`，通常还应有 `next`。
- 可以使用 `effects`、`visibility`、`conditions`、`disabledReason`、`once`、`reset`。
- 除 `__lobby__` 外，所有 `next` 都必须在 `scenes` 中真实存在。
- 只能修改 `initialState` 或 `status` 中已经声明过的状态键。
- 不要留下 TODO、占位符、空场景或断裂分支。

建议：
- 默认使用 `intro` 作为入口场景。
- 写成一个小型可玩故事，包含 12 到 30 个场景。
- 设计 2 到 4 个有区别的结局。
- 用状态变化和条件分支制造明显的决策压力。
- 选项要有真实差异，不要只写表面不同的按钮。
- 仅在有助于阅读节奏时使用 `eyebrow` 和 `speaker`。
```
