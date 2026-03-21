function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

function renderConditionNode(node, escapeHtml) {
  if (!node) {
    return '<div class="graph-muted">无</div>';
  }
  if (node.type === "rule") {
    return `<div class="author-condition-row ${node.passed ? "pass" : "fail"}"><span>${escapeHtml(
      `${node.key} ${node.op} ${JSON.stringify(node.expected)}`,
    )}</span><span>${escapeHtml(JSON.stringify(node.actual))}</span><span>${node.passed ? "通过" : "拒绝"}</span></div>`;
  }
  if (node.type === "not") {
    return `<div class="author-condition-group ${node.passed ? "pass" : "fail"}"><div class="author-condition-label">逻辑取反 (NOT)</div>${renderConditionNode(
      node.item,
      escapeHtml,
    )}</div>`;
  }
  const items = (node.items || [])
    .map((item) => renderConditionNode(item, escapeHtml))
    .join("");
  const typeMap = {
    all: "全部满足 (ALL)",
    any: "任意满足 (ANY)",
  };
  return `<div class="author-condition-group ${node.passed ? "pass" : "fail"}"><div class="author-condition-label">${escapeHtml(
    typeMap[node.type] || node.type.toUpperCase(),
  )}</div>${items}</div>`;
}

export function open(app) {
  const { state, els, openModal, escapeHtml, log, runtime } = app;

  openModal({
    title: "创作者模式",
    menu: "创作者模式",
    status: state.currentGame ? "就绪" : "未选择游戏",
    hint: state.currentGame?.id || "请选择游戏",
    size: "xwide",
    render(container) {
      function renderEmpty() {
        const gameOptions = state.games
          .map(
            (game) =>
              `<option value="${escapeHtml(game.id)}">${escapeHtml(game.name || game.id)}</option>`,
          )
          .join("");

        container.innerHTML = `
          <div class="author-layout">
            <section class="tool-panel tool-panel-author">
              <div class="tool-title">加载已注册的游戏</div>
              <p class="tool-lead">可以在不退出创作者模式的情况下直接测试不同游戏的数据索引。</p>
              <div class="author-controls">
                <select id="authorGameSelect" class="graph-select">${gameOptions}</select>
                <button type="button" id="authorLoadGameBtn" class="graph-button">执行加载</button>
              </div>
              <div class="author-note">系统会自动进行基础容错与文件依赖校验。</div>
            </section>
          </div>
        `;

        container
          .querySelector("#authorLoadGameBtn")
          ?.addEventListener("click", async () => {
            const selectedId =
              container.querySelector("#authorGameSelect")?.value || "";
            const meta = state.games.find((item) => item.id === selectedId);
            if (!meta) {
              return;
            }
            els.modalStatusText.textContent = "加载中";
            try {
              await runtime.loadGame(meta);
              els.modalStatusText.textContent = "就绪";
              els.modalStatusHint.textContent = meta.id;
              render();
            } catch (error) {
              log(`author load game failed: ${error.message}`);
              els.modalStatusText.textContent = "加载失败";
            }
          });
      }

      function render() {
        if (!state.currentGame) {
          renderEmpty();
          return;
        }

        const sceneOptions = Object.keys(state.currentGame.scenes)
          .map(
            (sceneId) =>
              `<option value="${escapeHtml(sceneId)}"${sceneId === state.currentSceneId ? " selected" : ""}>${escapeHtml(sceneId)}</option>`,
          )
          .join("");
        const gameOptions = state.games
          .map(
            (game) =>
              `<option value="${escapeHtml(game.id)}"${game.id === state.currentGame.id ? " selected" : ""}>${escapeHtml(game.name || game.id)}</option>`,
          )
          .join("");
        const currentScene = runtime.getCurrentSceneData();
        const saveData = runtime.getCurrentSaveData();
        const snapshot = runtime.getDebugSnapshot();
        const choiceCards = snapshot.choices.length
          ? snapshot.choices
              .map(
                (choice) => `
                  <article class="author-choice-card">
                    <div class="author-choice-heading">
                      <strong>${escapeHtml(choice.text || "(未命名的选项)")}</strong>
                      <span>${choice.availability.enabled ? "判断为启用" : "判断为拦截"}</span>
                    </div>
                    <div class="author-choice-meta">目标端点: ${escapeHtml(choice.next || "(原状态保持)")}</div>
                    <div class="author-choice-meta">仅限一次: ${choice.once ? "是" : "否"} / 本轮已消耗: ${choice.hasChosenOnce ? "是" : "否"}</div>
                    ${
                      choice.availability.reason
                        ? `<div class="author-choice-meta">失败原因: ${escapeHtml(choice.availability.reason)}</div>`
                        : ""
                    }
                    <div class="author-condition-block">
                      <div class="author-condition-title">视觉阻断条件 (visibility)</div>
                      ${renderConditionNode(choice.visibility, escapeHtml)}
                    </div>
                    <div class="author-condition-block">
                      <div class="author-condition-title">逻辑挂起条件 (conditions)</div>
                      ${renderConditionNode(choice.conditions, escapeHtml)}
                    </div>
                  </article>`,
              )
              .join("")
          : '<div class="graph-muted">审查显示，当前场景内部未注册任何分支选项对象。</div>';

        const historyRows = state.history.length
          ? state.history
              .slice()
              .reverse()
              .map(
                (entry) => `<tr>
                  <td>${escapeHtml(entry.from || "")}</td>
                  <td>${escapeHtml(entry.text || "")}</td>
                  <td>${escapeHtml(entry.to || "")}</td>
                </tr>`,
              )
              .join("")
          : '<tr><td colspan="3">当前未记录任何跳转历史栈。</td></tr>';

        container.innerHTML = `
          <div class="author-layout">
            <section class="tool-panel tool-panel-author">
              <div class="tool-title">时空游标</div>
              <p class="tool-lead">一个面板控制核心主轴：强制加载实例、跳转特定场景分支并注入系统热重载。</p>
              <div class="author-controls">
                <select id="authorGameSelect" class="graph-select">${gameOptions}</select>
                <button type="button" id="authorLoadGameBtn" class="graph-button">硬重载剧本</button>
              </div>
              <div class="author-controls">
                <select id="authorSceneSelect" class="graph-select">${sceneOptions}</select>
                <button type="button" id="authorJumpBtn" class="graph-button">虫洞跳转</button>
              </div>
              <div class="author-note">剧本代号：${escapeHtml(state.currentGame.id)} / 焦点场景：${escapeHtml(
                state.currentSceneId || state.currentGame.entryScene,
              )}</div>
            </section>

            <section class="tool-panel tool-panel-author">
              <div class="tool-title">全局状态断点注入</div>
              <textarea id="authorStateInput" class="system-modal-textarea author-textarea">${escapeHtml(
                formatJson(state.runtimeState),
              )}</textarea>
              <div class="author-controls">
                <button type="button" id="authorApplyStateBtn" class="graph-button">覆写当前内存树</button>
              </div>
            </section>

            <section class="tool-panel tool-panel-author">
              <div class="tool-title">自动存档内存堆快照</div>
              <pre class="author-json"><code>${escapeHtml(formatJson(saveData))}</code></pre>
            </section>

            <section class="tool-panel tool-panel-author">
              <div class="tool-title">时序执行栈追踪</div>
              <div class="author-table-wrap">
                <table class="author-table">
                  <thead><tr><th>触发源</th><th>触媒记录</th><th>目标着陆点</th></tr></thead>
                  <tbody>${historyRows}</tbody>
                </table>
              </div>
            </section>

            <section class="tool-panel tool-panel-author">
              <div class="tool-title">全局场景拦截器状态</div>
              <div class="author-condition-block">
                <div class="author-condition-title">全局级入口放行阈值</div>
                ${renderConditionNode(snapshot.scene?.conditions, escapeHtml)}
              </div>
              ${
                snapshot.scene?.disabledReason
                  ? `<div class="author-note">拦截系统广播: ${escapeHtml(snapshot.scene.disabledReason)}</div>`
                  : ""
              }
            </section>

            <section class="tool-panel tool-panel-author">
              <div class="tool-title">可用节点分支验证回溯报告</div>
              <div class="author-choice-list">${choiceCards}</div>
            </section>

            <section class="tool-panel tool-panel-author">
              <div class="tool-title">场景底层构建 JSON 代码审计</div>
              <pre class="author-json"><code>${escapeHtml(formatJson(currentScene))}</code></pre>
            </section>
          </div>
        `;

        container
          .querySelector("#authorLoadGameBtn")
          ?.addEventListener("click", async () => {
            const selectedId =
              container.querySelector("#authorGameSelect")?.value || "";
            const meta = state.games.find((item) => item.id === selectedId);
            if (!meta) {
              return;
            }
            els.modalStatusText.textContent = "装载节点中";
            try {
              await runtime.loadGame(meta);
              els.modalStatusText.textContent = "就绪";
              els.modalStatusHint.textContent = meta.id;
              render();
            } catch (error) {
              log(`author load game failed: ${error.message}`);
              els.modalStatusText.textContent = "装载失败";
            }
          });

        container
          .querySelector("#authorJumpBtn")
          ?.addEventListener("click", () => {
            const sceneId =
              container.querySelector("#authorSceneSelect")?.value;
            const ok = runtime.jumpToScene(sceneId);
            if (!ok) {
              els.modalStatusText.textContent = "跳转指令丢失";
              return;
            }
            els.modalStatusText.textContent = "节点已同步";
            els.modalStatusHint.textContent = sceneId;
            render();
          });

        container
          .querySelector("#authorApplyStateBtn")
          ?.addEventListener("click", () => {
            const stateInput = container.querySelector("#authorStateInput");
            try {
              const nextState = JSON.parse(stateInput.value);
              const ok = runtime.replaceRuntimeState(nextState);
              if (!ok) {
                els.modalStatusText.textContent = "应用状态树拒绝";
                return;
              }
              els.modalStatusText.textContent = "状态树核准并接入";
              render();
            } catch (error) {
              log(`author state parse failed: ${error.message}`);
              els.modalStatusText.textContent = "非法的 JSON 解码";
            }
          });
      }

      render();
    },
  });
}
