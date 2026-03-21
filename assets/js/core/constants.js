export const STORAGE_PREFIX = "wordgame:";
export const DEFAULT_ENTRY_SCENE = "intro";
export const SERVER_UPLOAD_ENDPOINT_KEY = "wordgame:server-upload-endpoint";
export const DEFAULT_BRANCH_SIZE = 12;

export const GUIDE_PROMPT = `你是一个顶级文字游戏策划和架构师。请为 WordGame 项目生成一个逻辑严密、结构完整的游戏 JSON 文件。

核心规范：
1. 输出格式：必须是单一的、合法的 JSON 对象，严禁包含 Markdown 代码块标签、注释或任何解释性文字。
2. 游戏信息：包含 title (必填), subtitle (可选), entryScene (必填), status (状态列定义), initialState (初始值)。
3. 场景结构 (scenes)：
   - 必须使用 contentBlocks 数组（不再使用 content 字符串）。
   - 每个 block 包含 type ("narrator", "dialogue", "danger", "safe", "clue", "item", "ghost", "hero", "rival", "secret") 和 text。
   - block 支持可选字段：speaker (说话人), eyebrow (标签), emphasis ("low"|"medium"|"high"), aside (侧边说明)。
4. 交互逻辑 (choices)：
   - 每个选项包含 text (显示文字) 和 next (目标场景 ID)。
   - effects: 修改 initialState 中定义的数值。
   - visibility: 满足条件才可见（使用 key/op/value 结构）。
   - conditions: 不满足时禁用并显示 disabledReason。
   - once: 选项只能执行一次。
5. 逻辑完整性：确保所有 next 指向的 ID 在 scenes 中都真实存在。严禁使用 TODO 或占位符。

示例结构参考：
{
  "title": "示例游戏",
  "entryScene": "intro",
  "status": [{ "key": "hp", "label": "生命", "value": 100, "max": 100 }],
  "initialState": { "hp": 100 },
  "scenes": {
    "intro": {
      "title": "起点",
      "contentBlocks": [
        { "type": "narrator", "eyebrow": "楔子", "text": "故事从此开始。" }
      ],
      "choices": [
        { "text": "踏上旅程", "next": "village" }
      ]
    }
  }
}`;
