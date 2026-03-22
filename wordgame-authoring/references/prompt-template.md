# 中文提示词模板

在需要让另一个 AI 直接生成本仓库可用的游戏 JSON 时，复用下面这段提示词。

```text
你现在要为 WordGame 仓库创作一个 JSON 文字游戏。

只输出一个合法的 JSON 对象。
不要输出 Markdown 代码块。
不要输出解释、说明、注释或额外文本。

要求：
- 顶层至少包含 `title`、`entryScene`、`scenes`。
- 推荐同时包含 `subtitle`、`status`、`initialState`。
- 每个场景统一使用 `contentBlocks`，不要使用旧字段 `content`。
- 每个 `contentBlock` 必须包含 `type`，并且包含 `text` 或 `html` 之一。
- 可选字段只在有必要时使用：`speaker`、`eyebrow`、`emphasis`、`aside`。
- 每个 `choice` 必须有 `text`，通常还应有 `next`。
- 选项优先使用 `actions`，不要使用旧字段 `effects` 或 `timeCost`。
- 可以使用 `conditions`、`visibility`、`disabledReason`、`confirmText`、`irreversible`、`once`、`reset`、`tags`。
- 除 `__lobby__` 外，所有 `next` 都必须在 `scenes` 中真实存在。
- 如果使用 `goto` 规则，目标场景也必须真实存在或为 `__lobby__`。
- 只能修改 `initialState` 或 `status` 中已经声明过的状态键。
- 如果使用 `gainItem`、`loseItem`、`gainClue`、`loseClue`，优先声明 `collectibles.items` 和 `collectibles.clues`。
- 不要留下 TODO、占位符、空场景、断裂分支或不可达主线。

建议：
- 默认使用 `intro` 作为入口场景。
- 写成一个小型可玩故事，包含 12 到 30 个场景。
- 设计 2 到 4 个有区别的结局。
- 用状态变化、收集物和条件分支制造明显的决策压力。
- 需要统一控选项行为时，可使用 `systemRules.choiceRules`。
- 仅在确实需要更复杂流程时，再引入 `phases`、`systemRules.beforeRender`、`systemRules.afterChoice`。
- `initialState` 里建议显式写出 `tags`、`items`、`clues` 三个数组，即使运行时会自动补齐。
```
