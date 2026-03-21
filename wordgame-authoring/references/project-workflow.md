# 项目工作流

## 目标

编写能直接在这个仓库运行的 JSON 文字游戏。

## 关键文件

- 游戏索引：`data/games.json`
- 游戏正文：`data/games/<id>.json`
- 主 schema：`schemas/game.schema.json`
- 索引 schema：`schemas/games.schema.json`
- 模板：`data/templates/game.template.json`
- 校验脚本：`scripts/validate-content.mjs`
- 可选脚手架：`scripts/new-game.mjs`

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
6. 编写 `scenes`。
7. 运行校验。

## 顶层结构

顶层至少应包含：

- `title`
- `entryScene`
- `scenes`

通常还应包含：

- `subtitle`
- `status`
- `initialState`

## scene 结构

每个场景通常包含：

- `title`
- `contentBlocks`
- `choices`

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

通常还应包含：

- `next`

可选控制字段：

- `effects`
- `conditions`
- `visibility`
- `disabledReason`
- `once`
- `reset`

语义约定：

- `visibility`：条件不满足时，选项直接隐藏
- `conditions`：条件不满足时，选项显示但禁用
- `once`：成功执行一次后禁用
- `reset`：常用于结局后重新开始

## 状态设计规则

- 所有可变值先在 `initialState` 声明。
- 所有需要展示为状态条的值同步写进 `status`。
- 不要修改未声明的键。
- 条件表达式引用的键必须存在，否则校验失败。

## 校验命令

内容改完至少运行：

```powershell
node scripts/validate-content.mjs
```

改动较大时建议再跑：

```powershell
npm.cmd run format:check
```

可选分析命令：

```powershell
node scripts/content-lint.mjs
node scripts/find-placeholder-scenes.mjs
node scripts/find-duplicate-copy.mjs
node scripts/find-undeclared-status-keys.mjs
```

## 交付检查清单

- 所有 `next` 都指向真实场景，或明确使用 `__lobby__`
- 没有空的 `text`、`speaker`、`eyebrow`、`aside`
- 没有占位文本或未完成场景
- 没有未声明的状态修改或条件引用
- `data/games.json` 与实际文件路径一致
- 校验通过
