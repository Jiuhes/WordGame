function countEndingScenes(rawGame) {
  return Object.values(rawGame?.scenes || {}).filter((scene) => {
    const choices = Array.isArray(scene?.choices) ? scene.choices : [];
    if (!choices.length) {
      return true;
    }
    return choices.every(
      (choice) =>
        choice?.reset ||
        choice?.next === "__lobby__" ||
        choice?.next === rawGame?.entryScene,
    );
  }).length;
}

export function open(app) {
  const { state, openModal, fetchJson, escapeHtml, storage } = app;

  openModal({
    title: "统计",
    menu: "统计",
    status: "就绪",
    hint: state.currentGame?.id || "选择游戏",
    size: "wide",
    render(container) {
      async function render(selectedId) {
        const games = state.games;
        const gameId =
          selectedId || state.currentGame?.id || games[0]?.id || "";
        const meta = games.find((game) => game.id === gameId);
        const rawGame = meta ? await fetchJson(meta.file) : null;
        const totalEndings = rawGame ? countEndingScenes(rawGame) : 0;
        const stats = gameId
          ? storage.getEndingStats(gameId)
          : { discoveredEndings: [], totalRuns: 0 };
        const discovered = stats.discoveredEndings || [];
        const percent = totalEndings
          ? Math.round((discovered.length / totalEndings) * 100)
          : 0;

        container.innerHTML = `
          <div class="tool-panel tool-panel-stats">
            <div class="tool-title">成就与统计</div>
            <p class="tool-lead">追踪你在各个游戏中的结局发现进度、总体收集度与总游玩次数。</p>
            <div class="author-controls">
              <label class="graph-label" for="statsGameSelect">选择游戏</label>
              <select id="statsGameSelect" class="graph-select">
                ${games
                  .map(
                    (game) =>
                      `<option value="${escapeHtml(game.id)}"${
                        game.id === gameId ? " selected" : ""
                      }>${escapeHtml(game.name || game.id)}</option>`,
                  )
                  .join("")}
              </select>
            </div>
            <div class="graph-summary">
              <div class="graph-pill">已解锁结局: ${discovered.length}</div>
              <div class="graph-pill">总结局数: ${totalEndings}</div>
              <div class="graph-pill">收集度: ${percent}%</div>
              <div class="graph-pill">累计游玩: ${stats.totalRuns || 0}</div>
            </div>
            <div class="author-table-wrap">
              <table class="author-table">
                <thead><tr><th>结局节点</th><th>名称</th><th>达成时间</th></tr></thead>
                <tbody>
                  ${
                    discovered.length
                      ? discovered
                          .map(
                            (item) =>
                              `<tr><td>${escapeHtml(item.sceneId)}</td><td>${escapeHtml(
                                item.title || item.sceneId,
                              )}</td><td>${escapeHtml(
                                item.at
                                  ? new Date(item.at).toLocaleString()
                                  : "-",
                              )}</td></tr>`,
                          )
                          .join("")
                      : '<tr><td colspan="3">暂无已记录的结局</td></tr>'
                  }
                </tbody>
              </table>
            </div>
          </div>
        `;

        container
          .querySelector("#statsGameSelect")
          ?.addEventListener("change", (event) => render(event.target.value));
      }

      render();
    },
  });
}
