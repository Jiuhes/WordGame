export function open(app) {
  const { showInfoModal, escapeHtml, GUIDE_PROMPT, els, log } = app;
  const html = `
    <div class="tool-layout">
      <aside class="tool-nav">
        <div class="tool-title">开发手册</div>
        <a href="#overview">项目架构</a>
        <a href="#structure">文件系统</a>
        <a href="#game">JSON 数据模板</a>
        <a href="#blocks">文本块 (Blocks)</a>
        <a href="#choices">交互与状态</a>
        <a href="#conditions">条件逻辑驱动</a>
        <a href="#validation">校验与发布</a>
        <a href="#ai-prompt" style="color:var(--color-sky-600);font-weight:700">AI 创作 Prompt</a>
      </aside>
      <div>
        <section class="tool-panel" id="overview">
          <div class="tool-title">架构概览</div>
          <h2>现代化文字游戏后端驱动</h2>
          <p>WordGame 采用 <strong>数据驱动渲染</strong> 架构。逻辑、文本、交互全由 JSON 定义，前端仅作为无状态的展示容器。</p>
          <div class="tool-note">所有内容均支持实时热重载。在大厅选择“本地文件”或“粘贴数据”即可预览。</div>
        </section>

        <section class="tool-panel" id="structure">
          <div class="tool-title">目录说明</div>
          <pre><code>/data/games/      # 存放游戏主体 JSON
/schemas/         # 校验规范 (AJV 支持)
/scripts/         # 内容自动化工具集
/assets/js/core/  # 运行时、状态机封装</code></pre>
        </section>

        <section class="tool-panel" id="game">
          <div class="tool-title">数据模板</div>
          <p>核心配置文件包含全局状态与场景树：</p>
          <pre><code>{
  "title": "作品标题",
  "status": [
    { "key": "exp", "label": "经验值", "value": 0 }
  ],
  "initialState": { "exp": 0 },
  "scenes": { ... }
}</code></pre>
        </section>

        <section class="tool-panel" id="blocks">
          <div class="tool-title">叙事块 (ContentBlocks)</div>
          <p>推荐使用 <code>contentBlocks</code> 实现富媒体渲染，支持多种预设 <code>type</code>：</p>
          <ul>
            <li><code>narrator</code>: 纯旁白</li>
            <li><code>dialogue</code>: 对话（支持 speaker）</li>
            <li><code>danger / safe / clue</code>: 带有特殊视觉强调的提示</li>
            <li><code>raw-html</code>: 直接渲染 HTML 源码（慎用）</li>
          </ul>
        </section>

        <section class="tool-panel" id="choices">
          <div class="tool-title">交互设计</div>
          <p>选项不仅是跳转，更是状态修改泵。通过 <code>effects</code> 修改全局变量，进而驱动后续的分支展现。</p>
        </section>

        <section class="tool-panel" id="conditions">
          <div class="tool-title">条件逻辑</div>
          <p>支持 <code>visibility</code> (物理消失) 和 <code>conditions</code> (可见 but 不可选)。</p>
          <p>支持复合逻辑 <code>all</code>, <code>any</code>, <code>not</code>。场景本身亦支持条件限制，不满足时将回退到错误页或大厅。</p>
        </section>

        <section class="tool-panel" id="validation">
          <div class="tool-title">部署检查</div>
          <p>发布前必须通过严苛的内容审计：</p>
          <pre><code>npm run validate:content # 结构与逻辑校验
npm run lint:content     # 低质量/占位符扫描</code></pre>
        </section>

        <section class="tool-panel" id="ai-prompt">
          <div class="tool-title">AI 生产力</div>
          <h2>让 AI 成为你的游戏主创</h2>
          <p class="tool-lead">将下方的指令完整复制并粘贴给 GPT-4 或 Claude 3，即可获得符合规范的生产级游戏剧本。</p>
          <pre style="background:#f0f9ff;border-color:#bae6fd"><code>${escapeHtml(GUIDE_PROMPT)}</code></pre>
          <div class="tool-actions">
            <button type="button" class="system-modal-btn primary" id="copyGuidePromptBtn">一键复制创作指令</button>
          </div>
        </section>
      </div>
    </div>`;

  showInfoModal({
    title: "制作指南",
    menu: "指南",
    status: "就绪",
    hint: "指南",
    size: "xwide",
    html,
    afterRender(container) {
      const copyBtn = container.querySelector("#copyGuidePromptBtn");
      if (copyBtn) {
        copyBtn.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(GUIDE_PROMPT);
            els.modalStatusHint.textContent = "提示词已复制";
          } catch (error) {
            log(`copy prompt failed: ${error.message}`);
            els.modalStatusHint.textContent = "复制失败";
          }
        });
      }
    },
  });
}
