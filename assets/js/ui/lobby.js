export function createLobbyController({
  state,
  els,
  log,
  escapeHtml,
  fetchJson,
  normalizeGamesIndex,
  getGameStats,
  getLatestSave,
  onSelectGame,
  onResumeGame,
}) {
  function getLobbySummary(games) {
    return games.reduce(
      (summary, game) => {
        const stats = getGameStats ? getGameStats(game.id) : null;
        const latestSave = getLatestSave ? getLatestSave(game.id) : null;
        summary.totalRuns += Number(stats?.totalRuns || 0);
        summary.discovered += Number(stats?.discoveredEndings?.length || 0);
        if (
          latestSave &&
          (!summary.latestSave ||
            Number(latestSave.updatedAt || 0) >
              Number(summary.latestSave.updatedAt || 0))
        ) {
          summary.latestSave = {
            ...latestSave,
            gameName: game.name,
          };
        }
        return summary;
      },
      { totalRuns: 0, discovered: 0, latestSave: null },
    );
  }

  function setFileMenuOpen(open) {
    els.fileMenuDropdown.classList.toggle("open", open);
    els.fileMenuTrigger.setAttribute("aria-expanded", open ? "true" : "false");
  }

  async function renderLobby() {
    els.gameList.innerHTML = "<div class='loading'>正在加载游戏列表...</div>";
    try {
      const rawIndex = await fetchJson("data/games.json");
      const available = normalizeGamesIndex(rawIndex);
      const lobbySummary = getLobbySummary(available);
      state.games = available;
      els.gameCount.textContent = `${available.length} 个游戏`;

      const gameCards = available
        .map((game) => {
          const desc = game.category
            ? `${game.category} | ${game.desc}`
            : game.desc;
          const stats = getGameStats ? getGameStats(game.id) : null;
          const latestSave = getLatestSave ? getLatestSave(game.id) : null;
          const totalEndings = stats?.totalEndings || 0;
          const discoveredEndings = stats?.discoveredEndings?.length || 0;
          const completion = totalEndings
            ? Math.round((discoveredEndings / totalEndings) * 100)
            : 0;
          const saveCopy = latestSave
            ? `<div class="game-save-meta">继续进度: ${escapeHtml(
                latestSave.currentSceneId,
              )} 路 ${escapeHtml(
                new Date(latestSave.updatedAt).toLocaleString(),
              )}</div>`
            : `<div class="game-save-meta is-empty">还没有可继续的进度。</div>`;
          const statsCopy = stats
            ? `<div class="game-card-stats">
                <span class="game-stat-pill">已解锁 ${discoveredEndings}${totalEndings ? ` / ${totalEndings}` : ""} 个结局</span>
                <span class="game-stat-pill">收集度 ${completion}%</span>
              </div>`
            : "";
          const actions = latestSave
            ? `<div class="game-card-actions">
                <button class="game-mini-action" type="button" data-resume-game-id="${escapeHtml(
                  game.id,
                )}">继续</button>
                <button class="game-mini-action" type="button" data-game-id="${escapeHtml(
                  game.id,
                )}">重开</button>
              </div>`
            : `<div class="game-card-actions"><span class="game-mini-hint">从头开始</span></div>`;
          const badge = game.category
            ? `<div class="game-card-topline"><span class="game-category-badge">${escapeHtml(game.category)}</span><span class="game-id-tag">${escapeHtml(game.id)}</span></div>`
            : `<div class="game-card-topline"><span class="game-id-tag">${escapeHtml(game.id)}</span></div>`;
          return `<div class="game-item" data-game-id="${escapeHtml(game.id)}">
            <div class="game-icon">${escapeHtml(game.icon)}</div>
            <div class="game-meta">
              ${badge}
              <div class="game-name">${escapeHtml(game.name)}</div>
              <div class="game-desc">${escapeHtml(desc)}</div>
              ${saveCopy}
              ${statsCopy}
              ${actions}
            </div>
          </div>`;
        })
        .join("");

      const latestSaveCopy = lobbySummary.latestSave
        ? `<div class="lobby-intro-footnote">最近一次停在 <strong>${escapeHtml(
            lobbySummary.latestSave.gameName,
          )}</strong> 路 ${escapeHtml(
            new Date(lobbySummary.latestSave.updatedAt).toLocaleString(),
          )}</div>`
        : `<div class="lobby-intro-footnote">还没有本地存档，可以从游戏大厅直接开始。</div>`;

      els.gameList.innerHTML = `
        <section class="lobby-intro" aria-label="游戏大厅概览">
          <div class="lobby-intro-copy">
            <div class="lobby-intro-eyebrow">WORDGAME OS</div>
            <h2 class="lobby-intro-title">从值夜开始，不从说明书开始</h2>
            <p class="lobby-intro-text">这里直接展示你能玩的内容、最近进度和结局收集情况。进入后所有选择都会实时记录，不需要额外操作。</p>
            ${latestSaveCopy}
          </div>
          <div class="lobby-summary" aria-label="玩家进度摘要">
            <div class="lobby-summary-card">
              <span class="lobby-summary-label">可玩剧本</span>
              <strong class="lobby-summary-value">${escapeHtml(available.length)}</strong>
            </div>
            <div class="lobby-summary-card">
              <span class="lobby-summary-label">累计游玩</span>
              <strong class="lobby-summary-value">${escapeHtml(lobbySummary.totalRuns)}</strong>
            </div>
            <div class="lobby-summary-card">
              <span class="lobby-summary-label">已见结局</span>
              <strong class="lobby-summary-value">${escapeHtml(lobbySummary.discovered)}</strong>
            </div>
          </div>
        </section>
        <section class="lobby-library" aria-label="游戏列表">
          <div class="lobby-library-title">选择一个入口继续</div>
          <div class="lobby-game-grid">${gameCards}</div>
        </section>
      `;

      els.gameList.querySelectorAll("[data-game-id]").forEach((item) => {
        item.addEventListener("click", () => {
          const game = available.find(
            (entry) => entry.id === item.dataset.gameId,
          );
          if (game) {
            onSelectGame(game);
          }
        });
      });
      els.gameList.querySelectorAll("[data-resume-game-id]").forEach((item) => {
        item.addEventListener("click", (event) => {
          event.stopPropagation();
          const game = available.find(
            (entry) => entry.id === item.dataset.resumeGameId,
          );
          if (game) {
            onResumeGame ? onResumeGame(game) : onSelectGame(game);
          }
        });
      });
    } catch (error) {
      log(`renderLobby failed: ${error.message}`);
      els.gameList.innerHTML = `<div class='text danger'>无法加载 data/games.json: ${escapeHtml(error.message)}</div>`;
    }
  }

  return {
    setFileMenuOpen,
    renderLobby,
  };
}
