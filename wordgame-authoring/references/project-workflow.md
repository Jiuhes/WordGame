# 项目工作流

## 目标

编写能直接在这个仓库运行，并能通过现有校验脚本的 JSON 文字游戏。

## 关键文件

- 游戏索引：`data/games.json`
- 游戏正文：`data/games/<id>.json`
- 主 schema：`schemas/game.schema.json`
- 索引 schema：`schemas/games.schema.json`
- 模板：`data/templates/game.template.json`
- 校验脚本：`scripts/validate-content.mjs`
- 脚手架：`scripts/new-game.mjs`

## 新建游戏的最短路径

1. 选一个新 id，例如 `ghost-ferry`、`paper-town`。
2. 创建 `data/games/<id>.json`。
3. 在 `data/games.json` 中注册：
   - `id`
   - `file`
   - `name`
   - 可选 `icon`
   - 可选 `desc`
   - 可选 `category`
4. 设置 `entryScene`，通常为 `intro`。
5. 定义 `status` 和 `initialState`。
6. 视需求补充 `phases`、`systemRules`、`collectibles`。
7. 编写 `scenes`。
8. 运行校验。

## 顶层结构

顶层至少应包含：

- `title`
- `entryScene`
- `scenes`

常见可选字段：

- `subtitle`
- `status`
- `initialState`
- `phases`
- `systemRules`
- `collectibles`

## scene 结构

每个场景通常包含：

- `title`
- `contentBlocks`
- `choices`

可选字段：

- `conditions`
- `disabledReason`
- `tags`

新内容不要使用旧字段 `content`。

## contentBlocks 规则

每个 block 必须具备：

- `type`
- `text` 或 `html` 其中之一

可选表现字段：

- `speaker`
- `eyebrow`
- `emphasis`：`low | medium | high`
- `aside`

常用类型：

- `narrator`
- `dialogue`
- `danger`
- `safe`
- `clue`
- `item`
- `ghost`
- `boss`
- `hero`
- `rival`
- `zombie`
- `wife`
- `husband`
- `secret`
- `raw-html`

## choice 规则

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

语义约定：

- `visibility`：条件不满足时，选项直接隐藏
- `conditions`：条件不满足时，选项显示但禁用
- `once`：成功执行一次后禁用
- `reset`：常用于结局后重新开始
- `confirmText`：在执行高风险决策前二次确认
- `irreversible`：标记当前选择会锁死部分后续路径

## actions 规则

推荐动作类型：

- `advanceTime`
- `adjust`
- `set`
- `addTag` / `removeTag`
- `gainItem` / `loseItem`
- `gainClue` / `loseClue`
- `pushUnique` / `removeValue`

约束：

- `adjust`、`set`、`pushUnique`、`removeValue` 必须引用已声明状态键
- `gainItem`、`loseItem` 应引用 `collectibles.items`
- `gainClue`、`loseClue` 应引用 `collectibles.clues`

## 条件与状态规则

- 所有可变值先在 `initialState` 声明
- 所有需要展示为状态条的值同步写进 `status`
- `tags`、`items`、`clues` 虽然会自动补齐，但建议在设计复杂逻辑时显式声明
- 条件表达式支持 `eq`、`ne`、`gt`、`gte`、`lt`、`lte`、`includes`、`notIncludes`、`exists`
- 条件表达式支持递归组合：`all`、`any`、`not`
- 条件引用的键必须存在，否则校验失败

## phases 与 systemRules

- `phases`：用条件表达式声明阶段 id
- `systemRules.beforeRender`：渲染前执行的全局规则
- `systemRules.afterChoice`：选择后执行的全局规则
- `systemRules.choiceRules`：按匹配条件批量 `disable` 或 `hide` 选项
- 规则中的 `goto` 必须指向真实场景或 `__lobby__`

## collectibles

`collectibles` 可声明两类可收集对象：

- `items`
- `clues`

每项可以写成字符串 id，也可以写成对象：

- `id`
- 可选 `name`
- 可选 `description`
- 可选 `icon`

## 废弃字段

以下旧字段会被校验脚本报错，应避免继续使用：

- 场景 `content`
- 选项与规则中的 `effects`
- 选项中的 `timeCost`

迁移方式：

- `content` -> `contentBlocks`
- `effects` -> `actions`
- `timeCost` -> `actions: [{ "type": "advanceTime", "amount": n }]`

## 校验命令

内容改完至少运行：

```powershell
npm.cmd run validate:content
```

改动较大时建议再跑：

```powershell
npm.cmd run format:check
```

可选分析命令：

```powershell
npm.cmd run lint:content
npm.cmd run find:placeholders
npm.cmd run find:duplicate-copy
npm.cmd run find:undeclared-keys
```

## 交付检查清单

- 所有 `next` 都指向真实场景，或明确使用 `__lobby__`
- 所有规则中的 `goto` 都合法
- 没有空的 `text`、`speaker`、`eyebrow`、`aside`
- 没有占位文本、未完成场景或不可达场景
- 没有未声明的状态修改或条件引用
- `data/games.json` 与实际文件路径一致
- 新引用的 `items`、`clues` 已在 `collectibles` 中声明
- 校验通过
