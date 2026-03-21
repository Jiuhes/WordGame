function describeEdgeRules(edge, escapeHtml) {
  const flags = [];
  if (edge.visibility) flags.push("visibility");
  if (edge.conditions) flags.push("conditions");
  if (edge.once) flags.push("once");
  if (edge.disabledReason) flags.push("disabled-reason");
  if (!flags.length) return "";
  return `<div class="graph-choice-meta">${flags
    .map((flag) => `<span class="graph-badge">${escapeHtml(flag)}</span>`)
    .join("")}</div>`;
}

export function open(app) {
  const {
    state,
    els,
    openModal,
    fetchJson,
    escapeHtml,
    normalizeText,
    makeGraphData,
    getPrimaryPath,
    getVisibleOutgoing,
    renderSceneCard,
    getScenePreview,
    DEFAULT_BRANCH_SIZE,
  } = app;

  openModal({
    title: "节点图谱",
    menu: "节点图谱",
    status: "就绪",
    hint: "图谱",
    size: "xwide",
    render(container) {
      const gameOptions = state.games
        .map(
          (game) =>
            `<option value="${escapeHtml(game.id)}">${escapeHtml(game.name || game.id)}</option>`,
        )
        .join("");

      container.innerHTML = `
        <div class="graph-toolbar">
          <div class="graph-toolbar-row">
            <label class="graph-label" for="graphGameSelect">剧本</label>
            <select id="graphGameSelect" class="graph-select">${gameOptions}</select>
            <button type="button" id="graphLoadBtn" class="graph-button">载入图谱</button>
            <label class="graph-label" for="graphBranchSizeSelect">单页分支数</label>
            <select id="graphBranchSizeSelect" class="graph-select">
              <option value="8">8</option>
              <option value="12" selected>12</option>
              <option value="24">24</option>
              <option value="48">48</option>
            </select>
            <label class="graph-label" for="graphSearchInput">关键字搜索</label>
            <input id="graphSearchInput" class="graph-input" type="text" placeholder="匹配 ID / 标题 / 选项文本">
          </div>
          <div class="graph-toolbar-note">节点图谱将视觉焦点锁定在你当前行进的路径之上。系统会自动标注出未能抵达的盲区、承载过重的广域节点、条件判定死锁以及中断的边缘链表。</div>
        </div>
        <div class="graph-summary" id="graphSummary"></div>
        <div class="graph-board" id="graphBoard"><div class="graph-empty">请先指定一款剧本来解析它的底层拓扑节点图网络。</div></div>
        <div class="graph-inspector" id="graphInspector"><h2>场景审查器</h2><p>点击图谱中的任意节点，深潜审查其溯源路径、分支健康度评级以及全局控制变量锁。</p></div>
      `;

      const graphEls = {
        gameSelect: container.querySelector("#graphGameSelect"),
        loadBtn: container.querySelector("#graphLoadBtn"),
        branchSizeSelect: container.querySelector("#graphBranchSizeSelect"),
        searchInput: container.querySelector("#graphSearchInput"),
        summary: container.querySelector("#graphSummary"),
        board: container.querySelector("#graphBoard"),
        inspector: container.querySelector("#graphInspector"),
      };

      graphEls.branchSizeSelect.value = String(state.graph.branchPageSize);
      graphEls.searchInput.value = state.graph.searchKeyword;

      function renderSummary(graph) {
        graphEls.summary.innerHTML = [
          `当前挂载: ${graph.game.title || graph.meta.name || graph.meta.id}`,
          `有效场景总计: ${graph.stats.scenes}`,
          `可达结局总数: ${graph.stats.endings}`,
          `未闭合死角: ${graph.stats.deadEnds}`,
          `超载过量节点: ${graph.stats.oversized}`,
          `附带拦截条件场景: ${graph.stats.conditional}`,
          `完全不可达暗区: ${graph.stats.unreachable}`,
          `断裂指针链: ${graph.stats.brokenEdges}`,
          `初始化切入点: ${graph.entryScene}`,
        ]
          .map((item) => `<div class="graph-pill">${escapeHtml(item)}</div>`)
          .join("");
      }

      function renderInspector() {
        const graph = state.graph.current;
        const sceneId = state.graph.selectedSceneId;
        if (!graph || !sceneId || !graph.scenes[sceneId]) {
          graphEls.inspector.innerHTML =
            "<h2>场景审查器</h2><p>点击图谱中的任意节点，深潜审查其溯源路径、分支健康度评级以及全局控制变量锁。</p>";
          return;
        }
        const scene = graph.scenes[sceneId];
        const incoming = graph.incoming.get(sceneId) || [];
        const outgoing = graph.outgoing.get(sceneId) || [];
        const path = getPrimaryPath(graph, sceneId);
        const visible = getVisibleOutgoing(graph, sceneId, state.graph);
        graphEls.inspector.innerHTML = `
          <h2>${escapeHtml(scene.title || sceneId)}</h2>
          <p><strong>底层索引 ID:</strong> ${escapeHtml(sceneId)}</p>
          <p><strong>推荐抵达路径:</strong> ${escapeHtml(path.join(" -> "))}</p>
          <p><strong>预览摘要:</strong> ${escapeHtml(getScenePreview(scene))}</p>
          <p><strong>传入向量 (Incoming):</strong> ${incoming.length}</p>
          <p><strong>传出向量 (Outgoing):</strong> ${outgoing.length}</p>
          <p><strong>当前可见分支过滤比:</strong> ${visible.visible.length} / ${visible.filtered.length}</p>
          ${
            scene.conditions
              ? `<div class="tool-note"><strong>scene.conditions</strong><pre>${escapeHtml(
                  JSON.stringify(scene.conditions, null, 2),
                )}</pre></div>`
              : ""
          }
          ${
            scene.disabledReason
              ? `<div class="tool-note"><strong>disabledReason</strong><div>${escapeHtml(scene.disabledReason)}</div></div>`
              : ""
          }
        `;
      }

      function bindSceneClicks() {
        graphEls.board
          .querySelectorAll("[data-scene-id]")
          .forEach((element) => {
            element.addEventListener("click", () => {
              if (!state.graph.current?.scenes[element.dataset.sceneId]) {
                return;
              }
              state.graph.selectedSceneId = element.dataset.sceneId;
              if (
                !state.graph.expandedBranches.has(state.graph.selectedSceneId)
              ) {
                state.graph.expandedBranches.set(
                  state.graph.selectedSceneId,
                  state.graph.branchPageSize,
                );
              }
              update();
            });
          });
      }

      function update() {
        const graph = state.graph.current;
        if (
          !graph ||
          !state.graph.selectedSceneId ||
          !graph.scenes[state.graph.selectedSceneId]
        ) {
          graphEls.board.innerHTML =
            '<div class="graph-empty">你还未在图谱空间中锁定任何探测节点。</div>';
          renderInspector();
          return;
        }

        renderSummary(graph);
        const path = getPrimaryPath(graph, state.graph.selectedSceneId);
        const scene = graph.scenes[state.graph.selectedSceneId];
        const incoming = graph.incoming.get(state.graph.selectedSceneId) || [];
        const visible = getVisibleOutgoing(
          graph,
          state.graph.selectedSceneId,
          state.graph,
        );

        graphEls.board.innerHTML = `
          <div class="graph-focus-grid">
            <section class="graph-panel">
              <div class="graph-panel-title">行进推荐路径</div>
              <div class="graph-stack">${path
                .map((sceneId) =>
                  renderSceneCard(graph, sceneId, state.graph, {
                    classes: ["compact", "path-node"],
                  }),
                )
                .join("")}</div>
            </section>
            <section class="graph-panel">
              <div class="graph-panel-title">主焦点场景</div>
              <div class="graph-current-card">
                <div class="graph-current-title">${escapeHtml(
                  scene.title || state.graph.selectedSceneId,
                )}</div>
                <div class="graph-current-subtitle">索引 ID: ${escapeHtml(
                  state.graph.selectedSceneId,
                )} | 汇聚汇点: ${incoming.length} | 辐射扇出: ${
                  (graph.outgoing.get(state.graph.selectedSceneId) || []).length
                }</div>
                <div class="graph-breadcrumbs">${path
                  .map(
                    (sceneId) =>
                      `<button type="button" class="graph-breadcrumb" data-scene-id="${escapeHtml(sceneId)}">${escapeHtml(sceneId)}</button>`,
                  )
                  .join("")}</div>
                <div class="graph-current-copy">${escapeHtml(getScenePreview(scene))}</div>
                ${
                  scene.conditions
                    ? `<div class="tool-note"><strong>scene.conditions</strong><pre>${escapeHtml(
                        JSON.stringify(scene.conditions, null, 2),
                      )}</pre></div>`
                    : ""
                }
                ${
                  scene.disabledReason
                    ? `<div class="tool-note"><strong>disabledReason</strong><div>${escapeHtml(
                        scene.disabledReason,
                      )}</div></div>`
                    : ""
                }
              </div>
            </section>
            <section class="graph-panel">
              <div class="graph-panel-title">扇出辐射直连分支</div>
              <div class="graph-muted">当前焦点探测域向外拥有 ${visible.all.length} 条有效辐射连接${
                state.graph.searchKeyword
                  ? `，经条件约束隔离后剩余可见 ${visible.filtered.length} 条`
                  : ""
              }。</div>
              ${
                visible.visible.length
                  ? `<div class="graph-branch-list">${visible.visible
                      .map(
                        (edge) =>
                          `<div class="graph-branch-item"><div class="graph-choice-text">${escapeHtml(
                            edge.text || "(未命名分支指令)",
                          )}</div>${describeEdgeRules(edge, escapeHtml)}${
                            edge.disabledReason
                              ? `<div class="graph-muted">失败原因捕获: ${escapeHtml(edge.disabledReason)}</div>`
                              : ""
                          }${
                            graph.scenes[edge.to]
                              ? renderSceneCard(graph, edge.to, state.graph, {
                                  classes: ["compact"],
                                })
                              : `<div class="graph-node problem compact"><div class="graph-node-id">${escapeHtml(
                                  edge.to,
                                )}</div><div class="graph-node-title">指针挂起断裂（目标不存或受损）</div></div>`
                          }<div class="graph-branch-actions"><button type="button" class="graph-link-button" data-scene-id="${escapeHtml(
                            edge.to,
                          )}">追溯此分支向外</button></div></div>`,
                      )
                      .join("")}</div>`
                  : '<div class="graph-empty">在当前的严格约束过滤条件下，没有发现任何可安全跃迁的下级分支。</div>'
              }
              <div class="graph-branch-actions">
                ${visible.hiddenCount ? `<button type="button" id="graphExpandBranchesBtn" class="graph-button">揭示更多隐匿分支 (${visible.hiddenCount})</button>` : ""}
                ${
                  (state.graph.expandedBranches.get(
                    state.graph.selectedSceneId,
                  ) || state.graph.branchPageSize) > state.graph.branchPageSize
                    ? '<button type="button" id="graphCollapseBranchesBtn" class="graph-button">限制回退</button>'
                    : ""
                }
              </div>
            </section>
          </div>`;

        bindSceneClicks();

        graphEls.board
          .querySelector("#graphExpandBranchesBtn")
          ?.addEventListener("click", () => {
            const current =
              state.graph.expandedBranches.get(state.graph.selectedSceneId) ||
              state.graph.branchPageSize;
            state.graph.expandedBranches.set(
              state.graph.selectedSceneId,
              current + state.graph.branchPageSize,
            );
            update();
          });

        graphEls.board
          .querySelector("#graphCollapseBranchesBtn")
          ?.addEventListener("click", () => {
            state.graph.expandedBranches.set(
              state.graph.selectedSceneId,
              state.graph.branchPageSize,
            );
            update();
          });

        renderInspector();
        els.modalStatusHint.textContent = `视图占比 ${visible.visible.length} / 总计匹配数 ${visible.filtered.length}`;
      }

      async function loadSelectedGame() {
        const meta = state.games.find(
          (item) => item.id === graphEls.gameSelect.value,
        );
        if (!meta) {
          return;
        }
        els.modalStatusText.textContent = "装载中";
        const rawGame = await fetchJson(meta.file);
        state.graph.current = makeGraphData(rawGame, meta);
        state.graph.selectedSceneId = state.graph.current.entryScene;
        state.graph.expandedBranches = new Map([
          [state.graph.selectedSceneId, state.graph.branchPageSize],
        ]);
        update();
        els.modalStatusText.textContent = "就绪";
      }

      graphEls.loadBtn.addEventListener("click", () => {
        loadSelectedGame().catch((error) => {
          graphEls.board.innerHTML = `<div class="graph-empty">源文件拓扑结构崩溃失败: ${escapeHtml(error.message)}</div>`;
          els.modalStatusText.textContent = "装载失败";
        });
      });

      graphEls.branchSizeSelect.addEventListener("change", () => {
        state.graph.branchPageSize =
          Number(graphEls.branchSizeSelect.value) || DEFAULT_BRANCH_SIZE;
        state.graph.expandedBranches.set(
          state.graph.selectedSceneId,
          state.graph.branchPageSize,
        );
        update();
      });

      graphEls.searchInput.addEventListener("input", () => {
        state.graph.searchKeyword = normalizeText(graphEls.searchInput.value);
        update();
      });

      if (!state.graph.current && state.games.length) {
        graphEls.gameSelect.value = state.games[0].id;
        loadSelectedGame().catch(() => {});
      } else {
        if (state.graph.current) {
          graphEls.gameSelect.value = state.graph.current.meta.id;
        }
        update();
      }
    },
  });
}
